#include <napi.h>
#include <windows.h>
#include <stdio.h>
#include <thread>
#include <queue>
#include <mutex>
#include <shlwapi.h>
#include "iCUESDK.h"

#pragma comment(lib, "shlwapi.lib")

// Global state
static HMODULE g_iCueModule = NULL;
static Napi::ThreadSafeFunction g_tsfn;
static std::queue<CorsairEvent> g_eventQueue;
static std::mutex g_queueMutex;
static bool g_subscribed = false;

// Forward declarations of SDK function pointers
typedef CorsairError (*CorsairConnectFn)(CorsairSessionStateChangedHandler onStateChanged, void *context);
typedef CorsairError (*CorsairDisconnectFn)(void);
typedef CorsairError (*CorsairSubscribeForEventsFn)(CorsairEventHandler onEvent, void *context);
typedef CorsairError (*CorsairUnsubscribeFromEventsFn)(void);
typedef CorsairError (*CorsairSetLedColorsFn)(const CorsairDeviceId deviceId, int size, const CorsairLedColor *ledColors);
typedef CorsairError (*CorsairGetDevicesFn)(const CorsairDeviceFilter *filter, int sizeMax, CorsairDeviceInfo *devices, int *size);
typedef CorsairError (*CorsairRequestControlFn)(const CorsairDeviceId deviceId, CorsairAccessLevel accessLevel);

static CorsairConnectFn CorsairConnect_Fn = NULL;
static CorsairDisconnectFn CorsairDisconnect_Fn = NULL;
static CorsairSubscribeForEventsFn CorsairSubscribeForEvents_Fn = NULL;
static CorsairUnsubscribeFromEventsFn CorsairUnsubscribeFromEvents_Fn = NULL;
static CorsairSetLedColorsFn CorsairSetLedColors_Fn = NULL;
static CorsairGetDevicesFn CorsairGetDevices_Fn = NULL;
static CorsairRequestControlFn CorsairRequestControl_Fn = NULL;

// Session state callback
void SessionStateChangedHandler(void *context, const CorsairSessionStateChanged *eventData) {
  if (eventData && eventData->state == CSS_Connected) {
    // Subscribed for events once connected
    if (CorsairSubscribeForEvents_Fn) {
      CorsairSubscribeForEvents_Fn([](void *ctx, const CorsairEvent *event) {
        if (event) {
          // Log all event types to help identify wheel/button events
          fprintf(stderr, "[EVENT] Received event type: %d\n", event->id);
          
          if (event->id == CEI_KeyEvent && event->keyEvent) {
            fprintf(stderr, "[EVENT] KeyEvent - keyId: %d, isPressed: %d\n", 
                    (int)event->keyEvent->keyId, event->keyEvent->isPressed);
            std::lock_guard<std::mutex> lock(g_queueMutex);
            g_eventQueue.push(*event);
          }
        }
      }, NULL);
      g_subscribed = true;
    }
  }
}

// Load the iCUE SDK DLL
Napi::Boolean LoadSDK(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (g_iCueModule != NULL) {
    return Napi::Boolean::New(env, true);
  }

  // Try common iCUE SDK library paths
  char searchPaths[15][MAX_PATH];
  memset(searchPaths, 0, sizeof(searchPaths));
  int pathCount = 0;
  
  // Get the directory of this DLL (the module itself)
  char moduleDllPath[MAX_PATH];
  char dirPath[MAX_PATH];
  memset(moduleDllPath, 0, MAX_PATH);
  memset(dirPath, 0, MAX_PATH);
  HMODULE thisModule = NULL;
  
  if (GetModuleHandleEx(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS,
                        (LPCSTR)&LoadSDK, &thisModule) && thisModule) {
    if (GetModuleFileNameA(thisModule, moduleDllPath, MAX_PATH) > 0) {
      // Strip the long path prefix if present (\\?\C:\...)
      const char *pathStr = moduleDllPath;
      if (strncmp(moduleDllPath, "\\\\?\\", 4) == 0) {
        pathStr = moduleDllPath + 4;
      }
      
      // Remove filename, keep just the directory
      strncpy_s(dirPath, MAX_PATH, pathStr, _TRUNCATE);
      PathRemoveFileSpecA(dirPath);
      
      // Append iCUESDK.dll to the module directory
      sprintf_s(searchPaths[pathCount], MAX_PATH, "%s\\iCUESDK.dll", dirPath);
      fprintf(stderr, "[DEBUG] Module directory DLL: %s\n", searchPaths[pathCount]);
      pathCount++;
    }
  }
  
  // Add DLL search paths
  const char *staticPaths[] = {
    "iCUESDK.dll",
    ".\\iCUESDK.dll",
    "build\\Release\\iCUESDK.dll",
    "C:\\Program Files\\Corsair\\SDK\\iCUESDK.dll",
    "C:\\Program Files\\Corsair\\iCUESDK.dll",
    "C:\\Program Files\\Corsair\\Corsair iCUE5 Software\\iCUESDK.dll",
    "C:\\Program Files (x86)\\Corsair\\SDK\\iCUESDK.dll",
    "C:\\Program Files (x86)\\Corsair\\iCUESDK.dll",
    "C:\\Program Files\\Corsair\\CORSAIR iCUE 4\\system\\iCUESDK.dll",
    "C:\\Program Files\\Corsair\\CORSAIR iCUE\\system\\iCUESDK.dll",
  };
  
  for (size_t i = 0; i < sizeof(staticPaths) / sizeof(staticPaths[0]) && pathCount < 15; i++) {
    strncpy_s(searchPaths[pathCount], MAX_PATH, staticPaths[i], _TRUNCATE);
    pathCount++;
  }

  char errorMsg[512] = "";

  for (int i = 0; i < pathCount && i < 15; i++) {
    fprintf(stderr, "[DEBUG] Trying to load: %s\n", searchPaths[i]);
    g_iCueModule = LoadLibraryA(searchPaths[i]);
    if (g_iCueModule != NULL) {
      fprintf(stderr, "[DEBUG] Successfully loaded DLL from: %s\n", searchPaths[i]);
      
      // Load function pointers
      CorsairConnect_Fn = (CorsairConnectFn)GetProcAddress(g_iCueModule, "CorsairConnect");
      CorsairDisconnect_Fn = (CorsairDisconnectFn)GetProcAddress(g_iCueModule, "CorsairDisconnect");
      CorsairSubscribeForEvents_Fn = (CorsairSubscribeForEventsFn)GetProcAddress(g_iCueModule, "CorsairSubscribeForEvents");
      CorsairUnsubscribeFromEvents_Fn = (CorsairUnsubscribeFromEventsFn)GetProcAddress(g_iCueModule, "CorsairUnsubscribeFromEvents");
      CorsairSetLedColors_Fn = (CorsairSetLedColorsFn)GetProcAddress(g_iCueModule, "CorsairSetLedColors");
      CorsairGetDevices_Fn = (CorsairGetDevicesFn)GetProcAddress(g_iCueModule, "CorsairGetDevices");
      CorsairRequestControl_Fn = (CorsairRequestControlFn)GetProcAddress(g_iCueModule, "CorsairRequestControl");

      fprintf(stderr, "[DEBUG] Function pointers: Connect=%p, SetColors=%p\n", 
              CorsairConnect_Fn, CorsairSetLedColors_Fn);

      if (CorsairConnect_Fn && CorsairSetLedColors_Fn) {
        fprintf(stderr, "[DEBUG] SDK loaded successfully!\n");
        return Napi::Boolean::New(env, true);
      }
      fprintf(stderr, "[DEBUG] Failed to load function pointers from: %s\n", searchPaths[i]);
      FreeLibrary(g_iCueModule);
      g_iCueModule = NULL;
    } else {
      DWORD err = GetLastError();
      fprintf(stderr, "[DEBUG] Failed to load from %s (error: %d)\n", searchPaths[i], err);
    }
  }

  sprintf(errorMsg, "Could not load iCUE SDK. Tried all known paths. Ensure Corsair iCUE is installed and running.");
  Napi::Error::New(env, errorMsg).ThrowAsJavaScriptException();
  return Napi::Boolean::New(env, false);
}

// Connect to iCUE
Napi::Boolean Connect(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (!g_iCueModule || !CorsairConnect_Fn) {
    Napi::Error::New(env, "SDK not loaded. Call loadSDK() first.").ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  CorsairError err = CorsairConnect_Fn(SessionStateChangedHandler, NULL);
  return Napi::Boolean::New(env, err == CE_Success);
}

// Disconnect from iCUE
Napi::Boolean Disconnect(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  if (!g_iCueModule || !CorsairDisconnect_Fn) {
    return Napi::Boolean::New(env, false);
  }

  if (g_subscribed && CorsairUnsubscribeFromEvents_Fn) {
    CorsairUnsubscribeFromEvents_Fn();
    g_subscribed = false;
  }

  CorsairError err = CorsairDisconnect_Fn();
  return Napi::Boolean::New(env, err == CE_Success);
}

// Set LED color for a specific key
Napi::Boolean SetKeyColor(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 3) {
    Napi::TypeError::New(env, "setKeyColor requires 3 arguments").ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  if (!g_iCueModule || !CorsairSetLedColors_Fn) {
    Napi::Error::New(env, "SDK not loaded or connected").ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  // Argument 0: deviceId (string)
  std::string deviceId = info[0].As<Napi::String>();
  
  // Argument 1: ledLuid (number - combined group + key ID)
  uint32_t ledLuid = info[1].As<Napi::Number>().Uint32Value();
  
  // Argument 2: color object {r, g, b}
  Napi::Object colorObj = info[2].As<Napi::Object>();
  unsigned char r = colorObj.Get("r").As<Napi::Number>().Uint32Value();
  unsigned char g = colorObj.Get("g").As<Napi::Number>().Uint32Value();
  unsigned char b = colorObj.Get("b").As<Napi::Number>().Uint32Value();

  CorsairLedColor ledColor;
  ledColor.id = ledLuid;
  ledColor.r = r;
  ledColor.g = g;
  ledColor.b = b;
  ledColor.a = 255;

  CorsairError err = CorsairSetLedColors_Fn(deviceId.c_str(), 1, &ledColor);
  return Napi::Boolean::New(env, err == CE_Success);
}

// Get connected keyboard devices
Napi::Array GetKeyboards(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Array result = Napi::Array::New(env);

  if (!g_iCueModule || !CorsairGetDevices_Fn) {
    return result;
  }

  CorsairDeviceFilter filter = {CDT_Keyboard};
  CorsairDeviceInfo devices[10];
  int deviceCount = 0;

  CorsairError err = CorsairGetDevices_Fn(&filter, 10, devices, &deviceCount);
  if (err != CE_Success) {
    return result;
  }

  for (int i = 0; i < deviceCount; i++) {
    Napi::Object deviceObj = Napi::Object::New(env);
    deviceObj.Set("id", Napi::String::New(env, devices[i].id));
    deviceObj.Set("model", Napi::String::New(env, devices[i].model));
    deviceObj.Set("serial", Napi::String::New(env, devices[i].serial));
    deviceObj.Set("ledCount", Napi::Number::New(env, devices[i].ledCount));
    
    result.Set(i, deviceObj);
  }

  return result;
}

// Request exclusive control
Napi::Boolean RequestControl(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "requestControl requires device ID").ThrowAsJavaScriptException();
    return Napi::Boolean::New(env, false);
  }

  if (!g_iCueModule || !CorsairRequestControl_Fn) {
    return Napi::Boolean::New(env, false);
  }

  std::string deviceId = info[0].As<Napi::String>();
  CorsairError err = CorsairRequestControl_Fn(deviceId.c_str(), CAL_ExclusiveLightingControl);
  return Napi::Boolean::New(env, err == CE_Success);
}

// Poll for key events
Napi::Value PollEvents(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Array result = Napi::Array::New(env);
  
  std::lock_guard<std::mutex> lock(g_queueMutex);
  
  int index = 0;
  while (!g_eventQueue.empty() && index < 100) { // Limit to 100 events per poll
    CorsairEvent event = g_eventQueue.front();
    g_eventQueue.pop();
    
    if (event.id == CEI_KeyEvent && event.keyEvent) {
      Napi::Object eventObj = Napi::Object::New(env);
      eventObj.Set("keyId", Napi::Number::New(env, (int)event.keyEvent->keyId));
      eventObj.Set("isPressed", Napi::Boolean::New(env, event.keyEvent->isPressed));
      result.Set(index++, eventObj);
    }
  }
  
  return result;
}

// Initialize the N-API module
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "loadSDK"), Napi::Function::New(env, LoadSDK));
  exports.Set(Napi::String::New(env, "connect"), Napi::Function::New(env, Connect));
  exports.Set(Napi::String::New(env, "disconnect"), Napi::Function::New(env, Disconnect));
  exports.Set(Napi::String::New(env, "setKeyColor"), Napi::Function::New(env, SetKeyColor));
  exports.Set(Napi::String::New(env, "getKeyboards"), Napi::Function::New(env, GetKeyboards));
  exports.Set(Napi::String::New(env, "requestControl"), Napi::Function::New(env, RequestControl));
  exports.Set(Napi::String::New(env, "pollEvents"), Napi::Function::New(env, PollEvents));

  // Export LED key constants
  Napi::Object ledKeys = Napi::Object::New(env);
  
  // G keys group (CLG_KeyboardGKeys = 1)
  ledKeys.Set("G1", Napi::Number::New(env, 0x00010001));
  ledKeys.Set("G2", Napi::Number::New(env, 0x00010002));
  ledKeys.Set("G3", Napi::Number::New(env, 0x00010003));
  ledKeys.Set("G4", Napi::Number::New(env, 0x00010004));
  ledKeys.Set("G5", Napi::Number::New(env, 0x00010005));
  ledKeys.Set("G6", Napi::Number::New(env, 0x00010006));
  ledKeys.Set("G7", Napi::Number::New(env, 0x00010007));
  ledKeys.Set("G8", Napi::Number::New(env, 0x00010008));
  ledKeys.Set("G9", Napi::Number::New(env, 0x00010009));
  ledKeys.Set("G10", Napi::Number::New(env, 0x0001000A));
  ledKeys.Set("G11", Napi::Number::New(env, 0x0001000B));
  ledKeys.Set("G12", Napi::Number::New(env, 0x0001000C));
  
  // Regular keyboard keys group (CLG_Keyboard = 0)
  ledKeys.Set("Esc", Napi::Number::New(env, 0x00000001));
  ledKeys.Set("F1", Napi::Number::New(env, 0x00000003));
  ledKeys.Set("F2", Napi::Number::New(env, 0x00000004));
  ledKeys.Set("F3", Napi::Number::New(env, 0x00000005));
  
  exports.Set(Napi::String::New(env, "ledKeys"), ledKeys);
  
  // Export macro key IDs for event mapping (CorsairMacroKeyId enum)
  Napi::Object macroKeys = Napi::Object::New(env);
  macroKeys.Set("G1", Napi::Number::New(env, 1));   // CMKI_1
  macroKeys.Set("G2", Napi::Number::New(env, 2));   // CMKI_2
  macroKeys.Set("G3", Napi::Number::New(env, 3));   // CMKI_3
  macroKeys.Set("G4", Napi::Number::New(env, 4));   // CMKI_4
  macroKeys.Set("G5", Napi::Number::New(env, 5));   // CMKI_5
  macroKeys.Set("G6", Napi::Number::New(env, 6));   // CMKI_6
  macroKeys.Set("G7", Napi::Number::New(env, 7));   // CMKI_7
  macroKeys.Set("G8", Napi::Number::New(env, 8));   // CMKI_8
  macroKeys.Set("G9", Napi::Number::New(env, 9));   // CMKI_9
  macroKeys.Set("G10", Napi::Number::New(env, 10)); // CMKI_10
  macroKeys.Set("G11", Napi::Number::New(env, 11)); // CMKI_11
  macroKeys.Set("G12", Napi::Number::New(env, 12)); // CMKI_12
  
  exports.Set(Napi::String::New(env, "macroKeys"), macroKeys);
  ledKeys.Set("F2", Napi::Number::New(env, 0x00000004));
  ledKeys.Set("F3", Napi::Number::New(env, 0x00000005));
  
  exports.Set(Napi::String::New(env, "ledKeys"), ledKeys);

  return exports;
}

NODE_API_MODULE(corsair, Init)

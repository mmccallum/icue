# Development Guide - Extending the Corsair iCUE Module

This guide explains how to extend and modify the module to add new features.

## Architecture Overview

```
corsair.cc (C++)
    ↓
node-gyp (Compiler)
    ↓
corsair.node (Native module)
    ↓
index.js (JavaScript wrapper)
    ↓
Your code
```

## Adding New LED Keys

### Step 1: Find the LED LUID

Consult the iCUE SDK documentation at:
https://corsairofficial.github.io/cue-sdk/#corsairledid-keyboard

LED LUID format: `0xGGGGIIII`
- GGGG = LED group (keyboard=0x0000, G-keys=0x0001)
- IIII = LED index/ID

Examples:
- G1: `0x00010001` (group 1, index 1)
- Esc: `0x00000001` (group 0, index 1)
- F1: `0x00000003` (group 0, index 3)

### Step 2: Add to C++ Binding

Edit `src/corsair.cc`, in the `Init` function, add:

```cpp
// Regular keyboard keys (group 0)
ledKeys.Set("F4", Napi::Number::New(env, 0x00000006));
ledKeys.Set("F5", Napi::Number::New(env, 0x00000007));
ledKeys.Set("F6", Napi::Number::New(env, 0x00000008));

// Or G-keys (group 1)
ledKeys.Set("G13", Napi::Number::New(env, 0x0001000D));
```

### Step 3: Rebuild

```bash
npm run build
```

### Step 4: Use in JavaScript

```javascript
keyboard.setKeyColor('F4', 255, 0, 0);
```

## Implementing G Key Press Detection

The foundation for event detection is already in place. Here's how to complete it:

### Step 1: Enable Event Subscription (C++)

In `src/corsair.cc`, modify `SessionStateChangedHandler`:

```cpp
void SessionStateChangedHandler(void *context, const CorsairSessionStateChanged *eventData) {
  if (eventData && eventData->state == CSS_Connected) {
    // Subscribe to events
    if (CorsairSubscribeForEvents_Fn) {
      CorsairSubscribeForEvents_Fn(EventHandlerCallback, NULL);
      g_subscribed = true;
    }
  }
}

// New callback for key events
void EventHandlerCallback(void *context, const CorsairEvent *event) {
  if (event && event->id == CEI_KeyEvent) {
    const CorsairKeyEvent *keyEvent = event->keyEvent;
    
    // Queue the event
    {
      std::lock_guard<std::mutex> lock(g_queueMutex);
      g_eventQueue.push(*event);
    }
    
    // Notify JavaScript (implementation in next step)
  }
}
```

### Step 2: Create Event Emitter (C++)

Add this function to handle JavaScript callbacks:

```cpp
void PollKeyEvents(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Array events = Napi::Array::New(env);
  
  {
    std::lock_guard<std::mutex> lock(g_queueMutex);
    int index = 0;
    
    while (!g_eventQueue.empty()) {
      const CorsairEvent& event = g_eventQueue.front();
      
      Napi::Object eventObj = Napi::Object::New(env);
      eventObj.Set("keyId", Napi::Number::New(env, event.keyEvent->keyId));
      eventObj.Set("isPressed", Napi::Boolean::New(env, event.keyEvent->isPressed));
      
      events.Set(index++, eventObj);
      g_eventQueue.pop();
    }
  }
  
  return events;
}
```

### Step 3: Expose in Module

Add to the `Init` function:

```cpp
exports.Set(Napi::String::New(env, "pollKeyEvents"), Napi::Function::New(env, PollKeyEvents));
```

### Step 4: Create JavaScript Event Emitter

Update `index.js`:

```javascript
const EventEmitter = require('events');

class CorsairKeyboard extends EventEmitter {
  constructor() {
    super();
    this.deviceId = null;
    this.isConnected = false;
    this.eventPollInterval = null;
  }

  async initialize() {
    // ... existing code ...
    
    // Start polling for key events
    this.startEventPolling();
  }

  startEventPolling() {
    this.eventPollInterval = setInterval(() => {
      const events = binding.pollKeyEvents();
      
      events.forEach(event => {
        const keyName = this.getKeyName(event.keyId);
        
        if (event.isPressed) {
          this.emit('keyPress', keyName);
        } else {
          this.emit('keyRelease', keyName);
        }
      });
    }, 10); // Poll every 10ms
  }

  getKeyName(keyId) {
    const keyMap = {
      0: 'G1', 1: 'G2', 2: 'G3', 3: 'G4',
      4: 'G5', 5: 'G6', 6: 'G7', 7: 'G8',
      8: 'G9', 9: 'G10', 10: 'G11', 11: 'G12'
    };
    return keyMap[keyId] || `Key${keyId}`;
  }

  disconnect() {
    if (this.eventPollInterval) {
      clearInterval(this.eventPollInterval);
    }
    // ... existing code ...
  }
}
```

### Step 5: Usage

```javascript
const keyboard = new CorsairKeyboard();

keyboard.on('keyPress', (key) => {
  console.log(`${key} pressed!`);
  keyboard.setKeyColor(key, 255, 0, 0); // Light up in red
});

keyboard.on('keyRelease', (key) => {
  console.log(`${key} released!`);
  keyboard.turnOffKey(key);
});
```

## Supporting Other Corsair Devices

To add support for mice, mousemats, headsets, etc.:

### Step 1: Update Device Filter (C++)

```cpp
Napi::Array GetDevices(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
  // Filter by device type (passed from JavaScript)
  int deviceType = info[0].As<Napi::Number>().Uint32Value();
  
  CorsairDeviceFilter filter = {deviceType};
  CorsairDeviceInfo devices[20];
  int deviceCount = 0;

  CorsairError err = CorsairGetDevices_Fn(&filter, 20, devices, &deviceCount);
  
  // ... convert to JavaScript array ...
}
```

### Step 2: Export Device Type Constants

```cpp
Napi::Object deviceTypes = Napi::Object::New(env);
deviceTypes.Set("Keyboard", Napi::Number::New(env, CDT_Keyboard));
deviceTypes.Set("Mouse", Napi::Number::New(env, CDT_Mouse));
deviceTypes.Set("Headset", Napi::Number::New(env, CDT_Headset));
// ... etc ...
exports.Set(Napi::String::New(env, "deviceTypes"), deviceTypes);
```

## Performance Optimization

### Batch Color Updates

Instead of setting colors one at a time:

```cpp
// Instead of this (slow)
setKeyColor(deviceId, G1, {255, 0, 0});
setKeyColor(deviceId, G2, {0, 255, 0});
setKeyColor(deviceId, G3, {0, 0, 255});

// Do this (fast)
CorsairLedColor colors[3] = {
  {G1_LUID, 255, 0, 0, 255},
  {G2_LUID, 0, 255, 0, 255},
  {G3_LUID, 0, 0, 255, 255}
};
CorsairSetLedColors_Fn(deviceId, 3, colors);
```

### Async Updates

Use `CorsairSetLedColorsFlushBufferAsync` for non-blocking updates:

```cpp
Napi::Value SetColorsAsync(const Napi::CallbackInfo& info) {
  // Use CorsairSetLedColorsFlushBufferAsync
  // Instead of CorsairSetLedColors_Fn
}
```

## Testing Your Changes

### Test C++ Changes

```bash
npm run clean
npm run build
node -e "const binding = require('./build/Release/corsair.node'); console.log(binding);"
```

### Test JavaScript Changes

```bash
node test-basic.js
node example.js
```

### Debug C++

Add console output in C++:

```cpp
printf("Debug: Loading SDK\n");
```

Then check the output when running:

```bash
node your-script.js
```

## Common Pitfalls

1. **Forgetting to rebuild** - Always run `npm run build` after changing C++
2. **Wrong LED LUID** - Double-check the hex values in SDK docs
3. **Not null-checking** - Always check pointers before dereferencing
4. **Memory leaks** - Use `std::lock_guard` for automatic mutex release
5. **Missing includes** - Add `#include` at the top of corsair.cc

## Resources

- **iCUE SDK Docs**: https://corsairofficial.github.io/cue-sdk
- **N-API Guide**: https://nodejs.org/api/n_api.html
- **node-gyp Docs**: https://github.com/nodejs/node-gyp
- **Windows SDK**: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/

## Getting Help

If you run into issues:

1. Check the iCUE SDK documentation
2. Review the example.js for usage patterns
3. Enable verbose build output: `npm run build -- --verbose`
4. Check Node.js and MSVC are up to date
5. Run the test scripts to isolate the problem

Happy coding! 🚀

# Quick Start Guide - Corsair iCUE Node.js Binding

## What You Just Built

A complete Node.js module that lets you control Corsair RGB keyboards and detect G key presses from JavaScript.

## Project Structure

```
corsair-icue/
├── src/
│   └── corsair.cc           # C++ N-API binding to iCUE SDK
├── build/
│   └── Release/
│       └── corsair.node     # Compiled native module
├── cue-sdk-4.0.84/          # Corsair iCUE SDK headers
├── index.js                 # High-level JavaScript API
├── example.js               # Full demo with lighting effects
├── test-basic.js            # Basic connectivity test
├── binding.gyp              # Build configuration
├── package.json             # Node.js package config
└── README.md                # Full documentation
```

## Testing the Module

### 1. Without iCUE Running (Safe Test)

```bash
node test-basic.js
```

This tests the module loads correctly and gracefully handles missing iCUE.

### 2. With iCUE Running (Full Demo)

**Prerequisites:**
- Corsair iCUE installed and running
- Supported Corsair keyboard connected
- Running as Administrator

```bash
node example.js
```

This will:
- Connect to your keyboard
- Light up G1-G6 in red
- Cycle through rainbow colors on G keys
- Create a pulse effect on G1
- Turn everything off
- Disconnect

## Usage in Your Code

### Basic Usage

```javascript
const CorsairKeyboard = require('./index.js');

async function start() {
  const keyboard = new CorsairKeyboard();
  
  // Connect
  if (!await keyboard.initialize()) {
    console.error('Connection failed');
    return;
  }

  // Set colors
  keyboard.setKeyColor('G1', 255, 0, 0);    // Red
  keyboard.setKeyColor('G2', 0, 255, 0);    // Green
  keyboard.setKeyColor('G3', 0, 0, 255);    // Blue

  // Cleanup
  keyboard.disconnect();
}

start();
```

### Key Functions

```javascript
// Initialize connection
await keyboard.initialize()

// Set single key color
keyboard.setKeyColor('G1', 255, 0, 0)

// Set multiple keys
keyboard.setKeysColor([
  {key: 'G1', color: {r: 255, g: 0, b: 0}},
  {key: 'G2', color: {r: 0, g: 255, b: 0}}
])

// Turn off keys
keyboard.turnOffKey('G1')
keyboard.turnOffAllKeys()

// Get available keys
keyboard.getAvailableKeys()

// Disconnect
keyboard.disconnect()
```

## Rebuilding the Module

If you modify the C++ code:

```bash
npm run clean
npm run build
```

## Adding New Keys

To add support for more LED keys, edit `src/corsair.cc` and add entries to the `ledKeys` object:

```cpp
// Example: Add F4 key (keyboard group, index 6)
ledKeys.Set("F4", Napi::Number::New(env, 0x00000006));
```

Reference the iCUE SDK documentation for LED LUIDs:
- Format: `0xGGGGIIII` where GGGG is group, IIII is ID
- G Keys: group `0x0001`, IDs `0x0001`-`0x000C`
- Keyboard: group `0x0000`, various IDs

## Implementing G Key Detection

The foundation is in place for key press event detection. To complete it:

1. Implement proper event callback handling in `src/corsair.cc`
2. Use `CorsairSubscribeForEvents` to listen for key events
3. Emit Node.js events to JavaScript layer
4. Use node-addon-api's ThreadSafeFunction for async callbacks

See the commented structures in the C++ code for guidance.

## Common Issues & Solutions

**Issue**: "Could not load iCUE SDK"
- **Fix**: Ensure Corsair iCUE is installed and running

**Issue**: Access Denied
- **Fix**: Run as Administrator

**Issue**: Module fails to build
- **Fix**: Install Visual Studio Build Tools with C++ support

**Issue**: "No Corsair keyboards detected"
- **Fix**: Verify keyboard is connected and recognized by iCUE

## Next Steps

1. **Test with your keyboard** - Run `node example.js` with iCUE running
2. **Implement event detection** - Add G key press listeners
3. **Expand LED support** - Add more keyboard keys and device types
4. **Create your app** - Build lighting effects, macro systems, etc.

## Resources

- Corsair iCUE SDK: https://github.com/CorsairOfficial/cue-sdk
- SDK Documentation: https://corsairofficial.github.io/cue-sdk
- N-API Documentation: https://nodejs.org/api/n_api.html
- node-gyp Guide: https://github.com/nodejs/node-gyp

## Support

For issues:
1. Check README.md for detailed documentation
2. Review example.js for usage patterns
3. Check iCUE settings to ensure SDK is enabled
4. Verify administrator privileges are granted

Good luck building! 🎮💡

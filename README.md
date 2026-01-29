# Corsair iCUE Node.js Binding

A native Node.js module that provides direct access to the Corsair iCUE SDK, allowing you to control RGB lighting and detect key presses on Corsair gaming keyboards.

## Features

✅ **Control individual key RGB colors** - Set any key to any RGB color
✅ **G Key detection** - Listen for G1-G12 key presses  
✅ **Direct SDK access** - Uses native C++ bindings for performance
✅ **Windows 11 compatible** - Fully tested on Windows 11
✅ **Easy-to-use JavaScript API** - High-level wrapper around the C++ binding

## Requirements

- **Windows 11 (x64)** (or Windows 7/8/10 x64)
- **Node.js 14.0.0+**
- **Corsair iCUE software** installed and running
- **A supported Corsair keyboard** (with RGB and G keys)
- **Administrator privileges** (required by iCUE SDK)

Note: Prebuilt binaries are included for Windows x64. Build tools are only needed for development or other platforms.

## Installation

### Windows x64 (one-step, no build tools needed)

Prebuilt binaries are included! Just install:

```bash
npm install corsair-icue
```

The module will automatically download the Corsair SDK on first install.

### Development or other platforms

If building from source, install Visual Studio Build Tools:

```powershell
winget install --id Microsoft.VisualStudio.2022.BuildTools
```

When prompted, select:
- C++ development workload  
- Windows SDK

Then clone and build:

```bash
git clone https://github.com/mmccallum/icue
cd icue
npm install
```

## Quick Start

```javascript
const CorsairKeyboard = require('corsair-icue');

async function main() {
  const keyboard = new CorsairKeyboard();
  
  // Connect to keyboard
  if (!await keyboard.initialize()) {
    console.error('Failed to connect');
    return;
  }

  // Light up G1 key in red
  keyboard.setKeyColor('G1', 255, 0, 0);

  // Turn it off
  keyboard.turnOffKey('G1');

  // Cleanup
  keyboard.disconnect();
}

main();
```

## API Documentation

### `CorsairKeyboard` Class

#### `async initialize(options)`
Connects to the first available Corsair keyboard.

**Parameters:**
- `options` (object, optional)
  - `exclusiveControl` (boolean, default `false`): request exclusive lighting control.
    - `false` (shared mode): iCUE continues to control normal keyboard lighting.
    - `true` (exclusive mode): your app takes over lighting; non-controlled keys may go dark.

**Returns:** `Promise<boolean>` - true if successful

```javascript
// Shared mode (default)
const connected = await keyboard.initialize();

// Exclusive lighting control
const connectedExclusive = await keyboard.initialize({ exclusiveControl: true });

if (!connected) {
  console.error('Could not connect to keyboard');
}
```

#### `setKeyColor(keyName, r, g, b)`
Sets the color of a specific key.

**Parameters:**
- `keyName` (string): Key identifier (e.g., 'G1', 'G2', ..., 'G12')
- `r` (number): Red value 0-255
- `g` (number): Green value 0-255  
- `b` (number): Blue value 0-255

```javascript
// Set G1 to red
keyboard.setKeyColor('G1', 255, 0, 0);

// Set G2 to green
keyboard.setKeyColor('G2', 0, 255, 0);

// Set G3 to blue
keyboard.setKeyColor('G3', 0, 0, 255);
```

#### `setKeysColor(keys)`
Sets colors for multiple keys at once.

**Parameters:**
- `keys` (Array): Array of objects with `{key: 'G1', color: {r: 255, g: 0, b: 0}}`

```javascript
keyboard.setKeysColor([
  {key: 'G1', color: {r: 255, g: 0, b: 0}},   // Red
  {key: 'G2', color: {r: 0, g: 255, b: 0}},   // Green
  {key: 'G3', color: {r: 0, g: 0, b: 255}}    // Blue
]);
```

#### `turnOffKey(keyName)`
Turns off a specific key (sets to black).

```javascript
keyboard.turnOffKey('G1');
```

#### `turnOffAllKeys()`
Turns off all G keys.

```javascript
keyboard.turnOffAllKeys();
```

#### `getAvailableKeys()`
Returns array of supported key names.

```javascript
const keys = keyboard.getAvailableKeys();
console.log(keys); // ['G1', 'G2', ..., 'G12', 'Esc', 'F1', 'F2', 'F3']
```

#### `disconnect()`
Disconnects from the keyboard and cleans up resources.

```javascript
keyboard.disconnect();
```

## Supported Keys

Currently, the module supports the following keys with full LED control:

- **G Keys**: G1, G2, G3, G4, G5, G6, G7, G8, G9, G10, G11, G12
- **Function Keys**: Esc, F1, F2, F3 (more can be added)

Additional keyboard keys can be added by referencing the iCUE SDK LED ID documentation.

## Event Limitations (Important)

- The iCUE SDK only reports **G/M/S macro key events** via `CorsairKeyEvent`.
- **Top buttons and the control wheel on the K100 do not emit SDK events** unless you map them in iCUE to macro keys.
- If you need those controls, remap them to G keys in iCUE or use a separate Windows Raw Input listener.

## Examples

### Example 1: Rainbow Effect

```javascript
const CorsairKeyboard = require('./index.js');

async function rainbowEffect() {
  const keyboard = new CorsairKeyboard();
  
  if (!await keyboard.initialize()) {
    console.error('Failed to connect');
    return;
  }

  const colors = [
    [255, 0, 0],    // Red
    [255, 165, 0],  // Orange
    [255, 255, 0],  // Yellow
    [0, 255, 0],    // Green
    [0, 0, 255],    // Blue
    [75, 0, 130]    // Indigo
  ];

  for (let i = 0; i < 6; i++) {
    const [r, g, b] = colors[i];
    keyboard.setKeyColor(`G${i + 1}`, r, g, b);
  }

  // Keep lit for 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));

  keyboard.disconnect();
}

rainbowEffect();
```

### Example 2: Pulse Effect

```javascript
const CorsairKeyboard = require('./index.js');

async function pulseEffect() {
  const keyboard = new CorsairKeyboard();
  
  if (!await keyboard.initialize()) return;

  // Pulse G1 key
  for (let brightness = 0; brightness <= 255; brightness += 10) {
    keyboard.setKeyColor('G1', brightness, 0, brightness);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  for (let brightness = 255; brightness >= 0; brightness -= 10) {
    keyboard.setKeyColor('G1', brightness, 0, brightness);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  keyboard.disconnect();
}

pulseEffect();
```

## Troubleshooting

### "Could not load iCUE SDK"
- **Solution**: Ensure Corsair iCUE is installed and running
- Check `C:\Program Files\Corsair\` for iCUE installation
- Restart iCUE or your computer

### Access Denied / Permissions Error
- **Solution**: Run your Node.js script with administrator privileges
- Right-click Command Prompt/PowerShell → Run as Administrator
- Or use a process elevation tool

### No Keyboards Detected
- Verify your Corsair keyboard is connected
- Check if iCUE recognizes the keyboard
- Try a different USB port
- Ensure it's a supported model (K95, K70, etc.)

### Build Fails with Compiler Errors
- Reinstall Visual Studio Build Tools with C++ support
- Delete `node_modules/` and `package-lock.json`, then `npm install` again
- Check that Python 3.7+ is available

## Development

### Build from source

```bash
npm install
npm run build
```

### Clean build

```bash
npm run clean
npm run build
```

### Run tests

```bash
node test-basic.js
node example.js
```

## Under the Hood

This module consists of:

1. **C++ Binding** (`src/corsair.cc`) - Native wrapper around Corsair iCUE SDK
2. **N-API** - Modern Node.js API for native modules
3. **JavaScript Wrapper** (`index.js`) - High-level, user-friendly API
4. **node-gyp** - Build system that compiles the C++ code

The module dynamically loads the iCUE SDK DLL at runtime, supporting various installation paths.

## SDK Version

Currently targets: **Corsair iCUE SDK v4.0.84**

Available at: https://github.com/CorsairOfficial/cue-sdk

## Limitations

- Windows-only (iCUE SDK limitation)
- Requires iCUE to be running
- Limited to G key event detection (implementation in progress)
- Some devices may have restricted LEDs (service LEDs)

## Future Enhancements

- [ ] G key press event detection
- [ ] Support for all keyboard LEDs (not just G keys)
- [ ] Support for other Corsair RGB devices (mice, headsets, etc.)
- [ ] Async color setting with batched updates
- [ ] Device enumeration and filtering

## License

MIT - See LICENSE file

## Contributing

Contributions welcome! Please open issues and PRs on GitHub.

## Credits

- Corsair iCUE SDK: https://github.com/CorsairOfficial/cue-sdk
- Built with Node.js Native Addons API (N-API)

/**
 * Corsair iCUE Node.js Binding
 * High-level interface for controlling Corsair RGB keyboards
 */

const binding = require('./build/Release/corsair.node');
const EventEmitter = require('events');

class CorsairKeyboard extends EventEmitter {
  constructor() {
    super();
    this.deviceId = null;
    this.isConnected = false;
    this.pollInterval = null;
  }

  /**
   * Initialize and connect to iCUE
   * @param {Object} options - Configuration options
   * @param {boolean} options.exclusiveControl - Request exclusive lighting control (default: false)
   * @returns {Promise<boolean>} true if successfully connected
   */
  async initialize(options = {}) {
    const { exclusiveControl = false } = options;
    
    try {
      // Load the SDK
      if (!binding.loadSDK()) {
        throw new Error('Failed to load iCUE SDK');
      }

      // Connect
      if (!binding.connect()) {
        throw new Error('Failed to connect to iCUE');
      }

      // Give iCUE a moment to send device list
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get keyboards
      const keyboards = binding.getKeyboards();
      if (keyboards.length === 0) {
        throw new Error('No Corsair keyboards detected');
      }

      this.deviceId = keyboards[0].id;
      console.log(`Connected to keyboard: ${keyboards[0].model}`);

      // Request exclusive control if specified
      if (exclusiveControl) {
        console.log('Requesting exclusive lighting control...');
        binding.requestControl(this.deviceId);
      } else {
        console.log('Using shared lighting mode (iCUE controls normal keys)');
      }

      this.isConnected = true;
      
      // Start polling for events
      this.startEventPolling();
      
      return true;
    } catch (error) {
      console.error('Initialization error:', error.message);
      return false;
    }
  }

  /**
   * Start polling for key events
   */
  startEventPolling() {
    if (this.pollInterval) return;
    
    this.pollInterval = setInterval(() => {
      const events = binding.pollEvents();
      for (const event of events) {
        const keyName = this.getKeyNameFromId(event.keyId);
        if (keyName) {
          this.emit(event.isPressed ? 'keydown' : 'keyup', {
            key: keyName,
            keyId: event.keyId,
            pressed: event.isPressed
          });
        }
      }
    }, 10); // Poll every 10ms
  }

  /**
   * Stop polling for events
   */
  stopEventPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Convert key ID to key name
   */
  getKeyNameFromId(keyId) {
    const keys = binding.macroKeys;
    for (const [name, id] of Object.entries(keys)) {
      if (id === keyId) return name;
    }
    return null;
  }

  /**
   * Disconnect from iCUE
   */
  disconnect() {
    if (this.isConnected) {
      this.stopEventPolling();
      binding.disconnect();
      this.isConnected = false;
    }
  }

  /**
   * Set color for a specific key
   * @param {string} keyName - Key identifier (e.g., 'G1', 'F1')
   * @param {number} r - Red value (0-255)
   * @param {number} g - Green value (0-255)
   * @param {number} b - Blue value (0-255)
   */
  setKeyColor(keyName, r, g, b) {
    if (!this.isConnected || !this.deviceId) {
      throw new Error('Not connected to keyboard');
    }

    // Get the LED LUID from predefined keys
    const ledLuid = binding.ledKeys[keyName];
    if (!ledLuid) {
      throw new Error(`Unknown key: ${keyName}`);
    }

    return binding.setKeyColor(
      this.deviceId,
      ledLuid,
      { r: Math.min(255, Math.max(0, r)), g: Math.min(255, Math.max(0, g)), b: Math.min(255, Math.max(0, b)) }
    );
  }

  /**
   * Set color for multiple keys at once
   * @param {Array} keys - Array of {key: 'G1', color: {r: 255, g: 0, b: 0}}
   */
  setKeysColor(keys) {
    keys.forEach(({key, color}) => {
      this.setKeyColor(key, color.r, color.g, color.b);
    });
  }

  /**
   * Turn off a key (set to black)
   * @param {string} keyName - Key identifier
   */
  turnOffKey(keyName) {
    this.setKeyColor(keyName, 0, 0, 0);
  }

  /**
   * Turn off all keys
   */
  turnOffAllKeys() {
    const gKeys = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'];
    gKeys.forEach(key => this.turnOffKey(key));
  }

  /**
   * Get available LED keys
   */
  getAvailableKeys() {
    return Object.keys(binding.ledKeys);
  }
}

module.exports = CorsairKeyboard;

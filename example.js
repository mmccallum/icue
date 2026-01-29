/**
 * Example: Basic Corsair Keyboard Control
 * 
 * This example demonstrates:
 * 1. Connecting to a Corsair keyboard
 * 2. Setting individual key colors
 * 3. Creating lighting patterns
 */

const CorsairKeyboard = require('./index.js');

async function main() {
  const keyboard = new CorsairKeyboard();

  // Initialize and connect
  console.log('Connecting to Corsair keyboard...');
  const connected = await keyboard.initialize();
  
  if (!connected) {
    console.error('Failed to connect to keyboard. Make sure:');
    console.error('1. Corsair iCUE is installed and running');
    console.error('2. You have a supported Corsair keyboard connected');
    console.error('3. This script is running with administrator privileges');
    process.exit(1);
  }

  try {
    console.log('\n=== Corsair Keyboard RGB Control Demo ===\n');

    // 1. Simple color test - light up G keys in red
    console.log('Setting G1-G6 to RED...');
    for (let i = 1; i <= 6; i++) {
      keyboard.setKeyColor(`G${i}`, 255, 0, 0);
    }
    await sleep(1000);

    // 2. Rainbow effect on G keys
    console.log('Rainbow effect on G keys...');
    const colors = [
      { name: 'RED', r: 255, g: 0, b: 0 },
      { name: 'GREEN', r: 0, g: 255, b: 0 },
      { name: 'BLUE', r: 0, g: 0, b: 255 },
      { name: 'YELLOW', r: 255, g: 255, b: 0 },
      { name: 'CYAN', r: 0, g: 255, b: 255 },
      { name: 'MAGENTA', r: 255, g: 0, b: 255 }
    ];

    for (let cycle = 0; cycle < 3; cycle++) {
      for (let i = 0; i < 6; i++) {
        const keyName = `G${i + 1}`;
        const color = colors[i];
        keyboard.setKeyColor(keyName, color.r, color.g, color.b);
        console.log(`  ${keyName}: ${color.name}`);
      }
      await sleep(500);
    }

    // 3. Pulse effect
    console.log('\nPulse effect on G1...');
    for (let brightness = 0; brightness <= 255; brightness += 25) {
      keyboard.setKeyColor('G1', brightness, 0, brightness);
      await sleep(100);
    }
    for (let brightness = 255; brightness >= 0; brightness -= 25) {
      keyboard.setKeyColor('G1', brightness, 0, brightness);
      await sleep(100);
    }

    // 4. Turn everything off
    console.log('\nTurning off all lights...');
    keyboard.turnOffAllKeys();

    console.log('\nDemo complete!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Cleanup
    console.log('Disconnecting...');
    keyboard.disconnect();
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(console.error);

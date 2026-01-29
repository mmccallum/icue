/**
 * Color Demo - Requires iCUE to be running and keyboard connected
 */

const CorsairKeyboard = require('../index.js');

async function demo() {
  console.log(`
╔═══════════════════════════════════════════════════╗
║    Corsair iCUE RGB Color Demo                    ║
║    (Requires iCUE running + keyboard connected)   ║
╚═══════════════════════════════════════════════════╝
`);

  const kb = new CorsairKeyboard();

  console.log('Connecting to keyboard...');
  const connected = await kb.initialize();

  if (!connected) {
    console.log('❌ Could not connect. Make sure:');
    console.log('   • Corsair iCUE is installed and running');
    console.log('   • Your keyboard is connected');
    console.log('   • This script is running as Administrator');
    process.exit(1);
  }

  console.log('✓ Connected!\n');

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  try {
    // Demo 1: Primary Colors
    console.log('Demo 1: Primary Colors (Red, Green, Blue)');
    kb.setKeyColor('G1', 255, 0, 0);   // Red
    kb.setKeyColor('G2', 0, 255, 0);   // Green
    kb.setKeyColor('G3', 0, 0, 255);   // Blue
    console.log('  G1: 🔴 Red');
    console.log('  G2: 🟢 Green');
    console.log('  G3: 🔵 Blue\n');
    await sleep(2000);

    // Demo 2: Secondary Colors
    console.log('Demo 2: Secondary Colors (Cyan, Magenta, Yellow)');
    kb.setKeyColor('G4', 0, 255, 255);   // Cyan
    kb.setKeyColor('G5', 255, 0, 255);   // Magenta
    kb.setKeyColor('G6', 255, 255, 0);   // Yellow
    console.log('  G4: 🟦 Cyan');
    console.log('  G5: 💜 Magenta');
    console.log('  G6: 🟨 Yellow\n');
    await sleep(2000);

    // Demo 3: Gradient
    console.log('Demo 3: Color Gradient');
    for (let i = 1; i <= 6; i++) {
      const brightness = Math.floor((i / 6) * 255);
      kb.setKeyColor(`G${i}`, brightness, 0, 0);
    }
    console.log('  G1-G6: Red gradient (dark to bright)\n');
    await sleep(2000);

    // Demo 4: White
    console.log('Demo 4: White/Bright');
    kb.setKeyColor('G1', 255, 255, 255);
    kb.setKeyColor('G2', 200, 200, 200);
    kb.setKeyColor('G3', 150, 150, 150);
    kb.setKeyColor('G4', 100, 100, 100);
    kb.setKeyColor('G5', 50, 50, 50);
    kb.setKeyColor('G6', 25, 25, 25);
    console.log('  G1-G6: Brightness gradient\n');
    await sleep(2000);

    // Demo 5: Rainbow Cycle
    console.log('Demo 5: Rainbow Animation');
    const colors = [
      { name: 'Red', r: 255, g: 0, b: 0 },
      { name: 'Orange', r: 255, g: 165, b: 0 },
      { name: 'Yellow', r: 255, g: 255, b: 0 },
      { name: 'Green', r: 0, g: 255, b: 0 },
      { name: 'Blue', r: 0, g: 0, b: 255 },
      { name: 'Indigo', r: 75, g: 0, b: 130 },
      { name: 'Violet', r: 148, g: 0, b: 211 }
    ];

    for (let cycle = 0; cycle < 2; cycle++) {
      for (const color of colors) {
        kb.setKeysColor([
          { key: 'G1', color: { r: color.r, g: color.g, b: color.b } },
          { key: 'G2', color: { r: color.r, g: color.g, b: color.b } },
          { key: 'G3', color: { r: color.r, g: color.g, b: color.b } },
          { key: 'G4', color: { r: color.r, g: color.g, b: color.b } },
          { key: 'G5', color: { r: color.r, g: color.g, b: color.b } },
          { key: 'G6', color: { r: color.r, g: color.g, b: color.b } }
        ]);
        console.log(`  All keys: ${color.name}`);
        await sleep(300);
      }
    }
    console.log();

    // Demo 6: Off
    console.log('Demo 6: Turning off...');
    kb.turnOffAllKeys();
    console.log('  ✓ All lights off\n');

    console.log('✓ Demo complete!');
    kb.disconnect();

  } catch (error) {
    console.error('Error during demo:', error.message);
    kb.disconnect();
    process.exit(1);
  }
}

demo();

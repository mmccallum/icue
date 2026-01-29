/**
 * G Key Color Test - Sets G1-G6 to orange and maintains connection
 */

const CorsairKeyboard = require('../index.js');

async function main() {
  console.log('🎹 G Key Color Test\n');
  
  const keyboard = new CorsairKeyboard();
  
  console.log('Initializing connection to iCUE...');
const success = await keyboard.initialize({ exclusiveControl: true });  
  if (!success) {
    console.error('❌ Failed to connect to iCUE');
    console.error('   Make sure:');
    console.error('   1. iCUE is running');
    console.error('   2. Third-party control is enabled in iCUE Settings → System');
    process.exit(1);
  }
  
  console.log('✅ Connected!\n');
  
  // Orange color (255, 165, 0)
  const orange = { r: 255, g: 165, b: 0 };
  
  console.log('Setting G1-G6 to orange...');
  
  // Set G1 through G6 to orange
  const gKeys = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
  for (const key of gKeys) {
    keyboard.setKeyColor(key, orange.r, orange.g, orange.b);
  }
  
  console.log('✅ G1-G6 are now orange!\n');
  console.log('ℹ️  Waiting for G key press...');
  console.log('ℹ️  Press any G key (G1-G12) to see the event');
  console.log('ℹ️  Press Ctrl+C to exit and restore iCUE control\n');
  
  // Listen for key press events
  keyboard.on('keydown', (event) => {
    console.log(`🔽 ${event.key} pressed! (keyId: ${event.keyId})`);
  });
  
  keyboard.on('keyup', (event) => {
    console.log(`🔼 ${event.key} released! (keyId: ${event.keyId})`);
  });
  
  // Handle Ctrl+C to gracefully disconnect
  process.on('SIGINT', () => {
    console.log('\n\n🔌 Disconnecting and restoring iCUE control...');
    keyboard.disconnect();
    console.log('✅ Done!');
    process.exit(0);
  });
  
  // Keep the process alive so colors stay active
  // In a real app, you'd wait for events here
  setInterval(() => {
    // Just keep alive - colors persist automatically
  }, 1000);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

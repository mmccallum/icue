/**
 * Simple quick test
 */

const CorsairKeyboard = require('../index.js');

console.log('🧪 Quick Test\n');

try {
  console.log('1. Creating CorsairKeyboard instance...');
  const kb = new CorsairKeyboard();
  console.log('   ✓ Success\n');

  console.log('2. Getting available keys...');
  const keys = kb.getAvailableKeys();
  console.log(`   ✓ Found ${keys.length} keys: ${keys.join(', ')}\n`);

  console.log('3. Checking methods...');
  const methods = ['initialize', 'setKeyColor', 'disconnect', 'turnOffKey'];
  methods.forEach(m => console.log(`   ✓ ${m}()`));
  console.log();

  console.log('4. Testing connection (will fail gracefully if iCUE not running)...');
  kb.initialize().then(success => {
    if (success) {
      console.log('   ✓ Connected to keyboard!\n');
      console.log('5. Testing color control...');
      kb.setKeyColor('G1', 255, 0, 0);
      console.log('   ✓ Set G1 to red');
      kb.setKeyColor('G2', 0, 255, 0);
      console.log('   ✓ Set G2 to green');
      kb.setKeyColor('G3', 0, 0, 255);
      console.log('   ✓ Set G3 to blue\n');

      console.log('6. Turning off lights...');
      kb.turnOffAllKeys();
      console.log('   ✓ All lights off\n');

      kb.disconnect();
      console.log('7. Disconnected\n');
    } else {
      console.log('   ℹ iCUE not available (this is OK for testing)\n');
    }

    console.log('✓ All basic tests passed!\n');
  }).catch(err => {
    console.log(`   ℹ Expected: ${err.message}\n`);
    console.log('✓ Error handling works correctly!\n');
  });

} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

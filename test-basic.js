/**
 * Example: Test without iCUE running
 * This demonstrates error handling
 */

const CorsairKeyboard = require('./index.js');

async function test() {
  const keyboard = new CorsairKeyboard();
  
  console.log('Attempting to connect without iCUE running...');
  const connected = await keyboard.initialize();
  
  if (!connected) {
    console.log('✓ Correctly handled missing iCUE');
  }
}

test();

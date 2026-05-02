#!/usr/bin/env node

/**
 * Helper script to generate a random SECRET_KEY for wallet encryption
 * 
 * Usage:
 *   node scripts/generateSecretKey.js
 * 
 * Output:
 *   A 32-byte key encoded as base64, ready to use as SECRET_KEY in .env
 */

const crypto = require('crypto');

function generateSecretKey() {
  // Generate 32 random bytes
  const secretKeyBytes = crypto.randomBytes(32);
  
  // Encode as base64 for easy storage in .env
  const secretKeyBase64 = secretKeyBytes.toString('base64');
  
  console.log('Generated new SECRET_KEY for wallet encryption:');
  console.log('');
  console.log(`SECRET_KEY=${secretKeyBase64}`);
  console.log('');
  console.log('Add this line to your .env file:');
  console.log(`export SECRET_KEY="${secretKeyBase64}"`);
  console.log('');
  console.log('For development, you can also run:');
  console.log(`export SECRET_KEY="${secretKeyBase64}"`);
}

// Run if executed directly
if (require.main === module) {
  generateSecretKey();
}

module.exports = {
  generateSecretKey,
};

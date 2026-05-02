const { encrypt, decrypt, loadSecretKey } = require('./cryptoUtil');

function loadOrGenerateSecretKey() {
  return loadSecretKey();
}

function validateSecretKey() {
  return loadSecretKey();
}

function encryptPrivateKey(privateKeyHex) {
  return encrypt(privateKeyHex);
}

function decryptPrivateKey(encryptedKeyBase64) {
  return decrypt(encryptedKeyBase64);
}

module.exports = {
  loadOrGenerateSecretKey,
  validateSecretKey,
  encrypt,
  decrypt,
  encryptPrivateKey,
  decryptPrivateKey,
};
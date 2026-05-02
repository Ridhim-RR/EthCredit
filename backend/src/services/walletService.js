const { ethers } = require('ethers');
const { encrypt, decrypt } = require('./cryptoUtil');

function createWallet() {
  const wallet = ethers.Wallet.createRandom();

  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
  };
}

function getWallet(encryptedKey) {
  const privateKey = decrypt(encryptedKey);
  return new ethers.Wallet(privateKey);
}

module.exports = {
  createWallet,
  getWallet,
  encryptPrivateKey: encrypt,
  decryptPrivateKey: decrypt,
};
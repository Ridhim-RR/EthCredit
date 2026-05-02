const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function loadSecretKey() {
  const secret = process.env.SECRET_KEY;

  if (!secret) {
    const error = new Error('SECRET_KEY environment variable is not set');
    error.statusCode = 500;
    throw error;
  }

  const secretKey = Buffer.from(secret, 'base64');

  if (secretKey.length !== 32) {
    const error = new Error('SECRET_KEY must decode to exactly 32 bytes');
    error.statusCode = 500;
    throw error;
  }

  return secretKey;
}

function encrypt(text) {
  if (typeof text !== 'string' || text.length === 0) {
    const error = new Error('Text to encrypt must be a non-empty string');
    error.statusCode = 400;
    throw error;
  }

  const key = loadSecretKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(payload) {
  if (typeof payload !== 'string' || payload.length === 0) {
    const error = new Error('Encrypted payload must be a non-empty string');
    error.statusCode = 400;
    throw error;
  }

  const raw = Buffer.from(payload, 'base64');
  if (raw.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    const error = new Error('Encrypted payload is invalid');
    error.statusCode = 400;
    throw error;
  }

  const key = loadSecretKey();
  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = {
  encrypt,
  decrypt,
  loadSecretKey,
};
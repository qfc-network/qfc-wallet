import CryptoJS from 'crypto-js';

/**
 * Encrypt text using AES
 */
const DEFAULT_KDF_ITERATIONS = 150000;
const SALT_BYTES = 16;
const IV_BYTES = 16;

function deriveKey(password: string, salt: CryptoJS.lib.WordArray, iterations: number) {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
}

export function encrypt(text: string, password: string, iterations: number = DEFAULT_KDF_ITERATIONS): string {
  const salt = CryptoJS.lib.WordArray.random(SALT_BYTES);
  const iv = CryptoJS.lib.WordArray.random(IV_BYTES);
  const key = deriveKey(password, salt, iterations);
  const ciphertext = CryptoJS.AES.encrypt(text, key, { iv }).toString();
  return `v3:${iterations}:${salt.toString(CryptoJS.enc.Base64)}:${iv.toString(
    CryptoJS.enc.Base64
  )}:${ciphertext}`;
}

/**
 * Decrypt ciphertext using AES
 */
export function decrypt(ciphertext: string, password: string): string {
  let decrypted = '';

  if (ciphertext.startsWith('v3:')) {
    const parts = ciphertext.split(':');
    if (parts.length !== 5) {
      throw new Error('Decryption failed - invalid data');
    }
    const iterations = Number(parts[1]);
    if (!Number.isFinite(iterations) || iterations <= 0) {
      throw new Error('Decryption failed - invalid data');
    }
    const salt = CryptoJS.enc.Base64.parse(parts[2]);
    const iv = CryptoJS.enc.Base64.parse(parts[3]);
    const key = deriveKey(password, salt, iterations);
    const bytes = CryptoJS.AES.decrypt(parts[4], key, { iv });
    decrypted = bytes.toString(CryptoJS.enc.Utf8);
  } else if (ciphertext.startsWith('v2:')) {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Decryption failed - invalid data');
    }
    const salt = CryptoJS.enc.Base64.parse(parts[1]);
    const iv = CryptoJS.enc.Base64.parse(parts[2]);
    const key = deriveKey(password, salt, 100000);
    const bytes = CryptoJS.AES.decrypt(parts[3], key, { iv });
    decrypted = bytes.toString(CryptoJS.enc.Utf8);
  } else {
    const bytes = CryptoJS.AES.decrypt(ciphertext, password);
    decrypted = bytes.toString(CryptoJS.enc.Utf8);
  }

  if (!decrypted) {
    throw new Error('Decryption failed - wrong password');
  }

  return decrypted;
}

export function isLegacyCiphertext(ciphertext: string): boolean {
  return !ciphertext.startsWith('v3:');
}

export function hashString(text: string): string {
  return CryptoJS.SHA256(text).toString();
}

/**
 * Generate a random password
 */
export function generatePassword(length: number = 32): string {
  const charset =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';

  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    password += charset[randomValues[i] % charset.length];
  }

  return password;
}

/**
 * Hash a password using SHA-256
 */
export function hashPassword(password: string): string {
  return CryptoJS.SHA256(password).toString();
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

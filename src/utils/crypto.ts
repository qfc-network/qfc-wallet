import CryptoJS from 'crypto-js';

/**
 * Encrypt text using AES
 */
export function encrypt(text: string, password: string): string {
  const salt = CryptoJS.lib.WordArray.random(16);
  const iv = CryptoJS.lib.WordArray.random(16);
  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: 256 / 32,
    iterations: 100000,
    hasher: CryptoJS.algo.SHA256,
  });
  const ciphertext = CryptoJS.AES.encrypt(text, key, { iv }).toString();
  return `v2:${salt.toString(CryptoJS.enc.Base64)}:${iv.toString(
    CryptoJS.enc.Base64
  )}:${ciphertext}`;
}

/**
 * Decrypt ciphertext using AES
 */
export function decrypt(ciphertext: string, password: string): string {
  let decrypted = '';

  if (ciphertext.startsWith('v2:')) {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Decryption failed - invalid data');
    }
    const salt = CryptoJS.enc.Base64.parse(parts[1]);
    const iv = CryptoJS.enc.Base64.parse(parts[2]);
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256,
    });
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

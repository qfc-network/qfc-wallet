import CryptoJS from 'crypto-js';

/**
 * Encrypt text using AES
 */
export function encrypt(text: string, password: string): string {
  return CryptoJS.AES.encrypt(text, password).toString();
}

/**
 * Decrypt ciphertext using AES
 */
export function decrypt(ciphertext: string, password: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, password);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);

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

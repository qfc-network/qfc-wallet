import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  isLegacyCiphertext,
  hashString,
  generatePassword,
  hashPassword,
  verifyPassword,
} from './crypto';

describe('crypto', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plaintext = 'Hello, World!';
      const password = 'TestPassword123!';

      const encrypted = encrypt(plaintext, password);
      const decrypted = decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt with v3 format', () => {
      const plaintext = 'secret data';
      const password = 'password123';

      const encrypted = encrypt(plaintext, password);

      expect(encrypted).toMatch(/^v3:\d+:/);
    });

    it('should use custom iterations', () => {
      const plaintext = 'test';
      const password = 'pass';
      const iterations = 1000;

      const encrypted = encrypt(plaintext, password, iterations);

      expect(encrypted.startsWith(`v3:${iterations}:`)).toBe(true);
    });

    it('should decrypt with correct password', () => {
      const plaintext = 'my private key';
      const password = 'correct_password';

      const encrypted = encrypt(plaintext, password);
      const decrypted = decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail to decrypt with wrong password', () => {
      const plaintext = 'sensitive data';
      const password = 'correct_password';
      const wrongPassword = 'wrong_password';

      const encrypted = encrypt(plaintext, password);

      expect(() => decrypt(encrypted, wrongPassword)).toThrow(
        'Decryption failed'
      );
    });

    it('should handle special characters in plaintext', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const password = 'password123';

      const encrypted = encrypt(plaintext, password);
      const decrypted = decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode in plaintext', () => {
      const plaintext = '你好世界 🌍 مرحبا';
      const password = 'password123';

      const encrypted = encrypt(plaintext, password);
      const decrypted = decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const password = 'password123';

      const encrypted = encrypt(plaintext, password);

      // Empty string encryption may behave differently
      // This test documents the behavior
      expect(encrypted).toMatch(/^v3:\d+:/);
    });

    it('should handle long plaintext', () => {
      const plaintext = 'a'.repeat(10000);
      const password = 'password123';

      const encrypted = encrypt(plaintext, password);
      const decrypted = decrypt(encrypted, password);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext (random salt/IV)', () => {
      const plaintext = 'same text';
      const password = 'same password';

      const encrypted1 = encrypt(plaintext, password);
      const encrypted2 = encrypt(plaintext, password);

      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same plaintext
      expect(decrypt(encrypted1, password)).toBe(plaintext);
      expect(decrypt(encrypted2, password)).toBe(plaintext);
    });

    it('should throw on invalid v3 format (missing parts)', () => {
      expect(() => decrypt('v3:invalid', 'password')).toThrow(
        'Decryption failed - invalid data'
      );
    });

    it('should throw on invalid v3 format (invalid iterations)', () => {
      expect(() =>
        decrypt('v3:abc:salt:iv:cipher', 'password')
      ).toThrow('Decryption failed - invalid data');
    });

    it('should throw on invalid v3 format (zero iterations)', () => {
      expect(() =>
        decrypt('v3:0:salt:iv:cipher', 'password')
      ).toThrow('Decryption failed - invalid data');
    });

    it('should throw on invalid v3 format (negative iterations)', () => {
      expect(() =>
        decrypt('v3:-1:salt:iv:cipher', 'password')
      ).toThrow('Decryption failed - invalid data');
    });
  });

  describe('isLegacyCiphertext', () => {
    it('should return false for v3 format', () => {
      const v3Ciphertext = 'v3:150000:salt:iv:ciphertext';
      expect(isLegacyCiphertext(v3Ciphertext)).toBe(false);
    });

    it('should return true for v2 format', () => {
      const v2Ciphertext = 'v2:salt:iv:ciphertext';
      expect(isLegacyCiphertext(v2Ciphertext)).toBe(true);
    });

    it('should return true for legacy format (no prefix)', () => {
      const legacyCiphertext = 'U2FsdGVkX1...';
      expect(isLegacyCiphertext(legacyCiphertext)).toBe(true);
    });
  });

  describe('hashString', () => {
    it('should produce consistent hash for same input', () => {
      const input = 'test string';
      const hash1 = hashString(input);
      const hash2 = hashString(input);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different inputs', () => {
      const hash1 = hashString('input1');
      const hash2 = hashString('input2');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce 64-character hex string (SHA256)', () => {
      const hash = hashString('test');

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should handle empty string', () => {
      const hash = hashString('');

      // SHA256 of empty string
      expect(hash).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      );
    });
  });

  describe('generatePassword', () => {
    it('should generate password of default length (32)', () => {
      const password = generatePassword();

      expect(password.length).toBe(32);
    });

    it('should generate password of specified length', () => {
      const password = generatePassword(16);

      expect(password.length).toBe(16);
    });

    it('should generate different passwords each time', () => {
      const password1 = generatePassword();
      const password2 = generatePassword();

      expect(password1).not.toBe(password2);
    });

    it('should only contain valid charset characters', () => {
      const charset =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
      const password = generatePassword(100);

      for (const char of password) {
        expect(charset).toContain(char);
      }
    });
  });

  describe('hashPassword', () => {
    it('should produce consistent hash', () => {
      const password = 'MySecretPassword123!';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).toBe(hash2);
    });

    it('should produce 64-character hex string', () => {
      const hash = hashPassword('password');

      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', () => {
      const password = 'MyPassword123!';
      const hash = hashPassword(password);

      expect(verifyPassword(password, hash)).toBe(true);
    });

    it('should return false for incorrect password', () => {
      const password = 'MyPassword123!';
      const hash = hashPassword(password);

      expect(verifyPassword('wrongPassword', hash)).toBe(false);
    });

    it('should be case-sensitive', () => {
      const password = 'Password';
      const hash = hashPassword(password);

      expect(verifyPassword('password', hash)).toBe(false);
      expect(verifyPassword('PASSWORD', hash)).toBe(false);
    });
  });
});

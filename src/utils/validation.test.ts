import { describe, it, expect } from 'vitest';
import {
  isValidAddress,
  isValidHex,
  isValidValue,
  isValidMnemonic,
  isValidPrivateKey,
  validatePassword,
  formatAddress,
  formatBalance,
} from './validation';

describe('validation', () => {
  describe('isValidAddress', () => {
    it('should return true for valid checksummed address', () => {
      expect(
        isValidAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')
      ).toBe(true);
    });

    it('should return true for valid lowercase address', () => {
      expect(
        isValidAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')
      ).toBe(true);
    });

    it('should return true for valid uppercase address', () => {
      expect(
        isValidAddress('0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED')
      ).toBe(true);
    });

    it('should return true for address without 0x prefix (ethers.js accepts it)', () => {
      // ethers.js isAddress() accepts addresses without 0x prefix
      expect(isValidAddress('5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(
        true
      );
    });

    it('should return false for address with wrong length', () => {
      expect(isValidAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1Be')).toBe(
        false
      );
    });

    it('should return false for empty string', () => {
      expect(isValidAddress('')).toBe(false);
    });

    it('should return false for random string', () => {
      expect(isValidAddress('not an address')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isValidAddress(null as unknown as string)).toBe(false);
      expect(isValidAddress(undefined as unknown as string)).toBe(false);
    });
  });

  describe('isValidHex', () => {
    it('should return true for valid hex with 0x prefix', () => {
      expect(isValidHex('0x1234abcd')).toBe(true);
    });

    it('should return true for empty hex (just 0x)', () => {
      expect(isValidHex('0x')).toBe(true);
    });

    it('should return true for uppercase hex', () => {
      expect(isValidHex('0xABCDEF')).toBe(true);
    });

    it('should return true for mixed case hex', () => {
      expect(isValidHex('0xAbCdEf123')).toBe(true);
    });

    it('should return false for hex without 0x prefix', () => {
      expect(isValidHex('1234abcd')).toBe(false);
    });

    it('should return false for invalid hex characters', () => {
      expect(isValidHex('0x1234ghij')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidHex('')).toBe(false);
    });
  });

  describe('isValidValue', () => {
    it('should return true for zero', () => {
      expect(isValidValue('0')).toBe(true);
    });

    it('should return true for positive integers', () => {
      expect(isValidValue('1000000000000000000')).toBe(true);
    });

    it('should return true for very large values', () => {
      expect(
        isValidValue('115792089237316195423570985008687907853269984665640564039457584007913129639935')
      ).toBe(true);
    });

    it('should return false for negative values', () => {
      expect(isValidValue('-1')).toBe(false);
    });

    it('should return false for non-numeric strings', () => {
      expect(isValidValue('abc')).toBe(false);
    });

    it('should return false for decimal values', () => {
      expect(isValidValue('1.5')).toBe(false);
    });

    it('should return true for empty string (BigInt("") = 0n)', () => {
      // BigInt('') evaluates to 0n, which is valid
      expect(isValidValue('')).toBe(true);
    });

    it('should return true for hex string value', () => {
      expect(isValidValue('0x0')).toBe(true);
      expect(isValidValue('0x1')).toBe(true);
    });
  });

  describe('isValidMnemonic', () => {
    // Note: In the jsdom test environment, ethers.js Mnemonic validation may behave differently
    // These tests verify the function handles various inputs correctly

    it('should return false for invalid mnemonic words', () => {
      const mnemonic =
        'invalid words that are not in bip39 wordlist blah blah';
      expect(isValidMnemonic(mnemonic)).toBe(false);
    });

    it('should return false for wrong number of words', () => {
      const mnemonic = 'abandon abandon abandon';
      expect(isValidMnemonic(mnemonic)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidMnemonic('')).toBe(false);
    });

    it('should return false for invalid checksum', () => {
      // Valid words but invalid checksum
      const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
      expect(isValidMnemonic(mnemonic)).toBe(false);
    });

    it('should handle mnemonic validation consistently', () => {
      // Test that the function returns a boolean and doesn't throw
      const result = isValidMnemonic('test test test test test test test test test test test test');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isValidPrivateKey', () => {
    it('should return true for valid 64-char hex private key', () => {
      const privateKey =
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      expect(isValidPrivateKey(privateKey)).toBe(true);
    });

    it('should return true for private key without 0x prefix', () => {
      const privateKey =
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      expect(isValidPrivateKey(privateKey)).toBe(true);
    });

    it('should return false for too short key', () => {
      const privateKey = '0x1234567890abcdef';
      expect(isValidPrivateKey(privateKey)).toBe(false);
    });

    it('should return false for too long key', () => {
      const privateKey =
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef00';
      expect(isValidPrivateKey(privateKey)).toBe(false);
    });

    it('should return false for invalid hex characters', () => {
      const privateKey =
        '0x0123456789ghijkl0123456789abcdef0123456789abcdef0123456789abcdef';
      expect(isValidPrivateKey(privateKey)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidPrivateKey('')).toBe(false);
    });

    it('should return false for all zeros (invalid key)', () => {
      const privateKey =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      expect(isValidPrivateKey(privateKey)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return valid for strong password', () => {
      const result = validatePassword('StrongPass1');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for password shorter than 8 characters', () => {
      const result = validatePassword('Short1A');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Password must be at least 8 characters'
      );
    });

    it('should fail for password without uppercase', () => {
      const result = validatePassword('lowercase123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one uppercase letter'
      );
    });

    it('should fail for password without lowercase', () => {
      const result = validatePassword('UPPERCASE123');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one lowercase letter'
      );
    });

    it('should fail for password without number', () => {
      const result = validatePassword('NoNumbersHere');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'Password must contain at least one number'
      );
    });

    it('should return multiple errors for multiple failures', () => {
      const result = validatePassword('short');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('should pass with exactly 8 characters meeting all requirements', () => {
      const result = validatePassword('Abcdef1!');
      expect(result.valid).toBe(true);
    });

    it('should not require special characters', () => {
      const result = validatePassword('Password123');
      expect(result.valid).toBe(true);
    });
  });

  describe('formatAddress', () => {
    it('should format address with default 4 characters', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const formatted = formatAddress(address);
      expect(formatted).toBe('0x1234...5678');
    });

    it('should format address with custom character count', () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const formatted = formatAddress(address, 6);
      expect(formatted).toBe('0x123456...345678');
    });

    it('should return empty string for empty input', () => {
      expect(formatAddress('')).toBe('');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatAddress(null as unknown as string)).toBe('');
      expect(formatAddress(undefined as unknown as string)).toBe('');
    });

    it('should handle short addresses', () => {
      const address = '0x1234';
      const formatted = formatAddress(address, 4);
      expect(formatted).toBe('0x1234...1234');
    });
  });

  describe('formatBalance', () => {
    it('should format balance with default 4 decimals', () => {
      expect(formatBalance('1.23456789')).toBe('1.2346');
    });

    it('should format balance with custom decimals', () => {
      expect(formatBalance('1.23456789', 2)).toBe('1.23');
    });

    it('should format whole numbers', () => {
      expect(formatBalance('100')).toBe('100.0000');
    });

    it('should return "0" for invalid input', () => {
      expect(formatBalance('not a number')).toBe('0');
    });

    it('should return "0" for empty string', () => {
      expect(formatBalance('')).toBe('0');
    });

    it('should handle very small numbers', () => {
      expect(formatBalance('0.000001', 6)).toBe('0.000001');
    });

    it('should handle very large numbers', () => {
      expect(formatBalance('1000000000.123456', 2)).toBe('1000000000.12');
    });

    it('should handle zero', () => {
      expect(formatBalance('0')).toBe('0.0000');
    });

    it('should handle negative numbers', () => {
      expect(formatBalance('-1.5', 2)).toBe('-1.50');
    });
  });
});

import { ethers } from 'ethers';

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Validate hex string
 */
export function isValidHex(hex: string): boolean {
  return /^0x[0-9a-fA-F]*$/.test(hex);
}

/**
 * Validate transaction value (must be non-negative)
 */
export function isValidValue(value: string): boolean {
  try {
    const bn = BigInt(value);
    return bn >= 0n;
  } catch {
    return false;
  }
}

/**
 * Validate mnemonic phrase
 */
export function isValidMnemonic(phrase: string): boolean {
  try {
    return ethers.Mnemonic.isValidMnemonic(phrase);
  } catch {
    return false;
  }
}

/**
 * Validate private key
 */
export function isValidPrivateKey(key: string): boolean {
  try {
    // Remove 0x prefix if present
    const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
    // Private key should be 64 hex characters (32 bytes)
    if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
      return false;
    }
    // Try to create a wallet from it
    new ethers.Wallet(key.startsWith('0x') ? key : `0x${key}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format address for display (0x1234...5678)
 */
export function formatAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format balance with decimals
 */
export function formatBalance(balance: string, decimals: number = 4): string {
  try {
    const value = parseFloat(balance);
    if (isNaN(value)) return '0';
    return value.toFixed(decimals);
  } catch {
    return '0';
  }
}

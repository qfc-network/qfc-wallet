export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance?: string;
  logoUrl?: string;
}

// Standard ERC-20 ABI for balance and transfer
export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// Default tokens for QFC Network
export const DEFAULT_TOKENS: Token[] = [
  // Add default tokens here when available
];

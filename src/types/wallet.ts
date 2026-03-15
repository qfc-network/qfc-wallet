export type WalletType = 'software' | 'ledger' | 'trezor';

export interface Wallet {
  address: string;
  encryptedPrivateKey: string;
  encryptedMnemonic?: string;
  mnemonicId?: string;
  hdIndex?: number;
  name: string;
  createdAt: number;
  type?: WalletType;         // 'software' (default) | 'ledger' | 'trezor'
  hdPath?: string;           // Full HD derivation path for hardware wallets
}

export interface WalletState {
  wallets: Wallet[];
  currentAddress: string | null;
  isUnlocked: boolean;
  balance: string;
  network: NetworkConfig;
}

export interface NetworkConfig {
  chainId: number;
  chainIdHex: string;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  symbol: string;
  decimals: number;
}

export interface CreateWalletResult {
  address: string;
  mnemonic: string;
}

export interface Account {
  address: string;
  name: string;
  balance?: string;
  type?: WalletType;
}

// --- NFT types ---

export interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  animation_url?: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

export interface NFTAsset {
  contractAddress: string;
  tokenId: string;
  standard: 'ERC-721' | 'ERC-1155';
  balance: string;        // "1" for ERC-721, variable for ERC-1155
  tokenURI?: string;
  metadata?: NFTMetadata;
  name?: string;          // From contract name()
  symbol?: string;        // From contract symbol()
  collectionName?: string;
}

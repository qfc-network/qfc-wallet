export interface Wallet {
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
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
}

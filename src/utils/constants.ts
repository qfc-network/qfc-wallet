import type { NetworkConfig } from '../types/wallet';

// QFC Network Configuration
export const NETWORKS: Record<string, NetworkConfig> = {
  localhost: {
    chainId: 9000,
    chainIdHex: '0x2328',
    name: 'QFC Local',
    rpcUrl: 'http://127.0.0.1:8545',
    explorerUrl: 'http://127.0.0.1:3000',
    symbol: 'QFC',
    decimals: 18,
  },
  testnet: {
    chainId: 9000,
    chainIdHex: '0x2328',
    name: 'QFC Testnet',
    rpcUrl: 'https://rpc.testnet.qfc.network',
    explorerUrl: 'https://explorer.testnet.qfc.network',
    symbol: 'QFC',
    decimals: 18,
  },
  mainnet: {
    chainId: 9001,
    chainIdHex: '0x2329',
    name: 'QFC Mainnet',
    rpcUrl: 'https://rpc.qfc.network',
    explorerUrl: 'https://explorer.qfc.network',
    symbol: 'QFC',
    decimals: 18,
  },
};

export type NetworkKey = string;

export const DEFAULT_NETWORK = NETWORKS.localhost;

// Auto-lock timeout (30 minutes)
export const LOCK_TIMEOUT_MS = 30 * 60 * 1000;

// Transaction timeout (30 seconds)
export const TX_TIMEOUT_MS = 30 * 1000;

// Storage keys
export const STORAGE_KEYS = {
  WALLETS: 'qfc_wallets',
  CURRENT_ADDRESS: 'qfc_current_address',
  NETWORK: 'qfc_network',
  CUSTOM_NETWORKS: 'qfc_custom_networks',
  CONNECTED_SITES: 'qfc_connected_sites',
  TX_HISTORY: 'qfc_tx_history',
  TOKENS: 'qfc_tokens',
  PENDING_APPROVALS: 'qfc_pending_approvals',
  CONTACTS: 'qfc_contacts',
  NFTS: 'qfc_nfts',
} as const;

// Message types
export const MESSAGE_TYPES = {
  REQUEST: 'QFC_REQUEST',
  RESPONSE: 'QFC_RESPONSE',
  NOTIFICATION: 'QFC_NOTIFICATION',
  APPROVAL_REQUEST: 'QFC_APPROVAL_REQUEST',
  APPROVAL_RESPONSE: 'QFC_APPROVAL_RESPONSE',
} as const;

export const TOKEN_LOGOS: Record<string, string> = {
  QFC: '/icons/qfc.svg',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  WETH: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
};

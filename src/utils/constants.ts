// QFC Network Configuration

export const NETWORKS = {
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
} as const;

export type NetworkKey = keyof typeof NETWORKS;

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
  CONNECTED_SITES: 'qfc_connected_sites',
  TX_HISTORY: 'qfc_tx_history',
  TOKENS: 'qfc_tokens',
  PENDING_APPROVALS: 'qfc_pending_approvals',
  CONTACTS: 'qfc_contacts',
} as const;

// Message types
export const MESSAGE_TYPES = {
  REQUEST: 'QFC_REQUEST',
  RESPONSE: 'QFC_RESPONSE',
  NOTIFICATION: 'QFC_NOTIFICATION',
  APPROVAL_REQUEST: 'QFC_APPROVAL_REQUEST',
  APPROVAL_RESPONSE: 'QFC_APPROVAL_RESPONSE',
} as const;

export interface TransactionRequest {
  from: string;
  to: string;
  value?: string;
  data?: string;
  gas?: string;
  gasPrice?: string;
  nonce?: number;
}

export interface TransactionRecord {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
  type: 'send' | 'receive' | 'contract' | 'token' | 'token_transfer';
  tokenSymbol?: string;
  tokenAddress?: string;
  nonce?: number;
}

export interface PendingApproval {
  id: string;
  type: 'transaction' | 'sign' | 'connect' | 'add_chain';
  origin: string;
  favicon?: string;
  timestamp: number;
  data: TransactionRequest | SignRequest | ConnectRequest | AddChainRequest;
}

export interface SignRequest {
  message: string;
  address: string;
  isTypedData?: boolean;
}

export interface ConnectRequest {
  origin: string;
  title?: string;
  favicon?: string;
}

export interface AddChainRequest {
  chainId: string;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls?: string[];
}

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
  type: 'send' | 'receive' | 'contract' | 'token';
  tokenSymbol?: string;
  tokenAddress?: string;
  nonce?: number;
}

export interface PendingApproval {
  id: string;
  type: 'transaction' | 'sign' | 'connect';
  origin: string;
  favicon?: string;
  timestamp: number;
  data: TransactionRequest | SignRequest | ConnectRequest;
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

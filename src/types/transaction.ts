export interface TransactionRequest {
  from: string;
  to: string;
  value?: string;
  data?: string;
  gas?: string;
  gasPrice?: string;
  nonce?: number;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
}

export interface PendingTransaction {
  id: number;
  request: TransactionRequest;
  origin: string;
  resolve: (hash: string) => void;
  reject: (error: Error) => void;
}

export interface SignMessageRequest {
  id: number;
  message: string;
  address: string;
  origin: string;
  resolve: (signature: string) => void;
  reject: (error: Error) => void;
}

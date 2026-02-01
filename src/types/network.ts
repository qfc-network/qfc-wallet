export interface RpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown[];
}

export interface RpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: number;
  result?: T;
  error?: RpcError;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface ProviderMessage {
  type: 'QFC_REQUEST' | 'QFC_RESPONSE' | 'QFC_NOTIFICATION';
  id?: number;
  payload: {
    method: string;
    params?: unknown[];
    result?: unknown;
    error?: RpcError;
  };
}

// Standard JSON-RPC error codes
export const RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
  // Provider errors (EIP-1193)
  USER_REJECTED: { code: 4001, message: 'User rejected the request' },
  UNAUTHORIZED: { code: 4100, message: 'The requested account has not been authorized' },
  UNSUPPORTED_METHOD: { code: 4200, message: 'The requested method is not supported' },
  DISCONNECTED: { code: 4900, message: 'The provider is disconnected' },
  CHAIN_DISCONNECTED: { code: 4901, message: 'The provider is not connected to the requested chain' },
} as const;

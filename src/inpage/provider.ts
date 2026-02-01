/**
 * QFC Provider - Injected into the webpage as window.qfc
 * Compatible with EIP-1193 standard
 */

interface RequestArguments {
  method: string;
  params?: unknown[];
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

// Extend Window interface
declare global {
  interface Window {
    qfc: QFCProvider;
    ethereum: QFCProvider;
  }
}

class QFCProvider extends EventTarget {
  public isQFC = true;
  public isMetaMask = true; // Compatibility flag for DApps
  public chainId: string;
  public selectedAddress: string | null = null;
  public networkVersion: string;

  private _requestId = 0;
  private _pendingRequests: Map<number, PendingRequest> = new Map();
  private _connected = false;

  constructor() {
    super();
    this.chainId = '0x2328'; // 9000 (testnet)
    this.networkVersion = '9000';

    // Listen for messages from content script
    window.addEventListener('message', this._handleMessage.bind(this));

    // Wait for content script to be ready
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'QFC_CONTENT_READY') {
        this._connected = true;
        this._emit('connect', { chainId: this.chainId });
      }
    });
  }

  /**
   * Check if connected to the provider
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Main method: Send RPC request
   */
  async request(args: RequestArguments): Promise<unknown> {
    const { method, params = [] } = args;

    console.log(`[QFC] Request: ${method}`, params);

    // Handle some methods locally
    switch (method) {
      case 'eth_accounts':
        return this.selectedAddress ? [this.selectedAddress] : [];

      case 'eth_chainId':
        return this.chainId;

      case 'net_version':
        return this.networkVersion;

      default:
        return this._sendToBackground({ method, params });
    }
  }

  /**
   * Legacy method: send (deprecated but still used by some DApps)
   */
  send(
    methodOrPayload: string | { method: string; params?: unknown[] },
    paramsOrCallback?: unknown[] | ((error: Error | null, result?: unknown) => void)
  ): Promise<unknown> | void {
    // Handle callback style
    if (typeof paramsOrCallback === 'function') {
      const payload =
        typeof methodOrPayload === 'string'
          ? { method: methodOrPayload }
          : methodOrPayload;

      this.request(payload)
        .then((result) => paramsOrCallback(null, { result }))
        .catch((error) => paramsOrCallback(error));
      return;
    }

    // Handle promise style
    const method =
      typeof methodOrPayload === 'string'
        ? methodOrPayload
        : methodOrPayload.method;
    const params =
      typeof methodOrPayload === 'string'
        ? (paramsOrCallback as unknown[]) || []
        : methodOrPayload.params || [];

    return this.request({ method, params });
  }

  /**
   * Legacy method: sendAsync
   */
  sendAsync(
    payload: { method: string; params?: unknown[]; id?: number },
    callback: (error: Error | null, result?: unknown) => void
  ): void {
    this.request(payload)
      .then((result) => callback(null, { jsonrpc: '2.0', id: payload.id, result }))
      .catch((error) => callback(error));
  }

  /**
   * Enable method (legacy, same as eth_requestAccounts)
   */
  async enable(): Promise<string[]> {
    const accounts = await this.request({ method: 'eth_requestAccounts' });
    return accounts as string[];
  }

  /**
   * Send request to background service
   */
  private _sendToBackground(payload: {
    method: string;
    params?: unknown[];
  }): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this._requestId++;

      this._pendingRequests.set(id, { resolve, reject });

      // Send to content script
      window.postMessage(
        {
          type: 'QFC_REQUEST',
          id,
          payload,
        },
        '*'
      );

      // Timeout handling
      setTimeout(() => {
        if (this._pendingRequests.has(id)) {
          this._pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Handle messages from content script
   */
  private _handleMessage(event: MessageEvent): void {
    if (event.source !== window) return;

    const { type, id, payload } = event.data;

    if (type === 'QFC_RESPONSE') {
      const pending = this._pendingRequests.get(id);
      if (pending) {
        this._pendingRequests.delete(id);

        if (payload.error) {
          pending.reject(new Error(payload.error.message || 'Unknown error'));
        } else {
          // Update selectedAddress if accounts changed
          if (
            payload.result &&
            Array.isArray(payload.result) &&
            payload.result.length > 0 &&
            typeof payload.result[0] === 'string' &&
            payload.result[0].startsWith('0x')
          ) {
            const newAddress = payload.result[0];
            if (this.selectedAddress !== newAddress) {
              this.selectedAddress = newAddress;
              this._emit('accountsChanged', payload.result);
            }
          }

          pending.resolve(payload.result);
        }
      }
    }

    if (type === 'QFC_NOTIFICATION') {
      const { method, params } = payload;
      this._emit(method, params);

      // Handle specific notifications
      if (method === 'accountsChanged') {
        this.selectedAddress = params[0] || null;
      } else if (method === 'chainChanged') {
        this.chainId = params;
        this.networkVersion = parseInt(params, 16).toString();
      }
    }
  }

  /**
   * Emit event
   */
  private _emit(event: string, data: unknown): void {
    console.log(`[QFC] Event: ${event}`, data);
    this.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  /**
   * Legacy: on() event listener
   */
  on(event: string, callback: (data: unknown) => void): this {
    this.addEventListener(event, ((e: CustomEvent) =>
      callback(e.detail)) as EventListener);
    return this;
  }

  /**
   * Legacy: once() event listener
   */
  once(event: string, callback: (data: unknown) => void): this {
    const handler = ((e: CustomEvent) => {
      callback(e.detail);
      this.removeEventListener(event, handler as EventListener);
    }) as EventListener;
    this.addEventListener(event, handler);
    return this;
  }

  /**
   * Legacy: removeListener()
   */
  removeListener(event: string, callback: (data: unknown) => void): this {
    this.removeEventListener(event, callback as EventListener);
    return this;
  }

  /**
   * Legacy: removeAllListeners()
   */
  removeAllListeners(_event?: string): this {
    // Note: EventTarget doesn't have a built-in removeAllListeners
    // This is a simplified implementation
    console.warn('[QFC] removeAllListeners not fully implemented');
    return this;
  }
}

// Inject provider
const provider = new QFCProvider();
window.qfc = provider;
window.ethereum = provider; // MetaMask compatibility

// Announce provider
window.dispatchEvent(new Event('ethereum#initialized'));

// EIP-6963 provider announcement
const info = {
  uuid: 'qfc-wallet-' + Date.now(),
  name: 'QFC Wallet',
  icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%238b5cf6"/><text x="50" y="65" font-size="40" text-anchor="middle" fill="white">Q</text></svg>',
  rdns: 'network.qfc.wallet',
};

window.dispatchEvent(
  new CustomEvent('eip6963:announceProvider', {
    detail: Object.freeze({ info, provider }),
  })
);

// Listen for provider requests (EIP-6963)
window.addEventListener('eip6963:requestProvider', () => {
  window.dispatchEvent(
    new CustomEvent('eip6963:announceProvider', {
      detail: Object.freeze({ info, provider }),
    })
  );
});

console.log('[QFC] Provider injected');

export {};

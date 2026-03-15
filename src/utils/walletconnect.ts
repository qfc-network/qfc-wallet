/**
 * WalletConnect v2 Integration
 *
 * Allows DApps to connect to QFC Wallet via QR code or deep link.
 * Uses @walletconnect/web3wallet for session management.
 *
 * Flow:
 *   1. DApp shows WC URI (QR code or paste)
 *   2. User scans/pastes in wallet → pair()
 *   3. Wallet approves session with supported chains/methods
 *   4. DApp sends requests → wallet shows approval dialog
 *   5. User approves → wallet signs and returns result
 */

// WC types (from @walletconnect/types)
export interface WCSession {
  topic: string;
  peer: {
    metadata: {
      name: string;
      description: string;
      url: string;
      icons: string[];
    };
  };
  namespaces: Record<string, { accounts: string[]; methods: string[]; events: string[] }>;
  expiry: number;
}

export interface WCRequest {
  id: number;
  topic: string;
  method: string;
  params: unknown[];
  peerMeta: {
    name: string;
    url: string;
    icons: string[];
  };
}

export type WCEventHandler = {
  onSessionProposal: (proposal: any) => Promise<boolean>;
  onSessionRequest: (request: WCRequest) => Promise<unknown>;
  onSessionDelete: (topic: string) => void;
};

// QFC chain definitions for WalletConnect
const QFC_CHAINS = {
  testnet: {
    chainId: 'eip155:9000',
    name: 'QFC Testnet',
    rpcUrl: 'https://rpc.testnet.qfc.network',
  },
  mainnet: {
    chainId: 'eip155:9001',
    name: 'QFC Mainnet',
    rpcUrl: 'https://rpc.qfc.network',
  },
};

// Supported methods
const SUPPORTED_METHODS = [
  'eth_sendTransaction',
  'eth_signTransaction',
  'eth_sign',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
];

const SUPPORTED_EVENTS = [
  'chainChanged',
  'accountsChanged',
];

/**
 * WalletConnect v2 Manager
 *
 * Manages pairing, sessions, and request handling.
 * In a Chrome Extension context, this runs in the popup window.
 */
export class WalletConnectManager {
  private web3wallet: any = null;
  private sessions: Map<string, WCSession> = new Map();
  private handlers: WCEventHandler;
  private projectId: string;
  private initialized = false;

  constructor(projectId: string, handlers: WCEventHandler) {
    this.projectId = projectId;
    this.handlers = handlers;
  }

  /**
   * Initialize the WalletConnect Web3Wallet SDK
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    const { Web3Wallet } = await import('@walletconnect/web3wallet');
    const { Core } = await import('@walletconnect/core');

    const core = new Core({ projectId: this.projectId }) as any;

    this.web3wallet = await Web3Wallet.init({
      core,
      metadata: {
        name: 'QFC Wallet',
        description: 'QFC Network Browser Wallet',
        url: 'https://wallet.qfc.network',
        icons: ['https://wallet.qfc.network/icon-128.png'],
      },
    });

    // Register event listeners
    this.web3wallet.on('session_proposal', async (proposal: any) => {
      const approved = await this.handlers.onSessionProposal(proposal);
      if (approved) {
        await this.approveSession(proposal);
      } else {
        await this.rejectSession(proposal);
      }
    });

    this.web3wallet.on('session_request', async (event: any) => {
      const { id, topic } = event;
      const session = this.web3wallet.getActiveSessions()[topic];

      const request: WCRequest = {
        id,
        topic,
        method: event.params.request.method,
        params: event.params.request.params,
        peerMeta: {
          name: session?.peer?.metadata?.name || 'Unknown DApp',
          url: session?.peer?.metadata?.url || '',
          icons: session?.peer?.metadata?.icons || [],
        },
      };

      try {
        const result = await this.handlers.onSessionRequest(request);
        await this.web3wallet.respondSessionRequest({
          topic,
          response: { id, jsonrpc: '2.0', result },
        });
      } catch (error: any) {
        await this.web3wallet.respondSessionRequest({
          topic,
          response: {
            id,
            jsonrpc: '2.0',
            error: { code: 4001, message: error.message || 'User rejected' },
          },
        });
      }
    });

    this.web3wallet.on('session_delete', (event: any) => {
      this.sessions.delete(event.topic);
      this.handlers.onSessionDelete(event.topic);
    });

    // Load existing sessions
    const activeSessions = this.web3wallet.getActiveSessions();
    for (const [topic, session] of Object.entries(activeSessions)) {
      this.sessions.set(topic, session as WCSession);
    }

    this.initialized = true;
  }

  /**
   * Pair with a DApp using a WalletConnect URI
   * @param uri The WC URI (from QR code or paste)
   */
  async pair(uri: string): Promise<void> {
    if (!this.web3wallet) throw new Error('WalletConnect not initialized');
    await this.web3wallet.pair({ uri });
  }

  /**
   * Approve a session proposal
   */
  private async approveSession(proposal: any): Promise<void> {
    const { id } = proposal;

    // Get current wallet address
    const address = await this.getCurrentAddress();

    // Build approved namespaces
    const namespaces: Record<string, any> = {};

    // Support both QFC testnet and mainnet
    const chains = [QFC_CHAINS.testnet.chainId, QFC_CHAINS.mainnet.chainId];
    const accounts = chains.map(chain => `${chain}:${address}`);

    namespaces['eip155'] = {
      chains,
      accounts,
      methods: SUPPORTED_METHODS,
      events: SUPPORTED_EVENTS,
    };

    const session = await this.web3wallet.approveSession({
      id,
      namespaces,
    });

    this.sessions.set(session.topic, session);
  }

  /**
   * Reject a session proposal
   */
  private async rejectSession(proposal: any): Promise<void> {
    await this.web3wallet.rejectSession({
      id: proposal.id,
      reason: { code: 4001, message: 'User rejected session' },
    });
  }

  /**
   * Disconnect a session
   */
  async disconnect(topic: string): Promise<void> {
    if (!this.web3wallet) return;

    await this.web3wallet.disconnectSession({
      topic,
      reason: { code: 6000, message: 'User disconnected' },
    });

    this.sessions.delete(topic);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): WCSession[] {
    if (!this.web3wallet) return [];
    const sessions = this.web3wallet.getActiveSessions();
    return Object.values(sessions);
  }

  /**
   * Emit an event to all active sessions (e.g., accountsChanged)
   */
  async emitEvent(event: string, data: unknown): Promise<void> {
    if (!this.web3wallet) return;

    for (const [topic] of this.sessions) {
      try {
        await this.web3wallet.emitSessionEvent({
          topic,
          event: { name: event, data },
          chainId: QFC_CHAINS.testnet.chainId,
        });
      } catch {
        // Session may have expired
      }
    }
  }

  /**
   * Get current wallet address from Chrome storage
   */
  private async getCurrentAddress(): Promise<string> {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get('qfc_current_address', (result) => {
          resolve(result.qfc_current_address || '0x0000000000000000000000000000000000000000');
        });
      } else {
        resolve('0x0000000000000000000000000000000000000000');
      }
    });
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Parse a WalletConnect URI
 * Format: wc:topic@version?relay-protocol=irn&symKey=...
 */
export function parseWCUri(uri: string): { valid: boolean; version: number } {
  if (!uri.startsWith('wc:')) return { valid: false, version: 0 };

  const match = uri.match(/wc:[^@]+@(\d+)/);
  if (!match) return { valid: false, version: 0 };

  return { valid: true, version: parseInt(match[1]) };
}

/**
 * Storage helpers for WC sessions
 */
export async function saveWCSessions(sessions: WCSession[]): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    await chrome.storage.local.set({ qfc_wc_sessions: sessions });
  }
}

export async function loadWCSessions(): Promise<WCSession[]> {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    return new Promise((resolve) => {
      chrome.storage.local.get('qfc_wc_sessions', (result) => {
        resolve(result.qfc_wc_sessions || []);
      });
    });
  }
  return [];
}

import { create } from 'zustand';
import type { Wallet, NetworkConfig } from '../types/wallet';
import type { TransactionRecord, PendingApproval } from '../types/transaction';
import type { Token } from '../types/token';
import { NETWORKS, NetworkKey } from '../utils/constants';

interface WalletStore {
  // State
  wallets: Wallet[];
  currentAddress: string | null;
  isUnlocked: boolean;
  isLoading: boolean;
  balance: string;
  network: NetworkConfig;
  networkKey: NetworkKey;
  networks: Record<string, NetworkConfig>;
  error: string | null;
  transactions: TransactionRecord[];
  tokens: Token[];
  pendingApproval: PendingApproval | null;

  // Actions
  setWallets: (wallets: Wallet[]) => void;
  setCurrentAddress: (address: string | null) => void;
  setUnlocked: (unlocked: boolean) => void;
  setLoading: (loading: boolean) => void;
  setBalance: (balance: string) => void;
  setNetwork: (network: NetworkConfig, key: NetworkKey) => void;
  setNetworks: (networks: Record<string, NetworkConfig>) => void;
  setError: (error: string | null) => void;
  setTransactions: (transactions: TransactionRecord[]) => void;
  setTokens: (tokens: Token[]) => void;
  setPendingApproval: (approval: PendingApproval | null) => void;
  reset: () => void;
}

const initialState = {
  wallets: [] as Wallet[],
  currentAddress: null as string | null,
  isUnlocked: false,
  isLoading: true,
  balance: '0',
  network: NETWORKS.testnet,
  networkKey: 'testnet' as NetworkKey,
  networks: NETWORKS,
  error: null as string | null,
  transactions: [] as TransactionRecord[],
  tokens: [] as Token[],
  pendingApproval: null as PendingApproval | null,
};

export const useWalletStore = create<WalletStore>((set) => ({
  ...initialState,

  setWallets: (wallets) => set({ wallets }),
  setCurrentAddress: (address) => set({ currentAddress: address }),
  setUnlocked: (unlocked) => set({ isUnlocked: unlocked }),
  setLoading: (loading) => set({ isLoading: loading }),
  setBalance: (balance) => set({ balance }),
  setNetwork: (network, key) => set({ network, networkKey: key }),
  setNetworks: (networks) => set({ networks }),
  setError: (error) => set({ error }),
  setTransactions: (transactions) => set({ transactions }),
  setTokens: (tokens) => set({ tokens }),
  setPendingApproval: (approval) => set({ pendingApproval: approval }),
  reset: () => set(initialState),
}));

// Helper to send messages to background
export async function sendMessage<T = unknown>(
  method: string,
  params: unknown[] = []
): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ method, params }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response?.error) {
        reject(new Error(response.error.message || 'Unknown error'));
        return;
      }

      resolve(response?.result as T);
    });
  });
}

// Actions that interact with background
export const walletActions = {
  async initialize() {
    const store = useWalletStore.getState();
    store.setLoading(true);
    store.setError(null);

    try {
      const hasWallets = await sendMessage<boolean>('wallet_hasWallets');
      const isUnlocked = await sendMessage<boolean>('wallet_isUnlocked');
      const networks = await sendMessage<Record<string, NetworkConfig>>('wallet_getNetworks');

      store.setUnlocked(isUnlocked);
      store.setNetworks(networks || NETWORKS);

      if (hasWallets && isUnlocked) {
        const wallets = await sendMessage<Wallet[]>('wallet_getAllAccounts');
        const network = await sendMessage<{ network: NetworkConfig; key: NetworkKey }>('wallet_getNetwork');

        store.setWallets(wallets);
        store.setNetwork(network.network, network.key);

        if (wallets.length > 0) {
          const address = wallets[0].address;
          store.setCurrentAddress(address);
          await walletActions.refreshBalance(address);
          await walletActions.loadTransactions(address);
          await walletActions.loadTokens(address);
        }
      }

      // Check for pending approvals
      const pending = await sendMessage<PendingApproval | null>('wallet_getPendingApproval');
      if (pending) {
        store.setPendingApproval(pending);
      }
    } catch (error) {
      console.error('Failed to initialize:', error);
      store.setError(error instanceof Error ? error.message : 'Failed to initialize');
    } finally {
      store.setLoading(false);
    }
  },

  async createWallet(name: string, password: string) {
    const store = useWalletStore.getState();
    store.setLoading(true);
    store.setError(null);

    try {
      const result = await sendMessage<{ address: string; mnemonic: string }>(
        'wallet_createWallet',
        [name, password]
      );

      store.setCurrentAddress(result.address);
      store.setUnlocked(true);

      const wallets = await sendMessage<Wallet[]>('wallet_getAllAccounts');
      store.setWallets(wallets);

      return result;
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to create wallet');
      throw error;
    } finally {
      store.setLoading(false);
    }
  },

  async createAccount(name: string, password: string) {
    const store = useWalletStore.getState();
    store.setLoading(true);
    store.setError(null);

    try {
      const result = await sendMessage<{ address: string; mnemonic: string }>(
        'wallet_createWallet',
        [name, password]
      );

      store.setCurrentAddress(result.address);
      store.setUnlocked(true);

      const wallets = await sendMessage<Wallet[]>('wallet_getAllAccounts');
      store.setWallets(wallets);
      await walletActions.refreshBalance(result.address);
      await walletActions.loadTransactions(result.address);
      await walletActions.loadTokens(result.address);

      return result;
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to create account');
      throw error;
    } finally {
      store.setLoading(false);
    }
  },

  async importWallet(keyOrMnemonic: string, name: string, password: string) {
    const store = useWalletStore.getState();
    store.setLoading(true);
    store.setError(null);

    try {
      const address = await sendMessage<string>('wallet_importWallet', [
        keyOrMnemonic,
        name,
        password,
      ]);

      store.setCurrentAddress(address);
      store.setUnlocked(true);

      const wallets = await sendMessage<Wallet[]>('wallet_getAllAccounts');
      store.setWallets(wallets);

      return address;
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to import wallet');
      throw error;
    } finally {
      store.setLoading(false);
    }
  },

  async unlock(password: string) {
    const store = useWalletStore.getState();
    store.setLoading(true);
    store.setError(null);

    try {
      const success = await sendMessage<boolean>('wallet_unlock', [password]);

      if (success) {
        store.setUnlocked(true);

        const wallets = await sendMessage<Wallet[]>('wallet_getAllAccounts');
        store.setWallets(wallets);

        if (wallets.length > 0) {
          const address = wallets[0].address;
          store.setCurrentAddress(address);
          await walletActions.refreshBalance(address);
          await walletActions.loadTransactions(address);
          await walletActions.loadTokens(address);
        }
      } else {
        store.setError('Wrong password');
      }

      return success;
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to unlock');
      throw error;
    } finally {
      store.setLoading(false);
    }
  },

  async lock() {
    const store = useWalletStore.getState();

    try {
      await sendMessage('wallet_lock');
      store.setUnlocked(false);
    } catch (error) {
      console.error('Failed to lock:', error);
    }
  },

  async reportActivity() {
    try {
      await sendMessage('wallet_reportActivity');
    } catch (error) {
      console.error('Failed to report activity:', error);
    }
  },

  async exportPrivateKey(password: string, address?: string) {
    return sendMessage<string>('wallet_exportPrivateKey', [password, address]);
  },

  async exportMnemonic(password: string, address?: string) {
    return sendMessage<string>('wallet_exportMnemonic', [password, address]);
  },

  async refreshBalance(address?: string) {
    const store = useWalletStore.getState();
    const addr = address || store.currentAddress;

    if (!addr) return;

    try {
      const balanceHex = await sendMessage<string>('eth_getBalance', [addr, 'latest']);
      const balanceWei = BigInt(balanceHex);
      const balanceEth = Number(balanceWei) / 1e18;
      store.setBalance(balanceEth.toFixed(4));
    } catch (error) {
      console.error('Failed to get balance:', error);
    }
  },

  async switchAccount(address: string) {
    const store = useWalletStore.getState();

    try {
      await sendMessage('wallet_switchAccount', [address]);
      store.setCurrentAddress(address);
      await walletActions.refreshBalance(address);
      await walletActions.loadTransactions(address);
      await walletActions.loadTokens(address);
    } catch (error) {
      console.error('Failed to switch account:', error);
    }
  },

  async switchNetwork(networkKey: NetworkKey) {
    const store = useWalletStore.getState();

    try {
      await sendMessage('wallet_switchNetwork', [networkKey]);
      const network = store.networks[networkKey] || NETWORKS[networkKey];
      store.setNetwork(network, networkKey);
      // Refresh balance on new network
      await walletActions.refreshBalance();
      await walletActions.refreshTokenBalances();
    } catch (error) {
      console.error('Failed to switch network:', error);
    }
  },

  async loadTransactions(address?: string) {
    const store = useWalletStore.getState();
    const addr = address || store.currentAddress;

    if (!addr) return;

    try {
      const transactions = await sendMessage<TransactionRecord[]>('wallet_getTransactions', [addr]);
      store.setTransactions(transactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  },

  async loadTokens(address?: string) {
    const store = useWalletStore.getState();
    const addr = address || store.currentAddress;

    if (!addr) return;

    try {
      const tokens = await sendMessage<Token[]>('wallet_getTokens', [addr]);
      store.setTokens(tokens);
    } catch (error) {
      console.error('Failed to load tokens:', error);
    }
  },

  async addToken(tokenAddress: string) {
    const store = useWalletStore.getState();
    const addr = store.currentAddress;

    if (!addr) return;

    try {
      const token = await sendMessage<Token>('wallet_addToken', [addr, tokenAddress]);
      const tokens = [...store.tokens, token];
      store.setTokens(tokens);
      return token;
    } catch (error) {
      console.error('Failed to add token:', error);
      throw error;
    }
  },

  async removeToken(tokenAddress: string) {
    const store = useWalletStore.getState();
    const addr = store.currentAddress;

    if (!addr) return;

    try {
      await sendMessage('wallet_removeToken', [addr, tokenAddress]);
      const tokens = store.tokens.filter(
        (t) => t.address.toLowerCase() !== tokenAddress.toLowerCase()
      );
      store.setTokens(tokens);
    } catch (error) {
      console.error('Failed to remove token:', error);
    }
  },

  async refreshTokenBalances() {
    const store = useWalletStore.getState();
    const addr = store.currentAddress;

    if (!addr || store.tokens.length === 0) return;

    try {
      const tokens = await sendMessage<Token[]>('wallet_refreshTokenBalances', [addr]);
      store.setTokens(tokens);
    } catch (error) {
      console.error('Failed to refresh token balances:', error);
    }
  },

  async approveRequest(approve: boolean) {
    const store = useWalletStore.getState();
    const pending = store.pendingApproval;

    if (!pending) return;

    try {
      await sendMessage('wallet_resolveApproval', [pending.id, approve]);
      store.setPendingApproval(null);
    } catch (error) {
      console.error('Failed to resolve approval:', error);
    }
  },
};

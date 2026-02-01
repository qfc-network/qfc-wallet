import { create } from 'zustand';
import type { Wallet, NetworkConfig } from '../types/wallet';
import { DEFAULT_NETWORK } from '../utils/constants';

interface WalletStore {
  // State
  wallets: Wallet[];
  currentAddress: string | null;
  isUnlocked: boolean;
  isLoading: boolean;
  balance: string;
  network: NetworkConfig;
  error: string | null;

  // Actions
  setWallets: (wallets: Wallet[]) => void;
  setCurrentAddress: (address: string | null) => void;
  setUnlocked: (unlocked: boolean) => void;
  setLoading: (loading: boolean) => void;
  setBalance: (balance: string) => void;
  setNetwork: (network: NetworkConfig) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  wallets: [] as Wallet[],
  currentAddress: null as string | null,
  isUnlocked: false,
  isLoading: true,
  balance: '0',
  network: DEFAULT_NETWORK,
  error: null as string | null,
};

export const useWalletStore = create<WalletStore>((set) => ({
  ...initialState,

  setWallets: (wallets) => set({ wallets }),
  setCurrentAddress: (address) => set({ currentAddress: address }),
  setUnlocked: (unlocked) => set({ isUnlocked: unlocked }),
  setLoading: (loading) => set({ isLoading: loading }),
  setBalance: (balance) => set({ balance }),
  setNetwork: (network) => set({ network }),
  setError: (error) => set({ error }),
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

      store.setUnlocked(isUnlocked);

      if (hasWallets && isUnlocked) {
        const wallets = await sendMessage<Wallet[]>('wallet_getAllAccounts');
        const network = await sendMessage<NetworkConfig>('wallet_getNetwork');

        store.setWallets(wallets);
        store.setNetwork(network);

        if (wallets.length > 0) {
          const address = wallets[0].address;
          store.setCurrentAddress(address);
          await walletActions.refreshBalance(address);
        }
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

      // Refresh wallet list
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

      // Refresh wallet list
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

        // Refresh wallet data
        const wallets = await sendMessage<Wallet[]>('wallet_getAllAccounts');
        store.setWallets(wallets);

        if (wallets.length > 0) {
          const address = wallets[0].address;
          store.setCurrentAddress(address);
          await walletActions.refreshBalance(address);
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
    } catch (error) {
      console.error('Failed to switch account:', error);
    }
  },
};

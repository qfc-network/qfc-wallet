import { STORAGE_KEYS } from './constants';

/**
 * Chrome storage wrapper with type safety
 */
export const storage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] ?? null;
    } catch {
      // Fallback for non-extension environment (dev mode)
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch {
      // Fallback for non-extension environment
      localStorage.setItem(key, JSON.stringify(value));
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch {
      localStorage.removeItem(key);
    }
  },

  async clear(): Promise<void> {
    try {
      await chrome.storage.local.clear();
    } catch {
      localStorage.clear();
    }
  },
};

/**
 * Typed storage helpers for wallet data
 */
export const walletStorage = {
  async getWallets(): Promise<WalletData[]> {
    return (await storage.get<WalletData[]>(STORAGE_KEYS.WALLETS)) ?? [];
  },

  async saveWallets(wallets: WalletData[]): Promise<void> {
    await storage.set(STORAGE_KEYS.WALLETS, wallets);
  },

  async getCurrentAddress(): Promise<string | null> {
    return storage.get<string>(STORAGE_KEYS.CURRENT_ADDRESS);
  },

  async setCurrentAddress(address: string): Promise<void> {
    await storage.set(STORAGE_KEYS.CURRENT_ADDRESS, address);
  },

  async getConnectedSites(): Promise<Record<string, string[]>> {
    return (await storage.get<Record<string, string[]>>(STORAGE_KEYS.CONNECTED_SITES)) ?? {};
  },

  async addConnectedSite(origin: string, address: string): Promise<void> {
    const sites = await this.getConnectedSites();
    if (!sites[origin]) {
      sites[origin] = [];
    }
    if (!sites[origin].includes(address)) {
      sites[origin].push(address);
    }
    await storage.set(STORAGE_KEYS.CONNECTED_SITES, sites);
  },

  async removeConnectedSite(origin: string): Promise<void> {
    const sites = await this.getConnectedSites();
    delete sites[origin];
    await storage.set(STORAGE_KEYS.CONNECTED_SITES, sites);
  },

  async isConnected(origin: string, address: string): Promise<boolean> {
    const sites = await this.getConnectedSites();
    return sites[origin]?.includes(address) ?? false;
  },
};

interface WalletData {
  address: string;
  encryptedPrivateKey: string;
  name: string;
  createdAt: number;
}

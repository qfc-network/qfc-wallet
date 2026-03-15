import { STORAGE_KEYS } from './constants';
import type { TransactionRecord } from '../types/transaction';
import type { Token } from '../types/token';
import type { NFT } from '../types/nft';
import type { Contact } from '../types/contact';

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

interface WalletData {
  address: string;
  encryptedPrivateKey: string;
  encryptedMnemonic?: string;
  mnemonicId?: string;
  hdIndex?: number;
  name: string;
  createdAt: number;
}

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

/**
 * Transaction history storage
 */
export const txStorage = {
  async getHistory(address: string): Promise<TransactionRecord[]> {
    const key = `${STORAGE_KEYS.TX_HISTORY}_${address.toLowerCase()}`;
    return (await storage.get<TransactionRecord[]>(key)) ?? [];
  },

  async addTransaction(address: string, tx: TransactionRecord): Promise<void> {
    const history = await this.getHistory(address);
    // Add to beginning, keep last 100 transactions
    history.unshift(tx);
    if (history.length > 100) {
      history.pop();
    }
    const key = `${STORAGE_KEYS.TX_HISTORY}_${address.toLowerCase()}`;
    await storage.set(key, history);
  },

  async updateTransaction(
    address: string,
    hash: string,
    updates: Partial<TransactionRecord>
  ): Promise<void> {
    const history = await this.getHistory(address);
    const index = history.findIndex((tx) => tx.hash === hash);
    if (index !== -1) {
      history[index] = { ...history[index], ...updates };
      const key = `${STORAGE_KEYS.TX_HISTORY}_${address.toLowerCase()}`;
      await storage.set(key, history);
    }
  },

  async clearHistory(address: string): Promise<void> {
    const key = `${STORAGE_KEYS.TX_HISTORY}_${address.toLowerCase()}`;
    await storage.remove(key);
  },
};

/**
 * Token storage
 */
export const tokenStorage = {
  async getTokens(address: string): Promise<Token[]> {
    const key = `${STORAGE_KEYS.TOKENS}_${address.toLowerCase()}`;
    return (await storage.get<Token[]>(key)) ?? [];
  },

  async addToken(address: string, token: Token): Promise<void> {
    const tokens = await this.getTokens(address);
    // Check if token already exists
    if (!tokens.find((t) => t.address.toLowerCase() === token.address.toLowerCase())) {
      tokens.push(token);
      const key = `${STORAGE_KEYS.TOKENS}_${address.toLowerCase()}`;
      await storage.set(key, tokens);
    }
  },

  async removeToken(address: string, tokenAddress: string): Promise<void> {
    const tokens = await this.getTokens(address);
    const filtered = tokens.filter(
      (t) => t.address.toLowerCase() !== tokenAddress.toLowerCase()
    );
    const key = `${STORAGE_KEYS.TOKENS}_${address.toLowerCase()}`;
    await storage.set(key, filtered);
  },

  async updateTokenBalance(
    address: string,
    tokenAddress: string,
    balance: string
  ): Promise<void> {
    const tokens = await this.getTokens(address);
    const token = tokens.find(
      (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
    );
    if (token) {
      token.balance = balance;
      const key = `${STORAGE_KEYS.TOKENS}_${address.toLowerCase()}`;
      await storage.set(key, tokens);
    }
  },
};

/**
 * NFT storage
 */
export const nftStorage = {
  async getNFTs(address: string): Promise<NFT[]> {
    const key = `${STORAGE_KEYS.NFTS}_${address.toLowerCase()}`;
    return (await storage.get<NFT[]>(key)) ?? [];
  },

  async addNFT(address: string, nft: NFT): Promise<void> {
    const nfts = await this.getNFTs(address);
    const exists = nfts.find(
      (n) =>
        n.contractAddress.toLowerCase() === nft.contractAddress.toLowerCase() &&
        n.tokenId === nft.tokenId
    );
    if (!exists) {
      nfts.push(nft);
      const key = `${STORAGE_KEYS.NFTS}_${address.toLowerCase()}`;
      await storage.set(key, nfts);
    }
  },

  async removeNFT(address: string, contractAddress: string, tokenId: string): Promise<void> {
    const nfts = await this.getNFTs(address);
    const filtered = nfts.filter(
      (n) =>
        !(
          n.contractAddress.toLowerCase() === contractAddress.toLowerCase() &&
          n.tokenId === tokenId
        )
    );
    const key = `${STORAGE_KEYS.NFTS}_${address.toLowerCase()}`;
    await storage.set(key, filtered);
  },
};

/**
 * Network storage
 */
export const networkStorage = {
  async getCurrentNetwork(): Promise<string> {
    return (await storage.get<string>(STORAGE_KEYS.NETWORK)) ?? 'testnet';
  },

  async setCurrentNetwork(network: string): Promise<void> {
    await storage.set(STORAGE_KEYS.NETWORK, network);
  },

  async getCustomNetworks(): Promise<Record<string, import('../types/wallet').NetworkConfig>> {
    return (await storage.get<Record<string, import('../types/wallet').NetworkConfig>>(STORAGE_KEYS.CUSTOM_NETWORKS)) ?? {};
  },

  async addCustomNetwork(
    key: string,
    network: import('../types/wallet').NetworkConfig
  ): Promise<void> {
    const networks = await this.getCustomNetworks();
    networks[key] = network;
    await storage.set(STORAGE_KEYS.CUSTOM_NETWORKS, networks);
  },
};

/**
 * Contact storage for address book
 */
export const contactStorage = {
  async getContacts(): Promise<Contact[]> {
    return (await storage.get<Contact[]>(STORAGE_KEYS.CONTACTS)) ?? [];
  },

  async addContact(contact: Contact): Promise<void> {
    const contacts = await this.getContacts();
    contacts.push(contact);
    await storage.set(STORAGE_KEYS.CONTACTS, contacts);
  },

  async updateContact(id: string, updates: Partial<Contact>): Promise<void> {
    const contacts = await this.getContacts();
    const index = contacts.findIndex((c) => c.id === id);
    if (index !== -1) {
      contacts[index] = { ...contacts[index], ...updates, updatedAt: Date.now() };
      await storage.set(STORAGE_KEYS.CONTACTS, contacts);
    }
  },

  async removeContact(id: string): Promise<void> {
    const contacts = await this.getContacts();
    const filtered = contacts.filter((c) => c.id !== id);
    await storage.set(STORAGE_KEYS.CONTACTS, filtered);
  },

  async getContactByAddress(address: string): Promise<Contact | null> {
    const contacts = await this.getContacts();
    return contacts.find((c) => c.address.toLowerCase() === address.toLowerCase()) ?? null;
  },
};

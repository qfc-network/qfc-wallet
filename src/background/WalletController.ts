import { ethers } from 'ethers';
import { encrypt, decrypt, isLegacyCiphertext, hashString } from '../utils/crypto';
import { walletStorage } from '../utils/storage';
import { DEFAULT_NETWORK, LOCK_TIMEOUT_MS } from '../utils/constants';
import type { Wallet, CreateWalletResult, NetworkConfig } from '../types/wallet';

export class WalletController {
  private wallets: Wallet[] = [];
  private currentWallet: Wallet | null = null;
  private isUnlocked = false;
  private password: string | null = null;
  private provider: ethers.JsonRpcProvider;
  private network: NetworkConfig;
  private lockTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivityAt: number | null = null;

  constructor(network: NetworkConfig = DEFAULT_NETWORK) {
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl);
  }

  async initialize(): Promise<void> {
    const wallets = await walletStorage.getWallets();
    const currentAddress = await walletStorage.getCurrentAddress();

    this.wallets = wallets;

    if (currentAddress && wallets.length > 0) {
      this.currentWallet =
        wallets.find((w) => w.address === currentAddress) || wallets[0];
    } else if (wallets.length > 0) {
      this.currentWallet = wallets[0];
    }

    await this.migrateEncryptionIfNeeded();
  }

  private async saveWallets(): Promise<void> {
    await walletStorage.saveWallets(this.wallets);
    if (this.currentWallet) {
      await walletStorage.setCurrentAddress(this.currentWallet.address);
    }
  }

  async createWallet(
    name: string,
    password: string
  ): Promise<CreateWalletResult> {
    const wallet = ethers.Wallet.createRandom();
    const encryptedPrivateKey = encrypt(wallet.privateKey, password);
    const encryptedMnemonic = wallet.mnemonic?.phrase
      ? encrypt(wallet.mnemonic.phrase, password)
      : undefined;
    const mnemonicId = wallet.mnemonic?.phrase ? hashString(wallet.mnemonic.phrase) : undefined;

    const newWallet: Wallet = {
      address: wallet.address,
      encryptedPrivateKey,
      encryptedMnemonic,
      mnemonicId,
      hdIndex: wallet.mnemonic?.phrase ? 0 : undefined,
      name: name || `Account ${this.wallets.length + 1}`,
      createdAt: Date.now(),
    };

    this.wallets.push(newWallet);
    this.currentWallet = newWallet;
    this.password = password;
    this.isUnlocked = true;

    await this.saveWallets();
    this.startLockTimer();

    return {
      address: wallet.address,
      mnemonic: wallet.mnemonic!.phrase,
    };
  }

  async importWallet(
    privateKeyOrMnemonic: string,
    name: string,
    password: string
  ): Promise<string> {
    let wallet: ethers.HDNodeWallet | ethers.Wallet;
    let encryptedMnemonic: string | undefined;
    let mnemonicId: string | undefined;

    // Determine if it's a mnemonic or private key
    if (privateKeyOrMnemonic.trim().split(/\s+/).length >= 12) {
      const phrase = privateKeyOrMnemonic.trim();
      wallet = ethers.Wallet.fromPhrase(phrase);
      encryptedMnemonic = encrypt(phrase, password);
      mnemonicId = hashString(phrase);
    } else {
      const key = privateKeyOrMnemonic.startsWith('0x')
        ? privateKeyOrMnemonic
        : `0x${privateKeyOrMnemonic}`;
      wallet = new ethers.Wallet(key);
    }

    // Check if wallet already exists
    if (this.wallets.some((w) => w.address === wallet.address)) {
      throw new Error('Wallet already exists');
    }

    const encryptedPrivateKey = encrypt(wallet.privateKey, password);

    const newWallet: Wallet = {
      address: wallet.address,
      encryptedPrivateKey,
      encryptedMnemonic,
      mnemonicId,
      hdIndex: encryptedMnemonic ? 0 : undefined,
      name: name || `Imported ${this.wallets.length + 1}`,
      createdAt: Date.now(),
    };

    this.wallets.push(newWallet);
    this.currentWallet = newWallet;
    this.password = password;
    this.isUnlocked = true;

    await this.saveWallets();
    this.startLockTimer();

    return wallet.address;
  }

  async unlock(password: string): Promise<boolean> {
    if (this.wallets.length === 0) {
      throw new Error('No wallet found');
    }

    try {
      // Verify password by trying to decrypt
      decrypt(this.wallets[0].encryptedPrivateKey, password);

      this.password = password;
      this.isUnlocked = true;

      if (!this.currentWallet) {
        this.currentWallet = this.wallets[0];
      }

      this.startLockTimer();
      this.touchActivity();
      await this.migrateEncryptionIfNeeded(password);
      return true;
    } catch {
      return false;
    }
  }

  lock(): void {
    this.isUnlocked = false;
    this.password = null;
    this.stopLockTimer();
  }

  getCurrentAccount(): string | null {
    return this.isUnlocked && this.currentWallet
      ? this.currentWallet.address
      : null;
  }

  async switchAccount(address: string): Promise<void> {
    const wallet = this.wallets.find((w) => w.address === address);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    this.currentWallet = wallet;
    await this.saveWallets();
  }

  async addDerivedAccount(name?: string): Promise<Wallet> {
    if (!this.isUnlocked || !this.password) {
      throw new Error('Wallet is locked');
    }
    if (!this.currentWallet?.encryptedMnemonic) {
      throw new Error('No recovery phrase available');
    }

    const phrase = decrypt(this.currentWallet.encryptedMnemonic, this.password);
    const mnemonicId = hashString(phrase);

    if (this.currentWallet.hdIndex === undefined) {
      this.currentWallet.hdIndex = 0;
      this.currentWallet.mnemonicId = mnemonicId;
    }

    let maxIndex = -1;
    for (const wallet of this.wallets) {
      if (wallet.encryptedMnemonic && !wallet.mnemonicId) {
        try {
          const walletPhrase = decrypt(wallet.encryptedMnemonic, this.password);
          if (hashString(walletPhrase) === mnemonicId) {
            wallet.mnemonicId = mnemonicId;
            if (wallet.hdIndex === undefined) {
              wallet.hdIndex = 0;
            }
          }
        } catch {
          // ignore wallets we can't decrypt
        }
      }
      if (wallet.mnemonicId === mnemonicId && typeof wallet.hdIndex === 'number') {
        maxIndex = Math.max(maxIndex, wallet.hdIndex);
      }
    }

    const nextIndex = maxIndex + 1;
    const path = `m/44'/60'/0'/0/${nextIndex}`;
    const derived = ethers.HDNodeWallet.fromPhrase(phrase, undefined, path);

    const encryptedPrivateKey = encrypt(derived.privateKey, this.password);
    const encryptedMnemonic = encrypt(phrase, this.password);

    const newWallet: Wallet = {
      address: derived.address,
      encryptedPrivateKey,
      encryptedMnemonic,
      mnemonicId,
      hdIndex: nextIndex,
      name: name || `Account ${this.wallets.length + 1}`,
      createdAt: Date.now(),
    };

    this.wallets.push(newWallet);
    this.currentWallet = newWallet;
    await this.saveWallets();

    return newWallet;
  }

  async renameAccount(address: string, name: string): Promise<void> {
    const wallet = this.wallets.find((w) => w.address === address);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    wallet.name = name;
    await this.saveWallets();
  }

  async removeAccount(address: string): Promise<void> {
    const index = this.wallets.findIndex((w) => w.address === address);
    if (index === -1) {
      throw new Error('Wallet not found');
    }
    if (this.wallets.length <= 1) {
      throw new Error('Cannot remove the last account');
    }

    const wasCurrent = this.currentWallet?.address === address;
    this.wallets.splice(index, 1);
    if (wasCurrent) {
      this.currentWallet = this.wallets[0] || null;
    }
    await this.saveWallets();
  }

  getAllAccounts(): Wallet[] {
    return this.wallets.map((w) => ({
      ...w,
      encryptedPrivateKey: '', // Don't expose private key
    }));
  }

  async getBalance(address?: string, blockTag?: ethers.BlockTag): Promise<string> {
    const addr = address || this.currentWallet?.address;
    if (!addr) throw new Error('No address');

    const balance = await this.provider.getBalance(addr, blockTag);
    return ethers.formatEther(balance);
  }

  async sendTransaction(tx: ethers.TransactionRequest): Promise<string> {
    if (!this.isUnlocked || !this.currentWallet || !this.password) {
      throw new Error('Wallet is locked');
    }

    const privateKey = decrypt(
      this.currentWallet.encryptedPrivateKey,
      this.password
    );

    const wallet = new ethers.Wallet(privateKey, this.provider);
    const txResponse = await wallet.sendTransaction(tx);

    this.startLockTimer();
    this.touchActivity();
    return txResponse.hash;
  }

  async signMessage(message: string): Promise<string> {
    if (!this.isUnlocked || !this.currentWallet || !this.password) {
      throw new Error('Wallet is locked');
    }

    const privateKey = decrypt(
      this.currentWallet.encryptedPrivateKey,
      this.password
    );

    const wallet = new ethers.Wallet(privateKey);
    const signature = await wallet.signMessage(message);

    this.startLockTimer();
    this.touchActivity();
    return signature;
  }

  async signTypedData(typedData: string): Promise<string> {
    if (!this.isUnlocked || !this.currentWallet || !this.password) {
      throw new Error('Wallet is locked');
    }

    const privateKey = decrypt(
      this.currentWallet.encryptedPrivateKey,
      this.password
    );

    const wallet = new ethers.Wallet(privateKey);
    const { domain, types, message } = JSON.parse(typedData);
    delete types.EIP712Domain;

    const signature = await wallet.signTypedData(domain, types, message);

    this.startLockTimer();
    this.touchActivity();
    return signature;
  }

  async estimateGas(tx: ethers.TransactionRequest): Promise<string> {
    const gas = await this.provider.estimateGas(tx);
    return gas.toString();
  }

  async getGasPrice(): Promise<string> {
    const feeData = await this.provider.getFeeData();
    return (feeData.gasPrice ?? 0n).toString();
  }

  async getTransactionCount(address?: string, blockTag?: ethers.BlockTag): Promise<number> {
    const addr = address || this.currentWallet?.address;
    if (!addr) throw new Error('No address');

    return this.provider.getTransactionCount(addr, blockTag);
  }

  async exportPrivateKey(password: string, address?: string): Promise<string> {
    const targetAddress = address || this.currentWallet?.address;
    if (!targetAddress) throw new Error('No address');

    const wallet = this.wallets.find((w) => w.address === targetAddress);
    if (!wallet) throw new Error('Wallet not found');

    const key = decrypt(wallet.encryptedPrivateKey, password);
    if (isLegacyCiphertext(wallet.encryptedPrivateKey)) {
      wallet.encryptedPrivateKey = encrypt(key, password);
      await this.saveWallets();
    }
    return key;
  }

  async exportMnemonic(password: string, address?: string): Promise<string> {
    const targetAddress = address || this.currentWallet?.address;
    if (!targetAddress) throw new Error('No address');

    const wallet = this.wallets.find((w) => w.address === targetAddress);
    if (!wallet) throw new Error('Wallet not found');
    if (!wallet.encryptedMnemonic) throw new Error('No recovery phrase available');

    const phrase = decrypt(wallet.encryptedMnemonic, password);
    if (wallet.encryptedMnemonic && isLegacyCiphertext(wallet.encryptedMnemonic)) {
      wallet.encryptedMnemonic = encrypt(phrase, password);
      await this.saveWallets();
    }
    return phrase;
  }

  private async migrateEncryptionIfNeeded(password?: string): Promise<void> {
    if (this.wallets.length === 0) return;
    if (!password) return;

    let changed = false;
    for (const wallet of this.wallets) {
      if (isLegacyCiphertext(wallet.encryptedPrivateKey)) {
        const key = decrypt(wallet.encryptedPrivateKey, password);
        wallet.encryptedPrivateKey = encrypt(key, password);
        changed = true;
      }
      if (wallet.encryptedMnemonic && isLegacyCiphertext(wallet.encryptedMnemonic)) {
        const phrase = decrypt(wallet.encryptedMnemonic, password);
        wallet.encryptedMnemonic = encrypt(phrase, password);
        changed = true;
      }
    }

    if (changed) {
      await this.saveWallets();
    }
  }

  async getBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  async getCode(address: string): Promise<string> {
    return this.provider.getCode(address);
  }

  async call(tx: ethers.TransactionRequest): Promise<string> {
    return this.provider.call(tx);
  }

  async getTransactionReceipt(hash: string): Promise<ethers.TransactionReceipt | null> {
    return this.provider.getTransactionReceipt(hash);
  }

  async getTransactionByHash(hash: string): Promise<ethers.TransactionResponse | null> {
    return this.provider.getTransaction(hash);
  }

  async getBlockByNumber(blockTag: string): Promise<ethers.Block | null> {
    return this.provider.getBlock(blockTag as ethers.BlockTag);
  }

  async getLogs(filter: Record<string, unknown>): Promise<ethers.Log[]> {
    return this.provider.getLogs(filter as ethers.Filter);
  }

  setNetwork(network: NetworkConfig): void {
    this.network = network;
    this.provider = new ethers.JsonRpcProvider(network.rpcUrl);
  }

  getNetwork(): NetworkConfig {
    return this.network;
  }

  isWalletUnlocked(): boolean {
    return this.isUnlocked;
  }

  hasWallets(): boolean {
    return this.wallets.length > 0;
  }

  async hasWalletsAsync(): Promise<boolean> {
    // Always check storage directly in case service worker was restarted
    if (this.wallets.length > 0) {
      return true;
    }
    const wallets = await walletStorage.getWallets();
    if (wallets.length > 0) {
      this.wallets = wallets;
      return true;
    }
    return false;
  }

  private startLockTimer(): void {
    this.stopLockTimer();

    this.lockTimer = setTimeout(() => {
      this.lock();
      console.log('[QFC] Wallet auto-locked after inactivity');
    }, LOCK_TIMEOUT_MS);
  }

  private stopLockTimer(): void {
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
  }

  touchActivity(): void {
    if (!this.isUnlocked) return;
    this.lastActivityAt = Date.now();
    this.startLockTimer();
  }

  shouldLockForInactivity(inactivityMs: number): boolean {
    if (!this.isUnlocked || this.lastActivityAt === null) return false;
    return Date.now() - this.lastActivityAt > inactivityMs;
  }
}

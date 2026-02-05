import { describe, it, expect, beforeEach } from 'vitest';
import { resetMocks } from '../test/setup';
import {
  storage,
  walletStorage,
  txStorage,
  tokenStorage,
  networkStorage,
  contactStorage,
} from './storage';
import type { TransactionRecord } from '../types/transaction';
import type { Token } from '../types/token';
import type { Contact } from '../types/contact';

describe('storage', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('base storage', () => {
    it('should set and get a value', async () => {
      await storage.set('test_key', { foo: 'bar' });
      const result = await storage.get<{ foo: string }>('test_key');
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent key', async () => {
      const result = await storage.get('non_existent');
      expect(result).toBeNull();
    });

    it('should remove a value', async () => {
      await storage.set('to_remove', 'value');
      await storage.remove('to_remove');
      const result = await storage.get('to_remove');
      expect(result).toBeNull();
    });

    it('should clear all values', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.clear();
      expect(await storage.get('key1')).toBeNull();
      expect(await storage.get('key2')).toBeNull();
    });

    it('should handle complex objects', async () => {
      const complex = {
        string: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { a: 1, b: 2 },
      };
      await storage.set('complex', complex);
      const result = await storage.get('complex');
      expect(result).toEqual(complex);
    });
  });

  describe('walletStorage', () => {
    it('should return empty array when no wallets exist', async () => {
      const wallets = await walletStorage.getWallets();
      expect(wallets).toEqual([]);
    });

    it('should save and retrieve wallets', async () => {
      const wallets = [
        {
          address: '0x1234567890abcdef1234567890abcdef12345678',
          encryptedPrivateKey: 'encrypted_key',
          name: 'My Wallet',
          createdAt: Date.now(),
        },
      ];
      await walletStorage.saveWallets(wallets);
      const result = await walletStorage.getWallets();
      expect(result).toEqual(wallets);
    });

    it('should set and get current address', async () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      await walletStorage.setCurrentAddress(address);
      const result = await walletStorage.getCurrentAddress();
      expect(result).toBe(address);
    });

    it('should return null when no current address set', async () => {
      const result = await walletStorage.getCurrentAddress();
      expect(result).toBeNull();
    });

    describe('connected sites', () => {
      it('should return empty object when no sites connected', async () => {
        const sites = await walletStorage.getConnectedSites();
        expect(sites).toEqual({});
      });

      it('should add a connected site', async () => {
        const origin = 'https://example.com';
        const address = '0x1234567890abcdef1234567890abcdef12345678';
        await walletStorage.addConnectedSite(origin, address);
        const sites = await walletStorage.getConnectedSites();
        expect(sites[origin]).toContain(address);
      });

      it('should not add duplicate address to same origin', async () => {
        const origin = 'https://example.com';
        const address = '0x1234567890abcdef1234567890abcdef12345678';
        await walletStorage.addConnectedSite(origin, address);
        await walletStorage.addConnectedSite(origin, address);
        const sites = await walletStorage.getConnectedSites();
        expect(sites[origin]).toHaveLength(1);
      });

      it('should add multiple addresses to same origin', async () => {
        const origin = 'https://example.com';
        const address1 = '0x1111111111111111111111111111111111111111';
        const address2 = '0x2222222222222222222222222222222222222222';
        await walletStorage.addConnectedSite(origin, address1);
        await walletStorage.addConnectedSite(origin, address2);
        const sites = await walletStorage.getConnectedSites();
        expect(sites[origin]).toHaveLength(2);
        expect(sites[origin]).toContain(address1);
        expect(sites[origin]).toContain(address2);
      });

      it('should remove a connected site', async () => {
        const origin = 'https://example.com';
        const address = '0x1234567890abcdef1234567890abcdef12345678';
        await walletStorage.addConnectedSite(origin, address);
        await walletStorage.removeConnectedSite(origin);
        const sites = await walletStorage.getConnectedSites();
        expect(sites[origin]).toBeUndefined();
      });

      it('should check if address is connected to origin', async () => {
        const origin = 'https://example.com';
        const address = '0x1234567890abcdef1234567890abcdef12345678';
        await walletStorage.addConnectedSite(origin, address);
        expect(await walletStorage.isConnected(origin, address)).toBe(true);
        expect(
          await walletStorage.isConnected(
            origin,
            '0x0000000000000000000000000000000000000000'
          )
        ).toBe(false);
        expect(
          await walletStorage.isConnected('https://other.com', address)
        ).toBe(false);
      });
    });
  });

  describe('txStorage', () => {
    const testAddress = '0x1234567890abcdef1234567890abcdef12345678';

    const createTx = (hash: string): TransactionRecord => ({
      hash,
      from: testAddress,
      to: '0x0000000000000000000000000000000000000000',
      value: '1000000000000000000',
      timestamp: Date.now(),
      status: 'pending',
      type: 'send',
    });

    it('should return empty array when no history', async () => {
      const history = await txStorage.getHistory(testAddress);
      expect(history).toEqual([]);
    });

    it('should add transaction to history', async () => {
      const tx = createTx('0xhash1');
      await txStorage.addTransaction(testAddress, tx);
      const history = await txStorage.getHistory(testAddress);
      expect(history).toHaveLength(1);
      expect(history[0].hash).toBe('0xhash1');
    });

    it('should add new transactions to beginning', async () => {
      const tx1 = createTx('0xhash1');
      const tx2 = createTx('0xhash2');
      await txStorage.addTransaction(testAddress, tx1);
      await txStorage.addTransaction(testAddress, tx2);
      const history = await txStorage.getHistory(testAddress);
      expect(history[0].hash).toBe('0xhash2');
      expect(history[1].hash).toBe('0xhash1');
    });

    it('should limit history to 100 transactions', async () => {
      for (let i = 0; i < 105; i++) {
        await txStorage.addTransaction(testAddress, createTx(`0xhash${i}`));
      }
      const history = await txStorage.getHistory(testAddress);
      expect(history).toHaveLength(100);
      expect(history[0].hash).toBe('0xhash104');
    });

    it('should update transaction', async () => {
      const tx = createTx('0xhash1');
      await txStorage.addTransaction(testAddress, tx);
      await txStorage.updateTransaction(testAddress, '0xhash1', {
        status: 'confirmed',
        blockNumber: 12345,
      });
      const history = await txStorage.getHistory(testAddress);
      expect(history[0].status).toBe('confirmed');
      expect(history[0].blockNumber).toBe(12345);
    });

    it('should not update non-existent transaction', async () => {
      const tx = createTx('0xhash1');
      await txStorage.addTransaction(testAddress, tx);
      await txStorage.updateTransaction(testAddress, '0xnonexistent', {
        status: 'confirmed',
      });
      const history = await txStorage.getHistory(testAddress);
      expect(history[0].status).toBe('pending');
    });

    it('should clear history', async () => {
      await txStorage.addTransaction(testAddress, createTx('0xhash1'));
      await txStorage.addTransaction(testAddress, createTx('0xhash2'));
      await txStorage.clearHistory(testAddress);
      const history = await txStorage.getHistory(testAddress);
      expect(history).toEqual([]);
    });

    it('should handle addresses case-insensitively', async () => {
      const upperAddress = testAddress.toUpperCase();
      const tx = createTx('0xhash1');
      await txStorage.addTransaction(testAddress, tx);
      const history = await txStorage.getHistory(upperAddress);
      expect(history).toHaveLength(1);
    });
  });

  describe('tokenStorage', () => {
    const walletAddress = '0x1234567890abcdef1234567890abcdef12345678';

    const createToken = (address: string, symbol: string): Token => ({
      address,
      symbol,
      name: `${symbol} Token`,
      decimals: 18,
    });

    it('should return empty array when no tokens', async () => {
      const tokens = await tokenStorage.getTokens(walletAddress);
      expect(tokens).toEqual([]);
    });

    it('should add token', async () => {
      const token = createToken('0xtoken1', 'TKN1');
      await tokenStorage.addToken(walletAddress, token);
      const tokens = await tokenStorage.getTokens(walletAddress);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].symbol).toBe('TKN1');
    });

    it('should not add duplicate token', async () => {
      const token = createToken('0xtoken1', 'TKN1');
      await tokenStorage.addToken(walletAddress, token);
      await tokenStorage.addToken(walletAddress, token);
      const tokens = await tokenStorage.getTokens(walletAddress);
      expect(tokens).toHaveLength(1);
    });

    it('should handle case-insensitive token address comparison', async () => {
      const token1 = createToken('0xABCDEF', 'TKN1');
      const token2 = createToken('0xabcdef', 'TKN1');
      await tokenStorage.addToken(walletAddress, token1);
      await tokenStorage.addToken(walletAddress, token2);
      const tokens = await tokenStorage.getTokens(walletAddress);
      expect(tokens).toHaveLength(1);
    });

    it('should remove token', async () => {
      const token = createToken('0xtoken1', 'TKN1');
      await tokenStorage.addToken(walletAddress, token);
      await tokenStorage.removeToken(walletAddress, '0xtoken1');
      const tokens = await tokenStorage.getTokens(walletAddress);
      expect(tokens).toEqual([]);
    });

    it('should remove token case-insensitively', async () => {
      const token = createToken('0xABCDEF', 'TKN1');
      await tokenStorage.addToken(walletAddress, token);
      await tokenStorage.removeToken(walletAddress, '0xabcdef');
      const tokens = await tokenStorage.getTokens(walletAddress);
      expect(tokens).toEqual([]);
    });

    it('should update token balance', async () => {
      const token = createToken('0xtoken1', 'TKN1');
      await tokenStorage.addToken(walletAddress, token);
      await tokenStorage.updateTokenBalance(
        walletAddress,
        '0xtoken1',
        '1000000000000000000'
      );
      const tokens = await tokenStorage.getTokens(walletAddress);
      expect(tokens[0].balance).toBe('1000000000000000000');
    });

    it('should not update non-existent token balance', async () => {
      await tokenStorage.updateTokenBalance(
        walletAddress,
        '0xnonexistent',
        '1000000000000000000'
      );
      const tokens = await tokenStorage.getTokens(walletAddress);
      expect(tokens).toEqual([]);
    });
  });

  describe('networkStorage', () => {
    it('should return testnet as default network', async () => {
      const network = await networkStorage.getCurrentNetwork();
      expect(network).toBe('testnet');
    });

    it('should set and get current network', async () => {
      await networkStorage.setCurrentNetwork('mainnet');
      const network = await networkStorage.getCurrentNetwork();
      expect(network).toBe('mainnet');
    });

    it('should return empty object when no custom networks', async () => {
      const networks = await networkStorage.getCustomNetworks();
      expect(networks).toEqual({});
    });

    it('should add custom network', async () => {
      const customNetwork = {
        chainId: 9999,
        chainIdHex: '0x270f',
        name: 'Custom Network',
        rpcUrl: 'https://custom.rpc',
        explorerUrl: 'https://custom.explorer',
        symbol: 'CUST',
        decimals: 18,
      };
      await networkStorage.addCustomNetwork('custom', customNetwork);
      const networks = await networkStorage.getCustomNetworks();
      expect(networks['custom']).toEqual(customNetwork);
    });
  });

  describe('contactStorage', () => {
    const createContact = (id: string, name: string, address: string): Contact => ({
      id,
      name,
      address,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    it('should return empty array when no contacts', async () => {
      const contacts = await contactStorage.getContacts();
      expect(contacts).toEqual([]);
    });

    it('should add contact', async () => {
      const contact = createContact('1', 'Alice', '0x1111111111111111111111111111111111111111');
      await contactStorage.addContact(contact);
      const contacts = await contactStorage.getContacts();
      expect(contacts).toHaveLength(1);
      expect(contacts[0].name).toBe('Alice');
    });

    it('should update contact', async () => {
      const contact = createContact('1', 'Alice', '0x1111111111111111111111111111111111111111');
      await contactStorage.addContact(contact);
      await contactStorage.updateContact('1', { name: 'Alice Smith' });
      const contacts = await contactStorage.getContacts();
      expect(contacts[0].name).toBe('Alice Smith');
      expect(contacts[0].updatedAt).toBeDefined();
    });

    it('should not update non-existent contact', async () => {
      await contactStorage.updateContact('nonexistent', { name: 'Test' });
      const contacts = await contactStorage.getContacts();
      expect(contacts).toEqual([]);
    });

    it('should remove contact', async () => {
      const contact = createContact('1', 'Alice', '0x1111111111111111111111111111111111111111');
      await contactStorage.addContact(contact);
      await contactStorage.removeContact('1');
      const contacts = await contactStorage.getContacts();
      expect(contacts).toEqual([]);
    });

    it('should get contact by address', async () => {
      const contact = createContact('1', 'Alice', '0x1111111111111111111111111111111111111111');
      await contactStorage.addContact(contact);
      const result = await contactStorage.getContactByAddress(
        '0x1111111111111111111111111111111111111111'
      );
      expect(result?.name).toBe('Alice');
    });

    it('should get contact by address case-insensitively', async () => {
      const contact = createContact('1', 'Alice', '0xABCDEF1111111111111111111111111111111111');
      await contactStorage.addContact(contact);
      const result = await contactStorage.getContactByAddress(
        '0xabcdef1111111111111111111111111111111111'
      );
      expect(result?.name).toBe('Alice');
    });

    it('should return null for non-existent address', async () => {
      const result = await contactStorage.getContactByAddress(
        '0x0000000000000000000000000000000000000000'
      );
      expect(result).toBeNull();
    });
  });
});

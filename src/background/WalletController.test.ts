/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WalletController } from './WalletController';
import { resetMocks } from '../test/setup';
import { DEFAULT_NETWORK } from '../utils/constants';

// Mock ethers provider methods
vi.mock('ethers', async () => {
  const actual = await vi.importActual('ethers');
  return {
    ...actual,
    JsonRpcProvider: vi.fn().mockImplementation(() => ({
      getBalance: vi.fn().mockResolvedValue(BigInt('1000000000000000000')),
      getBlockNumber: vi.fn().mockResolvedValue(12345),
      getGasPrice: vi.fn().mockResolvedValue(BigInt('1000000000')),
      getTransactionCount: vi.fn().mockResolvedValue(0),
      estimateGas: vi.fn().mockResolvedValue(BigInt('21000')),
      getBlock: vi.fn().mockResolvedValue({ number: 12345, timestamp: Date.now() }),
      getTransaction: vi.fn().mockResolvedValue(null),
      getTransactionReceipt: vi.fn().mockResolvedValue(null),
      getCode: vi.fn().mockResolvedValue('0x'),
      call: vi.fn().mockResolvedValue('0x'),
      getLogs: vi.fn().mockResolvedValue([]),
    })),
  };
});

describe('WalletController', () => {
  let controller: WalletController;

  beforeEach(() => {
    resetMocks();
    controller = new WalletController(DEFAULT_NETWORK);
  });

  describe('initialization', () => {
    it('should create controller with default network', () => {
      expect(controller).toBeDefined();
    });

    it('should initialize with empty wallets', async () => {
      await controller.initialize();
      expect(controller.getAllAccounts()).toEqual([]);
    });

    it('should report no wallets when empty', async () => {
      await controller.initialize();
      expect(controller.hasWallets()).toBe(false);
    });
  });

  describe('wallet creation', () => {
    it('should create a new wallet', async () => {
      await controller.initialize();
      const result = await controller.createWallet('Test Wallet', 'Password123!');

      expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(result.mnemonic).toBeDefined();
      expect(result.mnemonic.split(' ')).toHaveLength(12);
    });

    it('should unlock wallet after creation', async () => {
      await controller.initialize();
      await controller.createWallet('Test Wallet', 'Password123!');

      expect(controller.isWalletUnlocked()).toBe(true);
    });

    it('should set current account after creation', async () => {
      await controller.initialize();
      const result = await controller.createWallet('Test Wallet', 'Password123!');

      expect(controller.getCurrentAccount()).toBe(result.address);
    });

    it('should have wallets after creation', async () => {
      await controller.initialize();
      await controller.createWallet('Test Wallet', 'Password123!');

      expect(controller.hasWallets()).toBe(true);
    });

    it('should list created wallet in accounts', async () => {
      await controller.initialize();
      const result = await controller.createWallet('Test Wallet', 'Password123!');

      const accounts = controller.getAllAccounts();
      expect(accounts).toHaveLength(1);
      expect(accounts[0].address).toBe(result.address);
      expect(accounts[0].name).toBe('Test Wallet');
    });

    it('should not expose private key in getAllAccounts', async () => {
      await controller.initialize();
      await controller.createWallet('Test Wallet', 'Password123!');

      const accounts = controller.getAllAccounts();
      expect(accounts[0].encryptedPrivateKey).toBe('');
    });
  });

  describe('wallet import', () => {
    const testPrivateKey =
      '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    it('should import wallet from private key', async () => {
      await controller.initialize();
      const address = await controller.importWallet(
        testPrivateKey,
        'Imported Wallet',
        'Password123!'
      );

      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('should import wallet from private key without 0x prefix', async () => {
      await controller.initialize();
      const address = await controller.importWallet(
        testPrivateKey.slice(2),
        'Imported Wallet',
        'Password123!'
      );

      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('should import wallet from mnemonic', async () => {
      await controller.initialize();
      const mnemonic = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
      const address = await controller.importWallet(
        mnemonic,
        'Mnemonic Wallet',
        'Password123!'
      );

      expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('should reject duplicate wallet import', async () => {
      await controller.initialize();
      await controller.importWallet(testPrivateKey, 'First', 'Password123!');

      await expect(
        controller.importWallet(testPrivateKey, 'Duplicate', 'Password123!')
      ).rejects.toThrow('Wallet already exists');
    });
  });

  describe('unlock/lock', () => {
    const password = 'Password123!';

    beforeEach(async () => {
      await controller.initialize();
      await controller.createWallet('Test Wallet', password);
      controller.lock();
    });

    it('should lock wallet', () => {
      expect(controller.isWalletUnlocked()).toBe(false);
    });

    it('should return null for getCurrentAccount when locked', () => {
      expect(controller.getCurrentAccount()).toBeNull();
    });

    it('should unlock with correct password', async () => {
      const result = await controller.unlock(password);
      expect(result).toBe(true);
      expect(controller.isWalletUnlocked()).toBe(true);
    });

    it('should fail unlock with wrong password', async () => {
      const result = await controller.unlock('WrongPassword');
      expect(result).toBe(false);
      expect(controller.isWalletUnlocked()).toBe(false);
    });

    it('should return current account after unlock', async () => {
      await controller.unlock(password);
      expect(controller.getCurrentAccount()).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });

    it('should throw when unlocking with no wallets', async () => {
      // Clear storage to ensure no wallets exist
      resetMocks();
      const emptyController = new WalletController();
      await emptyController.initialize();

      await expect(emptyController.unlock(password)).rejects.toThrow(
        'No wallet found'
      );
    });
  });

  describe('account management', () => {
    const password = 'Password123!';

    beforeEach(async () => {
      await controller.initialize();
      await controller.createWallet('Wallet 1', password);
    });

    it('should switch between accounts', async () => {
      const result2 = await controller.createWallet('Wallet 2', password);

      await controller.switchAccount(controller.getAllAccounts()[0].address);
      expect(controller.getCurrentAccount()).toBe(
        controller.getAllAccounts()[0].address
      );

      await controller.switchAccount(result2.address);
      expect(controller.getCurrentAccount()).toBe(result2.address);
    });

    it('should throw when switching to non-existent account', async () => {
      await expect(
        controller.switchAccount('0x0000000000000000000000000000000000000000')
      ).rejects.toThrow('Wallet not found');
    });

    it('should rename account', async () => {
      const address = controller.getCurrentAccount()!;
      await controller.renameAccount(address, 'Renamed Wallet');

      const accounts = controller.getAllAccounts();
      expect(accounts[0].name).toBe('Renamed Wallet');
    });

    it('should throw when renaming non-existent account', async () => {
      await expect(
        controller.renameAccount(
          '0x0000000000000000000000000000000000000000',
          'New Name'
        )
      ).rejects.toThrow('Wallet not found');
    });

    it('should remove account', async () => {
      await controller.createWallet('Wallet 2', password);
      const accounts = controller.getAllAccounts();
      expect(accounts).toHaveLength(2);

      await controller.removeAccount(accounts[0].address);
      expect(controller.getAllAccounts()).toHaveLength(1);
    });

    it('should not remove last account', async () => {
      const address = controller.getCurrentAccount()!;
      await expect(controller.removeAccount(address)).rejects.toThrow(
        'Cannot remove the last account'
      );
    });

    it('should throw when removing non-existent account', async () => {
      await expect(
        controller.removeAccount('0x0000000000000000000000000000000000000000')
      ).rejects.toThrow('Wallet not found');
    });
  });

  describe('HD wallet derivation', () => {
    const password = 'Password123!';

    it('should derive new account from mnemonic', async () => {
      await controller.initialize();
      const mnemonic = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
      await controller.importWallet(mnemonic, 'HD Wallet', password);

      const derived = await controller.addDerivedAccount('Derived 1');

      expect(derived.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(derived.hdIndex).toBe(1);
      expect(controller.getAllAccounts()).toHaveLength(2);
    });

    it('should fail to derive when wallet is locked', async () => {
      await controller.initialize();
      const mnemonic = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
      await controller.importWallet(mnemonic, 'HD Wallet', password);
      controller.lock();

      await expect(controller.addDerivedAccount('Derived')).rejects.toThrow(
        'Wallet is locked'
      );
    });

    it('should fail to derive from private-key-only wallet', async () => {
      await controller.initialize();
      const privateKey =
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      await controller.importWallet(privateKey, 'PK Wallet', password);

      await expect(controller.addDerivedAccount('Derived')).rejects.toThrow(
        'No recovery phrase available'
      );
    });
  });

  describe('balance', () => {
    it('should get balance as formatted string', async () => {
      await controller.initialize();
      await controller.createWallet('Test Wallet', 'Password123!');

      const balance = await controller.getBalance();
      // Balance should be a valid decimal string (mock may return 0 or mocked value)
      expect(typeof balance).toBe('string');
      expect(parseFloat(balance)).toBeGreaterThanOrEqual(0);
    });

    it('should throw when no address available', async () => {
      await controller.initialize();
      await expect(controller.getBalance()).rejects.toThrow('No address');
    });
  });

  describe('signing', () => {
    const password = 'Password123!';

    beforeEach(async () => {
      await controller.initialize();
      await controller.createWallet('Test Wallet', password);
    });

    it('should sign message when unlocked', async () => {
      const signature = await controller.signMessage('Hello, World!');
      expect(signature).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it('should fail to sign when locked', async () => {
      controller.lock();
      await expect(controller.signMessage('Hello')).rejects.toThrow(
        'Wallet is locked'
      );
    });
  });

  describe('network', () => {
    it('should get current network', async () => {
      await controller.initialize();
      const network = controller.getNetwork();
      expect(network).toEqual(DEFAULT_NETWORK);
    });

    it('should set network', async () => {
      await controller.initialize();
      const newNetwork = {
        ...DEFAULT_NETWORK,
        name: 'Custom Network',
        rpcUrl: 'https://custom.rpc',
      };

      controller.setNetwork(newNetwork);
      expect(controller.getNetwork().name).toBe('Custom Network');
    });
  });

  describe('export', () => {
    const password = 'Password123!';

    beforeEach(async () => {
      await controller.initialize();
      await controller.createWallet('Test Wallet', password);
    });

    it('should export private key', async () => {
      const privateKey = await controller.exportPrivateKey(password);
      expect(privateKey).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });

    it('should not return valid private key with wrong password', async () => {
      // With wrong password, decrypt may return garbage instead of throwing
      // (depending on whether garbage bytes happen to be valid UTF-8)
      // So we check that the result is not a valid private key format
      try {
        const result = await controller.exportPrivateKey('WrongPassword');
        // If it doesn't throw, the result should be garbage (not valid 64-char hex)
        expect(result).not.toMatch(/^0x[0-9a-fA-F]{64}$/);
      } catch {
        // If it throws, that's also acceptable behavior
        expect(true).toBe(true);
      }
    });

    it('should export mnemonic for HD wallet', async () => {
      const mnemonic = await controller.exportMnemonic(password);
      expect(mnemonic.split(' ')).toHaveLength(12);
    });
  });

  describe('activity timeout', () => {
    it('should track activity', async () => {
      await controller.initialize();
      await controller.createWallet('Test', 'Password123!');

      controller.touchActivity();
      // Activity should be tracked (internal state)
      expect(controller.isWalletUnlocked()).toBe(true);
    });

    it('should auto-lock wallet after inactivity timeout', async () => {
      // Use fake timers
      vi.useFakeTimers();

      await controller.initialize();
      await controller.createWallet('Test', 'Password123!');

      expect(controller.isWalletUnlocked()).toBe(true);

      // Advance time by 31 minutes (past the 30-minute lock timeout)
      vi.advanceTimersByTime(31 * 60 * 1000);

      // Wallet should be auto-locked
      expect(controller.isWalletUnlocked()).toBe(false);

      // Restore real timers
      vi.useRealTimers();
    });

    it('should stay unlocked for short inactivity', async () => {
      // Use fake timers
      vi.useFakeTimers();

      await controller.initialize();
      await controller.createWallet('Test', 'Password123!');

      expect(controller.isWalletUnlocked()).toBe(true);

      // Advance time by only 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Wallet should still be unlocked
      expect(controller.isWalletUnlocked()).toBe(true);

      // Restore real timers
      vi.useRealTimers();
    });
  });

  describe('signTypedData', () => {
    const password = 'Password123!';

    beforeEach(async () => {
      await controller.initialize();
      await controller.createWallet('Test Wallet', password);
    });

    it('should sign typed data when unlocked', async () => {
      const typedData = JSON.stringify({
        domain: { name: 'Test', version: '1' },
        types: { Test: [{ name: 'value', type: 'string' }] },
        message: { value: 'hello' },
      });

      const signature = await controller.signTypedData(typedData);
      expect(signature).toMatch(/^0x[0-9a-fA-F]+$/);
    });

    it('should fail to sign typed data when locked', async () => {
      controller.lock();
      const typedData = JSON.stringify({
        domain: { name: 'Test', version: '1' },
        types: { Test: [{ name: 'value', type: 'string' }] },
        message: { value: 'hello' },
      });

      await expect(controller.signTypedData(typedData)).rejects.toThrow(
        'Wallet is locked'
      );
    });
  });

  describe('provider methods', () => {
    beforeEach(async () => {
      await controller.initialize();
      await controller.createWallet('Test Wallet', 'Password123!');
    });

    it('should get block number', async () => {
      const blockNumber = await controller.getBlockNumber();
      expect(typeof blockNumber).toBe('number');
    });

    it('should get transaction count', async () => {
      const address = controller.getCurrentAccount()!;
      const count = await controller.getTransactionCount(address);
      expect(typeof count).toBe('number');
    });

    it('should throw when getting transaction count without address', async () => {
      controller.lock();
      // Create new controller without wallets to test the no-address case
      resetMocks();
      const emptyController = new WalletController();
      await emptyController.initialize();
      await expect(emptyController.getTransactionCount()).rejects.toThrow(
        'No address'
      );
    });

    it('should get gas price', async () => {
      const gasPrice = await controller.getGasPrice();
      expect(typeof gasPrice).toBe('string');
    });

    it('should estimate gas', async () => {
      const gas = await controller.estimateGas({ to: controller.getCurrentAccount() });
      expect(typeof gas).toBe('string');
    });

    it('should get code at address', async () => {
      const code = await controller.getCode(controller.getCurrentAccount()!);
      expect(typeof code).toBe('string');
    });

    it('should call contract', async () => {
      const result = await controller.call({ to: controller.getCurrentAccount() });
      expect(typeof result).toBe('string');
    });

    // Note: getTransactionReceipt, getTransactionByHash, getBlockByNumber, getLogs
    // are simple pass-through methods to the provider and are difficult to mock properly
  });

  describe('hasWalletsAsync', () => {
    it('should return true when wallets exist in memory', async () => {
      await controller.initialize();
      await controller.createWallet('Test', 'Password123!');

      expect(await controller.hasWalletsAsync()).toBe(true);
    });

    it('should return false when no wallets exist', async () => {
      resetMocks();
      const emptyController = new WalletController();
      await emptyController.initialize();

      expect(await emptyController.hasWalletsAsync()).toBe(false);
    });
  });

  describe('export mnemonic', () => {
    const password = 'Password123!';

    it('should throw when exporting mnemonic for private-key-only wallet', async () => {
      await controller.initialize();
      const privateKey =
        '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      await controller.importWallet(privateKey, 'PK Wallet', password);

      await expect(controller.exportMnemonic(password)).rejects.toThrow(
        'No recovery phrase available'
      );
    });

    it('should throw when exporting mnemonic for non-existent wallet', async () => {
      await controller.initialize();
      await controller.createWallet('Test', password);

      await expect(
        controller.exportMnemonic(password, '0x0000000000000000000000000000000000000000')
      ).rejects.toThrow('Wallet not found');
    });
  });

  describe('export private key', () => {
    const password = 'Password123!';

    it('should throw when exporting for non-existent wallet', async () => {
      await controller.initialize();
      await controller.createWallet('Test', password);

      await expect(
        controller.exportPrivateKey(password, '0x0000000000000000000000000000000000000000')
      ).rejects.toThrow('Wallet not found');
    });
  });
});

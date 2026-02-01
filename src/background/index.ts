import { WalletController } from './WalletController';
import { DEFAULT_NETWORK } from '../utils/constants';
import { walletStorage } from '../utils/storage';
import { RPC_ERRORS } from '../types/network';

// Initialize wallet controller
const walletController = new WalletController(DEFAULT_NETWORK);

// Initialize on service worker start
walletController.initialize().then(() => {
  console.log('[QFC] Background service initialized');
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error('[QFC] Message handling error:', error);
      sendResponse({
        error: {
          code: RPC_ERRORS.INTERNAL_ERROR.code,
          message: error.message || 'Internal error',
        },
      });
    });

  // Return true to indicate async response
  return true;
});

// Handle external connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  console.log('[QFC] New connection from:', port.name);

  port.onMessage.addListener(async (message) => {
    try {
      const response = await handleMessage(message, port.sender);
      port.postMessage(response);
    } catch (error) {
      port.postMessage({
        id: message.id,
        error: {
          code: RPC_ERRORS.INTERNAL_ERROR.code,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      });
    }
  });
});

async function handleMessage(
  message: { method: string; params?: unknown[]; id?: number; origin?: string },
  sender?: chrome.runtime.MessageSender
): Promise<unknown> {
  const { method, params = [], id, origin } = message;
  const senderOrigin = origin || sender?.origin || sender?.url || 'unknown';

  console.log(`[QFC] Request: ${method}`, params);

  try {
    let result: unknown;

    switch (method) {
      // Account methods
      case 'eth_requestAccounts': {
        const account = walletController.getCurrentAccount();
        if (account) {
          // Add to connected sites
          await walletStorage.addConnectedSite(senderOrigin, account);
          result = [account];
        } else if (!walletController.hasWallets()) {
          // No wallet - need to create one
          throw new Error('No wallet found. Please create a wallet first.');
        } else {
          // Wallet locked - need to unlock
          throw new Error('Wallet is locked. Please unlock your wallet.');
        }
        break;
      }

      case 'eth_accounts': {
        const account = walletController.getCurrentAccount();
        if (account) {
          const isConnected = await walletStorage.isConnected(
            senderOrigin,
            account
          );
          result = isConnected ? [account] : [];
        } else {
          result = [];
        }
        break;
      }

      // Chain methods
      case 'eth_chainId': {
        result = walletController.getNetwork().chainIdHex;
        break;
      }

      case 'net_version': {
        result = walletController.getNetwork().chainId.toString();
        break;
      }

      // Balance and nonce
      case 'eth_getBalance': {
        const [address] = params as [string];
        const balance = await walletController.getBalance(address);
        result = '0x' + BigInt(Math.floor(parseFloat(balance) * 1e18)).toString(16);
        break;
      }

      case 'eth_getTransactionCount': {
        const [address] = params as [string];
        const count = await walletController.getTransactionCount(address);
        result = '0x' + count.toString(16);
        break;
      }

      // Transaction methods
      case 'eth_sendTransaction': {
        const [txParams] = params as [Record<string, unknown>];
        result = await walletController.sendTransaction(txParams);
        break;
      }

      case 'eth_estimateGas': {
        const [txParams] = params as [Record<string, unknown>];
        const gas = await walletController.estimateGas(txParams);
        result = '0x' + BigInt(gas).toString(16);
        break;
      }

      case 'eth_gasPrice': {
        const gasPrice = await walletController.getGasPrice();
        result = '0x' + BigInt(gasPrice).toString(16);
        break;
      }

      // Signing methods
      case 'personal_sign': {
        const [message, _address] = params as [string, string];
        result = await walletController.signMessage(message);
        break;
      }

      case 'eth_sign': {
        const [_address, message] = params as [string, string];
        result = await walletController.signMessage(message);
        break;
      }

      case 'eth_signTypedData_v4': {
        const [_address, typedData] = params as [string, string];
        result = await walletController.signTypedData(typedData);
        break;
      }

      // Internal methods (from popup)
      case 'wallet_createWallet': {
        const [name, password] = params as [string, string];
        result = await walletController.createWallet(name, password);
        break;
      }

      case 'wallet_importWallet': {
        const [keyOrMnemonic, name, password] = params as [string, string, string];
        result = await walletController.importWallet(keyOrMnemonic, name, password);
        break;
      }

      case 'wallet_unlock': {
        const [password] = params as [string];
        result = await walletController.unlock(password);
        break;
      }

      case 'wallet_lock': {
        walletController.lock();
        result = true;
        break;
      }

      case 'wallet_isUnlocked': {
        result = walletController.isWalletUnlocked();
        break;
      }

      case 'wallet_hasWallets': {
        result = walletController.hasWallets();
        break;
      }

      case 'wallet_getAllAccounts': {
        result = walletController.getAllAccounts();
        break;
      }

      case 'wallet_switchAccount': {
        const [address] = params as [string];
        await walletController.switchAccount(address);
        result = true;
        break;
      }

      case 'wallet_getNetwork': {
        result = walletController.getNetwork();
        break;
      }

      default:
        throw {
          code: RPC_ERRORS.METHOD_NOT_FOUND.code,
          message: `Method ${method} not found`,
        };
    }

    return { id, result };
  } catch (error) {
    console.error(`[QFC] Error handling ${method}:`, error);

    if (error && typeof error === 'object' && 'code' in error) {
      return { id, error };
    }

    return {
      id,
      error: {
        code: RPC_ERRORS.INTERNAL_ERROR.code,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('[QFC] Service worker heartbeat');
  }
});

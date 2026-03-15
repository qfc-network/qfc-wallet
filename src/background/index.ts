import { ethers } from 'ethers';
import { WalletController } from './WalletController';
import { NETWORKS, NetworkKey, LOCK_TIMEOUT_MS } from '../utils/constants';
import { walletStorage, txStorage, tokenStorage, nftStorage, networkStorage } from '../utils/storage';
import { RPC_ERRORS } from '../types/network';
import type { TransactionRecord, PendingApproval } from '../types/transaction';
import type { Token } from '../types/token';
import { ERC20_ABI } from '../types/token';
import type { NFT } from '../types/nft';
import { ERC721_ABI, ERC1155_ABI, ERC1155_INTERFACE_ID, resolveIpfsUri } from '../types/nft';

// State
let currentNetworkKey: NetworkKey = 'testnet';
let pendingApproval: PendingApproval | null = null;
let approvalResolvers: Map<string, { resolve: (value: boolean) => void }> = new Map();
const contentPorts: Map<chrome.runtime.Port, string> = new Map();
const logFilters: Map<string, { filter: Record<string, unknown>; lastBlock: number }> = new Map();
let nextFilterId = 1;

// Initialize wallet controller
const walletController = new WalletController(NETWORKS[currentNetworkKey]);

// Initialization promise to ensure we wait for init before handling messages
let initPromise: Promise<void> | null = null;

// Initialize on service worker start
async function initialize() {
  const customNetworks = await networkStorage.getCustomNetworks();
  Object.assign(NETWORKS, customNetworks);

  await walletController.initialize();

  // Load saved network
  const savedNetwork = await networkStorage.getCurrentNetwork();
  if (savedNetwork && savedNetwork in NETWORKS) {
    currentNetworkKey = savedNetwork as NetworkKey;
    walletController.setNetwork(NETWORKS[currentNetworkKey]);
  }

  console.log('[QFC] Background service initialized');
}

// Ensure initialization is complete
async function ensureInitialized() {
  if (!initPromise) {
    initPromise = initialize();
  }
  await initPromise;
}

// Start initialization immediately
ensureInitialized();

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

  return true;
});

// Handle external connections from content scripts
chrome.runtime.onConnect.addListener((port) => {
  console.log('[QFC] New connection from:', port.name);

  if (port.name === 'qfc-content') {
    const origin = getSenderOrigin(port.sender);
    contentPorts.set(port, origin);
    notifyPortInitialState(port, origin).catch((error) => {
      console.error('[QFC] Failed to notify initial state:', error);
    });

    port.onDisconnect.addListener(() => {
      contentPorts.delete(port);
    });
  }

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
  // Ensure initialization is complete before handling any message
  await ensureInitialized();

  const { method, params = [], id, origin } = message;
  const senderOrigin = origin || getSenderOrigin(sender);

  console.log(`[QFC] Request: ${method}`, params);

  try {
    let result: unknown;

    switch (method) {
      // Account methods
      case 'eth_requestAccounts': {
        const account = walletController.getCurrentAccount();
        if (account) {
          // Check if already connected
          const isConnected = await walletStorage.isConnected(senderOrigin, account);
          if (!isConnected) {
            // Request approval
            const approved = await requestApproval('connect', senderOrigin, {
              origin: senderOrigin,
            });
            if (!approved) {
              throw { code: RPC_ERRORS.USER_REJECTED.code, message: 'User rejected the request' };
            }
          }
          await walletStorage.addConnectedSite(senderOrigin, account);
          result = [account];
          notifyAccountsChangedForOrigin(senderOrigin).catch((error) => {
            console.error('[QFC] Failed to emit accountsChanged:', error);
          });
        } else if (!walletController.hasWallets()) {
          throw new Error('No wallet found. Please create a wallet first.');
        } else {
          throw new Error('Wallet is locked. Please unlock your wallet.');
        }
        break;
      }

      case 'eth_accounts': {
        const account = walletController.getCurrentAccount();
        if (account) {
          const isConnected = await walletStorage.isConnected(senderOrigin, account);
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

      case 'eth_blockNumber': {
        const blockNumber = await walletController.getBlockNumber();
        result = '0x' + blockNumber.toString(16);
        break;
      }

      case 'eth_getCode': {
        const [address] = params as [string];
        result = await walletController.getCode(address);
        break;
      }

      // Balance and nonce
      case 'eth_getBalance': {
        const [address, blockTag] = params as [string, string?];
        const balance = await walletController.getBalance(address, blockTag as ethers.BlockTag);
        result = '0x' + BigInt(Math.floor(parseFloat(balance) * 1e18)).toString(16);
        break;
      }

      case 'eth_getTransactionCount': {
        const [address, blockTag] = params as [string, string?];
        const count = await walletController.getTransactionCount(address, blockTag as ethers.BlockTag);
        result = '0x' + count.toString(16);
        break;
      }

      // Transaction methods
      case 'eth_sendTransaction': {
        const [txParams] = params as [Record<string, unknown>];

        // Request approval for external requests
        if (sender?.tab) {
          const approved = await requestApproval('transaction', senderOrigin, txParams);
          if (!approved) {
            throw { code: RPC_ERRORS.USER_REJECTED.code, message: 'User rejected the request' };
          }
        }

        const hash = await walletController.sendTransaction(txParams);

        // Save transaction to history
        const account = walletController.getCurrentAccount();
        if (account) {
          const tx: TransactionRecord = {
            hash,
            from: (txParams.from as string) || account,
            to: txParams.to as string,
            value: (Number(BigInt(txParams.value as string || '0')) / 1e18).toFixed(4),
            timestamp: Date.now(),
            status: 'pending',
            type: txParams.data && txParams.data !== '0x' ? 'contract' : 'send',
          };
          await txStorage.addTransaction(account, tx);
        }

        result = hash;
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

      case 'eth_call': {
        const [txParams] = params as [Record<string, unknown>];
        result = await walletController.call(txParams);
        break;
      }

      case 'eth_getTransactionReceipt': {
        const [hash] = params as [string];
        result = await walletController.getTransactionReceipt(hash);
        break;
      }

      case 'eth_getTransactionByHash': {
        const [hash] = params as [string];
        result = await walletController.getTransactionByHash(hash);
        break;
      }

      case 'eth_getBlockByNumber': {
        const [blockTag] = params as [string, boolean?];
        result = await walletController.getBlockByNumber(blockTag);
        break;
      }

      case 'eth_getLogs': {
        const [filter] = params as [Record<string, unknown>];
        result = await walletController.getLogs(filter);
        break;
      }

      case 'eth_newFilter': {
        const [filter] = params as [Record<string, unknown>];
        const latestBlock = await walletController.getBlockNumber();
        const fromBlock = normalizeBlockTag(filter?.fromBlock, latestBlock);
        const id = '0x' + (nextFilterId++).toString(16);
        logFilters.set(id, { filter: { ...filter }, lastBlock: fromBlock });
        result = id;
        break;
      }

      case 'eth_getFilterChanges': {
        const [filterId] = params as [string];
        const entry = logFilters.get(filterId);
        if (!entry) {
          throw { code: RPC_ERRORS.INVALID_PARAMS.code, message: 'Unknown filter' };
        }
        const latestBlock = await walletController.getBlockNumber();
        const fromBlock = Math.min(entry.lastBlock + 1, latestBlock);
        const logs = await walletController.getLogs({
          ...entry.filter,
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: '0x' + latestBlock.toString(16),
        });
        entry.lastBlock = latestBlock;
        result = logs;
        break;
      }

      case 'eth_uninstallFilter': {
        const [filterId] = params as [string];
        result = logFilters.delete(filterId);
        break;
      }

      // Signing methods
      case 'personal_sign': {
        const [message, _address] = params as [string, string];

        if (sender?.tab) {
          const approved = await requestApproval('sign', senderOrigin, { message, address: _address });
          if (!approved) {
            throw { code: RPC_ERRORS.USER_REJECTED.code, message: 'User rejected the request' };
          }
        }

        result = await walletController.signMessage(message);
        break;
      }

      case 'eth_sign': {
        const [_address, message] = params as [string, string];

        if (sender?.tab) {
          const approved = await requestApproval('sign', senderOrigin, { message, address: _address });
          if (!approved) {
            throw { code: RPC_ERRORS.USER_REJECTED.code, message: 'User rejected the request' };
          }
        }

        result = await walletController.signMessage(message);
        break;
      }

      case 'eth_signTypedData_v4': {
        const [_address, typedData] = params as [string, string];

        if (sender?.tab) {
          const approved = await requestApproval('sign', senderOrigin, {
            message: typedData,
            address: _address,
            isTypedData: true,
          });
          if (!approved) {
            throw { code: RPC_ERRORS.USER_REJECTED.code, message: 'User rejected the request' };
          }
        }

        result = await walletController.signTypedData(typedData);
        break;
      }

      // Internal methods (from popup)
      case 'wallet_createWallet': {
        const [name, password] = params as [string, string];
        result = await walletController.createWallet(name, password);
        notifyAccountsChanged().catch((error) => {
          console.error('[QFC] Failed to emit accountsChanged:', error);
        });
        break;
      }

      // EIP-2255 permissions
      case 'wallet_requestPermissions': {
        const [requested] = params as [Record<string, unknown>];

        if (!requested || !('eth_accounts' in requested)) {
          throw { code: RPC_ERRORS.INVALID_PARAMS.code, message: 'Only eth_accounts is supported' };
        }

        const account = walletController.getCurrentAccount();
        if (account) {
          const isConnected = await walletStorage.isConnected(senderOrigin, account);
          if (!isConnected) {
            const approved = await requestApproval('connect', senderOrigin, {
              origin: senderOrigin,
            });
            if (!approved) {
              throw { code: RPC_ERRORS.USER_REJECTED.code, message: 'User rejected the request' };
            }
          }
          await walletStorage.addConnectedSite(senderOrigin, account);
          result = [{ parentCapability: 'eth_accounts' }];
          notifyAccountsChangedForOrigin(senderOrigin).catch((error) => {
            console.error('[QFC] Failed to emit accountsChanged:', error);
          });
        } else if (!walletController.hasWallets()) {
          throw new Error('No wallet found. Please create a wallet first.');
        } else {
          throw new Error('Wallet is locked. Please unlock your wallet.');
        }
        break;
      }

      case 'wallet_getPermissions': {
        const account = walletController.getCurrentAccount();
        if (account) {
          const isConnected = await walletStorage.isConnected(senderOrigin, account);
          result = isConnected ? [{ parentCapability: 'eth_accounts' }] : [];
        } else {
          result = [];
        }
        break;
      }

      case 'wallet_revokePermissions': {
        const [requested] = params as [Record<string, unknown>];
        if (requested && 'eth_accounts' in requested) {
          await walletStorage.removeConnectedSite(senderOrigin);
          notifyAccountsChangedForOrigin(senderOrigin).catch((error) => {
            console.error('[QFC] Failed to emit accountsChanged:', error);
          });
        }
        result = null;
        break;
      }

      case 'wallet_switchEthereumChain': {
        const [chainParams] = params as [{ chainId: string }];
        const chainId = chainParams?.chainId;
        if (!chainId) {
          throw { code: RPC_ERRORS.INVALID_PARAMS.code, message: 'chainId is required' };
        }

        const targetKey = findNetworkKeyByChainId(chainId);
        if (!targetKey) {
          throw { code: 4902, message: 'Chain not found' };
        }

        if (targetKey === currentNetworkKey) {
          result = null;
          break;
        }

        currentNetworkKey = targetKey;
        walletController.setNetwork(NETWORKS[targetKey]);
        await networkStorage.setCurrentNetwork(targetKey);
        result = null;
        notifyChainChanged().catch((error) => {
          console.error('[QFC] Failed to emit chainChanged:', error);
        });
        break;
      }

      case 'wallet_addEthereumChain': {
        const [chainParams] = params as [Record<string, unknown>];
        if (!chainParams || !chainParams.chainId || !chainParams.chainName || !chainParams.rpcUrls) {
          throw { code: RPC_ERRORS.INVALID_PARAMS.code, message: 'Invalid chain params' };
        }

        const approved = await requestApproval('add_chain', senderOrigin, chainParams);
        if (!approved) {
          throw { code: RPC_ERRORS.USER_REJECTED.code, message: 'User rejected the request' };
        }

        const chainId = String(chainParams.chainId);
        const chainName = String(chainParams.chainName);
        const rpcUrls = chainParams.rpcUrls as string[];
        const blockExplorerUrls = (chainParams.blockExplorerUrls as string[] | undefined) || [];
        const nativeCurrency = chainParams.nativeCurrency as
          | { name: string; symbol: string; decimals: number }
          | undefined;

        const rpcUrl = rpcUrls[0];
        if (!rpcUrl) {
          throw { code: RPC_ERRORS.INVALID_PARAMS.code, message: 'rpcUrls is required' };
        }

        const parsedChainId = chainId.startsWith('0x') ? parseInt(chainId, 16) : Number(chainId);
        const normalizedHex = chainId.startsWith('0x') ? chainId.toLowerCase() : `0x${parsedChainId.toString(16)}`;
        const networkKey = `custom_${normalizedHex}` as NetworkKey;

        const customNetwork = {
          chainId: parsedChainId,
          chainIdHex: normalizedHex,
          name: chainName,
          rpcUrl,
          explorerUrl: blockExplorerUrls[0] || '',
          symbol: nativeCurrency?.symbol || 'QFC',
          decimals: nativeCurrency?.decimals || 18,
        };

        NETWORKS[networkKey] = customNetwork;
        await networkStorage.addCustomNetwork(networkKey, customNetwork);

        await networkStorage.setCurrentNetwork(networkKey);
        currentNetworkKey = networkKey;
        walletController.setNetwork(NETWORKS[networkKey]);
        notifyChainChanged().catch((error) => {
          console.error('[QFC] Failed to emit chainChanged:', error);
        });

        result = null;
        break;
      }

      case 'wallet_importWallet': {
        const [keyOrMnemonic, name, password] = params as [string, string, string];
        result = await walletController.importWallet(keyOrMnemonic, name, password);
        notifyAccountsChanged().catch((error) => {
          console.error('[QFC] Failed to emit accountsChanged:', error);
        });
        break;
      }

      case 'wallet_unlock': {
        const [password] = params as [string];
        result = await walletController.unlock(password);
        notifyAccountsChanged().catch((error) => {
          console.error('[QFC] Failed to emit accountsChanged:', error);
        });
        break;
      }

      case 'wallet_lock': {
        walletController.lock();
        result = true;
        notifyAccountsChanged().catch((error) => {
          console.error('[QFC] Failed to emit accountsChanged:', error);
        });
        break;
      }

      case 'wallet_reportActivity': {
        walletController.touchActivity();
        result = true;
        break;
      }

      case 'wallet_exportPrivateKey': {
        const [password, address] = params as [string, string | undefined];
        result = await walletController.exportPrivateKey(password, address);
        break;
      }

      case 'wallet_exportMnemonic': {
        const [password, address] = params as [string, string | undefined];
        result = await walletController.exportMnemonic(password, address);
        break;
      }

      case 'wallet_isUnlocked': {
        result = walletController.isWalletUnlocked();
        break;
      }

      case 'wallet_hasWallets': {
        result = await walletController.hasWalletsAsync();
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
        notifyAccountsChanged().catch((error) => {
          console.error('[QFC] Failed to emit accountsChanged:', error);
        });
        break;
      }

      case 'wallet_addDerivedAccount': {
        const [name] = params as [string | undefined];
        result = await walletController.addDerivedAccount(name);
        notifyAccountsChanged().catch((error) => {
          console.error('[QFC] Failed to emit accountsChanged:', error);
        });
        break;
      }

      case 'wallet_renameAccount': {
        const [address, name] = params as [string, string];
        await walletController.renameAccount(address, name);
        result = true;
        break;
      }

      case 'wallet_removeAccount': {
        const [address] = params as [string];
        await walletController.removeAccount(address);
        result = true;
        notifyAccountsChanged().catch((error) => {
          console.error('[QFC] Failed to emit accountsChanged:', error);
        });
        break;
      }

      case 'wallet_getNetwork': {
        result = {
          network: walletController.getNetwork(),
          key: currentNetworkKey,
        };
        break;
      }

      case 'wallet_switchNetwork': {
        const [networkKey] = params as [NetworkKey];
        if (networkKey in NETWORKS) {
          currentNetworkKey = networkKey;
          walletController.setNetwork(NETWORKS[networkKey]);
          await networkStorage.setCurrentNetwork(networkKey);
          result = true;
          notifyChainChanged().catch((error) => {
            console.error('[QFC] Failed to emit chainChanged:', error);
          });
        } else {
          throw new Error('Unknown network');
        }
        break;
      }

      case 'wallet_getNetworks': {
        result = NETWORKS;
        break;
      }

      // Transaction history
      case 'wallet_getTransactions': {
        const [address] = params as [string];
        result = await txStorage.getHistory(address);
        break;
      }

      // Token methods
      case 'wallet_getTokens': {
        const [address] = params as [string];
        result = await tokenStorage.getTokens(address);
        break;
      }

      case 'wallet_addToken': {
        const [walletAddress, tokenAddress] = params as [string, string];
        const network = walletController.getNetwork();
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

        try {
          const [name, symbol, decimals] = await Promise.all([
            contract.name(),
            contract.symbol(),
            contract.decimals(),
          ]);

          const balance = await contract.balanceOf(walletAddress);
          const formattedBalance = ethers.formatUnits(balance, decimals);

          const token: Token = {
            address: tokenAddress,
            name,
            symbol,
            decimals: Number(decimals),
            balance: formattedBalance,
          };

          await tokenStorage.addToken(walletAddress, token);
          result = token;
        } catch {
          throw new Error('Invalid token contract');
        }
        break;
      }

      case 'wallet_watchAsset': {
        const [watchParams] = params as [Record<string, unknown>];
        if (!watchParams || watchParams.type !== 'ERC20' || !watchParams.options) {
          throw { code: RPC_ERRORS.INVALID_PARAMS.code, message: 'Invalid watchAsset params' };
        }

        const options = watchParams.options as {
          address: string;
          symbol?: string;
          decimals?: number;
        };

        const account = walletController.getCurrentAccount();
        if (!account) {
          throw new Error('Wallet is locked');
        }

        const tokenAddress = options.address;
        if (!tokenAddress) {
          throw { code: RPC_ERRORS.INVALID_PARAMS.code, message: 'Token address is required' };
        }

        const network = walletController.getNetwork();
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

        try {
          const [name, symbol, decimals] = await Promise.all([
            contract.name(),
            contract.symbol(),
            contract.decimals(),
          ]);

          const balance = await contract.balanceOf(account);
          const formattedBalance = ethers.formatUnits(balance, decimals);

          const token: Token = {
            address: tokenAddress,
            name,
            symbol: options.symbol || symbol,
            decimals: Number(options.decimals ?? decimals),
            balance: formattedBalance,
          };

          await tokenStorage.addToken(account, token);
          result = true;
        } catch {
          throw new Error('Invalid token contract');
        }
        break;
      }

      case 'wallet_sendToken': {
        const [
          _fromAddress,
          tokenAddress,
          toAddress,
          amount,
          decimals,
          gasLimit,
          gasPrice,
        ] = params as [
          string,
          string,
          string,
          string,
          number,
          string | null,
          string | null
        ];

        // Encode ERC-20 transfer function call
        const amountWei = ethers.parseUnits(amount, decimals);
        const iface = new ethers.Interface(ERC20_ABI);
        const data = iface.encodeFunctionData('transfer', [toAddress, amountWei]);

        const tx: ethers.TransactionRequest = {
          to: tokenAddress,
          data,
          value: '0x0',
        };
        if (gasLimit) {
          tx.gasLimit = gasLimit;
        }
        if (gasPrice) {
          tx.gasPrice = gasPrice;
        }

        const hash = await walletController.sendTransaction(tx);

        // Save to transaction history
        const account = walletController.getCurrentAccount();
        if (account) {
          const network = walletController.getNetwork();
          const provider = new ethers.JsonRpcProvider(network.rpcUrl);
          const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
          let symbol = 'TOKEN';
          try {
            symbol = await contract.symbol();
          } catch {
            // Use default
          }

          const tx: TransactionRecord = {
            hash,
            from: account,
            to: toAddress,
            value: `${amount} ${symbol}`,
            timestamp: Date.now(),
            status: 'pending',
            type: 'token_transfer',
            tokenAddress,
          };
          await txStorage.addTransaction(account, tx);
        }

        result = hash;
        break;
      }

      case 'wallet_removeToken': {
        const [walletAddress, tokenAddress] = params as [string, string];
        await tokenStorage.removeToken(walletAddress, tokenAddress);
        result = true;
        break;
      }

      case 'wallet_refreshTokenBalances': {
        const [walletAddress] = params as [string];
        const tokens = await tokenStorage.getTokens(walletAddress);
        const network = walletController.getNetwork();
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);

        for (const token of tokens) {
          try {
            const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const balance = await contract.balanceOf(walletAddress);
            token.balance = ethers.formatUnits(balance, token.decimals);
            await tokenStorage.updateTokenBalance(walletAddress, token.address, token.balance);
          } catch {
            // Skip failed tokens
          }
        }

        result = tokens;
        break;
      }

      // Speed up / cancel pending transactions
      case 'wallet_speedUpTransaction': {
        const [txHash] = params as [string];
        const account = walletController.getCurrentAccount();
        if (!account) throw new Error('Wallet is locked');

        // Find original tx in history
        const speedUpHistory = await txStorage.getHistory(account);
        const originalTx = speedUpHistory.find(t => t.hash === txHash);
        if (!originalTx) throw new Error('Transaction not found');
        if (originalTx.status !== 'pending') throw new Error('Transaction is not pending');

        // Get the original on-chain tx to obtain nonce
        const onChainTx = await walletController.getTransactionByHash(txHash);
        if (!onChainTx) throw new Error('Transaction not found on chain');

        // Get current gas price and use 1.5x
        const currentGasPrice = BigInt(await walletController.getGasPrice());
        const originalGasPrice = onChainTx.gasPrice ? BigInt(onChainTx.gasPrice) : currentGasPrice;
        const boostedGasPrice = (originalGasPrice > currentGasPrice ? originalGasPrice : currentGasPrice) * BigInt(3) / BigInt(2);

        // Re-submit same tx with higher gas price and same nonce
        const speedUpTxParams: Record<string, unknown> = {
          to: onChainTx.to,
          value: '0x' + BigInt(onChainTx.value).toString(16),
          nonce: onChainTx.nonce,
          gasPrice: '0x' + boostedGasPrice.toString(16),
          gasLimit: '0x' + BigInt(onChainTx.gasLimit).toString(16),
        };
        if (onChainTx.data && onChainTx.data !== '0x') {
          speedUpTxParams.data = onChainTx.data;
        }

        const newHash = await walletController.sendTransaction(speedUpTxParams);

        // Mark old tx as failed (replaced) and add new one
        await txStorage.updateTransaction(account, txHash, { status: 'failed' });
        const newTxRecord: TransactionRecord = {
          ...originalTx,
          hash: newHash,
          timestamp: Date.now(),
          status: 'pending',
        };
        await txStorage.addTransaction(account, newTxRecord);

        result = newHash;
        break;
      }

      case 'wallet_cancelTransaction': {
        const [txHash] = params as [string];
        const account = walletController.getCurrentAccount();
        if (!account) throw new Error('Wallet is locked');

        // Find original tx in history
        const cancelHistory = await txStorage.getHistory(account);
        const cancelOriginalTx = cancelHistory.find(t => t.hash === txHash);
        if (!cancelOriginalTx) throw new Error('Transaction not found');
        if (cancelOriginalTx.status !== 'pending') throw new Error('Transaction is not pending');

        // Get the original on-chain tx to obtain nonce
        const cancelOnChainTx = await walletController.getTransactionByHash(txHash);
        if (!cancelOnChainTx) throw new Error('Transaction not found on chain');

        // Get current gas price and use 2x
        const cancelCurrentGasPrice = BigInt(await walletController.getGasPrice());
        const cancelOriginalGasPrice = cancelOnChainTx.gasPrice ? BigInt(cancelOnChainTx.gasPrice) : cancelCurrentGasPrice;
        const cancelGasPrice = (cancelOriginalGasPrice > cancelCurrentGasPrice ? cancelOriginalGasPrice : cancelCurrentGasPrice) * BigInt(2);

        // Send 0-value tx to self with same nonce to replace original
        const cancelTxParams: Record<string, unknown> = {
          to: account,
          value: '0x0',
          nonce: cancelOnChainTx.nonce,
          gasPrice: '0x' + cancelGasPrice.toString(16),
          gasLimit: '0x5208', // 21000 for simple transfer
        };

        const cancelNewHash = await walletController.sendTransaction(cancelTxParams);

        // Mark old tx as failed (cancelled)
        await txStorage.updateTransaction(account, txHash, { status: 'failed' });
        const cancelTxRecord: TransactionRecord = {
          hash: cancelNewHash,
          from: account,
          to: account,
          value: '0',
          timestamp: Date.now(),
          status: 'pending',
          type: 'send',
        };
        await txStorage.addTransaction(account, cancelTxRecord);

        result = cancelNewHash;
        break;
      }

      // Connected sites
      case 'wallet_getConnectedSites': {
        result = await walletStorage.getConnectedSites();
        break;
      }

      case 'wallet_disconnectSite': {
        const [origin] = params as [string];
        await walletStorage.removeConnectedSite(origin);
        result = true;
        break;
      }

      // Approval methods
      case 'wallet_getPendingApproval': {
        result = pendingApproval;
        break;
      }

      case 'wallet_resolveApproval': {
        const [approvalId, approved] = params as [string, boolean];
        const resolver = approvalResolvers.get(approvalId);
        if (resolver) {
          resolver.resolve(approved);
          approvalResolvers.delete(approvalId);
          pendingApproval = null;
        }
        result = true;
        break;
      }

      // NFT methods
      case 'wallet_getNFTs': {
        const [address] = params as [string];
        result = await nftStorage.getNFTs(address);
        break;
      }

      case 'wallet_addNFT': {
        const [walletAddress, contractAddress, tokenId] = params as [string, string, string];
        const network = walletController.getNetwork();
        const provider = new ethers.JsonRpcProvider(network.rpcUrl);

        // Detect standard via ERC-165
        let standard: 'ERC-721' | 'ERC-1155' = 'ERC-721';
        let nftName = '';
        let nftImage = '';
        let nftCollection = '';
        let nftBalance: string | undefined;

        try {
          const erc165 = new ethers.Contract(
            contractAddress,
            ['function supportsInterface(bytes4 interfaceId) view returns (bool)'],
            provider
          );

          let isERC1155 = false;
          try {
            isERC1155 = await erc165.supportsInterface(ERC1155_INTERFACE_ID);
          } catch {
            // contract may not support ERC-165
          }

          if (isERC1155) {
            standard = 'ERC-1155';
            const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);

            // Get balance
            const bal = await contract.balanceOf(walletAddress, tokenId);
            nftBalance = bal.toString();

            // Get URI and fetch metadata
            let uri = '';
            try {
              uri = await contract.uri(tokenId);
              // ERC-1155 URIs may contain {id} placeholder
              uri = uri.replace('{id}', BigInt(tokenId).toString(16).padStart(64, '0'));
            } catch {
              // uri may not be available
            }

            if (uri) {
              const resolvedUri = resolveIpfsUri(uri);
              try {
                const response = await fetch(resolvedUri);
                const metadata = await response.json();
                nftName = metadata.name || `#${tokenId}`;
                nftImage = resolveIpfsUri(metadata.image || '');
                nftCollection = metadata.collection?.name || '';
              } catch {
                nftName = `#${tokenId}`;
              }
            } else {
              nftName = `#${tokenId}`;
            }

            // Try to get collection name from contract (not standard for 1155 but some implement it)
            if (!nftCollection) {
              try {
                const nameContract = new ethers.Contract(
                  contractAddress,
                  ['function name() view returns (string)'],
                  provider
                );
                nftCollection = await nameContract.name();
              } catch {
                nftCollection = contractAddress.slice(0, 10) + '...';
              }
            }
          } else {
            // Treat as ERC-721
            standard = 'ERC-721';
            const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);

            // Verify ownership
            try {
              const owner = await contract.ownerOf(tokenId);
              if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
                throw new Error('You do not own this NFT');
              }
            } catch (err) {
              if (err instanceof Error && err.message.includes('do not own')) {
                throw err;
              }
              // ownerOf might fail for non-existent tokens
              throw new Error('NFT not found or invalid token ID');
            }

            // Get collection name
            try {
              nftCollection = await contract.name();
            } catch {
              nftCollection = contractAddress.slice(0, 10) + '...';
            }

            // Get tokenURI and fetch metadata
            let tokenURI = '';
            try {
              tokenURI = await contract.tokenURI(tokenId);
            } catch {
              // tokenURI may not be available
            }

            if (tokenURI) {
              const resolvedUri = resolveIpfsUri(tokenURI);
              try {
                const response = await fetch(resolvedUri);
                const metadata = await response.json();
                nftName = metadata.name || `${nftCollection} #${tokenId}`;
                nftImage = resolveIpfsUri(metadata.image || '');
              } catch {
                nftName = `${nftCollection} #${tokenId}`;
              }
            } else {
              nftName = `${nftCollection} #${tokenId}`;
            }
          }

          const nft: NFT = {
            contractAddress,
            tokenId,
            name: nftName,
            image: nftImage,
            collection: nftCollection,
            standard,
            balance: nftBalance,
          };

          await nftStorage.addNFT(walletAddress, nft);
          result = nft;
        } catch (err) {
          if (err instanceof Error) {
            throw err;
          }
          throw new Error('Invalid NFT contract');
        }
        break;
      }

      case 'wallet_removeNFT': {
        const [walletAddress, contractAddress, tokenId] = params as [string, string, string];
        await nftStorage.removeNFT(walletAddress, contractAddress, tokenId);
        result = true;
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

function getSenderOrigin(sender?: chrome.runtime.MessageSender): string {
  return sender?.origin || sender?.url || 'unknown';
}

function normalizeBlockTag(tag: unknown, latestBlock: number): number {
  if (typeof tag === 'string') {
    if (tag === 'latest' || tag === 'pending') return latestBlock;
    if (tag === 'earliest') return 0;
    if (tag.startsWith('0x')) {
      const parsed = parseInt(tag, 16);
      if (Number.isFinite(parsed)) return parsed;
    }
    const parsed = Number(tag);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof tag === 'number' && Number.isFinite(tag)) return tag;
  return latestBlock;
}

function findNetworkKeyByChainId(chainId: string): NetworkKey | null {
  const normalized = chainId.toLowerCase();
  const entries = Object.entries(NETWORKS) as [NetworkKey, (typeof NETWORKS)[NetworkKey]][];
  for (const [key, network] of entries) {
    if (network.chainIdHex.toLowerCase() === normalized) {
      return key;
    }
    if (normalized.startsWith('0x')) {
      try {
        const dec = parseInt(normalized, 16);
        if (dec === network.chainId) return key;
      } catch {
        // ignore parse errors
      }
    }
  }
  return null;
}

function notifyPort(port: chrome.runtime.Port, method: string, params: unknown) {
  port.postMessage({
    type: 'QFC_NOTIFICATION',
    payload: { method, params },
  });
}

async function notifyPortInitialState(port: chrome.runtime.Port, origin: string) {
  await ensureInitialized();
  const account = walletController.getCurrentAccount();
  const network = walletController.getNetwork();

  if (account) {
    const isConnected = await walletStorage.isConnected(origin, account);
    notifyPort(port, 'accountsChanged', isConnected ? [account] : []);
  } else {
    notifyPort(port, 'accountsChanged', []);
  }

  notifyPort(port, 'chainChanged', network.chainIdHex);
}

async function notifyAccountsChanged() {
  await ensureInitialized();
  const account = walletController.getCurrentAccount();

  await Promise.all(
    Array.from(contentPorts.entries()).map(async ([port, origin]) => {
      const isConnected = account ? await walletStorage.isConnected(origin, account) : false;
      notifyPort(port, 'accountsChanged', isConnected && account ? [account] : []);
    })
  );
}

async function notifyAccountsChangedForOrigin(origin: string) {
  await ensureInitialized();
  const account = walletController.getCurrentAccount();

  await Promise.all(
    Array.from(contentPorts.entries())
      .filter(([, portOrigin]) => portOrigin === origin)
      .map(async ([port]) => {
        const isConnected = account ? await walletStorage.isConnected(origin, account) : false;
        notifyPort(port, 'accountsChanged', isConnected && account ? [account] : []);
      })
  );
}

async function notifyChainChanged() {
  await ensureInitialized();
  const network = walletController.getNetwork();

  await Promise.all(
    Array.from(contentPorts.keys()).map(async (port) => {
      notifyPort(port, 'chainChanged', network.chainIdHex);
    })
  );
}

// Request approval from popup
async function requestApproval(
  type: 'transaction' | 'sign' | 'connect' | 'add_chain',
  origin: string,
  data: unknown
): Promise<boolean> {
  const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  pendingApproval = {
    id,
    type,
    origin,
    timestamp: Date.now(),
    data: data as PendingApproval['data'],
  };

  // Open popup if not already open
  try {
    await chrome.action.openPopup();
  } catch {
    // Popup might already be open
  }

  return new Promise((resolve) => {
    approvalResolvers.set(id, { resolve });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (approvalResolvers.has(id)) {
        approvalResolvers.delete(id);
        pendingApproval = null;
        resolve(false);
      }
    }, 5 * 60 * 1000);
  });
}

// Update pending transaction statuses
async function updatePendingTransactions() {
  try {
    const network = walletController.getNetwork();
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);

    // Get all wallets to check their transactions
    const wallets = walletController.getAllAccounts();

    for (const wallet of wallets) {
      const transactions = await txStorage.getHistory(wallet.address);
      const pendingTxs = transactions.filter(tx => tx.status === 'pending');

      for (const tx of pendingTxs) {
        try {
          const receipt = await provider.getTransactionReceipt(tx.hash);

          if (receipt) {
            const status = receipt.status === 1 ? 'confirmed' : 'failed';
            await txStorage.updateTransaction(wallet.address, tx.hash, {
              status,
              blockNumber: Number(receipt.blockNumber),
              gasUsed: receipt.gasUsed.toString(),
            });
            console.log(`[QFC] Transaction ${tx.hash.slice(0, 10)}... ${status}`);
          }
        } catch (err) {
          // Transaction not found yet, still pending
          console.log(`[QFC] Transaction ${tx.hash.slice(0, 10)}... still pending`);
        }
      }
    }
  } catch (error) {
    console.error('[QFC] Failed to update pending transactions:', error);
  }
}

// Keep service worker alive and update transactions
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.create('updateTransactions', { periodInMinutes: 0.5 }); // Every 30 seconds
chrome.alarms.create('inactivityCheck', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('[QFC] Service worker heartbeat');
  } else if (alarm.name === 'updateTransactions') {
    updatePendingTransactions();
  } else if (alarm.name === 'inactivityCheck') {
    try {
      if (walletController.shouldLockForInactivity(LOCK_TIMEOUT_MS)) {
        walletController.lock();
        notifyAccountsChanged().catch((error) => {
          console.error('[QFC] Failed to emit accountsChanged:', error);
        });
      }
    } catch (error) {
      console.error('[QFC] Inactivity check failed:', error);
    }
  }
});

chrome.runtime.onStartup.addListener(() => {
  ensureInitialized();
});

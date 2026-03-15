/**
 * Hardware Wallet Integration — Ledger & Trezor
 *
 * Provides a unified interface for connecting to hardware wallets,
 * discovering accounts, and signing transactions/messages.
 *
 * NOTE: Hardware wallet interactions (WebHID/WebUSB) can only happen
 * in the popup window context, not in the background service worker.
 * The popup sends hardware-signed results back to the service worker.
 */

import { ethers } from 'ethers';
import type { WalletType } from '../types/wallet';

// Default HD paths
export const HD_PATHS = {
  ledger: "m/44'/60'/0'/0",    // Ledger Live
  ledgerLegacy: "m/44'/60'/0'", // Ledger Legacy (MEW)
  trezor: "m/44'/60'/0'/0",    // Trezor
} as const;

export interface HardwareAccount {
  address: string;
  hdPath: string;
  index: number;
  balance?: string;
}

export interface HardwareSignResult {
  signature: string;
  v: number;
  r: string;
  s: string;
}

// --- Ledger ---

/**
 * Connect to Ledger via WebHID and get accounts
 * @param basePath HD derivation base path
 * @param count Number of accounts to discover
 */
export async function ledgerGetAccounts(
  basePath: string = HD_PATHS.ledger,
  count: number = 5,
): Promise<HardwareAccount[]> {
  // Dynamic import to avoid bundling in service worker
  const TransportWebHID = (await import('@ledgerhq/hw-transport-webhid')).default;
  const Eth = (await import('@ledgerhq/hw-app-eth')).default;

  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);

  const accounts: HardwareAccount[] = [];

  for (let i = 0; i < count; i++) {
    const path = `${basePath}/${i}`;
    const result = await eth.getAddress(path);
    accounts.push({
      address: ethers.getAddress(result.address),
      hdPath: path,
      index: i,
    });
  }

  await transport.close();
  return accounts;
}

/**
 * Sign a transaction with Ledger
 */
export async function ledgerSignTransaction(
  hdPath: string,
  unsignedTx: string, // RLP-encoded unsigned transaction hex
): Promise<HardwareSignResult> {
  const TransportWebHID = (await import('@ledgerhq/hw-transport-webhid')).default;
  const Eth = (await import('@ledgerhq/hw-app-eth')).default;

  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);

  const result = await eth.signTransaction(hdPath, unsignedTx.replace('0x', ''));

  await transport.close();

  return {
    signature: `0x${result.r}${result.s}${result.v}`,
    v: parseInt(result.v, 16),
    r: `0x${result.r}`,
    s: `0x${result.s}`,
  };
}

/**
 * Sign a message with Ledger (EIP-191)
 */
export async function ledgerSignMessage(
  hdPath: string,
  message: string,
): Promise<string> {
  const TransportWebHID = (await import('@ledgerhq/hw-transport-webhid')).default;
  const Eth = (await import('@ledgerhq/hw-app-eth')).default;

  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);

  const msgHex = Buffer.from(message).toString('hex');
  const result = await eth.signPersonalMessage(hdPath, msgHex);

  await transport.close();

  const v = parseInt(result.v.toString(), 10);
  return ethers.Signature.from({
    r: `0x${result.r}`,
    s: `0x${result.s}`,
    v,
  }).serialized;
}

/**
 * Sign EIP-712 typed data with Ledger
 */
export async function ledgerSignTypedData(
  hdPath: string,
  typedData: string,
): Promise<string> {
  const TransportWebHID = (await import('@ledgerhq/hw-transport-webhid')).default;
  const Eth = (await import('@ledgerhq/hw-app-eth')).default;

  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);

  const { domain, types, message } = JSON.parse(typedData);
  delete types.EIP712Domain;

  // Compute the hash that will be signed
  const domainHash = ethers.TypedDataEncoder.hashDomain(domain);
  const valueHash = ethers.TypedDataEncoder.from(types).hash(message);

  const result = await eth.signEIP712HashedMessage(
    hdPath,
    domainHash.replace('0x', ''),
    valueHash.replace('0x', ''),
  );

  await transport.close();

  const v = parseInt(result.v.toString(), 10);
  return ethers.Signature.from({
    r: `0x${result.r}`,
    s: `0x${result.s}`,
    v,
  }).serialized;
}

// --- Trezor ---

/**
 * Connect to Trezor and get accounts
 */
export async function trezorGetAccounts(
  basePath: string = HD_PATHS.trezor,
  count: number = 5,
): Promise<HardwareAccount[]> {
  const TrezorConnect = (await import('@trezor/connect-web')).default;

  await TrezorConnect.init({
    manifest: {
      email: 'support@qfc.network',
      appUrl: 'https://wallet.qfc.network',
      appName: 'QFC Wallet',
    },
    lazyLoad: true,
  });

  const accounts: HardwareAccount[] = [];

  for (let i = 0; i < count; i++) {
    const path = `${basePath}/${i}`;
    const result = await TrezorConnect.ethereumGetAddress({
      path,
      showOnTrezor: false,
    });

    if (result.success) {
      accounts.push({
        address: ethers.getAddress(result.payload.address),
        hdPath: path,
        index: i,
      });
    }
  }

  return accounts;
}

/**
 * Sign a transaction with Trezor
 */
export async function trezorSignTransaction(
  hdPath: string,
  tx: ethers.TransactionLike,
): Promise<HardwareSignResult> {
  const TrezorConnect = (await import('@trezor/connect-web')).default;

  const result = await TrezorConnect.ethereumSignTransaction({
    path: hdPath,
    transaction: {
      to: tx.to as string,
      value: ethers.toBeHex(tx.value || 0),
      gasLimit: ethers.toBeHex(tx.gasLimit || 21000),
      gasPrice: ethers.toBeHex(tx.gasPrice || 0),
      nonce: ethers.toBeHex(tx.nonce || 0),
      data: (tx.data as string) || '0x',
      chainId: tx.chainId ? Number(tx.chainId) : 9000,
    },
  });

  if (!result.success) {
    throw new Error(`Trezor signing failed: ${result.payload.error}`);
  }

  return {
    signature: `${result.payload.r}${result.payload.s}${result.payload.v}`,
    v: parseInt(result.payload.v, 16),
    r: result.payload.r,
    s: result.payload.s,
  };
}

/**
 * Sign a message with Trezor
 */
export async function trezorSignMessage(
  hdPath: string,
  message: string,
): Promise<string> {
  const TrezorConnect = (await import('@trezor/connect-web')).default;

  const result = await TrezorConnect.ethereumSignMessage({
    path: hdPath,
    message,
  });

  if (!result.success) {
    throw new Error(`Trezor signing failed: ${result.payload.error}`);
  }

  return `0x${result.payload.signature}`;
}

// --- Unified interface ---

export function isHardwareWallet(type?: WalletType): boolean {
  return type === 'ledger' || type === 'trezor';
}

export async function getHardwareAccounts(
  type: 'ledger' | 'trezor',
  basePath?: string,
  count?: number,
): Promise<HardwareAccount[]> {
  if (type === 'ledger') {
    return ledgerGetAccounts(basePath || HD_PATHS.ledger, count);
  }
  return trezorGetAccounts(basePath || HD_PATHS.trezor, count);
}

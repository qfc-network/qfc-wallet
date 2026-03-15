import { useState } from 'react';
import { HD_PATHS, type HardwareAccount } from '../../utils/hardware';

type Step = 'select' | 'connecting' | 'accounts' | 'error';

export default function ConnectHardware({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('select');
  const [deviceType, setDeviceType] = useState<'ledger' | 'trezor'>('ledger');
  const [accounts, setAccounts] = useState<HardwareAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [hdPath, setHdPath] = useState<string>(HD_PATHS.ledger);

  const handleConnect = async () => {
    setStep('connecting');
    setError('');

    try {
      // Dynamic import to avoid bundling hardware libs unnecessarily
      const { getHardwareAccounts } = await import('../../utils/hardware');
      const discovered = await getHardwareAccounts(deviceType, hdPath, 5);
      setAccounts(discovered);
      setStep('accounts');
    } catch (err: any) {
      setError(err.message || 'Failed to connect to device');
      setStep('error');
    }
  };

  const handleImport = async () => {
    const selected = accounts.filter((_, i) => selectedAccounts.has(i));

    for (const account of selected) {
      // Send to background to add as hardware wallet
      await chrome.runtime.sendMessage({
        type: 'wallet_addHardwareAccount',
        data: {
          address: account.address,
          hdPath: account.hdPath,
          deviceType,
          name: `${deviceType === 'ledger' ? 'Ledger' : 'Trezor'} ${account.index + 1}`,
        },
      });
    }

    onClose();
  };

  const toggleAccount = (index: number) => {
    const next = new Set(selectedAccounts);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedAccounts(next);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Connect Hardware Wallet</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Step 1: Select device */}
        {step === 'select' && (
          <>
            <p className="text-sm text-gray-400">Select your hardware wallet device:</p>

            <div className="space-y-2">
              <button
                onClick={() => { setDeviceType('ledger'); setHdPath(HD_PATHS.ledger); }}
                className={`w-full flex items-center gap-3 rounded-xl border p-4 transition ${
                  deviceType === 'ledger'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg">
                  🔐
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Ledger</p>
                  <p className="text-xs text-gray-500">Nano S, Nano X, Nano S Plus</p>
                </div>
              </button>

              <button
                onClick={() => { setDeviceType('trezor'); setHdPath(HD_PATHS.trezor); }}
                className={`w-full flex items-center gap-3 rounded-xl border p-4 transition ${
                  deviceType === 'trezor'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center text-lg">
                  🛡️
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Trezor</p>
                  <p className="text-xs text-gray-500">Model One, Model T, Safe 3</p>
                </div>
              </button>
            </div>

            {/* HD Path selector */}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Derivation path</label>
              <select
                value={hdPath}
                onChange={(e) => setHdPath(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
              >
                <option value={HD_PATHS.ledger}>Ledger Live (m/44'/60'/0'/0)</option>
                <option value={HD_PATHS.ledgerLegacy}>Legacy MEW (m/44'/60'/0')</option>
              </select>
            </div>

            <div className="rounded-lg bg-gray-800/50 p-3 text-xs text-gray-500 space-y-1">
              <p>1. Connect your {deviceType === 'ledger' ? 'Ledger' : 'Trezor'} device</p>
              <p>2. {deviceType === 'ledger' ? 'Open the Ethereum app on the device' : 'Unlock your Trezor'}</p>
              <p>3. Click "Connect" below</p>
            </div>

            <button
              onClick={handleConnect}
              className="w-full rounded-lg bg-cyan-500 py-3 text-sm font-medium text-white hover:bg-cyan-400"
            >
              Connect
            </button>
          </>
        )}

        {/* Connecting animation */}
        {step === 'connecting' && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-4" />
            <p className="text-sm text-white">Connecting to {deviceType === 'ledger' ? 'Ledger' : 'Trezor'}...</p>
            <p className="text-xs text-gray-500 mt-1">
              {deviceType === 'ledger'
                ? 'Make sure Ethereum app is open on your device'
                : 'Follow the prompts on your Trezor'}
            </p>
          </div>
        )}

        {/* Step 2: Select accounts */}
        {step === 'accounts' && (
          <>
            <p className="text-sm text-gray-400">Select accounts to import:</p>

            <div className="space-y-2">
              {accounts.map((account, i) => (
                <button
                  key={account.address}
                  onClick={() => toggleAccount(i)}
                  className={`w-full flex items-center gap-3 rounded-xl border p-3 transition ${
                    selectedAccounts.has(i)
                      ? 'border-cyan-500 bg-cyan-500/10'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border ${
                    selectedAccounts.has(i)
                      ? 'bg-cyan-500 border-cyan-500'
                      : 'border-gray-600'
                  } flex items-center justify-center`}>
                    {selectedAccounts.has(i) && <span className="text-white text-xs">✓</span>}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-mono text-white truncate">{account.address}</p>
                    <p className="text-xs text-gray-500">{account.hdPath}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handleImport}
              disabled={selectedAccounts.size === 0}
              className="w-full rounded-lg bg-cyan-500 py-3 text-sm font-medium text-white hover:bg-cyan-400 disabled:opacity-50"
            >
              Import {selectedAccounts.size} Account{selectedAccounts.size !== 1 ? 's' : ''}
            </button>
          </>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-400">Connection Failed</p>
              <p className="text-xs text-red-300 mt-1">{error}</p>
            </div>

            <div className="rounded-lg bg-gray-800/50 p-3 text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-400">Troubleshooting:</p>
              <p>• Make sure the device is connected and unlocked</p>
              <p>• {deviceType === 'ledger' ? 'Open the Ethereum app on your Ledger' : 'Allow the browser connection on your Trezor'}</p>
              <p>• Try a different USB cable or port</p>
              <p>• Close other apps that might be using the device</p>
            </div>

            <button
              onClick={() => setStep('select')}
              className="w-full rounded-lg bg-gray-700 py-3 text-sm font-medium text-white hover:bg-gray-600"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

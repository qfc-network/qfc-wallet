import { useState } from 'react';
import { ChevronLeft, Trash2, ExternalLink } from 'lucide-react';
import { useWalletStore, sendMessage } from '../store';
import { formatAddress } from '../../utils/validation';

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const { wallets, currentAddress, network } = useWalletStore();
  const [connectedSites, setConnectedSites] = useState<Record<string, string[]>>({});
  const [showSites, setShowSites] = useState(false);

  const loadConnectedSites = async () => {
    try {
      const sites = await sendMessage<Record<string, string[]>>('wallet_getConnectedSites');
      setConnectedSites(sites);
      setShowSites(true);
    } catch (error) {
      console.error('Failed to load connected sites:', error);
    }
  };

  const disconnectSite = async (origin: string) => {
    try {
      await sendMessage('wallet_disconnectSite', [origin]);
      const newSites = { ...connectedSites };
      delete newSites[origin];
      setConnectedSites(newSites);
    } catch (error) {
      console.error('Failed to disconnect site:', error);
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/50 rounded-lg"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Account Info */}
        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Account</h2>
          <div className="space-y-2">
            {wallets.map((wallet) => (
              <div
                key={wallet.address}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  wallet.address === currentAddress ? 'bg-qfc-50 border border-qfc-200' : 'bg-gray-50'
                }`}
              >
                <div>
                  <div className="font-medium">{wallet.name}</div>
                  <div className="text-sm text-gray-500 font-mono">
                    {formatAddress(wallet.address, 8)}
                  </div>
                </div>
                {wallet.address === currentAddress && (
                  <span className="text-xs bg-qfc-100 text-qfc-700 px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Network Info */}
        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold text-gray-800 mb-3">Network</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Network</span>
              <span className="font-medium">{network.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Chain ID</span>
              <span className="font-mono">{network.chainId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">RPC URL</span>
              <span className="font-mono text-xs">{network.rpcUrl}</span>
            </div>
            <a
              href={network.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-qfc-600 hover:underline"
            >
              <span>Block Explorer</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Connected Sites */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Connected Sites</h2>
            {!showSites && (
              <button
                onClick={loadConnectedSites}
                className="text-sm text-qfc-600 hover:underline"
              >
                View
              </button>
            )}
          </div>

          {showSites && (
            <div className="space-y-2">
              {Object.keys(connectedSites).length === 0 ? (
                <p className="text-sm text-gray-500">No connected sites</p>
              ) : (
                Object.entries(connectedSites).map(([origin, addresses]) => (
                  <div
                    key={origin}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-sm">{new URL(origin).hostname}</div>
                      <div className="text-xs text-gray-500">
                        {addresses.length} account{addresses.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => disconnectSite(origin)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title="Disconnect"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* About */}
        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold text-gray-800 mb-3">About</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Version</span>
              <span>1.0.0</span>
            </div>
            <a
              href="https://qfc.network"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-qfc-600 hover:underline"
            >
              <span>QFC Network</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

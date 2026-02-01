import { useState } from 'react';
import { ChevronLeft, AlertCircle, Check } from 'lucide-react';
import { walletActions } from '../store';
import { isValidAddress } from '../../utils/validation';

interface AddTokenProps {
  onBack: () => void;
}

export default function AddToken({ onBack }: AddTokenProps) {
  const [tokenAddress, setTokenAddress] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ name: string; symbol: string; decimals: number } | null>(null);

  const handleAddToken = async () => {
    setError('');

    if (!isValidAddress(tokenAddress)) {
      setError('Invalid token address');
      return;
    }

    setIsLoading(true);
    try {
      const token = await walletActions.addToken(tokenAddress);
      if (token) {
        setTokenInfo(token);
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add token');
    } finally {
      setIsLoading(false);
    }
  };

  if (success && tokenInfo) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <Check size={32} className="text-green-500" />
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">Token Added</h2>
          <p className="text-gray-500 text-center mb-6">
            {tokenInfo.name} ({tokenInfo.symbol}) has been added to your wallet
          </p>

          <button
            onClick={onBack}
            className="w-full max-w-sm py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

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
        <h1 className="text-lg font-bold">Add Token</h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        <div className="bg-white rounded-xl p-4">
          <p className="text-sm text-gray-600 mb-4">
            Enter the contract address of the ERC-20 token you want to add.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Token Contract Address
            </label>
            <input
              type="text"
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Only add tokens you trust. Adding a malicious token contract could put your funds at risk.
          </p>
        </div>
      </div>

      {/* Add Button */}
      <div className="p-4">
        <button
          onClick={handleAddToken}
          disabled={isLoading || !tokenAddress}
          className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? 'Adding...' : 'Add Token'}
        </button>
      </div>
    </div>
  );
}

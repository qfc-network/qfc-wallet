import { useState } from 'react';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { useWalletStore, sendMessage } from '../store';
import { isValidAddress } from '../../utils/validation';
import type { Token } from '../../types/token';

interface SendTokenProps {
  token: Token;
  onBack: () => void;
}

export default function SendToken({ token, onBack }: SendTokenProps) {
  const { currentAddress } = useWalletStore();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState('');

  const tokenBalance = parseFloat(token.balance || '0');

  const handleSend = async () => {
    setError('');

    if (!isValidAddress(recipient)) {
      setError('Invalid recipient address');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount');
      return;
    }

    if (amountNum > tokenBalance) {
      setError('Insufficient token balance');
      return;
    }

    setIsLoading(true);
    try {
      const hash = await sendMessage<string>('wallet_sendToken', [
        currentAddress,
        token.address,
        recipient,
        amount,
        token.decimals,
      ]);

      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setIsLoading(false);
    }
  };

  const setMaxAmount = () => {
    setAmount(tokenBalance.toString());
  };

  if (txHash) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg
              className="w-8 h-8 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Transaction Sent!
          </h2>
          <p className="text-gray-500 text-center mb-4">
            Your {token.symbol} transfer has been submitted
          </p>

          <div className="bg-white rounded-xl p-4 w-full max-w-sm mb-6">
            <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
            <p className="text-sm font-mono break-all">{txHash}</p>
          </div>

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
        <h1 className="text-lg font-bold">Send {token.symbol}</h1>
      </div>

      {/* Token Info */}
      <div className="px-4 pb-2">
        <div className="bg-white rounded-xl p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-qfc-500 to-blue-500 flex items-center justify-center text-white font-bold">
            {token.symbol.slice(0, 2)}
          </div>
          <div>
            <div className="font-medium">{token.name}</div>
            <div className="text-sm text-gray-500">
              Balance: {tokenBalance.toFixed(4)} {token.symbol}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recipient Address
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              step="any"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl pr-20 focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
            />
            <button
              onClick={setMaxAmount}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-qfc-600 text-sm font-medium"
            >
              MAX
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Available: {tokenBalance.toFixed(4)} {token.symbol}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Transaction Summary */}
        {recipient && amount && parseFloat(amount) > 0 && (
          <div className="bg-white rounded-xl p-4 space-y-2">
            <h3 className="font-medium text-gray-800">Transaction Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Amount</span>
              <span>{amount} {token.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Network Fee (est.)</span>
              <span>~0.002 QFC</span>
            </div>
          </div>
        )}
      </div>

      {/* Send Button */}
      <div className="p-4">
        <button
          onClick={handleSend}
          disabled={isLoading || !recipient || !amount}
          className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : `Send ${token.symbol}`}
        </button>
      </div>
    </div>
  );
}

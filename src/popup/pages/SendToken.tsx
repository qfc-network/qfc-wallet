import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { useWalletStore, sendMessage } from '../store';
import { isValidAddress } from '../../utils/validation';
import type { Token } from '../../types/token';
import { ERC20_ABI } from '../../types/token';
import { ethers } from 'ethers';
import { useTranslation } from '../../i18n';

interface SendTokenProps {
  token: Token;
  onBack: () => void;
}

export default function SendToken({ token, onBack }: SendTokenProps) {
  const { currentAddress } = useWalletStore();
  const t = useTranslation();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimatedGasLimit, setEstimatedGasLimit] = useState<bigint | null>(null);
  const [estimatedGasPriceWei, setEstimatedGasPriceWei] = useState<bigint | null>(null);
  const [showFeeOptions, setShowFeeOptions] = useState(false);
  const [customGasLimit, setCustomGasLimit] = useState('');
  const [customGasPrice, setCustomGasPrice] = useState('');

  const tokenBalance = parseFloat(token.balance || '0');
  const amountNum = useMemo(() => parseFloat(amount), [amount]);
  const amountValid = !isNaN(amountNum) && amountNum > 0;
  const recipientValid = isValidAddress(recipient);

  const parseGasLimit = (value: string): bigint | null => {
    if (!value.trim()) return null;
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  };

  const parseGasPriceWei = (value: string): bigint | null => {
    if (!value.trim()) return null;
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return null;
    return BigInt(Math.floor(num * 1e9));
  };

  const gasLimit = parseGasLimit(customGasLimit) ?? estimatedGasLimit;
  const gasPriceWei = parseGasPriceWei(customGasPrice) ?? estimatedGasPriceWei;

  const feeQfc = useMemo(() => {
    if (!gasLimit || !gasPriceWei) return null;
    const feeWei = gasLimit * gasPriceWei;
    const fee = Number(feeWei) / 1e18;
    return fee.toFixed(6);
  }, [gasLimit, gasPriceWei]);

  const gasPriceGwei = useMemo(() => {
    if (!gasPriceWei) return null;
    return (Number(gasPriceWei) / 1e9).toFixed(2);
  }, [gasPriceWei]);

  useEffect(() => {
    if (!recipientValid || !amountValid || !currentAddress) {
      setEstimatedGasLimit(null);
      return;
    }

    const estimate = async () => {
      setIsEstimating(true);
      try {
        const amountWei = ethers.parseUnits(amount, token.decimals);
        const iface = new ethers.Interface(ERC20_ABI);
        const data = iface.encodeFunctionData('transfer', [recipient, amountWei]);
        const [gasLimitHex, gasPriceHex] = await Promise.all([
          sendMessage<string>('eth_estimateGas', [
            { from: currentAddress, to: token.address, data },
          ]),
          sendMessage<string>('eth_gasPrice'),
        ]);

        setEstimatedGasLimit(BigInt(gasLimitHex));
        setEstimatedGasPriceWei(BigInt(gasPriceHex));
      } catch (err) {
        console.error('Failed to estimate gas:', err);
      } finally {
        setIsEstimating(false);
      }
    };

    estimate();
  }, [recipientValid, amountValid, amount, recipient, currentAddress, token.address, token.decimals]);

  const handleSend = async () => {
    setError('');

    if (!isValidAddress(recipient)) {
      setError(t.send.invalidAddress);
      return;
    }

    if (!amountValid) {
      setError(t.send.invalidAmount);
      return;
    }

    if (amountNum > tokenBalance) {
      setError(t.send.insufficientBalance);
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
        gasLimit ? '0x' + gasLimit.toString(16) : null,
        gasPriceWei ? '0x' + gasPriceWei.toString(16) : null,
      ]);

      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
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
            {t.send.transactionSent}
          </h2>
          <p className="text-gray-500 text-center mb-4">
            {t.common.success}
          </p>

          <div className="bg-white rounded-xl p-4 w-full max-w-sm mb-6">
            <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
            <p className="text-sm font-mono break-all">{txHash}</p>
          </div>

          <button
            onClick={onBack}
            className="w-full max-w-sm py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl"
          >
            {t.common.confirm}
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
        <h1 className="text-lg font-bold">{t.common.send} {token.symbol}</h1>
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
              {t.common.balance}: {tokenBalance.toFixed(4)} {token.symbol}
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t.send.recipient}
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
            {t.send.amount}
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            placeholder={t.send.amountPlaceholder}
            step="any"
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl pr-20 focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
          />
          <button
            onClick={setMaxAmount}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-qfc-600 text-sm font-medium"
          >
            {t.send.max}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {t.common.balance}: {tokenBalance.toFixed(4)} {token.symbol}
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
            <h3 className="font-medium text-gray-800">{t.common.send} {token.symbol}</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.send.amount}</span>
              <span>{amount} {token.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.send.networkFee}</span>
              <span>{feeQfc ? `~${feeQfc} QFC` : isEstimating ? t.common.loading : '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.send.gasPrice}</span>
              <span>{gasPriceGwei ? `${gasPriceGwei} Gwei` : '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.send.gasLimit}</span>
              <span>{gasLimit ? gasLimit.toString() : '-'}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl p-4 space-y-3">
          <button
            onClick={() => setShowFeeOptions(!showFeeOptions)}
            className="text-sm text-qfc-600 hover:underline"
          >
            {t.send.customizeFee}
          </button>
          {showFeeOptions && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.send.gasPrice}
                </label>
                <input
                  type="number"
                  value={customGasPrice}
                  onChange={(e) => setCustomGasPrice(e.target.value)}
                  placeholder={estimatedGasPriceWei ? (Number(estimatedGasPriceWei) / 1e9).toFixed(2) : '0'}
                  step="0.1"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t.send.gasLimit}
                </label>
                <input
                  type="number"
                  value={customGasLimit}
                  onChange={(e) => setCustomGasLimit(e.target.value)}
                  placeholder={estimatedGasLimit ? estimatedGasLimit.toString() : '65000'}
                  step="1"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Send Button */}
      <div className="p-4">
        <button
          onClick={handleSend}
          disabled={isLoading || !recipient || !amount}
          className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? t.send.sending : t.send.sendButton}
        </button>
      </div>
    </div>
  );
}

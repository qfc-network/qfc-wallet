import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { useWalletStore, sendMessage } from '../store';
import { isValidAddress } from '../../utils/validation';
import { useTranslation } from '../../i18n';

interface SendProps {
  onBack: () => void;
}

export default function Send({ onBack }: SendProps) {
  const { currentAddress, balance } = useWalletStore();
  const t = useTranslation();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimatedGasLimit, setEstimatedGasLimit] = useState<bigint | null>(null);
  const [estimatedGasPriceWei, setEstimatedGasPriceWei] = useState<bigint | null>(null);
  const [estimatedNonce, setEstimatedNonce] = useState<number | null>(null);
  const [showFeeOptions, setShowFeeOptions] = useState(false);
  const [customGasLimit, setCustomGasLimit] = useState('');
  const [customGasPrice, setCustomGasPrice] = useState('');

  const amountNum = useMemo(() => parseFloat(amount), [amount]);
  const amountValid = !isNaN(amountNum) && amountNum > 0;
  const recipientValid = isValidAddress(recipient);

  useEffect(() => {
    if (!recipientValid || !amountValid || !currentAddress) {
      setEstimatedGasLimit(null);
      setEstimatedNonce(null);
      return;
    }

    const estimate = async () => {
      setIsEstimating(true);
      try {
        const valueWei = BigInt(Math.floor(amountNum * 1e18));
        const [gasLimitHex, gasPriceHex, nonceHex] = await Promise.all([
          sendMessage<string>('eth_estimateGas', [
            { from: currentAddress, to: recipient, value: '0x' + valueWei.toString(16) },
          ]),
          sendMessage<string>('eth_gasPrice'),
          sendMessage<string>('eth_getTransactionCount', [currentAddress, 'latest']),
        ]);

        setEstimatedGasLimit(BigInt(gasLimitHex));
        setEstimatedGasPriceWei(BigInt(gasPriceHex));
        setEstimatedNonce(Number(BigInt(nonceHex)));
      } catch (err) {
        console.error('Failed to estimate gas:', err);
      } finally {
        setIsEstimating(false);
      }
    };

    estimate();
  }, [recipientValid, amountValid, amountNum, recipient, currentAddress]);

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

  const handleSend = async () => {
    setError('');

    // Validate recipient
    if (!isValidAddress(recipient)) {
      setError(t.send.invalidAddress);
      return;
    }

    // Validate amount
    if (!amountValid) {
      setError(t.send.invalidAmount);
      return;
    }

    if (amountNum > parseFloat(balance)) {
      setError(t.send.insufficientBalance);
      return;
    }

    setIsLoading(true);
    try {
      if (!currentAddress) {
        setError(t.common.error);
        return;
      }
      // Convert amount to wei
      const valueWei = BigInt(Math.floor(amountNum * 1e18));
      const tx: Record<string, string> = {
        from: currentAddress || '',
        to: recipient,
        value: '0x' + valueWei.toString(16),
      };

      if (gasLimit) {
        tx.gas = '0x' + gasLimit.toString(16);
      }
      if (gasPriceWei) {
        tx.gasPrice = '0x' + gasPriceWei.toString(16);
      }

      const hash = await sendMessage<string>('eth_sendTransaction', [
        tx,
      ]);

      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setIsLoading(false);
    }
  };

  const setMaxAmount = () => {
    // Leave some for gas (0.01 QFC)
    const max = Math.max(0, parseFloat(balance) - 0.01);
    setAmount(max.toFixed(4));
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
        <h1 className="text-lg font-bold">{t.send.title}</h1>
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
            placeholder={t.send.recipientPlaceholder}
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
              step="0.0001"
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
            {t.common.balance}: {balance} QFC
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
            <h3 className="font-medium text-gray-800">{t.send.title}</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.send.amount}</span>
              <span>{amount} QFC</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.send.from}</span>
              <span className="font-mono">{currentAddress ? `${currentAddress.slice(0, 10)}...` : '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.send.to}</span>
              <span className="font-mono">{recipient ? `${recipient.slice(0, 10)}...` : '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.send.nonce}</span>
              <span>{estimatedNonce !== null ? estimatedNonce : '-'}</span>
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
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>{t.send.total}</span>
              <span>{feeQfc ? (parseFloat(amount) + parseFloat(feeQfc)).toFixed(4) : `${amount} QFC`}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl p-4 space-y-3">
          {/* Gas Presets */}
          {estimatedGasPriceWei !== null && estimatedGasPriceWei > 0n && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t.send.gasSpeed || 'Transaction Speed'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t.send.gasSlow || 'Slow', multiplier: 0.8 },
                  { label: t.send.gasStandard || 'Standard', multiplier: 1.0 },
                  { label: t.send.gasFast || 'Fast', multiplier: 1.5 },
                ].map(({ label, multiplier }) => {
                  const presetWei = BigInt(Math.floor(Number(estimatedGasPriceWei) * multiplier));
                  const presetGwei = (Number(presetWei) / 1e9).toFixed(2);
                  const isSelected = !customGasPrice && multiplier === 1.0 ||
                    customGasPrice && BigInt(Math.floor(parseFloat(customGasPrice) * 1e9)) === presetWei;
                  return (
                    <button
                      key={label}
                      onClick={() => {
                        if (multiplier === 1.0) {
                          setCustomGasPrice('');
                        } else {
                          setCustomGasPrice((Number(presetWei) / 1e9).toFixed(2));
                        }
                      }}
                      className={`p-2 rounded-lg border text-center transition-colors ${
                        isSelected
                          ? 'border-qfc-500 bg-qfc-50 text-qfc-700'
                          : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <div className="text-xs font-medium">{label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{presetGwei} Gwei</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                  placeholder={estimatedGasLimit ? estimatedGasLimit.toString() : '21000'}
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

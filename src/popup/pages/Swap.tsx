import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronDown, ArrowDownUp, AlertCircle, Settings } from 'lucide-react';
import { useWalletStore, sendMessage } from '../store';
import { useTranslation } from '../../i18n';
import type { Token } from '../../types/token';

interface SwapProps {
  onBack: () => void;
}

interface SwapToken {
  address: string; // empty string for native QFC
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  isNative: boolean;
}

const SLIPPAGE_OPTIONS = [0.5, 1, 3];

export default function Swap({ onBack }: SwapProps) {
  const { currentAddress, balance, tokens } = useWalletStore();
  const t = useTranslation();

  const [fromToken, setFromToken] = useState<SwapToken | null>(null);
  const [toToken, setToToken] = useState<SwapToken | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [showSlippage, setShowSlippage] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [isQuoting, setIsQuoting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [priceImpact, setPriceImpact] = useState<string | null>(null);
  const [minimumReceived, setMinimumReceived] = useState<string | null>(null);

  // Build available tokens list
  const availableTokens: SwapToken[] = useMemo(() => {
    const native: SwapToken = {
      address: '',
      symbol: 'QFC',
      name: t.swap.nativeToken,
      decimals: 18,
      balance: balance,
      isNative: true,
    };

    const erc20Tokens: SwapToken[] = tokens.map((token: Token) => ({
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      balance: token.balance || '0',
      isNative: false,
    }));

    return [native, ...erc20Tokens];
  }, [balance, tokens, t.swap.nativeToken]);

  // Set default from token
  useEffect(() => {
    if (!fromToken && availableTokens.length > 0) {
      setFromToken(availableTokens[0]);
    }
  }, [availableTokens, fromToken]);

  const fromAmountNum = useMemo(() => parseFloat(fromAmount), [fromAmount]);
  const fromAmountValid = !isNaN(fromAmountNum) && fromAmountNum > 0;

  const canGetQuote = fromToken && toToken && fromAmountValid &&
    fromToken.address !== toToken.address &&
    !(fromToken.isNative && toToken.isNative);

  const handleGetQuote = async () => {
    if (!canGetQuote || !currentAddress) return;

    setIsQuoting(true);
    setError('');
    setToAmount('');
    setPriceImpact(null);
    setMinimumReceived(null);

    try {
      const result = await sendMessage<{
        amountOut: string;
        priceImpact: string;
        minimumReceived: string;
      }>('wallet_getSwapQuote', [
        fromToken!.isNative ? 'native' : fromToken!.address,
        toToken!.isNative ? 'native' : toToken!.address,
        fromAmount,
        fromToken!.decimals,
        toToken!.decimals,
        slippage,
      ]);

      setToAmount(result.amountOut);
      setPriceImpact(result.priceImpact);
      setMinimumReceived(result.minimumReceived);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.swap.noLiquidity);
    } finally {
      setIsQuoting(false);
    }
  };

  const handleSwap = async () => {
    if (!fromToken || !toToken || !currentAddress || !fromAmountValid || !toAmount) return;

    // Validate balance
    if (fromAmountNum > parseFloat(fromToken.balance)) {
      setError(t.swap.insufficientBalance);
      return;
    }

    setIsSwapping(true);
    setError('');

    try {
      const hash = await sendMessage<string>('wallet_swap', [
        fromToken.isNative ? 'native' : fromToken.address,
        toToken.isNative ? 'native' : toToken.address,
        fromAmount,
        fromToken.decimals,
        toToken.decimals,
        slippage,
        currentAddress,
      ]);

      setTxHash(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleApprove = async () => {
    if (!fromToken || fromToken.isNative || !currentAddress) return;

    setIsApproving(true);
    setError('');

    try {
      await sendMessage<string>('wallet_swap', [
        fromToken.address,
        toToken!.isNative ? 'native' : toToken!.address,
        fromAmount,
        fromToken.decimals,
        toToken!.decimals,
        slippage,
        currentAddress,
        true, // approveOnly flag
      ]);

      // After approval, get a fresh quote
      await handleGetQuote();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleFlipTokens = () => {
    const prevFrom = fromToken;
    const prevTo = toToken;
    setFromToken(prevTo);
    setToToken(prevFrom);
    setFromAmount(toAmount);
    setToAmount('');
    setPriceImpact(null);
    setMinimumReceived(null);
  };

  const setMaxAmount = () => {
    if (!fromToken) return;
    if (fromToken.isNative) {
      const max = Math.max(0, parseFloat(fromToken.balance) - 0.01);
      setFromAmount(max.toFixed(4));
    } else {
      setFromAmount(fromToken.balance);
    }
  };

  const isSameToken = fromToken && toToken &&
    ((fromToken.isNative && toToken.isNative) ||
     (!fromToken.isNative && !toToken.isNative && fromToken.address.toLowerCase() === toToken.address.toLowerCase()));

  const getButtonState = () => {
    if (!fromToken || !toToken) return { disabled: true, label: t.swap.selectTokens };
    if (isSameToken) return { disabled: true, label: t.swap.sameToken };
    if (!fromAmountValid) return { disabled: true, label: t.swap.enterAmount };
    if (fromAmountNum > parseFloat(fromToken.balance)) return { disabled: true, label: t.swap.insufficientBalance };
    if (!toAmount) return { disabled: false, label: t.swap.getQuote, action: 'quote' as const };
    if (isSwapping) return { disabled: true, label: t.swap.swapping };
    return { disabled: false, label: t.swap.swapButton, action: 'swap' as const };
  };

  const buttonState = getButtonState();

  // Success view
  if (txHash) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">{t.swap.swapSuccess}</h2>
          <p className="text-gray-500 text-center mb-4">{t.common.success}</p>

          <div className="bg-white rounded-xl p-4 w-full max-w-sm mb-4">
            <div className="text-center mb-3">
              <span className="text-lg font-semibold">{fromAmount} {fromToken?.symbol}</span>
              <span className="text-gray-400 mx-2">→</span>
              <span className="text-lg font-semibold">{toAmount} {toToken?.symbol}</span>
            </div>
            <p className="text-xs text-gray-500 mb-1">{t.swap.txHash}</p>
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
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/50 rounded-lg">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">{t.swap.title}</h1>
        </div>
        <button
          onClick={() => setShowSlippage(!showSlippage)}
          className="p-2 hover:bg-white/50 rounded-lg"
          title={t.swap.slippageTolerance}
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Slippage Settings */}
      {showSlippage && (
        <div className="mx-4 mb-3 bg-white rounded-xl p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">{t.swap.slippageTolerance}</p>
          <div className="flex gap-2">
            {SLIPPAGE_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setSlippage(opt)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  slippage === opt
                    ? 'bg-qfc-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Swap Form */}
      <div className="flex-1 p-4 space-y-2">
        {/* From Token */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">{t.swap.from}</span>
            <span className="text-xs text-gray-400">
              {t.swap.balance}: {fromToken?.balance || '0'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={fromAmount}
              onChange={(e) => {
                setFromAmount(e.target.value);
                setToAmount('');
                setPriceImpact(null);
                setMinimumReceived(null);
              }}
              placeholder={t.swap.amountPlaceholder}
              step="0.0001"
              className="flex-1 text-2xl font-semibold bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={setMaxAmount}
                className="text-xs text-qfc-600 font-medium px-2 py-1 bg-qfc-50 rounded-lg hover:bg-qfc-100"
              >
                {t.swap.max}
              </button>
              <button
                onClick={() => setShowFromPicker(true)}
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-2 transition-colors"
              >
                <TokenBadge token={fromToken} />
                <ChevronDown size={16} className="text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Flip Button */}
        <div className="flex justify-center -my-1 z-10 relative">
          <button
            onClick={handleFlipTokens}
            className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center hover:bg-gray-50 shadow-sm transition-colors"
          >
            <ArrowDownUp size={18} className="text-qfc-500" />
          </button>
        </div>

        {/* To Token */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">{t.swap.to}</span>
            <span className="text-xs text-gray-400">
              {t.swap.balance}: {toToken?.balance || '0'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-2xl font-semibold text-gray-400">
              {isQuoting ? (
                <span className="text-sm">{t.swap.gettingQuote}</span>
              ) : (
                toAmount || t.swap.amountPlaceholder
              )}
            </div>
            <button
              onClick={() => setShowToPicker(true)}
              className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-2 transition-colors"
            >
              <TokenBadge token={toToken} />
              <ChevronDown size={16} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Quote Details */}
        {toAmount && priceImpact !== null && minimumReceived !== null && (
          <div className="bg-white rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.swap.estimatedOutput}</span>
              <span>{toAmount} {toToken?.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.swap.priceImpact}</span>
              <span className={parseFloat(priceImpact) > 5 ? 'text-red-500' : 'text-gray-700'}>
                {priceImpact}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.swap.minimumReceived}</span>
              <span>{minimumReceived} {toToken?.symbol}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.swap.slippage}</span>
              <span>{slippage}%</span>
            </div>
            {fromToken && toToken && fromAmountNum > 0 && parseFloat(toAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t.swap.rate}</span>
                <span>1 {fromToken.symbol} = {(parseFloat(toAmount) / fromAmountNum).toFixed(6)} {toToken.symbol}</span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="p-4 space-y-2">
        {/* Approve button (only for ERC-20 from token when we have a quote) */}
        {fromToken && !fromToken.isNative && toAmount && !isApproving && (
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {isApproving ? t.swap.approving : t.swap.approveRequired} {fromToken.symbol}
          </button>
        )}
        <button
          onClick={() => {
            if (buttonState.action === 'quote') {
              handleGetQuote();
            } else if (buttonState.action === 'swap') {
              handleSwap();
            }
          }}
          disabled={buttonState.disabled || isQuoting || isApproving}
          className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isQuoting ? t.swap.gettingQuote : buttonState.label}
        </button>
      </div>

      {/* Token Pickers */}
      {showFromPicker && (
        <TokenPicker
          tokens={availableTokens}
          selectedToken={fromToken}
          excludeToken={toToken}
          onSelect={(token) => {
            setFromToken(token);
            setShowFromPicker(false);
            setToAmount('');
            setPriceImpact(null);
            setMinimumReceived(null);
          }}
          onClose={() => setShowFromPicker(false)}
          t={t}
        />
      )}
      {showToPicker && (
        <TokenPicker
          tokens={availableTokens}
          selectedToken={toToken}
          excludeToken={fromToken}
          onSelect={(token) => {
            setToToken(token);
            setShowToPicker(false);
            setToAmount('');
            setPriceImpact(null);
            setMinimumReceived(null);
          }}
          onClose={() => setShowToPicker(false)}
          t={t}
        />
      )}
    </div>
  );
}

function TokenBadge({ token }: { token: SwapToken | null }) {
  if (!token) {
    return <span className="text-sm text-gray-500">Select</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
        token.isNative ? 'bg-gradient-to-br from-qfc-400 to-blue-400' : 'bg-gradient-to-br from-green-400 to-emerald-500'
      }`}>
        {token.symbol.charAt(0)}
      </div>
      <span className="text-sm font-medium">{token.symbol}</span>
    </div>
  );
}

function TokenPicker({
  tokens,
  selectedToken,
  excludeToken,
  onSelect,
  onClose,
  t,
}: {
  tokens: SwapToken[];
  selectedToken: SwapToken | null;
  excludeToken: SwapToken | null;
  onSelect: (token: SwapToken) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslation>;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="w-full max-w-md bg-white rounded-t-2xl p-4 max-h-[60%] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">{t.swap.selectToken}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            x
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {tokens.map((token) => {
            const isSelected = selectedToken &&
              ((token.isNative && selectedToken.isNative) ||
               (!token.isNative && !selectedToken.isNative && token.address.toLowerCase() === selectedToken.address.toLowerCase()));
            const isExcluded = excludeToken &&
              ((token.isNative && excludeToken.isNative) ||
               (!token.isNative && !excludeToken.isNative && token.address.toLowerCase() === excludeToken.address.toLowerCase()));

            return (
              <button
                key={token.isNative ? 'native' : token.address}
                onClick={() => onSelect(token)}
                disabled={!!isExcluded}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                  isSelected ? 'bg-qfc-50 border border-qfc-200' :
                  isExcluded ? 'opacity-40 cursor-not-allowed' :
                  'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    token.isNative ? 'bg-gradient-to-br from-qfc-400 to-blue-400' : 'bg-gradient-to-br from-green-400 to-emerald-500'
                  }`}>
                    {token.symbol.charAt(0)}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{token.symbol}</div>
                    <div className="text-xs text-gray-500">{token.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{token.balance}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

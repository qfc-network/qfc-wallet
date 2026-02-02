import { useState, useEffect } from 'react';
import { Copy, Send as SendIcon, ArrowDownToLine, Lock, RefreshCw, ChevronDown, Plus, ExternalLink, User } from 'lucide-react';
import { useWalletStore, walletActions } from '../store';
import { formatAddress } from '../../utils/validation';
import { NetworkKey, TOKEN_LOGOS } from '../../utils/constants';
import { calculateUsdValue, refreshPrices } from '../../utils/prices';
import { useTranslation } from '../../i18n';
import SendPage from './Send';
import SendToken from './SendToken';
import Receive from './Receive';
import Settings from './Settings';
import AddToken from './AddToken';
import ApprovalDialog from '../components/ApprovalDialog';
import CreateAccountDialog from '../components/CreateAccountDialog';
import AddDerivedAccountDialog from '../components/AddDerivedAccountDialog';
import type { Token } from '../../types/token';

type Tab = 'assets' | 'activity';
type View = 'home' | 'send' | 'receive' | 'settings' | 'addToken' | 'sendToken';

export default function Home() {
  const { currentAddress, balance, network, networkKey, tokens, transactions, pendingApproval, wallets, networks } = useWalletStore();
  const t = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('assets');
  const [view, setView] = useState<View>('home');
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [showAddDerivedAccount, setShowAddDerivedAccount] = useState(false);
  const [, setPriceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      walletActions.refreshBalance();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const symbols = ['QFC', ...tokens.map((token) => token.symbol)];
    let mounted = true;

    const load = async () => {
      try {
        await refreshPrices(symbols);
        if (mounted) setPriceTick((v) => v + 1);
      } catch {
        // ignore price fetch errors
      }
    };

    load();
    const interval = setInterval(load, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [tokens]);

  const copyAddress = async () => {
    if (currentAddress) {
      await navigator.clipboard.writeText(currentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await walletActions.refreshBalance();
    await walletActions.loadTransactions();
    await walletActions.refreshTokenBalances();
    setRefreshing(false);
  };

  const handleLock = () => {
    walletActions.lock();
  };

  const handleNetworkSwitch = async (key: NetworkKey) => {
    await walletActions.switchNetwork(key);
    setShowNetworkMenu(false);
  };

  // USD value from price utility
  const usdValue = calculateUsdValue('QFC', balance);

  // Show pending approval dialog
  if (pendingApproval) {
    return <ApprovalDialog />;
  }

  if (view === 'send') {
    return <SendPage onBack={() => setView('home')} />;
  }

  if (view === 'receive') {
    return <Receive onBack={() => setView('home')} />;
  }

  if (view === 'settings') {
    return <Settings onBack={() => setView('home')} />;
  }

  if (view === 'addToken') {
    return <AddToken onBack={() => setView('home')} />;
  }

  if (view === 'sendToken' && selectedToken) {
    return (
      <SendToken
        token={selectedToken}
        onBack={() => {
          setView('home');
          setSelectedToken(null);
        }}
      />
    );
  }

  const handleSendToken = (token: Token) => {
    setSelectedToken(token);
    setView('sendToken');
  };

  const currentWallet = wallets.find((wallet) => wallet.address === currentAddress);

  return (
    <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
      <CreateAccountDialog
        open={showCreateAccount}
        onClose={() => setShowCreateAccount(false)}
      />
      <AddDerivedAccountDialog
        open={showAddDerivedAccount}
        onClose={() => setShowAddDerivedAccount(false)}
      />
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-qfc-500 to-blue-500" />
          <span className="font-bold text-lg">QFC {t.common.wallet}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/50 text-sm"
              title={currentWallet?.name || t.settings.account}
            >
              <User size={16} />
              <span className="max-w-[80px] truncate">{currentWallet?.name || formatAddress(currentAddress || '', 4)}</span>
              <ChevronDown size={14} />
            </button>
            {showAccountMenu && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10">
                {wallets.map((wallet) => {
                  const isActive = wallet.address === currentAddress;
                  return (
                    <button
                      key={wallet.address}
                      onClick={() => {
                        if (!isActive) {
                          walletActions.switchAccount(wallet.address);
                        }
                        setShowAccountMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-50 ${
                        isActive ? 'text-qfc-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{wallet.name}</div>
                        <div className="text-xs text-gray-500">{formatAddress(wallet.address, 6)}</div>
                      </div>
                      {isActive && (
                        <span className="text-[10px] bg-qfc-100 text-qfc-700 px-2 py-0.5 rounded-full">
                          {t.common.active}
                        </span>
                      )}
                    </button>
                  );
                })}
                <div className="border-t my-1" />
                <button
                  onClick={() => {
                    setShowAccountMenu(false);
                    setShowCreateAccount(true);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-qfc-600 hover:bg-qfc-50"
                >
                  {t.createWallet.createNew}
                </button>
                <button
                  onClick={() => {
                    setShowAccountMenu(false);
                    setShowAddDerivedAccount(true);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-qfc-600 hover:bg-qfc-50"
                >
                  {t.settings.addDerivedAccount}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-white/50 rounded-lg"
            title={t.common.refresh}
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleLock}
            className="p-2 hover:bg-white/50 rounded-lg"
            title={t.common.lock}
          >
            <Lock size={18} />
          </button>
        </div>
      </div>

      {/* Network Selector */}
      <div className="px-4 mb-2 relative">
        <button
          onClick={() => setShowNetworkMenu(!showNetworkMenu)}
          className="flex items-center gap-1 text-xs bg-qfc-100 text-qfc-700 px-3 py-1.5 rounded-full hover:bg-qfc-200 transition-colors"
        >
          <span className={`w-2 h-2 rounded-full ${networkKey === 'mainnet' ? 'bg-green-500' : 'bg-yellow-500'}`} />
          {network.name}
          <ChevronDown size={14} />
        </button>

        {showNetworkMenu && (
          <div className="absolute top-full left-4 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10">
            {(Object.keys(networks) as NetworkKey[]).map((key) => (
              <button
                key={key}
                onClick={() => handleNetworkSwitch(key)}
                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 ${
                  key === networkKey ? 'text-qfc-600 font-medium' : 'text-gray-700'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${key === 'mainnet' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                {networks[key]?.name || key}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Balance Card */}
      <div className="mx-4 bg-gradient-to-r from-qfc-500 to-blue-500 rounded-2xl p-6 text-white">
        <div className="text-sm opacity-80">{t.home.totalBalance}</div>
        <div className="text-3xl font-bold mt-1">{balance} QFC</div>
        <div className="text-sm opacity-80 mt-1">${usdValue} USD</div>

        <div className="flex items-center mt-4 gap-2">
          <div className="bg-white/20 px-3 py-1.5 rounded-full text-sm">
            {formatAddress(currentAddress || '', 6)}
          </div>
          <button
            onClick={copyAddress}
            className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
            title={copied ? t.common.copied : t.common.copy}
          >
            <Copy size={14} />
          </button>
          {copied && (
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              {t.common.copied}
            </span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <QuickAction
          icon={<ArrowDownToLine size={20} />}
          label={t.common.receive}
          onClick={() => setView('receive')}
        />
        <QuickAction
          icon={<SendIcon size={20} />}
          label={t.common.send}
          onClick={() => setView('send')}
        />
        <QuickAction
          icon={<span className="text-lg">⇄</span>}
          label={t.common.swap}
          onClick={() => {}}
          disabled
        />
      </div>

      {/* Assets & Activity */}
      <div className="flex-1 bg-white rounded-t-3xl p-4 overflow-hidden flex flex-col">
        {/* Tabs */}
        <div className="flex gap-4 border-b mb-4">
          <button
            onClick={() => setActiveTab('assets')}
            className={`pb-2 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'assets'
                ? 'border-qfc-500 text-qfc-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            {t.home.assets}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-2 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'activity'
                ? 'border-qfc-500 text-qfc-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            {t.home.activity}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'assets' ? (
            <div className="space-y-2">
              {/* Native QFC */}
              <AssetItem
                name="QFC"
                symbol="QFC"
                balance={balance}
                value={usdValue}
              />

              {/* Tokens */}
              {tokens.map((token) => (
                <AssetItem
                  key={token.address}
                  name={token.name}
                  symbol={token.symbol}
                  balance={token.balance || '0'}
                  value={calculateUsdValue(token.symbol, token.balance || '0')}
                  isToken
                  onSend={() => handleSendToken(token)}
                />
              ))}

              {/* Add Token Button */}
              <button
                onClick={() => setView('addToken')}
                className="w-full flex items-center justify-center gap-2 p-3 text-qfc-600 hover:bg-qfc-50 rounded-xl transition-colors"
              >
                <Plus size={18} />
                <span className="text-sm font-medium">{t.home.addToken}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {t.home.noActivity}
                </div>
              ) : (
                transactions.map((tx) => (
                  <TransactionItem key={tx.hash} tx={tx} currentAddress={currentAddress || ''} explorerUrl={network.explorerUrl} t={t} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`bg-white rounded-xl p-4 shadow-sm transition-all ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:shadow-md active:scale-95'
      }`}
    >
      <div className="text-qfc-500 mb-2 flex justify-center">{icon}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </button>
  );
}

function AssetItem({
  name,
  symbol,
  balance,
  value,
  isToken,
  onSend,
}: {
  name: string;
  symbol: string;
  balance: string;
  value: string;
  isToken?: boolean;
  onSend?: () => void;
}) {
  const logo = TOKEN_LOGOS[symbol.toUpperCase()];
  return (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
      <div className="flex items-center gap-3">
        {logo ? (
          <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden">
            <img src={logo} alt={symbol} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
            isToken ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-qfc-400 to-blue-400'
          }`}>
            {symbol.charAt(0)}
          </div>
        )}
        <div>
          <div className="font-semibold">{name}</div>
          <div className="text-sm text-gray-500">${value}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="font-semibold">{balance}</div>
          <div className="text-sm text-gray-500">{symbol}</div>
        </div>
        {isToken && onSend && (
          <button
            onClick={onSend}
            className="p-2 text-qfc-600 hover:bg-qfc-100 rounded-lg transition-colors"
            title={`Send ${symbol}`}
          >
            <SendIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function TransactionItem({
  tx,
  currentAddress,
  explorerUrl,
  t,
}: {
  tx: { hash: string; from: string; to: string; value: string; timestamp: number; status: string; type: string };
  currentAddress: string;
  explorerUrl: string;
  t: ReturnType<typeof useTranslation>;
}) {
  const isSent = tx.from.toLowerCase() === currentAddress.toLowerCase();
  const date = new Date(tx.timestamp);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  // Determine display label based on transaction type
  const getLabel = () => {
    if (tx.type === 'token_transfer') {
      return isSent ? t.home.tokenSent : t.home.tokenReceived;
    }
    if (tx.type === 'contract') {
      return t.home.contractCall;
    }
    return isSent ? t.home.sent : t.home.received;
  };

  // Get status text
  const getStatusText = () => {
    if (tx.status === 'confirmed') return t.common.confirmed;
    if (tx.status === 'pending') return t.common.pending;
    return t.common.failed;
  };

  // Format value display (token transfers include symbol in value)
  const displayValue = tx.type === 'token_transfer' || tx.value.includes(' ')
    ? tx.value
    : `${tx.value} QFC`;

  return (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          tx.type === 'contract' ? 'bg-purple-100 text-purple-600' :
          isSent ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
        }`}>
          {tx.type === 'contract' ? '⚙' : isSent ? '↑' : '↓'}
        </div>
        <div>
          <div className="font-medium">{getLabel()}</div>
          <div className="text-xs text-gray-500">{dateStr} {timeStr}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className={`font-medium ${
            tx.type === 'contract' ? 'text-purple-600' :
            isSent ? 'text-red-600' : 'text-green-600'
          }`}>
            {tx.type === 'contract' ? '' : (isSent ? '-' : '+')}{displayValue}
          </div>
          <div className={`text-xs ${
            tx.status === 'confirmed' ? 'text-green-500' :
            tx.status === 'pending' ? 'text-yellow-500' : 'text-red-500'
          }`}>
            {getStatusText()}
          </div>
        </div>
        <a
          href={`${explorerUrl}/tx/${tx.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

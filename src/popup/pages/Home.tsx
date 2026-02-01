import { useState, useEffect } from 'react';
import { Copy, Send as SendIcon, ArrowDownToLine, Lock, RefreshCw } from 'lucide-react';
import { useWalletStore, walletActions } from '../store';
import { formatAddress } from '../../utils/validation';
import SendPage from './Send';
import Receive from './Receive';

type Tab = 'assets' | 'activity';
type View = 'home' | 'send' | 'receive' | 'settings';

export default function Home() {
  const { currentAddress, balance, network } = useWalletStore();
  const [activeTab, setActiveTab] = useState<Tab>('assets');
  const [view, setView] = useState<View>('home');
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Refresh balance periodically
    const interval = setInterval(() => {
      walletActions.refreshBalance();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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
    setRefreshing(false);
  };

  const handleLock = () => {
    walletActions.lock();
  };

  // USD value (mock - would normally fetch from price API)
  const usdValue = (parseFloat(balance) * 2.34).toFixed(2);

  if (view === 'send') {
    return <SendPage onBack={() => setView('home')} />;
  }

  if (view === 'receive') {
    return <Receive onBack={() => setView('home')} />;
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-qfc-500 to-blue-500" />
          <span className="font-bold text-lg">QFC Wallet</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-white/50 rounded-lg"
            title="Refresh balance"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleLock}
            className="p-2 hover:bg-white/50 rounded-lg"
            title="Lock wallet"
          >
            <Lock size={18} />
          </button>
        </div>
      </div>

      {/* Network indicator */}
      <div className="px-4 mb-2">
        <span className="text-xs bg-qfc-100 text-qfc-700 px-2 py-1 rounded-full">
          {network.name}
        </span>
      </div>

      {/* Balance Card */}
      <div className="mx-4 bg-gradient-to-r from-qfc-500 to-blue-500 rounded-2xl p-6 text-white">
        <div className="text-sm opacity-80">Total Balance</div>
        <div className="text-3xl font-bold mt-1">{balance} QFC</div>
        <div className="text-sm opacity-80 mt-1">${usdValue} USD</div>

        <div className="flex items-center mt-4 gap-2">
          <div className="bg-white/20 px-3 py-1.5 rounded-full text-sm">
            {formatAddress(currentAddress || '', 6)}
          </div>
          <button
            onClick={copyAddress}
            className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors"
            title={copied ? 'Copied!' : 'Copy address'}
          >
            <Copy size={14} />
          </button>
          {copied && (
            <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
              Copied!
            </span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <QuickAction
          icon={<ArrowDownToLine size={20} />}
          label="Receive"
          onClick={() => setView('receive')}
        />
        <QuickAction
          icon={<SendIcon size={20} />}
          label="Send"
          onClick={() => setView('send')}
        />
        <QuickAction
          icon={<span className="text-lg">⇄</span>}
          label="Swap"
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
            Assets
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-2 px-1 border-b-2 font-medium transition-colors ${
              activeTab === 'activity'
                ? 'border-qfc-500 text-qfc-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Activity
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'assets' ? (
            <div className="space-y-2">
              <AssetItem
                name="QFC"
                symbol="QFC"
                balance={balance}
                value={usdValue}
              />
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              No recent activity
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
}: {
  name: string;
  symbol: string;
  balance: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-qfc-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold">
          Q
        </div>
        <div>
          <div className="font-semibold">{name}</div>
          <div className="text-sm text-gray-500">${value}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold">{balance}</div>
        <div className="text-sm text-gray-500">{symbol}</div>
      </div>
    </div>
  );
}

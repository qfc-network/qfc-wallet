import { useState } from 'react';
import { ChevronLeft, Trash2, ExternalLink, Globe, ChevronDown, ChevronRight, BookUser } from 'lucide-react';
import { useWalletStore, sendMessage } from '../store';
import { formatAddress } from '../../utils/validation';
import { useI18n, LANGUAGES } from '../../i18n';
import type { Language } from '../../i18n';
import AddressBook from './AddressBook';

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const { wallets, currentAddress, network } = useWalletStore();
  const { language, setLanguage, t } = useI18n();
  const [connectedSites, setConnectedSites] = useState<Record<string, string[]>>({});
  const [showSites, setShowSites] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showAddressBook, setShowAddressBook] = useState(false);

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

  const handleLanguageChange = async (lang: Language) => {
    await setLanguage(lang);
    setShowLangMenu(false);
  };

  const currentLang = LANGUAGES.find((l) => l.code === language);

  if (showAddressBook) {
    return <AddressBook onBack={() => setShowAddressBook(false)} />;
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
        <h1 className="text-lg font-bold">{t.settings.title}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Account Info */}
        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold text-gray-800 mb-3">{t.settings.account}</h2>
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
                    {t.common.active}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Language Selector */}
        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold text-gray-800 mb-3">{t.settings.language}</h2>
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-gray-500" />
                <span>{currentLang?.nativeName} ({currentLang?.name})</span>
              </div>
              <ChevronDown size={18} className={`text-gray-500 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
            </button>

            {showLangMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full px-4 py-3 text-left text-sm flex items-center justify-between hover:bg-gray-50 ${
                      lang.code === language ? 'text-qfc-600 font-medium bg-qfc-50' : 'text-gray-700'
                    }`}
                  >
                    <span>{lang.nativeName}</span>
                    <span className="text-gray-400 text-xs">{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Address Book */}
        <div className="bg-white rounded-xl p-4">
          <button
            onClick={() => setShowAddressBook(true)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookUser size={18} className="text-gray-500" />
              <span>{t.settings.addressBook}</span>
            </div>
            <ChevronRight size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Network Info */}
        <div className="bg-white rounded-xl p-4">
          <h2 className="font-semibold text-gray-800 mb-3">{t.settings.network}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t.settings.network}</span>
              <span className="font-medium">{network.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t.settings.chainId}</span>
              <span className="font-mono">{network.chainId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">{t.settings.rpcUrl}</span>
              <span className="font-mono text-xs">{network.rpcUrl}</span>
            </div>
            <a
              href={network.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-qfc-600 hover:underline"
            >
              <span>{t.settings.explorer}</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* Connected Sites */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">{t.settings.connectedSites}</h2>
            {!showSites && (
              <button
                onClick={loadConnectedSites}
                className="text-sm text-qfc-600 hover:underline"
              >
                {t.common.view}
              </button>
            )}
          </div>

          {showSites && (
            <div className="space-y-2">
              {Object.keys(connectedSites).length === 0 ? (
                <p className="text-sm text-gray-500">{t.settings.noConnectedSites}</p>
              ) : (
                Object.entries(connectedSites).map(([origin, addresses]) => (
                  <div
                    key={origin}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-sm">{new URL(origin).hostname}</div>
                      <div className="text-xs text-gray-500">
                        {addresses.length} {t.settings.account.toLowerCase()}{addresses.length > 1 ? 's' : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => disconnectSite(origin)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      title={t.common.disconnect}
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
          <h2 className="font-semibold text-gray-800 mb-3">{t.settings.about}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">{t.common.version}</span>
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

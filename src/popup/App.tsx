import { useEffect } from 'react';
import { useWalletStore, walletActions } from './store';
import { useTranslation } from '../i18n';
import Home from './pages/Home';
import Unlock from './pages/Unlock';
import CreateWallet from './pages/CreateWallet';

export default function App() {
  const { isLoading, isUnlocked, wallets } = useWalletStore();
  const t = useTranslation();

  useEffect(() => {
    walletActions.initialize();
  }, []);

  useEffect(() => {
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const report = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 5000);
      walletActions.reportActivity();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        report();
      }
    };

    window.addEventListener('focus', report);
    window.addEventListener('click', report);
    window.addEventListener('keydown', report);
    window.addEventListener('mousemove', report);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', report);
      window.removeEventListener('click', report);
      window.removeEventListener('keydown', report);
      window.removeEventListener('mousemove', report);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-qfc-50 to-blue-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-qfc-500 to-blue-500 animate-pulse" />
          <p className="text-gray-500">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  // No wallet exists - show create/import
  if (wallets.length === 0) {
    return <CreateWallet />;
  }

  // Wallet locked - show unlock
  if (!isUnlocked) {
    return <Unlock />;
  }

  // Wallet unlocked - show home
  return <Home />;
}

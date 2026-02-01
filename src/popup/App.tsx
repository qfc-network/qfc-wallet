import { useEffect } from 'react';
import { useWalletStore, walletActions } from './store';
import Home from './pages/Home';
import Unlock from './pages/Unlock';
import CreateWallet from './pages/CreateWallet';

export default function App() {
  const { isLoading, isUnlocked, wallets } = useWalletStore();

  useEffect(() => {
    walletActions.initialize();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-qfc-50 to-blue-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-qfc-500 to-blue-500 animate-pulse" />
          <p className="text-gray-500">Loading...</p>
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

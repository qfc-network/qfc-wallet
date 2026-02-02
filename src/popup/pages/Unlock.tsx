import { useState } from 'react';
import { Eye, EyeOff, Unlock as UnlockIcon } from 'lucide-react';
import { useWalletStore, walletActions } from '../store';
import { useTranslation } from '../../i18n';

export default function Unlock() {
  const { error, isLoading } = useWalletStore();
  const t = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!password) {
      setLocalError(t.unlock.enterPassword);
      return;
    }

    try {
      const success = await walletActions.unlock(password);
      if (!success) {
        setLocalError(t.unlock.wrongPassword);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t.common.error);
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-r from-qfc-500 to-blue-500 flex items-center justify-center mb-6">
          <UnlockIcon size={36} className="text-white" />
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">{t.unlock.title}</h1>
        <p className="text-gray-500 text-center mb-8">
          {t.unlock.enterPassword}
        </p>

        {/* Unlock Form */}
        <form onSubmit={handleUnlock} className="w-full max-w-sm space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.unlock.passwordPlaceholder}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl pr-12 focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {(localError || error) && (
            <p className="text-red-500 text-sm text-center">
              {localError || error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? t.common.loading : t.unlock.unlockButton}
          </button>
        </form>
      </div>

      {/* Footer */}
      <div className="p-6 text-center">
        <p className="text-sm text-gray-400">
          QFC {t.common.wallet} v1.0.0
        </p>
      </div>
    </div>
  );
}

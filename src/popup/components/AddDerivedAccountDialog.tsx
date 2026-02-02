import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { walletActions } from '../store';

interface AddDerivedAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AddDerivedAccountDialog({ open, onClose }: AddDerivedAccountDialogProps) {
  const t = useTranslation();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setName('');
      setError('');
      setIsLoading(false);
    }
  }, [open]);

  const handleAdd = async () => {
    setError('');
    setIsLoading(true);
    try {
      await walletActions.addDerivedAccount(name.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{t.settings.addDerivedAccount}</h2>
            <p className="text-sm text-gray-500">{t.settings.derivedAccountHint}</p>
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.createWallet.walletNamePlaceholder}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="space-y-2">
            <button
              onClick={handleAdd}
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isLoading ? t.common.loading : t.common.confirm}
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

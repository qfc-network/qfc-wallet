import { useEffect, useState } from 'react';
import { Eye, EyeOff, Copy, Check, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { walletActions } from '../store';

interface ExportPrivateKeyDialogProps {
  open: boolean;
  onClose: () => void;
  address?: string | null;
}

export default function ExportPrivateKeyDialog({
  open,
  onClose,
  address,
}: ExportPrivateKeyDialogProps) {
  const t = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [privateKey, setPrivateKey] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setShowPassword(false);
      setPrivateKey('');
      setError('');
      setCopied(false);
      setIsLoading(false);
    }
  }, [open]);

  const handleReveal = async () => {
    setError('');
    setIsLoading(true);
    try {
      const key = await walletActions.exportPrivateKey(password, address || undefined);
      setPrivateKey(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(privateKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{t.settings.exportPrivateKey}</h2>
            <p className="text-sm text-gray-500">{t.settings.exportWarning}</p>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
            <AlertTriangle size={16} className="mt-0.5" />
            <span>{t.settings.exportWarning}</span>
          </div>

          {!privateKey ? (
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.settings.password}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl pr-12 focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="space-y-2">
                <button
                  onClick={handleReveal}
                  disabled={isLoading || !password}
                  className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isLoading ? t.common.loading : t.settings.reveal}
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  {t.common.cancel}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="text-xs text-gray-500 mb-1">{t.settings.privateKey}</div>
                <div className="font-mono text-sm break-all">{privateKey}</div>
              </div>

              <button
                onClick={handleCopy}
                className="flex items-center gap-2 text-qfc-600 text-sm"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? t.common.copied : t.common.copy}
              </button>

              <button
                onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                {t.common.confirm}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

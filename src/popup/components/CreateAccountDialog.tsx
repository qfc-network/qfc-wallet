import { useEffect, useState } from 'react';
import { Copy, Check, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { validatePassword } from '../../utils/validation';
import { useWalletStore, walletActions } from '../store';

interface CreateAccountDialogProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'form' | 'mnemonic';

export default function CreateAccountDialog({ open, onClose }: CreateAccountDialogProps) {
  const t = useTranslation();
  const { wallets } = useWalletStore();
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('form');
      setName('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setMnemonic('');
      setCopied(false);
      setError('');
      setIsLoading(false);
    }
  }, [open]);

  const handleCreate = async () => {
    setError('');

    const validation = validatePassword(password);
    if (!validation.valid) {
      setError(t.createWallet.passwordTooShort);
      return;
    }

    if (password !== confirmPassword) {
      setError(t.createWallet.passwordMismatch);
      return;
    }

    setIsLoading(true);
    try {
      const accountName = name.trim() || `Account ${wallets.length + 1}`;
      const result = await walletActions.createAccount(accountName, password);
      setMnemonic(result.mnemonic);
      setStep('mnemonic');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyMnemonic = async () => {
    await navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {step === 'form' ? (
          <div className="p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{t.createWallet.createNew}</h2>
              <p className="text-sm text-gray-500">{t.createWallet.passwordTooShort}</p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.createWallet.walletNamePlaceholder}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
              />

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.createWallet.passwordPlaceholder}
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

              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.createWallet.confirmPasswordPlaceholder}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="space-y-2">
              <button
                onClick={handleCreate}
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isLoading ? t.common.loading : t.createWallet.create}
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
          <div className="p-5 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{t.createWallet.saveRecoveryPhrase}</h2>
              <p className="text-sm text-gray-500">{t.createWallet.recoveryPhraseWarning}</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <div className="grid grid-cols-3 gap-2 mb-3">
                {mnemonic.split(' ').map((word, i) => (
                  <div key={i} className="bg-white px-2 py-1.5 rounded text-sm border border-gray-200">
                    <span className="text-gray-400 mr-1">{i + 1}.</span>
                    {word}
                  </div>
                ))}
              </div>

              <button
                onClick={copyMnemonic}
                className="flex items-center gap-2 text-qfc-600 text-sm"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? t.common.copied : t.common.copy}
              </button>
            </div>

            <div className="space-y-2">
              <button
                onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                {t.createWallet.iHaveSaved}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

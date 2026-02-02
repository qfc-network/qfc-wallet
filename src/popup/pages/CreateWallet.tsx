import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, ChevronLeft } from 'lucide-react';
import { walletActions } from '../store';
import { validatePassword, isValidMnemonic, isValidPrivateKey } from '../../utils/validation';
import { useTranslation } from '../../i18n';

type Step = 'choice' | 'create' | 'mnemonic' | 'import';

export default function CreateWallet() {
  const t = useTranslation();
  const [step, setStep] = useState<Step>('choice');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [importValue, setImportValue] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    setError('');

    // Validate password
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
      const result = await walletActions.createWallet(name || 'Account 1', password);
      setMnemonic(result.mnemonic);
      setStep('mnemonic');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setError('');

    if (!importValue.trim()) {
      setError(t.createWallet.privateKeyPlaceholder);
      return;
    }

    // Check if it's a mnemonic or private key
    const words = importValue.trim().split(/\s+/);
    if (words.length >= 12) {
      if (!isValidMnemonic(importValue.trim())) {
        setError(t.send.invalidAddress);
        return;
      }
    } else {
      if (!isValidPrivateKey(importValue.trim())) {
        setError(t.send.invalidAddress);
        return;
      }
    }

    // Validate password
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
      await walletActions.importWallet(
        importValue.trim(),
        name || 'Imported Account',
        password
      );
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

  const renderChoice = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="w-20 h-20 rounded-full bg-gradient-to-r from-qfc-500 to-blue-500 flex items-center justify-center mb-6">
        <span className="text-3xl text-white font-bold">Q</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-800 mb-2">QFC {t.common.wallet}</h1>
      <p className="text-gray-500 text-center mb-8">
        {t.createWallet.title}
      </p>

      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => setStep('create')}
          className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          {t.createWallet.createNew}
        </button>

        <button
          onClick={() => setStep('import')}
          className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
        >
          {t.createWallet.importExisting}
        </button>
      </div>
    </div>
  );

  const renderCreate = () => (
    <div className="flex-1 flex flex-col p-6">
      <button
        onClick={() => setStep('choice')}
        className="flex items-center gap-1 text-gray-500 mb-6"
      >
        <ChevronLeft size={20} />
        {t.common.back}
      </button>

      <h1 className="text-xl font-bold text-gray-800 mb-2">{t.createWallet.createNew}</h1>
      <p className="text-gray-500 mb-6">
        {t.createWallet.passwordTooShort}
      </p>

      <div className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.createWallet.walletNamePlaceholder}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
        />

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.createWallet.passwordPlaceholder}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl pr-12 focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t.createWallet.confirmPasswordPlaceholder}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={isLoading}
          className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? t.common.loading : t.createWallet.create}
        </button>
      </div>
    </div>
  );

  const renderMnemonic = () => (
    <div className="flex-1 flex flex-col p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-2">{t.createWallet.saveRecoveryPhrase}</h1>
      <p className="text-gray-500 mb-6">
        {t.createWallet.recoveryPhraseWarning}
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          {mnemonic.split(' ').map((word, i) => (
            <div key={i} className="bg-gray-50 px-2 py-1.5 rounded text-sm">
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

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
        <p className="text-yellow-800 text-sm">
          <strong>Warning:</strong> {t.createWallet.recoveryPhraseWarning}
        </p>
      </div>

      <button
        onClick={() => {
          // Wallet is already created and unlocked
          // The App component will re-render and show Home
        }}
        className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
      >
        {t.createWallet.iHaveSaved}
      </button>
    </div>
  );

  const renderImport = () => (
    <div className="flex-1 flex flex-col p-6">
      <button
        onClick={() => setStep('choice')}
        className="flex items-center gap-1 text-gray-500 mb-6"
      >
        <ChevronLeft size={20} />
        {t.common.back}
      </button>

      <h1 className="text-xl font-bold text-gray-800 mb-2">{t.createWallet.import}</h1>
      <p className="text-gray-500 mb-6">
        {t.createWallet.privateKeyOrMnemonic}
      </p>

      <div className="space-y-4 flex-1">
        <textarea
          value={importValue}
          onChange={(e) => setImportValue(e.target.value)}
          placeholder={t.createWallet.privateKeyPlaceholder}
          className="w-full h-32 px-4 py-3 bg-white border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
        />

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t.createWallet.walletNamePlaceholder}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
        />

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t.createWallet.passwordPlaceholder}
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl pr-12 focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder={t.createWallet.confirmPasswordPlaceholder}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      <button
        onClick={handleImport}
        disabled={isLoading}
        className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isLoading ? t.common.loading : t.createWallet.import}
      </button>
    </div>
  );

  return (
    <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
      {step === 'choice' && renderChoice()}
      {step === 'create' && renderCreate()}
      {step === 'mnemonic' && renderMnemonic()}
      {step === 'import' && renderImport()}
    </div>
  );
}

import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, ChevronLeft } from 'lucide-react';
import { walletActions } from '../store';
import { validatePassword, isValidMnemonic, isValidPrivateKey } from '../../utils/validation';

type Step = 'choice' | 'create' | 'mnemonic' | 'import';

export default function CreateWallet() {
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
      setError(validation.errors[0]);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const result = await walletActions.createWallet(name || 'Account 1', password);
      setMnemonic(result.mnemonic);
      setStep('mnemonic');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    setError('');

    if (!importValue.trim()) {
      setError('Please enter a mnemonic phrase or private key');
      return;
    }

    // Check if it's a mnemonic or private key
    const words = importValue.trim().split(/\s+/);
    if (words.length >= 12) {
      if (!isValidMnemonic(importValue.trim())) {
        setError('Invalid mnemonic phrase');
        return;
      }
    } else {
      if (!isValidPrivateKey(importValue.trim())) {
        setError('Invalid private key');
        return;
      }
    }

    // Validate password
    const validation = validatePassword(password);
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
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
      setError(err instanceof Error ? err.message : 'Failed to import wallet');
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

      <h1 className="text-2xl font-bold text-gray-800 mb-2">QFC Wallet</h1>
      <p className="text-gray-500 text-center mb-8">
        Your gateway to the QFC Network
      </p>

      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={() => setStep('create')}
          className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
        >
          Create New Wallet
        </button>

        <button
          onClick={() => setStep('import')}
          className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
        >
          Import Existing Wallet
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
        Back
      </button>

      <h1 className="text-xl font-bold text-gray-800 mb-2">Create New Wallet</h1>
      <p className="text-gray-500 mb-6">
        Set a strong password to protect your wallet
      </p>

      <div className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wallet name (optional)"
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
        />

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (8+ characters)"
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
          placeholder="Confirm password"
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={isLoading}
          className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? 'Creating...' : 'Create Wallet'}
        </button>
      </div>
    </div>
  );

  const renderMnemonic = () => (
    <div className="flex-1 flex flex-col p-6">
      <h1 className="text-xl font-bold text-gray-800 mb-2">Backup Your Wallet</h1>
      <p className="text-gray-500 mb-6">
        Write down these 12 words in order. Never share them with anyone!
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
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
        <p className="text-yellow-800 text-sm">
          <strong>Warning:</strong> If you lose these words, you will lose access
          to your wallet forever. Store them securely!
        </p>
      </div>

      <button
        onClick={() => {
          // Wallet is already created and unlocked
          // The App component will re-render and show Home
        }}
        className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
      >
        I've Saved My Recovery Phrase
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
        Back
      </button>

      <h1 className="text-xl font-bold text-gray-800 mb-2">Import Wallet</h1>
      <p className="text-gray-500 mb-6">
        Enter your 12-word recovery phrase or private key
      </p>

      <div className="space-y-4 flex-1">
        <textarea
          value={importValue}
          onChange={(e) => setImportValue(e.target.value)}
          placeholder="Enter recovery phrase or private key"
          className="w-full h-32 px-4 py-3 bg-white border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
        />

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Wallet name (optional)"
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
        />

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Set a password"
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
          placeholder="Confirm password"
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      <button
        onClick={handleImport}
        disabled={isLoading}
        className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {isLoading ? 'Importing...' : 'Import Wallet'}
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

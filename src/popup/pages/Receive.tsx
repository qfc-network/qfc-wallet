import { useState } from 'react';
import { ChevronLeft, Copy, Check } from 'lucide-react';
import { useWalletStore } from '../store';

interface ReceiveProps {
  onBack: () => void;
}

export default function Receive({ onBack }: ReceiveProps) {
  const { currentAddress, network } = useWalletStore();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (currentAddress) {
      await navigator.clipboard.writeText(currentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Simple QR code placeholder - in production, use a proper QR library
  const qrPlaceholder = (
    <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center border-2 border-gray-100">
      <div className="text-center">
        <div className="grid grid-cols-5 gap-1 p-4">
          {Array.from({ length: 25 }).map((_, i) => (
            <div
              key={i}
              className={`w-6 h-6 rounded-sm ${
                Math.random() > 0.5 ? 'bg-gray-800' : 'bg-white'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">QR Code</p>
      </div>
    </div>
  );

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
        <h1 className="text-lg font-bold">Receive QFC</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Network Badge */}
        <span className="text-xs bg-qfc-100 text-qfc-700 px-3 py-1 rounded-full mb-6">
          {network.name}
        </span>

        {/* QR Code */}
        {qrPlaceholder}

        {/* Address */}
        <div className="mt-6 w-full max-w-sm">
          <p className="text-sm text-gray-500 text-center mb-2">
            Your QFC Address
          </p>
          <div className="bg-white rounded-xl p-4">
            <p className="text-sm font-mono break-all text-center text-gray-800">
              {currentAddress}
            </p>
          </div>
        </div>

        {/* Copy Button */}
        <button
          onClick={copyAddress}
          className={`mt-4 flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
            copied
              ? 'bg-green-100 text-green-700'
              : 'bg-gradient-to-r from-qfc-500 to-blue-500 text-white hover:opacity-90'
          }`}
        >
          {copied ? (
            <>
              <Check size={20} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={20} />
              Copy Address
            </>
          )}
        </button>

        {/* Warning */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 w-full max-w-sm">
          <p className="text-sm text-yellow-800 text-center">
            Only send QFC tokens to this address. Sending other tokens may result
            in permanent loss.
          </p>
        </div>
      </div>
    </div>
  );
}

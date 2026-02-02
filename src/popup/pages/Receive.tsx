import { useState } from 'react';
import { ChevronLeft, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useWalletStore } from '../store';
import { useTranslation } from '../../i18n';

interface ReceiveProps {
  onBack: () => void;
}

export default function Receive({ onBack }: ReceiveProps) {
  const { currentAddress, network } = useWalletStore();
  const t = useTranslation();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (currentAddress) {
      await navigator.clipboard.writeText(currentAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
        <h1 className="text-lg font-bold">{t.receive.title} QFC</h1>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Network Badge */}
        <span className="text-xs bg-qfc-100 text-qfc-700 px-3 py-1 rounded-full mb-6">
          {network.name}
        </span>

        {/* QR Code */}
        <div className="bg-white p-4 rounded-2xl shadow-sm">
          <QRCodeSVG
            value={currentAddress || ''}
            size={180}
            level="M"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#1f2937"
          />
        </div>

        {/* Address */}
        <div className="mt-6 w-full max-w-sm">
          <p className="text-sm text-gray-500 text-center mb-2">
            {t.receive.yourAddress}
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
              {t.common.copied}
            </>
          ) : (
            <>
              <Copy size={20} />
              {t.receive.copyAddress}
            </>
          )}
        </button>

        {/* Warning */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 w-full max-w-sm">
          <p className="text-sm text-yellow-800 text-center">
            {t.receive.scanQR}
          </p>
        </div>
      </div>
    </div>
  );
}

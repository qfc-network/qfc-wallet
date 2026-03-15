import { useState } from 'react';
import { ChevronLeft, AlertCircle, Check } from 'lucide-react';
import { walletActions } from '../store';
import { isValidAddress } from '../../utils/validation';
import { useTranslation } from '../../i18n';
import type { NFT } from '../../types/nft';

interface AddNFTProps {
  onBack: () => void;
}

export default function AddNFT({ onBack }: AddNFTProps) {
  const t = useTranslation();
  const [contractAddress, setContractAddress] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [nftInfo, setNftInfo] = useState<NFT | null>(null);

  const handleAddNFT = async () => {
    setError('');

    if (!isValidAddress(contractAddress)) {
      setError(t.token.invalidAddress);
      return;
    }

    if (!tokenId.trim()) {
      setError(t.nft.nftNotFound);
      return;
    }

    setIsLoading(true);
    try {
      const nft = await walletActions.addNFT(contractAddress, tokenId.trim());
      if (nft) {
        setNftInfo(nft);
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.nft.invalidContract);
    } finally {
      setIsLoading(false);
    }
  };

  if (success && nftInfo) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-qfc-50 to-blue-50 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <Check size={32} className="text-green-500" />
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">{t.common.success}</h2>

          {nftInfo.image ? (
            <div className="w-32 h-32 rounded-xl overflow-hidden mb-3">
              <img
                src={nftInfo.image}
                alt={nftInfo.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : null}

          <p className="text-gray-700 font-medium mb-1">{nftInfo.name}</p>
          <p className="text-gray-500 text-sm mb-6">{nftInfo.collection}</p>

          <button
            onClick={onBack}
            className="w-full max-w-sm py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl"
          >
            {t.common.confirm}
          </button>
        </div>
      </div>
    );
  }

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
        <h1 className="text-lg font-bold">{t.nft.addNFT}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        <div className="bg-white rounded-xl p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.nft.contractAddress}
            </label>
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              placeholder={t.nft.contractAddressPlaceholder}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t.nft.tokenId}
            </label>
            <input
              type="text"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder={t.nft.tokenIdPlaceholder}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-qfc-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Add Button */}
      <div className="p-4">
        <button
          onClick={handleAddNFT}
          disabled={isLoading || !contractAddress || !tokenId.trim()}
          className="w-full py-3 bg-gradient-to-r from-qfc-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isLoading ? t.nft.fetchingMetadata : t.nft.addNFT}
        </button>
      </div>
    </div>
  );
}

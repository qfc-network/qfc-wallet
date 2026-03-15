import { useState } from 'react';
import type { NFTAsset, NFTMetadata } from '../../types/wallet';

// Mock NFTs for display before contract integration
const MOCK_NFTS: (NFTAsset & { metadata?: NFTMetadata })[] = [
  {
    contractAddress: '0x1234...5678',
    tokenId: '42',
    standard: 'ERC-721',
    balance: '1',
    collectionName: 'QFC Genesis',
    name: 'QFC Genesis',
    symbol: 'QGEN',
    metadata: {
      name: 'QFC Genesis #42',
      description: 'Genesis collection for QFC Network early adopters',
      image: 'https://placehold.co/300x300/1a1a2e/00d4ff?text=QFC%2342',
      attributes: [
        { trait_type: 'Rarity', value: 'Legendary' },
        { trait_type: 'Power', value: 95 },
      ],
    },
  },
  {
    contractAddress: '0xabcd...ef01',
    tokenId: '7',
    standard: 'ERC-721',
    balance: '1',
    collectionName: 'QFC Validators',
    name: 'QFC Validators',
    symbol: 'QVAL',
    metadata: {
      name: 'Validator Badge #7',
      description: 'Proof of contribution to QFC Network validation',
      image: 'https://placehold.co/300x300/1a1a2e/a855f7?text=VAL%237',
      attributes: [
        { trait_type: 'Tier', value: 'Gold' },
        { trait_type: 'Uptime', value: '99.9%' },
      ],
    },
  },
  {
    contractAddress: '0x9876...5432',
    tokenId: '1',
    standard: 'ERC-1155',
    balance: '5',
    collectionName: 'QFC Items',
    metadata: {
      name: 'Energy Crystal',
      description: 'Consumable item for QFC games',
      image: 'https://placehold.co/300x300/1a1a2e/10b981?text=Crystal',
    },
  },
];

export default function NFTGallery() {
  const [nfts] = useState<(NFTAsset & { metadata?: NFTMetadata })[]>(MOCK_NFTS);
  const [selectedNft, setSelectedNft] = useState<(NFTAsset & { metadata?: NFTMetadata }) | null>(null);
  const [sendTo, setSendTo] = useState('');
  const [sending, setSending] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-lg font-bold text-white">NFT Gallery</h2>
        <p className="text-xs text-gray-500">{nfts.length} items</p>
      </div>

      {selectedNft ? (
        // NFT Detail View
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <button
            onClick={() => setSelectedNft(null)}
            className="text-sm text-cyan-400 hover:text-cyan-300"
          >
            &larr; Back to gallery
          </button>

          {/* Image */}
          <div className="rounded-xl overflow-hidden bg-gray-800">
            {selectedNft.metadata?.image ? (
              <img
                src={selectedNft.metadata.image}
                alt={selectedNft.metadata.name || 'NFT'}
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center text-gray-600">
                No Image
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <p className="text-xs text-cyan-400">{selectedNft.collectionName || selectedNft.standard}</p>
            <h3 className="text-lg font-bold text-white">
              {selectedNft.metadata?.name || `#${selectedNft.tokenId}`}
            </h3>
            {selectedNft.standard === 'ERC-1155' && (
              <p className="text-sm text-gray-400">Quantity: {selectedNft.balance}</p>
            )}
          </div>

          {selectedNft.metadata?.description && (
            <p className="text-sm text-gray-400">{selectedNft.metadata.description}</p>
          )}

          {/* Attributes */}
          {selectedNft.metadata?.attributes && selectedNft.metadata.attributes.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Attributes</h4>
              <div className="grid grid-cols-2 gap-2">
                {selectedNft.metadata.attributes.map((attr, i) => (
                  <div key={i} className="rounded-lg bg-gray-800 p-2 text-center">
                    <p className="text-[10px] text-cyan-400 uppercase">{attr.trait_type}</p>
                    <p className="text-sm font-medium text-white">{attr.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Send */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-300">Send NFT</h4>
            <input
              type="text"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="Recipient address (0x...)"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-cyan-500 focus:outline-none"
            />
            <button
              onClick={async () => {
                setSending(true);
                // In production: call transferERC721 or transferERC1155
                await new Promise((r) => setTimeout(r, 1500));
                setSending(false);
                setSendTo('');
              }}
              disabled={!sendTo || sending}
              className="w-full rounded-lg bg-cyan-500 py-2 text-sm font-medium text-white hover:bg-cyan-400 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      ) : (
        // Gallery Grid View
        <div className="flex-1 overflow-y-auto p-4">
          {nfts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-4xl mb-2">🖼️</p>
              <p className="text-sm">No NFTs found</p>
              <p className="text-xs mt-1">NFTs you own will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {nfts.map((nft, i) => (
                <button
                  key={`${nft.contractAddress}-${nft.tokenId}-${i}`}
                  onClick={() => setSelectedNft(nft)}
                  className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden hover:border-gray-600 transition text-left"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-gray-800">
                    {nft.metadata?.image ? (
                      <img
                        src={nft.metadata.image}
                        alt={nft.metadata.name || 'NFT'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-2xl">
                        ?
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <div className="p-2">
                    <p className="text-[10px] text-gray-500 truncate">
                      {nft.collectionName || nft.standard}
                    </p>
                    <p className="text-xs font-medium text-white truncate">
                      {nft.metadata?.name || `#${nft.tokenId}`}
                    </p>
                    {nft.standard === 'ERC-1155' && Number(nft.balance) > 1 && (
                      <p className="text-[10px] text-gray-400">x{nft.balance}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

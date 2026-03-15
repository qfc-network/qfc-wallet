/**
 * NFT utilities — ERC-721 and ERC-1155 asset discovery and metadata fetching.
 */

import { ethers } from 'ethers';
import type { NFTAsset, NFTMetadata } from '../types/wallet';

// Minimal ABIs for NFT queries
const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function safeTransferFrom(address from, address to, uint256 tokenId)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
];

const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function uri(uint256 id) view returns (string)',
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
];

// ERC-165 interface IDs
const ERC721_INTERFACE_ID = '0x80ac58cd';
const ERC1155_INTERFACE_ID = '0xd9b67a26';
const ERC721_ENUMERABLE_INTERFACE_ID = '0x780e9d63';

/**
 * Detect whether a contract is ERC-721 or ERC-1155
 */
export async function detectNFTStandard(
  provider: ethers.Provider,
  contractAddress: string,
): Promise<'ERC-721' | 'ERC-1155' | null> {
  const contract = new ethers.Contract(contractAddress, [
    'function supportsInterface(bytes4) view returns (bool)',
  ], provider);

  try {
    if (await contract.supportsInterface(ERC721_INTERFACE_ID)) return 'ERC-721';
    if (await contract.supportsInterface(ERC1155_INTERFACE_ID)) return 'ERC-1155';
  } catch {
    // Not an ERC-165 contract
  }
  return null;
}

/**
 * Fetch ERC-721 NFTs owned by an address from a specific contract
 */
export async function fetchERC721NFTs(
  provider: ethers.Provider,
  contractAddress: string,
  ownerAddress: string,
  maxTokens: number = 50,
): Promise<NFTAsset[]> {
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
  const nfts: NFTAsset[] = [];

  try {
    const balance = await contract.balanceOf(ownerAddress);
    const count = Math.min(Number(balance), maxTokens);

    // Try enumerable first
    let isEnumerable = false;
    try {
      isEnumerable = await contract.supportsInterface(ERC721_ENUMERABLE_INTERFACE_ID);
    } catch { /* not enumerable */ }

    let name = '', symbol = '';
    try { name = await contract.name(); } catch { /* no name */ }
    try { symbol = await contract.symbol(); } catch { /* no symbol */ }

    if (isEnumerable) {
      for (let i = 0; i < count; i++) {
        try {
          const tokenId = await contract.tokenOfOwnerByIndex(ownerAddress, i);
          let tokenURI = '';
          try { tokenURI = await contract.tokenURI(tokenId); } catch { /* no URI */ }

          nfts.push({
            contractAddress,
            tokenId: tokenId.toString(),
            standard: 'ERC-721',
            balance: '1',
            tokenURI,
            collectionName: name,
            name,
            symbol,
          });
        } catch { break; }
      }
    }

    // If not enumerable but balance > 0, return a placeholder
    if (!isEnumerable && count > 0) {
      nfts.push({
        contractAddress,
        tokenId: '?',
        standard: 'ERC-721',
        balance: count.toString(),
        collectionName: name,
        name,
        symbol,
      });
    }
  } catch {
    // Contract call failed
  }

  return nfts;
}

/**
 * Fetch ERC-1155 token balances for specific token IDs
 */
export async function fetchERC1155Balance(
  provider: ethers.Provider,
  contractAddress: string,
  ownerAddress: string,
  tokenIds: string[],
): Promise<NFTAsset[]> {
  const contract = new ethers.Contract(contractAddress, ERC1155_ABI, provider);
  const nfts: NFTAsset[] = [];

  for (const tokenId of tokenIds) {
    try {
      const balance = await contract.balanceOf(ownerAddress, tokenId);
      if (balance > 0n) {
        let tokenURI = '';
        try {
          tokenURI = await contract.uri(tokenId);
          // Replace {id} placeholder per ERC-1155 spec
          tokenURI = tokenURI.replace('{id}', BigInt(tokenId).toString(16).padStart(64, '0'));
        } catch { /* no URI */ }

        nfts.push({
          contractAddress,
          tokenId,
          standard: 'ERC-1155',
          balance: balance.toString(),
          tokenURI,
        });
      }
    } catch {
      // Skip failed queries
    }
  }

  return nfts;
}

/**
 * Resolve IPFS URI to HTTP gateway URL
 */
export function resolveIPFS(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  if (uri.startsWith('ar://')) {
    return `https://arweave.net/${uri.slice(5)}`;
  }
  return uri;
}

/**
 * Fetch NFT metadata from tokenURI
 */
export async function fetchMetadata(tokenURI: string): Promise<NFTMetadata | null> {
  if (!tokenURI) return null;

  const url = resolveIPFS(tokenURI);

  // Handle data URIs (base64 JSON)
  if (url.startsWith('data:application/json;base64,')) {
    try {
      const json = atob(url.split(',')[1]);
      return JSON.parse(json);
    } catch { return null; }
  }

  if (url.startsWith('data:application/json,')) {
    try {
      return JSON.parse(decodeURIComponent(url.split(',')[1]));
    } catch { return null; }
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const metadata = await response.json();
    // Resolve image IPFS URIs
    if (metadata.image) metadata.image = resolveIPFS(metadata.image);
    if (metadata.animation_url) metadata.animation_url = resolveIPFS(metadata.animation_url);
    return metadata;
  } catch {
    return null;
  }
}

/**
 * Send ERC-721 NFT
 */
export async function transferERC721(
  signer: ethers.Signer,
  contractAddress: string,
  from: string,
  to: string,
  tokenId: string,
): Promise<string> {
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, signer);
  const tx = await contract.safeTransferFrom(from, to, tokenId);
  return tx.hash;
}

/**
 * Send ERC-1155 NFT
 */
export async function transferERC1155(
  signer: ethers.Signer,
  contractAddress: string,
  from: string,
  to: string,
  tokenId: string,
  amount: string = '1',
): Promise<string> {
  const contract = new ethers.Contract(contractAddress, ERC1155_ABI, signer);
  const tx = await contract.safeTransferFrom(from, to, tokenId, amount, '0x');
  return tx.hash;
}

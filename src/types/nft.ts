export interface NFT {
  contractAddress: string;
  tokenId: string;
  name: string;
  image: string;
  collection: string;
  standard: 'ERC-721' | 'ERC-1155';
  balance?: string; // for ERC-1155
}

// Minimal ERC-721 ABI
export const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
];

// Minimal ERC-1155 ABI
export const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function uri(uint256 id) view returns (string)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
];

// ERC-165 interface IDs
export const ERC721_INTERFACE_ID = '0x80ac58cd';
export const ERC1155_INTERFACE_ID = '0xd9b67a26';

// IPFS gateway for resolving ipfs:// URIs
export const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

/**
 * Convert an IPFS URI to an HTTP gateway URL.
 * Handles ipfs://, ipfs://ipfs/, and plain CID prefixes.
 */
export function resolveIpfsUri(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://ipfs/')) {
    return IPFS_GATEWAY + uri.slice('ipfs://ipfs/'.length);
  }
  if (uri.startsWith('ipfs://')) {
    return IPFS_GATEWAY + uri.slice('ipfs://'.length);
  }
  return uri;
}

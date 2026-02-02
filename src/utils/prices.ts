// Token price utilities
// Uses CoinGecko simple price endpoint with a small cache.

const PRICE_CACHE_KEY = 'qfc_price_cache_v1';
const CACHE_TTL_MS = 60 * 1000;
const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
const COINGECKO_API_KEY_KEY = 'qfc_coingecko_api_key_v1';

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  WETH: 'weth',
  USDT: 'tether',
  USDC: 'usd-coin',
};

type PriceCache = {
  updatedAt: number;
  prices: Record<string, number>;
};

const CUSTOM_IDS_KEY = 'qfc_coingecko_ids_v1';

function loadCustomIds(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CUSTOM_IDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [k.toUpperCase(), v])
    );
  } catch {
    return {};
  }
}

export function setCoingeckoApiKey(key: string): void {
  try {
    localStorage.setItem(COINGECKO_API_KEY_KEY, key);
  } catch {
    // ignore
  }
}

function loadApiKey(): string | null {
  try {
    return localStorage.getItem(COINGECKO_API_KEY_KEY);
  } catch {
    return null;
  }
}

export function setCoingeckoId(symbol: string, id: string): void {
  try {
    const existing = loadCustomIds();
    existing[symbol.toUpperCase()] = id;
    localStorage.setItem(CUSTOM_IDS_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

function loadCache(): PriceCache {
  try {
    const raw = localStorage.getItem(PRICE_CACHE_KEY);
    if (!raw) return { updatedAt: 0, prices: {} };
    return JSON.parse(raw) as PriceCache;
  } catch {
    return { updatedAt: 0, prices: {} };
  }
}

function saveCache(cache: PriceCache): void {
  try {
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

/**
 * Get token price in USD
 * Returns null if price is unknown
 */
export function getTokenPrice(symbol: string): number | null {
  const cache = loadCache();
  return cache.prices[symbol.toUpperCase()] ?? null;
}

/**
 * Calculate USD value for a token amount
 */
export function calculateUsdValue(symbol: string, amount: string | number): string {
  const price = getTokenPrice(symbol);
  if (price === null) {
    return '0.00';
  }

  const amountNum = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(amountNum)) {
    return '0.00';
  }

  return (amountNum * price).toFixed(2);
}

/**
 * Format USD value with $ prefix
 */
export function formatUsd(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) {
    return '$0.00';
  }
  return `$${num.toFixed(2)}`;
}

/**
 * Refresh prices from CoinGecko for a set of symbols.
 */
export async function refreshPrices(symbols: string[]): Promise<void> {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const customIds = loadCustomIds();
  const ids = unique
    .map((symbol) => customIds[symbol] || COINGECKO_IDS[symbol])
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return;

  const cache = loadCache();
  const now = Date.now();
  if (now - cache.updatedAt < CACHE_TTL_MS) return;

  const apiKey = loadApiKey();
  const keyParam = apiKey ? `&x_cg_demo_api_key=${encodeURIComponent(apiKey)}` : '';
  const url = `${COINGECKO_API_BASE}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_last_updated_at=true${keyParam}`;
  const response = await fetch(url, apiKey ? { headers: { 'x-cg-demo-api-key': apiKey } } : undefined);
  if (!response.ok) return;

  const data = (await response.json()) as Record<string, { usd?: number }>;
  const prices: Record<string, number> = { ...cache.prices };

  for (const symbol of unique) {
    const id = customIds[symbol] || COINGECKO_IDS[symbol];
    if (!id) continue;
    const price = data[id]?.usd;
    if (typeof price === 'number') {
      prices[symbol] = price;
    }
  }

  saveCache({ updatedAt: now, prices });
}

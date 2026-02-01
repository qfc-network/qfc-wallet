// Token price utilities
// For testnet, we use mock prices. In production, integrate with CoinGecko/CoinMarketCap

// Mock price data (in USD)
const MOCK_PRICES: Record<string, number> = {
  QFC: 2.34,
  USDT: 1.0,
  USDC: 1.0,
  WETH: 3200.0,
  WBTC: 95000.0,
};

/**
 * Get token price in USD
 * Returns null if price is unknown
 */
export function getTokenPrice(symbol: string): number | null {
  return MOCK_PRICES[symbol.toUpperCase()] ?? null;
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
 * Set a custom price (for testing)
 */
export function setMockPrice(symbol: string, price: number): void {
  MOCK_PRICES[symbol.toUpperCase()] = price;
}

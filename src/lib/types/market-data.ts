/**
 * T030: MarketData model and types
 * TypeScript types for market data caching model
 * Based on data-model.md specifications
 */

export interface MarketData {
  id?: string; // UUID, Primary Key - Unique record identifier (optional for requests)
  coin_symbol: string; // Cryptocurrency symbol
  price_source: string; // Data provider (e.g., 'coingecko')
  current_price: number; // Latest price in USD
  price_change_24h: number; // 24-hour price change percentage
  volume_24h: number; // 24-hour trading volume
  market_cap: number; // Current market capitalization
  sentiment_score: number; // Aggregated sentiment indicator (-1 to 1)
  fear_greed_index: number; // Market fear/greed index (0-100)
  last_updated: string; // When data was last refreshed (ISO string)
  historical_data: HistoricalDataPoint[]; // Array of historical price points
  created_at?: string; // Record creation timestamp (ISO string)
}

export interface HistoricalDataPoint {
  timestamp: string; // ISO string
  price: number; // Price at this timestamp
  volume: number; // Volume at this timestamp
  open?: number; // Opening price (for OHLC data)
  high?: number; // High price (for OHLC data)
  low?: number; // Low price (for OHLC data)
  close?: number; // Closing price (for OHLC data)
}

export interface OHLCDataPoint {
  timestamp: string; // ISO string
  open: number; // Opening price
  high: number; // High price
  low: number; // Low price
  close: number; // Closing price
  volume: number; // Trading volume
}

export interface MarketDataRequest {
  coin_symbol: string;
  include_historical?: boolean;
  historical_days?: number; // Number of days of historical data
}

export interface HistoricalDataRequest {
  coin_symbol: string;
  from: string; // Start date (ISO string)
  to: string; // End date (ISO string)
  interval: "1h" | "4h" | "1d"; // Data interval
}

export interface HistoricalDataResponse {
  coin_symbol: string;
  interval: string;
  data: OHLCDataPoint[];
}

export interface PriceAlert {
  coin_symbol: string;
  target_price: number;
  direction: "above" | "below";
  current_price: number;
  created_at: string;
}

export interface MarketSummary {
  coin_symbol: string;
  current_price: number;
  price_change_24h: number;
  market_cap: number;
  volume_24h: number;
  last_updated: string;
}

// Cache configuration
export interface CacheConfig {
  current_price_ttl: number; // TTL in seconds for current price
  historical_data_ttl: number; // TTL in seconds for historical data
  max_historical_points: number; // Maximum historical data points to store
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  current_price_ttl: 30, // 30 seconds
  historical_data_ttl: 3600, // 1 hour
  max_historical_points: 1000
};

// Validation constraints from data-model.md
export const MARKET_DATA_CONSTRAINTS = {
  CURRENT_PRICE: {
    MIN: 0.00000001 // Minimum price
  },
  SENTIMENT_SCORE: {
    MIN: -1,
    MAX: 1
  },
  FEAR_GREED_INDEX: {
    MIN: 0,
    MAX: 100
  },
  HISTORICAL_DAYS: {
    MIN: 1,
    MAX: 365 // Maximum historical data range
  }
} as const;

// Type guards
export function isValidInterval(value: string): value is "1h" | "4h" | "1d" {
  return ["1h", "4h", "1d"].includes(value);
}

export function isValidMarketData(data: any): data is MarketData {
  return (
    typeof data === "object" &&
    typeof data.coin_symbol === "string" &&
    typeof data.price_source === "string" &&
    typeof data.current_price === "number" &&
    data.current_price > MARKET_DATA_CONSTRAINTS.CURRENT_PRICE.MIN &&
    typeof data.price_change_24h === "number" &&
    typeof data.volume_24h === "number" &&
    typeof data.market_cap === "number" &&
    typeof data.sentiment_score === "number" &&
    data.sentiment_score >= MARKET_DATA_CONSTRAINTS.SENTIMENT_SCORE.MIN &&
    data.sentiment_score <= MARKET_DATA_CONSTRAINTS.SENTIMENT_SCORE.MAX &&
    typeof data.fear_greed_index === "number" &&
    data.fear_greed_index >= MARKET_DATA_CONSTRAINTS.FEAR_GREED_INDEX.MIN &&
    data.fear_greed_index <= MARKET_DATA_CONSTRAINTS.FEAR_GREED_INDEX.MAX &&
    typeof data.last_updated === "string" &&
    Array.isArray(data.historical_data)
  );
}

export function isValidHistoricalDataPoint(point: any): point is HistoricalDataPoint {
  return (
    typeof point === "object" &&
    typeof point.timestamp === "string" &&
    typeof point.price === "number" &&
    point.price > 0 &&
    typeof point.volume === "number" &&
    point.volume >= 0
  );
}

export function isValidOHLCDataPoint(point: any): point is OHLCDataPoint {
  return (
    typeof point === "object" &&
    typeof point.timestamp === "string" &&
    typeof point.open === "number" &&
    point.open > 0 &&
    typeof point.high === "number" &&
    point.high > 0 &&
    typeof point.low === "number" &&
    point.low > 0 &&
    typeof point.close === "number" &&
    point.close > 0 &&
    typeof point.volume === "number" &&
    point.volume >= 0 &&
    point.high >= point.open &&
    point.high >= point.close &&
    point.high >= point.low &&
    point.low <= point.open &&
    point.low <= point.close
  );
}

// Validation functions
export function validateCoinSymbol(symbol: string): string | null {
  if (!symbol || typeof symbol !== "string") {
    return "Coin symbol is required";
  }

  if (symbol.length < 2 || symbol.length > 10) {
    return "Coin symbol must be between 2 and 10 characters";
  }

  if (!/^[A-Z0-9]+$/.test(symbol.toUpperCase())) {
    return "Coin symbol must contain only letters and numbers";
  }

  return null;
}

export function validateHistoricalDataRequest(request: HistoricalDataRequest): string | null {
  const symbolError = validateCoinSymbol(request.coin_symbol);
  if (symbolError) return symbolError;

  if (!isValidInterval(request.interval)) {
    return "Invalid interval. Must be 1h, 4h, or 1d";
  }

  const fromDate = new Date(request.from);
  const toDate = new Date(request.to);

  if (isNaN(fromDate.getTime())) {
    return "Invalid from date format";
  }

  if (isNaN(toDate.getTime())) {
    return "Invalid to date format";
  }

  if (fromDate >= toDate) {
    return "From date must be before to date";
  }

  const now = new Date();
  if (fromDate > now) {
    return "From date cannot be in the future";
  }

  if (toDate > now) {
    return "To date cannot be in the future";
  }

  // Check maximum range (1 year)
  const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  if (toDate.getTime() - fromDate.getTime() > maxRangeMs) {
    return "Date range cannot exceed 1 year";
  }

  return null;
}

// Utility functions
export function createMarketData(
  coinSymbol: string,
  priceSource: string,
  currentPrice: number,
  priceChange24h: number,
  volume24h: number,
  marketCap: number,
  sentimentScore: number = 0,
  fearGreedIndex: number = 50,
  historicalData: HistoricalDataPoint[] = []
): Omit<MarketData, "id" | "created_at"> {
  const now = new Date().toISOString();

  return {
    coin_symbol: coinSymbol.toUpperCase(),
    price_source: priceSource,
    current_price: currentPrice,
    price_change_24h: priceChange24h,
    volume_24h: volume24h,
    market_cap: marketCap,
    sentiment_score: Math.max(-1, Math.min(1, sentimentScore)),
    fear_greed_index: Math.max(0, Math.min(100, fearGreedIndex)),
    last_updated: now,
    historical_data: historicalData
  };
}

export function createHistoricalDataPoint(
  timestamp: string,
  price: number,
  volume: number,
  ohlc?: { open: number; high: number; low: number; close: number }
): HistoricalDataPoint {
  const point: HistoricalDataPoint = {
    timestamp,
    price,
    volume
  };

  if (ohlc) {
    point.open = ohlc.open;
    point.high = ohlc.high;
    point.low = ohlc.low;
    point.close = ohlc.close;
  }

  return point;
}

export function createOHLCDataPoint(
  timestamp: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
): OHLCDataPoint {
  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume
  };
}

export function isDataStale(lastUpdated: string, ttlSeconds: number): boolean {
  const lastUpdateTime = new Date(lastUpdated).getTime();
  const now = Date.now();
  const ageSeconds = (now - lastUpdateTime) / 1000;
  return ageSeconds > ttlSeconds;
}

export function calculatePriceChange(
  currentPrice: number,
  previousPrice: number
): { absolute: number; percentage: number } {
  const absolute = currentPrice - previousPrice;
  const percentage = previousPrice > 0 ? (absolute / previousPrice) * 100 : 0;

  return { absolute, percentage };
}

export function generatePriceAlerts(
  marketData: MarketData,
  targetPrices: { above: number[]; below: number[] }
): PriceAlert[] {
  const alerts: PriceAlert[] = [];
  const { current_price, coin_symbol } = marketData;

  // Check for price above targets
  for (const target of targetPrices.above) {
    if (current_price >= target) {
      alerts.push({
        coin_symbol,
        target_price: target,
        direction: "above",
        current_price,
        created_at: new Date().toISOString()
      });
    }
  }

  // Check for price below targets
  for (const target of targetPrices.below) {
    if (current_price <= target) {
      alerts.push({
        coin_symbol,
        target_price: target,
        direction: "below",
        current_price,
        created_at: new Date().toISOString()
      });
    }
  }

  return alerts;
}

export function summarizeMarketData(data: MarketData): MarketSummary {
  return {
    coin_symbol: data.coin_symbol,
    current_price: data.current_price,
    price_change_24h: data.price_change_24h,
    market_cap: data.market_cap,
    volume_24h: data.volume_24h,
    last_updated: data.last_updated
  };
}

export function formatPriceForDisplay(price: number): string {
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 0.01) {
    return `$${price.toFixed(4)}`;
  } else {
    return `$${price.toFixed(8)}`;
  }
}

export function formatVolumeForDisplay(volume: number): string {
  if (volume >= 1e9) {
    return `$${(volume / 1e9).toFixed(1)}B`;
  } else if (volume >= 1e6) {
    return `$${(volume / 1e6).toFixed(1)}M`;
  } else if (volume >= 1e3) {
    return `$${(volume / 1e3).toFixed(1)}K`;
  } else {
    return `$${volume.toFixed(0)}`;
  }
}

export function formatMarketCapForDisplay(marketCap: number): string {
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(1)}T`;
  } else if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(1)}B`;
  } else if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(1)}M`;
  } else {
    return `$${marketCap.toFixed(0)}`;
  }
}
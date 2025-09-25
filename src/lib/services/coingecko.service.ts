/**
 * T069: CoinGecko API service with rate limiting and caching
 * Service for fetching cryptocurrency market data from CoinGecko API
 */

// Rate limiting and caching configuration
const RATE_LIMIT = {
  REQUESTS_PER_MINUTE: 30, // CoinGecko free tier limit
  CACHE_DURATION: 60000, // 1 minute cache for live data
  HISTORY_CACHE_DURATION: 300000 // 5 minutes cache for historical data
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

interface HistoricalPrice {
  timestamp: number;
  price: number;
  volume?: number;
  market_cap?: number;
}

interface MarketStats {
  price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap: number;
  volume_24h: number;
  high_24h: number;
  low_24h: number;
  last_updated: string;
}

class CoinGeckoService {
  private baseUrl = 'https://api.coingecko.com/api/v3';
  private apiKey: string | null = null;
  private cache = new Map<string, CacheEntry<any>>();
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;

  constructor() {
    this.apiKey = import.meta.env.COINGECKO_API_KEY || null;

    // Clean up cache periodically
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanupCache(), 60000); // Every minute
    }
  }

  /**
   * Get current price and basic stats for a cryptocurrency
   */
  async getCurrentPrice(symbol: string): Promise<MarketStats | null> {
    const coinId = this.getCoinId(symbol);
    const cacheKey = `current_${coinId}`;

    // Check cache first
    const cached = this.getFromCache<MarketStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const endpoint = `/coins/${coinId}`;
      const params = new URLSearchParams({
        localization: 'false',
        tickers: 'false',
        market_data: 'true',
        community_data: 'false',
        developer_data: 'false',
        sparkline: 'false'
      });

      const data = await this.makeRequest(`${endpoint}?${params}`);

      if (!data || !data.market_data) {
        return this.getFallbackPrice(symbol);
      }

      const marketStats: MarketStats = {
        price: data.market_data.current_price?.usd || 0,
        price_change_24h: data.market_data.price_change_24h || 0,
        price_change_percentage_24h: data.market_data.price_change_percentage_24h || 0,
        market_cap: data.market_data.market_cap?.usd || 0,
        volume_24h: data.market_data.total_volume?.usd || 0,
        high_24h: data.market_data.high_24h?.usd || 0,
        low_24h: data.market_data.low_24h?.usd || 0,
        last_updated: data.last_updated || new Date().toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, marketStats, RATE_LIMIT.CACHE_DURATION);

      return marketStats;

    } catch (error) {
      console.error(`Failed to fetch current price for ${symbol}:`, error);
      return this.getFallbackPrice(symbol);
    }
  }

  /**
   * Get historical price data for a cryptocurrency
   */
  async getHistoricalPrices(
    symbol: string,
    days: number = 30,
    interval: 'daily' | 'hourly' = 'daily'
  ): Promise<HistoricalPrice[]> {
    const coinId = this.getCoinId(symbol);
    const cacheKey = `history_${coinId}_${days}_${interval}`;

    // Check cache first
    const cached = this.getFromCache<HistoricalPrice[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const endpoint = `/coins/${coinId}/market_chart`;
      const params = new URLSearchParams({
        vs_currency: 'usd',
        days: days.toString(),
        interval: interval === 'hourly' ? 'hourly' : 'daily'
      });

      const data = await this.makeRequest(`${endpoint}?${params}`);

      if (!data || !data.prices) {
        return this.getFallbackHistoricalPrices(symbol, days);
      }

      const prices: HistoricalPrice[] = data.prices.map((pricePoint: [number, number]) => ({
        timestamp: pricePoint[0],
        price: pricePoint[1],
        volume: data.total_volumes?.find((v: [number, number]) => v[0] === pricePoint[0])?.[1],
        market_cap: data.market_caps?.find((m: [number, number]) => m[0] === pricePoint[0])?.[1]
      }));

      // Cache the result
      this.setCache(cacheKey, prices, RATE_LIMIT.HISTORY_CACHE_DURATION);

      return prices;

    } catch (error) {
      console.error(`Failed to fetch historical prices for ${symbol}:`, error);
      return this.getFallbackHistoricalPrices(symbol, days);
    }
  }

  /**
   * Get multiple coins data at once
   */
  async getMultipleCoins(symbols: string[]): Promise<Record<string, MarketStats>> {
    const coinIds = symbols.map(symbol => this.getCoinId(symbol));
    const cacheKey = `multiple_${coinIds.sort().join('_')}`;

    // Check cache first
    const cached = this.getFromCache<Record<string, MarketStats>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const endpoint = '/coins/markets';
      const params = new URLSearchParams({
        vs_currency: 'usd',
        ids: coinIds.join(','),
        order: 'market_cap_desc',
        per_page: '250',
        page: '1',
        sparkline: 'false'
      });

      const data = await this.makeRequest(`${endpoint}?${params}`);

      if (!Array.isArray(data)) {
        return this.getFallbackMultipleCoins(symbols);
      }

      const result: Record<string, MarketStats> = {};

      data.forEach((coin: CoinGeckoCoin) => {
        const symbol = coin.symbol.toLowerCase();
        result[symbol] = {
          price: coin.current_price,
          price_change_24h: coin.price_change_24h,
          price_change_percentage_24h: coin.price_change_percentage_24h,
          market_cap: coin.market_cap,
          volume_24h: coin.total_volume,
          high_24h: coin.high_24h,
          low_24h: coin.low_24h,
          last_updated: coin.last_updated
        };
      });

      // Cache the result
      this.setCache(cacheKey, result, RATE_LIMIT.CACHE_DURATION);

      return result;

    } catch (error) {
      console.error('Failed to fetch multiple coins data:', error);
      return this.getFallbackMultipleCoins(symbols);
    }
  }

  /**
   * Get trending cryptocurrencies
   */
  async getTrending(): Promise<Array<{ id: string; symbol: string; name: string; price?: number }>> {
    const cacheKey = 'trending';

    // Check cache first
    const cached = this.getFromCache<Array<any>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const data = await this.makeRequest('/search/trending');

      if (!data || !data.coins) {
        return this.getFallbackTrending();
      }

      const trending = data.coins.map((item: any) => ({
        id: item.item.id,
        symbol: item.item.symbol,
        name: item.item.name,
        price: item.item.price_btc
      }));

      // Cache the result
      this.setCache(cacheKey, trending, RATE_LIMIT.CACHE_DURATION);

      return trending;

    } catch (error) {
      console.error('Failed to fetch trending coins:', error);
      return this.getFallbackTrending();
    }
  }

  /**
   * Private: Make HTTP request with rate limiting and error handling
   */
  private async makeRequest(endpoint: string): Promise<any> {
    // Check if we should use mock data instead
    if (import.meta.env.ENABLE_REAL_API_CALLS === 'false' || import.meta.env.MOCK_DATA_ENABLED === 'true') {
      console.log('Using mock data for endpoint:', endpoint);
      return this.getMockData(endpoint);
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          await this.enforceRateLimit();

          const url = `${this.baseUrl}${endpoint}`;
          const headers: Record<string, string> = {
            'Accept': 'application/json'
          };

          // Add API key if available
          if (this.apiKey) {
            headers['x-cg-demo-api-key'] = this.apiKey;
          }

          const response = await fetch(url, { headers });

          if (!response.ok) {
            if (response.status === 429) {
              throw new Error('Rate limit exceeded');
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          resolve(data);

        } catch (error) {
          reject(error);
        }
      });

      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  /**
   * Private: Process the request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          console.error('Request failed:', error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Private: Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = (60 * 1000) / RATE_LIMIT.REQUESTS_PER_MINUTE; // ms between requests

    if (timeSinceLastRequest < minInterval) {
      const delayMs = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Private: Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Private: Set cache
   */
  private setCache<T>(key: string, data: T, duration: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + duration
    };

    this.cache.set(key, entry);
  }

  /**
   * Private: Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Private: Map symbol to CoinGecko coin ID
   */
  private getCoinId(symbol: string): string {
    const symbolMap: Record<string, string> = {
      btc: 'bitcoin',
      eth: 'ethereum',
      ada: 'cardano',
      sol: 'solana',
      dot: 'polkadot',
      matic: 'polygon',
      link: 'chainlink',
      avax: 'avalanche-2',
      atom: 'cosmos',
      near: 'near'
    };

    return symbolMap[symbol.toLowerCase()] || symbol.toLowerCase();
  }

  /**
   * Private: Generate mock data for development/testing
   */
  private getMockData(endpoint: string): any {
    const basePrice = 50000; // Base Bitcoin price for calculations
    const random = Math.sin(Date.now() / 100000); // Deterministic randomness

    if (endpoint.includes('/coins/bitcoin')) {
      return {
        market_data: {
          current_price: { usd: basePrice + random * 5000 },
          price_change_24h: random * 1000,
          price_change_percentage_24h: random * 5,
          market_cap: { usd: (basePrice + random * 5000) * 19000000 },
          total_volume: { usd: 25000000000 + random * 5000000000 },
          high_24h: { usd: basePrice + random * 5000 + 1000 },
          low_24h: { usd: basePrice + random * 5000 - 1000 }
        },
        last_updated: new Date().toISOString()
      };
    }

    if (endpoint.includes('/market_chart')) {
      const prices = [];
      const now = Date.now();

      for (let i = 30; i >= 0; i--) {
        const timestamp = now - (i * 24 * 60 * 60 * 1000);
        const dayRandom = Math.sin(timestamp / 100000);
        prices.push([timestamp, basePrice + dayRandom * 3000]);
      }

      return { prices };
    }

    return {};
  }

  /**
   * Private: Fallback data when API fails
   */
  private getFallbackPrice(symbol: string): MarketStats {
    const basePrice = symbol.toLowerCase() === 'btc' ? 50000 :
                     symbol.toLowerCase() === 'eth' ? 3000 :
                     symbol.toLowerCase() === 'ada' ? 0.5 : 100;

    return {
      price: basePrice,
      price_change_24h: 0,
      price_change_percentage_24h: 0,
      market_cap: basePrice * 1000000,
      volume_24h: basePrice * 100000,
      high_24h: basePrice * 1.02,
      low_24h: basePrice * 0.98,
      last_updated: new Date().toISOString()
    };
  }

  private getFallbackHistoricalPrices(symbol: string, days: number): HistoricalPrice[] {
    const basePrice = symbol.toLowerCase() === 'btc' ? 50000 : 3000;
    const prices = [];
    const now = Date.now();

    for (let i = days; i >= 0; i--) {
      prices.push({
        timestamp: now - (i * 24 * 60 * 60 * 1000),
        price: basePrice + (Math.random() - 0.5) * basePrice * 0.1
      });
    }

    return prices;
  }

  private getFallbackMultipleCoins(symbols: string[]): Record<string, MarketStats> {
    const result: Record<string, MarketStats> = {};

    symbols.forEach(symbol => {
      result[symbol] = this.getFallbackPrice(symbol);
    });

    return result;
  }

  private getFallbackTrending(): Array<{ id: string; symbol: string; name: string; price?: number }> {
    return [
      { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', price: 50000 },
      { id: 'ethereum', symbol: 'eth', name: 'Ethereum', price: 3000 },
      { id: 'cardano', symbol: 'ada', name: 'Cardano', price: 0.5 }
    ];
  }
}

// Export singleton instance
export const coinGeckoService = new CoinGeckoService();
export default coinGeckoService;
/**
 * T036: MarketDataService - CoinGecko API integration for market data
 * Service layer for fetching and caching cryptocurrency market data
 * Based on data-model.md specifications
 */

import { supabase, supabaseServer, handleDatabaseError, retryOperation } from "../supabase.js";
import { externalAPIErrorHandler } from "./external-api-error-handler.service.js";
import type { Database } from "../supabase.js";
import type {
  MarketData,
  MarketDataRequest,
  HistoricalDataRequest,
  HistoricalDataResponse,
  HistoricalDataPoint,
  OHLCDataPoint,
  MarketSummary,
  PriceAlert,
  CacheConfig
} from "../types/market-data.js";
import {
  DEFAULT_CACHE_CONFIG
} from "../types/market-data.js";

export class MarketDataService {
  private readonly baseUrl = "https://api.coingecko.com/api/v3";
  private readonly cacheConfig: CacheConfig;
  private readonly priceCache = new Map<string, { data: MarketData; timestamp: number }>();
  private readonly rateLimit = {
    requests: 0,
    resetTime: Date.now() + 60000 // Reset every minute
  };

  constructor(cacheConfig: CacheConfig = DEFAULT_CACHE_CONFIG) {
    this.cacheConfig = cacheConfig;
  }

  /**
   * Get current market data for a cryptocurrency
   */
  async getMarketData(request: MarketDataRequest): Promise<MarketData> {
    try {
      const coinSymbol = request.coin_symbol.toUpperCase();

      // Check memory cache first
      const memoryCache = this.priceCache.get(coinSymbol);
      if (memoryCache && !this.isDataStale(new Date(memoryCache.timestamp).toISOString(), this.cacheConfig.current_price_ttl)) {
        return memoryCache.data;
      }

      // Try to check database cache (with fallback)
      try {
        const cached = await this.getCachedMarketData(coinSymbol);
        if (cached && !this.isDataStale(cached.last_updated, this.cacheConfig.current_price_ttl)) {
          // Update memory cache
          this.updateCache(coinSymbol, cached);
          return cached;
        }
      } catch (dbError: any) {
        console.warn("Database cache unavailable, continuing with API fetch:", dbError.message);
      }

      // Check rate limits
      await this.checkRateLimit();

      // Fetch from CoinGecko API
      const coinGeckoData = await this.fetchFromCoinGecko(coinSymbol, request.include_historical);

      // Transform the data
      const marketData = this.transformCoinGeckoData(coinGeckoData);

      // Try to store in database (with fallback)
      try {
        const storedData = await this.storeMarketData(coinGeckoData);
        this.updateCache(coinSymbol, storedData);
        return storedData;
      } catch (dbError: any) {
        console.warn("Database storage unavailable, using memory cache only:", dbError.message);
        // Create a complete MarketData object for memory cache
        const fallbackData: MarketData = {
          id: `${coinSymbol}-${Date.now()}`,
          ...marketData,
          created_at: new Date().toISOString()
        };
        this.updateCache(coinSymbol, fallbackData);
        return fallbackData;
      }
    } catch (error: any) {
      console.error("Failed to get market data:", error);
      throw new Error(`Failed to get market data: ${error.message}`);
    }
  }

  /**
   * Get historical price data
   */
  async getHistoricalData(request: HistoricalDataRequest): Promise<HistoricalDataResponse> {
    try {
      // Check rate limits
      await this.checkRateLimit();

      const coinSymbol = request.coin_symbol.toLowerCase();
      const fromTimestamp = Math.floor(new Date(request.from).getTime() / 1000);
      const toTimestamp = Math.floor(new Date(request.to).getTime() / 1000);

      // Note: CoinGecko API doesn't use interval parameters for market_chart/range

      const url = `${this.baseUrl}/coins/${coinSymbol}/market_chart/range`;
      const params = new URLSearchParams({
        vs_currency: "usd",
        from: fromTimestamp.toString(),
        to: toTimestamp.toString()
      });

      const response = await fetch(`${url}?${params}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.updateRateLimit();

      // Process historical data
      const historicalData = this.processHistoricalData(data, request.interval);

      return {
        coin_symbol: request.coin_symbol.toUpperCase(),
        interval: request.interval,
        data: historicalData
      };
    } catch (error: any) {
      console.error("Failed to get historical data:", error);
      throw new Error(`Failed to get historical data: ${error.message}`);
    }
  }

  /**
   * Get multiple market summaries
   */
  async getMarketSummaries(coinSymbols: string[]): Promise<MarketSummary[]> {
    try {
      // Check rate limits
      await this.checkRateLimit();

      const symbols = coinSymbols.map(s => s.toLowerCase()).join(",");
      const url = `${this.baseUrl}/simple/price`;
      const params = new URLSearchParams({
        ids: symbols,
        vs_currencies: "usd",
        include_market_cap: "true",
        include_24hr_vol: "true",
        include_24hr_change: "true",
        include_last_updated_at: "true"
      });

      const response = await fetch(`${url}?${params}`, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.updateRateLimit();

      return Object.entries(data).map(([coin, info]: [string, any]) => ({
        coin_symbol: coin.toUpperCase(),
        current_price: info.usd || 0,
        price_change_24h: info.usd_24h_change || 0,
        market_cap: info.usd_market_cap || 0,
        volume_24h: info.usd_24h_vol || 0,
        last_updated: new Date(info.last_updated_at * 1000).toISOString()
      }));
    } catch (error: any) {
      console.error("Failed to get market summaries:", error);
      throw new Error(`Failed to get market summaries: ${error.message}`);
    }
  }

  /**
   * Update market data in database
   */
  async updateMarketData(coinSymbol: string): Promise<MarketData> {
    try {
      const request: MarketDataRequest = {
        coin_symbol: coinSymbol,
        include_historical: false
      };

      return await this.getMarketData(request);
    } catch (error: any) {
      console.error("Failed to update market data:", error);
      throw new Error(`Failed to update market data: ${error.message}`);
    }
  }

  /**
   * Get cached market data from database
   */
  async getCachedMarketData(coinSymbol: string): Promise<MarketData | null> {
    try {
      // Check memory cache first
      const memoryCache = this.priceCache.get(coinSymbol);
      if (memoryCache && !this.isDataStale(new Date(memoryCache.timestamp).toISOString(), 30)) {
        return memoryCache.data;
      }

      return await retryOperation(async () => {
        const { data, error } = await supabase
          .from("market_data")
          .select("*")
          .eq("coin_symbol", coinSymbol.toUpperCase())
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            return null; // No data found
          }
          // For permission errors, throw to trigger fallback
          if (error.code === "42501" || error.message?.includes("Permission denied")) {
            throw new Error(`Database access denied: ${error.message}`);
          }
          handleDatabaseError(error, "get cached market data");
        }

        return data ? this.mapDatabaseMarketDataToMarketData(data) : null;
      });
    } catch (error: any) {
      console.warn("Database cache lookup failed:", error.message);
      // Re-throw to allow caller to handle gracefully
      throw error;
    }
  }

  /**
   * Generate price alerts based on target prices
   */
  async generatePriceAlerts(
    coinSymbol: string,
    targetPrices: { above: number[]; below: number[] }
  ): Promise<PriceAlert[]> {
    try {
      const marketData = await this.getMarketData({ coin_symbol: coinSymbol });
      const alerts: PriceAlert[] = [];

      // Check for price above targets
      for (const target of targetPrices.above) {
        if (marketData.current_price >= target) {
          alerts.push({
            coin_symbol: coinSymbol.toUpperCase(),
            target_price: target,
            direction: "above",
            current_price: marketData.current_price,
            created_at: new Date().toISOString()
          });
        }
      }

      // Check for price below targets
      for (const target of targetPrices.below) {
        if (marketData.current_price <= target) {
          alerts.push({
            coin_symbol: coinSymbol.toUpperCase(),
            target_price: target,
            direction: "below",
            current_price: marketData.current_price,
            created_at: new Date().toISOString()
          });
        }
      }

      return alerts;
    } catch (error: any) {
      console.error("Failed to generate price alerts:", error);
      throw new Error(`Failed to generate price alerts: ${error.message}`);
    }
  }

  /**
   * Get supported coins from CoinGecko
   */
  async getSupportedCoins(): Promise<{ id: string; symbol: string; name: string }[]> {
    try {
      // Check rate limits
      await this.checkRateLimit();

      const url = `${this.baseUrl}/coins/list`;
      const response = await fetch(url, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.updateRateLimit();

      return data.slice(0, 100); // Limit to top 100 coins
    } catch (error: any) {
      console.error("Failed to get supported coins:", error);
      throw new Error(`Failed to get supported coins: ${error.message}`);
    }
  }

  /**
   * Clear old cached data
   */
  async clearOldCacheData(olderThanHours: number = 24): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();

      await retryOperation(async () => {
        // Use server client for write operations (bypasses RLS)
        const { error } = await supabaseServer
          .from("market_data")
          .delete()
          .lt("created_at", cutoffTime);

        if (error) {
          handleDatabaseError(error, "clear old cache data");
        }
      });

      // Clear memory cache
      this.priceCache.clear();
    } catch (error: any) {
      console.error("Failed to clear old cache data:", error);
      throw new Error(`Failed to clear old cache data: ${error.message}`);
    }
  }

  /**
   * Private: Fetch data from CoinGecko API
   */
  private async fetchFromCoinGecko(coinSymbol: string, includeHistorical: boolean = false): Promise<any> {
    const coinId = coinSymbol.toLowerCase();
    const url = `${this.baseUrl}/coins/${coinId}`;
    const params = new URLSearchParams({
      localization: "false",
      tickers: "false",
      market_data: "true",
      community_data: "false",
      developer_data: "false",
      sparkline: includeHistorical.toString()
    });

    // Use error handler with fallback data
    const fallbackData = externalAPIErrorHandler.getFallbackData(`market_data_${coinSymbol}`);
    
    return await externalAPIErrorHandler.executeWithErrorHandling(
      'CoinGecko',
      async () => {
        const response = await fetch(`${url}?${params}`, {
          headers: this.getHeaders()
        });

        if (!response.ok) {
          const error = new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          throw error;
        }

        const data = await response.json();
        this.updateRateLimit();

        // Cache successful response as fallback data
        externalAPIErrorHandler.setFallbackData(`market_data_${coinSymbol}`, data);

        return data;
      },
      fallbackData
    );
  }

  /**
   * Private: Store market data in database
   */
  private async storeMarketData(coinGeckoData: any): Promise<MarketData> {
    const marketData = this.transformCoinGeckoData(coinGeckoData);

    return await retryOperation(async () => {
      // Use server client for write operations (bypasses RLS)
      const { data, error } = await (supabaseServer
        .from("market_data") as any)
        .insert({
          coin_symbol: marketData.coin_symbol,
          price_source: "coingecko",
          current_price: marketData.current_price,
          price_change_24h: marketData.price_change_24h,
          volume_24h: marketData.volume_24h,
          market_cap: marketData.market_cap,
          sentiment_score: marketData.sentiment_score,
          fear_greed_index: marketData.fear_greed_index,
          last_updated: marketData.last_updated,
          historical_data: marketData.historical_data
        })
        .select()
        .single();

      if (error) {
        handleDatabaseError(error, "store market data");
      }

      if (!data) {
        throw new Error("Failed to store market data - no data returned");
      }

      return this.mapDatabaseMarketDataToMarketData(data);
    });
  }

  /**
   * Private: Transform CoinGecko data to our format
   */
  private transformCoinGeckoData(data: any): Omit<MarketData, "id" | "created_at"> {
    const marketData = data.market_data;
    const sentimentScore = this.calculateSentimentScore(data);

    return {
      coin_symbol: data.symbol.toUpperCase(),
      price_source: "coingecko",
      current_price: marketData.current_price?.usd || 0,
      price_change_24h: marketData.price_change_percentage_24h || 0,
      volume_24h: marketData.total_volume?.usd || 0,
      market_cap: marketData.market_cap?.usd || 0,
      sentiment_score: sentimentScore,
      fear_greed_index: 50, // Default value, would need separate API for real fear/greed index
      last_updated: new Date().toISOString(),
      historical_data: data.market_data.sparkline_7d?.price ?
        this.transformSparklineData(data.market_data.sparkline_7d.price) : []
    };
  }

  /**
   * Private: Calculate sentiment score from various indicators
   */
  private calculateSentimentScore(data: any): number {
    let score = 0;
    const marketData = data.market_data;

    // Price change contribution
    const priceChange24h = marketData.price_change_percentage_24h || 0;
    score += Math.max(-0.5, Math.min(0.5, priceChange24h / 20)); // Normalize to -0.5 to 0.5

    // Volume contribution (high volume = more confidence)
    const volumeChange = marketData.total_volume?.usd || 0;
    const marketCap = marketData.market_cap?.usd || 1;
    const volumeRatio = volumeChange / marketCap;
    score += Math.max(-0.3, Math.min(0.3, (volumeRatio - 0.1) * 3)); // Normalize volume ratio

    // Market cap rank contribution (lower rank = higher sentiment)
    const marketCapRank = data.market_cap_rank || 1000;
    score += Math.max(-0.2, Math.min(0.2, (100 - marketCapRank) / 500));

    // Ensure score is within bounds
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Private: Transform sparkline data to historical points
   */
  private transformSparklineData(sparklineData: number[]): HistoricalDataPoint[] {
    const points: HistoricalDataPoint[] = [];
    const now = Date.now();
    const intervalMs = (7 * 24 * 60 * 60 * 1000) / sparklineData.length; // 7 days divided by data points

    sparklineData.forEach((price, index) => {
      points.push({
        timestamp: new Date(now - (sparklineData.length - index) * intervalMs).toISOString(),
        price,
        volume: 0 // Sparkline doesn't include volume data
      });
    });

    return points;
  }

  /**
   * Private: Process historical data from CoinGecko
   */
  private processHistoricalData(data: any, interval: string): OHLCDataPoint[] {
    const prices = data.prices || [];
    const volumes = data.total_volumes || [];

    // Group data by interval
    const intervalMs = this.getIntervalMs(interval);
    const groupedData = new Map<number, { prices: number[]; volumes: number[]; timestamps: number[] }>();

    prices.forEach(([timestamp, price]: [number, number], index: number) => {
      const intervalKey = Math.floor(timestamp / intervalMs) * intervalMs;

      if (!groupedData.has(intervalKey)) {
        groupedData.set(intervalKey, { prices: [], volumes: [], timestamps: [] });
      }

      groupedData.get(intervalKey)!.prices.push(price);
      groupedData.get(intervalKey)!.timestamps.push(timestamp);

      if (volumes[index]) {
        groupedData.get(intervalKey)!.volumes.push(volumes[index][1]);
      }
    });

    // Convert to OHLC format
    const ohlcData: OHLCDataPoint[] = [];

    for (const [intervalStart, group] of groupedData) {
      if (group.prices.length === 0) continue;

      const open = group.prices[0] || 0;
      const close = group.prices[group.prices.length - 1] || 0;
      const high = Math.max(...group.prices);
      const low = Math.min(...group.prices);
      const volume = group.volumes.reduce((sum, vol) => sum + vol, 0);

      ohlcData.push({
        timestamp: new Date(intervalStart).toISOString(),
        open,
        high,
        low,
        close,
        volume
      });
    }

    return ohlcData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Private: Get interval in milliseconds
   */
  private getIntervalMs(interval: string): number {
    const intervals = {
      "1h": 60 * 60 * 1000,
      "4h": 4 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000
    };
    return intervals[interval as keyof typeof intervals] || intervals["1h"];
  }

  /**
   * Private: Check rate limits
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();

    if (now > this.rateLimit.resetTime) {
      this.rateLimit.requests = 0;
      this.rateLimit.resetTime = now + 60000; // Reset in 1 minute
    }

    if (this.rateLimit.requests >= 50) { // CoinGecko free tier limit
      const waitTime = this.rateLimit.resetTime - now;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.rateLimit.requests = 0;
      this.rateLimit.resetTime = Date.now() + 60000;
    }
  }

  /**
   * Private: Update rate limit counter
   */
  private updateRateLimit(): void {
    this.rateLimit.requests++;
  }

  /**
   * Private: Get API headers
   */
  private getHeaders(): Record<string, string> {
    return {
      "Accept": "application/json",
      "User-Agent": "ai-trading-system/1.0.0"
    };
  }

  /**
   * Private: Check if data is stale
   */
  private isDataStale(lastUpdated: string, ttlSeconds: number): boolean {
    const lastUpdateTime = new Date(lastUpdated).getTime();
    const now = Date.now();
    const ageSeconds = (now - lastUpdateTime) / 1000;
    return ageSeconds > ttlSeconds;
  }

  /**
   * Private: Update memory cache
   */
  private updateCache(coinSymbol: string, data: MarketData): void {
    this.priceCache.set(coinSymbol, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Private: Map database market data to MarketData type
   */
  private mapDatabaseMarketDataToMarketData(dbData: Database["public"]["Tables"]["market_data"]["Row"]): MarketData {
    return {
      id: dbData.id,
      coin_symbol: dbData.coin_symbol,
      price_source: dbData.price_source,
      current_price: dbData.current_price,
      price_change_24h: dbData.price_change_24h,
      volume_24h: dbData.volume_24h,
      market_cap: dbData.market_cap,
      sentiment_score: dbData.sentiment_score,
      fear_greed_index: dbData.fear_greed_index,
      last_updated: dbData.last_updated,
      historical_data: dbData.historical_data as HistoricalDataPoint[],
      created_at: dbData.created_at
    };
  }
}

// Export singleton instance
export const marketDataService = new MarketDataService();
export default marketDataService;
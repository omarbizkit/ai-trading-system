/**
 * T067: Real-time price updates with polling mechanism
 * Service for monitoring cryptocurrency prices with configurable polling intervals
 */

import { coinGeckoService } from './coingecko.service';
import { tradingStore } from '../stores/trading-store';
import type { MarketStats } from './coingecko.service';

export interface PriceUpdateConfig {
  symbols: string[];
  interval: number; // milliseconds
  retryAttempts: number;
  retryDelay: number;
  onUpdate?: (symbol: string, data: MarketStats) => void;
  onError?: (symbol: string, error: Error) => void;
}

export interface PriceMonitorStats {
  isRunning: boolean;
  updateCount: number;
  errorCount: number;
  lastUpdate: string;
  nextUpdate: string;
  subscribedSymbols: string[];
}

class PriceMonitorService {
  private intervalId: number | null = null;
  private config: PriceUpdateConfig;
  private stats: PriceMonitorStats;
  private updateQueue: Set<string> = new Set();
  private isUpdating = false;

  constructor() {
    this.config = {
      symbols: ['btc', 'eth', 'ada', 'sol'],
      interval: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 5000
    };

    this.stats = {
      isRunning: false,
      updateCount: 0,
      errorCount: 0,
      lastUpdate: '',
      nextUpdate: '',
      subscribedSymbols: []
    };
  }

  /**
   * Start price monitoring
   */
  start(config?: Partial<PriceUpdateConfig>): void {
    if (this.intervalId !== null) {
      console.log('Price monitor already running');
      return;
    }

    // Update configuration
    this.config = { ...this.config, ...config };

    // Initialize stats
    this.stats = {
      ...this.stats,
      isRunning: true,
      subscribedSymbols: [...this.config.symbols],
      nextUpdate: new Date(Date.now() + this.config.interval).toISOString()
    };

    // Start polling
    this.intervalId = window.setInterval(() => {
      this.performUpdate();
    }, this.config.interval);

    // Perform initial update
    this.performUpdate();

    console.log(`Price monitor started with ${this.config.symbols.length} symbols, interval: ${this.config.interval}ms`);
  }

  /**
   * Stop price monitoring
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.stats.isRunning = false;
    this.updateQueue.clear();
    this.isUpdating = false;

    console.log('Price monitor stopped');
  }

  /**
   * Add symbol to monitoring
   */
  addSymbol(symbol: string): void {
    const normalizedSymbol = symbol.toLowerCase();

    if (!this.config.symbols.includes(normalizedSymbol)) {
      this.config.symbols.push(normalizedSymbol);
      this.stats.subscribedSymbols = [...this.config.symbols];

      // Immediately update the new symbol
      if (this.stats.isRunning) {
        this.updateQueue.add(normalizedSymbol);
        this.performSingleUpdate(normalizedSymbol);
      }

      console.log(`Added symbol to price monitor: ${normalizedSymbol}`);
    }
  }

  /**
   * Remove symbol from monitoring
   */
  removeSymbol(symbol: string): void {
    const normalizedSymbol = symbol.toLowerCase();
    const index = this.config.symbols.indexOf(normalizedSymbol);

    if (index > -1) {
      this.config.symbols.splice(index, 1);
      this.stats.subscribedSymbols = [...this.config.symbols];
      this.updateQueue.delete(normalizedSymbol);

      console.log(`Removed symbol from price monitor: ${normalizedSymbol}`);
    }
  }

  /**
   * Update monitoring interval
   */
  setInterval(interval: number): void {
    if (interval < 5000) {
      console.warn('Minimum interval is 5 seconds to respect rate limits');
      interval = 5000;
    }

    this.config.interval = interval;

    // Restart if currently running
    if (this.stats.isRunning) {
      this.stop();
      this.start();
    }

    console.log(`Price monitor interval updated: ${interval}ms`);
  }

  /**
   * Force immediate update of all symbols
   */
  async forceUpdate(): Promise<void> {
    if (this.isUpdating) {
      console.log('Update already in progress');
      return;
    }

    console.log('Forcing price update for all symbols...');
    await this.performUpdate();
  }

  /**
   * Force immediate update of specific symbol
   */
  async forceUpdateSymbol(symbol: string): Promise<void> {
    const normalizedSymbol = symbol.toLowerCase();
    console.log(`Forcing price update for ${normalizedSymbol}...`);
    await this.performSingleUpdate(normalizedSymbol);
  }

  /**
   * Get current monitoring statistics
   */
  getStats(): PriceMonitorStats {
    return { ...this.stats };
  }

  /**
   * Get current configuration
   */
  getConfig(): PriceUpdateConfig {
    return { ...this.config };
  }

  /**
   * Check if monitoring is active
   */
  isActive(): boolean {
    return this.stats.isRunning;
  }

  /**
   * Set custom update callback
   */
  setUpdateCallback(callback: (symbol: string, data: MarketStats) => void): void {
    this.config.onUpdate = callback;
  }

  /**
   * Set custom error callback
   */
  setErrorCallback(callback: (symbol: string, error: Error) => void): void {
    this.config.onError = callback;
  }

  /**
   * Private: Perform batch update of all symbols
   */
  private async performUpdate(): Promise<void> {
    if (this.isUpdating) {
      console.log('Update already in progress, skipping...');
      return;
    }

    this.isUpdating = true;

    try {
      // Get multiple coins data efficiently
      const marketData = await coinGeckoService.getMultipleCoins(this.config.symbols);

      // Process each symbol
      for (const [symbol, data] of Object.entries(marketData)) {
        this.processMarketData(symbol, data);
      }

      // Update stats
      this.stats.updateCount++;
      this.stats.lastUpdate = new Date().toISOString();
      this.stats.nextUpdate = new Date(Date.now() + this.config.interval).toISOString();

      console.log(`Price monitor updated ${Object.keys(marketData).length} symbols`);

    } catch (error) {
      console.error('Failed to update prices:', error);
      this.stats.errorCount++;

      // Fallback to individual updates
      await this.performFallbackUpdate();
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Private: Perform single symbol update
   */
  private async performSingleUpdate(symbol: string): Promise<void> {
    try {
      const data = await coinGeckoService.getCurrentPrice(symbol);

      if (data) {
        this.processMarketData(symbol, data);
        console.log(`Updated price for ${symbol}: $${data.price}`);
      }

    } catch (error) {
      console.error(`Failed to update price for ${symbol}:`, error);
      this.stats.errorCount++;

      if (this.config.onError) {
        this.config.onError(symbol, error as Error);
      }
    }
  }

  /**
   * Private: Fallback to individual updates if batch fails
   */
  private async performFallbackUpdate(): Promise<void> {
    console.log('Performing fallback individual updates...');

    for (const symbol of this.config.symbols) {
      try {
        await this.performSingleUpdate(symbol);
        // Add small delay between requests to respect rate limits
        await this.delay(200);
      } catch (error) {
        console.error(`Fallback update failed for ${symbol}:`, error);
      }
    }
  }

  /**
   * Private: Process and distribute market data
   */
  private processMarketData(symbol: string, data: MarketStats): void {
    // Update trading store
    tradingStore.updateMarketData(symbol, {
      price: data.price,
      change_24h: data.price_change_percentage_24h,
      volume: data.volume_24h
    });

    // Call custom update callback if provided
    if (this.config.onUpdate) {
      this.config.onUpdate(symbol, data);
    }

    // Emit custom event for components to listen to
    this.emitPriceUpdateEvent(symbol, data);
  }

  /**
   * Private: Emit custom price update event
   */
  private emitPriceUpdateEvent(symbol: string, data: MarketStats): void {
    if (typeof window === 'undefined') return;

    const event = new CustomEvent('priceUpdate', {
      detail: { symbol, data }
    });

    window.dispatchEvent(event);
  }

  /**
   * Private: Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Auto-restart monitoring on page visibility change
   */
  private setupVisibilityHandling(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.stats.isRunning) {
        // Page became visible, force an immediate update
        this.forceUpdate();
      }
    });
  }

  /**
   * Setup network connectivity monitoring
   */
  private setupNetworkHandling(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      if (this.stats.isRunning) {
        console.log('Network connection restored, resuming price monitoring...');
        this.forceUpdate();
      }
    });

    window.addEventListener('offline', () => {
      console.log('Network connection lost, price monitoring will retry when online');
    });
  }

  /**
   * Initialize automatic restart features
   */
  initializeAutoFeatures(): void {
    this.setupVisibilityHandling();
    this.setupNetworkHandling();
  }

  /**
   * Destroy service and clean up resources
   */
  destroy(): void {
    this.stop();
    this.updateQueue.clear();
    this.config.onUpdate = undefined;
    this.config.onError = undefined;
  }
}

// Export singleton instance
export const priceMonitorService = new PriceMonitorService();

// Initialize auto features
priceMonitorService.initializeAutoFeatures();

export default priceMonitorService;

// Helper function for components
export const usePriceMonitor = () => {
  return {
    start: (config?: Partial<PriceUpdateConfig>) => priceMonitorService.start(config),
    stop: () => priceMonitorService.stop(),
    addSymbol: (symbol: string) => priceMonitorService.addSymbol(symbol),
    removeSymbol: (symbol: string) => priceMonitorService.removeSymbol(symbol),
    setInterval: (interval: number) => priceMonitorService.setInterval(interval),
    forceUpdate: () => priceMonitorService.forceUpdate(),
    forceUpdateSymbol: (symbol: string) => priceMonitorService.forceUpdateSymbol(symbol),
    getStats: () => priceMonitorService.getStats(),
    getConfig: () => priceMonitorService.getConfig(),
    isActive: () => priceMonitorService.isActive(),
    setUpdateCallback: (callback: (symbol: string, data: MarketStats) => void) =>
      priceMonitorService.setUpdateCallback(callback),
    setErrorCallback: (callback: (symbol: string, error: Error) => void) =>
      priceMonitorService.setErrorCallback(callback)
  };
};

// Event listener helper for components
export const addPriceUpdateListener = (
  callback: (symbol: string, data: MarketStats) => void
): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const handlePriceUpdate = (event: CustomEvent) => {
    callback(event.detail.symbol, event.detail.data);
  };

  window.addEventListener('priceUpdate', handlePriceUpdate as EventListener);

  // Return cleanup function
  return () => {
    window.removeEventListener('priceUpdate', handlePriceUpdate as EventListener);
  };
};

// Presets for different update frequencies
export const PRICE_MONITOR_PRESETS = {
  REAL_TIME: { interval: 5000, retryAttempts: 5 }, // 5 seconds
  ACTIVE: { interval: 15000, retryAttempts: 3 }, // 15 seconds
  NORMAL: { interval: 30000, retryAttempts: 3 }, // 30 seconds
  CONSERVATIVE: { interval: 60000, retryAttempts: 2 }, // 1 minute
  MINIMAL: { interval: 300000, retryAttempts: 1 } // 5 minutes
} as const;
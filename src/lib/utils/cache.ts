/**
 * T063: API Response Caching Strategies
 * Implements production-ready caching for API responses
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  tags?: string[]; // For cache invalidation
}

interface CacheConfig {
  defaultTTL: number;
  maxSize: number;
  enableLogging: boolean;
}

/**
 * In-memory cache with TTL and tagging support
 */
export class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private hitCount = 0;
  private missCount = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes default
      maxSize: 1000,
      enableLogging: false,
      ...config
    };
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      this.log(`Cache MISS: ${key}`);
      return null;
    }

    // Check if expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      this.missCount++;
      this.log(`Cache EXPIRED: ${key}`);
      return null;
    }

    this.hitCount++;
    this.log(`Cache HIT: ${key}`);
    return entry.data;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, data: T, ttl?: number, tags?: string[]): void {
    // Enforce max size
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      tags
    };

    this.cache.set(key, entry);
    this.log(`Cache SET: ${key} (TTL: ${entry.ttl}ms)`);
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.log(`Cache DELETE: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear cache by tags
   */
  invalidateByTag(tag: string): number {
    let invalidated = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags?.includes(tag)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    this.log(`Cache INVALIDATE TAG: ${tag} (${invalidated} entries)`);
    return invalidated;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
    this.log('Cache CLEAR ALL');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hitCount + this.missCount;
    return {
      size: this.cache.size,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: total > 0 ? (this.hitCount / total) * 100 : 0,
      maxSize: this.config.maxSize
    };
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.log(`Cache EVICT: ${oldestKey}`);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    this.log(`Cache CLEANUP: ${cleaned} expired entries removed`);
    return cleaned;
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[Cache] ${message}`);
    }
  }
}

/**
 * HTTP Response Cache with different strategies
 */
export class APICache {
  private cache: MemoryCache;
  
  // Cache TTL strategies by endpoint pattern
  private static readonly CACHE_STRATEGIES = {
    // Market data - short TTL, high frequency
    'market': {
      ttl: 30 * 1000, // 30 seconds
      tags: ['market', 'prices']
    },
    // AI predictions - medium TTL
    'predictions': {
      ttl: 5 * 60 * 1000, // 5 minutes
      tags: ['ai', 'predictions']
    },
    // User data - long TTL, user-specific
    'user': {
      ttl: 15 * 60 * 1000, // 15 minutes
      tags: ['user']
    },
    // Trading runs - medium TTL
    'runs': {
      ttl: 10 * 60 * 1000, // 10 minutes
      tags: ['trading', 'runs']
    },
    // Health checks - very short TTL
    'health': {
      ttl: 10 * 1000, // 10 seconds
      tags: ['health']
    },
    // Default strategy
    'default': {
      ttl: 5 * 60 * 1000, // 5 minutes
      tags: ['default']
    }
  };

  constructor() {
    this.cache = new MemoryCache({
      defaultTTL: 5 * 60 * 1000,
      maxSize: 2000,
      enableLogging: import.meta.env.NODE_ENV === 'development'
    });

    // Set up periodic cleanup
    setInterval(() => {
      this.cache.cleanup();
    }, 60 * 1000); // Clean up every minute
  }

  /**
   * Get cached response
   */
  get(key: string): any {
    return this.cache.get(key);
  }

  /**
   * Cache response with appropriate strategy
   */
  set(url: string, data: any, userId?: string): void {
    const strategy = this.getStrategy(url);
    const key = this.generateKey(url, userId);
    
    this.cache.set(key, data, strategy.ttl, strategy.tags);
  }

  /**
   * Delete cached response
   */
  delete(url: string, userId?: string): boolean {
    const key = this.generateKey(url, userId);
    return this.cache.delete(key);
  }

  /**
   * Invalidate cache by endpoint type
   */
  invalidateByType(type: keyof typeof APICache.CACHE_STRATEGIES): number {
    const strategy = APICache.CACHE_STRATEGIES[type];
    if (!strategy || !strategy.tags) return 0;
    
    let invalidated = 0;
    for (const tag of strategy.tags) {
      invalidated += this.cache.invalidateByTag(tag);
    }
    
    return invalidated;
  }

  /**
   * Invalidate user-specific cache
   */
  invalidateUser(userId: string): number {
    return this.cache.invalidateByTag(`user:${userId}`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Generate cache key
   */
  private generateKey(url: string, userId?: string): string {
    const base = url.replace(/[?&]_=\d+/, ''); // Remove cache busters
    return userId ? `${base}:user:${userId}` : base;
  }

  /**
   * Determine caching strategy based on URL
   */
  private getStrategy(url: string) {
    for (const [pattern, strategy] of Object.entries(APICache.CACHE_STRATEGIES)) {
      if (pattern !== 'default' && url.includes(pattern)) {
        return strategy;
      }
    }
    return APICache.CACHE_STRATEGIES.default;
  }
}

/**
 * HTTP Cache Headers utility
 */
export class CacheHeaders {
  /**
   * Generate cache headers for API responses
   */
  static forAPI(url: string, isPrivate: boolean = false): Record<string, string> {
    const strategy = this.getStrategyForURL(url);
    const maxAge = Math.floor(strategy.ttl / 1000); // Convert to seconds
    
    const headers: Record<string, string> = {
      'Cache-Control': isPrivate 
        ? `private, max-age=${maxAge}`
        : `public, max-age=${maxAge}`,
      'ETag': this.generateETag(url),
      'Vary': 'Accept-Encoding, Authorization'
    };

    // Add specific headers for different content types
    if (url.includes('/market/')) {
      headers['Cache-Control'] += ', must-revalidate';
    }

    if (url.includes('/health')) {
      headers['Cache-Control'] = 'no-cache, must-revalidate';
    }

    return headers;
  }

  /**
   * Generate ETag for response
   */
  private static generateETag(url: string): string {
    const hash = this.simpleHash(url + Date.now().toString());
    return `"${hash}"`;
  }

  /**
   * Simple hash function for ETags
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Get strategy for URL (reused from APICache)
   */
  private static getStrategyForURL(url: string) {
    for (const [pattern, strategy] of Object.entries(APICache.CACHE_STRATEGIES)) {
      if (pattern !== 'default' && url.includes(pattern)) {
        return strategy;
      }
    }
    return APICache.CACHE_STRATEGIES.default;
  }
}

// Global cache instance
export const apiCache = new APICache();

/**
 * Cache decorator for API functions
 */
export function cached(
  ttl?: number,
  tags?: string[]
) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;
    
    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}.${propertyName}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = apiCache.get(cacheKey);
      if (cached !== null) {
        return cached;
      }
      
      // Execute original method
      const result = await method.apply(this, args);
      
      // Cache the result
      apiCache.cache.set(cacheKey, result, ttl, tags);
      
      return result;
    } as T;
  };
}

/**
 * Cache invalidation helper
 */
export const CacheInvalidation = {
  /**
   * Invalidate all market data cache
   */
  invalidateMarketData: () => apiCache.invalidateByType('market'),
  
  /**
   * Invalidate user-specific cache
   */
  invalidateUser: (userId: string) => apiCache.invalidateUser(userId),
  
  /**
   * Invalidate predictions cache
   */
  invalidatePredictions: () => apiCache.invalidateByType('predictions'),
  
  /**
   * Clear all cache
   */
  clearAll: () => apiCache.clear()
};
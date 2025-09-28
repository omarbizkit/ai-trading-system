/**
 * T063: API Response Caching Middleware
 * Handles automatic caching of API responses with appropriate headers
 */

import type { APIRoute } from 'astro';
import { apiCache, CacheHeaders } from '../utils/cache.js';

/**
 * Middleware to handle API response caching
 */
export function withCache(handler: APIRoute): APIRoute {
  return async (context) => {
    const { request, url } = context;
    const method = request.method;
    const pathname = url.pathname;
    
    // Only cache GET requests
    if (method !== 'GET') {
      return handler(context);
    }
    
    // Skip caching for certain endpoints
    if (shouldSkipCaching(pathname)) {
      return handler(context);
    }
    
    // Generate cache key
    const userId = await getUserId(request);
    const cacheKey = generateCacheKey(url, userId);
    
    // Try to get from cache
    const cached = apiCache.get(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          ...CacheHeaders.forAPI(pathname, !!userId)
        }
      });
    }
    
    // Execute original handler
    const response = await handler(context);
    
    // Cache successful responses
    if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
      try {
        const data = await response.json();
        apiCache.set(url.toString(), { data }, userId);
        
        // Return response with cache headers
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'MISS',
            ...CacheHeaders.forAPI(pathname, !!userId)
          }
        });
      } catch (error) {
        // If JSON parsing fails, return original response
        console.warn('Failed to cache response:', error);
        return response;
      }
    }
    
    return response;
  };
}

/**
 * Conditional caching - only cache certain responses
 */
export function withConditionalCache(
  handler: APIRoute,
  shouldCache: (url: URL, response: Response) => boolean
): APIRoute {
  return async (context) => {
    const { request, url } = context;
    const method = request.method;
    
    if (method !== 'GET') {
      return handler(context);
    }
    
    const userId = await getUserId(request);
    const cacheKey = generateCacheKey(url, userId);
    
    // Try cache first
    const cached = apiCache.get(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        }
      });
    }
    
    // Execute handler
    const response = await handler(context);
    
    // Check if we should cache this response
    if (shouldCache(url, response) && response.status === 200) {
      try {
        const data = await response.json();
        apiCache.set(url.toString(), { data }, userId);
        
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'MISS'
          }
        });
      } catch (error) {
        console.warn('Failed to cache conditional response:', error);
      }
    }
    
    return response;
  };
}

/**
 * Cache with custom TTL
 */
export function withCacheTTL(handler: APIRoute, ttl: number): APIRoute {
  return async (context) => {
    const { request, url } = context;
    
    if (request.method !== 'GET') {
      return handler(context);
    }
    
    const userId = await getUserId(request);
    const cacheKey = generateCacheKey(url, userId);
    
    const cached = apiCache.get(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT',
          'Cache-Control': `public, max-age=${Math.floor(ttl / 1000)}`
        }
      });
    }
    
    const response = await handler(context);
    
    if (response.status === 200) {
      try {
        const data = await response.json();
        apiCache.cache.set(cacheKey, { data }, ttl);
        
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Cache': 'MISS',
            'Cache-Control': `public, max-age=${Math.floor(ttl / 1000)}`
          }
        });
      } catch (error) {
        console.warn('Failed to cache TTL response:', error);
      }
    }
    
    return response;
  };
}

/**
 * Cache invalidation decorator
 */
export function withCacheInvalidation(
  handler: APIRoute,
  invalidationPattern: string | string[]
): APIRoute {
  return async (context) => {
    const response = await handler(context);
    
    // Invalidate cache on successful mutations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(context.request.method) && 
        response.status >= 200 && response.status < 300) {
      
      const patterns = Array.isArray(invalidationPattern) ? invalidationPattern : [invalidationPattern];
      
      for (const pattern of patterns) {
        if (pattern === 'user') {
          const userId = await getUserId(context.request);
          if (userId) {
            apiCache.invalidateUser(userId);
          }
        } else {
          apiCache.invalidateByType(pattern as any);
        }
      }
    }
    
    return response;
  };
}

/**
 * Utility functions
 */

function shouldSkipCaching(pathname: string): boolean {
  const skipPatterns = [
    '/api/debug/',
    '/api/health/',
    '/api/auth/',
  ];
  
  return skipPatterns.some(pattern => pathname.startsWith(pattern));
}

function generateCacheKey(url: URL, userId?: string): string {
  const base = url.pathname + (url.search || '');
  return userId ? `${base}:user:${userId}` : base;
}

async function getUserId(request: Request): Promise<string | undefined> {
  try {
    // Extract user ID from Authorization header or session
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      // Parse JWT token or session ID
      // This is a simplified version - implement proper auth parsing
      const token = authHeader.replace('Bearer ', '');
      // For now, return undefined - implement proper token parsing
      return undefined;
    }
    
    return undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Cache warming utility
 */
export class CacheWarmer {
  /**
   * Warm up cache with commonly accessed endpoints
   */
  static async warmUp(): Promise<void> {
    const commonEndpoints = [
      '/api/market/bitcoin',
      '/api/market/ethereum', 
      '/api/predictions/bitcoin',
      '/api/health'
    ];
    
    console.log('🔥 Warming up cache...');
    
    const promises = commonEndpoints.map(async (endpoint) => {
      try {
        const response = await fetch(`${import.meta.env.SITE || 'http://localhost:4321'}${endpoint}`);
        if (response.ok) {
          console.log(`   ✅ Warmed: ${endpoint}`);
        }
      } catch (error) {
        console.warn(`   ❌ Failed to warm: ${endpoint}`, error);
      }
    });
    
    await Promise.allSettled(promises);
    console.log('🔥 Cache warm-up complete');
  }
}

/**
 * Cache monitoring utilities
 */
export class CacheMonitor {
  /**
   * Log cache statistics
   */
  static logStats(): void {
    const stats = apiCache.getStats();
    console.log('📊 Cache Statistics:', {
      size: stats.size,
      hitRate: `${stats.hitRate.toFixed(2)}%`,
      hits: stats.hits,
      misses: stats.misses,
      maxSize: stats.maxSize
    });
  }
  
  /**
   * Set up periodic cache monitoring
   */
  static startMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      this.logStats();
    }, intervalMs);
  }
}

// Export helper decorators
export const cacheHelpers = {
  /**
   * Cache market data for 30 seconds
   */
  marketData: (handler: APIRoute) => withCacheTTL(handler, 30 * 1000),
  
  /**
   * Cache user data for 15 minutes
   */
  userData: (handler: APIRoute) => withCacheTTL(handler, 15 * 60 * 1000),
  
  /**
   * Cache predictions for 5 minutes
   */
  predictions: (handler: APIRoute) => withCacheTTL(handler, 5 * 60 * 1000),
  
  /**
   * Cache with invalidation on user updates
   */
  userWithInvalidation: (handler: APIRoute) => 
    withCacheInvalidation(withCache(handler), 'user')
};
/**
 * Database Optimization Service
 * 
 * Service for optimizing database queries and connection pooling
 * during the production readiness phase.
 */

import { supabase, retryOperation } from '../supabase';
import type { Database } from '../supabase';

export interface QueryPerformanceMetrics {
  query: string;
  executionTime: number;
  rowCount: number;
  cacheHit: boolean;
  timestamp: Date;
}

export interface ConnectionPoolMetrics {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
  averageWaitTime: number;
}

export interface DatabaseOptimizationConfig {
  enableQueryCaching: boolean;
  cacheTTL: number; // in milliseconds
  maxCacheSize: number;
  enableConnectionPooling: boolean;
  maxConnections: number;
  queryTimeout: number; // in milliseconds
  enableSlowQueryLogging: boolean;
  slowQueryThreshold: number; // in milliseconds
}

export class DatabaseOptimizationService {
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private queryMetrics: QueryPerformanceMetrics[] = [];
  private config: DatabaseOptimizationConfig;
  private slowQueries: QueryPerformanceMetrics[] = [];

  constructor(config: Partial<DatabaseOptimizationConfig> = {}) {
    this.config = {
      enableQueryCaching: true,
      cacheTTL: 300000, // 5 minutes
      maxCacheSize: 1000,
      enableConnectionPooling: true,
      maxConnections: 10,
      queryTimeout: 30000, // 30 seconds
      enableSlowQueryLogging: true,
      slowQueryThreshold: 1000, // 1 second
      ...config
    };
  }

  /**
   * Execute a query with optimization features
   */
  async executeQuery<T>(
    queryName: string,
    queryFn: () => Promise<T>,
    cacheKey?: string,
    ttl?: number
  ): Promise<T> {
    const startTime = Date.now();
    let result: T;
    let cacheHit = false;

    // Check cache first
    if (this.config.enableQueryCaching && cacheKey) {
      const cached = this.getCachedQuery(cacheKey);
      if (cached) {
        result = cached;
        cacheHit = true;
      }
    }

    // Execute query if not cached
    if (!cacheHit) {
      try {
        result = await retryOperation(async () => {
          return await Promise.race([
            queryFn(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout')), this.config.queryTimeout)
            )
          ]);
        });

        // Cache the result
        if (this.config.enableQueryCaching && cacheKey) {
          this.setCachedQuery(cacheKey, result, ttl || this.config.cacheTTL);
        }
      } catch (error: any) {
        console.error(`Query ${queryName} failed:`, error);
        throw error;
      }
    }

    const executionTime = Date.now() - startTime;

    // Record metrics
    const metrics: QueryPerformanceMetrics = {
      query: queryName,
      executionTime,
      rowCount: Array.isArray(result) ? result.length : 1,
      cacheHit,
      timestamp: new Date()
    };

    this.queryMetrics.push(metrics);

    // Log slow queries
    if (this.config.enableSlowQueryLogging && executionTime > this.config.slowQueryThreshold) {
      this.slowQueries.push(metrics);
      console.warn(`Slow query detected: ${queryName} took ${executionTime}ms`);
    }

    // Clean up old metrics
    this.cleanupMetrics();

    return result;
  }

  /**
   * Get cached query result
   */
  private getCachedQuery<T>(cacheKey: string): T | null {
    const cached = this.queryCache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.queryCache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached query result
   */
  private setCachedQuery<T>(cacheKey: string, data: T, ttl: number): void {
    // Check cache size limit
    if (this.queryCache.size >= this.config.maxCacheSize) {
      // Remove oldest entries
      const entries = Array.from(this.queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = Math.floor(this.config.maxCacheSize * 0.1); // Remove 10%
      for (let i = 0; i < toRemove; i++) {
        this.queryCache.delete(entries[i][0]);
      }
    }

    this.queryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Clean up old metrics and cache entries
   */
  private cleanupMetrics(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up query metrics
    this.queryMetrics = this.queryMetrics.filter(
      metric => now - metric.timestamp.getTime() < maxAge
    );

    // Clean up slow queries
    this.slowQueries = this.slowQueries.filter(
      query => now - query.timestamp.getTime() < maxAge
    );

    // Clean up cache
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Get query performance statistics
   */
  getQueryPerformanceStats(): {
    totalQueries: number;
    averageExecutionTime: number;
    cacheHitRate: number;
    slowQueriesCount: number;
    topSlowQueries: QueryPerformanceMetrics[];
  } {
    const totalQueries = this.queryMetrics.length;
    const averageExecutionTime = totalQueries > 0 
      ? this.queryMetrics.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries 
      : 0;
    
    const cacheHits = this.queryMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;

    const slowQueriesCount = this.slowQueries.length;
    const topSlowQueries = [...this.slowQueries]
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    return {
      totalQueries,
      averageExecutionTime: Math.round(averageExecutionTime),
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      slowQueriesCount,
      topSlowQueries
    };
  }

  /**
   * Get connection pool metrics (simulated for Supabase)
   */
  getConnectionPoolMetrics(): ConnectionPoolMetrics {
    // Supabase handles connection pooling internally
    // This is a simulation based on our configuration
    return {
      activeConnections: Math.min(this.queryMetrics.length, this.config.maxConnections),
      idleConnections: Math.max(0, this.config.maxConnections - this.queryMetrics.length),
      totalConnections: this.config.maxConnections,
      maxConnections: this.config.maxConnections,
      averageWaitTime: this.getAverageWaitTime()
    };
  }

  /**
   * Calculate average wait time for queries
   */
  private getAverageWaitTime(): number {
    if (this.queryMetrics.length === 0) return 0;
    
    const totalWaitTime = this.queryMetrics.reduce((sum, m) => sum + m.executionTime, 0);
    return Math.round(totalWaitTime / this.queryMetrics.length);
  }

  /**
   * Optimize database queries by analyzing patterns
   */
  analyzeQueryPatterns(): {
    frequentQueries: { query: string; count: number; avgTime: number }[];
    recommendations: string[];
  } {
    const queryGroups = new Map<string, QueryPerformanceMetrics[]>();
    
    // Group queries by name
    this.queryMetrics.forEach(metric => {
      if (!queryGroups.has(metric.query)) {
        queryGroups.set(metric.query, []);
      }
      queryGroups.get(metric.query)!.push(metric);
    });

    // Analyze frequent queries
    const frequentQueries = Array.from(queryGroups.entries())
      .map(([query, metrics]) => ({
        query,
        count: metrics.length,
        avgTime: Math.round(metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (this.queryMetrics.length > 100) {
      recommendations.push('Consider implementing query result caching for frequently accessed data');
    }
    
    if (this.slowQueries.length > 0) {
      recommendations.push('Review slow queries and consider adding database indexes');
    }
    
    if (this.getQueryPerformanceStats().cacheHitRate < 50) {
      recommendations.push('Increase cache TTL or implement more aggressive caching strategies');
    }

    return {
      frequentQueries,
      recommendations
    };
  }

  /**
   * Clear all caches and metrics
   */
  clearCache(): void {
    this.queryCache.clear();
    this.queryMetrics = [];
    this.slowQueries = [];
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DatabaseOptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): DatabaseOptimizationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const databaseOptimizationService = new DatabaseOptimizationService();

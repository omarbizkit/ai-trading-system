/**
 * Performance Monitoring and Metrics Collection
 * Provides comprehensive performance tracking, metrics collection, and optimization insights
 */

export interface PerformanceMetric {
  id: string;
  name: string;
  category: MetricCategory;
  value: number;
  unit: MetricUnit;
  timestamp: Date;
  tags?: Record<string, string>;
  threshold?: PerformanceThreshold;
}

export interface PerformanceThreshold {
  warning: number;
  critical: number;
  target?: number;
}

export enum MetricCategory {
  PAGE_LOAD = 'page_load',
  API_PERFORMANCE = 'api_performance',
  DATABASE_PERFORMANCE = 'database_performance',
  BUNDLE_SIZE = 'bundle_size',
  MEMORY_USAGE = 'memory_usage',
  CPU_USAGE = 'cpu_usage',
  NETWORK_PERFORMANCE = 'network_performance',
  USER_INTERACTION = 'user_interaction',
  TRADING_PERFORMANCE = 'trading_performance',
  AI_INFERENCE = 'ai_inference'
}

export enum MetricUnit {
  MILLISECONDS = 'ms',
  SECONDS = 's',
  BYTES = 'bytes',
  KILOBYTES = 'kb',
  MEGABYTES = 'mb',
  PERCENTAGE = '%',
  COUNT = 'count',
  REQUESTS_PER_SECOND = 'rps',
  OPERATIONS_PER_SECOND = 'ops'
}

export interface WebVitalsMetrics {
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  TTI?: number; // Time to Interactive
}

export interface APIPerformanceMetrics {
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  requestSize?: number;
  responseSize?: number;
  timestamp: Date;
  success: boolean;
}

export interface DatabasePerformanceMetrics {
  operation: string;
  table?: string;
  queryTime: number;
  recordsAffected?: number;
  timestamp: Date;
  success: boolean;
}

export interface TradingPerformanceMetrics {
  operation: string; // 'simulation', 'backtesting', 'ai_prediction'
  duration: number;
  recordsProcessed?: number;
  memoryUsed?: number;
  timestamp: Date;
  success: boolean;
}

export interface PerformanceReport {
  summary: {
    totalMetrics: number;
    timeRange: { start: Date; end: Date };
    averagePageLoad: number;
    averageAPIResponse: number;
    averageDatabaseQuery: number;
    criticalIssues: number;
    warnings: number;
  };
  webVitals: WebVitalsMetrics;
  apiPerformance: APIPerformanceMetrics[];
  databasePerformance: DatabasePerformanceMetrics[];
  tradingPerformance: TradingPerformanceMetrics[];
  recommendations: PerformanceRecommendation[];
}

export interface PerformanceRecommendation {
  type: 'optimization' | 'warning' | 'critical';
  category: MetricCategory;
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  action: string;
  estimatedImprovement?: string;
}

/**
 * Performance Monitor Implementation
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetric> = new Map();
  private webVitals: WebVitalsMetrics = {};
  private apiMetrics: APIPerformanceMetrics[] = [];
  private databaseMetrics: DatabasePerformanceMetrics[] = [];
  private tradingMetrics: TradingPerformanceMetrics[] = [];
  private observers: Map<string, PerformanceObserver> = new Map();
  private isInitialized = false;

  private constructor() {
    this.initializePerformanceMonitoring();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  private initializePerformanceMonitoring(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    this.isInitialized = true;

    // Initialize Web Vitals monitoring
    this.initializeWebVitals();

    // Initialize resource timing monitoring
    this.initializeResourceTiming();

    // Initialize navigation timing monitoring
    this.initializeNavigationTiming();

    // Initialize memory monitoring
    this.initializeMemoryMonitoring();

    // Initialize user interaction monitoring
    this.initializeUserInteractionMonitoring();

    // Start periodic metric collection
    this.startPeriodicCollection();
  }

  private initializeWebVitals(): void {
    // First Contentful Paint
    this.observePerformanceEntry('paint', (entries) => {
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        this.webVitals.FCP = fcpEntry.startTime;
        this.recordMetric('FCP', MetricCategory.PAGE_LOAD, fcpEntry.startTime, MetricUnit.MILLISECONDS, {
          warning: 1800,
          critical: 3000,
          target: 1200
        });
      }
    });

    // Largest Contentful Paint
    this.observePerformanceEntry('largest-contentful-paint', (entries) => {
      const lcpEntry = entries[entries.length - 1]; // Get the latest LCP
      if (lcpEntry) {
        this.webVitals.LCP = lcpEntry.startTime;
        this.recordMetric('LCP', MetricCategory.PAGE_LOAD, lcpEntry.startTime, MetricUnit.MILLISECONDS, {
          warning: 2500,
          critical: 4000,
          target: 1200
        });
      }
    });

    // First Input Delay
    this.observePerformanceEntry('first-input', (entries) => {
      const fidEntry = entries[0];
      if (fidEntry) {
        const fid = fidEntry.processingStart - fidEntry.startTime;
        this.webVitals.FID = fid;
        this.recordMetric('FID', MetricCategory.USER_INTERACTION, fid, MetricUnit.MILLISECONDS, {
          warning: 100,
          critical: 300,
          target: 50
        });
      }
    });

    // Cumulative Layout Shift
    this.observePerformanceEntry('layout-shift', (entries) => {
      let clsValue = 0;
      for (const entry of entries) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.webVitals.CLS = clsValue;
      this.recordMetric('CLS', MetricCategory.PAGE_LOAD, clsValue, MetricUnit.COUNT, {
        warning: 0.1,
        critical: 0.25,
        target: 0.05
      });
    });

    // Time to First Byte (using navigation timing)
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
        const navEntry = navigationEntries[0];
        const ttfb = navEntry.responseStart - navEntry.requestStart;
        this.webVitals.TTFB = ttfb;
        this.recordMetric('TTFB', MetricCategory.NETWORK_PERFORMANCE, ttfb, MetricUnit.MILLISECONDS, {
          warning: 800,
          critical: 1800,
          target: 200
        });

        // Time to Interactive (approximation)
        const tti = navEntry.domInteractive - navEntry.navigationStart;
        this.webVitals.TTI = tti;
        this.recordMetric('TTI', MetricCategory.PAGE_LOAD, tti, MetricUnit.MILLISECONDS, {
          warning: 3800,
          critical: 7300,
          target: 2000
        });
      }
    }
  }

  private observePerformanceEntry(entryType: string, callback: (entries: PerformanceEntry[]) => void): void {
    try {
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ entryTypes: [entryType] });
      this.observers.set(entryType, observer);
    } catch (error) {
      console.warn(`Failed to observe ${entryType} performance entries:`, error);
    }
  }

  private initializeResourceTiming(): void {
    this.observePerformanceEntry('resource', (entries) => {
      for (const entry of entries as PerformanceResourceTiming[]) {
        const duration = entry.responseEnd - entry.startTime;
        const category = this.categorizeResource(entry.name);

        this.recordMetric(
          `Resource: ${entry.name}`,
          category,
          duration,
          MetricUnit.MILLISECONDS,
          { warning: 1000, critical: 3000 }
        );

        // Track resource sizes
        if (entry.transferSize) {
          this.recordMetric(
            `Resource Size: ${entry.name}`,
            MetricCategory.BUNDLE_SIZE,
            entry.transferSize,
            MetricUnit.BYTES
          );
        }
      }
    });
  }

  private categorizeResource(url: string): MetricCategory {
    if (url.includes('.js')) return MetricCategory.BUNDLE_SIZE;
    if (url.includes('.css')) return MetricCategory.BUNDLE_SIZE;
    if (url.includes('/api/')) return MetricCategory.API_PERFORMANCE;
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.svg')) return MetricCategory.BUNDLE_SIZE;
    return MetricCategory.NETWORK_PERFORMANCE;
  }

  private initializeNavigationTiming(): void {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
        const navEntry = navigationEntries[0];

        // DNS lookup time
        const dnsTime = navEntry.domainLookupEnd - navEntry.domainLookupStart;
        this.recordMetric('DNS Lookup', MetricCategory.NETWORK_PERFORMANCE, dnsTime, MetricUnit.MILLISECONDS);

        // TCP connection time
        const tcpTime = navEntry.connectEnd - navEntry.connectStart;
        this.recordMetric('TCP Connection', MetricCategory.NETWORK_PERFORMANCE, tcpTime, MetricUnit.MILLISECONDS);

        // DOM content loaded time
        const domContentLoaded = navEntry.domContentLoadedEventEnd - navEntry.navigationStart;
        this.recordMetric('DOM Content Loaded', MetricCategory.PAGE_LOAD, domContentLoaded, MetricUnit.MILLISECONDS);

        // Full page load time
        const pageLoad = navEntry.loadEventEnd - navEntry.navigationStart;
        this.recordMetric('Page Load', MetricCategory.PAGE_LOAD, pageLoad, MetricUnit.MILLISECONDS, {
          warning: 3000,
          critical: 5000,
          target: 1500
        });
      }
    }
  }

  private initializeMemoryMonitoring(): void {
    // Memory usage monitoring (if supported)
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      this.recordMetric('JS Heap Used', MetricCategory.MEMORY_USAGE, memoryInfo.usedJSHeapSize, MetricUnit.BYTES);
      this.recordMetric('JS Heap Total', MetricCategory.MEMORY_USAGE, memoryInfo.totalJSHeapSize, MetricUnit.BYTES);
      this.recordMetric('JS Heap Limit', MetricCategory.MEMORY_USAGE, memoryInfo.jsHeapSizeLimit, MetricUnit.BYTES);
    }
  }

  private initializeUserInteractionMonitoring(): void {
    // Track click interactions
    document.addEventListener('click', (event) => {
      const startTime = performance.now();

      // Use requestAnimationFrame to measure rendering time after click
      requestAnimationFrame(() => {
        const renderTime = performance.now() - startTime;
        this.recordMetric('Click Response Time', MetricCategory.USER_INTERACTION, renderTime, MetricUnit.MILLISECONDS, {
          warning: 100,
          critical: 300
        });
      });
    });

    // Track scroll performance
    let scrollStart = 0;
    let scrollTimeout: NodeJS.Timeout;

    document.addEventListener('scroll', () => {
      if (!scrollStart) {
        scrollStart = performance.now();
      }

      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const scrollDuration = performance.now() - scrollStart;
        this.recordMetric('Scroll Duration', MetricCategory.USER_INTERACTION, scrollDuration, MetricUnit.MILLISECONDS);
        scrollStart = 0;
      }, 100);
    });
  }

  private startPeriodicCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectPeriodicMetrics();
    }, 30000);

    // Collect initial metrics after 5 seconds
    setTimeout(() => {
      this.collectPeriodicMetrics();
    }, 5000);
  }

  private collectPeriodicMetrics(): void {
    // Memory monitoring
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      this.recordMetric('Current JS Heap Used', MetricCategory.MEMORY_USAGE, memoryInfo.usedJSHeapSize, MetricUnit.BYTES);
    }

    // Connection information
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      if (connection.effectiveType) {
        this.recordMetric(`Connection Type: ${connection.effectiveType}`, MetricCategory.NETWORK_PERFORMANCE, 1, MetricUnit.COUNT);
      }
      if (connection.downlink) {
        this.recordMetric('Connection Speed', MetricCategory.NETWORK_PERFORMANCE, connection.downlink, MetricUnit.COUNT);
      }
    }

    // Send metrics to backend (in production)
    if (process.env.NODE_ENV === 'production') {
      this.sendMetricsToBackend();
    }
  }

  recordMetric(
    name: string,
    category: MetricCategory,
    value: number,
    unit: MetricUnit,
    threshold?: PerformanceThreshold,
    tags?: Record<string, string>
  ): string {
    const id = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const metric: PerformanceMetric = {
      id,
      name,
      category,
      value,
      unit,
      timestamp: new Date(),
      tags,
      threshold
    };

    this.metrics.set(id, metric);

    // Check thresholds and create alerts
    if (threshold) {
      this.checkThreshold(metric);
    }

    return id;
  }

  recordAPIPerformance(
    endpoint: string,
    method: string,
    responseTime: number,
    statusCode: number,
    requestSize?: number,
    responseSize?: number
  ): void {
    const apiMetric: APIPerformanceMetrics = {
      endpoint,
      method,
      responseTime,
      statusCode,
      requestSize,
      responseSize,
      timestamp: new Date(),
      success: statusCode >= 200 && statusCode < 400
    };

    this.apiMetrics.push(apiMetric);

    // Record as performance metric
    this.recordMetric(
      `API: ${method} ${endpoint}`,
      MetricCategory.API_PERFORMANCE,
      responseTime,
      MetricUnit.MILLISECONDS,
      { warning: 1000, critical: 3000, target: 200 },
      { endpoint, method, status: statusCode.toString() }
    );

    // Keep only last 100 API metrics
    if (this.apiMetrics.length > 100) {
      this.apiMetrics.splice(0, this.apiMetrics.length - 100);
    }
  }

  recordDatabasePerformance(
    operation: string,
    queryTime: number,
    table?: string,
    recordsAffected?: number
  ): void {
    const dbMetric: DatabasePerformanceMetrics = {
      operation,
      table,
      queryTime,
      recordsAffected,
      timestamp: new Date(),
      success: true
    };

    this.databaseMetrics.push(dbMetric);

    // Record as performance metric
    this.recordMetric(
      `DB: ${operation}${table ? ` on ${table}` : ''}`,
      MetricCategory.DATABASE_PERFORMANCE,
      queryTime,
      MetricUnit.MILLISECONDS,
      { warning: 500, critical: 2000, target: 100 },
      { operation, table: table || 'unknown' }
    );

    // Keep only last 100 database metrics
    if (this.databaseMetrics.length > 100) {
      this.databaseMetrics.splice(0, this.databaseMetrics.length - 100);
    }
  }

  recordTradingPerformance(
    operation: string,
    duration: number,
    recordsProcessed?: number,
    memoryUsed?: number
  ): void {
    const tradingMetric: TradingPerformanceMetrics = {
      operation,
      duration,
      recordsProcessed,
      memoryUsed,
      timestamp: new Date(),
      success: true
    };

    this.tradingMetrics.push(tradingMetric);

    // Record as performance metric
    this.recordMetric(
      `Trading: ${operation}`,
      MetricCategory.TRADING_PERFORMANCE,
      duration,
      MetricUnit.MILLISECONDS,
      { warning: 5000, critical: 15000, target: 1000 },
      { operation, records: recordsProcessed?.toString() || '0' }
    );

    // Keep only last 50 trading metrics
    if (this.tradingMetrics.length > 50) {
      this.tradingMetrics.splice(0, this.tradingMetrics.length - 50);
    }
  }

  private checkThreshold(metric: PerformanceMetric): void {
    if (!metric.threshold) return;

    if (metric.value >= metric.threshold.critical) {
      this.createAlert('critical', metric, `Critical performance threshold exceeded for ${metric.name}`);
    } else if (metric.value >= metric.threshold.warning) {
      this.createAlert('warning', metric, `Warning performance threshold exceeded for ${metric.name}`);
    }
  }

  private createAlert(level: 'warning' | 'critical', metric: PerformanceMetric, message: string): void {
    // This would integrate with the error logger
    console.warn(`[PERFORMANCE ${level.toUpperCase()}] ${message}`, {
      metric: metric.name,
      value: metric.value,
      unit: metric.unit,
      threshold: metric.threshold,
      timestamp: metric.timestamp
    });

    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production' && level === 'critical') {
      fetch('/api/alerts/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level,
          metric,
          message,
          timestamp: new Date().toISOString()
        })
      }).catch(error => console.error('Failed to send performance alert:', error));
    }
  }

  private async sendMetricsToBackend(): Promise<void> {
    try {
      const recentMetrics = Array.from(this.metrics.values())
        .filter(metric => metric.timestamp > new Date(Date.now() - 5 * 60 * 1000)) // Last 5 minutes
        .slice(0, 50); // Limit to 50 metrics per batch

      if (recentMetrics.length === 0) return;

      await fetch('/api/metrics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: recentMetrics,
          webVitals: this.webVitals,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to send metrics to backend:', error);
    }
  }

  getMetrics(category?: MetricCategory, limit?: number): PerformanceMetric[] {
    let metrics = Array.from(this.metrics.values());

    if (category) {
      metrics = metrics.filter(metric => metric.category === category);
    }

    // Sort by timestamp (newest first)
    metrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      metrics = metrics.slice(0, limit);
    }

    return metrics;
  }

  getWebVitals(): WebVitalsMetrics {
    return { ...this.webVitals };
  }

  getAPIMetrics(limit?: number): APIPerformanceMetrics[] {
    const metrics = [...this.apiMetrics]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? metrics.slice(0, limit) : metrics;
  }

  getDatabaseMetrics(limit?: number): DatabasePerformanceMetrics[] {
    const metrics = [...this.databaseMetrics]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? metrics.slice(0, limit) : metrics;
  }

  getTradingMetrics(limit?: number): TradingPerformanceMetrics[] {
    const metrics = [...this.tradingMetrics]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? metrics.slice(0, limit) : metrics;
  }

  generateReport(timeRange?: { start: Date; end: Date }): PerformanceReport {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

    const start = timeRange?.start || defaultStart;
    const end = timeRange?.end || now;

    const filteredMetrics = Array.from(this.metrics.values())
      .filter(metric => metric.timestamp >= start && metric.timestamp <= end);

    const pageLoadMetrics = filteredMetrics.filter(m => m.category === MetricCategory.PAGE_LOAD);
    const apiMetrics = this.apiMetrics.filter(m => m.timestamp >= start && m.timestamp <= end);
    const dbMetrics = this.databaseMetrics.filter(m => m.timestamp >= start && m.timestamp <= end);

    const avgPageLoad = this.calculateAverage(pageLoadMetrics.map(m => m.value));
    const avgAPIResponse = this.calculateAverage(apiMetrics.map(m => m.responseTime));
    const avgDatabaseQuery = this.calculateAverage(dbMetrics.map(m => m.queryTime));

    const criticalIssues = filteredMetrics.filter(m =>
      m.threshold && m.value >= m.threshold.critical
    ).length;

    const warnings = filteredMetrics.filter(m =>
      m.threshold && m.value >= m.threshold.warning && m.value < (m.threshold.critical || Infinity)
    ).length;

    return {
      summary: {
        totalMetrics: filteredMetrics.length,
        timeRange: { start, end },
        averagePageLoad: avgPageLoad,
        averageAPIResponse: avgAPIResponse,
        averageDatabaseQuery: avgDatabaseQuery,
        criticalIssues,
        warnings
      },
      webVitals: this.webVitals,
      apiPerformance: apiMetrics,
      databasePerformance: dbMetrics,
      tradingPerformance: this.tradingMetrics.filter(m => m.timestamp >= start && m.timestamp <= end),
      recommendations: this.generateRecommendations(filteredMetrics)
    };
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private generateRecommendations(metrics: PerformanceMetric[]): PerformanceRecommendation[] {
    const recommendations: PerformanceRecommendation[] = [];

    // Analyze LCP
    const lcpMetric = metrics.find(m => m.name === 'LCP');
    if (lcpMetric && lcpMetric.value > 2500) {
      recommendations.push({
        type: lcpMetric.value > 4000 ? 'critical' : 'warning',
        category: MetricCategory.PAGE_LOAD,
        title: 'Optimize Largest Contentful Paint',
        description: `LCP is ${lcpMetric.value.toFixed(0)}ms, which is ${lcpMetric.value > 4000 ? 'poor' : 'needs improvement'}`,
        impact: 'high',
        action: 'Optimize images, remove unused CSS, use a CDN, or preload critical resources',
        estimatedImprovement: '1-2 seconds faster loading'
      });
    }

    // Analyze API performance
    const slowAPIRequests = this.apiMetrics.filter(m => m.responseTime > 1000).length;
    if (slowAPIRequests > 0) {
      recommendations.push({
        type: 'optimization',
        category: MetricCategory.API_PERFORMANCE,
        title: 'Optimize API Response Times',
        description: `${slowAPIRequests} API requests are taking longer than 1 second`,
        impact: 'medium',
        action: 'Add caching, optimize database queries, or implement request batching',
        estimatedImprovement: '50-80% faster API responses'
      });
    }

    // Analyze bundle size
    const bundleMetrics = metrics.filter(m => m.category === MetricCategory.BUNDLE_SIZE);
    const totalBundleSize = bundleMetrics.reduce((sum, m) => sum + m.value, 0);
    if (totalBundleSize > 1024 * 1024) { // 1MB
      recommendations.push({
        type: 'optimization',
        category: MetricCategory.BUNDLE_SIZE,
        title: 'Reduce Bundle Size',
        description: `Total bundle size is ${(totalBundleSize / 1024 / 1024).toFixed(2)}MB`,
        impact: 'medium',
        action: 'Implement code splitting, tree shaking, and lazy loading',
        estimatedImprovement: '30-50% smaller bundles'
      });
    }

    return recommendations;
  }

  // Utility method for measuring function performance
  async measureAsync<T>(name: string, fn: () => Promise<T>, category: MetricCategory = MetricCategory.API_PERFORMANCE): Promise<T> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, category, duration, MetricUnit.MILLISECONDS);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(`${name} (failed)`, category, duration, MetricUnit.MILLISECONDS);
      throw error;
    }
  }

  measure<T>(name: string, fn: () => T, category: MetricCategory = MetricCategory.USER_INTERACTION): T {
    const startTime = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - startTime;
      this.recordMetric(name, category, duration, MetricUnit.MILLISECONDS);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      this.recordMetric(`${name} (failed)`, category, duration, MetricUnit.MILLISECONDS);
      throw error;
    }
  }

  disconnect(): void {
    // Disconnect all performance observers
    for (const observer of this.observers.values()) {
      observer.disconnect();
    }
    this.observers.clear();
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Utility functions for common performance monitoring patterns
export function withPerformanceTracking<T extends (...args: any[]) => any>(
  fn: T,
  name: string,
  category: MetricCategory = MetricCategory.USER_INTERACTION
): T {
  return ((...args: Parameters<T>) => {
    return performanceMonitor.measure(name, () => fn(...args), category);
  }) as T;
}

export function withAsyncPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name: string,
  category: MetricCategory = MetricCategory.API_PERFORMANCE
): T {
  return ((...args: Parameters<T>) => {
    return performanceMonitor.measureAsync(name, () => fn(...args), category);
  }) as T;
}

// API interceptor for automatic API performance tracking
export function createAPIInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method || 'GET';
    const startTime = performance.now();

    try {
      const response = await originalFetch(input, init);
      const duration = performance.now() - startTime;

      performanceMonitor.recordAPIPerformance(
        url,
        method,
        duration,
        response.status
      );

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      performanceMonitor.recordAPIPerformance(url, method, duration, 0);
      throw error;
    }
  };
}
/**
 * External API Error Handler Service
 * 
 * Service for handling external API failures with retry logic,
 * circuit breakers, and fallback mechanisms.
 */

export interface APIError {
  code: string;
  message: string;
  statusCode?: number;
  retryable: boolean;
  fallbackAvailable: boolean;
  retryAfter?: number; // seconds
  originalError?: any;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  jitter: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number; // milliseconds
  monitoringPeriod: number; // milliseconds
}

export interface FallbackConfig {
  enabled: boolean;
  fallbackData?: any;
  fallbackMessage?: string;
  cacheFallback: boolean;
  cacheTTL: number; // milliseconds
}

export class ExternalAPIErrorHandler {
  private retryConfig: RetryConfig;
  private circuitBreakerConfig: CircuitBreakerConfig;
  private fallbackConfig: FallbackConfig;
  private circuitBreakerState: Map<string, {
    failures: number;
    lastFailure: number;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  }> = new Map();
  private fallbackCache = new Map<string, { data: any; timestamp: number }>();

  constructor(
    retryConfig: Partial<RetryConfig> = {},
    circuitBreakerConfig: Partial<CircuitBreakerConfig> = {},
    fallbackConfig: Partial<FallbackConfig> = {}
  ) {
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
      ...retryConfig
    };

    this.circuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 300000, // 5 minutes
      ...circuitBreakerConfig
    };

    this.fallbackConfig = {
      enabled: true,
      cacheFallback: true,
      cacheTTL: 300000, // 5 minutes
      ...fallbackConfig
    };
  }

  /**
   * Execute API call with error handling, retry logic, and circuit breaker
   */
  async executeWithErrorHandling<T>(
    apiName: string,
    operation: () => Promise<T>,
    fallbackData?: T
  ): Promise<T> {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen(apiName)) {
      if (this.fallbackConfig.enabled && fallbackData) {
        console.warn(`Circuit breaker open for ${apiName}, using fallback data`);
        return fallbackData;
      }
      throw new Error(`Circuit breaker open for ${apiName}`);
    }

    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Success - reset circuit breaker
        this.resetCircuitBreaker(apiName);
        return result;
      } catch (error: any) {
        lastError = error;
        
        const apiError = this.classifyError(error);
        
        // Don't retry non-retryable errors
        if (!apiError.retryable) {
          this.recordFailure(apiName);
          throw this.createHandledError(apiError, apiName);
        }

        // Don't retry on last attempt
        if (attempt === this.retryConfig.maxRetries) {
          this.recordFailure(apiName);
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateRetryDelay(attempt);
        console.warn(`API call failed (attempt ${attempt + 1}/${this.retryConfig.maxRetries + 1}), retrying in ${delay}ms:`, apiError.message);
        
        await this.sleep(delay);
      }
    }

    // All retries failed
    this.recordFailure(apiName);
    
    if (this.fallbackConfig.enabled && fallbackData) {
      console.warn(`All retries failed for ${apiName}, using fallback data`);
      return fallbackData;
    }

    throw this.createHandledError(this.classifyError(lastError!), apiName);
  }

  /**
   * Classify API error based on status code and error type
   */
  private classifyError(error: any): APIError {
    const statusCode = error.status || error.statusCode || error.response?.status;
    const message = error.message || 'Unknown API error';

    // Network errors
    if (error.name === 'TypeError' && message.includes('fetch')) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network connection failed',
        retryable: true,
        fallbackAvailable: true
      };
    }

    // Timeout errors
    if (error.name === 'AbortError' || message.includes('timeout')) {
      return {
        code: 'TIMEOUT_ERROR',
        message: 'Request timeout',
        retryable: true,
        fallbackAvailable: true
      };
    }

    // HTTP status codes
    switch (statusCode) {
      case 400:
        return {
          code: 'BAD_REQUEST',
          message: 'Invalid request parameters',
          statusCode: 400,
          retryable: false,
          fallbackAvailable: false
        };

      case 401:
        return {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401,
          retryable: false,
          fallbackAvailable: false
        };

      case 403:
        return {
          code: 'FORBIDDEN',
          message: 'Access forbidden',
          statusCode: 403,
          retryable: false,
          fallbackAvailable: false
        };

      case 404:
        return {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          statusCode: 404,
          retryable: false,
          fallbackAvailable: true
        };

      case 429:
        const retryAfter = error.headers?.['retry-after'] || error.response?.headers?.['retry-after'];
        return {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded',
          statusCode: 429,
          retryable: true,
          fallbackAvailable: true,
          retryAfter: retryAfter ? parseInt(retryAfter) : 60
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          code: 'SERVER_ERROR',
          message: 'Server error',
          statusCode,
          retryable: true,
          fallbackAvailable: true
        };

      default:
        return {
          code: 'UNKNOWN_ERROR',
          message: message,
          statusCode,
          retryable: true,
          fallbackAvailable: true
        };
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number): number {
    let delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
      this.retryConfig.maxDelay
    );

    if (this.retryConfig.jitter) {
      // Add random jitter (±25%)
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      delay += jitter;
    }

    return Math.max(0, Math.floor(delay));
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitBreakerOpen(apiName: string): boolean {
    const state = this.circuitBreakerState.get(apiName);
    if (!state) return false;

    const now = Date.now();

    switch (state.state) {
      case 'CLOSED':
        return false;
      
      case 'OPEN':
        if (now - state.lastFailure > this.circuitBreakerConfig.recoveryTimeout) {
          // Move to half-open
          state.state = 'HALF_OPEN';
          return false;
        }
        return true;
      
      case 'HALF_OPEN':
        return false;
      
      default:
        return false;
    }
  }

  /**
   * Record API failure
   */
  private recordFailure(apiName: string): void {
    const now = Date.now();
    const state = this.circuitBreakerState.get(apiName) || {
      failures: 0,
      lastFailure: 0,
      state: 'CLOSED' as const
    };

    state.failures++;
    state.lastFailure = now;

    if (state.failures >= this.circuitBreakerConfig.failureThreshold) {
      state.state = 'OPEN';
      console.warn(`Circuit breaker opened for ${apiName} after ${state.failures} failures`);
    }

    this.circuitBreakerState.set(apiName, state);
  }

  /**
   * Reset circuit breaker after successful call
   */
  private resetCircuitBreaker(apiName: string): void {
    const state = this.circuitBreakerState.get(apiName);
    if (state) {
      state.failures = 0;
      state.state = 'CLOSED';
      this.circuitBreakerState.set(apiName, state);
    }
  }

  /**
   * Create a handled error with additional context
   */
  private createHandledError(apiError: APIError, apiName: string): Error {
    const error = new Error(`${apiName}: ${apiError.message}`);
    (error as any).apiError = apiError;
    (error as any).apiName = apiName;
    (error as any).timestamp = new Date().toISOString();
    return error;
  }

  /**
   * Get fallback data from cache
   */
  getFallbackData<T>(key: string): T | null {
    if (!this.fallbackConfig.cacheFallback) return null;

    const cached = this.fallbackCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.fallbackConfig.cacheTTL) {
      this.fallbackCache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set fallback data in cache
   */
  setFallbackData<T>(key: string, data: T): void {
    if (!this.fallbackConfig.cacheFallback) return;

    this.fallbackCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get circuit breaker status for an API
   */
  getCircuitBreakerStatus(apiName: string): {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
    lastFailure: number;
  } | null {
    const state = this.circuitBreakerState.get(apiName);
    if (!state) return null;

    return {
      state: state.state,
      failures: state.failures,
      lastFailure: state.lastFailure
    };
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllCircuitBreakerStatuses(): Record<string, any> {
    const statuses: Record<string, any> = {};
    for (const [apiName, state] of this.circuitBreakerState.entries()) {
      statuses[apiName] = {
        state: state.state,
        failures: state.failures,
        lastFailure: state.lastFailure
      };
    }
    return statuses;
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreakerState.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(
    retryConfig?: Partial<RetryConfig>,
    circuitBreakerConfig?: Partial<CircuitBreakerConfig>,
    fallbackConfig?: Partial<FallbackConfig>
  ): void {
    if (retryConfig) {
      this.retryConfig = { ...this.retryConfig, ...retryConfig };
    }
    if (circuitBreakerConfig) {
      this.circuitBreakerConfig = { ...this.circuitBreakerConfig, ...circuitBreakerConfig };
    }
    if (fallbackConfig) {
      this.fallbackConfig = { ...this.fallbackConfig, ...fallbackConfig };
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const externalAPIErrorHandler = new ExternalAPIErrorHandler();

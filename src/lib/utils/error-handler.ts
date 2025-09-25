/**
 * T071: Error handling and retry logic for external APIs
 * Comprehensive error handling, retry mechanisms, and graceful degradation
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export interface ErrorContext {
  operation: string;
  endpoint?: string;
  parameters?: Record<string, any>;
  timestamp: number;
  userAgent?: string;
  networkStatus?: boolean;
}

export interface ErrorLog {
  id: string;
  error: Error;
  context: ErrorContext;
  recoveryAction?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  handled: boolean;
}

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  retryable: boolean;
  context?: ErrorContext;
}

class ErrorHandler {
  private errorLogs: ErrorLog[] = [];
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private maxLogEntries = 1000;

  /**
   * Retry operation with exponential backoff
   */
  async retry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: Partial<ErrorContext>
  ): Promise<T> {
    const finalConfig: RetryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      exponentialBackoff: true,
      retryCondition: this.isRetryableError,
      ...config
    };

    let lastError: any;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        const result = await operation();

        // If we had previous failures but now succeeded, log recovery
        if (attempt > 1) {
          this.logError(lastError, {
            operation: 'retry_success',
            ...context,
            timestamp: Date.now()
          }, 'Recovery after retry', 'low', true);
        }

        return result;

      } catch (error) {
        lastError = error;

        // Check if this error is retryable
        if (!finalConfig.retryCondition!(error)) {
          this.logError(error, {
            operation: 'non_retryable_error',
            ...context,
            timestamp: Date.now()
          }, 'Non-retryable error', 'high', false);
          throw this.enhanceError(error, context);
        }

        // Don't retry on last attempt
        if (attempt === finalConfig.maxAttempts) {
          this.logError(error, {
            operation: 'retry_exhausted',
            ...context,
            timestamp: Date.now()
          }, 'All retry attempts failed', 'critical', false);
          throw this.enhanceError(error, context);
        }

        // Call retry callback
        if (finalConfig.onRetry) {
          finalConfig.onRetry(attempt, error);
        }

        // Calculate delay
        let delay = finalConfig.baseDelay;
        if (finalConfig.exponentialBackoff) {
          delay = Math.min(
            finalConfig.baseDelay * Math.pow(2, attempt - 1),
            finalConfig.maxDelay
          );
        }

        // Add jitter to prevent thundering herd
        delay += Math.random() * 1000;

        this.logError(error, {
          operation: 'retry_attempt',
          ...context,
          timestamp: Date.now()
        }, `Retry attempt ${attempt}, waiting ${delay}ms`, 'medium', true);

        await this.delay(delay);
      }
    }

    throw this.enhanceError(lastError, context);
  }

  /**
   * Execute operation with circuit breaker pattern
   */
  async withCircuitBreaker<T>(
    key: string,
    operation: () => Promise<T>,
    config?: Partial<{
      failureThreshold: number;
      resetTimeout: number;
      monitoringPeriod: number;
    }>,
    context?: Partial<ErrorContext>
  ): Promise<T> {
    let circuitBreaker = this.circuitBreakers.get(key);

    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker(key, {
        failureThreshold: 5,
        resetTimeout: 60000,
        monitoringPeriod: 60000,
        ...config
      });
      this.circuitBreakers.set(key, circuitBreaker);
    }

    return circuitBreaker.execute(operation, context);
  }

  /**
   * Handle API errors with proper categorization
   */
  handleApiError(
    error: any,
    context: Partial<ErrorContext>,
    fallbackValue?: any
  ): never | any {
    const enhancedError = this.enhanceError(error, context);
    const severity = this.categorizeError(error);

    this.logError(enhancedError, {
      operation: 'api_error',
      ...context,
      timestamp: Date.now()
    }, this.getRecoveryAction(error), severity, false);

    // Return fallback value for low/medium severity errors
    if ((severity === 'low' || severity === 'medium') && fallbackValue !== undefined) {
      console.warn(`Using fallback value for ${context.operation}:`, fallbackValue);
      return fallbackValue;
    }

    throw enhancedError;
  }

  /**
   * Handle network errors with automatic recovery
   */
  async handleNetworkError<T>(
    operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>,
    context?: Partial<ErrorContext>
  ): Promise<T> {
    try {
      return await this.retry(operation, {
        maxAttempts: 3,
        baseDelay: 2000,
        retryCondition: (error) => this.isNetworkError(error)
      }, context);

    } catch (error) {
      if (fallbackOperation) {
        this.logError(error, {
          operation: 'network_fallback',
          ...context,
          timestamp: Date.now()
        }, 'Using fallback operation due to network error', 'medium', true);

        try {
          return await fallbackOperation();
        } catch (fallbackError) {
          this.logError(fallbackError, {
            operation: 'fallback_failed',
            ...context,
            timestamp: Date.now()
          }, 'Fallback operation also failed', 'critical', false);

          throw this.enhanceError(fallbackError, context);
        }
      }

      throw this.enhanceError(error, context);
    }
  }

  /**
   * Graceful degradation for non-critical operations
   */
  async gracefulDegradation<T>(
    operation: () => Promise<T>,
    degradedOperation: () => Promise<T>,
    context?: Partial<ErrorContext>
  ): Promise<T> {
    try {
      return await operation();

    } catch (error) {
      const severity = this.categorizeError(error);

      // Only degrade for low/medium severity errors
      if (severity === 'low' || severity === 'medium') {
        this.logError(error, {
          operation: 'graceful_degradation',
          ...context,
          timestamp: Date.now()
        }, 'Falling back to degraded operation', severity, true);

        return await degradedOperation();
      }

      // For high/critical errors, don't degrade
      throw this.enhanceError(error, context);
    }
  }

  /**
   * Batch operation with partial failure handling
   */
  async batchWithPartialFailure<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    options: {
      maxConcurrency?: number;
      continueOnError?: boolean;
      retryFailures?: boolean;
      context?: Partial<ErrorContext>;
    } = {}
  ): Promise<{
    results: Array<{ item: T; result?: R; error?: Error }>;
    successCount: number;
    failureCount: number;
  }> {
    const {
      maxConcurrency = 5,
      continueOnError = true,
      retryFailures = true,
      context = {}
    } = options;

    const results: Array<{ item: T; result?: R; error?: Error }> = [];
    let successCount = 0;
    let failureCount = 0;

    // Process items in batches
    for (let i = 0; i < items.length; i += maxConcurrency) {
      const batch = items.slice(i, i + maxConcurrency);

      const batchPromises = batch.map(async (item, index) => {
        try {
          const processItem = async () => operation(item);

          const result = retryFailures
            ? await this.retry(processItem, { maxAttempts: 2 }, context)
            : await processItem();

          results.push({ item, result });
          successCount++;

        } catch (error) {
          results.push({ item, error: error as Error });
          failureCount++;

          this.logError(error, {
            operation: 'batch_item_failure',
            ...context,
            timestamp: Date.now()
          }, `Failed to process batch item ${i + index}`, 'medium', continueOnError);

          if (!continueOnError) {
            throw error;
          }
        }
      });

      await Promise.all(batchPromises);
    }

    return { results, successCount, failureCount };
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsBySeverity: Record<string, number>;
    errorsByOperation: Record<string, number>;
    recentErrors: ErrorLog[];
    recoveryRate: number;
  } {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;

    const recentErrors = this.errorLogs.filter(log => log.context.timestamp >= last24Hours);
    const totalErrors = recentErrors.length;

    const errorsBySeverity = recentErrors.reduce((acc, log) => {
      acc[log.severity] = (acc[log.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorsByOperation = recentErrors.reduce((acc, log) => {
      const op = log.context.operation;
      acc[op] = (acc[op] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const handledErrors = recentErrors.filter(log => log.handled).length;
    const recoveryRate = totalErrors > 0 ? (handledErrors / totalErrors) * 100 : 100;

    return {
      totalErrors,
      errorsBySeverity,
      errorsByOperation,
      recentErrors: recentErrors.slice(-10), // Last 10 errors
      recoveryRate
    };
  }

  /**
   * Clear old error logs
   */
  cleanup(): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    this.errorLogs = this.errorLogs.filter(log => log.context.timestamp >= cutoff);

    // Keep only the most recent errors if over limit
    if (this.errorLogs.length > this.maxLogEntries) {
      this.errorLogs = this.errorLogs.slice(-this.maxLogEntries);
    }
  }

  /**
   * Private methods
   */
  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (this.isNetworkError(error)) return true;

    // HTTP 5xx errors are retryable
    if (error.statusCode >= 500) return true;

    // Rate limit errors are retryable
    if (error.statusCode === 429) return true;

    // Timeout errors are retryable
    if (error.code === 'TIMEOUT' || error.name === 'TimeoutError') return true;

    // Connection errors are retryable
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') return true;

    return false;
  }

  private isNetworkError(error: any): boolean {
    return (
      !navigator.onLine ||
      error.code === 'NETWORK_ERROR' ||
      error.message?.toLowerCase().includes('network') ||
      error.message?.toLowerCase().includes('fetch')
    );
  }

  private categorizeError(error: any): 'low' | 'medium' | 'high' | 'critical' {
    // Critical: Authentication, authorization, or data corruption
    if (error.statusCode === 401 || error.statusCode === 403) return 'critical';
    if (error.message?.toLowerCase().includes('corrupt')) return 'critical';

    // High: Client errors (4xx except rate limit)
    if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) return 'high';

    // Medium: Server errors, rate limits, timeouts
    if (error.statusCode >= 500 || error.statusCode === 429) return 'medium';
    if (error.code === 'TIMEOUT' || this.isNetworkError(error)) return 'medium';

    // Low: Other errors
    return 'low';
  }

  private getRecoveryAction(error: any): string {
    if (error.statusCode === 401) return 'Re-authenticate user';
    if (error.statusCode === 429) return 'Reduce request rate';
    if (error.statusCode >= 500) return 'Retry with backoff';
    if (this.isNetworkError(error)) return 'Check network connection';
    return 'Use fallback or cached data';
  }

  private enhanceError(error: any, context?: Partial<ErrorContext>): ApiError {
    const apiError = error as ApiError;
    apiError.retryable = this.isRetryableError(error);
    apiError.context = {
      operation: 'unknown',
      timestamp: Date.now(),
      networkStatus: navigator.onLine,
      userAgent: navigator.userAgent,
      ...context
    };

    return apiError;
  }

  private logError(
    error: any,
    context: ErrorContext,
    recoveryAction?: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    handled: boolean = false
  ): void {
    const errorLog: ErrorLog = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      error: error instanceof Error ? error : new Error(String(error)),
      context,
      recoveryAction,
      severity,
      handled
    };

    this.errorLogs.push(errorLog);

    // Log to console based on severity
    const logMessage = `[${severity.toUpperCase()}] ${context.operation}: ${errorLog.error.message}`;

    switch (severity) {
      case 'critical':
        console.error(logMessage, { error: errorLog.error, context });
        break;
      case 'high':
        console.error(logMessage, { context });
        break;
      case 'medium':
        console.warn(logMessage, { context });
        break;
      case 'low':
        console.info(logMessage);
        break;
    }

    // In production, you might want to send critical/high errors to external service
    if (severity === 'critical' || severity === 'high') {
      this.reportToExternalService(errorLog);
    }
  }

  private async reportToExternalService(errorLog: ErrorLog): Promise<void> {
    // Placeholder for external error reporting service
    // In production, integrate with services like Sentry, LogRocket, etc.
    console.log('Would report to external service:', errorLog.id);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(
    private name: string,
    private config: {
      failureThreshold: number;
      resetTimeout: number;
      monitoringPeriod: number;
    }
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    context?: Partial<ErrorContext>
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
        console.log(`Circuit breaker ${this.name} entering HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await operation();

      // Success: reset failures and close circuit
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
        console.log(`Circuit breaker ${this.name} reset to CLOSED state`);
      }

      return result;

    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.config.failureThreshold) {
        this.state = 'OPEN';
        console.error(`Circuit breaker ${this.name} opened due to ${this.failures} failures`);
      }

      throw error;
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Cleanup old logs every hour
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    errorHandler.cleanup();
  }, 60 * 60 * 1000);
}

export default errorHandler;

// Utility functions
export const withRetry = <T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>,
  context?: Partial<ErrorContext>
): Promise<T> => {
  return errorHandler.retry(operation, config, context);
};

export const withCircuitBreaker = <T>(
  key: string,
  operation: () => Promise<T>,
  context?: Partial<ErrorContext>
): Promise<T> => {
  return errorHandler.withCircuitBreaker(key, operation, undefined, context);
};

export const handleApiError = (
  error: any,
  context: Partial<ErrorContext>,
  fallbackValue?: any
) => {
  return errorHandler.handleApiError(error, context, fallbackValue);
};

// Common retry configurations
export const RETRY_CONFIGS = {
  QUICK: { maxAttempts: 2, baseDelay: 500, exponentialBackoff: false },
  NORMAL: { maxAttempts: 3, baseDelay: 1000, exponentialBackoff: true },
  PERSISTENT: { maxAttempts: 5, baseDelay: 2000, exponentialBackoff: true },
  CRITICAL: { maxAttempts: 7, baseDelay: 1000, maxDelay: 30000, exponentialBackoff: true }
} as const;
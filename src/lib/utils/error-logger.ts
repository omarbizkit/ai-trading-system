/**
 * Error Logging and Tracking Utilities
 * Provides comprehensive error logging, tracking, and alerting for production systems
 */

export interface ErrorLogEntry {
  id: string;
  timestamp: Date;
  level: ErrorLevel;
  category: ErrorCategory;
  message: string;
  error?: Error;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  stackTrace?: string;
  tags?: string[];
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export enum ErrorLevel {
  CRITICAL = 'critical',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  DEBUG = 'debug'
}

export enum ErrorCategory {
  API_ERROR = 'api_error',
  DATABASE_ERROR = 'database_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  VALIDATION_ERROR = 'validation_error',
  NETWORK_ERROR = 'network_error',
  TYPESCRIPT_ERROR = 'typescript_error',
  BUILD_ERROR = 'build_error',
  DEPLOYMENT_ERROR = 'deployment_error',
  USER_ERROR = 'user_error',
  SYSTEM_ERROR = 'system_error'
}

export interface ErrorLogger {
  critical(message: string, error?: Error, context?: Record<string, any>): Promise<string>;
  error(message: string, error?: Error, context?: Record<string, any>): Promise<string>;
  warning(message: string, context?: Record<string, any>): Promise<string>;
  info(message: string, context?: Record<string, any>): Promise<string>;
  debug(message: string, context?: Record<string, any>): Promise<string>;
  getErrors(filters?: ErrorFilters): Promise<ErrorLogEntry[]>;
  resolveError(errorId: string, resolvedBy: string): Promise<boolean>;
  getErrorStats(): Promise<ErrorStats>;
}

export interface ErrorFilters {
  level?: ErrorLevel;
  category?: ErrorCategory;
  startDate?: Date;
  endDate?: Date;
  resolved?: boolean;
  userId?: string;
  tags?: string[];
  limit?: number;
}

export interface ErrorStats {
  totalErrors: number;
  criticalErrors: number;
  unresolvedErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByLevel: Record<ErrorLevel, number>;
  recentErrors: ErrorLogEntry[];
  topErrors: Array<{ message: string; count: number; lastOccurred: Date }>;
}

/**
 * Production Error Logger Implementation
 */
export class ProductionErrorLogger implements ErrorLogger {
  private static instance: ProductionErrorLogger;
  private errors: Map<string, ErrorLogEntry> = new Map();
  private sessionId: string;
  private userId?: string;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeFromStorage();
  }

  static getInstance(): ProductionErrorLogger {
    if (!ProductionErrorLogger.instance) {
      ProductionErrorLogger.instance = new ProductionErrorLogger();
    }
    return ProductionErrorLogger.instance;
  }

  private generateId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentContext(): Record<string, any> {
    const context: Record<string, any> = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      page: typeof window !== 'undefined' ? window.location.pathname : 'server',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server'
    };

    if (this.userId) {
      context.userId = this.userId;
    }

    return context;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  async critical(message: string, error?: Error, context?: Record<string, any>): Promise<string> {
    return this.logError(ErrorLevel.CRITICAL, message, error, context);
  }

  async error(message: string, error?: Error, context?: Record<string, any>): Promise<string> {
    return this.logError(ErrorLevel.ERROR, message, error, context);
  }

  async warning(message: string, context?: Record<string, any>): Promise<string> {
    return this.logError(ErrorLevel.WARNING, message, undefined, context);
  }

  async info(message: string, context?: Record<string, any>): Promise<string> {
    return this.logError(ErrorLevel.INFO, message, undefined, context);
  }

  async debug(message: string, context?: Record<string, any>): Promise<string> {
    return this.logError(ErrorLevel.DEBUG, message, undefined, context);
  }

  private async logError(
    level: ErrorLevel,
    message: string,
    error?: Error,
    additionalContext?: Record<string, any>
  ): Promise<string> {
    const id = this.generateId();
    const timestamp = new Date();
    const context = { ...this.getCurrentContext(), ...additionalContext };

    // Determine error category
    const category = this.categorizeError(message, error, context);

    const logEntry: ErrorLogEntry = {
      id,
      timestamp,
      level,
      category,
      message,
      error,
      context,
      userId: this.userId,
      sessionId: this.sessionId,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
      stackTrace: error?.stack,
      tags: this.generateTags(message, error, context),
      resolved: false
    };

    // Store error
    this.errors.set(id, logEntry);

    // Persist to storage
    await this.persistError(logEntry);

    // Send to console in development
    if (process.env.NODE_ENV === 'development') {
      this.logToConsole(logEntry);
    }

    // Send to remote logging service in production
    if (process.env.NODE_ENV === 'production') {
      await this.sendToRemoteLogger(logEntry);
    }

    // Trigger alerts for critical errors
    if (level === ErrorLevel.CRITICAL) {
      await this.triggerAlert(logEntry);
    }

    return id;
  }

  private categorizeError(message: string, error?: Error, context?: Record<string, any>): ErrorCategory {
    const messageText = message.toLowerCase();
    const errorMessage = error?.message?.toLowerCase() || '';

    // API and Network errors
    if (messageText.includes('api') || messageText.includes('fetch') ||
        messageText.includes('network') || messageText.includes('timeout')) {
      return ErrorCategory.API_ERROR;
    }

    // Database errors
    if (messageText.includes('database') || messageText.includes('supabase') ||
        messageText.includes('sql') || messageText.includes('connection')) {
      return ErrorCategory.DATABASE_ERROR;
    }

    // Authentication errors
    if (messageText.includes('auth') || messageText.includes('login') ||
        messageText.includes('token') || messageText.includes('permission')) {
      return ErrorCategory.AUTHENTICATION_ERROR;
    }

    // Validation errors
    if (messageText.includes('validation') || messageText.includes('invalid') ||
        messageText.includes('required') || messageText.includes('format')) {
      return ErrorCategory.VALIDATION_ERROR;
    }

    // TypeScript errors
    if (messageText.includes('typescript') || messageText.includes('type') ||
        errorMessage.includes('ts(')) {
      return ErrorCategory.TYPESCRIPT_ERROR;
    }

    // Build errors
    if (messageText.includes('build') || messageText.includes('compile') ||
        messageText.includes('bundle') || messageText.includes('astro')) {
      return ErrorCategory.BUILD_ERROR;
    }

    // Deployment errors
    if (messageText.includes('deploy') || messageText.includes('deployment') ||
        messageText.includes('environment') || messageText.includes('config')) {
      return ErrorCategory.DEPLOYMENT_ERROR;
    }

    // Default to system error
    return ErrorCategory.SYSTEM_ERROR;
  }

  private generateTags(message: string, error?: Error, context?: Record<string, any>): string[] {
    const tags: string[] = [];

    // Add environment tag
    tags.push(`env:${process.env.NODE_ENV || 'unknown'}`);

    // Add platform tag
    if (typeof window !== 'undefined') {
      tags.push('platform:client');
    } else {
      tags.push('platform:server');
    }

    // Add error type tags
    if (error) {
      tags.push(`error_type:${error.constructor.name}`);
    }

    // Add context-based tags
    if (context?.component) {
      tags.push(`component:${context.component}`);
    }

    if (context?.feature) {
      tags.push(`feature:${context.feature}`);
    }

    // Add URL-based tags
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname.includes('/api/')) {
        tags.push('api_endpoint');
      }
      if (pathname.includes('/simulation')) {
        tags.push('simulation');
      }
      if (pathname.includes('/backtesting')) {
        tags.push('backtesting');
      }
    }

    return tags;
  }

  private logToConsole(logEntry: ErrorLogEntry): void {
    const levelSymbols = {
      [ErrorLevel.CRITICAL]: '🚨',
      [ErrorLevel.ERROR]: '❌',
      [ErrorLevel.WARNING]: '⚠️',
      [ErrorLevel.INFO]: 'ℹ️',
      [ErrorLevel.DEBUG]: '🐛'
    };

    const symbol = levelSymbols[logEntry.level];
    const timestamp = logEntry.timestamp.toISOString();

    console.group(`${symbol} [${logEntry.level.toUpperCase()}] ${logEntry.message}`);
    console.log(`📅 Time: ${timestamp}`);
    console.log(`🏷️ Category: ${logEntry.category}`);
    console.log(`🆔 ID: ${logEntry.id}`);

    if (logEntry.error) {
      console.log(`💥 Error:`, logEntry.error);
    }

    if (logEntry.context && Object.keys(logEntry.context).length > 0) {
      console.log(`📋 Context:`, logEntry.context);
    }

    if (logEntry.tags && logEntry.tags.length > 0) {
      console.log(`🏷️ Tags:`, logEntry.tags.join(', '));
    }

    console.groupEnd();
  }

  private async persistError(logEntry: ErrorLogEntry): Promise<void> {
    try {
      // Store in localStorage for client-side persistence
      if (typeof window !== 'undefined') {
        const existingErrors = localStorage.getItem('errorLogs');
        const errors = existingErrors ? JSON.parse(existingErrors) : [];

        // Add new error and keep only last 100 errors
        errors.unshift({
          ...logEntry,
          timestamp: logEntry.timestamp.toISOString(),
          error: logEntry.error ? {
            name: logEntry.error.name,
            message: logEntry.error.message,
            stack: logEntry.error.stack
          } : undefined
        });

        // Keep only last 100 errors
        if (errors.length > 100) {
          errors.splice(100);
        }

        localStorage.setItem('errorLogs', JSON.stringify(errors));
      }
    } catch (error) {
      console.error('Failed to persist error log:', error);
    }
  }

  private async sendToRemoteLogger(logEntry: ErrorLogEntry): Promise<void> {
    try {
      // In production, send to remote logging service
      await fetch('/api/logs/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...logEntry,
          timestamp: logEntry.timestamp.toISOString(),
          error: logEntry.error ? {
            name: logEntry.error.name,
            message: logEntry.error.message,
            stack: logEntry.error.stack
          } : undefined
        })
      });
    } catch (error) {
      // Fallback to console if remote logging fails
      console.error('Failed to send error to remote logger:', error);
    }
  }

  private async triggerAlert(logEntry: ErrorLogEntry): Promise<void> {
    try {
      // Send critical error alert
      await fetch('/api/alerts/critical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          errorId: logEntry.id,
          message: logEntry.message,
          category: logEntry.category,
          timestamp: logEntry.timestamp.toISOString(),
          context: logEntry.context
        })
      });
    } catch (error) {
      console.error('Failed to trigger critical error alert:', error);
    }
  }

  private initializeFromStorage(): void {
    try {
      if (typeof window !== 'undefined') {
        const existingErrors = localStorage.getItem('errorLogs');
        if (existingErrors) {
          const errors = JSON.parse(existingErrors);
          errors.forEach((errorData: any) => {
            const logEntry: ErrorLogEntry = {
              ...errorData,
              timestamp: new Date(errorData.timestamp),
              error: errorData.error ? new Error(errorData.error.message) : undefined
            };
            if (logEntry.error && errorData.error.stack) {
              logEntry.error.stack = errorData.error.stack;
            }
            this.errors.set(logEntry.id, logEntry);
          });
        }
      }
    } catch (error) {
      console.error('Failed to initialize error logger from storage:', error);
    }
  }

  async getErrors(filters?: ErrorFilters): Promise<ErrorLogEntry[]> {
    let filteredErrors = Array.from(this.errors.values());

    if (filters) {
      if (filters.level) {
        filteredErrors = filteredErrors.filter(error => error.level === filters.level);
      }

      if (filters.category) {
        filteredErrors = filteredErrors.filter(error => error.category === filters.category);
      }

      if (filters.resolved !== undefined) {
        filteredErrors = filteredErrors.filter(error => error.resolved === filters.resolved);
      }

      if (filters.userId) {
        filteredErrors = filteredErrors.filter(error => error.userId === filters.userId);
      }

      if (filters.startDate) {
        filteredErrors = filteredErrors.filter(error => error.timestamp >= filters.startDate!);
      }

      if (filters.endDate) {
        filteredErrors = filteredErrors.filter(error => error.timestamp <= filters.endDate!);
      }

      if (filters.tags && filters.tags.length > 0) {
        filteredErrors = filteredErrors.filter(error =>
          error.tags?.some(tag => filters.tags!.includes(tag))
        );
      }
    }

    // Sort by timestamp (newest first)
    filteredErrors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit if specified
    if (filters?.limit) {
      filteredErrors = filteredErrors.slice(0, filters.limit);
    }

    return filteredErrors;
  }

  async resolveError(errorId: string, resolvedBy: string): Promise<boolean> {
    const error = this.errors.get(errorId);
    if (!error) {
      return false;
    }

    error.resolved = true;
    error.resolvedAt = new Date();
    error.resolvedBy = resolvedBy;

    // Persist the resolution
    await this.persistError(error);

    return true;
  }

  async getErrorStats(): Promise<ErrorStats> {
    const allErrors = Array.from(this.errors.values());
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats: ErrorStats = {
      totalErrors: allErrors.length,
      criticalErrors: allErrors.filter(error => error.level === ErrorLevel.CRITICAL).length,
      unresolvedErrors: allErrors.filter(error => !error.resolved).length,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsByLevel: {} as Record<ErrorLevel, number>,
      recentErrors: allErrors
        .filter(error => error.timestamp >= oneDayAgo)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 10),
      topErrors: []
    };

    // Calculate errors by category
    Object.values(ErrorCategory).forEach(category => {
      stats.errorsByCategory[category] = allErrors.filter(error => error.category === category).length;
    });

    // Calculate errors by level
    Object.values(ErrorLevel).forEach(level => {
      stats.errorsByLevel[level] = allErrors.filter(error => error.level === level).length;
    });

    // Calculate top errors (by message frequency)
    const errorMessages = new Map<string, { count: number; lastOccurred: Date }>();
    allErrors.forEach(error => {
      const existing = errorMessages.get(error.message);
      if (existing) {
        existing.count++;
        if (error.timestamp > existing.lastOccurred) {
          existing.lastOccurred = error.timestamp;
        }
      } else {
        errorMessages.set(error.message, { count: 1, lastOccurred: error.timestamp });
      }
    });

    stats.topErrors = Array.from(errorMessages.entries())
      .map(([message, data]) => ({ message, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return stats;
  }

  // Utility methods for common error patterns
  async logAPIError(endpoint: string, status: number, error: Error, context?: Record<string, any>): Promise<string> {
    return this.error(
      `API Error: ${endpoint} returned ${status}`,
      error,
      { ...context, endpoint, status, component: 'api' }
    );
  }

  async logDatabaseError(operation: string, error: Error, context?: Record<string, any>): Promise<string> {
    return this.error(
      `Database Error: ${operation} failed`,
      error,
      { ...context, operation, component: 'database' }
    );
  }

  async logAuthError(action: string, error: Error, context?: Record<string, any>): Promise<string> {
    return this.warning(
      `Authentication Error: ${action} failed`,
      { ...context, action, component: 'auth', error: error.message }
    );
  }

  async logValidationError(field: string, value: any, rule: string): Promise<string> {
    return this.warning(
      `Validation Error: ${field} failed ${rule} validation`,
      { field, value, rule, component: 'validation' }
    );
  }
}

// Export singleton instance
export const errorLogger = ProductionErrorLogger.getInstance();

// Global error handler for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorLogger.error(
      `Unhandled Error: ${event.message}`,
      event.error,
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        component: 'global_handler'
      }
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorLogger.error(
      `Unhandled Promise Rejection: ${event.reason}`,
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      { component: 'promise_handler' }
    );
  });
}

// Export utility functions
export function withErrorLogging<T extends (...args: any[]) => any>(
  fn: T,
  context?: Record<string, any>
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);

      // Handle async functions
      if (result instanceof Promise) {
        return result.catch((error: Error) => {
          errorLogger.error(
            `Function ${fn.name} threw an error`,
            error,
            { ...context, function: fn.name, args }
          );
          throw error;
        });
      }

      return result;
    } catch (error) {
      errorLogger.error(
        `Function ${fn.name} threw an error`,
        error instanceof Error ? error : new Error(String(error)),
        { ...context, function: fn.name, args }
      );
      throw error;
    }
  }) as T;
}

export function createComponentLogger(componentName: string) {
  return {
    critical: (message: string, error?: Error, context?: Record<string, any>) =>
      errorLogger.critical(message, error, { ...context, component: componentName }),
    error: (message: string, error?: Error, context?: Record<string, any>) =>
      errorLogger.error(message, error, { ...context, component: componentName }),
    warning: (message: string, context?: Record<string, any>) =>
      errorLogger.warning(message, { ...context, component: componentName }),
    info: (message: string, context?: Record<string, any>) =>
      errorLogger.info(message, { ...context, component: componentName }),
    debug: (message: string, context?: Record<string, any>) =>
      errorLogger.debug(message, { ...context, component: componentName })
  };
}
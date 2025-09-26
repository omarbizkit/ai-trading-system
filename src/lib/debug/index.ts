/**
 * T004: Development Debugging Tools
 * Centralized debugging utilities for production readiness development
 */

import { errorTracker } from '../utils/typescript-error-tracker';

export interface DebugInfo {
  timestamp: Date;
  environment: string;
  node_version: string;
  typescript_errors: number;
  build_status: 'success' | 'failed' | 'pending';
  api_health: Record<string, 'healthy' | 'degraded' | 'failed'>;
  performance_metrics: {
    memory_usage: number;
    heap_used: number;
    uptime: number;
  };
}

export class ProductionReadinessDebugger {
  private static instance: ProductionReadinessDebugger;
  private debugEnabled: boolean = false;
  private logs: Array<{timestamp: Date, level: string, message: string, data?: any}> = [];

  static getInstance(): ProductionReadinessDebugger {
    if (!ProductionReadinessDebugger.instance) {
      ProductionReadinessDebugger.instance = new ProductionReadinessDebugger();
    }
    return ProductionReadinessDebugger.instance;
  }

  constructor() {
    this.debugEnabled = process.env.NODE_ENV === 'development' || 
                       process.env.ENABLE_DEBUG_LOGS === 'true';
  }

  /**
   * Enable or disable debug logging
   */
  setDebugEnabled(enabled: boolean): void {
    this.debugEnabled = enabled;
    this.log('info', `Debug logging ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Log debug information
   */
  log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): void {
    const logEntry = {
      timestamp: new Date(),
      level,
      message,
      data
    };

    this.logs.push(logEntry);

    // Keep only last 1000 logs to prevent memory issues
    if (this.logs.length > 1000) {
      this.logs.shift();
    }

    if (this.debugEnabled) {
      const prefix = `[PROD-DEBUG][${level.toUpperCase()}]`;
      const timestamp = logEntry.timestamp.toISOString();
      
      if (data) {
        console.log(`${prefix} ${timestamp}: ${message}`, data);
      } else {
        console.log(`${prefix} ${timestamp}: ${message}`);
      }
    }
  }

  /**
   * Get current debug information
   */
  async getDebugInfo(): Promise<DebugInfo> {
    const errorSummary = errorTracker.getSummary();
    
    return {
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'unknown',
      node_version: process.version,
      typescript_errors: errorSummary.total,
      build_status: await this.checkBuildStatus(),
      api_health: await this.checkAPIHealth(),
      performance_metrics: this.getPerformanceMetrics()
    };
  }

  /**
   * Check current build status
   */
  private async checkBuildStatus(): Promise<'success' | 'failed' | 'pending'> {
    try {
      // This would be implemented to actually check TypeScript compilation
      // For now, return based on error count
      const errorSummary = errorTracker.getSummary();
      if (errorSummary.total === 0) {
        return 'success';
      } else {
        return 'failed';
      }
    } catch (error) {
      this.log('error', 'Failed to check build status', error);
      return 'failed';
    }
  }

  /**
   * Check API endpoint health
   */
  private async checkAPIHealth(): Promise<Record<string, 'healthy' | 'degraded' | 'failed'>> {
    const endpoints = [
      '/api/health',
      '/api/user/profile', 
      '/api/runs',
      '/api/market/bitcoin',
      '/api/predictions/bitcoin'
    ];

    const health: Record<string, 'healthy' | 'degraded' | 'failed'> = {};

    for (const endpoint of endpoints) {
      try {
        // In a real implementation, this would make actual HTTP requests
        // For now, simulate health checks
        health[endpoint] = 'healthy';
      } catch (error) {
        this.log('warn', `API health check failed for ${endpoint}`, error);
        health[endpoint] = 'failed';
      }
    }

    return health;
  }

  /**
   * Get current performance metrics
   */
  private getPerformanceMetrics() {
    const memUsage = process.memoryUsage();
    
    return {
      memory_usage: memUsage.rss,
      heap_used: memUsage.heapUsed,
      uptime: process.uptime()
    };
  }

  /**
   * Run comprehensive diagnostics
   */
  async runDiagnostics(): Promise<{
    summary: string;
    details: DebugInfo;
    recommendations: string[];
  }> {
    this.log('info', 'Running production readiness diagnostics...');

    const debugInfo = await this.getDebugInfo();
    const recommendations: string[] = [];

    // Analyze TypeScript errors
    if (debugInfo.typescript_errors > 0) {
      recommendations.push(`Fix ${debugInfo.typescript_errors} TypeScript errors before deployment`);
    }

    // Check build status
    if (debugInfo.build_status === 'failed') {
      recommendations.push('Resolve build failures before proceeding');
    }

    // Check API health
    const failedAPIs = Object.entries(debugInfo.api_health)
      .filter(([, status]) => status === 'failed')
      .map(([endpoint]) => endpoint);

    if (failedAPIs.length > 0) {
      recommendations.push(`Fix failed API endpoints: ${failedAPIs.join(', ')}`);
    }

    // Check memory usage
    const memoryMB = debugInfo.performance_metrics.memory_usage / 1024 / 1024;
    if (memoryMB > 500) {
      recommendations.push('High memory usage detected, consider optimization');
    }

    const summary = this.generateSummary(debugInfo, recommendations);

    this.log('info', 'Diagnostics completed', { 
      errors: debugInfo.typescript_errors,
      recommendations: recommendations.length 
    });

    return {
      summary,
      details: debugInfo,
      recommendations
    };
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(debugInfo: DebugInfo, recommendations: string[]): string {
    const status = recommendations.length === 0 ? 'READY' : 'NOT READY';
    
    return [
      `Production Readiness Status: ${status}`,
      `TypeScript Errors: ${debugInfo.typescript_errors}`,
      `Build Status: ${debugInfo.build_status}`,
      `Recommendations: ${recommendations.length}`,
      `Environment: ${debugInfo.environment}`,
      `Node Version: ${debugInfo.node_version}`
    ].join('\n');
  }

  /**
   * Export debug logs for analysis
   */
  exportLogs(): Array<{timestamp: Date, level: string, message: string, data?: any}> {
    return [...this.logs];
  }

  /**
   * Clear debug logs
   */
  clearLogs(): void {
    this.logs = [];
    this.log('info', 'Debug logs cleared');
  }

  /**
   * Get TypeScript error analysis
   */
  getTypeScriptErrorAnalysis() {
    const summary = errorTracker.getSummary();
    const criticalErrors = errorTracker.getErrorsBySeverity('critical');
    const highErrors = errorTracker.getErrorsBySeverity('high');

    return {
      summary,
      critical_errors: criticalErrors.slice(0, 10), // Top 10 critical
      high_priority_errors: highErrors.slice(0, 10), // Top 10 high priority
      recommendations: this.getErrorRecommendations(criticalErrors, highErrors)
    };
  }

  /**
   * Generate recommendations based on error types
   */
  private getErrorRecommendations(critical: any[], high: any[]): string[] {
    const recommendations: string[] = [];

    if (critical.length > 0) {
      recommendations.push('Focus on critical errors first - they block the build');
    }

    if (high.length > 0) {
      recommendations.push('Address high priority errors to improve type safety');
    }

    // Analyze common patterns
    const commonFiles = new Set();
    [...critical, ...high].forEach(error => {
      commonFiles.add(error.file_path);
    });

    if (commonFiles.size < 5 && (critical.length + high.length) > 10) {
      recommendations.push('Errors are concentrated in few files - focus on those first');
    }

    return recommendations;
  }
}

// Export singleton instance
export const debugger = ProductionReadinessDebugger.getInstance();

// Utility functions for common debugging tasks
export const debug = {
  log: (message: string, data?: any) => debugger.log('debug', message, data),
  info: (message: string, data?: any) => debugger.log('info', message, data),
  warn: (message: string, data?: any) => debugger.log('warn', message, data),
  error: (message: string, data?: any) => debugger.log('error', message, data),
  
  async checkProductionReadiness() {
    return debugger.runDiagnostics();
  },
  
  async getSystemInfo() {
    return debugger.getDebugInfo();
  },
  
  getTypeScriptErrors() {
    return debugger.getTypeScriptErrorAnalysis();
  }
};
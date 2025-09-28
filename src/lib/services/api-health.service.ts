/**
 * API Health Service
 * 
 * Service for monitoring API endpoint health and connectivity status
 * during the production readiness phase.
 */

import type { 
  APIHealthCheck, 
  HTTPMethod, 
  HealthStatus, 
  Environment 
} from '../types/api-health';

export class APIHealthService {
  private healthChecks: Map<string, APIHealthCheck> = new Map();
  private checkHistory: Map<string, APIHealthCheck[]> = new Map();

  constructor() {
    this.initializeDefaultEndpoints();
  }

  /**
   * Initialize default API endpoints for health monitoring
   */
  private initializeDefaultEndpoints(): void {
    const defaultEndpoints = [
      { path: '/api/health', method: 'GET' as HTTPMethod, expectedStatus: 200 },
      { path: '/api/health/database', method: 'GET' as HTTPMethod, expectedStatus: 200 },
      { path: '/api/health/endpoints', method: 'GET' as HTTPMethod, expectedStatus: 200 },
      { path: '/api/debug/typescript-errors', method: 'GET' as HTTPMethod, expectedStatus: 200 },
      { path: '/api/debug/build-status', method: 'GET' as HTTPMethod, expectedStatus: 200 },
      { path: '/api/debug/deployment-status', method: 'GET' as HTTPMethod, expectedStatus: 200 },
      { path: '/api/user/profile', method: 'GET' as HTTPMethod, expectedStatus: 200 },
      { path: '/api/trading/portfolio', method: 'GET' as HTTPMethod, expectedStatus: 200 },
      { path: '/api/trading/history', method: 'GET' as HTTPMethod, expectedStatus: 200 },
      { path: '/api/market/data', method: 'GET' as HTTPMethod, expectedStatus: 200 }
    ];

    defaultEndpoints.forEach(endpoint => {
      const id = this.generateHealthCheckId(endpoint.path, endpoint.method);
      const healthCheck: APIHealthCheck = {
        id,
        endpoint_path: endpoint.path,
        http_method: endpoint.method,
        expected_status: endpoint.expectedStatus,
        status: 'unknown',
        last_checked: new Date(),
        consecutive_failures: 0,
        environment: 'development'
      };
      
      this.healthChecks.set(id, healthCheck);
      this.checkHistory.set(id, []);
    });
  }

  /**
   * Perform health check for a specific endpoint
   */
  async checkEndpoint(
    endpointPath: string, 
    method: HTTPMethod = 'GET',
    environment: Environment = 'development'
  ): Promise<APIHealthCheck> {
    const id = this.generateHealthCheckId(endpointPath, method);
    const existingCheck = this.healthChecks.get(id);
    
    if (!existingCheck) {
      throw new Error(`Health check not found for endpoint: ${method} ${endpointPath}`);
    }

    const startTime = Date.now();
    let actualStatus: number | undefined;
    let errorMessage: string | undefined;
    let healthStatus: HealthStatus = 'unknown';

    try {
      const response = await this.makeRequest(endpointPath, method);
      actualStatus = response.status;
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        healthStatus = 'healthy';
        existingCheck.consecutive_failures = 0;
      } else {
        healthStatus = response.status >= 500 ? 'failed' : 'degraded';
        existingCheck.consecutive_failures++;
      }

      // Update the health check
      const updatedCheck: APIHealthCheck = {
        ...existingCheck,
        actual_status: actualStatus,
        response_time: responseTime,
        status: healthStatus,
        last_checked: new Date(),
        environment
      };

      this.healthChecks.set(id, updatedCheck);
      this.addToHistory(id, updatedCheck);

      return updatedCheck;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      healthStatus = 'failed';
      existingCheck.consecutive_failures++;

      const updatedCheck: APIHealthCheck = {
        ...existingCheck,
        actual_status: actualStatus,
        response_time: responseTime,
        error_message: errorMessage,
        status: healthStatus,
        last_checked: new Date(),
        environment
      };

      this.healthChecks.set(id, updatedCheck);
      this.addToHistory(id, updatedCheck);

      return updatedCheck;
    }
  }

  /**
   * Perform health checks for all registered endpoints
   */
  async checkAllEndpoints(environment: Environment = 'development'): Promise<APIHealthCheck[]> {
    const results: APIHealthCheck[] = [];
    
    for (const [id, healthCheck] of this.healthChecks) {
      try {
        const result = await this.checkEndpoint(
          healthCheck.endpoint_path, 
          healthCheck.http_method,
          environment
        );
        results.push(result);
      } catch (error) {
        console.error(`Failed to check endpoint ${healthCheck.endpoint_path}:`, error);
        // Create a failed health check
        const failedCheck: APIHealthCheck = {
          ...healthCheck,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          last_checked: new Date(),
          consecutive_failures: healthCheck.consecutive_failures + 1,
          environment
        };
        results.push(failedCheck);
      }
    }

    return results;
  }

  /**
   * Get health check by ID
   */
  getHealthCheck(id: string): APIHealthCheck | undefined {
    return this.healthChecks.get(id);
  }

  /**
   * Get all health checks with optional filtering
   */
  getHealthChecks(filters?: {
    status?: HealthStatus;
    environment?: Environment;
    endpointPath?: string;
  }): APIHealthCheck[] {
    let filteredChecks = Array.from(this.healthChecks.values());

    if (filters) {
      if (filters.status) {
        filteredChecks = filteredChecks.filter(check => check.status === filters.status);
      }
      if (filters.environment) {
        filteredChecks = filteredChecks.filter(check => check.environment === filters.environment);
      }
      if (filters.endpointPath) {
        filteredChecks = filteredChecks.filter(check => 
          check.endpoint_path.includes(filters.endpointPath!)
        );
      }
    }

    return filteredChecks.sort((a, b) => a.last_checked.getTime() - b.last_checked.getTime());
  }

  /**
   * Get health check history for an endpoint
   */
  getHealthCheckHistory(endpointPath: string, method: HTTPMethod = 'GET'): APIHealthCheck[] {
    const id = this.generateHealthCheckId(endpointPath, method);
    return this.checkHistory.get(id) || [];
  }

  /**
   * Get health statistics
   */
  getHealthStatistics(): {
    total: number;
    healthy: number;
    degraded: number;
    failed: number;
    unknown: number;
    averageResponseTime: number;
    endpointsWithFailures: number;
  } {
    const checks = Array.from(this.healthChecks.values());
    const total = checks.length;
    
    const healthy = checks.filter(check => check.status === 'healthy').length;
    const degraded = checks.filter(check => check.status === 'degraded').length;
    const failed = checks.filter(check => check.status === 'failed').length;
    const unknown = checks.filter(check => check.status === 'unknown').length;
    
    const responseTimes = checks
      .filter(check => check.response_time !== undefined)
      .map(check => check.response_time!);
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;
    
    const endpointsWithFailures = checks.filter(check => check.consecutive_failures > 0).length;

    return {
      total,
      healthy,
      degraded,
      failed,
      unknown,
      averageResponseTime,
      endpointsWithFailures
    };
  }

  /**
   * Get endpoints that need attention (failed or degraded)
   */
  getProblematicEndpoints(): APIHealthCheck[] {
    return this.getHealthChecks({
      status: 'failed'
    }).concat(this.getHealthChecks({
      status: 'degraded'
    }));
  }

  /**
   * Reset consecutive failure count for an endpoint
   */
  resetFailureCount(endpointPath: string, method: HTTPMethod = 'GET'): boolean {
    const id = this.generateHealthCheckId(endpointPath, method);
    const healthCheck = this.healthChecks.get(id);
    
    if (!healthCheck) return false;

    const updatedCheck: APIHealthCheck = {
      ...healthCheck,
      consecutive_failures: 0,
      status: 'unknown'
    };

    this.healthChecks.set(id, updatedCheck);
    return true;
  }

  /**
   * Add new endpoint for monitoring
   */
  addEndpoint(
    endpointPath: string,
    method: HTTPMethod,
    expectedStatus: number = 200
  ): APIHealthCheck {
    const id = this.generateHealthCheckId(endpointPath, method);
    
    const healthCheck: APIHealthCheck = {
      id,
      endpoint_path: endpointPath,
      http_method: method,
      expected_status: expectedStatus,
      status: 'unknown',
      last_checked: new Date(),
      consecutive_failures: 0,
      environment: 'development'
    };

    this.healthChecks.set(id, healthCheck);
    this.checkHistory.set(id, []);
    
    return healthCheck;
  }

  /**
   * Make HTTP request to endpoint
   */
  private async makeRequest(endpointPath: string, method: HTTPMethod): Promise<Response> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}${endpointPath}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'API-Health-Service/1.0.0'
      },
      // Add timeout for health checks
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    return response;
  }

  /**
   * Get base URL for API requests
   */
  private getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    
    // Server-side fallback
    return process.env.PUBLIC_SITE_URL || 'http://localhost:4321';
  }

  /**
   * Generate unique health check ID
   */
  private generateHealthCheckId(endpointPath: string, method: HTTPMethod): string {
    const base = `${method}:${endpointPath}`;
    return Buffer.from(base).toString('base64').replace(/[+/=]/g, '').substring(0, 16);
  }

  /**
   * Add health check to history
   */
  private addToHistory(id: string, healthCheck: APIHealthCheck): void {
    const history = this.checkHistory.get(id) || [];
    history.push(healthCheck);
    
    // Keep only last 100 checks to prevent memory issues
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    this.checkHistory.set(id, history);
  }

  /**
   * Export health checks to JSON for debugging
   */
  exportHealthChecks(): string {
    const checksArray = Array.from(this.healthChecks.values());
    return JSON.stringify(checksArray, null, 2);
  }

  /**
   * Clear all health checks (for testing or reset)
   */
  clearAllHealthChecks(): void {
    this.healthChecks.clear();
    this.checkHistory.clear();
    this.initializeDefaultEndpoints();
  }
}

// Export singleton instance
export const apiHealthService = new APIHealthService();

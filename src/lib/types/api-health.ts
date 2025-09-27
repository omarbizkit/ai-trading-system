/**
 * API Health Types
 * 
 * Type definitions for API health monitoring and tracking
 */

export interface APIHealthCheck {
  id: string;
  endpoint_path: string;
  http_method: HTTPMethod;
  expected_status: number;
  actual_status?: number;
  response_time?: number;
  error_message?: string;
  status: HealthStatus;
  last_checked: Date;
  consecutive_failures: number;
  environment: Environment;
}

export enum HTTPMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE"
}

export enum HealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  FAILED = "failed",
  UNKNOWN = "unknown"
}

export enum Environment {
  DEVELOPMENT = "development",
  STAGING = "staging",
  PRODUCTION = "production"
}

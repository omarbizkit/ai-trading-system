/**
 * Database Health Types
 * 
 * Type definitions for database health monitoring and tracking
 */

import { Environment } from './api-health';

export interface DatabaseHealth {
  id: string;
  connection_name: string;
  host: string;
  database_name: string;
  connection_status: ConnectionStatus;
  query_test_status: QueryStatus;
  average_query_time?: number;
  connection_pool_size?: number;
  error_message?: string;
  last_tested: Date;
  environment: Environment;
}

export enum ConnectionStatus {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  TIMEOUT = "timeout",
  ERROR = "error"
}

export enum QueryStatus {
  SUCCESS = "success",
  SLOW = "slow",
  FAILED = "failed",
  NOT_TESTED = "not_tested"
}

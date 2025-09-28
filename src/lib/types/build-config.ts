/**
 * Build Configuration Types
 * 
 * Type definitions for build process monitoring and tracking
 */

import { Environment } from './api-health';

export interface BuildConfiguration {
  id: string;
  environment: Environment;
  node_version: string;
  typescript_version: string;
  astro_version: string;
  build_command: string;
  build_status: BuildStatus;
  build_time?: number;
  bundle_size?: number;
  error_count: number;
  warning_count: number;
  created_at: Date;
  completed_at?: Date;
  error_log?: string;
}

export enum BuildStatus {
  PENDING = "pending",
  BUILDING = "building",
  SUCCESS = "success",
  FAILED = "failed",
  CANCELLED = "cancelled"
}

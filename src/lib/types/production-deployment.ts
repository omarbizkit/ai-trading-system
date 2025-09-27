/**
 * Production Deployment Types
 * 
 * Type definitions for deployment tracking and environment validation
 */

import { Environment } from './api-health';

export interface ProductionDeployment {
  id: string;
  version: string;
  commit_hash: string;
  deployment_status: DeploymentStatus;
  deployment_platform: string;
  domain: string;
  deployment_url?: string;
  health_check_url?: string;
  environment_variables: EnvironmentVariable[];
  deployment_time?: number;
  rollback_available: boolean;
  created_at: Date;
  deployed_at?: Date;
  error_message?: string;
}

export interface EnvironmentVariable {
  key: string;
  is_set: boolean;
  is_sensitive: boolean;
  validation_status: ValidationStatus;
}

export enum DeploymentStatus {
  QUEUED = "queued",
  DEPLOYING = "deploying",
  SUCCESS = "success",
  FAILED = "failed",
  ROLLED_BACK = "rolled_back"
}

export enum ValidationStatus {
  VALID = "valid",
  INVALID = "invalid",
  NOT_VALIDATED = "not_validated"
}

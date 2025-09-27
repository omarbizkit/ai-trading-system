/**
 * Environment Validation Endpoint
 * 
 * POST /api/debug/environment-validation
 * Validate environment configuration and deployment readiness
 */

import type { APIRoute } from 'astro';
import { deploymentService } from '../../../../lib/services/deployment.service';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json();
    const { environment = 'production', check_secrets = false } = body;
    
    // Validate environment
    const validEnvironments = ['development', 'staging', 'production'];
    if (!validEnvironments.includes(environment)) {
      return new Response(JSON.stringify({
        error: `Invalid environment. Must be one of: ${validEnvironments.join(', ')}`,
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Get environment variables for validation
    const envValidation = await validateEnvironmentVariables(environment, check_secrets);
    
    // Get deployment readiness status
    const deploymentReadiness = await checkDeploymentReadiness(environment);
    
    // Get system requirements check
    const systemRequirements = await checkSystemRequirements();
    
    const response = {
      is_valid: envValidation.isValid && deploymentReadiness.isReady && systemRequirements.isCompatible,
      environment,
      validation_timestamp: new Date().toISOString(),
      environment_variables: {
        total: envValidation.variables.length,
        valid: envValidation.variables.filter(v => v.validation_status === 'valid').length,
        invalid: envValidation.variables.filter(v => v.validation_status === 'invalid').length,
        not_validated: envValidation.variables.filter(v => v.validation_status === 'not_validated').length,
        missing: envValidation.missingVariables.length,
        variables: envValidation.variables
      },
      missing_variables: envValidation.missingVariables,
      invalid_variables: envValidation.invalidVariables,
      deployment_readiness: {
        is_ready: deploymentReadiness.isReady,
        issues: deploymentReadiness.issues,
        warnings: deploymentReadiness.warnings
      },
      system_requirements: {
        is_compatible: systemRequirements.isCompatible,
        node_version: systemRequirements.nodeVersion,
        required_node_version: systemRequirements.requiredNodeVersion,
        issues: systemRequirements.issues
      },
      overall_status: getOverallValidationStatus(envValidation, deploymentReadiness, systemRequirements),
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Failed to validate environment:', error);
    
    const errorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      is_valid: false,
      environment: 'unknown',
      validation_timestamp: new Date().toISOString(),
      environment_variables: {
        total: 0,
        valid: 0,
        invalid: 0,
        not_validated: 0,
        missing: 0,
        variables: []
      },
      missing_variables: [],
      invalid_variables: [],
      deployment_readiness: {
        is_ready: false,
        issues: ['Environment validation failed'],
        warnings: []
      },
      system_requirements: {
        is_compatible: false,
        node_version: 'unknown',
        required_node_version: '18.0.0',
        issues: ['System requirements check failed']
      },
      overall_status: 'failed',
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};

/**
 * Validate environment variables
 */
async function validateEnvironmentVariables(environment: string, checkSecrets: boolean) {
  const requiredVars = [
    'PUBLIC_SUPABASE_URL',
    'PUBLIC_SUPABASE_ANON_KEY',
    'COINGECKO_API_KEY',
    'AI_MODEL_VERSION',
    'AI_CONFIDENCE_THRESHOLD',
    'TENSORFLOW_JS_BACKEND',
    'DEFAULT_PORTFOLIO_VALUE',
    'MAX_POSITION_SIZE',
    'PAPER_TRADING_ONLY'
  ];
  
  const variables = requiredVars.map(key => ({
    key,
    is_set: process.env[key] !== undefined && process.env[key] !== '',
    is_sensitive: isSensitiveVariable(key),
    validation_status: validateEnvironmentVariable(key, checkSecrets)
  }));
  
  const missingVariables = variables
    .filter(v => !v.is_set)
    .map(v => v.key);
    
  const invalidVariables = variables
    .filter(v => v.is_set && v.validation_status === 'invalid')
    .map(v => v.key);
  
  return {
    isValid: missingVariables.length === 0 && invalidVariables.length === 0,
    variables,
    missingVariables,
    invalidVariables
  };
}

/**
 * Check if environment variable is sensitive
 */
function isSensitiveVariable(key: string): boolean {
  const sensitiveKeys = ['KEY', 'SECRET', 'TOKEN', 'PASSWORD', 'PASS', 'AUTH'];
  return sensitiveKeys.some(sensitive => key.toUpperCase().includes(sensitive));
}

/**
 * Validate individual environment variable
 */
function validateEnvironmentVariable(key: string, checkSecrets: boolean): 'valid' | 'invalid' | 'not_validated' {
  const value = process.env[key];
  
  if (!value) return 'invalid';
  
  // Skip secret validation if not requested
  if (isSensitiveVariable(key) && !checkSecrets) {
    return 'not_validated';
  }
  
  // Basic validation based on variable type
  switch (key) {
    case 'PUBLIC_SUPABASE_URL':
      return value.startsWith('https://') ? 'valid' : 'invalid';
    case 'PUBLIC_SUPABASE_ANON_KEY':
      return value.length > 20 ? 'valid' : 'invalid';
    case 'AI_CONFIDENCE_THRESHOLD':
      const threshold = parseFloat(value);
      return (threshold >= 0 && threshold <= 1) ? 'valid' : 'invalid';
    case 'DEFAULT_PORTFOLIO_VALUE':
    case 'MAX_POSITION_SIZE':
      const num = parseFloat(value);
      return (num > 0) ? 'valid' : 'invalid';
    case 'PAPER_TRADING_ONLY':
      return (value === 'true' || value === 'false') ? 'valid' : 'invalid';
    default:
      return 'valid';
  }
}

/**
 * Check deployment readiness
 */
async function checkDeploymentReadiness(environment: string) {
  const issues: string[] = [];
  const warnings: string[] = [];
  
  // Check if build is successful
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Check if dist directory exists and has content
    const { existsSync, readdirSync } = await import('fs');
    const { join } = await import('path');
    
    const distPath = join(process.cwd(), 'dist');
    if (!existsSync(distPath)) {
      issues.push('Build directory (dist) does not exist. Run build first.');
    } else {
      const distContents = readdirSync(distPath);
      if (distContents.length === 0) {
        issues.push('Build directory (dist) is empty. Run build first.');
      }
    }
  } catch (error) {
    warnings.push('Could not verify build status');
  }
  
  // Check environment-specific requirements
  if (environment === 'production') {
    if (!process.env.PUBLIC_SUPABASE_URL?.includes('supabase.co')) {
      warnings.push('Production Supabase URL should use supabase.co domain');
    }
  }
  
  return {
    isReady: issues.length === 0,
    issues,
    warnings
  };
}

/**
 * Check system requirements
 */
async function checkSystemRequirements() {
  const issues: string[] = [];
  
  // Check Node.js version
  const nodeVersion = process.version;
  const requiredNodeVersion = '18.0.0';
  
  const nodeVersionCompatible = compareVersions(nodeVersion.slice(1), requiredNodeVersion) >= 0;
  if (!nodeVersionCompatible) {
    issues.push(`Node.js version ${nodeVersion} is not compatible. Required: ${requiredNodeVersion}+`);
  }
  
  return {
    isCompatible: issues.length === 0,
    nodeVersion,
    requiredNodeVersion,
    issues
  };
}

/**
 * Compare semantic versions
 */
function compareVersions(version1: string, version2: string): number {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
}

/**
 * Get overall validation status
 */
function getOverallValidationStatus(
  envValidation: any,
  deploymentReadiness: any,
  systemRequirements: any
): 'passed' | 'failed' | 'warning' {
  if (envValidation.isValid && deploymentReadiness.isReady && systemRequirements.isCompatible) {
    return 'passed';
  }
  
  if (envValidation.missingVariables.length > 0 || deploymentReadiness.issues.length > 0 || systemRequirements.issues.length > 0) {
    return 'failed';
  }
  
  return 'warning';
}

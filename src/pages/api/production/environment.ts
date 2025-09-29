/**
 * API endpoint for production environment validation and setup
 * Part of Phase 10: Production Environment Setup
 */

import type { APIRoute } from 'astro';
import { environmentManager } from '../../../lib/services/environment-manager.service';
import { productionSupabase } from '../../../lib/services/supabase-production.service';
import { zeaburDeployment } from '../../../lib/services/zeabur-deployment.service';
import { sslSecurity } from '../../../lib/services/ssl-security.service';
import { databaseMigration } from '../../../lib/services/database-migration.service';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'validate';

    switch (action) {
      case 'validate':
        return await validateEnvironment();
      case 'status':
        return await getProductionStatus();
      case 'readiness':
        return await getReadinessScore();
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action parameter' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Production environment API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'migrate':
        return await runDatabaseMigrations();
      case 'setup':
        return await setupProductionEnvironment();
      case 'validate-ssl':
        return await validateSSL(body.domain);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Production environment API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

async function validateEnvironment() {
  const environmentValidation = environmentManager.validateEnvironment();
  const schemaValidation = await databaseMigration.validateSchema();
  const deploymentValidation = await zeaburDeployment.validateDeploymentConfig();

  const overallValid = environmentValidation.isValid &&
                      schemaValidation.isValid &&
                      deploymentValidation.isValid;

  return new Response(
    JSON.stringify({
      status: 'success',
      data: {
        overall: {
          isValid: overallValid,
          environment: environmentValidation.environment,
        },
        environment: environmentValidation,
        database: schemaValidation,
        deployment: deploymentValidation,
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...sslSecurity.getSecurityHeaders(),
      },
    }
  );
}

async function getProductionStatus() {
  const supabaseHealth = await productionSupabase.validateConnection();
  const deploymentStatus = await zeaburDeployment.getDeploymentStatus();
  const environmentConfig = environmentManager.getSanitizedConfig();

  return new Response(
    JSON.stringify({
      status: 'success',
      data: {
        environment: {
          name: environmentConfig.environment,
          domain: environmentConfig.app?.url,
          isProduction: environmentManager.isProduction(),
        },
        database: {
          status: supabaseHealth.status,
          responseTime: supabaseHealth.responseTime,
          connectionCount: supabaseHealth.connectionCount,
          lastChecked: supabaseHealth.lastChecked,
        },
        deployment: {
          status: deploymentStatus.status,
          version: deploymentStatus.version,
          url: deploymentStatus.url,
          health: deploymentStatus.health,
          deployedAt: deploymentStatus.deployedAt,
        },
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...sslSecurity.getSecurityHeaders(),
      },
    }
  );
}

async function getReadinessScore() {
  const readinessScore = environmentManager.getReadinessScore();
  const environmentValidation = environmentManager.validateEnvironment();
  const schemaValidation = await databaseMigration.validateSchema();

  const recommendations = [
    ...environmentValidation.recommendations,
    ...schemaValidation.recommendations,
    ...sslSecurity.getSecurityRecommendations(),
  ];

  return new Response(
    JSON.stringify({
      status: 'success',
      data: {
        score: readinessScore.score,
        maxScore: readinessScore.maxScore,
        percentage: Math.round((readinessScore.score / readinessScore.maxScore) * 100),
        details: readinessScore.details,
        recommendations: recommendations.slice(0, 10), // Top 10 recommendations
        criticalIssues: environmentValidation.errors.length,
        warnings: environmentValidation.warnings.length,
        timestamp: new Date().toISOString(),
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...sslSecurity.getSecurityHeaders(),
      },
    }
  );
}

async function runDatabaseMigrations() {
  try {
    const pendingMigrations = await databaseMigration.getPendingMigrations();

    if (pendingMigrations.length === 0) {
      return new Response(
        JSON.stringify({
          status: 'success',
          message: 'No pending migrations',
          data: { migrationsRun: 0, results: [] },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...sslSecurity.getSecurityHeaders(),
          },
        }
      );
    }

    const results = await databaseMigration.runMigrations();
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        status: failed === 0 ? 'success' : 'partial',
        message: `Migrations completed: ${successful} successful, ${failed} failed`,
        data: {
          migrationsRun: results.length,
          successful,
          failed,
          results,
        },
      }),
      {
        status: failed === 0 ? 200 : 207,
        headers: {
          'Content-Type': 'application/json',
          ...sslSecurity.getSecurityHeaders(),
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Migration execution failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...sslSecurity.getSecurityHeaders(),
        },
      }
    );
  }
}

async function setupProductionEnvironment() {
  try {
    // Run setup steps
    const steps = [];

    // 1. Validate environment
    const envValidation = environmentManager.validateEnvironment();
    steps.push({
      step: 'Environment Validation',
      success: envValidation.isValid,
      details: envValidation.errors.length === 0 ? 'All variables configured' : `${envValidation.errors.length} errors found`,
    });

    // 2. Validate database connection
    const dbHealth = await productionSupabase.validateConnection();
    steps.push({
      step: 'Database Connection',
      success: dbHealth.status === 'healthy',
      details: `Status: ${dbHealth.status}, Response time: ${dbHealth.responseTime}ms`,
    });

    // 3. Run migrations
    const migrationResults = await databaseMigration.runMigrations();
    const migrationSuccess = migrationResults.every(r => r.success);
    steps.push({
      step: 'Database Migrations',
      success: migrationSuccess,
      details: `${migrationResults.length} migrations processed`,
    });

    // 4. Validate deployment configuration
    const deploymentValidation = await zeaburDeployment.validateDeploymentConfig();
    steps.push({
      step: 'Deployment Configuration',
      success: deploymentValidation.isValid,
      details: deploymentValidation.errors.length === 0 ? 'Configuration valid' : `${deploymentValidation.errors.length} errors found`,
    });

    const overallSuccess = steps.every(step => step.success);

    return new Response(
      JSON.stringify({
        status: overallSuccess ? 'success' : 'partial',
        message: overallSuccess ? 'Production environment setup completed' : 'Setup completed with some issues',
        data: {
          steps,
          overallSuccess,
          completedAt: new Date().toISOString(),
        },
      }),
      {
        status: overallSuccess ? 200 : 207,
        headers: {
          'Content-Type': 'application/json',
          ...sslSecurity.getSecurityHeaders(),
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Production environment setup failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...sslSecurity.getSecurityHeaders(),
        },
      }
    );
  }
}

async function validateSSL(domain: string) {
  if (!domain) {
    return new Response(
      JSON.stringify({ error: 'Domain parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const sslValidation = await sslSecurity.performSecurityValidation(domain);

  return new Response(
    JSON.stringify({
      status: 'success',
      data: sslValidation,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...sslSecurity.getSecurityHeaders(),
      },
    }
  );
}
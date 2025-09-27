/**
 * System Health Check Endpoint
 * 
 * GET /api/health
 * Comprehensive health check including database, APIs, and system status
 */

import type { APIRoute } from 'astro';
import { apiHealthService } from '../../../lib/services/api-health.service';
import { databaseHealthService } from '../../../lib/services/database-health.service';
import { buildConfigService } from '../../../lib/services/build-config.service';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  components: {
    database: 'healthy' | 'degraded' | 'failed' | 'unknown';
    api_endpoints: 'healthy' | 'degraded' | 'failed' | 'unknown';
    external_services: 'healthy' | 'degraded' | 'failed' | 'unknown';
    build_system: 'healthy' | 'degraded' | 'failed' | 'unknown';
  };
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const startTime = Date.now();
    
    // Get package.json version
    const packageJson = await import('../../../../package.json');
    const version = packageJson.default?.version || '1.0.0';
    
    // Calculate uptime (simplified - in production this would be actual process uptime)
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    
    // Check database health
    const databaseHealth = await databaseHealthService.testAllConnections('production');
    const databaseStatus = getDatabaseHealthStatus(databaseHealth);
    
    // Check API endpoints health
    const apiHealth = await apiHealthService.checkAllEndpoints('production');
    const apiStatus = getAPIHealthStatus(apiHealth);
    
    // Check external services (CoinGecko API)
    const externalServicesStatus = await checkExternalServices();
    
    // Check build system
    const buildConfigs = buildConfigService.getBuildConfigs({ environment: 'production' });
    const buildStatus = getBuildSystemStatus(buildConfigs);
    
    // Determine overall system status
    const overallStatus = determineOverallStatus([
      databaseStatus,
      apiStatus,
      externalServicesStatus,
      buildStatus
    ]);
    
    const systemHealth: SystemHealth = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version,
      uptime,
      components: {
        database: databaseStatus,
        api_endpoints: apiStatus,
        external_services: externalServicesStatus,
        build_system: buildStatus
      }
    };
    
    // Return appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 : 503;
    
    return new Response(JSON.stringify(systemHealth), {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    const errorHealth: SystemHealth = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: 0,
      components: {
        database: 'unknown',
        api_endpoints: 'unknown',
        external_services: 'unknown',
        build_system: 'unknown'
      }
    };
    
    return new Response(JSON.stringify(errorHealth), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};

/**
 * Determine database health status from health checks
 */
function getDatabaseHealthStatus(databaseHealth: any[]): 'healthy' | 'degraded' | 'failed' | 'unknown' {
  if (databaseHealth.length === 0) return 'unknown';
  
  const connectedCount = databaseHealth.filter(check => check.connection_status === 'connected').length;
  const totalCount = databaseHealth.length;
  
  if (connectedCount === totalCount) return 'healthy';
  if (connectedCount > 0) return 'degraded';
  return 'failed';
}

/**
 * Determine API health status from health checks
 */
function getAPIHealthStatus(apiHealth: any[]): 'healthy' | 'degraded' | 'failed' | 'unknown' {
  if (apiHealth.length === 0) return 'unknown';
  
  const healthyCount = apiHealth.filter(check => check.status === 'healthy').length;
  const degradedCount = apiHealth.filter(check => check.status === 'degraded').length;
  const totalCount = apiHealth.length;
  
  if (healthyCount === totalCount) return 'healthy';
  if (healthyCount + degradedCount === totalCount) return 'degraded';
  return 'failed';
}

/**
 * Check external services health
 */
async function checkExternalServices(): Promise<'healthy' | 'degraded' | 'failed' | 'unknown'> {
  try {
    // Check CoinGecko API
    const coinGeckoUrl = 'https://api.coingecko.com/api/v3/ping';
    const response = await fetch(coinGeckoUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'AI-Trading-System-Health-Check/1.0.0'
      },
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    if (response.ok) {
      return 'healthy';
    } else if (response.status >= 500) {
      return 'failed';
    } else {
      return 'degraded';
    }
  } catch (error) {
    console.warn('External services check failed:', error);
    return 'failed';
  }
}

/**
 * Determine build system status
 */
function getBuildSystemStatus(buildConfigs: any[]): 'healthy' | 'degraded' | 'failed' | 'unknown' {
  if (buildConfigs.length === 0) return 'unknown';
  
  const latestBuild = buildConfigs[0]; // Assuming sorted by created_at desc
  
  switch (latestBuild.build_status) {
    case 'success':
      return 'healthy';
    case 'building':
    case 'pending':
      return 'degraded';
    case 'failed':
    case 'cancelled':
      return 'failed';
    default:
      return 'unknown';
  }
}

/**
 * Determine overall system status
 */
function determineOverallStatus(statuses: string[]): 'healthy' | 'degraded' | 'unhealthy' {
  if (statuses.includes('failed') || statuses.includes('unknown')) {
    return 'unhealthy';
  }
  
  if (statuses.includes('degraded')) {
    return 'degraded';
  }
  
  return 'healthy';
}

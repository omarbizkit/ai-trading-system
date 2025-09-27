/**
 * API Endpoints Health Check
 * 
 * GET /api/health/endpoints
 * Test all API endpoints connectivity and response times
 */

import type { APIRoute } from 'astro';
import { apiHealthService } from '../../../../lib/services/api-health.service';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Check all API endpoints
    const apiHealth = await apiHealthService.checkAllEndpoints('production');
    
    // Get API health statistics
    const statistics = apiHealthService.getHealthStatistics();
    
    // Get problematic endpoints
    const problematicEndpoints = apiHealthService.getProblematicEndpoints();
    
    const response = {
      status: 'completed',
      timestamp: new Date().toISOString(),
      total_endpoints: statistics.total,
      healthy_endpoints: statistics.healthy,
      degraded_endpoints: statistics.degraded,
      failed_endpoints: statistics.failed,
      unknown_endpoints: statistics.unknown,
      average_response_time: statistics.averageResponseTime,
      endpoints_with_failures: statistics.endpointsWithFailures,
      endpoints: apiHealth,
      problematic_endpoints: problematicEndpoints,
      statistics: {
        total: statistics.total,
        healthy: statistics.healthy,
        degraded: statistics.degraded,
        failed: statistics.failed,
        unknown: statistics.unknown,
        average_response_time: statistics.averageResponseTime,
        endpoints_with_failures: statistics.endpointsWithFailures
      }
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
    console.error('API endpoints health check failed:', error);
    
    const errorResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown API health check error',
      total_endpoints: 0,
      healthy_endpoints: 0,
      degraded_endpoints: 0,
      failed_endpoints: 0,
      unknown_endpoints: 0,
      average_response_time: 0,
      endpoints_with_failures: 0,
      endpoints: [],
      problematic_endpoints: [],
      statistics: {
        total: 0,
        healthy: 0,
        degraded: 0,
        failed: 0,
        unknown: 0,
        average_response_time: 0,
        endpoints_with_failures: 0
      }
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

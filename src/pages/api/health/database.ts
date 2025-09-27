/**
 * Database Health Check Endpoint
 * 
 * GET /api/health/database
 * Test database connection and query performance
 */

import type { APIRoute } from 'astro';
import { databaseHealthService } from '../../../../lib/services/database-health.service';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Test all database connections
    const databaseHealth = await databaseHealthService.testAllConnections('production');
    
    // Get database statistics
    const statistics = databaseHealthService.getDatabaseStatistics();
    
    // Determine overall database health
    const overallStatus = determineDatabaseHealthStatus(databaseHealth);
    
    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      connections: databaseHealth,
      statistics: {
        total_connections: statistics.total,
        connected: statistics.connected,
        disconnected: statistics.disconnected,
        error: statistics.error,
        unknown: statistics.unknown,
        average_query_time: statistics.averageQueryTime,
        slow_queries: statistics.slowQueries,
        failed_queries: statistics.failedQueries
      }
    };
    
    // Return appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 : 503;
    
    return new Response(JSON.stringify(response), {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Database health check failed:', error);
    
    const errorResponse = {
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown database error',
      connections: [],
      statistics: {
        total_connections: 0,
        connected: 0,
        disconnected: 0,
        error: 1,
        unknown: 0,
        average_query_time: 0,
        slow_queries: 0,
        failed_queries: 1
      }
    };
    
    return new Response(JSON.stringify(errorResponse), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};

/**
 * Determine overall database health status
 */
function determineDatabaseHealthStatus(databaseHealth: any[]): 'healthy' | 'degraded' | 'failed' | 'unknown' {
  if (databaseHealth.length === 0) return 'unknown';
  
  const connectedCount = databaseHealth.filter(check => 
    check.connection_status === 'connected' && 
    check.query_test_status === 'success'
  ).length;
  
  const degradedCount = databaseHealth.filter(check => 
    check.connection_status === 'connected' && 
    check.query_test_status === 'slow'
  ).length;
  
  const totalCount = databaseHealth.length;
  
  if (connectedCount === totalCount) return 'healthy';
  if (connectedCount + degradedCount === totalCount) return 'degraded';
  return 'failed';
}

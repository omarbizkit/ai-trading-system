/**
 * Deployment Status Endpoint
 * 
 * GET /api/debug/deployment-status
 * Get deployment status and configuration
 */

import type { APIRoute } from 'astro';
import { zeaburDeployment } from '../../../lib/services/zeabur-deployment.service';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Get version from query parameter or default to latest
    const version = url.searchParams.get('version');
    
    // Get deployment status from the new service
    const deployment = await zeaburDeployment.getDeploymentStatus();
    
    if (!deployment) {
      return new Response(JSON.stringify({
        error: 'No deployment found',
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Get deployment statistics
    const statistics = deploymentService.getDeploymentStatistics();
    
    // Get deployment history for this version
    const deploymentHistory = deploymentService.getDeploymentHistory(deployment.version);
    
    // Get failed deployments
    const failedDeployments = deploymentService.getFailedDeployments();
    
    const response = {
      ...deployment,
      statistics: {
        total_deployments: statistics.total,
        successful_deployments: statistics.successful,
        failed_deployments: statistics.failed,
        queued_deployments: statistics.queued,
        deploying_deployments: statistics.deploying,
        rolled_back_deployments: statistics.rolledBack,
        average_deployment_time: statistics.averageDeploymentTime,
        rollback_available: statistics.rollbackAvailable
      },
      deployment_history: deploymentHistory.slice(0, 10), // Last 10 deployments
      failed_deployments: failedDeployments.slice(0, 5), // Last 5 failed deployments
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
    console.error('Failed to get deployment status:', error);
    
    const errorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
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

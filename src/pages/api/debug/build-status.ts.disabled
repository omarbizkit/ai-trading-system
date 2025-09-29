/**
 * Build Status Debug Endpoint
 * 
 * GET /api/debug/build-status - Get build configuration and status
 * POST /api/debug/build-status - Trigger new build
 */

import type { APIRoute } from 'astro';
import { buildConfigService } from '../../../../lib/services/build-config.service';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Get environment from query parameter or default to production
    const environment = (url.searchParams.get('environment') as any) || 'production';
    
    // Get build configuration for the environment
    const buildConfig = buildConfigService.getBuildConfig(environment);
    
    if (!buildConfig) {
      return new Response(JSON.stringify({
        error: `Build configuration not found for environment: ${environment}`,
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Get build statistics
    const statistics = buildConfigService.getBuildStatistics();
    
    // Get build history for the environment
    const buildHistory = buildConfigService.getBuildHistory(environment);
    
    // Get failed builds
    const failedBuilds = buildConfigService.getFailedBuilds();
    
    const response = {
      ...buildConfig,
      statistics: {
        total_builds: statistics.total,
        successful_builds: statistics.successful,
        failed_builds: statistics.failed,
        pending_builds: statistics.pending,
        building_builds: statistics.building,
        average_build_time: statistics.averageBuildTime,
        average_bundle_size: statistics.averageBundleSize,
        total_errors: statistics.totalErrors,
        total_warnings: statistics.totalWarnings
      },
      build_history: buildHistory.slice(0, 10), // Last 10 builds
      failed_builds: failedBuilds.slice(0, 5), // Last 5 failed builds
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
    console.error('Failed to get build status:', error);
    
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

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse request body
    const body = await request.json();
    const { environment = 'production', build_options = {} } = body;
    
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
    
    // Check if a build is already in progress
    const currentBuild = buildConfigService.getBuildConfig(environment);
    if (currentBuild && currentBuild.build_status === 'building') {
      return new Response(JSON.stringify({
        error: 'Build already in progress',
        build_id: currentBuild.id,
        status: currentBuild.build_status,
        timestamp: new Date().toISOString()
      }), {
        status: 409,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Start new build
    const buildConfig = await buildConfigService.startBuild(environment);
    
    // Estimate build duration based on environment and previous builds
    const statistics = buildConfigService.getBuildStatistics();
    const estimatedDuration = statistics.averageBuildTime || 60; // Default 60 seconds
    
    const response = {
      build_id: buildConfig.id,
      status: buildConfig.build_status,
      environment: buildConfig.environment,
      estimated_duration: Math.round(estimatedDuration),
      build_command: buildConfig.build_command,
      created_at: buildConfig.created_at,
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify(response), {
      status: 202, // Accepted
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Failed to trigger build:', error);
    
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

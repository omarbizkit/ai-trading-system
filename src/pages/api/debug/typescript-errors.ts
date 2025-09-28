/**
 * TypeScript Errors Debug Endpoint
 * 
 * GET /api/debug/typescript-errors - Get TypeScript compilation errors
 * POST /api/debug/typescript-errors - Refresh TypeScript error analysis
 */

import type { APIRoute } from 'astro';
import { typescriptErrorService } from '../../../../lib/services/typescript-error.service';

export const GET: APIRoute = async ({ request, url }) => {
  try {
    // Parse query parameters
    const category = url.searchParams.get('category') as any;
    const severity = url.searchParams.get('severity') as any;
    const status = url.searchParams.get('status') as any;
    
    // Get filtered errors
    const errors = typescriptErrorService.getErrors({
      category,
      severity,
      status
    });
    
    // Get error statistics
    const statistics = typescriptErrorService.getErrorStatistics();
    
    // Get critical errors that need immediate attention
    const criticalErrors = typescriptErrorService.getCriticalErrors();
    
    const response = {
      total_errors: statistics.total,
      errors_by_category: statistics.byCategory,
      errors_by_severity: statistics.bySeverity,
      errors_by_status: statistics.byStatus,
      resolved_count: statistics.resolvedCount,
      unresolved_count: statistics.unresolvedCount,
      critical_errors_count: criticalErrors.length,
      errors: errors,
      critical_errors: criticalErrors,
      filters: {
        category: category || null,
        severity: severity || null,
        status: status || null
      },
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
    console.error('Failed to get TypeScript errors:', error);
    
    const errorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      total_errors: 0,
      errors_by_category: {},
      errors_by_severity: {},
      errors_by_status: {},
      resolved_count: 0,
      unresolved_count: 0,
      critical_errors_count: 0,
      errors: [],
      critical_errors: [],
      filters: {
        category: null,
        severity: null,
        status: null
      },
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
    // Run TypeScript compiler to get current errors
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Run TypeScript compiler with error output
    const { stdout, stderr } = await execAsync('npx tsc --noEmit --pretty false', {
      cwd: process.cwd(),
      timeout: 30000 // 30 second timeout
    });
    
    // Parse TypeScript output for errors
    const compilerOutput = stderr || stdout;
    const newErrors = typescriptErrorService.parseTypeScriptOutput(compilerOutput);
    
    // Get updated statistics
    const statistics = typescriptErrorService.getErrorStatistics();
    
    // Get critical errors
    const criticalErrors = typescriptErrorService.getCriticalErrors();
    
    const response = {
      analysis_completed_at: new Date().toISOString(),
      total_errors_found: statistics.total,
      new_errors: newErrors.length,
      resolved_errors: statistics.resolvedCount,
      critical_errors: criticalErrors.length,
      errors_by_severity: statistics.bySeverity,
      errors_by_category: statistics.byCategory,
      errors_by_status: statistics.byStatus,
      compiler_output: compilerOutput,
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
    console.error('Failed to refresh TypeScript errors:', error);
    
    const errorResponse = {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      analysis_completed_at: new Date().toISOString(),
      total_errors_found: 0,
      new_errors: 0,
      resolved_errors: 0,
      critical_errors: 0,
      errors_by_severity: {},
      errors_by_category: {},
      errors_by_status: {},
      compiler_output: '',
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

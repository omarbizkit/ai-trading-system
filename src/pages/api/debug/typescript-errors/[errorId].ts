/**
 * Individual TypeScript Error Update Endpoint
 * 
 * PATCH /api/debug/typescript-errors/{errorId}
 * Update TypeScript error status and resolution notes
 */

import type { APIRoute } from 'astro';
import { typescriptErrorService } from '../../../../../lib/services/typescript-error.service';

export const PATCH: APIRoute = async ({ request, params }) => {
  try {
    const errorId = params.errorId;
    
    if (!errorId) {
      return new Response(JSON.stringify({
        error: 'Error ID is required',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Parse request body
    const body = await request.json();
    const { status, resolution_notes } = body;
    
    if (!status) {
      return new Response(JSON.stringify({
        error: 'Status is required',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Validate status
    const validStatuses = ['identified', 'in_progress', 'resolved', 'deferred'];
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Update error status
    const success = typescriptErrorService.updateErrorStatus(errorId, status, resolution_notes);
    
    if (!success) {
      return new Response(JSON.stringify({
        error: 'Error not found',
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Get updated error
    const updatedError = typescriptErrorService.getErrorById(errorId);
    
    if (!updatedError) {
      return new Response(JSON.stringify({
        error: 'Error not found after update',
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    
    return new Response(JSON.stringify(updatedError), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Failed to update TypeScript error:', error);
    
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

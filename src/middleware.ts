/**
 * T065: Auth middleware for protected routes
 * Middleware to handle authentication and route protection
 */

import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './lib/supabase';

// Define which routes require authentication
const PROTECTED_ROUTES = [
  '/api/user/',
  '/api/runs',
  '/api/trades',
  '/profile',
  // Add more protected routes as needed
];

// Define which routes are public (no auth required)
const PUBLIC_ROUTES = [
  '/',
  '/auth/',
  '/api/market/',
  '/api/predictions/',
  '/simulation',
  '/backtesting',
  '/history'
  // Public API endpoints and pages
];

// Define which routes allow guest access but enhance with auth
const GUEST_ALLOWED_ROUTES = [
  '/simulation',
  '/backtesting',
  '/history',
  '/api/predictions/',
  '/api/market/'
];

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url, locals } = context;
  const pathname = url.pathname;

  // Skip auth for static assets and internal routes
  if (pathname.includes('.') || pathname.startsWith('/_') || pathname.startsWith('/api/health')) {
    return next();
  }

  // Initialize auth state in locals
  locals.user = null;
  locals.session = null;
  locals.isAuthenticated = false;
  locals.isGuest = false;

  try {
    // Create Supabase client for middleware context
    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase credentials not configured, proceeding without auth');
      return next();
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // Don't persist session in middleware
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    // Get session from request headers or cookies
    const authHeader = request.headers.get('Authorization');
    let session = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Extract token from Authorization header
      const token = authHeader.substring(7);

      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (!error && user) {
          session = { user, access_token: token };
        }
      } catch (error) {
        console.error('Error validating token:', error);
      }
    } else {
      // Try to get session from cookies
      try {
        const cookieHeader = request.headers.get('cookie');
        if (cookieHeader) {
          // Extract access token from cookies
          const accessTokenMatch = cookieHeader.match(/sb-[^.]*-auth-token=([^;]*)/);
          if (accessTokenMatch) {
            const token = decodeURIComponent(accessTokenMatch[1]);
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (!error && user) {
              session = { user, access_token: token };
            }
          }
        }
      } catch (error) {
        console.error('Error getting session from cookies:', error);
      }
    }

    // Set auth state in locals
    if (session?.user) {
      locals.user = {
        id: session.user.id,
        email: session.user.email ?? undefined,
        user_metadata: session.user.user_metadata ?? undefined,
        app_metadata: session.user.app_metadata ?? undefined
      };
      locals.session = session;
      locals.isAuthenticated = true;
    }

    // Check if route requires authentication
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route));
    const isGuestAllowedRoute = GUEST_ALLOWED_ROUTES.some(route => pathname.startsWith(route));

    // Handle protected routes
    if (isProtectedRoute && !locals.isAuthenticated) {
      // API routes return 401, pages redirect to sign-in
      if (pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({
          error: 'Unauthorized',
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer'
          }
        });
      } else {
        // Redirect to sign-in page
        const signInUrl = new URL('/auth/signin', url);
        signInUrl.searchParams.set('redirect', pathname);

        return Response.redirect(signInUrl.toString(), 302);
      }
    }

    // Handle API requests with optional auth enhancement
    if (pathname.startsWith('/api/')) {
      // Apply rate limiting to API requests
      const clientId = locals.user?.id || request.headers.get('x-forwarded-for') || 'anonymous';
      const rateLimit = checkRateLimit(clientId, 100, 60000); // 100 requests per minute
      
      if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
          resetTime: rateLimit.resetTime
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': rateLimit.resetTime ? Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString() : '60',
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
            'X-RateLimit-Reset': rateLimit.resetTime?.toString() || ''
          }
        });
      }

      // Add rate limit headers to successful responses
      const response = await next();
      if (response instanceof Response) {
        response.headers.set('X-RateLimit-Limit', '100');
        response.headers.set('X-RateLimit-Remaining', rateLimit.remaining?.toString() || '0');
        response.headers.set('X-RateLimit-Reset', rateLimit.resetTime?.toString() || '');
      }

      // Add user context to API requests for enhanced functionality
      if (locals.isAuthenticated) {
        // User is authenticated - full API access
        return response;
      } else if (isGuestAllowedRoute) {
        // Guest access allowed - limited functionality
        locals.isGuest = true;
        return response;
      } else if (isPublicRoute) {
        // Public API - no auth required
        return response;
      } else {
        // Protected API endpoint
        return new Response(JSON.stringify({
          error: 'Unauthorized',
          message: 'This endpoint requires authentication',
          code: 'AUTH_REQUIRED'
        }), {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer'
          }
        });
      }
    }

    // Handle page requests
    if (isProtectedRoute && !locals.isAuthenticated) {
      // Protected page - redirect to sign-in
      const signInUrl = new URL('/auth/signin', url);
      signInUrl.searchParams.set('redirect', pathname);

      return Response.redirect(signInUrl.toString(), 302);
    }

    // Allow access to public and guest-allowed routes
    return next();

  } catch (error) {
    console.error('Middleware error:', error);

    // On error, treat as unauthenticated
    locals.user = null;
    locals.session = null;
    locals.isAuthenticated = false;

    // Continue with request - let individual routes handle auth requirements
    return next();
  }
});

// Helper function to check auth in API routes
export const requireAuth = (locals: any) => {
  if (!locals.isAuthenticated) {
    throw new Error('Authentication required');
  }
  return locals.user;
};

// Helper function to get user ID from locals
export const getUserId = (locals: any): string | null => {
  return locals.user?.id || null;
};

// Helper function to check if user is guest
export const isGuest = (locals: any): boolean => {
  return !!locals.isGuest && !locals.isAuthenticated;
};

// Helper function to get auth headers for external API calls
export const getAuthHeaders = (locals: any): Record<string, string> => {
  if (!locals.session?.access_token) {
    return {};
  }

  return {
    'Authorization': `Bearer ${locals.session.access_token}`,
    'Content-Type': 'application/json'
  };
};

// Rate limiting helpers (improved implementation)
class RateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.startCleanup();
  }

  checkRateLimit(
    identifier: string,
    maxRequests: number = 100,
    windowMs: number = 60000 // 1 minute
  ): { allowed: boolean; resetTime?: number; remaining?: number } {
    const now = Date.now();
    const key = identifier;

    const current = this.store.get(key);

    if (!current || now > current.resetTime) {
      // Reset or initialize
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: maxRequests - 1 };
    }

    if (current.count >= maxRequests) {
      return { 
        allowed: false, 
        resetTime: current.resetTime,
        remaining: 0
      };
    }

    current.count++;
    this.store.set(key, current);

    return { 
      allowed: true, 
      remaining: maxRequests - current.count 
    };
  }

  private startCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.store.entries()) {
        if (now > data.resetTime) {
          this.store.delete(key);
        }
      }
    }, 300000); // Clean up every 5 minutes
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

export const checkRateLimit = (
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
) => rateLimiter.checkRateLimit(identifier, maxRequests, windowMs);
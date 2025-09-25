/**
 * T065: Auth middleware for protected routes
 * Middleware to handle authentication and route protection
 */

import { defineMiddleware } from 'astro:middleware';
import { supabase } from './lib/supabase';

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

  // Skip auth for static assets
  if (pathname.includes('.') || pathname.startsWith('/_')) {
    return next();
  }

  // Initialize auth state in locals
  locals.user = null;
  locals.session = null;
  locals.isAuthenticated = false;

  try {
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
      // Try to get session from Supabase cookies
      try {
        const { data: { session: cookieSession }, error } = await supabase.auth.getSession();

        if (!error && cookieSession) {
          session = cookieSession;
        }
      } catch (error) {
        console.error('Error getting session from cookies:', error);
      }
    }

    // Set auth state in locals
    if (session?.user) {
      locals.user = {
        id: session.user.id,
        email: session.user.email || undefined,
        user_metadata: session.user.user_metadata,
        app_metadata: session.user.app_metadata
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
      // Add user context to API requests for enhanced functionality
      if (locals.isAuthenticated) {
        // User is authenticated - full API access
        return next();
      } else if (isGuestAllowedRoute) {
        // Guest access allowed - limited functionality
        locals.isGuest = true;
        return next();
      } else if (isPublicRoute) {
        // Public API - no auth required
        return next();
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

// Rate limiting helpers (basic implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const checkRateLimit = (
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000 // 1 minute
): { allowed: boolean; resetTime?: number } => {
  const now = Date.now();
  const key = identifier;

  const current = rateLimitStore.get(key);

  if (!current || now > current.resetTime) {
    // Reset or initialize
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (current.count >= maxRequests) {
    return { allowed: false, resetTime: current.resetTime };
  }

  current.count++;
  rateLimitStore.set(key, current);

  return { allowed: true };
};

// Cleanup old rate limit entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
      if (now > data.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 300000); // Clean up every 5 minutes
}
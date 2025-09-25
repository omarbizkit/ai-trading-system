/**
 * T064: Supabase Auth integration with SSO configuration
 * Authentication service for seamless SSO with bizkit.dev portfolio
 */

import { supabase } from './supabase';
import type { User, Session, AuthResponse, AuthError } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    preferred_username?: string;
  };
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: AuthUser;
}

export interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  error: string | null;
}

class AuthService {
  private authState: AuthState = {
    user: null,
    session: null,
    loading: true,
    error: null
  };

  private listeners: Array<(state: AuthState) => void> = [];

  constructor() {
    this.initializeAuth();
  }

  /**
   * Initialize authentication and set up session listener
   */
  private async initializeAuth(): Promise<void> {
    try {
      // Get initial session
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        this.updateAuthState({
          user: null,
          session: null,
          loading: false,
          error: error.message
        });
        return;
      }

      this.updateAuthState({
        user: session?.user ? this.mapSupabaseUser(session.user) : null,
        session: session ? this.mapSupabaseSession(session) : null,
        loading: false,
        error: null
      });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);

        this.updateAuthState({
          user: session?.user ? this.mapSupabaseUser(session.user) : null,
          session: session ? this.mapSupabaseSession(session) : null,
          loading: false,
          error: null
        });

        // Handle specific auth events
        this.handleAuthEvent(event, session);
      });

    } catch (error) {
      console.error('Failed to initialize auth:', error);
      this.updateAuthState({
        user: null,
        session: null,
        loading: false,
        error: 'Failed to initialize authentication'
      });
    }
  }

  /**
   * Handle specific authentication events
   */
  private handleAuthEvent(event: string, session: Session | null): void {
    switch (event) {
      case 'SIGNED_IN':
        if (session?.user) {
          this.onSignIn(session.user);
        }
        break;
      case 'SIGNED_OUT':
        this.onSignOut();
        break;
      case 'TOKEN_REFRESHED':
        console.log('Token refreshed successfully');
        break;
      case 'USER_UPDATED':
        console.log('User profile updated');
        break;
    }
  }

  /**
   * Handle successful sign-in
   */
  private async onSignIn(user: User): Promise<void> {
    try {
      // Create or update user profile in trading_users table
      const { error } = await supabase
        .from('trading_users')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          last_sign_in: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Failed to create/update user profile:', error);
      }

      console.log('User signed in successfully:', user.email);
    } catch (error) {
      console.error('Error during sign-in process:', error);
    }
  }

  /**
   * Handle sign-out
   */
  private onSignOut(): void {
    // Clear any local storage or cached data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trading-session');
      localStorage.removeItem('portfolio-data');
    }

    console.log('User signed out');
  }

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, metadata?: { full_name?: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata || {}
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Sign in with OAuth provider (for SSO integration)
   */
  async signInWithOAuth(provider: 'google' | 'github' | 'discord'): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${import.meta.env.PUBLIC_APP_URL}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${import.meta.env.PUBLIC_APP_URL}/auth/reset-password`
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: { email?: string; full_name?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.auth.updateUser({
        email: updates.email,
        data: {
          full_name: updates.full_name,
          avatar_url: updates.avatar_url
        }
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' };
    }
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.authState.user;
  }

  /**
   * Get current session
   */
  getCurrentSession(): AuthSession | null {
    return this.authState.session;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.authState.user && !!this.authState.session;
  }

  /**
   * Check if auth is loading
   */
  isLoading(): boolean {
    return this.authState.loading;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (state: AuthState) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get access token for API requests
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        return null;
      }

      return session.access_token;
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  /**
   * Create authenticated request headers
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();

    if (!token) {
      return {};
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Private: Update auth state and notify listeners
   */
  private updateAuthState(newState: Partial<AuthState>): void {
    this.authState = { ...this.authState, ...newState };

    // Notify all listeners
    this.listeners.forEach(callback => {
      try {
        callback({ ...this.authState });
      } catch (error) {
        console.error('Error in auth state listener:', error);
      }
    });
  }

  /**
   * Private: Map Supabase User to AuthUser
   */
  private mapSupabaseUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata
    };
  }

  /**
   * Private: Map Supabase Session to AuthSession
   */
  private mapSupabaseSession(session: Session): AuthSession {
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in || 3600,
      expires_at: session.expires_at,
      token_type: session.token_type || 'bearer',
      user: this.mapSupabaseUser(session.user)
    };
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;

// Utility functions for components
export const useAuth = () => {
  if (typeof window === 'undefined') {
    return {
      user: null,
      session: null,
      loading: true,
      error: null,
      isAuthenticated: false
    };
  }

  return authService.getAuthState();
};

export const requireAuth = async (): Promise<AuthUser | null> => {
  const user = authService.getCurrentUser();

  if (!user) {
    if (typeof window !== 'undefined') {
      // Redirect to sign-in page
      window.location.href = '/auth/signin?redirect=' + encodeURIComponent(window.location.pathname);
    }
    return null;
  }

  return user;
};

// Development utilities
export const mockSignIn = async (mockUser?: Partial<AuthUser>): Promise<void> => {
  if (import.meta.env.NODE_ENV !== 'development') {
    console.warn('mockSignIn is only available in development mode');
    return;
  }

  const defaultMockUser: AuthUser = {
    id: 'mock-user-id',
    email: 'demo@bizkit.dev',
    user_metadata: {
      full_name: 'Demo User',
      avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo',
      preferred_username: 'demo'
    },
    app_metadata: {
      provider: 'mock',
      providers: ['mock']
    }
  };

  const user = { ...defaultMockUser, ...mockUser };

  // Simulate authentication state
  (authService as any).updateAuthState({
    user,
    session: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      user
    },
    loading: false,
    error: null
  });

  console.log('Mock user signed in:', user.email);
};
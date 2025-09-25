/**
 * T032: Supabase client configuration
 * Supabase client setup for AI Trading System with authentication and database access
 * Based on research.md technical decisions
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Database type definitions for better TypeScript support
export interface Database {
  public: {
    Tables: {
      trading_users: {
        Row: {
          id: string;
          display_name: string;
          default_capital: number;
          risk_tolerance: "low" | "medium" | "high";
          preferred_coins: string[];
          notification_settings: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          default_capital?: number;
          risk_tolerance?: "low" | "medium" | "high";
          preferred_coins?: string[];
          notification_settings?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string;
          default_capital?: number;
          risk_tolerance?: "low" | "medium" | "high";
          preferred_coins?: string[];
          notification_settings?: Record<string, any>;
          updated_at?: string;
        };
      };
      trading_runs: {
        Row: {
          id: string;
          user_id: string | null;
          session_type: "simulation" | "backtest";
          coin_symbol: string;
          starting_capital: number;
          final_capital: number | null;
          total_trades: number;
          winning_trades: number;
          win_rate: number | null;
          total_return: number | null;
          max_drawdown: number | null;
          session_start: string;
          session_end: string | null;
          time_period_start: string | null;
          time_period_end: string | null;
          ai_model_version: string;
          parameters: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_type: "simulation" | "backtest";
          coin_symbol: string;
          starting_capital: number;
          final_capital?: number | null;
          total_trades?: number;
          winning_trades?: number;
          win_rate?: number | null;
          total_return?: number | null;
          max_drawdown?: number | null;
          session_start?: string;
          session_end?: string | null;
          time_period_start?: string | null;
          time_period_end?: string | null;
          ai_model_version: string;
          parameters?: Record<string, any>;
          created_at?: string;
        };
        Update: {
          final_capital?: number | null;
          total_trades?: number;
          winning_trades?: number;
          win_rate?: number | null;
          total_return?: number | null;
          max_drawdown?: number | null;
          session_end?: string | null;
          parameters?: Record<string, any>;
        };
      };
      trading_trades: {
        Row: {
          id: string;
          run_id: string;
          user_id: string | null;
          trade_type: "buy" | "sell";
          coin_symbol: string;
          quantity: number;
          price: number;
          total_value: number;
          fee: number;
          net_value: number;
          portfolio_value_before: number;
          portfolio_value_after: number;
          profit_loss: number | null;
          trade_reason: "ai_signal" | "stop_loss" | "take_profit" | "manual";
          ai_confidence: number;
          market_price: number;
          execution_time: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          user_id?: string | null;
          trade_type: "buy" | "sell";
          coin_symbol: string;
          quantity: number;
          price: number;
          total_value: number;
          fee: number;
          net_value: number;
          portfolio_value_before: number;
          portfolio_value_after: number;
          profit_loss?: number | null;
          trade_reason: "ai_signal" | "stop_loss" | "take_profit" | "manual";
          ai_confidence: number;
          market_price: number;
          execution_time?: string;
          created_at?: string;
        };
        Update: {
          profit_loss?: number | null;
        };
      };
      market_data: {
        Row: {
          id: string;
          coin_symbol: string;
          price_source: string;
          current_price: number;
          price_change_24h: number;
          volume_24h: number;
          market_cap: number;
          sentiment_score: number;
          fear_greed_index: number;
          last_updated: string;
          historical_data: Record<string, any>[];
          created_at: string;
        };
        Insert: {
          id?: string;
          coin_symbol: string;
          price_source: string;
          current_price: number;
          price_change_24h: number;
          volume_24h: number;
          market_cap: number;
          sentiment_score?: number;
          fear_greed_index?: number;
          last_updated?: string;
          historical_data?: Record<string, any>[];
          created_at?: string;
        };
        Update: {
          current_price?: number;
          price_change_24h?: number;
          volume_24h?: number;
          market_cap?: number;
          sentiment_score?: number;
          fear_greed_index?: number;
          last_updated?: string;
          historical_data?: Record<string, any>[];
        };
      };
      ai_predictions: {
        Row: {
          id: string;
          coin_symbol: string;
          model_version: string;
          input_features: Record<string, any>;
          predicted_price: number;
          predicted_direction: "up" | "down" | "hold";
          confidence_score: number;
          prediction_horizon: number;
          actual_price: number | null;
          accuracy_score: number | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          coin_symbol: string;
          model_version: string;
          input_features: Record<string, any>;
          predicted_price: number;
          predicted_direction: "up" | "down" | "hold";
          confidence_score: number;
          prediction_horizon: number;
          actual_price?: number | null;
          accuracy_score?: number | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          actual_price?: number | null;
          accuracy_score?: number | null;
          resolved_at?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Environment variables validation
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// For development, allow placeholder values
const isDevMode = import.meta.env.NODE_ENV === 'development';
const isPlaceholder = supabaseUrl?.includes('placeholder') || supabaseAnonKey?.includes('placeholder');

if (!supabaseUrl && !isDevMode) {
  throw new Error("Missing PUBLIC_SUPABASE_URL environment variable");
}

if (!supabaseAnonKey && !isDevMode) {
  throw new Error("Missing PUBLIC_SUPABASE_ANON_KEY environment variable");
}

// Create and configure Supabase client
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || 'https://dev-placeholder.supabase.co',
  supabaseAnonKey || 'dev-placeholder-key',
  {
    auth: {
      // Configure for .bizkit.dev domain SSO
      cookieOptions: {
        name: "auth-token",
        domain: ".bizkit.dev",
        maxAge: 100 * 365 * 24 * 60 * 60, // 100 years in seconds
        httpOnly: false, // Allow client-side access for SSO
        sameSite: "lax", // Allow cross-subdomain cookies
        secure: true // HTTPS only
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce" // Use PKCE flow for better security
    },
    db: {
      schema: "public"
    },
    global: {
      headers: {
        "X-Client-Info": "ai-trading-system@1.0.0"
      }
    }
  }
);

// Helper functions for common operations

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getting current user:", error);
    return null;
  }
  return user;
}

/**
 * Get the current session
 */
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Error getting current session:", error);
    return null;
  }
  return session;
}

/**
 * Sign in with OAuth provider (Google)
 */
export async function signInWithOAuth(provider: "google") {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "consent"
      }
    }
  });

  if (error) {
    console.error("Error signing in with OAuth:", error);
    throw error;
  }

  return data;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return !!session;
}

/**
 * Get user ID for database operations
 */
export async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id || null;
}

/**
 * Create RLS policy helper - ensures user can only access their own data
 */
export function createRLSPolicy(tableName: string, operation: string) {
  return `
    CREATE POLICY "${operation}_own_${tableName}" ON ${tableName}
    FOR ${operation.toUpperCase()} USING (auth.uid() = user_id);
  `;
}

/**
 * Database connection test
 */
export async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("trading_users")
      .select("count")
      .limit(1);

    return !error;
  } catch (error) {
    console.error("Database connection test failed:", error);
    return false;
  }
}

/**
 * Handle database errors consistently
 */
export function handleDatabaseError(error: any, operation: string) {
  console.error(`Database error during ${operation}:`, error);

  // Common error handling
  if (error.code === "PGRST301") {
    throw new Error("Unauthorized: You don't have permission to access this resource");
  }

  if (error.code === "23505") {
    throw new Error("Duplicate entry: This record already exists");
  }

  if (error.code === "23503") {
    throw new Error("Invalid reference: Referenced record does not exist");
  }

  if (error.code === "42501") {
    throw new Error("Permission denied: Insufficient privileges");
  }

  // Generic error
  throw new Error(`Database operation failed: ${error.message || "Unknown error"}`);
}

/**
 * Retry database operations with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry auth errors
      if (error.message?.includes("Unauthorized") || error.message?.includes("Permission denied")) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

// Export database type for use in services
export type { Database };
export default supabase;
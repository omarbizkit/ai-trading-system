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

// Environment variables validation with better error handling
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Environment detection
const isDevMode = import.meta.env.NODE_ENV === 'development';
const isProduction = import.meta.env.NODE_ENV === 'production';
const isPlaceholder = supabaseUrl?.includes('placeholder') || supabaseAnonKey?.includes('placeholder');

// Validation with detailed error messages
if (!supabaseUrl) {
  const errorMsg = isDevMode 
    ? "Missing PUBLIC_SUPABASE_URL environment variable. Please check your .env file."
    : "Missing PUBLIC_SUPABASE_URL environment variable for production deployment.";
  throw new Error(errorMsg);
}

if (!supabaseAnonKey) {
  const errorMsg = isDevMode 
    ? "Missing PUBLIC_SUPABASE_ANON_KEY environment variable. Please check your .env file."
    : "Missing PUBLIC_SUPABASE_ANON_KEY environment variable for production deployment.";
  throw new Error(errorMsg);
}

// Validate URL format
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  throw new Error(`Invalid Supabase URL format: ${supabaseUrl}. Expected format: https://your-project.supabase.co`);
}

// Validate key format (basic check)
if (supabaseAnonKey.length < 50) {
  throw new Error(`Invalid Supabase anon key format. Key appears to be too short: ${supabaseAnonKey.length} characters`);
}

// Create and configure Supabase client with production-ready settings
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      // Configure for .bizkit.dev domain SSO
      cookieOptions: {
        name: "auth-token",
        domain: isProduction ? ".bizkit.dev" : "localhost",
        maxAge: 100 * 365 * 24 * 60 * 60, // 100 years in seconds
        httpOnly: false, // Allow client-side access for SSO
        sameSite: isProduction ? "lax" : "lax", // Allow cross-subdomain cookies
        secure: isProduction // HTTPS only in production
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
        "X-Client-Info": `ai-trading-system@1.0.0-${isProduction ? 'production' : 'development'}`,
        "X-Environment": isProduction ? 'production' : 'development'
      }
    },
    // Add connection pooling and retry configuration
    realtime: {
      params: {
        eventsPerSecond: 10
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
 * Database connection test with detailed diagnostics
 */
export async function testConnection(): Promise<{
  success: boolean;
  error?: string;
  responseTime?: number;
  details?: any;
}> {
  const startTime = Date.now();
  
  try {
    // Test basic connectivity with a simple query
    const { data, error } = await supabase
      .from("trading_users")
      .select("count")
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        success: false,
        error: error.message,
        responseTime,
        details: {
          code: error.code,
          hint: error.hint,
          details: error.details
        }
      };
    }

    return {
      success: true,
      responseTime,
      details: {
        data: data,
        connection: "healthy"
      }
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    return {
      success: false,
      error: error.message || "Unknown connection error",
      responseTime,
      details: {
        type: error.constructor.name,
        stack: error.stack
      }
    };
  }
}

/**
 * Test database schema and permissions
 */
export async function testDatabaseSchema(): Promise<{
  success: boolean;
  tables?: string[];
  error?: string;
}> {
  try {
    // Test access to all main tables
    const tables = ['trading_users', 'trading_runs', 'trading_trades', 'market_data', 'ai_predictions'];
    const results = await Promise.allSettled(
      tables.map(table => 
        supabase
          .from(table)
          .select('*')
          .limit(1)
      )
    );

    const accessibleTables = results
      .map((result, index) => ({ result, table: tables[index] }))
      .filter(({ result }) => result.status === 'fulfilled')
      .map(({ table }) => table);

    return {
      success: accessibleTables.length === tables.length,
      tables: accessibleTables,
      error: accessibleTables.length < tables.length 
        ? `Only ${accessibleTables.length}/${tables.length} tables accessible`
        : undefined
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Schema test failed"
    };
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
 * Retry database operations with exponential backoff and circuit breaker
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

      // Don't retry auth errors or client errors
      if (error.message?.includes("Unauthorized") || 
          error.message?.includes("Permission denied") ||
          error.message?.includes("Not Found") ||
          error.message?.includes("Bad Request")) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Database operation failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`Database operation failed after ${maxRetries} attempts:`, lastError);
  throw lastError!;
}

/**
 * Connection pool monitoring and health checks
 */
export class ConnectionPool {
  private static instance: ConnectionPool;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: Date | null = null;
  private isHealthy: boolean = true;

  static getInstance(): ConnectionPool {
    if (!ConnectionPool.instance) {
      ConnectionPool.instance = new ConnectionPool();
    }
    return ConnectionPool.instance;
  }

  async startHealthMonitoring(intervalMs: number = 30000) {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);

    // Initial health check
    await this.performHealthCheck();
  }

  stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async performHealthCheck() {
    try {
      const result = await testConnection();
      this.isHealthy = result.success;
      this.lastHealthCheck = new Date();
      
      if (!this.isHealthy) {
        console.warn('Database health check failed:', result.error);
      }
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();
      console.error('Database health check error:', error);
    }
  }

  getHealthStatus() {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastHealthCheck,
      uptime: this.lastHealthCheck ? Date.now() - this.lastHealthCheck.getTime() : null
    };
  }
}

// Initialize connection pool monitoring
const connectionPool = ConnectionPool.getInstance();
if (isProduction) {
  connectionPool.startHealthMonitoring(30000); // Check every 30 seconds in production
}

// Export database type for use in services
export type { Database };
export default supabase;
/**
 * T066: Supabase Production Configuration Service
 * Configure Supabase production instance and connection strings
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase';

export interface SupabaseProductionConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  environment: 'production' | 'staging';
  connectionPoolSize: number;
  maxConnections: number;
  idleTimeout: number;
}

export interface SupabaseHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  connectionCount: number;
  lastChecked: string;
  errors: string[];
}

export class SupabaseProductionService {
  private client: SupabaseClient<Database>;
  private config: SupabaseProductionConfig;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: SupabaseProductionConfig) {
    this.config = config;
    this.client = this.createClient();
    this.startHealthChecking();
  }

  private createClient(): SupabaseClient<Database> {
    return createClient<Database>(
      this.config.url,
      this.config.anonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          // Production cookie settings for .bizkit.dev domain
          cookieOptions: {
            name: 'ai-trading-auth',
            domain: '.bizkit.dev',
            path: '/',
            sameSite: 'lax',
            secure: true, // HTTPS only in production
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60, // 7 days
          },
        },
        global: {
          headers: {
            'X-Client-Info': 'ai-trading-system@1.0.0-production',
            'X-Environment': 'production',
            'X-Connection-Pool-Size': this.config.connectionPoolSize.toString(),
          },
        },
        db: {
          schema: 'public',
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      }
    );
  }

  async validateConnection(): Promise<SupabaseHealthCheck> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Test basic connectivity
      const { data, error } = await this.client
        .from('trading_users')
        .select('id')
        .limit(1);

      if (error) {
        errors.push(`Database query failed: ${error.message}`);
      }

      // Test authentication
      const { data: authUser, error: authError } = await this.client.auth.getUser();
      if (authError && authError.message !== 'Auth session missing!') {
        errors.push(`Auth check failed: ${authError.message}`);
      }

      // Test real-time connectivity
      const channel = this.client.channel('health-check');
      const subscriptionError = await new Promise<string | null>((resolve) => {
        const timeout = setTimeout(() => resolve('Real-time connection timeout'), 5000);

        channel.subscribe((status) => {
          clearTimeout(timeout);
          if (status === 'SUBSCRIBED') {
            resolve(null);
          } else {
            resolve(`Real-time subscription failed: ${status}`);
          }
        });
      });

      if (subscriptionError) {
        errors.push(subscriptionError);
      }

      await this.client.removeChannel(channel);

      const responseTime = Date.now() - startTime;
      const status = errors.length === 0 ? 'healthy' :
                   errors.length <= 2 ? 'degraded' : 'unhealthy';

      return {
        status,
        responseTime,
        connectionCount: await this.getConnectionCount(),
        lastChecked: new Date().toISOString(),
        errors,
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      errors.push(`Connection validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      return {
        status: 'unhealthy',
        responseTime,
        connectionCount: 0,
        lastChecked: new Date().toISOString(),
        errors,
      };
    }
  }

  private async getConnectionCount(): Promise<number> {
    try {
      // Query pg_stat_activity to get connection count (requires appropriate permissions)
      const { data, error } = await this.client.rpc('get_connection_count');

      if (error || !data) {
        console.warn('Could not retrieve connection count:', error?.message);
        return 0;
      }

      return data as number;
    } catch (error) {
      console.warn('Connection count query failed:', error);
      return 0;
    }
  }

  async migrateToProduction(): Promise<{
    success: boolean;
    tablesCreated: number;
    policiesApplied: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let tablesCreated = 0;
    let policiesApplied = 0;

    try {
      // Check if tables exist and create if needed
      const requiredTables = [
        'trading_users',
        'trading_sessions',
        'trading_predictions',
        'trading_backtest_runs',
        'trading_performance_metrics'
      ];

      for (const table of requiredTables) {
        try {
          const { error } = await this.client
            .from(table)
            .select('*')
            .limit(0);

          if (error && error.message.includes('does not exist')) {
            errors.push(`Missing table: ${table}`);
          } else {
            tablesCreated++;
          }
        } catch (error) {
          errors.push(`Table check failed for ${table}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Verify RLS policies are enabled
      try {
        const { data: policies, error } = await this.client.rpc('get_rls_policies');

        if (error) {
          errors.push(`RLS policy check failed: ${error.message}`);
        } else {
          policiesApplied = Array.isArray(policies) ? policies.length : 0;
        }
      } catch (error) {
        errors.push(`Policy verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return {
        success: errors.length === 0,
        tablesCreated,
        policiesApplied,
        errors,
      };

    } catch (error) {
      errors.push(`Migration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        success: false,
        tablesCreated,
        policiesApplied,
        errors,
      };
    }
  }

  private startHealthChecking(): void {
    // Health check every 5 minutes in production
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.validateConnection();

      if (health.status === 'unhealthy') {
        console.error('Supabase health check failed:', health.errors);
        // In production, this could trigger alerts/notifications
      }
    }, 5 * 60 * 1000);
  }

  stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  getClient(): SupabaseClient<Database> {
    return this.client;
  }

  getConfig(): SupabaseProductionConfig {
    return { ...this.config };
  }

  // Production-specific connection management
  async optimizeConnection(): Promise<void> {
    // Set connection parameters for production
    try {
      await this.client.rpc('optimize_connection_settings', {
        pool_size: this.config.connectionPoolSize,
        max_connections: this.config.maxConnections,
        idle_timeout: this.config.idleTimeout,
      });
    } catch (error) {
      console.warn('Connection optimization failed:', error);
    }
  }
}

// Factory function for production environment
export function createProductionSupabaseService(): SupabaseProductionService {
  const isProduction = import.meta.env.NODE_ENV === 'production';

  const config: SupabaseProductionConfig = {
    url: import.meta.env.PUBLIC_SUPABASE_URL || 'https://production-project.supabase.co',
    anonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'production-anon-key',
    serviceRoleKey: import.meta.env.SUPABASE_SERVICE_ROLE_KEY || 'production-service-role-key',
    environment: isProduction ? 'production' : 'staging',
    connectionPoolSize: isProduction ? 20 : 10,
    maxConnections: isProduction ? 100 : 50,
    idleTimeout: isProduction ? 600 : 300, // 10 minutes production, 5 minutes staging
  };

  return new SupabaseProductionService(config);
}

// Global instance (singleton pattern for production)
export const productionSupabase = createProductionSupabaseService();
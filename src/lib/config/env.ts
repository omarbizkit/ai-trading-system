/**
 * Environment Configuration Utility
 * Provides type-safe access to environment variables with validation and defaults
 */

// Environment types
export type Environment = 'development' | 'staging' | 'production' | 'test';

// Configuration interface
export interface AppConfig {
  // Application
  nodeEnv: Environment;
  port: number;
  host: string;
  appUrl: string;
  portfolioUrl: string;

  // Supabase
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };

  // External APIs
  coinGecko: {
    apiKey?: string;
    baseUrl: string;
    rateLimit: number;
  };

  // AI/ML
  ai: {
    modelVersion: string;
    modelType: string;
    confidenceThreshold: number;
    cacheTimeToLive: number;
    tensorflowBackend: 'cpu' | 'webgl' | 'webgpu';
    modelUrl?: string;
    inferenceEndpoint?: string;
  };

  // Trading
  trading: {
    defaultPortfolioValue: number;
    defaultStartingCapital: number;
    maxPositionSize: number;
    defaultRiskPerTrade: number;
    defaultStopLoss: number;
    defaultTakeProfit: number;
    riskManagementEnabled: boolean;
    paperTradingOnly: boolean;
    enableRealTrading: boolean;
  };

  // External Services
  services: {
    enableRealApiCalls: boolean;
    mockDataEnabled: boolean;
    enablePriceUpdates: boolean;
    updateIntervalMs: number;
  };

  // Database
  database?: {
    url: string;
  };

  // Redis
  redis?: {
    url: string;
    password?: string;
    ttl: number;
  };

  // Security
  security: {
    jwtSecret?: string;
    jwtExpiresIn: string;
    sessionSecret?: string;
    corsOrigin: string[];
  };

  // Monitoring
  monitoring: {
    sentryDsn?: string;
    sentryEnvironment: string;
    googleAnalyticsId?: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    enableDebugLogs: boolean;
  };

  // Feature Flags
  features: {
    aiPredictions: boolean;
    backtesting: boolean;
    socialFeatures: boolean;
    paperTrading: boolean;
    advancedCharts: boolean;
    mobileApp: boolean;
    apiAccess: boolean;
  };

  // Deployment
  deployment?: {
    zeaburProjectId?: string;
    zeaburServiceId?: string;
  };
}

/**
 * Get environment variable with type conversion and validation
 */
function getEnvVar(key: string, defaultValue?: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  return defaultValue;
}

/**
 * Get required environment variable (throws if missing)
 */
function getRequiredEnvVar(key: string): string {
  const value = getEnvVar(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get boolean environment variable
 */
function getBooleanEnv(key: string, defaultValue: boolean = false): boolean {
  const value = getEnvVar(key);
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Get number environment variable
 */
function getNumberEnv(key: string, defaultValue: number): number {
  const value = getEnvVar(key);
  if (!value) return defaultValue;
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get array environment variable (comma-separated)
 */
function getArrayEnv(key: string, defaultValue: string[] = []): string[] {
  const value = getEnvVar(key);
  if (!value) return defaultValue;
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

/**
 * Validate environment configuration
 */
function validateConfig(config: AppConfig): void {
  // Validate required Supabase configuration
  if (!config.supabase.url || !config.supabase.anonKey) {
    console.warn('Warning: Supabase configuration is incomplete. Some features may not work.');
  }

  // Validate AI confidence threshold
  if (config.ai.confidenceThreshold < 0 || config.ai.confidenceThreshold > 1) {
    throw new Error('AI confidence threshold must be between 0 and 1');
  }

  // Validate trading parameters
  if (config.trading.maxPositionSize > 1) {
    throw new Error('Max position size cannot exceed 100%');
  }

  // Validate security in production
  if (config.nodeEnv === 'production') {
    if (!config.security.jwtSecret || config.security.jwtSecret.length < 32) {
      throw new Error('JWT secret must be at least 32 characters in production');
    }
    if (!config.security.sessionSecret) {
      throw new Error('Session secret is required in production');
    }
  }
}

/**
 * Load and validate application configuration
 */
export function loadConfig(): AppConfig {
  const nodeEnv = (getEnvVar('NODE_ENV', 'development') as Environment);

  const config: AppConfig = {
    // Application
    nodeEnv,
    port: getNumberEnv('PORT', 4321),
    host: getEnvVar('HOST', '0.0.0.0')!,
    appUrl: getEnvVar('PUBLIC_APP_URL', 'http://localhost:4321')!,
    portfolioUrl: getEnvVar('PUBLIC_PORTFOLIO_URL', 'https://bizkit.dev')!,

    // Supabase
    supabase: {
      url: getEnvVar('PUBLIC_SUPABASE_URL', '')!,
      anonKey: getEnvVar('PUBLIC_SUPABASE_ANON_KEY', '')!,
      serviceRoleKey: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),
    },

    // External APIs
    coinGecko: {
      apiKey: getEnvVar('COINGECKO_API_KEY'),
      baseUrl: 'https://api.coingecko.com/api/v3',
      rateLimit: nodeEnv === 'development' ? 50 : 30,
    },

    // AI/ML
    ai: {
      modelVersion: getEnvVar('AI_MODEL_VERSION', 'v1.2.3')!,
      modelType: getEnvVar('AI_MODEL_TYPE', 'lstm')!,
      confidenceThreshold: getNumberEnv('AI_CONFIDENCE_THRESHOLD', 0.6),
      cacheTimeToLive: getNumberEnv('MODEL_CACHE_TTL', 300),
      tensorflowBackend: (getEnvVar('TENSORFLOW_JS_BACKEND', 'cpu') as 'cpu' | 'webgl' | 'webgpu'),
      modelUrl: getEnvVar('MODEL_URL'),
      inferenceEndpoint: getEnvVar('ML_INFERENCE_ENDPOINT'),
    },

    // Trading
    trading: {
      defaultPortfolioValue: getNumberEnv('DEFAULT_PORTFOLIO_VALUE', 50000),
      defaultStartingCapital: getNumberEnv('DEFAULT_STARTING_CAPITAL', 10000),
      maxPositionSize: getNumberEnv('MAX_POSITION_SIZE', 0.1),
      defaultRiskPerTrade: getNumberEnv('DEFAULT_RISK_PER_TRADE', 0.02),
      defaultStopLoss: getNumberEnv('DEFAULT_STOP_LOSS', 0.05),
      defaultTakeProfit: getNumberEnv('DEFAULT_TAKE_PROFIT', 0.10),
      riskManagementEnabled: getBooleanEnv('RISK_MANAGEMENT_ENABLED', true),
      paperTradingOnly: getBooleanEnv('PAPER_TRADING_ONLY', true),
      enableRealTrading: getBooleanEnv('ENABLE_REAL_TRADING', false),
    },

    // External Services
    services: {
      enableRealApiCalls: getBooleanEnv('ENABLE_REAL_API_CALLS', nodeEnv !== 'development'),
      mockDataEnabled: getBooleanEnv('MOCK_DATA_ENABLED', nodeEnv === 'development'),
      enablePriceUpdates: getBooleanEnv('ENABLE_PRICE_UPDATES', true),
      updateIntervalMs: getNumberEnv('UPDATE_INTERVAL_MS', 5000),
    },

    // Database
    database: {
      url: getEnvVar('DATABASE_URL'),
    },

    // Redis
    redis: {
      url: getEnvVar('REDIS_URL'),
      password: getEnvVar('REDIS_PASSWORD'),
      ttl: getNumberEnv('REDIS_TTL', 3600),
    },

    // Security
    security: {
      jwtSecret: getEnvVar('JWT_SECRET'),
      jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '7d')!,
      sessionSecret: getEnvVar('SESSION_SECRET'),
      corsOrigin: getArrayEnv('CORS_ORIGIN', [
        'http://localhost:4321',
        'https://bizkit.dev'
      ]),
    },

    // Monitoring
    monitoring: {
      sentryDsn: getEnvVar('SENTRY_DSN'),
      sentryEnvironment: getEnvVar('SENTRY_ENVIRONMENT', nodeEnv)!,
      googleAnalyticsId: getEnvVar('GOOGLE_ANALYTICS_ID'),
      logLevel: (getEnvVar('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error'),
      enableDebugLogs: getBooleanEnv('ENABLE_DEBUG_LOGS', nodeEnv === 'development'),
    },

    // Feature Flags
    features: {
      aiPredictions: getBooleanEnv('ENABLE_AI_PREDICTIONS', true),
      backtesting: getBooleanEnv('ENABLE_BACKTESTING', true),
      socialFeatures: getBooleanEnv('ENABLE_SOCIAL_FEATURES', false),
      paperTrading: getBooleanEnv('ENABLE_PAPER_TRADING', true),
      advancedCharts: getBooleanEnv('ENABLE_ADVANCED_CHARTS', true),
      mobileApp: getBooleanEnv('ENABLE_MOBILE_APP', true),
      apiAccess: getBooleanEnv('ENABLE_API_ACCESS', nodeEnv !== 'production'),
    },

    // Deployment
    deployment: {
      zeaburProjectId: getEnvVar('ZEABUR_PROJECT_ID'),
      zeaburServiceId: getEnvVar('ZEABUR_SERVICE_ID'),
    },
  };

  // Validate configuration
  validateConfig(config);

  return config;
}

/**
 * Get current environment
 */
export function getCurrentEnvironment(): Environment {
  return (getEnvVar('NODE_ENV', 'development') as Environment);
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return getCurrentEnvironment() === 'development';
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return getCurrentEnvironment() === 'production';
}

/**
 * Check if running in staging
 */
export function isStaging(): boolean {
  return getCurrentEnvironment() === 'staging';
}

/**
 * Check if running in test environment
 */
export function isTest(): boolean {
  return getCurrentEnvironment() === 'test';
}

// Export singleton config instance
export const config = loadConfig();
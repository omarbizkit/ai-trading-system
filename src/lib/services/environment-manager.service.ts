/**
 * T067: Production Environment Variables and Secrets Management
 * Set up production environment variables and secrets management
 */

export interface EnvironmentConfig {
  environment: 'development' | 'staging' | 'production';
  app: {
    url: string;
    portfolioUrl: string;
    domain: string;
  };
  database: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  security: {
    jwtSecret: string;
    sessionSecret: string;
    corsOrigin: string[];
  };
  services: {
    coingeckoApiKey?: string;
    sentryDsn?: string;
    googleAnalyticsId?: string;
  };
  features: {
    realApiCalls: boolean;
    mockDataEnabled: boolean;
    priceUpdates: boolean;
    debugLogs: boolean;
  };
  performance: {
    cacheEnabled: boolean;
    updateInterval: number;
    rateLimitWindow: number;
    rateLimitRequests: number;
  };
}

export interface EnvironmentValidation {
  isValid: boolean;
  environment: string;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  missingOptional: string[];
  recommendations: string[];
}

export class EnvironmentManagerService {
  private config: EnvironmentConfig;
  private requiredVars: string[] = [
    'PUBLIC_SUPABASE_URL',
    'PUBLIC_SUPABASE_ANON_KEY',
    'PUBLIC_APP_URL',
    'PUBLIC_PORTFOLIO_URL',
  ];

  private productionRequiredVars: string[] = [
    ...this.requiredVars,
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'SESSION_SECRET',
    'CORS_ORIGIN',
  ];

  private optionalVars: string[] = [
    'COINGECKO_API_KEY',
    'SENTRY_DSN',
    'GOOGLE_ANALYTICS_ID',
    'REDIS_URL',
    'REDIS_PASSWORD',
  ];

  constructor() {
    this.config = this.loadEnvironmentConfig();
  }

  private loadEnvironmentConfig(): EnvironmentConfig {
    const env = import.meta.env;
    const isProduction = env.NODE_ENV === 'production';
    const isStaging = env.NODE_ENV === 'staging';

    return {
      environment: isProduction ? 'production' : isStaging ? 'staging' : 'development',
      app: {
        url: env.PUBLIC_APP_URL || 'http://localhost:4321',
        portfolioUrl: env.PUBLIC_PORTFOLIO_URL || 'https://bizkit.dev',
        domain: isProduction ? '.bizkit.dev' : 'localhost',
      },
      database: {
        url: env.PUBLIC_SUPABASE_URL || '',
        anonKey: env.PUBLIC_SUPABASE_ANON_KEY || '',
        serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
      },
      security: {
        jwtSecret: env.JWT_SECRET || 'development-jwt-secret',
        sessionSecret: env.SESSION_SECRET || 'development-session-secret',
        corsOrigin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',') : ['http://localhost:4321'],
      },
      services: {
        coingeckoApiKey: env.COINGECKO_API_KEY,
        sentryDsn: env.SENTRY_DSN,
        googleAnalyticsId: env.GOOGLE_ANALYTICS_ID,
      },
      features: {
        realApiCalls: env.ENABLE_REAL_API_CALLS === 'true',
        mockDataEnabled: env.MOCK_DATA_ENABLED !== 'false',
        priceUpdates: env.ENABLE_PRICE_UPDATES !== 'false',
        debugLogs: env.ENABLE_DEBUG_LOGS === 'true',
      },
      performance: {
        cacheEnabled: env.CACHE_ENABLED !== 'false',
        updateInterval: parseInt(env.UPDATE_INTERVAL_MS || '5000'),
        rateLimitWindow: parseInt(env.RATE_LIMIT_WINDOW_MS || '900000'),
        rateLimitRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS || '100'),
      },
    };
  }

  validateEnvironment(): EnvironmentValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingRequired: string[] = [];
    const missingOptional: string[] = [];
    const recommendations: string[] = [];

    const env = import.meta.env;
    const isProduction = this.config.environment === 'production';

    // Check required variables
    const requiredVars = isProduction ? this.productionRequiredVars : this.requiredVars;

    for (const varName of requiredVars) {
      if (!env[varName] || env[varName] === '') {
        missingRequired.push(varName);
        errors.push(`Missing required environment variable: ${varName}`);
      }
    }

    // Check optional variables
    for (const varName of this.optionalVars) {
      if (!env[varName] || env[varName] === '') {
        missingOptional.push(varName);
      }
    }

    // Production-specific validations
    if (isProduction) {
      this.validateProductionSecrets(errors, warnings, recommendations);
      this.validateProductionUrls(errors, warnings);
      this.validateProductionSecurity(errors, warnings, recommendations);
    }

    // URL validations
    if (this.config.database.url && !this.config.database.url.startsWith('https://')) {
      if (isProduction) {
        errors.push('Database URL must use HTTPS in production');
      } else {
        warnings.push('Database URL should use HTTPS');
      }
    }

    if (this.config.app.url && !this.config.app.url.startsWith('https://') && isProduction) {
      errors.push('App URL must use HTTPS in production');
    }

    // Key length validations
    if (this.config.database.anonKey && this.config.database.anonKey.length < 50) {
      warnings.push('Supabase anon key appears to be a development placeholder');
    }

    if (this.config.security.jwtSecret && this.config.security.jwtSecret.length < 32) {
      if (isProduction) {
        errors.push('JWT secret must be at least 32 characters in production');
      } else {
        warnings.push('JWT secret should be at least 32 characters');
      }
    }

    // Performance recommendations
    if (this.config.performance.updateInterval < 5000 && isProduction) {
      recommendations.push('Consider increasing update interval to reduce API costs in production');
    }

    if (missingOptional.includes('COINGECKO_API_KEY') && isProduction) {
      recommendations.push('Consider adding CoinGecko API key for better rate limits');
    }

    if (missingOptional.includes('SENTRY_DSN') && isProduction) {
      recommendations.push('Consider adding Sentry for error monitoring in production');
    }

    return {
      isValid: errors.length === 0,
      environment: this.config.environment,
      errors,
      warnings,
      missingRequired,
      missingOptional,
      recommendations,
    };
  }

  private validateProductionSecrets(errors: string[], warnings: string[], recommendations: string[]): void {
    const env = import.meta.env;

    // Check for development secrets in production
    const developmentIndicators = ['dev', 'test', 'localhost', 'development', 'placeholder'];

    for (const indicator of developmentIndicators) {
      if (this.config.security.jwtSecret.toLowerCase().includes(indicator)) {
        errors.push('JWT secret appears to be a development value');
      }

      if (this.config.security.sessionSecret.toLowerCase().includes(indicator)) {
        errors.push('Session secret appears to be a development value');
      }

      if (this.config.database.serviceRoleKey.toLowerCase().includes(indicator)) {
        errors.push('Service role key appears to be a development value');
      }
    }

    // Check secret rotation recommendations
    const jwtExpiry = env.JWT_EXPIRES_IN || '7d';
    if (jwtExpiry.includes('30d') || jwtExpiry.includes('90d')) {
      recommendations.push('Consider shorter JWT expiry times for better security');
    }
  }

  private validateProductionUrls(errors: string[], warnings: string[]): void {
    // Validate domain consistency
    if (!this.config.app.url.includes('bizkit.dev')) {
      warnings.push('App URL domain may not match expected production domain');
    }

    if (!this.config.app.portfolioUrl.includes('bizkit.dev')) {
      warnings.push('Portfolio URL domain may not match expected production domain');
    }

    // Check for localhost or development URLs
    const developmentUrls = ['localhost', '127.0.0.1', 'dev.', 'staging.'];

    for (const devUrl of developmentUrls) {
      if (this.config.app.url.includes(devUrl)) {
        errors.push(`Production app URL contains development indicator: ${devUrl}`);
      }
    }
  }

  private validateProductionSecurity(errors: string[], warnings: string[], recommendations: string[]): void {
    // CORS validation
    if (this.config.security.corsOrigin.includes('*')) {
      errors.push('CORS origin must not use wildcard (*) in production');
    }

    if (this.config.security.corsOrigin.some(origin => origin.includes('localhost'))) {
      warnings.push('CORS origin includes localhost in production');
    }

    // Security headers recommendations
    if (!import.meta.env.SECURITY_HEADERS_ENABLED) {
      recommendations.push('Consider enabling security headers for production');
    }

    if (!import.meta.env.RATE_LIMITING_ENABLED) {
      recommendations.push('Consider enabling rate limiting for production API endpoints');
    }
  }

  getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  isProduction(): boolean {
    return this.config.environment === 'production';
  }

  isStaging(): boolean {
    return this.config.environment === 'staging';
  }

  isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  // Get sanitized config for logging (without secrets)
  getSanitizedConfig(): Partial<EnvironmentConfig> {
    const config = { ...this.config };

    // Remove sensitive information
    delete (config as any).database.serviceRoleKey;
    delete (config as any).security.jwtSecret;
    delete (config as any).security.sessionSecret;

    if (config.services.coingeckoApiKey) {
      config.services.coingeckoApiKey = config.services.coingeckoApiKey.substring(0, 8) + '...';
    }

    return config;
  }

  // Production readiness score
  getReadinessScore(): {
    score: number;
    maxScore: number;
    details: {
      requiredVars: number;
      optionalVars: number;
      security: number;
      performance: number;
    };
  } {
    const validation = this.validateEnvironment();
    const isProduction = this.isProduction();

    let score = 0;
    const maxScore = 100;

    // Required variables (40 points)
    const requiredVars = isProduction ? this.productionRequiredVars : this.requiredVars;
    const requiredScore = Math.max(0, 40 - (validation.missingRequired.length * 8));
    score += requiredScore;

    // Optional variables (20 points)
    const optionalScore = Math.max(0, 20 - (validation.missingOptional.length * 4));
    score += optionalScore;

    // Security configuration (25 points)
    const securityIssues = validation.errors.filter(e =>
      e.includes('secret') || e.includes('CORS') || e.includes('HTTPS')
    ).length;
    const securityScore = Math.max(0, 25 - (securityIssues * 5));
    score += securityScore;

    // Performance optimization (15 points)
    const performanceScore = this.config.features.realApiCalls &&
                           this.config.performance.cacheEnabled ? 15 : 10;
    score += performanceScore;

    return {
      score: Math.min(score, maxScore),
      maxScore,
      details: {
        requiredVars: requiredScore,
        optionalVars: optionalScore,
        security: securityScore,
        performance: performanceScore,
      },
    };
  }
}

// Global instance
export const environmentManager = new EnvironmentManagerService();
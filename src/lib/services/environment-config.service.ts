/**
 * Environment Configuration Service
 * 
 * Service for managing environment variables and configuration
 * for different deployment environments.
 */

export interface EnvironmentConfig {
  // Application
  NODE_ENV: 'development' | 'staging' | 'production';
  PORT: number;
  HOST: string;
  
  // Database
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  
  // External APIs
  COINGECKO_API_KEY?: string;
  
  // AI/ML
  AI_MODEL_VERSION: string;
  AI_CONFIDENCE_THRESHOLD: number;
  TENSORFLOW_JS_BACKEND: string;
  
  // Trading
  DEFAULT_PORTFOLIO_VALUE: number;
  MAX_POSITION_SIZE: number;
  PAPER_TRADING_ONLY: boolean;
  
  // Security
  JWT_SECRET?: string;
  SESSION_SECRET?: string;
  
  // Monitoring
  SENTRY_DSN?: string;
  LOG_LEVEL: string;
  
  // Feature Flags
  ENABLE_REAL_API_CALLS: boolean;
  MOCK_DATA_ENABLED: boolean;
  ENABLE_PRICE_UPDATES: boolean;
  
  // Performance
  UPDATE_INTERVAL_MS: number;
  CACHE_TTL: number;
}

export interface EnvironmentValidationResult {
  isValid: boolean;
  missing: string[];
  invalid: string[];
  warnings: string[];
  config: Partial<EnvironmentConfig>;
}

export class EnvironmentConfigService {
  private config: Partial<EnvironmentConfig> = {};
  private validationRules: Map<string, (value: any) => boolean> = new Map();

  constructor() {
    this.initializeValidationRules();
    this.loadConfig();
  }

  /**
   * Initialize validation rules for environment variables
   */
  private initializeValidationRules(): void {
    this.validationRules.set('NODE_ENV', (value) => 
      ['development', 'staging', 'production'].includes(value)
    );
    
    this.validationRules.set('PORT', (value) => 
      typeof value === 'number' && value > 0 && value < 65536
    );
    
    this.validationRules.set('HOST', (value) => 
      typeof value === 'string' && value.length > 0
    );
    
    this.validationRules.set('PUBLIC_SUPABASE_URL', (value) => 
      typeof value === 'string' && value.startsWith('https://') && value.includes('.supabase.co')
    );
    
    this.validationRules.set('PUBLIC_SUPABASE_ANON_KEY', (value) => 
      typeof value === 'string' && value.length > 50
    );
    
    this.validationRules.set('COINGECKO_API_KEY', (value) => 
      !value || (typeof value === 'string' && value.length > 10)
    );
    
    this.validationRules.set('AI_CONFIDENCE_THRESHOLD', (value) => 
      typeof value === 'number' && value >= 0 && value <= 1
    );
    
    this.validationRules.set('DEFAULT_PORTFOLIO_VALUE', (value) => 
      typeof value === 'number' && value > 0 && value <= 10000000
    );
    
    this.validationRules.set('MAX_POSITION_SIZE', (value) => 
      typeof value === 'number' && value > 0 && value <= 1
    );
    
    this.validationRules.set('PAPER_TRADING_ONLY', (value) => 
      typeof value === 'boolean' || value === 'true' || value === 'false'
    );
    
    this.validationRules.set('LOG_LEVEL', (value) => 
      ['debug', 'info', 'warn', 'error'].includes(value)
    );
    
    this.validationRules.set('UPDATE_INTERVAL_MS', (value) => 
      typeof value === 'number' && value >= 1000 && value <= 300000
    );
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): void {
    this.config = {
      NODE_ENV: this.getEnvVar('NODE_ENV', 'development') as 'development' | 'staging' | 'production',
      PORT: this.getEnvVar('PORT', 4321, 'number'),
      HOST: this.getEnvVar('HOST', '0.0.0.0'),
      
      PUBLIC_SUPABASE_URL: this.getEnvVar('PUBLIC_SUPABASE_URL', ''),
      PUBLIC_SUPABASE_ANON_KEY: this.getEnvVar('PUBLIC_SUPABASE_ANON_KEY', ''),
      SUPABASE_SERVICE_ROLE_KEY: this.getEnvVar('SUPABASE_SERVICE_ROLE_KEY', undefined),
      
      COINGECKO_API_KEY: this.getEnvVar('COINGECKO_API_KEY', undefined),
      
      AI_MODEL_VERSION: this.getEnvVar('AI_MODEL_VERSION', 'v1.2.3'),
      AI_CONFIDENCE_THRESHOLD: this.getEnvVar('AI_CONFIDENCE_THRESHOLD', 0.6, 'number'),
      TENSORFLOW_JS_BACKEND: this.getEnvVar('TENSORFLOW_JS_BACKEND', 'cpu'),
      
      DEFAULT_PORTFOLIO_VALUE: this.getEnvVar('DEFAULT_PORTFOLIO_VALUE', 50000, 'number'),
      MAX_POSITION_SIZE: this.getEnvVar('MAX_POSITION_SIZE', 0.1, 'number'),
      PAPER_TRADING_ONLY: this.getEnvVar('PAPER_TRADING_ONLY', true, 'boolean'),
      
      JWT_SECRET: this.getEnvVar('JWT_SECRET', undefined),
      SESSION_SECRET: this.getEnvVar('SESSION_SECRET', undefined),
      
      SENTRY_DSN: this.getEnvVar('SENTRY_DSN', undefined),
      LOG_LEVEL: this.getEnvVar('LOG_LEVEL', 'info'),
      
      ENABLE_REAL_API_CALLS: this.getEnvVar('ENABLE_REAL_API_CALLS', false, 'boolean'),
      MOCK_DATA_ENABLED: this.getEnvVar('MOCK_DATA_ENABLED', true, 'boolean'),
      ENABLE_PRICE_UPDATES: this.getEnvVar('ENABLE_PRICE_UPDATES', true, 'boolean'),
      
      UPDATE_INTERVAL_MS: this.getEnvVar('UPDATE_INTERVAL_MS', 5000, 'number'),
      CACHE_TTL: this.getEnvVar('CACHE_TTL', 300000, 'number')
    };
  }

  /**
   * Get environment variable with type conversion
   */
  private getEnvVar(key: string, defaultValue: any, type: 'string' | 'number' | 'boolean' = 'string'): any {
    const value = import.meta.env[key] || process.env[key];
    
    if (value === undefined) {
      return defaultValue;
    }
    
    switch (type) {
      case 'number':
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
      
      case 'boolean':
        if (value === 'true') return true;
        if (value === 'false') return false;
        return Boolean(value);
      
      default:
        return value;
    }
  }

  /**
   * Validate environment configuration
   */
  validateConfig(): EnvironmentValidationResult {
    const missing: string[] = [];
    const invalid: string[] = [];
    const warnings: string[] = [];
    
    // Required variables
    const required = [
      'NODE_ENV',
      'PORT',
      'HOST',
      'PUBLIC_SUPABASE_URL',
      'PUBLIC_SUPABASE_ANON_KEY'
    ];
    
    // Check required variables
    for (const key of required) {
      if (!this.config[key as keyof EnvironmentConfig]) {
        missing.push(key);
      }
    }
    
    // Validate each variable
    for (const [key, value] of Object.entries(this.config)) {
      if (value !== undefined) {
        const validator = this.validationRules.get(key);
        if (validator && !validator(value)) {
          invalid.push(key);
        }
      }
    }
    
    // Environment-specific warnings
    if (this.config.NODE_ENV === 'production') {
      if (!this.config.JWT_SECRET) {
        warnings.push('JWT_SECRET not set for production environment');
      }
      if (!this.config.SESSION_SECRET) {
        warnings.push('SESSION_SECRET not set for production environment');
      }
      if (this.config.MOCK_DATA_ENABLED) {
        warnings.push('MOCK_DATA_ENABLED is true in production environment');
      }
      if (!this.config.ENABLE_REAL_API_CALLS) {
        warnings.push('ENABLE_REAL_API_CALLS is false in production environment');
      }
    }
    
    // Security warnings
    if (this.config.PUBLIC_SUPABASE_URL?.includes('placeholder')) {
      warnings.push('PUBLIC_SUPABASE_URL appears to be a placeholder value');
    }
    if (this.config.PUBLIC_SUPABASE_ANON_KEY?.includes('placeholder')) {
      warnings.push('PUBLIC_SUPABASE_ANON_KEY appears to be a placeholder value');
    }
    
    return {
      isValid: missing.length === 0 && invalid.length === 0,
      missing,
      invalid,
      warnings,
      config: this.config
    };
  }

  /**
   * Get configuration value
   */
  get<K extends keyof EnvironmentConfig>(key: K): EnvironmentConfig[K] | undefined {
    return this.config[key];
  }

  /**
   * Get all configuration
   */
  getAll(): Partial<EnvironmentConfig> {
    return { ...this.config };
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  /**
   * Check if running in staging
   */
  isStaging(): boolean {
    return this.config.NODE_ENV === 'staging';
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfig(): {
    isProduction: boolean;
    isDevelopment: boolean;
    isStaging: boolean;
    environment: string;
    debugMode: boolean;
    enableLogging: boolean;
  } {
    return {
      isProduction: this.isProduction(),
      isDevelopment: this.isDevelopment(),
      isStaging: this.isStaging(),
      environment: this.config.NODE_ENV || 'development',
      debugMode: this.config.LOG_LEVEL === 'debug',
      enableLogging: this.config.LOG_LEVEL !== 'error'
    };
  }

  /**
   * Generate environment configuration report
   */
  generateReport(): {
    environment: string;
    validation: EnvironmentValidationResult;
    security: {
      hasSecrets: boolean;
      hasPlaceholders: boolean;
      isSecure: boolean;
    };
    features: {
      realApiCalls: boolean;
      mockData: boolean;
      priceUpdates: boolean;
      paperTrading: boolean;
    };
    performance: {
      updateInterval: number;
      cacheTTL: number;
      logLevel: string;
    };
  } {
    const validation = this.validateConfig();
    
    return {
      environment: this.config.NODE_ENV || 'development',
      validation,
      security: {
        hasSecrets: !!(this.config.JWT_SECRET && this.config.SESSION_SECRET),
        hasPlaceholders: !!(
          this.config.PUBLIC_SUPABASE_URL?.includes('placeholder') ||
          this.config.PUBLIC_SUPABASE_ANON_KEY?.includes('placeholder')
        ),
        isSecure: !validation.warnings.some(w => w.includes('placeholder'))
      },
      features: {
        realApiCalls: this.config.ENABLE_REAL_API_CALLS || false,
        mockData: this.config.MOCK_DATA_ENABLED || false,
        priceUpdates: this.config.ENABLE_PRICE_UPDATES || false,
        paperTrading: this.config.PAPER_TRADING_ONLY || false
      },
      performance: {
        updateInterval: this.config.UPDATE_INTERVAL_MS || 5000,
        cacheTTL: this.config.CACHE_TTL || 300000,
        logLevel: this.config.LOG_LEVEL || 'info'
      }
    };
  }

  /**
   * Update configuration (for testing)
   */
  updateConfig(updates: Partial<EnvironmentConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Reset configuration to defaults
   */
  resetConfig(): void {
    this.loadConfig();
  }
}

// Export singleton instance
export const environmentConfigService = new EnvironmentConfigService();

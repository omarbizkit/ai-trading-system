/**
 * T068: Zeabur Deployment Settings and Domain Configuration
 * Configure Zeabur deployment settings and domain configuration
 */

export interface ZeaburDeploymentConfig {
  projectId: string;
  serviceId: string;
  environment: 'production' | 'staging' | 'development';
  domain: {
    primary: string;
    aliases: string[];
    ssl: boolean;
    customDomain: boolean;
  };
  build: {
    framework: string;
    buildCommand: string;
    outputDirectory: string;
    nodeVersion: string;
    installCommand: string;
  };
  runtime: {
    startCommand: string;
    port: number;
    healthCheckPath: string;
    regions: string[];
  };
  scaling: {
    minInstances: number;
    maxInstances: number;
    cpuLimit: string;
    memoryLimit: string;
  };
  monitoring: {
    enabled: boolean;
    alertsEnabled: boolean;
    logRetentionDays: number;
  };
}

export interface DeploymentStatus {
  status: 'building' | 'deploying' | 'running' | 'failed' | 'stopped';
  version: string;
  deployedAt: string;
  buildTime: number;
  health: 'healthy' | 'unhealthy' | 'unknown';
  url: string;
  commit: string;
  branch: string;
  logs: DeploymentLog[];
}

export interface DeploymentLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: 'build' | 'runtime' | 'system';
}

export interface DomainValidation {
  domain: string;
  isValid: boolean;
  dnsConfigured: boolean;
  sslValid: boolean;
  errors: string[];
  recommendations: string[];
}

export class ZeaburDeploymentService {
  private config: ZeaburDeploymentConfig;

  constructor() {
    this.config = this.loadZeaburConfig();
  }

  private loadZeaburConfig(): ZeaburDeploymentConfig {
    const env = import.meta.env;
    const isProduction = env.NODE_ENV === 'production';

    return {
      projectId: env.ZEABUR_PROJECT_ID || '',
      serviceId: env.ZEABUR_SERVICE_ID || '',
      environment: isProduction ? 'production' : env.NODE_ENV === 'staging' ? 'staging' : 'development',
      domain: {
        primary: isProduction ? 'ai-trading.bizkit.dev' : 'ai-trading-staging.bizkit.dev',
        aliases: ['www.ai-trading.bizkit.dev'],
        ssl: true,
        customDomain: true,
      },
      build: {
        framework: 'astro',
        buildCommand: 'npm run build',
        outputDirectory: 'dist',
        nodeVersion: '18',
        installCommand: 'npm ci',
      },
      runtime: {
        startCommand: 'node ./dist/server/entry.mjs',
        port: parseInt(env.PORT || '4321'),
        healthCheckPath: '/api/health',
        regions: ['hkg1'], // Hong Kong region for better performance in Asia
      },
      scaling: {
        minInstances: isProduction ? 1 : 0,
        maxInstances: isProduction ? 3 : 1,
        cpuLimit: isProduction ? '1000m' : '500m',
        memoryLimit: isProduction ? '512Mi' : '256Mi',
      },
      monitoring: {
        enabled: true,
        alertsEnabled: isProduction,
        logRetentionDays: isProduction ? 30 : 7,
      },
    };
  }

  async validateDeploymentConfig(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Validate basic configuration
    if (!this.config.projectId) {
      errors.push('ZEABUR_PROJECT_ID is required for deployment');
    }

    if (!this.config.serviceId) {
      errors.push('ZEABUR_SERVICE_ID is required for deployment');
    }

    // Validate build configuration
    if (!this.config.build.buildCommand) {
      errors.push('Build command is required');
    }

    if (!this.config.build.outputDirectory) {
      errors.push('Output directory is required');
    }

    // Validate runtime configuration
    if (!this.config.runtime.startCommand) {
      errors.push('Start command is required');
    }

    if (this.config.runtime.port < 1 || this.config.runtime.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }

    // Domain validation
    const domainValidation = await this.validateDomain(this.config.domain.primary);
    if (!domainValidation.isValid) {
      errors.push(...domainValidation.errors);
    }

    // Production-specific validations
    if (this.config.environment === 'production') {
      if (this.config.scaling.minInstances < 1) {
        warnings.push('Consider setting minimum instances >= 1 for production');
      }

      if (!this.config.domain.ssl) {
        errors.push('SSL is required for production deployment');
      }

      if (!this.config.monitoring.alertsEnabled) {
        warnings.push('Consider enabling alerts for production monitoring');
      }

      if (this.config.scaling.memoryLimit === '256Mi') {
        recommendations.push('Consider increasing memory limit for production workloads');
      }
    }

    // Node.js version check
    const nodeVersion = parseInt(this.config.build.nodeVersion);
    if (nodeVersion < 18) {
      if (this.config.environment === 'production') {
        errors.push('Node.js 18+ is required for production deployment');
      } else {
        warnings.push('Node.js 18+ is recommended');
      }
    }

    // Health check validation
    if (!this.config.runtime.healthCheckPath.startsWith('/')) {
      errors.push('Health check path must start with /');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations,
    };
  }

  async validateDomain(domain: string): Promise<DomainValidation> {
    const errors: string[] = [];
    const recommendations: string[] = [];

    // Basic domain format validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      errors.push('Invalid domain format');
    }

    // DNS and SSL checks (mock implementation - in real scenario would use actual DNS/SSL checking)
    const dnsConfigured = await this.checkDNSConfiguration(domain);
    const sslValid = await this.checkSSLCertificate(domain);

    if (!dnsConfigured && this.config.environment === 'production') {
      errors.push('DNS configuration is required for custom domain');
      recommendations.push('Configure CNAME record pointing to Zeabur deployment');
    }

    if (!sslValid && this.config.domain.ssl) {
      errors.push('SSL certificate validation failed');
      recommendations.push('Ensure SSL certificate is properly configured');
    }

    // Additional domain recommendations
    if (domain.includes('www.') && !this.config.domain.aliases.includes(domain.replace('www.', ''))) {
      recommendations.push('Consider adding non-www alias for better SEO');
    }

    if (this.config.environment === 'production' && !domain.includes('bizkit.dev')) {
      recommendations.push('Consider using bizkit.dev domain for brand consistency');
    }

    return {
      domain,
      isValid: errors.length === 0,
      dnsConfigured,
      sslValid,
      errors,
      recommendations,
    };
  }

  private async checkDNSConfiguration(domain: string): Promise<boolean> {
    try {
      // Mock DNS check - in real implementation would use DNS lookup
      // For now, assume DNS is configured for bizkit.dev domains
      return domain.includes('bizkit.dev');
    } catch (error) {
      return false;
    }
  }

  private async checkSSLCertificate(domain: string): Promise<boolean> {
    try {
      // Mock SSL check - in real implementation would verify certificate
      // For now, assume SSL is valid for HTTPS domains
      return this.config.domain.ssl;
    } catch (error) {
      return false;
    }
  }

  generateZeaburConfig(): string {
    const config = {
      name: 'ai-trading-system',
      type: 'nodejs',
      framework: this.config.build.framework,
      buildCommand: this.config.build.buildCommand,
      installCommand: this.config.build.installCommand,
      startCommand: this.config.runtime.startCommand,
      outputDirectory: this.config.build.outputDirectory,
      nodeVersion: this.config.build.nodeVersion,
      environmentVariables: this.getEnvironmentVariables(),
      domains: [
        {
          domain: this.config.domain.primary,
          ssl: this.config.domain.ssl,
        },
        ...this.config.domain.aliases.map(alias => ({
          domain: alias,
          ssl: this.config.domain.ssl,
        })),
      ],
      scaling: {
        minReplicas: this.config.scaling.minInstances,
        maxReplicas: this.config.scaling.maxInstances,
        resources: {
          cpu: this.config.scaling.cpuLimit,
          memory: this.config.scaling.memoryLimit,
        },
      },
      healthCheck: {
        path: this.config.runtime.healthCheckPath,
        port: this.config.runtime.port,
        initialDelaySeconds: 30,
        periodSeconds: 10,
      },
      regions: this.config.runtime.regions,
    };

    return JSON.stringify(config, null, 2);
  }

  private getEnvironmentVariables(): Record<string, string> {
    const env = import.meta.env;
    const isProduction = this.config.environment === 'production';

    const baseVars = {
      NODE_ENV: this.config.environment,
      PORT: this.config.runtime.port.toString(),
      HOST: '0.0.0.0',
      PUBLIC_APP_URL: `https://${this.config.domain.primary}`,
      PUBLIC_PORTFOLIO_URL: env.PUBLIC_PORTFOLIO_URL || 'https://bizkit.dev',
    };

    if (isProduction) {
      return {
        ...baseVars,
        PUBLIC_SUPABASE_URL: env.PUBLIC_SUPABASE_URL || '',
        PUBLIC_SUPABASE_ANON_KEY: env.PUBLIC_SUPABASE_ANON_KEY || '',
        SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY || '',
        JWT_SECRET: env.JWT_SECRET || '',
        SESSION_SECRET: env.SESSION_SECRET || '',
        CORS_ORIGIN: `https://${this.config.domain.primary},https://bizkit.dev`,
        ENABLE_REAL_API_CALLS: 'true',
        MOCK_DATA_ENABLED: 'false',
        LOG_LEVEL: 'warn',
        ENABLE_DEBUG_LOGS: 'false',
      };
    }

    return baseVars;
  }

  async getDeploymentStatus(): Promise<DeploymentStatus> {
    // Mock implementation - in real scenario would call Zeabur API
    return {
      status: 'running',
      version: '1.0.0',
      deployedAt: new Date().toISOString(),
      buildTime: 120000, // 2 minutes
      health: 'healthy',
      url: `https://${this.config.domain.primary}`,
      commit: 'abc123def456',
      branch: 'main',
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Deployment started',
          source: 'system',
        },
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Build completed successfully',
          source: 'build',
        },
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'Application started',
          source: 'runtime',
        },
      ],
    };
  }

  getConfig(): ZeaburDeploymentConfig {
    return { ...this.config };
  }

  // Generate deployment instructions
  getDeploymentInstructions(): string[] {
    return [
      '1. Ensure all environment variables are configured in Zeabur dashboard',
      '2. Set up custom domain DNS (CNAME record)',
      '3. Configure SSL certificate for custom domain',
      '4. Enable monitoring and alerts',
      '5. Set up automatic deployments from GitHub',
      '6. Configure scaling rules based on traffic',
      '7. Set up backup and recovery procedures',
      '8. Test health check endpoints',
      '9. Verify all features work in production environment',
      '10. Monitor application performance and logs',
    ];
  }
}

// Global instance
export const zeaburDeployment = new ZeaburDeploymentService();
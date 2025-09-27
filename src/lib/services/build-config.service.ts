/**
 * Build Configuration Service
 * 
 * Service for managing build process configuration and performance tracking
 * during the production readiness phase.
 */

import type { 
  BuildConfiguration, 
  BuildStatus, 
  Environment 
} from '../types/build-config';

export class BuildConfigService {
  private buildConfigs: Map<string, BuildConfiguration> = new Map();
  private buildHistory: Map<string, BuildConfiguration[]> = new Map();

  constructor() {
    this.initializeDefaultConfigurations();
  }

  /**
   * Initialize default build configurations for monitoring
   */
  private initializeDefaultConfigurations(): void {
    const environments: Environment[] = ['development', 'staging', 'production'];
    
    environments.forEach(env => {
      const id = this.generateBuildConfigId(env);
      const buildConfig: BuildConfiguration = {
        id,
        environment: env,
        node_version: process.version,
        typescript_version: this.getTypeScriptVersion(),
        astro_version: this.getAstroVersion(),
        build_command: this.getBuildCommand(env),
        build_status: 'pending',
        error_count: 0,
        warning_count: 0,
        created_at: new Date()
      };
      
      this.buildConfigs.set(id, buildConfig);
      this.buildHistory.set(id, []);
    });
  }

  /**
   * Start a new build process
   */
  async startBuild(
    environment: Environment = 'development',
    customBuildCommand?: string
  ): Promise<BuildConfiguration> {
    const id = this.generateBuildConfigId(environment);
    const existingConfig = this.buildConfigs.get(id);
    
    if (!existingConfig) {
      throw new Error(`Build configuration not found for environment: ${environment}`);
    }

    const startTime = Date.now();
    const buildCommand = customBuildCommand || existingConfig.build_command;
    
    // Update build status to building
    const buildingConfig: BuildConfiguration = {
      ...existingConfig,
      build_command: buildCommand,
      build_status: 'building',
      created_at: new Date()
    };

    this.buildConfigs.set(id, buildingConfig);
    this.addToHistory(id, buildingConfig);

    try {
      // Execute the build process
      const buildResult = await this.executeBuild(buildCommand, environment);
      
      const buildTime = (Date.now() - startTime) / 1000; // Convert to seconds
      
      const completedConfig: BuildConfiguration = {
        ...buildingConfig,
        build_status: buildResult.success ? 'success' : 'failed',
        build_time: buildTime,
        bundle_size: buildResult.bundleSize,
        error_count: buildResult.errorCount,
        warning_count: buildResult.warningCount,
        completed_at: new Date(),
        error_log: buildResult.errorLog
      };

      this.buildConfigs.set(id, completedConfig);
      this.addToHistory(id, completedConfig);

      return completedConfig;

    } catch (error) {
      const buildTime = (Date.now() - startTime) / 1000;
      const errorMessage = error instanceof Error ? error.message : 'Unknown build error';
      
      const failedConfig: BuildConfiguration = {
        ...buildingConfig,
        build_status: 'failed',
        build_time: buildTime,
        error_count: 1,
        completed_at: new Date(),
        error_log: errorMessage
      };

      this.buildConfigs.set(id, failedConfig);
      this.addToHistory(id, failedConfig);

      return failedConfig;
    }
  }

  /**
   * Execute the build process
   */
  private async executeBuild(
    buildCommand: string, 
    environment: Environment
  ): Promise<{
    success: boolean;
    bundleSize?: number;
    errorCount: number;
    warningCount: number;
    errorLog?: string;
  }> {
    try {
      // Set environment variables for the build
      const env = {
        ...process.env,
        NODE_ENV: environment === 'production' ? 'production' : 'development',
        ASTRO_ENV: environment
      };

      // Execute build command using child process
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout, stderr } = await execAsync(buildCommand, { 
        env,
        timeout: 300000 // 5 minute timeout
      });

      // Parse build output for errors and warnings
      const errorCount = this.countErrors(stderr);
      const warningCount = this.countWarnings(stderr);
      
      // Calculate bundle size if build was successful
      let bundleSize: number | undefined;
      if (errorCount === 0) {
        bundleSize = await this.calculateBundleSize();
      }

      return {
        success: errorCount === 0,
        bundleSize,
        errorCount,
        warningCount,
        errorLog: stderr || undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown build error';
      
      return {
        success: false,
        errorCount: 1,
        warningCount: 0,
        errorLog: errorMessage
      };
    }
  }

  /**
   * Count errors in build output
   */
  private countErrors(output: string): number {
    const errorPatterns = [
      /error\s+ts\(\d+\):/gi,
      /error:/gi,
      /ERROR:/gi,
      /failed/gi,
      /Error:/gi
    ];
    
    let errorCount = 0;
    errorPatterns.forEach(pattern => {
      const matches = output.match(pattern);
      if (matches) {
        errorCount += matches.length;
      }
    });
    
    return errorCount;
  }

  /**
   * Count warnings in build output
   */
  private countWarnings(output: string): number {
    const warningPatterns = [
      /warning\s+ts\(\d+\):/gi,
      /warning:/gi,
      /WARNING:/gi,
      /Warning:/gi
    ];
    
    let warningCount = 0;
    warningPatterns.forEach(pattern => {
      const matches = output.match(pattern);
      if (matches) {
        warningCount += matches.length;
      }
    });
    
    return warningCount;
  }

  /**
   * Calculate bundle size
   */
  private async calculateBundleSize(): Promise<number> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const distPath = path.join(process.cwd(), 'dist');
      if (!fs.existsSync(distPath)) {
        return 0;
      }

      const getDirectorySize = (dirPath: string): number => {
        let totalSize = 0;
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            totalSize += getDirectorySize(filePath);
          } else {
            totalSize += stats.size;
          }
        }
        
        return totalSize;
      };

      return getDirectorySize(distPath);
    } catch (error) {
      console.warn('Failed to calculate bundle size:', error);
      return 0;
    }
  }

  /**
   * Get build configuration by environment
   */
  getBuildConfig(environment: Environment): BuildConfiguration | undefined {
    const id = this.generateBuildConfigId(environment);
    return this.buildConfigs.get(id);
  }

  /**
   * Get all build configurations with optional filtering
   */
  getBuildConfigs(filters?: {
    environment?: Environment;
    buildStatus?: BuildStatus;
  }): BuildConfiguration[] {
    let filteredConfigs = Array.from(this.buildConfigs.values());

    if (filters) {
      if (filters.environment) {
        filteredConfigs = filteredConfigs.filter(config => 
          config.environment === filters.environment
        );
      }
      if (filters.buildStatus) {
        filteredConfigs = filteredConfigs.filter(config => 
          config.build_status === filters.buildStatus
        );
      }
    }

    return filteredConfigs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
  }

  /**
   * Get build history for an environment
   */
  getBuildHistory(environment: Environment): BuildConfiguration[] {
    const id = this.generateBuildConfigId(environment);
    return this.buildHistory.get(id) || [];
  }

  /**
   * Get build statistics
   */
  getBuildStatistics(): {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    building: number;
    averageBuildTime: number;
    averageBundleSize: number;
    totalErrors: number;
    totalWarnings: number;
  } {
    const configs = Array.from(this.buildConfigs.values());
    const total = configs.length;
    
    const successful = configs.filter(config => config.build_status === 'success').length;
    const failed = configs.filter(config => config.build_status === 'failed').length;
    const pending = configs.filter(config => config.build_status === 'pending').length;
    const building = configs.filter(config => config.build_status === 'building').length;
    
    const buildTimes = configs
      .filter(config => config.build_time !== undefined)
      .map(config => config.build_time!);
    
    const averageBuildTime = buildTimes.length > 0 
      ? buildTimes.reduce((sum, time) => sum + time, 0) / buildTimes.length 
      : 0;
    
    const bundleSizes = configs
      .filter(config => config.bundle_size !== undefined)
      .map(config => config.bundle_size!);
    
    const averageBundleSize = bundleSizes.length > 0 
      ? bundleSizes.reduce((sum, size) => sum + size, 0) / bundleSizes.length 
      : 0;
    
    const totalErrors = configs.reduce((sum, config) => sum + config.error_count, 0);
    const totalWarnings = configs.reduce((sum, config) => sum + config.warning_count, 0);

    return {
      total,
      successful,
      failed,
      pending,
      building,
      averageBuildTime,
      averageBundleSize,
      totalErrors,
      totalWarnings
    };
  }

  /**
   * Get failed builds that need attention
   */
  getFailedBuilds(): BuildConfiguration[] {
    return this.getBuildConfigs({
      buildStatus: 'failed'
    });
  }

  /**
   * Get TypeScript version from package.json
   */
  private getTypeScriptVersion(): string {
    try {
      const packageJson = require('../../package.json');
      return packageJson.devDependencies?.typescript || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get Astro version from package.json
   */
  private getAstroVersion(): string {
    try {
      const packageJson = require('../../package.json');
      return packageJson.dependencies?.astro || packageJson.devDependencies?.astro || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get build command for environment
   */
  private getBuildCommand(environment: Environment): string {
    switch (environment) {
      case 'production':
        return 'npm run build';
      case 'staging':
        return 'npm run build:staging';
      case 'development':
        return 'npm run build:dev';
      default:
        return 'npm run build';
    }
  }

  /**
   * Generate unique build configuration ID
   */
  private generateBuildConfigId(environment: Environment): string {
    const base = `build:${environment}`;
    return Buffer.from(base).toString('base64').replace(/[+/=]/g, '').substring(0, 16);
  }

  /**
   * Add build configuration to history
   */
  private addToHistory(id: string, buildConfig: BuildConfiguration): void {
    const history = this.buildHistory.get(id) || [];
    history.push(buildConfig);
    
    // Keep only last 20 builds to prevent memory issues
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
    
    this.buildHistory.set(id, history);
  }

  /**
   * Export build configurations to JSON for debugging
   */
  exportBuildConfigs(): string {
    const configsArray = Array.from(this.buildConfigs.values());
    return JSON.stringify(configsArray, null, 2);
  }

  /**
   * Clear all build configurations (for testing or reset)
   */
  clearAllBuildConfigs(): void {
    this.buildConfigs.clear();
    this.buildHistory.clear();
    this.initializeDefaultConfigurations();
  }

  /**
   * Cancel a running build
   */
  cancelBuild(environment: Environment): boolean {
    const id = this.generateBuildConfigId(environment);
    const buildConfig = this.buildConfigs.get(id);
    
    if (!buildConfig || buildConfig.build_status !== 'building') {
      return false;
    }

    const cancelledConfig: BuildConfiguration = {
      ...buildConfig,
      build_status: 'cancelled',
      completed_at: new Date()
    };

    this.buildConfigs.set(id, cancelledConfig);
    this.addToHistory(id, cancelledConfig);
    
    return true;
  }
}

// Export singleton instance
export const buildConfigService = new BuildConfigService();

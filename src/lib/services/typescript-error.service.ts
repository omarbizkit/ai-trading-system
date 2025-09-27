/**
 * TypeScript Error Service
 * 
 * Service for tracking, categorizing, and managing TypeScript compilation errors
 * during the production readiness phase.
 */

import type { 
  TypeScriptError, 
  ErrorCategory, 
  ErrorSeverity, 
  ErrorStatus 
} from '../types/typescript-error';

export class TypeScriptErrorService {
  private errors: Map<string, TypeScriptError> = new Map();
  private errorCounts: Map<ErrorCategory, number> = new Map();
  private severityCounts: Map<ErrorSeverity, number> = new Map();

  constructor() {
    this.initializeCounters();
  }

  /**
   * Initialize error category and severity counters
   */
  private initializeCounters(): void {
    const categories: ErrorCategory[] = [
      'type_mismatch',
      'implicit_any', 
      'missing_types',
      'property_violation',
      'import_export',
      'strict_mode'
    ];

    const severities: ErrorSeverity[] = [
      'critical',
      'high',
      'medium', 
      'low'
    ];

    categories.forEach(category => {
      this.errorCounts.set(category, 0);
    });

    severities.forEach(severity => {
      this.severityCounts.set(severity, 0);
    });
  }

  /**
   * Add a new TypeScript error to tracking
   */
  addError(error: Omit<TypeScriptError, 'id' | 'created_at'>): TypeScriptError {
    const id = this.generateErrorId(error);
    const now = new Date();
    
    const newError: TypeScriptError = {
      ...error,
      id,
      created_at: now
    };

    this.errors.set(id, newError);
    this.updateCounters(newError);
    
    return newError;
  }

  /**
   * Get all errors with optional filtering
   */
  getErrors(filters?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    status?: ErrorStatus;
    filePath?: string;
  }): TypeScriptError[] {
    let filteredErrors = Array.from(this.errors.values());

    if (filters) {
      if (filters.category) {
        filteredErrors = filteredErrors.filter(error => error.category === filters.category);
      }
      if (filters.severity) {
        filteredErrors = filteredErrors.filter(error => error.severity === filters.severity);
      }
      if (filters.status) {
        filteredErrors = filteredErrors.filter(error => error.status === filters.status);
      }
      if (filters.filePath) {
        filteredErrors = filteredErrors.filter(error => error.file_path.includes(filters.filePath!));
      }
    }

    return filteredErrors.sort((a, b) => {
      // Sort by severity first, then by line number
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.line_number - b.line_number;
    });
  }

  /**
   * Get error by ID
   */
  getErrorById(id: string): TypeScriptError | undefined {
    return this.errors.get(id);
  }

  /**
   * Update error status and resolution notes
   */
  updateErrorStatus(
    id: string, 
    status: ErrorStatus, 
    resolutionNotes?: string
  ): boolean {
    const error = this.errors.get(id);
    if (!error) return false;

    const updatedError: TypeScriptError = {
      ...error,
      status,
      resolution_notes: resolutionNotes,
      resolved_at: status === 'resolved' ? new Date() : undefined
    };

    this.errors.set(id, updatedError);
    this.updateCounters(updatedError);
    
    return true;
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    byStatus: Record<ErrorStatus, number>;
    resolvedCount: number;
    unresolvedCount: number;
  } {
    const total = this.errors.size;
    const byCategory: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>;
    const bySeverity: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;
    const byStatus: Record<ErrorStatus, number> = {
      identified: 0,
      in_progress: 0,
      resolved: 0,
      deferred: 0
    };

    // Initialize counters
    this.errorCounts.forEach((count, category) => {
      byCategory[category] = count;
    });

    this.severityCounts.forEach((count, severity) => {
      bySeverity[severity] = count;
    });

    // Count by status
    this.errors.forEach(error => {
      byStatus[error.status]++;
    });

    const resolvedCount = byStatus.resolved;
    const unresolvedCount = total - resolvedCount;

    return {
      total,
      byCategory,
      bySeverity,
      byStatus,
      resolvedCount,
      unresolvedCount
    };
  }

  /**
   * Get errors that need immediate attention (critical/high severity, unresolved)
   */
  getCriticalErrors(): TypeScriptError[] {
    return this.getErrors({
      severity: 'critical'
    }).filter(error => error.status !== 'resolved');
  }

  /**
   * Get errors by file path
   */
  getErrorsByFile(filePath: string): TypeScriptError[] {
    return this.getErrors({ filePath });
  }

  /**
   * Clear all errors (for testing or reset)
   */
  clearAllErrors(): void {
    this.errors.clear();
    this.initializeCounters();
  }

  /**
   * Export errors to JSON for debugging
   */
  exportErrors(): string {
    const errorsArray = Array.from(this.errors.values());
    return JSON.stringify(errorsArray, null, 2);
  }

  /**
   * Generate unique error ID based on error properties
   */
  private generateErrorId(error: Omit<TypeScriptError, 'id' | 'created_at'>): string {
    const base = `${error.file_path}:${error.line_number}:${error.column_number}:${error.error_code}`;
    return Buffer.from(base).toString('base64').replace(/[+/=]/g, '').substring(0, 16);
  }

  /**
   * Update internal counters when error is added or updated
   */
  private updateCounters(error: TypeScriptError): void {
    // Update category counter
    const currentCategoryCount = this.errorCounts.get(error.category) || 0;
    this.errorCounts.set(error.category, currentCategoryCount + 1);

    // Update severity counter  
    const currentSeverityCount = this.severityCounts.get(error.severity) || 0;
    this.severityCounts.set(error.severity, currentSeverityCount + 1);
  }

  /**
   * Parse TypeScript compiler output and extract errors
   */
  parseTypeScriptOutput(compilerOutput: string): TypeScriptError[] {
    const errors: TypeScriptError[] = [];
    const lines = compilerOutput.split('\n');

    for (const line of lines) {
      const errorMatch = line.match(/^(.+):(\d+):(\d+)\s*-\s*error\s*ts\((\d+)\):\s*(.+)$/);
      
      if (errorMatch) {
        const [, filePath, lineNumber, columnNumber, errorCode, errorMessage] = errorMatch;
        
        const category = this.categorizeError(errorCode, errorMessage);
        const severity = this.determineSeverity(errorCode, errorMessage);
        
        const error: Omit<TypeScriptError, 'id' | 'created_at'> = {
          file_path: filePath.trim(),
          line_number: parseInt(lineNumber, 10),
          column_number: parseInt(columnNumber, 10),
          error_code: `ts${errorCode}`,
          error_message: errorMessage.trim(),
          category,
          severity,
          status: 'identified'
        };

        errors.push(this.addError(error));
      }
    }

    return errors;
  }

  /**
   * Categorize error based on error code and message
   */
  private categorizeError(errorCode: string, message: string): ErrorCategory {
    const code = parseInt(errorCode, 10);
    
    // Type mismatch errors
    if ([2322, 2339, 2345, 2352, 2353].includes(code)) {
      return 'type_mismatch';
    }
    
    // Implicit any errors
    if ([7006, 7005, 7008].includes(code)) {
      return 'implicit_any';
    }
    
    // Missing type errors
    if ([2304, 2307, 2308, 2314].includes(code)) {
      return 'missing_types';
    }
    
    // Property violation errors
    if ([2339, 2345, 2352].includes(code) && message.includes('Property')) {
      return 'property_violation';
    }
    
    // Import/export errors
    if ([2307, 2308, 2314, 1451, 1452].includes(code)) {
      return 'import_export';
    }
    
    // Strict mode errors
    if ([2375, 2377, 2378, 2379].includes(code)) {
      return 'strict_mode';
    }
    
    return 'type_mismatch'; // Default fallback
  }

  /**
   * Determine error severity based on error code and message
   */
  private determineSeverity(errorCode: string, message: string): ErrorSeverity {
    const code = parseInt(errorCode, 10);
    
    // Critical errors that block compilation
    if ([2307, 2308, 2314, 1451, 1452].includes(code)) {
      return 'critical';
    }
    
    // High severity errors that affect core functionality
    if ([2322, 2339, 2345, 2352, 2353].includes(code)) {
      return 'high';
    }
    
    // Medium severity errors that affect developer experience
    if ([7006, 7005, 7008, 2375, 2377].includes(code)) {
      return 'medium';
    }
    
    // Low severity warnings and suggestions
    if ([6133, 6138, 6139, 6140].includes(code)) {
      return 'low';
    }
    
    return 'medium'; // Default fallback
  }
}

// Export singleton instance
export const typescriptErrorService = new TypeScriptErrorService();

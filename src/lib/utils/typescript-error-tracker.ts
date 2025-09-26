/**
 * T002: TypeScript Error Tracking System
 * System for categorizing, tracking, and managing TypeScript compilation errors
 */

export interface TypeScriptError {
  id: string;
  file_path: string;
  line_number: number;
  column_number: number;
  error_code: string;
  error_message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  status: ErrorStatus;
  resolution_notes?: string;
  created_at: Date;
  resolved_at?: Date;
}

export enum ErrorCategory {
  TYPE_MISMATCH = "type_mismatch",
  IMPLICIT_ANY = "implicit_any", 
  MISSING_TYPES = "missing_types",
  PROPERTY_VIOLATION = "property_violation",
  IMPORT_EXPORT = "import_export",
  STRICT_MODE = "strict_mode"
}

export enum ErrorSeverity {
  CRITICAL = "critical",    // Blocks build
  HIGH = "high",           // Core functionality impact
  MEDIUM = "medium",       // Non-critical features
  LOW = "low"              // Developer experience
}

export enum ErrorStatus {
  IDENTIFIED = "identified",
  IN_PROGRESS = "in_progress", 
  RESOLVED = "resolved",
  DEFERRED = "deferred"
}

export class TypeScriptErrorTracker {
  private errors: Map<string, TypeScriptError> = new Map();

  /**
   * Parse TypeScript compiler output and extract errors
   */
  parseTypeScriptOutput(output: string): TypeScriptError[] {
    const errorLines = output.split('\n').filter(line => 
      line.includes(' - error') && line.includes('ts(')
    );

    const errors: TypeScriptError[] = [];

    for (const line of errorLines) {
      const error = this.parseErrorLine(line);
      if (error) {
        errors.push(error);
        this.addError(error);
      }
    }

    return errors;
  }

  /**
   * Parse individual error line from TypeScript output
   */
  private parseErrorLine(line: string): TypeScriptError | null {
    // Pattern: file.ts:line:column - error ts(code): message
    const match = line.match(/^(.+?):(\d+):(\d+) - error ts\((\d+)\): (.+)$/);
    
    if (!match) return null;

    const [, filePath, lineStr, columnStr, errorCode, message] = match;
    const lineNumber = parseInt(lineStr);
    const columnNumber = parseInt(columnStr);

    const id = `${filePath}:${lineNumber}:${columnNumber}:${errorCode}`;
    
    return {
      id,
      file_path: filePath,
      line_number: lineNumber,
      column_number: columnNumber,
      error_code: `ts${errorCode}`,
      error_message: message.trim(),
      category: this.categorizeError(errorCode, message),
      severity: this.determineSeverity(errorCode, message),
      status: ErrorStatus.IDENTIFIED,
      created_at: new Date()
    };
  }

  /**
   * Categorize error based on TypeScript error code and message
   */
  private categorizeError(errorCode: string, message: string): ErrorCategory {
    const code = parseInt(errorCode);

    // Type mismatch errors
    if ([2375, 2322, 2345, 2362, 2363].includes(code)) {
      return ErrorCategory.TYPE_MISMATCH;
    }

    // Implicit any types
    if ([7006, 7005, 7053].includes(code)) {
      return ErrorCategory.IMPLICIT_ANY;
    }

    // Property violations
    if ([2339, 2353, 2322].includes(code)) {
      return ErrorCategory.PROPERTY_VIOLATION;
    }

    // Import/export issues
    if ([1484, 2305, 2307].includes(code)) {
      return ErrorCategory.IMPORT_EXPORT;
    }

    // Strict mode violations
    if ([18048, 2345, 2532].includes(code)) {
      return ErrorCategory.STRICT_MODE;
    }

    return ErrorCategory.MISSING_TYPES;
  }

  /**
   * Determine error severity based on impact
   */
  private determineSeverity(errorCode: string, message: string): ErrorSeverity {
    const code = parseInt(errorCode);

    // Critical - blocks build or core functionality
    if ([2375, 2322, 2362, 2363].includes(code)) {
      return ErrorSeverity.CRITICAL;
    }

    // High - type safety violations
    if ([2339, 2353, 7006, 7005].includes(code)) {
      return ErrorSeverity.HIGH;
    }

    // Medium - code quality issues  
    if ([6133, 6196, 18048].includes(code)) {
      return ErrorSeverity.MEDIUM;
    }

    // Low - developer experience
    return ErrorSeverity.LOW;
  }

  /**
   * Add error to tracking system
   */
  addError(error: TypeScriptError): void {
    this.errors.set(error.id, error);
  }

  /**
   * Update error status and add resolution notes
   */
  updateError(id: string, status: ErrorStatus, notes?: string): boolean {
    const error = this.errors.get(id);
    if (!error) return false;

    error.status = status;
    if (notes) error.resolution_notes = notes;
    if (status === ErrorStatus.RESOLVED) {
      error.resolved_at = new Date();
    }

    return true;
  }

  /**
   * Get errors by category
   */
  getErrorsByCategory(category: ErrorCategory): TypeScriptError[] {
    return Array.from(this.errors.values()).filter(e => e.category === category);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ErrorSeverity): TypeScriptError[] {
    return Array.from(this.errors.values()).filter(e => e.severity === severity);
  }

  /**
   * Get errors by status
   */
  getErrorsByStatus(status: ErrorStatus): TypeScriptError[] {
    return Array.from(this.errors.values()).filter(e => e.status === status);
  }

  /**
   * Get summary statistics
   */
  getSummary() {
    const errors = Array.from(this.errors.values());
    
    return {
      total: errors.length,
      by_category: this.groupBy(errors, 'category'),
      by_severity: this.groupBy(errors, 'severity'),
      by_status: this.groupBy(errors, 'status'),
      critical_files: this.getCriticalFiles(errors)
    };
  }

  /**
   * Get files with the most critical errors
   */
  private getCriticalFiles(errors: TypeScriptError[]): Array<{file: string, count: number}> {
    const fileCounts = new Map<string, number>();
    
    errors
      .filter(e => e.severity === ErrorSeverity.CRITICAL)
      .forEach(e => {
        const count = fileCounts.get(e.file_path) || 0;
        fileCounts.set(e.file_path, count + 1);
      });

    return Array.from(fileCounts.entries())
      .map(([file, count]) => ({ file, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Group errors by property
   */
  private groupBy<T extends Record<string, any>>(
    items: T[], 
    key: keyof T
  ): Record<string, number> {
    return items.reduce((groups, item) => {
      const value = String(item[key]);
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  /**
   * Export errors for persistence or analysis
   */
  exportErrors(): TypeScriptError[] {
    return Array.from(this.errors.values());
  }

  /**
   * Import errors from previous analysis
   */
  importErrors(errors: TypeScriptError[]): void {
    errors.forEach(error => this.addError(error));
  }

  /**
   * Clear all tracked errors
   */
  clear(): void {
    this.errors.clear();
  }
}

// Global instance for use across the application
export const errorTracker = new TypeScriptErrorTracker();
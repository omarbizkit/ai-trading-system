/**
 * TypeScript Error Types
 * 
 * Type definitions for TypeScript error tracking and management
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
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low"
}

export enum ErrorStatus {
  IDENTIFIED = "identified",
  IN_PROGRESS = "in_progress",
  RESOLVED = "resolved",
  DEFERRED = "deferred"
}

/**
 * @fileoverview Base validator class for validation pipeline
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: Base class for all validators
 * Main APIs: BaseValidator abstract class
 * Constraints: Abstract validation methods
 * Patterns: Template method pattern
 */

import {
  ValidationContext,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  Validator,
} from './validation-pipeline';

export abstract class BaseValidator implements Validator {
  public readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract validate(context: ValidationContext): Promise<ValidationResult>;

  /**
   * Helper to create a successful validation result
   */
  protected static success(data?: unknown): ValidationResult {
    return {
      valid: true,
      errors: [],
      warnings: [],
      data: data ?? undefined,
    };
  }

  /**
   * Helper to create a failed validation result
   */
  protected static failure(errors: ValidationError[]): ValidationResult {
    return {
      valid: false,
      errors,
      warnings: [],
    };
  }

  /**
   * Helper to create an error
   */
  protected static error(
    message: string,
    path?: string,
    code?: string,
    context?: Record<string, unknown>
  ): ValidationError {
    return {
      path: path || '',
      message,
      code,
      context,
    };
  }

  /**
   * Helper to create a warning
   */
  protected static warning(
    message: string,
    path?: string,
    code?: string,
    context?: Record<string, unknown>
  ): ValidationWarning {
    return {
      path: path || '',
      message,
      code,
      context,
    };
  }
}

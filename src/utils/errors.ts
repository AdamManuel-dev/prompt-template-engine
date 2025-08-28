/* eslint-disable max-classes-per-file */
/**
 * @fileoverview Custom error classes for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T10:54:00Z
 *
 * Features: Structured error handling with error codes and context
 * Main APIs: TemplateEngineError, ConfigError, FileNotFoundError
 * Constraints: Extends built-in Error class for compatibility
 * Patterns: Error inheritance, error codes, structured error data
 */

/**
 * Base error class for all template engine errors
 */
export class TemplateEngineError extends Error {
  public readonly code: string;

  public readonly context?: Record<string, unknown>;

  public readonly timestamp: Date;

  constructor(
    message: string,
    context?: Record<string, unknown>,
    code: string = 'TEMPLATE_ENGINE_ERROR'
  ) {
    super(message);
    this.name = 'TemplateEngineError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();

    // Maintain proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TemplateEngineError);
    }
  }

  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * Create a user-friendly error message
   */
  toUserMessage(): string {
    return `${this.message}${this.context ? ` (${JSON.stringify(this.context)})` : ''}`;
  }
}

/**
 * Configuration-related errors
 */
export class ConfigError extends TemplateEngineError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    code: string = 'CONFIG_ERROR'
  ) {
    super(message, context, code);
    this.name = 'ConfigError';
  }
}

/**
 * File system related errors
 */
export class FileNotFoundError extends TemplateEngineError {
  public readonly filePath?: string;

  constructor(
    message: string,
    filePath?: string,
    context?: Record<string, unknown>,
    code: string = 'FILE_NOT_FOUND'
  ) {
    super(message, { ...context, filePath }, code);
    this.name = 'FileNotFoundError';
    this.filePath = filePath;
  }
}

/**
 * Template processing errors
 */
export class TemplateProcessingError extends TemplateEngineError {
  public readonly templatePath?: string;

  public readonly lineNumber?: number;

  public readonly columnNumber?: number;

  constructor(
    message: string,
    templatePath?: string,
    lineNumber?: number,
    columnNumber?: number,
    context?: Record<string, unknown>,
    code: string = 'TEMPLATE_PROCESSING_ERROR'
  ) {
    super(
      message,
      {
        ...context,
        templatePath,
        lineNumber,
        columnNumber,
      },
      code
    );
    this.name = 'TemplateProcessingError';
    this.templatePath = templatePath;
    this.lineNumber = lineNumber;
    this.columnNumber = columnNumber;
  }

  /**
   * Create a detailed error message with location information
   */
  override toUserMessage(): string {
    let { message } = this;

    if (this.templatePath) {
      message += ` in template: ${this.templatePath}`;
    }

    if (this.lineNumber !== undefined) {
      message += ` at line ${this.lineNumber}`;

      if (this.columnNumber !== undefined) {
        message += `, column ${this.columnNumber}`;
      }
    }

    return message;
  }
}

/**
 * Validation errors
 */
export class ValidationError extends TemplateEngineError {
  public readonly field?: string;

  public readonly value?: unknown;

  public readonly validationRule?: string;

  constructor(
    message: string,
    field?: string,
    value?: unknown,
    validationRule?: string,
    context?: Record<string, unknown>,
    code: string = 'VALIDATION_ERROR'
  ) {
    super(
      message,
      {
        ...context,
        field,
        value,
        validationRule,
      },
      code
    );
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
    this.validationRule = validationRule;
  }
}

/**
 * CLI-specific errors
 */
export class CLIError extends TemplateEngineError {
  public readonly exitCode: number;

  constructor(
    message: string,
    context?: Record<string, unknown>,
    code: string = 'CLI_ERROR',
    exitCode: number = 1
  ) {
    super(message, { ...context, exitCode }, code);
    this.name = 'CLIError';
    this.exitCode = exitCode;
  }
}

/**
 * Network/API related errors
 */
export class NetworkError extends TemplateEngineError {
  public readonly statusCode?: number;

  public readonly url?: string;

  constructor(
    message: string,
    statusCode?: number,
    url?: string,
    context?: Record<string, unknown>,
    code: string = 'NETWORK_ERROR'
  ) {
    super(
      message,
      {
        ...context,
        statusCode,
        url,
      },
      code
    );
    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.url = url;
  }
}

/**
 * Permission/access related errors
 */
export class PermissionError extends TemplateEngineError {
  public readonly action?: string;

  public readonly resource?: string;

  constructor(
    message: string,
    action?: string,
    resource?: string,
    context?: Record<string, unknown>,
    code: string = 'PERMISSION_ERROR'
  ) {
    super(
      message,
      {
        ...context,
        action,
        resource,
      },
      code
    );
    this.name = 'PermissionError';
    this.action = action;
    this.resource = resource;
  }
}

/**
 * Error utilities
 */
export class ErrorUtils {
  /**
   * Check if error is of a specific type
   */
  static isTemplateEngineError(error: unknown): error is TemplateEngineError {
    return error instanceof TemplateEngineError;
  }

  /**
   * Extract error code from any error
   */
  static getErrorCode(error: unknown): string {
    if (ErrorUtils.isTemplateEngineError(error)) {
      return error.code;
    }
    return 'UNKNOWN_ERROR';
  }

  /**
   * Create error from unknown value
   */
  static fromUnknown(
    error: unknown,
    defaultMessage: string = 'Unknown error occurred'
  ): TemplateEngineError {
    if (error instanceof TemplateEngineError) {
      return error;
    }

    if (error instanceof Error) {
      return new TemplateEngineError(
        error.message,
        {
          originalName: error.name,
          originalStack: error.stack,
        },
        'WRAPPED_ERROR'
      );
    }

    if (typeof error === 'string') {
      return new TemplateEngineError(error, undefined, 'STRING_ERROR');
    }

    return new TemplateEngineError(
      defaultMessage,
      {
        originalValue: error,
      },
      'UNKNOWN_ERROR'
    );
  }

  /**
   * Log error with appropriate level
   */
  static logError(
    error: unknown,
    logger?: { error: (msg: string) => void; debug: (msg: string) => void }
  ): void {
    if (!logger) return;

    if (ErrorUtils.isTemplateEngineError(error)) {
      logger.error(error.toUserMessage());
      if (error.context) {
        logger.debug(
          `Error context: ${JSON.stringify(error.context, null, 2)}`
        );
      }
    } else {
      logger.error(`Unexpected error: ${error}`);
    }
  }

  /**
   * Check if error should cause immediate exit
   */
  static isFatalError(error: unknown): boolean {
    if (error instanceof CLIError) {
      return error.exitCode > 0;
    }

    if (error instanceof PermissionError) {
      return true;
    }

    return false;
  }

  /**
   * Get appropriate exit code for error
   */
  static getExitCode(error: unknown): number {
    if (error instanceof CLIError) {
      return error.exitCode;
    }

    if (error instanceof PermissionError) {
      return 126; // Permission denied
    }

    if (error instanceof FileNotFoundError) {
      return 2; // No such file or directory
    }

    if (error instanceof ConfigError) {
      return 78; // Configuration error
    }

    if (error instanceof ValidationError) {
      return 65; // Data format error
    }

    return 1; // General error
  }
}

/**
 * Common error codes used throughout the application
 */
export const ERROR_CODES = {
  // General
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Configuration
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  CONFIG_INVALID: 'CONFIG_INVALID',
  CONFIG_PARSE_ERROR: 'CONFIG_PARSE_ERROR',

  // File System
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_READ_ERROR: 'FILE_READ_ERROR',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  DIRECTORY_NOT_FOUND: 'DIRECTORY_NOT_FOUND',

  // Templates
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_INVALID: 'TEMPLATE_INVALID',
  TEMPLATE_PARSE_ERROR: 'TEMPLATE_PARSE_ERROR',
  MISSING_VARIABLES: 'MISSING_VARIABLES',

  // CLI
  INVALID_COMMAND: 'INVALID_COMMAND',
  INVALID_ARGUMENT: 'INVALID_ARGUMENT',
  MISSING_ARGUMENT: 'MISSING_ARGUMENT',

  // Validation
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Network
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',

  // Permissions
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ACCESS_DENIED: 'ACCESS_DENIED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

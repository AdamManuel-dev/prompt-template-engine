/**
 * @fileoverview Comprehensive error class hierarchy for standardized error handling
 * @lastmodified 2025-08-23T04:00:00Z
 *
 * Features: Custom error classes, error codes, serialization, stack traces
 * Main APIs: BaseError, ValidationError, NetworkError, SecurityError
 * Constraints: All errors extend BaseError, include error codes and context
 * Patterns: Error boundary pattern, structured error responses
 */

/* eslint-disable max-classes-per-file */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Error categories
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NETWORK = 'network',
  DATABASE = 'database',
  FILE_SYSTEM = 'file_system',
  CONFIGURATION = 'configuration',
  TEMPLATE = 'template',
  PLUGIN = 'plugin',
  MARKETPLACE = 'marketplace',
  INTERNAL = 'internal',
  EXTERNAL = 'external',
}

/**
 * Interface for errors with code property
 */
interface ErrorWithCode extends Error {
  code: string;
  context?: Record<string, unknown>;
  response?: unknown;
  originalError?: Error;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  isOperational?: boolean;
}

/**
 * Base error class for all custom errors
 */
export abstract class BaseError extends Error {
  public readonly code: string;

  public readonly severity: ErrorSeverity;

  public readonly category: ErrorCategory;

  public readonly timestamp: Date;

  public readonly context?: Record<string, unknown>;

  public readonly originalError?: Error;

  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>,
    originalError?: Error,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    category: ErrorCategory = ErrorCategory.INTERNAL
  ) {
    super(message);

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.category = category;
    this.timestamp = new Date();
    this.context = context;
    this.originalError = originalError;
    this.isOperational = true; // Indicates error is expected and handled
  }

  /**
   * Convert error to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return this.message;
  }

  /**
   * Log error with appropriate level
   */
  log(logger?: Console): void {
    const logMethod =
      this.severity === ErrorSeverity.CRITICAL
        ? 'error'
        : this.severity === ErrorSeverity.HIGH
          ? 'error'
          : this.severity === ErrorSeverity.MEDIUM
            ? 'warn'
            : 'log';

    (logger || console)[logMethod](this.toJSON());
  }
}

/**
 * Validation errors
 */
export class ValidationError extends BaseError {
  public readonly field?: string;

  public readonly value?: unknown;

  public readonly constraints?: Record<string, unknown>;

  constructor(
    message: string,
    field?: string,
    value?: unknown,
    constraints?: Record<string, unknown>
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      { field, value, constraints },
      undefined,
      ErrorSeverity.LOW,
      ErrorCategory.VALIDATION
    );

    this.field = field;
    this.value = value;
    this.constraints = constraints;
  }
}

/**
 * File system errors
 */
export class FileSystemError extends BaseError {
  public readonly path?: string;

  public readonly operation?: string;

  constructor(
    message: string,
    path?: string,
    operation?: string,
    originalError?: Error
  ) {
    super(
      message,
      'FILE_SYSTEM_ERROR',
      { path, operation },
      originalError,
      ErrorSeverity.MEDIUM,
      ErrorCategory.FILE_SYSTEM
    );

    this.path = path;
    this.operation = operation;
  }
}

export class FileNotFoundError extends FileSystemError {
  constructor(path: string) {
    super(`File not found: ${path}`, path, 'read');
    (this as ErrorWithCode).code = 'FILE_NOT_FOUND';
  }
}

export class FileAccessError extends FileSystemError {
  constructor(path: string, operation: string = 'access') {
    super(`Cannot ${operation} file: ${path}`, path, operation);
    (this as ErrorWithCode).code = 'FILE_ACCESS_DENIED';
  }
}

/**
 * Template errors
 */
export class TemplateError extends BaseError {
  public readonly templateName?: string;

  public readonly templatePath?: string;

  constructor(
    message: string,
    templateName?: string,
    templatePath?: string,
    context?: Record<string, unknown>
  ) {
    super(
      message,
      'TEMPLATE_ERROR',
      { templateName, templatePath, ...context },
      undefined,
      ErrorSeverity.MEDIUM,
      ErrorCategory.TEMPLATE
    );

    this.templateName = templateName;
    this.templatePath = templatePath;
  }
}

export class TemplateNotFoundError extends TemplateError {
  constructor(templateName: string) {
    super(`Template not found: ${templateName}`, templateName);
    (this as ErrorWithCode).code = 'TEMPLATE_NOT_FOUND';
  }
}

export class TemplateProcessingError extends TemplateError {
  constructor(
    message: string,
    templateName?: string,
    line?: number,
    column?: number,
    originalError?: Error
  ) {
    super(message, templateName, undefined, { line, column });
    (this as ErrorWithCode).code = 'TEMPLATE_PROCESSING_ERROR';
    (this as ErrorWithCode).originalError = originalError;
  }
}

/**
 * Plugin errors
 */
export class PluginError extends BaseError {
  public readonly pluginName?: string;

  public readonly pluginVersion?: string;

  constructor(
    message: string,
    pluginName?: string,
    pluginVersion?: string,
    originalError?: Error
  ) {
    super(
      message,
      'PLUGIN_ERROR',
      { pluginName, pluginVersion },
      originalError,
      ErrorSeverity.MEDIUM,
      ErrorCategory.PLUGIN
    );

    this.pluginName = pluginName;
    this.pluginVersion = pluginVersion;
  }
}

export class PluginLoadError extends PluginError {
  constructor(pluginName: string, reason: string) {
    super(`Failed to load plugin ${pluginName}: ${reason}`, pluginName);
    (this as ErrorWithCode).code = 'PLUGIN_LOAD_ERROR';
  }
}

export class PluginExecutionError extends PluginError {
  constructor(pluginName: string, command: string, originalError?: Error) {
    super(
      `Plugin ${pluginName} failed executing command: ${command}`,
      pluginName,
      undefined,
      originalError
    );
    (this as ErrorWithCode).code = 'PLUGIN_EXECUTION_ERROR';
  }
}

/**
 * Network errors
 */
export class NetworkError extends BaseError {
  public readonly url?: string;

  public readonly statusCode?: number;

  public readonly method?: string;

  constructor(
    message: string,
    url?: string,
    statusCode?: number,
    method?: string,
    originalError?: Error
  ) {
    super(
      message,
      'NETWORK_ERROR',
      { url, statusCode, method },
      originalError,
      ErrorSeverity.MEDIUM,
      ErrorCategory.NETWORK
    );

    this.url = url;
    this.statusCode = statusCode;
    this.method = method;
  }
}

export class ApiError extends NetworkError {
  constructor(
    message: string,
    url: string,
    statusCode: number,
    response?: unknown
  ) {
    super(message, url, statusCode);
    (this as ErrorWithCode).code = `API_ERROR_${statusCode}`;
    (this as ErrorWithCode).context = { ...this.context, response };
  }
}

export class TimeoutError extends NetworkError {
  constructor(url: string, timeout: number) {
    super(`Request timed out after ${timeout}ms: ${url}`, url);
    (this as ErrorWithCode).code = 'TIMEOUT_ERROR';
    (this as ErrorWithCode).severity = ErrorSeverity.HIGH;
  }
}

/**
 * Security errors
 */
export class SecurityError extends BaseError {
  constructor(
    message: string,
    context?: Record<string, unknown>,
    code: string = 'SECURITY_ERROR'
  ) {
    super(
      message,
      code,
      context,
      undefined,
      ErrorSeverity.CRITICAL,
      ErrorCategory.AUTHENTICATION
    );
  }
}

export class AuthenticationError extends SecurityError {
  constructor(message: string = 'Authentication failed') {
    super(message, undefined, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends SecurityError {
  constructor(resource: string, action: string, user?: string) {
    super(
      `Unauthorized: Cannot ${action} ${resource}`,
      {
        resource,
        action,
        user,
      },
      'AUTHORIZATION_ERROR'
    );
    (this as ErrorWithCode).category = ErrorCategory.AUTHORIZATION;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends BaseError {
  public readonly configKey?: string;

  public readonly configFile?: string;

  constructor(message: string, configKey?: string, configFile?: string) {
    super(
      message,
      'CONFIGURATION_ERROR',
      { configKey, configFile },
      undefined,
      ErrorSeverity.HIGH,
      ErrorCategory.CONFIGURATION
    );

    this.configKey = configKey;
    this.configFile = configFile;
  }
}

export class MissingConfigError extends ConfigurationError {
  constructor(configKey: string) {
    super(`Missing required configuration: ${configKey}`, configKey);
    (this as ErrorWithCode).code = 'MISSING_CONFIG';
  }
}

export class InvalidConfigError extends ConfigurationError {
  constructor(configKey: string, reason: string) {
    super(`Invalid configuration for ${configKey}: ${reason}`, configKey);
    (this as ErrorWithCode).code = 'INVALID_CONFIG';
  }
}

/**
 * Marketplace errors
 */
export class MarketplaceError extends BaseError {
  public readonly templateId?: string;

  public readonly authorId?: string;

  constructor(
    message: string,
    templateId?: string,
    authorId?: string,
    originalError?: Error
  ) {
    super(
      message,
      'MARKETPLACE_ERROR',
      { templateId, authorId },
      originalError,
      ErrorSeverity.MEDIUM,
      ErrorCategory.MARKETPLACE
    );

    this.templateId = templateId;
    this.authorId = authorId;
  }
}

export class TemplateInstallError extends MarketplaceError {
  constructor(templateId: string, reason: string) {
    super(`Failed to install template ${templateId}: ${reason}`, templateId);
    (this as ErrorWithCode).code = 'TEMPLATE_INSTALL_ERROR';
  }
}

export class PublishError extends MarketplaceError {
  constructor(templateId: string, reason: string) {
    super(`Failed to publish template ${templateId}: ${reason}`, templateId);
    (this as ErrorWithCode).code = 'PUBLISH_ERROR';
  }
}

/**
 * Internal errors
 */
export class InternalError extends BaseError {
  constructor(
    originalError?: Error,
    message: string = 'An internal error occurred'
  ) {
    super(
      message,
      'INTERNAL_ERROR',
      undefined,
      originalError,
      ErrorSeverity.CRITICAL,
      ErrorCategory.INTERNAL
    );

    (this as ErrorWithCode).isOperational = false; // Unexpected error
  }
}

export class NotImplementedError extends InternalError {
  constructor(feature: string) {
    super(undefined, `Feature not implemented: ${feature}`);
    (this as ErrorWithCode).code = 'NOT_IMPLEMENTED';
    (this as ErrorWithCode).severity = ErrorSeverity.LOW;
  }
}

/**
 * Error boundary for handling errors gracefully
 */
export class ErrorBoundary {
  private static handlers = new Map<string, (error: BaseError) => void>();

  /**
   * Register error handler for specific error code
   */
  static registerHandler(
    code: string,
    handler: (error: BaseError) => void
  ): void {
    this.handlers.set(code, handler);
  }

  /**
   * Handle error with registered handler or default behavior
   */
  static handle(error: Error): void {
    if (error instanceof BaseError) {
      const handler = this.handlers.get(error.code);
      if (handler) {
        handler(error);
      } else {
        this.defaultHandler(error);
      }
    } else {
      // Wrap non-custom errors
      const internalError = new InternalError(error, error.message);
      this.defaultHandler(internalError);
    }
  }

  /**
   * Default error handler
   */
  private static defaultHandler(error: BaseError): void {
    error.log();

    if (!error.isOperational) {
      // For non-operational errors, we might want to exit the process
      // in production or alert monitoring systems
      console.error('Non-operational error detected:', error);
    }
  }

  /**
   * Async error wrapper
   */
  static async wrap<T>(
    fn: () => Promise<T>,
    errorTransform?: (error: Error) => BaseError
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const customError = errorTransform
        ? errorTransform(error as Error)
        : error instanceof BaseError
          ? error
          : new InternalError(error as Error, (error as Error).message);

      this.handle(customError);
      throw customError;
    }
  }

  /**
   * Sync error wrapper
   */
  static wrapSync<T>(
    fn: () => T,
    errorTransform?: (error: Error) => BaseError
  ): T {
    try {
      return fn();
    } catch (error) {
      const customError = errorTransform
        ? errorTransform(error as Error)
        : error instanceof BaseError
          ? error
          : new InternalError(error as Error, (error as Error).message);

      this.handle(customError);
      throw customError;
    }
  }
}

/**
 * Error serializer for API responses
 */
export class ErrorSerializer {
  static serialize(error: Error): Record<string, unknown> {
    if (error instanceof BaseError) {
      return error.toJSON();
    }

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  static serializeForUser(error: Error): Record<string, unknown> {
    if (error instanceof BaseError) {
      return {
        message: error.getUserMessage(),
        code: error.code,
        severity: error.severity,
      };
    }

    return {
      message: 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Export error codes for easy reference
 */
export const ErrorCodes = {
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // File System
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_ACCESS_DENIED: 'FILE_ACCESS_DENIED',

  // Template
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_PROCESSING_ERROR: 'TEMPLATE_PROCESSING_ERROR',

  // Plugin
  PLUGIN_LOAD_ERROR: 'PLUGIN_LOAD_ERROR',
  PLUGIN_EXECUTION_ERROR: 'PLUGIN_EXECUTION_ERROR',

  // Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',

  // Security
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',

  // Configuration
  MISSING_CONFIG: 'MISSING_CONFIG',
  INVALID_CONFIG: 'INVALID_CONFIG',

  // Marketplace
  TEMPLATE_INSTALL_ERROR: 'TEMPLATE_INSTALL_ERROR',
  PUBLISH_ERROR: 'PUBLISH_ERROR',

  // Internal
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

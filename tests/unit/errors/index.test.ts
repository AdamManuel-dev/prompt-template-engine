/**
 * @fileoverview Tests for custom error classes and error handling
 * @lastmodified 2025-08-23T04:05:00Z
 */

import {
  ValidationError,
  FileSystemError,
  FileNotFoundError,
  FileAccessError,
  TemplateNotFoundError,
  TemplateProcessingError,
  PluginLoadError,
  PluginExecutionError,
  ApiError,
  TimeoutError,
  SecurityError,
  AuthenticationError,
  AuthorizationError,
  MissingConfigError,
  InvalidConfigError,
  TemplateInstallError,
  PublishError,
  InternalError,
  NotImplementedError,
  ErrorBoundary,
  ErrorSerializer,
  ErrorSeverity,
  ErrorCategory,
  ErrorCodes,
} from '../../../src/errors';

describe('Error Classes', () => {
  describe('ValidationError', () => {
    it('should create validation error with field details', () => {
      const error = new ValidationError(
        'Invalid email format',
        'email',
        'not-an-email',
        { format: 'email' }
      );

      expect(error.message).toBe('Invalid email format');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.field).toBe('email');
      expect(error.value).toBe('not-an-email');
      expect(error.constraints).toEqual({ format: 'email' });
      expect(error.severity).toBe(ErrorSeverity.LOW);
      expect(error.category).toBe(ErrorCategory.VALIDATION);
    });

    it('should have proper stack trace', () => {
      const error = new ValidationError('Test error');
      expect(error.stack).toContain('ValidationError');
      expect(error.stack).toContain('index.test.ts');
    });
  });

  describe('FileSystemError', () => {
    it('should create FileNotFoundError', () => {
      const error = new FileNotFoundError('/path/to/file.txt');
      
      expect(error.message).toBe('File not found: /path/to/file.txt');
      expect(error.code).toBe('FILE_NOT_FOUND');
      expect(error.path).toBe('/path/to/file.txt');
      expect(error.operation).toBe('read');
    });

    it('should create FileAccessError', () => {
      const error = new FileAccessError('/protected/file.txt', 'write');
      
      expect(error.message).toBe('Cannot write file: /protected/file.txt');
      expect(error.code).toBe('FILE_ACCESS_DENIED');
      expect(error.path).toBe('/protected/file.txt');
      expect(error.operation).toBe('write');
    });

    it('should preserve original error', () => {
      const originalError = new Error('EACCES: permission denied');
      const error = new FileSystemError(
        'File operation failed',
        '/file.txt',
        'read',
        originalError
      );
      
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('TemplateError', () => {
    it('should create TemplateNotFoundError', () => {
      const error = new TemplateNotFoundError('my-template');
      
      expect(error.message).toBe('Template not found: my-template');
      expect(error.code).toBe('TEMPLATE_NOT_FOUND');
      expect(error.templateName).toBe('my-template');
    });

    it('should create TemplateProcessingError with location', () => {
      const originalError = new Error('Unexpected token');
      const error = new TemplateProcessingError(
        'Template syntax error',
        'my-template',
        10,
        5,
        originalError
      );
      
      expect(error.message).toBe('Template syntax error');
      expect(error.code).toBe('TEMPLATE_PROCESSING_ERROR');
      expect(error.templateName).toBe('my-template');
      expect(error.context).toEqual({ line: 10, column: 5 });
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('PluginError', () => {
    it('should create PluginLoadError', () => {
      const error = new PluginLoadError('my-plugin', 'Module not found');
      
      expect(error.message).toBe('Failed to load plugin my-plugin: Module not found');
      expect(error.code).toBe('PLUGIN_LOAD_ERROR');
      expect(error.pluginName).toBe('my-plugin');
    });

    it('should create PluginExecutionError', () => {
      const originalError = new Error('Command failed');
      const error = new PluginExecutionError('my-plugin', 'custom-command', originalError);
      
      expect(error.message).toBe('Plugin my-plugin failed executing command: custom-command');
      expect(error.code).toBe('PLUGIN_EXECUTION_ERROR');
      expect(error.pluginName).toBe('my-plugin');
      expect(error.originalError).toBe(originalError);
    });
  });

  describe('NetworkError', () => {
    it('should create ApiError with status code', () => {
      const error = new ApiError(
        'Bad Request',
        'https://api.example.com/users',
        400,
        { error: 'Invalid parameters' }
      );
      
      expect(error.message).toBe('Bad Request');
      expect(error.code).toBe('API_ERROR_400');
      expect(error.url).toBe('https://api.example.com/users');
      expect(error.statusCode).toBe(400);
      expect(error.context?.response).toEqual({ error: 'Invalid parameters' });
    });

    it('should create TimeoutError', () => {
      const error = new TimeoutError('https://slow-api.com', 5000);
      
      expect(error.message).toBe('Request timed out after 5000ms: https://slow-api.com');
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });
  });

  describe('SecurityError', () => {
    it('should create AuthenticationError', () => {
      const error = new AuthenticationError('Invalid credentials');
      
      expect(error.message).toBe('Invalid credentials');
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.category).toBe(ErrorCategory.AUTHENTICATION);
    });

    it('should create AuthorizationError', () => {
      const error = new AuthorizationError('admin-panel', 'access', 'user123');
      
      expect(error.message).toBe('Unauthorized: Cannot access admin-panel');
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.category).toBe(ErrorCategory.AUTHORIZATION);
      expect(error.context).toEqual({
        resource: 'admin-panel',
        action: 'access',
        user: 'user123'
      });
    });
  });

  describe('ConfigurationError', () => {
    it('should create MissingConfigError', () => {
      const error = new MissingConfigError('API_KEY');
      
      expect(error.message).toBe('Missing required configuration: API_KEY');
      expect(error.code).toBe('MISSING_CONFIG');
      expect(error.configKey).toBe('API_KEY');
      expect(error.severity).toBe(ErrorSeverity.HIGH);
    });

    it('should create InvalidConfigError', () => {
      const error = new InvalidConfigError('PORT', 'Must be a number');
      
      expect(error.message).toBe('Invalid configuration for PORT: Must be a number');
      expect(error.code).toBe('INVALID_CONFIG');
      expect(error.configKey).toBe('PORT');
    });
  });

  describe('MarketplaceError', () => {
    it('should create TemplateInstallError', () => {
      const error = new TemplateInstallError('awesome-template', 'Network error');
      
      expect(error.message).toBe('Failed to install template awesome-template: Network error');
      expect(error.code).toBe('TEMPLATE_INSTALL_ERROR');
      expect(error.templateId).toBe('awesome-template');
    });

    it('should create PublishError', () => {
      const error = new PublishError('my-template', 'Validation failed');
      
      expect(error.message).toBe('Failed to publish template my-template: Validation failed');
      expect(error.code).toBe('PUBLISH_ERROR');
      expect(error.templateId).toBe('my-template');
    });
  });

  describe('InternalError', () => {
    it('should create InternalError', () => {
      const originalError = new Error('Unexpected state');
      const error = new InternalError('System failure', originalError);
      
      expect(error.message).toBe('System failure');
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.isOperational).toBe(false);
      expect(error.originalError).toBe(originalError);
    });

    it('should create NotImplementedError', () => {
      const error = new NotImplementedError('WebSocket support');
      
      expect(error.message).toBe('Feature not implemented: WebSocket support');
      expect(error.code).toBe('NOT_IMPLEMENTED');
      expect(error.severity).toBe(ErrorSeverity.LOW);
    });
  });

  describe('Error Serialization', () => {
    it('should serialize BaseError to JSON', () => {
      const error = new ValidationError('Test error', 'field1', 'value1');
      const json = error.toJSON();
      
      expect(json).toMatchObject({
        name: 'ValidationError',
        message: 'Test error',
        code: 'VALIDATION_ERROR',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        context: {
          field: 'field1',
          value: 'value1',
          constraints: undefined
        }
      });
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeDefined();
    });

    it('should get user-friendly message', () => {
      const error = new ValidationError('Technical validation failed', 'email');
      expect(error.getUserMessage()).toBe('Technical validation failed');
    });
  });

  describe('ErrorBoundary', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should handle custom errors with registered handler', () => {
      const handler = jest.fn();
      ErrorBoundary.registerHandler('VALIDATION_ERROR', handler);
      
      const error = new ValidationError('Test');
      
      ErrorBoundary.handle(error);
      
      expect(handler).toHaveBeenCalledWith(error);
    });

    it('should use default handler for unregistered errors', () => {
      const error = new ValidationError('Test');
      ErrorBoundary.handle(error);
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should wrap non-custom errors', () => {
      const error = new Error('Regular error');
      ErrorBoundary.handle(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Non-operational error detected:',
        expect.any(InternalError)
      );
    });

    it('should wrap async functions', async () => {
      const error = new ValidationError('Async error');
      const fn = jest.fn().mockRejectedValue(error);
      
      await expect(ErrorBoundary.wrap(fn)).rejects.toThrow(error);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should wrap sync functions', () => {
      const error = new ValidationError('Sync error');
      const fn = jest.fn().mockImplementation(() => {
        throw error;
      });
      
      expect(() => ErrorBoundary.wrapSync(fn)).toThrow(error);
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should transform errors in wrap', async () => {
      const originalError = new Error('Original');
      const customError = new ValidationError('Transformed');
      const transform = jest.fn().mockReturnValue(customError);
      const fn = jest.fn().mockRejectedValue(originalError);
      
      await expect(ErrorBoundary.wrap(fn, transform)).rejects.toThrow(customError);
      expect(transform).toHaveBeenCalledWith(originalError);
    });
  });

  describe('ErrorSerializer', () => {
    it('should serialize BaseError', () => {
      const error = new ValidationError('Test error', 'field1');
      const serialized = ErrorSerializer.serialize(error);
      
      expect(serialized).toMatchObject({
        name: 'ValidationError',
        message: 'Test error',
        code: 'VALIDATION_ERROR',
      });
    });

    it('should serialize regular Error', () => {
      const error = new Error('Regular error');
      const serialized = ErrorSerializer.serialize(error);
      
      expect(serialized).toMatchObject({
        name: 'Error',
        message: 'Regular error',
      });
      expect(serialized.stack).toBeDefined();
    });

    it('should serialize for user (hide sensitive info)', () => {
      const error = new ValidationError('Internal validation logic failed', 'secret_field');
      const serialized = ErrorSerializer.serializeForUser(error);
      
      expect(serialized).toEqual({
        message: 'Internal validation logic failed',
        code: 'VALIDATION_ERROR',
        severity: ErrorSeverity.LOW,
      });
      expect(serialized.stack).toBeUndefined();
      expect(serialized.context).toBeUndefined();
    });

    it('should handle unknown errors for user', () => {
      const error = new Error('System crash');
      const serialized = ErrorSerializer.serializeForUser(error);
      
      expect(serialized).toEqual({
        message: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
      });
    });
  });

  describe('Error Logging', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should log critical errors with console.error', () => {
      const error = new SecurityError('Critical security breach');
      error.log();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Critical security breach',
        severity: ErrorSeverity.CRITICAL,
      }));
    });

    it('should log medium errors with console.warn', () => {
      const error = new FileNotFoundError('/file.txt');
      error.log();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.objectContaining({
        message: 'File not found: /file.txt',
        severity: ErrorSeverity.MEDIUM,
      }));
    });

    it('should log low errors with console.log', () => {
      const error = new ValidationError('Field invalid');
      error.log();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Field invalid',
        severity: ErrorSeverity.LOW,
      }));
    });
  });

  describe('ErrorCodes', () => {
    it('should have all error codes defined', () => {
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
      expect(ErrorCodes.TEMPLATE_NOT_FOUND).toBe('TEMPLATE_NOT_FOUND');
      expect(ErrorCodes.PLUGIN_LOAD_ERROR).toBe('PLUGIN_LOAD_ERROR');
      expect(ErrorCodes.AUTHENTICATION_ERROR).toBe('AUTHENTICATION_ERROR');
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });
  });
});
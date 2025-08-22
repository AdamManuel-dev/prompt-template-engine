/**
 * @fileoverview Centralized error handling patterns for testing
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Consistent error handling and mocking patterns
 * Main APIs: Error creation and handling utilities for tests
 * Constraints: Compatible with Jest testing framework
 * Patterns: Factory pattern for error creation with realistic behavior
 */

export enum ErrorType {
  FILE_NOT_FOUND = 'ENOENT',
  PERMISSION_DENIED = 'EACCES',
  INVALID_ARGUMENT = 'EINVAL',
  TIMEOUT = 'ETIMEDOUT',
  NETWORK_ERROR = 'ENOTFOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  TEMPLATE_ERROR = 'TEMPLATE_ERROR',
  GIT_ERROR = 'GIT_ERROR',
}

export interface MockError extends Error {
  code?: string;
  errno?: number;
  syscall?: string;
  path?: string;
  statusCode?: number;
  details?: any;
}

export class ErrorMockFactory {
  /**
   * Create a file system error with realistic properties
   */
  static createFileSystemError(
    type: ErrorType,
    path?: string,
    syscall: string = 'open'
  ): MockError {
    const messages = {
      [ErrorType.FILE_NOT_FOUND]: `ENOENT: no such file or directory, ${syscall} '${path}'`,
      [ErrorType.PERMISSION_DENIED]: `EACCES: permission denied, ${syscall} '${path}'`,
      [ErrorType.INVALID_ARGUMENT]: `EINVAL: invalid argument, ${syscall} '${path}'`,
    };

    const error = new Error(
      messages[type] || `Unknown error: ${type}`
    ) as MockError;
    error.code = type;
    error.errno = this.getErrno(type);
    error.syscall = syscall;
    if (path) error.path = path;

    return error;
  }

  /**
   * Create a network/timeout error
   */
  static createNetworkError(type: ErrorType, hostname?: string): MockError {
    const messages = {
      [ErrorType.TIMEOUT]: `ETIMEDOUT: connect timeout`,
      [ErrorType.NETWORK_ERROR]: `ENOTFOUND: getaddrinfo ENOTFOUND ${hostname}`,
    };

    const error = new Error(
      messages[type] || `Network error: ${type}`
    ) as MockError;
    error.code = type;
    error.errno = this.getErrno(type);

    return error;
  }

  /**
   * Create a validation error with details
   */
  static createValidationError(message: string, details?: any): MockError {
    const error = new Error(message) as MockError;
    error.code = ErrorType.VALIDATION_ERROR;
    error.details = details;

    return error;
  }

  /**
   * Create a template processing error
   */
  static createTemplateError(
    message: string,
    template?: string,
    line?: number,
    column?: number
  ): MockError {
    const error = new Error(message) as MockError;
    error.code = ErrorType.TEMPLATE_ERROR;
    error.details = {
      template,
      line,
      column,
    };

    return error;
  }

  /**
   * Create a git operation error
   */
  static createGitError(message: string, command?: string): MockError {
    const error = new Error(message) as MockError;
    error.code = ErrorType.GIT_ERROR;
    error.details = { command };

    return error;
  }

  /**
   * Create an error that will be thrown after a delay
   */
  static createDelayedError(error: MockError, delayMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(error), delayMs);
    });
  }

  /**
   * Create a mock function that throws specific errors based on input
   */
  static createConditionalErrorMock(
    conditions: Array<{
      condition: (input: any) => boolean;
      error: MockError;
    }>,
    defaultReturn?: any
  ): jest.MockedFunction<any> {
    return jest.fn().mockImplementation((input: any) => {
      const matchingCondition = conditions.find(c => c.condition(input));
      if (matchingCondition) {
        throw matchingCondition.error;
      }
      return defaultReturn;
    });
  }

  /**
   * Create a mock function that rejects with specific errors
   */
  static createAsyncConditionalErrorMock(
    conditions: Array<{
      condition: (input: any) => boolean;
      error: MockError;
    }>,
    defaultReturn?: any
  ): jest.MockedFunction<any> {
    return jest.fn().mockImplementation(async (input: any) => {
      const matchingCondition = conditions.find(c => c.condition(input));
      if (matchingCondition) {
        throw matchingCondition.error;
      }
      return defaultReturn;
    });
  }

  /**
   * Get errno for error type
   */
  private static getErrno(type: ErrorType): number {
    const errnos = {
      [ErrorType.FILE_NOT_FOUND]: -2,
      [ErrorType.PERMISSION_DENIED]: -13,
      [ErrorType.INVALID_ARGUMENT]: -22,
      [ErrorType.TIMEOUT]: -110,
      [ErrorType.NETWORK_ERROR]: -3008,
      [ErrorType.VALIDATION_ERROR]: -1000,
      [ErrorType.TEMPLATE_ERROR]: -1001,
      [ErrorType.GIT_ERROR]: -1002,
    };

    return errnos[type] || -1;
  }
}

/**
 * Error handling test utilities
 */
export class ErrorTestUtils {
  /**
   * Assert that a function throws a specific error type
   */
  static expectError(
    fn: () => any,
    expectedType: ErrorType,
    expectedMessage?: string
  ): void {
    let error: MockError | undefined;

    try {
      fn();
    } catch (e) {
      error = e as MockError;
    }

    expect(error).toBeDefined();
    expect(error?.code).toBe(expectedType);

    if (expectedMessage) {
      expect(error?.message).toContain(expectedMessage);
    }
  }

  /**
   * Assert that an async function throws a specific error type
   */
  static async expectAsyncError(
    fn: () => Promise<any>,
    expectedType: ErrorType,
    expectedMessage?: string
  ): Promise<void> {
    let error: MockError | undefined;

    try {
      await fn();
    } catch (e) {
      error = e as MockError;
    }

    expect(error).toBeDefined();
    expect(error?.code).toBe(expectedType);

    if (expectedMessage) {
      expect(error?.message).toContain(expectedMessage);
    }
  }

  /**
   * Create a test scenario that expects specific error handling
   */
  static createErrorScenario(
    name: string,
    setup: () => void,
    operation: () => Promise<any> | any,
    expectedError: ErrorType,
    expectedMessage?: string
  ): { name: string; test: () => Promise<void> } {
    return {
      name,
      test: async () => {
        setup();

        if (operation.constructor.name === 'AsyncFunction') {
          await ErrorTestUtils.expectAsyncError(
            operation as () => Promise<any>,
            expectedError,
            expectedMessage
          );
        } else {
          ErrorTestUtils.expectError(
            operation as () => any,
            expectedError,
            expectedMessage
          );
        }
      },
    };
  }

  /**
   * Test error recovery patterns
   */
  static async testErrorRecovery<T>(
    operation: () => Promise<T>,
    recovery: (error: MockError) => Promise<T>,
    expectedError: ErrorType
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const mockError = error as MockError;
      expect(mockError.code).toBe(expectedError);
      return await recovery(mockError);
    }
  }

  /**
   * Create a sequence of operations that may fail and test resilience
   */
  static async testOperationSequence<T>(
    operations: Array<() => Promise<T>>,
    errorHandlers: Array<(error: MockError) => Promise<T>>,
    continueOnError: boolean = false
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < operations.length; i++) {
      try {
        const result = await operations[i]();
        results.push(result);
      } catch (error) {
        const mockError = error as MockError;

        if (errorHandlers[i]) {
          const recovered = await errorHandlers[i](mockError);
          results.push(recovered);
        } else if (!continueOnError) {
          throw error;
        }
      }
    }

    return results;
  }
}

/**
 * Common error scenarios for different service types
 */
export const CommonErrorScenarios = {
  fileSystem: {
    notFound: (path: string) =>
      ErrorMockFactory.createFileSystemError(ErrorType.FILE_NOT_FOUND, path),
    permissionDenied: (path: string) =>
      ErrorMockFactory.createFileSystemError(ErrorType.PERMISSION_DENIED, path),
    invalidArgument: (path: string) =>
      ErrorMockFactory.createFileSystemError(ErrorType.INVALID_ARGUMENT, path),
  },

  network: {
    timeout: () => ErrorMockFactory.createNetworkError(ErrorType.TIMEOUT),
    notFound: (hostname: string) =>
      ErrorMockFactory.createNetworkError(ErrorType.NETWORK_ERROR, hostname),
  },

  template: {
    syntaxError: (message: string, line?: number) =>
      ErrorMockFactory.createTemplateError(message, undefined, line),
    missingVariable: (variable: string) =>
      ErrorMockFactory.createTemplateError(`Variable '${variable}' not found`),
    circularInclude: (template: string) =>
      ErrorMockFactory.createTemplateError(
        'Circular dependency detected',
        template
      ),
  },

  git: {
    notARepository: () =>
      ErrorMockFactory.createGitError('Not a git repository'),
    commandFailed: (command: string) =>
      ErrorMockFactory.createGitError(
        `Git command failed: ${command}`,
        command
      ),
  },

  validation: {
    requiredField: (field: string) =>
      ErrorMockFactory.createValidationError(`Field '${field}' is required`, {
        field,
      }),
    invalidType: (field: string, expected: string, actual: string) =>
      ErrorMockFactory.createValidationError(
        `Field '${field}' expected ${expected}, got ${actual}`,
        { field, expected, actual }
      ),
  },
};

export default ErrorMockFactory;

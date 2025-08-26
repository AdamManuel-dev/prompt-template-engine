/**
 * @fileoverview Error handling utilities for optimization services
 * @lastmodified 2025-08-26T16:30:00Z
 *
 * Features: Custom error classes, error tracking, retry logic
 * Main APIs: OptimizationError, CacheError, QueueError
 * Constraints: Structured error handling with metrics
 * Patterns: Error hierarchy, error context tracking
 */

export class OptimizationError extends Error {
  public readonly code: string;

  public readonly context: Record<string, unknown>;

  public readonly timestamp: Date;

  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {},
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'OptimizationError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.retryable = retryable;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      retryable: this.retryable,
      stack: this.stack,
    };
  }
}

export class CacheError extends OptimizationError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'CACHE_ERROR', context, true);
    this.name = 'CacheError';
  }
}

export class QueueError extends OptimizationError {
  constructor(
    message: string,
    context: Record<string, unknown> = {},
    retryable: boolean = true
  ) {
    super(message, 'QUEUE_ERROR', context, retryable);
    this.name = 'QueueError';
  }
}

export class PipelineError extends OptimizationError {
  constructor(
    message: string,
    stage: string,
    context: Record<string, any> = {}
  ) {
    super(message, 'PIPELINE_ERROR', { ...context, stage }, true);
    this.name = 'PipelineError';
  }
}

export class ConfigurationError extends OptimizationError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'CONFIG_ERROR', context, false);
    this.name = 'ConfigurationError';
  }
}

export class ValidationError extends OptimizationError {
  constructor(message: string, field: string, value: any) {
    super(message, 'VALIDATION_ERROR', { field, value }, false);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends OptimizationError {
  constructor(
    operation: string,
    timeoutMs: number,
    context: Record<string, any> = {}
  ) {
    super(
      `Operation '${operation}' timed out after ${timeoutMs}ms`,
      'TIMEOUT_ERROR',
      { ...context, operation, timeoutMs },
      true
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Error metrics tracking
 */
export class ErrorTracker {
  private errorCounts = new Map<string, number>();

  private lastErrors = new Map<string, OptimizationError>();

  private errorHistory: OptimizationError[] = [];

  private readonly maxHistorySize = 1000;

  track(error: OptimizationError): void {
    // Update error counts
    const key = `${error.name}:${error.code}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);

    // Store last error of this type
    this.lastErrors.set(key, error);

    // Add to history
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  getStats() {
    return {
      totalErrors: this.errorHistory.length,
      errorsByType: Object.fromEntries(this.errorCounts),
      recentErrors: this.errorHistory.slice(-10),
    };
  }

  getLastError(
    errorType: string,
    code?: string
  ): OptimizationError | undefined {
    const key = code ? `${errorType}:${code}` : errorType;
    for (const [k, error] of this.lastErrors.entries()) {
      if (k.startsWith(key)) {
        return error;
      }
    }
    return undefined;
  }

  clear(): void {
    this.errorCounts.clear();
    this.lastErrors.clear();
    this.errorHistory = [];
  }
}

/**
 * Retry logic with exponential backoff
 */
export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  exponentialBase: number;
  jitter: boolean;
}

export class RetryManager {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    exponentialBase: 2,
    jitter: true,
  };

  static async retry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    errorTracker?: ErrorTracker
  ): Promise<T> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: Error;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Track error if tracker provided
        if (errorTracker && lastError instanceof OptimizationError) {
          errorTracker.track(lastError);
        }

        // Don't retry if not retryable
        if (lastError instanceof OptimizationError && !lastError.retryable) {
          break;
        }

        // Don't retry on last attempt
        if (attempt === config.maxRetries) {
          break;
        }

        // Calculate delay for next attempt
        const delay = Math.min(
          config.initialDelay * config.exponentialBase ** attempt,
          config.maxDelay
        );

        const finalDelay = config.jitter
          ? delay + Math.random() * delay * 0.1
          : delay;

        await new Promise(resolve => setTimeout(resolve, finalDelay));
      }
    }

    throw lastError!;
  }
}

/**
 * Circuit breaker for external dependencies
 */
export interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringWindow: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;

  private failures = 0;

  private lastFailureTime = 0;

  private successCount = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.options.recoveryTimeout) {
        throw new OptimizationError(
          'Circuit breaker is OPEN',
          'CIRCUIT_BREAKER_OPEN',
          { state: this.state, failures: this.failures },
          false
        );
      }
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
    }

    try {
      const result = await operation();

      // Success
      if (this.state === CircuitState.HALF_OPEN) {
        this.successCount++;
        if (this.successCount >= 3) {
          // Require 3 successes to close
          this.state = CircuitState.CLOSED;
          this.failures = 0;
        }
      }

      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.options.failureThreshold) {
        this.state = CircuitState.OPEN;
      }

      throw error;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

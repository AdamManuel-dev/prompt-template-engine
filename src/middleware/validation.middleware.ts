/**
 * @fileoverview Validation middleware for command handlers and API endpoints
 * @lastmodified 2025-08-23T05:00:00Z
 *
 * Features: Input validation, sanitization, error handling
 * Main APIs: validateInput(), createValidator(), withValidation()
 * Constraints: Uses Zod for schema validation
 * Patterns: Middleware pattern, functional composition
 */

import { z } from 'zod';
import { ValidationError } from '../errors';

// Type definition for command handler
type CommandHandler<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

/**
 * Validation middleware result
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Create a validation middleware for a specific schema
 */
export function createValidator<T>(
  schema: z.ZodSchema<T>
): (input: unknown) => ValidationResult<T> {
  return (input: unknown): ValidationResult<T> => {
    try {
      const data = schema.parse(input);
      return { success: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(err => {
          const path = err.path.join('.');
          return new ValidationError(err.message, path, input, {
            type: err.code,
          });
        });
        return { success: false, errors };
      }

      return {
        success: false,
        errors: [new ValidationError('Validation failed', undefined, input)],
      };
    }
  };
}

/**
 * Validate input against a schema
 */
export async function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): Promise<T> {
  const validator = createValidator(schema);
  const result = validator(input);

  if (!result.success) {
    const errorMessages =
      result.errors?.map(e => e.message).join(', ') || 'Validation failed';
    throw new ValidationError(errorMessages);
  }

  return result.data!; // We know data exists if success is true
}

/**
 * Wrap a command handler with validation
 */
export function withValidation<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: CommandHandler<TInput, TOutput>
): CommandHandler<unknown, TOutput> {
  return async (input: unknown): Promise<TOutput> => {
    const validatedInput = await validateInput(schema, input);
    return handler(validatedInput);
  };
}

/**
 * Create a middleware chain with validation
 */
export function createValidationMiddleware<T>(
  schema: z.ZodSchema<T>,
  options?: {
    transform?: (data: T) => T | Promise<T>;
    sanitize?: boolean;
    strict?: boolean;
  }
): (input: unknown) => Promise<T> {
  return async (input: unknown): Promise<T> => {
    // Note: strict mode not available in base ZodSchema type
    // Parse and validate
    let data = await validateInput(schema, input);

    // Apply transformation if provided
    if (options?.transform) {
      data = await options.transform(data);
    }

    // Additional sanitization if needed
    if (options?.sanitize) {
      data = sanitizeData(data) as any;
    }

    return data;
  };
}

/**
 * Sanitize data by removing potentially dangerous content
 */
function sanitizeData<T>(data: T): T {
  if (typeof data === 'string') {
    // Remove script tags and other dangerous patterns
    return data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on[a-z]+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers with quotes
      .replace(/on[a-z]+\s*=\s*[^\s>]*/gi, '') as T; // Remove event handlers without quotes
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item)) as T;
  }

  if (data && typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeData(value);
    }
    return sanitized;
  }

  return data;
}

/**
 * Batch validation for multiple inputs
 */
export async function validateBatch<T>(
  schema: z.ZodSchema<T>,
  inputs: unknown[]
): Promise<ValidationResult<T>[]> {
  const validator = createValidator(schema);
  return inputs.map(input => validator(input));
}

/**
 * Conditional validation based on input
 */
export function conditionalValidator<T>(
  condition: (input: unknown) => boolean,
  trueSchema: z.ZodSchema<T>,
  falseSchema: z.ZodSchema<T>
): (input: unknown) => ValidationResult<T> {
  return (input: unknown): ValidationResult<T> => {
    const schema = condition(input) ? trueSchema : falseSchema;
    return createValidator(schema)(input);
  };
}

/**
 * Compose multiple validators
 */
export function composeValidators<T>(
  ...validators: Array<(input: unknown) => ValidationResult<any>>
): (input: unknown) => ValidationResult<T> {
  return (input: unknown): ValidationResult<T> => {
    let currentData = input;

    for (const validator of validators) {
      const result = validator(currentData);
      if (!result.success) {
        return result;
      }
      currentData = result.data;
    }

    return { success: true, data: currentData as T };
  };
}

/**
 * Create a type-safe validator with custom error messages
 */
export function createTypedValidator<T>(
  schema: z.ZodSchema<T>,
  errorMessages?: Record<string, string>
): {
  validate: (input: unknown) => ValidationResult<T>;
  validateAsync: (input: unknown) => Promise<ValidationResult<T>>;
  validateOrThrow: (input: unknown) => T;
  isValid: (input: unknown) => input is T;
} {
  const validator = createValidator(schema);

  return {
    validate: (input: unknown) => {
      const result = validator(input);
      if (!result.success && errorMessages && result.errors) {
        result.errors = result.errors.map(err => {
          const customMessage = errorMessages[err.field || ''] || err.message;
          return new ValidationError(
            customMessage,
            err.field,
            err.value,
            err.constraints
          );
        });
      }
      return result;
    },

    validateAsync: async (input: unknown) => validator(input),

    validateOrThrow: (input: unknown): T => {
      const result = validator(input);
      if (!result.success) {
        const errors =
          result.errors?.map(e => e.message).join(', ') || 'Validation failed';
        throw new ValidationError(errors);
      }
      return result.data!; // We know data exists if success is true
    },

    isValid: (input: unknown): input is T => {
      const result = validator(input);
      return result.success;
    },
  };
}

/**
 * Environment variable validation
 */
export function validateEnv<T extends Record<string, any>>(
  schema: z.ZodSchema<T>
): T {
  const result = createValidator(schema)(process.env);

  if (!result.success) {
    const missing = result.errors
      ?.map(e => e.field)
      .filter(Boolean)
      .join(', ');
    throw new ValidationError(
      `Missing required environment variables: ${missing}`,
      undefined,
      undefined,
      { required: missing?.split(', ') }
    );
  }

  return result.data!; // We know data exists if success is true
}

/**
 * File path validation
 */
export function validateFilePath(
  path: string,
  options?: {
    mustExist?: boolean;
    allowTraversal?: boolean;
    extensions?: string[];
  }
): boolean {
  // Check for path traversal
  if (!options?.allowTraversal && path.includes('..')) {
    throw new ValidationError('Path traversal detected', 'path', path);
  }

  // Check file extension if specified
  if (options?.extensions) {
    const hasValidExtension = options.extensions.some(ext =>
      path.endsWith(ext)
    );
    if (!hasValidExtension) {
      throw new ValidationError(
        `Invalid file extension. Allowed: ${options.extensions.join(', ')}`,
        'path',
        path
      );
    }
  }

  return true;
}

/**
 * Export pre-configured validators for common use cases
 */
export const validators = {
  email: createTypedValidator(z.string().email()),
  url: createTypedValidator(z.string().url()),
  uuid: createTypedValidator(z.string().uuid()),
  semver: createTypedValidator(
    z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9-.]+)?$/)
  ),
  json: createTypedValidator(z.string().transform(str => JSON.parse(str))),
  positiveNumber: createTypedValidator(z.number().positive()),
  nonEmptyString: createTypedValidator(z.string().min(1)),

  // Template-specific validators
  templateName: createTypedValidator(
    z
      .string()
      .regex(
        /^[a-zA-Z][a-zA-Z0-9_-]*$/,
        'Template name must start with a letter and contain only alphanumeric characters, dashes, and underscores'
      )
  ),

  variableName: createTypedValidator(
    z
      .string()
      .regex(
        /^[a-zA-Z_$][a-zA-Z0-9_$]*$/,
        'Variable name must be a valid JavaScript identifier'
      )
  ),
};

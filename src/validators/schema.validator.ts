/**
 * @fileoverview Schema validator for template validation
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: JSON Schema-like validation for templates
 * Main APIs: SchemaValidator, SchemaDefinition
 * Constraints: Type checking, required fields, patterns
 * Patterns: Schema validation pattern
 */

import BaseValidator from './base.validator';
import { ValidationContext, ValidationResult } from './validation-pipeline';

export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: unknown[];
  items?: SchemaField; // For arrays
  properties?: Record<string, SchemaField>; // For objects
  additionalProperties?: boolean;
}

export interface SchemaDefinition {
  type: 'object';
  properties: Record<string, SchemaField>;
  required?: string[];
  additionalProperties?: boolean;
}

export class SchemaValidator extends BaseValidator {
  constructor(
    private readonly schema: SchemaDefinition,
    name: string = 'SchemaValidator'
  ) {
    super(name);
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const errors = this.validateObject(
      context.data,
      this.schema,
      context.path || ''
    );

    if (errors.length > 0) {
      return BaseValidator.failure(errors);
    }

    return BaseValidator.success(context.data);
  }

  private validateObject(
    data: unknown,
    schema: SchemaDefinition | SchemaField,
    path: string
  ): Array<ReturnType<typeof BaseValidator.error>> {
    const errors: Array<ReturnType<typeof BaseValidator.error>> = [];

    // Check if data is an object
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      errors.push(
        BaseValidator.error(
          `Expected object at ${path || 'root'}`,
          path,
          'TYPE_MISMATCH'
        )
      );
      return errors;
    }

    const objData = data as Record<string, unknown>;

    // Check required fields
    if ('required' in schema && Array.isArray(schema.required)) {
      schema.required.forEach((field: string) => {
        if (!(field in objData)) {
          errors.push(
            BaseValidator.error(
              `Required field "${field}" is missing`,
              `${path}.${field}`,
              'REQUIRED_FIELD_MISSING'
            )
          );
        }
      });
    }

    // Validate properties
    if ('properties' in schema && schema.properties) {
      Object.entries(schema.properties).forEach(([key, fieldSchema]) => {
        const fieldPath = path ? `${path}.${key}` : key;
        const value = objData[key];

        // Check required
        if (fieldSchema.required && value === undefined) {
          errors.push(
            BaseValidator.error(
              `Required field "${key}" is missing`,
              fieldPath,
              'REQUIRED_FIELD_MISSING'
            )
          );
          return;
        }

        // Skip if not provided and not required
        if (value === undefined) {
          return;
        }

        // Validate field
        errors.push(...this.validateField(value, fieldSchema, fieldPath));
      });
    }

    // Check additional properties
    if (
      'additionalProperties' in schema &&
      schema.additionalProperties === false
    ) {
      const allowedKeys = new Set(
        Object.keys('properties' in schema ? schema.properties || {} : {})
      );
      Object.keys(objData).forEach(key => {
        if (!allowedKeys.has(key)) {
          errors.push(
            BaseValidator.error(
              `Additional property "${key}" is not allowed`,
              path ? `${path}.${key}` : key,
              'ADDITIONAL_PROPERTY'
            )
          );
        }
      });
    }

    return errors;
  }

  private validateField(
    value: unknown,
    schema: SchemaField,
    path: string
  ): Array<ReturnType<typeof BaseValidator.error>> {
    const errors: Array<ReturnType<typeof BaseValidator.error>> = [];

    // Type validation
    const actualType = SchemaValidator.getType(value);
    if (actualType !== schema.type) {
      errors.push(
        BaseValidator.error(
          `Expected ${schema.type} but got ${actualType}`,
          path,
          'TYPE_MISMATCH',
          { expected: schema.type, actual: actualType }
        )
      );
      return errors; // Stop further validation if type is wrong
    }

    // String validations
    if (schema.type === 'string' && typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(
          BaseValidator.error(
            `String length must be at least ${schema.minLength}`,
            path,
            'MIN_LENGTH',
            { minLength: schema.minLength, actual: value.length }
          )
        );
      }

      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(
          BaseValidator.error(
            `String length must be at most ${schema.maxLength}`,
            path,
            'MAX_LENGTH',
            { maxLength: schema.maxLength, actual: value.length }
          )
        );
      }

      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          errors.push(
            BaseValidator.error(
              `String does not match pattern ${schema.pattern}`,
              path,
              'PATTERN_MISMATCH',
              { pattern: schema.pattern }
            )
          );
        }
      }
    }

    // Number validations
    if (schema.type === 'number' && typeof value === 'number') {
      if (schema.min !== undefined && value < schema.min) {
        errors.push(
          BaseValidator.error(
            `Number must be at least ${schema.min}`,
            path,
            'MIN_VALUE',
            { min: schema.min, actual: value }
          )
        );
      }

      if (schema.max !== undefined && value > schema.max) {
        errors.push(
          BaseValidator.error(
            `Number must be at most ${schema.max}`,
            path,
            'MAX_VALUE',
            { max: schema.max, actual: value }
          )
        );
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(
        BaseValidator.error(
          `Value must be one of: ${schema.enum.join(', ')}`,
          path,
          'ENUM_MISMATCH',
          { enum: schema.enum, actual: value }
        )
      );
    }

    // Array validations
    if (schema.type === 'array' && Array.isArray(value)) {
      if (schema.items) {
        value.forEach((item, index) => {
          errors.push(
            ...this.validateField(item, schema.items!, `${path}[${index}]`)
          );
        });
      }
    }

    // Object validations
    if (
      schema.type === 'object' &&
      typeof value === 'object' &&
      value !== null
    ) {
      if (schema.properties) {
        errors.push(
          ...this.validateObject(
            value,
            {
              type: 'object',
              properties: schema.properties,
              additionalProperties: schema.additionalProperties,
            },
            path
          )
        );
      }
    }

    return errors;
  }

  private static getType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}

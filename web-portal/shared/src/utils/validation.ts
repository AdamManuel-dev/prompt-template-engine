/**
 * @fileoverview Validation utilities for template variables and API data
 * @lastmodified 2025-08-28T10:00:00Z
 *
 * Features: Template variable validation, API payload validation
 * Main APIs: validateTemplateVariables, validateFigmaUrl
 * Constraints: Must handle all variable types defined in schema
 * Patterns: Type-safe validation with detailed error messages
 */

import { TemplateVariable } from '../types/api';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

export function validateTemplateVariables(
  variables: Record<string, unknown>,
  schema: TemplateVariable[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Check required variables
  for (const variable of schema) {
    const value = variables[variable.name];

    if (
      variable.required &&
      (value === undefined || value === null || value === '')
    ) {
      errors.push({
        field: variable.name,
        message: `${variable.name} is required`,
        code: 'REQUIRED_FIELD',
      });
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    const typeValid = validateVariableType(value, variable.type);
    if (!typeValid) {
      errors.push({
        field: variable.name,
        message: `${variable.name} must be of type ${variable.type}`,
        code: 'INVALID_TYPE',
      });
      continue;
    }

    // Validation rules
    if (variable.validation) {
      const validationResult = validateVariableRules(
        value,
        variable.validation
      );
      if (!validationResult.valid) {
        errors.push(
          ...validationResult.errors.map(e => ({
            ...e,
            field: variable.name,
          }))
        );
      }
    }

    // Options validation
    if (variable.options && typeof value === 'string') {
      if (!variable.options.includes(value)) {
        errors.push({
          field: variable.name,
          message: `${variable.name} must be one of: ${variable.options.join(', ')}`,
          code: 'INVALID_OPTION',
        });
      }
    }
  }

  // Check for unknown variables
  const knownFields = schema.map(v => v.name);
  for (const fieldName of Object.keys(variables)) {
    if (!knownFields.includes(fieldName)) {
      warnings.push({
        field: fieldName,
        message: `${fieldName} is not defined in the template schema`,
        code: 'UNKNOWN_FIELD',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateVariableType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return (
        typeof value === 'object' && value !== null && !Array.isArray(value)
      );
    default:
      return true; // Unknown type, assume valid
  }
}

function validateVariableRules(
  value: unknown,
  rules: NonNullable<TemplateVariable['validation']>
): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof value === 'string') {
    if (rules.pattern) {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        errors.push({
          field: '',
          message: `Value does not match required pattern: ${rules.pattern}`,
          code: 'PATTERN_MISMATCH',
        });
      }
    }

    if (rules.minLength !== undefined && value.length < rules.minLength) {
      errors.push({
        field: '',
        message: `Must be at least ${rules.minLength} characters long`,
        code: 'MIN_LENGTH',
      });
    }

    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      errors.push({
        field: '',
        message: `Must be no more than ${rules.maxLength} characters long`,
        code: 'MAX_LENGTH',
      });
    }
  }

  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      errors.push({
        field: '',
        message: `Must be at least ${rules.min}`,
        code: 'MIN_VALUE',
      });
    }

    if (rules.max !== undefined && value > rules.max) {
      errors.push({
        field: '',
        message: `Must be no more than ${rules.max}`,
        code: 'MAX_VALUE',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateFigmaUrl(url: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!url) {
    return { valid: true, errors }; // Optional field
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    errors.push({
      field: 'figmaUrl',
      message: 'Invalid URL format',
      code: 'INVALID_URL',
    });
    return { valid: false, errors };
  }

  // Figma-specific validation
  const figmaPattern =
    /^https:\/\/www\.figma\.com\/(file|design)\/[a-zA-Z0-9]+/;
  if (!figmaPattern.test(url)) {
    errors.push({
      field: 'figmaUrl',
      message: 'Must be a valid Figma file or design URL',
      code: 'INVALID_FIGMA_URL',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateEmail(email: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!email) {
    errors.push({
      field: 'email',
      message: 'Email is required',
      code: 'REQUIRED_FIELD',
    });
    return { valid: false, errors };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    errors.push({
      field: 'email',
      message: 'Invalid email format',
      code: 'INVALID_EMAIL',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function sanitizeInput(input: string): string {
  // Basic XSS prevention
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function validateJson(jsonString: string): ValidationResult {
  const errors: ValidationError[] = [];

  try {
    JSON.parse(jsonString);
  } catch (error) {
    errors.push({
      field: 'json',
      message: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      code: 'INVALID_JSON',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

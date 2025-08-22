/**
 * @fileoverview Variable validator for template variables
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: Variable validation and usage analysis
 * Main APIs: VariableValidator class
 * Constraints: Variable definition and usage consistency
 * Patterns: Static analysis pattern
 */

import BaseValidator from './base.validator';
import { ValidationContext, ValidationResult } from './validation-pipeline';
import { Template } from '../services/template.service';

export default class VariableValidator extends BaseValidator {
  constructor() {
    super('VariableValidator');
  }

  static async validate(context: ValidationContext): Promise<ValidationResult> {
    const template = context.data as Template;
    const errors: Array<ReturnType<typeof BaseValidator.error>> = [];
    const warnings: Array<ReturnType<typeof BaseValidator.warning>> = [];

    if (!template.variables) {
      return BaseValidator.success(template);
    }

    // Extract all variables used in template
    const usedVariables = new Set<string>();

    // Check files for variable usage
    template.files?.forEach(file => {
      const vars = VariableValidator.extractVariables(file.content);
      vars.forEach(v => usedVariables.add(v));

      if (file.path) {
        const pathVars = VariableValidator.extractVariables(file.path);
        pathVars.forEach(v => usedVariables.add(v));
      }
    });

    // Check commands for variable usage
    template.commands?.forEach(cmd => {
      const vars = VariableValidator.extractVariables(cmd.command);
      vars.forEach(v => usedVariables.add(v));
    });

    // Validate variable definitions
    Object.entries(template.variables).forEach(([key, config]) => {
      const varPath = `variables.${key}`;

      // Check type
      if (!config.type) {
        errors.push(
          BaseValidator.error(
            `Variable ${key} has no type defined`,
            varPath,
            'MISSING_TYPE'
          )
        );
      }

      // Check if defined but not used
      if (!usedVariables.has(key)) {
        warnings.push(
          BaseValidator.warning(
            `Variable ${key} is defined but never used`,
            varPath,
            'UNUSED_VARIABLE'
          )
        );
      }

      // Validate default value type
      if (config.default !== undefined) {
        const defaultType = VariableValidator.getType(config.default);
        if (defaultType !== config.type && config.type !== 'array') {
          warnings.push(
            BaseValidator.warning(
              `Variable ${key} default value type (${defaultType}) doesn't match declared type (${config.type})`,
              `${varPath}.default`,
              'TYPE_MISMATCH'
            )
          );
        }
      }

      // Check required variables have defaults or are marked as required
      if (config.required && config.default === undefined) {
        warnings.push(
          BaseValidator.warning(
            `Required variable ${key} has no default value`,
            varPath,
            'NO_DEFAULT'
          )
        );
      }
    });

    // Check for used but undefined variables
    usedVariables.forEach(varName => {
      if (!template.variables[varName]) {
        errors.push(
          BaseValidator.error(
            `Variable ${varName} is used but not defined`,
            `variables.${varName}`,
            'UNDEFINED_VARIABLE'
          )
        );
      }
    });

    if (errors.length > 0) {
      return {
        valid: false,
        errors,
        warnings,
      };
    }

    return {
      valid: true,
      errors: [],
      warnings,
      data: template,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async validate(context: ValidationContext): Promise<ValidationResult> {
    return VariableValidator.validate(context);
  }

  private static extractVariables(text: string): string[] {
    const pattern = /\{\{(\s*[\w.]+\s*)\}\}/g;
    const variables: string[] = [];
    let match = pattern.exec(text);

    while (match !== null) {
      variables.push(match[1].trim());
      match = pattern.exec(text);
    }

    return variables;
  }

  private static getType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}

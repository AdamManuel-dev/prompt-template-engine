/**
 * @fileoverview Template-specific validators
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: Specialized validators for template validation
 * Main APIs: TemplateStructureValidator, VariableValidator
 * Constraints: Template-specific rules and constraints
 * Patterns: Domain-specific validation
 */

import { BaseValidator } from './base.validator';
import { ValidationContext, ValidationResult } from './validation-pipeline';
import { Template } from '../services/template.service';

export class TemplateStructureValidator extends BaseValidator {
  constructor() {
    super('TemplateStructureValidator');
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const template = context.data as Template;
    const errors = [];
    const warnings = [];

    // Validate required fields
    if (!template.name) {
      errors.push(
        BaseValidator.error(
          'Template name is required',
          'name',
          'REQUIRED_FIELD'
        )
      );
    }

    if (!template.version) {
      errors.push(
        BaseValidator.error(
          'Template version is required',
          'version',
          'REQUIRED_FIELD'
        )
      );
    }

    // Validate version format (semver)
    if (
      template.version &&
      !TemplateStructureValidator.isValidSemver(template.version)
    ) {
      errors.push(
        BaseValidator.error(
          'Template version must be valid semver (e.g., 1.0.0)',
          'version',
          'INVALID_VERSION'
        )
      );
    }

    // Validate files
    if (!template.files || !Array.isArray(template.files)) {
      warnings.push(
        BaseValidator.warning(
          'Template has no files defined',
          'files',
          'NO_FILES'
        )
      );
    } else {
      template.files.forEach((file, index) => {
        const filePath = `files[${index}]`;

        if (!file.path && !file.name) {
          errors.push(
            BaseValidator.error(
              `File at index ${index} has no path or name`,
              filePath,
              'MISSING_PATH'
            )
          );
        }

        if (!file.content) {
          warnings.push(
            BaseValidator.warning(
              `File ${file.path || file.name} has no content`,
              `${filePath}.content`,
              'NO_CONTENT'
            )
          );
        }
      });
    }

    // Validate commands
    if (template.commands && Array.isArray(template.commands)) {
      template.commands.forEach((cmd, index) => {
        const cmdPath = `commands[${index}]`;

        if (!cmd.command) {
          errors.push(
            BaseValidator.error(
              `Command at index ${index} has no command string`,
              cmdPath,
              'MISSING_COMMAND'
            )
          );
        }
      });
    }

    // Validate metadata
    if (template.metadata) {
      if (
        template.metadata.created &&
        !TemplateStructureValidator.isValidDate(template.metadata.created)
      ) {
        warnings.push(
          BaseValidator.warning(
            'Invalid created date format',
            'metadata.created',
            'INVALID_DATE'
          )
        );
      }

      if (
        template.metadata.updated &&
        !TemplateStructureValidator.isValidDate(template.metadata.updated)
      ) {
        warnings.push(
          BaseValidator.warning(
            'Invalid updated date format',
            'metadata.updated',
            'INVALID_DATE'
          )
        );
      }
    }

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

  private static isValidSemver(version: string): boolean {
    const semverRegex =
      /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
    return semverRegex.test(version);
  }

  private static isValidDate(date: string): boolean {
    const parsed = Date.parse(date);
    return !Number.isNaN(parsed);
  }
}

export class VariableValidator extends BaseValidator {
  constructor() {
    super('VariableValidator');
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
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

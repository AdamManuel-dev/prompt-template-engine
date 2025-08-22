/**
 * @fileoverview Template-specific validators
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: Specialized validators for template validation
 * Main APIs: TemplateStructureValidator, VariableValidator
 * Constraints: Template-specific rules and constraints
 * Patterns: Domain-specific validation
 */

import BaseValidator from './base.validator';
import { ValidationContext, ValidationResult } from './validation-pipeline';
import { Template } from '../services/template.service';

export default class TemplateStructureValidator extends BaseValidator {
  constructor() {
    super('TemplateStructureValidator');
  }

  static async validate(context: ValidationContext): Promise<ValidationResult> {
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

  // eslint-disable-next-line class-methods-use-this
  async validate(context: ValidationContext): Promise<ValidationResult> {
    return TemplateStructureValidator.validate(context);
  }
}

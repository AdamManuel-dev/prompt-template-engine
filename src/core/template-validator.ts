/**
 * @fileoverview Template validator for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T19:00:00Z
 *
 * Features: Template structure and schema validation
 * Main APIs: TemplateValidator.validate()
 * Constraints: Validates template schema and structure
 * Patterns: Schema validation, error collection
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface VariableDefinition {
  type: 'string' | 'number' | 'boolean' | 'choice';
  description?: string;
  default?: unknown;
  required?: boolean;
  choices?: string[];
  pattern?: string;
}

export interface FileDefinition {
  path?: string;
  name?: string;
  source?: string;
  destination?: string;
  content?: string;
  template?: string;
  permissions?: string;
}

export interface CommandDefinition {
  command: string;
  description?: string;
  condition?: string;
}

export interface TemplateSchema {
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  variables?: Record<string, VariableDefinition>;
  files?: FileDefinition[];
  commands?: CommandDefinition[];
}

export class TemplateValidator {
  /**
   * Validate a template against the schema
   */
  async validate(template: unknown): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!template || typeof template !== 'object') {
      errors.push('Template must be a non-null object');
      return { valid: false, errors };
    }

    const templateObj = template as Record<string, unknown>;

    // Validate required fields
    if (!templateObj.name || typeof templateObj.name !== 'string') {
      errors.push('Template must have a name field of type string');
    }

    if (
      !templateObj.description ||
      typeof templateObj.description !== 'string'
    ) {
      errors.push('Template must have a description field of type string');
    }

    if (!templateObj.version || typeof templateObj.version !== 'string') {
      errors.push('Template must have a version field of type string');
    }

    // Validate optional fields
    if (templateObj.author && typeof templateObj.author !== 'string') {
      errors.push('Template author must be a string');
    }

    if (templateObj.tags) {
      if (!Array.isArray(templateObj.tags)) {
        errors.push('Template tags must be an array');
      } else {
        const invalidTags = (templateObj.tags as unknown[]).filter(
          tag => typeof tag !== 'string'
        );
        if (invalidTags.length > 0) {
          errors.push('All template tags must be strings');
        }
      }
    }

    // Validate variables
    if (templateObj.variables) {
      const variablesErrors = this.validateVariables(templateObj.variables);
      errors.push(...variablesErrors);
    }

    // Validate files
    if (templateObj.files) {
      const filesErrors = this.validateFiles(templateObj.files);
      errors.push(...filesErrors);
    }

    // Validate commands
    if (templateObj.commands) {
      const commandsErrors = this.validateCommands(templateObj.commands);
      errors.push(...commandsErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate variables definition
   */
  // eslint-disable-next-line class-methods-use-this
  private validateVariables(variables: unknown): string[] {
    const errors: string[] = [];

    if (typeof variables !== 'object' || variables === null) {
      errors.push('Variables must be an object');
      return errors;
    }

    const variablesObj = variables as Record<string, unknown>;

    Object.entries(variablesObj).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') {
        errors.push(`Variable '${key}' must be an object`);
        return;
      }

      const variable = value as Record<string, unknown>;

      // Validate type
      const validTypes = ['string', 'number', 'boolean', 'choice'];
      if (!variable.type || !validTypes.includes(variable.type as string)) {
        errors.push(
          `Variable '${key}' must have a valid type: ${validTypes.join(', ')}`
        );
      }

      // Validate choice type
      if (variable.type === 'choice') {
        if (!variable.choices || !Array.isArray(variable.choices)) {
          errors.push(
            `Variable '${key}' of type 'choice' must have a choices array`
          );
        } else if ((variable.choices as unknown[]).length === 0) {
          errors.push(`Variable '${key}' choices array cannot be empty`);
        }
      }

      // Validate description
      if (variable.description && typeof variable.description !== 'string') {
        errors.push(`Variable '${key}' description must be a string`);
      }

      // Validate pattern for string type
      if (variable.pattern && typeof variable.pattern !== 'string') {
        errors.push(`Variable '${key}' pattern must be a string`);
      }
    });

    return errors;
  }

  /**
   * Validate files definition
   */
  // eslint-disable-next-line class-methods-use-this
  private validateFiles(files: unknown): string[] {
    const errors: string[] = [];

    if (!Array.isArray(files)) {
      errors.push('Files must be an array');
      return errors;
    }

    files.forEach((file, index) => {
      if (!file || typeof file !== 'object') {
        errors.push(`File at index ${index} must be an object`);
        return;
      }

      const fileObj = file as Record<string, unknown>;

      // Must have either path or name
      if (!fileObj.path && !fileObj.name) {
        errors.push(
          `File at index ${index} must have either 'path' or 'name' field`
        );
      }

      // Must have either content, template, or source
      if (!fileObj.content && !fileObj.template && !fileObj.source) {
        errors.push(
          `File at index ${index} must have 'content', 'template', or 'source' field`
        );
      }

      // If source is provided, destination is required
      if (fileObj.source && !fileObj.destination) {
        errors.push(
          `File at index ${index} with 'source' must also have 'destination' field`
        );
      }

      // Validate permissions format
      if (
        fileObj.permissions &&
        typeof fileObj.permissions === 'string' &&
        !/^[0-7]{3,4}$/.test(fileObj.permissions)
      ) {
        errors.push(
          `File at index ${index} has invalid permissions format: ${fileObj.permissions}`
        );
      }
    });

    return errors;
  }

  /**
   * Validate commands definition
   */
  // eslint-disable-next-line class-methods-use-this
  private validateCommands(commands: unknown): string[] {
    const errors: string[] = [];

    if (!Array.isArray(commands)) {
      errors.push('Commands must be an array');
      return errors;
    }

    commands.forEach((command, index) => {
      if (typeof command === 'string') {
        // Simple string command is valid
        return;
      }

      if (!command || typeof command !== 'object') {
        errors.push(`Command at index ${index} must be a string or object`);
        return;
      }

      const commandObj = command as Record<string, unknown>;

      if (!commandObj.command || typeof commandObj.command !== 'string') {
        errors.push(
          `Command at index ${index} must have a 'command' field of type string`
        );
      }

      if (
        commandObj.description &&
        typeof commandObj.description !== 'string'
      ) {
        errors.push(`Command at index ${index} description must be a string`);
      }

      if (commandObj.condition && typeof commandObj.condition !== 'string') {
        errors.push(`Command at index ${index} condition must be a string`);
      }
    });

    return errors;
  }
}

/* eslint-disable class-methods-use-this */
/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @fileoverview Validate command for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T18:30:00Z
 *
 * Features: Template validation with comprehensive checks
 * Main APIs: validateCommand() - validates template structure and integrity
 * Constraints: Validates required fields, file references, and variable definitions
 * Patterns: Template loading, schema validation, detailed error reporting
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import {
  TemplateEngineError,
  ValidationError,
  FileNotFoundError,
} from '../utils/errors';
import { loadConfig, Config } from '../utils/config';
import {
  ValidationResult,
  ValidationError as IValidationError,
  ValidationWarning,
} from '../types';

export interface ValidateOptions {
  strict?: boolean;
  fix?: boolean;
  format?: 'table' | 'json' | 'yaml';
  detailed?: boolean;
}

export interface TemplateValidationResult extends ValidationResult {
  templatePath: string;
  templateName: string;
  schema: {
    hasRequiredFields: boolean;
    hasValidFileReferences: boolean;
    hasValidVariables: boolean;
  };
}

/**
 * Template validator class
 */
class TemplateValidator {
  private strict: boolean;

  constructor(options: { strict?: boolean } = {}) {
    this.strict = options.strict ?? false;
  }

  /**
   * Validate a loaded template configuration
   */
  async validateTemplate(
    template: unknown,
    templatePath: string
  ): Promise<TemplateValidationResult> {
    const errors: IValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const templateName = this.extractTemplateName(template, templatePath);

    // Initialize schema validation flags
    const schema = {
      hasRequiredFields: false,
      hasValidFileReferences: false,
      hasValidVariables: false,
    };

    try {
      // Validate basic structure
      this.validateBasicStructure(template, errors);

      // Validate required fields
      schema.hasRequiredFields = this.validateRequiredFields(template, errors);

      // Validate file references if template has files
      schema.hasValidFileReferences = await this.validateFileReferences(
        template,
        templatePath,
        errors,
        warnings
      );

      // Validate variable definitions
      schema.hasValidVariables = this.validateVariableDefinitions(
        template,
        errors,
        warnings
      );

      // Strict mode additional validations
      if (this.strict) {
        this.performStrictValidations(template, templatePath, errors, warnings);
      }
    } catch (error) {
      errors.push({
        code: 'VALIDATION_EXCEPTION',
        message: `Validation failed: ${error}`,
        file: templatePath,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      templatePath,
      templateName,
      schema,
    };
  }

  /**
   * Extract template name from template or path
   */
  private extractTemplateName(template: unknown, templatePath: string): string {
    if (
      this.isObject(template) &&
      typeof (template as Record<string, unknown>).name === 'string'
    ) {
      return (template as Record<string, unknown>).name as string;
    }
    return path.basename(templatePath, path.extname(templatePath));
  }

  /**
   * Validate basic template structure
   */
  private validateBasicStructure(
    template: unknown,
    errors: IValidationError[]
  ): void {
    if (!template) {
      errors.push({
        code: 'EMPTY_TEMPLATE',
        message: 'Template is empty or null',
      });
      return;
    }

    if (!this.isObject(template)) {
      errors.push({
        code: 'INVALID_TEMPLATE_TYPE',
        message: 'Template must be an object',
      });
    }
  }

  /**
   * Validate required fields
   */
  private validateRequiredFields(
    template: unknown,
    errors: IValidationError[]
  ): boolean {
    if (!this.isObject(template)) return false;

    const templateObj = template as Record<string, unknown>;
    const requiredFields = ['name', 'description', 'version'];
    let allFieldsValid = true;

    requiredFields.forEach(field => {
      if (!(field in templateObj) || !templateObj[field]) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `Missing required field: ${field}`,
        });
        allFieldsValid = false;
      } else if (typeof templateObj[field] !== 'string') {
        errors.push({
          code: 'INVALID_FIELD_TYPE',
          message: `Field '${field}' must be a string`,
        });
        allFieldsValid = false;
      } else if ((templateObj[field] as string).trim().length === 0) {
        errors.push({
          code: 'EMPTY_REQUIRED_FIELD',
          message: `Required field '${field}' cannot be empty`,
        });
        allFieldsValid = false;
      }
    });

    return allFieldsValid;
  }

  /**
   * Validate file references exist
   */
  private async validateFileReferences(
    template: unknown,
    templatePath: string,
    errors: IValidationError[],
    warnings: ValidationWarning[]
  ): Promise<boolean> {
    if (!this.isObject(template)) return false;

    const templateObj = template as Record<string, unknown>;
    const { files } = templateObj;

    // If no files array, that's valid but we'll warn in strict mode
    if (!files) {
      if (this.strict) {
        warnings.push({
          code: 'NO_FILES_DEFINED',
          message: 'Template has no files defined',
          suggestion:
            'Consider adding a files array if this template should create files',
        });
      }
      return true;
    }

    if (!Array.isArray(files)) {
      errors.push({
        code: 'INVALID_FILES_TYPE',
        message: 'Template files must be an array',
      });
      return false;
    }

    if (files.length === 0) {
      warnings.push({
        code: 'EMPTY_FILES_ARRAY',
        message: 'Template has empty files array',
        suggestion: 'Remove the files array or add file definitions',
      });
      return true;
    }

    const templateDir = path.dirname(templatePath);
    let allFilesValid = true;

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const fileIndex = `files[${i}]`;

      if (!this.isObject(file)) {
        errors.push({
          code: 'INVALID_FILE_TYPE',
          message: `${fileIndex} must be an object`,
        });
        allFilesValid = false;
        continue;
      }

      const fileObj = file as Record<string, unknown>;

      // Validate required file properties
      if (!fileObj.source || typeof fileObj.source !== 'string') {
        errors.push({
          code: 'MISSING_FILE_SOURCE',
          message: `${fileIndex} missing required 'source' property`,
        });
        allFilesValid = false;
        continue;
      }

      if (!fileObj.destination || typeof fileObj.destination !== 'string') {
        errors.push({
          code: 'MISSING_FILE_DESTINATION',
          message: `${fileIndex} missing required 'destination' property`,
        });
        allFilesValid = false;
        continue;
      }

      // Check if source file exists
      const sourcePath = path.resolve(templateDir, fileObj.source as string);
      try {
        await fs.access(sourcePath);
      } catch {
        errors.push({
          code: 'SOURCE_FILE_NOT_FOUND',
          message: `${fileIndex} source file not found: ${fileObj.source}`,
          file: sourcePath,
        });
        allFilesValid = false;
      }

      // Validate permissions format if specified
      if (
        fileObj.permissions &&
        typeof fileObj.permissions === 'string' &&
        !/^[0-7]{3,4}$/.test(fileObj.permissions)
      ) {
        errors.push({
          code: 'INVALID_PERMISSIONS',
          message: `${fileIndex} invalid permissions format: ${fileObj.permissions}`,
        });
        allFilesValid = false;
      }
    }

    return allFilesValid;
  }

  /**
   * Validate variable definitions
   */
  private validateVariableDefinitions(
    template: unknown,
    errors: IValidationError[],
    warnings: ValidationWarning[]
  ): boolean {
    if (!this.isObject(template)) return false;

    const templateObj = template as Record<string, unknown>;
    const { variables } = templateObj;

    // Variables are optional
    if (!variables) return true;

    if (!this.isObject(variables)) {
      errors.push({
        code: 'INVALID_VARIABLES_TYPE',
        message: 'Template variables must be an object',
      });
      return false;
    }

    const variablesObj = variables as Record<string, unknown>;
    let allVariablesValid = true;

    Object.entries(variablesObj).forEach(([varName, varDef]) => {
      if (!this.isObject(varDef)) {
        errors.push({
          code: 'INVALID_VARIABLE_TYPE',
          message: `Variable '${varName}' must be an object`,
        });
        allVariablesValid = false;
        return;
      }

      const variable = varDef as Record<string, unknown>;

      // Validate variable type
      const validTypes = ['string', 'number', 'boolean', 'choice'];
      if (
        !variable.type ||
        typeof variable.type !== 'string' ||
        !validTypes.includes(variable.type)
      ) {
        errors.push({
          code: 'INVALID_VARIABLE_TYPE_VALUE',
          message: `Variable '${varName}' has invalid type. Must be one of: ${validTypes.join(', ')}`,
        });
        allVariablesValid = false;
      }

      // Validate description
      if (!variable.description || typeof variable.description !== 'string') {
        errors.push({
          code: 'MISSING_VARIABLE_DESCRIPTION',
          message: `Variable '${varName}' must have a description`,
        });
        allVariablesValid = false;
      }

      // Validate choices for choice type
      if (variable.type === 'choice') {
        if (!variable.choices || !Array.isArray(variable.choices)) {
          errors.push({
            code: 'MISSING_VARIABLE_CHOICES',
            message: `Variable '${varName}' of type 'choice' must have a choices array`,
          });
          allVariablesValid = false;
        } else if ((variable.choices as unknown[]).length === 0) {
          errors.push({
            code: 'EMPTY_VARIABLE_CHOICES',
            message: `Variable '${varName}' must have at least one choice`,
          });
          allVariablesValid = false;
        }
      }

      // Validate default value type consistency
      if (variable.default !== undefined) {
        const defaultType = typeof variable.default;
        if (variable.type === 'number' && defaultType !== 'number') {
          warnings.push({
            code: 'VARIABLE_TYPE_MISMATCH',
            message: `Variable '${varName}' default value type doesn't match variable type`,
            suggestion: `Convert default value to ${variable.type}`,
          });
        }
      }
    });

    return allVariablesValid;
  }

  /**
   * Perform strict mode validations
   */
  private performStrictValidations(
    template: unknown,
    templatePath: string,
    errors: IValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!this.isObject(template)) return;

    const templateObj = template as Record<string, unknown>;

    // Check for recommended fields
    const recommendedFields = ['author', 'tags', 'type'];
    recommendedFields.forEach(field => {
      if (!(field in templateObj) || !templateObj[field]) {
        warnings.push({
          code: 'MISSING_RECOMMENDED_FIELD',
          message: `Missing recommended field: ${field}`,
          suggestion: `Consider adding '${field}' for better template discoverability`,
        });
      }
    });

    // Validate version format
    if (templateObj.version && typeof templateObj.version === 'string') {
      const versionPattern = /^\d+\.\d+\.\d+(-\w+)?$/;
      if (!versionPattern.test(templateObj.version)) {
        warnings.push({
          code: 'INVALID_VERSION_FORMAT',
          message: 'Version should follow semantic versioning (e.g., 1.0.0)',
          suggestion: 'Use format: MAJOR.MINOR.PATCH',
        });
      }
    }

    // Check for template file naming conventions
    const fileName = path.basename(templatePath);
    if (!fileName.startsWith('template.') && !fileName.includes('template')) {
      warnings.push({
        code: 'TEMPLATE_NAMING_CONVENTION',
        message: 'Template file should follow naming convention',
        suggestion:
          'Consider naming template files as template.json or include "template" in the name',
      });
    }

    // Validate tags if present
    if (templateObj.tags) {
      if (!Array.isArray(templateObj.tags)) {
        errors.push({
          code: 'INVALID_TAGS_TYPE',
          message: 'Template tags must be an array',
        });
      } else {
        const tags = templateObj.tags as unknown[];
        const invalidTags = tags.filter(tag => typeof tag !== 'string');
        if (invalidTags.length > 0) {
          errors.push({
            code: 'INVALID_TAG_TYPE',
            message: 'All tags must be strings',
          });
        }
      }
    }
  }

  /**
   * Type guard for objects
   */
  private isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}

/**
 * Load template from file path
 */
async function loadTemplate(templatePath: string): Promise<unknown> {
  try {
    const stats = await fs.stat(templatePath);

    if (stats.isDirectory()) {
      // Load from template.json in directory
      const templateJsonPath = path.join(templatePath, 'template.json');
      try {
        const content = await fs.readFile(templateJsonPath, 'utf-8');
        const template = JSON.parse(content);
        // Add base path for relative file resolution
        (template as Record<string, unknown>).basePath = templatePath;
        return template;
      } catch (error) {
        throw new FileNotFoundError(
          `Template directory must contain template.json`,
          templateJsonPath,
          { originalError: error }
        );
      }
    } else {
      // Load from single file
      const content = await fs.readFile(templatePath, 'utf-8');

      if (templatePath.endsWith('.json')) {
        return JSON.parse(content);
      }
      if (templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')) {
        try {
          return yaml.load(content) as any;
        } catch (yamlError: unknown) {
          throw new TemplateEngineError(
            `Invalid YAML format: ${yamlError instanceof Error ? yamlError.message : 'Unknown YAML parsing error'}`,
            { templatePath, yamlError },
            'INVALID_YAML'
          );
        }
      } else {
        throw new TemplateEngineError(
          `Unsupported template format: ${path.extname(templatePath)}`,
          { templatePath },
          'UNSUPPORTED_FORMAT'
        );
      }
    }
  } catch (error) {
    if (error instanceof TemplateEngineError) {
      throw error;
    }

    if ((error as { code?: string }).code === 'ENOENT') {
      throw new FileNotFoundError(
        `Template file not found: ${templatePath}`,
        templatePath
      );
    }

    throw new TemplateEngineError(
      `Failed to load template: ${error}`,
      { templatePath },
      'TEMPLATE_LOAD_ERROR'
    );
  }
}

/**
 * Find template file in configured paths
 */
async function findTemplate(
  templateName: string,
  config: Config
): Promise<string | null> {
  // If templateName is an absolute path, use it directly
  if (path.isAbsolute(templateName)) {
    try {
      await fs.access(templateName);
      return templateName;
    } catch {
      return null;
    }
  }

  // If templateName is a relative path from cwd, try it first
  const relativePath = path.resolve(process.cwd(), templateName);
  try {
    await fs.access(relativePath);
    return relativePath;
  } catch {
    // Continue searching in configured paths
  }

  // Search in configured template paths
  const searchPaths = [
    ...config.templatePaths,
    path.join(process.cwd(), 'templates'),
    path.join(process.cwd(), '.cursor-prompt', 'templates'),
  ];

  for (const searchPath of searchPaths) {
    try {
      await fs.access(searchPath);

      // Try direct file match
      const directPath = path.join(searchPath, templateName);
      try {
        await fs.access(directPath);
        return directPath;
      } catch {
        // Continue searching
      }

      // Try with extensions
      const extensions = ['.json', '.template.json', '.yaml', '.yml'];
      for (const ext of extensions) {
        const extPath = path.join(searchPath, `${templateName}${ext}`);
        try {
          await fs.access(extPath);
          return extPath;
        } catch {
          // Continue searching
        }
      }

      // Try as directory with template.json
      const dirPath = path.join(searchPath, templateName, 'template.json');
      try {
        await fs.access(dirPath);
        return path.dirname(dirPath);
      } catch {
        // Continue searching
      }
    } catch {
      // Search path doesn't exist, continue
    }
  }

  return null;
}

/**
 * Display validation results
 */
function displayResults(
  results: TemplateValidationResult[],
  options: ValidateOptions
): void {
  switch (options.format) {
    case 'json':
      logger.info(JSON.stringify(results, null, 2));
      break;

    case 'yaml':
      // Simple YAML-like output
      results.forEach((result, index) => {
        logger.info(`- template: ${result.templateName}`);
        logger.info(`  path: ${result.templatePath}`);
        logger.info(`  valid: ${result.valid}`);
        logger.info(`  errors: ${result.errors.length}`);
        logger.info(`  warnings: ${result.warnings.length}`);
        if (index < results.length - 1) logger.info('');
      });
      break;

    case 'table':
    default:
      displayTableResults(results, options);
      break;
  }
}

/**
 * Display results in table format
 */
function displayTableResults(
  results: TemplateValidationResult[],
  options: ValidateOptions
): void {
  logger.info('');

  results.forEach((result, index) => {
    // Template header
    const status = result.valid
      ? chalk.green('✅ VALID')
      : chalk.red('❌ INVALID');
    logger.info(chalk.cyan(`📋 ${result.templateName} ${status}`));
    logger.info(chalk.gray(`   Path: ${result.templatePath}`));

    // Schema validation summary
    if (options.detailed) {
      logger.info(chalk.gray('   Schema:'));
      logger.info(
        chalk.gray(
          `     Required fields: ${result.schema.hasRequiredFields ? '✅' : '❌'}`
        )
      );
      logger.info(
        chalk.gray(
          `     File references: ${result.schema.hasValidFileReferences ? '✅' : '❌'}`
        )
      );
      logger.info(
        chalk.gray(
          `     Variables: ${result.schema.hasValidVariables ? '✅' : '❌'}`
        )
      );
    }

    // Display errors
    if (result.errors.length > 0) {
      logger.info(chalk.red(`\n   Errors (${result.errors.length}):`));
      result.errors.forEach(error => {
        logger.info(chalk.red(`     • [${error.code}] ${error.message}`));
        if (error.file && options.detailed) {
          logger.info(chalk.gray(`       File: ${error.file}`));
        }
        if (error.line && options.detailed) {
          logger.info(
            chalk.gray(
              `       Line: ${error.line}${error.column ? `, Column: ${error.column}` : ''}`
            )
          );
        }
      });
    }

    // Display warnings
    if (result.warnings.length > 0) {
      logger.info(chalk.yellow(`\n   Warnings (${result.warnings.length}):`));
      result.warnings.forEach(warning => {
        logger.info(
          chalk.yellow(`     • [${warning.code}] ${warning.message}`)
        );
        if (warning.suggestion && options.detailed) {
          logger.info(chalk.gray(`       Suggestion: ${warning.suggestion}`));
        }
        if (warning.file && options.detailed) {
          logger.info(chalk.gray(`       File: ${warning.file}`));
        }
      });
    }

    // Add spacing between templates
    if (index < results.length - 1) {
      logger.info('');
    }
  });

  logger.info('');

  // Summary
  const validCount = results.filter(r => r.valid).length;
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  logger.info(chalk.cyan('📊 Validation Summary:'));
  logger.info(`   Templates validated: ${results.length}`);
  logger.info(`   Valid: ${chalk.green(validCount)}`);
  logger.info(`   Invalid: ${chalk.red(results.length - validCount)}`);
  logger.info(`   Total errors: ${chalk.red(totalErrors)}`);
  logger.info(`   Total warnings: ${chalk.yellow(totalWarnings)}`);
}

/**
 * Validate template command
 */
export async function validateCommand(
  templatePath: string,
  options: ValidateOptions = {}
): Promise<void> {
  try {
    logger.info('🔍 Validating template...');

    // Load configuration
    const config = await loadConfig();

    // Find template
    const resolvedPath = await findTemplate(templatePath, config);
    if (!resolvedPath) {
      throw new FileNotFoundError(
        `Template not found: ${templatePath}`,
        templatePath
      );
    }

    logger.debug(`Found template at: ${resolvedPath}`);

    // Load template
    const template = await loadTemplate(resolvedPath);

    // Initialize validator
    const validator = new TemplateValidator({
      strict: options.strict,
    });

    // Validate template
    const result = await validator.validateTemplate(template, resolvedPath);

    // Display results
    displayResults([result], options);

    // Set exit status based on validation result
    if (!result.valid) {
      if (result.errors.length > 0) {
        logger.error('❌ Template validation failed with errors');
        throw new ValidationError(
          `Template validation failed: ${result.errors.length} error(s)`,
          'templatePath',
          templatePath,
          'TEMPLATE_VALIDATION',
          { errors: result.errors },
          'VALIDATION_FAILED'
        );
      }
    } else {
      const warningText =
        result.warnings.length > 0
          ? ` with ${result.warnings.length} warning(s)`
          : '';
      logger.success(`✅ Template validation passed${warningText}`);
    }
  } catch (error) {
    if (error instanceof TemplateEngineError) {
      logger.error(`❌ Validation failed: ${error.message}`);
      throw error;
    } else {
      logger.error(`❌ Unexpected error during validation: ${error}`);
      throw new TemplateEngineError(
        `Validation command failed: ${error}`,
        undefined,
        'VALIDATE_ERROR'
      );
    }
  }
}

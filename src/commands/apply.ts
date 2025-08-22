/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @fileoverview Apply command implementation for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T11:50:00Z
 *
 * Features: Apply prompt templates to current project
 * Main APIs: applyCommand()
 * Constraints: Requires valid template in templates directory
 * Patterns: Uses template validation and file system operations
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { TemplateEngine } from '../core/template-engine';
import { TemplateValidator } from '../core/template-validator';
import { loadConfig } from '../utils/config';

export interface ApplyOptions {
  force?: boolean;
  preview?: boolean;
  variables?: Record<string, string>;
}

interface ApplyResult {
  success: boolean;
  filesCreated: string[];
  filesUpdated: string[];
  filesSkipped: string[];
  errors: string[];
}

/**
 * Apply a prompt template to the current project
 */
export async function applyCommand(
  templateName: string,
  options: ApplyOptions = {}
): Promise<void> {
  try {
    logger.info(chalk.blue(`⚡ Applying template: ${templateName}`));

    // Load configuration
    const config = await loadConfig();
    const templateDirs = config.templatePaths;

    // Find template
    const templatePath = await findTemplate(templateName, templateDirs);
    if (!templatePath) {
      throw new Error(`Template '${templateName}' not found`);
    }

    // Load and validate template
    const template = await loadTemplate(templatePath);
    const validator = new TemplateValidator();
    const validation = await validator.validate(template);

    if (!validation.valid) {
      logger.error(chalk.red('❌ Template validation failed:'));
      validation.errors.forEach(err => {
        logger.error(chalk.red(`  - ${err}`));
      });
      throw new Error('Invalid template');
    }

    // Preview mode
    if (options.preview) {
      logger.info(
        chalk.yellow('\n📋 Preview mode - no files will be modified')
      );
      await previewApply(template, options);
      return;
    }

    // Apply template
    const result = await applyTemplate(template, options);

    // Report results
    reportApplyResults(result);

    if (!result.success) {
      throw new Error('Template application failed');
    }

    logger.success(chalk.green('\n✅ Template applied successfully!'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(chalk.red(`❌ Apply failed: ${message}`));
    throw error;
  }
}

/**
 * Find template in configured directories
 */
async function findTemplate(
  templateName: string,
  directories: string[]
): Promise<string | null> {
  for (const dir of directories) {
    const templatePath = path.join(dir, templateName);

    // Check for directory with template.json
    const templateJsonPath = path.join(templatePath, 'template.json');
    if (fs.existsSync(templateJsonPath)) {
      return templatePath;
    }

    // Check for .json file
    const jsonPath = `${templatePath}.json`;
    if (fs.existsSync(jsonPath)) {
      return jsonPath;
    }

    // Check for .yaml file
    const yamlPath = `${templatePath}.yaml`;
    if (fs.existsSync(yamlPath)) {
      return yamlPath;
    }
  }

  return null;
}

/**
 * Load template from file
 */
async function loadTemplate(templatePath: string): Promise<any> {
  const stats = fs.statSync(templatePath);

  if (stats.isDirectory()) {
    // Load from template.json in directory
    const templateJsonPath = path.join(templatePath, 'template.json');
    const content = fs.readFileSync(templateJsonPath, 'utf8');
    const template = JSON.parse(content);
    (template as any).basePath = templatePath;
    return template;
  }
  // Load from single file
  const content = fs.readFileSync(templatePath, 'utf8');

  if (templatePath.endsWith('.json')) {
    return JSON.parse(content);
  }
  if (templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')) {
    // TODO: Add YAML support
    throw new Error('YAML templates not yet supported');
  } else {
    throw new Error(
      `Unsupported template format: ${path.extname(templatePath)}`
    );
  }
}

/**
 * Preview template application
 */
async function previewApply(
  template: any,
  options: ApplyOptions
): Promise<void> {
  logger.info(chalk.cyan('\nTemplate Information:'));
  logger.info(`  Name: ${template.name || 'Unknown'}`);
  logger.info(`  Description: ${template.description || 'No description'}`);
  logger.info(`  Version: ${template.version || '1.0.0'}`);

  if (template.files && Array.isArray(template.files)) {
    logger.info(chalk.cyan('\nFiles to be created/updated:'));
    template.files.forEach((file: any) => {
      const filePath = file.path || file.name;
      let action = '(create)';
      if (fs.existsSync(filePath)) {
        action = options.force ? '(overwrite)' : '(skip - exists)';
      }
      logger.info(`  ${filePath} ${chalk.gray(action)}`);
    });
  }

  if (template.variables && Object.keys(template.variables).length > 0) {
    logger.info(chalk.cyan('\nRequired variables:'));
    Object.entries(template.variables).forEach(
      ([key, config]: [string, any]) => {
        const value =
          options.variables?.[key] || config.default || '<not provided>';
        logger.info(`  ${key}: ${value}`);
      }
    );
  }

  if (template.commands && Array.isArray(template.commands)) {
    logger.info(chalk.cyan('\nCommands to execute:'));
    template.commands.forEach((cmd: any) => {
      logger.info(`  ${cmd.command || cmd}`);
    });
  }
}

/**
 * Apply template to project
 */
async function applyTemplate(
  template: any,
  options: ApplyOptions
): Promise<ApplyResult> {
  const result: ApplyResult = {
    success: false,
    filesCreated: [],
    filesUpdated: [],
    filesSkipped: [],
    errors: [],
  };

  try {
    // Initialize template engine
    const engine = new TemplateEngine();

    // Process variables
    const variables = {
      ...getDefaultVariables(),
      ...(template.variables || {}),
      ...(options.variables || {}),
    };

    // Apply files
    if (template.files && Array.isArray(template.files)) {
      for (const file of template.files) {
        try {
          const applied = await applyFile(file, variables, options, engine);
          if (applied.created) {
            result.filesCreated.push(applied.path);
          } else if (applied.updated) {
            result.filesUpdated.push(applied.path);
          } else if (applied.skipped) {
            result.filesSkipped.push(applied.path);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Failed to apply ${file.path || file.name}: ${message}`
          );
        }
      }
    }

    // Execute commands
    if (template.commands && Array.isArray(template.commands)) {
      for (const cmd of template.commands) {
        try {
          await executeCommand(cmd);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to execute command: ${message}`);
        }
      }
    }

    result.success = result.errors.length === 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`Template application error: ${message}`);
  }

  return result;
}

/**
 * Apply individual file from template
 */
async function applyFile(
  file: any,
  variables: Record<string, any>,
  options: ApplyOptions,
  engine: TemplateEngine
): Promise<{
  path: string;
  created?: boolean;
  updated?: boolean;
  skipped?: boolean;
}> {
  const filePath = file.path || file.name;
  const fullPath = path.resolve(filePath);

  // Check if file exists
  const exists = fs.existsSync(fullPath);
  if (exists && !options.force) {
    logger.warn(chalk.yellow(`⚠️  Skipping existing file: ${filePath}`));
    return { path: filePath, skipped: true };
  }

  // Process content
  let content = file.content || '';
  if (file.template) {
    content = await engine.render(file.template, variables);
  }

  // Ensure directory exists
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(fullPath, content, 'utf8');

  if (exists) {
    logger.info(chalk.green(`✓ Updated: ${filePath}`));
    return { path: filePath, updated: true };
  }
  logger.info(chalk.green(`✓ Created: ${filePath}`));
  return { path: filePath, created: true };
}

/**
 * Execute command from template
 */
async function executeCommand(cmd: any): Promise<void> {
  const command = typeof cmd === 'string' ? cmd : cmd.command;
  if (!command) return;

  // TODO: Implement command execution with variable substitution
  logger.info(chalk.gray(`  Would execute: ${command}`));
}

/**
 * Get default variables
 */
function getDefaultVariables(): Record<string, any> {
  return {
    projectName: path.basename(process.cwd()),
    projectPath: process.cwd(),
    timestamp: new Date().toISOString(),
    year: new Date().getFullYear(),
  };
}

/**
 * Report apply results
 */
function reportApplyResults(result: ApplyResult): void {
  logger.info(chalk.cyan('\n📊 Apply Results:'));

  if (result.filesCreated.length > 0) {
    logger.info(chalk.green(`  ✓ Created ${result.filesCreated.length} files`));
  }

  if (result.filesUpdated.length > 0) {
    logger.info(chalk.blue(`  ✓ Updated ${result.filesUpdated.length} files`));
  }

  if (result.filesSkipped.length > 0) {
    logger.info(
      chalk.yellow(`  ⚠ Skipped ${result.filesSkipped.length} files`)
    );
  }

  if (result.errors.length > 0) {
    logger.error(chalk.red(`  ✗ ${result.errors.length} errors occurred:`));
    result.errors.forEach(err => {
      logger.error(chalk.red(`    - ${err}`));
    });
  }
}

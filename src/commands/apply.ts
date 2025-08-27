/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/**
 * @fileoverview Apply command implementation for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: Apply prompt templates to current project
 * Main APIs: applyCommand()
 * Constraints: Requires valid template in templates directory
 * Patterns: Uses template validation and file system operations
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { TemplateEngine } from '../core/template-engine';
import {
  TemplateValidator,
  TemplateSchema,
  FileDefinition,
  CommandDefinition,
  VariableDefinition,
} from '../core/template-validator';
import { loadConfig } from '../utils/config';
import { ApplyCommandSchema } from '../validation/schemas';
import { withValidation } from '../middleware/validation.middleware';

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

interface TemplateWithPath extends TemplateSchema {
  basePath?: string;
}

interface AppliedFile {
  path: string;
  created?: boolean;
  updated?: boolean;
  skipped?: boolean;
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
async function loadTemplate(templatePath: string): Promise<TemplateWithPath> {
  const stats = fs.statSync(templatePath);

  if (stats.isDirectory()) {
    // Load from template.json in directory
    const templateJsonPath = path.join(templatePath, 'template.json');
    const content = fs.readFileSync(templateJsonPath, 'utf8');
    const template: TemplateWithPath = JSON.parse(content);
    template.basePath = templatePath;
    return template;
  }
  // Load from single file
  const content = fs.readFileSync(templatePath, 'utf8');

  if (templatePath.endsWith('.json')) {
    return JSON.parse(content);
  }
  if (templatePath.endsWith('.yaml') || templatePath.endsWith('.yml')) {
    try {
      return yaml.load(content) as TemplateSchema;
    } catch (yamlError: unknown) {
      throw new Error(
        `Invalid YAML format in ${templatePath}: ${yamlError instanceof Error ? yamlError.message : 'Unknown YAML parsing error'}`
      );
    }
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
  template: TemplateWithPath,
  options: ApplyOptions
): Promise<void> {
  logger.info(chalk.cyan('\nTemplate Information:'));
  logger.info(`  Name: ${template.name || 'Unknown'}`);
  logger.info(`  Description: ${template.description || 'No description'}`);
  logger.info(`  Version: ${template.version || '1.0.0'}`);

  if (template.files && Array.isArray(template.files)) {
    logger.info(chalk.cyan('\nFiles to be created/updated:'));
    template.files.forEach((file: FileDefinition) => {
      const filePath = file.path || file.name;
      if (!filePath) {
        logger.warn('  File missing path or name property');
        return;
      }
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
      ([key, config]: [string, VariableDefinition]) => {
        const value =
          options.variables?.[key] || config.default || '<not provided>';
        logger.info(`  ${key}: ${value}`);
      }
    );
  }

  if (template.commands && Array.isArray(template.commands)) {
    logger.info(chalk.cyan('\nCommands to execute:'));
    template.commands.forEach((cmd: CommandDefinition | string) => {
      const commandStr = typeof cmd === 'string' ? cmd : cmd.command;
      logger.info(`  ${commandStr}`);
    });
  }
}

/**
 * Apply template to project
 */
async function applyTemplate(
  template: TemplateWithPath,
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
          await executeCommand(cmd, variables, engine);
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
  file: FileDefinition,
  variables: Record<string, unknown>,
  options: ApplyOptions,
  engine: TemplateEngine
): Promise<AppliedFile> {
  const filePath = file.path || file.name;
  if (!filePath) {
    throw new Error('File must have a path or name property');
  }
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
 * Execute command from template with variable substitution
 */
async function executeCommand(
  cmd: CommandDefinition | string,
  variables: Record<string, unknown>,
  engine: TemplateEngine
): Promise<void> {
  const command = typeof cmd === 'string' ? cmd : cmd.command;
  if (!command) return;

  // Perform variable substitution
  const processedCommand = await engine.render(command, variables);

  if (!processedCommand.trim()) {
    logger.info(
      chalk.gray('  Command is empty after variable substitution, skipping')
    );
    return;
  }

  logger.info(chalk.cyan(`  Executing: ${processedCommand}`));

  try {
    const [executable, ...args] = processedCommand.split(' ');

    return new Promise<void>((resolve, reject) => {
      const child = spawn(executable, args, {
        stdio: 'inherit',
        shell: true,
        cwd: process.cwd(),
      });

      child.on('close', code => {
        if (code === 0) {
          logger.info(chalk.green(`  ✓ Command completed successfully`));
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', error => {
        reject(new Error(`Failed to execute command: ${error.message}`));
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(chalk.red(`  ✗ Command execution failed: ${message}`));
    throw error;
  }
}

/**
 * Get default variables
 */
function getDefaultVariables(): Record<string, unknown> {
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

/**
 * Validated apply command wrapper
 */
export const applyCommandWithValidation = withValidation(
  ApplyCommandSchema,
  async (validatedInput: z.infer<typeof ApplyCommandSchema>) => {
    const { template, force, dryRun } = validatedInput;

    // Convert to ApplyOptions
    const options: ApplyOptions = {
      force,
      preview: dryRun,
      variables: {},
    };

    await applyCommand(template, options);
    return { success: true };
  }
);

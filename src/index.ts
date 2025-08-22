#!/usr/bin/env node

/**
 * @fileoverview CLI entry point for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T10:54:00Z
 *
 * Features: Command line interface for prompt template management
 * Main APIs: template creation, management, and deployment
 * Constraints: Requires Node.js >=18.0.0
 * Patterns: Uses commander.js for CLI structure, chalk for output styling
 */

import { Command, CommanderError } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils/logger';
import { ErrorUtils } from './utils/errors';
import { initCommand, InitOptions } from './commands/init';
import { generateCommand } from './commands/generate';
import { generateEnhancedCommand } from './commands/generate-enhanced';
import { listCommand, ListOptions } from './commands/list';
import { applyCommand, ApplyOptions } from './commands/apply';
import { validateCommand } from './commands/validate';
import { configCommand } from './commands/config';

interface CLIValidateOptions {
  strict?: boolean;
  fix?: boolean;
  format?: 'table' | 'json' | 'yaml';
  detailed?: boolean;
}

interface CLIGenerateOptions {
  variables?: string;
  output?: string;
  clipboard?: boolean;
  preview?: boolean;
  format?: string;
  context?: boolean;
  includeGit?: boolean;
  includeFiles?: boolean;
  filePatterns?: string;
  contextFiles?: string;
}

// Removed - using inline options in the command handler

// interface ApplyOptions {
//   force?: boolean;
//   preview?: boolean;
// }

interface CLIConfigOptions {
  global?: boolean;
  list?: boolean;
  set?: string;
}

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8')
);

const program = new Command();

/**
 * Configure the main CLI program
 */
function configureProgram(): void {
  program
    .name('cursor-prompt')
    .description(
      'TypeScript CLI tool for automated prompt template management in Cursor IDE'
    )
    .version(packageJson.version, '-v, --version', 'display version number');

  // Global options
  program
    .option('-d, --debug', 'enable debug mode', false)
    .option('--config <path>', 'path to config file')
    .option('--dry-run', 'show what would be done without executing', false);

  // Template management commands
  program
    .command('init')
    .description('initialize a new prompt template project')
    .option('-n, --name <name>', 'project name')
    .option('-t, --template <template>', 'template type', 'basic')
    .option(
      '-f, --force',
      'force initialization even if directory is not empty'
    )
    .option('-d, --directory <path>', 'target directory for initialization')
    .action(async (options: InitOptions) => {
      try {
        await initCommand(options);
      } catch (error) {
        ErrorUtils.logError(error, logger);
        process.exit(ErrorUtils.getExitCode(error));
      }
    });

  program
    .command('generate <template>')
    .alias('gen')
    .description('generate prompt from template')
    .option('-v, --variables <variables>', 'template variables as JSON string')
    .option('-o, --output <file>', 'output file path')
    .option('-c, --clipboard', 'copy result to clipboard')
    .option('-p, --preview', 'preview without generating')
    .option(
      '-f, --format <format>',
      'output format (markdown, plain, json)',
      'markdown'
    )
    .option('--no-context', 'disable automatic context gathering')
    .option('--include-git', 'include git context')
    .option('--include-files', 'include file context')
    .option(
      '--file-patterns <patterns>',
      'file patterns to include (comma-separated)'
    )
    .option(
      '--context-files <files>',
      'specific files to include (comma-separated)'
    )
    .action(async (template: string, options: CLIGenerateOptions) => {
      try {
        // Parse variables if provided
        let variables: Record<string, string> = {};
        if (options.variables) {
          try {
            variables = JSON.parse(options.variables) as Record<string, string>;
          } catch {
            logger.error('Invalid JSON in variables option');
            process.exit(1);
          }
        }

        // Use enhanced command if context is enabled (default)
        if (options.context !== false) {
          const filePatterns = options.filePatterns
            ? options.filePatterns.split(',').map((p: string) => p.trim())
            : undefined;
          const contextFiles = options.contextFiles
            ? options.contextFiles.split(',').map((f: string) => f.trim())
            : undefined;

          await generateEnhancedCommand({
            template,
            variables,
            output: options.output,
            clipboard: options.clipboard,
            preview: options.preview,
            format: options.format as 'markdown' | 'plain' | 'json' | undefined,
            includeGit: options.includeGit,
            includeFiles: options.includeFiles,
            filePatterns,
            contextFiles,
          });
        } else {
          // Use basic command without context
          await generateCommand({
            template,
            variables,
            output: options.output,
            clipboard: options.clipboard,
            preview: options.preview,
            format: options.format as 'markdown' | 'plain' | 'json' | undefined,
          });
        }
      } catch (error) {
        ErrorUtils.logError(error, logger);
        process.exit(ErrorUtils.getExitCode(error));
      }
    });

  program
    .command('list')
    .aliases(['ls'])
    .description('list available prompt templates')
    .option('-a, --all', 'show all templates including hidden')
    .option(
      '-f, --format <format>',
      'output format (table, json, yaml)',
      'table'
    )
    .option('-c, --category <category>', 'filter by category')
    .option('-s, --search <term>', 'search templates by name or description')
    .option('--details', 'show detailed information')
    .action(async (options: ListOptions) => {
      try {
        await listCommand(options);
      } catch (error) {
        ErrorUtils.logError(error, logger);
        process.exit(ErrorUtils.getExitCode(error));
      }
    });

  program
    .command('apply <template>')
    .description('apply a prompt template to current project')
    .option('-f, --force', 'force overwrite existing files')
    .option('-p, --preview', 'preview changes without applying')
    .action(async (template: string, options: ApplyOptions) => {
      try {
        await applyCommand(template, options);
      } catch (error) {
        ErrorUtils.logError(error, logger);
        process.exit(ErrorUtils.getExitCode(error));
      }
    });

  program
    .command('validate <path>')
    .description('validate a prompt template')
    .option('-s, --strict', 'enable strict validation')
    .option('--fix', 'attempt to fix validation issues')
    .option(
      '-f, --format <format>',
      'output format (table, json, yaml)',
      'table'
    )
    .option('-d, --detailed', 'show detailed validation information')
    .action(async (templatePath: string, options: CLIValidateOptions) => {
      try {
        await validateCommand(templatePath, options);
      } catch (error) {
        ErrorUtils.logError(error, logger);
        process.exit(ErrorUtils.getExitCode(error));
      }
    });

  program
    .command('config')
    .description('manage configuration settings')
    .option('-g, --global', 'use global config')
    .option('-l, --list', 'list current configuration')
    .option('-s, --set <key=value>', 'set configuration value')
    .action(async (options: CLIConfigOptions) => {
      try {
        await configCommand(options);
      } catch (error) {
        ErrorUtils.logError(error, logger);
        process.exit(ErrorUtils.getExitCode(error));
      }
    });

  // Error handling
  program.configureOutput({
    writeErr: (str: string) => process.stderr.write(chalk.red(str)),
  });

  program.exitOverride((err: CommanderError) => {
    if (err.code === 'commander.help') {
      process.exit(0);
    }
    if (err.code === 'commander.version') {
      process.exit(0);
    }
    logger.error(`${chalk.red('❌ Error:')} ${err.message}`);
    process.exit(1);
  });
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  try {
    // Pre-parse to get global options for logger configuration
    const debugIndex = process.argv.findIndex(
      arg => arg === '--debug' || arg === '-d'
    );
    if (debugIndex !== -1) {
      logger.enableDebug();
    }

    configureProgram();

    // Show help if no arguments provided
    if (process.argv.length <= 2) {
      program.outputHelp();
      return;
    }

    // Parse arguments and execute commands
    await program.parseAsync(process.argv);
  } catch (error) {
    ErrorUtils.logError(error, logger);
    process.exit(ErrorUtils.getExitCode(error));
  }
}

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error: Error) => {
  logger.error(`${chalk.red('💥 Uncaught Exception:')} ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason: Error, promise: Promise<unknown>) => {
  logger.error(
    `${chalk.red('💥 Unhandled Rejection at:')} ${promise} reason: ${reason.message}`
  );
  process.exit(1);
});

// Execute main function if this file is run directly
if (require.main === module) {
  main();
}

export { program, main };

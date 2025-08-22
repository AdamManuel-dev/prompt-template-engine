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
import { listCommand, ListOptions } from './commands/list';

interface CLIGenerateOptions {
  variables?: string;
  output?: string;
  clipboard?: boolean;
  preview?: boolean;
  format?: 'markdown' | 'plain' | 'json';
}

interface ApplyOptions {
  force?: boolean;
  preview?: boolean;
}

interface ValidateOptions {
  strict?: boolean;
}

interface ConfigOptions {
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

        await generateCommand({
          template,
          variables,
          output: options.output,
          clipboard: options.clipboard,
          preview: options.preview,
          format: options.format,
        });
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
      logger.info(chalk.blue(`⚡ Applying template: ${template}`));
      logger.info(chalk.gray(`Options: ${JSON.stringify(options, null, 2)}`));
      // TODO: Implement apply command
      logger.warn('⚠️  Apply command not yet implemented');
    });

  program
    .command('validate <path>')
    .description('validate a prompt template')
    .option('-s, --strict', 'enable strict validation')
    .action(async (templatePath: string, options: ValidateOptions) => {
      logger.info(chalk.blue(`✅ Validating template: ${templatePath}`));
      logger.info(chalk.gray(`Options: ${JSON.stringify(options, null, 2)}`));
      // TODO: Implement validate command
      logger.warn('⚠️  Validate command not yet implemented');
    });

  program
    .command('config')
    .description('manage configuration settings')
    .option('-g, --global', 'use global config')
    .option('-l, --list', 'list current configuration')
    .option('-s, --set <key=value>', 'set configuration value')
    .action(async (options: ConfigOptions) => {
      logger.info(chalk.blue('⚙️  Managing configuration...'));
      logger.info(chalk.gray(`Options: ${JSON.stringify(options, null, 2)}`));
      // TODO: Implement config command
      logger.warn('⚠️  Config command not yet implemented');
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

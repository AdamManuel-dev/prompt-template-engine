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
import { CommandRegistry } from './cli/command-registry';
import { PluginLoader } from './cli/plugin-loader';
import { ConfigManager } from './config/config-manager';
import { CursorIntegration } from './integrations/cursor-ide';
import { CursorExtensionBridge } from './integrations/cursor-extension-bridge';

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
let commandRegistry: CommandRegistry;
let pluginLoader: PluginLoader;
let configManager: ConfigManager;
let cursorIntegration: CursorIntegration | undefined;

/**
 * Initialize services
 */
async function initializeServices(): Promise<void> {
  // Initialize configuration manager
  configManager = ConfigManager.getInstance();

  // Initialize command registry
  commandRegistry = CommandRegistry.getInstance(program);

  // Initialize plugin loader
  pluginLoader = new PluginLoader(commandRegistry);

  // Initialize Cursor integration if enabled
  if (configManager.get('cursor.integration', true)) {
    try {
      cursorIntegration = CursorIntegration.getInstance();
      CursorExtensionBridge.getInstance(); // Initialize the extension bridge

      // Try to connect to Cursor
      const connected = await cursorIntegration.connect();
      if (connected) {
        logger.info('Connected to Cursor IDE');
      }
    } catch (error) {
      logger.debug(`Cursor integration not available: ${String(error)}`);
    }
  }

  // Load plugins if enabled
  if (configManager.get('plugins.enabled', true)) {
    const customDirs = configManager.get<string[]>('plugins.directories', []);
    customDirs.forEach(dir => pluginLoader.addPluginDir(dir));

    await pluginLoader.discover();

    if (configManager.get('plugins.autoLoad', true)) {
      await pluginLoader.loadAll();
    }
  }
}

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

  // Cursor IDE integration commands
  program
    .command('cursor:sync')
    .description('sync templates with Cursor IDE')
    .action(async () => {
      try {
        if (!cursorIntegration) {
          logger.error('Cursor integration is not available');
          process.exit(1);
        }
        await cursorIntegration.sync();
        logger.success('Templates synced with Cursor IDE');
      } catch (error) {
        ErrorUtils.logError(error, logger);
        process.exit(ErrorUtils.getExitCode(error));
      }
    });

  program
    .command('cursor:inject <template>')
    .description('inject template into Cursor IDE')
    .option('-v, --variables <json>', 'template variables as JSON')
    .action(async (template: string, options: { variables?: string }) => {
      try {
        if (!cursorIntegration) {
          logger.error('Cursor integration is not available');
          process.exit(1);
        }

        let variables: Record<string, string> = {};
        if (options.variables) {
          try {
            variables = JSON.parse(options.variables);
          } catch {
            logger.error('Invalid JSON in variables option');
            process.exit(1);
          }
        }

        await cursorIntegration.inject(template, variables);
        logger.success(`Template ${template} injected into Cursor`);
      } catch (error) {
        ErrorUtils.logError(error, logger);
        process.exit(ErrorUtils.getExitCode(error));
      }
    });

  program
    .command('cursor:status')
    .description('show Cursor IDE connection status')
    .action(async () => {
      try {
        if (!cursorIntegration) {
          console.log(chalk.yellow('Cursor integration is disabled'));
          return;
        }

        const status = cursorIntegration.getConnectionStatus();
        console.log('\nCursor IDE Connection Status:');
        console.log('=============================');
        console.log(
          `Connected: ${status.connected ? chalk.green('Yes') : chalk.red('No')}`
        );
        console.log(`Endpoint: ${status.endpoint}`);
        if (status.version) {
          console.log(`Version: ${status.version}`);
        }

        const templates = cursorIntegration.getTemplates();
        console.log(`\nTemplates: ${templates.length} loaded`);
      } catch (error) {
        ErrorUtils.logError(error, logger);
        process.exit(ErrorUtils.getExitCode(error));
      }
    });

  // Plugin management commands
  program
    .command('plugin:list')
    .description('list installed plugins')
    .action(async () => {
      try {
        const plugins = pluginLoader.getPlugins();

        if (plugins.length === 0) {
          console.log('No plugins installed');
          return;
        }

        console.log('\nInstalled Plugins:');
        console.log('==================');

        for (const plugin of plugins) {
          const status = plugin.loaded ? chalk.green('✓') : chalk.red('✗');
          console.log(
            `\n${status} ${plugin.metadata.name} v${plugin.metadata.version}`
          );

          if (plugin.metadata.description) {
            console.log(`  ${plugin.metadata.description}`);
          }

          if (plugin.error) {
            console.log(chalk.red(`  Error: ${plugin.error}`));
          }
        }
      } catch (error) {
        ErrorUtils.logError(error, logger);
        process.exit(ErrorUtils.getExitCode(error));
      }
    });

  program
    .command('plugin:load <name>')
    .description('load a plugin')
    .action(async (name: string) => {
      try {
        const success = await pluginLoader.load(name);

        if (success) {
          logger.success(`Plugin ${name} loaded successfully`);
        } else {
          logger.error(`Failed to load plugin ${name}`);
          process.exit(1);
        }
      } catch (error) {
        ErrorUtils.logError(error, logger);
        process.exit(ErrorUtils.getExitCode(error));
      }
    });

  program
    .command('plugin:unload <name>')
    .description('unload a plugin')
    .action(async (name: string) => {
      try {
        const success = pluginLoader.unload(name);

        if (success) {
          logger.success(`Plugin ${name} unloaded successfully`);
        } else {
          logger.error(`Failed to unload plugin ${name}`);
          process.exit(1);
        }
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

    // Initialize services
    await initializeServices();

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

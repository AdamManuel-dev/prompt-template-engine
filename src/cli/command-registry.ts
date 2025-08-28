/**
 * @fileoverview Command registry for dynamic command management
 * @lastmodified 2025-08-26T11:37:12Z
 *
 * Features: Dynamic command registration, plugin support, command discovery
 * Main APIs: CommandRegistry.register(), execute(), discover()
 * Constraints: Commands must implement ICommand interface
 * Patterns: Registry pattern, plugin architecture
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger';

/**
 * Configuration for command line options
 * @interface CommandOption
 * @example
 * ```
 * const option: CommandOption = {
 *   flags: '-v, --verbose',
 *   description: 'Enable verbose output',
 *   defaultValue: false
 * };
 * ```
 */
export interface CommandOption {
  /** Command flags in commander.js format (e.g., '-v, --verbose') */
  flags: string;
  /** Human-readable description of the option */
  description: string;
  /** Default value for the option if not provided */
  defaultValue?: unknown;
}

/**
 * Interface defining the structure of CLI commands
 * @interface ICommand
 * @example
 * ```
 * const command: ICommand = {
 *   name: 'build',
 *   description: 'Build the project',
 *   aliases: ['b'],
 *   options: [
 *     { flags: '-w, --watch', description: 'Watch for changes' }
 *   ],
 *   action: async (args, options) => {
 *     // Implementation
 *   }
 * };
 * ```
 */
export interface ICommand {
  /** Unique command name used for invocation */
  name: string;
  /** Human-readable description shown in help */
  description: string;
  /** Alternative names for the command */
  aliases?: string[];
  /** Command-line options configuration */
  options?: CommandOption[];
  /** Command execution function */
  action: (args: unknown, options: unknown) => Promise<void>;
  /** Whether to hide from help output */
  hidden?: boolean;
}

/**
 * Interface for command registry operations
 * @interface ICommandRegistry
 */
interface ICommandRegistry {
  /** Register a new command */
  register(command: ICommand): void;
  /** Get a specific command by name */
  getCommand(name: string): ICommand | undefined;
  /** Get all registered commands */
  getCommands(): Map<string, ICommand>;
  /** Execute a command programmatically */
  execute(commandName: string, args: unknown, options: unknown): Promise<void>;
  /** List all available commands for help output */
  listCommands(): { name: string; description: string; aliases?: string[] }[];
  /** Discover and load plugin commands from directories */
  discoverPlugins(pluginDirs: string[]): Promise<void>;
}

/**
 * Singleton registry for managing CLI commands with plugin support
 *
 * Provides centralized command registration, discovery, and execution capabilities.
 * Supports both built-in commands and dynamically loaded plugin commands.
 *
 * @class CommandRegistry
 * @implements {ICommandRegistry}
 * @example
 * ```
 * import { Command } from 'commander';
 * import { CommandRegistry } from './command-registry';
 *
 * const program = new Command();
 * const registry = CommandRegistry.getInstance(program);
 *
 * // Register a command
 * registry.register({
 *   name: 'deploy',
 *   description: 'Deploy the application',
 *   action: async (args, options) => {
 *     console.log('Deploying...');
 *   }
 * });
 *
 * // Discover plugin commands
 * await registry.discoverPlugins(['./plugins']);
 *
 * // Execute programmatically
 * await registry.execute('deploy', {}, {});
 * ```
 */
export class CommandRegistry implements ICommandRegistry {
  /** Singleton instance */
  private static instance: ICommandRegistry | undefined;

  /** Map of registered commands by name */
  private commands: Map<string, ICommand> = new Map();

  /** Commander.js program instance */
  private program: Command;

  /**
   * Private constructor to enforce singleton pattern
   * @param program - Commander.js program instance
   */
  private constructor(program: Command) {
    this.program = program;
  }

  /**
   * Get singleton instance of CommandRegistry
   *
   * @param program - Commander.js program instance (only used on first call)
   * @returns CommandRegistry instance
   *
   * @example
   * ```
   * import { Command } from 'commander';
   *
   * const program = new Command();
   * const registry = CommandRegistry.getInstance(program);
   * ```
   */
  static getInstance(program: Command): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry(program);
    }
    return CommandRegistry.instance as CommandRegistry;
  }

  /**
   * Register a new command with the CLI
   *
   * Adds the command to the internal registry and attaches it to the Commander.js
   * program. If a command with the same name already exists, it will be overridden
   * with a warning.
   *
   * @param command - Command configuration implementing ICommand interface
   *
   * @example
   * ```
   * registry.register({
   *   name: 'test',
   *   description: 'Run tests',
   *   aliases: ['t'],
   *   options: [
   *     { flags: '--coverage', description: 'Generate coverage report' }
   *   ],
   *   action: async (args, options) => {
   *     if (options.coverage) {
   *       console.log('Running tests with coverage...');
   *     }
   *   }
   * });
   * ```
   */
  register(command: ICommand): void {
    if (this.commands.has(command.name)) {
      logger.warn(
        `Command ${command.name} is already registered, overriding...`
      );
    }

    this.commands.set(command.name, command);
    this.attachToProgram(command);
    logger.debug(`Registered command: ${command.name}`);
  }

  /**
   * Attach command to Commander.js program
   *
   * Configures the command with Commander.js, including options, aliases,
   * and action handler with error handling.
   *
   * @private
   * @param command - Command configuration to attach
   */
  private attachToProgram(command: ICommand): void {
    const cmd = this.program.command(command.name);

    cmd.description(command.description);

    if (command.aliases) {
      cmd.aliases(command.aliases);
    }

    if (command.options) {
      command.options.forEach(option => {
        if (option.defaultValue !== undefined) {
          cmd.option(
            option.flags,
            option.description,
            option.defaultValue as string | boolean
          );
        } else {
          cmd.option(option.flags, option.description);
        }
      });
    }

    cmd.action(async (...args) => {
      try {
        await command.action(args[0], args[1]);
      } catch (error: any) {
        logger.error(
          `Error executing command ${command.name}:${String(error)}`
        );
        process.exit(1);
      }
    });

    if (command.hidden) {
      // cmd.hidden = true; // Not available in commander, would need to filter in help output
    }
  }

  /**
   * Discover and load plugin commands from directories
   *
   * Scans specified directories for command files matching the pattern
   * '*.command.ts' or '*.command.js' and loads them as plugin commands.
   *
   * @param pluginDirs - Array of directory paths to search for plugins
   * @returns Promise that resolves when all plugins are processed
   *
   * @example
   * ```bash
   * # Plugin file structure
   * plugins/
   * ├── deploy.command.ts
   * ├── test.command.js
   * └── utils/
   *     └── helper.command.ts
   * ```
   *
   * ```
   * await registry.discoverPlugins([
   *   './src/plugins',
   *   './custom-commands',
   *   path.join(process.env['HOME'], '.myapp/plugins')
   * ]);
   * ```
   */
  async discoverPlugins(pluginDirs: string[]): Promise<void> {
    await Promise.all(
      pluginDirs.map(async dir => {
        if (!fs.existsSync(dir)) {
          logger.debug(`Plugin directory not found: ${dir}`);
          return;
        }

        const files = fs.readdirSync(dir);
        const commandFiles = files.filter(
          file => file.endsWith('.command.ts') || file.endsWith('.command.js')
        );

        await Promise.all(
          commandFiles.map(file => this.loadPlugin(path.join(dir, file)))
        );
      })
    );
  }

  /**
   * Load a plugin command file
   *
   * Dynamically imports a command file and registers the exported command.
   * Supports both default exports and named 'command' exports.
   *
   * @private
   * @param filePath - Absolute path to the command file
   * @returns Promise that resolves when plugin is loaded
   *
   * @example
   * ```
   * // Plugin file format (deploy.command.ts)
   * export default {
   *   name: 'deploy',
   *   description: 'Deploy application',
   *   action: async () => { // implementation }
   * };
   *
   * // Or with named export
   * export const command = {
   *   name: 'deploy',
   *   description: 'Deploy application',
   *   action: async () => { // implementation }
   * };
   * ```
   */
  private async loadPlugin(filePath: string): Promise<void> {
    try {
      const module = await import(filePath);

      if (module.default && CommandRegistry.isValidCommand(module.default)) {
        this.register(module.default);
        logger.info(`Loaded plugin command from: ${filePath}`);
      } else if (
        module.command &&
        CommandRegistry.isValidCommand(module.command)
      ) {
        this.register(module.command);
        logger.info(`Loaded plugin command from: ${filePath}`);
      } else {
        logger.warn(`Invalid command structure in: ${filePath}`);
      }
    } catch (error: any) {
      logger.error(`Failed to load plugin from ${filePath}:${String(error)}`);
    }
  }

  /**
   * Validate command structure
   *
   * Type guard to ensure an object conforms to the ICommand interface.
   * Validates required properties: name, description, and action.
   *
   * @private
   * @param obj - Object to validate
   * @returns True if object is a valid ICommand
   *
   * @example
   * ```
   * const validCommand = {
   *   name: 'build',
   *   description: 'Build project',
   *   action: async () => {}
   * };
   *
   * CommandRegistry.isValidCommand(validCommand); // true
   * CommandRegistry.isValidCommand({}); // false
   * ```
   */
  private static isValidCommand(obj: unknown): obj is ICommand {
    if (typeof obj !== 'object' || obj === null) {
      return false;
    }

    const cmd = obj as ICommand;
    return (
      typeof cmd.name === 'string' &&
      typeof cmd.description === 'string' &&
      typeof cmd.action === 'function'
    );
  }

  /**
   * Get all registered commands
   *
   * Returns a copy of the commands map to prevent external modification.
   *
   * @returns Map of command names to ICommand objects
   *
   * @example
   * ```
   * const commands = registry.getCommands();
   * console.log('Available commands:');
   * for (const [name, command] of commands) {
   *   console.log('- ' + name + ': ' + command.description);
   * }
   * ```
   */
  getCommands(): Map<string, ICommand> {
    return new Map(this.commands);
  }

  /**
   * Get command by name
   *
   * @param name - Command name to lookup
   * @returns Command configuration or undefined if not found
   *
   * @example
   * ```
   * const buildCommand = registry.getCommand('build');
   * if (buildCommand) {
   *   console.log('Description: ' + buildCommand.description);
   *   console.log('Aliases: ' + (buildCommand.aliases?.join(', ') || 'none'));
   * } else {
   *   console.log('Command not found');
   * }
   * ```
   */
  getCommand(name: string): ICommand | undefined {
    return this.commands.get(name);
  }

  /**
   * Execute a command programmatically
   *
   * Bypasses the CLI interface and directly executes a command with
   * provided arguments and options. Useful for scripting and testing.
   *
   * @param commandName - Name of the command to execute
   * @param args - Command arguments
   * @param options - Command options
   * @returns Promise that resolves when command completes
   * @throws {Error} If command is not found
   *
   * @example
   * ```
   * // Execute build command with options
   * await registry.execute('build', [], {
   *   production: true,
   *   verbose: false
   * });
   *
   * // Execute deploy command with arguments
   * await registry.execute('deploy', ['staging'], {
   *   force: true
   * });
   * ```
   */
  async execute(
    commandName: string,
    args: unknown,
    options: unknown
  ): Promise<void> {
    const command = this.commands.get(commandName);

    if (!command) {
      throw new Error(`Command not found: ${commandName}`);
    }

    await command.action(args, options);
  }

  /**
   * List all available commands for help display
   *
   * Filters out hidden commands and returns a simplified list suitable
   * for help output and command discovery.
   *
   * @returns Array of command information objects
   *
   * @example
   * ```
   * const commands = registry.listCommands();
   * console.log('Available commands:');
   *
   * commands.forEach(cmd => {
   *   const aliases = cmd.aliases ? ' (' + cmd.aliases.join(', ') + ')' : '';
   *   console.log('  ' + cmd.name + aliases);
   *   console.log('    ' + cmd.description);
   * });
   *
   * // Output:
   * // Available commands:
   * //   build (b)
   * //     Build the project
   * //   deploy (d)
   * //     Deploy to environment
   * ```
   */
  listCommands(): { name: string; description: string; aliases?: string[] }[] {
    return Array.from(this.commands.values())
      .filter(cmd => !cmd.hidden)
      .map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        ...(cmd.aliases && { aliases: cmd.aliases }),
      }));
  }
}

/**
 * @fileoverview Command registry for dynamic command management
 * @lastmodified 2025-08-22T20:00:00Z
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

export interface CommandOption {
  flags: string;
  description: string;
  defaultValue?: unknown;
}

export interface ICommand {
  name: string;
  description: string;
  aliases?: string[];
  options?: CommandOption[];
  action: (args: unknown, options: unknown) => Promise<void>;
  hidden?: boolean;
}

// Interface declaration to resolve no-use-before-define
interface ICommandRegistry {
  register(command: ICommand): void;
  getCommand(name: string): ICommand | undefined;
  getCommands(): Map<string, ICommand>;
  execute(commandName: string, args: unknown, options: unknown): Promise<void>;
  listCommands(): { name: string; description: string; aliases?: string[] }[];
  discoverPlugins(pluginDirs: string[]): Promise<void>;
}

export class CommandRegistry implements ICommandRegistry {
  private static instance: ICommandRegistry | undefined;

  private commands: Map<string, ICommand> = new Map();

  private program: Command;

  private constructor(program: Command) {
    this.program = program;
  }

  static getInstance(program: Command): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry(program);
    }
    return CommandRegistry.instance as CommandRegistry;
  }

  /**
   * Register a new command
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
   * Attach command to commander program
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
      } catch (error) {
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
    } catch (error) {
      logger.error(`Failed to load plugin from ${filePath}:${String(error)}`);
    }
  }

  /**
   * Validate command structure
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
   */
  getCommands(): Map<string, ICommand> {
    return new Map(this.commands);
  }

  /**
   * Get command by name
   */
  getCommand(name: string): ICommand | undefined {
    return this.commands.get(name);
  }

  /**
   * Execute a command programmatically
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
   * List all available commands
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

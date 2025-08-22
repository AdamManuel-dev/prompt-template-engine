/**
 * @fileoverview Base command class for all CLI commands
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Base class with common functionality for commands
 * Main APIs: BaseCommand abstract class
 * Constraints: Commands must extend this class
 * Patterns: Template method pattern, abstract class
 */

import chalk from 'chalk';
import { ICommand, CommandOption } from './command-registry';
import { logger } from '../utils/logger';
import { ConfigService } from '../services/config.service';

export abstract class BaseCommand implements ICommand {
  abstract name: string;

  abstract description: string;

  aliases?: string[];

  options?: CommandOption[];

  hidden?: boolean;

  protected configService: ConfigService;

  constructor() {
    this.configService = new ConfigService();
  }

  /**
   * Abstract method that must be implemented by subclasses
   */
  abstract execute(args: unknown, options: unknown): Promise<void>;

  /**
   * Wrapper for the execute method that handles common functionality
   */
  async action(args: unknown, options: unknown): Promise<void> {
    try {
      // Pre-execution hook
      await this.preExecute(args, options);

      // Execute the actual command
      await this.execute(args, options);

      // Post-execution hook
      await this.postExecute(args, options);
    } catch (error) {
      await this.handleError(error);
      throw error;
    }
  }

  /**
   * Hook called before command execution
   */
  protected async preExecute(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    _args: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    _options: unknown
  ): Promise<void> {
    // Intentionally unused parameters for subclass overrides
    logger.debug(`Executing command: ${this.name}`);
  }

  /**
   * Hook called after successful command execution
   */
  protected async postExecute(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    _args: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
    _options: unknown
  ): Promise<void> {
    // Intentionally unused parameters for subclass overrides
    logger.debug(`Command ${this.name} completed successfully`);
  }

  /**
   * Error handler for command execution
   */
  protected async handleError(error: unknown): Promise<void> {
    logger.error(`Error in command ${this.name}: ${error}`);
  }

  /**
   * Display success message
   */
  // eslint-disable-next-line class-methods-use-this
  protected success(message: string): void {
    // eslint-disable-next-line no-console
    console.log(chalk.green('✓'), message);
  }

  /**
   * Display info message
   */
  // eslint-disable-next-line class-methods-use-this
  protected info(message: string): void {
    // eslint-disable-next-line no-console
    console.log(chalk.blue('ℹ'), message);
  }

  /**
   * Display warning message
   */
  // eslint-disable-next-line class-methods-use-this
  protected warn(message: string): void {
    // eslint-disable-next-line no-console
    console.log(chalk.yellow('⚠'), message);
  }

  /**
   * Display error message
   */
  // eslint-disable-next-line class-methods-use-this
  protected error(message: string): void {
    // eslint-disable-next-line no-console
    console.log(chalk.red('✗'), message);
  }

  /**
   * Prompt for user confirmation
   */
  // eslint-disable-next-line class-methods-use-this
  protected async confirm(message: string): Promise<boolean> {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise(resolve => {
      rl.question(`${message} (y/N): `, answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * Prompt for user input
   */
  // eslint-disable-next-line class-methods-use-this
  protected async prompt(
    message: string,
    defaultValue?: string
  ): Promise<string> {
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const promptMessage = defaultValue
      ? `${message} (${defaultValue}): `
      : `${message}: `;

    return new Promise(resolve => {
      rl.question(promptMessage, answer => {
        rl.close();
        resolve(answer || defaultValue || '');
      });
    });
  }

  /**
   * Get configuration value
   */
  protected async getConfig<T>(key: string): Promise<T | undefined> {
    const config = await this.configService.getConfig();
    return this.getNestedProperty(config, key) as T | undefined;
  }

  /**
   * Set configuration value
   */
  protected async setConfig(key: string, value: unknown): Promise<void> {
    await this.configService.setConfig({ [key]: value });
  }

  /**
   * Get nested property from object
   */
  // eslint-disable-next-line class-methods-use-this
  private getNestedProperty(obj: unknown, path: string): unknown {
    if (!obj || typeof obj !== 'object') {
      return undefined;
    }

    const keys = path.split('.');
    const current: unknown = obj;

    return keys.reduce((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, current);
  }
}

// Additional export to satisfy import/prefer-default-export
export type BaseCommandType = typeof BaseCommand;

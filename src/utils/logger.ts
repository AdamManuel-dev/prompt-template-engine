/**
 * @fileoverview Logging utility for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T10:30:00Z
 *
 * Features: Structured logging with levels and colors
 * Main APIs: debug(), info(), warn(), error(), success()
 * Constraints: Uses chalk for colors, respects debug flag
 * Patterns: Singleton logger with configurable levels
 */

import * as chalk from 'chalk';

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  timestamps: boolean;
  colors: boolean;
}

/**
 * Singleton logger class
 */
class Logger {
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    prefix: '[cursor-prompt]',
    timestamps: true,
    colors: true,
  };

  /**
   * Configure the logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current timestamp string
   */
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Format log message with prefix and timestamp
   */
  private formatMessage(
    level: string,
    message: string,
    ...args: any[]
  ): string {
    const parts = [this.config.prefix];

    if (this.config.timestamps) {
      parts.push(`[${Logger.getTimestamp()}]`);
    }

    let formattedMessage = message;
    if (args.length > 0) {
      // Handle additional arguments by stringifying them
      const additionalInfo = args
        .map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            if (arg instanceof Error) {
              return arg.message;
            }
            return JSON.stringify(arg, null, 2);
          }
          return String(arg);
        })
        .join(' ');
      formattedMessage = `${message} ${additionalInfo}`;
    }

    parts.push(`[${level}]`, formattedMessage);
    return parts.join(' ');
  }

  /**
   * Log a message if it meets the current log level
   */
  private log(
    level: LogLevel,
    levelName: string,
    message: string,
    colorFn?: (str: string) => string,
    ...args: any[]
  ): void {
    if (level < this.config.level) {
      return;
    }

    const formattedMessage = this.formatMessage(levelName, message, ...args);
    const output =
      this.config.colors && colorFn
        ? colorFn(formattedMessage)
        : formattedMessage;

    if (level >= LogLevel.ERROR) {
      // eslint-disable-next-line no-console
      console.error(output);
    } else {
      // eslint-disable-next-line no-console
      console.log(output);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, chalk.gray, ...args);
  }

  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, 'INFO', message, chalk.cyan, ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, 'WARN', message, chalk.yellow, ...args);
  }

  /**
   * Log error message
   */
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, 'ERROR', message, chalk.red, ...args);
  }

  /**
   * Log success message
   */
  success(message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, 'SUCCESS', message, chalk.green, ...args);
  }

  /**
   * Enable debug mode
   */
  enableDebug(): void {
    this.config.level = LogLevel.DEBUG;
  }

  /**
   * Disable colors
   */
  disableColors(): void {
    this.config.colors = false;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions bound to logger instance
export const debug = (message: string, ...args: any[]): void =>
  logger.debug(message, ...args);
export const info = (message: string, ...args: any[]): void =>
  logger.info(message, ...args);
export const warn = (message: string, ...args: any[]): void =>
  logger.warn(message, ...args);
export const error = (message: string, ...args: any[]): void =>
  logger.error(message, ...args);
export const success = (message: string, ...args: any[]): void =>
  logger.success(message, ...args);

/**
 * @fileoverview Logging utility for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T10:30:00Z
 *
 * Features: Structured logging with levels and colors
 * Main APIs: debug(), info(), warn(), error(), success()
 * Constraints: Uses chalk for colors, respects debug flag
 * Patterns: Singleton logger with configurable levels
 */

import chalk from 'chalk';

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
  private formatMessage(level: string, message: string): string {
    const parts = [this.config.prefix];

    if (this.config.timestamps) {
      parts.push(`[${Logger.getTimestamp()}]`);
    }

    parts.push(`[${level}]`, message);
    return parts.join(' ');
  }

  /**
   * Log a message if it meets the current log level
   */
  private log(
    level: LogLevel,
    levelName: string,
    message: string,
    colorFn?: (str: string) => string
  ): void {
    if (level < this.config.level) {
      return;
    }

    const formattedMessage = this.formatMessage(levelName, message);
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
  debug(message: string): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, chalk.gray);
  }

  /**
   * Log info message
   */
  info(message: string): void {
    this.log(LogLevel.INFO, 'INFO', message, chalk.cyan);
  }

  /**
   * Log warning message
   */
  warn(message: string): void {
    this.log(LogLevel.WARN, 'WARN', message, chalk.yellow);
  }

  /**
   * Log error message
   */
  error(message: string): void {
    this.log(LogLevel.ERROR, 'ERROR', message, chalk.red);
  }

  /**
   * Log success message
   */
  success(message: string): void {
    this.log(LogLevel.INFO, 'SUCCESS', message, chalk.green);
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
export const debug = (message: string): void => logger.debug(message);
export const info = (message: string): void => logger.info(message);
export const warn = (message: string): void => logger.warn(message);
export const error = (message: string): void => logger.error(message);
export const success = (message: string): void => logger.success(message);

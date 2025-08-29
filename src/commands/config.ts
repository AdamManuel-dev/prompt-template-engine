/* eslint-disable no-use-before-define */
/**
 * @fileoverview Config command implementation for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T11:55:00Z
 *
 * Features: Configuration management for the CLI tool
 * Main APIs: configCommand()
 * Constraints: Supports local and global configuration
 * Patterns: Key-value configuration with JSON storage
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { logger } from '../utils/logger';

export interface ConfigOptions {
  global?: boolean;
  list?: boolean;
  set?: string;
  get?: string;
  delete?: string;
  reset?: boolean;
}

interface ConfigData {
  templatePaths?: string[];
  defaultTemplate?: string;
  outputFormat?: 'markdown' | 'plain' | 'json';
  colorOutput?: boolean;
  debugMode?: boolean;
  autoUpdate?: boolean;
  [key: string]: string | number | boolean | string[] | undefined;
}

const DEFAULT_CONFIG: ConfigData = {
  templatePaths: [
    './templates',
    path.join(os.homedir(), '.cursor-prompt/templates'),
  ],
  outputFormat: 'markdown',
  colorOutput: true,
  debugMode: false,
  autoUpdate: false,
};

/**
 * Get config file path
 */
function getConfigPath(global: boolean = false): string {
  if (global) {
    return path.join(os.homedir(), '.cursor-prompt', 'config.json');
  }
  return path.join(process.cwd(), '.cursor-prompt.json');
}

/**
 * Load configuration from file
 */
function loadConfig(global: boolean = false): ConfigData {
  const configPath = getConfigPath(global);

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);
    return { ...DEFAULT_CONFIG, ...config };
  } catch {
    logger.warn(chalk.yellow(`⚠️  Failed to load config from ${configPath}`));
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save configuration to file
 */
function saveConfig(config: ConfigData, global: boolean = false): void {
  const configPath = getConfigPath(global);
  const dir = path.dirname(configPath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * Config command implementation
 */
export async function configCommand(
  options: ConfigOptions = {}
): Promise<void> {
  try {
    const isGlobal = options.global || false;

    // Handle reset
    if (options.reset) {
      await resetConfig(isGlobal);
      return;
    }

    // Handle list
    if (options.list) {
      await listConfig(isGlobal);
      return;
    }

    // Handle get
    if (options.get) {
      await getConfigValueCommand(options.get, isGlobal);
      return;
    }

    // Handle set
    if (options.set) {
      await setConfigValue(options.set, isGlobal);
      return;
    }

    // Handle delete
    if (options.delete) {
      await deleteConfigValue(options.delete, isGlobal);
      return;
    }

    // Default: show current config
    await listConfig(isGlobal);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(chalk.red(`❌ Config command failed: ${message}`));
    throw error;
  }
}

/**
 * List all configuration values
 */
async function listConfig(global: boolean): Promise<void> {
  const config = loadConfig(global);
  const configType = global ? 'Global' : 'Local';

  logger.info(chalk.cyan(`\n⚙️  ${configType} Configuration:`));
  logger.info(chalk.gray(`Path: ${getConfigPath(global)}`));
  logger.info('');

  Object.entries(config).forEach(([key, value]) => {
    const valueStr =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    logger.info(`  ${chalk.bold(key)}: ${valueStr}`);
  });
}

/**
 * Get a specific configuration value
 */
async function getConfigValueCommand(
  key: string,
  global: boolean
): Promise<void> {
  const config = loadConfig(global);

  if (!(key in config)) {
    logger.warn(chalk.yellow(`⚠️  Configuration key '${key}' not found`));
    return;
  }

  const value = config[key];
  const valueStr =
    typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);

  logger.info(`${chalk.bold(key)}: ${valueStr}`);
}

/**
 * Set a configuration value
 */
async function setConfigValue(
  keyValue: string,
  global: boolean
): Promise<void> {
  const [key, ...valueParts] = keyValue.split('=');
  const value = valueParts.join('=');

  if (!key || !value) {
    throw new Error('Invalid format. Use: --set key=value');
  }

  const config = loadConfig(global);

  // Try to parse value as JSON
  let parsedValue: string | number | boolean | string[] = value;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    // Keep as string if not valid JSON
    // Check for boolean strings
    if (value.toLowerCase() === 'true') parsedValue = true;
    else if (value.toLowerCase() === 'false') parsedValue = false;
    // Check for number strings
    else if (!Number.isNaN(Number(value))) parsedValue = Number(value);
  }

  config[key] = parsedValue;
  saveConfig(config, global);

  const configType = global ? 'global' : 'local';
  logger.success(
    chalk.green(
      `✅ Set ${configType} config: ${key} = ${JSON.stringify(parsedValue)}`
    )
  );
}

/**
 * Delete a configuration value
 */
async function deleteConfigValue(key: string, global: boolean): Promise<void> {
  const config = loadConfig(global);

  if (!(key in config)) {
    logger.warn(chalk.yellow(`⚠️  Configuration key '${key}' not found`));
    return;
  }

  delete config[key];
  saveConfig(config, global);

  const configType = global ? 'global' : 'local';
  logger.success(chalk.green(`✅ Deleted ${configType} config key: ${key}`));
}

/**
 * Reset configuration to defaults
 */
async function resetConfig(global: boolean): Promise<void> {
  saveConfig(DEFAULT_CONFIG, global);

  const configType = global ? 'global' : 'local';
  logger.success(
    chalk.green(`✅ Reset ${configType} configuration to defaults`)
  );
}

/**
 * Merge configurations (local overrides global)
 */
export function getMergedConfig(): ConfigData {
  const globalConfig = loadConfig(true);
  const localConfig = loadConfig(false);

  return { ...globalConfig, ...localConfig };
}

/**
 * Get configuration value with fallback
 */
export function getConfigValue(
  key: string,
  defaultValue?: string | number | boolean | string[]
): string | number | boolean | string[] | undefined {
  const config = getMergedConfig();
  return config[key] ?? defaultValue;
}

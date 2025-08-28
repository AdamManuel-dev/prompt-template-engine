/**
 * @fileoverview Configuration management for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T10:54:00Z
 *
 * Features: Configuration loading, validation, and defaults
 * Main APIs: loadConfig(), writeConfig(), createDefaultConfig()
 * Constraints: JSON-based configuration with schema validation
 * Patterns: Configuration hierarchy, environment overrides, validation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './logger';
import { ConfigError, ValidationError } from './errors';

/**
 * Validation error details
 */
type ValidationErrors = string[];

/**
 * Configuration object with proper typing
 */
interface ConfigObject {
  projectName?: string;
  templatePaths?: string[];
  outputPath?: string;
  defaultTemplate?: string;
  variables?: Record<string, string>;
  formats?: {
    default?: 'markdown' | 'plain' | 'json';
    supported?: string[];
  };
  features?: {
    clipboard?: boolean;
    preview?: boolean;
    validation?: boolean;
    autoBackup?: boolean;
  };
  metadata?: {
    version?: string;
    created?: string;
    lastModified?: string;
  };
}

/**
 * Main configuration interface
 */
export interface Config {
  projectName: string;
  templatePaths: string[];
  outputPath?: string;
  defaultTemplate?: string;
  variables: Record<string, string>;
  formats: {
    default: 'markdown' | 'plain' | 'json';
    supported: string[];
  };
  features: {
    clipboard: boolean;
    preview: boolean;
    validation: boolean;
    autoBackup: boolean;
  };
  metadata: {
    version: string;
    created: string;
    lastModified: string;
  };
}

/**
 * Configuration creation options
 */
export interface ConfigOptions {
  projectName?: string;
  templateType?: string;
  templatePaths?: string[];
  outputPath?: string;
}

/**
 * Configuration summary interface
 */
interface ConfigSummary {
  projectName: string;
  templatePaths: string[];
  outputPath?: string;
  defaultTemplate?: string;
  defaultFormat: string;
  featuresEnabled: string[];
  variableCount: number;
  version: string;
  lastModified: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Config = {
  projectName: 'cursor-prompt-templates',
  templatePaths: ['./templates', './.cursor-prompt/templates'],
  outputPath: './generated',
  defaultTemplate: 'basic',
  variables: {},
  formats: {
    default: 'markdown',
    supported: ['markdown', 'plain', 'json'],
  },
  features: {
    clipboard: true,
    preview: true,
    validation: true,
    autoBackup: false,
  },
  metadata: {
    version: '1.0.0',
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
  },
};

/**
 * Configuration file names in order of priority
 */
const CONFIG_FILE_NAMES = [
  '.cursor-prompt.config.json',
  '.cursor-prompt.json',
  'cursor-prompt.config.json',
  '.cursorprompt.json',
];

/**
 * Find configuration file in current directory and parents
 */
async function findConfigFile(
  startDir: string = process.cwd()
): Promise<string | null> {
  const searchDirs: string[] = [];
  let currentDir = startDir;

  // Build list of directories to search
  // eslint-disable-next-line no-constant-condition
  while (true) {
    searchDirs.push(currentDir);
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root directory
      break;
    }
    currentDir = parentDir;
  }

  // Search all directories with all config files in parallel
  const allConfigPaths = searchDirs.flatMap(dir =>
    CONFIG_FILE_NAMES.map(fileName => path.join(dir, fileName))
  );

  const results = await Promise.allSettled(
    allConfigPaths.map(async configPath => {
      await fs.access(configPath);
      return configPath;
    })
  );

  // Return the first found config file (closest to start directory)
  const foundConfig = results.find(result => result.status === 'fulfilled');
  return foundConfig && foundConfig.status === 'fulfilled'
    ? foundConfig.value
    : null;
}

/**
 * Validate configuration object
 */
async function validateConfig(config: ConfigObject): Promise<void> {
  const errors: ValidationErrors = [];

  // Required fields
  if (!config.projectName || typeof config.projectName !== 'string') {
    errors.push('projectName must be a non-empty string');
  }

  if (!Array.isArray(config.templatePaths)) {
    errors.push('templatePaths must be an array');
  } else if (config.templatePaths.length === 0) {
    errors.push('templatePaths must contain at least one path');
  }

  // Optional fields with type validation
  if (
    config.outputPath !== undefined &&
    typeof config.outputPath !== 'string'
  ) {
    errors.push('outputPath must be a string');
  }

  if (
    config.defaultTemplate !== undefined &&
    typeof config.defaultTemplate !== 'string'
  ) {
    errors.push('defaultTemplate must be a string');
  }

  if (config.variables !== undefined && typeof config.variables !== 'object') {
    errors.push('variables must be an object');
  }

  // Validate formats
  if (config.formats) {
    if (
      config.formats.default &&
      !['markdown', 'plain', 'json'].includes(config.formats.default)
    ) {
      errors.push('formats.default must be one of: markdown, plain, json');
    }

    if (config.formats.supported && !Array.isArray(config.formats.supported)) {
      errors.push('formats.supported must be an array');
    }
  }

  // Validate features
  if (config.features) {
    const featureKeys = [
      'clipboard',
      'preview',
      'validation',
      'autoBackup',
    ] as const;
    featureKeys.forEach(key => {
      if (
        config.features?.[key] !== undefined &&
        typeof config.features[key] !== 'boolean'
      ) {
        errors.push(`features.${key} must be a boolean`);
      }
    });
  }

  if (errors.length > 0) {
    throw new ValidationError(
      `Configuration validation failed: ${errors.join(', ')}`,
      'CONFIG_VALIDATION_ERROR'
    );
  }
}

/**
 * Merge configuration objects with deep merge for nested objects
 */
function mergeConfig(base: Config, override: Partial<Config>): Config {
  const merged = { ...base };

  Object.entries(override).forEach(([key, value]) => {
    if (key in merged) {
      const baseValue = (merged as Record<string, unknown>)[key];

      if (
        typeof baseValue === 'object' &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        baseValue !== null &&
        value !== null
      ) {
        // Deep merge for objects
        (merged as Record<string, unknown>)[key] = { ...baseValue, ...value };
      } else {
        // Direct assignment for primitives and arrays
        (merged as Record<string, unknown>)[key] = value;
      }
    }
  });

  return merged;
}

/**
 * Apply environment variable overrides
 */
function applyEnvironmentOverrides(config: Config): Config {
  const envConfig = { ...config };

  // Project name override
  if (process.env.CURSOR_PROMPT_PROJECT_NAME) {
    envConfig.projectName = process.env.CURSOR_PROMPT_PROJECT_NAME;
  }

  // Template paths override
  if (process.env.CURSOR_PROMPT_TEMPLATE_PATHS) {
    envConfig.templatePaths =
      process.env.CURSOR_PROMPT_TEMPLATE_PATHS.split(':');
  }

  // Output path override
  if (process.env.CURSOR_PROMPT_OUTPUT_PATH) {
    envConfig.outputPath = process.env.CURSOR_PROMPT_OUTPUT_PATH;
  }

  // Default template override
  if (process.env.CURSOR_PROMPT_DEFAULT_TEMPLATE) {
    envConfig.defaultTemplate = process.env.CURSOR_PROMPT_DEFAULT_TEMPLATE;
  }

  // Feature toggles
  if (process.env.CURSOR_PROMPT_CLIPBOARD !== undefined) {
    envConfig.features.clipboard =
      process.env.CURSOR_PROMPT_CLIPBOARD === 'true';
  }

  if (process.env.CURSOR_PROMPT_PREVIEW !== undefined) {
    envConfig.features.preview = process.env.CURSOR_PROMPT_PREVIEW === 'true';
  }

  if (process.env.CURSOR_PROMPT_VALIDATION !== undefined) {
    envConfig.features.validation =
      process.env.CURSOR_PROMPT_VALIDATION === 'true';
  }

  return envConfig;
}

/**
 * Resolve relative paths in configuration
 */
function resolveConfigPaths(
  config: Config,
  configFilePath?: string | null
): Config {
  const resolvedConfig = { ...config };

  // Get base directory for relative path resolution
  const baseDir = configFilePath ? path.dirname(configFilePath) : process.cwd();

  // Resolve template paths
  resolvedConfig.templatePaths = config.templatePaths.map(templatePath => {
    if (path.isAbsolute(templatePath)) {
      return templatePath;
    }
    return path.resolve(baseDir, templatePath);
  });

  // Resolve output path
  if (config.outputPath && !path.isAbsolute(config.outputPath)) {
    resolvedConfig.outputPath = path.resolve(baseDir, config.outputPath);
  }

  return resolvedConfig;
}

/**
 * Load configuration from file system
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  let config = { ...DEFAULT_CONFIG };

  try {
    const configFilePath = configPath || (await findConfigFile());

    if (configFilePath) {
      logger.debug(`Loading config from: ${configFilePath}`);
      const fileContent = await fs.readFile(configFilePath, 'utf-8');
      const parsedConfig = JSON.parse(fileContent);

      // Validate configuration
      await validateConfig(parsedConfig);

      // Merge with defaults
      config = mergeConfig(config, parsedConfig);

      logger.debug('Configuration loaded successfully');
    } else {
      logger.debug('No config file found, using defaults');
    }

    // Apply environment overrides
    config = applyEnvironmentOverrides(config);

    // Resolve relative paths
    config = resolveConfigPaths(config, configFilePath);

    return config;
  } catch (error: any) {
    if (error instanceof ConfigError) {
      throw error;
    } else if (error instanceof SyntaxError) {
      throw new ConfigError(
        `Invalid JSON in configuration file: ${(error as Error).message}`,
        undefined,
        'CONFIG_PARSE_ERROR'
      );
    } else {
      throw new ConfigError(
        `Failed to load configuration: ${(error as Error).message}`,
        undefined,
        'CONFIG_LOAD_ERROR'
      );
    }
  }
}

/**
 * Write configuration to file
 */
export async function writeConfig(
  configPath: string,
  config: Config
): Promise<void> {
  try {
    // Create a copy to avoid mutating the parameter
    const configToWrite = {
      ...config,
      metadata: {
        ...config.metadata,
        lastModified: new Date().toISOString(),
      },
    };

    // Validate before writing
    await validateConfig(configToWrite);

    // Ensure directory exists
    const configDir = path.dirname(configPath);
    await fs.mkdir(configDir, { recursive: true });

    // Write configuration
    const configJson = JSON.stringify(configToWrite, null, 2);
    await fs.writeFile(configPath, configJson);

    logger.debug(`Configuration written to: ${configPath}`);
  } catch (error: any) {
    throw new ConfigError(
      `Failed to write configuration: ${(error as Error).message}`,
      undefined,
      'CONFIG_WRITE_ERROR'
    );
  }
}

/**
 * Create default configuration with overrides
 */
export function createDefaultConfig(options: ConfigOptions = {}): Config {
  const config: Config = {
    ...DEFAULT_CONFIG,
    projectName: options.projectName || DEFAULT_CONFIG.projectName,
    templatePaths: options.templatePaths || [...DEFAULT_CONFIG.templatePaths],
    outputPath: options.outputPath || DEFAULT_CONFIG.outputPath,
    metadata: {
      ...DEFAULT_CONFIG.metadata,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    },
  };

  return config;
}

/**
 * Get configuration file path (for writing)
 */
export async function getConfigFilePath(
  preferredPath?: string
): Promise<string> {
  if (preferredPath) {
    return preferredPath;
  }

  // Try to find existing config file
  const existingConfig = await findConfigFile();
  if (existingConfig) {
    return existingConfig;
  }

  // Use default location
  return path.join(
    process.cwd(),
    CONFIG_FILE_NAMES[0] || '.cursor-prompt-template'
  );
}

/**
 * Check if configuration file exists
 */
export async function configExists(configPath?: string): Promise<boolean> {
  try {
    const configFilePath = configPath || (await findConfigFile());
    if (configFilePath) {
      await fs.access(configFilePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Get configuration summary for display
 */
export function getConfigSummary(config: Config): ConfigSummary {
  return {
    projectName: config.projectName,
    templatePaths: config.templatePaths,
    outputPath: config.outputPath,
    defaultTemplate: config.defaultTemplate,
    defaultFormat: config.formats.default,
    featuresEnabled: Object.entries(config.features)
      .filter(([, enabled]) => enabled)
      .map(([feature]) => feature),
    variableCount: Object.keys(config.variables).length,
    version: config.metadata.version,
    lastModified: config.metadata.lastModified,
  };
}

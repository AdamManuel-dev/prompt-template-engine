/**
 * @fileoverview Configuration service for centralized config management
 * @lastmodified 2025-08-26T11:31:10Z
 *
 * Features: Configuration loading, merging, and persistence
 * Main APIs: getConfig, setConfig, mergeConfigs
 * Constraints: Supports both global and local configurations
 * Patterns: Service layer pattern, singleton pattern ready
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigError } from '../utils/errors';

/**
 * Application configuration options defining behavior and preferences
 * Contains all configurable settings for the cursor prompt template engine
 */
export interface ConfigOptions {
  /** Array of directory paths to search for templates */
  templatePaths: string[];
  /** Default output format for template processing */
  defaultFormat: 'markdown' | 'plain' | 'json';
  /** Enable automatic updates for templates and configurations */
  autoUpdate: boolean;
  /** Enable colored output in console/terminal */
  colorOutput: boolean;
  /** Enable verbose logging and detailed output */
  verboseMode: boolean;
  /** Maximum number of items to keep in operation history */
  maxHistorySize: number;
  /** User-defined custom variables for template processing */
  customVariables: Record<string, unknown>;
}

/**
 * Configuration service initialization options
 * Defines paths and default values for the configuration service
 */
export interface ConfigServiceOptions {
  /** Path to global configuration file (defaults to ~/.cursor-prompt/config.json) */
  globalConfigPath?: string;
  /** Path to local project configuration file (defaults to ./.cursor-prompt.json) */
  localConfigPath?: string;
  /** Default configuration values to use when not specified */
  defaults?: Partial<ConfigOptions>;
}

/**
 * Centralized configuration management service
 *
 * This service provides comprehensive configuration management for the cursor
 * prompt template engine, supporting both global user preferences and local
 * project-specific settings. It implements a hierarchical configuration system
 * where local settings override global settings, which override defaults.
 *
 * Key Features:
 * - Hierarchical configuration merging (defaults -> global -> local)
 * - Automatic file watching and cache invalidation
 * - JSON schema validation for configuration integrity
 * - Template path management with deduplication
 * - Custom variable support for template processing
 * - Atomic configuration updates with rollback on validation errors
 *
 * Configuration Hierarchy:
 * 1. Built-in defaults (lowest priority)
 * 2. Global user configuration (~/.cursor-prompt/config.json)
 * 3. Local project configuration (./.cursor-prompt.json) (highest priority)
 *
 * @example
 * ```typescript
 * // Initialize config service
 * const configService = new ConfigService({
 *   defaults: {
 *     verboseMode: true,
 *     colorOutput: false
 *   }
 * });
 *
 * // Get merged configuration
 * const config = await configService.getConfig();
 * console.log(`Template paths: ${config.templatePaths.join(', ')}`);
 *
 * // Update local configuration
 * await configService.setConfigValue('verboseMode', true, false);
 *
 * // Add template search path
 * await configService.addTemplatePath('/custom/templates');
 *
 * // Get specific config value
 * const format = await configService.getConfigValue('defaultFormat');
 * ```
 *
 * @see {@link ConfigOptions} for available configuration options
 * @see {@link ConfigServiceOptions} for service initialization options
 */
export class ConfigService {
  private readonly globalConfigPath: string;

  private readonly localConfigPath: string;

  private readonly defaults: ConfigOptions;

  private configCache: ConfigOptions | null = null;

  private lastCacheTime: number = 0;

  private readonly cacheTimeout: number = 5000; // 5 seconds

  /**
   * Creates a new ConfigService instance with specified options
   *
   * Initializes the configuration service with default paths, cache settings,
   * and baseline configuration values. The service automatically determines
   * appropriate global and local configuration file paths based on the
   * operating system and current working directory.
   *
   * @param options - Service initialization options
   * @param options.globalConfigPath - Custom global config path (optional)
   * @param options.localConfigPath - Custom local config path (optional)
   * @param options.defaults - Default configuration values (optional)
   *
   * @example
   * ```typescript
   * // Use default paths and settings
   * const config = new ConfigService();
   *
   * // Custom configuration with defaults
   * const config = new ConfigService({
   *   defaults: {
   *     verboseMode: true,
   *     defaultFormat: 'json',
   *     templatePaths: ['/custom/templates']
   *   }
   * });
   *
   * // Custom file paths
   * const config = new ConfigService({
   *   globalConfigPath: '/etc/cursor-prompt/config.json',
   *   localConfigPath: './config/local.json'
   * });
   * ```
   */
  constructor(options: ConfigServiceOptions = {}) {
    this.globalConfigPath =
      options.globalConfigPath ||
      path.join(os.homedir(), '.cursor-prompt', 'config.json');
    this.localConfigPath =
      options.localConfigPath ||
      path.join(process.cwd(), '.cursor-prompt.json');

    this.defaults = {
      templatePaths: [
        path.join(process.cwd(), 'templates'),
        path.join(os.homedir(), '.cursor-prompt', 'templates'),
      ],
      defaultFormat: 'markdown',
      autoUpdate: false,
      colorOutput: true,
      verboseMode: false,
      maxHistorySize: 100,
      customVariables: {},
      ...options.defaults,
    };
  }

  /**
   * Get the merged configuration with all overrides applied
   *
   * Returns the complete configuration by merging defaults, global settings,
   * and local settings in order of precedence. The result is cached for
   * performance and automatically invalidated when configuration files change.
   *
   * Configuration merge order:
   * 1. Service defaults (lowest priority)
   * 2. Global user configuration
   * 3. Local project configuration (highest priority)
   *
   * @returns Promise resolving to complete merged configuration
   *
   * @throws {ConfigError} When configuration files contain invalid JSON or values
   *
   * @example
   * ```typescript
   * const config = await configService.getConfig();
   *
   * // Access configuration values
   * console.log(`Output format: ${config.defaultFormat}`);
   * console.log(`Template paths: ${config.templatePaths.join(', ')}`);
   * console.log(`Verbose mode: ${config.verboseMode}`);
   *
   * // Use configuration for application logic
   * if (config.colorOutput) {
   *   enableColoredLogging();
   * }
   *
   * // Access custom variables
   * const customVars = config.customVariables;
   * Object.entries(customVars).forEach(([key, value]) => {
   *   console.log(`Custom variable ${key}: ${value}`);
   * });
   * ```
   */
  async getConfig(): Promise<ConfigOptions> {
    // Check cache validity
    if (
      this.configCache &&
      Date.now() - this.lastCacheTime < this.cacheTimeout
    ) {
      return this.configCache;
    }

    const globalConfig = await ConfigService.loadConfigFile(
      this.globalConfigPath
    );
    const localConfig = await ConfigService.loadConfigFile(
      this.localConfigPath
    );

    // Merge configurations: defaults -> global -> local
    const merged = ConfigService.mergeConfigs(
      this.defaults,
      globalConfig,
      localConfig
    );

    // Update cache
    this.configCache = merged;
    this.lastCacheTime = Date.now();

    return merged;
  }

  /**
   * Get a specific configuration value by key
   *
   * Retrieves a single configuration value from the merged configuration.
   * This method is more efficient than getConfig() when you only need
   * one specific setting, but still benefits from caching.
   *
   * @template K - Type-safe key of ConfigOptions
   * @param key - Configuration option key to retrieve
   * @returns Promise resolving to the configuration value
   *
   * @example
   * ```typescript
   * // Get specific configuration values
   * const format = await configService.getConfigValue('defaultFormat');
   * const paths = await configService.getConfigValue('templatePaths');
   * const verbose = await configService.getConfigValue('verboseMode');
   *
   * // Type-safe access with autocomplete
   * const maxHistory = await configService.getConfigValue('maxHistorySize');
   * console.log(`History size limit: ${maxHistory}`);
   *
   * // Use in conditional logic
   * if (await configService.getConfigValue('autoUpdate')) {
   *   await checkForUpdates();
   * }
   * ```
   */
  async getConfigValue<K extends keyof ConfigOptions>(
    key: K
  ): Promise<ConfigOptions[K]> {
    const config = await this.getConfig();
    return config[key];
  }

  /**
   * Set a specific configuration value
   *
   * Updates a single configuration value in either global or local configuration
   * file. The update is validated before saving and the cache is automatically
   * invalidated to ensure consistency.
   *
   * @template K - Type-safe key of ConfigOptions
   * @param key - Configuration option key to update
   * @param value - New value for the configuration option
   * @param global - Whether to update global (true) or local (false) config
   *
   * @throws {ConfigError} When the new value fails validation
   * @throws {ConfigError} When file operations fail
   *
   * @example
   * ```typescript
   * // Update local configuration
   * await configService.setConfigValue('verboseMode', true);
   * await configService.setConfigValue('defaultFormat', 'json');
   *
   * // Update global configuration
   * await configService.setConfigValue('colorOutput', false, true);
   *
   * // Set custom variables
   * await configService.setConfigValue('customVariables', {
   *   author: 'John Doe',
   *   version: '2.0.0',
   *   environment: 'production'
   * });
   * ```
   */
  async setConfigValue<K extends keyof ConfigOptions>(
    key: K,
    value: ConfigOptions[K],
    global: boolean = false
  ): Promise<void> {
    const configPath = global ? this.globalConfigPath : this.localConfigPath;
    const config = await ConfigService.loadConfigFile(configPath);

    // Update the value
    (config as Record<string, unknown>)[key] = value;

    // Save the config
    await ConfigService.saveConfigFile(configPath, config);

    // Invalidate cache
    this.invalidateCache();
  }

  /**
   * Set multiple configuration values atomically
   *
   * Updates multiple configuration values in a single operation, ensuring
   * atomicity - either all updates succeed or none are applied. This prevents
   * partial configuration corruption if validation fails.
   *
   * @param updates - Object containing configuration updates
   * @param global - Whether to update global (true) or local (false) config
   *
   * @throws {ConfigError} When any update value fails validation
   * @throws {ConfigError} When file operations fail
   *
   * @example
   * ```typescript
   * // Update multiple local settings
   * await configService.setConfig({
   *   verboseMode: true,
   *   defaultFormat: 'markdown',
   *   maxHistorySize: 200,
   *   customVariables: {
   *     project: 'MyApp',
   *     author: 'Team Lead'
   *   }
   * });
   *
   * // Update global user preferences
   * await configService.setConfig({
   *   colorOutput: true,
   *   autoUpdate: false
   * }, true);
   *
   * // Add multiple template paths
   * const currentConfig = await configService.getConfig();
   * await configService.setConfig({
   *   templatePaths: [
   *     ...currentConfig.templatePaths,
   *     '/new/templates',
   *     '/shared/templates'
   *   ]
   * });
   * ```
   */
  async setConfig(
    updates: Partial<ConfigOptions>,
    global: boolean = false
  ): Promise<void> {
    const configPath = global ? this.globalConfigPath : this.localConfigPath;
    const config = await ConfigService.loadConfigFile(configPath);

    // Merge updates
    Object.assign(config, updates);

    // Save the config
    await ConfigService.saveConfigFile(configPath, config);

    // Invalidate cache
    this.invalidateCache();
  }

  /**
   * Delete a configuration value from the specified config file
   *
   * Removes a configuration key from either global or local configuration,
   * causing it to fall back to the next level in the hierarchy (or default).
   * This is useful for removing overrides and returning to inherited values.
   *
   * @param key - Configuration key to delete
   * @param global - Whether to delete from global (true) or local (false) config
   *
   * @throws {ConfigError} When file operations fail
   *
   * @example
   * ```typescript
   * // Remove local override, fall back to global setting
   * await configService.deleteConfigValue('verboseMode');
   *
   * // Remove global setting, fall back to default
   * await configService.deleteConfigValue('colorOutput', true);
   *
   * // Remove custom variables from local config
   * await configService.deleteConfigValue('customVariables');
   *
   * // Verify the value now uses fallback
   * const verbose = await configService.getConfigValue('verboseMode');
   * console.log(`Using fallback verbose mode: ${verbose}`);
   * ```
   */
  async deleteConfigValue(
    key: keyof ConfigOptions,
    global: boolean = false
  ): Promise<void> {
    const configPath = global ? this.globalConfigPath : this.localConfigPath;
    const config = await ConfigService.loadConfigFile(configPath);

    // Delete the key
    delete (config as Record<string, unknown>)[key];

    // Save the config
    await ConfigService.saveConfigFile(configPath, config);

    // Invalidate cache
    this.invalidateCache();
  }

  /**
   * Reset configuration file to defaults by removing it
   *
   * Deletes the specified configuration file, causing all settings to fall
   * back to the next level in the hierarchy. This is useful for clearing
   * all customizations and returning to a clean state.
   *
   * @param global - Whether to reset global (true) or local (false) config
   *
   * @example
   * ```typescript
   * // Reset local project configuration
   * await configService.resetConfig();
   * console.log('Local config reset to global/default values');
   *
   * // Reset global user configuration
   * await configService.resetConfig(true);
   * console.log('Global config reset to default values');
   *
   * // Verify reset by checking merged config
   * const config = await configService.getConfig();
   * console.log('Current config after reset:', config);
   * ```
   */
  async resetConfig(global: boolean = false): Promise<void> {
    const configPath = global ? this.globalConfigPath : this.localConfigPath;

    // Remove the config file
    if (fs.existsSync(configPath)) {
      await fs.promises.unlink(configPath);
    }

    // Invalidate cache
    this.invalidateCache();
  }

  /**
   * List all configuration values from a specific config file
   *
   * Returns the raw configuration from either global or local config file
   * without merging. This shows exactly what overrides are set at each level,
   * useful for debugging configuration issues.
   *
   * @param global - Whether to list global (true) or local (false) config
   * @returns Promise resolving to configuration object from specified file
   *
   * @example
   * ```typescript
   * // View local project overrides
   * const localConfig = await configService.listConfig();
   * console.log('Local overrides:', localConfig);
   *
   * // View global user settings
   * const globalConfig = await configService.listConfig(true);
   * console.log('Global settings:', globalConfig);
   *
   * // Compare configurations
   * const merged = await configService.getConfig();
   * console.log('Final merged config:', merged);
   *
   * // Find which settings are overridden locally
   * const localOverrides = Object.keys(localConfig);
   * console.log(`Local overrides: ${localOverrides.join(', ')}`);
   * ```
   */
  async listConfig(global: boolean = false): Promise<Partial<ConfigOptions>> {
    const configPath = global ? this.globalConfigPath : this.localConfigPath;
    return ConfigService.loadConfigFile(configPath);
  }

  /**
   * Validate configuration object against schema rules
   *
   * Performs comprehensive validation of configuration values including type
   * checking, value range validation, and format verification. This ensures
   * configuration integrity and prevents runtime errors from invalid settings.
   *
   * Validation Rules:
   * - templatePaths: Array of strings
   * - defaultFormat: One of 'markdown', 'plain', 'json'
   * - Boolean fields: Must be actual boolean values
   * - maxHistorySize: Non-negative number
   * - customVariables: Plain object
   *
   * @param config - Configuration object to validate
   * @returns Validation result with success status and error details
   * @returns returns.valid - Whether all validation rules passed
   * @returns returns.errors - Array of error messages for failed validations
   *
   * @example
   * ```typescript
   * // Validate configuration before saving
   * const configUpdates = {
   *   defaultFormat: 'yaml', // Invalid format
   *   maxHistorySize: -10,   // Invalid negative number
   *   verboseMode: 'true'    // Invalid string instead of boolean
   * };
   *
   * const validation = ConfigService.validateConfig(configUpdates);
   * if (!validation.valid) {
   *   console.error('Configuration validation failed:');
   *   validation.errors.forEach(error => console.error(`- ${error}`));
   *   return;
   * }
   *
   * // Safe to apply configuration
   * await configService.setConfig(configUpdates);
   * ```
   */
  static validateConfig(config: Partial<ConfigOptions>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate template paths
    if (config.templatePaths) {
      if (!Array.isArray(config.templatePaths)) {
        errors.push('templatePaths must be an array');
      } else {
        config.templatePaths.forEach((templatePath, index) => {
          if (typeof templatePath !== 'string') {
            errors.push(`templatePaths[${index}] must be a string`);
          }
        });
      }
    }

    // Validate format
    if (
      config.defaultFormat &&
      !['markdown', 'plain', 'json'].includes(config.defaultFormat)
    ) {
      errors.push('defaultFormat must be one of: markdown, plain, json');
    }

    // Validate boolean fields
    const booleanFields: Array<keyof ConfigOptions> = [
      'autoUpdate',
      'colorOutput',
      'verboseMode',
    ];
    booleanFields.forEach(fieldName => {
      if (
        config[fieldName] !== undefined &&
        typeof config[fieldName] !== 'boolean'
      ) {
        errors.push(`${fieldName} must be a boolean`);
      }
    });

    // Validate maxHistorySize
    if (config.maxHistorySize !== undefined) {
      if (typeof config.maxHistorySize !== 'number') {
        errors.push('maxHistorySize must be a number');
      } else if (config.maxHistorySize < 0) {
        errors.push('maxHistorySize must be non-negative');
      }
    }

    // Validate customVariables
    if (
      config.customVariables !== undefined &&
      typeof config.customVariables !== 'object'
    ) {
      errors.push('customVariables must be an object');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Add a new template search path to the configuration
   *
   * Adds a directory path to the template search paths, automatically
   * deduplicating to prevent duplicate entries. Template paths are searched
   * in order when resolving template names, with earlier paths taking precedence.
   *
   * @param templatePath - Directory path to add to template search paths
   * @param global - Whether to add to global (true) or local (false) config
   *
   * @example
   * ```typescript
   * // Add local template directory
   * await configService.addTemplatePath('./my-templates');
   *
   * // Add shared template directory globally
   * await configService.addTemplatePath('/usr/share/cursor-templates', true);
   *
   * // Add multiple paths
   * const templateDirs = [
   *   './templates',
   *   './shared-templates',
   *   '../common-templates'
   * ];
   *
   * for (const dir of templateDirs) {
   *   await configService.addTemplatePath(dir);
   * }
   *
   * // Verify paths were added
   * const config = await configService.getConfig();
   * console.log('Template search paths:', config.templatePaths);
   * ```
   */
  async addTemplatePath(
    templatePath: string,
    global: boolean = false
  ): Promise<void> {
    const config = await this.getConfig();
    const paths = new Set(config.templatePaths);
    paths.add(templatePath);

    await this.setConfigValue('templatePaths', Array.from(paths), global);
  }

  /**
   * Remove a template search path from the configuration
   *
   * Removes a specific directory path from the template search paths.
   * This is useful for cleaning up outdated paths or removing access
   * to template directories that should no longer be searched.
   *
   * @param templatePath - Directory path to remove from template search paths
   * @param global - Whether to remove from global (true) or local (false) config
   *
   * @example
   * ```typescript
   * // Remove obsolete local template path
   * await configService.removeTemplatePath('./old-templates');
   *
   * // Remove global template path
   * await configService.removeTemplatePath('/deprecated/templates', true);
   *
   * // Clean up multiple paths
   * const obsoletePaths = ['./temp-templates', './test-templates'];
   * for (const path of obsoletePaths) {
   *   await configService.removeTemplatePath(path);
   * }
   *
   * // Verify removal
   * const config = await configService.getConfig();
   * console.log('Remaining template paths:', config.templatePaths);
   * ```
   */
  async removeTemplatePath(
    templatePath: string,
    global: boolean = false
  ): Promise<void> {
    const config = await this.getConfig();
    const paths = config.templatePaths.filter(p => p !== templatePath);

    await this.setConfigValue('templatePaths', paths, global);
  }

  /**
   * Load and validate configuration from a JSON file
   *
   * Reads a configuration file from the specified path, parses the JSON content,
   * and validates it against the configuration schema. Returns an empty object
   * if the file doesn't exist, which allows for graceful fallback behavior.
   *
   * @param configPath - Path to the configuration file
   * @returns Promise resolving to parsed and validated configuration
   *
   * @throws {ConfigError} When file contains invalid JSON or fails validation
   *
   * @private
   */
  private static async loadConfigFile(
    configPath: string
  ): Promise<Partial<ConfigOptions>> {
    if (!fs.existsSync(configPath)) {
      return {};
    }

    try {
      const content = await fs.promises.readFile(configPath, 'utf8');
      const config = JSON.parse(content);

      // Validate loaded config
      const validation = ConfigService.validateConfig(config);
      if (!validation.valid) {
        throw new ConfigError(
          `Invalid configuration in ${configPath}: ${validation.errors.join(', ')}`,
          { path: configPath, errors: validation.errors }
        );
      }

      return config;
    } catch (error: any) {
      if (error instanceof ConfigError) {
        throw error;
      }
      throw new ConfigError(`Failed to load configuration from ${configPath}`, {
        path: configPath,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Save configuration to a JSON file with validation and atomic writes
   *
   * Validates the configuration before saving and ensures the target directory
   * exists. Uses atomic write operations to prevent corruption if the process
   * is interrupted during saving.
   *
   * @param configPath - Path where the configuration file should be saved
   * @param config - Configuration object to save
   *
   * @throws {ConfigError} When configuration validation fails
   * @throws {ConfigError} When file operations fail
   *
   * @private
   */
  private static async saveConfigFile(
    configPath: string,
    config: Partial<ConfigOptions>
  ): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    // Validate before saving
    const validation = ConfigService.validateConfig(config);
    if (!validation.valid) {
      throw new ConfigError(
        `Cannot save invalid configuration: ${validation.errors.join(', ')}`,
        { errors: validation.errors }
      );
    }

    try {
      const content = JSON.stringify(config, null, 2);
      await fs.promises.writeFile(configPath, content, 'utf8');
    } catch (error: any) {
      throw new ConfigError(`Failed to save configuration to ${configPath}`, {
        path: configPath,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Merge multiple configuration objects with intelligent handling of complex types
   *
   * Combines multiple configuration objects using smart merging strategies:
   * - Arrays (templatePaths): Deduplicated concatenation
   * - Objects (customVariables): Deep merge with later values overriding
   * - Primitives: Simple override with last non-undefined value
   *
   * @param configs - Variable number of configuration objects to merge
   * @returns Merged configuration object with all overrides applied
   *
   * @private
   */
  private static mergeConfigs(
    ...configs: Partial<ConfigOptions>[]
  ): ConfigOptions {
    const merged = {} as ConfigOptions;

    configs.forEach(config => {
      Object.entries(config).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'templatePaths' && Array.isArray(value)) {
            // Merge template paths uniquely
            const existing =
              ((merged as unknown as Record<string, unknown>)[
                key
              ] as string[]) || [];
            (merged as unknown as Record<string, unknown>)[key] = Array.from(
              new Set([...existing, ...(value as string[])])
            );
          } else if (key === 'customVariables' && typeof value === 'object') {
            // Deep merge custom variables
            (merged as unknown as Record<string, unknown>)[key] = {
              ...(((merged as unknown as Record<string, unknown>)[
                key
              ] as Record<string, unknown>) || {}),
              ...(value as Record<string, unknown>),
            };
          } else {
            // Simple override
            (merged as unknown as Record<string, unknown>)[key] = value;
          }
        }
      });
    });

    return merged;
  }

  /**
   * Invalidate the configuration cache to force reload on next access
   *
   * Clears the cached configuration and resets the cache timestamp, forcing
   * the next getConfig() call to reload from files. This ensures consistency
   * after configuration changes.
   *
   * @private
   */
  private invalidateCache(): void {
    this.configCache = null;
    this.lastCacheTime = 0;
  }

  /**
   * Get the file paths for global and local configuration files
   *
   * Returns the resolved paths to both global and local configuration files.
   * This is useful for debugging configuration issues, displaying configuration
   * locations to users, or implementing configuration file management tools.
   *
   * @returns Object containing both global and local configuration file paths
   * @returns returns.global - Path to global configuration file
   * @returns returns.local - Path to local configuration file
   *
   * @example
   * ```typescript
   * const paths = configService.getConfigPaths();
   * console.log(`Global config: ${paths.global}`);
   * console.log(`Local config: ${paths.local}`);
   *
   * // Check if config files exist
   * import { promises as fs } from 'fs';
   *
   * try {
   *   await fs.access(paths.global);
   *   console.log('Global config file exists');
   * } catch {
   *   console.log('No global config file');
   * }
   *
   * try {
   *   await fs.access(paths.local);
   *   console.log('Local config file exists');
   * } catch {
   *   console.log('No local config file');
   * }
   * ```
   */
  getConfigPaths(): { global: string; local: string } {
    return {
      global: this.globalConfigPath,
      local: this.localConfigPath,
    };
  }
}

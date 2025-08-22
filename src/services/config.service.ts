/**
 * @fileoverview Configuration service for centralized config management
 * @lastmodified 2025-08-22T12:00:00Z
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

export interface ConfigOptions {
  templatePaths: string[];
  defaultFormat: 'markdown' | 'plain' | 'json';
  autoUpdate: boolean;
  colorOutput: boolean;
  verboseMode: boolean;
  maxHistorySize: number;
  customVariables: Record<string, unknown>;
}

export interface ConfigServiceOptions {
  globalConfigPath?: string;
  localConfigPath?: string;
  defaults?: Partial<ConfigOptions>;
}

export class ConfigService {
  private readonly globalConfigPath: string;

  private readonly localConfigPath: string;

  private readonly defaults: ConfigOptions;

  private configCache: ConfigOptions | null = null;

  private lastCacheTime: number = 0;

  private readonly cacheTimeout: number = 5000; // 5 seconds

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
   * Get merged configuration (local overrides global)
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
   * Get a specific config value
   */
  async getConfigValue<K extends keyof ConfigOptions>(
    key: K
  ): Promise<ConfigOptions[K]> {
    const config = await this.getConfig();
    return config[key];
  }

  /**
   * Set a config value
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
   * Set multiple config values
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
   * Delete a config value
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
   * Reset configuration to defaults
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
   * List all configuration values
   */
  async listConfig(global: boolean = false): Promise<Partial<ConfigOptions>> {
    const configPath = global ? this.globalConfigPath : this.localConfigPath;
    return ConfigService.loadConfigFile(configPath);
  }

  /**
   * Validate configuration
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
   * Add a template path
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
   * Remove a template path
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
   * Load configuration from file
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
    } catch (error) {
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
   * Save configuration to file
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
    } catch (error) {
      throw new ConfigError(`Failed to save configuration to ${configPath}`, {
        path: configPath,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Merge multiple configurations
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
   * Invalidate configuration cache
   */
  private invalidateCache(): void {
    this.configCache = null;
    this.lastCacheTime = 0;
  }

  /**
   * Get configuration file paths
   */
  getConfigPaths(): { global: string; local: string } {
    return {
      global: this.globalConfigPath,
      local: this.localConfigPath,
    };
  }
}

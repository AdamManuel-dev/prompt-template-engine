/**
 * @fileoverview Enhanced configuration manager with schema validation
 * @lastmodified 2025-08-22T20:15:00Z
 *
 * Features: Hierarchical config, environment variables, schema validation
 * Main APIs: ConfigManager.get(), set(), merge(), validate()
 * Constraints: JSON schema validation, type safety
 * Patterns: Singleton, hierarchical configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface ConfigSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  default?: unknown;
  properties?: Record<string, ConfigSchema>;
  items?: ConfigSchema;
  enum?: unknown[];
  pattern?: string;
  min?: number;
  max?: number;
  description?: string;
}

export interface ConfigSource {
  name: string;
  priority: number;
  data: Record<string, unknown>;
}

export class ConfigManager {
  private static instance: ConfigManager;

  private sources: ConfigSource[] = [];

  private schema: Record<string, ConfigSchema> = {};

  private cache: Record<string, unknown> = {};

  private watchers: Map<string, Set<(value: unknown) => void>> = new Map();

  private constructor() {
    this.initializeDefaultSchema();
    this.loadConfigurations();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Initialize default configuration schema
   */
  private initializeDefaultSchema(): void {
    this.schema = {
      templates: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            default: './templates',
            description: 'Default templates directory',
          },
          extension: {
            type: 'string',
            default: '.prompt',
            description: 'Template file extension',
          },
        },
      },
      output: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['markdown', 'plain', 'json'],
            default: 'markdown',
            description: 'Default output format',
          },
          clipboard: {
            type: 'boolean',
            default: false,
            description: 'Copy output to clipboard by default',
          },
        },
      },
      cursor: {
        type: 'object',
        properties: {
          integration: {
            type: 'boolean',
            default: true,
            description: 'Enable Cursor IDE integration',
          },
          apiEndpoint: {
            type: 'string',
            default: 'http://localhost:3000',
            description: 'Cursor API endpoint',
          },
          autoSync: {
            type: 'boolean',
            default: false,
            description: 'Auto-sync templates with Cursor',
          },
        },
      },
      plugins: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: true,
            description: 'Enable plugin system',
          },
          directories: {
            type: 'array',
            items: { type: 'string' },
            default: [],
            description: 'Additional plugin directories',
          },
          autoLoad: {
            type: 'boolean',
            default: true,
            description: 'Auto-load plugins on startup',
          },
        },
      },
      logging: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            enum: ['debug', 'info', 'warn', 'error'],
            default: 'info',
            description: 'Logging level',
          },
          file: {
            type: 'string',
            default: '',
            description: 'Log file path',
          },
        },
      },
    };
  }

  /**
   * Load configurations from multiple sources
   */
  private loadConfigurations(): void {
    // 1. Default configuration (lowest priority)
    this.addSource({
      name: 'defaults',
      priority: 0,
      data: this.getDefaults(),
    });

    // 2. Global configuration
    const globalConfigPath = this.getGlobalConfigPath();
    if (fs.existsSync(globalConfigPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
        this.addSource({
          name: 'global',
          priority: 10,
          data,
        });
      } catch (error) {
        logger.error(`Failed to load global config:${String(error)}`);
      }
    }

    // 3. Project configuration
    const projectConfigPath = path.join(process.cwd(), '.cursor-prompt.json');
    if (fs.existsSync(projectConfigPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
        this.addSource({
          name: 'project',
          priority: 20,
          data,
        });
      } catch (error) {
        logger.error(`Failed to load project config:${String(error)}`);
      }
    }

    // 4. Environment variables (highest priority)
    this.loadEnvironmentVariables();

    // Rebuild cache
    this.rebuildCache();
  }

  /**
   * Get global configuration path
   */
  private getGlobalConfigPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(homeDir, '.cursor-prompt', 'config.json');
  }

  /**
   * Load environment variables
   */
  private loadEnvironmentVariables(): void {
    const envData: Record<string, unknown> = {};
    const prefix = 'CURSOR_PROMPT_';

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key
          .substring(prefix.length)
          .toLowerCase()
          .replace(/_/g, '.');

        envData[configKey] = this.parseEnvValue(value || '');
      }
    }

    if (Object.keys(envData).length > 0) {
      this.addSource({
        name: 'environment',
        priority: 30,
        data: envData,
      });
    }
  }

  /**
   * Parse environment variable value
   */
  private parseEnvValue(value: string): unknown {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Try to parse as boolean
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;

      // Try to parse as number
      const num = parseFloat(value);
      if (!isNaN(num)) return num;

      // Return as string
      return value;
    }
  }

  /**
   * Get default values from schema
   */
  private getDefaults(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};

    const extractDefaults = (
      schema: Record<string, ConfigSchema>,
      target: Record<string, unknown>
    ): void => {
      for (const [key, value] of Object.entries(schema)) {
        if (value.default !== undefined) {
          target[key] = value.default;
        } else if (value.type === 'object' && value.properties) {
          target[key] = {};
          extractDefaults(
            value.properties,
            target[key] as Record<string, unknown>
          );
        }
      }
    };

    extractDefaults(this.schema, defaults);
    return defaults;
  }

  /**
   * Add a configuration source
   */
  addSource(source: ConfigSource): void {
    // Remove existing source with same name
    this.sources = this.sources.filter(s => s.name !== source.name);

    // Add new source
    this.sources.push(source);

    // Sort by priority
    this.sources.sort((a, b) => a.priority - b.priority);

    // Rebuild cache
    this.rebuildCache();
  }

  /**
   * Rebuild configuration cache
   */
  private rebuildCache(): void {
    this.cache = {};

    // Merge sources in priority order
    for (const source of this.sources) {
      this.deepMerge(this.cache, source.data);
    }

    // Notify watchers
    this.notifyWatchers();
  }

  /**
   * Deep merge objects
   */
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): void {
    for (const [key, value] of Object.entries(source)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
        if (
          !(key in target) ||
          typeof target[key] !== 'object' ||
          Array.isArray(target[key])
        ) {
          target[key] = {};
        }
        this.deepMerge(
          target[key] as Record<string, unknown>,
          value as Record<string, unknown>
        );
      } else {
        target[key] = value;
      }
    }
  }

  /**
   * Get configuration value
   */
  get<T = unknown>(path: string, defaultValue?: T): T {
    const keys = path.split('.');
    let current: unknown = this.cache;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return defaultValue as T;
      }
    }

    return current as T;
  }

  /**
   * Set configuration value
   */
  set(path: string, value: unknown, source = 'runtime'): void {
    // Validate against schema
    const validation = this.validatePath(path, value);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Create or update runtime source
    let runtimeSource = this.sources.find(s => s.name === source);
    if (!runtimeSource) {
      runtimeSource = {
        name: source,
        priority: 25, // Between project and environment
        data: {},
      };
      this.sources.push(runtimeSource);
    }

    // Set value in source
    const keys = path.split('.');
    let current: Record<string, unknown> = runtimeSource.data;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;

    // Rebuild cache
    this.rebuildCache();
  }

  /**
   * Validate configuration path and value
   */
  private validatePath(
    path: string,
    value: unknown
  ): { valid: boolean; errors: string[] } {
    const keys = path.split('.');
    let currentSchema: ConfigSchema | undefined;

    // Navigate to the schema for this path
    let schemaPath = this.schema;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key in schemaPath) {
        currentSchema = schemaPath[key];
        if (
          i < keys.length - 1 &&
          currentSchema.type === 'object' &&
          currentSchema.properties
        ) {
          schemaPath = currentSchema.properties;
        }
      } else {
        // Path not in schema, allow it
        return { valid: true, errors: [] };
      }
    }

    if (!currentSchema) {
      return { valid: true, errors: [] };
    }

    return this.validateValue(value, currentSchema, path);
  }

  /**
   * Validate a value against schema
   */
  private validateValue(
    value: unknown,
    schema: ConfigSchema,
    path: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check type
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== schema.type) {
      errors.push(`${path}: expected ${schema.type}, got ${actualType}`);
    }

    // Check enum
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${path}: value must be one of ${schema.enum.join(', ')}`);
    }

    // Check pattern
    if (schema.pattern && typeof value === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(`${path}: value does not match pattern ${schema.pattern}`);
      }
    }

    // Check min/max
    if (typeof value === 'number') {
      if (schema.min !== undefined && value < schema.min) {
        errors.push(`${path}: value must be >= ${schema.min}`);
      }
      if (schema.max !== undefined && value > schema.max) {
        errors.push(`${path}: value must be <= ${schema.max}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Save configuration to file
   */
  async save(target: 'global' | 'project' = 'project'): Promise<void> {
    const configPath =
      target === 'global'
        ? this.getGlobalConfigPath()
        : path.join(process.cwd(), '.cursor-prompt.json');

    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const source = this.sources.find(s => s.name === target);
    if (source) {
      fs.writeFileSync(configPath, JSON.stringify(source.data, null, 2));
      logger.info(`Configuration saved to ${configPath}`);
    }
  }

  /**
   * Watch configuration changes
   */
  watch(path: string, callback: (value: unknown) => void): () => void {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, new Set());
    }

    this.watchers.get(path)!.add(callback);

    // Return unwatch function
    return () => {
      const callbacks = this.watchers.get(path);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.watchers.delete(path);
        }
      }
    };
  }

  /**
   * Notify watchers of changes
   */
  private notifyWatchers(): void {
    for (const [path, callbacks] of this.watchers.entries()) {
      const value = this.get(path);
      for (const callback of callbacks) {
        try {
          callback(value);
        } catch (error) {
          logger.error(`Error in config watcher for ${path}:${String(error)}`);
        }
      }
    }
  }

  /**
   * Get all configuration
   */
  getAll(): Record<string, unknown> {
    return { ...this.cache };
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    this.sources = [];
    this.cache = {};
    this.loadConfigurations();
  }
}

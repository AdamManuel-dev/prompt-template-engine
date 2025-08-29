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

// Interface declaration to resolve no-use-before-define
interface IConfigManager {
  get<T>(path: string, defaultValue?: T): T;
  set(path: string, value: unknown, source?: string): void;
  getAll(): Record<string, unknown>;
  watch(path: string, callback: (value: unknown) => void): () => void;
  save(target?: 'global' | 'project'): Promise<void>;
  reset(): void;
}

export class ConfigManager implements IConfigManager {
  private static instance: IConfigManager;

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
    return ConfigManager.instance as ConfigManager;
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
      promptwizard: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: false,
            description: 'Enable PromptWizard optimization features',
          },
          serviceUrl: {
            type: 'string',
            default: 'http://localhost:8000',
            description: 'PromptWizard Python service URL',
          },
          apiKey: {
            type: 'string',
            description: 'API authentication token',
          },
          verifySSL: {
            type: 'boolean',
            default: true,
            description: 'Enable SSL/TLS verification',
          },
          timeout: {
            type: 'number',
            default: 120000,
            min: 30000,
            max: 600000,
            description: 'Request timeout in milliseconds',
          },
          retries: {
            type: 'number',
            default: 3,
            min: 0,
            max: 10,
            description: 'Number of retry attempts',
          },
          autoOptimize: {
            type: 'boolean',
            default: false,
            description: 'Automatically optimize templates on save',
          },
          defaultModel: {
            type: 'string',
            enum: [
              'gpt-4',
              'gpt-3.5-turbo',
              'claude-3-opus',
              'claude-3-sonnet',
              'gemini-pro',
            ],
            default: 'gpt-4',
            description: 'Default target model for optimization',
          },
          mutateRefineIterations: {
            type: 'number',
            default: 3,
            min: 1,
            max: 10,
            description: 'Number of refinement iterations',
          },
          fewShotCount: {
            type: 'number',
            default: 5,
            min: 0,
            max: 20,
            description: 'Number of few-shot examples to generate',
          },
          generateReasoning: {
            type: 'boolean',
            default: true,
            description: 'Generate reasoning chains in optimized prompts',
          },
          maxPromptLength: {
            type: 'number',
            default: 10000,
            min: 1000,
            description: 'Maximum prompt length for optimization',
          },
          minConfidence: {
            type: 'number',
            default: 0.7,
            min: 0,
            max: 1,
            description: 'Minimum confidence threshold for results',
          },
          grpc: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                default: false,
                description: 'Enable gRPC protocol support',
              },
              serviceUrl: {
                type: 'string',
                default: 'localhost:50051',
                description: 'gRPC service URL',
              },
              secure: {
                type: 'boolean',
                default: false,
                description: 'Use secure connection (TLS)',
              },
              keepAlive: {
                type: 'boolean',
                default: true,
                description: 'Enable keep-alive',
              },
              maxReceiveMessageLength: {
                type: 'number',
                default: 4194304,
                min: 1024,
                description: 'Max receive message size in bytes',
              },
              maxSendMessageLength: {
                type: 'number',
                default: 4194304,
                min: 1024,
                description: 'Max send message size in bytes',
              },
            },
          },
          websocket: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                default: false,
                description: 'Enable WebSocket streaming',
              },
              serviceUrl: {
                type: 'string',
                default: 'ws://localhost:8001/ws/optimize',
                description: 'WebSocket service URL',
              },
              reconnectInterval: {
                type: 'number',
                default: 5000,
                min: 1000,
                description: 'Reconnection interval in milliseconds',
              },
              maxReconnectAttempts: {
                type: 'number',
                default: 10,
                min: 0,
                description: 'Maximum reconnection attempts',
              },
              heartbeatInterval: {
                type: 'number',
                default: 30000,
                min: 5000,
                description: 'Heartbeat interval in milliseconds',
              },
            },
          },
          cache: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                default: true,
                description: 'Enable optimization result caching',
              },
              ttl: {
                type: 'number',
                default: 86400,
                min: 300,
                description: 'Cache TTL in seconds',
              },
              maxSize: {
                type: 'number',
                default: 1000,
                min: 10,
                description: 'Maximum cache entries',
              },
              redis: {
                type: 'object',
                properties: {
                  enabled: {
                    type: 'boolean',
                    default: false,
                    description: 'Enable Redis distributed caching',
                  },
                  url: {
                    type: 'string',
                    default: 'redis://localhost:6379',
                    description: 'Redis connection URL',
                  },
                  keyPrefix: {
                    type: 'string',
                    default: 'promptwizard:',
                    description: 'Redis key prefix',
                  },
                },
              },
            },
          },
          rateLimiting: {
            type: 'object',
            properties: {
              maxRequests: {
                type: 'number',
                default: 100,
                min: 1,
                description: 'Maximum requests per window',
              },
              windowMs: {
                type: 'number',
                default: 3600000,
                min: 60000,
                description: 'Rate limiting window in milliseconds',
              },
              skipCached: {
                type: 'boolean',
                default: true,
                description: 'Skip rate limiting for cached results',
              },
            },
          },
          analytics: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                default: true,
                description: 'Enable analytics tracking',
              },
              trackUsage: {
                type: 'boolean',
                default: true,
                description: 'Track usage metrics',
              },
              reportInterval: {
                type: 'number',
                default: 3600,
                min: 300,
                description: 'Report interval in seconds',
              },
              backend: {
                type: 'string',
                enum: ['memory', 'redis', 'file'],
                default: 'memory',
                description: 'Analytics storage backend',
              },
            },
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
    const globalConfigPath = ConfigManager.getGlobalConfigPath();
    if (fs.existsSync(globalConfigPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
        this.addSource({
          name: 'global',
          priority: 10,
          data,
        });
      } catch (error: unknown) {
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
      } catch (error: unknown) {
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
  private static getGlobalConfigPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(homeDir, '.cursor-prompt', 'config.json');
  }

  /**
   * Load environment variables
   */
  private loadEnvironmentVariables(): void {
    const envData: Record<string, unknown> = {};
    const prefix = 'CURSOR_PROMPT_';

    Object.entries(process.env)
      .filter(([key]) => key.startsWith(prefix))
      .forEach(([key, value]) => {
        const configKey = key
          .substring(prefix.length)
          .toLowerCase()
          .replace(/_/g, '.');

        envData[configKey] = ConfigManager.parseEnvValue(value || '');
      });

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
  private static parseEnvValue(value: string): unknown {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch {
      // Try to parse as boolean
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;

      // Try to parse as number
      const num = parseFloat(value);
      if (!Number.isNaN(num)) return num;

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
      Object.entries(schema).forEach(([key, value]) => {
        if (value.default !== undefined) {
          // eslint-disable-next-line no-param-reassign
          target[key] = value.default;
        } else if (value.type === 'object' && value.properties) {
          // eslint-disable-next-line no-param-reassign
          target[key] = {};
          extractDefaults(
            value.properties,
            target[key] as Record<string, unknown>
          );
        }
      });
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
    this.sources.forEach(source => {
      this.deepMerge(this.cache, source.data);
    });

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
    Object.entries(source)
      .filter(([, value]) => value !== null && value !== undefined)
      .forEach(([key, value]) => {
        if (typeof value === 'object' && !Array.isArray(value)) {
          if (
            !(key in target) ||
            typeof target[key] !== 'object' ||
            Array.isArray(target[key])
          ) {
            // eslint-disable-next-line no-param-reassign
            target[key] = {};
          }
          this.deepMerge(
            target[key] as Record<string, unknown>,
            value as Record<string, unknown>
          );
        } else {
          // eslint-disable-next-line no-param-reassign
          target[key] = value;
        }
      });
  }

  /**
   * Get configuration value
   */
  get<T = unknown>(keyPath: string, defaultValue?: T): T {
    const keys = keyPath.split('.');
    let current: unknown = this.cache;

    // Traverse nested object path to find the value
    // eslint-disable-next-line no-restricted-syntax
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
  set(keyPath: string, value: unknown, source = 'runtime'): void {
    // Validate against schema
    const validation = this.validatePath(keyPath, value);
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
    const keys = keyPath.split('.');
    let current: Record<string, unknown> = runtimeSource.data;

    for (let i = 0; i < keys.length - 1; i += 1) {
      const key = keys[i];
      if (!key) continue;
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
    if (lastKey !== undefined) {
      current[lastKey] = value;
    }

    // Rebuild cache
    this.rebuildCache();
  }

  /**
   * Validate configuration path and value
   */
  private validatePath(
    keyPath: string,
    value: unknown
  ): { valid: boolean; errors: string[] } {
    const keys = keyPath.split('.');
    let currentSchema: ConfigSchema | undefined;

    // Navigate to the schema for this path
    let schemaPath = this.schema;
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (!key) continue;
      if (key in schemaPath) {
        currentSchema = schemaPath[key];
        if (
          i < keys.length - 1 &&
          currentSchema &&
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

    return ConfigManager.validateValue(value, currentSchema, keyPath);
  }

  /**
   * Validate a value against schema
   */
  private static validateValue(
    value: unknown,
    schema: ConfigSchema,
    keyPath: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check type
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== schema.type) {
      errors.push(`${keyPath}: expected ${schema.type}, got ${actualType}`);
    }

    // Check enum
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${keyPath}: value must be one of ${schema.enum.join(', ')}`);
    }

    // Check pattern
    if (schema.pattern && typeof value === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(
          `${keyPath}: value does not match pattern ${schema.pattern}`
        );
      }
    }

    // Check min/max
    if (typeof value === 'number') {
      if (schema.min !== undefined && value < schema.min) {
        errors.push(`${keyPath}: value must be >= ${schema.min}`);
      }
      if (schema.max !== undefined && value > schema.max) {
        errors.push(`${keyPath}: value must be <= ${schema.max}`);
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
        ? ConfigManager.getGlobalConfigPath()
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
  watch(keyPath: string, callback: (value: unknown) => void): () => void {
    if (!this.watchers.has(keyPath)) {
      this.watchers.set(keyPath, new Set());
    }

    this.watchers.get(keyPath)!.add(callback);

    // Return unwatch function
    return () => {
      const callbacks = this.watchers.get(keyPath);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.watchers.delete(keyPath);
        }
      }
    };
  }

  /**
   * Notify watchers of changes
   */
  private notifyWatchers(): void {
    Array.from(this.watchers.entries()).forEach(([keyPath, callbacks]) => {
      const value = this.get(keyPath);
      callbacks.forEach(callback => {
        try {
          callback(value);
        } catch (error: unknown) {
          logger.error(`Error in config watcher for ${path}:${String(error)}`);
        }
      });
    });
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

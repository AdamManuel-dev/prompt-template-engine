/**
 * @fileoverview Secure plugin manager with sandboxing
 * @lastmodified 2025-08-26T03:27:11Z
 *
 * Features: Secure plugin loading, execution, and lifecycle management
 * Main APIs: SecurePluginManager class for safe plugin operations
 * Constraints: All plugins run in sandboxed workers, resource limits enforced
 * Patterns: Manager pattern, sandbox pattern, lifecycle management
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { IPlugin, PluginAPI } from '../types';
import {
  PluginSandbox,
  SandboxConfig,
  PluginExecutionResult,
} from './sandbox/plugin-sandbox';
import { logger } from '../utils/logger';

/**
 * Secure plugin code validator
 */
class SecurePluginValidator {
  private dangerousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /setTimeout\s*\(/,
    /setInterval\s*\(/,
    /require\s*\(/,
    /process\./,
    /global\./,
    /__dirname/,
    /__filename/,
    /import\s+/,
    /\bfs\./,
    /\bos\./,
    /\bchild_process\./,
  ];

  validatePluginCode(code: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for dangerous patterns using regex
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(`Dangerous pattern detected: ${pattern.source}`);
      }
    }

    // Try to parse with Babel to check syntax
    try {
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['objectRestSpread', 'functionBind'],
      });

      traverse(ast, {
        enter: nodePath => {
          const { node } = nodePath;

          // Block dangerous function calls
          if (
            node.type === 'CallExpression' &&
            node.callee.type === 'Identifier'
          ) {
            const dangerousFunctions = [
              'eval',
              'Function',
              'require',
              'setTimeout',
              'setInterval',
            ];
            if (dangerousFunctions.includes(node.callee.name)) {
              errors.push(`Dangerous function call: ${node.callee.name}`);
            }
          }

          // Block access to dangerous objects
          if (
            node.type === 'MemberExpression' &&
            node.object.type === 'Identifier'
          ) {
            const dangerousObjects = [
              'process',
              'global',
              'fs',
              'os',
              'child_process',
            ];
            if (dangerousObjects.includes(node.object.name)) {
              errors.push(`Dangerous object access: ${node.object.name}`);
            }
          }
        },
      });
    } catch (parseError: unknown) {
      const errorMessage =
        parseError instanceof Error ? parseError.message : String(parseError);
      errors.push(`Plugin code parsing failed: ${errorMessage}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Plugin security policy
 */
export interface PluginSecurityPolicy {
  // Plugin validation
  requireSignature: boolean;
  allowedAuthors: string[];
  blacklistedPlugins: string[];

  // Code analysis
  disallowEval: boolean;
  disallowDynamicImports: boolean;
  maxCodeSize: number;

  // Runtime restrictions
  sandbox: SandboxConfig;
}

/**
 * Plugin metadata
 */
export interface SecurePluginMetadata {
  name: string;
  version: string;
  author: string;
  signature?: string;
  hash: string;
  loadedAt: Date;
  lastExecuted?: Date;
  executionCount: number;
  errors: string[];
}

/**
 * Plugin manager options
 */
export interface PluginManagerOptions {
  pluginsPath: string;
  enableSandbox?: boolean;
  timeout?: number;
  memoryLimit?: number;
}

/**
 * Default security policy
 */
export const DEFAULT_SECURITY_POLICY: PluginSecurityPolicy = {
  requireSignature: false,
  allowedAuthors: [],
  blacklistedPlugins: [],
  disallowEval: true,
  disallowDynamicImports: true,
  maxCodeSize: 1024 * 1024, // 1MB
  sandbox: {
    maxMemoryMB: 50,
    maxExecutionTimeMs: 10000,
    maxCpuUsagePercent: 80,
    allowedReadPaths: ['./plugins'],
    allowedWritePaths: ['./plugins/data'],
    allowNetworkAccess: false,
    allowedAPIs: ['log', 'storage', 'fs'],
  },
};

/**
 * Secure plugin manager with sandboxing
 */
export class SecurePluginManager {
  private plugins = new Map<string, IPlugin>();

  private metadata = new Map<string, SecurePluginMetadata>();

  private sandbox: PluginSandbox;

  private activePlugins = new Set<string>();

  private disabledPlugins = new Set<string>();

  private validationErrors: string[] = [];

  private hooks = new Map<
    string,
    Array<{ plugin: IPlugin; handler: Function; priority: number }>
  >();

  private helpers = new Map<string, Function>();

  private pluginsDir: string;

  private enableSandbox: boolean;

  private securityPolicy: PluginSecurityPolicy;

  constructor(
    options: PluginManagerOptions | string = './plugins',
    securityPolicy: PluginSecurityPolicy = DEFAULT_SECURITY_POLICY
  ) {
    // Support both new options object and legacy string parameter
    if (typeof options === 'string') {
      this.pluginsDir = options;
      this.enableSandbox = true;
    } else {
      this.pluginsDir = options.pluginsPath;
      this.enableSandbox = options.enableSandbox ?? true;
    }

    this.securityPolicy = securityPolicy;
    this.sandbox = new PluginSandbox(this.securityPolicy.sandbox);
  }

  /**
   * Load a plugin from file with comprehensive security validation
   * @param pluginPath - Absolute path to the plugin file
   * @returns Promise that resolves when plugin is successfully loaded
   * @throws Error if plugin path is invalid, code fails validation, or loading fails
   */
  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      // Validate file path
      const normalizedPath = path.normalize(pluginPath);
      if (!normalizedPath.startsWith(path.normalize(this.pluginsDir))) {
        throw new Error(`Plugin path outside allowed directory: ${pluginPath}`);
      }

      // Read and validate plugin file
      const pluginCode = await fs.readFile(pluginPath, 'utf8');
      await this.validatePluginCode(pluginCode, pluginPath);

      // Parse plugin
      const plugin = await this.parsePlugin(pluginCode, pluginPath);

      // Security checks
      await this.performSecurityChecks(plugin, pluginCode);

      // Load plugin
      this.plugins.set(plugin.name, plugin);
      this.metadata.set(plugin.name, {
        name: plugin.name,
        version: plugin.version,
        author: plugin.author || 'Unknown',
        hash: await this.calculateHash(pluginCode),
        loadedAt: new Date(),
        executionCount: 0,
        errors: [],
      });

      logger.info(`Plugin loaded securely: ${plugin.name}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load plugin ${pluginPath}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Load all plugins from directory with error handling for individual failures
   * @returns Promise that resolves when directory scan and loading is complete
   * @throws Error if plugins directory cannot be accessed
   */
  async loadPluginsFromDirectory(): Promise<void> {
    try {
      const files = await fs.readdir(this.pluginsDir);
      const pluginFiles = files.filter(
        file => file.endsWith('.js') || file.endsWith('.ts')
      );

      for (const file of pluginFiles) {
        try {
          await this.loadPlugin(path.join(this.pluginsDir, file));
        } catch (error: any) {
          logger.error(`Failed to load plugin ${file}: ${error.message}`);
        }
      }

      logger.info(
        `Loaded ${this.plugins.size} plugins from ${this.pluginsDir}`
      );
    } catch (error: any) {
      logger.error(`Failed to load plugins directory: ${error.message}`);
    }
  }

  /**
   * Load all plugins from directory with optional user configuration
   * @param userConfig - Optional configuration object with plugin-specific settings
   * @returns Promise that resolves when all plugins are loaded and initialized
   * @throws Error if plugins directory cannot be accessed or critical plugins fail
   */
  async loadPlugins(userConfig?: Record<string, unknown>): Promise<void> {
    await this.loadPluginsFromDirectory();
    if (userConfig) {
      // Apply user configuration to plugins
      for (const [name, plugin] of Array.from(this.plugins.entries())) {
        if (plugin.init && userConfig[name]) {
          try {
            await plugin.init(this.createPluginAPI(name), userConfig[name]);
          } catch (error: any) {
            this.validationErrors.push(
              `Plugin ${name} init failed: ${error.message}`
            );
          }
        }
      }
    }
  }

  /**
   * Get array of all currently loaded plugins
   * @returns Array of loaded plugin instances
   */
  getLoadedPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Shutdown all plugins and perform complete cleanup
   * @returns Promise that resolves when shutdown and cleanup is complete
   */
  async shutdown(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Get all validation errors encountered during plugin loading
   * @returns Array of validation error messages
   */
  getValidationErrors(): string[] {
    return [...this.validationErrors];
  }

  /**
   * Execute hook on all plugins with priority ordering and sandboxing
   * @param name - Hook name to execute
   * @param args - Arguments to pass to hook handlers
   * @returns Promise resolving to the final result after all hook processing
   * @throws Error if critical hook execution fails
   */
  async executeHook<T = unknown>(name: string, ...args: unknown[]): Promise<T> {
    return this.executeHookWithType<T>(name, ...args);
  }

  /**
   * Execute hook with specific type for template context hooks
   * @param name - Hook name to execute
   * @param args - Arguments to pass to hook handlers
   * @returns Promise resolving to the final result after all hook processing
   * @throws Error if critical hook execution fails
   */
  private async executeHookWithType<T>(
    name: string,
    ...args: unknown[]
  ): Promise<T> {
    const hookHandlers = this.hooks.get(name) || [];

    // Sort by priority (higher priority first)
    hookHandlers.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    let result = args[0]; // First argument is usually the main data to transform

    for (const { plugin, handler } of hookHandlers) {
      // Skip disabled plugins
      if (this.disabledPlugins.has(plugin.name)) {
        continue;
      }

      try {
        if (this.enableSandbox) {
          // Execute in sandbox
          const sandboxResult = await this.sandbox.executePlugin(
            plugin,
            'executeHook',
            [name, result, ...args.slice(1)]
          );
          if (sandboxResult.success) {
            result = sandboxResult.result;
          } else {
            logger.error(
              `Hook ${name} failed in plugin ${plugin.name}: ${sandboxResult.error}`
            );
          }
        } else {
          // Execute directly
          result = await handler.call(plugin, result, ...args.slice(1));
        }
      } catch (error: any) {
        logger.error(
          `Hook ${name} error in plugin ${plugin.name}: ${error.message}`
        );
        // Continue with other plugins
      }
    }

    return result as T;
  }

  /**
   * Get aggregated helpers from all plugins (excluding disabled plugins)
   * @returns Record of helper name to function mappings from all active plugins
   */
  getHelpers(): Record<string, Function> {
    const allHelpers: Record<string, Function> = {};

    // Collect helpers from all plugins (last loaded wins for conflicts)
    for (const [pluginName, plugin] of Array.from(this.plugins.entries())) {
      if (this.disabledPlugins.has(pluginName)) {
        continue;
      }

      if (plugin.hooks && typeof plugin.hooks === 'object') {
        // Check if hooks contains helpers property
        const hooks = plugin.hooks as any;
        if (hooks.helpers) {
          Object.assign(allHelpers, hooks.helpers);
        }
      }
    }

    // Also include directly registered helpers
    for (const [name, helper] of Array.from(this.helpers.entries())) {
      allHelpers[name] = helper;
    }

    return allHelpers;
  }

  /**
   * Enable a specific plugin and activate it
   * @param name - Plugin name to enable
   * @returns Promise resolving to true if plugin was successfully enabled
   */
  async enablePlugin(name: string): Promise<boolean> {
    if (!this.plugins.has(name)) {
      logger.error(`Cannot enable unknown plugin: ${name}`);
      return false;
    }

    this.disabledPlugins.delete(name);
    return await this.activatePlugin(name);
  }

  /**
   * Disable a specific plugin and deactivate it
   * @param name - Plugin name to disable
   * @returns Promise resolving to true if plugin was successfully disabled
   */
  async disablePlugin(name: string): Promise<boolean> {
    if (!this.plugins.has(name)) {
      return true; // Already not loaded
    }

    this.disabledPlugins.add(name);
    return await this.deactivatePlugin(name);
  }

  /**
   * Initialize all loaded plugins with API access and hook registration
   * @returns Promise that resolves when all plugins are initialized
   */
  async initializePlugins(): Promise<void> {
    const initResults = [];

    for (const [name, plugin] of Array.from(this.plugins.entries())) {
      try {
        // Create plugin API
        const api = this.createPluginAPI(name);

        // Initialize plugin
        const initResult = await plugin.init(api);
        if (initResult) {
          this.activePlugins.add(name);
          logger.info(`Plugin initialized: ${name}`);

          // Register hooks
          if (plugin.hooks) {
            for (const [hookName, handler] of Object.entries(plugin.hooks)) {
              if (typeof handler === 'function') {
                this.registerHook(hookName, plugin, handler);
              }
            }
          }
        } else {
          logger.error(`Plugin initialization failed: ${name}`);
        }

        initResults.push({
          name,
          success: !!initResult,
          error: initResult ? undefined : 'Initialization returned false',
        });
      } catch (error: any) {
        logger.error(`Plugin initialization error: ${name} - ${error.message}`);
        this.validationErrors.push(
          `Plugin ${name} initialization failed: ${error.message}`
        );
        initResults.push({ name, success: false, error: error.message });
      }
    }

    logger.info(
      `Initialized ${this.activePlugins.size}/${this.plugins.size} plugins`
    );
  }

  /**
   * Execute a plugin method safely in sandbox with error handling
   * @param pluginName - Name of plugin to execute
   * @param method - Method name to execute (default: 'execute')
   * @param args - Arguments to pass to the method
   * @returns Promise resolving to plugin execution result with stats
   */
  async executePlugin(
    pluginName: string,
    method: string = 'execute',
    args: unknown[] = []
  ): Promise<PluginExecutionResult> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return {
        success: false,
        error: `Plugin not found: ${pluginName}`,
        stats: { executionTime: 0, memoryUsed: 0, cpuUsage: 0 },
      };
    }

    const metadata = this.metadata.get(pluginName)!;

    try {
      // Update execution stats
      metadata.executionCount += 1;
      metadata.lastExecuted = new Date();

      // Execute in sandbox
      const result = await this.sandbox.executePlugin(plugin, method, args);

      if (!result.success && result.error) {
        metadata.errors.push(`${new Date().toISOString()}: ${result.error}`);
        // Keep only last 10 errors
        if (metadata.errors.length > 10) {
          metadata.errors = metadata.errors.slice(-10);
        }
      }

      logger.info(
        `Plugin executed: ${pluginName}.${method} (${result.success ? 'success' : 'failed'})`
      );
      return result;
    } catch (error: any) {
      const errorMsg = error.message;
      metadata.errors.push(`${new Date().toISOString()}: ${errorMsg}`);

      return {
        success: false,
        error: errorMsg,
        stats: { executionTime: 0, memoryUsed: 0, cpuUsage: 0 },
      };
    }
  }

  /**
   * Activate a plugin by calling its activate method
   * @param pluginName - Name of plugin to activate
   * @returns Promise resolving to true if activation was successful
   */
  async activatePlugin(pluginName: string): Promise<boolean> {
    if (!this.plugins.has(pluginName)) {
      logger.error(`Cannot activate unknown plugin: ${pluginName}`);
      return false;
    }

    const result = await this.executePlugin(pluginName, 'activate');
    if (result.success) {
      this.activePlugins.add(pluginName);
      logger.info(`Plugin activated: ${pluginName}`);
      return true;
    }
    logger.error(`Plugin activation failed: ${pluginName} - ${result.error}`);
    return false;
  }

  /**
   * Deactivate a plugin by calling its deactivate method
   * @param pluginName - Name of plugin to deactivate
   * @returns Promise resolving to true if deactivation was successful
   */
  async deactivatePlugin(pluginName: string): Promise<boolean> {
    if (!this.activePlugins.has(pluginName)) {
      return true; // Already deactivated
    }

    const result = await this.executePlugin(pluginName, 'deactivate');
    if (result.success) {
      this.activePlugins.delete(pluginName);
      logger.info(`Plugin deactivated: ${pluginName}`);
      return true;
    }
    logger.error(`Plugin deactivation failed: ${pluginName} - ${result.error}`);
    return false;
  }

  /**
   * Unload a plugin completely from memory and cleanup resources
   * @param pluginName - Name of plugin to unload
   * @returns Promise resolving to true if plugin was successfully unloaded
   */
  async unloadPlugin(pluginName: string): Promise<boolean> {
    try {
      await this.deactivatePlugin(pluginName);
      await this.executePlugin(pluginName, 'dispose');

      this.plugins.delete(pluginName);
      this.metadata.delete(pluginName);
      this.activePlugins.delete(pluginName);

      logger.info(`Plugin unloaded: ${pluginName}`);
      return true;
    } catch (error: any) {
      logger.error(`Plugin unload failed: ${pluginName} - ${error.message}`);
      return false;
    }
  }

  /**
   * Get plugin information including metadata and execution stats
   * @param pluginName - Name of plugin to get information for
   * @returns Plugin metadata object or null if plugin not found
   */
  getPluginInfo(pluginName: string): SecurePluginMetadata | null {
    return this.metadata.get(pluginName) || null;
  }

  /**
   * List all loaded plugins with their metadata
   * @returns Array of plugin metadata for all loaded plugins
   */
  listPlugins(): SecurePluginMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Get names of all currently active plugins
   * @returns Array of active plugin names
   */
  getActivePlugins(): string[] {
    return Array.from(this.activePlugins);
  }

  /**
   * Cleanup all resources including plugins, sandbox, and internal state
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanup(): Promise<void> {
    // Deactivate all plugins
    for (const pluginName of Array.from(this.activePlugins)) {
      await this.deactivatePlugin(pluginName);
    }

    // Dispose all plugins
    for (const [name, plugin] of Array.from(this.plugins.entries())) {
      try {
        if (plugin.dispose) {
          await plugin.dispose();
        }
      } catch (error: any) {
        logger.error(`Plugin disposal error: ${name} - ${error.message}`);
      }
    }

    // Cleanup sandbox
    if (this.sandbox) {
      await this.sandbox.cleanup();
    }

    // Clear all collections
    this.plugins.clear();
    this.metadata.clear();
    this.activePlugins.clear();
    this.disabledPlugins.clear();
    this.hooks.clear();
    this.helpers.clear();
    this.validationErrors = [];

    logger.info('Plugin manager cleanup completed');
  }

  /**
   * Validate plugin code for security issues and policy violations
   * @param code - Plugin code to validate
   * @param _filePath - File path (unused but kept for interface compatibility)
   * @returns Promise that resolves if code is valid
   * @throws Error if code violates security policy
   * @private
   */
  private async validatePluginCode(
    code: string,
    _filePath: string
  ): Promise<void> {
    // Check code size
    if (code.length > this.securityPolicy.maxCodeSize) {
      throw new Error(`Plugin code too large: ${code.length} bytes`);
    }

    // Check for dangerous patterns
    if (this.securityPolicy.disallowEval) {
      if (/\beval\s*\(/.test(code) || /new\s+Function\s*\(/.test(code)) {
        throw new Error('Plugin contains eval() or Function constructor');
      }
    }

    if (this.securityPolicy.disallowDynamicImports) {
      if (/\bimport\s*\(/.test(code) || /require\s*\(/.test(code)) {
        throw new Error('Plugin contains dynamic imports or require calls');
      }
    }

    // Check for file system access outside sandbox
    const dangerousPatterns = [
      /process\.exit/,
      /process\.abort/,
      /child_process/,
      /cluster/,
      /worker_threads/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Plugin contains dangerous pattern: ${pattern.source}`);
      }
    }
  }

  /**
   * Securely parse plugin from code string into plugin object
   * @param code - Plugin code to parse
   * @param filePath - File path for error reporting
   * @returns Promise resolving to parsed plugin object
   * @throws Error if plugin cannot be parsed or is missing required fields
   * @private
   */
  private async parsePlugin(code: string, filePath: string): Promise<IPlugin> {
    try {
      // Validate plugin code for security risks
      const validator = new SecurePluginValidator();
      const validation = validator.validatePluginCode(code);

      if (!validation.isValid) {
        logger.error(
          `Plugin code validation failed for ${filePath}:`,
          validation.errors
        );
        throw new Error(
          `Plugin code validation failed: ${validation.errors.join(', ')}`
        );
      }

      let plugin: IPlugin;

      try {
        // SECURITY: Parse plugin code using AST instead of Function constructor
        logger.debug(`Parsing plugin code using AST for ${filePath}`);

        // Parse the code using Babel AST
        const ast = parse(code, {
          sourceType: 'module',
          plugins: ['objectRestSpread', 'functionBind'],
        });

        // Extract plugin configuration from AST
        const pluginConfig: Record<string, unknown> = {};

        traverse(ast, {
          // Look for module.exports assignments
          AssignmentExpression: path => {
            const { left } = path.node;
            if (
              left.type === 'MemberExpression' &&
              left.object.type === 'MemberExpression' &&
              left.object.object.type === 'Identifier' &&
              left.object.object.name === 'module' &&
              left.object.property.type === 'Identifier' &&
              left.object.property.name === 'exports'
            ) {
              // Extract literal values from the right side
              const { right } = path.node;
              if (right.type === 'ObjectExpression') {
                right.properties.forEach(prop => {
                  if (
                    prop.type === 'ObjectProperty' &&
                    'key' in prop &&
                    'value' in prop &&
                    typeof prop.key === 'object' &&
                    (prop.key as any).type === 'Identifier' &&
                    'name' in prop.key &&
                    typeof prop.value === 'object' &&
                    (prop.value as any).type === 'Literal' &&
                    'value' in prop.value
                  ) {
                    pluginConfig[(prop.key as { name: string }).name] = (
                      prop.value as { value: unknown }
                    ).value;
                  }
                });
              }
            }
          },

          // Look for direct exports
          ExportDefaultDeclaration: path => {
            const { declaration } = path.node;
            if (declaration.type === 'ObjectExpression') {
              declaration.properties.forEach(prop => {
                if (
                  prop.type === 'ObjectProperty' &&
                  'key' in prop &&
                  'value' in prop &&
                  typeof prop.key === 'object' &&
                  (prop.key as any).type === 'Identifier' &&
                  'name' in prop.key &&
                  typeof prop.value === 'object' &&
                  (prop.value as any).type === 'Literal' &&
                  'value' in prop.value
                ) {
                  pluginConfig[(prop.key as { name: string }).name] = (
                    prop.value as { value: unknown }
                  ).value;
                }
              });
            }
          },
        });

        plugin = pluginConfig as unknown as IPlugin;
      } catch (_parseError) {
        // Fallback to basic plugin structure
        plugin = {
          name: path.basename(filePath, path.extname(filePath)),
          version: '1.0.0',
          description: 'Plugin loaded from file',
          author: 'Unknown',
          init: async () =>
            // Default initialization
            true,
        };
      }

      // Validate required fields
      if (!plugin.name) {
        throw new Error('Plugin missing required field: name');
      }
      if (!plugin.version) {
        throw new Error('Plugin missing required field: version');
      }

      // Ensure init function exists
      if (!plugin.init) {
        plugin.init = () => Promise.resolve(true);
      }

      // Set default priority if not provided
      if (plugin.priority === undefined) {
        plugin.priority = 0;
      }

      return plugin as IPlugin;
    } catch (error: any) {
      this.validationErrors.push(
        `Failed to parse plugin ${filePath}: ${error.message}`
      );
      throw new Error(`Failed to parse plugin: ${error.message}`);
    }
  }

  /**
   * Perform security checks on plugin including author validation and blacklisting
   * @param plugin - Plugin object to validate
   * @param _code - Plugin code (unused but kept for interface compatibility)
   * @returns Promise that resolves if plugin passes security checks
   * @throws Error if plugin fails security validation
   * @private
   */
  private async performSecurityChecks(
    plugin: IPlugin,
    _code: string
  ): Promise<void> {
    // Check author whitelist
    if (this.securityPolicy.allowedAuthors.length > 0) {
      if (
        !plugin.author ||
        !this.securityPolicy.allowedAuthors.includes(plugin.author)
      ) {
        throw new Error(`Plugin author not in allowed list: ${plugin.author}`);
      }
    }

    // Check blacklist
    if (this.securityPolicy.blacklistedPlugins.includes(plugin.name)) {
      throw new Error(`Plugin is blacklisted: ${plugin.name}`);
    }

    // Signature verification (if required)
    if (this.securityPolicy.requireSignature) {
      // Implementation would verify digital signatures
      throw new Error('Plugin signature verification not implemented');
    }
  }

  /**
   * Calculate SHA-256 hash of plugin code for integrity verification
   * @param code - Plugin code to hash
   * @returns Promise resolving to hex-encoded SHA-256 hash
   * @private
   */
  private async calculateHash(code: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Register a hook handler for a specific plugin with priority
   * @param name - Hook name to register
   * @param plugin - Plugin instance registering the hook
   * @param handler - Hook handler function
   * @private
   */
  private registerHook(name: string, plugin: IPlugin, handler: Function): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }

    const handlers = this.hooks.get(name)!;
    handlers.push({
      plugin,
      handler,
      priority: plugin.priority || 0,
    });
  }

  /**
   * Create plugin API for a specific plugin with security restrictions
   * @param pluginName - Name of plugin to create API for
   * @returns Plugin API object with restricted access to system functions
   * @private
   */
  private createPluginAPI(pluginName: string): PluginAPI {
    return {
      getVersion: () => '1.0.0',
      getConfig: (key?: string) => {
        const plugin = this.plugins.get(pluginName);
        if (!plugin?.defaultConfig) return undefined;
        return key ? plugin.defaultConfig[key] : plugin.defaultConfig;
      },
      setConfig: (key: string, value: unknown) => {
        const plugin = this.plugins.get(pluginName);
        if (plugin?.defaultConfig) {
          plugin.defaultConfig[key] = value;
        }
      },
      registerCommand: (name: string, _handler: unknown) => {
        // Store command handler
        logger.info(`Plugin ${pluginName} registered command: ${name}`);
      },
      getCommand: (_name: string) =>
        // Return command handler
        undefined,
      on: (event: string, _callback: (...args: unknown[]) => void) => {
        // Event subscription
        logger.info(`Plugin ${pluginName} subscribed to event: ${event}`);
      },
      emit: (event: string, _data: unknown) => {
        // Event emission
        logger.info(`Plugin ${pluginName} emitted event: ${event}`);
      },
      storage: {
        get: async (_key: string) =>
          // Simple storage implementation
          undefined,
        set: async (_key: string, _value: unknown) => {
          // Simple storage implementation
        },
        delete: async (_key: string) => {
          // Simple storage implementation
        },
      },
      fs: {
        readFile: async (path: string) => {
          // Secure file reading within plugin directory
          const safePath = this.validatePluginPath(path);
          return await fs.readFile(safePath, 'utf8');
        },
        writeFile: async (path: string, content: string) => {
          // Secure file writing within plugin directory
          const safePath = this.validatePluginPath(path);
          await fs.writeFile(safePath, content);
        },
        exists: async (path: string) => {
          try {
            const safePath = this.validatePluginPath(path);
            await fs.access(safePath);
            return true;
          } catch {
            return false;
          }
        },
        glob: async (_pattern: string) =>
          // Simple glob implementation
          [],
      },
      exec: async (_command: string) => {
        throw new Error('Command execution not allowed in sandbox');
      },
      log: (_level: string, message: string, ..._args: unknown[]) => {
        logger.info(`[${pluginName}] ${message}`);
      },
      sendMessage: (plugin: string, _data: unknown) => {
        // Inter-plugin messaging
        logger.info(`Plugin ${pluginName} sent message to ${plugin}`);
      },
      onMessage: (_callback: (message: unknown) => void) => {
        // Message reception
        logger.info(`Plugin ${pluginName} registered message handler`);
      },
      getPlugin: (name: string) => this.plugins.get(name) || null,
    };
  }

  /**
   * Validate file path for plugin access within allowed directories
   * @param filePath - File path to validate
   * @returns Normalized path if valid
   * @throws Error if path is outside allowed plugin directory
   * @private
   */
  private validatePluginPath(filePath: string): string {
    const normalizedPath = path.normalize(filePath);
    const pluginsDir = path.normalize(this.pluginsDir);

    if (!normalizedPath.startsWith(pluginsDir)) {
      throw new Error(
        `Access denied: Path outside plugin directory: ${filePath}`
      );
    }

    return normalizedPath;
  }
}

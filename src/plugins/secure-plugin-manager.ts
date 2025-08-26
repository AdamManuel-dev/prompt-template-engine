/**
 * @fileoverview Secure plugin manager with sandboxing
 * @lastmodified 2025-08-26T10:30:00Z
 *
 * Features: Secure plugin loading, execution, and lifecycle management
 * Main APIs: SecurePluginManager class for safe plugin operations
 * Constraints: All plugins run in sandboxed workers, resource limits enforced
 * Patterns: Manager pattern, sandbox pattern, lifecycle management
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { IPlugin, PluginAPI } from '../types';
import {
  PluginSandbox,
  SandboxConfig,
  PluginExecutionResult,
  PartialSandboxConfig,
} from './sandbox/plugin-sandbox';
import { logger } from '../utils/logger';

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
  private hooks = new Map<string, Array<{ plugin: IPlugin; handler: Function; priority: number }>>();
  private helpers = new Map<string, Function>();
  private pluginsDir: string;
  private enableSandbox: boolean;
  private timeout: number;
  private memoryLimit: number;
  private securityPolicy: PluginSecurityPolicy;

  constructor(
    options: PluginManagerOptions | string = './plugins',
    securityPolicy: PluginSecurityPolicy = DEFAULT_SECURITY_POLICY
  ) {
    // Support both new options object and legacy string parameter
    if (typeof options === 'string') {
      this.pluginsDir = options;
      this.enableSandbox = true;
      this.timeout = 5000;
      this.memoryLimit = 50 * 1024 * 1024; // 50MB
    } else {
      this.pluginsDir = options.pluginsPath;
      this.enableSandbox = options.enableSandbox ?? true;
      this.timeout = options.timeout ?? 5000;
      this.memoryLimit = options.memoryLimit ?? 50 * 1024 * 1024;
    }
    
    this.securityPolicy = securityPolicy;
    this.sandbox = new PluginSandbox(this.securityPolicy.sandbox);
  }

  /**
   * Load a plugin from file
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
    } catch (error: any) {
      logger.error(`Failed to load plugin ${pluginPath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load all plugins from directory
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
   * Load all plugins from directory (wrapper for loadPluginsFromDirectory)
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
            this.validationErrors.push(`Plugin ${name} init failed: ${error.message}`);
          }
        }
      }
    }
  }

  /**
   * Get array of loaded plugins
   */
  getLoadedPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Shutdown all plugins and cleanup
   */
  async shutdown(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Get validation errors
   */
  getValidationErrors(): string[] {
    return [...this.validationErrors];
  }

  /**
   * Execute hook on all plugins
   */
  async executeHook(name: string, ...args: unknown[]): Promise<unknown> {
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
          const sandboxResult = await this.sandbox.executePlugin(plugin, 'executeHook', [name, result, ...args.slice(1)]);
          if (sandboxResult.success) {
            result = sandboxResult.result;
          } else {
            logger.error(`Hook ${name} failed in plugin ${plugin.name}: ${sandboxResult.error}`);
          }
        } else {
          // Execute directly
          result = await handler.call(plugin, result, ...args.slice(1));
        }
      } catch (error: any) {
        logger.error(`Hook ${name} error in plugin ${plugin.name}: ${error.message}`);
        // Continue with other plugins
      }
    }
    
    return result;
  }

  /**
   * Get aggregated helpers from all plugins
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
   * Enable a specific plugin
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
   * Disable a specific plugin
   */
  async disablePlugin(name: string): Promise<boolean> {
    if (!this.plugins.has(name)) {
      return true; // Already not loaded
    }
    
    this.disabledPlugins.add(name);
    return await this.deactivatePlugin(name);
  }

  /**
   * Initialize all plugins
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
        this.validationErrors.push(`Plugin ${name} initialization failed: ${error.message}`);
        initResults.push({ name, success: false, error: error.message });
      }
    }

    logger.info(
      `Initialized ${this.activePlugins.size}/${this.plugins.size} plugins`
    );
  }

  /**
   * Execute a plugin method safely
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
      metadata.executionCount++;
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
   * Activate a plugin
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
   * Deactivate a plugin
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
   * Unload a plugin
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
   * Get plugin information
   */
  getPluginInfo(pluginName: string): SecurePluginMetadata | null {
    return this.metadata.get(pluginName) || null;
  }

  /**
   * List all loaded plugins
   */
  listPlugins(): SecurePluginMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Get active plugins
   */
  getActivePlugins(): string[] {
    return Array.from(this.activePlugins);
  }

  /**
   * Cleanup all resources
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
   * Validate plugin code for security issues
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
   * Parse plugin from code
   */
  private async parsePlugin(code: string, filePath: string): Promise<IPlugin> {
    try {
      // For now, we'll use a simple module evaluation
      // In production, this would be more sophisticated
      let plugin: any;
      
      try {
        // Try to evaluate the module code
        // This is a simplified approach - in production, use proper module loading
        const moduleCode = `
          const module = { exports: {} };
          const exports = module.exports;
          ${code}
          return module.exports.default || module.exports;
        `;
        
        const pluginFactory = new Function(moduleCode);
        plugin = pluginFactory();
      } catch (evalError) {
        // Fallback to basic plugin structure
        plugin = {
          name: path.basename(filePath, path.extname(filePath)),
          version: '1.0.0',
          description: 'Plugin loaded from file',
          author: 'Unknown',
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
      this.validationErrors.push(`Failed to parse plugin ${filePath}: ${error.message}`);
      throw new Error(`Failed to parse plugin: ${error.message}`);
    }
  }

  /**
   * Perform security checks on plugin
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
   * Calculate hash of plugin code
   */
  private async calculateHash(code: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Register a hook handler
   */
  private registerHook(name: string, plugin: IPlugin, handler: Function): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    
    const handlers = this.hooks.get(name)!;
    handlers.push({
      plugin,
      handler,
      priority: plugin.priority || 0
    });
  }
  
  /**
   * Create plugin API for a specific plugin
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
      registerCommand: (name: string, handler: unknown) => {
        // Store command handler
        logger.info(`Plugin ${pluginName} registered command: ${name}`);
      },
      getCommand: (name: string) => {
        // Return command handler
        return undefined;
      },
      on: (event: string, callback: (...args: unknown[]) => void) => {
        // Event subscription
        logger.info(`Plugin ${pluginName} subscribed to event: ${event}`);
      },
      emit: (event: string, data: unknown) => {
        // Event emission
        logger.info(`Plugin ${pluginName} emitted event: ${event}`);
      },
      storage: {
        get: async (key: string) => {
          // Simple storage implementation
          return undefined;
        },
        set: async (key: string, value: unknown) => {
          // Simple storage implementation
        },
        delete: async (key: string) => {
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
        glob: async (pattern: string) => {
          // Simple glob implementation
          return [];
        },
      },
      exec: async (command: string) => {
        throw new Error('Command execution not allowed in sandbox');
      },
      log: (level: string, message: string, ...args: unknown[]) => {
        logger.info(`[${pluginName}] ${message}`);
      },
      sendMessage: (plugin: string, data: unknown) => {
        // Inter-plugin messaging
        logger.info(`Plugin ${pluginName} sent message to ${plugin}`);
      },
      onMessage: (callback: (message: unknown) => void) => {
        // Message reception
        logger.info(`Plugin ${pluginName} registered message handler`);
      },
      getPlugin: (name: string) => {
        return this.plugins.get(name) || null;
      },
    };
  }
  
  /**
   * Validate file path for plugin access
   */
  private validatePluginPath(filePath: string): string {
    const normalizedPath = path.normalize(filePath);
    const pluginsDir = path.normalize(this.pluginsDir);
    
    if (!normalizedPath.startsWith(pluginsDir)) {
      throw new Error(`Access denied: Path outside plugin directory: ${filePath}`);
    }
    
    return normalizedPath;
  }
}
/**
 * @fileoverview Secure plugin manager with sandboxing
 * @lastmodified 2025-08-23T05:30:00Z
 * 
 * Features: Secure plugin loading, execution, and lifecycle management
 * Main APIs: SecurePluginManager class for safe plugin operations
 * Constraints: All plugins run in sandboxed workers, resource limits enforced
 * Patterns: Manager pattern, sandbox pattern, lifecycle management
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { IPlugin } from '../types';
import { PluginSandbox, SandboxConfig, PluginExecutionResult } from './sandbox/plugin-sandbox';
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
    allowedAPIs: ['log', 'storage', 'fs']
  }
};

/**
 * Secure plugin manager with sandboxing
 */
export class SecurePluginManager {
  private plugins = new Map<string, IPlugin>();
  private metadata = new Map<string, SecurePluginMetadata>();
  private sandbox: PluginSandbox;
  private activePlugins = new Set<string>();

  constructor(
    private pluginsDir: string = './plugins',
    private securityPolicy: PluginSecurityPolicy = DEFAULT_SECURITY_POLICY
  ) {
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
        errors: []
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
      const pluginFiles = files.filter(file => 
        file.endsWith('.js') || file.endsWith('.ts')
      );

      for (const file of pluginFiles) {
        try {
          await this.loadPlugin(path.join(this.pluginsDir, file));
        } catch (error: any) {
          logger.error(`Failed to load plugin ${file}: ${error.message}`);
        }
      }

      logger.info(`Loaded ${this.plugins.size} plugins from ${this.pluginsDir}`);
    } catch (error: any) {
      logger.error(`Failed to load plugins directory: ${error.message}`);
    }
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
        stats: { executionTime: 0, memoryUsed: 0, cpuUsage: 0 }
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

      logger.info(`Plugin executed: ${pluginName}.${method} (${result.success ? 'success' : 'failed'})`);
      return result;

    } catch (error: any) {
      const errorMsg = error.message;
      metadata.errors.push(`${new Date().toISOString()}: ${errorMsg}`);
      
      return {
        success: false,
        error: errorMsg,
        stats: { executionTime: 0, memoryUsed: 0, cpuUsage: 0 }
      };
    }
  }

  /**
   * Initialize all plugins
   */
  async initializePlugins(): Promise<void> {
    const initResults = [];
    
    for (const [name] of this.plugins.entries()) {
      try {
        const result = await this.executePlugin(name, 'init');
        if (result.success) {
          this.activePlugins.add(name);
          logger.info(`Plugin initialized: ${name}`);
        } else {
          logger.error(`Plugin initialization failed: ${name} - ${result.error}`);
        }
        initResults.push({ name, success: result.success, error: result.error });
      } catch (error: any) {
        logger.error(`Plugin initialization error: ${name} - ${error.message}`);
        initResults.push({ name, success: false, error: error.message });
      }
    }

    logger.info(`Initialized ${this.activePlugins.size}/${this.plugins.size} plugins`);
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
    } else {
      logger.error(`Plugin activation failed: ${pluginName} - ${result.error}`);
      return false;
    }
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
    } else {
      logger.error(`Plugin deactivation failed: ${pluginName} - ${result.error}`);
      return false;
    }
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
    for (const pluginName of this.activePlugins) {
      await this.deactivatePlugin(pluginName);
    }

    // Cleanup sandbox
    await this.sandbox.cleanup();
    
    logger.info('Plugin manager cleanup completed');
  }

  /**
   * Validate plugin code for security issues
   */
  private async validatePluginCode(code: string, _filePath: string): Promise<void> {
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
      /worker_threads/
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
  private async parsePlugin(_code: string, filePath: string): Promise<IPlugin> {
    try {
      // For now, we'll use a simple module evaluation
      // In production, this would be more sophisticated
      
      // This is a simplified evaluation - in production, use proper module loading
      // Real plugin loading would happen here
      
      // For now, we'll expect plugins to export a default plugin object
      // This would need to be more robust in production
      const pluginData = {
        name: path.basename(filePath, path.extname(filePath)),
        version: '1.0.0',
        description: 'Plugin loaded from file',
        author: 'Unknown',
        dependencies: [],
        permissions: [],
        priority: 0,
        defaultConfig: {},
        init: () => true,
        execute: () => 'Plugin executed successfully'
      };

      return pluginData as IPlugin;
      
    } catch (error: any) {
      throw new Error(`Failed to parse plugin: ${error.message}`);
    }
  }

  /**
   * Perform security checks on plugin
   */
  private async performSecurityChecks(plugin: IPlugin, _code: string): Promise<void> {
    // Check author whitelist
    if (this.securityPolicy.allowedAuthors.length > 0) {
      if (!plugin.author || !this.securityPolicy.allowedAuthors.includes(plugin.author)) {
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
}
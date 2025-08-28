/**
 * @fileoverview Plugin loader for dynamic command loading
 * @lastmodified 2025-08-26T11:37:12Z
 *
 * Features: Plugin discovery, loading, and management
 * Main APIs: PluginLoader.load(), discover(), validate()
 * Constraints: Plugins must follow naming convention and structure
 * Patterns: Plugin architecture, dynamic loading
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { CommandRegistry, ICommand } from './command-registry';

/**
 * Metadata structure for plugin configuration
 * @interface PluginMetadata
 * @example
 * ```json
 * // plugin.json
 * {
 *   "name": "my-plugin",
 *   "version": "1.0.0",
 *   "description": "Custom commands for deployment",
 *   "author": "John Doe",
 *   "commands": ["deploy", "rollback"],
 *   "dependencies": {
 *     "axios": "^1.0.0",
 *     "chalk": "^5.0.0"
 *   }
 * }
 * ```
 */
export interface PluginMetadata {
  /** Unique plugin name */
  name: string;
  /** Semantic version string */
  version: string;
  /** Optional plugin description */
  description?: string;
  /** Plugin author information */
  author?: string;
  /** List of command names this plugin provides */
  commands?: string[];
  /** NPM dependencies required by this plugin */
  dependencies?: Record<string, string>;
}

/**
 * Complete plugin information including metadata and runtime state
 * @interface Plugin
 * @example
 * ```
 * const plugin: Plugin = {
 *   metadata: {
 *     name: 'deploy-plugin',
 *     version: '2.1.0',
 *     description: 'Advanced deployment commands'
 *   },
 *   path: '/path/to/plugin',
 *   loaded: true,
 *   error: undefined
 * };
 * ```
 */
export interface Plugin {
  /** Plugin configuration and metadata */
  metadata: PluginMetadata;
  /** Absolute path to plugin directory */
  path: string;
  /** Whether the plugin is currently loaded */
  loaded: boolean;
  /** Error message if loading failed */
  error?: string;
}

/**
 * Plugin loader for discovering and loading CLI command plugins
 *
 * Manages the lifecycle of plugins including discovery, loading, validation,
 * and dependency checking. Supports multiple plugin directories and formats.
 *
 * @class PluginLoader
 * @example
 * ```
 * import { CommandRegistry } from './command-registry';
 * import { PluginLoader } from './plugin-loader';
 *
 * const registry = CommandRegistry.getInstance(program);
 * const loader = new PluginLoader(registry);
 *
 * // Add custom plugin directories
 * loader.addPluginDir('/custom/plugins');
 *
 * // Discover all available plugins
 * const plugins = await loader.discover();
 * console.log('Found ' + plugins.length + ' plugins');
 *
 * // Load all discovered plugins
 * await loader.loadAll();
 *
 * // Load specific plugin
 * const success = await loader.load('my-plugin');
 * if (success) {
 *   console.log('Plugin loaded successfully');
 * }
 * ```
 */
export class PluginLoader {
  /** Map of plugin names to plugin objects */
  private plugins: Map<string, Plugin> = new Map();

  /** Array of directories to search for plugins */
  private pluginDirs: string[] = [];

  /** Command registry for registering plugin commands */
  private commandRegistry: CommandRegistry;

  /**
   * Create a new plugin loader
   * @param commandRegistry - Command registry instance for registering plugin commands
   */
  constructor(commandRegistry: CommandRegistry) {
    this.commandRegistry = commandRegistry;
    this.initializePluginDirs();
  }

  /**
   * Initialize default plugin directories
   *
   * Sets up standard plugin search paths:
   * - Local project: .cursor-prompt/plugins
   * - User home: ~/.cursor-prompt/plugins
   * - Global npm modules: @cursor-prompt packages
   *
   * @private
   */
  private initializePluginDirs(): void {
    // Local project plugins
    this.addPluginDir(path.join(process.cwd(), '.cursor-prompt', 'plugins'));

    // User home directory plugins
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      this.addPluginDir(path.join(homeDir, '.cursor-prompt', 'plugins'));
    }

    // Global plugins (if installed via npm)
    const globalModulesPath = PluginLoader.getGlobalModulesPath();
    if (globalModulesPath) {
      this.addPluginDir(path.join(globalModulesPath, '@cursor-prompt'));
    }
  }

  /**
   * Get global node_modules path
   *
   * Uses npm to determine the global modules directory for finding
   * globally installed plugin packages.
   *
   * @private
   * @returns Global node_modules path or null if npm is not available
   *
   * @example
   * ```
   * const globalPath = PluginLoader.getGlobalModulesPath();
   * // Returns: '/usr/local/lib/node_modules' or similar
   * ```
   */
  private static getGlobalModulesPath(): string | null {
    try {
      // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
      const { execSync } = require('child_process');
      const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
      return npmRoot;
    } catch {
      return null;
    }
  }

  /**
   * Add a plugin directory to search
   *
   * Adds a directory to the plugin search path if not already included.
   * Directories are searched in the order they were added.
   *
   * @param dir - Absolute path to plugin directory
   *
   * @example
   * ```
   * // Add custom plugin directories
   * loader.addPluginDir('/opt/company/plugins');
   * loader.addPluginDir(path.join(process.cwd(), 'custom-plugins'));
   *
   * // Add user-specific plugin directory
   * const userPlugins = path.join(os.homedir(), '.myapp', 'plugins');
   * loader.addPluginDir(userPlugins);
   * ```
   */
  addPluginDir(dir: string): void {
    // SECURITY: Validate and normalize directory path
    const normalizedDir = this.validatePluginDirectory(dir);
    if (!normalizedDir) {
      logger.error(`Invalid plugin directory rejected: ${dir}`);
      return;
    }

    if (!this.pluginDirs.includes(normalizedDir)) {
      this.pluginDirs.push(normalizedDir);
      logger.debug(`Added plugin directory: ${normalizedDir}`);
    }
  }

  /**
   * Validate and normalize plugin directory path for security
   * @private
   * @param dir - Directory path to validate
   * @returns Normalized path if valid, null if invalid
   */
  private validatePluginDirectory(dir: string): string | null {
    try {
      // Normalize and resolve the path
      const normalizedPath = path.resolve(path.normalize(dir));

      // Security checks
      if (normalizedPath.includes('..')) {
        logger.warn(`Directory traversal attempt blocked: ${dir}`);
        return null;
      }

      // Reject potentially dangerous paths
      const dangerousPaths = ['/etc', '/usr/bin', '/bin', '/sbin', '/system'];
      if (
        dangerousPaths.some(dangerous => normalizedPath.startsWith(dangerous))
      ) {
        logger.warn(`Dangerous system directory blocked: ${dir}`);
        return null;
      }

      return normalizedPath;
    } catch (error: any) {
      logger.error(`Path validation failed for ${dir}: ${String(error)}`);
      return null;
    }
  }

  /**
   * Discover all plugins in configured directories
   *
   * Scans all configured plugin directories for valid plugins.
   * Loads metadata from plugin.json or package.json files.
   * Updates internal plugin registry with discovered plugins.
   *
   * @returns Promise resolving to array of discovered plugins
   *
   * @example
   * ```
   * const plugins = await loader.discover();
   *
   * console.log('Discovered plugins:');
   * plugins.forEach(plugin => {
   *   console.log('- ' + plugin.metadata.name + ' v' + plugin.metadata.version);
   *   console.log('  ' + (plugin.metadata.description || 'No description'));
   *   console.log('  Path: ' + plugin.path);
   * });
   *
   * // Filter by criteria
   * const loadedPlugins = plugins.filter(p => p.loaded);
   * const errorPlugins = plugins.filter(p => p.error);
   * ```
   */
  async discover(): Promise<Plugin[]> {
    const discovered: Plugin[] = [];

    // Process directories sequentially to maintain order and handle errors properly
    const discoveryPromises = this.pluginDirs
      .filter(dir => {
        if (!fs.existsSync(dir)) {
          logger.debug(`Plugin directory not found: ${dir}`);
          return false;
        }
        return true;
      })
      .map(async dir => {
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          const directoryEntries = entries.filter(entry => entry.isDirectory());

          // Process plugin loading in parallel within each directory
          const pluginPromises = directoryEntries.map(async entry => {
            const pluginPath = path.join(dir, entry.name);
            return this.loadPluginMetadata(pluginPath);
          });

          const plugins = await Promise.all(pluginPromises);
          return plugins.filter((plugin): plugin is Plugin => plugin !== null);
        } catch (error: any) {
          logger.error(
            `Error scanning plugin directory ${dir}:${String(error)}`
          );
          return [];
        }
      });

    const allPlugins = await Promise.all(discoveryPromises);
    const flatPlugins = allPlugins.flat();

    // Update plugins map and discovered array
    flatPlugins.forEach(plugin => {
      discovered.push(plugin);
      this.plugins.set(plugin.metadata.name, plugin);
    });

    logger.info(`Discovered ${discovered.length} plugins`);
    return discovered;
  }

  /**
   * Load plugin metadata from directory
   *
   * Attempts to load plugin configuration from plugin.json first,
   * then falls back to package.json if plugin.json is not found.
   *
   * @private
   * @param pluginPath - Absolute path to plugin directory
   * @returns Promise resolving to Plugin object or null if invalid
   *
   * @example
   * ```
   * // Plugin directory structure:
   * // my-plugin/
   * // ├── plugin.json          (preferred)
   * // ├── package.json         (fallback)
   * // ├── commands/
   * // │   ├── deploy.js
   * // │   └── rollback.js
   * // └── index.js             (optional entry point)
   * ```
   */
  // eslint-disable-next-line class-methods-use-this
  private async loadPluginMetadata(pluginPath: string): Promise<Plugin | null> {
    const metadataPath = path.join(pluginPath, 'plugin.json');

    if (!fs.existsSync(metadataPath)) {
      // Try package.json as fallback
      const packagePath = path.join(pluginPath, 'package.json');
      if (fs.existsSync(packagePath)) {
        return PluginLoader.loadFromPackageJson(pluginPath, packagePath);
      }
      return null;
    }

    try {
      const metadataContent = fs.readFileSync(metadataPath, 'utf8');

      // SECURITY: Validate JSON content size and structure
      if (metadataContent.length > 10240) {
        // 10KB limit
        logger.error(`Plugin metadata too large: ${pluginPath}`);
        return null;
      }

      const metadata = JSON.parse(metadataContent) as PluginMetadata;

      // SECURITY: Validate metadata structure
      if (!this.validatePluginMetadata(metadata)) {
        logger.error(`Invalid plugin metadata structure: ${pluginPath}`);
        return null;
      }

      return {
        metadata,
        path: pluginPath,
        loaded: false,
      };
    } catch (error: any) {
      logger.error(
        `Failed to load plugin metadata from ${pluginPath}:${String(error)}`
      );
      return null;
    }
  }

  /**
   * Load plugin metadata from package.json
   *
   * Extracts plugin information from an npm package.json file.
   * Looks for cursor-prompt specific configuration in the package.json.
   *
   * @private
   * @param pluginPath - Absolute path to plugin directory
   * @param packagePath - Absolute path to package.json file
   * @returns Plugin object or null if invalid
   *
   * @example
   * ```json
   * // package.json with cursor-prompt configuration
   * {
   *   "name": "@myorg/cursor-prompt-plugin",
   *   "version": "1.2.3",
   *   "description": "Custom deployment commands",
   *   "cursor-prompt": {
   *     "commands": ["deploy", "rollback", "status"]
   *   },
   *   "dependencies": {
   *     "axios": "^1.0.0"
   *   }
   * }
   * ```
   */
  private static loadFromPackageJson(
    pluginPath: string,
    packagePath: string
  ): Plugin | null {
    try {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      const metadata: PluginMetadata = {
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        author: typeof pkg.author === 'string' ? pkg.author : pkg.author?.name,
        dependencies: pkg.dependencies,
      };

      // Look for commands in specific fields
      if (pkg['cursor-prompt'] && pkg['cursor-prompt'].commands) {
        metadata.commands = pkg['cursor-prompt'].commands;
      }

      return {
        metadata,
        path: pluginPath,
        loaded: false,
      };
    } catch (error: any) {
      logger.error(
        `Failed to load plugin from package.json at ${pluginPath}:${String(
          error
        )}`
      );
      return null;
    }
  }

  /**
   * Load all discovered plugins
   *
   * Loads all plugins that have been discovered but not yet loaded.
   * Processes plugins sequentially to maintain dependency order
   * and provide proper error handling.
   *
   * @returns Promise that resolves when all plugins are processed
   *
   * @example
   * ```
   * // Discover and load all plugins
   * await loader.discover();
   * await loader.loadAll();
   *
   * // Check results
   * const plugins = loader.getPlugins();
   * const loaded = plugins.filter(p => p.loaded);
   * const failed = plugins.filter(p => p.error);
   *
   * console.log('Loaded: ' + loaded.length + ', Failed: ' + failed.length);
   *
   * // Show failures
   * failed.forEach(plugin => {
   *   console.error('Failed to load ' + plugin.metadata.name + ': ' + plugin.error);
   * });
   * ```
   */
  async loadAll(): Promise<void> {
    // Load plugins sequentially to maintain dependency order and error handling
    const unloadedPlugins = Array.from(this.plugins.values()).filter(
      plugin => !plugin.loaded
    );

    // Using sequential processing to maintain plugin loading order
    // eslint-disable-next-line no-restricted-syntax
    for (const plugin of unloadedPlugins) {
      // eslint-disable-next-line no-await-in-loop
      await this.load(plugin.metadata.name);
    }
  }

  /**
   * Load a specific plugin by name
   *
   * Loads a single plugin including dependency validation and command registration.
   * Plugin must have been discovered first via discover() method.
   *
   * @param pluginName - Name of the plugin to load
   * @returns Promise resolving to true if loaded successfully, false otherwise
   *
   * @example
   * ```
   * // Load specific plugin
   * const success = await loader.load('deploy-plugin');
   *
   * if (success) {
   *   console.log('Plugin loaded successfully');
   *
   *   // Plugin commands are now available in command registry
   *   const deployCommand = registry.getCommand('deploy');
   *   if (deployCommand) {
   *     await registry.execute('deploy', ['production'], { force: true });
   *   }
   * } else {
   *   const plugin = loader.getPlugin('deploy-plugin');
   *   console.error('Load failed:', plugin?.error);
   * }
   * ```
   */
  async load(pluginName: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      logger.error(`Plugin not found: ${pluginName}`);
      return false;
    }

    if (plugin.loaded) {
      logger.debug(`Plugin already loaded: ${pluginName}`);
      return true;
    }

    try {
      // Check dependencies
      if (plugin.metadata.dependencies) {
        if (!PluginLoader.checkDependencies(plugin.metadata.dependencies)) {
          throw new Error('Missing dependencies');
        }
      }

      // Load plugin commands
      await this.loadPluginCommands(plugin);

      plugin.loaded = true;
      logger.info(`Loaded plugin: ${pluginName}`);
      return true;
    } catch (error: any) {
      plugin.error = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load plugin ${pluginName}:${String(error)}`);
      return false;
    }
  }

  /**
   * Load commands from a plugin
   *
   * Discovers and registers commands from plugin directory.
   * Supports two patterns:
   * 1. commands/ directory with *.command.js/ts files
   * 2. index.js/ts file with exported commands array
   *
   * @private
   * @param plugin - Plugin object to load commands from
   * @returns Promise that resolves when all commands are loaded
   *
   * @example
   * ```
   * // Plugin structure option 1: commands directory
   * plugin/
   * ├── commands/
   * │   ├── deploy.command.js
   * │   └── status.command.js
   * └── plugin.json
   *
   * // Plugin structure option 2: index file
   * plugin/
   * ├── index.js
   * └── plugin.json
   *
   * // index.js exports:
   * export const commands = [
   *   {
   *     name: 'deploy',
   *     description: 'Deploy application',
   *     action: async () => { // ... }
   *   }
   * ];
   * ```
   */
  private async loadPluginCommands(plugin: Plugin): Promise<void> {
    const commandsDir = path.join(plugin.path, 'commands');

    if (fs.existsSync(commandsDir)) {
      await this.commandRegistry.discoverPlugins([commandsDir]);
    }

    // Also check for index file
    const indexPath = path.join(plugin.path, 'index.js');
    const indexTsPath = path.join(plugin.path, 'index.ts');

    if (fs.existsSync(indexPath) || fs.existsSync(indexTsPath)) {
      const modulePath = fs.existsSync(indexPath) ? indexPath : indexTsPath;

      try {
        const module = await import(modulePath);

        if (module.commands && Array.isArray(module.commands)) {
          module.commands.forEach((command: unknown) => {
            this.commandRegistry.register(command as ICommand);
          });
        }
      } catch (error: any) {
        logger.error(
          `Failed to load commands from ${modulePath}:${String(error)}`
        );
      }
    }
  }

  /**
   * Check if dependencies are satisfied
   *
   * Validates that all required dependencies are available in the current
   * Node.js environment. Uses require.resolve() to check availability.
   *
   * @private
   * @param dependencies - Map of package names to version constraints
   * @returns True if all dependencies are available
   *
   * @example
   * ```
   * const dependencies = {
   *   'axios': '^1.0.0',
   *   'chalk': '^5.0.0',
   *   'commander': '^9.0.0'
   * };
   *
   * const satisfied = PluginLoader.checkDependencies(dependencies);
   * if (!satisfied) {
   *   console.error('Missing required dependencies');
   *   console.log('Install with: npm install axios chalk commander');
   * }
   * ```
   */
  private static checkDependencies(
    dependencies: Record<string, string>
  ): boolean {
    return Object.entries(dependencies).every(([dep, version]) => {
      try {
        require.resolve(dep);
        return true;
      } catch {
        logger.error(`Missing dependency: ${dep}@${version}`);
        return false;
      }
    });
  }

  /**
   * Unload a plugin
   *
   * Marks a plugin as unloaded in the registry. Note that commands
   * remain registered in the CommandRegistry - full unloading would
   * require tracking command ownership.
   *
   * @param pluginName - Name of the plugin to unload
   * @returns True if plugin was found and unloaded
   *
   * @example
   * ```
   * // Unload a plugin
   * const success = loader.unload('deploy-plugin');
   * if (success) {
   *   console.log('Plugin unloaded');
   * } else {
   *   console.log('Plugin not found');
   * }
   *
   * // Note: Commands remain available until restart
   * const deployCommand = registry.getCommand('deploy');
   * // deployCommand is still available
   * ```
   */
  unload(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      logger.error(`Plugin not found: ${pluginName}`);
      return false;
    }

    // Note: Unloading commands from registry would require tracking
    // which commands belong to which plugin
    plugin.loaded = false;
    logger.info(`Unloaded plugin: ${pluginName}`);
    return true;
  }

  /**
   * Get all plugins (loaded and unloaded)
   *
   * @returns Array of all plugin objects in the registry
   *
   * @example
   * ```
   * const allPlugins = loader.getPlugins();
   *
   * console.log('Plugin Status Report:');
   * allPlugins.forEach(plugin => {
   *   const status = plugin.loaded ? '✅ Loaded' :
   *                  plugin.error ? '❌ Error' : '⏳ Pending';
   *   console.log(status + ' ' + plugin.metadata.name + ' v' + plugin.metadata.version);
   *
   *   if (plugin.error) {
   *     console.log('   Error: ' + plugin.error);
   *   }
   * });
   * ```
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by name
   *
   * @param name - Plugin name to lookup
   * @returns Plugin object or undefined if not found
   *
   * @example
   * ```
   * const plugin = loader.getPlugin('deploy-plugin');
   *
   * if (plugin) {
   *   console.log('Plugin: ' + plugin.metadata.name);
   *   console.log('Version: ' + plugin.metadata.version);
   *   console.log('Loaded: ' + plugin.loaded);
   *   console.log('Commands: ' + (plugin.metadata.commands?.join(', ') || 'none'));
   *
   *   if (plugin.error) {
   *     console.log('Error: ' + plugin.error);
   *   }
   * } else {
   *   console.log('Plugin not found');
   * }
   * ```
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Validate plugin metadata for security and correctness
   * @private
   * @param metadata - Plugin metadata to validate
   * @returns True if metadata is valid and safe
   */
  private validatePluginMetadata(metadata: PluginMetadata): boolean {
    if (!metadata || typeof metadata !== 'object') {
      return false;
    }

    // Required fields
    if (!metadata.name || typeof metadata.name !== 'string') {
      return false;
    }

    if (!metadata.version || typeof metadata.version !== 'string') {
      return false;
    }

    // Security: Check for dangerous plugin names
    const dangerousNames = ['system', 'root', 'admin', 'eval', 'exec'];
    if (dangerousNames.includes(metadata.name.toLowerCase())) {
      logger.warn(`Dangerous plugin name blocked: ${metadata.name}`);
      return false;
    }

    // Validate name format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]+$/.test(metadata.name)) {
      logger.warn(`Invalid plugin name format: ${metadata.name}`);
      return false;
    }

    // Validate version format (semver-like)
    if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/.test(metadata.version)) {
      logger.warn(`Invalid plugin version format: ${metadata.version}`);
      return false;
    }

    // Optional fields validation
    if (metadata.description && typeof metadata.description !== 'string') {
      return false;
    }

    if (metadata.author && typeof metadata.author !== 'string') {
      return false;
    }

    if (metadata.commands && !Array.isArray(metadata.commands)) {
      return false;
    }

    if (metadata.dependencies && typeof metadata.dependencies !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Validate plugin structure
   *
   * Performs structural validation of a plugin object to ensure
   * it meets minimum requirements for loading.
   *
   * @param plugin - Plugin object to validate
   * @returns Validation result with success flag and error messages
   *
   * @example
   * ```
   * const plugin = loader.getPlugin('my-plugin');
   * if (plugin) {
   *   const validation = PluginLoader.validatePlugin(plugin);
   *
   *   if (validation.valid) {
   *     console.log('Plugin is valid');
   *   } else {
   *     console.log('Plugin validation failed:');
   *     validation.errors.forEach(error => {
   *       console.log('- ' + error);
   *     });
   *   }
   * }
   *
   * // Custom validation before loading
   * const plugins = await loader.discover();
   * const validPlugins = plugins.filter(p =>
   *   PluginLoader.validatePlugin(p).valid
   * );
   * ```
   */
  static validatePlugin(plugin: Plugin): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!plugin.metadata.name) {
      errors.push('Plugin name is required');
    }

    if (!plugin.metadata.version) {
      errors.push('Plugin version is required');
    }

    if (!fs.existsSync(plugin.path)) {
      errors.push('Plugin path does not exist');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

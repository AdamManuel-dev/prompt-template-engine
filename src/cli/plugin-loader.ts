/**
 * @fileoverview Plugin loader for dynamic command loading
 * @lastmodified 2025-08-22T20:00:00Z
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

export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  commands?: string[];
  dependencies?: Record<string, string>;
}

export interface Plugin {
  metadata: PluginMetadata;
  path: string;
  loaded: boolean;
  error?: string;
}

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();

  private pluginDirs: string[] = [];

  private commandRegistry: CommandRegistry;

  constructor(commandRegistry: CommandRegistry) {
    this.commandRegistry = commandRegistry;
    this.initializePluginDirs();
  }

  /**
   * Initialize default plugin directories
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
   */
  addPluginDir(dir: string): void {
    if (!this.pluginDirs.includes(dir)) {
      this.pluginDirs.push(dir);
      logger.debug(`Added plugin directory: ${dir}`);
    }
  }

  /**
   * Discover all plugins in configured directories
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
        } catch (error) {
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
      const metadata = JSON.parse(
        fs.readFileSync(metadataPath, 'utf8')
      ) as PluginMetadata;

      return {
        metadata,
        path: pluginPath,
        loaded: false,
      };
    } catch (error) {
      logger.error(
        `Failed to load plugin metadata from ${pluginPath}:${String(error)}`
      );
      return null;
    }
  }

  /**
   * Load plugin metadata from package.json
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
    } catch (error) {
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
   * Load a specific plugin
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
    } catch (error) {
      plugin.error = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load plugin ${pluginName}:${String(error)}`);
      return false;
    }
  }

  /**
   * Load commands from a plugin
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
      } catch (error) {
        logger.error(
          `Failed to load commands from ${modulePath}:${String(error)}`
        );
      }
    }
  }

  /**
   * Check if dependencies are satisfied
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
   * Get all loaded plugins
   */
  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Validate plugin structure
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

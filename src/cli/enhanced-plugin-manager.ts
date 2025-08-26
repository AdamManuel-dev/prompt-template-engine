/**
 * @fileoverview Enhanced plugin manager with multiple extensibility points
 * @lastmodified 2025-08-23T02:30:00Z
 *
 * Features: Plugin lifecycle, processor registration, validator plugins, hooks
 * Main APIs: ExtensionRegistry, PluginLifecycle, ExtensionPoints
 * Constraints: Plugin security, performance, compatibility
 * Patterns: Extension points, plugin architecture, lifecycle management
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { PluginLoader, Plugin } from './plugin-loader';
import { CommandRegistry, ICommand } from './command-registry';

// Extension points for plugins
export interface TemplateProcessor {
  name: string;
  description: string;
  process(content: string, context: Record<string, unknown>): Promise<string>;
  priority?: number; // Higher priority runs first
}

export interface TemplateValidator {
  name: string;
  description: string;
  validate(
    template: unknown
  ): Promise<{ valid: boolean; errors: string[]; warnings?: string[] }>;
}

export interface TemplateTransformer {
  name: string;
  description: string;
  transform(template: unknown): Promise<unknown>;
}

export interface MarketplaceHook {
  name: string;
  description: string;
  onBeforeInstall?(templateId: string, options: unknown): Promise<void>;
  onAfterInstall?(templateId: string, result: unknown): Promise<void>;
  onBeforePublish?(template: unknown): Promise<void>;
  onAfterPublish?(templateId: string, result: unknown): Promise<void>;
  onBeforeUpdate?(templateId: string, options: unknown): Promise<void>;
  onAfterUpdate?(templateId: string, result: unknown): Promise<void>;
}

export interface ContextProvider {
  name: string;
  description: string;
  priority?: number; // Higher priority runs first
  provideContext(): Promise<Record<string, unknown>>;
}

export interface FileGenerator {
  name: string;
  description: string;
  supportedExtensions: string[];
  generateFile(
    template: unknown,
    context: Record<string, unknown>,
    outputPath: string
  ): Promise<void>;
}

export interface PluginLifecycleHooks {
  onLoad?(): Promise<void>;
  onUnload?(): Promise<void>;
  onEnable?(): Promise<void>;
  onDisable?(): Promise<void>;
  onConfigUpdate?(config: Record<string, unknown>): Promise<void>;
}

export interface EnhancedPlugin extends Plugin {
  commands?: ICommand[];
  processors?: TemplateProcessor[];
  validators?: TemplateValidator[];
  transformers?: TemplateTransformer[];
  marketplaceHooks?: MarketplaceHook[];
  contextProviders?: ContextProvider[];
  fileGenerators?: FileGenerator[];
  lifecycle?: PluginLifecycleHooks;
}

export interface ExtensionPoint<T = unknown> {
  name: string;
  extensions: Map<string, T>;
  register(name: string, extension: T): void;
  unregister(name: string): boolean;
  get(name: string): T | undefined;
  getAll(): T[];
  getSorted(): T[]; // For extensions with priority
}

// Forward declaration for self-referencing type
export class EnhancedPluginManager extends EventEmitter {
  private static instance: EnhancedPluginManager | undefined;

  private pluginLoader: PluginLoader;

  private commandRegistry: CommandRegistry;

  private extensionPoints: Map<string, ExtensionPoint> = new Map();

  // Extension registries
  public readonly processors: ExtensionPoint<TemplateProcessor>;

  public readonly validators: ExtensionPoint<TemplateValidator>;

  public readonly transformers: ExtensionPoint<TemplateTransformer>;

  public readonly marketplaceHooks: ExtensionPoint<MarketplaceHook>;

  public readonly contextProviders: ExtensionPoint<ContextProvider>;

  public readonly fileGenerators: ExtensionPoint<FileGenerator>;

  private loadedPlugins: Map<string, EnhancedPlugin> = new Map();

  constructor(commandRegistry: CommandRegistry) {
    super();
    this.commandRegistry = commandRegistry;
    this.pluginLoader = new PluginLoader(commandRegistry);

    // Initialize extension points
    this.processors =
      this.createExtensionPoint<TemplateProcessor>('processors');
    this.validators =
      this.createExtensionPoint<TemplateValidator>('validators');
    this.transformers =
      this.createExtensionPoint<TemplateTransformer>('transformers');
    this.marketplaceHooks =
      this.createExtensionPoint<MarketplaceHook>('marketplaceHooks');
    this.contextProviders =
      this.createExtensionPoint<ContextProvider>('contextProviders');
    this.fileGenerators =
      this.createExtensionPoint<FileGenerator>('fileGenerators');
  }

  static getInstance(commandRegistry?: CommandRegistry): EnhancedPluginManager {
    if (!EnhancedPluginManager.instance) {
      if (!commandRegistry) {
        throw new Error('CommandRegistry required for first initialization');
      }
      EnhancedPluginManager.instance = new EnhancedPluginManager(
        commandRegistry
      );
    }
    return EnhancedPluginManager.instance;
  }

  private createExtensionPoint<T>(name: string): ExtensionPoint<T> {
    const extensionPoint: ExtensionPoint<T> = {
      name,
      extensions: new Map(),
      register(extensionName: string, extension: T): void {
        this.extensions.set(extensionName, extension);
        logger.debug(`Registered ${name} extension: ${extensionName}`);
      },
      unregister(extensionName: string): boolean {
        const removed = this.extensions.delete(extensionName);
        if (removed) {
          logger.debug(`Unregistered ${name} extension: ${extensionName}`);
        }
        return removed;
      },
      get(extensionName: string): T | undefined {
        return this.extensions.get(extensionName);
      },
      getAll(): T[] {
        return Array.from(this.extensions.values());
      },
      getSorted(): T[] {
        const extensions = this.getAll();
        // Sort by priority if the extension has a priority property
        return extensions.sort((a, b) => {
          const priorityA = (a as any).priority || 0;
          const priorityB = (b as any).priority || 0;
          return priorityB - priorityA; // Higher priority first
        });
      },
    };

    this.extensionPoints.set(name, extensionPoint as ExtensionPoint);
    return extensionPoint;
  }

  /**
   * Discover and load all plugins with enhanced features
   */
  async discoverAndLoad(): Promise<void> {
    logger.info('🔍 Discovering plugins...');

    // Discover base plugins
    const basePlugins = await this.pluginLoader.discover();

    // Load each plugin with enhanced features
    const loadPromises = basePlugins.map(async basePlugin => {
      try {
        const enhancedPlugin = await this.loadEnhancedPlugin(basePlugin);
        if (enhancedPlugin) {
          await this.registerPlugin(enhancedPlugin);
        }
      } catch (error) {
        logger.error(
          `Failed to load enhanced plugin ${basePlugin.metadata.name}: ${error}`
        );
      }
    });

    await Promise.all(loadPromises);

    logger.info(`🚀 Loaded ${this.loadedPlugins.size} enhanced plugins`);
    this.emit('plugins:loaded', { count: this.loadedPlugins.size });
  }

  /**
   * Load an enhanced plugin from a base plugin
   */
  private async loadEnhancedPlugin(
    basePlugin: Plugin
  ): Promise<EnhancedPlugin | null> {
    try {
      // Try to load the plugin module
      const modulePath = basePlugin.path;
      let pluginModule;

      try {
        pluginModule = await import(modulePath);
      } catch {
        // Try alternative paths
        const altPaths = [
          `${modulePath}/index.js`,
          `${modulePath}/index.ts`,
          `${modulePath}/plugin.js`,
          `${modulePath}/plugin.ts`,
        ];

        for (const altPath of altPaths) {
          try {
            pluginModule = await import(altPath);
            break;
          } catch {
            // Continue trying
          }
        }

        if (!pluginModule) {
          logger.warn(
            `Could not load plugin module for ${basePlugin.metadata.name}`
          );
          return null;
        }
      }

      // Create enhanced plugin
      const enhancedPlugin: EnhancedPlugin = {
        ...basePlugin,
        commands: pluginModule.commands || [],
        processors: pluginModule.processors || [],
        validators: pluginModule.validators || [],
        transformers: pluginModule.transformers || [],
        marketplaceHooks: pluginModule.marketplaceHooks || [],
        contextProviders: pluginModule.contextProviders || [],
        fileGenerators: pluginModule.fileGenerators || [],
        lifecycle: pluginModule.lifecycle,
      };

      return enhancedPlugin;
    } catch (error) {
      logger.error(
        `Error loading enhanced plugin ${basePlugin.metadata.name}: ${error}`
      );
      return null;
    }
  }

  /**
   * Register an enhanced plugin with all its extensions
   */
  private async registerPlugin(plugin: EnhancedPlugin): Promise<void> {
    logger.info(`📦 Registering enhanced plugin: ${plugin.metadata.name}`);

    // Call lifecycle hook
    if (plugin.lifecycle?.onLoad) {
      try {
        await plugin.lifecycle.onLoad();
      } catch (error) {
        logger.error(
          `Plugin ${plugin.metadata.name} onLoad hook failed: ${error}`
        );
      }
    }

    // Register commands
    plugin.commands?.forEach(command => {
      this.commandRegistry.register(command);
    });

    // Register processors
    plugin.processors?.forEach(processor => {
      this.processors.register(processor.name, processor);
    });

    // Register validators
    plugin.validators?.forEach(validator => {
      this.validators.register(validator.name, validator);
    });

    // Register transformers
    plugin.transformers?.forEach(transformer => {
      this.transformers.register(transformer.name, transformer);
    });

    // Register marketplace hooks
    plugin.marketplaceHooks?.forEach(hook => {
      this.marketplaceHooks.register(hook.name, hook);
    });

    // Register context providers
    plugin.contextProviders?.forEach(provider => {
      this.contextProviders.register(provider.name, provider);
    });

    // Register file generators
    plugin.fileGenerators?.forEach(generator => {
      this.fileGenerators.register(generator.name, generator);
    });

    // Mark as loaded
    // eslint-disable-next-line no-param-reassign
    plugin.loaded = true;
    this.loadedPlugins.set(plugin.metadata.name, plugin);

    // Emit event
    this.emit('plugin:loaded', { plugin: plugin.metadata.name });

    logger.info(`✅ Successfully registered plugin: ${plugin.metadata.name}`);
  }

  /**
   * Unload a plugin and clean up its extensions
   */
  async unloadPlugin(pluginName: string): Promise<boolean> {
    const plugin = this.loadedPlugins.get(pluginName);
    if (!plugin) {
      logger.error(`Plugin not found: ${pluginName}`);
      return false;
    }

    try {
      // Call lifecycle hook
      if (plugin.lifecycle?.onUnload) {
        await plugin.lifecycle.onUnload();
      }

      // Unregister all extensions
      plugin.processors?.forEach(processor => {
        this.processors.unregister(processor.name);
      });

      plugin.validators?.forEach(validator => {
        this.validators.unregister(validator.name);
      });

      plugin.transformers?.forEach(transformer => {
        this.transformers.unregister(transformer.name);
      });

      plugin.marketplaceHooks?.forEach(hook => {
        this.marketplaceHooks.unregister(hook.name);
      });

      plugin.contextProviders?.forEach(provider => {
        this.contextProviders.unregister(provider.name);
      });

      plugin.fileGenerators?.forEach(generator => {
        this.fileGenerators.unregister(generator.name);
      });

      // Remove from loaded plugins
      this.loadedPlugins.delete(pluginName);
      plugin.loaded = false;

      // Emit event
      this.emit('plugin:unloaded', { plugin: pluginName });

      logger.info(`✅ Successfully unloaded plugin: ${pluginName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to unload plugin ${pluginName}: ${error}`);
      return false;
    }
  }

  /**
   * Execute marketplace hooks
   */
  async executeMarketplaceHooks(
    hookName: keyof MarketplaceHook,
    ...args: any[]
  ): Promise<void> {
    const hooks = this.marketplaceHooks.getAll();
    const relevantHooks = hooks.filter(
      hook => typeof hook[hookName] === 'function'
    );

    if (relevantHooks.length === 0) {
      return;
    }

    logger.debug(`Executing ${relevantHooks.length} ${hookName} hooks`);

    // Execute hooks in parallel
    const hookPromises = relevantHooks.map(async hook => {
      try {
        await (hook[hookName] as (...args: unknown[]) => Promise<void>)(
          ...args
        );
      } catch (error) {
        logger.error(`Hook ${hook.name}.${hookName} failed: ${error}`);
      }
    });

    await Promise.all(hookPromises);
  }

  /**
   * Process content through all registered processors
   */
  async processContent(
    content: string,
    context: Record<string, unknown>
  ): Promise<string> {
    let processedContent = content;
    const processors = this.processors.getSorted();

    for (const processor of processors) {
      try {
        processedContent = await processor.process(processedContent, context);
      } catch (error) {
        logger.error(`Processor ${processor.name} failed: ${error}`);
      }
    }

    return processedContent;
  }

  /**
   * Validate using all registered validators
   */
  async validateTemplate(
    template: unknown
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const validators = this.validators.getAll();
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (const validator of validators) {
      try {
        const result = await validator.validate(template);
        allErrors.push(...result.errors);
        if (result.warnings) {
          allWarnings.push(...result.warnings);
        }
      } catch (error) {
        allErrors.push(`Validator ${validator.name} failed: ${error}`);
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Get aggregated context from all context providers
   */
  async getAggregatedContext(): Promise<Record<string, unknown>> {
    const providers = this.contextProviders.getSorted();
    const context: Record<string, unknown> = {};

    for (const provider of providers) {
      try {
        const providerContext = await provider.provideContext();
        Object.assign(context, providerContext);
      } catch (error) {
        logger.error(`Context provider ${provider.name} failed: ${error}`);
      }
    }

    return context;
  }

  /**
   * Get plugin statistics
   */
  getPluginStats(): {
    totalPlugins: number;
    loadedPlugins: number;
    extensionCounts: Record<string, number>;
  } {
    return {
      totalPlugins: this.pluginLoader.getPlugins().length,
      loadedPlugins: this.loadedPlugins.size,
      extensionCounts: {
        processors: this.processors.extensions.size,
        validators: this.validators.extensions.size,
        transformers: this.transformers.extensions.size,
        marketplaceHooks: this.marketplaceHooks.extensions.size,
        contextProviders: this.contextProviders.extensions.size,
        fileGenerators: this.fileGenerators.extensions.size,
      },
    };
  }

  /**
   * Get loaded plugins
   */
  getLoadedPlugins(): EnhancedPlugin[] {
    return Array.from(this.loadedPlugins.values());
  }
}

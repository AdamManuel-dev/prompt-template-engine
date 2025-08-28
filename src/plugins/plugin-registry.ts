/**
 * @fileoverview Plugin registry for managing PromptWizard and other optimization plugins
 * @lastmodified 2025-08-26T10:30:00Z
 *
 * Features: Plugin discovery, registration, lifecycle management, dependency resolution
 * Main APIs: PluginRegistry class for centralized plugin management
 * Constraints: Integrates with secure plugin manager and marketplace
 * Patterns: Registry pattern, plugin architecture, lifecycle management
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { SecurePluginManager } from './secure-plugin-manager';

/**
 * Plugin types
 */
export enum PluginType {
  OPTIMIZATION = 'optimization',
  ANALYSIS = 'analysis',
  INTEGRATION = 'integration',
  UI = 'ui',
  UTILITY = 'utility',
  EXTENSION = 'extension',
}

/**
 * Plugin capabilities
 */
export enum PluginCapability {
  TEMPLATE_OPTIMIZATION = 'template-optimization',
  QUALITY_ANALYSIS = 'quality-analysis',
  PERFORMANCE_TRACKING = 'performance-tracking',
  MARKETPLACE_INTEGRATION = 'marketplace-integration',
  CLI_EXTENSION = 'cli-extension',
  UI_COMPONENTS = 'ui-components',
  API_INTEGRATION = 'api-integration',
  DATA_EXPORT = 'data-export',
  REAL_TIME_FEEDBACK = 'real-time-feedback',
  BATCH_PROCESSING = 'batch-processing',
}

/**
 * Plugin status
 */
export enum PluginStatus {
  REGISTERED = 'registered',
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  ERROR = 'error',
  UPDATING = 'updating',
  UNINSTALLING = 'uninstalling',
}

/**
 * Plugin dependency
 */
export interface PluginDependency {
  /** Dependency name */
  name: string;

  /** Version requirement */
  version: string;

  /** Whether dependency is optional */
  optional: boolean;

  /** Dependency type */
  type: 'plugin' | 'package' | 'service';
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  /** Installation source */
  source: 'marketplace' | 'local' | 'git' | 'npm';

  /** Installation method */
  installMethod: string;

  /** Last updated timestamp */
  lastUpdated?: Date;

  /** Usage statistics */
  usageStats?: {
    activationCount: number;
    lastActivated?: Date;
    errorCount: number;
    lastError?: Date;
  };

  /** User preferences */
  userPreferences?: Record<string, unknown>;

  /** Plugin tags */
  tags?: string[];

  /** Plugin rating */
  rating?: number;

  /** Update availability */
  updateAvailable?: boolean;

  /** Available version */
  availableVersion?: string;
}

/**
 * Plugin registration information
 */
export interface PluginRegistration {
  /** Plugin name */
  name: string;

  /** Plugin display name */
  displayName: string;

  /** Plugin version */
  version: string;

  /** Plugin description */
  description: string;

  /** Plugin author */
  author: string;

  /** Plugin type/category */
  type: PluginType;

  /** Plugin capabilities */
  capabilities: PluginCapability[];

  /** Plugin configuration schema */
  configSchema?: Record<string, unknown>;

  /** Plugin dependencies */
  dependencies: PluginDependency[];

  /** Plugin installation path */
  installPath: string;

  /** Plugin manifest path */
  manifestPath: string;

  /** Registration timestamp */
  registeredAt: Date;

  /** Plugin status */
  status: PluginStatus;

  /** Plugin metadata */
  metadata?: PluginMetadata;
}

/**
 * Plugin search criteria
 */
export interface PluginSearchCriteria {
  /** Plugin name pattern */
  name?: string;

  /** Plugin type */
  type?: PluginType;

  /** Required capabilities */
  capabilities?: PluginCapability[];

  /** Plugin status */
  status?: PluginStatus;

  /** Plugin tags */
  tags?: string[];

  /** Minimum rating */
  minRating?: number;

  /** Sort criteria */
  sortBy?: 'name' | 'rating' | 'updated' | 'usage';

  /** Sort order */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Plugin registry for centralized plugin management
 */
export class PluginRegistry {
  private registrations = new Map<string, PluginRegistration>();

  private pluginManager: SecurePluginManager;

  private registryPath: string;

  private watchForChanges: boolean;

  private changeWatcher?: NodeJS.FSWatcher; // File system watcher

  constructor(
    pluginManager: SecurePluginManager,
    registryPath: string = './plugins',
    options: { watchForChanges?: boolean } = {}
  ) {
    this.pluginManager = pluginManager;
    this.registryPath = registryPath;
    this.watchForChanges = options.watchForChanges ?? true;
  }

  /**
   * Initialize the plugin registry
   * @returns Promise resolving when registry is initialized
   */
  async initialize(): Promise<void> {
    try {
      // Ensure registry directory exists
      await fs.mkdir(this.registryPath, { recursive: true });

      // Load existing plugin registrations
      await this.loadRegistrations();

      // Discover and register plugins
      await this.discoverPlugins();

      // Start watching for changes if enabled
      if (this.watchForChanges) {
        await this.startWatching();
      }

      logger.info(
        `Plugin registry initialized with ${this.registrations.size} plugins`
      );
    } catch (error) {
      logger.error('Failed to initialize plugin registry:', error);
      throw error;
    }
  }

  /**
   * Register a plugin in the registry
   * @param pluginPath - Path to plugin directory
   * @returns Promise resolving to plugin registration
   */
  async registerPlugin(pluginPath: string): Promise<PluginRegistration> {
    try {
      // Validate plugin path
      const normalizedPath = path.resolve(pluginPath);
      const manifestPath = path.join(normalizedPath, 'plugin.json');

      // Check if manifest exists
      try {
        await fs.access(manifestPath);
      } catch {
        throw new Error(`Plugin manifest not found: ${manifestPath}`);
      }

      // Load and validate manifest
      const manifestContent = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      // Validate required fields
      this.validateManifest(manifest);

      // Create registration
      const registration: PluginRegistration = {
        name: manifest.name,
        displayName: manifest.displayName || manifest.name,
        version: manifest.version,
        description: manifest.description || '',
        author: manifest.author || 'Unknown',
        type: this.parsePluginType(manifest.type || manifest.category),
        capabilities: this.parseCapabilities(manifest.capabilities || []),
        configSchema: manifest.configuration,
        dependencies: this.parseDependencies(manifest.dependencies || {}),
        installPath: normalizedPath,
        manifestPath,
        registeredAt: new Date(),
        status: PluginStatus.REGISTERED,
        metadata: this.extractMetadata(manifest, normalizedPath),
      };

      // Check for conflicts
      await this.checkPluginConflicts(registration);

      // Validate dependencies
      await this.validateDependencies(registration);

      // Register with plugin manager
      await this.pluginManager.loadPlugin(
        path.join(normalizedPath, manifest.main || 'index.js')
      );

      // Store registration
      this.registrations.set(registration.name, registration);

      // Save registry state
      await this.saveRegistrations();

      logger.info(
        `Plugin registered: ${registration.name} v${registration.version}`
      );
      return registration;
    } catch (error) {
      logger.error(`Failed to register plugin ${pluginPath}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a plugin from the registry
   * @param pluginName - Name of plugin to unregister
   * @returns Promise resolving when plugin is unregistered
   */
  async unregisterPlugin(pluginName: string): Promise<void> {
    try {
      const registration = this.registrations.get(pluginName);
      if (!registration) {
        throw new Error(`Plugin not found: ${pluginName}`);
      }

      // Update status
      registration.status = PluginStatus.UNINSTALLING;

      // Unload from plugin manager
      await this.pluginManager.unloadPlugin(pluginName);

      // Remove registration
      this.registrations.delete(pluginName);

      // Save registry state
      await this.saveRegistrations();

      logger.info(`Plugin unregistered: ${pluginName}`);
    } catch (error) {
      logger.error(`Failed to unregister plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Enable a registered plugin
   * @param pluginName - Name of plugin to enable
   * @returns Promise resolving when plugin is enabled
   */
  async enablePlugin(pluginName: string): Promise<void> {
    try {
      const registration = this.registrations.get(pluginName);
      if (!registration) {
        throw new Error(`Plugin not found: ${pluginName}`);
      }

      if (registration.status === PluginStatus.ENABLED) {
        return; // Already enabled
      }

      // Enable in plugin manager
      const success = await this.pluginManager.enablePlugin(pluginName);
      if (!success) {
        throw new Error(`Failed to enable plugin: ${pluginName}`);
      }

      // Update status
      registration.status = PluginStatus.ENABLED;

      // Update usage stats
      if (registration.metadata?.usageStats) {
        registration.metadata.usageStats.activationCount += 1;
        registration.metadata.usageStats.lastActivated = new Date();
      }

      await this.saveRegistrations();

      logger.info(`Plugin enabled: ${pluginName}`);
    } catch (error) {
      const registration = this.registrations.get(pluginName);
      if (registration) {
        registration.status = PluginStatus.ERROR;
        if (registration.metadata?.usageStats) {
          registration.metadata.usageStats.errorCount += 1;
          registration.metadata.usageStats.lastError = new Date();
        }
      }

      logger.error(`Failed to enable plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Disable a registered plugin
   * @param pluginName - Name of plugin to disable
   * @returns Promise resolving when plugin is disabled
   */
  async disablePlugin(pluginName: string): Promise<void> {
    try {
      const registration = this.registrations.get(pluginName);
      if (!registration) {
        throw new Error(`Plugin not found: ${pluginName}`);
      }

      if (registration.status === PluginStatus.DISABLED) {
        return; // Already disabled
      }

      // Disable in plugin manager
      const success = await this.pluginManager.disablePlugin(pluginName);
      if (!success) {
        throw new Error(`Failed to disable plugin: ${pluginName}`);
      }

      // Update status
      registration.status = PluginStatus.DISABLED;

      await this.saveRegistrations();

      logger.info(`Plugin disabled: ${pluginName}`);
    } catch (error) {
      logger.error(`Failed to disable plugin ${pluginName}:`, error);
      throw error;
    }
  }

  /**
   * Get plugin registration by name
   * @param pluginName - Plugin name
   * @returns Plugin registration or undefined
   */
  getPlugin(pluginName: string): PluginRegistration | undefined {
    return this.registrations.get(pluginName);
  }

  /**
   * Get all registered plugins
   * @returns Array of plugin registrations
   */
  getAllPlugins(): PluginRegistration[] {
    return Array.from(this.registrations.values());
  }

  /**
   * Search for plugins by criteria
   * @param criteria - Search criteria
   * @returns Matching plugin registrations
   */
  searchPlugins(criteria: PluginSearchCriteria): PluginRegistration[] {
    let results = Array.from(this.registrations.values());

    // Filter by name
    if (criteria.name) {
      const namePattern = new RegExp(criteria.name, 'i');
      results = results.filter(
        p => namePattern.test(p.name) || namePattern.test(p.displayName)
      );
    }

    // Filter by type
    if (criteria.type) {
      results = results.filter(p => p.type === criteria.type);
    }

    // Filter by capabilities
    if (criteria.capabilities && criteria.capabilities.length > 0) {
      results = results.filter(p =>
        criteria.capabilities!.every(cap => p.capabilities.includes(cap))
      );
    }

    // Filter by status
    if (criteria.status) {
      results = results.filter(p => p.status === criteria.status);
    }

    // Filter by tags
    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(p =>
        p.metadata?.tags?.some(tag => criteria.tags!.includes(tag))
      );
    }

    // Filter by rating
    if (criteria.minRating) {
      results = results.filter(
        p => (p.metadata?.rating || 0) >= criteria.minRating!
      );
    }

    // Sort results
    const sortBy = criteria.sortBy || 'name';
    const sortOrder = criteria.sortOrder || 'asc';

    results.sort((a, b) => {
      let aValue: unknown;
      let bValue: unknown;

      switch (sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'rating':
          aValue = a.metadata?.rating || 0;
          bValue = b.metadata?.rating || 0;
          break;
        case 'updated':
          aValue = a.metadata?.lastUpdated || a.registeredAt;
          bValue = b.metadata?.lastUpdated || b.registeredAt;
          break;
        case 'usage':
          aValue = a.metadata?.usageStats?.activationCount || 0;
          bValue = b.metadata?.usageStats?.activationCount || 0;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }

      if (sortOrder === 'desc') {
        [aValue, bValue] = [bValue, aValue];
      }

      if (aValue < bValue) return -1;
      if (aValue > bValue) return 1;
      return 0;
    });

    return results;
  }

  /**
   * Get plugins by capability
   * @param capability - Required capability
   * @returns Plugins with the specified capability
   */
  getPluginsByCapability(capability: PluginCapability): PluginRegistration[] {
    return this.searchPlugins({ capabilities: [capability] });
  }

  /**
   * Get enabled optimization plugins
   * @returns Enabled optimization plugins
   */
  getOptimizationPlugins(): PluginRegistration[] {
    return this.searchPlugins({
      type: PluginType.OPTIMIZATION,
      status: PluginStatus.ENABLED,
    });
  }

  /**
   * Check if a plugin is registered
   * @param pluginName - Plugin name
   * @returns Whether plugin is registered
   */
  isPluginRegistered(pluginName: string): boolean {
    return this.registrations.has(pluginName);
  }

  /**
   * Check if a plugin is enabled
   * @param pluginName - Plugin name
   * @returns Whether plugin is enabled
   */
  isPluginEnabled(pluginName: string): boolean {
    const registration = this.registrations.get(pluginName);
    return registration?.status === PluginStatus.ENABLED;
  }

  /**
   * Update plugin metadata
   * @param pluginName - Plugin name
   * @param metadata - Metadata to update
   * @returns Promise resolving when metadata is updated
   */
  async updatePluginMetadata(
    pluginName: string,
    metadata: Partial<PluginMetadata>
  ): Promise<void> {
    const registration = this.registrations.get(pluginName);
    if (!registration) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    // Merge metadata
    registration.metadata = {
      source: 'local' as const, // Provide default required value
      installMethod: 'unknown',
      ...registration.metadata,
      ...metadata,
      lastUpdated: new Date(),
    };

    await this.saveRegistrations();
  }

  /**
   * Get plugin statistics
   * @returns Registry statistics
   */
  getStatistics(): {
    totalPlugins: number;
    enabledPlugins: number;
    disabledPlugins: number;
    errorPlugins: number;
    pluginsByType: Record<PluginType, number>;
    pluginsByCapability: Record<PluginCapability, number>;
  } {
    const plugins = this.getAllPlugins();

    const stats = {
      totalPlugins: plugins.length,
      enabledPlugins: plugins.filter(p => p.status === PluginStatus.ENABLED)
        .length,
      disabledPlugins: plugins.filter(p => p.status === PluginStatus.DISABLED)
        .length,
      errorPlugins: plugins.filter(p => p.status === PluginStatus.ERROR).length,
      pluginsByType: {} as Record<PluginType, number>,
      pluginsByCapability: {} as Record<PluginCapability, number>,
    };

    // Count by type
    for (const type of Object.values(PluginType)) {
      stats.pluginsByType[type] = plugins.filter(p => p.type === type).length;
    }

    // Count by capability
    for (const capability of Object.values(PluginCapability)) {
      stats.pluginsByCapability[capability] = plugins.filter(p =>
        p.capabilities.includes(capability)
      ).length;
    }

    return stats;
  }

  /**
   * Cleanup registry resources
   * @returns Promise resolving when cleanup is complete
   */
  async cleanup(): Promise<void> {
    if (this.changeWatcher) {
      this.changeWatcher.close();
      this.changeWatcher = undefined;
    }

    await this.saveRegistrations();
  }

  // Private methods

  /**
   * Load plugin registrations from storage
   * @private
   */
  private async loadRegistrations(): Promise<void> {
    try {
      const registryFile = path.join(this.registryPath, 'registry.json');
      const content = await fs.readFile(registryFile, 'utf8');
      const data = JSON.parse(content);

      // Restore registrations with proper types
      for (const [name, regData] of Object.entries(data.registrations || {})) {
        const registration = regData as PluginRegistration;
        registration.registeredAt = new Date(registration.registeredAt);
        if (registration.metadata?.lastUpdated) {
          registration.metadata.lastUpdated = new Date(
            registration.metadata.lastUpdated
          );
        }
        this.registrations.set(name, registration);
      }
    } catch (_error) {
      // Registry file doesn't exist or is invalid - start fresh
      logger.debug('No existing plugin registry found, starting fresh');
    }
  }

  /**
   * Save plugin registrations to storage
   * @private
   */
  private async saveRegistrations(): Promise<void> {
    try {
      const registryFile = path.join(this.registryPath, 'registry.json');
      const data = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        registrations: Object.fromEntries(this.registrations),
      };

      await fs.writeFile(registryFile, JSON.stringify(data, null, 2));
    } catch (error) {
      logger.error('Failed to save plugin registry:', error);
    }
  }

  /**
   * Discover plugins in the registry directory
   * @private
   */
  private async discoverPlugins(): Promise<void> {
    try {
      const entries = await fs.readdir(this.registryPath, {
        withFileTypes: true,
      });
      const pluginDirs = entries.filter(entry => entry.isDirectory());

      for (const dir of pluginDirs) {
        const pluginPath = path.join(this.registryPath, dir.name);
        const manifestPath = path.join(pluginPath, 'plugin.json');

        try {
          await fs.access(manifestPath);

          // Check if already registered
          const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
          if (!this.registrations.has(manifest.name)) {
            await this.registerPlugin(pluginPath);
          }
        } catch {
          // No manifest or invalid plugin - skip
          continue;
        }
      }
    } catch (error) {
      logger.error('Failed to discover plugins:', error);
    }
  }

  /**
   * Start watching for plugin changes
   * @private
   */
  private async startWatching(): Promise<void> {
    try {
      this.changeWatcher = fs.watch(this.registryPath, { recursive: true });

      this.changeWatcher.on(
        'change',
        async (_eventType: string, filename?: string) => {
          if (filename && filename.endsWith('plugin.json')) {
            // Plugin manifest changed - refresh registration
            const pluginDir = path.dirname(
              path.join(this.registryPath, filename)
            );
            await this.refreshPlugin(pluginDir);
          }
        }
      );
    } catch (error) {
      logger.warn('Failed to start plugin watching:', error);
    }
  }

  /**
   * Refresh a plugin registration
   * @param pluginPath - Plugin path
   * @private
   */
  private async refreshPlugin(pluginPath: string): Promise<void> {
    try {
      const manifestPath = path.join(pluginPath, 'plugin.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

      const existingReg = this.registrations.get(manifest.name);
      if (existingReg && existingReg.version !== manifest.version) {
        // Version changed - re-register
        await this.unregisterPlugin(manifest.name);
        await this.registerPlugin(pluginPath);
      }
    } catch (error) {
      logger.debug('Failed to refresh plugin registration:', error);
    }
  }

  /**
   * Validate plugin manifest
   * @param manifest - Plugin manifest
   * @private
   */
  private validateManifest(manifest: Record<string, unknown>): void {
    const required = ['name', 'version', 'description'];
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field in manifest: ${field}`);
      }
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error(`Invalid version format: ${manifest.version}`);
    }
  }

  /**
   * Parse plugin type from manifest
   * @param type - Type string from manifest
   * @returns Parsed plugin type
   * @private
   */
  private parsePluginType(type: string): PluginType {
    const typeMap: Record<string, PluginType> = {
      optimization: PluginType.OPTIMIZATION,
      'ai-optimization': PluginType.OPTIMIZATION,
      analysis: PluginType.ANALYSIS,
      integration: PluginType.INTEGRATION,
      ui: PluginType.UI,
      utility: PluginType.UTILITY,
      extension: PluginType.EXTENSION,
    };

    return typeMap[type.toLowerCase()] || PluginType.UTILITY;
  }

  /**
   * Parse plugin capabilities from manifest
   * @param capabilities - Capabilities array from manifest
   * @returns Parsed capabilities
   * @private
   */
  private parseCapabilities(capabilities: string[]): PluginCapability[] {
    const capabilityMap: Record<string, PluginCapability> = {
      'template-optimization': PluginCapability.TEMPLATE_OPTIMIZATION,
      'quality-analysis': PluginCapability.QUALITY_ANALYSIS,
      'performance-tracking': PluginCapability.PERFORMANCE_TRACKING,
      'marketplace-integration': PluginCapability.MARKETPLACE_INTEGRATION,
      'cli-extension': PluginCapability.CLI_EXTENSION,
      'ui-components': PluginCapability.UI_COMPONENTS,
      'api-integration': PluginCapability.API_INTEGRATION,
      'data-export': PluginCapability.DATA_EXPORT,
      'real-time-feedback': PluginCapability.REAL_TIME_FEEDBACK,
      'batch-processing': PluginCapability.BATCH_PROCESSING,
    };

    return capabilities
      .map(cap => capabilityMap[cap.toLowerCase()])
      .filter(Boolean);
  }

  /**
   * Parse plugin dependencies from manifest
   * @param dependencies - Dependencies object from manifest
   * @returns Parsed dependencies
   * @private
   */
  private parseDependencies(
    dependencies: Record<string, string>
  ): PluginDependency[] {
    return Object.entries(dependencies).map(([name, version]) => ({
      name,
      version,
      optional: false,
      type: 'package' as const,
    }));
  }

  /**
   * Extract plugin metadata from manifest and path
   * @param manifest - Plugin manifest
   * @param installPath - Installation path
   * @returns Plugin metadata
   * @private
   */
  private extractMetadata(
    manifest: Record<string, unknown>,
    _installPath: string
  ): PluginMetadata {
    return {
      source: 'local',
      installMethod: 'manual',
      usageStats: {
        activationCount: 0,
        errorCount: 0,
      },
      tags: manifest.keywords || [],
      rating: 0,
    };
  }

  /**
   * Check for plugin conflicts
   * @param registration - Plugin registration to check
   * @private
   */
  private async checkPluginConflicts(
    registration: PluginRegistration
  ): Promise<void> {
    // Check for name conflicts
    if (this.registrations.has(registration.name)) {
      const existing = this.registrations.get(registration.name)!;
      if (existing.version !== registration.version) {
        logger.warn(
          `Plugin version conflict: ${registration.name} ${existing.version} vs ${registration.version}`
        );
      }
    }

    // Check for capability conflicts (if needed)
    // This could be extended to prevent conflicting optimization plugins
  }

  /**
   * Validate plugin dependencies
   * @param registration - Plugin registration to validate
   * @private
   */
  private async validateDependencies(
    registration: PluginRegistration
  ): Promise<void> {
    for (const dep of registration.dependencies) {
      if (dep.type === 'plugin') {
        // Check if required plugin is registered
        const depPlugin = this.registrations.get(dep.name);
        if (!depPlugin && !dep.optional) {
          throw new Error(`Missing required plugin dependency: ${dep.name}`);
        }

        // Version compatibility check could be added here
      }
    }
  }
}

/**
 * Create and initialize a plugin registry
 * @param pluginManager - Secure plugin manager instance
 * @param registryPath - Path to plugin registry
 * @param options - Registry options
 * @returns Initialized plugin registry
 */
export async function createPluginRegistry(
  pluginManager: SecurePluginManager,
  registryPath?: string,
  options?: { watchForChanges?: boolean }
): Promise<PluginRegistry> {
  const registry = new PluginRegistry(pluginManager, registryPath, options);
  await registry.initialize();
  return registry;
}

/**
 * @fileoverview Core marketplace service for template management
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Template discovery, installation, version management, ratings
 * Main APIs: search(), install(), update(), rate(), getTemplateInfo()
 * Constraints: Network connectivity, API rate limits, storage permissions
 * Patterns: Service layer, async operations, caching, error handling
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import {
  TemplateModel,
  TemplateSearchQuery,
  TemplateSearchResult,
  TemplateInstallation,
  TemplateManifest,
  TemplateVersion,
  TemplateReview,
  MarketplacePreferences,
} from '../models/template.model';
import { MarketplaceAPI } from '../api/marketplace.api';
import { TemplateRegistry } from './template.registry';
// import { VersionManager } from './version.manager'; // Reserved for future use

export class MarketplaceService extends EventEmitter {
  private static instance: MarketplaceService;

  private api: MarketplaceAPI;

  private registry: TemplateRegistry;

  // private _versionManager: VersionManager; // Reserved for future use
  private cache: Map<string, { data: unknown; expires: number }> = new Map();

  private manifestPath: string;

  private manifest: TemplateManifest | null = null;

  private constructor() {
    super();
    this.api = new MarketplaceAPI();
    this.registry = new TemplateRegistry();
    // this._versionManager = new VersionManager(); // Reserved for future use
    this.manifestPath = path.join(
      process.cwd(),
      '.cursor-prompt',
      'marketplace.json'
    );
    this.initializeManifest();
  }

  static getInstance(): MarketplaceService {
    if (!MarketplaceService.instance) {
      MarketplaceService.instance = new MarketplaceService();
    }
    return MarketplaceService.instance;
  }

  /**
   * Get API instance for direct access
   */
  get apiClient(): MarketplaceAPI {
    return this.api;
  }

  /**
   * Initialize marketplace manifest
   */
  private async initializeManifest(): Promise<void> {
    try {
      const manifestData = await fs.readFile(this.manifestPath, 'utf8');
      this.manifest = JSON.parse(manifestData);
    } catch {
      // Create default manifest if not exists
      this.manifest = {
        templates: [],
        lastSync: new Date(),
        marketplaceUrl:
          process.env.MARKETPLACE_URL ||
          'https://marketplace.cursor-prompt.com',
        preferences: {
          autoUpdate: false,
          checkInterval: 24 * 60 * 60 * 1000, // 24 hours
          includePrerelease: false,
          trustedAuthors: [],
          blockedAuthors: [],
          preferredCategories: [],
          notifications: {
            newVersions: true,
            newFromAuthors: false,
            featuredTemplates: false,
            securityUpdates: true,
            weeklyDigest: false,
          },
        },
      };
      await this.saveManifest();
    }
  }

  /**
   * Save manifest to disk
   */
  private async saveManifest(): Promise<void> {
    if (!this.manifest) return;

    const manifestDir = path.dirname(this.manifestPath);
    await fs.mkdir(manifestDir, { recursive: true });
    await fs.writeFile(
      this.manifestPath,
      JSON.stringify(this.manifest, null, 2),
      'utf8'
    );
  }

  /**
   * Search templates in marketplace
   */
  async search(query: TemplateSearchQuery): Promise<TemplateSearchResult> {
    const cacheKey = `search:${JSON.stringify(query)}`;
    const cached = this.getFromCache<TemplateSearchResult>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const result = await this.api.searchTemplates(query);
      this.setCache(cacheKey, result, 5 * 60 * 1000); // 5 minutes cache

      this.emit('search:completed', { query, result });
      return result;
    } catch (error) {
      logger.error(`Marketplace search failed: ${error}`);
      this.emit('search:error', { query, error });
      throw error;
    }
  }

  /**
   * Get detailed template information
   */
  async getTemplate(templateId: string): Promise<TemplateModel> {
    const cacheKey = `template:${templateId}`;
    const cached = this.getFromCache<TemplateModel>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const template = await this.api.getTemplate(templateId);
      this.setCache(cacheKey, template, 10 * 60 * 1000); // 10 minutes cache

      this.emit('template:fetched', { templateId, template });
      return template;
    } catch (error) {
      logger.error(`Failed to fetch template ${templateId}: ${error}`);
      this.emit('template:error', { templateId, error });
      throw error;
    }
  }

  /**
   * Install template from marketplace
   */
  async install(
    templateId: string,
    version?: string
  ): Promise<TemplateInstallation> {
    try {
      this.emit('install:started', { templateId, version });

      // Get template information
      const template = await this.getTemplate(templateId);
      const targetVersion = version || template.currentVersion;
      const templateVersion = template.versions.find(
        v => v.version === targetVersion
      );

      if (!templateVersion) {
        throw new Error(
          `Version ${targetVersion} not found for template ${templateId}`
        );
      }

      // Check dependencies
      await this.checkDependencies(templateVersion);

      // Download and install template
      const installPath = await this.downloadTemplate(
        template,
        templateVersion
      );

      // Create installation record
      const installation: TemplateInstallation = {
        templateId,
        version: targetVersion,
        installPath,
        installed: new Date(),
        autoUpdate: this.manifest?.preferences.autoUpdate || false,
      };

      // Update manifest
      if (this.manifest) {
        const existingIndex = this.manifest.templates.findIndex(
          t => t.templateId === templateId
        );
        if (existingIndex >= 0) {
          this.manifest.templates[existingIndex] = installation;
        } else {
          this.manifest.templates.push(installation);
        }
        await this.saveManifest();
      }

      // Register with template registry
      await this.registry.registerTemplate(
        template,
        templateVersion,
        installPath
      );

      this.emit('install:completed', {
        templateId,
        version: targetVersion,
        installation,
      });
      logger.info(
        `Template ${templateId}@${targetVersion} installed successfully`
      );

      return installation;
    } catch (error) {
      logger.error(`Failed to install template ${templateId}: ${error}`);
      this.emit('install:error', { templateId, version, error });
      throw error;
    }
  }

  /**
   * Update installed template
   */
  async update(
    templateId: string,
    version?: string
  ): Promise<TemplateInstallation> {
    try {
      this.emit('update:started', { templateId, version });

      const installation = this.getInstallation(templateId);
      if (!installation) {
        throw new Error(`Template ${templateId} is not installed`);
      }

      // Get latest template information
      const template = await this.getTemplate(templateId);
      const targetVersion = version || template.currentVersion;

      if (installation.version === targetVersion) {
        logger.info(
          `Template ${templateId} is already at version ${targetVersion}`
        );
        return installation;
      }

      // Backup current installation if needed
      if (installation.customizations) {
        await this.backupTemplate(installation);
      }

      // Perform update (essentially reinstall)
      const updatedInstallation = await this.install(templateId, targetVersion);

      this.emit('update:completed', {
        templateId,
        fromVersion: installation.version,
        toVersion: targetVersion,
      });
      logger.info(
        `Template ${templateId} updated from ${installation.version} to ${targetVersion}`
      );

      return updatedInstallation;
    } catch (error) {
      logger.error(`Failed to update template ${templateId}: ${error}`);
      this.emit('update:error', { templateId, version, error });
      throw error;
    }
  }

  /**
   * Uninstall template
   */
  async uninstall(templateId: string): Promise<void> {
    try {
      this.emit('uninstall:started', { templateId });

      const installation = this.getInstallation(templateId);
      if (!installation) {
        throw new Error(`Template ${templateId} is not installed`);
      }

      // Remove from file system
      await fs.rm(installation.installPath, { recursive: true, force: true });

      // Remove from registry
      await this.registry.unregisterTemplate(templateId);

      // Update manifest
      if (this.manifest) {
        this.manifest.templates = this.manifest.templates.filter(
          t => t.templateId !== templateId
        );
        await this.saveManifest();
      }

      this.emit('uninstall:completed', { templateId });
      logger.info(`Template ${templateId} uninstalled successfully`);
    } catch (error) {
      logger.error(`Failed to uninstall template ${templateId}: ${error}`);
      this.emit('uninstall:error', { templateId, error });
      throw error;
    }
  }

  /**
   * Rate and review template
   */
  async rateTemplate(
    templateId: string,
    rating: number,
    review?: Partial<TemplateReview>
  ): Promise<void> {
    try {
      await this.api.rateTemplate(templateId, rating, review);

      // Invalidate template cache
      this.invalidateCache(`template:${templateId}`);

      this.emit('rating:submitted', { templateId, rating, review });
      logger.info(`Rating submitted for template ${templateId}: ${rating}/5`);
    } catch (error) {
      logger.error(`Failed to rate template ${templateId}: ${error}`);
      this.emit('rating:error', { templateId, rating, error });
      throw error;
    }
  }

  /**
   * Check for updates for all installed templates
   */
  async checkUpdates(): Promise<
    Array<{ templateId: string; currentVersion: string; latestVersion: string }>
  > {
    const updates: Array<{
      templateId: string;
      currentVersion: string;
      latestVersion: string;
    }> = [];

    if (!this.manifest) return updates;

    for (const installation of this.manifest.templates) {
      try {
        const template = await this.getTemplate(installation.templateId);

        if (template.currentVersion !== installation.version) {
          updates.push({
            templateId: installation.templateId,
            currentVersion: installation.version,
            latestVersion: template.currentVersion,
          });
        }
      } catch (error) {
        logger.warn(
          `Failed to check updates for template ${installation.templateId}: ${error}`
        );
      }
    }

    this.emit('updates:checked', { updates });
    return updates;
  }

  /**
   * Get list of installed templates
   */
  getInstalledTemplates(): TemplateInstallation[] {
    return this.manifest?.templates || [];
  }

  /**
   * Get specific installation
   */
  getInstallation(templateId: string): TemplateInstallation | undefined {
    return this.manifest?.templates.find(t => t.templateId === templateId);
  }

  /**
   * Update marketplace preferences
   */
  async updatePreferences(
    preferences: Partial<MarketplacePreferences>
  ): Promise<void> {
    if (!this.manifest) return;

    this.manifest.preferences = {
      ...this.manifest.preferences,
      ...preferences,
    };
    await this.saveManifest();

    this.emit('preferences:updated', {
      preferences: this.manifest.preferences,
    });
  }

  /**
   * One-click install with smart defaults
   */
  async quickInstall(
    templateQuery: string,
    options: {
      autoConfirm?: boolean;
      useLatest?: boolean;
      enableAutoUpdate?: boolean;
    } = {}
  ): Promise<{ template: TemplateModel; installation: TemplateInstallation }> {
    try {
      this.emit('quick-install:started', { templateQuery, options });

      // Auto-resolve template
      let template: TemplateModel;
      try {
        template = await this.getTemplate(templateQuery);
      } catch {
        // Search by name if direct lookup fails
        const searchResult = await this.search({
          query: templateQuery,
          limit: 1,
          sortBy: 'downloads',
          sortOrder: 'desc',
        });

        if (searchResult.templates.length === 0) {
          throw new Error(`Template "${templateQuery}" not found`);
        }

        template = searchResult.templates[0];
      }

      // Use smart version selection
      const targetVersion = options.useLatest
        ? template.currentVersion
        : this.selectOptimalVersion(template);

      // Check if already installed
      const existing = this.getInstallation(template.id);
      if (existing) {
        // Auto-update if newer version available
        if (targetVersion !== existing.version) {
          logger.info(
            `Auto-updating ${template.name} from ${existing.version} to ${targetVersion}`
          );
          const installation = await this.update(template.id, targetVersion);

          this.emit('quick-install:updated', { template, installation });
          return { template, installation };
        }
        logger.info(`Template ${template.name} is already up to date`);
        this.emit('quick-install:already-current', { template, existing });
        return { template, installation: existing };
      }

      // Perform quick installation
      const installation = await this.install(template.id, targetVersion);

      // Enable auto-update if requested
      if (options.enableAutoUpdate && this.manifest) {
        const installIndex = this.manifest.templates.findIndex(
          t => t.templateId === template.id
        );
        if (installIndex >= 0) {
          this.manifest.templates[installIndex].autoUpdate = true;
          await this.saveManifest();
        }
      }

      this.emit('quick-install:completed', { template, installation });
      return { template, installation };
    } catch (error) {
      this.emit('quick-install:error', { templateQuery, options, error });
      throw error;
    }
  }

  /**
   * Batch install multiple templates
   */
  async batchInstall(
    templateQueries: string[],
    options: {
      continueOnError?: boolean;
      maxConcurrency?: number;
    } = {}
  ): Promise<
    Array<{
      templateQuery: string;
      success: boolean;
      template?: TemplateModel;
      installation?: TemplateInstallation;
      error?: Error;
    }>
  > {
    const results = [];
    const { continueOnError = true, maxConcurrency = 3 } = options;

    this.emit('batch-install:started', { templateQueries, options });

    // Process in batches to avoid overwhelming the marketplace API
    for (let i = 0; i < templateQueries.length; i += maxConcurrency) {
      const batch = templateQueries.slice(i, i + maxConcurrency);

      const batchPromises = batch.map(async templateQuery => {
        try {
          const result = await this.quickInstall(templateQuery, {
            autoConfirm: true,
            useLatest: true,
          });
          return {
            templateQuery,
            success: true,
            template: result.template,
            installation: result.installation,
          };
        } catch (error) {
          const errorResult = {
            templateQuery,
            success: false,
            error: error as Error,
          };

          if (!continueOnError) {
            throw error;
          }

          logger.warn(`Failed to install ${templateQuery}: ${error}`);
          return errorResult;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    this.emit('batch-install:completed', { results });
    return results;
  }

  /**
   * Install template with dependencies
   */
  async installWithDependencies(
    templateId: string,
    version?: string,
    options: {
      skipOptional?: boolean;
      maxDepth?: number;
    } = {}
  ): Promise<{
    primary: TemplateInstallation;
    dependencies: TemplateInstallation[];
  }> {
    const { skipOptional = false, maxDepth = 10 } = options;
    const installedDeps: TemplateInstallation[] = [];

    // Get template information
    const template = await this.getTemplate(templateId);
    const targetVersion = version || template.currentVersion;
    const versionInfo = template.versions.find(
      v => v.version === targetVersion
    );

    if (!versionInfo) {
      throw new Error(
        `Version ${targetVersion} not found for template ${templateId}`
      );
    }

    // Install dependencies first
    const dependencyChain = this.resolveDependencyChain(
      versionInfo.dependencies,
      maxDepth
    );

    for (const dep of dependencyChain) {
      if (dep.optional && skipOptional) {
        continue;
      }

      try {
        const depInstallation = await this.install(dep.name, dep.version);
        installedDeps.push(depInstallation);
        logger.info(`Installed dependency: ${dep.name}@${dep.version}`);
      } catch (error) {
        if (!dep.optional) {
          throw new Error(
            `Failed to install required dependency ${dep.name}: ${error}`
          );
        }
        logger.warn(`Skipped optional dependency ${dep.name}: ${error}`);
      }
    }

    // Install primary template
    const primaryInstallation = await this.install(templateId, targetVersion);

    this.emit('install-with-deps:completed', {
      primary: primaryInstallation,
      dependencies: installedDeps,
    });

    return {
      primary: primaryInstallation,
      dependencies: installedDeps,
    };
  }

  /**
   * Check template dependencies
   */
  private async checkDependencies(
    templateVersion: TemplateVersion
  ): Promise<void> {
    for (const dependency of templateVersion.dependencies) {
      if (!dependency.optional) {
        const isInstalled =
          await this.registry.isDependencyInstalled(dependency);
        if (!isInstalled) {
          throw new Error(
            `Required dependency not found: ${dependency.name}@${dependency.version}`
          );
        }
      }
    }
  }

  /**
   * Download template content
   */
  private async downloadTemplate(
    template: TemplateModel,
    version: TemplateVersion
  ): Promise<string> {
    const templateDir = path.join(
      process.cwd(),
      '.cursor-prompt',
      'templates',
      template.name
    );
    await fs.mkdir(templateDir, { recursive: true });

    const templatePath = path.join(templateDir, `${template.name}.md`);
    await fs.writeFile(templatePath, version.content, 'utf8');

    // Save metadata
    const metadataPath = path.join(templateDir, 'template.json');
    const metadata = {
      template,
      version,
      installed: new Date(),
    };
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    return templateDir;
  }

  /**
   * Backup template before update
   */
  private async backupTemplate(
    installation: TemplateInstallation
  ): Promise<void> {
    const backupDir = path.join(
      installation.installPath,
      'backups',
      installation.version
    );
    await fs.mkdir(backupDir, { recursive: true });

    const templateFiles = await fs.readdir(installation.installPath);
    for (const file of templateFiles) {
      if (file !== 'backups') {
        const sourcePath = path.join(installation.installPath, file);
        const backupPath = path.join(backupDir, file);
        await fs.copyFile(sourcePath, backupPath);
      }
    }

    logger.info(`Backup created for template at ${backupDir}`);
  }

  /**
   * Cache management
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: unknown, ttl: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
    });
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Select optimal version for installation
   */
  private selectOptimalVersion(template: TemplateModel): string {
    // Prefer latest stable version over prerelease
    const stableVersions = template.versions.filter(
      v => !v.version.includes('-') && !v.deprecated
    );

    if (stableVersions.length > 0) {
      return stableVersions[0].version;
    }

    return template.currentVersion;
  }

  /**
   * Resolve dependency chain with circular dependency detection
   */
  private resolveDependencyChain(
    dependencies: any[],
    maxDepth: number = 10,
    visited: Set<string> = new Set()
  ): any[] {
    const resolved: any[] = [];

    for (const dep of dependencies) {
      if (visited.has(dep.name)) {
        throw new Error(`Circular dependency detected: ${dep.name}`);
      }

      if (dep.type === 'template') {
        visited.add(dep.name);

        // Add this dependency to the chain
        resolved.push(dep);

        // If we haven't reached max depth, resolve nested dependencies
        if (visited.size < maxDepth) {
          try {
            // In a real implementation, we would fetch the dependency's template info
            // For now, we'll just add the direct dependency
          } catch (error) {
            logger.warn(
              `Failed to resolve nested dependencies for ${dep.name}: ${error}`
            );
          }
        }

        visited.delete(dep.name);
      } else {
        // Non-template dependencies (plugins, etc.)
        resolved.push(dep);
      }
    }

    return resolved;
  }
}

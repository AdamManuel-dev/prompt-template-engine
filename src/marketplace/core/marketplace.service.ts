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

import { MarketplaceAPI } from '../api/marketplace.api';
import { IMarketplaceDatabase } from '../database/database.interface';
import { getDatabase } from '../database/database.factory';
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
import {
  InstallationResult,
  MarketplaceTemplate,
  TemplateDependency,
} from '../../types';
import { logger } from '../../utils/logger';
import { TemplateRegistry } from './template.registry';
// import { VersionManager } from './version.manager'; // Reserved for future use

// Interface declaration to resolve no-use-before-define
interface IMarketplaceService {
  search(query: TemplateSearchQuery): Promise<TemplateSearchResult>;
  getTemplate(templateId: string): Promise<TemplateModel>;
  install(templateId: string, version?: string): Promise<InstallationResult>;
  update(templateId: string): Promise<InstallationResult>;
  uninstall(templateId: string): Promise<void>;
  rate(
    templateId: string,
    rating: number,
    review?: Partial<TemplateReview>
  ): Promise<void>;
  publishTemplate(
    template: TemplateModel,
    options?: {
      version?: string;
      isDraft?: boolean;
      isPrivate?: boolean;
    }
  ): Promise<{
    templateId: string;
    version: string;
    url?: string;
  }>;
}

export class MarketplaceService
  extends EventEmitter
  implements IMarketplaceService
{
  private static instance: IMarketplaceService;

  private api: MarketplaceAPI;

  private registry: TemplateRegistry;

  private database: IMarketplaceDatabase | null = null;

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
    this.initializeDatabase();
  }

  static getInstance(): MarketplaceService {
    if (!MarketplaceService.instance) {
      MarketplaceService.instance = new MarketplaceService();
    }
    return MarketplaceService.instance as MarketplaceService;
  }

  /**
   * Get API instance for direct access
   */
  get apiClient(): MarketplaceAPI {
    return this.api;
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this.database = await getDatabase();
      logger.info('Marketplace database initialized');

      // Initialize manifest from database or create default
      await this.initializeManifest();
    } catch (error) {
      logger.error(`Failed to initialize marketplace database: ${error}`);
      // Fallback to file-based initialization
      await this.initializeManifest();
    }
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
      let result: TemplateSearchResult;

      // Use database for local search if available, otherwise API
      if (this.database) {
        const offset = ((query.page || 1) - 1) * (query.limit || 20);
        const templates = query.query
          ? await this.database.templates.search(query.query, {
              limit: query.limit,
              offset,
              sort: query.sortBy
                ? [
                    {
                      field: query.sortBy,
                      direction: query.sortOrder || 'desc',
                    },
                  ]
                : undefined,
            })
          : await this.database.templates.findMany({
              limit: query.limit,
              offset,
              sort: query.sortBy
                ? [
                    {
                      field: query.sortBy,
                      direction: query.sortOrder || 'desc',
                    },
                  ]
                : undefined,
            });

        result = {
          templates: templates as any[], // Convert TemplateModel to MarketplaceTemplate
          total: templates.length,
          page: query.page || 1,
          limit: query.limit || 20,
          hasMore: templates.length === (query.limit || 20),
        };
      } else {
        // Fallback to API
        result = await this.api.searchTemplates(query);
      }

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
      let template: TemplateModel;

      // Try database first, then API
      if (this.database) {
        const dbTemplate = await this.database.templates.findById(templateId);
        if (dbTemplate) {
          template = dbTemplate;
        } else {
          // Not in local database, fetch from API and cache locally
          template = await this.api.getTemplate(templateId);
          await this.database.templates.create(template);
        }
      } else {
        template = await this.api.getTemplate(templateId);
      }

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
  ): Promise<InstallationResult> {
    const startTime = Date.now();
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

      // Convert TemplateInstallation to InstallationResult
      const templateForResult = await this.getTemplate(templateId);
      const result: InstallationResult = {
        success: true,
        template: templateForResult as unknown as MarketplaceTemplate,
        version: installation.version,
        installPath: installation.installPath,
        duration: Date.now() - startTime,
        warnings: [],
      };
      return result;
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
  ): Promise<InstallationResult> {
    const startTime = Date.now();
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
        const templateForResult = await this.getTemplate(templateId);
        const result: InstallationResult = {
          success: true,
          template: templateForResult as unknown as MarketplaceTemplate,
          version: installation.version,
          installPath: installation.installPath,
          duration: Date.now() - startTime,
          warnings: [],
        };
        return result;
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

      // Convert TemplateInstallation to InstallationResult
      const templateForResult = await this.getTemplate(templateId);
      const result: InstallationResult = {
        success: true,
        template: templateForResult as unknown as MarketplaceTemplate,
        version: updatedInstallation.version,
        installPath: updatedInstallation.installPath,
        duration: Date.now() - startTime,
        warnings: [],
      };
      return result;
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
  async rate(
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

    // Check each installed template for updates sequentially to avoid rate limiting
    // eslint-disable-next-line no-restricted-syntax
    for (const installation of this.manifest.templates) {
      try {
        // eslint-disable-next-line no-await-in-loop
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

        [template] = searchResult.templates;
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
          const installationResult = await this.update(
            template.id,
            targetVersion
          );

          // Convert InstallationResult back to TemplateInstallation for consistency
          const installation: TemplateInstallation = {
            templateId: template.id,
            version: installationResult.version,
            installPath: installationResult.installPath,
            installed: new Date(),
            autoUpdate: existing.autoUpdate,
            customizations: existing.customizations,
          };

          this.emit('quick-install:updated', { template, installation });
          return { template, installation };
        }
        logger.info(`Template ${template.name} is already up to date`);
        this.emit('quick-install:already-current', { template, existing });
        return { template, installation: existing };
      }

      // Perform quick installation
      const installationResult = await this.install(template.id, targetVersion);

      // Convert InstallationResult to TemplateInstallation for consistency
      const installation: TemplateInstallation = {
        templateId: template.id,
        version: installationResult.version,
        installPath: installationResult.installPath,
        installed: new Date(),
        autoUpdate: options.enableAutoUpdate || false,
      };

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

      // eslint-disable-next-line no-await-in-loop
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

    // Install dependencies sequentially to maintain order and avoid conflicts
    const requiredDeps = dependencyChain.filter(
      dep => !(dep.optional && skipOptional)
    );

    // eslint-disable-next-line no-restricted-syntax
    for (const dep of requiredDeps) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const depInstallationResult = await this.install(dep.name, dep.version);

        // Convert InstallationResult to TemplateInstallation
        const depInstallation: TemplateInstallation = {
          templateId: dep.name,
          version: depInstallationResult.version,
          installPath: depInstallationResult.installPath,
          installed: new Date(),
          autoUpdate: false,
        };

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
    const primaryInstallationResult = await this.install(
      templateId,
      targetVersion
    );

    // Convert InstallationResult to TemplateInstallation
    const primaryInstallation: TemplateInstallation = {
      templateId,
      version: primaryInstallationResult.version,
      installPath: primaryInstallationResult.installPath,
      installed: new Date(),
      autoUpdate: false,
    };

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
    // Check required dependencies sequentially
    const requiredDeps = templateVersion.dependencies.filter(
      dep => !dep.optional
    );

    // eslint-disable-next-line no-restricted-syntax
    for (const dependency of requiredDeps) {
      // eslint-disable-next-line no-await-in-loop
      const isInstalled = await this.registry.isDependencyInstalled(dependency);
      if (!isInstalled) {
        throw new Error(
          `Required dependency not found: ${dependency.name}@${dependency.version}`
        );
      }
    }
  }

  /**
   * Download template content
   */
  // eslint-disable-next-line class-methods-use-this
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
  // eslint-disable-next-line class-methods-use-this
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
    const filesToBackup = templateFiles.filter(file => file !== 'backups');

    // Backup files sequentially to avoid filesystem conflicts
    // eslint-disable-next-line no-restricted-syntax
    for (const file of filesToBackup) {
      const sourcePath = path.join(installation.installPath, file);
      const backupPath = path.join(backupDir, file);
      // eslint-disable-next-line no-await-in-loop
      await fs.copyFile(sourcePath, backupPath);
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
  // eslint-disable-next-line class-methods-use-this
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
  // eslint-disable-next-line class-methods-use-this
  private resolveDependencyChain(
    dependencies: TemplateDependency[],
    maxDepth: number = 10,
    visited: Set<string> = new Set()
  ): TemplateDependency[] {
    const resolved: TemplateDependency[] = [];

    // Process dependencies with circular detection - complex stateful logic requires for-of
    // eslint-disable-next-line no-restricted-syntax
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

  /**
   * Publish a template to the marketplace
   */
  async publishTemplate(
    template: TemplateModel,
    options: {
      version?: string;
      isDraft?: boolean;
      isPrivate?: boolean;
    } = {}
  ): Promise<{
    templateId: string;
    version: string;
    url?: string;
  }> {
    try {
      logger.info(`Publishing template: ${template.name || template.id}`);

      // Prepare template data for publishing
      const publishData = {
        ...template,
        currentVersion: options.version || template.currentVersion || '1.0.0',
        isDraft: options.isDraft || false,
        isPrivate: options.isPrivate || false,
        updated: new Date(),
      };

      // Call marketplace API to publish
      const result = await this.api.publishTemplate(publishData);

      // Register in local registry if successful
      if (result.templateId) {
        const templateVersion = template.versions[0] || {
          version: result.version,
          description: template.description,
          content: template,
          dependencies: [],
          variables: [],
          hooks: [],
          publishedAt: new Date(),
          changelog: 'Initial release',
        };

        await this.registry.registerTemplate(
          template,
          templateVersion,
          '' // Will be set during installation
        );
      }

      // Emit publish event
      this.emit('template:published', {
        templateId: result.templateId,
        version: result.version,
        authorId: template.author.id,
      });

      logger.info(
        `✅ Template published successfully: ${result.templateId}@${result.version}`
      );

      return {
        templateId: result.templateId,
        version: result.version,
        url: result.url,
      };
    } catch (error) {
      logger.error(`Failed to publish template: ${error}`);

      // Emit publish error event
      this.emit('template:publish-error', {
        templateId: template.id,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}

// Additional export to satisfy import/prefer-default-export
export type MarketplaceServiceType = typeof MarketplaceService;

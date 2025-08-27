/**
 * @fileoverview Core marketplace service for template management
 * @lastmodified 2025-08-26T03:27:11Z
 *
 * Features: Template discovery, installation, version management, ratings, search filters, batch operations
 * Main APIs: search(), searchByTags(), install(), batchInstall(), update(), rate(), getReviews(), clearCache()
 * Constraints: Network connectivity, API rate limits, storage permissions
 * Patterns: Service layer, async operations, caching, error handling, backward compatibility
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
  UpdateCheckResult,
  UpdateResult,
  RatingResult,
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
  // New search methods
  searchByTags(tags: string[]): Promise<TemplateSearchResult>;
  searchByCategory(category: string): Promise<TemplateSearchResult>;
  getPopularTemplates(limit: number): Promise<TemplateSearchResult>;
  getTopRated(limit: number): Promise<TemplateSearchResult>;
  getByAuthor(author: string): Promise<TemplateSearchResult>;
  getTrending(hours: number): Promise<TemplateSearchResult>;
  // Installation methods
  installTemplate(
    id: string,
    targetPath: string,
    options?: {
      version?: string;
      skipDeps?: boolean;
      enableAutoUpdate?: boolean;
    }
  ): Promise<InstallationResult>;
  batchInstall(
    templateQueries: string[],
    options?: {
      continueOnError?: boolean;
      maxConcurrency?: number;
    }
  ): Promise<
    Array<{
      templateQuery: string;
      success: boolean;
      template?: TemplateModel;
      installation?: TemplateInstallation;
      error?: Error;
    }>
  >;
  batchInstall(
    ids: string[],
    targetPath: string,
    options?: {
      maxConcurrency?: number;
      continueOnError?: boolean;
    }
  ): Promise<
    Array<{
      id: string;
      success: boolean;
      result?: InstallationResult;
      error?: Error;
    }>
  >;
  // Update methods
  checkUpdates(): Promise<
    Array<{ templateId: string; currentVersion: string; latestVersion: string }>
  >;
  checkUpdates(installedPath: string): Promise<UpdateCheckResult>;
  updateTemplate(
    id: string,
    installedPath: string,
    version?: string
  ): Promise<InstallationResult>;
  updateAll(installedPath: string): Promise<UpdateResult>;
  rollbackTemplate(
    id: string,
    version: string,
    installedPath: string
  ): Promise<InstallationResult>;
  // Rating and review methods
  rateTemplate(
    id: string,
    rating: number,
    userId: string,
    options?: {
      comment?: string;
      title?: string;
    }
  ): Promise<RatingResult>;
  addReview(
    id: string,
    review: {
      userId: string;
      rating: number;
      title?: string;
      comment: string;
    }
  ): Promise<TemplateReview>;
  getReviews(id: string): Promise<TemplateReview[]>;
  // Analytics and cache methods
  recordDownload(id: string): Promise<void>;
  getCacheSize(): Promise<number>;
  clearCache(): Promise<void>;
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

  public constructor() {
    super();
    this.api = new MarketplaceAPI();
    this.registry = new TemplateRegistry();
    // this._versionManager = new VersionManager(); // Reserved for future use
    this.manifestPath = path.join(
      process.cwd(),
      '.cursor-prompt',
      'marketplace.json'
    );
    // Database will be initialized via async init method
  }

  static async getInstance(): Promise<MarketplaceService> {
    if (!MarketplaceService.instance) {
      MarketplaceService.instance = new MarketplaceService();
      await (MarketplaceService.instance as MarketplaceService).init();
    }
    return MarketplaceService.instance as MarketplaceService;
  }

  /**
   * Static factory method to create a new instance
   */
  static async create(): Promise<MarketplaceService> {
    const service = new MarketplaceService();
    await service.init();
    return service;
  }

  /**
   * Initialize the service (must be called after constructor)
   */
  async init(): Promise<void> {
    await this.initializeDatabase();
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
    review?: Partial<TemplateReview>,
    userId?: string
  ): Promise<void> {
    try {
      await this.api.rateTemplate(templateId, rating, review, userId);

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
   * One-click install with smart defaults and automatic resolution
   * Resolves template by ID or search, selects optimal version, handles updates
   * @param templateQuery - Template ID or search query
   * @param options - Quick install options (autoConfirm, useLatest, enableAutoUpdate)
   * @returns Promise resolving to template and installation details
   * @throws Error if template not found or installation fails
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
   * Install template with dependencies using dependency resolution
   * @param templateId - Template ID to install
   * @param version - Optional specific version (defaults to current)
   * @param options - Dependency installation options (skipOptional, maxDepth)
   * @returns Promise resolving to primary template and dependency installations
   * @throws Error if dependencies cannot be resolved or installation fails
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
   * Check template dependencies to ensure all required dependencies are available
   * @param templateVersion - Template version object containing dependencies
   * @returns Promise that resolves when all dependencies are verified
   * @throws Error if required dependencies are missing
   * @private
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
   * Download template content and metadata to local filesystem
   * @param template - Template model to download
   * @param version - Specific template version to download
   * @returns Promise resolving to local installation directory path
   * @throws Error if download or file operations fail
   * @private
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
   * Search templates by tags with caching and database fallback
   * @param tags - Array of tags to search for
   * @returns Promise resolving to search results with templates matching the tags
   * @throws Error if search operation fails
   */
  async searchByTags(tags: string[]): Promise<TemplateSearchResult> {
    const cacheKey = `searchByTags:${JSON.stringify(tags)}`;
    const cached = this.getFromCache<TemplateSearchResult>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      let result: TemplateSearchResult;

      if (this.database) {
        const templates = await this.database.templates.findByTags(tags, {
          sort: [{ field: 'downloads', direction: 'desc' }],
        });

        result = {
          templates: templates as any[],
          total: templates.length,
          page: 1,
          limit: templates.length,
          hasMore: false,
        };
      } else {
        // Fallback to API search
        result = await this.search({ tags });
      }

      this.setCache(cacheKey, result, 5 * 60 * 1000); // 5 minutes
      this.emit('search:tags', { tags, result });
      return result;
    } catch (error) {
      logger.error(`Search by tags failed: ${error}`);
      this.emit('search:tags:error', { tags, error });
      throw error;
    }
  }

  /**
   * Search templates by category with caching and database fallback
   * @param category - Category name to search for
   * @returns Promise resolving to search results for the specified category
   * @throws Error if search operation fails
   */
  async searchByCategory(category: string): Promise<TemplateSearchResult> {
    const cacheKey = `searchByCategory:${category}`;
    const cached = this.getFromCache<TemplateSearchResult>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      let result: TemplateSearchResult;

      if (this.database) {
        const templates = await this.database.templates.findByCategory(
          category,
          {
            sort: [{ field: 'downloads', direction: 'desc' }],
          }
        );

        result = {
          templates: templates as any[],
          total: templates.length,
          page: 1,
          limit: templates.length,
          hasMore: false,
        };
      } else {
        // Fallback to API search
        result = await this.search({ category: category as any });
      }

      this.setCache(cacheKey, result, 5 * 60 * 1000); // 5 minutes
      this.emit('search:category', { category, result });
      return result;
    } catch (error) {
      logger.error(`Search by category failed: ${error}`);
      this.emit('search:category:error', { category, error });
      throw error;
    }
  }

  /**
   * Get popular templates sorted by download count
   * @param limit - Maximum number of templates to return (default: 20)
   * @returns Promise resolving to search results with most popular templates
   * @throws Error if retrieval operation fails
   */
  async getPopularTemplates(limit: number = 20): Promise<TemplateSearchResult> {
    const cacheKey = `popular:${limit}`;
    const cached = this.getFromCache<TemplateSearchResult>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      let result: TemplateSearchResult;

      if (this.database) {
        const templates = await this.database.templates.getPopular(limit);

        result = {
          templates: templates as any[],
          total: templates.length,
          page: 1,
          limit,
          hasMore: false,
        };
      } else {
        // Fallback to API search
        result = await this.search({
          sortBy: 'downloads',
          sortOrder: 'desc',
          limit,
        });
      }

      this.setCache(cacheKey, result, 10 * 60 * 1000); // 10 minutes
      this.emit('popular:fetched', { limit, result });
      return result;
    } catch (error) {
      logger.error(`Get popular templates failed: ${error}`);
      this.emit('popular:error', { limit, error });
      throw error;
    }
  }

  /**
   * Get top rated templates sorted by rating
   * @param limit - Maximum number of templates to return (default: 20)
   * @returns Promise resolving to search results with highest rated templates
   * @throws Error if retrieval operation fails
   */
  async getTopRated(limit: number = 20): Promise<TemplateSearchResult> {
    const cacheKey = `topRated:${limit}`;
    const cached = this.getFromCache<TemplateSearchResult>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      let result: TemplateSearchResult;

      if (this.database) {
        const templates = await this.database.templates.findMany({
          sort: [{ field: 'rating.average', direction: 'desc' }],
          limit,
        });

        result = {
          templates: templates as any[],
          total: templates.length,
          page: 1,
          limit,
          hasMore: false,
        };
      } else {
        // Fallback to API search
        result = await this.search({
          sortBy: 'rating',
          sortOrder: 'desc',
          limit,
        });
      }

      this.setCache(cacheKey, result, 10 * 60 * 1000); // 10 minutes
      this.emit('topRated:fetched', { limit, result });
      return result;
    } catch (error) {
      logger.error(`Get top rated templates failed: ${error}`);
      this.emit('topRated:error', { limit, error });
      throw error;
    }
  }

  /**
   * Get all templates by a specific author
   * @param author - Author name or ID to search for
   * @returns Promise resolving to search results with all templates by the author
   * @throws Error if search operation fails
   */
  async getByAuthor(author: string): Promise<TemplateSearchResult> {
    const cacheKey = `byAuthor:${author}`;
    const cached = this.getFromCache<TemplateSearchResult>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      let result: TemplateSearchResult;

      if (this.database) {
        const templates = await this.database.templates.findByAuthor(author, {
          sort: [{ field: 'updated', direction: 'desc' }],
        });

        result = {
          templates: templates as any[],
          total: templates.length,
          page: 1,
          limit: templates.length,
          hasMore: false,
        };
      } else {
        // Fallback to API search
        result = await this.search({ author });
      }

      this.setCache(cacheKey, result, 10 * 60 * 1000); // 10 minutes
      this.emit('byAuthor:fetched', { author, result });
      return result;
    } catch (error) {
      logger.error(`Get templates by author failed: ${error}`);
      this.emit('byAuthor:error', { author, error });
      throw error;
    }
  }

  /**
   * Get trending templates based on recent download activity
   * @param hours - Time window in hours for trending calculation (default: 24)
   * @returns Promise resolving to search results with trending templates
   * @throws Error if retrieval operation fails
   */
  async getTrending(hours: number = 24): Promise<TemplateSearchResult> {
    const cacheKey = `trending:${hours}`;
    const cached = this.getFromCache<TemplateSearchResult>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      let result: TemplateSearchResult;

      if (this.database) {
        // Get templates with recent downloads
        // const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);
        const templates = await this.database.templates.getTrending();

        // Filter by recent activity (this would need installation tracking)
        const filtered = templates.filter(
          template =>
            // In a real implementation, check installation history
            template.stats && template.stats.downloads > 0
        );

        result = {
          templates: filtered as any[],
          total: filtered.length,
          page: 1,
          limit: filtered.length,
          hasMore: false,
        };
      } else {
        // Fallback to API search
        result = await this.search({
          trending: true,
          sortBy: 'downloads',
          sortOrder: 'desc',
        });
      }

      this.setCache(cacheKey, result, 5 * 60 * 1000); // 5 minutes (trending changes fast)
      this.emit('trending:fetched', { hours, result });
      return result;
    } catch (error) {
      logger.error(`Get trending templates failed: ${error}`);
      this.emit('trending:error', { hours, error });
      throw error;
    }
  }

  /**
   * Install template to specific path with advanced options
   * @param id - Template ID to install
   * @param targetPath - Target installation path
   * @param options - Installation options (version, skipDeps, enableAutoUpdate)
   * @returns Promise resolving to installation result with success status and metadata
   * @throws Error if installation fails or template not found
   */
  async installTemplate(
    id: string,
    targetPath: string,
    options?: {
      version?: string;
      skipDeps?: boolean;
      enableAutoUpdate?: boolean;
    }
  ): Promise<InstallationResult> {
    const startTime = Date.now();

    try {
      this.emit('installTemplate:started', { id, targetPath, options });

      // Get template information
      const template = await this.getTemplate(id);
      const version = options?.version || template.currentVersion;

      // Install to specific path
      const installResult = await this.install(id, version);

      // If target path is different, move installation
      if (targetPath !== installResult.installPath) {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });

        // Remove target directory if it exists to avoid ENOTEMPTY error
        try {
          await fs.rm(targetPath, { recursive: true, force: true });
        } catch (_error) {
          // Ignore error if directory doesn't exist
        }

        await fs.rename(installResult.installPath, targetPath);

        // Update manifest with new path
        if (this.manifest) {
          const installation = this.manifest.templates.find(
            t => t.templateId === id
          );
          if (installation) {
            installation.installPath = targetPath;
            await this.saveManifest();
          }
        }
      }

      const result: InstallationResult = {
        ...installResult,
        installPath: targetPath,
        duration: Date.now() - startTime,
      };

      this.emit('installTemplate:completed', { id, targetPath, result });
      return result;
    } catch (error) {
      logger.error(`Failed to install template to ${targetPath}: ${error}`);
      this.emit('installTemplate:error', { id, targetPath, error });
      throw error;
    }
  }

  /**
   * Batch install multiple templates with concurrent processing
   * Supports two overloads: install by queries or install to specific paths
   * @param templateQueries - Array of template queries/IDs to install
   * @param options - Batch installation options (continueOnError, maxConcurrency)
   * @returns Promise resolving to array of installation results with success/failure status
   * @throws Error if critical installation failures occur and continueOnError is false
   */
  async batchInstall(
    templateQueries: string[],
    options?: {
      continueOnError?: boolean;
      maxConcurrency?: number;
    }
  ): Promise<
    Array<{
      templateQuery: string;
      success: boolean;
      template?: TemplateModel;
      installation?: TemplateInstallation;
      error?: Error;
    }>
  >;

  // eslint-disable-next-line no-dupe-class-members
  async batchInstall(
    ids: string[],
    targetPath: string,
    options?: {
      maxConcurrency?: number;
      continueOnError?: boolean;
    }
  ): Promise<
    Array<{
      id: string;
      success: boolean;
      result?: InstallationResult;
      error?: Error;
    }>
  >;

  // eslint-disable-next-line no-dupe-class-members
  async batchInstall(
    idsOrQueries: string[],
    targetPathOrOptions?:
      | string
      | {
          continueOnError?: boolean;
          maxConcurrency?: number;
        },
    options?: {
      maxConcurrency?: number;
      continueOnError?: boolean;
    }
  ): Promise<any> {
    // Determine which overload is being used
    if (typeof targetPathOrOptions === 'string') {
      // Second overload: batchInstall(ids, targetPath, options)
      const targetPath = targetPathOrOptions;
      const { maxConcurrency = 3, continueOnError = true } = options || {};
      const results = [];

      this.emit('batchInstall:started', {
        ids: idsOrQueries,
        targetPath,
        options,
      });

      // Process in batches to avoid overwhelming the system
      for (let i = 0; i < idsOrQueries.length; i += maxConcurrency) {
        const batch = idsOrQueries.slice(i, i + maxConcurrency);

        const batchPromises = batch.map(async id => {
          try {
            const templatePath = path.join(targetPath, id);
            const result = await this.installTemplate(id, templatePath);

            return {
              id,
              success: true,
              result,
            };
          } catch (error) {
            const errorResult = {
              id,
              success: false,
              error: error as Error,
            };

            if (!continueOnError) {
              throw error;
            }

            logger.warn(`Failed to install ${id}: ${error}`);
            return errorResult;
          }
        });

        // eslint-disable-next-line no-await-in-loop
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      this.emit('batchInstall:completed', { results });
      return results;
    }
    // First overload: batchInstall(templateQueries, options) - legacy behavior
    const templateQueries = idsOrQueries;
    const { continueOnError = true, maxConcurrency = 3 } =
      targetPathOrOptions || {};
    const results = [];

    this.emit('batch-install:started', {
      templateQueries,
      options: targetPathOrOptions,
    });

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
   * Check for template updates with flexible input options
   * Supports checking all installed templates or templates in specific path
   * @param installedPath - Optional path to check for installed templates
   * @returns Promise resolving to update check results or array of available updates
   * @throws Error if update check operation fails
   */
  // eslint-disable-next-line no-dupe-class-members
  async checkUpdates(): Promise<
    Array<{ templateId: string; currentVersion: string; latestVersion: string }>
  >;

  // eslint-disable-next-line no-dupe-class-members
  async checkUpdates(installedPath: string): Promise<UpdateCheckResult>;

  // eslint-disable-next-line no-dupe-class-members
  async checkUpdates(installedPath?: string): Promise<
    | UpdateCheckResult
    | Array<{
        templateId: string;
        currentVersion: string;
        latestVersion: string;
      }>
  > {
    try {
      this.emit('checkUpdates:started', { installedPath });

      // If no path provided, use legacy behavior (check from manifest)
      if (!installedPath) {
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

      // New behavior - read installed templates from path
      const installedTemplates: string[] = [];

      try {
        const items = await fs.readdir(installedPath);
        for (const item of items) {
          const itemPath = path.join(installedPath, item);
          const stat = await fs.stat(itemPath);
          if (stat.isDirectory()) {
            // Check if it's a template directory
            const metadataPath = path.join(itemPath, 'template.json');
            if (
              await fs
                .access(metadataPath)
                .then(() => true)
                .catch(() => false)
            ) {
              const metadata = JSON.parse(
                await fs.readFile(metadataPath, 'utf8')
              );
              if (metadata.template?.id) {
                installedTemplates.push(metadata.template.id);
              }
            }
          }
        }
      } catch (error) {
        logger.warn(`Could not read installed path ${installedPath}: ${error}`);
      }

      // Check each template for updates
      const updates = [];
      for (const templateId of installedTemplates) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const installation = this.getInstallation(templateId);

          if (installation) {
            // eslint-disable-next-line no-await-in-loop
            const template = await this.getTemplate(templateId);

            if (template.currentVersion !== installation.version) {
              updates.push({
                templateId,
                currentVersion: installation.version,
                latestVersion: template.currentVersion,
                template: template as unknown as MarketplaceTemplate,
              });
            }
          }
        } catch (error) {
          logger.warn(`Failed to check updates for ${templateId}: ${error}`);
        }
      }

      const result: UpdateCheckResult = {
        hasUpdates: updates.length > 0,
        currentVersion: '', // Not applicable for batch check
        latestVersion: '', // Not applicable for batch check
        hasUpdate: updates.length > 0, // Legacy alias
        updates,
      };

      this.emit('checkUpdates:completed', { installedPath, result });
      return result;
    } catch (error) {
      logger.error(`Check updates failed: ${error}`);
      this.emit('checkUpdates:error', { installedPath, error });
      throw error;
    }
  }

  /**
   * Update specific template to latest or specified version
   * @param id - Template ID to update
   * @param installedPath - Path where template is installed
   * @param version - Optional specific version to update to (defaults to latest)
   * @returns Promise resolving to installation result with update details
   * @throws Error if template not found or update fails
   */
  async updateTemplate(
    id: string,
    installedPath: string,
    version?: string
  ): Promise<InstallationResult> {
    const startTime = Date.now();

    try {
      this.emit('updateTemplate:started', { id, installedPath, version });

      // Get current installation
      const installation = this.getInstallation(id);
      if (!installation) {
        throw new Error(`Template ${id} is not installed`);
      }

      // Get template info
      const template = await this.getTemplate(id);
      const targetVersion = version || template.currentVersion;

      if (installation.version === targetVersion) {
        logger.info(`Template ${id} is already at version ${targetVersion}`);
        const result: InstallationResult = {
          success: true,
          template: template as unknown as MarketplaceTemplate,
          version: targetVersion,
          installPath: installation.installPath,
          duration: Date.now() - startTime,
          warnings: [],
        };
        return result;
      }

      // Update the template
      const updateResult = await this.update(id, targetVersion);

      this.emit('updateTemplate:completed', {
        id,
        installedPath,
        fromVersion: installation.version,
        toVersion: targetVersion,
      });

      return {
        ...updateResult,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      logger.error(`Failed to update template ${id}: ${error}`);
      this.emit('updateTemplate:error', { id, installedPath, error });
      throw error;
    }
  }

  /**
   * Update all templates in specified path to their latest versions
   * @param installedPath - Path containing installed templates
   * @returns Promise resolving to update result with success/failure counts
   * @throws Error if path is invalid or update process fails
   */
  async updateAll(installedPath: string): Promise<UpdateResult> {
    try {
      this.emit('updateAll:started', { installedPath });

      // Check for updates first
      const updateCheck = await this.checkUpdates(installedPath);

      if (!updateCheck.hasUpdates) {
        const result: UpdateResult = {
          success: true,
          updated: [],
          failed: [],
        };

        this.emit('updateAll:completed', { result });
        return result;
      }

      const updated = [];
      const failed = [];

      // Update each template
      for (const update of updateCheck.updates) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await this.updateTemplate(
            update.templateId,
            installedPath,
            update.latestVersion
          );

          updated.push({
            templateId: update.templateId,
            oldVersion: update.currentVersion,
            newVersion: update.latestVersion,
          });
        } catch (error) {
          failed.push({
            templateId: update.templateId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const result: UpdateResult = {
        success: failed.length === 0,
        updated,
        failed,
      };

      this.emit('updateAll:completed', { result });
      return result;
    } catch (error) {
      logger.error(`Update all templates failed: ${error}`);
      this.emit('updateAll:error', { installedPath, error });
      throw error;
    }
  }

  /**
   * Rollback template to specific version using backup or reinstallation
   * @param id - Template ID to rollback
   * @param version - Target version to rollback to
   * @param installedPath - Path where template is installed
   * @returns Promise resolving to installation result after rollback
   * @throws Error if template not found or rollback fails
   */
  async rollbackTemplate(
    id: string,
    version: string,
    installedPath: string
  ): Promise<InstallationResult> {
    const startTime = Date.now();

    try {
      this.emit('rollback:started', { id, version, installedPath });

      const installation = this.getInstallation(id);
      if (!installation) {
        throw new Error(`Template ${id} is not installed`);
      }

      // Check if backup exists for the target version
      const backupPath = path.join(
        installation.installPath,
        'backups',
        version
      );
      const backupExists = await fs
        .access(backupPath)
        .then(() => true)
        .catch(() => false);

      if (backupExists) {
        // Restore from backup
        const templateFiles = await fs.readdir(backupPath);

        for (const file of templateFiles) {
          const backupFilePath = path.join(backupPath, file);
          const targetFilePath = path.join(installation.installPath, file);
          // eslint-disable-next-line no-await-in-loop
          await fs.copyFile(backupFilePath, targetFilePath);
        }

        // Update installation record
        if (this.manifest) {
          const installIndex = this.manifest.templates.findIndex(
            t => t.templateId === id
          );
          if (installIndex >= 0) {
            this.manifest.templates[installIndex].version = version;
            await this.saveManifest();
          }
        }

        logger.info(
          `Template ${id} rolled back to version ${version} from backup`
        );
      } else {
        // Reinstall the specific version
        logger.info(`No backup found, reinstalling ${id}@${version}`);
        const installResult = await this.install(id, version);

        const result: InstallationResult = {
          ...installResult,
          duration: Date.now() - startTime,
        };

        this.emit('rollback:completed', { id, version, result });
        return result;
      }

      // Get template info for result
      const template = await this.getTemplate(id);
      const result: InstallationResult = {
        success: true,
        template: template as unknown as MarketplaceTemplate,
        version,
        installPath: installation.installPath,
        duration: Date.now() - startTime,
        warnings: [],
      };

      this.emit('rollback:completed', { id, version, result });
      return result;
    } catch (error) {
      logger.error(`Rollback failed for ${id}@${version}: ${error}`);
      this.emit('rollback:error', { id, version, error });
      throw error;
    }
  }

  /**
   * Rate a template with optional review comment
   * @param id - Template ID to rate
   * @param rating - Rating value (1-5 integer)
   * @param userId - User ID submitting the rating
   * @param options - Optional rating options (comment, title)
   * @returns Promise resolving to rating result with success status
   * @throws Error if rating is invalid or submission fails
   */
  async rateTemplate(
    id: string,
    rating: number,
    userId: string,
    options?: {
      comment?: string;
      title?: string;
    }
  ): Promise<RatingResult> {
    try {
      this.emit('rateTemplate:started', { id, rating, userId, options });

      // Validate rating
      if (rating < 1 || rating > 5 || typeof rating !== 'number') {
        throw new Error('Rating must be a number between 1 and 5');
      }

      // Create review object
      const review: Partial<TemplateReview> = {
        userId,
        rating,
        title: options?.title,
        comment: options?.comment,
      };

      // Submit rating via API
      await this.rate(id, rating, review, userId);

      // Store in database if available
      if (this.database && options?.comment) {
        const fullReview: TemplateReview = {
          id: `${id}_${userId}_${Date.now()}`,
          userId,
          userName: userId, // Would normally fetch user name
          rating,
          title: options.title,
          comment: options.comment,
          version: (await this.getTemplate(id)).currentVersion,
          helpful: 0,
          flagged: false,
          created: new Date(),
        };

        await this.database.reviews.create(fullReview);
      }

      const result: RatingResult = {
        success: true,
        rating,
        comment: options?.comment,
        templateId: id,
        userId,
      };

      this.emit('rateTemplate:completed', { id, rating, userId, result });
      return result;
    } catch (error) {
      logger.error(`Failed to rate template ${id}: ${error}`);
      this.emit('rateTemplate:error', { id, rating, userId, error });
      throw error;
    }
  }

  /**
   * Add a detailed review for a template
   * @param id - Template ID to review
   * @param review - Review data including userId, rating, title, and comment
   * @returns Promise resolving to created template review
   * @throws Error if database unavailable or review creation fails
   */
  async addReview(
    id: string,
    review: {
      userId: string;
      rating: number;
      title?: string;
      comment: string;
    }
  ): Promise<TemplateReview> {
    try {
      this.emit('addReview:started', { id, review });

      if (!this.database) {
        throw new Error('Database not available for reviews');
      }

      // Get template to get current version
      const template = await this.getTemplate(id);

      const fullReview: TemplateReview = {
        id: `${id}_${review.userId}_${Date.now()}`,
        templateId: id, // Add template ID for proper filtering
        userId: review.userId,
        userName: review.userId, // Would normally fetch user name
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        version: template.currentVersion,
        helpful: 0,
        flagged: false,
        created: new Date(),
      };

      const createdReview = await this.database.reviews.create(fullReview);

      // Invalidate template cache to refresh rating
      this.invalidateCache(`template:${id}`);

      this.emit('addReview:completed', { id, review: createdReview });
      return createdReview;
    } catch (error) {
      logger.error(`Failed to add review for template ${id}: ${error}`);
      this.emit('addReview:error', { id, review, error });
      throw error;
    }
  }

  /**
   * Get all reviews for a specific template with caching
   * @param id - Template ID to get reviews for
   * @returns Promise resolving to array of template reviews
   * @throws Error if template not found or review retrieval fails
   */
  async getReviews(id: string): Promise<TemplateReview[]> {
    const cacheKey = `reviews:${id}`;
    const cached = this.getFromCache<TemplateReview[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      let reviews: TemplateReview[] = [];

      if (
        this.database &&
        typeof this.database.reviews?.findByTemplate === 'function'
      ) {
        reviews = await this.database.reviews.findByTemplate(id, {
          sort: [{ field: 'created', direction: 'desc' }],
        });
      } else {
        // Fallback to template's reviews in model
        const template = await this.getTemplate(id);
        if (typeof template.rating === 'object' && template.rating.reviews) {
          const { reviews: templateReviews } = template.rating;
          reviews = templateReviews;
        }
      }

      this.setCache(cacheKey, reviews, 5 * 60 * 1000); // 5 minutes
      this.emit('getReviews:completed', { id, reviews });
      return reviews;
    } catch (error) {
      logger.error(`Failed to get reviews for template ${id}: ${error}`);
      this.emit('getReviews:error', { id, error });
      throw error;
    }
  }

  /**
   * Record a download for analytics and usage tracking
   * @param id - Template ID that was downloaded
   * @returns Promise that resolves when download is recorded
   * @throws Does not throw - logs warnings for non-critical failures
   */
  async recordDownload(id: string): Promise<void> {
    try {
      this.emit('recordDownload:started', { id });

      if (this.database) {
        // Record installation in database
        await this.database.installations.create({
          id: `${id}_${Date.now()}`,
          templateId: id,
          userId: 'anonymous', // Would normally track actual user
          installed: new Date(),
        });

        // Update template stats
        const template = await this.database.templates.findById(id);
        if (template) {
          const updatedStats = {
            ...template.stats,
            downloads: (template.stats.downloads || 0) + 1,
            lastDownload: new Date(),
          };

          await this.database.templates.update(id, {
            stats: updatedStats,
          });
        }
      }

      // Invalidate relevant caches
      this.invalidateCache(`template:${id}`);
      this.invalidateCache('popular');
      this.invalidateCache('trending');

      this.emit('recordDownload:completed', { id });
    } catch (error) {
      logger.warn(`Failed to record download for ${id}: ${error}`);
      // Don't throw error as this is non-critical
    }
  }

  /**
   * Get total cache size across memory and file-based caches
   * @returns Promise resolving to total cache size in bytes
   * @throws Error if cache size calculation fails
   */
  async getCacheSize(): Promise<number> {
    try {
      let totalSize = 0;

      // Calculate memory cache size
      for (const [, entry] of this.cache) {
        totalSize += JSON.stringify(entry.data).length;
      }

      // Add file-based cache size if exists
      const cacheDir = path.join(process.cwd(), '.cursor-prompt', 'cache');
      try {
        const cacheFiles = await fs.readdir(cacheDir);
        for (const file of cacheFiles) {
          const filePath = path.join(cacheDir, file);
          const stat = await fs.stat(filePath);
          totalSize += stat.size;
        }
      } catch {
        // Cache directory doesn't exist or can't be read
      }

      this.emit('getCacheSize:completed', { totalSize });
      return totalSize;
    } catch (error) {
      logger.error(`Failed to get cache size: ${error}`);
      throw error;
    }
  }

  /**
   * Clear all caches including memory, database, and file-based caches
   * @returns Promise that resolves when all caches are cleared
   * @throws Error if cache clearing operation fails
   */
  async clearCache(): Promise<void> {
    try {
      this.emit('clearCache:started');

      // Clear memory cache
      this.cache.clear();

      // Clear database cache if available
      if (this.database) {
        await this.database.clearCache();
      }

      // Clear file-based cache
      const cacheDir = path.join(process.cwd(), '.cursor-prompt', 'cache');
      try {
        await fs.rm(cacheDir, { recursive: true, force: true });
        await fs.mkdir(cacheDir, { recursive: true });
      } catch {
        // Cache directory doesn't exist or can't be cleared
      }

      logger.info('All caches cleared successfully');
      this.emit('clearCache:completed');
    } catch (error) {
      logger.error(`Failed to clear cache: ${error}`);
      this.emit('clearCache:error', { error });
      throw error;
    }
  }

  /**
   * Publish a template to the marketplace with version and privacy options
   * @param template - Template model to publish
   * @param options - Publishing options (version, isDraft, isPrivate)
   * @returns Promise resolving to publication result with template ID and version
   * @throws Error if template validation fails or publication is rejected
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
      // Validate template before publishing
      if (!template) {
        throw new Error('Template is required for publishing');
      }
      if (!template.id && !template.name) {
        throw new Error('Template must have either an id or name');
      }
      if (!template.name) {
        throw new Error('Template name is required');
      }

      logger.info(`Publishing template: ${template.name || template.id}`);

      // Check for existing template with same ID to enforce permissions
      if (template.id && this.database) {
        try {
          const existing = await this.database.templates.findById(template.id);
          if (existing && existing.author?.id && template.author?.id) {
            if (existing.author.id !== template.author.id) {
              throw new Error(
                `Template '${template.id}' can only be updated by its original author`
              );
            }
          }
        } catch (error: any) {
          // If it's a permission error, re-throw it
          if (error.message.includes('can only be updated')) {
            throw error;
          }
          // Otherwise, the template probably doesn't exist yet, which is fine for new templates
        }
      }

      // Prepare template data for publishing
      const publishData = {
        ...template,
        currentVersion: options.version || template.currentVersion || '1.0.0',
        isDraft: options.isDraft || false,
        isPrivate: options.isPrivate || false,
        updated: new Date(),
      };

      // Store in local database if available (for testing)
      if (this.database) {
        await this.database.templates.create(publishData);
      }

      // Call marketplace API to publish
      const result = await this.api.publishTemplate(publishData);

      // Register in local registry if successful
      if (result.templateId) {
        const templateVersion: TemplateVersion = template.versions?.[0] || {
          version: result.version,
          description: template.description,
          content: JSON.stringify(template),
          dependencies: [],
          variables: [],
          examples: [],
          changelog: 'Initial release',
          compatibility: ['1.0.0'],
          size: JSON.stringify(template).length,
          created: new Date(),
          downloads: 0,
          deprecated: false,
        };

        await this.registry.registerTemplate(
          template,
          templateVersion,
          '' // Will be set during installation
        );
      }

      // Invalidate cache for this template since we have a new version
      this.invalidateCache(`template:${template.id || result.templateId}`);

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
        templateId: template?.id || 'unknown',
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
}

// Additional export to satisfy import/prefer-default-export
export type MarketplaceServiceType = typeof MarketplaceService;

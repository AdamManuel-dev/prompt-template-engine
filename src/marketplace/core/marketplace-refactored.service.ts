/**
 * @fileoverview Refactored marketplace service using domain services
 * @lastmodified 2025-08-22T21:45:00Z
 *
 * Features: Orchestrates marketplace operations using specialized services
 * Main APIs: Delegates to domain services for specific operations
 * Constraints: Maintains backward compatibility
 * Patterns: Facade pattern with service composition
 */

import * as os from 'os';
import * as path from 'path';

import { MarketplaceAPI } from '../api/marketplace.api';
import {
  TemplateModel,
  TemplateSearchQuery,
  TemplateSearchResult,
  InstallationResult,
  UpdateResult,
  UpdateCheckResult,
  RatingResult,
  UserPreferences,
  TemplateReview,
} from '../models/template.model';
import { TemplateSearchService } from '../services/template-search.service';
import { TemplateInstallerService } from '../services/template-installer.service';
import { TemplateUpdaterService } from '../services/template-updater.service';
import { logger } from '../../utils/logger';
import { AuthorService } from './author.service';
import { TemplateRegistry } from './template.registry';

export class MarketplaceRefactoredService {
  private searchService: TemplateSearchService;

  private installerService: TemplateInstallerService;

  private updaterService: TemplateUpdaterService;

  private authorService: AuthorService;

  private api: MarketplaceAPI;

  private registry: TemplateRegistry;

  private preferences: UserPreferences = {
    autoUpdate: false,
    checkInterval: 86400000, // 24 hours
    includePrerelease: false,
    trustedAuthors: [],
    blockedAuthors: [],
    preferredCategories: [],
    installPath: path.join(os.homedir(), '.cursor-prompt', 'marketplace'),
    notifications: {
      newVersions: true,
      newFromAuthors: false,
      featuredTemplates: false,
      securityUpdates: true,
      weeklyDigest: false,
    },
  };

  constructor(config?: {
    apiUrl?: string;
    apiKey?: string;
    installPath?: string;
  }) {
    // Initialize core services
    this.api = new MarketplaceAPI(config);
    this.registry = new TemplateRegistry();

    // Initialize domain services
    this.searchService = new TemplateSearchService(this.api);
    this.installerService = new TemplateInstallerService(
      this.api,
      this.registry,
      config?.installPath ||
        this.preferences.installPath ||
        path.join(os.homedir(), '.cursor-prompt', 'marketplace')
    );
    this.updaterService = new TemplateUpdaterService(
      this.api,
      this.registry,
      this.installerService,
      path.join(
        config?.installPath ||
          this.preferences.installPath ||
          path.join(os.homedir(), '.cursor-prompt', 'marketplace'),
        'backups'
      )
    );
    this.authorService = AuthorService.getInstance(this.api);

    logger.info('MarketplaceRefactoredService initialized');
  }

  /**
   * Search for templates
   */
  async search(query: TemplateSearchQuery): Promise<TemplateSearchResult> {
    return this.searchService.search(query);
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<TemplateModel> {
    return this.searchService.getTemplate(templateId);
  }

  /**
   * Get featured templates
   */
  async getFeatured(limit = 10): Promise<TemplateModel[]> {
    return this.searchService.getFeatured(limit);
  }

  /**
   * Get trending templates
   */
  async getTrending(limit = 10): Promise<TemplateModel[]> {
    return this.searchService.getTrending(limit);
  }

  /**
   * Install a template
   */
  async install(
    templateId: string,
    options?: {
      version?: string;
      force?: boolean;
      withDependencies?: boolean;
    }
  ): Promise<InstallationResult> {
    return this.installerService.install(templateId, options);
  }

  /**
   * Quick install
   */
  async quickInstall(templateId: string): Promise<InstallationResult> {
    return this.installerService.quickInstall(templateId);
  }

  /**
   * Batch install
   */
  async batchInstall(
    templateIds: string[],
    options?: {
      continueOnError?: boolean;
    }
  ): Promise<InstallationResult[]> {
    return this.installerService.batchInstall(templateIds, options);
  }

  /**
   * Update a template
   */
  async update(
    templateId: string,
    options?: {
      force?: boolean;
      backup?: boolean;
    }
  ): Promise<UpdateResult> {
    return this.updaterService.update(templateId, options);
  }

  /**
   * Check for updates
   */
  async checkUpdates(): Promise<UpdateCheckResult[]> {
    return this.updaterService.checkUpdates();
  }

  /**
   * Update all templates
   */
  async updateAll(options?: {
    force?: boolean;
    backup?: boolean;
  }): Promise<UpdateResult[]> {
    return this.updaterService.updateAll(options);
  }

  /**
   * Uninstall a template
   */
  async uninstall(templateId: string): Promise<void> {
    try {
      // Remove from registry
      await this.registry.unregisterTemplate(templateId);

      // Remove files
      const installPath =
        this.preferences.installPath ||
        path.join(os.homedir(), '.cursor-prompt', 'marketplace');
      const templatePath = path.join(installPath, 'templates', templateId);
      const fs = await import('fs');
      await fs.promises.rm(templatePath, { recursive: true, force: true });

      logger.info(`Template ${templateId} uninstalled successfully`);
    } catch (error: unknown) {
      logger.error(
        `Failed to uninstall template ${templateId}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Rate a template
   */
  async rate(
    templateId: string,
    rating: number,
    review?: string | Partial<TemplateReview>
  ): Promise<RatingResult> {
    try {
      const reviewData =
        typeof review === 'string' ? { comment: review } : review;
      await this.api.rateTemplate(templateId, rating, reviewData);
      logger.info(`Rated template ${templateId}: ${rating} stars`);
      return {
        success: true,
        rating,
        comment: reviewData?.comment,
        templateId,
        userId: 'current-user', // Would need proper user context
      };
    } catch (error: unknown) {
      logger.error(
        `Failed to rate template ${templateId}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get installed templates
   */
  async getInstalled(): Promise<TemplateModel[]> {
    return this.registry.listTemplates().map(t => t.metadata);
  }

  /**
   * Get recommendations
   */
  async getRecommendations(limit = 10): Promise<TemplateModel[]> {
    const installed = await this.getInstalled();
    const installedIds = installed.map(t => t.id);

    // Get categories and tags from installed templates
    const categories = [
      ...new Set(installed.map(t => t.category).filter(Boolean)),
    ];
    const tags = [...new Set(installed.flatMap(t => t.tags || []))];

    return this.searchService.getRecommendations(
      {
        categories: categories as any[],
        tags,
        excludeInstalled: installedIds,
      },
      limit
    );
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    this.preferences = {
      ...this.preferences,
      ...preferences,
    };

    // Save preferences
    const installPath =
      this.preferences.installPath ||
      path.join(os.homedir(), '.cursor-prompt', 'marketplace');
    const prefsPath = path.join(installPath, 'preferences.json');
    const fs = await import('fs');
    await fs.promises.writeFile(
      prefsPath,
      JSON.stringify(this.preferences, null, 2)
    );

    return this.preferences;
  }

  /**
   * Get author information
   */
  async getAuthor(authorId: string): Promise<unknown> {
    return this.authorService.getProfile(authorId);
  }

  /**
   * Follow an author
   */
  async followAuthor(authorId: string): Promise<unknown> {
    return this.authorService.followAuthor(authorId);
  }

  /**
   * Unfollow an author
   */
  async unfollowAuthor(authorId: string): Promise<unknown> {
    return this.authorService.unfollowAuthor(authorId);
  }
}

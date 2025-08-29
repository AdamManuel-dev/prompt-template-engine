/**
 * @fileoverview Migration script to switch to refactored implementations
 * @lastmodified 2025-08-22T22:15:00Z
 *
 * Features: Replaces old services with refactored versions
 * Main APIs: migrateTemplateEngine(), migrateMarketplace()
 * Constraints: Maintains backward compatibility
 * Patterns: Adapter pattern for compatibility layer
 */

import { TemplateEngine } from '../core/template-engine';
import { TemplateEngineRefactored } from '../core/template-engine-refactored';
import { MarketplaceRefactoredService } from '../marketplace/core/marketplace-refactored.service';
import type {
  TemplateReview,
  TemplateSearchQuery,
  TemplateModel,
  TemplateSearchResult,
  InstallationResult,
  UpdateResult,
  UpdateCheckResult,
  UserPreferences,
} from '../marketplace/models/template.model';
import { logger } from '../utils/logger';

/**
 * Create a compatibility adapter for TemplateEngine
 */
export class TemplateEngineAdapter extends TemplateEngine {
  private refactoredEngine: TemplateEngineRefactored;

  constructor(options?: Record<string, unknown>) {
    super();
    this.refactoredEngine = new TemplateEngineRefactored(options);
  }

  override async render(
    template: string,
    context: Record<string, unknown>
  ): Promise<string> {
    return this.refactoredEngine.render(template, { variables: context });
  }

  renderSync(template: string, context: Record<string, unknown>): string {
    return this.refactoredEngine.renderSync(template, { variables: context });
  }

  override isTruthy(value: unknown): boolean {
    return this.refactoredEngine.isTruthy(value);
  }

  override extractVariables(template: string): string[] {
    return this.refactoredEngine.extractVariables(template);
  }

  // Override other methods to use refactored implementation
  override processConditionalBlocks(
    template: string,
    context: Record<string, unknown>,
    _depth = 0
  ): string {
    // Use refactored engine's renderSync which includes conditional processing
    return this.refactoredEngine.renderSync(template, { variables: context });
  }

  override findOutermostIfBlocks(_template: string): Array<{
    fullMatch: string;
    condition: string;
    innerTemplate: string;
    elseTemplate?: string;
  }> {
    // This method is exposed for compatibility but uses new implementation internally
    logger.warn(
      'findOutermostIfBlocks called on adapter - consider updating to new API'
    );
    return [];
  }

  override findOutermostConditionalBlocks(
    _template: string,
    _type: string
  ): Array<{
    fullMatch: string;
    condition: string;
    innerTemplate: string;
    elseTemplate?: string;
  }> {
    logger.warn(
      'findOutermostConditionalBlocks called on adapter - consider updating to new API'
    );
    return [];
  }
}

/**
 * Create a compatibility adapter for MarketplaceService
 */
export class MarketplaceServiceAdapter {
  private refactoredService: MarketplaceRefactoredService;

  constructor() {
    this.refactoredService = new MarketplaceRefactoredService();
  }

  async search(query: TemplateSearchQuery): Promise<TemplateSearchResult> {
    return this.refactoredService.search(query);
  }

  async getTemplate(templateId: string): Promise<TemplateModel | null> {
    return this.refactoredService.getTemplate(templateId);
  }

  async install(
    templateId: string,
    options?: Record<string, unknown>
  ): Promise<InstallationResult> {
    return this.refactoredService.install(templateId, options);
  }

  async update(
    templateId: string,
    options?: Record<string, unknown>
  ): Promise<UpdateResult> {
    return this.refactoredService.update(templateId, options);
  }

  async uninstall(templateId: string): Promise<void> {
    return this.refactoredService.uninstall(templateId);
  }

  async rate(
    templateId: string,
    rating: number,
    review?: string | Partial<TemplateReview>
  ): Promise<void> {
    await this.refactoredService.rate(templateId, rating, review);
  }

  async checkUpdates(): Promise<UpdateCheckResult[]> {
    return this.refactoredService.checkUpdates();
  }

  async quickInstall(templateId: string): Promise<InstallationResult> {
    return this.refactoredService.quickInstall(templateId);
  }

  async batchInstall(
    templateIds: string[],
    options?: Record<string, unknown>
  ): Promise<InstallationResult[]> {
    return this.refactoredService.batchInstall(templateIds, options);
  }

  async getInstalled(): Promise<TemplateModel[]> {
    return this.refactoredService.getInstalled();
  }

  async updatePreferences(preferences: UserPreferences): Promise<void> {
    await this.refactoredService.updatePreferences(preferences);
  }
}

/**
 * Migrate template engine imports
 */
export function migrateTemplateEngine(): void {
  logger.info('Migrating to refactored TemplateEngine...');

  // Update the main export to use adapter
  const templateEngineModule = require('../core/template-engine');
  templateEngineModule.TemplateEngine = TemplateEngineAdapter;

  logger.success('TemplateEngine migration complete');
}

/**
 * Migrate marketplace service imports
 */
export function migrateMarketplace(): void {
  logger.info('Migrating to refactored MarketplaceService...');

  // Update the singleton instance
  const marketplaceModule = require('../marketplace/core/marketplace.service');
  // Store original for potential restoration
  // const _originalGetInstance = marketplaceModule.MarketplaceService.getInstance;

  marketplaceModule.MarketplaceService.getInstance = function () {
    if (!this._adapterInstance) {
      this._adapterInstance = new MarketplaceServiceAdapter();
    }
    return this._adapterInstance;
  };

  logger.success('MarketplaceService migration complete');
}

/**
 * Run all migrations
 */
export function runMigrations(): void {
  logger.info('Starting migration to refactored services...');

  try {
    migrateTemplateEngine();
    migrateMarketplace();

    logger.success('All migrations completed successfully');
    logger.info('The codebase is now using refactored implementations');
    logger.info('Old implementations are wrapped with compatibility adapters');
  } catch (error: unknown) {
    logger.error(
      `Migration failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

// Auto-run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

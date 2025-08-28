/**
 * @fileoverview Template search and discovery service
 * @lastmodified 2025-08-22T21:45:00Z
 *
 * Features: Search, filter, sort marketplace templates
 * Main APIs: search(), getTemplate(), getRecommendations()
 * Constraints: API rate limiting, result pagination
 * Patterns: Search service with caching
 */

import { MarketplaceAPI } from '../api/marketplace.api';
import {
  TemplateModel,
  TemplateSearchQuery,
  TemplateSearchResult,
  TemplateCategory,
  TemplateSortOption,
} from '../models/template.model';
import { logger } from '../../utils/logger';

export class TemplateSearchService {
  private searchCache = new Map<
    string,
    {
      result: TemplateSearchResult;
      timestamp: number;
    }
  >();

  private cacheDuration = 5 * 60 * 1000; // 5 minutes

  constructor(private api: MarketplaceAPI) {}

  /**
   * Search for templates in marketplace
   */
  async search(query: TemplateSearchQuery): Promise<TemplateSearchResult> {
    const cacheKey = this.getCacheKey(query);

    // Check cache
    const cached = this.searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.result;
    }

    try {
      // Perform search
      const result = await this.api.searchTemplates(query);

      // Cache result
      this.searchCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      return result;
    } catch (error: any) {
      logger.error(
        `Template search failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<TemplateModel> {
    try {
      return await this.api.getTemplate(templateId);
    } catch (error: any) {
      logger.error(
        `Failed to get template ${templateId}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get featured templates
   */
  async getFeatured(limit = 10): Promise<TemplateModel[]> {
    const result = await this.search({
      featured: true,
      limit,
      sortBy: 'downloads',
      sortOrder: 'desc',
    });
    return result.templates;
  }

  /**
   * Get trending templates
   */
  async getTrending(limit = 10): Promise<TemplateModel[]> {
    const result = await this.search({
      trending: true,
      limit,
      sortBy: 'popularity',
      sortOrder: 'desc',
    });
    return result.templates;
  }

  /**
   * Get templates by category
   */
  async getByCategory(
    category: TemplateCategory,
    options: {
      page?: number;
      limit?: number;
      sort?: TemplateSortOption;
    } = {}
  ): Promise<TemplateSearchResult> {
    return this.search({
      category,
      page: options.page || 1,
      limit: options.limit || 20,
      sortBy: options.sort || 'relevance',
      sortOrder: 'desc',
    });
  }

  /**
   * Get templates by author
   */
  async getByAuthor(
    authorId: string,
    options: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<TemplateSearchResult> {
    return this.search({
      author: authorId,
      page: options.page || 1,
      limit: options.limit || 20,
      sortBy: 'updated',
      sortOrder: 'desc',
    });
  }

  /**
   * Get recommended templates based on user preferences
   */
  async getRecommendations(
    preferences: {
      categories?: TemplateCategory[];
      tags?: string[];
      excludeInstalled?: string[];
    },
    limit = 10
  ): Promise<TemplateModel[]> {
    // Build recommendation query
    const queries: Promise<TemplateSearchResult>[] = [];

    // Get templates from preferred categories
    if (preferences.categories) {
      for (const category of preferences.categories) {
        queries.push(
          this.search({
            category,
            limit: Math.ceil(limit / preferences.categories.length),
            sortBy: 'rating',
            sortOrder: 'desc',
          })
        );
      }
    }

    // Get templates with preferred tags
    if (preferences.tags && preferences.tags.length > 0) {
      queries.push(
        this.search({
          tags: preferences.tags,
          limit: Math.ceil(limit / 2),
          sortBy: 'downloads',
          sortOrder: 'desc',
        })
      );
    }

    // Combine and deduplicate results
    const results = await Promise.all(queries);
    const allTemplates: TemplateModel[] = [];
    const seen = new Set<string>(preferences.excludeInstalled || []);

    for (const result of results) {
      for (const template of result.templates) {
        if (!seen.has(template.id)) {
          seen.add(template.id);
          allTemplates.push(template);
        }
      }
    }

    // Return top recommendations
    return allTemplates.slice(0, limit);
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    this.searchCache.clear();
  }

  /**
   * Generate cache key for query
   */
  private getCacheKey(query: TemplateSearchQuery): string {
    return JSON.stringify(query);
  }
}

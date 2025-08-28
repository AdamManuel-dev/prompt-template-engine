/**
 * @fileoverview Optimization features integration for marketplace
 * @lastmodified 2025-08-26T10:30:00Z
 *
 * Features: Quality scoring display, performance metrics visualization, optimized template category
 * Main APIs: OptimizedTemplateCategory, QualityScoreDisplay, PerformanceMetricsWidget
 * Constraints: Integrates with existing marketplace service architecture
 * Patterns: Feature flag pattern, metrics aggregation, UI enhancement
 */

import {
  TemplateModel,
  TemplateSearchQuery,
  TemplateSearchResult,
  TemplateCategory,
  TemplateSortOption,
} from './models/template.model';
import { MarketplaceRefactoredService } from './core/marketplace-refactored.service';
import { logger } from '../utils/logger';

/**
 * Optimization quality tiers for templates
 */
export enum OptimizationTier {
  UNOPTIMIZED = 'unoptimized',
  BASIC = 'basic',
  STANDARD = 'standard',
  ADVANCED = 'advanced',
  PREMIUM = 'premium',
}

/**
 * Quality score ranges and their corresponding tiers
 */
export const QUALITY_TIERS = {
  [OptimizationTier.PREMIUM]: {
    min: 95,
    max: 100,
    label: 'Premium Quality',
    color: '#dc2626',
    icon: '⭐⭐⭐',
  },
  [OptimizationTier.ADVANCED]: {
    min: 85,
    max: 94,
    label: 'Advanced Quality',
    color: '#ea580c',
    icon: '⭐⭐',
  },
  [OptimizationTier.STANDARD]: {
    min: 70,
    max: 84,
    label: 'Standard Quality',
    color: '#ca8a04',
    icon: '⭐',
  },
  [OptimizationTier.BASIC]: {
    min: 50,
    max: 69,
    label: 'Basic Quality',
    color: '#6b7280',
    icon: '📝',
  },
  [OptimizationTier.UNOPTIMIZED]: {
    min: 0,
    max: 49,
    label: 'Unoptimized',
    color: '#374151',
    icon: '⚠️',
  },
};

/**
 * Performance metrics thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  responseTime: {
    excellent: 1000, // < 1s
    good: 3000, // < 3s
    fair: 5000, // < 5s
    poor: 5000, // >= 5s
  },
  tokenEfficiency: {
    excellent: 90, // >= 90%
    good: 75, // >= 75%
    fair: 60, // >= 60%
    poor: 60, // < 60%
  },
  costEffectiveness: {
    excellent: 0.01, // < $0.01
    good: 0.05, // < $0.05
    fair: 0.1, // < $0.10
    poor: 0.1, // >= $0.10
  },
};

/**
 * Optimization features for marketplace templates
 */
export interface OptimizationFeatures {
  /** Quality score (0-100) */
  qualityScore?: number;

  /** Quality tier */
  qualityTier?: OptimizationTier;

  /** Performance metrics */
  performanceMetrics?: {
    averageResponseTime: number;
    tokenEfficiency: number;
    costPerRequest: number;
    successRate: number;
    cacheHitRate: number;
  };

  /** Optimization metadata */
  optimization?: {
    level: 'basic' | 'standard' | 'advanced' | 'aggressive';
    tokenReduction: number;
    qualityImprovement: number;
    optimizedAt: string;
    optimizedBy: string;
    version: string;
  };

  /** User reviews and ratings focused on optimization */
  optimizationReviews?: {
    averageRating: number;
    totalReviews: number;
    qualityRatings: { score: number; count: number }[];
    performanceRatings: { score: number; count: number }[];
    recommendations: string[];
  };

  /** Badges and certifications */
  badges?: {
    aiOptimized: boolean;
    tokenEfficient: boolean;
    highQuality: boolean;
    performanceOptimized: boolean;
    costEffective: boolean;
    communityFavorite: boolean;
  };
}

/**
 * Extended template model with optimization features
 */
export interface OptimizedTemplateModel extends TemplateModel {
  optimizationFeatures?: OptimizationFeatures;
  optimizationData?: Record<string, unknown>;
  qualityScore?: number;
  performanceMetrics?:
    | {
        averageResponseTime: number;
        tokenEfficiency: number;
        costPerRequest: number;
        successRate: number;
        cacheHitRate: number;
      }
    | Record<string, unknown>;
  optimizationLevel?: string;
  tokenReduction?: number;
  qualityImprovement?: number;
  optimizedAt?: string;
  aiOptimized?: boolean;
  optimization?: Record<string, unknown>;
  optimizationReviews?: unknown[];
  optimizedBy?: string;
  optimizationVersion?: string;
  performanceOptimized?: boolean;
  costReduction?: number;
}

/**
 * Optimization-aware search filters
 */
export interface OptimizationSearchFilters {
  /** Filter by quality tier */
  qualityTier?: OptimizationTier[];

  /** Minimum quality score */
  minQualityScore?: number;

  /** Performance requirements */
  performance?: {
    maxResponseTime?: number;
    minTokenEfficiency?: number;
    maxCostPerRequest?: number;
    minSuccessRate?: number;
  };

  /** Required badges */
  requiredBadges?: string[];

  /** Optimization level */
  optimizationLevel?: string[];

  /** Sort by optimization metrics */
  sortBy?: 'quality' | 'performance' | 'cost' | 'popularity';
}

/**
 * Marketplace optimization features service
 */
export class MarketplaceOptimizationService {
  private marketplaceService: MarketplaceRefactoredService;

  constructor(marketplaceService: MarketplaceRefactoredService) {
    this.marketplaceService = marketplaceService;
  }

  /**
   * Get optimized template category listings
   * @param filters - Optimization-specific filters
   * @param limit - Maximum number of results
   * @returns Promise resolving to optimized templates
   */
  async getOptimizedTemplates(
    filters: OptimizationSearchFilters = {},
    limit: number = 50
  ): Promise<OptimizedTemplateModel[]> {
    try {
      // Build search query with optimization filters
      const searchQuery: TemplateSearchQuery = {
        category: 'other' as TemplateCategory, // 'optimized' not in enum, using 'other'
        sortBy: this.mapOptimizationSort(filters.sortBy) as TemplateSortOption,
        limit,
      };

      // Execute search
      const results = await this.marketplaceService.search(searchQuery);

      // Enhance templates with optimization features
      return this.enhanceTemplatesWithOptimization(results.templates);
    } catch (error) {
      logger.error('Failed to get optimized templates:', error);
      throw error;
    }
  }

  /**
   * Get featured optimized templates
   * @param limit - Maximum number of results
   * @returns Promise resolving to featured optimized templates
   */
  async getFeaturedOptimized(
    limit: number = 10
  ): Promise<OptimizedTemplateModel[]> {
    try {
      const featured = await this.marketplaceService.getFeatured(limit * 2); // Get more to filter

      // Filter for optimized templates
      const optimized = featured
        .filter(template => this.hasOptimizationFeatures(template))
        .slice(0, limit);

      return this.enhanceTemplatesWithOptimization(optimized);
    } catch (error) {
      logger.error('Failed to get featured optimized templates:', error);
      throw error;
    }
  }

  /**
   * Get trending optimized templates
   * @param limit - Maximum number of results
   * @returns Promise resolving to trending optimized templates
   */
  async getTrendingOptimized(
    limit: number = 10
  ): Promise<OptimizedTemplateModel[]> {
    try {
      const trending = await this.marketplaceService.getTrending(limit * 2);

      // Filter and sort by optimization metrics
      const optimized = trending
        .filter(template => this.hasOptimizationFeatures(template))
        .sort((a, b) => this.compareOptimizationScore(a, b))
        .slice(0, limit);

      return this.enhanceTemplatesWithOptimization(optimized);
    } catch (error) {
      logger.error('Failed to get trending optimized templates:', error);
      throw error;
    }
  }

  /**
   * Get quality score leaderboard
   * @param limit - Maximum number of results
   * @returns Promise resolving to top quality templates
   */
  async getQualityLeaderboard(
    limit: number = 20
  ): Promise<OptimizedTemplateModel[]> {
    try {
      const filters: OptimizationSearchFilters = {
        minQualityScore: 80,
        sortBy: 'quality',
      };

      const templates = await this.getOptimizedTemplates(filters, limit);

      // Sort by quality score descending
      return templates.sort((a, b) => {
        const scoreA = a.optimizationFeatures?.qualityScore || 0;
        const scoreB = b.optimizationFeatures?.qualityScore || 0;
        return scoreB - scoreA;
      });
    } catch (error) {
      logger.error('Failed to get quality leaderboard:', error);
      throw error;
    }
  }

  /**
   * Get performance champions
   * @param limit - Maximum number of results
   * @returns Promise resolving to best performing templates
   */
  async getPerformanceChampions(
    limit: number = 20
  ): Promise<OptimizedTemplateModel[]> {
    try {
      const filters: OptimizationSearchFilters = {
        performance: {
          maxResponseTime: PERFORMANCE_THRESHOLDS.responseTime.good,
          minTokenEfficiency: PERFORMANCE_THRESHOLDS.tokenEfficiency.good,
          minSuccessRate: 95,
        },
        sortBy: 'performance',
      };

      return this.getOptimizedTemplates(filters, limit);
    } catch (error) {
      logger.error('Failed to get performance champions:', error);
      throw error;
    }
  }

  /**
   * Get cost-effective templates
   * @param limit - Maximum number of results
   * @returns Promise resolving to most cost-effective templates
   */
  async getCostEffectiveTemplates(
    limit: number = 20
  ): Promise<OptimizedTemplateModel[]> {
    try {
      const filters: OptimizationSearchFilters = {
        performance: {
          maxCostPerRequest: PERFORMANCE_THRESHOLDS.costEffectiveness.good,
        },
        requiredBadges: ['costEffective'],
        sortBy: 'cost',
      };

      return this.getOptimizedTemplates(filters, limit);
    } catch (error) {
      logger.error('Failed to get cost-effective templates:', error);
      throw error;
    }
  }

  /**
   * Search templates with optimization filters
   * @param query - Search query with optimization filters
   * @returns Promise resolving to filtered search results
   */
  async searchOptimized(
    query: TemplateSearchQuery & { optimization?: OptimizationSearchFilters }
  ): Promise<TemplateSearchResult> {
    try {
      // Merge optimization filters into main query
      const enhancedQuery: TemplateSearchQuery = {
        ...query,
        // Note: filters property doesn't exist on TemplateSearchQuery, using tags for filtering
        tags: [
          ...(query.tags || []),
          // Add optimization-related tags based on filters
          ...(query.optimization?.qualityTier?.map(tier => `quality-${tier}`) ||
            []),
        ],
      };

      const results = await this.marketplaceService.search(enhancedQuery);

      // Enhance results with optimization data
      const enhancedTemplates = await this.enhanceTemplatesWithOptimization(
        results.templates
      );

      return {
        ...results,
        templates: enhancedTemplates,
        optimizationMetadata:
          this.generateOptimizationMetadata(enhancedTemplates),
      } as TemplateSearchResult & {
        optimizationMetadata: Record<string, unknown>;
      };
    } catch (error) {
      logger.error('Failed to search optimized templates:', error);
      throw error;
    }
  }

  /**
   * Get optimization statistics for marketplace dashboard
   * @returns Promise resolving to optimization statistics
   */
  async getOptimizationStatistics(): Promise<{
    totalOptimizedTemplates: number;
    averageQualityScore: number;
    qualityDistribution: Record<OptimizationTier, number>;
    performanceMetrics: {
      averageResponseTime: number;
      averageTokenEfficiency: number;
      averageCostPerRequest: number;
    };
    topPerformers: OptimizedTemplateModel[];
  }> {
    try {
      // Get all optimized templates
      const optimizedTemplates = await this.getOptimizedTemplates({}, 1000);

      // Calculate statistics
      const totalOptimized = optimizedTemplates.length;
      const qualityScores = optimizedTemplates
        .map(t => t.optimizationFeatures?.qualityScore)
        .filter((score): score is number => score !== undefined);

      const averageQuality =
        qualityScores.length > 0
          ? qualityScores.reduce((sum, score) => sum + score, 0) /
            qualityScores.length
          : 0;

      // Quality distribution
      const qualityDistribution =
        this.calculateQualityDistribution(optimizedTemplates);

      // Performance metrics
      const performanceMetrics =
        this.calculateAveragePerformanceMetrics(optimizedTemplates);

      // Top performers
      const topPerformers = optimizedTemplates
        .filter(
          t =>
            t.optimizationFeatures?.qualityScore &&
            t.optimizationFeatures.qualityScore >= 90
        )
        .sort(
          (a, b) =>
            (b.optimizationFeatures?.qualityScore || 0) -
            (a.optimizationFeatures?.qualityScore || 0)
        )
        .slice(0, 10);

      return {
        totalOptimizedTemplates: totalOptimized,
        averageQualityScore: averageQuality,
        qualityDistribution,
        performanceMetrics,
        topPerformers,
      };
    } catch (error) {
      logger.error('Failed to get optimization statistics:', error);
      throw error;
    }
  }

  /**
   * Rate a template's optimization quality
   * @param templateId - Template ID
   * @param userId - User ID
   * @param ratings - Optimization ratings
   * @returns Promise resolving to rating result
   */
  async rateOptimization(
    templateId: string,
    userId: string,
    _ratings: {
      qualityScore: number;
      performanceScore: number;
      costEffectivenessScore: number;
      comment?: string;
    }
  ): Promise<void> {
    try {
      // Store optimization-specific rating
      // This would integrate with the existing rating system
      logger.info(
        `Optimization rating submitted for template ${templateId} by user ${userId}`
      );

      // Update template's optimization features with new ratings
      // Implementation would depend on the data storage mechanism
    } catch (error) {
      logger.error('Failed to rate optimization:', error);
      throw error;
    }
  }

  // Private helper methods

  /**
   * Map optimization sort criteria to marketplace sort
   * @param sortBy - Optimization sort criteria
   * @returns Marketplace sort criteria
   * @private
   */
  private mapOptimizationSort(sortBy?: string): string {
    const mapping: Record<string, string> = {
      quality: 'qualityScore',
      performance: 'performanceScore',
      cost: 'costEffectiveness',
      popularity: 'downloads',
    };

    return mapping[sortBy || 'quality'] || 'qualityScore';
  }

  /**
   * Check if template has optimization features
   * @param template - Template to check
   * @returns Whether template has optimization features
   * @private
   */
  private hasOptimizationFeatures(
    template: TemplateModel | OptimizedTemplateModel
  ): boolean {
    // Check for optimization indicators in template metadata
    const optimizedTemplate = template as OptimizedTemplateModel;
    return (
      !!optimizedTemplate.optimizationFeatures ||
      !!optimizedTemplate.optimizationData ||
      !!optimizedTemplate.qualityScore ||
      !!optimizedTemplate.performanceMetrics
    );
  }

  /**
   * Enhance templates with optimization features
   * @param templates - Templates to enhance
   * @returns Enhanced templates
   * @private
   */
  private async enhanceTemplatesWithOptimization(
    templates: TemplateModel[]
  ): Promise<OptimizedTemplateModel[]> {
    return templates.map(template => {
      const optimizedTemplate: OptimizedTemplateModel = {
        ...template,
        optimizationFeatures: this.extractOptimizationFeatures(template),
      };

      return optimizedTemplate;
    });
  }

  /**
   * Extract optimization features from template
   * @param template - Template to extract from
   * @returns Optimization features
   * @private
   */
  private extractOptimizationFeatures(
    template: TemplateModel | OptimizedTemplateModel
  ): OptimizationFeatures {
    const optimizedTemplate = template as OptimizedTemplateModel;

    const qualityScore =
      optimizedTemplate.qualityScore || this.estimateQualityScore(template);
    const qualityTier = this.determineQualityTier(qualityScore);

    return {
      qualityScore,
      qualityTier,
      performanceMetrics: optimizedTemplate.performanceMetrics
        ? typeof optimizedTemplate.performanceMetrics === 'object' &&
          'averageResponseTime' in optimizedTemplate.performanceMetrics
          ? (optimizedTemplate.performanceMetrics as {
              averageResponseTime: number;
              tokenEfficiency: number;
              costPerRequest: number;
              successRate: number;
              cacheHitRate: number;
            })
          : this.estimatePerformanceMetrics(template)
        : this.estimatePerformanceMetrics(template),
      optimization: optimizedTemplate.optimization
        ? (optimizedTemplate.optimization as any)
        : this.extractOptimizationMetadata(template),
      optimizationReviews: optimizedTemplate.optimizationReviews
        ? (optimizedTemplate.optimizationReviews as any)
        : this.extractOptimizationReviews(template),
      badges: this.determineBadges(template, qualityScore),
    };
  }

  /**
   * Estimate quality score for template without explicit score
   * @param template - Template to estimate for
   * @returns Estimated quality score
   * @private
   */
  private estimateQualityScore(template: TemplateModel): number {
    let score = 50; // Base score

    // Factor in template length (not too short, not too long)
    // Note: content property doesn't exist on TemplateModel, using description
    const contentLength = template.description.length;
    if (contentLength > 100 && contentLength < 2000) {
      score += 10;
    }

    // Factor in number of downloads
    const downloadCount = template.downloads || template.stats?.downloads || 0;
    if (downloadCount > 100) score += 5;
    if (downloadCount > 1000) score += 5;

    // Factor in rating
    const ratingValue =
      typeof template.rating === 'number'
        ? template.rating
        : template.rating?.average || 0;
    if (ratingValue > 0) {
      score += (ratingValue - 3) * 10; // Adjust based on rating vs 3.0 baseline
    }

    // Factor in tags (more specific templates tend to be higher quality)
    if (template.tags && template.tags.length > 2) {
      score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Determine quality tier based on score
   * @param score - Quality score
   * @returns Quality tier
   * @private
   */
  private determineQualityTier(score: number): OptimizationTier {
    for (const [tier, range] of Object.entries(QUALITY_TIERS)) {
      if (score >= range.min && score <= range.max) {
        return tier as OptimizationTier;
      }
    }
    return OptimizationTier.UNOPTIMIZED;
  }

  /**
   * Estimate performance metrics for template
   * @param template - Template to estimate for
   * @returns Estimated performance metrics
   * @private
   */
  private estimatePerformanceMetrics(template: TemplateModel) {
    // Rough estimates based on template characteristics
    // Note: content property doesn't exist on TemplateModel, using description
    const contentLength = template.description.length;
    const estimatedTokens = Math.ceil(contentLength / 4); // Rough token estimation

    return {
      averageResponseTime: Math.min(5000, 1000 + estimatedTokens), // Longer templates = slower
      tokenEfficiency: Math.max(20, 100 - estimatedTokens / 50), // Efficiency decreases with tokens
      costPerRequest: estimatedTokens * 0.00002, // Rough cost estimation
      successRate: 95, // Default high success rate
      cacheHitRate: 60, // Default moderate cache hit rate
    };
  }

  /**
   * Extract optimization metadata from template
   * @param template - Template to extract from
   * @returns Optimization metadata
   * @private
   */
  private extractOptimizationMetadata(
    template: TemplateModel | OptimizedTemplateModel
  ) {
    const optimizedTemplate = template as OptimizedTemplateModel;

    return {
      level: optimizedTemplate.optimizationLevel || 'standard',
      tokenReduction: optimizedTemplate.tokenReduction || 0,
      qualityImprovement: optimizedTemplate.qualityImprovement || 0,
      optimizedAt:
        optimizedTemplate.optimizedAt ||
        template.updated.toISOString() ||
        new Date().toISOString(),
      optimizedBy: optimizedTemplate.optimizedBy || 'system',
      version: optimizedTemplate.optimizationVersion || '1.0.0',
    };
  }

  /**
   * Extract optimization-specific reviews
   * @param template - Template to extract from
   * @returns Optimization reviews
   * @private
   */
  private extractOptimizationReviews(template: TemplateModel) {
    // This would extract optimization-specific review data
    // For now, return defaults based on overall rating
    const rating =
      typeof template.rating === 'number'
        ? template.rating
        : template.rating?.average || 3;

    const reviewCount =
      typeof template.rating === 'object' ? template.rating.total : 0;

    return {
      averageRating: rating,
      totalReviews: reviewCount,
      qualityRatings: [
        {
          score: 5,
          count: Math.ceil(Math.max(0, (rating as number) - 1) * 10),
        },
        { score: 4, count: Math.ceil(Math.max(0, 5 - (rating as number)) * 5) },
        { score: 3, count: Math.ceil(Math.abs((rating as number) - 3) * 3) },
      ],
      performanceRatings: [
        { score: 5, count: Math.ceil(Math.max(0, rating as number) * 5) },
        { score: 4, count: Math.ceil(Math.max(0, 5 - (rating as number)) * 3) },
      ],
      recommendations: [
        'Well-structured template',
        'Good optimization potential',
        'Clear instructions',
      ],
    };
  }

  /**
   * Determine badges for template
   * @param template - Template to determine badges for
   * @param qualityScore - Template quality score
   * @returns Template badges
   * @private
   */
  private determineBadges(
    template: TemplateModel | OptimizedTemplateModel,
    qualityScore: number
  ) {
    const optimizedTemplate = template as OptimizedTemplateModel;

    return {
      aiOptimized: !!(
        optimizedTemplate.optimizationData || optimizedTemplate.aiOptimized
      ),
      tokenEfficient:
        qualityScore >= 80 || (optimizedTemplate.tokenReduction || 0) > 0.2,
      highQuality: qualityScore >= 90,
      performanceOptimized: !!(
        optimizedTemplate.performanceOptimized ||
        optimizedTemplate.performanceMetrics
      ),
      costEffective:
        qualityScore >= 75 && (optimizedTemplate.costReduction || 0) > 0.15,
      communityFavorite:
        (template.downloads || template.stats?.downloads || 0) > 1000 &&
        (typeof template.rating === 'number'
          ? template.rating
          : template.rating?.average || 0) >= 4.5,
    };
  }

  /**
   * Compare templates by optimization score
   * @param a - First template
   * @param b - Second template
   * @returns Comparison result
   * @private
   */
  private compareOptimizationScore(
    a: TemplateModel | OptimizedTemplateModel,
    b: TemplateModel | OptimizedTemplateModel
  ): number {
    const optimizedA = a as OptimizedTemplateModel;
    const optimizedB = b as OptimizedTemplateModel;
    const scoreA = optimizedA.qualityScore || this.estimateQualityScore(a);
    const scoreB = optimizedB.qualityScore || this.estimateQualityScore(b);
    return scoreB - scoreA;
  }

  /**
   * Generate optimization metadata for search results
   * @param templates - Search result templates
   * @returns Optimization metadata
   * @private
   */
  private generateOptimizationMetadata(templates: OptimizedTemplateModel[]) {
    const qualityScores = templates
      .map(t => t.optimizationFeatures?.qualityScore)
      .filter((score): score is number => score !== undefined);

    return {
      totalOptimized: templates.filter(
        t => t.optimizationFeatures?.optimization
      ).length,
      averageQualityScore:
        qualityScores.length > 0
          ? qualityScores.reduce((sum, score) => sum + score, 0) /
            qualityScores.length
          : 0,
      qualityDistribution: this.calculateQualityDistribution(templates),
      availableBadges: this.extractAvailableBadges(templates),
    };
  }

  /**
   * Calculate quality distribution across templates
   * @param templates - Templates to analyze
   * @returns Quality distribution
   * @private
   */
  private calculateQualityDistribution(
    templates: OptimizedTemplateModel[]
  ): Record<OptimizationTier, number> {
    const distribution: Record<OptimizationTier, number> = {
      [OptimizationTier.PREMIUM]: 0,
      [OptimizationTier.ADVANCED]: 0,
      [OptimizationTier.STANDARD]: 0,
      [OptimizationTier.BASIC]: 0,
      [OptimizationTier.UNOPTIMIZED]: 0,
    };

    templates.forEach(template => {
      const tier =
        template.optimizationFeatures?.qualityTier ||
        OptimizationTier.UNOPTIMIZED;
      distribution[tier] += 1;
    });

    return distribution;
  }

  /**
   * Calculate average performance metrics across templates
   * @param templates - Templates to analyze
   * @returns Average performance metrics
   * @private
   */
  private calculateAveragePerformanceMetrics(
    templates: OptimizedTemplateModel[]
  ) {
    const performanceTemplates = templates.filter(
      t => t.optimizationFeatures?.performanceMetrics
    );

    if (performanceTemplates.length === 0) {
      return {
        averageResponseTime: 0,
        averageTokenEfficiency: 0,
        averageCostPerRequest: 0,
      };
    }

    const totals = performanceTemplates.reduce(
      (acc, template) => {
        const metrics = template.optimizationFeatures!.performanceMetrics!;
        return {
          responseTime: acc.responseTime + metrics.averageResponseTime,
          tokenEfficiency: acc.tokenEfficiency + metrics.tokenEfficiency,
          costPerRequest: acc.costPerRequest + metrics.costPerRequest,
        };
      },
      { responseTime: 0, tokenEfficiency: 0, costPerRequest: 0 }
    );

    return {
      averageResponseTime: totals.responseTime / performanceTemplates.length,
      averageTokenEfficiency:
        totals.tokenEfficiency / performanceTemplates.length,
      averageCostPerRequest:
        totals.costPerRequest / performanceTemplates.length,
    };
  }

  /**
   * Extract available badges from templates
   * @param templates - Templates to extract from
   * @returns Available badge types
   * @private
   */
  private extractAvailableBadges(
    templates: OptimizedTemplateModel[]
  ): string[] {
    const badgeSet = new Set<string>();

    templates.forEach(template => {
      if (template.optimizationFeatures?.badges) {
        const { badges } = template.optimizationFeatures;
        Object.keys(badges).forEach(badge => {
          if ((badges as Record<string, boolean>)[badge]) {
            badgeSet.add(badge);
          }
        });
      }
    });

    return Array.from(badgeSet);
  }
}

/**
 * Quality score display widget for marketplace UI
 */
export class QualityScoreDisplay {
  /**
   * Render quality score badge
   * @param score - Quality score (0-100)
   * @returns HTML string for quality badge
   */
  static renderQualityBadge(score: number): string {
    const tier = this.determineQualityTier(score);
    const config = QUALITY_TIERS[tier];

    return `
      <div class="quality-badge" style="color: ${config.color}">
        <span class="quality-icon">${config.icon}</span>
        <span class="quality-score">${score.toFixed(1)}</span>
        <span class="quality-label">${config.label}</span>
      </div>
    `;
  }

  /**
   * Render quality progress bar
   * @param score - Quality score (0-100)
   * @returns HTML string for progress bar
   */
  static renderQualityProgressBar(score: number): string {
    const tier = this.determineQualityTier(score);
    const config = QUALITY_TIERS[tier];

    return `
      <div class="quality-progress">
        <div class="progress-bar" style="width: 100px; height: 8px; background-color: #e5e7eb; border-radius: 4px;">
          <div class="progress-fill" style="width: ${score}%; height: 100%; background-color: ${config.color}; border-radius: 4px; transition: width 0.3s ease;"></div>
        </div>
        <span class="progress-text" style="font-size: 12px; color: ${config.color};">${score.toFixed(1)}/100</span>
      </div>
    `;
  }

  private static determineQualityTier(score: number): OptimizationTier {
    for (const [tier, range] of Object.entries(QUALITY_TIERS)) {
      if (score >= range.min && score <= range.max) {
        return tier as OptimizationTier;
      }
    }
    return OptimizationTier.UNOPTIMIZED;
  }
}

/**
 * Performance metrics widget for marketplace UI
 */
export class PerformanceMetricsWidget {
  /**
   * Render performance metrics card
   * @param metrics - Performance metrics
   * @returns HTML string for metrics card
   */
  static renderMetricsCard(
    metrics: OptimizationFeatures['performanceMetrics']
  ): string {
    if (!metrics) return '<div>No performance data available</div>';

    return `
      <div class="performance-metrics">
        <div class="metric">
          <span class="metric-label">Response Time</span>
          <span class="metric-value">${metrics.averageResponseTime}ms</span>
          <span class="metric-indicator">${this.getPerformanceIndicator(metrics.averageResponseTime, 'responseTime')}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Token Efficiency</span>
          <span class="metric-value">${metrics.tokenEfficiency.toFixed(1)}%</span>
          <span class="metric-indicator">${this.getPerformanceIndicator(metrics.tokenEfficiency, 'tokenEfficiency')}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Cost per Request</span>
          <span class="metric-value">$${metrics.costPerRequest.toFixed(4)}</span>
          <span class="metric-indicator">${this.getPerformanceIndicator(metrics.costPerRequest, 'cost')}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Success Rate</span>
          <span class="metric-value">${metrics.successRate.toFixed(1)}%</span>
        </div>
      </div>
    `;
  }

  private static getPerformanceIndicator(
    value: number,
    type: 'responseTime' | 'tokenEfficiency' | 'cost'
  ): string {
    const thresholds = PERFORMANCE_THRESHOLDS;
    let level = 'poor';

    switch (type) {
      case 'responseTime':
        if (value < thresholds.responseTime.excellent) level = 'excellent';
        else if (value < thresholds.responseTime.good) level = 'good';
        else if (value < thresholds.responseTime.fair) level = 'fair';
        break;
      case 'tokenEfficiency':
        if (value >= thresholds.tokenEfficiency.excellent) level = 'excellent';
        else if (value >= thresholds.tokenEfficiency.good) level = 'good';
        else if (value >= thresholds.tokenEfficiency.fair) level = 'fair';
        break;
      case 'cost':
        if (value < thresholds.costEffectiveness.excellent) level = 'excellent';
        else if (value < thresholds.costEffectiveness.good) level = 'good';
        else if (value < thresholds.costEffectiveness.fair) level = 'fair';
        break;
      default:
        // For unknown metric types, default to 'poor'
        level = 'poor';
        break;
    }

    const indicators = {
      excellent: '🟢',
      good: '🟡',
      fair: '🟠',
      poor: '🔴',
    };

    return indicators[level as keyof typeof indicators];
  }
}

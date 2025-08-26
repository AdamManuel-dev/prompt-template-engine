/**
 * @fileoverview Marketplace Enhancer for PromptWizard Plugin
 * @lastmodified 2025-08-26T10:30:00Z
 *
 * Features: Marketplace listing enhancement with optimization data and quality scores
 * Main APIs: enhanceListing, addOptimizationBadge, addQualityMetrics
 * Constraints: Integrates with marketplace service for template listings
 * Patterns: Decorator pattern, metadata enrichment, UI enhancement
 */

class MarketplaceEnhancer {
  constructor(config = {}) {
    this.config = {
      showOptimizedBadge: true,
      displayQualityScore: true,
      enablePerformanceFilters: true,
      ...config.marketplaceIntegration || {}
    };

    // Quality score thresholds for badges
    this.qualityThresholds = {
      excellent: 90,
      good: 75,
      fair: 60,
      poor: 0
    };

    // Performance categories
    this.performanceCategories = {
      'lightning': { minScore: 90, icon: '⚡', description: 'Blazing fast' },
      'fast': { minScore: 75, icon: '🚀', description: 'Fast optimization' },
      'standard': { minScore: 60, icon: '📊', description: 'Standard performance' },
      'basic': { minScore: 0, icon: '📝', description: 'Basic optimization' }
    };

    // Optimization badges
    this.badges = {
      'ai_optimized': {
        label: 'AI Optimized',
        icon: '🤖',
        color: '#2563eb',
        description: 'Template optimized using AI-driven analysis'
      },
      'token_efficient': {
        label: 'Token Efficient',
        icon: '⚡',
        color: '#16a34a',
        description: 'Optimized for minimal token usage'
      },
      'high_quality': {
        label: 'High Quality',
        icon: '⭐',
        color: '#dc2626',
        description: 'Excellent quality score (90+)'
      },
      'performance_optimized': {
        label: 'Performance+',
        icon: '🚀',
        color: '#7c3aed',
        description: 'Optimized for fast response times'
      },
      'cost_effective': {
        label: 'Cost Effective',
        icon: '💰',
        color: '#059669',
        description: 'Optimized for cost efficiency'
      }
    };

    // Filter categories for marketplace
    this.filterCategories = {
      optimizationLevel: {
        label: 'Optimization Level',
        options: ['basic', 'standard', 'advanced', 'expert']
      },
      qualityScore: {
        label: 'Quality Score',
        options: ['90+', '75+', '60+', 'Any']
      },
      performance: {
        label: 'Performance',
        options: ['lightning', 'fast', 'standard', 'basic']
      },
      tokenEfficiency: {
        label: 'Token Efficiency',
        options: ['high', 'medium', 'standard']
      }
    };
  }

  /**
   * Enhance marketplace listing with optimization data
   * @param {Object} listing - Original marketplace listing
   * @param {Object} options - Enhancement options
   * @returns {Promise<Object>} Enhanced listing
   */
  async enhanceListing(listing, options = {}) {
    const enhancedListing = { ...listing };

    try {
      // Add optimization metadata if available
      if (listing.optimizationData) {
        await this.addOptimizationMetadata(enhancedListing, listing.optimizationData);
      }

      // Add quality score and badges
      if (this.config.displayQualityScore && listing.qualityScore !== undefined) {
        await this.addQualityMetrics(enhancedListing, listing.qualityScore);
      }

      // Add optimization badges
      if (this.config.showOptimizedBadge) {
        await this.addOptimizationBadges(enhancedListing, listing);
      }

      // Add performance metrics
      if (options.includePerformanceMetrics && listing.performanceMetrics) {
        await this.addPerformanceMetrics(enhancedListing, listing.performanceMetrics);
      }

      // Enhance search tags for filtering
      if (this.config.enablePerformanceFilters) {
        await this.addFilteringTags(enhancedListing, listing);
      }

      // Add marketplace-specific enhancements
      await this.addMarketplaceEnhancements(enhancedListing);

      return enhancedListing;
    } catch (error) {
      console.error('Failed to enhance marketplace listing:', error);
      return listing; // Return original on error
    }
  }

  /**
   * Add optimization metadata to listing
   * @param {Object} listing - Listing to enhance
   * @param {Object} optimizationData - Optimization data
   * @returns {Promise<void>}
   * @private
   */
  async addOptimizationMetadata(listing, optimizationData) {
    listing.optimization = {
      level: optimizationData.level || 'standard',
      timestamp: optimizationData.timestamp || new Date().toISOString(),
      version: optimizationData.version || '1.0.0',
      metrics: {
        tokenReduction: optimizationData.tokenReduction || 0,
        qualityImprovement: optimizationData.qualityImprovement || 0,
        performanceGain: optimizationData.performanceGain || 0
      },
      features: optimizationData.features || []
    };

    // Add optimization summary to description
    if (optimizationData.tokenReduction > 0) {
      const reductionPercent = Math.round(optimizationData.tokenReduction * 100);
      listing.optimizationSummary = `Optimized for ${reductionPercent}% token reduction`;
    }
  }

  /**
   * Add quality metrics to listing
   * @param {Object} listing - Listing to enhance
   * @param {number} qualityScore - Quality score (0-100)
   * @returns {Promise<void>}
   * @private
   */
  async addQualityMetrics(listing, qualityScore) {
    const qualityCategory = this.getQualityCategory(qualityScore);
    
    listing.quality = {
      score: Math.round(qualityScore * 10) / 10,
      category: qualityCategory,
      badge: this.getQualityBadge(qualityScore),
      description: this.getQualityDescription(qualityScore)
    };

    // Add quality indicator to tags
    if (!listing.tags) listing.tags = [];
    listing.tags.push(`quality-${qualityCategory}`);
  }

  /**
   * Add optimization badges to listing
   * @param {Object} listing - Listing to enhance
   * @param {Object} originalListing - Original listing data
   * @returns {Promise<void>}
   * @private
   */
  async addOptimizationBadges(listing, originalListing) {
    if (!listing.badges) listing.badges = [];

    // AI Optimized badge (always add for enhanced templates)
    listing.badges.push(this.badges.ai_optimized);

    // Token efficiency badge
    if (originalListing.optimizationData?.tokenReduction > 0.2) {
      listing.badges.push(this.badges.token_efficient);
    }

    // High quality badge
    if (originalListing.qualityScore >= this.qualityThresholds.excellent) {
      listing.badges.push(this.badges.high_quality);
    }

    // Performance badge
    if (originalListing.performanceMetrics?.performanceScore >= 80) {
      listing.badges.push(this.badges.performance_optimized);
    }

    // Cost effective badge
    if (originalListing.optimizationData?.costReduction > 0.15) {
      listing.badges.push(this.badges.cost_effective);
    }
  }

  /**
   * Add performance metrics to listing
   * @param {Object} listing - Listing to enhance
   * @param {Object} performanceMetrics - Performance metrics
   * @returns {Promise<void>}
   * @private
   */
  async addPerformanceMetrics(listing, performanceMetrics) {
    const performanceCategory = this.getPerformanceCategory(performanceMetrics.performanceScore);
    
    listing.performance = {
      score: Math.round(performanceMetrics.performanceScore * 10) / 10,
      category: performanceCategory.name,
      icon: performanceCategory.icon,
      description: performanceCategory.description,
      metrics: {
        averageResponseTime: performanceMetrics.averageResponseTime || 0,
        tokenEfficiency: this.calculateTokenEfficiency(performanceMetrics),
        cacheHitRate: performanceMetrics.cacheHitRate || 0,
        successRate: performanceMetrics.successRate || 100
      },
      lastMeasured: performanceMetrics.lastMeasured || new Date().toISOString()
    };

    // Add performance sorting metadata
    listing.sortingMetrics = {
      performance: performanceMetrics.performanceScore,
      responseTime: performanceMetrics.averageResponseTime,
      tokenEfficiency: this.calculateTokenEfficiency(performanceMetrics)
    };
  }

  /**
   * Add filtering tags for marketplace search
   * @param {Object} listing - Listing to enhance
   * @param {Object} originalListing - Original listing data
   * @returns {Promise<void>}
   * @private
   */
  async addFilteringTags(listing, originalListing) {
    if (!listing.filterTags) listing.filterTags = [];

    // Optimization level tags
    if (originalListing.optimizationData?.level) {
      listing.filterTags.push(`opt-${originalListing.optimizationData.level}`);
    }

    // Quality score range tags
    const qualityScore = originalListing.qualityScore;
    if (qualityScore !== undefined) {
      if (qualityScore >= 90) listing.filterTags.push('quality-90+');
      if (qualityScore >= 75) listing.filterTags.push('quality-75+');
      if (qualityScore >= 60) listing.filterTags.push('quality-60+');
    }

    // Performance tags
    if (originalListing.performanceMetrics?.performanceScore) {
      const perfCategory = this.getPerformanceCategory(originalListing.performanceMetrics.performanceScore);
      listing.filterTags.push(`perf-${perfCategory.name}`);
    }

    // Token efficiency tags
    if (originalListing.optimizationData?.tokenReduction) {
      const reduction = originalListing.optimizationData.tokenReduction;
      if (reduction > 0.3) listing.filterTags.push('tokens-high-efficiency');
      else if (reduction > 0.15) listing.filterTags.push('tokens-medium-efficiency');
      else if (reduction > 0) listing.filterTags.push('tokens-standard-efficiency');
    }

    // Feature tags
    if (originalListing.optimizationData?.features) {
      originalListing.optimizationData.features.forEach(feature => {
        listing.filterTags.push(`feature-${feature}`);
      });
    }
  }

  /**
   * Add general marketplace enhancements
   * @param {Object} listing - Listing to enhance
   * @returns {Promise<void>}
   * @private
   */
  async addMarketplaceEnhancements(listing) {
    // Add enhanced metadata for search and sorting
    listing.enhanced = {
      version: '1.0.0',
      enhancedAt: new Date().toISOString(),
      enhancedBy: 'promptwizard',
      features: [
        'ai-optimized',
        'quality-scored',
        'performance-tracked'
      ]
    };

    // Add marketplace display enhancements
    listing.display = {
      showQualityScore: this.config.displayQualityScore,
      showOptimizationBadge: this.config.showOptimizedBadge,
      showPerformanceMetrics: true,
      highlightOptimization: true
    };

    // Add recommendation score for marketplace algorithms
    listing.recommendationScore = this.calculateRecommendationScore(listing);
  }

  /**
   * Get quality category based on score
   * @param {number} score - Quality score (0-100)
   * @returns {string} Quality category
   * @private
   */
  getQualityCategory(score) {
    if (score >= this.qualityThresholds.excellent) return 'excellent';
    if (score >= this.qualityThresholds.good) return 'good';
    if (score >= this.qualityThresholds.fair) return 'fair';
    return 'poor';
  }

  /**
   * Get quality badge configuration
   * @param {number} score - Quality score (0-100)
   * @returns {Object} Badge configuration
   * @private
   */
  getQualityBadge(score) {
    if (score >= this.qualityThresholds.excellent) {
      return { icon: '⭐⭐⭐', color: '#dc2626', label: 'Excellent' };
    }
    if (score >= this.qualityThresholds.good) {
      return { icon: '⭐⭐', color: '#ea580c', label: 'Good' };
    }
    if (score >= this.qualityThresholds.fair) {
      return { icon: '⭐', color: '#ca8a04', label: 'Fair' };
    }
    return { icon: '📝', color: '#6b7280', label: 'Basic' };
  }

  /**
   * Get quality description
   * @param {number} score - Quality score (0-100)
   * @returns {string} Quality description
   * @private
   */
  getQualityDescription(score) {
    if (score >= this.qualityThresholds.excellent) {
      return 'Exceptional template with outstanding clarity and structure';
    }
    if (score >= this.qualityThresholds.good) {
      return 'High-quality template with clear instructions and good structure';
    }
    if (score >= this.qualityThresholds.fair) {
      return 'Decent template with room for improvement';
    }
    return 'Basic template that may need refinement';
  }

  /**
   * Get performance category based on score
   * @param {number} score - Performance score (0-100)
   * @returns {Object} Performance category
   * @private
   */
  getPerformanceCategory(score) {
    for (const [name, category] of Object.entries(this.performanceCategories)) {
      if (score >= category.minScore) {
        return { name, ...category };
      }
    }
    return { name: 'basic', ...this.performanceCategories.basic };
  }

  /**
   * Calculate token efficiency score
   * @param {Object} performanceMetrics - Performance metrics
   * @returns {number} Token efficiency score (0-100)
   * @private
   */
  calculateTokenEfficiency(performanceMetrics) {
    const avgTokens = performanceMetrics.averageTokenUsage || 1000;
    const avgTime = performanceMetrics.averageResponseTime || 2000;
    
    // Efficiency is inversely related to tokens and time
    const tokenEfficiency = Math.max(0, 100 - (avgTokens / 20));
    const timeEfficiency = Math.max(0, 100 - (avgTime / 50));
    
    return (tokenEfficiency + timeEfficiency) / 2;
  }

  /**
   * Calculate recommendation score for marketplace algorithms
   * @param {Object} listing - Enhanced listing
   * @returns {number} Recommendation score (0-100)
   * @private
   */
  calculateRecommendationScore(listing) {
    let score = 50; // Base score
    
    // Quality bonus
    if (listing.quality?.score) {
      score += listing.quality.score * 0.3;
    }
    
    // Performance bonus
    if (listing.performance?.score) {
      score += listing.performance.score * 0.2;
    }
    
    // Optimization bonus
    if (listing.optimization?.metrics?.tokenReduction) {
      score += listing.optimization.metrics.tokenReduction * 20;
    }
    
    // Badge bonus
    if (listing.badges) {
      score += listing.badges.length * 2;
    }
    
    // Features bonus
    if (listing.optimization?.features) {
      score += listing.optimization.features.length;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Create filter options for marketplace UI
   * @returns {Object} Filter options configuration
   */
  createFilterOptions() {
    return {
      categories: this.filterCategories,
      badges: Object.keys(this.badges),
      qualityThresholds: Object.keys(this.qualityThresholds),
      performanceCategories: Object.keys(this.performanceCategories)
    };
  }

  /**
   * Generate marketplace search enhancements
   * @param {Object} searchQuery - Search query
   * @returns {Object} Enhanced search query
   */
  enhanceSearchQuery(searchQuery) {
    const enhanced = { ...searchQuery };

    // Add optimization filters if present
    if (searchQuery.optimizationLevel) {
      enhanced.filterTags = [
        ...(enhanced.filterTags || []),
        `opt-${searchQuery.optimizationLevel}`
      ];
    }

    if (searchQuery.qualityMin) {
      enhanced.filterTags = [
        ...(enhanced.filterTags || []),
        `quality-${searchQuery.qualityMin}+`
      ];
    }

    if (searchQuery.performanceCategory) {
      enhanced.filterTags = [
        ...(enhanced.filterTags || []),
        `perf-${searchQuery.performanceCategory}`
      ];
    }

    // Add sorting preferences
    if (searchQuery.sortBy === 'optimization') {
      enhanced.sortBy = 'recommendationScore';
      enhanced.sortOrder = 'desc';
    }

    return enhanced;
  }

  /**
   * Generate optimization statistics for marketplace dashboard
   * @param {Array<Object>} listings - Array of listings
   * @returns {Object} Optimization statistics
   */
  generateOptimizationStatistics(listings) {
    const optimizedListings = listings.filter(l => l.optimization);
    
    if (optimizedListings.length === 0) {
      return {
        totalListings: listings.length,
        optimizedListings: 0,
        optimizationRate: 0,
        averageQualityScore: 0,
        averageTokenReduction: 0,
        topPerformers: []
      };
    }

    const qualityScores = optimizedListings
      .filter(l => l.quality?.score)
      .map(l => l.quality.score);
    
    const tokenReductions = optimizedListings
      .filter(l => l.optimization?.metrics?.tokenReduction)
      .map(l => l.optimization.metrics.tokenReduction);

    const topPerformers = optimizedListings
      .filter(l => l.recommendationScore >= 80)
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 10)
      .map(l => ({
        id: l.id,
        name: l.name,
        score: l.recommendationScore,
        qualityScore: l.quality?.score,
        badges: l.badges?.map(b => b.label) || []
      }));

    return {
      totalListings: listings.length,
      optimizedListings: optimizedListings.length,
      optimizationRate: (optimizedListings.length / listings.length) * 100,
      averageQualityScore: qualityScores.length > 0 
        ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length 
        : 0,
      averageTokenReduction: tokenReductions.length > 0
        ? tokenReductions.reduce((sum, reduction) => sum + reduction, 0) / tokenReductions.length
        : 0,
      topPerformers,
      qualityDistribution: this.calculateQualityDistribution(qualityScores),
      badges: this.calculateBadgeDistribution(optimizedListings)
    };
  }

  /**
   * Calculate quality score distribution
   * @param {Array<number>} qualityScores - Quality scores
   * @returns {Object} Quality distribution
   * @private
   */
  calculateQualityDistribution(qualityScores) {
    const distribution = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0
    };

    qualityScores.forEach(score => {
      const category = this.getQualityCategory(score);
      distribution[category]++;
    });

    return distribution;
  }

  /**
   * Calculate badge distribution
   * @param {Array<Object>} listings - Optimized listings
   * @returns {Object} Badge distribution
   * @private
   */
  calculateBadgeDistribution(listings) {
    const distribution = {};

    listings.forEach(listing => {
      if (listing.badges) {
        listing.badges.forEach(badge => {
          const label = badge.label || badge;
          distribution[label] = (distribution[label] || 0) + 1;
        });
      }
    });

    return distribution;
  }
}

module.exports = MarketplaceEnhancer;
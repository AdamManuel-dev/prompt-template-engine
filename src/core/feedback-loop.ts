/**
 * @fileoverview Feedback loop mechanism for continuous prompt optimization improvement
 * @lastmodified 2025-08-26T15:20:00Z
 *
 * Features: User feedback collection, performance tracking, automated re-optimization
 * Main APIs: FeedbackLoop.collectFeedback(), trackPerformance(), triggerReoptimization()
 * Constraints: Requires analytics service and optimization pipeline
 * Patterns: Observer pattern, feedback collection, continuous improvement
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { Template } from '../types/index';
import { OptimizationPipeline } from './optimization-pipeline';
import { CacheService } from '../services/cache.service';

export interface UserFeedback {
  id: string;
  templateId: string;
  optimizationId?: string;
  userId?: string;
  timestamp: Date;
  rating: number; // 1-5 scale
  category:
    | 'accuracy'
    | 'relevance'
    | 'clarity'
    | 'completeness'
    | 'efficiency';
  comment?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceMetric {
  templateId: string;
  optimizationId?: string;
  timestamp: Date;
  metricType:
    | 'response_time'
    | 'token_usage'
    | 'accuracy_score'
    | 'user_satisfaction'
    | 'error_rate';
  value: number;
  context?: Record<string, any>;
}

export interface FeedbackSummary {
  templateId: string;
  totalFeedback: number;
  averageRating: number;
  ratingsByCategory: Record<string, number>;
  recentTrend: 'improving' | 'declining' | 'stable';
  lastOptimization?: Date;
  recommendReoptimization: boolean;
}

export interface ReoptimizationTrigger {
  templateId: string;
  reason:
    | 'poor_feedback'
    | 'performance_decline'
    | 'usage_pattern_change'
    | 'scheduled_review';
  severity: 'low' | 'medium' | 'high';
  metrics: Record<string, any>;
  timestamp: Date;
}

export interface FeedbackLoopConfig {
  enableAutoReoptimization: boolean;
  feedbackThreshold: number; // Minimum feedback count for re-optimization
  ratingThreshold: number; // Rating below which triggers re-optimization
  performanceThreshold: number; // Performance decline threshold
  reoptimizationCooldown: number; // Minimum time between re-optimizations (ms)
  enableScheduledReviews: boolean;
  reviewInterval: number; // Scheduled review interval (ms)
}

export class FeedbackLoop extends EventEmitter {
  private optimizationPipeline: OptimizationPipeline;

  private cacheService: CacheService;

  private config: FeedbackLoopConfig;

  private feedback: Map<string, UserFeedback[]> = new Map();

  private performanceMetrics: Map<string, PerformanceMetric[]> = new Map();

  private reoptimizationHistory: Map<string, Date[]> = new Map();

  constructor(
    optimizationPipeline: OptimizationPipeline,
    cacheService: CacheService,
    config: Partial<FeedbackLoopConfig> = {}
  ) {
    super();

    this.optimizationPipeline = optimizationPipeline;
    this.cacheService = cacheService;
    this.config = {
      enableAutoReoptimization: false,
      feedbackThreshold: 10,
      ratingThreshold: 3.0,
      performanceThreshold: 0.8,
      reoptimizationCooldown: 24 * 60 * 60 * 1000, // 24 hours
      enableScheduledReviews: true,
      reviewInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...config,
    };

    // Set up scheduled reviews if enabled
    if (this.config.enableScheduledReviews) {
      this.setupScheduledReviews();
    }

    // Load existing feedback and metrics from cache
    this.initializeFromCache();
  }

  /**
   * Collect user feedback for a template optimization
   */
  async collectFeedback(
    feedback: Omit<UserFeedback, 'id' | 'timestamp'>
  ): Promise<UserFeedback> {
    const completeFeedback: UserFeedback = {
      id: this.generateFeedbackId(),
      timestamp: new Date(),
      ...feedback,
    };

    // Store feedback
    if (!this.feedback.has(feedback.templateId)) {
      this.feedback.set(feedback.templateId, []);
    }
    this.feedback.get(feedback.templateId)!.push(completeFeedback);

    // Cache feedback
    await this.cacheFeedback(completeFeedback);

    // Emit feedback event
    this.emit('feedback:collected', completeFeedback);

    logger.info(
      `User feedback collected for template ${feedback.templateId} with rating ${feedback.rating} in category ${feedback.category}`
    );

    // Check if re-optimization should be triggered
    await this.evaluateReoptimizationNeed(feedback.templateId);

    return completeFeedback;
  }

  /**
   * Track performance metrics for templates
   */
  async trackPerformance(
    metric: Omit<PerformanceMetric, 'timestamp'>
  ): Promise<void> {
    const completeMetric: PerformanceMetric = {
      timestamp: new Date(),
      ...metric,
    };

    // Store metric
    if (!this.performanceMetrics.has(metric.templateId)) {
      this.performanceMetrics.set(metric.templateId, []);
    }
    this.performanceMetrics.get(metric.templateId)!.push(completeMetric);

    // Cache metric
    await this.cachePerformanceMetric(completeMetric);

    // Emit performance event
    this.emit('performance:tracked', completeMetric);

    logger.debug(
      `Performance metric tracked for template ${metric.templateId}: ${metric.metricType} = ${metric.value}`
    );

    // Check for performance degradation
    await this.evaluatePerformanceTrend(metric.templateId);
  }

  /**
   * Get feedback summary for a template
   */
  getFeedbackSummary(templateId: string): FeedbackSummary {
    const templateFeedback = this.feedback.get(templateId) || [];

    if (templateFeedback.length === 0) {
      return {
        templateId,
        totalFeedback: 0,
        averageRating: 0,
        ratingsByCategory: {},
        recentTrend: 'stable',
        recommendReoptimization: false,
      };
    }

    // Calculate average rating
    const averageRating =
      templateFeedback.reduce((sum, fb) => sum + fb.rating, 0) /
      templateFeedback.length;

    // Group ratings by category
    const ratingsByCategory: Record<string, number> = {};
    const categoryGroups = templateFeedback.reduce(
      (groups, fb) => {
        if (!groups[fb.category]) groups[fb.category] = [];
        groups[fb.category].push(fb.rating);
        return groups;
      },
      {} as Record<string, number[]>
    );

    Object.entries(categoryGroups).forEach(([category, ratings]) => {
      ratingsByCategory[category] =
        ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    });

    // Calculate recent trend
    const recentTrend = this.calculateFeedbackTrend(templateFeedback);

    // Get last optimization date
    const reoptimizationHistory =
      this.reoptimizationHistory.get(templateId) || [];
    const lastOptimization =
      reoptimizationHistory.length > 0
        ? reoptimizationHistory[reoptimizationHistory.length - 1]
        : undefined;

    // Determine if re-optimization is recommended
    const recommendReoptimization = this.shouldRecommendReoptimization(
      templateFeedback,
      averageRating,
      lastOptimization
    );

    return {
      templateId,
      totalFeedback: templateFeedback.length,
      averageRating,
      ratingsByCategory,
      recentTrend,
      lastOptimization,
      recommendReoptimization,
    };
  }

  /**
   * Evaluate if re-optimization is needed based on feedback
   */
  private async evaluateReoptimizationNeed(templateId: string): Promise<void> {
    const summary = this.getFeedbackSummary(templateId);

    // Check if we have enough feedback and it's below threshold
    if (
      summary.totalFeedback >= this.config.feedbackThreshold &&
      summary.averageRating < this.config.ratingThreshold
    ) {
      await this.triggerReoptimization(templateId, 'poor_feedback', 'medium', {
        averageRating: summary.averageRating,
        feedbackCount: summary.totalFeedback,
        trend: summary.recentTrend,
      });
    }
  }

  /**
   * Evaluate performance trends
   */
  private async evaluatePerformanceTrend(templateId: string): Promise<void> {
    const metrics = this.performanceMetrics.get(templateId) || [];

    if (metrics.length < 10) return; // Need enough data points

    // Analyze recent performance vs. historical average
    const recent = metrics.slice(-5);
    const historical = metrics.slice(0, -5);

    const recentAverage =
      recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
    const historicalAverage =
      historical.reduce((sum, m) => sum + m.value, 0) / historical.length;

    const performanceRatio = recentAverage / historicalAverage;

    if (performanceRatio < this.config.performanceThreshold) {
      await this.triggerReoptimization(
        templateId,
        'performance_decline',
        'high',
        {
          recentPerformance: recentAverage,
          historicalPerformance: historicalAverage,
          performanceRatio,
        }
      );
    }
  }

  /**
   * Trigger re-optimization for a template
   */
  async triggerReoptimization(
    templateId: string,
    reason: ReoptimizationTrigger['reason'],
    severity: ReoptimizationTrigger['severity'],
    metrics: Record<string, any>
  ): Promise<void> {
    // Check cooldown period
    if (!this.canReoptimize(templateId)) {
      logger.info(
        `Re-optimization skipped due to cooldown period for template ${templateId}`
      );
      return;
    }

    const trigger: ReoptimizationTrigger = {
      templateId,
      reason,
      severity,
      metrics,
      timestamp: new Date(),
    };

    this.emit('reoptimization:triggered', trigger);

    logger.info(
      `Re-optimization triggered for template ${templateId}: ${reason} (${severity})`
    );

    if (this.config.enableAutoReoptimization) {
      await this.performReoptimization(templateId, trigger);
    } else {
      // Just log the recommendation for manual review
      logger.info(
        `Re-optimization recommended (auto-reoptimization disabled) for template ${templateId}: ${trigger.reason}`
      );
    }
  }

  /**
   * Perform actual re-optimization
   */
  private async performReoptimization(
    templateId: string,
    trigger: ReoptimizationTrigger
  ): Promise<void> {
    try {
      // Get current template
      const template = await this.getTemplate(templateId);
      if (!template) {
        logger.error(`Template not found for re-optimization: ${templateId}`);
        return;
      }

      // Collect feedback insights for optimization
      const feedbackSummary = this.getFeedbackSummary(templateId);
      const optimizationHints = this.generateOptimizationHints(
        feedbackSummary,
        trigger
      );

      // Run optimization pipeline with feedback-informed parameters
      const result = await this.optimizationPipeline.process(
        templateId,
        template,
        {
          task: `Re-optimize based on user feedback: ${trigger.reason}`,
          // Custom optimization hints
          focusAreas: Object.keys(optimizationHints.targets),
          improvementTargets: Object.entries(optimizationHints.targets).map(
            ([k, v]) => `${k}: ${v}`
          ),
        }
      );

      if (result.success) {
        // Record re-optimization
        this.recordReoptimization(templateId);

        this.emit('reoptimization:completed', {
          templateId,
          trigger,
          result,
        });

        logger.info(
          `Re-optimization completed successfully for template ${templateId}: ${trigger.reason}`
        );
      } else {
        this.emit('reoptimization:failed', {
          templateId,
          trigger,
          error: result.error,
        });

        logger.error(
          `Re-optimization failed for template ${templateId}: ${result.error}`
        );
      }
    } catch (error) {
      logger.error(
        `Re-optimization process failed for template ${templateId}: ${error instanceof Error ? error.message : String(error)}`
      );

      this.emit('reoptimization:failed', {
        templateId,
        trigger,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate optimization hints based on feedback
   */
  private generateOptimizationHints(
    summary: FeedbackSummary,
    trigger: ReoptimizationTrigger
  ): { focusAreas: string[]; targets: Record<string, number> } {
    const focusAreas: string[] = [];
    const targets: Record<string, number> = {};

    // Analyze category ratings to identify focus areas
    Object.entries(summary.ratingsByCategory).forEach(([category, rating]) => {
      if (rating < this.config.ratingThreshold) {
        focusAreas.push(category);
        targets[category] = Math.max(
          rating + 1,
          this.config.ratingThreshold + 0.5
        );
      }
    });

    // Add performance-specific focus areas
    if (trigger.reason === 'performance_decline') {
      focusAreas.push('efficiency', 'accuracy');
      targets.efficiency = Math.max(
        trigger.metrics.performanceRatio + 0.2,
        0.9
      );
    }

    return { focusAreas, targets };
  }

  /**
   * Calculate feedback trend
   */
  private calculateFeedbackTrend(
    feedback: UserFeedback[]
  ): 'improving' | 'declining' | 'stable' {
    if (feedback.length < 6) return 'stable';

    const recent = feedback.slice(-3);
    const previous = feedback.slice(-6, -3);

    const recentAvg =
      recent.reduce((sum, fb) => sum + fb.rating, 0) / recent.length;
    const previousAvg =
      previous.reduce((sum, fb) => sum + fb.rating, 0) / previous.length;

    const improvement = recentAvg - previousAvg;

    if (improvement > 0.5) return 'improving';
    if (improvement < -0.5) return 'declining';
    return 'stable';
  }

  /**
   * Check if template should be recommended for re-optimization
   */
  private shouldRecommendReoptimization(
    feedback: UserFeedback[],
    averageRating: number,
    lastOptimization?: Date
  ): boolean {
    // Check if rating is below threshold
    if (averageRating < this.config.ratingThreshold) {
      return true;
    }

    // Check if enough time has passed since last optimization
    if (lastOptimization) {
      const timeSinceOptimization = Date.now() - lastOptimization.getTime();
      if (timeSinceOptimization < this.config.reoptimizationCooldown) {
        return false;
      }
    }

    // Check feedback trend
    const trend = this.calculateFeedbackTrend(feedback);
    return trend === 'declining';
  }

  /**
   * Check if template can be re-optimized (cooldown check)
   */
  private canReoptimize(templateId: string): boolean {
    const history = this.reoptimizationHistory.get(templateId);
    if (!history || history.length === 0) return true;

    const lastReoptimization = history[history.length - 1];
    const timeSinceLast = Date.now() - lastReoptimization.getTime();

    return timeSinceLast >= this.config.reoptimizationCooldown;
  }

  /**
   * Record re-optimization event
   */
  private recordReoptimization(templateId: string): void {
    if (!this.reoptimizationHistory.has(templateId)) {
      this.reoptimizationHistory.set(templateId, []);
    }
    this.reoptimizationHistory.get(templateId)!.push(new Date());
  }

  /**
   * Setup scheduled reviews
   */
  private setupScheduledReviews(): void {
    setInterval(async () => {
      await this.performScheduledReview();
    }, this.config.reviewInterval);
  }

  /**
   * Perform scheduled review of all templates
   */
  private async performScheduledReview(): Promise<void> {
    logger.info('Starting scheduled template review');

    for (const [templateId] of this.feedback) {
      try {
        const summary = this.getFeedbackSummary(templateId);

        if (summary.recommendReoptimization && this.canReoptimize(templateId)) {
          await this.triggerReoptimization(
            templateId,
            'scheduled_review',
            'low',
            {
              summary,
            }
          );
        }
      } catch (error) {
        logger.error(
          `Scheduled review failed for template ${templateId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Initialize from cache
   */
  private async initializeFromCache(): Promise<void> {
    try {
      // Load feedback from cache
      const cachedFeedback = await this.cacheService.get('feedback:all');
      if (cachedFeedback) {
        Object.entries(
          cachedFeedback as Record<string, UserFeedback[]>
        ).forEach(([templateId, feedback]) => {
          this.feedback.set(templateId, feedback);
        });
      }

      // Load performance metrics from cache
      const cachedMetrics = await this.cacheService.get('metrics:all');
      if (cachedMetrics) {
        Object.entries(
          cachedMetrics as Record<string, PerformanceMetric[]>
        ).forEach(([templateId, metrics]) => {
          this.performanceMetrics.set(templateId, metrics);
        });
      }
    } catch (error) {
      logger.warn(
        `Failed to initialize from cache: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Cache feedback
   */
  private async cacheFeedback(feedback: UserFeedback): Promise<void> {
    try {
      const cacheKey = `feedback:${feedback.templateId}`;
      const existing = (await this.cacheService.get(cacheKey)) || [];
      const updated = [...(existing as UserFeedback[]), feedback];
      await this.cacheService.set(cacheKey, updated);
    } catch (error) {
      logger.warn(
        `Failed to cache feedback: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Cache performance metric
   */
  private async cachePerformanceMetric(
    metric: PerformanceMetric
  ): Promise<void> {
    try {
      const cacheKey = `metrics:${metric.templateId}`;
      const existing = (await this.cacheService.get(cacheKey)) || [];
      const updated = [...(existing as PerformanceMetric[]), metric];
      await this.cacheService.set(cacheKey, updated);
    } catch (error) {
      logger.warn(
        `Failed to cache performance metric: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get template from template service or cache
   */
  private async getTemplate(templateId: string): Promise<Template | null> {
    try {
      // Try to get from cache first
      const cached = await this.cacheService.get(`template:${templateId}`);
      if (cached) {
        return cached as Template;
      }

      // If template service has a get method, use it
      // Note: TemplateService interface may need extension
      return null;
    } catch (error) {
      logger.error(
        `Failed to retrieve template ${templateId}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Generate unique feedback ID
   */
  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

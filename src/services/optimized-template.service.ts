/**
 * @fileoverview Extended template service with PromptWizard optimization support
 * @lastmodified 2025-08-26T16:40:00Z
 *
 * Features: Template optimization, version management, A/B testing, performance tracking
 * Main APIs: optimizeTemplate(), getOptimized(), compareTemplates(), trackPerformance()
 * Constraints: Extends existing TemplateService functionality
 * Patterns: Service extension, optimization pipeline integration
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { TemplateService, Template } from './template.service';
import { CacheService } from './cache.service';
import { OptimizationPipeline } from '../core/optimization-pipeline';
import { OptimizationQueue } from '../queues/optimization-queue';
import { OptimizationCacheService } from './optimization-cache.service';
import { FeedbackLoop } from '../core/feedback-loop';
import { getPromptWizardConfig } from '../config/promptwizard.config';
import {
  OptimizedTemplate,
  OptimizationMetrics,
  OptimizationHistory,
  OptimizationContext,
  TemplateComparison,
  OptimizationJob,
  OptimizationBatch,
  OptimizationReport,
  OptimizationSettings,
} from '../types/optimized-template.types';
import {
  OptimizationRequest,
  OptimizationResult,
} from '../integrations/promptwizard/types';

export interface OptimizedTemplateServiceConfig {
  enableOptimization: boolean;
  autoOptimizeNewTemplates: boolean;
  enableFeedbackLoop: boolean;
  enableABTesting: boolean;
  optimizationCacheTTL: number;
  maxOptimizationHistory: number;
  defaultOptimizationContext: Partial<OptimizationContext>;
}

export class OptimizedTemplateService extends EventEmitter {
  private templateService: TemplateService;

  private optimizationPipeline: OptimizationPipeline;

  private optimizationQueue: OptimizationQueue;

  private optimizationCache: OptimizationCacheService;

  private feedbackLoop: FeedbackLoop;

  private optimizedTemplateCache: CacheService<OptimizedTemplate>;

  private config: OptimizedTemplateServiceConfig;

  private settings: OptimizationSettings;

  constructor(
    templateService: TemplateService,
    optimizationPipeline: OptimizationPipeline,
    optimizationQueue: OptimizationQueue,
    optimizationCache: OptimizationCacheService,
    feedbackLoop: FeedbackLoop,
    config: Partial<OptimizedTemplateServiceConfig> = {}
  ) {
    super();

    this.templateService = templateService;
    this.optimizationPipeline = optimizationPipeline;
    this.optimizationQueue = optimizationQueue;
    this.optimizationCache = optimizationCache;
    this.feedbackLoop = feedbackLoop;

    this.config = {
      enableOptimization: true,
      autoOptimizeNewTemplates: false,
      enableFeedbackLoop: true,
      enableABTesting: false,
      optimizationCacheTTL: 24 * 60 * 60 * 1000, // 24 hours
      maxOptimizationHistory: 10,
      defaultOptimizationContext: {},
      ...config,
    };

    this.optimizedTemplateCache = new CacheService<OptimizedTemplate>({
      maxSize: 100,
      maxAge: this.config.optimizationCacheTTL,
    });

    // Load optimization settings
    this.settings = this.loadOptimizationSettings();

    // Set up event listeners
    this.setupEventListeners();

    logger.info(`Optimized template service initialized - ${JSON.stringify({
      optimizationEnabled: this.config.enableOptimization,
      autoOptimize: this.config.autoOptimizeNewTemplates,
      feedbackLoop: this.config.enableFeedbackLoop,
    })}`);
  }

  /**
   * Optimize a template using PromptWizard
   */
  async optimizeTemplate(
    templateId: string,
    context?: Partial<OptimizationContext>,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      async?: boolean;
      forceReoptimization?: boolean;
    } = {}
  ): Promise<OptimizedTemplate | OptimizationJob> {
    if (!this.config.enableOptimization) {
      throw new Error('Template optimization is disabled');
    }

    // Load the original template
    const template = await this.templateService.loadTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Check if optimization is needed
    if (!options.forceReoptimization) {
      const existingOptimized = await this.getOptimizedTemplate(templateId);
      if (
        existingOptimized &&
        this.shouldUseExistingOptimization(existingOptimized)
      ) {
        logger.info(`Using existing optimized template - ${JSON.stringify({ templateId })}`);
        return existingOptimized;
      }
    }

    // Prepare optimization context
    const optimizationContext: OptimizationContext = {
      targetModel: this.settings.global.defaultModel,
      task: template.description || 'Optimize template for better performance',
      constraints: {
        maxLength: 10000,
        preserveVariables: true,
        maintainStructure: true,
      },
      ...this.config.defaultOptimizationContext,
      ...context,
    };

    // Convert to optimization request
    const optimizationRequest: OptimizationRequest = {
      task: optimizationContext.task,
      prompt: template.files[0]?.content || '',
      targetModel: optimizationContext.targetModel,
      mutateRefineIterations: 3,
      fewShotCount: 5,
      generateReasoning: true,
      constraints: optimizationContext.constraints || {},
    };

    if (options.async) {
      // Add to optimization queue
      const job = await this.optimizationQueue.addJob(
        templateId,
        template,
        optimizationRequest,
        {
          priority: options.priority || 'normal',
          metadata: { context: optimizationContext },
        }
      );

      this.emit('optimization:queued', { templateId, jobId: job.jobId });
      return job;
    }
    // Process immediately
    const result = await this.optimizationPipeline.process(
      templateId,
      template,
      optimizationRequest
    );

    if (result.success && result.optimizationResult) {
      const optimizedTemplate = await this.createOptimizedTemplate(
        template,
        result.optimizationResult,
        optimizationContext
      );

      await this.saveOptimizedTemplate(optimizedTemplate);
      this.emit('optimization:completed', { templateId, optimizedTemplate });

      return optimizedTemplate;
    }
    throw new Error(`Optimization failed: ${result.error}`);
  }

  /**
   * Get optimized version of a template
   */
  async getOptimizedTemplate(
    templateId: string
  ): Promise<OptimizedTemplate | null> {
    // Try cache first
    const cached = this.optimizedTemplateCache.get(templateId);
    if (cached) {
      return cached;
    }

    // Try to load from disk
    try {
      const optimizedTemplate =
        await this.loadOptimizedTemplateFromDisk(templateId);
      if (optimizedTemplate) {
        this.optimizedTemplateCache.set(templateId, optimizedTemplate);
        return optimizedTemplate;
      }
    } catch (error) {
      logger.debug(`No optimized template found on disk - ${JSON.stringify({ templateId })}`);
    }

    return null;
  }

  /**
   * Compare original and optimized templates
   */
  async compareTemplates(
    templateId: string
  ): Promise<TemplateComparison | null> {
    const original = await this.templateService.loadTemplate(templateId);
    const optimized = await this.getOptimizedTemplate(templateId);

    if (!original || !optimized) {
      return null;
    }

    return this.generateTemplateComparison(original, optimized);
  }

  /**
   * Track performance metrics for a template
   */
  async trackPerformance(
    templateId: string,
    metrics: {
      responseTime?: number;
      tokenUsage?: number;
      userRating?: number;
      errorRate?: number;
      successRate?: number;
    }
  ): Promise<void> {
    if (!this.config.enableFeedbackLoop) {
      return;
    }

    // Track each metric
    if (metrics.responseTime !== undefined) {
      await this.feedbackLoop.trackPerformance({
        templateId,
        metricType: 'response_time',
        value: metrics.responseTime,
      });
    }

    if (metrics.tokenUsage !== undefined) {
      await this.feedbackLoop.trackPerformance({
        templateId,
        metricType: 'token_usage',
        value: metrics.tokenUsage,
      });
    }

    if (metrics.userRating !== undefined) {
      await this.feedbackLoop.collectFeedback({
        templateId,
        rating: metrics.userRating,
        category: 'accuracy',
      });
    }

    if (metrics.errorRate !== undefined) {
      await this.feedbackLoop.trackPerformance({
        templateId,
        metricType: 'error_rate',
        value: metrics.errorRate,
      });
    }

    if (metrics.successRate !== undefined) {
      await this.feedbackLoop.trackPerformance({
        templateId,
        metricType: 'accuracy_score',
        value: metrics.successRate,
      });
    }
  }

  /**
   * Batch optimize multiple templates
   */
  async batchOptimize(
    templateIds: string[],
    context?: Partial<OptimizationContext>,
    options: {
      concurrency?: number;
      failFast?: boolean;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
    } = {}
  ): Promise<OptimizationBatch> {
    const batchId = this.generateBatchId();
    const jobs: OptimizationJob[] = [];

    logger.info(`Starting batch optimization - ${JSON.stringify({
      batchId,
      templateCount: templateIds.length,
      concurrency: options.concurrency || this.config.enableOptimization,
    })}`);

    // Create optimization jobs
    for (const templateId of templateIds) {
      try {
        const job = (await this.optimizeTemplate(templateId, context, {
          priority: options.priority,
          async: true,
        })) as OptimizationJob;

        jobs.push(job);
      } catch (error) {
        if (options.failFast) {
          throw error;
        }

        logger.warn(`Failed to create optimization job in batch - ${JSON.stringify({
          templateId,
          batchId,
          error: error instanceof Error ? error.message : String(error)}`),
        });
      }
    }

    const batch: OptimizationBatch = {
      batchId,
      templateIds,
      status: jobs.length > 0 ? 'processing' : 'failed',
      jobs,
      config: {
        concurrency: options.concurrency || 3,
        failFast: options.failFast || false,
        context: context || this.config.defaultOptimizationContext,
      },
      createdAt: new Date(),
      startedAt: jobs.length > 0 ? new Date() : undefined,
    };

    this.emit('batch:started', batch);
    return batch;
  }

  /**
   * Generate optimization report
   */
  async generateOptimizationReport(period: {
    start: Date;
    end: Date;
  }): Promise<OptimizationReport> {
    const reportId = this.generateReportId();

    // This would normally query a database or analytics service
    // For now, we'll create a mock report structure
    const report: OptimizationReport = {
      reportId,
      generatedAt: new Date(),
      period,
      templatesAnalyzed: 0,
      summary: {
        totalOptimizations: 0,
        successfulOptimizations: 0,
        averageImprovement: 0,
        totalCostSavings: 0,
        totalTimeSavings: 0,
      },
      categoryBreakdown: {},
      trends: {
        improvementOverTime: [],
        mostOptimizedCategories: [],
      },
      recommendations: [],
      highlights: {
        topPerformers: [],
        underperformers: [],
      },
    };

    this.emit('report:generated', report);
    return report;
  }

  /**
   * Update optimization settings
   */
  async updateOptimizationSettings(
    updates: Partial<OptimizationSettings>
  ): Promise<void> {
    this.settings = {
      ...this.settings,
      ...updates,
    };

    await this.saveOptimizationSettings(this.settings);
    this.emit('settings:updated', this.settings);

    logger.info('Optimization settings updated');
  }

  /**
   * Get current optimization settings
   */
  getOptimizationSettings(): OptimizationSettings {
    return { ...this.settings };
  }

  /**
   * Check if optimization is available for a template
   */
  canOptimizeTemplate(template: Template): {
    canOptimize: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];

    if (!this.config.enableOptimization) {
      reasons.push('Optimization is disabled globally');
    }

    if (!template.files || template.files.length === 0) {
      reasons.push('Template has no files to optimize');
    }

    const primaryContent = template.files[0]?.content || '';
    if (primaryContent.length < 10) {
      reasons.push('Template content is too short to optimize');
    }

    if (primaryContent.length > 50000) {
      reasons.push('Template content is too long to optimize');
    }

    return {
      canOptimize: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Create optimized template from optimization result
   */
  private async createOptimizedTemplate(
    original: Template,
    result: OptimizationResult,
    context: OptimizationContext
  }`): Promise<OptimizedTemplate> {
    const optimizationId = this.generateOptimizationId();

    const optimizationHistory: OptimizationHistory = {
      optimizationId,
      timestamp: new Date(),
      version: '1.0.0',
      context,
      metrics: result.metrics,
      originalContent: original.files[0]?.content || '',
      optimizedContent: result.optimizedTemplate.content,
      method: 'PromptWizard',
      success: true,
    };

    const optimizedTemplate: OptimizedTemplate = {
      ...original,
      id: `${original.name}_optimized`,
      name: `${original.name} (Optimized)`,
      files: [
        {
          ...original.files[0],
          content: result.optimizedTemplate.content,
        },
      ],
      isOptimized: true,
      originalTemplateId: original.name,
      optimizationMetrics: result.metrics,
      optimizationHistory: [optimizationHistory],
      optimizationContext: context,
      metadata: {
        ...original.metadata,
        optimized: true,
        optimizationDate: new Date().toISOString(),
      },
    };

    return optimizedTemplate;
  }

  /**
   * Save optimized template to disk
   */
  private async saveOptimizedTemplate(
    template: OptimizedTemplate
  ): Promise<void> {
    const optimizedDir = path.join(
      process.cwd(),
      '.cursor-prompt',
      'optimized'
    );
    const templatePath = path.join(
      optimizedDir,
      `${template.originalTemplateId}.json`
    );

    // Ensure directory exists
    await fs.promises.mkdir(optimizedDir, { recursive: true });

    // Save template
    await fs.promises.writeFile(
      templatePath,
      JSON.stringify(template, null, 2),
      'utf8'
    );

    // Cache it
    this.optimizedTemplateCache.set(template.originalTemplateId!, template);

    logger.debug(`Optimized template saved - ${JSON.stringify({
      templateId: template.originalTemplateId,
      path: templatePath,
    })}`);
  }

  /**
   * Load optimized template from disk
   */
  private async loadOptimizedTemplateFromDisk(
    templateId: string
  ): Promise<OptimizedTemplate | null> {
    const optimizedDir = path.join(
      process.cwd(),
      '.cursor-prompt',
      'optimized'
    );
    const templatePath = path.join(optimizedDir, `${templateId}.json`);

    try {
      const content = await fs.promises.readFile(templatePath, 'utf8');
      const template = JSON.parse(content) as OptimizedTemplate;

      // Convert date strings back to Date objects
      template.optimizationHistory = template.optimizationHistory.map(
        history => ({
          ...history,
          timestamp: new Date(history.timestamp),
        })
      );

      return template;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate template comparison
   */
  private generateTemplateComparison(
    original: Template,
    optimized: OptimizedTemplate
  ): TemplateComparison {
    const originalContent = original.files[0]?.content || '';
    const optimizedContent = optimized.files[0]?.content || '';

    // This would normally perform detailed diff analysis
    const comparison: TemplateComparison = {
      original,
      optimized,
      comparison: {
        overallImprovement: optimized.optimizationMetrics.accuracyImprovement,
        metrics: optimized.optimizationMetrics,
        contentDiff: {
          additions: [],
          deletions: [],
          modifications: [],
        },
        structuralChanges: {
          variablesAdded: [],
          variablesRemoved: [],
          sectionsReorganized: false,
          logicSimplified: false,
        },
        qualityAssessment: {
          clarity: 0.1,
          conciseness: optimized.optimizationMetrics.tokenReduction,
          completeness: 0.05,
          accuracy: optimized.optimizationMetrics.accuracyImprovement,
        },
      },
      recommendation: {
        useOptimized: optimized.optimizationMetrics.accuracyImprovement > 0.1,
        confidence: optimized.optimizationMetrics.confidence || 0.8,
        reasons: ['Improved accuracy', 'Reduced token usage'],
        warnings: [],
      },
    };

    return comparison;
  }

  /**
   * Check if existing optimization should be used
   */
  private shouldUseExistingOptimization(optimized: OptimizedTemplate): boolean {
    const lastOptimization =
      optimized.optimizationHistory[optimized.optimizationHistory.length - 1];
    const age = Date.now() - lastOptimization.timestamp.getTime();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    return age < maxAge;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to optimization queue events
    this.optimizationQueue.on('job:completed', (job: OptimizationJob) => {
      this.handleOptimizationJobCompleted(job);
    });

    this.optimizationQueue.on('job:failed', (job: OptimizationJob) => {
      this.handleOptimizationJobFailed(job);
    });

    // Listen to feedback loop events
    if (this.config.enableFeedbackLoop) {
      this.feedbackLoop.on('reoptimization:triggered', (trigger: any) => {
        this.handleReoptimizationTriggered(trigger);
      });
    }
  }

  /**
   * Handle completed optimization job
   */
  private async handleOptimizationJobCompleted(
    job: OptimizationJob
  ): Promise<void> {
    if (job.result) {
      try {
        await this.saveOptimizedTemplate(job.result);
        this.emit('optimization:completed', {
          templateId: job.templateId,
          optimizedTemplate: job.result,
        });
      } catch (error) {
        logger.error(`Failed to save completed optimization - ${JSON.stringify({
          jobId: job.jobId,
          templateId: job.templateId,
          error,
        })}`);
      }
    }
  }

  /**
   * Handle failed optimization job
   */
  private handleOptimizationJobFailed(job: OptimizationJob): void {
    this.emit('optimization:failed', {
      templateId: job.templateId,
      jobId: job.jobId,
      error: job.error,
    });

    logger.error(`Optimization job failed - ${JSON.stringify({
      jobId: job.jobId,
      templateId: job.templateId,
      error: job.error,
    })}`);
  }

  /**
   * Handle reoptimization trigger
   */
  private async handleReoptimizationTriggered(trigger: any): Promise<void> {
    if (
      this.settings.global.enabled &&
      this.settings.feedbackSettings.enableFeedbackLoop
    ) {
      try {
        await this.optimizeTemplate(
          trigger.templateId,
          {},
          {
            forceReoptimization: true,
            async: true,
            priority: trigger.severity === 'high' ? 'high' : 'normal',
          }
        );

        logger.info(`Reoptimization triggered by feedback - ${JSON.stringify({
          templateId: trigger.templateId,
          reason: trigger.reason,
        })}`);
      } catch (error) {
        logger.error(`Failed to trigger reoptimization - ${JSON.stringify({
          templateId: trigger.templateId,
          error,
        })}`);
      }
    }
  }

  /**
   * Load optimization settings
   */
  private loadOptimizationSettings(): OptimizationSettings {
    // This would normally load from a configuration file
    // For now, return default settings
    const promptwizardConfig = getPromptWizardConfig();

    return {
      global: {
        enabled: promptwizardConfig.enabled,
        defaultModel: promptwizardConfig.optimization.defaultModel,
        autoOptimizeNewTemplates: promptwizardConfig.optimization.autoOptimize,
      },
      categorySettings: {},
      qualityThresholds: {
        minimumImprovement: 0.05,
        maximumDegradation: -0.1,
        confidenceThreshold: 0.7,
      },
      feedbackSettings: {
        enableFeedbackLoop: this.config.enableFeedbackLoop,
        reoptimizationThreshold: 3.0,
        feedbackWeight: 0.3,
      },
      advanced: {
        enableABTesting: this.config.enableABTesting,
        maxOptimizationHistory: this.config.maxOptimizationHistory,
        enableExperimentalFeatures: false,
      },
    };
  }

  /**
   * Save optimization settings
   */
  private async saveOptimizationSettings(
    settings: OptimizationSettings
  ): Promise<void> {
    const settingsPath = path.join(
      process.cwd(),
      '.cursor-prompt',
      'optimization-settings.json'
    );

    await fs.promises.mkdir(path.dirname(settingsPath), { recursive: true });
    await fs.promises.writeFile(
      settingsPath,
      JSON.stringify(settings, null, 2),
      'utf8'
    );
  }

  /**
   * Generate unique IDs
   */
  private generateOptimizationId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private generateReportId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}

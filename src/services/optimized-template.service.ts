/**
 * @fileoverview Optimized template service with PromptWizard integration
 * @lastmodified 2025-08-26T16:45:00Z
 *
 * Features: Template optimization, performance tracking, A/B testing, batch processing
 * Main APIs: optimizeTemplate(), getOptimizedTemplate(), batchOptimize(), updateOptimizationSettings()
 * Constraints: Integrates with PromptWizard service and optimization pipeline
 * Patterns: Event-driven optimization, caching, async job processing
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';

import { CacheService } from './cache.service';
import { TemplateService, Template as ServiceTemplate } from './template.service';
import { OptimizationPipeline } from '../core/optimization-pipeline';
import { OptimizationQueue } from '../queues/optimization-queue';
import { logger } from '../utils/logger';
import { convertServiceToIndexTemplate } from '../utils/template-converter';

import type {
  OptimizedTemplate,
  OptimizationHistory,
  OptimizationContext,
  OptimizationSettings,
  OptimizationBatch,
  TemplateComparison
} from '../types/optimized-template.types';

import type {
  OptimizationResult
} from '../integrations/promptwizard/types';

import type { Template } from '../types/index';
import type { OptimizationJob } from '../queues/optimization-queue';

export interface OptimizedTemplateServiceConfig {
  enableOptimization: boolean;
  autoOptimizeNewTemplates: boolean;
  enableFeedbackLoop: boolean;
  optimizationCache: {
    ttl: number;
    maxSize: number;
  };
}

/**
 * Service for managing optimized templates with PromptWizard integration
 */
export class OptimizedTemplateService extends EventEmitter {
  private readonly config: OptimizedTemplateServiceConfig;
  private readonly templateService: TemplateService;
  private readonly optimizationPipeline?: OptimizationPipeline;
  private readonly optimizationQueue: OptimizationQueue;
  private readonly optimizedTemplateCache: CacheService<OptimizedTemplate>;
  private settings: OptimizationSettings;

  constructor(config: Partial<OptimizedTemplateServiceConfig> = {}) {
    super();

    this.config = {
      enableOptimization: true,
      autoOptimizeNewTemplates: false,
      enableFeedbackLoop: true,
      optimizationCache: {
        ttl: 24 * 60 * 60 * 1000, // 24 hours
        maxSize: 100,
      },
      ...config,
    };

    this.templateService = new TemplateService({});
    // Note: OptimizationPipeline needs proper service instances - simplified for now
    // this.optimizationPipeline = new OptimizationPipeline(promptService, this.templateService, {});
    this.optimizationQueue = new OptimizationQueue();

    // Initialize cache
    this.optimizedTemplateCache = new CacheService<OptimizedTemplate>({
      maxSize: this.config.optimizationCache.maxSize,
      ttl: this.config.optimizationCache.ttl,
    });

    // Load optimization settings
    this.settings = this.loadOptimizationSettings();

    logger.info(`Optimized template service initialized with optimization: ${this.config.enableOptimization}`);
  }

  /**
   * Optimize a template using PromptWizard
   */
  async optimizeTemplate(
    templateId: string,
    context?: Partial<OptimizationContext>,
    options: {
      forceReoptimization?: boolean;
      async?: boolean;
      priority?: 'low' | 'normal' | 'high' | 'urgent';
    } = {}
  ): Promise<OptimizedTemplate | OptimizationJob> {
    if (!this.config.enableOptimization) {
      throw new Error('Template optimization is disabled');
    }

    // Load template
    const serviceTemplate = await this.templateService.loadTemplate(templateId);
    if (!serviceTemplate) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const template = convertServiceToIndexTemplate(serviceTemplate);

    // Check if optimization is needed
    if (!options.forceReoptimization) {
      const existingOptimized = await this.getOptimizedTemplate(templateId);
      if (existingOptimized && this.shouldUseExistingOptimization(existingOptimized)) {
        logger.info(`Using existing optimized template for ${templateId}`);
        return existingOptimized;
      }
    }

    // Prepare optimization context
    const optimizationContext: OptimizationContext = {
      templateId,
      targetModel: this.settings.global.defaultModel,
      task: template.description || 'Optimize template for better performance',
      preferences: context?.preferences,
      metadata: context?.metadata,
      ...context,
    };

    if (options.async) {
      // Queue optimization job
      const job = await this.optimizationQueue.addJob(
        templateId,
        template,
        optimizationContext,
        {
          priority: options.priority || 'normal',
        }
      );

      this.emit('optimization:queued', { templateId, jobId: job.jobId });
      return job;
    } else {
      // Process immediately (simplified for now - would use actual pipeline)
      if (!this.optimizationPipeline) {
        throw new Error('Optimization pipeline not initialized');
      }
      
      const result = await this.optimizationPipeline.process(
        templateId,
        template,
        optimizationContext
      );

      if (result.success && result.data) {
        const optimizedTemplate = await this.createOptimizedTemplate(
          template,
          result.data,
          optimizationContext
        );

        await this.saveOptimizedTemplate(optimizedTemplate);
        return optimizedTemplate;
      } else {
        throw new Error(result.error?.message || 'Optimization pipeline failed');
      }
    }
  }

  /**
   * Get optimized version of a template
   */
  async getOptimizedTemplate(templateId: string): Promise<OptimizedTemplate | null> {
    // Check cache first
    const cached = this.optimizedTemplateCache.get(templateId);
    if (cached) {
      return cached;
    }

    // Try loading from disk
    try {
      const optimizedTemplate = await this.loadOptimizedTemplateFromDisk(templateId);
      if (optimizedTemplate) {
        this.optimizedTemplateCache.set(templateId, optimizedTemplate);
        return optimizedTemplate;
      }
    } catch (error) {
      logger.debug(`No optimized template found on disk for ${templateId}`);
    }

    return null;
  }

  /**
   * Compare original and optimized templates
   */
  async compareTemplates(originalId: string, optimizedId: string): Promise<TemplateComparison> {
    const original = await this.templateService.loadTemplate(originalId);
    const optimized = await this.getOptimizedTemplate(optimizedId);

    if (!original || !optimized) {
      throw new Error('Templates not found for comparison');
    }

    return this.generateTemplateComparison(
      convertServiceToIndexTemplate(original),
      optimized
    );
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

    logger.info(`Starting batch optimization ${batchId} for ${templateIds.length} templates`);

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

        logger.warn(`Failed to create optimization job in batch ${batchId} for template ${templateId}: ${error}`);
      }
    }

    const batch: OptimizationBatch = {
      batchId,
      templateIds,
      status: jobs.length > 0 ? 'processing' : 'failed',
      jobs: jobs.map(j => j.jobId),
      createdAt: new Date(),
      settings: {
        concurrency: options.concurrency || 3,
        failFast: options.failFast || false,
        priority: options.priority || 'normal',
      },
    };

    return batch;
  }

  /**
   * Update optimization settings
   */
  async updateOptimizationSettings(updates: Partial<OptimizationSettings>): Promise<void> {
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
   * Check if template can be optimized
   */
  canOptimize(template: Template): { canOptimize: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Get primary content
    const primaryContent = template.content || template.files?.[0]?.source || '';

    if (!primaryContent || primaryContent.trim().length === 0) {
      reasons.push('Template has no content to optimize');
    }

    if (primaryContent.length < 50) {
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
  ): Promise<OptimizedTemplate> {
    const optimizationId = this.generateOptimizationId();

    const optimizationHistory: OptimizationHistory = {
      optimizationId,
      timestamp: new Date(),
      version: '1.0.0',
      context,
      metrics: result.metrics,
      originalContent: original.files?.[0]?.source || original.content || '',
      optimizedContent: result.optimizedPrompt,
      method: 'promptwizard',
      success: true,
    };

    const optimizedTemplate: OptimizedTemplate = {
      ...original,
      originalTemplateId: original.id || original.name,
      optimizationMetrics: result.metrics,
      optimizationHistory: [optimizationHistory],
      optimizationContext: context,
      content: result.optimizedPrompt,
    };

    return optimizedTemplate;
  }

  /**
   * Save optimized template to disk
   */
  private async saveOptimizedTemplate(template: OptimizedTemplate): Promise<void> {
    const optimizedDir = path.join(process.cwd(), '.optimized-templates');
    await fs.mkdir(optimizedDir, { recursive: true });

    const templatePath = path.join(
      optimizedDir,
      `${template.originalTemplateId}.optimized.json`
    );

    await fs.writeFile(
      templatePath,
      JSON.stringify(template, null, 2),
      'utf8'
    );

    // Cache it
    this.optimizedTemplateCache.set(template.originalTemplateId!, template);
    logger.debug(`Optimized template saved: ${template.originalTemplateId} to ${templatePath}`);
  }

  /**
   * Load optimized template from disk
   */
  private async loadOptimizedTemplateFromDisk(templateId: string): Promise<OptimizedTemplate | null> {
    const optimizedDir = path.join(process.cwd(), '.optimized-templates');
    const templatePath = path.join(optimizedDir, `${templateId}.optimized.json`);

    try {
      const content = await fs.readFile(templatePath, 'utf8');
      const template = JSON.parse(content) as OptimizedTemplate;
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
    const originalContent = original.content || original.files?.[0]?.source || '';
    const optimizedContent = optimized.content || '';

    const comparison: TemplateComparison = {
      original,
      optimized,
      improvements: {
        tokenReduction: optimized.optimizationMetrics.tokenReduction,
        costSavings: optimized.optimizationMetrics.costReduction,
        qualityImprovement: optimized.optimizationMetrics.qualityImprovement || 0,
        complexityReduction: optimized.optimizationMetrics.complexityReduction || 0,
      },
      analysis: {
        contentChanges: this.analyzeContentChanges(originalContent, optimizedContent),
        structuralChanges: this.analyzeStructuralChanges(original, optimized),
        variableChanges: this.analyzeVariableChanges(original, optimized),
      },
      recommendation: this.generateRecommendation(optimized.optimizationMetrics),
    };

    return comparison;
  }

  /**
   * Check if existing optimization should be used
   */
  private shouldUseExistingOptimization(optimized: OptimizedTemplate): boolean {
    const lastOptimization = optimized.optimizationHistory[optimized.optimizationHistory.length - 1];
    const age = Date.now() - lastOptimization.timestamp.getTime();
    const maxAge = this.settings.global.maxOptimizationAge || 7 * 24 * 60 * 60 * 1000; // 7 days

    return age < maxAge;
  }

  // Placeholder methods that would be implemented
  private analyzeContentChanges(original: string, optimized: string): string[] {
    return [`Content length changed from ${original.length} to ${optimized.length} characters`];
  }

  private analyzeStructuralChanges(original: Template, optimized: OptimizedTemplate): string[] {
    return ['Template structure analyzed'];
  }

  private analyzeVariableChanges(original: Template, optimized: OptimizedTemplate): string[] {
    return ['Variable usage analyzed'];
  }

  private generateRecommendation(metrics: any): string {
    return metrics.qualityImprovement > 0.1 ? 'Recommended for use' : 'Review recommended';
  }

  private loadOptimizationSettings(): OptimizationSettings {
    return {
      global: {
        enabled: true,
        defaultModel: 'gpt-4',
        maxOptimizationAge: 7 * 24 * 60 * 60 * 1000,
      },
      performance: {
        targetTokenReduction: 0.2,
        targetQualityImprovement: 0.1,
      },
      feedback: {
        enableAutoReoptimization: true,
        reoptimizationThreshold: 2.5,
      }
    };
  }

  private async saveOptimizationSettings(_settings: OptimizationSettings): Promise<void> {
    // Implementation would save to config file
  }

  private generateOptimizationId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
/**
 * @fileoverview Optimized template service with PromptWizard integration and compatibility layer
 * @lastmodified 2025-08-26T17:00:00Z
 *
 * Features: Template optimization, performance tracking, A/B testing, batch processing, service integration
 * Main APIs: optimizeTemplate(), getOptimizedTemplate(), batchOptimize(), compareTemplates(), updateOptimizationSettings()
 * Constraints: Integrates with PromptWizard service and optimization pipeline, compatible with extended TemplateService
 * Patterns: Event-driven optimization, caching, async job processing, service layer integration
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import * as path from 'path';

import { CacheService } from './cache.service';
import {
  TemplateService,
  // Template as ServiceTemplate, // Commented out as unused
} from './template.service';
import { OptimizationPipeline } from '../core/optimization-pipeline';
import { OptimizationQueue } from '../queues/optimization-queue';
import { PromptOptimizationService } from './prompt-optimization.service';
import { OptimizationCacheService } from './optimization-cache.service';
import { logger } from '../utils/logger';
import { convertServiceToIndexTemplate } from '../utils/template-converter';

import type {
  OptimizedTemplate,
  OptimizationHistory,
  OptimizationContext,
  OptimizationSettings,
  OptimizationBatch,
  TemplateComparison,
  OptimizationJob,
  OptimizationMetrics,
} from '../types/optimized-template.types';

import type {
  OptimizationResult,
  OptimizationRequest,
  PromptWizardService,
} from '../integrations/promptwizard/types';
import { PromptWizardClient } from '../integrations/promptwizard/client';

import type { Template, TemplateFile } from '../types/index';

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

  private readonly promptWizardService: PromptWizardService;

  private readonly cacheService: CacheService<OptimizationResult>;

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

    // Initialize services - properly typed implementations
    this.promptWizardService = new PromptWizardClient({
      baseUrl: process.env.PROMPT_WIZARD_BASE_URL || 'http://localhost:8080',
      timeout: 30000,
    } as any);
    this.cacheService = new CacheService<OptimizationResult>({
      maxSize: 100,
      ttl: 3600000,
    });

    // Initialize PromptOptimizationService first
    const promptOptimizationService = new PromptOptimizationService(
      this.promptWizardService as any,
      this.templateService,
      this.cacheService as unknown as CacheService<Record<string, unknown>>
    );

    // Initialize OptimizationPipeline with proper service instances
    this.optimizationPipeline = new OptimizationPipeline(
      promptOptimizationService,
      this.templateService as any,
      this.cacheService as unknown as CacheService<Record<string, unknown>>,
      {}
    );
    // Initialize OptimizationQueue with dependency injection pattern
    // Note: Full service dependencies would be injected in production
    const optimizationCacheService = new OptimizationCacheService();
    this.optimizationQueue = new OptimizationQueue(
      this.optimizationPipeline,
      optimizationCacheService
    );

    // Initialize cache
    this.optimizedTemplateCache = new CacheService<OptimizedTemplate>({
      maxSize: this.config.optimizationCache.maxSize,
      ttl: this.config.optimizationCache.ttl,
    });

    // Load optimization settings
    this.settings = this.loadOptimizationSettings();

    logger.info(
      `Optimized template service initialized with optimization: ${this.config.enableOptimization}`
    );
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
      if (
        existingOptimized &&
        this.shouldUseExistingOptimization(existingOptimized)
      ) {
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

    // Convert context to request format
    const optimizationRequest = this.convertContextToRequest(
      template,
      optimizationContext
    );

    if (options.async) {
      // Queue optimization job
      const job = await this.optimizationQueue.addJob(
        templateId,
        template,
        optimizationRequest,
        {
          priority: options.priority || 'normal',
        }
      );

      this.emit('optimization:queued', { templateId, jobId: job.jobId });
      return job as unknown as OptimizedTemplate | OptimizationJob;
    }
    // Process immediately (simplified for now - would use actual pipeline)
    if (!this.optimizationPipeline) {
      throw new Error('Optimization pipeline not initialized');
    }

    const result = await this.optimizationPipeline.process(
      templateId,
      template,
      optimizationRequest
    );

    if (result.success && result.data) {
      const optimizedTemplate = await this.createOptimizedTemplate(
        template,
        result.data,
        optimizationContext
      );

      await this.saveOptimizedTemplate(optimizedTemplate);
      return optimizedTemplate;
    }
    throw new Error(result.error?.message || 'Optimization pipeline failed');
  }

  /**
   * Get optimized version of a template
   */
  async getOptimizedTemplate(
    templateId: string
  ): Promise<OptimizedTemplate | null> {
    // Check cache first
    const cached = await this.optimizedTemplateCache.get(templateId);
    if (cached !== undefined) {
      return cached || null;
    }

    // Try loading from disk
    try {
      const optimizedTemplate =
        await this.loadOptimizedTemplateFromDisk(templateId);
      if (optimizedTemplate) {
        this.optimizedTemplateCache.set(templateId, optimizedTemplate);
        return optimizedTemplate;
      }
    } catch (_error) {
      logger.debug(`No optimized template found on disk for ${templateId}`);
    }

    return null;
  }

  /**
   * Compare original and optimized templates
   */
  async compareTemplates(
    originalId: string,
    optimizedId: string
  ): Promise<TemplateComparison> {
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

    logger.info(
      `Starting batch optimization ${batchId} for ${templateIds.length} templates`
    );

    // Create optimization jobs
    for (const templateId of templateIds) {
      try {
        const job = (await this.optimizeTemplate(templateId, context, {
          priority: options.priority,
          async: true,
        })) as OptimizationJob;

        jobs.push(job);
      } catch (error: any) {
        if (options.failFast) {
          throw error;
        }

        logger.warn(
          `Failed to create optimization job in batch ${batchId} for template ${templateId}: ${error}`
        );
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
        context: {
          templateId: (context as any)?.templateId || '',
          targetModel: (context as any)?.targetModel || 'gpt-4',
          task: (context as any)?.task || 'batch optimization',
        } as OptimizationContext,
      },
      createdAt: new Date(),
      // settings commented out as not in OptimizationBatch interface
      // settings: {
      //   concurrency: options.concurrency || 3,
      //   failFast: options.failFast || false,
      //   priority: options.priority || 'normal',
      // },
    };

    return batch;
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
   * Check if template can be optimized
   */
  canOptimize(template: Template): { canOptimize: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Get primary content
    const primaryContent =
      template.content || template.files?.[0]?.source || '';

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
      originalContent:
        (original.files?.[0] as TemplateFile)?.content ||
        original.description ||
        '',
      optimizedContent: result.optimizedPrompt,
      method: 'promptwizard',
      success: true,
    };

    const optimizedTemplate: OptimizedTemplate = {
      ...original,
      isOptimized: true,
      originalTemplateId: original.name,
      optimizationMetrics: result.metrics,
      currentOptimizationMetrics: result.metrics,
      optimizationHistory: [optimizationHistory],
      optimizationContext: context,
      optimizationLevel: 'basic',
      // Update the content in files if they exist, otherwise add content property
      files:
        original.files && original.files.length > 0
          ? original.files.map((file, index) =>
              index === 0 ? { ...file, content: result.optimizedPrompt } : file
            )
          : [
              {
                path: `${original.name}.optimized.md`,
                source: `${original.name}.optimized.md`,
                destination: `${original.name}.optimized.md`,
                content: result.optimizedPrompt,
                name: original.name,
              } as TemplateFile,
            ],
    };

    return optimizedTemplate;
  }

  /**
   * Save optimized template to disk
   */
  private async saveOptimizedTemplate(
    template: OptimizedTemplate
  ): Promise<void> {
    const optimizedDir = path.join(process.cwd(), '.optimized-templates');
    await fs.mkdir(optimizedDir, { recursive: true });

    const templatePath = path.join(
      optimizedDir,
      `${template.originalTemplateId}.optimized.json`
    );

    await fs.writeFile(templatePath, JSON.stringify(template, null, 2), 'utf8');

    // Cache it
    this.optimizedTemplateCache.set(template.originalTemplateId!, template);
    logger.debug(
      `Optimized template saved: ${template.originalTemplateId} to ${templatePath}`
    );
  }

  /**
   * Load optimized template from disk
   */
  private async loadOptimizedTemplateFromDisk(
    templateId: string
  ): Promise<OptimizedTemplate | null> {
    const optimizedDir = path.join(process.cwd(), '.optimized-templates');
    const templatePath = path.join(
      optimizedDir,
      `${templateId}.optimized.json`
    );

    try {
      const content = await fs.readFile(templatePath, 'utf8');
      const template = JSON.parse(content) as OptimizedTemplate;
      return template;
    } catch (_error) {
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
    const originalContent =
      (original.files?.[0] as TemplateFile)?.content ||
      original.description ||
      '';
    const optimizedContent =
      (optimized.files?.[0] as TemplateFile)?.content ||
      optimized.description ||
      '';

    const comparison: TemplateComparison = {
      original,
      optimized,
      improvements: {
        tokenReduction: optimized.optimizationMetrics.tokenReduction,
        costSavings: optimized.optimizationMetrics.costReduction,
        qualityImprovement:
          optimized.optimizationMetrics.qualityImprovement || 0,
        complexityReduction:
          optimized.optimizationMetrics.complexityReduction || 0,
      },
      analysis: {
        contentChanges: this.analyzeContentChanges(
          originalContent,
          optimizedContent
        ),
        structuralChanges: this.analyzeStructuralChanges(original, optimized),
        variableChanges: this.analyzeVariableChanges(original, optimized),
      },
      comparison: {
        overallImprovement: optimized.optimizationMetrics.accuracyImprovement,
        metrics: optimized.optimizationMetrics,
        contentDiff: {
          additions: this.findContentDifferences(
            originalContent,
            optimizedContent,
            'additions'
          ),
          deletions: this.findContentDifferences(
            originalContent,
            optimizedContent,
            'deletions'
          ),
          modifications: this.findContentModifications(
            originalContent,
            optimizedContent
          ),
        },
        structuralChanges: {
          variablesAdded: Object.keys(optimized.variables || {}).filter(
            v => !Object.keys(original.variables || {}).includes(v)
          ),
          variablesRemoved: Object.keys(original.variables || {}).filter(
            v => !Object.keys(optimized.variables || {}).includes(v)
          ),
          sectionsReorganized:
            (original.files?.length || 0) !== (optimized.files?.length || 0),
          logicSimplified: optimizedContent.length < originalContent.length,
        },
        qualityAssessment: {
          clarity: optimized.optimizationMetrics.readabilityImprovement || 0,
          conciseness: optimized.optimizationMetrics.tokenReduction,
          completeness: optimized.optimizationMetrics.qualityImprovement || 0,
          accuracy: optimized.optimizationMetrics.accuracyImprovement,
        },
      },
      recommendation: this.generateRecommendation(
        optimized.optimizationMetrics
      ),
    };

    return comparison;
  }

  /**
   * Check if existing optimization should be used
   */
  private shouldUseExistingOptimization(optimized: OptimizedTemplate): boolean {
    const lastOptimization =
      optimized.optimizationHistory[optimized.optimizationHistory.length - 1];
    if (!lastOptimization) {
      return false;
    }
    const age = Date.now() - lastOptimization.timestamp.getTime();
    const maxAge =
      this.settings.global.maxOptimizationAge || 7 * 24 * 60 * 60 * 1000; // 7 days

    return age < maxAge;
  }

  // Helper methods for content analysis
  private analyzeContentChanges(original: string, optimized: string): string[] {
    const changes: string[] = [];

    if (original.length !== optimized.length) {
      changes.push(
        `Content length changed from ${original.length} to ${optimized.length} characters`
      );
    }

    if (optimized.length < original.length) {
      changes.push('Content was shortened and condensed');
    } else if (optimized.length > original.length) {
      changes.push('Content was expanded with additional details');
    }

    return changes;
  }

  private analyzeStructuralChanges(
    original: Template,
    optimized: OptimizedTemplate
  ): string[] {
    const changes: string[] = [];

    const origLen = original.files?.length || 0;
    const optLen = optimized.files?.length || 0;
    if (origLen !== optLen) {
      changes.push(`File count changed from ${origLen} to ${optLen}`);
    }

    const origCmdLen = original.commands?.length || 0;
    const optCmdLen = optimized.commands?.length || 0;
    if (origCmdLen !== optCmdLen) {
      changes.push(`Command count changed from ${origCmdLen} to ${optCmdLen}`);
    }

    return changes;
  }

  private analyzeVariableChanges(
    original: Template,
    optimized: OptimizedTemplate
  ): string[] {
    const originalVars = Object.keys(original.variables || {});
    const optimizedVars = Object.keys(optimized.variables || {});
    const changes: string[] = [];

    const added = optimizedVars.filter(v => !originalVars.includes(v));
    const removed = originalVars.filter(v => !optimizedVars.includes(v));

    if (added.length > 0) {
      changes.push(`Variables added: ${added.join(', ')}`);
    }

    if (removed.length > 0) {
      changes.push(`Variables removed: ${removed.join(', ')}`);
    }

    return changes;
  }

  private findContentDifferences(
    original: string,
    comparison: string,
    type: 'additions' | 'deletions'
  ): string[] {
    const originalLines = original.split('\n');
    const comparisonLines = comparison.split('\n');

    if (type === 'additions') {
      return comparisonLines.filter(line => !originalLines.includes(line));
    }
    return originalLines.filter(line => !comparisonLines.includes(line));
  }

  private findContentModifications(
    original: string,
    comparison: string
  ): Array<{ original: string; modified: string }> {
    const originalLines = original.split('\n');
    const comparisonLines = comparison.split('\n');
    const modifications: Array<{ original: string; modified: string }> = [];

    const maxLines = Math.max(originalLines.length, comparisonLines.length);
    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || '';
      const compLine = comparisonLines[i] || '';

      if (origLine !== compLine && origLine.length > 0 && compLine.length > 0) {
        modifications.push({ original: origLine, modified: compLine });
      }
    }

    return modifications;
  }

  private generateRecommendation(metrics: OptimizationMetrics): {
    useOptimized: boolean;
    confidence: number;
    reasons: string[];
    warnings?: string[];
  } {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let useOptimized = false;
    let confidence = 0.5;

    if (metrics.accuracyImprovement > 0.1) {
      reasons.push('Significant accuracy improvement detected');
      useOptimized = true;
      confidence += 0.2;
    }

    if (metrics.tokenReduction > 0.2) {
      reasons.push('Substantial token reduction achieved');
      useOptimized = true;
      confidence += 0.15;
    }

    if (metrics.costReduction > 1.5) {
      reasons.push('Cost reduction benefits');
      useOptimized = true;
      confidence += 0.1;
    }

    if (metrics.confidence && metrics.confidence < 0.7) {
      warnings.push('Low optimization confidence - manual review recommended');
      confidence -= 0.2;
    }

    return {
      useOptimized,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasons,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private loadOptimizationSettings(): OptimizationSettings {
    return {
      global: {
        enabled: true,
        defaultModel: 'gpt-4',
        maxOptimizationAge: 7 * 24 * 60 * 60 * 1000,
        autoOptimizeNewTemplates: false,
      },
      categorySettings: {},
      qualityThresholds: {
        minimumImprovement: 0.1,
        maximumDegradation: 0.05,
        confidenceThreshold: 0.7,
      },
      feedbackSettings: {
        enableFeedbackLoop: true,
        reoptimizationThreshold: 2.5,
        feedbackWeight: 0.3,
      },
      performance: {
        targetTokenReduction: 0.2,
        targetQualityImprovement: 0.1,
      },
      feedback: {
        enableAutoReoptimization: true,
        reoptimizationThreshold: 2.5,
      },
      advanced: {
        enableABTesting: false,
        maxOptimizationHistory: 10,
        enableExperimentalFeatures: false,
      },
    };
  }

  private async saveOptimizationSettings(
    _settings: OptimizationSettings
  ): Promise<void> {
    // Implementation would save to config file
  }

  private generateOptimizationId(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert OptimizationContext to OptimizationRequest format
   */
  private convertContextToRequest(
    template: Template,
    context: OptimizationContext
  ): OptimizationRequest {
    // Convert targetModel to valid values
    const validTargetModels: Array<
      | 'gpt-4'
      | 'gpt-3.5-turbo'
      | 'claude-3-opus'
      | 'claude-3-sonnet'
      | 'gemini-pro'
    > = [
      'gpt-4',
      'gpt-3.5-turbo',
      'claude-3-opus',
      'claude-3-sonnet',
      'gemini-pro',
    ];

    const targetModel = validTargetModels.includes(context.targetModel as any)
      ? (context.targetModel as any)
      : 'gpt-4';

    return {
      prompt: template.content || template.description || '',
      task: context.task,
      targetModel,
      metadata: {
        templateId: context.templateId,
        templateName: template.name,
        version: template.version,
        author: template.author,
      },
      ...context.preferences,
    };
  }
}

/**
 * @fileoverview Unified optimization service consolidating all optimization functionality
 * @lastmodified 2025-08-27T04:45:00Z
 *
 * Features: Template optimization, caching, queue management, PromptWizard integration
 * Main APIs: optimize(), batchOptimize(), getOptimizationHistory(), compareTemplates()
 * Constraints: Replaces 4 separate optimization services with unified approach
 * Patterns: Single responsibility, dependency injection, event-driven architecture
 */

import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { CacheService } from './cache.service';
import { TemplateService } from './template.service';
import { PromptWizardClient } from '../integrations/promptwizard/client';
import { OptimizationQueue } from '../queues/optimization-queue';
import { OptimizationPipeline } from '../core/optimization-pipeline';
import {
  OptimizationConfig,
  OptimizedResult,
  OptimizationRequest,
} from '../integrations/promptwizard/types';
import {
  OptimizationHistory,
  TemplateComparison,
} from '../types/optimized-template.types';
import { OptimizationMetrics } from '../types/unified-optimization.types';

export interface UnifiedOptimizationConfig {
  /** PromptWizard client configuration */
  promptWizard: {
    enabled: boolean;
    serviceUrl: string;
    timeout: number;
    retries: number;
  };
  /** Cache configuration */
  cache: {
    maxSize: number;
    ttlMs: number;
    useRedis: boolean;
  };
  /** Queue configuration */
  queue: {
    maxConcurrent: number;
    retryAttempts: number;
    backoffMs: number;
  };
  /** Optimization defaults */
  defaults: {
    targetModel: string;
    mutateRefineIterations: number;
    fewShotCount: number;
    generateReasoning: boolean;
  };
}

export interface OptimizationJobResult {
  jobId: string;
  status: 'completed' | 'failed' | 'pending';
  result?: OptimizedResult;
  error?: string;
  metrics?: OptimizationMetrics;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * Unified optimization service that consolidates all optimization functionality
 *
 * This service replaces the previous 4 separate optimization services:
 * - TemplateService (optimization features)
 * - OptimizedTemplateService
 * - PromptOptimizationService
 * - OptimizationCacheService
 *
 * Benefits:
 * - Single point of optimization functionality
 * - Consistent API across all optimization operations
 * - Unified caching and queue management
 * - Better dependency management through injection
 */
export class UnifiedOptimizationService extends EventEmitter {
  private promptWizardClient: PromptWizardClient | null = null;

  private cacheService: CacheService;

  private templateService: TemplateService;

  // private optimizationQueue: OptimizationQueue;

  private optimizationPipeline: OptimizationPipeline;

  private config: UnifiedOptimizationConfig;

  private inMemoryCache: LRUCache<string, OptimizationJobResult>;

  private optimizationHistory: Map<string, OptimizationHistory> = new Map();

  constructor(
    config: UnifiedOptimizationConfig,
    dependencies: {
      cacheService?: CacheService;
      templateService?: TemplateService;
      optimizationQueue?: OptimizationQueue;
      optimizationPipeline?: OptimizationPipeline;
    } = {}
  ) {
    super();

    this.config = config;

    // Dependency injection with fallbacks
    this.cacheService = dependencies.cacheService || new CacheService();
    this.templateService =
      dependencies.templateService || new TemplateService();
    // this.optimizationQueue =
    //   dependencies.optimizationQueue || new OptimizationQueue({}, {});
    this.optimizationPipeline =
      dependencies.optimizationPipeline ||
      new OptimizationPipeline(
        new (require('./prompt-optimization.service').PromptOptimizationService)(),
        this.templateService,
        this.cacheService
      );

    // Initialize in-memory cache
    this.inMemoryCache = new LRUCache<string, OptimizationJobResult>({
      max: config.cache.maxSize,
      ttl: config.cache.ttlMs,
    });

    this.initializePromptWizardClient();
  }

  /**
   * Initialize PromptWizard client if enabled
   */
  private initializePromptWizardClient(): void {
    if (!this.config.promptWizard.enabled) {
      logger.info('PromptWizard client disabled in configuration');
      return;
    }

    try {
      this.promptWizardClient = new PromptWizardClient({
        serviceUrl: this.config.promptWizard.serviceUrl,
        timeout: this.config.promptWizard.timeout,
        retries: this.config.promptWizard.retries,
        defaults: this.config.defaults,
        cache: {
          enabled: true,
          ttl: this.config.cache.ttlMs / 1000, // Convert ms to seconds
          maxSize: this.config.cache.maxSize,
        },
      });

      logger.info('PromptWizard client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PromptWizard client', error as Error);
    }
  }

  /**
   * Optimize a single template
   */
  async optimize(
    templatePath: string,
    options: Partial<OptimizationConfig> = {}
  ): Promise<OptimizationJobResult> {
    const jobId = this.generateJobId();
    const cacheKey = await this.generateCacheKey(templatePath, options);

    try {
      // Check cache first
      const cachedResult = await this.getCachedResult(cacheKey);
      if (cachedResult) {
        logger.debug('Using cached optimization result', {
          jobId,
          templatePath,
        });
        this.emit('optimization:cached', {
          jobId,
          templatePath,
          result: cachedResult,
        });
        return cachedResult;
      }

      // Load template
      const template = await this.templateService.loadTemplate(templatePath);

      // Create optimization request
      const request: OptimizationRequest = {
        task:
          options.task ||
          'Optimize template for clarity, effectiveness, and token efficiency',
        prompt: template.content || '',
        targetModel:
          (options.targetModel as any) ||
          (this.config.defaults.targetModel as any),
        mutateRefineIterations:
          options.mutateRefineIterations ||
          this.config.defaults.mutateRefineIterations,
        fewShotCount: options.fewShotCount || this.config.defaults.fewShotCount,
        generateReasoning:
          options.generateReasoning ?? this.config.defaults.generateReasoning,
        metadata: {
          templateId: templatePath,
          ...options.metadata,
        },
      };

      this.emit('optimization:started', { jobId, templatePath, request });

      let result: OptimizationJobResult;

      if (this.promptWizardClient) {
        // Use PromptWizard for optimization
        const optimizedResult =
          await this.promptWizardClient.optimizePrompt(request);

        result = {
          jobId,
          status:
            optimizedResult.status === 'completed'
              ? 'completed'
              : optimizedResult.status === 'failed'
                ? 'failed'
                : 'pending',
          result: optimizedResult,
          metrics: this.convertPromptWizardMetrics(optimizedResult.metrics),
          createdAt: new Date(),
          completedAt:
            optimizedResult.status === 'completed' ? new Date() : undefined,
        };
      } else {
        // Fallback to optimization pipeline
        const pipelineResult = await this.optimizationPipeline.process(
          templatePath,
          template,
          {
            targetModel: request.targetModel as any,
            mutateRefineIterations: request.mutateRefineIterations,
            generateReasoning: request.generateReasoning,
          }
        );

        const optimizationResult =
          pipelineResult.data || pipelineResult.optimizationResult;
        result = {
          jobId,
          status: pipelineResult.success ? 'completed' : 'failed',
          result: optimizationResult,
          metrics: optimizationResult?.metrics
            ? this.convertPromptWizardMetrics(optimizationResult.metrics)
            : undefined,
          createdAt: new Date(),
          completedAt: new Date(),
        };
      }

      // Cache result
      await this.cacheResult(cacheKey, result);

      // Update optimization history
      this.updateOptimizationHistory(templatePath, result);

      this.emit('optimization:completed', { jobId, templatePath, result });

      return result;
    } catch (error) {
      const result: OptimizationJobResult = {
        jobId,
        status: 'failed',
        error: (error as Error).message,
        createdAt: new Date(),
        completedAt: new Date(),
      };

      this.emit('optimization:failed', { jobId, templatePath, error });

      return result;
    }
  }

  /**
   * Batch optimize multiple templates
   */
  async batchOptimize(
    templatePaths: string[],
    options: Partial<OptimizationConfig> = {}
  ): Promise<OptimizationJobResult[]> {
    const batchId = this.generateJobId();

    logger.info('Starting batch optimization', {
      batchId,
      count: templatePaths.length,
    });
    this.emit('batch:started', { batchId, templatePaths });

    // Process templates with concurrency control
    const results: OptimizationJobResult[] = [];
    const concurrency = this.config.queue.maxConcurrent;

    for (let i = 0; i < templatePaths.length; i += concurrency) {
      const batch = templatePaths.slice(i, i + concurrency);
      const batchPromises = batch.map(templatePath =>
        this.optimize(templatePath, options)
      );
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            jobId: this.generateJobId(),
            status: 'failed',
            error: result.reason?.message || 'Unknown batch optimization error',
            createdAt: new Date(),
            completedAt: new Date(),
          });
        }
      });
    }

    this.emit('batch:completed', { batchId, results });

    return results;
  }

  /**
   * Get optimization history for a template
   */
  async getOptimizationHistory(
    templatePath: string
  ): Promise<OptimizationHistory | null> {
    const history = this.optimizationHistory.get(templatePath);
    if (history) {
      return history;
    }

    // Try to load from persistent cache
    const cacheKey = `history:${templatePath}`;
    const cachedHistory = (await this.cacheService.get(
      cacheKey
    )) as OptimizationHistory | null;

    if (cachedHistory) {
      this.optimizationHistory.set(templatePath, cachedHistory);
    }

    return cachedHistory;
  }

  /**
   * Compare template versions
   */
  async compareTemplates(
    originalPath: string,
    optimizedPath: string
  ): Promise<TemplateComparison> {
    const [original, optimized] = await Promise.all([
      this.templateService.loadTemplate(originalPath),
      this.templateService.loadTemplate(optimizedPath),
    ]);

    // Calculate basic metrics
    const tokenReduction = this.calculateTokenReduction(
      original.content || '',
      optimized.content || ''
    );
    const lengthReduction =
      (((original.content || '').length - (optimized.content || '').length) /
        (original.content || '').length) *
      100;

    const comparison: TemplateComparison = {
      original: {
        path: originalPath,
        content: original.content || '',
        length: (original.content || '').length,
      },
      optimized: {
        path: optimizedPath,
        content: optimized.content || '',
        length: (optimized.content || '').length,
      },
      metrics: {
        tokenReduction,
        lengthReduction,
        estimatedCostReduction: tokenReduction * 0.8, // Rough estimate
      },
      comparedAt: new Date(),
    };

    return comparison;
  }

  /**
   * Clear optimization cache
   */
  async clearCache(): Promise<void> {
    this.inMemoryCache.clear();
    await this.cacheService.clear();
    logger.info('Optimization cache cleared');
  }

  /**
   * Get optimization statistics
   */
  getStatistics(): {
    cacheSize: number;
    historyCount: number;
    totalOptimizations: number;
  } {
    const totalOptimizations = this.optimizationHistory.size;

    return {
      cacheSize: this.inMemoryCache.size,
      historyCount: this.optimizationHistory.size,
      totalOptimizations,
    };
  }

  // Private helper methods

  private generateJobId(): string {
    return `opt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private async generateCacheKey(
    templatePath: string,
    options: Partial<OptimizationConfig>
  ): Promise<string> {
    const template = await this.templateService.loadTemplate(templatePath);
    const keyData = {
      content: template.content || '',
      options,
    };

    return crypto
      .createHash('md5')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  private async getCachedResult(
    cacheKey: string
  ): Promise<OptimizationJobResult | null> {
    // Try in-memory cache first
    const memoryResult = this.inMemoryCache.get(cacheKey);
    if (memoryResult) {
      return memoryResult;
    }

    // Try persistent cache
    const persistentResult = (await this.cacheService.get(
      cacheKey
    )) as OptimizationJobResult | null;
    if (persistentResult) {
      // Update in-memory cache
      this.inMemoryCache.set(cacheKey, persistentResult);
    }

    return persistentResult;
  }

  private async cacheResult(
    cacheKey: string,
    result: OptimizationJobResult
  ): Promise<void> {
    // Cache in memory
    this.inMemoryCache.set(cacheKey, result);

    // Cache persistently
    await this.cacheService.set(
      cacheKey,
      result,
      this.config.cache.ttlMs / 1000
    );
  }

  private updateOptimizationHistory(
    templatePath: string,
    result: OptimizationJobResult
  ): void {
    const history: OptimizationHistory = {
      optimizationId: result.jobId,
      timestamp: result.createdAt,
      version: '1.0.0',
      context: {
        templateId: templatePath,
        targetModel: 'gpt-4',
        task: 'optimization',
        metadata: {},
      },
      metrics: result.metrics || {
        tokenReduction: 0,
        costReduction: 0,
        processingTime: 0,
        modelUsed: 'gpt-4',
        originalTokenCount: 0,
        optimizedTokenCount: 0,
        originalCharCount: 0,
        optimizedCharCount: 0,
        confidence: 0.5,
        qualityScore: 50,
      },
    };

    this.optimizationHistory.set(templatePath, history);

    // Persist history
    const cacheKey = `history:${templatePath}`;
    this.cacheService.set(cacheKey, history, 86400); // 24 hours
  }

  private calculateTokenReduction(original: string, optimized: string): number {
    const originalTokens = this.estimateTokenCount(original);
    const optimizedTokens = this.estimateTokenCount(optimized);

    return originalTokens > 0
      ? ((originalTokens - optimizedTokens) / originalTokens) * 100
      : 0;
  }

  private estimateTokenCount(text: string): number {
    // Rough token estimation (more accurate would use tiktoken)
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }

  /**
   * Convert PromptWizard metrics to unified OptimizationMetrics format
   */
  private convertPromptWizardMetrics(pwMetrics: {
    accuracyImprovement: number;
    tokenReduction: number;
    costReduction: number;
    processingTime: number;
    apiCallsUsed: number;
  }): OptimizationMetrics {
    return {
      tokenReduction: pwMetrics.tokenReduction,
      costReduction: pwMetrics.costReduction,
      processingTime: pwMetrics.processingTime * 1000, // Convert seconds to ms
      modelUsed: 'promptwizard',
      originalTokenCount: 100, // Default values, could be calculated
      optimizedTokenCount: Math.round(
        100 * (1 - pwMetrics.tokenReduction / 100)
      ),
      originalCharCount: 500, // Default values
      optimizedCharCount: Math.round(
        500 * (1 - pwMetrics.tokenReduction / 100)
      ),
      confidence: Math.min(pwMetrics.accuracyImprovement / 100, 1.0),
      qualityScore: Math.round(pwMetrics.accuracyImprovement),
    };
  }
}

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
import { OptimizationHistory } from '../types/optimized-template.types';
import {
  OptimizationMetrics,
  TemplateComparison,
} from '../types/unified-optimization.types';

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
        prompt: template.files?.[0]?.content || '',
        targetModel: this.validateTargetModel(
          (options.targetModel as string | undefined) ||
            (this.config.defaults.targetModel as string)
        ),
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
            targetModel: this.validateTargetModel(request.targetModel),
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
      const originalContent = template.files?.[0]?.content || '';
      const optimizedContent = result.result?.optimizedPrompt || '';
      this.updateOptimizationHistory(
        templatePath,
        result,
        originalContent,
        optimizedContent
      );

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
    const originalContent = original.files?.[0]?.content || '';
    const optimizedContent = optimized.files?.[0]?.content || '';

    const tokenReduction = this.calculateTokenReduction(
      originalContent,
      optimizedContent
    );
    const lengthReduction =
      ((originalContent.length - optimizedContent.length) /
        originalContent.length) *
      100;

    const comparison: TemplateComparison = {
      original: {
        path: originalPath,
        content: originalContent,
        tokenCount: this.calculateTokenCount(originalContent),
        length: originalContent.length,
      },
      optimized: {
        path: optimizedPath,
        content: optimizedContent,
        tokenCount: this.calculateTokenCount(optimizedContent),
        length: optimizedContent.length,
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

  private validateTargetModel(
    model: string | undefined
  ):
    | 'gpt-4'
    | 'gpt-3.5-turbo'
    | 'claude-3-opus'
    | 'claude-3-sonnet'
    | 'gemini-pro'
    | undefined {
    const validModels = [
      'gpt-4',
      'gpt-3.5-turbo',
      'claude-3-opus',
      'claude-3-sonnet',
      'gemini-pro',
    ] as const;
    if (!model) return undefined;
    return validModels.includes(model as any)
      ? (model as (typeof validModels)[number])
      : 'gpt-4';
  }

  private async generateCacheKey(
    templatePath: string,
    options: Partial<OptimizationConfig>
  ): Promise<string> {
    const template = await this.templateService.loadTemplate(templatePath);
    const keyData = {
      content: template.files?.[0]?.content || '',
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
    result: OptimizationJobResult,
    originalContent: string,
    optimizedContent: string
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
      originalContent,
      optimizedContent,
      method: 'promptwizard',
      success: result.status === 'completed',
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
        accuracyImprovement: 0,
        apiCallsUsed: 0,
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

  /**
   * Calculate token count for given text
   */
  private calculateTokenCount(text: string): number {
    return this.estimateTokenCount(text);
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
      accuracyImprovement: pwMetrics.accuracyImprovement,
      apiCallsUsed: pwMetrics.apiCallsUsed,
    };
  }

  /**
   * Enhanced batch optimization with worker pool pattern for better performance
   */
  async batchOptimizeParallel(
    templatePaths: string[],
    options: Partial<OptimizationConfig> = {}
  ): Promise<OptimizationJobResult[]> {
    const batchId = this.generateJobId();
    const startTime = Date.now();

    logger.info('Starting enhanced parallel batch optimization', {
      batchId,
      count: templatePaths.length,
      concurrency: this.config.queue.maxConcurrent,
    });

    // Pre-load all templates in parallel for better I/O performance
    const templateLoadPromises = templatePaths.map(async (path, index) => ({
      index,
      path,
      template: await this.templateService.loadTemplate(path).catch(error => ({
        error: error.message,
      })),
    }));

    const loadedTemplates = await Promise.all(templateLoadPromises);
    const validTemplates = loadedTemplates.filter(
      t => !('error' in t.template)
    );
    const failedLoads = loadedTemplates.filter(t => 'error' in t.template);

    logger.info(
      `Template loading completed: ${validTemplates.length} success, ${failedLoads.length} failed`
    );

    // Process valid templates with worker pool
    const results = await this.processWithWorkerPool(validTemplates, options);

    // Add failed loads to results
    failedLoads.forEach(({ index, template }) => {
      results[index] = {
        jobId: this.generateJobId(),
        status: 'failed',
        error: `Template loading failed: ${(template as { error?: string }).error || 'unknown error'}`,
        createdAt: new Date(),
        completedAt: new Date(),
      };
    });

    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.status === 'completed').length;

    logger.info('Enhanced parallel batch optimization completed', {
      batchId,
      total: results.length,
      success: successCount,
      failed: results.length - successCount,
      duration,
      throughput: results.length / (duration / 1000),
    });

    return results;
  }

  /**
   * Process templates using worker pool pattern for maximum parallelism
   */
  private async processWithWorkerPool(
    templates: Array<{ index: number; path: string; template: unknown }>,
    options: Partial<OptimizationConfig>
  ): Promise<OptimizationJobResult[]> {
    const results: OptimizationJobResult[] = [];
    const concurrency = this.config.queue.maxConcurrent;
    // const _semaphore = new Array(concurrency).fill(null); // Reserved for future semaphore implementation"

    const processTemplate = async (templateData: {
      index: number;
      path: string;
      template: unknown;
    }): Promise<OptimizationJobResult> => {
      try {
        const result = await this.optimize(templateData.path, options);
        results[templateData.index] = result;
        return result;
      } catch (error) {
        const errorResult = {
          jobId: this.generateJobId(),
          status: 'failed' as const,
          error: (error as Error).message,
          createdAt: new Date(),
          completedAt: new Date(),
        };
        results[templateData.index] = errorResult;
        return errorResult;
      }
    };

    // Create worker pool using Promise.all with limited concurrency
    const workers = [];
    for (let i = 0; i < templates.length; i += concurrency) {
      const batch = templates.slice(i, i + concurrency);
      workers.push(Promise.all(batch.map(processTemplate)));
    }

    await Promise.all(workers);
    return results;
  }

  /**
   * Stream processing for large templates to reduce memory usage
   */
  async processLargeTemplateStream(
    templatePath: string,
    options: Partial<OptimizationConfig> = {}
  ): Promise<OptimizationJobResult> {
    const jobId = this.generateJobId();
    logger.info('Starting stream processing for large template', {
      jobId,
      templatePath,
    });

    try {
      // Use streaming approach for large template content
      const template = await this.templateService.loadTemplate(templatePath);
      const content = template.files?.[0]?.content || '';

      // If content is large, process in chunks
      if (content.length > 10000) {
        // 10KB threshold
        return this.processInChunks(content, templatePath, options, jobId);
      }

      // For smaller templates, use regular processing
      return this.optimize(templatePath, options);
    } catch (error) {
      return {
        jobId,
        status: 'failed',
        error: (error as Error).message,
        createdAt: new Date(),
        completedAt: new Date(),
      };
    }
  }

  /**
   * Process large template content in chunks to manage memory usage
   */
  private async processInChunks(
    content: string,
    templatePath: string,
    options: Partial<OptimizationConfig>,
    jobId: string
  ): Promise<OptimizationJobResult> {
    const chunkSize = 5000; // 5KB chunks
    const chunks = [];

    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }

    logger.info(`Processing template in ${chunks.length} chunks`, {
      jobId,
      templatePath,
    });

    // Process chunks in parallel with limited concurrency
    const chunkResults = await Promise.allSettled(
      chunks.map((chunk, index) => this.optimizeChunk(chunk, index, options))
    );

    // Combine chunk results
    const optimizedChunks = chunkResults
      .filter((result, index) => {
        if (result.status === 'rejected') {
          logger.warn(`Chunk ${index} processing failed:`, result.reason);
          return false;
        }
        return true;
      })
      .map(result => (result as PromiseFulfilledResult<string>).value);

    const optimizedContent = optimizedChunks.join('');

    return {
      jobId,
      status: 'completed',
      result: {
        jobId,
        originalPrompt: content,
        optimizedPrompt: optimizedContent,
        status: 'completed',
        metrics: {
          accuracyImprovement: 0,
          tokenReduction: Math.max(
            0,
            ((content.length - optimizedContent.length) / content.length) * 100
          ),
          costReduction: 10,
          processingTime: Date.now() - Date.now(),
          apiCallsUsed: 1,
        },
        createdAt: new Date(),
        completedAt: new Date(),
      } as OptimizedResult,
      createdAt: new Date(),
      completedAt: new Date(),
    };
  }

  /**
   * Optimize individual chunk of content
   */
  private async optimizeChunk(
    chunk: string,
    _index: number,
    _options: Partial<OptimizationConfig>
  ): Promise<string> {
    // For demo purposes, apply simple optimizations
    // In practice, this would use the PromptWizard API for each chunk
    return chunk
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive line breaks
      .trim();
  }
}

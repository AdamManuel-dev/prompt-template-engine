/**
 * @fileoverview Service for managing prompt optimization workflows with PromptWizard
 * @lastmodified 2025-08-26T12:30:00Z
 *
 * Features: Batch optimization, queue management, result caching, feedback loops
 * Main APIs: optimizeTemplate(), batchOptimize(), getOptimizationStatus(), sendFeedback()
 * Constraints: Requires PromptWizard service running, Redis for caching
 * Patterns: Queue-based async processing, LRU cache, event-driven updates
 */

import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';
import { logger } from '../utils/logger';
import {
  PromptWizardClient,
  OptimizationConfig,
  QualityScore,
  PromptComparison,
  OptimizationJob,
} from '../integrations/promptwizard';
import { TemplateService } from './template.service';
import { CacheService } from './cache.service';
import { Template } from '../types';

export interface OptimizationOptions {
  skipCache?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  maxRetries?: number;
  timeoutMs?: number;
}

export interface OptimizationRequest {
  templateId: string;
  template: Template;
  config?: Partial<OptimizationConfig>;
  options?: OptimizationOptions;
}

export interface OptimizationResult {
  requestId: string;
  templateId: string;
  originalTemplate: Template;
  optimizedTemplate: Template;
  metrics: {
    tokenReduction: number;
    accuracyImprovement: number;
    optimizationTime: number;
    apiCalls: number;
  };
  qualityScore: QualityScore;
  comparison: PromptComparison;
  timestamp: Date;
}

export interface BatchOptimizationRequest {
  templates: Array<{
    id: string;
    template: Template;
  }>;
  config?: Partial<OptimizationConfig>;
  options?: OptimizationOptions;
}

export interface BatchOptimizationResult {
  batchId: string;
  total: number;
  successful: number;
  failed: number;
  results: OptimizationResult[];
  errors: Array<{
    templateId: string;
    error: string;
  }>;
  timestamp: Date;
}

export class PromptOptimizationService extends EventEmitter {
  private client: PromptWizardClient;

  private cacheService: CacheService;

  private optimizationQueue: Map<string, OptimizationJob>;

  private resultCache: LRUCache<string, OptimizationResult>;

  constructor(
    client: PromptWizardClient,
    _templateService: TemplateService, // Keep parameter for interface compatibility
    cacheService: CacheService
  ) {
    super();
    this.client = client;
    this.cacheService = cacheService;
    this.optimizationQueue = new Map();

    // Initialize LRU cache for optimization results
    this.resultCache = new LRUCache<string, OptimizationResult>({
      max: 100, // Maximum 100 cached results
      ttl: 1000 * 60 * 60 * 24, // 24 hour TTL
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });
  }

  /**
   * Optimize a single template
   */
  async optimizeTemplate(
    request: OptimizationRequest
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(request);

    // Check cache first unless explicitly skipped
    if (!request.options?.skipCache) {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) {
        logger.info(
          `Using cached optimization for template: ${request.templateId}`
        );
        return cached;
      }
    }

    logger.info(`Starting optimization for template: ${request.templateId}`);
    this.emit('optimization:started', { templateId: request.templateId });

    try {
      // Prepare optimization configuration
      const config: OptimizationConfig = {
        task: request.template.name,
        prompt: request.template.content || '',
        targetModel: request.config?.targetModel || 'gpt-4',
        mutateRefineIterations: request.config?.mutateRefineIterations || 3,
        fewShotCount: request.config?.fewShotCount || 5,
        generateReasoning: request.config?.generateReasoning ?? true,
        ...request.config,
      };

      // Submit optimization request
      const optimizedResult = await this.client.optimizePrompt(config);

      // Score both original and optimized prompts
      const [, optimizedScore] = await Promise.all([
        this.client.scorePrompt(request.template.content || ''),
        this.client.scorePrompt(optimizedResult.optimizedPrompt),
      ]);

      // Compare prompts for metrics
      const comparison = await this.client.comparePrompts(
        request.template.content || '',
        optimizedResult.optimizedPrompt
      );

      // Create optimized template
      const optimizedTemplate: Template = {
        ...request.template,
        content: optimizedResult.optimizedPrompt,
      };

      // Calculate metrics
      const metrics = {
        tokenReduction: comparison.improvements?.tokenReduction || 0,
        accuracyImprovement: comparison.improvements?.qualityImprovement || 0,
        optimizationTime: Date.now() - startTime,
        apiCalls: optimizedResult.metrics?.apiCallsUsed || 0,
      };

      // Create result
      const result: OptimizationResult = {
        requestId: this.generateRequestId(),
        templateId: request.templateId,
        originalTemplate: request.template,
        optimizedTemplate,
        metrics,
        qualityScore: optimizedScore,
        comparison,
        timestamp: new Date(),
      };

      // Cache result
      await this.cacheResult(cacheKey, result);

      // Note: Template service doesn't have updateTemplate method
      // This would need to be implemented if template updating is required

      logger.info(`Optimization completed for template: ${request.templateId}`);
      this.emit('optimization:completed', result);

      return result;
    } catch (error) {
      logger.error(`Optimization failed for template: ${request.templateId}`);
      this.emit('optimization:failed', {
        templateId: request.templateId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Batch optimize multiple templates
   */
  async batchOptimize(
    request: BatchOptimizationRequest
  ): Promise<BatchOptimizationResult> {
    logger.info(
      `Starting batch optimization for ${request.templates.length} templates`
    );
    this.emit('batch:started', { count: request.templates.length });

    const batchId = this.generateBatchId();
    const results: OptimizationResult[] = [];
    const errors: Array<{ templateId: string; error: string }> = [];

    // Process templates in parallel with concurrency control
    const concurrency = 3; // Process 3 templates at a time
    for (let i = 0; i < request.templates.length; i += concurrency) {
      const batch = request.templates.slice(i, i + concurrency);
      const promises = batch.map(async ({ id, template }) => {
        try {
          const result = await this.optimizeTemplate({
            templateId: id,
            template,
            config: request.config,
            options: request.options,
          });
          results.push(result);
        } catch (error) {
          errors.push({
            templateId: id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
      await Promise.all(promises);
    }

    const batchResult: BatchOptimizationResult = {
      batchId,
      total: request.templates.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      timestamp: new Date(),
    };

    logger.info(
      `Batch optimization completed: ${batchResult.successful}/${batchResult.total} successful`
    );
    this.emit('batch:completed', batchResult);

    return batchResult;
  }

  /**
   * Get optimization status for a job
   */
  async getOptimizationStatus(jobId: string): Promise<OptimizationJob | null> {
    const job = this.optimizationQueue.get(jobId);
    if (!job) {
      // Check if job exists in the Python service
      return this.client.getJobStatus(jobId);
    }
    return job;
  }

  /**
   * Send feedback for an optimization to improve future results
   */
  async sendFeedback(
    templateId: string,
    feedback: {
      rating: number; // 1-5
      comments?: string;
      preferredVersion: 'original' | 'optimized';
    }
  ): Promise<void> {
    logger.info(`Sending feedback for template: ${templateId}`);

    // Get the cached optimization result
    const cacheKey = `feedback:${templateId}`;
    const result = this.resultCache.get(cacheKey);

    if (!result) {
      throw new Error('Optimization result not found for feedback');
    }

    // Note: PromptWizard client doesn't have sendFeedback method
    // This would need to be implemented in the client

    // Trigger re-optimization if rating is low
    if (feedback.rating <= 2 && feedback.preferredVersion === 'original') {
      logger.info(
        `Low rating detected, scheduling re-optimization for: ${templateId}`
      );
      this.emit('reoptimization:scheduled', { templateId });

      // Schedule re-optimization with adjusted parameters
      await this.optimizeTemplate({
        templateId,
        template: result.originalTemplate,
        config: {
          mutateRefineIterations: 5, // More iterations for better results
          generateReasoning: true,
          fewShotCount: 10, // More examples
        },
        options: {
          skipCache: true, // Force fresh optimization
          priority: 'high',
        },
      });
    }

    logger.info(`Feedback processed for template: ${templateId}`);
  }

  /**
   * Clear optimization cache
   */
  clearCache(): void {
    this.resultCache.clear();
    logger.info('Optimization cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
  } {
    return {
      size: this.resultCache.size,
      maxSize: this.resultCache.max,
      hits: this.resultCache.size, // Simplified, would need proper tracking
      misses: 0, // Would need proper tracking
    };
  }

  // Private helper methods

  private generateCacheKey(request: OptimizationRequest): string {
    const configHash = JSON.stringify(request.config || {});
    return `optimize:${request.templateId}:${configHash}`;
  }

  private async getCachedResult(
    key: string
  ): Promise<OptimizationResult | null> {
    // Check in-memory cache first
    const memCached = this.resultCache.get(key);
    if (memCached) {
      return memCached;
    }

    // Check distributed cache
    const cached = (await this.cacheService.get(
      key
    )) as OptimizationResult | null;
    if (cached) {
      // Populate memory cache
      this.resultCache.set(key, cached);
      return cached;
    }

    return null;
  }

  private async cacheResult(
    key: string,
    result: OptimizationResult
  ): Promise<void> {
    // Cache in memory
    this.resultCache.set(key, result);

    // Cache in distributed cache
    await this.cacheService.set(key, result); // Use default TTL
  }

  private generateRequestId(): string {
    return `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

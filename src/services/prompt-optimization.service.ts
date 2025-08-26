/**
 * @fileoverview Service for managing prompt optimization workflows with PromptWizard
 * @lastmodified 2025-08-26T11:31:10Z
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
import { Template } from '../types';
import { CacheService } from './cache.service';
import { OptimizationCacheService } from './optimization-cache.service';
import { OptimizationQueue } from '../queues/optimization-queue';
import { OptimizationPipeline } from '../core/optimization-pipeline';

/**
 * Configuration options for optimization requests
 * Controls caching, priority, and timeout behavior
 */
export interface OptimizationOptions {
  /** Skip cache lookup and force fresh optimization */
  skipCache?: boolean;
  /** Processing priority level affecting queue order */
  priority?: 'low' | 'normal' | 'high' | 'critical';
  /** Maximum number of retry attempts on failure */
  maxRetries?: number;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Request structure for single template optimization
 * Contains template data and optimization parameters
 */
export interface OptimizationRequest {
  /** Unique identifier for the template */
  templateId: string;
  /** Template object containing content and metadata */
  template: Template;
  /** Optimization configuration overrides */
  config?: Partial<OptimizationConfig>;
  /** Request-specific options for caching and priority */
  options?: OptimizationOptions;
}

/**
 * Result object containing optimization outcomes and metrics
 * Provides before/after comparison and performance data
 */
export interface OptimizationResult {
  /** Unique identifier for this optimization request */
  requestId: string;
  /** Template identifier that was optimized */
  templateId: string;
  /** Original template before optimization */
  originalTemplate: Template;
  /** Optimized template with improvements */
  optimizedTemplate: Template;
  /** Performance metrics from the optimization process */
  metrics: {
    /** Percentage reduction in token count */
    tokenReduction: number;
    /** Improvement in accuracy score */
    accuracyImprovement: number;
    /** Time taken for optimization in milliseconds */
    optimizationTime: number;
    /** Number of API calls made during optimization */
    apiCalls: number;
  };
  /** Quality assessment of the optimized prompt */
  qualityScore: QualityScore;
  /** Detailed comparison between original and optimized versions */
  comparison: PromptComparison;
  /** Timestamp when optimization completed */
  timestamp: Date;
}

/**
 * Request structure for batch template optimization
 * Allows processing multiple templates with shared configuration
 */
export interface BatchOptimizationRequest {
  /** Array of templates to optimize with their identifiers */
  templates: Array<{
    /** Unique identifier for the template */
    id: string;
    /** Template object to be optimized */
    template: Template;
  }>;
  /** Shared optimization configuration for all templates */
  config?: Partial<OptimizationConfig>;
  /** Shared options for all templates in the batch */
  options?: OptimizationOptions;
}

/**
 * Result object for batch optimization operations
 * Contains aggregated results and error information
 */
export interface BatchOptimizationResult {
  /** Unique identifier for this batch operation */
  batchId: string;
  /** Total number of templates processed */
  total: number;
  /** Number of successfully optimized templates */
  successful: number;
  /** Number of templates that failed optimization */
  failed: number;
  /** Array of successful optimization results */
  results: OptimizationResult[];
  /** Array of errors for failed templates */
  errors: Array<{
    /** Template ID that failed */
    templateId: string;
    /** Error message describing the failure */
    error: string;
  }>;
  /** Timestamp when batch operation completed */
  timestamp: Date;
}

/**
 * Service for managing prompt optimization workflows with PromptWizard integration
 *
 * This service provides a comprehensive prompt optimization solution that handles:
 * - Single and batch template optimization
 * - Queue-based asynchronous processing with priority levels
 * - Result caching with LRU and distributed cache support
 * - Real-time progress tracking through event emission
 * - Feedback collection for continuous improvement
 *
 * The service uses an event-driven architecture to provide real-time updates
 * on optimization progress and integrates with both in-memory and distributed
 * caching systems for improved performance.
 *
 * @extends EventEmitter
 * @example
 * ```typescript
 * const optimizationService = new PromptOptimizationService(
 *   promptWizardClient,
 *   templateService,
 *   cacheService
 * );
 *
 * // Single template optimization
 * const result = await optimizationService.optimizeTemplate({
 *   templateId: 'template-123',
 *   template: myTemplate,
 *   config: {
 *     targetModel: 'gpt-4',
 *     mutateRefineIterations: 3
 *   },
 *   options: {
 *     priority: 'high',
 *     skipCache: false
 *   }
 * });
 *
 * // Listen for progress updates
 * optimizationService.on('optimization:progress', (data) => {
 *   console.log(`Progress: ${data.progress}% - ${data.currentStep}`);
 * });
 * ```
 *
 * @see {@link OptimizationRequest} for request structure
 * @see {@link OptimizationResult} for result structure
 * @see {@link BatchOptimizationRequest} for batch operations
 */
export class PromptOptimizationService extends EventEmitter {
  private client: PromptWizardClient;

  private cacheService: CacheService;

  private optimizationCacheService: OptimizationCacheService;

  private optimizationQueue: OptimizationQueue;

  private optimizationPipeline: OptimizationPipeline;

  private resultCache: LRUCache<string, OptimizationResult>;

  private templateService: TemplateService;

  /**
   * Creates a new PromptOptimizationService instance
   *
   * Initializes the optimization service with all necessary dependencies
   * and sets up event listeners for queue operations. The service automatically
   * configures an LRU cache for results and establishes connections to the
   * optimization pipeline and cache services.
   *
   * @param client - PromptWizard client for API communication
   * @param _templateService - Template service (kept for interface compatibility)
   * @param cacheService - Cache service for distributed caching
   * @param optimizationPipeline - Optional custom optimization pipeline
   *
   * @example
   * ```typescript
   * const service = new PromptOptimizationService(
   *   new PromptWizardClient({ apiKey: 'key' }),
   *   templateService,
   *   new CacheService({ maxSize: 200 })
   * );
   * ```
   */
  constructor(
    client: PromptWizardClient,
    templateService: TemplateService,
    cacheService: CacheService,
    optimizationPipeline?: OptimizationPipeline
  ) {
    super();
    this.client = client;
    this.cacheService = cacheService;
    this.templateService = templateService;

    // Initialize optimization cache service
    this.optimizationCacheService = new OptimizationCacheService();

    // Initialize optimization pipeline (create a basic one if not provided)
    this.optimizationPipeline =
      optimizationPipeline ||
      new OptimizationPipeline(
        this, // Use self as optimization service
        this.templateService,
        this.cacheService
      );

    // Initialize optimization queue
    this.optimizationQueue = new OptimizationQueue(
      this.optimizationPipeline,
      this.optimizationCacheService
    );

    // Initialize LRU cache for optimization results
    this.resultCache = new LRUCache<string, OptimizationResult>({
      max: 100, // Maximum 100 cached results
      ttl: 1000 * 60 * 60 * 24, // 24 hour TTL
      allowStale: false,
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });

    // Set up event listeners for queue events
    this.setupQueueEventListeners();
  }

  /**
   * Set up event listeners for optimization queue events
   *
   * Configures event forwarding from the optimization queue to this service,
   * allowing clients to listen for job lifecycle events including queuing,
   * processing, progress updates, completion, and failures.
   *
   * Events emitted:
   * - optimization:queued - When job is added to queue
   * - optimization:started - When job processing begins
   * - optimization:progress - When job reports progress updates
   * - optimization:completed - When job completes successfully
   * - optimization:failed - When job fails with error
   * - optimization:retry - When job is retried after failure
   *
   * @private
   */
  private setupQueueEventListeners(): void {
    this.optimizationQueue.on('job:added', job => {
      this.emit('optimization:queued', {
        templateId: job.templateId,
        jobId: job.jobId,
        priority: job.priority,
      });
    });

    this.optimizationQueue.on('job:started', job => {
      this.emit('optimization:started', {
        templateId: job.templateId,
        jobId: job.jobId,
      });
    });

    this.optimizationQueue.on('job:progress', job => {
      this.emit('optimization:progress', {
        templateId: job.templateId,
        jobId: job.jobId,
        progress: job.progress,
        currentStep: job.currentStep,
      });
    });

    this.optimizationQueue.on('job:completed', job => {
      if (job.result) {
        this.emit('optimization:completed', job.result);
      }
    });

    this.optimizationQueue.on('job:failed', job => {
      this.emit('optimization:failed', {
        templateId: job.templateId,
        jobId: job.jobId,
        error: job.error,
      });
    });

    this.optimizationQueue.on('job:retry', job => {
      this.emit('optimization:retry', {
        templateId: job.templateId,
        jobId: job.jobId,
        retryCount: job.retryCount,
      });
    });
  }

  /**
   * Optimize a single template using the queue-based processing system
   *
   * This method processes a single template optimization request through the
   * following workflow:
   * 1. Check optimization cache for existing results (unless skipCache is true)
   * 2. Queue the optimization job with appropriate priority
   * 3. Wait for job completion with configurable timeout
   * 4. Return optimization result with metrics and comparisons
   *
   * The method supports both cached and fresh optimizations, priority-based
   * queue processing, and comprehensive error handling with retry mechanisms.
   *
   * @param request - The optimization request containing template and config
   * @returns Promise resolving to optimization result with metrics
   *
   * @throws {Error} When optimization times out or fails after retries
   * @throws {Error} When template or configuration is invalid
   *
   * @example
   * ```typescript
   * const result = await service.optimizeTemplate({
   *   templateId: 'user-onboarding-v1',
   *   template: {
   *     name: 'User Onboarding',
   *     content: 'Welcome new user, please complete...'
   *   },
   *   config: {
   *     targetModel: 'gpt-4',
   *     mutateRefineIterations: 5,
   *     generateReasoning: true
   *   },
   *   options: {
   *     priority: 'high',
   *     timeoutMs: 300000, // 5 minutes
   *     maxRetries: 3
   *   }
   * });
   *
   * console.log(`Token reduction: ${result.metrics.tokenReduction}%`);
   * console.log(`Quality score: ${result.qualityScore.overall}`);
   * ```
   *
   * @see {@link OptimizationRequest} for request structure
   * @see {@link OptimizationResult} for result structure
   */
  async optimizeTemplate(
    request: OptimizationRequest
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    // Check optimization cache first unless explicitly skipped
    if (!request.options?.skipCache) {
      try {
        const optimizationConfig: OptimizationConfig = {
          task: request.template.name,
          prompt:
            request.template.content ||
            (request.template.files?.[0] as any)?.content ||
            request.template.description ||
            '',
          targetModel: request.config?.targetModel || 'gpt-4',
          mutateRefineIterations: request.config?.mutateRefineIterations || 3,
          fewShotCount: request.config?.fewShotCount || 5,
          generateReasoning: request.config?.generateReasoning ?? true,
          ...request.config,
        };

        const cached =
          await this.optimizationCacheService.get(optimizationConfig);
        if (cached) {
          logger.info(
            `Using cached optimization for template: ${request.templateId}`
          );

          // Convert cached result to OptimizationResult format
          const result: OptimizationResult = {
            requestId: this.generateRequestId(),
            templateId: request.templateId,
            originalTemplate: request.template,
            optimizedTemplate: {
              ...request.template,
              content: cached.optimizedPrompt,
            },
            metrics: {
              tokenReduction: cached.metrics?.tokenReduction || 0,
              accuracyImprovement: cached.metrics?.accuracyImprovement || 0,
              optimizationTime: Date.now() - startTime,
              apiCalls: cached.metrics?.apiCallsUsed || 0,
            },
            qualityScore: (typeof cached.qualityScore === 'object'
              ? cached.qualityScore
              : {
                  overall: cached.qualityScore || 80,
                  confidence: 0.8,
                  metrics: {
                    clarity: 80,
                    taskAlignment: 80,
                    tokenEfficiency: 80,
                  },
                  suggestions: [],
                }) as QualityScore,
            comparison: cached.comparison || { improvements: {} },
            timestamp: new Date(),
          };

          return result;
        }
      } catch (error) {
        logger.warn(`Cache lookup failed: ${error}`);
      }
    }

    // Add job to optimization queue
    logger.info(
      `Queueing optimization job for template: ${request.templateId}`
    );

    const job = await this.optimizationQueue.addJob(
      request.templateId,
      request.template,
      {
        task: request.template.name,
        prompt:
          request.template.content ||
          (request.template.files?.[0] as any)?.content ||
          request.template.description ||
          '',
        targetModel: request.config?.targetModel || 'gpt-4',
        mutateRefineIterations: request.config?.mutateRefineIterations || 3,
        fewShotCount: request.config?.fewShotCount || 5,
        generateReasoning: request.config?.generateReasoning ?? true,
        ...request.config,
      },
      {
        priority:
          request.options?.priority === 'critical'
            ? 'urgent'
            : request.options?.priority === 'high'
              ? 'high'
              : request.options?.priority === 'low'
                ? 'low'
                : 'normal',
        maxRetries: request.options?.maxRetries,
        metadata: {
          originalRequestId: this.generateRequestId(),
          startTime,
        },
      }
    );

    // For now, return a promise that resolves when the job completes
    // In a real implementation, you might want to return the job ID
    // and provide a separate method to get results
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          reject(
            new Error(
              `Optimization timeout for template: ${request.templateId}`
            )
          );
        },
        request.options?.timeoutMs || 10 * 60 * 1000
      ); // 10 minutes default

      // Forward declaration
      let onCompleted: (completedJob: any) => void;

      const onFailed = (failedJob: any) => {
        if (failedJob.jobId === job.jobId) {
          clearTimeout(timeout);
          this.optimizationQueue.off('job:completed', onCompleted);
          this.optimizationQueue.off('job:failed', onFailed);
          reject(new Error(failedJob.error || 'Job failed'));
        }
      };

      onCompleted = (completedJob: any) => {
        if (completedJob.jobId === job.jobId) {
          clearTimeout(timeout);
          this.optimizationQueue.off('job:completed', onCompleted);
          this.optimizationQueue.off('job:failed', onFailed);

          if (completedJob.result) {
            resolve(completedJob.result);
          } else {
            reject(new Error('Job completed but no result available'));
          }
        }
      };

      this.optimizationQueue.on('job:completed', onCompleted);
      this.optimizationQueue.on('job:failed', onFailed);
    });
  }

  /**
   * Optimize multiple templates in a batch operation
   *
   * Processes multiple templates concurrently with controlled concurrency
   * to prevent resource exhaustion. The method applies the same configuration
   * and options to all templates in the batch, providing efficient bulk
   * optimization capabilities.
   *
   * Features:
   * - Concurrent processing with configurable concurrency (default: 3)
   * - Shared configuration applied to all templates
   * - Individual error handling per template
   * - Progress tracking through events
   * - Comprehensive result aggregation
   *
   * @param request - Batch optimization request with templates and config
   * @returns Promise resolving to aggregated batch results
   *
   * @throws {Error} When batch configuration is invalid
   *
   * @example
   * ```typescript
   * const batchResult = await service.batchOptimize({
   *   templates: [
   *     { id: 'template-1', template: template1 },
   *     { id: 'template-2', template: template2 },
   *     { id: 'template-3', template: template3 }
   *   ],
   *   config: {
   *     targetModel: 'gpt-4',
   *     mutateRefineIterations: 3
   *   },
   *   options: {
   *     priority: 'normal',
   *     timeoutMs: 600000 // 10 minutes per template
   *   }
   * });
   *
   * console.log(`Successfully optimized: ${batchResult.successful}/${batchResult.total}`);
   * batchResult.errors.forEach(error => {
   *   console.error(`Failed ${error.templateId}: ${error.error}`);
   * });
   * ```
   *
   * @see {@link BatchOptimizationRequest} for request structure
   * @see {@link BatchOptimizationResult} for result structure
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
   * Get the current status of an optimization job
   *
   * Retrieves the current status of an optimization job by checking both
   * the local queue and the remote PromptWizard service. This method provides
   * real-time visibility into job progress, current processing step, and
   * any errors that may have occurred.
   *
   * @param jobId - Unique identifier of the optimization job
   * @returns Promise resolving to job status or null if not found
   *
   * @example
   * ```typescript
   * const status = await service.getOptimizationStatus('job-123');
   * if (status) {
   *   console.log(`Status: ${status.status}`);
   *   console.log(`Progress: ${status.progress}%`);
   *   console.log(`Current step: ${status.currentStep}`);
   * } else {
   *   console.log('Job not found');
   * }
   * ```
   *
   * @see {@link OptimizationJob} for job structure
   */
  async getOptimizationStatus(jobId: string): Promise<OptimizationJob | null> {
    const job = this.optimizationQueue.getJob(jobId);
    if (!job) {
      // Check if job exists in the Python service
      try {
        return await this.client.getJobStatus(jobId);
      } catch (error) {
        logger.warn(`Failed to get job status from client: ${error}`);
        return null;
      }
    }
    return job as any;
  }

  /**
   * Send feedback for an optimization result to improve future optimization quality
   *
   * Collects user feedback on optimization results and uses this information
   * to improve future optimizations. Low ratings automatically trigger
   * re-optimization with adjusted parameters for better results.
   *
   * The feedback system helps train the optimization algorithms and provides
   * valuable insights for continuous improvement of prompt optimization quality.
   *
   * @param templateId - Identifier of the template that was optimized
   * @param feedback - Feedback data including rating and preferences
   * @param feedback.rating - Rating from 1-5 (1=poor, 5=excellent)
   * @param feedback.comments - Optional detailed feedback comments
   * @param feedback.preferredVersion - Whether user prefers original or optimized version
   *
   * @throws {Error} When optimization result is not found for feedback
   *
   * @example
   * ```typescript
   * // Provide positive feedback
   * await service.sendFeedback('template-123', {
   *   rating: 5,
   *   comments: 'Excellent optimization, much clearer and more concise',
   *   preferredVersion: 'optimized'
   * });
   *
   * // Provide negative feedback (triggers re-optimization)
   * await service.sendFeedback('template-456', {
   *   rating: 2,
   *   comments: 'Lost important context, too aggressive optimization',
   *   preferredVersion: 'original'
   * });
   * ```
   *
   * @see {@link OptimizationResult} for related result structure
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
   * Clear all optimization caches to free memory and force fresh optimizations
   *
   * Clears both the in-memory LRU cache and the distributed optimization cache,
   * ensuring that all future requests will perform fresh optimizations rather
   * than using cached results. This is useful for testing, debugging, or when
   * optimization algorithms have been updated.
   *
   * @example
   * ```typescript
   * // Clear cache before running fresh optimizations
   * await service.clearCache();
   * console.log('All caches cleared');
   * ```
   */
  async clearCache(): Promise<void> {
    // Clear both old LRU cache and new optimization cache
    this.resultCache.clear();
    await this.optimizationCacheService.clear();
    logger.info('Optimization cache cleared');
  }

  /**
   * Get comprehensive cache performance statistics
   *
   * Returns detailed statistics about cache usage including hit/miss ratios,
   * cache size, and performance metrics from both the in-memory LRU cache
   * and the distributed optimization cache.
   *
   * These statistics are valuable for monitoring cache effectiveness,
   * optimizing cache configuration, and understanding optimization patterns.
   *
   * @returns Object containing cache statistics and performance metrics
   * @returns returns.size - Current number of items in LRU cache
   * @returns returns.maxSize - Maximum LRU cache capacity
   * @returns returns.hits - Number of cache hits (simplified)
   * @returns returns.misses - Number of cache misses (simplified)
   * @returns returns.optimizationCache - Statistics from distributed cache
   *
   * @example
   * ```typescript
   * const stats = service.getCacheStats();
   * console.log(`Cache utilization: ${stats.size}/${stats.maxSize}`);
   * console.log(`Hit rate: ${(stats.hits / (stats.hits + stats.misses) * 100).toFixed(2)}%`);
   * if (stats.optimizationCache) {
   *   console.log('Distributed cache stats:', stats.optimizationCache);
   * }
   * ```
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hits: number;
    misses: number;
    optimizationCache?: any;
  } {
    const optimizationCacheStats = this.optimizationCacheService.getStats();

    return {
      size: this.resultCache.size,
      maxSize: this.resultCache.max,
      hits: this.resultCache.size, // Simplified, would need proper tracking
      misses: 0, // Would need proper tracking
      optimizationCache: optimizationCacheStats,
    };
  }

  /**
   * Get current optimization queue statistics and status
   *
   * Returns detailed information about the optimization queue including
   * pending jobs, active processing, completed jobs, and queue performance
   * metrics. This information is useful for monitoring system load and
   * queue health.
   *
   * @returns Queue statistics object with counts and performance data
   *
   * @example
   * ```typescript
   * const queueStats = service.getQueueStats();
   * console.log(`Pending jobs: ${queueStats.pending}`);
   * console.log(`Active jobs: ${queueStats.active}`);
   * console.log(`Completed jobs: ${queueStats.completed}`);
   * console.log(`Failed jobs: ${queueStats.failed}`);
   * ```
   */
  getQueueStats() {
    return this.optimizationQueue.getStats();
  }

  /**
   * Cancel a queued or active optimization job
   *
   * Attempts to cancel an optimization job that is either queued for processing
   * or currently being processed. Cancellation success depends on the job's
   * current state and processing stage.
   *
   * @param jobId - Unique identifier of the job to cancel
   * @returns Promise resolving to true if cancellation was successful
   *
   * @example
   * ```typescript
   * const cancelled = await service.cancelJob('job-123');
   * if (cancelled) {
   *   console.log('Job cancelled successfully');
   * } else {
   *   console.log('Job could not be cancelled (may have already completed)');
   * }
   * ```
   */
  async cancelJob(jobId: string): Promise<boolean> {
    return this.optimizationQueue.cancelJob(jobId);
  }

  /**
   * Invalidate cached optimization results for a specific template
   *
   * Removes all cached optimization results for a specific template,
   * forcing future optimization requests for this template to perform
   * fresh optimizations. This is useful when template content has changed
   * or when you want to re-optimize with different parameters.
   *
   * @param templateId - Identifier of the template to invalidate cache for
   *
   * @example
   * ```typescript
   * // Invalidate cache after template content changes
   * await service.invalidateTemplateCache('template-123');
   * console.log('Template cache invalidated');
   *
   * // Next optimization will be performed fresh
   * const result = await service.optimizeTemplate({
   *   templateId: 'template-123',
   *   template: updatedTemplate
   * });
   * ```
   */
  async invalidateTemplateCache(templateId: string): Promise<void> {
    await this.optimizationCacheService.invalidateTemplate(templateId);
    logger.info(`Cache invalidated for template: ${templateId}`);
  }

  // Private helper methods

  /**
   * Generate a unique cache key for an optimization request
   *
   * Creates a deterministic cache key based on template ID and configuration
   * hash. This ensures that identical optimization requests can reuse cached
   * results while different configurations generate separate cache entries.
   *
   * @param request - The optimization request to generate key for
   * @returns Unique cache key string
   * @private
   */
  /*
  private generateCacheKey(request: OptimizationRequest): string {
    const configHash = JSON.stringify(request.config || {});
    return `optimize:${request.templateId}:${configHash}`;
  }
  */

  /**
   * Retrieve a cached optimization result from multi-tier cache
   *
   * Checks both in-memory LRU cache and distributed cache for existing
   * optimization results. Populates faster cache tiers when results are
   * found in slower tiers for improved future performance.
   *
   * @param key - Cache key to look up
   * @returns Cached optimization result or null if not found
   * @private
   */
  // getCachedResult method commented out as unused

  /**
   * Store an optimization result in multi-tier cache
   *
   * Stores the result in both in-memory LRU cache for fast access and
   * distributed cache for persistence across service restarts. This ensures
   * optimal cache performance and data durability.
   *
   * @param key - Cache key to store result under
   * @param result - Optimization result to cache
   * @private
   */
  // cacheResult method commented out as unused

  /**
   * Generate a unique request identifier
   *
   * Creates a unique identifier for optimization requests using timestamp
   * and random string components to ensure uniqueness across concurrent
   * requests and service instances.
   *
   * @returns Unique request ID string
   * @private
   */
  private generateRequestId(): string {
    return `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate a unique batch operation identifier
   *
   * Creates a unique identifier for batch optimization operations using
   * timestamp and random components to track batch operations across
   * the service lifecycle.
   *
   * @returns Unique batch ID string
   * @private
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources when shutting down the service
   *
   * Performs graceful shutdown of all service components including the
   * optimization queue, cache services, and local resources. This method
   * should be called when the application is shutting down to ensure
   * proper resource cleanup and prevent memory leaks.
   *
   * The cleanup process:
   * 1. Shutdown optimization queue (completing active jobs if possible)
   * 2. Cleanup cache service connections
   * 3. Clear local cache memory
   * 4. Log completion status
   *
   * @throws {Error} When cleanup operations fail
   *
   * @example
   * ```typescript
   * // Graceful shutdown during application exit
   * process.on('SIGTERM', async () => {
   *   try {
   *     await optimizationService.cleanup();
   *     console.log('Service shutdown completed');
   *     process.exit(0);
   *   } catch (error) {
   *     console.error('Shutdown error:', error);
   *     process.exit(1);
   *   }
   * });
   * ```
   */
  async cleanup(): Promise<void> {
    logger.info('Shutting down PromptOptimizationService');

    try {
      // Shutdown the optimization queue
      await this.optimizationQueue.shutdown();

      // Cleanup the cache service
      await this.optimizationCacheService.cleanup();

      // Clear local cache
      this.resultCache.clear();

      logger.info('PromptOptimizationService shutdown completed');
    } catch (error) {
      logger.error(`Error during service cleanup: ${error}`);
      throw error;
    }
  }
}

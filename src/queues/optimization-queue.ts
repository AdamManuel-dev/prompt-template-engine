/**
 * @fileoverview Job queue system for optimization tasks with priority scheduling and progress tracking
 * @lastmodified 2025-08-26T16:00:00Z
 *
 * Features: Priority queue, job progress tracking, failure handling, retry mechanism
 * Main APIs: addJob(), processJobs(), getJobStatus(), cancelJob()
 * Constraints: In-memory queue with optional Redis backing
 * Patterns: Producer-consumer, priority queue, job state machine
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { OptimizationPipeline } from '../core/optimization-pipeline';
import { OptimizationCacheService } from '../services/optimization-cache.service';
import { getPromptWizardConfig } from '../config/promptwizard.config';
import { Template } from '../types/index';
import {
  OptimizationRequest,
  OptimizationResult,
  PipelineResult,
} from '../integrations/promptwizard/types';

// Optional Bull Queue support for Redis-backed job queues
let Queue: any;
// let _Job: any; // Commented out as unused
try {
  const bullModule = require('bull');
  Queue = bullModule.default || bullModule.Queue || bullModule;
  // _Job = bullModule.Job; // Commented out as unused
} catch (_error) {
  // Bull not available - fallback to in-memory queue
  Queue = null;
  // _Job = null; // Not used
}

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface OptimizationJob {
  jobId: string;
  templateId: string;
  template: Template;
  request: OptimizationRequest;
  priority: JobPriority;
  status: JobStatus;
  progress: number;
  currentStep?: string;
  result?: OptimizationResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  metadata?: Record<string, unknown>;
}

export interface QueueStats {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  averageProcessingTime: number;
  successRate: number;
  activeWorkers: number;
  queueLength: number;
}

export interface QueueConfig {
  maxConcurrency: number;
  defaultPriority: JobPriority;
  maxRetries: number;
  retryDelay: number; // milliseconds
  jobTimeout: number; // milliseconds
  cleanupInterval: number; // milliseconds
  maxJobHistory: number;
  // Bull queue configuration
  useBull?: boolean;
  redisUrl?: string;
  queueName?: string;
  bullOptions?: {
    removeOnComplete?: number;
    removeOnFail?: number;
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
  };
}

export class OptimizationQueue extends EventEmitter {
  private jobs = new Map<string, OptimizationJob>();

  private pendingQueue: OptimizationJob[] = [];

  private processingJobs = new Set<string>();

  private workers: Map<string, Promise<void>> = new Map();

  private optimizationPipeline: OptimizationPipeline;

  // private _cacheService: OptimizationCacheService; // Commented out as unused

  private config: QueueConfig;

  private isProcessing = false;

  private cleanupTimer?: NodeJS.Timeout;

  // Bull queue integration
  private bullQueue?: any;

  private useBull = false;

  constructor(
    optimizationPipeline: OptimizationPipeline,
    _cacheService: OptimizationCacheService,
    config: Partial<QueueConfig> = {}
  ) {
    super();

    this.optimizationPipeline = optimizationPipeline;
    // this._cacheService = cacheService; // Commented out as unused

    // Get PromptWizard configuration for Redis settings
    const promptwizardConfig = getPromptWizardConfig();

    this.config = {
      maxConcurrency: 3,
      defaultPriority: 'normal',
      maxRetries: 3,
      retryDelay: 5000,
      jobTimeout: 10 * 60 * 1000, // 10 minutes
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      maxJobHistory: 1000,
      // Bull configuration from PromptWizard config
      useBull: Queue !== null && promptwizardConfig.cache.redis?.enabled,
      redisUrl: promptwizardConfig.cache.redis?.url,
      queueName: 'optimization-jobs',
      bullOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
      ...config,
    };

    // Initialize Bull queue if available and configured
    this.initializeBullQueue();

    // Setup periodic cleanup
    this.setupPeriodicCleanup();

    logger.info(
      `Optimization queue initialized - ${JSON.stringify({
        maxConcurrency: this.config.maxConcurrency,
        maxRetries: this.config.maxRetries,
        useBull: this.useBull,
      })}`
    );
  }

  /**
   * Add optimization job to queue
   */
  async addJob(
    templateId: string,
    template: Template,
    request: OptimizationRequest,
    options: {
      priority?: JobPriority;
      maxRetries?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<OptimizationJob> {
    const job: OptimizationJob = {
      jobId: this.generateJobId(),
      templateId,
      template,
      request,
      priority: options.priority || this.config.defaultPriority,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
      metadata: options.metadata,
    };

    // Store job
    this.jobs.set(job.jobId, job);

    if (this.useBull && this.bullQueue) {
      // Use Bull queue for Redis-backed processing
      const bullPriority = this.mapPriorityToBull(job.priority);

      try {
        const bullJob = await this.bullQueue.add(
          'optimize',
          {
            templateId,
            template,
            request,
            options,
            jobId: job.jobId,
          },
          {
            priority: bullPriority,
            attempts: job.maxRetries,
            delay: 0,
            jobId: job.jobId,
          }
        );

        logger.info(
          `Optimization job added to Bull queue - ${JSON.stringify({
            jobId: job.jobId,
            bullJobId: bullJob.id,
            templateId,
            priority: job.priority,
          })}`
        );
      } catch (error) {
        logger.warn(
          `Failed to add job to Bull queue, using in-memory fallback: ${error}`
        );
        // Fall back to in-memory queue
        this.insertJobByPriority(job);
        this.startProcessing();
      }
    } else {
      // Use in-memory queue
      this.insertJobByPriority(job);

      logger.info(
        `Optimization job added to queue - ${JSON.stringify({
          jobId: job.jobId,
          templateId,
          priority: job.priority,
          queueLength: this.pendingQueue.length,
        })}`
      );

      // Start processing if not already running
      this.startProcessing();
    }

    this.emit('job:added', job);
    return job;
  }

  /**
   * Get job status
   */
  getJob(jobId: string): OptimizationJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (
      job.status === 'completed' ||
      job.status === 'failed' ||
      job.status === 'cancelled'
    ) {
      return false; // Cannot cancel completed/failed/cancelled jobs
    }

    if (job.status === 'pending') {
      // Remove from pending queue
      const index = this.pendingQueue.findIndex(j => j.jobId === jobId);
      if (index > -1) {
        this.pendingQueue.splice(index, 1);
      }
    }

    if (job.status === 'processing') {
      // Mark for cancellation - the worker will check this flag
      this.processingJobs.delete(jobId);
    }

    job.status = 'cancelled';
    job.completedAt = new Date();

    logger.info(`Optimization job cancelled - ${JSON.stringify({ jobId })}`);
    this.emit('job:cancelled', job);

    return true;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const totalJobs = this.jobs.size;
    const jobsByStatus = this.getJobsByStatus();

    // Calculate average processing time
    const completedJobs = Array.from(this.jobs.values()).filter(
      job => job.status === 'completed' && job.startedAt && job.completedAt
    );

    const averageProcessingTime =
      completedJobs.length > 0
        ? completedJobs.reduce(
            (sum, job) =>
              sum + (job.completedAt!.getTime() - job.startedAt!.getTime()),
            0
          ) / completedJobs.length
        : 0;

    // Calculate success rate
    const finishedJobs = jobsByStatus.completed + jobsByStatus.failed;
    const successRate =
      finishedJobs > 0 ? jobsByStatus.completed / finishedJobs : 1;

    return {
      totalJobs,
      pendingJobs: jobsByStatus.pending,
      processingJobs: jobsByStatus.processing,
      completedJobs: jobsByStatus.completed,
      failedJobs: jobsByStatus.failed,
      cancelledJobs: jobsByStatus.cancelled,
      averageProcessingTime,
      successRate,
      activeWorkers: this.workers.size,
      queueLength: this.pendingQueue.length,
    };
  }

  /**
   * Clear completed jobs from history
   */
  cleanup(): void {
    const jobsArray = Array.from(this.jobs.values());

    // Sort by completion time (most recent first)
    const completedJobs = jobsArray
      .filter(
        job =>
          job.status === 'completed' ||
          job.status === 'failed' ||
          job.status === 'cancelled'
      )
      .sort(
        (a, b) =>
          (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
      );

    // Keep only the most recent jobs up to maxJobHistory
    const jobsToRemove = completedJobs.slice(this.config.maxJobHistory);

    jobsToRemove.forEach(job => {
      this.jobs.delete(job.jobId);
    });

    if (jobsToRemove.length > 0) {
      logger.info(
        `Queue cleanup completed - ${JSON.stringify({
          jobsRemoved: jobsToRemove.length,
          totalJobs: this.jobs.size,
        })}`
      );
    }
  }

  /**
   * Start job processing
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    // Start workers up to max concurrency
    while (
      this.workers.size < this.config.maxConcurrency &&
      this.pendingQueue.length > 0
    ) {
      this.startWorker();
    }

    // Check if we should stop processing
    if (this.pendingQueue.length === 0 && this.workers.size === 0) {
      this.isProcessing = false;
    }
  }

  /**
   * Start a worker to process jobs
   */
  private startWorker(): void {
    const workerId = this.generateWorkerId();

    const workerPromise = this.runWorker(workerId);
    this.workers.set(workerId, workerPromise);

    workerPromise
      .catch(error => {
        logger.error(`Worker error - ${JSON.stringify({ workerId, error })}`);
      })
      .finally(() => {
        this.workers.delete(workerId);

        // Start new worker if there are pending jobs
        if (
          this.pendingQueue.length > 0 &&
          this.workers.size < this.config.maxConcurrency
        ) {
          this.startWorker();
        } else if (this.pendingQueue.length === 0 && this.workers.size === 0) {
          this.isProcessing = false;
        }
      });
  }

  /**
   * Run worker to process jobs
   */
  private async runWorker(workerId: string): Promise<void> {
    logger.debug(`Worker started - ${JSON.stringify({ workerId })}`);

    while (this.pendingQueue.length > 0) {
      const job = this.pendingQueue.shift();
      if (!job) break;

      // Check if job was cancelled while waiting
      if (job.status === 'cancelled') {
        continue;
      }

      await this.processJob(job, workerId);

      // Small delay to prevent overwhelming the system
      await this.delay(100);
    }

    logger.debug(`Worker finished - ${JSON.stringify({ workerId })}`);
  }

  /**
   * Process a single job
   */
  private async processJob(
    job: OptimizationJob,
    workerId: string
  ): Promise<void> {
    try {
      // Mark job as processing
      job.status = 'processing';
      job.startedAt = new Date();
      job.progress = 0;
      this.processingJobs.add(job.jobId);

      logger.info(
        `Processing optimization job - ${JSON.stringify({
          jobId: job.jobId,
          workerId,
          templateId: job.templateId,
          priority: job.priority,
        })}`
      );

      this.emit('job:started', job);

      // Set up job timeout
      const timeoutPromise = this.createJobTimeout(job);

      // Set up progress callback
      // Progress callback commented out as unused
      // const _progressCallback = (stage: any, progress: number) => {
      //   job.currentStep = stage;
      //   job.progress = progress;
      //   this.emit('job:progress', job);
      // };

      // Process job with timeout
      const processingPromise = this.optimizationPipeline.process(
        job.templateId,
        job.template,
        job.request
      );

      const result = (await Promise.race([
        processingPromise,
        timeoutPromise,
      ])) as PipelineResult;

      // Clear timeout
      clearTimeout(timeoutPromise as any);

      if (result.success && result.optimizationResult) {
        // Job completed successfully
        job.status = 'completed';
        job.result = result.optimizationResult;
        job.progress = 100;
        job.completedAt = new Date();

        logger.info(
          `Optimization job completed - ${JSON.stringify({
            jobId: job.jobId,
            templateId: job.templateId,
            processingTime:
              job.completedAt.getTime() - job.startedAt!.getTime(),
          })}`
        );

        this.emit('job:completed', job);
      } else {
        // Job failed
        const errorMessage =
          typeof result.error === 'string'
            ? result.error
            : 'Pipeline processing failed';
        throw new Error(errorMessage);
      }
    } catch (error) {
      await this.handleJobError(
        job,
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      this.processingJobs.delete(job.jobId);
    }
  }

  /**
   * Handle job error with retry logic
   */
  private async handleJobError(
    job: OptimizationJob,
    error: Error
  ): Promise<void> {
    job.error = error.message;
    job.retryCount++;

    logger.warn(
      `Optimization job failed - ${JSON.stringify({
        jobId: job.jobId,
        error: error.message,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
      })}`
    );

    if (job.retryCount < job.maxRetries) {
      // Retry job after delay
      job.status = 'pending';
      job.progress = 0;
      job.currentStep = undefined;

      logger.info(
        `Retrying optimization job - ${JSON.stringify({
          jobId: job.jobId,
          retryCount: job.retryCount,
          delay: this.config.retryDelay,
        })}`
      );

      // Add back to queue after delay
      setTimeout(() => {
        this.insertJobByPriority(job);
        this.startProcessing();
      }, this.config.retryDelay);

      this.emit('job:retry', job);
    } else {
      // Max retries reached, mark as failed
      job.status = 'failed';
      job.completedAt = new Date();

      logger.error(
        `Optimization job failed permanently - ${JSON.stringify({
          jobId: job.jobId,
          error: error.message,
          retryCount: job.retryCount,
        })}`
      );

      this.emit('job:failed', job);
    }
  }

  /**
   * Create job timeout promise
   */
  private createJobTimeout(_job: OptimizationJob): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Job timeout after ${this.config.jobTimeout}ms`));
      }, this.config.jobTimeout);
    });
  }

  /**
   * Insert job into pending queue by priority
   */
  private insertJobByPriority(job: OptimizationJob): void {
    const priorityOrder: Record<JobPriority, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    const insertIndex = this.pendingQueue.findIndex(
      existingJob =>
        priorityOrder[existingJob.priority] > priorityOrder[job.priority]
    );

    if (insertIndex === -1) {
      this.pendingQueue.push(job);
    } else {
      this.pendingQueue.splice(insertIndex, 0, job);
    }
  }

  /**
   * Get jobs grouped by status
   */
  private getJobsByStatus(): Record<JobStatus, number> {
    const counts: Record<JobStatus, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const job of this.jobs.values()) {
      counts[job.status]++;
    }

    return counts;
  }

  /**
   * Initialize Bull queue if available
   */
  private initializeBullQueue(): void {
    if (!this.config.useBull || !Queue || !this.config.redisUrl) {
      this.useBull = false;
      logger.info(
        'Using in-memory job queue (Bull not available or not configured)'
      );
      return;
    }

    try {
      this.bullQueue = new Queue(this.config.queueName, this.config.redisUrl, {
        defaultJobOptions: {
          removeOnComplete: this.config.bullOptions?.removeOnComplete || 100,
          removeOnFail: this.config.bullOptions?.removeOnFail || 50,
          attempts: this.config.bullOptions?.attempts || this.config.maxRetries,
          backoff: this.config.bullOptions?.backoff || {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      this.useBull = true;

      // Set up Bull event listeners
      this.bullQueue.on('completed', (job: any, result: any) => {
        logger.debug(`Bull job completed: ${job.id}`);
        this.emit('job:completed', { jobId: job.id, result });
      });

      this.bullQueue.on('failed', (job: any, err: Error) => {
        logger.warn(`Bull job failed: ${job.id} - ${err.message}`);
        this.emit('job:failed', { jobId: job.id, error: err.message });
      });

      this.bullQueue.on('progress', (job: any, progress: number) => {
        this.emit('job:progress', { jobId: job.id, progress });
      });

      // Process jobs with Bull
      this.bullQueue.process(this.config.maxConcurrency, async (job: any) =>
        this.processBullJob(job)
      );

      logger.info('Bull queue initialized successfully');
    } catch (error) {
      logger.warn(
        `Failed to initialize Bull queue, falling back to in-memory: ${error}`
      );
      this.useBull = false;
      this.bullQueue = undefined;
    }
  }

  /**
   * Process a Bull job
   */
  private async processBullJob(bullJob: any): Promise<any> {
    const { templateId, template, request, options: _options } = bullJob.data;

    try {
      // Update job progress
      await bullJob.progress(10);

      // Process optimization
      const result = await this.optimizationPipeline.process(
        templateId,
        template,
        request
      );

      await bullJob.progress(100);

      if (result.success && result.optimizationResult) {
        return result.optimizationResult;
      }
      throw new Error(
        typeof result.error === 'string'
          ? result.error
          : 'Pipeline processing failed'
      );
    } catch (error) {
      logger.error(`Bull job processing failed: ${error}`);
      throw error;
    }
  }

  /**
   * Setup periodic cleanup
   */
  private setupPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Map job priority to Bull priority (higher number = higher priority in Bull)
   */
  private mapPriorityToBull(priority: JobPriority): number {
    const priorityMap: Record<JobPriority, number> = {
      urgent: 10,
      high: 5,
      normal: 0,
      low: -5,
    };
    return priorityMap[priority];
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Generate unique worker ID
   */
  private generateWorkerId(): string {
    return `worker_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    logger.info(`Shutting down optimization queue`);

    // Clear cleanup timer
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
    }

    // Shutdown Bull queue if using it
    if (this.useBull && this.bullQueue) {
      try {
        await this.bullQueue.close();
        logger.info('Bull queue closed successfully');
      } catch (error) {
        logger.warn(`Error closing Bull queue: ${error}`);
      }
    }

    // Wait for all workers to complete
    await Promise.all(Array.from(this.workers.values()));

    // Cancel all pending jobs
    for (const job of this.pendingQueue) {
      job.status = 'cancelled';
      job.completedAt = new Date();
      this.emit('job:cancelled', job);
    }

    this.pendingQueue = [];
    this.processingJobs.clear();
    this.workers.clear();
    this.isProcessing = false;

    logger.info('Optimization queue shutdown completed');
  }
}

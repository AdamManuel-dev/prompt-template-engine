/**
 * @fileoverview Job processor service for auto-optimization
 * @lastmodified 2025-08-27T04:55:00Z
 *
 * Features: Job queue management, concurrent processing, job status tracking
 * Main APIs: addJob(), start(), stop(), getStats()
 * Constraints: Single responsibility - only handles job processing
 * Patterns: Queue pattern, worker pool, event emitter
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

export interface OptimizationJob {
  id: string;
  templatePath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  completedTime?: Date;
  result?: unknown;
  error?: string;
  priority: number;
  retryCount: number;
}

export interface JobProcessorOptions {
  /** Maximum concurrent jobs */
  maxConcurrentJobs: number;
  /** Maximum retry attempts for failed jobs */
  maxRetryAttempts: number;
  /** Backoff delay between retries (ms) */
  retryBackoffMs: number;
  /** Job timeout (ms) */
  jobTimeoutMs: number;
}

export interface JobProcessorStats {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  averageProcessingTime: number;
  activeJobs: number;
  queuedJobs: number;
  retryCount: number;
}

/**
 * Job processor service focused solely on managing optimization job queue
 *
 * This service handles the job processing logic that was previously
 * embedded in AutoOptimizeManager, following single responsibility principle.
 */
export class JobProcessorService extends EventEmitter {
  private jobQueue: OptimizationJob[] = [];

  private activeJobs: Map<string, OptimizationJob> = new Map();

  private options: JobProcessorOptions;

  private isProcessing: boolean = false;

  private processorInterval: NodeJS.Timeout | null = null;

  private stats: JobProcessorStats = {
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    averageProcessingTime: 0,
    activeJobs: 0,
    queuedJobs: 0,
    retryCount: 0,
  };

  constructor(options: JobProcessorOptions) {
    super();
    this.options = options;
  }

  /**
   * Add a job to the processing queue
   */
  addJob(templatePath: string, priority: number = 0): OptimizationJob {
    const job: OptimizationJob = {
      id: this.generateJobId(),
      templatePath,
      status: 'pending',
      startTime: new Date(),
      priority,
      retryCount: 0,
    };

    // Insert job in priority order (higher priority first)
    let inserted = false;
    for (let i = 0; i < this.jobQueue.length; i++) {
      if (this.jobQueue[i].priority < priority) {
        this.jobQueue.splice(i, 0, job);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      this.jobQueue.push(job);
    }

    this.updateStats();

    logger.info('Job added to processing queue', {
      jobId: job.id,
      templatePath,
      priority,
      queueLength: this.jobQueue.length,
    });

    this.emit('job-added', job);
    return job;
  }

  /**
   * Start job processing
   */
  async start(): Promise<void> {
    if (this.isProcessing) {
      logger.warn('Job processor is already running');
      return;
    }

    this.isProcessing = true;
    this.startJobProcessor();

    logger.info('Job processor started', {
      maxConcurrentJobs: this.options.maxConcurrentJobs,
      maxRetryAttempts: this.options.maxRetryAttempts,
    });

    this.emit('processor-started');
  }

  /**
   * Stop job processing
   */
  async stop(graceful: boolean = true): Promise<void> {
    if (!this.isProcessing) {
      logger.warn('Job processor is not running');
      return;
    }

    this.isProcessing = false;

    if (this.processorInterval) {
      clearInterval(this.processorInterval);
      this.processorInterval = null;
    }

    if (graceful) {
      // Wait for active jobs to complete
      await this.waitForActiveJobsToComplete(30000); // 30 second timeout
    } else {
      // Cancel active jobs
      this.activeJobs.forEach(job => {
        job.status = 'failed';
        job.error = 'Job cancelled due to processor shutdown';
        job.completedTime = new Date();
        this.emit('job-failed', job);
      });
      this.activeJobs.clear();
    }

    this.updateStats();

    logger.info('Job processor stopped', { graceful });
    this.emit('processor-stopped');
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): OptimizationJob | null {
    // Check active jobs
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      return activeJob;
    }

    // Check queued jobs
    return this.jobQueue.find(job => job.id === jobId) || null;
  }

  /**
   * Get all jobs (active and queued)
   */
  getAllJobs(): OptimizationJob[] {
    return [...Array.from(this.activeJobs.values()), ...this.jobQueue];
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    // Try to remove from queue first
    const queueIndex = this.jobQueue.findIndex(job => job.id === jobId);
    if (queueIndex !== -1) {
      const job = this.jobQueue.splice(queueIndex, 1)[0];
      job.status = 'failed';
      job.error = 'Job cancelled';
      job.completedTime = new Date();

      this.updateStats();
      this.emit('job-cancelled', job);

      logger.info('Job cancelled from queue', { jobId });
      return true;
    }

    // Try to cancel active job
    const activeJob = this.activeJobs.get(jobId);
    if (activeJob) {
      activeJob.status = 'failed';
      activeJob.error = 'Job cancelled';
      activeJob.completedTime = new Date();

      this.emit('job-cancelled', activeJob);
      logger.info('Active job marked for cancellation', { jobId });
      return true;
    }

    return false;
  }

  /**
   * Clear the job queue
   */
  clearQueue(): number {
    const clearedCount = this.jobQueue.length;

    this.jobQueue.forEach(job => {
      job.status = 'failed';
      job.error = 'Queue cleared';
      job.completedTime = new Date();
      this.emit('job-cancelled', job);
    });

    this.jobQueue = [];
    this.updateStats();

    logger.info('Job queue cleared', { clearedCount });
    return clearedCount;
  }

  /**
   * Get current statistics
   */
  getStats(): JobProcessorStats {
    return { ...this.stats };
  }

  /**
   * Update processor options
   */
  updateOptions(options: Partial<JobProcessorOptions>): void {
    this.options = { ...this.options, ...options };
    logger.info('Job processor options updated', options);
  }

  // Private methods

  private startJobProcessor(): void {
    this.processorInterval = setInterval(async () => {
      await this.processJobs();
    }, 1000) as NodeJS.Timeout; // Check every second
  }

  private async processJobs(): Promise<void> {
    if (!this.isProcessing) {
      return;
    }

    // Process jobs if we have capacity and jobs in queue
    while (
      this.activeJobs.size < this.options.maxConcurrentJobs &&
      this.jobQueue.length > 0
    ) {
      const job = this.jobQueue.shift()!;
      this.activeJobs.set(job.id, job);
      this.updateStats();

      // Process job in background
      this.processJob(job).catch(error => {
        logger.error('Unexpected error in job processing', error as Error, {
          jobId: job.id,
        });
      });
    }
  }

  private async processJob(job: OptimizationJob): Promise<void> {
    try {
      job.status = 'processing';
      const startTime = Date.now();

      logger.info('Processing optimization job', {
        jobId: job.id,
        templatePath: job.templatePath,
        retryCount: job.retryCount,
      });

      this.emit('job-started', job);

      // Set timeout for job
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Job timeout'));
        }, this.options.jobTimeoutMs);
      });

      // Emit job processing event (external processor handles the actual work)
      const processingPromise = new Promise((resolve, reject) => {
        const onJobCompleted = (result: unknown) => {
          this.removeAllListeners('job-process-completed');
          this.removeAllListeners('job-process-failed');
          resolve(result);
        };

        const onJobFailed = (error: Error) => {
          this.removeAllListeners('job-process-completed');
          this.removeAllListeners('job-process-failed');
          reject(error);
        };

        this.once('job-process-completed', onJobCompleted);
        this.once('job-process-failed', onJobFailed);

        // Emit the job for external processing
        this.emit('process-job', job);
      });

      // Race between processing and timeout
      const result = await Promise.race([processingPromise, timeoutPromise]);

      // Job completed successfully
      job.status = 'completed';
      job.result = result;
      job.completedTime = new Date();

      const processingTime = Date.now() - startTime;
      this.updateJobStats(true, processingTime);

      logger.info('Optimization job completed', {
        jobId: job.id,
        processingTime: `${processingTime}ms`,
      });

      this.emit('job-completed', job);
    } catch (error) {
      // Job failed
      const errorMessage = (error as Error).message;

      if (
        job.retryCount < this.options.maxRetryAttempts &&
        errorMessage !== 'Job timeout'
      ) {
        // Retry the job
        job.retryCount += 1;
        job.status = 'pending';

        // Add back to queue with delay
        setTimeout(() => {
          this.jobQueue.unshift(job); // Add to front for priority
          this.updateStats();
        }, this.options.retryBackoffMs);

        this.stats.retryCount += 1;

        logger.info('Job scheduled for retry', {
          jobId: job.id,
          retryCount: job.retryCount,
          maxRetries: this.options.maxRetryAttempts,
        });

        this.emit('job-retry', job);
      } else {
        // Job failed permanently
        job.status = 'failed';
        job.error = errorMessage;
        job.completedTime = new Date();

        this.updateJobStats(false, 0);

        logger.error('Optimization job failed permanently', error as Error, {
          jobId: job.id,
          retryCount: job.retryCount,
        });

        this.emit('job-failed', job);
      }
    } finally {
      // Remove from active jobs if not retrying
      if (job.status !== 'pending') {
        this.activeJobs.delete(job.id);
        this.updateStats();
      }
    }
  }

  private async waitForActiveJobsToComplete(timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      logger.warn(`${this.activeJobs.size} jobs still active after timeout`);
    }
  }

  private updateStats(): void {
    this.stats.activeJobs = this.activeJobs.size;
    this.stats.queuedJobs = this.jobQueue.length;
  }

  private updateJobStats(success: boolean, processingTime: number): void {
    this.stats.totalProcessed += 1;

    if (success) {
      this.stats.successCount += 1;

      // Update average processing time
      if (processingTime > 0) {
        this.stats.averageProcessingTime =
          (this.stats.averageProcessingTime * (this.stats.successCount - 1) +
            processingTime) /
          this.stats.successCount;
      }
    } else {
      this.stats.failureCount += 1;
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

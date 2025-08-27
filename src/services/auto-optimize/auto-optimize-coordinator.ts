/**
 * @fileoverview Refactored auto-optimization coordinator
 * @lastmodified 2025-08-27T05:05:00Z
 *
 * Features: Orchestrates file watching, job processing, and notifications
 * Main APIs: start(), stop(), getStatus(), updateOptions()
 * Constraints: Coordinates focused services instead of doing everything
 * Patterns: Coordinator pattern, dependency injection, event orchestration
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { ConfigManager } from '../../config/config-manager';
import { UnifiedOptimizationService } from '../unified-optimization.service';
import { FileWatcherService, FileChangeEvent } from './file-watcher.service';
import { JobProcessorService, OptimizationJob } from './job-processor.service';
import { NotificationService } from './notification.service';
import {
  getPromptWizardConfig,
  checkPromptWizardAvailability,
} from '../../config/promptwizard.config';

export interface AutoOptimizeCoordinatorOptions {
  /** Enable auto-optimization on template save */
  enabled: boolean;
  /** Watch patterns for template files */
  watchPatterns: string[];
  /** Optimization delay after file change (debounce) */
  debounceMs: number;
  /** Target models for optimization */
  targetModels: string[];
  /** Enable desktop notifications */
  notifications: boolean;
  /** Background optimization queue size */
  maxConcurrentJobs: number;
  /** Save optimized templates to separate files */
  saveOptimized: boolean;
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Maximum retry attempts */
  maxRetryAttempts: number;
  /** Job timeout (ms) */
  jobTimeoutMs: number;
}

export interface AutoOptimizeStatus {
  enabled: boolean;
  activeJobs: number;
  queuedJobs: number;
  totalProcessed: number;
  successRate: number;
  options: AutoOptimizeCoordinatorOptions;
}

/**
 * Refactored auto-optimization coordinator
 * 
 * This replaces the monolithic AutoOptimizeManager with a lean coordinator
 * that orchestrates focused services, following single responsibility principle.
 * 
 * Services coordinated:
 * - FileWatcherService: Monitors file changes
 * - JobProcessorService: Manages job queue and processing
 * - NotificationService: Handles desktop notifications
 * - UnifiedOptimizationService: Performs optimizations
 */
export class AutoOptimizeCoordinator extends EventEmitter {
  private fileWatcher: FileWatcherService;
  private jobProcessor: JobProcessorService;
  private notificationService: NotificationService;
  private optimizationService: UnifiedOptimizationService;

  private options: AutoOptimizeCoordinatorOptions;
  private isEnabled: boolean = false;

  constructor(
    options: AutoOptimizeCoordinatorOptions,
    services?: {
      fileWatcher?: FileWatcherService;
      jobProcessor?: JobProcessorService;
      notificationService?: NotificationService;
      optimizationService?: UnifiedOptimizationService;
    }
  ) {
    super();
    
    this.options = options;

    // Initialize services with dependency injection
    this.fileWatcher = services?.fileWatcher || new FileWatcherService({
      watchPatterns: options.watchPatterns,
      debounceMs: options.debounceMs,
    });

    this.jobProcessor = services?.jobProcessor || new JobProcessorService({
      maxConcurrentJobs: options.maxConcurrentJobs,
      maxRetryAttempts: options.maxRetryAttempts,
      retryBackoffMs: 5000,
      jobTimeoutMs: options.jobTimeoutMs,
    });

    this.notificationService = services?.notificationService || new NotificationService({
      enabled: options.notifications,
    });

    this.optimizationService = services?.optimizationService || this.createOptimizationService();

    this.setupEventHandlers();
  }

  /**
   * Initialize and start auto-optimization
   */
  async start(): Promise<void> {
    if (this.isEnabled) {
      logger.warn('Auto-optimize coordinator is already running');
      return;
    }

    try {
      logger.info('Initializing auto-optimize coordinator...');

      // Check PromptWizard availability
      const availability = await checkPromptWizardAvailability();
      if (!availability.available) {
        logger.warn('PromptWizard not available for auto-optimization', {
          issues: availability.issues,
          recommendations: availability.recommendations,
        });
      }

      // Start services
      await this.fileWatcher.start();
      await this.jobProcessor.start();

      this.isEnabled = true;

      logger.info('Auto-optimization enabled', {
        watchPatterns: this.options.watchPatterns,
        targetModels: this.options.targetModels,
        maxConcurrentJobs: this.options.maxConcurrentJobs,
      });

      // Send start notification
      await this.notificationService.sendAutoOptimizationEnabled();

      this.emit('started', this.getStatus());

    } catch (error) {
      logger.error('Failed to start auto-optimization', error as Error);
      throw error;
    }
  }

  /**
   * Stop auto-optimization
   */
  async stop(graceful: boolean = true): Promise<void> {
    if (!this.isEnabled) {
      logger.warn('Auto-optimize coordinator is not running');
      return;
    }

    try {
      logger.info('Stopping auto-optimize coordinator...');

      // Stop services
      await this.fileWatcher.stop();
      await this.jobProcessor.stop(graceful);

      this.isEnabled = false;

      logger.info('Auto-optimization disabled');

      // Send stop notification
      await this.notificationService.sendAutoOptimizationDisabled();

      this.emit('stopped', this.getStatus());

    } catch (error) {
      logger.error('Failed to stop auto-optimization', error as Error);
      throw error;
    }
  }

  /**
   * Get current status
   */
  getStatus(): AutoOptimizeStatus {
    const jobStats = this.jobProcessor.getStats();
    
    return {
      enabled: this.isEnabled,
      activeJobs: jobStats.activeJobs,
      queuedJobs: jobStats.queuedJobs,
      totalProcessed: jobStats.totalProcessed,
      successRate: jobStats.totalProcessed > 0 
        ? (jobStats.successCount / jobStats.totalProcessed) * 100 
        : 0,
      options: { ...this.options },
    };
  }

  /**
   * Update configuration options
   */
  updateOptions(newOptions: Partial<AutoOptimizeCoordinatorOptions>): void {
    this.options = { ...this.options, ...newOptions };

    // Update service configurations
    if (newOptions.watchPatterns || newOptions.debounceMs) {
      // File watcher options changed - restart may be needed
      if (this.isEnabled) {
        logger.info('File watcher configuration changed - restart may be required for full effect');
      }
    }

    if (newOptions.maxConcurrentJobs || newOptions.maxRetryAttempts || newOptions.jobTimeoutMs) {
      this.jobProcessor.updateOptions({
        maxConcurrentJobs: this.options.maxConcurrentJobs,
        maxRetryAttempts: this.options.maxRetryAttempts,
        jobTimeoutMs: this.options.jobTimeoutMs,
      });
    }

    if (newOptions.notifications !== undefined) {
      if (newOptions.notifications) {
        this.notificationService.enable();
      } else {
        this.notificationService.disable();
      }
    }

    logger.info('Auto-optimize options updated', newOptions);
    this.emit('options-updated', this.options);
  }

  /**
   * Manually trigger optimization for a specific file
   */
  async optimizeFile(templatePath: string, priority: number = 10): Promise<OptimizationJob> {
    const job = this.jobProcessor.addJob(templatePath, priority);
    logger.info('Manual optimization triggered', { jobId: job.id, templatePath });
    return job;
  }

  /**
   * Get processing statistics
   */
  getStatistics(): {
    processor: ReturnType<JobProcessorService['getStats']>;
    notifications: ReturnType<NotificationService['getStats']>;
    optimization: ReturnType<UnifiedOptimizationService['getStatistics']>;
  } {
    return {
      processor: this.jobProcessor.getStats(),
      notifications: this.notificationService.getStats(),
      optimization: this.optimizationService.getStatistics(),
    };
  }

  // Private methods

  private createOptimizationService(): UnifiedOptimizationService {
    const promptWizardConfig = getPromptWizardConfig();
    
    return new UnifiedOptimizationService({
      promptWizard: {
        enabled: true,
        serviceUrl: promptWizardConfig.connection.serviceUrl,
        timeout: promptWizardConfig.connection.timeout,
        retries: promptWizardConfig.connection.retries,
      },
      cache: {
        maxSize: 1000,
        ttlMs: 86400000, // 24 hours
        useRedis: false,
      },
      queue: {
        maxConcurrent: this.options.maxConcurrentJobs,
        retryAttempts: this.options.maxRetryAttempts,
        backoffMs: 5000,
      },
      defaults: {
        targetModel: this.options.targetModels[0] || 'gpt-4',
        mutateRefineIterations: promptWizardConfig.optimization.mutateRefineIterations,
        fewShotCount: promptWizardConfig.optimization.fewShotCount,
        generateReasoning: promptWizardConfig.optimization.generateReasoning,
      },
    });
  }

  private setupEventHandlers(): void {
    // File watcher events
    this.fileWatcher.on('file-change', (event: FileChangeEvent) => {
      this.handleFileChange(event);
    });

    this.fileWatcher.on('error', (error: Error) => {
      logger.error('File watcher error', error);
      this.emit('file-watcher-error', error);
    });

    // Job processor events
    this.jobProcessor.on('process-job', (job: OptimizationJob) => {
      this.handleJobProcessing(job);
    });

    this.jobProcessor.on('job-completed', (job: OptimizationJob) => {
      this.handleJobCompleted(job);
    });

    this.jobProcessor.on('job-failed', (job: OptimizationJob) => {
      this.handleJobFailed(job);
    });

    this.jobProcessor.on('job-retry', (job: OptimizationJob) => {
      logger.info('Job scheduled for retry', {
        jobId: job.id,
        templatePath: job.templatePath,
        retryCount: job.retryCount,
      });
    });
  }

  private handleFileChange(event: FileChangeEvent): void {
    logger.debug('File change detected', {
      filePath: event.filePath,
      eventType: event.eventType,
    });

    if (event.eventType === 'unlink') {
      // Don't optimize deleted files
      return;
    }

    // Add optimization job for changed file
    const job = this.jobProcessor.addJob(event.absolutePath, 5); // Medium priority

    this.emit('file-queued', {
      filePath: event.absolutePath,
      jobId: job.id,
      eventType: event.eventType,
    });
  }

  private async handleJobProcessing(job: OptimizationJob): Promise<void> {
    try {
      // Send start notification
      await this.notificationService.sendOptimizationStarted(job.templatePath);

      // Perform optimization
      const result = await this.optimizationService.optimize(job.templatePath, {
        targetModel: this.options.targetModels[0] as any,
        generateReasoning: true,
      });

      // Job completed successfully
      job.result = result;
      this.jobProcessor.emit('job-process-completed', result);

    } catch (error) {
      // Job failed
      this.jobProcessor.emit('job-process-failed', error);
    }
  }

  private async handleJobCompleted(job: OptimizationJob): Promise<void> {
    const result = job.result as any;
    
    // Extract metrics if available
    let tokenReduction: number | undefined;
    if (result?.result?.metrics?.tokenReduction) {
      tokenReduction = result.result.metrics.tokenReduction;
    }

    // Send completion notification
    await this.notificationService.sendOptimizationCompleted(
      job.templatePath,
      tokenReduction
    );

    this.emit('optimization-completed', {
      jobId: job.id,
      templatePath: job.templatePath,
      result: job.result,
    });

    logger.info('Template optimization completed', {
      jobId: job.id,
      templatePath: job.templatePath,
      tokenReduction,
    });
  }

  private async handleJobFailed(job: OptimizationJob): Promise<void> {
    // Send failure notification
    await this.notificationService.sendOptimizationFailed(
      job.templatePath,
      job.error || 'Unknown error'
    );

    this.emit('optimization-failed', {
      jobId: job.id,
      templatePath: job.templatePath,
      error: job.error,
    });

    logger.error('Template optimization failed', new Error(job.error), {
      jobId: job.id,
      templatePath: job.templatePath,
    });
  }

  /**
   * Get default coordinator options
   */
  static getDefaultOptions(): AutoOptimizeCoordinatorOptions {
    const config = ConfigManager.getInstance();

    return {
      enabled: config.get<boolean>('promptwizard.autoOptimize', false),
      watchPatterns: [
        '**/*.prompt',
        '**/*.md',
        'templates/**/*',
        'prompts/**/*',
      ],
      debounceMs: 2000,
      targetModels: ['gpt-4', 'claude-3-sonnet'],
      notifications: true,
      maxConcurrentJobs: 3,
      saveOptimized: true,
      minConfidence: 0.7,
      maxRetryAttempts: 2,
      jobTimeoutMs: 30000, // 30 seconds
    };
  }
}

/**
 * Global coordinator instance
 */
export const autoOptimizeCoordinator = new AutoOptimizeCoordinator(
  AutoOptimizeCoordinator.getDefaultOptions()
);
/**
 * @fileoverview CLI auto-optimize flag implementation with background optimization
 * @lastmodified 2025-08-26T15:30:00Z
 *
 * Features: Auto-optimize on template save, background optimization, notification system
 * Main APIs: setupAutoOptimize(), startAutoOptimizeMode(), stopAutoOptimizeMode()
 * Constraints: Requires file system watching and PromptWizard service
 * Patterns: File watcher pattern, background job queue, notification system
 */

import { Command } from 'commander';
import { watch, FSWatcher } from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { logger } from '../../utils/logger';
import { ConfigManager } from '../../config/config-manager';
import {
  getPromptWizardConfig,
  checkPromptWizardAvailability,
} from '../../config/promptwizard.config';
import { PromptWizardClient } from '../../integrations/promptwizard/client';
import {
  OptimizationRequest,
  OptimizationResponse,
} from '../../integrations/promptwizard/types';
import { CacheService } from '../../services/cache.service';

export interface AutoOptimizeOptions {
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
}

interface OptimizationJob {
  id: string;
  templatePath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  result?: OptimizationResponse;
  error?: string;
}

interface AutoOptimizeStats {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  averageProcessingTime: number;
  activeJobs: number;
  queuedJobs: number;
}

export class AutoOptimizeManager {
  private watchers: FSWatcher[] = [];

  private client: PromptWizardClient | null = null;


  private cacheService: CacheService;

  private options: AutoOptimizeOptions;

  private isEnabled: boolean = false;

  private jobQueue: OptimizationJob[] = [];

  private activeJobs: Map<string, OptimizationJob> = new Map();

  private stats: AutoOptimizeStats = {
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    averageProcessingTime: 0,
    activeJobs: 0,
    queuedJobs: 0,
  };

  private processingTimers: Map<string, number> = new Map();

  constructor() {
    this.cacheService = new CacheService();
    this.options = this.getDefaultOptions();
  }

  /**
   * Get default auto-optimize options
   */
  private getDefaultOptions(): AutoOptimizeOptions {
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
    };
  }

  /**
   * Initialize auto-optimize manager
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing auto-optimize manager...');

      // Check PromptWizard availability
      const availability = await checkPromptWizardAvailability();
      if (!availability.available) {
        logger.warn('PromptWizard not available for auto-optimization', {
          issues: availability.issues,
          recommendations: availability.recommendations,
        });
        return;
      }

      // Initialize PromptWizard client
      const promptWizardConfig = getPromptWizardConfig();

      // Convert config format for client
      const clientConfig = {
        serviceUrl: promptWizardConfig.connection.serviceUrl,
        timeout: promptWizardConfig.connection.timeout,
        retries: promptWizardConfig.connection.retries,
        cache: promptWizardConfig.cache,
        defaults: {
          targetModel: promptWizardConfig.optimization.defaultModel,
          mutateRefineIterations:
            promptWizardConfig.optimization.mutateRefineIterations,
          fewShotCount: promptWizardConfig.optimization.fewShotCount,
          generateReasoning: promptWizardConfig.optimization.generateReasoning,
        },
      };

      this.client = new PromptWizardClient(clientConfig);

      // Initialize services (services don't require explicit initialization)
      // Services are initialized in their constructors

      logger.info('Auto-optimize manager initialized successfully');
    } catch (error) {
      logger.error(
        'Failed to initialize auto-optimize manager',
        error as Error
      );
      throw error;
    }
  }

  /**
   * Start auto-optimization mode
   */
  async start(options?: Partial<AutoOptimizeOptions>): Promise<void> {
    if (this.isEnabled) {
      logger.warn('Auto-optimize is already enabled');
      return;
    }

    try {
      // Update options
      this.options = { ...this.options, ...options };

      // Start file watchers
      await this.startWatching();

      // Start background job processor
      this.startJobProcessor();

      this.isEnabled = true;

      logger.info('Auto-optimization enabled', {
        watchPatterns: this.options.watchPatterns,
        targetModels: this.options.targetModels,
        maxConcurrentJobs: this.options.maxConcurrentJobs,
      });

      // Send notification
      if (this.options.notifications) {
        this.sendNotification(
          'Auto-optimization enabled',
          'Templates will be optimized automatically on save'
        );
      }
    } catch (error) {
      logger.error('Failed to start auto-optimization', error as Error);
      throw error;
    }
  }

  /**
   * Stop auto-optimization mode
   */
  async stop(): Promise<void> {
    if (!this.isEnabled) {
      logger.warn('Auto-optimize is not enabled');
      return;
    }

    try {
      // Stop file watchers
      await this.stopWatching();

      // Wait for active jobs to complete (with timeout)
      await this.waitForJobsToComplete(30000);

      this.isEnabled = false;

      logger.info('Auto-optimization disabled');

      // Send notification
      if (this.options.notifications) {
        this.sendNotification(
          'Auto-optimization disabled',
          'Templates will no longer be optimized automatically'
        );
      }
    } catch (error) {
      logger.error('Failed to stop auto-optimization', error as Error);
      throw error;
    }
  }

  /**
   * Start file system watching
   */
  private async startWatching(): Promise<void> {
    const cwd = process.cwd();

    this.options.watchPatterns.forEach(pattern => {
      const watcher = watch(pattern, {
        cwd,
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100,
        },
      });

      watcher.on('add', (filePath: string) =>
        this.handleFileChange(filePath, 'add')
      );
      watcher.on('change', (filePath: string) =>
        this.handleFileChange(filePath, 'change')
      );
      watcher.on('error', (error: unknown) =>
        logger.error('File watcher error', error as Error)
      );

      this.watchers.push(watcher);
    });

    logger.info(
      `Started watching ${this.options.watchPatterns.length} patterns for template changes`
    );
  }

  /**
   * Stop file system watching
   */
  private async stopWatching(): Promise<void> {
    await Promise.all(this.watchers.map(watcher => watcher.close()));
    this.watchers = [];
    logger.info('Stopped file system watching');
  }

  /**
   * Handle file system change event
   */
  private async handleFileChange(
    filePath: string,
    eventType: string
  ): Promise<void> {
    try {
      const absolutePath = path.resolve(filePath);

      // Check if file is a template
      if (!this.isTemplateFile(absolutePath)) {
        return;
      }

      // Debounce file changes
      const debounceKey = `${absolutePath}-${eventType}`;
      if (this.processingTimers.has(debounceKey)) {
        clearTimeout(this.processingTimers.get(debounceKey)!);
      }

      const timer = setTimeout(() => {
        this.queueOptimization(absolutePath);
        this.processingTimers.delete(debounceKey);
      }, this.options.debounceMs) as any;

      this.processingTimers.set(debounceKey, timer);

      logger.debug('Template file change detected', { filePath, eventType });
    } catch (error) {
      logger.error('Error handling file change', error as Error);
    }
  }

  /**
   * Check if file is a template file
   */
  private isTemplateFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExts = ['.prompt', '.md', '.txt'];

    // Check extension
    if (!supportedExts.includes(ext)) {
      return false;
    }

    // Check if file exists and is readable
    try {
      const stats = fs.statSync(filePath);
      return stats.isFile() && stats.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * Queue template for optimization
   */
  private queueOptimization(templatePath: string): void {
    const job: OptimizationJob = {
      id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templatePath,
      status: 'pending',
      startTime: new Date(),
    };

    this.jobQueue.push(job);
    this.stats.queuedJobs = this.jobQueue.length;

    logger.info('Queued template for optimization', {
      templatePath,
      jobId: job.id,
      queueLength: this.jobQueue.length,
    });
  }

  /**
   * Start background job processor
   */
  private startJobProcessor(): void {
    const processJobs = async () => {
      while (this.isEnabled) {
        // Process jobs if we have capacity
        if (
          this.activeJobs.size < this.options.maxConcurrentJobs &&
          this.jobQueue.length > 0
        ) {
          const job = this.jobQueue.shift()!;
          this.activeJobs.set(job.id, job);
          this.stats.queuedJobs = this.jobQueue.length;
          this.stats.activeJobs = this.activeJobs.size;

          // Process job in background
          this.processOptimizationJob(job).catch(error => {
            logger.error('Job processing failed', error as Error);
          });
        }

        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };

    processJobs().catch(error => {
      logger.error('Job processor error', error as Error);
    });
  }

  /**
   * Process individual optimization job
   */
  private async processOptimizationJob(job: OptimizationJob): Promise<void> {
    try {
      job.status = 'processing';
      const startTime = Date.now();

      logger.info('Processing optimization job', {
        jobId: job.id,
        templatePath: job.templatePath,
      });

      // Read template content
      const templateContent = fs.readFileSync(job.templatePath, 'utf-8');

      // Check cache first
      const cacheKey = this.generateCacheKey(templateContent);
      const cachedResult =
        await this.cacheService.get(cacheKey) as OptimizationResponse;

      let result: OptimizationResponse;

      if (cachedResult) {
        logger.debug('Using cached optimization result', { jobId: job.id });
        result = cachedResult;
      } else {
        // Create optimization request
        const request: OptimizationRequest = {
          task: 'Optimize template for clarity, effectiveness, and token efficiency',
          prompt: templateContent,
          targetModel: this.options.targetModels[0] as 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-opus' | 'claude-3-sonnet' | 'gemini-pro',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true,
          metadata: {
            templateName: path.basename(job.templatePath),
            templateId: job.id,
          },
        };

        // Perform optimization
        if (!this.client) {
          throw new Error('PromptWizard client not initialized');
        }

        const optimizedResult = await this.client.optimizePrompt(request);
        result = {
          jobId: optimizedResult.jobId,
          result: optimizedResult,
          status: optimizedResult.status === 'completed' ? 'success' : 
                 optimizedResult.status === 'failed' ? 'error' : 'pending',
          confidence: optimizedResult.qualityScore,
          originalPrompt: optimizedResult.originalPrompt,
          optimizedPrompt: optimizedResult.optimizedPrompt,
          metrics: optimizedResult.metrics
        };

        // Cache result
        await this.cacheService.set(cacheKey, result, 86400); // 24 hours
      }

      // Check confidence threshold
      if (result.confidence && result.confidence < this.options.minConfidence) {
        logger.warn('Optimization confidence below threshold', {
          jobId: job.id,
          confidence: result.confidence,
          threshold: this.options.minConfidence,
        });
      }

      // Save optimized template if configured
      if (this.options.saveOptimized && result.optimizedPrompt) {
        await this.saveOptimizedTemplate(
          job.templatePath,
          result.optimizedPrompt,
          result
        );
      }

      // Complete job
      job.status = 'completed';
      job.result = result;

      const processingTime = Date.now() - startTime;
      this.updateStats(true, processingTime);

      logger.info('Optimization job completed', {
        jobId: job.id,
        processingTime: `${processingTime}ms`,
        tokenReduction: result.metrics?.tokenReduction || 0,
      });

      // Send success notification
      if (this.options.notifications) {
        this.sendNotification(
          'Template Optimized',
          `${path.basename(job.templatePath)} optimized successfully`
        );
      }
    } catch (error) {
      logger.error('Optimization job failed', error as Error, {
        jobId: job.id,
      });

      job.status = 'failed';
      job.error = (error as Error).message;
      this.updateStats(false, 0);

      // Send failure notification
      if (this.options.notifications) {
        this.sendNotification(
          'Optimization Failed',
          `Failed to optimize ${path.basename(job.templatePath)}: ${(error as Error).message}`
        );
      }
    } finally {
      // Remove from active jobs
      this.activeJobs.delete(job.id);
      this.stats.activeJobs = this.activeJobs.size;
    }
  }

  /**
   * Save optimized template to file
   */
  private async saveOptimizedTemplate(
    originalPath: string,
    optimizedContent: string,
    result: OptimizationResponse
  ): Promise<void> {
    try {
      const parsedPath = path.parse(originalPath);
      const optimizedPath = path.join(
        parsedPath.dir,
        `${parsedPath.name}.optimized${parsedPath.ext}`
      );

      // Create header with optimization metadata
      const header = `<!-- Optimized by PromptWizard on ${new Date().toISOString()} -->
<!-- Original file: ${path.basename(originalPath)} -->
<!-- Metrics: Token reduction: ${result.metrics?.tokenReduction || 0}%, Cost reduction: ${result.metrics?.costReduction || 0}% -->
<!-- Confidence: ${result.confidence || 'N/A'} -->

`;

      const finalContent = header + optimizedContent;

      fs.writeFileSync(optimizedPath, finalContent, 'utf-8');
      logger.info('Saved optimized template', { optimizedPath });
    } catch (error) {
      logger.error('Failed to save optimized template', error as Error);
    }
  }

  /**
   * Generate cache key for template content
   */
  private generateCacheKey(content: string): string {
    const crypto = require('crypto');
    return `auto_optimize_${crypto.createHash('md5').update(content).digest('hex')}`;
  }

  /**
   * Update statistics
   */
  private updateStats(success: boolean, processingTime: number): void {
    this.stats.totalProcessed++;

    if (success) {
      this.stats.successCount++;
    } else {
      this.stats.failureCount++;
    }

    // Update average processing time
    if (processingTime > 0) {
      this.stats.averageProcessingTime =
        (this.stats.averageProcessingTime * (this.stats.successCount - 1) +
          processingTime) /
        this.stats.successCount;
    }
  }

  /**
   * Wait for active jobs to complete
   */
  private async waitForJobsToComplete(timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      logger.warn(`${this.activeJobs.size} jobs still active after timeout`);
    }
  }

  /**
   * Send desktop notification
   */
  private sendNotification(title: string, message: string): void {
    try {
      if (os.platform() === 'darwin') {
        // macOS notification
        require('child_process').exec(
          `osascript -e 'display notification "${message}" with title "${title}"'`
        );
      } else if (os.platform() === 'linux') {
        // Linux notification
        require('child_process').exec(`notify-send "${title}" "${message}"`);
      } else if (os.platform() === 'win32') {
        // Windows notification (requires additional setup)
        logger.info(`Notification: ${title} - ${message}`);
      }
    } catch (error) {
      logger.debug('Failed to send notification', error as Error);
    }
  }

  /**
   * Get current statistics
   */
  getStats(): AutoOptimizeStats {
    return { ...this.stats };
  }

  /**
   * Get current status
   */
  getStatus(): {
    enabled: boolean;
    activeJobs: number;
    queuedJobs: number;
    totalProcessed: number;
    options: AutoOptimizeOptions;
  } {
    return {
      enabled: this.isEnabled,
      activeJobs: this.activeJobs.size,
      queuedJobs: this.jobQueue.length,
      totalProcessed: this.stats.totalProcessed,
      options: { ...this.options },
    };
  }

  /**
   * Update options
   */
  updateOptions(options: Partial<AutoOptimizeOptions>): void {
    this.options = { ...this.options, ...options };
    logger.info('Auto-optimize options updated', options);
  }
}

/**
 * Global auto-optimize manager instance
 */
export const autoOptimizeManager = new AutoOptimizeManager();

/**
 * Add auto-optimize flag to CLI command
 */
export function addAutoOptimizeFlag(command: Command): Command {
  return command
    .option('--auto-optimize', 'Enable automatic optimization on template save')
    .option(
      '--auto-optimize-models <models>',
      'Target models for auto-optimization (comma-separated)',
      'gpt-4'
    )
    .option(
      '--auto-optimize-confidence <threshold>',
      'Minimum confidence threshold (0-1)',
      '0.7'
    )
    .option('--no-notifications', 'Disable desktop notifications')
    .option(
      '--max-concurrent <jobs>',
      'Maximum concurrent optimization jobs',
      '3'
    );
}

/**
 * Setup auto-optimize from CLI options
 */
export async function setupAutoOptimizeFromOptions(
  options: any
): Promise<void> {
  if (!options.autoOptimize) {
    return;
  }

  const autoOptimizeOptions: Partial<AutoOptimizeOptions> = {
    enabled: true,
    notifications: !options.noNotifications,
    maxConcurrentJobs: parseInt(options.maxConcurrent, 10),
    minConfidence: parseFloat(options.autoOptimizeConfidence),
  };

  if (options.autoOptimizeModels) {
    autoOptimizeOptions.targetModels = options.autoOptimizeModels
      .split(',')
      .map((model: string) => model.trim());
  }

  await autoOptimizeManager.initialize();
  await autoOptimizeManager.start(autoOptimizeOptions);

  // Setup graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Gracefully shutting down auto-optimize...');
    await autoOptimizeManager.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Gracefully shutting down auto-optimize...');
    await autoOptimizeManager.stop();
    process.exit(0);
  });
}

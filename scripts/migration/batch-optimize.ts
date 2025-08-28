/**
 * @fileoverview Batch optimization tools for processing multiple templates concurrently
 * @lastmodified 2024-08-26T16:25:00Z
 * 
 * Features: Queue management, parallel processing, progress tracking, fault tolerance
 * Main APIs: BatchProcessor, OptimizationQueue, ProgressMonitor with resume capability
 * Constraints: Requires PromptWizard service, Redis for queue management, proper resource limits
 * Patterns: Producer-consumer, circuit breaker, graceful degradation, checkpoint recovery
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { Command } from 'commander';
import { EventEmitter } from 'events';

import { TemplateService } from '../../src/services/template.service';
import { PromptOptimizationService } from '../../src/services/prompt-optimization.service';
import { PromptWizardClient, createDefaultConfig } from '../../src/integrations/promptwizard';
import { CacheService } from '../../src/services/cache.service';
import { logger } from '../../src/utils/logger';
import { Template } from '../../src/types';

/**
 * Batch optimization configuration
 */
interface BatchOptimizationConfig {
  /** Maximum concurrent optimizations */
  maxConcurrency: number;
  /** Batch size for processing */
  batchSize: number;
  /** Queue processing interval (ms) */
  processInterval: number;
  /** Individual optimization timeout (ms) */
  timeout: number;
  /** Maximum retry attempts per template */
  maxRetries: number;
  /** Retry delay with exponential backoff */
  retryDelay: number;
  /** Enable checkpoint recovery */
  enableCheckpoints: boolean;
  /** Checkpoint save interval */
  checkpointInterval: number;
  /** Output directory for results */
  outputDir: string;
  /** Resource limits */
  resourceLimits: {
    memoryLimitMB: number;
    cpuThreshold: number;
  };
  /** Circuit breaker configuration */
  circuitBreaker: {
    failureThreshold: number;
    resetTimeout: number;
    enabled: boolean;
  };
}

/**
 * Optimization job in the queue
 */
interface OptimizationJob {
  /** Unique job identifier */
  id: string;
  /** Template to optimize */
  template: Template;
  /** Job priority (higher = more priority) */
  priority: number;
  /** Number of retry attempts */
  attempts: number;
  /** Job status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  /** Optimization parameters */
  params: {
    model: string;
    iterations: number;
    examples: number;
    reasoning: boolean;
  };
  /** Timestamps */
  timestamps: {
    created: Date;
    started?: Date;
    completed?: Date;
  };
  /** Error information */
  error?: string;
  /** Optimization result */
  result?: any;
}

/**
 * Batch processing progress and statistics
 */
interface BatchProgress {
  /** Total jobs in queue */
  total: number;
  /** Jobs completed successfully */
  completed: number;
  /** Jobs that failed */
  failed: number;
  /** Jobs currently processing */
  processing: number;
  /** Jobs pending processing */
  pending: number;
  /** Jobs cancelled */
  cancelled: number;
  /** Start time */
  startTime: Date;
  /** Estimated completion time */
  estimatedCompletion?: Date;
  /** Processing rate (jobs per minute) */
  throughput: number;
  /** Average processing time per job */
  avgProcessingTime: number;
  /** Current resource usage */
  resourceUsage: {
    memory: number;
    cpu: number;
  };
}

/**
 * Circuit breaker for handling service failures
 */
class CircuitBreaker {
  private failures = 0;
  private isOpen = false;
  private lastFailureTime = 0;

  constructor(
    private threshold: number,
    private resetTimeout: number
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.isOpen = false;
        this.failures = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.isOpen = true;
      logger.warn(`Circuit breaker opened after ${this.failures} failures`);
    }
  }

  get state(): 'closed' | 'open' | 'half-open' {
    if (this.isOpen) {
      return Date.now() - this.lastFailureTime > this.resetTimeout ? 'half-open' : 'open';
    }
    return 'closed';
  }
}

/**
 * Resource monitor for tracking system usage
 */
class ResourceMonitor {
  private memoryUsage = 0;
  private cpuUsage = 0;

  constructor(private limits: { memoryLimitMB: number; cpuThreshold: number }) {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    setInterval(() => {
      this.updateMetrics();
    }, 5000);
  }

  private updateMetrics(): void {
    const usage = process.memoryUsage();
    this.memoryUsage = usage.heapUsed / (1024 * 1024); // Convert to MB
    
    // Simple CPU usage estimation (not perfect but sufficient for basic monitoring)
    const startUsage = process.cpuUsage();
    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage);
      this.cpuUsage = ((endUsage.user + endUsage.system) / 1000000) * 100;
    }, 100);
  }

  isWithinLimits(): boolean {
    return this.memoryUsage < this.limits.memoryLimitMB && 
           this.cpuUsage < this.limits.cpuThreshold;
  }

  getUsage(): { memory: number; cpu: number } {
    return {
      memory: this.memoryUsage,
      cpu: this.cpuUsage
    };
  }
}

/**
 * Checkpoint manager for recovery support
 */
class CheckpointManager {
  constructor(private checkpointDir: string) {}

  async saveCheckpoint(data: any, checkpointId: string): Promise<void> {
    await fs.mkdir(this.checkpointDir, { recursive: true });
    const checkpointPath = path.join(this.checkpointDir, `checkpoint-${checkpointId}.json`);
    
    const checkpoint = {
      timestamp: new Date().toISOString(),
      data,
      version: '1.0'
    };

    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
    logger.debug(`Checkpoint saved: ${checkpointPath}`);
  }

  async loadCheckpoint(checkpointId: string): Promise<any> {
    const checkpointPath = path.join(this.checkpointDir, `checkpoint-${checkpointId}.json`);
    
    if (!existsSync(checkpointPath)) {
      return null;
    }

    const content = await fs.readFile(checkpointPath, 'utf8');
    const checkpoint = JSON.parse(content);
    logger.info(`Checkpoint loaded: ${checkpointPath}`);
    return checkpoint.data;
  }

  async deleteCheckpoint(checkpointId: string): Promise<void> {
    const checkpointPath = path.join(this.checkpointDir, `checkpoint-${checkpointId}.json`);
    
    if (existsSync(checkpointPath)) {
      await fs.unlink(checkpointPath);
      logger.debug(`Checkpoint deleted: ${checkpointPath}`);
    }
  }

  async listCheckpoints(): Promise<string[]> {
    if (!existsSync(this.checkpointDir)) {
      return [];
    }

    const files = await fs.readdir(this.checkpointDir);
    return files
      .filter(file => file.startsWith('checkpoint-') && file.endsWith('.json'))
      .map(file => file.replace('checkpoint-', '').replace('.json', ''));
  }
}

/**
 * Batch optimization processor
 * 
 * Manages queue-based processing of template optimizations with fault tolerance,
 * progress tracking, and resource monitoring capabilities.
 * 
 * @class BatchOptimizer
 * @extends EventEmitter
 * @example
 * ```typescript
 * const optimizer = new BatchOptimizer({
 *   maxConcurrency: 5,
 *   batchSize: 20,
 *   processInterval: 1000,
 *   timeout: 300000,
 *   enableCheckpoints: true,
 *   outputDir: './batch-results'
 * });
 * 
 * optimizer.on('progress', (progress) => {
 *   console.log(`Progress: ${progress.completed}/${progress.total}`);
 * });
 * 
 * const templates = await templateService.listTemplates();
 * await optimizer.processBatch(templates);
 * ```
 */
class BatchOptimizer extends EventEmitter {
  private templateService: TemplateService;
  private optimizationService: PromptOptimizationService;
  private promptWizardClient: PromptWizardClient;
  private cacheService: CacheService;
  private resourceMonitor: ResourceMonitor;
  private circuitBreaker: CircuitBreaker;
  private checkpointManager: CheckpointManager;
  
  private jobQueue: OptimizationJob[] = [];
  private activeJobs = new Map<string, OptimizationJob>();
  private progress: BatchProgress;
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;
  private checkpointInterval?: NodeJS.Timeout;
  private sessionId: string;

  constructor(private config: BatchOptimizationConfig) {
    super();
    
    this.sessionId = `batch-${Date.now()}`;
    this.templateService = new TemplateService();
    this.cacheService = new CacheService();
    
    // Initialize PromptWizard integration
    const pwConfig = createDefaultConfig();
    this.promptWizardClient = new PromptWizardClient(pwConfig);
    this.optimizationService = new PromptOptimizationService(
      this.promptWizardClient,
      this.templateService
    );

    // Initialize monitoring and fault tolerance
    this.resourceMonitor = new ResourceMonitor(config.resourceLimits);
    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreaker.failureThreshold,
      config.circuitBreaker.resetTimeout
    );
    this.checkpointManager = new CheckpointManager(
      path.join(config.outputDir, 'checkpoints')
    );

    // Initialize progress tracking
    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      processing: 0,
      pending: 0,
      cancelled: 0,
      startTime: new Date(),
      throughput: 0,
      avgProcessingTime: 0,
      resourceUsage: { memory: 0, cpu: 0 }
    };
  }

  /**
   * Process a batch of templates for optimization
   * 
   * @param templates - Templates to optimize
   * @param resumeFromCheckpoint - Whether to resume from existing checkpoint
   * @returns Promise that resolves when batch processing is complete
   */
  async processBatch(templates: Template[], resumeFromCheckpoint = false): Promise<void> {
    logger.info(`Starting batch optimization of ${templates.length} templates`);

    // Try to resume from checkpoint if requested
    if (resumeFromCheckpoint) {
      await this.resumeFromCheckpoint();
    } else {
      // Create fresh queue
      this.createJobQueue(templates);
    }

    // Setup progress monitoring
    this.startProgressMonitoring();

    // Start checkpoint saving if enabled
    if (this.config.enableCheckpoints) {
      this.startCheckpointSaving();
    }

    // Start queue processing
    await this.startProcessing();

    // Cleanup
    this.stopProgressMonitoring();
    this.stopCheckpointSaving();

    // Generate final report
    await this.generateBatchReport();
  }

  /**
   * Create optimization job queue from templates
   * 
   * @private
   * @param templates - Templates to queue for optimization
   */
  private createJobQueue(templates: Template[]): void {
    this.jobQueue = templates.map((template, index) => ({
      id: `job-${this.sessionId}-${index}`,
      template,
      priority: this.calculatePriority(template),
      attempts: 0,
      status: 'pending',
      params: {
        model: 'gpt-4',
        iterations: 3,
        examples: 5,
        reasoning: false
      },
      timestamps: {
        created: new Date()
      }
    }));

    // Sort by priority (higher priority first)
    this.jobQueue.sort((a, b) => b.priority - a.priority);
    
    this.progress.total = this.jobQueue.length;
    this.progress.pending = this.jobQueue.length;
  }

  /**
   * Calculate priority for template optimization
   * 
   * @private
   * @param template - Template to prioritize
   * @returns Priority score (higher = more priority)
   */
  private calculatePriority(template: Template): number {
    let priority = 1;

    // Higher priority for frequently used templates
    if (template.usage?.frequency) {
      priority += template.usage.frequency * 10;
    }

    // Higher priority for templates with performance issues
    if (template.metadata?.performance?.responseTime > 1000) {
      priority += 5;
    }

    // Higher priority for newer templates
    const age = Date.now() - new Date(template.createdAt || 0).getTime();
    const ageInDays = age / (1000 * 60 * 60 * 24);
    if (ageInDays < 30) {
      priority += 3;
    }

    return priority;
  }

  /**
   * Start processing the job queue
   * 
   * @private
   */
  private async startProcessing(): Promise<void> {
    this.isProcessing = true;
    
    // Start processing interval
    this.processingInterval = setInterval(async () => {
      await this.processQueue();
    }, this.config.processInterval);

    // Wait for all jobs to complete
    while (this.isProcessing && this.hasRemainingJobs()) {
      await this.sleep(1000);
      this.updateProgress();
    }

    // Clean up interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
  }

  /**
   * Process jobs from the queue
   * 
   * @private
   */
  private async processQueue(): Promise<void> {
    // Check resource limits
    if (!this.resourceMonitor.isWithinLimits()) {
      logger.warn('Resource limits exceeded, pausing processing');
      return;
    }

    // Check circuit breaker
    if (this.config.circuitBreaker.enabled && this.circuitBreaker.state === 'open') {
      logger.warn('Circuit breaker is open, skipping processing cycle');
      return;
    }

    // Process jobs up to concurrency limit
    while (this.activeJobs.size < this.config.maxConcurrency && this.hasAvailableJobs()) {
      const job = this.getNextJob();
      if (job) {
        await this.processJob(job);
      }
    }
  }

  /**
   * Get next job from queue
   * 
   * @private
   * @returns Next job to process or null if none available
   */
  private getNextJob(): OptimizationJob | null {
    const pendingJobs = this.jobQueue.filter(job => job.status === 'pending');
    return pendingJobs.length > 0 ? pendingJobs[0] : null;
  }

  /**
   * Process individual optimization job
   * 
   * @private
   * @param job - Job to process
   */
  private async processJob(job: OptimizationJob): Promise<void> {
    job.status = 'processing';
    job.timestamps.started = new Date();
    job.attempts++;
    
    this.activeJobs.set(job.id, job);
    this.emit('jobStarted', job);

    try {
      // Execute optimization with circuit breaker
      const result = await this.circuitBreaker.execute(async () => {
        return await this.optimizeTemplateJob(job);
      });

      job.result = result;
      job.status = 'completed';
      job.timestamps.completed = new Date();
      
      // Save optimized template
      await this.saveOptimizedTemplate(job);
      
      this.emit('jobCompleted', job);
      logger.debug(`Job completed: ${job.id}`);

    } catch (error) {
      job.error = (error as Error).message;
      
      // Retry logic
      if (job.attempts < this.config.maxRetries) {
        job.status = 'pending';
        logger.warn(`Job failed, will retry: ${job.id} (attempt ${job.attempts}/${this.config.maxRetries})`);
        
        // Add exponential backoff delay
        setTimeout(() => {
          // Job will be picked up in next processing cycle
        }, this.config.retryDelay * Math.pow(2, job.attempts - 1));
        
      } else {
        job.status = 'failed';
        job.timestamps.completed = new Date();
        this.emit('jobFailed', job);
        logger.error(`Job failed permanently: ${job.id}`, error);
      }
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Optimize template for a specific job
   * 
   * @private
   * @param job - Optimization job
   * @returns Optimization result
   */
  private async optimizeTemplateJob(job: OptimizationJob): Promise<any> {
    const optimizationRequest = {
      templateId: job.template.id,
      content: job.template.content,
      task: job.template.description || 'Template optimization',
      model: job.params.model,
      iterations: job.params.iterations,
      examples: job.params.examples,
      reasoning: job.params.reasoning,
      timeout: this.config.timeout
    };

    return await this.optimizationService.optimizePrompt(optimizationRequest);
  }

  /**
   * Save optimized template result
   * 
   * @private
   * @param job - Completed job with result
   */
  private async saveOptimizedTemplate(job: OptimizationJob): Promise<void> {
    const outputDir = path.join(this.config.outputDir, 'optimized');
    await fs.mkdir(outputDir, { recursive: true });

    const optimizedPath = path.join(outputDir, `${job.template.id}.optimized.json`);
    const optimizedData = {
      jobId: job.id,
      templateId: job.template.id,
      content: job.result.optimizedTemplate.content,
      optimization: {
        requestId: job.result.requestId,
        metrics: job.result.metrics,
        qualityScore: job.result.qualityScore,
        processingTime: job.timestamps.completed!.getTime() - job.timestamps.started!.getTime(),
        attempts: job.attempts,
        timestamp: new Date().toISOString()
      }
    };

    await fs.writeFile(optimizedPath, JSON.stringify(optimizedData, null, 2));
  }

  /**
   * Check if there are remaining jobs to process
   * 
   * @private
   * @returns True if there are jobs still to be processed
   */
  private hasRemainingJobs(): boolean {
    return this.jobQueue.some(job => 
      job.status === 'pending' || job.status === 'processing'
    );
  }

  /**
   * Check if there are available jobs to start processing
   * 
   * @private
   * @returns True if there are pending jobs
   */
  private hasAvailableJobs(): boolean {
    return this.jobQueue.some(job => job.status === 'pending');
  }

  /**
   * Update progress statistics
   * 
   * @private
   */
  private updateProgress(): void {
    this.progress.completed = this.jobQueue.filter(job => job.status === 'completed').length;
    this.progress.failed = this.jobQueue.filter(job => job.status === 'failed').length;
    this.progress.processing = this.activeJobs.size;
    this.progress.pending = this.jobQueue.filter(job => job.status === 'pending').length;
    this.progress.cancelled = this.jobQueue.filter(job => job.status === 'cancelled').length;
    
    // Calculate throughput and ETA
    const elapsed = Date.now() - this.progress.startTime.getTime();
    const processed = this.progress.completed + this.progress.failed;
    
    if (processed > 0 && elapsed > 0) {
      this.progress.throughput = (processed / elapsed) * 60000; // jobs per minute
      this.progress.avgProcessingTime = elapsed / processed;
      
      const remaining = this.progress.total - processed;
      if (remaining > 0 && this.progress.throughput > 0) {
        const etaMs = (remaining / this.progress.throughput) * 60000;
        this.progress.estimatedCompletion = new Date(Date.now() + etaMs);
      }
    }

    // Update resource usage
    this.progress.resourceUsage = this.resourceMonitor.getUsage();
    
    this.emit('progress', this.progress);
  }

  /**
   * Start progress monitoring
   * 
   * @private
   */
  private startProgressMonitoring(): void {
    const progressInterval = setInterval(() => {
      this.updateProgress();
    }, 5000);

    this.once('processingComplete', () => {
      clearInterval(progressInterval);
    });
  }

  /**
   * Stop progress monitoring
   * 
   * @private
   */
  private stopProgressMonitoring(): void {
    this.emit('processingComplete');
  }

  /**
   * Start checkpoint saving
   * 
   * @private
   */
  private startCheckpointSaving(): void {
    this.checkpointInterval = setInterval(async () => {
      await this.saveCheckpoint();
    }, this.config.checkpointInterval);
  }

  /**
   * Stop checkpoint saving
   * 
   * @private
   */
  private stopCheckpointSaving(): void {
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
    }
  }

  /**
   * Save current state as checkpoint
   * 
   * @private
   */
  private async saveCheckpoint(): Promise<void> {
    const checkpointData = {
      sessionId: this.sessionId,
      jobQueue: this.jobQueue,
      progress: this.progress,
      config: this.config
    };

    await this.checkpointManager.saveCheckpoint(checkpointData, this.sessionId);
  }

  /**
   * Resume processing from checkpoint
   * 
   * @private
   */
  private async resumeFromCheckpoint(): Promise<void> {
    const checkpointData = await this.checkpointManager.loadCheckpoint(this.sessionId);
    
    if (checkpointData) {
      this.jobQueue = checkpointData.jobQueue;
      this.progress = checkpointData.progress;
      
      // Reset processing jobs to pending
      this.jobQueue.forEach(job => {
        if (job.status === 'processing') {
          job.status = 'pending';
        }
      });

      logger.info(`Resumed from checkpoint with ${this.jobQueue.length} jobs`);
    }
  }

  /**
   * Generate batch processing report
   * 
   * @private
   */
  private async generateBatchReport(): Promise<void> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.progress.startTime.getTime();

    const report = {
      session: {
        id: this.sessionId,
        startTime: this.progress.startTime,
        endTime,
        duration
      },
      summary: this.progress,
      jobs: this.jobQueue.map(job => ({
        id: job.id,
        templateId: job.template.id,
        status: job.status,
        attempts: job.attempts,
        processingTime: job.timestamps.completed && job.timestamps.started
          ? job.timestamps.completed.getTime() - job.timestamps.started.getTime()
          : null,
        error: job.error
      })),
      performance: {
        throughput: this.progress.throughput,
        avgProcessingTime: this.progress.avgProcessingTime,
        peakMemoryUsage: this.progress.resourceUsage.memory,
        peakCpuUsage: this.progress.resourceUsage.cpu
      }
    };

    const reportPath = path.join(this.config.outputDir, `batch-report-${this.sessionId}.json`);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    logger.info(`Batch report generated: ${reportPath}`);
    this.displaySummary(report);
  }

  /**
   * Display batch processing summary
   * 
   * @private
   * @param report - Batch processing report
   */
  private displaySummary(report: any): void {
    console.log('\n' + chalk.green.bold('🚀 Batch Optimization Complete'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    console.log(`${chalk.blue('Session ID:')} ${report.session.id}`);
    console.log(`${chalk.blue('Duration:')} ${(report.session.duration / 1000).toFixed(2)}s`);
    console.log(`${chalk.blue('Total Jobs:')} ${report.summary.total}`);
    console.log(`${chalk.green('Completed:')} ${report.summary.completed}`);
    console.log(`${chalk.red('Failed:')} ${report.summary.failed}`);
    console.log(`${chalk.yellow('Cancelled:')} ${report.summary.cancelled}`);
    console.log(`${chalk.blue('Success Rate:')} ${((report.summary.completed / report.summary.total) * 100).toFixed(1)}%`);
    console.log(`${chalk.blue('Throughput:')} ${report.performance.throughput.toFixed(2)} jobs/min`);
    console.log(`${chalk.blue('Avg Processing Time:')} ${(report.performance.avgProcessingTime / 1000).toFixed(2)}s`);
  }

  /**
   * Gracefully stop batch processing
   * 
   * @param reason - Reason for stopping
   */
  async stop(reason = 'Manual stop'): Promise<void> {
    logger.info(`Stopping batch processing: ${reason}`);
    this.isProcessing = false;
    
    // Cancel pending jobs
    this.jobQueue.forEach(job => {
      if (job.status === 'pending') {
        job.status = 'cancelled';
      }
    });

    // Wait for active jobs to complete (with timeout)
    const stopTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeJobs.size > 0 && (Date.now() - startTime) < stopTimeout) {
      await this.sleep(1000);
    }

    // Force cancel remaining active jobs if timeout reached
    if (this.activeJobs.size > 0) {
      this.activeJobs.forEach(job => {
        job.status = 'cancelled';
      });
      this.activeJobs.clear();
    }

    // Save final checkpoint
    if (this.config.enableCheckpoints) {
      await this.saveCheckpoint();
    }

    this.emit('stopped', reason);
  }

  /**
   * Utility function for sleeping
   * 
   * @private
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * CLI interface for batch optimization
 */
async function main() {
  const program = new Command();
  
  program
    .name('batch-optimize')
    .description('Batch optimization tool for processing multiple templates')
    .version('1.0.0');

  program
    .option('-c, --concurrency <num>', 'Maximum concurrent optimizations', '5')
    .option('-b, --batch-size <size>', 'Batch size for processing', '20')
    .option('-t, --timeout <ms>', 'Optimization timeout in milliseconds', '300000')
    .option('-r, --max-retries <num>', 'Maximum retry attempts', '3')
    .option('--enable-checkpoints', 'Enable checkpoint recovery', false)
    .option('-o, --output <dir>', 'Output directory for results', './batch-results')
    .option('--resume', 'Resume from checkpoint if available', false)
    .option('-f, --filter <pattern>', 'Filter templates by pattern')
    .action(async (options) => {
      const config: BatchOptimizationConfig = {
        maxConcurrency: parseInt(options.concurrency),
        batchSize: parseInt(options.batchSize),
        processInterval: 1000,
        timeout: parseInt(options.timeout),
        maxRetries: parseInt(options.maxRetries),
        retryDelay: 1000,
        enableCheckpoints: options.enableCheckpoints,
        checkpointInterval: 30000, // 30 seconds
        outputDir: options.output,
        resourceLimits: {
          memoryLimitMB: 2048,
          cpuThreshold: 80
        },
        circuitBreaker: {
          failureThreshold: 5,
          resetTimeout: 60000,
          enabled: true
        }
      };

      try {
        const optimizer = new BatchOptimizer(config);
        
        // Setup progress monitoring
        const spinner = ora('Initializing batch optimization...').start();
        
        optimizer.on('progress', (progress) => {
          spinner.text = `Processing: ${progress.completed}/${progress.total} completed, ${progress.processing} active, ETA: ${progress.estimatedCompletion?.toLocaleTimeString() || 'calculating...'}`;
        });

        optimizer.on('jobCompleted', (job) => {
          logger.debug(`✓ Optimized: ${job.template.id}`);
        });

        optimizer.on('jobFailed', (job) => {
          logger.warn(`✗ Failed: ${job.template.id} - ${job.error}`);
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
          spinner.info('Received SIGINT, gracefully stopping...');
          await optimizer.stop('SIGINT received');
          process.exit(0);
        });

        // Load templates
        const templateService = new TemplateService();
        let templates = await templateService.listTemplates();

        // Apply filter if specified
        if (options.filter) {
          const regex = new RegExp(options.filter, 'i');
          templates = templates.filter(template => 
            regex.test(template.id) || regex.test(template.name || '')
          );
        }

        spinner.succeed(`Found ${templates.length} templates for batch optimization`);

        // Start batch processing
        await optimizer.processBatch(templates, options.resume);

      } catch (error) {
        console.error(chalk.red('Batch optimization failed:'), error);
        process.exit(1);
      }
    });

  await program.parseAsync();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { BatchOptimizer, BatchOptimizationConfig, OptimizationJob, BatchProgress };
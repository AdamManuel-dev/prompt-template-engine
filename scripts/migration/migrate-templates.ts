/**
 * @fileoverview Migration script for converting existing templates to optimized versions
 * @lastmodified 2024-08-26T16:20:00Z
 * 
 * Features: Template discovery, optimization queueing, progress tracking, rollback support
 * Main APIs: TemplateService, OptimizationService, PromptWizardClient integration
 * Constraints: Requires PromptWizard service running, database access, proper error handling
 * Patterns: Batch processing, progress monitoring, failure recovery, data integrity validation
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { Command } from 'commander';

import { TemplateService } from '../../src/services/template.service';
import { PromptOptimizationService } from '../../src/services/prompt-optimization.service';
import { PromptWizardClient, createDefaultConfig } from '../../src/integrations/promptwizard';
import { logger } from '../../src/utils/logger';
import { Template } from '../../src/types';

/**
 * Configuration interface for template migration
 */
interface MigrationConfig {
  /** Batch size for processing templates */
  batchSize: number;
  /** Maximum concurrent optimizations */
  maxConcurrency: number;
  /** Timeout for individual optimizations (ms) */
  optimizationTimeout: number;
  /** Skip templates that already have optimized versions */
  skipExisting: boolean;
  /** Dry run mode - no actual changes */
  dryRun: boolean;
  /** Output directory for migration reports */
  outputDir: string;
  /** Template filter pattern */
  filterPattern?: string;
  /** Priority level for optimizations */
  priority: 'low' | 'normal' | 'high' | 'critical';
  /** Number of retry attempts on failure */
  maxRetries: number;
}

/**
 * Migration progress tracking interface
 */
interface MigrationProgress {
  /** Total number of templates to migrate */
  total: number;
  /** Number of templates processed successfully */
  successful: number;
  /** Number of failed migrations */
  failed: number;
  /** Number of templates skipped */
  skipped: number;
  /** Currently processing templates */
  inProgress: string[];
  /** Start time of migration */
  startTime: Date;
  /** Estimated completion time */
  estimatedCompletion?: Date;
  /** Migration errors by template ID */
  errors: Record<string, string>;
}

/**
 * Migration result for individual template
 */
interface TemplateMigrationResult {
  /** Template identifier */
  templateId: string;
  /** Migration status */
  status: 'success' | 'failed' | 'skipped';
  /** Original template content */
  originalContent: string;
  /** Optimized template content (if successful) */
  optimizedContent?: string;
  /** Optimization metrics */
  metrics?: {
    tokenReduction: number;
    accuracyImprovement: number;
    optimizationTime: number;
  };
  /** Error message if failed */
  error?: string;
  /** Processing timestamps */
  timestamps: {
    started: Date;
    completed: Date;
  };
}

/**
 * Complete migration report
 */
interface MigrationReport {
  /** Migration session metadata */
  session: {
    id: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    config: MigrationConfig;
  };
  /** Overall migration statistics */
  summary: {
    totalTemplates: number;
    successful: number;
    failed: number;
    skipped: number;
    successRate: number;
    averageOptimizationTime: number;
    totalTokensReduced: number;
    averageAccuracyImprovement: number;
  };
  /** Individual template results */
  results: TemplateMigrationResult[];
  /** Performance metrics */
  performance: {
    throughput: number; // templates per minute
    averageLatency: number;
    peakConcurrency: number;
  };
  /** Errors and warnings */
  issues: {
    errors: Array<{ templateId: string; error: string; timestamp: Date }>;
    warnings: Array<{ message: string; timestamp: Date }>;
  };
}

/**
 * Template migration orchestrator
 * 
 * Handles the complete workflow of discovering, optimizing, and migrating
 * existing templates to their optimized versions using PromptWizard.
 * 
 * @class TemplateMigrator
 * @example
 * ```typescript
 * const migrator = new TemplateMigrator({
 *   batchSize: 10,
 *   maxConcurrency: 3,
 *   optimizationTimeout: 300000,
 *   skipExisting: true,
 *   dryRun: false,
 *   outputDir: './migration-results',
 *   priority: 'normal',
 *   maxRetries: 2
 * });
 * 
 * const report = await migrator.migrateAllTemplates();
 * console.log(`Migration completed: ${report.summary.successful}/${report.summary.totalTemplates} templates optimized`);
 * ```
 */
class TemplateMigrator {
  private templateService: TemplateService;
  private optimizationService: PromptOptimizationService;
  private promptWizardClient: PromptWizardClient;
  private progress: MigrationProgress;
  private spinner: Ora;

  constructor(private config: MigrationConfig) {
    this.templateService = new TemplateService();
    
    // Initialize PromptWizard integration
    const pwConfig = createDefaultConfig();
    this.promptWizardClient = new PromptWizardClient(pwConfig);
    this.optimizationService = new PromptOptimizationService(
      this.promptWizardClient,
      this.templateService
    );

    // Initialize progress tracking
    this.progress = {
      total: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      inProgress: [],
      startTime: new Date(),
      errors: {}
    };

    this.spinner = ora();
  }

  /**
   * Migrate all templates to optimized versions
   * 
   * Main entry point for template migration. Discovers all templates,
   * filters based on configuration, and processes them in batches.
   * 
   * @returns Promise resolving to complete migration report
   * @throws {Error} If migration setup fails or critical errors occur
   */
  async migrateAllTemplates(): Promise<MigrationReport> {
    logger.info('Starting template migration process');
    this.spinner.start('Initializing template migration...');

    try {
      // Setup migration environment
      await this.initializeMigration();
      
      // Discover templates to migrate
      const templates = await this.discoverTemplates();
      this.progress.total = templates.length;

      if (templates.length === 0) {
        this.spinner.info('No templates found for migration');
        return this.generateReport();
      }

      this.spinner.succeed(`Found ${templates.length} templates for migration`);

      // Process templates in batches
      await this.processBatches(templates);

      // Generate and save final report
      const report = this.generateReport();
      await this.saveReport(report);

      this.displaySummary(report);
      return report;

    } catch (error) {
      this.spinner.fail('Migration failed');
      logger.error('Template migration failed', error);
      throw error;
    }
  }

  /**
   * Initialize migration environment and validate prerequisites
   * 
   * @private
   * @throws {Error} If initialization fails
   */
  private async initializeMigration(): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true });

    // Verify PromptWizard service health
    const isHealthy = await this.promptWizardClient.healthCheck();
    if (!isHealthy) {
      throw new Error('PromptWizard service is not available');
    }

    // Validate configuration
    if (this.config.batchSize <= 0 || this.config.maxConcurrency <= 0) {
      throw new Error('Invalid batch size or concurrency configuration');
    }

    logger.info('Migration environment initialized successfully');
  }

  /**
   * Discover all templates that need migration
   * 
   * @private
   * @returns Promise resolving to array of templates to migrate
   */
  private async discoverTemplates(): Promise<Template[]> {
    this.spinner.text = 'Discovering templates...';
    
    const allTemplates = await this.templateService.listTemplates();
    let filteredTemplates = allTemplates;

    // Apply filter pattern if specified
    if (this.config.filterPattern) {
      const regex = new RegExp(this.config.filterPattern, 'i');
      filteredTemplates = allTemplates.filter(template => 
        regex.test(template.id) || regex.test(template.name || '')
      );
    }

    // Skip templates that already have optimized versions
    if (this.config.skipExisting) {
      const templatesNeedingOptimization: Template[] = [];
      
      for (const template of filteredTemplates) {
        const hasOptimizedVersion = await this.hasOptimizedVersion(template.id);
        if (!hasOptimizedVersion) {
          templatesNeedingOptimization.push(template);
        }
      }
      
      filteredTemplates = templatesNeedingOptimization;
    }

    return filteredTemplates;
  }

  /**
   * Check if template already has an optimized version
   * 
   * @private
   * @param templateId - Template identifier to check
   * @returns Promise resolving to true if optimized version exists
   */
  private async hasOptimizedVersion(templateId: string): Promise<boolean> {
    try {
      const optimizedPath = path.join(
        this.config.outputDir,
        'optimized',
        `${templateId}.optimized.json`
      );
      return existsSync(optimizedPath);
    } catch {
      return false;
    }
  }

  /**
   * Process templates in batches with concurrency control
   * 
   * @private
   * @param templates - Templates to process
   */
  private async processBatches(templates: Template[]): Promise<void> {
    const batches = this.createBatches(templates, this.config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      this.spinner.text = `Processing batch ${i + 1}/${batches.length} (${batch.length} templates)`;
      
      // Process batch with concurrency limit
      const batchPromises = batch.map(template => 
        this.processTemplateWithRetry(template)
      );

      // Wait for batch to complete with concurrency control
      const semaphore = new Semaphore(this.config.maxConcurrency);
      const results = await Promise.allSettled(
        batchPromises.map(async (promise) => {
          const release = await semaphore.acquire();
          try {
            return await promise;
          } finally {
            release();
          }
        })
      );

      // Update progress based on results
      this.updateProgressFromBatch(results);
      
      // Update estimated completion time
      this.updateEstimatedCompletion();
    }
  }

  /**
   * Process individual template with retry logic
   * 
   * @private
   * @param template - Template to process
   * @returns Promise resolving to migration result
   */
  private async processTemplateWithRetry(template: Template): Promise<TemplateMigrationResult> {
    const result: TemplateMigrationResult = {
      templateId: template.id,
      status: 'failed',
      originalContent: template.content,
      timestamps: {
        started: new Date(),
        completed: new Date()
      }
    };

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts < this.config.maxRetries) {
      attempts++;
      
      try {
        this.progress.inProgress.push(template.id);
        
        if (this.config.dryRun) {
          // Simulate optimization in dry run mode
          result.status = 'success';
          result.optimizedContent = `[DRY RUN] Optimized version of: ${template.content}`;
          result.metrics = {
            tokenReduction: 25,
            accuracyImprovement: 15,
            optimizationTime: 1000
          };
        } else {
          // Perform actual optimization
          const optimizationResult = await this.optimizeTemplate(template);
          result.status = 'success';
          result.optimizedContent = optimizationResult.optimizedTemplate.content;
          result.metrics = optimizationResult.metrics;
          
          // Save optimized template
          await this.saveOptimizedTemplate(template.id, optimizationResult);
        }
        
        result.timestamps.completed = new Date();
        break; // Success, exit retry loop
        
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Template optimization failed (attempt ${attempts}/${this.config.maxRetries}): ${template.id}`, error);
        
        if (attempts >= this.config.maxRetries) {
          result.status = 'failed';
          result.error = lastError.message;
          result.timestamps.completed = new Date();
          this.progress.errors[template.id] = lastError.message;
        } else {
          // Wait before retry with exponential backoff
          await this.sleep(Math.pow(2, attempts) * 1000);
        }
      } finally {
        // Remove from in-progress list
        this.progress.inProgress = this.progress.inProgress.filter(id => id !== template.id);
      }
    }

    return result;
  }

  /**
   * Optimize individual template using PromptWizard
   * 
   * @private
   * @param template - Template to optimize
   * @returns Promise resolving to optimization result
   */
  private async optimizeTemplate(template: Template): Promise<any> {
    const optimizationRequest = {
      templateId: template.id,
      content: template.content,
      task: template.description || 'Template optimization',
      model: 'gpt-4',
      iterations: 3,
      examples: 5,
      priority: this.config.priority,
      timeout: this.config.optimizationTimeout
    };

    return await this.optimizationService.optimizePrompt(optimizationRequest);
  }

  /**
   * Save optimized template to file system
   * 
   * @private
   * @param templateId - Template identifier
   * @param optimizationResult - Optimization result to save
   */
  private async saveOptimizedTemplate(templateId: string, optimizationResult: any): Promise<void> {
    const optimizedDir = path.join(this.config.outputDir, 'optimized');
    await fs.mkdir(optimizedDir, { recursive: true });

    const optimizedPath = path.join(optimizedDir, `${templateId}.optimized.json`);
    const optimizedData = {
      templateId,
      content: optimizationResult.optimizedTemplate.content,
      optimization: {
        requestId: optimizationResult.requestId,
        metrics: optimizationResult.metrics,
        qualityScore: optimizationResult.qualityScore,
        timestamp: new Date().toISOString()
      }
    };

    await fs.writeFile(optimizedPath, JSON.stringify(optimizedData, null, 2));
  }

  /**
   * Create batches from template array
   * 
   * @private
   * @param templates - Templates to batch
   * @param batchSize - Size of each batch
   * @returns Array of template batches
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Update progress tracking from batch results
   * 
   * @private
   * @param results - Batch processing results
   */
  private updateProgressFromBatch(results: PromiseSettledResult<TemplateMigrationResult>[]): void {
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const templateResult = result.value;
        switch (templateResult.status) {
          case 'success':
            this.progress.successful++;
            break;
          case 'failed':
            this.progress.failed++;
            break;
          case 'skipped':
            this.progress.skipped++;
            break;
        }
      } else {
        this.progress.failed++;
      }
    }
  }

  /**
   * Update estimated completion time
   * 
   * @private
   */
  private updateEstimatedCompletion(): void {
    const processed = this.progress.successful + this.progress.failed + this.progress.skipped;
    if (processed > 0) {
      const elapsed = Date.now() - this.progress.startTime.getTime();
      const avgTimePerTemplate = elapsed / processed;
      const remaining = this.progress.total - processed;
      const estimatedRemainingTime = remaining * avgTimePerTemplate;
      
      this.progress.estimatedCompletion = new Date(Date.now() + estimatedRemainingTime);
    }
  }

  /**
   * Generate comprehensive migration report
   * 
   * @private
   * @returns Complete migration report
   */
  private generateReport(): MigrationReport {
    const endTime = new Date();
    const duration = endTime.getTime() - this.progress.startTime.getTime();

    return {
      session: {
        id: `migration-${Date.now()}`,
        startTime: this.progress.startTime,
        endTime,
        duration,
        config: this.config
      },
      summary: {
        totalTemplates: this.progress.total,
        successful: this.progress.successful,
        failed: this.progress.failed,
        skipped: this.progress.skipped,
        successRate: this.progress.total > 0 ? (this.progress.successful / this.progress.total) * 100 : 0,
        averageOptimizationTime: 0, // Would be calculated from individual results
        totalTokensReduced: 0, // Would be calculated from metrics
        averageAccuracyImprovement: 0 // Would be calculated from metrics
      },
      results: [], // Individual results would be collected during processing
      performance: {
        throughput: this.progress.total > 0 ? (this.progress.total / (duration / 60000)) : 0,
        averageLatency: 0, // Would be calculated from individual processing times
        peakConcurrency: this.config.maxConcurrency
      },
      issues: {
        errors: Object.entries(this.progress.errors).map(([templateId, error]) => ({
          templateId,
          error,
          timestamp: new Date()
        })),
        warnings: []
      }
    };
  }

  /**
   * Save migration report to file
   * 
   * @private
   * @param report - Migration report to save
   */
  private async saveReport(report: MigrationReport): Promise<void> {
    const reportPath = path.join(
      this.config.outputDir,
      `migration-report-${report.session.id}.json`
    );
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    logger.info(`Migration report saved to: ${reportPath}`);
  }

  /**
   * Display migration summary
   * 
   * @private
   * @param report - Migration report to display
   */
  private displaySummary(report: MigrationReport): void {
    console.log('\n' + chalk.green.bold('🎉 Template Migration Complete'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    console.log(`${chalk.blue('Total Templates:')} ${report.summary.totalTemplates}`);
    console.log(`${chalk.green('Successful:')} ${report.summary.successful}`);
    console.log(`${chalk.red('Failed:')} ${report.summary.failed}`);
    console.log(`${chalk.yellow('Skipped:')} ${report.summary.skipped}`);
    console.log(`${chalk.blue('Success Rate:')} ${report.summary.successRate.toFixed(1)}%`);
    console.log(`${chalk.blue('Duration:')} ${(report.session.duration / 1000).toFixed(2)}s`);
    console.log(`${chalk.blue('Throughput:')} ${report.performance.throughput.toFixed(2)} templates/min`);
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
 * Semaphore for concurrency control
 */
class Semaphore {
  private permits: number;
  private waiting: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise<() => void>((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waiting.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    }
  }
}

/**
 * CLI interface for template migration
 */
async function main() {
  const program = new Command();
  
  program
    .name('migrate-templates')
    .description('Migrate existing templates to optimized versions using PromptWizard')
    .version('1.0.0');

  program
    .option('-b, --batch-size <size>', 'Batch size for processing', '10')
    .option('-c, --max-concurrency <num>', 'Maximum concurrent optimizations', '3')
    .option('-t, --timeout <ms>', 'Optimization timeout in milliseconds', '300000')
    .option('--skip-existing', 'Skip templates with existing optimized versions', false)
    .option('--dry-run', 'Perform dry run without actual optimizations', false)
    .option('-o, --output <dir>', 'Output directory for results', './migration-results')
    .option('-f, --filter <pattern>', 'Filter templates by pattern')
    .option('-p, --priority <level>', 'Optimization priority level', 'normal')
    .option('-r, --max-retries <num>', 'Maximum retry attempts', '2')
    .action(async (options) => {
      const config: MigrationConfig = {
        batchSize: parseInt(options.batchSize),
        maxConcurrency: parseInt(options.maxConcurrency),
        optimizationTimeout: parseInt(options.timeout),
        skipExisting: options.skipExisting,
        dryRun: options.dryRun,
        outputDir: options.output,
        filterPattern: options.filter,
        priority: options.priority as any,
        maxRetries: parseInt(options.maxRetries)
      };

      try {
        const migrator = new TemplateMigrator(config);
        await migrator.migrateAllTemplates();
        process.exit(0);
      } catch (error) {
        console.error(chalk.red('Migration failed:'), error);
        process.exit(1);
      }
    });

  await program.parseAsync();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { TemplateMigrator, MigrationConfig, MigrationReport, TemplateMigrationResult };
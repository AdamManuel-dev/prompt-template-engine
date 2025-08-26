/**
 * @fileoverview CLI command for optimizing prompts using PromptWizard
 * @lastmodified 2025-08-26T11:37:12Z
 *
 * Features: Single and batch prompt optimization with progress indicators
 * Main APIs: OptimizeCommand class implementing ICommand interface
 * Constraints: Requires PromptWizard service running, handles templates via TemplateService
 * Patterns: Command pattern, async operations with progress tracking
 */

import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { BaseCommand } from '../base-command';
import { CommandOption } from '../command-registry';
import { logger } from '../../utils/logger';
import { TemplateService } from '../../services/template.service';
import { CacheService } from '../../services/cache.service';
import {
  PromptOptimizationService,
  OptimizationRequest,
  BatchOptimizationRequest,
} from '../../services/prompt-optimization.service';
import {
  PromptWizardClient,
  createDefaultConfig,
} from '../../integrations/promptwizard';

/**
 * Options for the optimize command
 * @interface OptimizeOptions
 * @example
 * ```bash
 * # Single template optimization
 * cursor-prompt optimize --template "my-prompt" --model "gpt-4" --iterations 5
 *
 * # Batch optimization with output
 * cursor-prompt optimize --batch --output "./optimized" --skip-cache
 *
 * # High priority optimization with reasoning
 * cursor-prompt optimize -t "critical-prompt" --priority high --reasoning
 * ```
 */
interface OptimizeOptions {
  /** Template name or path to optimize */
  template?: string;
  /** Task description for optimization context */
  task?: string;
  /** Target model for optimization (gpt-4, claude-3-opus, etc.) */
  model?: string;
  /** Number of refinement iterations to perform */
  iterations?: number;
  /** Number of few-shot examples to generate */
  examples?: number;
  /** Whether to generate reasoning steps in optimized prompt */
  reasoning?: boolean;
  /** Enable batch mode for multiple templates */
  batch?: boolean;
  /** Output path for optimized template(s) */
  output?: string;
  /** Skip cache and force fresh optimization */
  skipCache?: boolean;
  /** Optimization priority level */
  priority?: string;
}

/**
 * CLI command for optimizing prompts using Microsoft PromptWizard
 *
 * Provides both single template and batch optimization capabilities with
 * comprehensive progress tracking, caching, and result analysis. Supports
 * various optimization parameters and output formats.
 *
 * @class OptimizeCommand
 * @extends BaseCommand
 * @example
 * ```bash
 * # Basic usage - optimize a specific template
 * cursor-prompt optimize --template "user-onboarding" --task "Guide new users"
 *
 * # Advanced single optimization
 * cursor-prompt optimize \
 *   --template "support-response" \
 *   --model "claude-3-opus" \
 *   --iterations 5 \
 *   --examples 10 \
 *   --reasoning \
 *   --output "./optimized/support.json"
 *
 * # Batch optimization of all templates
 * cursor-prompt optimize --batch --priority high --skip-cache
 *
 * # Quick optimization with defaults
 * cursor-prompt opt -t "my-prompt"
 * ```
 */
export class OptimizeCommand extends BaseCommand {
  /** Command name for CLI invocation */
  name = 'prompt:optimize';

  /** Human-readable command description */
  description = 'Optimize prompts using Microsoft PromptWizard';

  /** Command aliases for shorter invocation */
  aliases = ['optimize', 'opt'];

  /** Command-line options configuration */
  options: CommandOption[] = [
    {
      flags: '-t, --template <name>',
      description: 'Template name or path to optimize',
    },
    {
      flags: '--task <description>',
      description: 'Task description for optimization',
    },
    {
      flags: '-m, --model <model>',
      description: 'Target model for optimization (gpt-4, claude-3-opus, etc.)',
      defaultValue: 'gpt-4',
    },
    {
      flags: '-i, --iterations <number>',
      description: 'Number of refinement iterations',
      defaultValue: '3',
    },
    {
      flags: '-e, --examples <number>',
      description: 'Number of few-shot examples to generate',
      defaultValue: '5',
    },
    {
      flags: '--reasoning',
      description: 'Generate reasoning steps in optimized prompt',
      defaultValue: true,
    },
    {
      flags: '--batch',
      description: 'Batch optimize multiple templates',
    },
    {
      flags: '-o, --output <path>',
      description: 'Output path for optimized template(s)',
    },
    {
      flags: '--skip-cache',
      description: 'Skip cache and force fresh optimization',
    },
    {
      flags: '--priority <level>',
      description: 'Optimization priority (low, normal, high, critical)',
      defaultValue: 'normal',
    },
  ];

  /** Service for template operations and management */
  private templateService!: TemplateService;

  /** Service for optimization result caching */
  private cacheService!: CacheService;

  /** Core optimization service with PromptWizard integration */
  private optimizationService!: PromptOptimizationService;

  /** PromptWizard client for API communication */
  private client!: PromptWizardClient;

  /**
   * Execute the optimize command
   *
   * Main entry point for command execution. Initializes services,
   * performs health checks, and routes to single or batch optimization
   * based on command options.
   *
   * @param args - Command arguments (unused)
   * @param options - Parsed command options
   * @returns Promise that resolves when optimization completes
   *
   * @throws {Error} If PromptWizard service is unavailable
   * @throws {Error} If service initialization fails
   *
   * @example
   * ```typescript
   * const command = new OptimizeCommand();
   *
   * // Single optimization
   * await command.execute([], {
   *   template: 'user-guide',
   *   model: 'gpt-4',
   *   iterations: 3
   * });
   *
   * // Batch optimization
   * await command.execute([], {
   *   batch: true,
   *   priority: 'high',
   *   output: './results'
   * });
   * ```
   */
  async execute(_args: unknown, options: OptimizeOptions): Promise<void> {
    await this.initializeServices();

    // Check service health
    const isHealthy = await this.checkServiceHealth();
    if (!isHealthy) {
      this.error(
        'PromptWizard service is not available. Please check your configuration.'
      );
      process.exit(1);
    }

    if (options.batch) {
      await this.batchOptimize(options);
    } else {
      await this.singleOptimize(options);
    }
  }

  /**
   * Initialize required services
   *
   * Sets up the PromptWizard client, template service, cache service,
   * and optimization service with proper error handling.
   *
   * @private
   * @returns Promise that resolves when all services are initialized
   * @throws {Error} If any service initialization fails
   */
  private async initializeServices(): Promise<void> {
    try {
      const config = createDefaultConfig();
      this.client = new PromptWizardClient(config);
      this.templateService = new TemplateService();
      this.cacheService = new CacheService();
      this.optimizationService = new PromptOptimizationService(
        this.client,
        this.templateService,
        this.cacheService
      );
    } catch (error) {
      this.error(
        `Failed to initialize services: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  }

  /**
   * Check PromptWizard service health
   *
   * Performs a health check against the PromptWizard service to ensure
   * it's available and responsive before attempting optimization.
   *
   * @private
   * @returns Promise resolving to true if service is healthy
   *
   * @example
   * ```typescript
   * const isHealthy = await this.checkServiceHealth();
   * if (!isHealthy) {
   *   console.error('PromptWizard service unavailable');
   *   process.exit(1);
   * }
   * ```
   */
  private async checkServiceHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.client.healthCheck();
      if (isHealthy) {
        this.success('PromptWizard service is healthy');
      }
      return isHealthy;
    } catch (error) {
      logger.error(
        `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Optimize a single template
   *
   * Handles the complete workflow for optimizing a single template:
   * - Template loading and validation
   * - Task description determination
   * - Optimization request preparation
   * - Progress tracking and event handling
   * - Result display and optional saving
   *
   * @private
   * @param options - Command options for single optimization
   * @returns Promise that resolves when optimization completes
   *
   * @example
   * ```typescript
   * // Internal usage within execute()
   * await this.singleOptimize({
   *   template: 'customer-support',
   *   model: 'gpt-4',
   *   iterations: 5,
   *   examples: 8,
   *   reasoning: true,
   *   output: './optimized.json'
   * });
   * ```
   */
  private async singleOptimize(options: OptimizeOptions): Promise<void> {
    let templateName = options.template;

    // If no template specified, prompt user
    if (!templateName) {
      templateName = await this.prompt('Enter template name or path');
      if (!templateName) {
        this.error('Template name is required');
        return;
      }
    }

    const spinner = ora(`Loading template: ${templateName}`).start();

    try {
      // Load template
      const templatePath =
        await this.templateService.findTemplate(templateName);
      if (!templatePath) {
        spinner.fail(`Template not found: ${templateName}`);
        return;
      }
      const template = await this.templateService.loadTemplate(templatePath);

      spinner.text = `Optimizing template: ${template.name}`;

      // Determine task description
      let task = options.task || template.description || '';
      if (!task) {
        spinner.stop();
        task = await this.prompt('Enter task description for optimization');
        spinner.start(`Optimizing template: ${template.name}`);
      }

      // Prepare optimization request
      const request: OptimizationRequest = {
        templateId: template.name,
        template,
        config: {
          task,
          targetModel: options.model as any,
          mutateRefineIterations: parseInt(
            options.iterations?.toString() || '3',
            10
          ),
          fewShotCount: parseInt(options.examples?.toString() || '5', 10),
          generateReasoning: options.reasoning !== false,
        },
        options: {
          skipCache: options.skipCache,
          priority: options.priority as any,
        },
      };

      // Set up progress tracking
      this.optimizationService.on('optimization:started', () => {
        spinner.text = 'Starting optimization with PromptWizard...';
      });

      this.optimizationService.on('optimization:completed', result => {
        spinner.succeed('Optimization completed successfully!');
        this.displayOptimizationResult(result);
      });

      this.optimizationService.on('optimization:failed', event => {
        spinner.fail(`Optimization failed: ${event.error}`);
      });

      // Start optimization
      const result = await this.optimizationService.optimizeTemplate(request);

      // Save optimized template if output path provided
      if (options.output) {
        await this.saveOptimizedTemplate(result, options.output);
      }
    } catch (error) {
      spinner.fail(
        `Optimization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Batch optimize multiple templates
   *
   * Processes multiple templates in batch mode with:
   * - Template discovery and loading
   * - User confirmation for batch operations
   * - Parallel optimization processing
   * - Comprehensive progress tracking
   * - Batch result aggregation and display
   *
   * @private
   * @param options - Command options for batch optimization
   * @returns Promise that resolves when batch optimization completes
   *
   * @example
   * ```bash
   * # CLI usage that triggers this method
   * cursor-prompt optimize --batch --priority high --output ./batch-results
   *
   * # Expected output:
   * # ✓ Found 15 templates for optimization
   * # ? Optimize 15 templates? This may take several minutes. (Y/n)
   * # ✓ Processing templates in batches...
   * # ✓ Batch optimization completed!
   * #
   * # Batch Results:
   * # - Successful: 14/15
   * # - Failed: 1/15
   * # - Average token reduction: 23.5%
   * ```
   */
  private async batchOptimize(options: OptimizeOptions): Promise<void> {
    const spinner = ora('Loading templates for batch optimization').start();

    try {
      // Get all templates
      const templateList = await this.templateService.listTemplates();
      const templates = [];

      for (const templateInfo of templateList) {
        try {
          const template = await this.templateService.loadTemplate(
            templateInfo.path
          );
          templates.push(template);
        } catch (error) {
          logger.warn(
            `Failed to load template ${templateInfo.name}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      if (templates.length === 0) {
        spinner.fail('No templates found for batch optimization');
        return;
      }

      spinner.text = `Found ${templates.length} templates for optimization`;

      // Confirm batch operation
      spinner.stop();
      const shouldProceed = await this.confirm(
        `Optimize ${templates.length} templates? This may take several minutes.`
      );

      if (!shouldProceed) {
        this.info('Batch optimization cancelled');
        return;
      }

      spinner.start('Starting batch optimization...');

      // Prepare batch request
      const batchRequest: BatchOptimizationRequest = {
        templates: templates.map(template => ({
          id: template.name,
          template,
        })),
        config: {
          targetModel: options.model as any,
          mutateRefineIterations: parseInt(
            options.iterations?.toString() || '3',
            10
          ),
          fewShotCount: parseInt(options.examples?.toString() || '5', 10),
          generateReasoning: options.reasoning !== false,
        },
        options: {
          skipCache: options.skipCache,
          priority: options.priority as any,
        },
      };

      // Set up progress tracking
      this.optimizationService.on('batch:started', () => {
        spinner.text = 'Processing templates in batches...';
      });

      // Start batch optimization
      const batchResult =
        await this.optimizationService.batchOptimize(batchRequest);

      spinner.succeed('Batch optimization completed!');
      this.displayBatchResult(batchResult);

      // Save results if output path provided
      if (options.output) {
        await this.saveBatchResults(batchResult, options.output);
      }
    } catch (error) {
      spinner.fail(
        `Batch optimization failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Display optimization result
   *
   * Renders a comprehensive, colorized display of optimization results
   * including metrics, quality scores, and the optimized content.
   *
   * @private
   * @param result - Optimization result from PromptWizard
   * @param result.templateId - ID of the optimized template
   * @param result.requestId - Unique request identifier
   * @param result.metrics - Performance metrics (token reduction, accuracy improvement, etc.)
   * @param result.qualityScore - Quality assessment with detailed breakdown
   * @param result.optimizedTemplate - The optimized prompt content
   *
   * @example
   * ```typescript
   * // Expected console output:
   * // 🎉 Optimization Results
   * // ═════════════════════════
   * // Template: user-onboarding
   * // Request ID: req_abc123
   * //
   * // 📊 Performance Metrics
   * // Token Reduction: 25%
   * // Accuracy Improvement: 15%
   * // Optimization Time: 12.3s
   * ```
   */
  private displayOptimizationResult(result: any): void {
    console.log(`\n${chalk.green.bold('🎉 Optimization Results')}`);
    console.log(chalk.cyan('═'.repeat(50)));

    console.log(`${chalk.blue('Template:')} ${result.templateId}`);
    console.log(`${chalk.blue('Request ID:')} ${result.requestId}`);

    console.log(`\n${chalk.yellow.bold('📊 Performance Metrics')}`);
    console.log(
      `${chalk.green('Token Reduction:')} ${result.metrics.tokenReduction}%`
    );
    console.log(
      `${chalk.green('Accuracy Improvement:')} ${result.metrics.accuracyImprovement}%`
    );
    console.log(
      `${chalk.green('Optimization Time:')} ${(result.metrics.optimizationTime / 1000).toFixed(2)}s`
    );
    console.log(`${chalk.green('API Calls Used:')} ${result.metrics.apiCalls}`);

    console.log(`\n${chalk.yellow.bold('⭐ Quality Score')}`);
    console.log(
      `${chalk.green('Overall Score:')} ${result.qualityScore.overall}/100`
    );
    console.log(
      `${chalk.blue('Clarity:')} ${result.qualityScore.metrics.clarity}/100`
    );
    console.log(
      `${chalk.blue('Task Alignment:')} ${result.qualityScore.metrics.taskAlignment}/100`
    );
    console.log(
      `${chalk.blue('Token Efficiency:')} ${result.qualityScore.metrics.tokenEfficiency}/100`
    );

    if (result.qualityScore.suggestions.length > 0) {
      console.log(`\n${chalk.yellow.bold('💡 Suggestions')}`);
      result.qualityScore.suggestions.forEach(
        (suggestion: string, index: number) => {
          console.log(`${chalk.gray(`${index + 1}.`)} ${suggestion}`);
        }
      );
    }

    console.log(`\n${chalk.magenta.bold('🔄 Optimized Content')}`);
    console.log(chalk.gray('─'.repeat(50)));
    console.log(result.optimizedTemplate.content);
    console.log(chalk.gray('─'.repeat(50)));
  }

  /**
   * Display batch optimization results
   *
   * Renders a summary of batch optimization including success/failure
   * counts, error details, and aggregate statistics.
   *
   * @private
   * @param batchResult - Batch optimization results
   * @param batchResult.batchId - Unique batch identifier
   * @param batchResult.successful - Number of successful optimizations
   * @param batchResult.failed - Number of failed optimizations
   * @param batchResult.total - Total number of templates processed
   * @param batchResult.errors - Array of error details for failed optimizations
   * @param batchResult.results - Array of successful optimization results
   *
   * @example
   * ```typescript
   * // Expected console output:
   * // 🎉 Batch Optimization Results
   * // ═════════════════════════
   * // Batch ID: batch_xyz789
   * // Successful: 18/20
   * // Failed: 2/20
   * //
   * // ❌ Errors
   * // • template-a: Timeout after 60s
   * // • template-b: Invalid format
   * ```
   */
  private displayBatchResult(batchResult: any): void {
    console.log(`\n${chalk.green.bold('🎉 Batch Optimization Results')}`);
    console.log(chalk.cyan('═'.repeat(50)));

    console.log(`${chalk.blue('Batch ID:')} ${batchResult.batchId}`);
    console.log(
      `${chalk.green('Successful:')} ${batchResult.successful}/${batchResult.total}`
    );
    console.log(
      `${chalk.red('Failed:')} ${batchResult.failed}/${batchResult.total}`
    );

    if (batchResult.errors.length > 0) {
      console.log(`\n${chalk.red.bold('❌ Errors')}`);
      batchResult.errors.forEach((error: any) => {
        console.log(`${chalk.red('•')} ${error.templateId}: ${error.error}`);
      });
    }

    if (batchResult.results.length > 0) {
      console.log(`\n${chalk.yellow.bold('📊 Summary Statistics')}`);
      const avgTokenReduction =
        batchResult.results.reduce(
          (sum: number, r: any) => sum + r.metrics.tokenReduction,
          0
        ) / batchResult.results.length;
      const avgAccuracyImprovement =
        batchResult.results.reduce(
          (sum: number, r: any) => sum + r.metrics.accuracyImprovement,
          0
        ) / batchResult.results.length;
      const totalOptimizationTime = batchResult.results.reduce(
        (sum: number, r: any) => sum + r.metrics.optimizationTime,
        0
      );

      console.log(
        `${chalk.green('Average Token Reduction:')} ${avgTokenReduction.toFixed(1)}%`
      );
      console.log(
        `${chalk.green('Average Accuracy Improvement:')} ${avgAccuracyImprovement.toFixed(1)}%`
      );
      console.log(
        `${chalk.green('Total Optimization Time:')} ${(totalOptimizationTime / 1000).toFixed(2)}s`
      );
    }
  }

  /**
   * Save optimized template to file
   *
   * Saves the optimization result as JSON file with complete metadata
   * including original template ID, optimization metrics, and quality scores.
   *
   * @private
   * @param result - Optimization result to save
   * @param outputPath - File path for saving the optimized template
   * @returns Promise that resolves when file is saved
   *
   * @throws {Error} If file write operations fail
   *
   * @example
   * ```typescript
   * // Saves to JSON file with structure:
   * // {
   * //   "content": "optimized prompt content...",
   * //   "optimization": {
   * //     "originalId": "user-guide",
   * //     "requestId": "req_abc123",
   * //     "metrics": {
   * //       "tokenReduction": 25,
   * //       "accuracyImprovement": 15
   * //     },
   * //     "qualityScore": {
   * //       "overall": 87,
   * //       "metrics": { "clarity": 90, "taskAlignment": 85 }
   * //     }
   * //   }
   * // }
   * ```
   */
  private async saveOptimizedTemplate(
    result: any,
    outputPath: string
  ): Promise<void> {
    try {
      // Create output directory if needed
      const fs = await import('fs');
      const outputDir = path.dirname(outputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Save optimized template
      const templateData = {
        ...result.optimizedTemplate,
        optimization: {
          originalId: result.templateId,
          requestId: result.requestId,
          metrics: result.metrics,
          qualityScore: result.qualityScore,
          timestamp: result.timestamp,
        },
      };

      fs.writeFileSync(outputPath, JSON.stringify(templateData, null, 2));
      this.success(`Optimized template saved to: ${outputPath}`);
    } catch (error) {
      this.error(
        `Failed to save optimized template: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Save batch optimization results to file
   *
   * Saves complete batch results including individual template results,
   * error details, and summary statistics as a JSON file.
   *
   * @private
   * @param batchResult - Complete batch optimization results
   * @param outputPath - File path for saving batch results
   * @returns Promise that resolves when file is saved
   *
   * @throws {Error} If file write operations fail
   *
   * @example
   * ```typescript
   * // Saves comprehensive batch data:
   * // {
   * //   "batchId": "batch_xyz789",
   * //   "timestamp": "2024-01-15T10:30:00Z",
   * //   "summary": {
   * //     "total": 20,
   * //     "successful": 18,
   * //     "failed": 2
   * //   },
   * //   "results": [...],
   * //   "errors": [...],
   * //   "statistics": {
   * //     "avgTokenReduction": 23.5,
   * //     "avgAccuracyImprovement": 12.8
   * //   }
   * // }
   * ```
   */
  private async saveBatchResults(
    batchResult: any,
    outputPath: string
  ): Promise<void> {
    try {
      const fs = await import('fs');
      const outputDir = path.dirname(outputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(batchResult, null, 2));
      this.success(`Batch results saved to: ${outputPath}`);
    } catch (error) {
      this.error(
        `Failed to save batch results: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default OptimizeCommand;

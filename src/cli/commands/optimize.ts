/**
 * @fileoverview CLI command for optimizing prompts using PromptWizard
 * @lastmodified 2025-08-26T12:45:00Z
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
import { PromptOptimizationService, OptimizationRequest } from '../../services/prompt-optimization.service';
import { PromptWizardClient, createDefaultConfig } from '../../integrations/promptwizard';
import { Template } from '../../types';

interface OptimizeOptions {
  template?: string;
  task?: string;
  model?: string;
  iterations?: number;
  examples?: number;
  reasoning?: boolean;
  batch?: boolean;
  output?: string;
  skipCache?: boolean;
  priority?: string;
}

export class OptimizeCommand extends BaseCommand {
  name = 'prompt:optimize';

  description = 'Optimize prompts using Microsoft PromptWizard';

  aliases = ['optimize', 'opt'];

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

  private templateService!: TemplateService;
  private cacheService!: CacheService;
  private optimizationService!: PromptOptimizationService;
  private client!: PromptWizardClient;

  async execute(args: unknown, options: OptimizeOptions): Promise<void> {
    await this.initializeServices();

    // Check service health
    const isHealthy = await this.checkServiceHealth();
    if (!isHealthy) {
      this.error('PromptWizard service is not available. Please check your configuration.');
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
      this.error(`Failed to initialize services: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  /**
   * Check PromptWizard service health
   */
  private async checkServiceHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.client.healthCheck();
      if (isHealthy) {
        this.success('PromptWizard service is healthy');
      }
      return isHealthy;
    } catch (error) {
      logger.error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Optimize a single template
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
      const templatePath = await this.templateService.findTemplate(templateName);
      if (!templatePath) {
        spinner.fail(`Template not found: ${templateName}`);
        return;
      }
      const template = await this.templateService.loadTemplate(templatePath);
      // Extract content by rendering template
      const renderedTemplate = await this.templateService.renderTemplate(template, {});
      const templateContent = renderedTemplate.files.map(f => f.content).join('\n');

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
        template: {
          id: template.name,
          name: template.name,
          content: templateContent,
          description: template.description,
        } as Template,
        config: {
          task,
          targetModel: options.model as any,
          mutateRefineIterations: parseInt(options.iterations?.toString() || '3', 10),
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

      this.optimizationService.on('optimization:completed', (result) => {
        spinner.succeed('Optimization completed successfully!');
        this.displayOptimizationResult(result);
      });

      this.optimizationService.on('optimization:failed', (event) => {
        spinner.fail(`Optimization failed: ${event.error}`);
      });

      // Start optimization
      const result = await this.optimizationService.optimizeTemplate(request);

      // Save optimized template if output path provided
      if (options.output) {
        await this.saveOptimizedTemplate(result, options.output);
      }
    } catch (error) {
      spinner.fail(`Optimization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Batch optimize multiple templates
   */
  private async batchOptimize(options: OptimizeOptions): Promise<void> {
    const spinner = ora('Loading templates for batch optimization').start();

    try {
      // Get all templates
      const templateList = await this.templateService.listTemplates();
      const templates = [];
      
      for (const templateInfo of templateList) {
        try {
          const template = await this.templateService.loadTemplate(templateInfo.path);
          templates.push(template);
        } catch (error) {
          logger.warn(`Failed to load template ${templateInfo.name}: ${error instanceof Error ? error.message : String(error)}`);
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
      const batchRequest = {
        templates: templates.map(template => ({
          id: template.id || template.name,
          template,
        })),
        config: {
          targetModel: options.model as any,
          mutateRefineIterations: parseInt(options.iterations?.toString() || '3', 10),
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
      const batchResult = await this.optimizationService.batchOptimize(batchRequest);
      
      spinner.succeed('Batch optimization completed!');
      this.displayBatchResult(batchResult);

      // Save results if output path provided
      if (options.output) {
        await this.saveBatchResults(batchResult, options.output);
      }
    } catch (error) {
      spinner.fail(`Batch optimization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Display optimization result
   */
  private displayOptimizationResult(result: any): void {
    console.log('\n' + chalk.green.bold('🎉 Optimization Results'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    console.log(`${chalk.blue('Template:')} ${result.templateId}`);
    console.log(`${chalk.blue('Request ID:')} ${result.requestId}`);
    
    console.log('\n' + chalk.yellow.bold('📊 Performance Metrics'));
    console.log(`${chalk.green('Token Reduction:')} ${result.metrics.tokenReduction}%`);
    console.log(`${chalk.green('Accuracy Improvement:')} ${result.metrics.accuracyImprovement}%`);
    console.log(`${chalk.green('Optimization Time:')} ${(result.metrics.optimizationTime / 1000).toFixed(2)}s`);
    console.log(`${chalk.green('API Calls Used:')} ${result.metrics.apiCalls}`);
    
    console.log('\n' + chalk.yellow.bold('⭐ Quality Score'));
    console.log(`${chalk.green('Overall Score:')} ${result.qualityScore.overall}/100`);
    console.log(`${chalk.blue('Clarity:')} ${result.qualityScore.metrics.clarity}/100`);
    console.log(`${chalk.blue('Task Alignment:')} ${result.qualityScore.metrics.taskAlignment}/100`);
    console.log(`${chalk.blue('Token Efficiency:')} ${result.qualityScore.metrics.tokenEfficiency}/100`);
    
    if (result.qualityScore.suggestions.length > 0) {
      console.log('\n' + chalk.yellow.bold('💡 Suggestions'));
      result.qualityScore.suggestions.forEach((suggestion: string, index: number) => {
        console.log(`${chalk.gray(`${index + 1}.`)} ${suggestion}`);
      });
    }
    
    console.log('\n' + chalk.magenta.bold('🔄 Optimized Content'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(result.optimizedTemplate.content);
    console.log(chalk.gray('─'.repeat(50)));
  }

  /**
   * Display batch optimization results
   */
  private displayBatchResult(batchResult: any): void {
    console.log('\n' + chalk.green.bold('🎉 Batch Optimization Results'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    console.log(`${chalk.blue('Batch ID:')} ${batchResult.batchId}`);
    console.log(`${chalk.green('Successful:')} ${batchResult.successful}/${batchResult.total}`);
    console.log(`${chalk.red('Failed:')} ${batchResult.failed}/${batchResult.total}`);
    
    if (batchResult.errors.length > 0) {
      console.log('\n' + chalk.red.bold('❌ Errors'));
      batchResult.errors.forEach((error: any) => {
        console.log(`${chalk.red('•')} ${error.templateId}: ${error.error}`);
      });
    }
    
    if (batchResult.results.length > 0) {
      console.log('\n' + chalk.yellow.bold('📊 Summary Statistics'));
      const avgTokenReduction = batchResult.results.reduce((sum: number, r: any) => sum + r.metrics.tokenReduction, 0) / batchResult.results.length;
      const avgAccuracyImprovement = batchResult.results.reduce((sum: number, r: any) => sum + r.metrics.accuracyImprovement, 0) / batchResult.results.length;
      const totalOptimizationTime = batchResult.results.reduce((sum: number, r: any) => sum + r.metrics.optimizationTime, 0);
      
      console.log(`${chalk.green('Average Token Reduction:')} ${avgTokenReduction.toFixed(1)}%`);
      console.log(`${chalk.green('Average Accuracy Improvement:')} ${avgAccuracyImprovement.toFixed(1)}%`);
      console.log(`${chalk.green('Total Optimization Time:')} ${(totalOptimizationTime / 1000).toFixed(2)}s`);
    }
  }

  /**
   * Save optimized template
   */
  private async saveOptimizedTemplate(result: any, outputPath: string): Promise<void> {
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
      this.error(`Failed to save optimized template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save batch optimization results
   */
  private async saveBatchResults(batchResult: any, outputPath: string): Promise<void> {
    try {
      const fs = await import('fs');
      const outputDir = path.dirname(outputPath);
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputPath, JSON.stringify(batchResult, null, 2));
      this.success(`Batch results saved to: ${outputPath}`);
    } catch (error) {
      this.error(`Failed to save batch results: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export default OptimizeCommand;
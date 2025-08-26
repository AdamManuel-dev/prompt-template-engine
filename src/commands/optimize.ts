/**
 * @fileoverview CLI command for prompt optimization using PromptWizard
 * @lastmodified 2025-08-26T12:35:00Z
 *
 * Features: Single and batch prompt optimization, comparison, scoring
 * Main APIs: optimizeCommand, compareCommand, scoreCommand
 * Constraints: Requires PromptWizard service running
 * Patterns: Commander.js command structure, async execution
 */

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import path from 'path';
import fs from 'fs/promises';
import {
  PromptWizardClient,
  createDefaultConfig,
} from '../integrations/promptwizard';
import { PromptOptimizationService } from '../services/prompt-optimization.service';
import { TemplateService } from '../services/template.service';
import { CacheService } from '../services/cache.service';
import { loadConfig } from '../utils/config';
import { Template } from '../types';

// Mock spinner implementation since it doesn't exist
const mockSpinner = {
  create: (msg: string) => ({
    start: () => console.log(`🔄 ${msg}`),
    update: (msg: string) => console.log(`🔄 ${msg}`),
    succeed: (msg: string) => console.log(`✅ ${msg}`),
    fail: (msg: string) => console.log(`❌ ${msg}`),
    stop: () => {},
  }),
};
const spinnerManager = mockSpinner;

// Helper function to convert TemplateService Template to types Template
function convertTemplate(serviceTemplate: any): Template {
  return {
    name: serviceTemplate.name,
    version: serviceTemplate.version || '1.0.0',
    description: serviceTemplate.description,
    author: serviceTemplate.metadata?.author,
    tags: serviceTemplate.metadata?.tags,
    content: serviceTemplate.files?.[0]?.content || '',
    variables: serviceTemplate.variables || {},
    commands: {}, // Convert TemplateCommand[] to Record<string, string> if needed
    requirements: [],
    examples: [],
    filePatterns: [],
    contextFiles: [],
    references: [],
    priority: 'medium',
    alwaysApply: false,
  };
}

/**
 * Create the optimize command
 */
export function createOptimizeCommand(): Command {
  const command = new Command('optimize');

  command
    .alias('opt')
    .description('Optimize prompts using PromptWizard ML-powered optimization')
    .argument('[template]', 'Template name or path to optimize')
    .option(
      '-b, --batch <directory>',
      'Batch optimize all templates in directory'
    )
    .option('-o, --output <path>', 'Output path for optimized template')
    .option('-m, --model <model>', 'Model to use for optimization', 'gpt-4')
    .option('-i, --iterations <n>', 'Number of optimization iterations', '3')
    .option('-e, --examples <n>', 'Number of few-shot examples', '5')
    .option('-r, --reasoning', 'Generate reasoning for optimization', true)
    .option('--no-cache', 'Skip cache and force fresh optimization')
    .option('--compare', 'Show detailed comparison after optimization')
    .option('--dry-run', 'Preview optimization without saving')
    .option('--json', 'Output results as JSON')
    .action(async (templateArg, options) => {
      const spinner = spinnerManager.create(
        'Initializing PromptWizard optimization...'
      );

      try {
        spinner.start();

        // Load configuration
        const config = await loadConfig();
        const pwConfig = createDefaultConfig();

        // Initialize services
        const client = new PromptWizardClient(pwConfig);
        const templateService = new TemplateService({
          templatePaths: config.templatePaths || ['./templates'],
        });
        const cacheService = new CacheService();
        const optimizationService = new PromptOptimizationService(
          client,
          templateService,
          cacheService
        );

        spinner.update('Loading templates...');

        if (options.batch) {
          // Batch optimization
          await handleBatchOptimization(
            optimizationService,
            templateService,
            options.batch,
            options
          );
        } else if (templateArg) {
          // Single template optimization
          await handleSingleOptimization(
            optimizationService,
            templateService,
            templateArg,
            options
          );
        } else {
          // Interactive mode - list templates and let user choose
          await handleInteractiveOptimization(
            optimizationService,
            templateService,
            options
          );
        }

        spinner.succeed('Optimization completed successfully');
      } catch (error) {
        spinner.fail(
          `Optimization failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  // Add sub-commands
  command.addCommand(createCompareCommand());
  command.addCommand(createScoreCommand());
  command.addCommand(createBatchCommand());

  return command;
}

/**
 * Create the compare sub-command
 */
function createCompareCommand(): Command {
  const command = new Command('compare');

  command
    .description('Compare original and optimized prompts')
    .argument('<original>', 'Path to original template')
    .argument('<optimized>', 'Path to optimized template')
    .option('--metrics', 'Show detailed metrics')
    .option('--json', 'Output as JSON')
    .action(async (originalPath, optimizedPath, options) => {
      const spinner = spinnerManager.create('Comparing prompts...');

      try {
        spinner.start();

        const pwConfig = createDefaultConfig();
        const client = new PromptWizardClient(pwConfig);

        // Read templates
        const originalContent = await fs.readFile(originalPath, 'utf-8');
        const optimizedContent = await fs.readFile(optimizedPath, 'utf-8');

        // Compare prompts
        const comparison = await client.comparePrompts(
          originalContent,
          optimizedContent
        );

        spinner.stop();

        if (options.json) {
          console.log(JSON.stringify(comparison, null, 2));
        } else {
          displayComparison(comparison);
        }
      } catch (error) {
        spinner.fail(
          `Comparison failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the score sub-command
 */
function createScoreCommand(): Command {
  const command = new Command('score');

  command
    .description('Score prompt quality using PromptWizard')
    .argument('<template>', 'Template name or path to score')
    .option('--suggestions', 'Show improvement suggestions')
    .option('--json', 'Output as JSON')
    .action(async (templateArg, options) => {
      const spinner = spinnerManager.create('Scoring prompt...');

      try {
        spinner.start();

        const config = await loadConfig();
        const pwConfig = createDefaultConfig();
        const client = new PromptWizardClient(pwConfig);

        // Load template content
        let content: string;
        if (await fileExists(templateArg)) {
          content = await fs.readFile(templateArg, 'utf-8');
        } else {
          const templateService = new TemplateService({
            templatePaths: config.templatePaths || ['./templates'],
          });
          const template = await templateService.loadTemplate(templateArg);
          content = template.files?.[0]?.content || '';
        }

        // Score prompt
        const score = await client.scorePrompt(content);

        spinner.stop();

        if (options.json) {
          console.log(JSON.stringify(score, null, 2));
        } else {
          displayScore(score);
        }

        if (options.suggestions && score.suggestions) {
          console.log(chalk.cyan('\n📝 Improvement Suggestions:'));
          score.suggestions.forEach((suggestion, i) => {
            console.log(chalk.gray(`  ${i + 1}. ${suggestion}`));
          });
        }
      } catch (error) {
        spinner.fail(
          `Scoring failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the batch sub-command
 */
function createBatchCommand(): Command {
  const command = new Command('batch');

  command
    .description('Batch optimize multiple templates')
    .argument('<directory>', 'Directory containing templates')
    .option('-p, --pattern <glob>', 'Glob pattern for templates', '*.yaml')
    .option('-o, --output <dir>', 'Output directory for optimized templates')
    .option('--parallel <n>', 'Number of parallel optimizations', '3')
    .option('--report', 'Generate optimization report')
    .action(async (directory, options) => {
      const spinner = spinnerManager.create('Starting batch optimization...');

      try {
        spinner.start();

        await loadConfig(); // Ensure config is loaded for any environment variables
        const pwConfig = createDefaultConfig();

        // Initialize services
        const client = new PromptWizardClient(pwConfig);
        const templateService = new TemplateService({
          templatePaths: [directory],
        });
        const cacheService = new CacheService();
        const optimizationService = new PromptOptimizationService(
          client,
          templateService,
          cacheService
        );

        spinner.update('Loading templates...');

        // Load all templates
        const templateList = await templateService.listTemplates();

        spinner.update(
          `Found ${templateList.length} templates. Starting optimization...`
        );

        // Load full templates
        const templates = await Promise.all(
          templateList.map(async t => ({
            id: t.name,
            template: await templateService.loadTemplate(t.path),
          }))
        );

        // Batch optimize
        const result = await optimizationService.batchOptimize({
          templates,
          options: {
            priority: 'normal',
          },
        });

        spinner.stop();

        // Display results
        displayBatchResults(result);

        // Save optimized templates if output directory specified
        if (options.output) {
          await saveBatchResults(result, options.output);
        }

        // Generate report if requested
        if (options.report) {
          await generateOptimizationReport(result, directory);
        }
      } catch (error) {
        spinner.fail(
          `Batch optimization failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  return command;
}

// Helper functions

async function handleSingleOptimization(
  service: PromptOptimizationService,
  templateService: TemplateService,
  templateArg: string,
  options: any
): Promise<void> {
  // Load template
  let template: Template;
  if (await fileExists(templateArg)) {
    // Load from file
    const content = await fs.readFile(templateArg, 'utf-8');
    template = {
      name: path.basename(templateArg),
      version: '1.0.0',
      content,
      variables: {},
      commands: {},
      requirements: [],
      examples: [],
      filePatterns: [],
      contextFiles: [],
      references: [],
      priority: 'medium',
      alwaysApply: false,
    };
  } else {
    // Load from template service
    const serviceTemplate = await templateService.loadTemplate(templateArg);
    template = convertTemplate(serviceTemplate);
  }

  // Optimize template
  const result = await service.optimizeTemplate({
    templateId: template.name,
    template: template as any,
    config: {
      targetModel: options.model as
        | 'gpt-4'
        | 'gpt-3.5-turbo'
        | 'claude-3-opus'
        | 'claude-3-sonnet'
        | 'gemini-pro',
      mutateRefineIterations: parseInt(options.iterations),
      fewShotCount: parseInt(options.examples),
      generateReasoning: options.reasoning,
    },
    options: {
      skipCache: options.noCache,
    },
  });

  // Display results
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    displayOptimizationResult(result);
  }

  // Show comparison if requested
  if (options.compare) {
    displayComparison(result.comparison);
  }

  // Save optimized template if not dry-run
  if (!options.dryRun && options.output) {
    await fs.writeFile(
      options.output,
      (result.optimizedTemplate as any)?.content ||
        result.optimizedTemplate?.files?.[0]?.content ||
        ''
    );
    console.log(
      chalk.green(`✅ Optimized template saved to: ${options.output}`)
    );
  }
}

async function handleBatchOptimization(
  service: PromptOptimizationService,
  templateService: TemplateService,
  _directory: string,
  options: any
): Promise<void> {
  // Load all templates from directory
  const templateList = await templateService.listTemplates();

  console.log(
    chalk.cyan(`Found ${templateList.length} templates for optimization`)
  );

  // Load full templates
  const templates = await Promise.all(
    templateList.map(async t => ({
      id: t.name,
      template: await templateService.loadTemplate(t.path),
    }))
  );

  // Batch optimize
  const result = await service.batchOptimize({
    templates,
    options: {
      skipCache: options.noCache,
    },
  });

  // Display results
  displayBatchResults(result);

  // Save optimized templates if output specified
  if (options.output) {
    await saveBatchResults(result, options.output);
  }
}

async function handleInteractiveOptimization(
  _service: PromptOptimizationService,
  templateService: TemplateService,
  _options: any
): Promise<void> {
  // List available templates
  const templates = await templateService.listTemplates();

  if (templates.length === 0) {
    console.log(
      chalk.yellow('No templates found. Please specify a template path.')
    );
    return;
  }

  console.log(chalk.cyan('Available templates:'));
  templates.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.name}`);
  });

  // For now, just show the list. In a real implementation,
  // we'd use inquirer or similar for interactive selection
  console.log(chalk.gray('\nRun with a template name to optimize:'));
  console.log(chalk.gray('  cprompt optimize <template-name>'));
}

function displayOptimizationResult(result: any): void {
  console.log(chalk.green('\n✨ Optimization Complete!\n'));

  const table = new Table({
    head: ['Metric', 'Value'],
    style: { head: ['cyan'] },
  });

  table.push(
    ['Template', result.templateId],
    ['Token Reduction', `${result.metrics.tokenReduction}%`],
    ['Accuracy Improvement', `${result.metrics.accuracyImprovement}%`],
    ['Quality Score', `${result.qualityScore.overall}/100`],
    [
      'Optimization Time',
      `${(result.metrics.optimizationTime / 1000).toFixed(2)}s`,
    ],
    ['API Calls', result.metrics.apiCalls]
  );

  console.log(table.toString());
}

function displayComparison(comparison: any): void {
  console.log(chalk.cyan('\n📊 Prompt Comparison:\n'));

  const table = new Table({
    head: ['Aspect', 'Original', 'Optimized', 'Change'],
    style: { head: ['cyan'] },
  });

  table.push(
    [
      'Token Count',
      comparison.originalTokens,
      comparison.optimizedTokens,
      chalk.green(`-${comparison.tokenReduction}%`),
    ],
    [
      'Accuracy',
      `${comparison.originalAccuracy}%`,
      `${comparison.optimizedAccuracy}%`,
      chalk.green(`+${comparison.accuracyImprovement}%`),
    ],
    [
      'Clarity Score',
      comparison.originalClarity,
      comparison.optimizedClarity,
      comparison.optimizedClarity > comparison.originalClarity
        ? chalk.green('↑')
        : chalk.red('↓'),
    ],
    [
      'Specificity',
      comparison.originalSpecificity,
      comparison.optimizedSpecificity,
      comparison.optimizedSpecificity > comparison.originalSpecificity
        ? chalk.green('↑')
        : chalk.red('↓'),
    ]
  );

  console.log(table.toString());
}

function displayScore(score: any): void {
  console.log(chalk.cyan('\n📊 Prompt Quality Score:\n'));

  const table = new Table({
    head: ['Metric', 'Score', 'Rating'],
    style: { head: ['cyan'] },
  });

  const getRating = (score: number) => {
    if (score >= 90) return chalk.green('Excellent');
    if (score >= 75) return chalk.green('Good');
    if (score >= 60) return chalk.yellow('Fair');
    return chalk.red('Poor');
  };

  table.push(
    ['Overall', `${score.overall}/100`, getRating(score.overall)],
    ['Clarity', `${score.clarity}/100`, getRating(score.clarity)],
    ['Specificity', `${score.specificity}/100`, getRating(score.specificity)],
    ['Coherence', `${score.coherence}/100`, getRating(score.coherence)],
    ['Completeness', `${score.completeness}/100`, getRating(score.completeness)]
  );

  console.log(table.toString());
}

function displayBatchResults(result: any): void {
  console.log(chalk.green(`\n✨ Batch Optimization Complete!\n`));

  const table = new Table({
    head: ['Summary', 'Count'],
    style: { head: ['cyan'] },
  });

  table.push(
    ['Total Templates', result.total],
    ['Successful', chalk.green(result.successful)],
    ['Failed', result.failed > 0 ? chalk.red(result.failed) : '0']
  );

  console.log(table.toString());

  if (result.results.length > 0) {
    console.log(chalk.cyan('\n📈 Optimization Results:\n'));

    const resultsTable = new Table({
      head: ['Template', 'Token Reduction', 'Accuracy Gain', 'Quality Score'],
      style: { head: ['cyan'] },
    });

    result.results.forEach((r: any) => {
      resultsTable.push([
        r.templateId,
        `${r.metrics.tokenReduction}%`,
        `+${r.metrics.accuracyImprovement}%`,
        `${r.qualityScore.overall}/100`,
      ]);
    });

    console.log(resultsTable.toString());
  }

  if (result.errors.length > 0) {
    console.log(chalk.red('\n❌ Failed Optimizations:\n'));
    result.errors.forEach((e: any) => {
      console.log(`  - ${e.templateId}: ${e.error}`);
    });
  }
}

async function saveBatchResults(result: any, outputDir: string): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  for (const optimization of result.results) {
    const outputPath = path.join(
      outputDir,
      `${optimization.templateId}.optimized.yaml`
    );
    await fs.writeFile(outputPath, optimization.optimizedTemplate.content);
  }

  console.log(chalk.green(`✅ Optimized templates saved to: ${outputDir}`));
}

async function generateOptimizationReport(
  result: any,
  directory: string
): Promise<void> {
  const reportPath = path.join(directory, 'optimization-report.md');

  let report = `# Prompt Optimization Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## Summary\n\n`;
  report += `- Total Templates: ${result.total}\n`;
  report += `- Successful: ${result.successful}\n`;
  report += `- Failed: ${result.failed}\n\n`;

  if (result.results.length > 0) {
    report += `## Optimization Results\n\n`;

    // Calculate averages
    const avgTokenReduction =
      result.results.reduce(
        (acc: number, r: any) => acc + r.metrics.tokenReduction,
        0
      ) / result.results.length;
    const avgAccuracyGain =
      result.results.reduce(
        (acc: number, r: any) => acc + r.metrics.accuracyImprovement,
        0
      ) / result.results.length;
    const avgQualityScore =
      result.results.reduce(
        (acc: number, r: any) => acc + r.qualityScore.overall,
        0
      ) / result.results.length;

    report += `### Average Improvements\n\n`;
    report += `- Token Reduction: ${avgTokenReduction.toFixed(1)}%\n`;
    report += `- Accuracy Improvement: ${avgAccuracyGain.toFixed(1)}%\n`;
    report += `- Quality Score: ${avgQualityScore.toFixed(1)}/100\n\n`;

    report += `### Individual Results\n\n`;
    report += `| Template | Token Reduction | Accuracy Gain | Quality Score |\n`;
    report += `|----------|----------------|---------------|---------------|\n`;

    result.results.forEach((r: any) => {
      report += `| ${r.templateId} | ${r.metrics.tokenReduction}% | +${r.metrics.accuracyImprovement}% | ${r.qualityScore.overall}/100 |\n`;
    });
  }

  if (result.errors.length > 0) {
    report += `\n## Failed Optimizations\n\n`;
    result.errors.forEach((e: any) => {
      report += `- **${e.templateId}**: ${e.error}\n`;
    });
  }

  await fs.writeFile(reportPath, report);
  console.log(chalk.green(`📄 Report saved to: ${reportPath}`));
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

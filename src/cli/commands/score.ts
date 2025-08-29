/**
 * @fileoverview CLI command for scoring prompt quality using PromptWizard
 * @lastmodified 2025-08-26T12:55:00Z
 *
 * Features: Quality scoring with detailed metrics and improvement suggestions
 * Main APIs: ScoreCommand class implementing ICommand interface
 * Constraints: Requires PromptWizard service, provides quality assessment
 * Patterns: Command pattern, quality scoring with actionable feedback
 */

import chalk from 'chalk';
import ora from 'ora';
import { BaseCommand } from '../base-command';
import { CommandOption } from '../command-registry';
import { logger } from '../../utils/logger';
import { TemplateService } from '../../services/template.service';
import {
  PromptWizardClient,
  createDefaultConfig,
} from '../../integrations/promptwizard';
import type { QualityScore } from '../../integrations/promptwizard/types';

interface ScoreOptions {
  prompt?: string;
  template?: string;
  task?: string;
  format?: string;
  output?: string;
  threshold?: number;
  detailed?: boolean;
  batch?: boolean;
}

export class ScoreCommand extends BaseCommand {
  name = 'prompt:score';

  description = 'Score prompt quality and get improvement suggestions';

  override aliases = ['score', 'rate'];

  override options: CommandOption[] = [
    {
      flags: '-p, --prompt <text>',
      description: 'Prompt text to score',
    },
    {
      flags: '-t, --template <name>',
      description: 'Template name to score',
    },
    {
      flags: '--task <description>',
      description: 'Task description for context-aware scoring',
    },
    {
      flags: '-f, --format <type>',
      description: 'Output format (table, json, markdown, badge)',
      defaultValue: 'table',
    },
    {
      flags: '--output <path>',
      description: 'Save scoring report to file',
    },
    {
      flags: '--threshold <number>',
      description: 'Quality threshold (0-100) for pass/fail reporting',
      defaultValue: '70',
    },
    {
      flags: '--detailed',
      description: 'Show detailed breakdown and suggestions',
      defaultValue: true,
    },
    {
      flags: '--batch',
      description: 'Score all templates in batch',
    },
  ];

  private templateService!: TemplateService;

  private client!: PromptWizardClient;

  async execute(_args: unknown, options: ScoreOptions): Promise<void> {
    await this.initializeServices();

    // Check service health
    const isHealthy = await this.checkServiceHealth();
    if (!isHealthy) {
      this.error(
        'PromptWizard service is not available. Please check your configuration.'
      );
      this.exit(1);
    }

    if (options.batch) {
      await this.batchScore(options);
    } else {
      await this.singleScore(options);
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
    } catch (error: unknown) {
      this.error(
        `Failed to initialize services: ${error instanceof Error ? error.message : String(error)}`
      );
      this.exit(1);
    }
  }

  /**
   * Check PromptWizard service health
   */
  private async checkServiceHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.client.healthCheck();
      return isHealthy;
    } catch (error: unknown) {
      logger.error(
        `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Score a single prompt
   */
  private async singleScore(options: ScoreOptions): Promise<void> {
    let promptText = options.prompt;
    let templateName = options.template;

    // Determine what to score
    if (!promptText && !templateName) {
      const choice = await this.prompt(
        'Score (p)rompt text or (t)emplate? [p/t]'
      );
      if (choice.toLowerCase() === 't') {
        templateName = await this.prompt('Enter template name');
      } else {
        promptText = await this.prompt('Enter prompt text');
      }
    }

    const spinner = ora('Loading prompt for scoring...').start();

    try {
      // Resolve prompt text
      let finalPromptText = promptText;
      let sourceName = 'prompt';

      if (templateName) {
        const templatePath =
          await this.templateService.findTemplate(templateName);
        if (!templatePath) {
          spinner.fail(`Template not found: ${templateName}`);
          return;
        }
        const template = await this.templateService.loadTemplate(templatePath);
        const renderedTemplate = await this.templateService.renderTemplate(
          template,
          {}
        );
        finalPromptText =
          renderedTemplate.files?.map(f => f.content).join('\n') || '';
        sourceName = template.name;
      }

      if (!finalPromptText) {
        spinner.fail('No prompt content to score');
        return;
      }

      spinner.text = 'Analyzing prompt quality...';

      // Get task description if not provided
      let { task } = options;
      if (!task && templateName) {
        const templatePath =
          await this.templateService.findTemplate(templateName);
        if (templatePath) {
          const template =
            await this.templateService.loadTemplate(templatePath);
          task = template?.description || '';
        }
      }

      // Score the prompt
      const score = await this.client.scorePrompt(finalPromptText, task);

      spinner.succeed('Quality scoring completed!');

      // Display results based on format
      switch (options.format) {
        case 'json':
          this.displayJsonScore(score, sourceName);
          break;
        case 'markdown':
          this.displayMarkdownScore(score, finalPromptText, sourceName);
          break;
        case 'badge':
          this.displayBadgeScore(score, sourceName);
          break;
        default:
          this.displayTableScore(score, finalPromptText, sourceName, options);
      }

      // Check threshold
      const threshold = parseInt(options.threshold?.toString() || '70', 10);
      this.checkThreshold(score, threshold);

      // Save report if output path provided
      if (options.output) {
        await this.saveScoreReport(score, finalPromptText, sourceName, options);
      }
    } catch (error: unknown) {
      spinner.fail(
        `Scoring failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Batch score multiple templates
   */
  private async batchScore(options: ScoreOptions): Promise<void> {
    const spinner = ora('Loading templates for batch scoring...').start();

    try {
      const templateList = await this.templateService.listTemplates();
      const templates = [];

      for (const templateInfo of templateList) {
        try {
          const template = await this.templateService.loadTemplate(
            templateInfo.path
          );
          templates.push(template);
        } catch (error: unknown) {
          logger.warn(
            `Failed to load template ${templateInfo.name}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      if (templates.length === 0) {
        spinner.fail('No templates found for batch scoring');
        return;
      }

      spinner.text = `Scoring ${templates.length} templates...`;

      const results = [];
      const threshold = parseInt(options.threshold?.toString() || '70', 10);

      for (const template of templates) {
        try {
          spinner.text = `Scoring: ${template.name}`;
          const renderedTemplate = await this.templateService.renderTemplate(
            template,
            {}
          );
          const templateContent =
            renderedTemplate.files?.map(f => f.content).join('\n') || '';

          const score = await this.client.scorePrompt(
            templateContent,
            template.description
          );

          results.push({
            template: template.name,
            score,
            passed: score.overall >= threshold,
          });
        } catch (error: unknown) {
          results.push({
            template: template.name,
            error: error instanceof Error ? error.message : String(error),
            passed: false,
          });
        }
      }

      spinner.succeed('Batch scoring completed!');

      // Display batch results
      this.displayBatchResults(results, threshold, options);

      // Save batch report if output path provided
      if (options.output) {
        await this.saveBatchReport(results, options);
      }
    } catch (error: unknown) {
      spinner.fail(
        `Batch scoring failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Display score in table format
   */
  private displayTableScore(
    score: QualityScore,
    promptText: string,
    sourceName: string,
    options: ScoreOptions
  ): void {
    console.log(`\n${chalk.blue.bold('📊 Prompt Quality Score')}`);
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(`${chalk.blue('Source:')} ${sourceName}`);
    console.log(`${chalk.blue('Confidence:')} ${score.confidence.toFixed(1)}%`);

    // Overall score with color coding
    const overallColor = this.getScoreColor(score.overall);
    console.log(
      `${chalk.blue('Overall Score:')} ${overallColor(`${score.overall}/100`)} ${this.getScoreLabel(score.overall)}`
    );

    // Detailed metrics
    console.log(`\n${chalk.yellow.bold('📈 Quality Metrics')}`);
    console.log('┌─────────────────────┬─────────────┬───────────────┐');
    console.log('│ Metric              │ Score       │ Rating        │');
    console.log('├─────────────────────┼─────────────┼───────────────┤');

    const metrics = [
      ['Clarity', score.metrics.clarity],
      ['Task Alignment', score.metrics.taskAlignment],
      ['Token Efficiency', score.metrics.tokenEfficiency],
    ];

    if (score.metrics.exampleQuality !== undefined) {
      metrics.push(['Example Quality', score.metrics.exampleQuality]);
    }

    metrics.forEach(([metric, value]) => {
      const numericValue = typeof value === 'number' ? value : 0;
      const color = this.getScoreColor(numericValue);
      const label = this.getScoreLabel(numericValue);
      console.log(
        `│ ${String(metric).padEnd(19)} │ ${color(`${numericValue}/100`.padEnd(11))} │ ${color(label.padEnd(13))} │`
      );
    });

    console.log('└─────────────────────┴─────────────┴───────────────┘');

    // Suggestions
    if (score.suggestions.length > 0 && options.detailed) {
      console.log(`\n${chalk.magenta.bold('💡 Improvement Suggestions')}`);
      score.suggestions.forEach((suggestion: string, index: number) => {
        console.log(`${chalk.gray(`${index + 1}.`)} ${suggestion}`);
      });
    }

    // Show prompt content if detailed
    if (options.detailed && promptText.length < 500) {
      console.log(`\n${chalk.gray.bold('📝 Prompt Content')}`);
      console.log(chalk.gray('─'.repeat(50)));
      console.log(promptText);
      console.log(chalk.gray('─'.repeat(50)));
    } else if (options.detailed) {
      console.log(
        `\n${chalk.gray('📝 Prompt Content:')} ${promptText.length} characters (truncated for display)`
      );
    }
  }

  /**
   * Display score in JSON format
   */
  private displayJsonScore(score: QualityScore, sourceName: string): void {
    const result = {
      source: sourceName,
      timestamp: new Date().toISOString(),
      score,
    };
    console.log(JSON.stringify(result, null, 2));
  }

  /**
   * Display score in markdown format
   */
  private displayMarkdownScore(
    score: QualityScore,
    promptText: string,
    sourceName: string
  ): void {
    console.log('# Prompt Quality Report\n');
    console.log(`**Source:** ${sourceName}\n`);
    console.log(`**Generated:** ${new Date().toISOString()}\n`);
    console.log(
      `**Overall Score:** ${score.overall}/100 (${this.getScoreLabel(score.overall)})\n`
    );
    console.log(`**Confidence:** ${score.confidence.toFixed(1)}%\n`);

    console.log('## Quality Metrics\n');
    console.log('| Metric | Score | Rating |');
    console.log('|--------|--------|---------|');
    console.log(
      `| Clarity | ${score.metrics.clarity}/100 | ${this.getScoreLabel(score.metrics.clarity)} |`
    );
    console.log(
      `| Task Alignment | ${score.metrics.taskAlignment}/100 | ${this.getScoreLabel(score.metrics.taskAlignment)} |`
    );
    console.log(
      `| Token Efficiency | ${score.metrics.tokenEfficiency}/100 | ${this.getScoreLabel(score.metrics.tokenEfficiency)} |`
    );

    if (score.metrics.exampleQuality !== undefined) {
      console.log(
        `| Example Quality | ${score.metrics.exampleQuality}/100 | ${this.getScoreLabel(score.metrics.exampleQuality)} |`
      );
    }

    if (score.suggestions.length > 0) {
      console.log('\n## Improvement Suggestions\n');
      score.suggestions.forEach((suggestion: string, index: number) => {
        console.log(`${index + 1}. ${suggestion}`);
      });
    }

    console.log('\n## Prompt Content\n');
    console.log('```');
    console.log(promptText);
    console.log('```\n');
  }

  /**
   * Display score in badge format
   */
  private displayBadgeScore(score: QualityScore, sourceName: string): void {
    const color = this.getScoreColor(score.overall);
    const label = this.getScoreLabel(score.overall);

    console.log(
      color(`
╔══════════════════════════════════╗
║          QUALITY SCORE           ║
║                                  ║
║  ${sourceName.padEnd(30)} ║
║                                  ║
║     ${`${score.overall}/100`.padEnd(26)} ║
║     ${label.padEnd(26)} ║
║                                  ║
║  Confidence: ${`${score.confidence.toFixed(1)}%`.padEnd(18)} ║
╚══════════════════════════════════╝
    `)
    );
  }

  /**
   * Display batch scoring results
   */
  private displayBatchResults(
    results: Array<{
      template: string;
      score?: QualityScore;
      passed: boolean;
      error?: string;
    }>,
    threshold: number,
    options: ScoreOptions
  ): void {
    console.log(`\n${chalk.blue.bold('📊 Batch Quality Scoring Results')}`);
    console.log(chalk.cyan('═'.repeat(60)));

    const passed = results.filter(r => r.passed && !r.error).length;
    const failed = results.filter(r => !r.passed || r.error).length;

    console.log(
      `${chalk.green('Passed:')} ${passed}/${results.length} (threshold: ${threshold})`
    );
    console.log(`${chalk.red('Failed:')} ${failed}/${results.length}`);

    if (options.format === 'table') {
      console.log(
        '\n┌─────────────────────────────────┬─────────────┬─────────────┐'
      );
      console.log(
        '│ Template                        │ Score       │ Status      │'
      );
      console.log(
        '├─────────────────────────────────┼─────────────┼─────────────┤'
      );

      results.forEach(result => {
        const name = result.template.padEnd(31).substring(0, 31);
        if (result.error) {
          console.log(
            `│ ${name} │ ${chalk.red('ERROR'.padEnd(11))} │ ${chalk.red('FAILED'.padEnd(11))} │`
          );
        } else {
          const scoreStr = `${result.score?.overall || 0}/100`;
          const scoreColor = this.getScoreColor(result.score?.overall || 0);
          const status = result.passed
            ? chalk.green('PASSED')
            : chalk.red('FAILED');
          console.log(
            `│ ${name} │ ${scoreColor(scoreStr.padEnd(11))} │ ${status.padEnd(21)} │`
          );
        }
      });

      console.log(
        '└─────────────────────────────────┴─────────────┴─────────────┘'
      );
    }

    // Summary statistics
    const validResults = results.filter(r => !r.error && r.score);
    if (validResults.length > 0) {
      const scores = validResults.map(r => r.score?.overall || 0);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);

      console.log(`\n${chalk.yellow.bold('📈 Summary Statistics')}`);
      console.log(`${chalk.blue('Average Score:')} ${avgScore.toFixed(1)}/100`);
      console.log(`${chalk.blue('Highest Score:')} ${maxScore}/100`);
      console.log(`${chalk.blue('Lowest Score:')} ${minScore}/100`);
    }

    // Show errors
    const errorResults = results.filter(r => r.error);
    if (errorResults.length > 0) {
      console.log(`\n${chalk.red.bold('❌ Errors')}`);
      errorResults.forEach(result => {
        console.log(`${chalk.red('•')} ${result.template}: ${result.error}`);
      });
    }
  }

  /**
   * Check if score meets threshold
   */
  private checkThreshold(score: QualityScore, threshold: number): void {
    if (score.overall >= threshold) {
      this.success(
        `Quality score meets threshold (${score.overall} >= ${threshold})`
      );
    } else {
      this.warn(
        `Quality score below threshold (${score.overall} < ${threshold})`
      );
    }
  }

  /**
   * Get color for score
   */
  private getScoreColor(score: number): typeof chalk.green {
    if (score >= 90) return chalk.green;
    if (score >= 80) return chalk.cyan;
    if (score >= 70) return chalk.yellow;
    if (score >= 60) return chalk.magenta;
    return chalk.red;
  }

  /**
   * Get label for score
   */
  private getScoreLabel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 60) return 'Poor';
    return 'Very Poor';
  }

  /**
   * Save scoring report
   */
  private async saveScoreReport(
    score: QualityScore,
    promptText: string,
    sourceName: string,
    options: ScoreOptions
  ): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');

      const outputDir = path.dirname(options.output!);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const report = {
        metadata: {
          source: sourceName,
          timestamp: new Date().toISOString(),
          format: options.format,
          threshold: options.threshold,
        },
        score,
        prompt: {
          text: promptText,
          length: promptText.length,
        },
      };

      fs.writeFileSync(options.output!, JSON.stringify(report, null, 2));
      this.success(`Score report saved to: ${options.output}`);
    } catch (error: unknown) {
      this.error(
        `Failed to save score report: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Save batch scoring report
   */
  private async saveBatchReport(
    results: Array<{
      template: string;
      score?: QualityScore;
      passed: boolean;
      error?: string;
    }>,
    options: ScoreOptions
  ): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');

      const outputDir = path.dirname(options.output!);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const validResults = results.filter(r => !r.error && r.score);
      const scores = validResults.map(r => r.score?.overall || 0);

      const report = {
        metadata: {
          timestamp: new Date().toISOString(),
          total: results.length,
          threshold: options.threshold,
        },
        summary: {
          passed: results.filter(r => r.passed).length,
          failed: results.filter(r => !r.passed).length,
          errors: results.filter(r => r.error).length,
          avgScore:
            scores.length > 0
              ? scores.reduce((a, b) => a + b, 0) / scores.length
              : 0,
          minScore: scores.length > 0 ? Math.min(...scores) : 0,
          maxScore: scores.length > 0 ? Math.max(...scores) : 0,
        },
        results,
      };

      fs.writeFileSync(options.output!, JSON.stringify(report, null, 2));
      this.success(`Batch score report saved to: ${options.output}`);
    } catch (error: unknown) {
      this.error(
        `Failed to save batch report: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default ScoreCommand;

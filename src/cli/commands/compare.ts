/**
 * @fileoverview CLI command for comparing original vs optimized prompts
 * @lastmodified 2025-08-26T12:50:00Z
 *
 * Features: Side-by-side prompt comparison with metrics and diff visualization
 * Main APIs: CompareCommand class implementing ICommand interface
 * Constraints: Requires PromptWizard service, compares two prompt versions
 * Patterns: Command pattern, diff generation, interactive comparison display
 */

import chalk from 'chalk';
import ora from 'ora';
// Note: @types/diff is in devDependencies for development purposes only
// eslint-disable-next-line import/no-extraneous-dependencies
import { diffLines } from 'diff';
import { BaseCommand } from '../base-command';
import { CommandOption } from '../command-registry';
import { logger } from '../../utils/logger';
import { TemplateService } from '../../services/template.service';
import {
  PromptWizardClient,
  createDefaultConfig,
} from '../../integrations/promptwizard';

interface CompareOptions {
  original?: string;
  optimized?: string;
  task?: string;
  format?: string;
  output?: string;
  detailed?: boolean;
  showDiff?: boolean;
}

export class CompareCommand extends BaseCommand {
  name = 'prompt:compare';

  description = 'Compare original and optimized prompts with detailed metrics';

  aliases = ['compare', 'diff'];

  options: CommandOption[] = [
    {
      flags: '-o, --original <prompt>',
      description: 'Original prompt text or template name',
    },
    {
      flags: '-p, --optimized <prompt>',
      description: 'Optimized prompt text or template name',
    },
    {
      flags: '--task <description>',
      description: 'Task description for context-aware comparison',
    },
    {
      flags: '-f, --format <type>',
      description: 'Output format (table, json, markdown)',
      defaultValue: 'table',
    },
    {
      flags: '--output <path>',
      description: 'Save comparison report to file',
    },
    {
      flags: '--detailed',
      description: 'Show detailed analysis and recommendations',
    },
    {
      flags: '--show-diff',
      description: 'Show line-by-line diff of prompts',
      defaultValue: true,
    },
  ];

  private templateService!: TemplateService;

  private client!: PromptWizardClient;

  async execute(_args: unknown, options: CompareOptions): Promise<void> {
    await this.initializeServices();

    // Check service health
    const isHealthy = await this.checkServiceHealth();
    if (!isHealthy) {
      this.error(
        'PromptWizard service is not available. Please check your configuration.'
      );
      process.exit(1);
    }

    await this.comparePrompts(options);
  }

  /**
   * Initialize required services
   */
  private async initializeServices(): Promise<void> {
    try {
      const config = createDefaultConfig();
      this.client = new PromptWizardClient(config);
      this.templateService = new TemplateService();
    } catch (error) {
      this.error(
        `Failed to initialize services: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  }

  /**
   * Check PromptWizard service health
   */
  private async checkServiceHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.client.healthCheck();
      return isHealthy;
    } catch (error) {
      logger.error(
        `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Compare two prompts
   */
  private async comparePrompts(options: CompareOptions): Promise<void> {
    let originalText = options.original;
    let optimizedText = options.optimized;

    // Get original prompt
    if (!originalText) {
      originalText = await this.prompt(
        'Enter original prompt or template name'
      );
      if (!originalText) {
        this.error('Original prompt is required');
        return;
      }
    }

    // Get optimized prompt
    if (!optimizedText) {
      optimizedText = await this.prompt(
        'Enter optimized prompt or template name'
      );
      if (!optimizedText) {
        this.error('Optimized prompt is required');
        return;
      }
    }

    const spinner = ora(
      'Resolving prompts and performing comparison...'
    ).start();

    try {
      // Resolve prompt texts (could be template names or direct text)
      const originalPrompt = await this.resolvePromptText(originalText);
      const optimizedPrompt = await this.resolvePromptText(optimizedText);

      spinner.text = 'Analyzing prompts with PromptWizard...';

      // Get detailed comparison from PromptWizard
      const comparison = await this.client.comparePrompts(
        originalPrompt,
        optimizedPrompt,
        options.task
      );

      spinner.succeed('Comparison completed!');

      // Display results based on format
      switch (options.format) {
        case 'json':
          this.displayJsonComparison(comparison);
          break;
        case 'markdown':
          this.displayMarkdownComparison(
            comparison,
            originalPrompt,
            optimizedPrompt
          );
          break;
        default:
          this.displayTableComparison(
            comparison,
            originalPrompt,
            optimizedPrompt,
            options
          );
      }

      // Show diff if requested
      if (options.showDiff) {
        this.displayDiff(originalPrompt, optimizedPrompt);
      }

      // Save report if output path provided
      if (options.output) {
        await this.saveComparisonReport(
          comparison,
          originalPrompt,
          optimizedPrompt,
          options
        );
      }
    } catch (error) {
      spinner.fail(
        `Comparison failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Resolve prompt text (could be template name or direct text)
   */
  private async resolvePromptText(input: string): Promise<string> {
    // Check if input looks like a template name (short, no spaces/newlines)
    if (input.length < 100 && !input.includes('\n') && !input.includes(' ')) {
      try {
        const templatePath = await this.templateService.findTemplate(input);
        if (templatePath) {
          const template =
            await this.templateService.loadTemplate(templatePath);
          const renderedTemplate = await this.templateService.renderTemplate(
            template,
            {}
          );
          const templateContent =
            renderedTemplate.files?.map(f => f.content).join('\n') || '';
          if (templateContent) {
            return templateContent;
          }
        }
      } catch (_error) {
        // Not a template, treat as direct text
      }
    }
    return input;
  }

  /**
   * Display comparison in table format
   */
  private displayTableComparison(
    comparison: any,
    _originalPrompt: string,
    _optimizedPrompt: string,
    options: CompareOptions
  ): void {
    console.log(`\n${chalk.blue.bold('📊 Prompt Comparison Results')}`);
    console.log(chalk.cyan('═'.repeat(60)));

    // Basic metrics comparison
    console.log(`\n${chalk.yellow.bold('📈 Quality Metrics')}`);
    console.log(
      '┌─────────────────────┬─────────────┬─────────────┬─────────────┐'
    );
    console.log(
      '│ Metric              │ Original    │ Optimized   │ Improvement │'
    );
    console.log(
      '├─────────────────────┼─────────────┼─────────────┼─────────────┤'
    );

    const metrics = [
      [
        'Overall Score',
        comparison.original.score.overall,
        comparison.optimized.score.overall,
      ],
      [
        'Clarity',
        comparison.original.score.metrics.clarity,
        comparison.optimized.score.metrics.clarity,
      ],
      [
        'Task Alignment',
        comparison.original.score.metrics.taskAlignment,
        comparison.optimized.score.metrics.taskAlignment,
      ],
      [
        'Token Efficiency',
        comparison.original.score.metrics.tokenEfficiency,
        comparison.optimized.score.metrics.tokenEfficiency,
      ],
      [
        'Estimated Tokens',
        comparison.original.estimatedTokens,
        comparison.optimized.estimatedTokens,
      ],
      [
        'Estimated Cost',
        comparison.original.estimatedCost.toFixed(4),
        comparison.optimized.estimatedCost.toFixed(4),
      ],
    ];

    metrics.forEach(([metric, original, optimized]) => {
      const improvement =
        typeof original === 'number' && typeof optimized === 'number'
          ? `${(((optimized - original) / original) * 100).toFixed(1)}%`
          : 'N/A';

      const improvementColor = improvement.startsWith('-')
        ? chalk.red
        : chalk.green;

      console.log(
        `│ ${metric.padEnd(19)} │ ${String(original).padEnd(11)} │ ${String(optimized).padEnd(11)} │ ${improvementColor(String(improvement).padEnd(11))} │`
      );
    });

    console.log(
      '└─────────────────────┴─────────────┴─────────────┴─────────────┘'
    );

    // Improvements summary
    if (comparison.improvements) {
      console.log(`\n${chalk.green.bold('🚀 Optimization Improvements')}`);
      console.log(
        `${chalk.blue('Quality Improvement:')} ${comparison.improvements.qualityImprovement.toFixed(1)}%`
      );
      console.log(
        `${chalk.blue('Token Reduction:')} ${comparison.improvements.tokenReduction.toFixed(1)}%`
      );
      console.log(
        `${chalk.blue('Cost Savings:')} ${comparison.improvements.costSavings.toFixed(1)}%`
      );
    }

    // Analysis insights
    if (comparison.analysis && options.detailed) {
      console.log(`\n${chalk.magenta.bold('🔍 Detailed Analysis')}`);

      if (comparison.analysis.strengthsGained.length > 0) {
        console.log(`\n${chalk.green('✅ Strengths Gained:')}`);
        comparison.analysis.strengthsGained.forEach((strength: string) => {
          console.log(`  • ${strength}`);
        });
      }

      if (comparison.analysis.potentialRisks.length > 0) {
        console.log(`\n${chalk.red('⚠️  Potential Risks:')}`);
        comparison.analysis.potentialRisks.forEach((risk: string) => {
          console.log(`  • ${risk}`);
        });
      }

      if (comparison.analysis.recommendations.length > 0) {
        console.log(`\n${chalk.yellow('💡 Recommendations:')}`);
        comparison.analysis.recommendations.forEach((rec: string) => {
          console.log(`  • ${rec}`);
        });
      }
    }

    // Suggestions from individual scores
    const allSuggestions = [
      ...comparison.original.score.suggestions,
      ...comparison.optimized.score.suggestions,
    ];

    if (allSuggestions.length > 0 && options.detailed) {
      console.log(`\n${chalk.cyan.bold('💭 Additional Suggestions')}`);
      const uniqueSuggestions = Array.from(new Set(allSuggestions));
      uniqueSuggestions.forEach((suggestion: string, index: number) => {
        console.log(`${chalk.gray(`${index + 1}.`)} ${suggestion}`);
      });
    }
  }

  /**
   * Display comparison in JSON format
   */
  private displayJsonComparison(comparison: any): void {
    console.log(JSON.stringify(comparison, null, 2));
  }

  /**
   * Display comparison in Markdown format
   */
  private displayMarkdownComparison(
    comparison: any,
    originalPrompt: string,
    optimizedPrompt: string
  ): void {
    console.log('# Prompt Comparison Report\n');
    console.log(`**Comparison ID:** ${comparison.comparisonId}\n`);
    console.log(`**Generated:** ${new Date().toISOString()}\n`);

    console.log('## Quality Metrics\n');
    console.log('| Metric | Original | Optimized | Improvement |');
    console.log('|--------|----------|-----------|-------------|');
    console.log(
      `| Overall Score | ${comparison.original.score.overall}/100 | ${comparison.optimized.score.overall}/100 | ${(((comparison.optimized.score.overall - comparison.original.score.overall) / comparison.original.score.overall) * 100).toFixed(1)}% |`
    );
    console.log(
      `| Clarity | ${comparison.original.score.metrics.clarity}/100 | ${comparison.optimized.score.metrics.clarity}/100 | ${(((comparison.optimized.score.metrics.clarity - comparison.original.score.metrics.clarity) / comparison.original.score.metrics.clarity) * 100).toFixed(1)}% |`
    );
    console.log(
      `| Task Alignment | ${comparison.original.score.metrics.taskAlignment}/100 | ${comparison.optimized.score.metrics.taskAlignment}/100 | ${(((comparison.optimized.score.metrics.taskAlignment - comparison.original.score.metrics.taskAlignment) / comparison.original.score.metrics.taskAlignment) * 100).toFixed(1)}% |`
    );
    console.log(
      `| Token Efficiency | ${comparison.original.score.metrics.tokenEfficiency}/100 | ${comparison.optimized.score.metrics.tokenEfficiency}/100 | ${(((comparison.optimized.score.metrics.tokenEfficiency - comparison.original.score.metrics.tokenEfficiency) / comparison.original.score.metrics.tokenEfficiency) * 100).toFixed(1)}% |`
    );

    if (comparison.improvements) {
      console.log('\n## Optimization Summary\n');
      console.log(
        `- **Quality Improvement:** ${comparison.improvements.qualityImprovement.toFixed(1)}%`
      );
      console.log(
        `- **Token Reduction:** ${comparison.improvements.tokenReduction.toFixed(1)}%`
      );
      console.log(
        `- **Cost Savings:** ${comparison.improvements.costSavings.toFixed(1)}%`
      );
    }

    if (comparison.analysis) {
      console.log('\n## Analysis\n');

      if (comparison.analysis.strengthsGained.length > 0) {
        console.log('### Strengths Gained\n');
        comparison.analysis.strengthsGained.forEach((strength: string) => {
          console.log(`- ${strength}`);
        });
      }

      if (comparison.analysis.potentialRisks.length > 0) {
        console.log('\n### Potential Risks\n');
        comparison.analysis.potentialRisks.forEach((risk: string) => {
          console.log(`- ${risk}`);
        });
      }

      if (comparison.analysis.recommendations.length > 0) {
        console.log('\n### Recommendations\n');
        comparison.analysis.recommendations.forEach((rec: string) => {
          console.log(`- ${rec}`);
        });
      }
    }

    console.log('\n## Prompt Content\n');
    console.log('### Original Prompt\n');
    console.log('```');
    console.log(originalPrompt);
    console.log('```\n');
    console.log('### Optimized Prompt\n');
    console.log('```');
    console.log(optimizedPrompt);
    console.log('```\n');
  }

  /**
   * Display diff between prompts
   */
  private displayDiff(originalPrompt: string, optimizedPrompt: string): void {
    console.log(`\n${chalk.blue.bold('📝 Content Diff')}`);
    console.log(chalk.cyan('═'.repeat(60)));

    const diff = diffLines(originalPrompt, optimizedPrompt);

    diff.forEach(
      (part: { added?: boolean; removed?: boolean; value: string }) => {
        if (part.removed) {
          process.stdout.write(chalk.red(`- ${part.value}`));
        } else if (part.added) {
          process.stdout.write(chalk.green(`+ ${part.value}`));
        } else {
          process.stdout.write(chalk.gray(`  ${part.value}`));
        }
      }
    );

    console.log(''); // Add final newline
  }

  /**
   * Save comparison report to file
   */
  private async saveComparisonReport(
    comparison: any,
    originalPrompt: string,
    optimizedPrompt: string,
    options: CompareOptions
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
          comparisonId: comparison.comparisonId,
          timestamp: new Date().toISOString(),
          format: options.format,
        },
        comparison,
        prompts: {
          original: originalPrompt,
          optimized: optimizedPrompt,
        },
      };

      if (options.format === 'markdown') {
        // Save as markdown
        let content = '# Prompt Comparison Report\n\n';
        content += `**Comparison ID:** ${comparison.comparisonId}\n`;
        content += `**Generated:** ${new Date().toISOString()}\n\n`;
        // Add rest of markdown content...
        fs.writeFileSync(options.output!, content);
      } else {
        // Save as JSON
        fs.writeFileSync(options.output!, JSON.stringify(report, null, 2));
      }

      this.success(`Comparison report saved to: ${options.output}`);
    } catch (error) {
      this.error(
        `Failed to save comparison report: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default CompareCommand;

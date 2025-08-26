/**
 * @fileoverview Interactive optimization wizard for guided prompt optimization
 * @lastmodified 2025-08-26T13:00:00Z
 *
 * Features: Step-by-step optimization with real-time preview and refinement
 * Main APIs: OptimizationWizardCommand class implementing ICommand interface
 * Constraints: Requires PromptWizard service, interactive CLI environment
 * Patterns: Wizard pattern, state machine, progressive disclosure
 */

import chalk from 'chalk';
import ora from 'ora';
import { BaseCommand } from '../base-command';
import { CommandOption } from '../command-registry';
import { logger } from '../../utils/logger';
import { TemplateService } from '../../services/template.service';
import { CacheService } from '../../services/cache.service';
import { PromptOptimizationService } from '../../services/prompt-optimization.service';
import { PromptWizardClient, createDefaultConfig } from '../../integrations/promptwizard';
import { Template } from '../../types';

interface WizardOptions {
  template?: string;
  skipIntro?: boolean;
  mode?: string;
}

interface WizardState {
  step: number;
  maxSteps: number;
  templateId?: string;
  originalPrompt: string;
  task: string;
  targetModel: string;
  iterations: number;
  examples: number;
  reasoning: boolean;
  currentOptimized?: string;
  scores: any[];
  comparisons: any[];
  refinements: number;
}

export class OptimizationWizardCommand extends BaseCommand {
  name = 'prompt:wizard';

  description = 'Interactive optimization wizard with guided step-by-step refinement';

  aliases = ['wizard', 'guide'];

  options: CommandOption[] = [
    {
      flags: '-t, --template <name>',
      description: 'Start with specific template',
    },
    {
      flags: '--skip-intro',
      description: 'Skip introductory explanation',
    },
    {
      flags: '-m, --mode <type>',
      description: 'Wizard mode (beginner, advanced, expert)',
      defaultValue: 'beginner',
    },
  ];

  private templateService!: TemplateService;
  private cacheService!: CacheService;
  private optimizationService!: PromptOptimizationService;
  private client!: PromptWizardClient;
  private state!: WizardState;

  async execute(args: unknown, options: WizardOptions): Promise<void> {
    await this.initializeServices();

    // Check service health
    const isHealthy = await this.checkServiceHealth();
    if (!isHealthy) {
      this.error('PromptWizard service is not available. Please check your configuration.');
      process.exit(1);
    }

    // Initialize wizard state
    this.initializeState(options);

    // Show introduction
    if (!options.skipIntro) {
      await this.showIntroduction();
    }

    // Run wizard steps
    try {
      await this.runWizard(options);
    } catch (error) {
      this.error(`Wizard failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
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
      return await this.client.healthCheck();
    } catch (error) {
      logger.error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Initialize wizard state
   */
  private initializeState(options: WizardOptions): void {
    this.state = {
      step: 1,
      maxSteps: options.mode === 'expert' ? 8 : options.mode === 'advanced' ? 6 : 5,
      templateId: options.template,
      originalPrompt: '',
      task: '',
      targetModel: 'gpt-4',
      iterations: 3,
      examples: 5,
      reasoning: true,
      scores: [],
      comparisons: [],
      refinements: 0,
    };
  }

  /**
   * Show wizard introduction
   */
  private async showIntroduction(): Promise<void> {
    console.clear();
    console.log(chalk.blue.bold('🧙 PromptWizard Optimization Wizard'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log();
    console.log(chalk.white('Welcome to the interactive prompt optimization wizard!'));
    console.log();
    console.log(chalk.gray('This wizard will guide you through:'));
    console.log(chalk.gray('• Analyzing your prompt quality'));
    console.log(chalk.gray('• Optimizing with Microsoft PromptWizard'));
    console.log(chalk.gray('• Comparing before and after results'));
    console.log(chalk.gray('• Fine-tuning optimization parameters'));
    console.log(chalk.gray('• Saving your optimized prompt'));
    console.log();
    
    const shouldContinue = await this.confirm('Ready to start optimizing your prompts?');
    if (!shouldContinue) {
      console.log(chalk.yellow('Wizard cancelled. Come back when you\'re ready!'));
      process.exit(0);
    }
  }

  /**
   * Run the wizard steps
   */
  private async runWizard(options: WizardOptions): Promise<void> {
    while (this.state.step <= this.state.maxSteps) {
      await this.runStep(options);
      this.state.step++;
    }

    await this.showCompletion();
  }

  /**
   * Run individual wizard step
   */
  private async runStep(options: WizardOptions): Promise<void> {
    this.showStepHeader();

    switch (this.state.step) {
      case 1:
        await this.stepSelectPrompt();
        break;
      case 2:
        await this.stepAnalyzeQuality();
        break;
      case 3:
        await this.stepConfigureOptimization(options);
        break;
      case 4:
        await this.stepRunOptimization();
        break;
      case 5:
        await this.stepCompareResults();
        break;
      case 6:
        if (options.mode !== 'beginner') {
          await this.stepRefineSettings();
        }
        break;
      case 7:
        if (options.mode === 'advanced' || options.mode === 'expert') {
          await this.stepAdvancedTuning();
        }
        break;
      case 8:
        if (options.mode === 'expert') {
          await this.stepExpertAnalysis();
        }
        break;
      default:
        break;
    }
  }

  /**
   * Show step header
   */
  private showStepHeader(): void {
    console.clear();
    console.log(chalk.blue.bold('🧙 PromptWizard Optimization Wizard'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(`${chalk.gray('Step')} ${chalk.white.bold(`${this.state.step}/${this.state.maxSteps}`)}`);
    console.log();
  }

  /**
   * Step 1: Select prompt to optimize
   */
  private async stepSelectPrompt(): Promise<void> {
    console.log(chalk.yellow.bold('📝 Step 1: Select Prompt to Optimize'));
    console.log();

    if (this.state.templateId) {
      console.log(`${chalk.blue('Template:')} ${this.state.templateId}`);
      const templatePath = await this.templateService.findTemplate(this.state.templateId);
      if (templatePath) {
        const template = await this.templateService.loadTemplate(templatePath);
        const renderedTemplate = await this.templateService.renderTemplate(template, {});
        this.state.originalPrompt = renderedTemplate.files.map(f => f.content).join('\n');
        this.state.task = template.description || template.name;
        console.log(`${chalk.green('✓')} Template loaded successfully`);
      } else {
        this.error(`Template not found: ${this.state.templateId}`);
        this.state.templateId = undefined;
      }
    }

    if (!this.state.templateId) {
      const choice = await this.prompt('Enter (t)emplate name or (p)rompt text directly? [t/p]');
      
      if (choice.toLowerCase() === 't') {
        const templateName = await this.prompt('Template name');
        const templatePath = await this.templateService.findTemplate(templateName);
        if (templatePath) {
          const template = await this.templateService.loadTemplate(templatePath);
          const renderedTemplate = await this.templateService.renderTemplate(template, {});
          this.state.templateId = templateName;
          this.state.originalPrompt = renderedTemplate.files.map(f => f.content).join('\n');
          this.state.task = template.description || template.name;
        } else {
          this.error('Template not found. Please enter prompt text directly.');
          this.state.originalPrompt = await this.prompt('Prompt text');
          this.state.task = await this.prompt('Task description');
        }
      } else {
        this.state.originalPrompt = await this.prompt('Prompt text');
        this.state.task = await this.prompt('Task description');
      }
    }

    if (!this.state.originalPrompt) {
      throw new Error('No prompt content provided');
    }

    console.log();
    console.log(chalk.gray('Prompt loaded:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(this.state.originalPrompt.length > 200 
      ? this.state.originalPrompt.substring(0, 200) + '...'
      : this.state.originalPrompt
    );
    console.log(chalk.gray('─'.repeat(40)));
    console.log();

    await this.prompt('Press Enter to continue');
  }

  /**
   * Step 2: Analyze current quality
   */
  private async stepAnalyzeQuality(): Promise<void> {
    console.log(chalk.yellow.bold('📊 Step 2: Analyze Current Quality'));
    console.log();

    const spinner = ora('Analyzing prompt quality...').start();

    try {
      const score = await this.client.scorePrompt(this.state.originalPrompt, this.state.task);
      this.state.scores.push({
        type: 'original',
        score,
        timestamp: new Date(),
      });

      spinner.succeed('Quality analysis completed!');
      console.log();

      // Display score
      const overallColor = this.getScoreColor(score.overall);
      console.log(`${chalk.blue('Overall Score:')} ${overallColor(`${score.overall}/100`)} (${this.getScoreLabel(score.overall)})`);
      console.log(`${chalk.blue('Confidence:')} ${score.confidence.toFixed(1)}%`);
      console.log();

      console.log(chalk.cyan('Detailed Metrics:'));
      console.log(`• ${chalk.gray('Clarity:')} ${this.getScoreColor(score.metrics.clarity)(`${score.metrics.clarity}/100`)}`);
      console.log(`• ${chalk.gray('Task Alignment:')} ${this.getScoreColor(score.metrics.taskAlignment)(`${score.metrics.taskAlignment}/100`)}`);
      console.log(`• ${chalk.gray('Token Efficiency:')} ${this.getScoreColor(score.metrics.tokenEfficiency)(`${score.metrics.tokenEfficiency}/100`)}`);

      if (score.suggestions.length > 0) {
        console.log();
        console.log(chalk.magenta('💡 Improvement Opportunities:'));
        score.suggestions.slice(0, 3).forEach((suggestion: string, index: number) => {
          console.log(`${chalk.gray(`${index + 1}.`)} ${suggestion}`);
        });
      }

      console.log();
      if (score.overall < 70) {
        console.log(chalk.yellow('🚀 Good news! There\'s significant room for optimization.'));
      } else if (score.overall < 85) {
        console.log(chalk.blue('💡 Your prompt is decent, but optimization can make it even better.'));
      } else {
        console.log(chalk.green('✨ Your prompt is already good! Optimization will fine-tune it.'));
      }

      console.log();
      await this.prompt('Press Enter to continue');
    } catch (error) {
      spinner.fail('Quality analysis failed');
      throw error;
    }
  }

  /**
   * Step 3: Configure optimization
   */
  private async stepConfigureOptimization(options: WizardOptions): Promise<void> {
    console.log(chalk.yellow.bold('⚙️ Step 3: Configure Optimization'));
    console.log();

    if (options.mode === 'beginner') {
      console.log(chalk.gray('Using recommended settings for best results...'));
      // Keep defaults
    } else {
      console.log(chalk.cyan('Optimization Parameters:'));
      
      const models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'gemini-pro'];
      console.log(`\nTarget models: ${models.join(', ')}`);
      const modelChoice = await this.prompt(`Target model (${this.state.targetModel})`, this.state.targetModel);
      if (models.includes(modelChoice)) {
        this.state.targetModel = modelChoice;
      }

      const iterationsChoice = await this.prompt(`Refinement iterations (${this.state.iterations})`, this.state.iterations.toString());
      const iterations = parseInt(iterationsChoice, 10);
      if (iterations >= 1 && iterations <= 10) {
        this.state.iterations = iterations;
      }

      const examplesChoice = await this.prompt(`Few-shot examples (${this.state.examples})`, this.state.examples.toString());
      const examples = parseInt(examplesChoice, 10);
      if (examples >= 0 && examples <= 20) {
        this.state.examples = examples;
      }

      const reasoningChoice = await this.prompt(`Generate reasoning steps? (${this.state.reasoning ? 'yes' : 'no'})`, this.state.reasoning ? 'yes' : 'no');
      this.state.reasoning = reasoningChoice.toLowerCase().startsWith('y');
    }

    console.log();
    console.log(chalk.green('Configuration Summary:'));
    console.log(`• ${chalk.gray('Target Model:')} ${this.state.targetModel}`);
    console.log(`• ${chalk.gray('Iterations:')} ${this.state.iterations}`);
    console.log(`• ${chalk.gray('Examples:')} ${this.state.examples}`);
    console.log(`• ${chalk.gray('Reasoning:')} ${this.state.reasoning ? 'Yes' : 'No'}`);

    console.log();
    await this.prompt('Press Enter to start optimization');
  }

  /**
   * Step 4: Run optimization
   */
  private async stepRunOptimization(): Promise<void> {
    console.log(chalk.yellow.bold('🚀 Step 4: Running Optimization'));
    console.log();

    const spinner = ora('Optimizing with PromptWizard...').start();

    try {
      // Set up progress tracking
      this.optimizationService.on('optimization:started', () => {
        spinner.text = 'Optimization started - analyzing prompt...';
      });

      const result = await this.optimizationService.optimizeTemplate({
        templateId: this.state.templateId || 'wizard-prompt',
        template: {
          id: this.state.templateId || 'wizard-prompt',
          name: this.state.task,
          content: this.state.originalPrompt,
          description: this.state.task,
        },
        config: {
          task: this.state.task,
          targetModel: this.state.targetModel as any,
          mutateRefineIterations: this.state.iterations,
          fewShotCount: this.state.examples,
          generateReasoning: this.state.reasoning,
        },
      });

      this.state.currentOptimized = result.optimizedTemplate.content || '';
      
      spinner.succeed('Optimization completed successfully!');
      console.log();

      // Show quick metrics
      console.log(chalk.green('🎉 Optimization Results:'));
      console.log(`• ${chalk.gray('Token Reduction:')} ${chalk.green(`${result.metrics.tokenReduction}%`)}`);
      console.log(`• ${chalk.gray('Accuracy Improvement:')} ${chalk.green(`${result.metrics.accuracyImprovement}%`)}`);
      console.log(`• ${chalk.gray('Processing Time:')} ${chalk.blue(`${(result.metrics.optimizationTime / 1000).toFixed(2)}s`)}`);
      console.log(`• ${chalk.gray('Quality Score:')} ${this.getScoreColor(result.qualityScore.overall)(`${result.qualityScore.overall}/100`)}`);

      this.state.scores.push({
        type: 'optimized',
        score: result.qualityScore,
        timestamp: new Date(),
      });

      console.log();
      await this.prompt('Press Enter to see detailed comparison');
    } catch (error) {
      spinner.fail('Optimization failed');
      throw error;
    }
  }

  /**
   * Step 5: Compare results
   */
  private async stepCompareResults(): Promise<void> {
    console.log(chalk.yellow.bold('🔍 Step 5: Compare Results'));
    console.log();

    const spinner = ora('Generating detailed comparison...').start();

    try {
      const comparison = await this.client.comparePrompts(
        this.state.originalPrompt,
        this.state.currentOptimized!,
        this.state.task
      );

      this.state.comparisons.push({
        comparison,
        timestamp: new Date(),
      });

      spinner.succeed('Comparison completed!');
      console.log();

      // Show side-by-side comparison
      console.log(chalk.cyan.bold('📊 Before vs After'));
      console.log('┌─────────────────────────────────┬─────────────┬─────────────┐');
      console.log('│ Metric                          │ Before      │ After       │');
      console.log('├─────────────────────────────────┼─────────────┼─────────────┤');
      
      const metrics = [
        ['Overall Score', comparison.original.score.overall, comparison.optimized.score.overall],
        ['Clarity', comparison.original.score.metrics.clarity, comparison.optimized.score.metrics.clarity],
        ['Task Alignment', comparison.original.score.metrics.taskAlignment, comparison.optimized.score.metrics.taskAlignment],
        ['Token Efficiency', comparison.original.score.metrics.tokenEfficiency, comparison.optimized.score.metrics.tokenEfficiency],
        ['Est. Tokens', comparison.original.estimatedTokens, comparison.optimized.estimatedTokens],
      ];

      metrics.forEach(([metric, before, after]) => {
        const beforeStr = String(before).padEnd(11);
        const afterStr = String(after).padEnd(11);
        const afterColor = typeof before === 'number' && typeof after === 'number' && after > before 
          ? chalk.green : chalk.white;
        console.log(`│ ${String(metric).padEnd(31)} │ ${beforeStr} │ ${afterColor(afterStr)} │`);
      });
      
      console.log('└─────────────────────────────────┴─────────────┴─────────────┘');

      if (comparison.improvements) {
        console.log();
        console.log(chalk.green('🎯 Key Improvements:'));
        console.log(`• Quality improved by ${comparison.improvements.qualityImprovement.toFixed(1)}%`);
        console.log(`• Tokens reduced by ${comparison.improvements.tokenReduction.toFixed(1)}%`);
        console.log(`• Cost savings of ${comparison.improvements.costSavings.toFixed(1)}%`);
      }

      // Show optimized content
      console.log();
      console.log(chalk.magenta.bold('✨ Optimized Content:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(this.state.currentOptimized!);
      console.log(chalk.gray('─'.repeat(50)));

      console.log();
      const satisfied = await this.confirm('Are you satisfied with these results?');
      
      if (!satisfied && this.state.refinements < 2) {
        console.log();
        console.log(chalk.yellow('💡 Let\'s try refining the optimization...'));
        this.state.refinements++;
        this.state.step = 2; // Go back to analysis step
      }

      console.log();
      await this.prompt('Press Enter to continue');
    } catch (error) {
      spinner.fail('Comparison failed');
      throw error;
    }
  }

  /**
   * Step 6: Refine settings (advanced mode)
   */
  private async stepRefineSettings(): Promise<void> {
    console.log(chalk.yellow.bold('🎛️ Step 6: Refine Settings'));
    console.log();

    const currentScore = this.state.scores[this.state.scores.length - 1];
    if (currentScore.score.overall < 85) {
      console.log(chalk.yellow('The score could be better. Let\'s try different settings.'));
      
      const increaseIterations = await this.confirm('Increase refinement iterations for better quality?');
      if (increaseIterations) {
        this.state.iterations = Math.min(this.state.iterations + 2, 10);
      }

      const moreExamples = await this.confirm('Generate more examples for better context?');
      if (moreExamples) {
        this.state.examples = Math.min(this.state.examples + 3, 15);
      }

      if (increaseIterations || moreExamples) {
        console.log();
        console.log(chalk.blue('Running optimization with refined settings...'));
        this.state.step = 3; // Go back to optimization step
        return;
      }
    } else {
      console.log(chalk.green('Great results! The optimization is performing well.'));
    }

    console.log();
    await this.prompt('Press Enter to continue');
  }

  /**
   * Step 7: Advanced tuning
   */
  private async stepAdvancedTuning(): Promise<void> {
    console.log(chalk.yellow.bold('🔬 Step 7: Advanced Tuning'));
    console.log();
    console.log(chalk.gray('Advanced features for expert users...'));

    // Show advanced metrics and options
    const latestComparison = this.state.comparisons[this.state.comparisons.length - 1];
    
    if (latestComparison.comparison.analysis) {
      console.log();
      console.log(chalk.cyan('🔍 Analysis Insights:'));
      
      if (latestComparison.comparison.analysis.strengthsGained.length > 0) {
        console.log(chalk.green('\n✅ Strengths Gained:'));
        latestComparison.comparison.analysis.strengthsGained.forEach((strength: string) => {
          console.log(`  • ${strength}`);
        });
      }
      
      if (latestComparison.comparison.analysis.potentialRisks.length > 0) {
        console.log(chalk.red('\n⚠️  Potential Risks:'));
        latestComparison.comparison.analysis.potentialRisks.forEach((risk: string) => {
          console.log(`  • ${risk}`);
        });
      }
    }

    console.log();
    await this.prompt('Press Enter to continue');
  }

  /**
   * Step 8: Expert analysis
   */
  private async stepExpertAnalysis(): Promise<void> {
    console.log(chalk.yellow.bold('🧠 Step 8: Expert Analysis'));
    console.log();

    // Show detailed performance analytics
    console.log(chalk.cyan('📈 Performance Analytics:'));
    
    const scoreHistory = this.state.scores.map(s => s.score.overall);
    const improvement = scoreHistory.length > 1 
      ? scoreHistory[scoreHistory.length - 1] - scoreHistory[0]
      : 0;

    console.log(`• Score improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)} points`);
    console.log(`• Refinement cycles: ${this.state.refinements}`);
    console.log(`• Total comparisons: ${this.state.comparisons.length}`);

    if (this.state.comparisons.length > 0) {
      const totalTokenReduction = this.state.comparisons.reduce((sum, c) => 
        sum + (c.comparison.improvements?.tokenReduction || 0), 0
      ) / this.state.comparisons.length;
      
      console.log(`• Average token reduction: ${totalTokenReduction.toFixed(1)}%`);
    }

    console.log();
    await this.prompt('Press Enter to complete the wizard');
  }

  /**
   * Show completion summary
   */
  private async showCompletion(): Promise<void> {
    console.clear();
    console.log(chalk.green.bold('🎉 Optimization Complete!'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log();

    const finalScore = this.state.scores[this.state.scores.length - 1];
    const originalScore = this.state.scores[0];
    const improvement = finalScore.score.overall - originalScore.score.overall;

    console.log(chalk.white('✨ Optimization Summary:'));
    console.log(`• ${chalk.blue('Original Score:')} ${originalScore.score.overall}/100`);
    console.log(`• ${chalk.green('Final Score:')} ${finalScore.score.overall}/100`);
    console.log(`• ${chalk.yellow('Improvement:')} ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)} points`);
    console.log(`• ${chalk.magenta('Refinements:')} ${this.state.refinements} cycles`);

    console.log();
    const savePrompt = await this.confirm('Would you like to save the optimized prompt?');
    
    if (savePrompt) {
      const outputPath = await this.prompt('Output file path', 'optimized-prompt.json');
      await this.saveOptimizedPrompt(outputPath);
    }

    console.log();
    console.log(chalk.blue('Thank you for using PromptWizard! 🧙'));
    console.log(chalk.gray('Run the wizard again anytime to optimize more prompts.'));
  }

  /**
   * Save optimized prompt
   */
  private async saveOptimizedPrompt(outputPath: string): Promise<void> {
    try {
      const fs = await import('fs');
      
      const result = {
        wizard: {
          completed: new Date().toISOString(),
          refinements: this.state.refinements,
          finalScore: this.state.scores[this.state.scores.length - 1].score,
        },
        original: {
          prompt: this.state.originalPrompt,
          task: this.state.task,
          score: this.state.scores[0].score,
        },
        optimized: {
          prompt: this.state.currentOptimized,
          configuration: {
            targetModel: this.state.targetModel,
            iterations: this.state.iterations,
            examples: this.state.examples,
            reasoning: this.state.reasoning,
          },
        },
        comparisons: this.state.comparisons,
      };

      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      this.success(`Optimized prompt saved to: ${outputPath}`);
    } catch (error) {
      this.error(`Failed to save optimized prompt: ${error instanceof Error ? error.message : String(error)}`);
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
}

export default OptimizationWizardCommand;
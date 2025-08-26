/**
 * @fileoverview Interactive optimization wizard for guided prompt optimization
 * @lastmodified 2025-08-26T11:37:12Z
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
import {
  PromptWizardClient,
  createDefaultConfig,
} from '../../integrations/promptwizard';
import type {
  QualityScore,
  PromptComparison,
} from '../../integrations/promptwizard/types';

/**
 * Options for the wizard command
 * @interface WizardOptions
 * @example
 * ```bash
 * # Start wizard with specific template
 * cursor-prompt wizard --template "user-onboarding"
 *
 * # Expert mode with no introduction
 * cursor-prompt wizard --mode expert --skip-intro
 *
 * # Beginner-friendly mode (default)
 * cursor-prompt wizard --mode beginner
 * ```
 */
interface WizardOptions {
  /** Template name to start optimization with */
  template?: string;
  /** Skip the introductory explanation */
  skipIntro?: boolean;
  /** Wizard complexity mode (beginner, advanced, expert) */
  mode?: string;
}

/**
 * Internal state management for the optimization wizard
 * @interface WizardState
 * @example
 * ```typescript
 * const state: WizardState = {
 *   step: 1,
 *   maxSteps: 5,
 *   templateId: 'user-guide',
 *   originalPrompt: 'Create a user guide...',
 *   task: 'Help new users understand the platform',
 *   targetModel: 'gpt-4',
 *   iterations: 3,
 *   examples: 5,
 *   reasoning: true,
 *   currentOptimized: undefined,
 *   scores: [],
 *   comparisons: [],
 *   refinements: 0
 * };
 * ```
 */
interface WizardState {
  /** Current wizard step (1-based) */
  step: number;
  /** Total number of steps for current mode */
  maxSteps: number;
  /** Optional template ID being optimized */
  templateId?: string;
  /** Original prompt content */
  originalPrompt: string;
  /** Task description for optimization context */
  task: string;
  /** Target model for optimization */
  targetModel: string;
  /** Number of refinement iterations */
  iterations: number;
  /** Number of few-shot examples to generate */
  examples: number;
  /** Whether to include reasoning steps */
  reasoning: boolean;
  /** Current optimized prompt content */
  currentOptimized?: string;
  /** History of quality scores */
  scores: Array<{
    type: 'original' | 'optimized';
    score: QualityScore;
    timestamp: Date;
  }>;
  /** History of comparison results */
  comparisons: Array<{
    comparison: PromptComparison;
    timestamp: Date;
  }>;
  /** Number of refinement cycles performed */
  refinements: number;
}

/**
 * Interactive optimization wizard for guided prompt optimization
 *
 * Provides a step-by-step interface for optimizing prompts with real-time
 * feedback, quality analysis, and iterative refinement. Supports multiple
 * complexity modes from beginner to expert.
 *
 * @class OptimizationWizardCommand
 * @extends BaseCommand
 * @example
 * ```bash
 * # Basic wizard usage
 * cursor-prompt wizard
 *
 * # Start with specific template
 * cursor-prompt wizard --template "customer-support"
 *
 * # Expert mode for advanced users
 * cursor-prompt wizard --mode expert --skip-intro
 *
 * # Quick access aliases
 * cursor-prompt guide
 * cursor-prompt wizard --mode advanced
 * ```
 *
 * Wizard Flow:
 * 1. **Prompt Selection**: Choose template or input custom prompt
 * 2. **Quality Analysis**: Analyze current prompt quality and identify issues
 * 3. **Configuration**: Set optimization parameters (model, iterations, examples)
 * 4. **Optimization**: Run PromptWizard optimization with progress tracking
 * 5. **Comparison**: Side-by-side analysis of before/after results
 * 6. **Refinement**: Optional parameter tuning for better results (advanced+)
 * 7. **Advanced Tuning**: Deep analysis and fine-tuning (advanced/expert)
 * 8. **Expert Analysis**: Performance analytics and insights (expert only)
 */
export class OptimizationWizardCommand extends BaseCommand {
  /** Command name for CLI invocation */
  name = 'prompt:wizard';

  /** Human-readable command description */
  description =
    'Interactive optimization wizard with guided step-by-step refinement';

  /** Command aliases for easier access */
  aliases = ['wizard', 'guide'];

  /** Command-line options configuration */
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

  /** Service for template operations and management */
  private templateService!: TemplateService;

  /** Service for optimization result caching */
  private cacheService!: CacheService;

  /** Core optimization service with PromptWizard integration */
  private optimizationService!: PromptOptimizationService;

  /** PromptWizard client for API communication */
  private client!: PromptWizardClient;

  /** Current wizard state and progress */
  private state!: WizardState;

  /**
   * Execute the wizard command
   *
   * Main entry point that initializes services, checks health, and runs
   * the interactive wizard flow based on the specified mode.
   *
   * @param args - Command arguments (unused)
   * @param options - Parsed command options
   * @returns Promise that resolves when wizard completes
   *
   * @throws {Error} If PromptWizard service is unavailable
   * @throws {Error} If wizard execution fails
   *
   * @example
   * ```typescript
   * const command = new OptimizationWizardCommand();
   *
   * // Basic wizard
   * await command.execute([], { mode: 'beginner' });
   *
   * // Expert wizard with template
   * await command.execute([], {
   *   template: 'support-prompt',
   *   mode: 'expert',
   *   skipIntro: true
   * });
   * ```
   */
  async execute(_args: unknown, options: WizardOptions): Promise<void> {
    await this.initializeServices();

    // Check service health
    const isHealthy = await this.checkServiceHealth();
    if (!isHealthy) {
      this.error(
        'PromptWizard service is not available. Please check your configuration.'
      );
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
      this.error(
        `Wizard failed: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  }

  /**
   * Initialize required services
   *
   * Sets up PromptWizard client, template service, cache service,
   * and optimization service with comprehensive error handling.
   *
   * @private
   * @returns Promise that resolves when all services are ready
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
   * Verifies that the PromptWizard service is available and responsive
   * before starting the wizard to avoid mid-flow failures.
   *
   * @private
   * @returns Promise resolving to true if service is healthy
   */
  private async checkServiceHealth(): Promise<boolean> {
    try {
      return await this.client.healthCheck();
    } catch (error) {
      logger.error(
        `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Initialize wizard state
   *
   * Sets up the initial state machine configuration based on wizard mode.
   * Different modes have different step counts and complexity levels.
   *
   * @private
   * @param options - Command options affecting wizard behavior
   *
   * Step Counts by Mode:
   * - Beginner: 5 steps (simplified flow)
   * - Advanced: 6 steps (adds refinement)
   * - Expert: 8 steps (adds advanced tuning and analytics)
   */
  private initializeState(options: WizardOptions): void {
    this.state = {
      step: 1,
      maxSteps:
        options.mode === 'expert' ? 8 : options.mode === 'advanced' ? 6 : 5,
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
   *
   * Displays welcome screen with overview of wizard capabilities
   * and flow. Allows user to cancel before starting the process.
   *
   * @private
   * @returns Promise that resolves when introduction is complete
   *
   * @example
   * ```
   * 🧿 PromptWizard Optimization Wizard
   * ═════════════════════════
   *
   * Welcome to the interactive prompt optimization wizard!
   *
   * This wizard will guide you through:
   * • Analyzing your prompt quality
   * • Optimizing with Microsoft PromptWizard
   * • Comparing before and after results
   * ```
   */
  private async showIntroduction(): Promise<void> {
    console.clear();
    console.log(chalk.blue.bold('🧙 PromptWizard Optimization Wizard'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log();
    console.log(
      chalk.white('Welcome to the interactive prompt optimization wizard!')
    );
    console.log();
    console.log(chalk.gray('This wizard will guide you through:'));
    console.log(chalk.gray('• Analyzing your prompt quality'));
    console.log(chalk.gray('• Optimizing with Microsoft PromptWizard'));
    console.log(chalk.gray('• Comparing before and after results'));
    console.log(chalk.gray('• Fine-tuning optimization parameters'));
    console.log(chalk.gray('• Saving your optimized prompt'));
    console.log();

    const shouldContinue = await this.confirm(
      'Ready to start optimizing your prompts?'
    );
    if (!shouldContinue) {
      console.log(
        chalk.yellow("Wizard cancelled. Come back when you're ready!")
      );
      process.exit(0);
    }
  }

  /**
   * Run the wizard steps
   *
   * Executes the main wizard loop, progressing through each step
   * until completion. Handles step navigation and state management.
   *
   * @private
   * @param options - Command options affecting wizard behavior
   * @returns Promise that resolves when all steps are complete
   */
  private async runWizard(options: WizardOptions): Promise<void> {
    while (this.state.step <= this.state.maxSteps) {
      await this.runStep(options);
      this.state.step += 1;
    }

    await this.showCompletion();
  }

  /**
   * Run individual wizard step
   *
   * Dispatches to the appropriate step handler based on current
   * wizard state and mode. Each step is self-contained and manages
   * its own user interaction.
   *
   * @private
   * @param options - Command options affecting step behavior
   * @returns Promise that resolves when step completes
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
   *
   * Displays consistent header for each wizard step with progress
   * indicator and step counter.
   *
   * @private
   *
   * @example
   * ```
   * 🧿 PromptWizard Optimization Wizard
   * ═════════════════════════
   * Step 3/5
   * ```
   */
  private showStepHeader(): void {
    console.clear();
    console.log(chalk.blue.bold('🧙 PromptWizard Optimization Wizard'));
    console.log(chalk.cyan('═'.repeat(50)));
    console.log(
      `${chalk.gray('Step')} ${chalk.white.bold(`${this.state.step}/${this.state.maxSteps}`)}`
    );
    console.log();
  }

  /**
   * Step 1: Select prompt to optimize
   *
   * Handles prompt selection through template lookup or direct input.
   * Validates template existence and extracts prompt content and task
   * description for optimization.
   *
   * @private
   * @returns Promise that resolves when prompt is selected and loaded
   *
   * @example
   * ```
   * 📝 Step 1: Select Prompt to Optimize
   *
   * Enter (t)emplate name or (p)rompt text directly? [t/p] t
   * Template name: user-onboarding
   * ✓ Template loaded successfully
   *
   * Prompt loaded:
   * ─────────────────────────
   * Create a comprehensive guide for new users...
   * ─────────────────────────
   * ```
   */
  private async stepSelectPrompt(): Promise<void> {
    console.log(chalk.yellow.bold('📝 Step 1: Select Prompt to Optimize'));
    console.log();

    if (this.state.templateId) {
      console.log(`${chalk.blue('Template:')} ${this.state.templateId}`);
      const templatePath = await this.templateService.findTemplate(
        this.state.templateId
      );
      if (templatePath) {
        const template = await this.templateService.loadTemplate(templatePath);
        const renderedTemplate = await this.templateService.renderTemplate(
          template,
          {}
        );
        this.state.originalPrompt =
          renderedTemplate.files?.map(f => f.content).join('\n') || '';
        this.state.task = template.description || template.name;
        console.log(`${chalk.green('✓')} Template loaded successfully`);
      } else {
        this.error(`Template not found: ${this.state.templateId}`);
        this.state.templateId = undefined;
      }
    }

    if (!this.state.templateId) {
      const choice = await this.prompt(
        'Enter (t)emplate name or (p)rompt text directly? [t/p]'
      );

      if (choice.toLowerCase() === 't') {
        const templateName = await this.prompt('Template name');
        const templatePath =
          await this.templateService.findTemplate(templateName);
        if (templatePath) {
          const template =
            await this.templateService.loadTemplate(templatePath);
          const renderedTemplate = await this.templateService.renderTemplate(
            template,
            {}
          );
          this.state.templateId = templateName;
          this.state.originalPrompt =
            renderedTemplate.files?.map(f => f.content).join('\n') || '';
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
    console.log(
      this.state.originalPrompt.length > 200
        ? `${this.state.originalPrompt.substring(0, 200)}...`
        : this.state.originalPrompt
    );
    console.log(chalk.gray('─'.repeat(40)));
    console.log();

    await this.prompt('Press Enter to continue');
  }

  /**
   * Step 2: Analyze current quality
   *
   * Performs comprehensive quality analysis of the original prompt using
   * PromptWizard's scoring system. Displays detailed metrics and improvement
   * suggestions to set baseline expectations.
   *
   * @private
   * @returns Promise that resolves when analysis is complete
   *
   * @example
   * ```
   * 📊 Step 2: Analyze Current Quality
   *
   * ✓ Quality analysis completed!
   *
   * Overall Score: 72/100 (Fair)
   * Confidence: 85.3%
   *
   * Detailed Metrics:
   * • Clarity: 68/100
   * • Task Alignment: 75/100
   * • Token Efficiency: 73/100
   *
   * 💡 Improvement Opportunities:
   * 1. Add more specific examples
   * 2. Clarify expected output format
   * 3. Reduce redundant instructions
   * ```
   */
  private async stepAnalyzeQuality(): Promise<void> {
    console.log(chalk.yellow.bold('📊 Step 2: Analyze Current Quality'));
    console.log();

    const spinner = ora('Analyzing prompt quality...').start();

    try {
      const score = await this.client.scorePrompt(
        this.state.originalPrompt,
        this.state.task
      );
      this.state.scores.push({
        type: 'original',
        score,
        timestamp: new Date(),
      });

      spinner.succeed('Quality analysis completed!');
      console.log();

      // Display score
      const overallColor = this.getScoreColor(score.overall);
      console.log(
        `${chalk.blue('Overall Score:')} ${overallColor(`${score.overall}/100`)} (${this.getScoreLabel(score.overall)})`
      );
      console.log(
        `${chalk.blue('Confidence:')} ${score.confidence.toFixed(1)}%`
      );
      console.log();

      console.log(chalk.cyan('Detailed Metrics:'));
      console.log(
        `• ${chalk.gray('Clarity:')} ${this.getScoreColor(score.metrics.clarity)(`${score.metrics.clarity}/100`)}`
      );
      console.log(
        `• ${chalk.gray('Task Alignment:')} ${this.getScoreColor(score.metrics.taskAlignment)(`${score.metrics.taskAlignment}/100`)}`
      );
      console.log(
        `• ${chalk.gray('Token Efficiency:')} ${this.getScoreColor(score.metrics.tokenEfficiency)(`${score.metrics.tokenEfficiency}/100`)}`
      );

      if (score.suggestions.length > 0) {
        console.log();
        console.log(chalk.magenta('💡 Improvement Opportunities:'));
        score.suggestions
          .slice(0, 3)
          .forEach((suggestion: string, index: number) => {
            console.log(`${chalk.gray(`${index + 1}.`)} ${suggestion}`);
          });
      }

      console.log();
      if (score.overall < 70) {
        console.log(
          chalk.yellow(
            "🚀 Good news! There's significant room for optimization."
          )
        );
      } else if (score.overall < 85) {
        console.log(
          chalk.blue(
            '💡 Your prompt is decent, but optimization can make it even better.'
          )
        );
      } else {
        console.log(
          chalk.green(
            '✨ Your prompt is already good! Optimization will fine-tune it.'
          )
        );
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
   *
   * Allows users to configure optimization parameters based on their
   * expertise level. Beginner mode uses recommended defaults while
   * advanced/expert modes allow full customization.
   *
   * @private
   * @param options - Command options affecting configuration level
   * @returns Promise that resolves when configuration is complete
   *
   * @example
   * ```
   * ⚙️ Step 3: Configure Optimization
   *
   * Target models: gpt-4, gpt-3.5-turbo, claude-3-opus, claude-3-sonnet, gemini-pro
   * Target model (gpt-4): claude-3-opus
   * Refinement iterations (3): 5
   * Few-shot examples (5): 8
   * Generate reasoning steps? (yes): yes
   *
   * Configuration Summary:
   * • Target Model: claude-3-opus
   * • Iterations: 5
   * • Examples: 8
   * • Reasoning: Yes
   * ```
   */
  private async stepConfigureOptimization(
    options: WizardOptions
  ): Promise<void> {
    console.log(chalk.yellow.bold('⚙️ Step 3: Configure Optimization'));
    console.log();

    if (options.mode === 'beginner') {
      console.log(chalk.gray('Using recommended settings for best results...'));
      // Keep defaults
    } else {
      console.log(chalk.cyan('Optimization Parameters:'));

      const models = [
        'gpt-4',
        'gpt-3.5-turbo',
        'claude-3-opus',
        'claude-3-sonnet',
        'gemini-pro',
      ];
      console.log(`\nTarget models: ${models.join(', ')}`);
      const modelChoice = await this.prompt(
        `Target model (${this.state.targetModel})`,
        this.state.targetModel
      );
      if (models.includes(modelChoice)) {
        this.state.targetModel = modelChoice;
      }

      const iterationsChoice = await this.prompt(
        `Refinement iterations (${this.state.iterations})`,
        this.state.iterations.toString()
      );
      const iterations = parseInt(iterationsChoice, 10);
      if (iterations >= 1 && iterations <= 10) {
        this.state.iterations = iterations;
      }

      const examplesChoice = await this.prompt(
        `Few-shot examples (${this.state.examples})`,
        this.state.examples.toString()
      );
      const examples = parseInt(examplesChoice, 10);
      if (examples >= 0 && examples <= 20) {
        this.state.examples = examples;
      }

      const reasoningChoice = await this.prompt(
        `Generate reasoning steps? (${this.state.reasoning ? 'yes' : 'no'})`,
        this.state.reasoning ? 'yes' : 'no'
      );
      this.state.reasoning = reasoningChoice.toLowerCase().startsWith('y');
    }

    console.log();
    console.log(chalk.green('Configuration Summary:'));
    console.log(`• ${chalk.gray('Target Model:')} ${this.state.targetModel}`);
    console.log(`• ${chalk.gray('Iterations:')} ${this.state.iterations}`);
    console.log(`• ${chalk.gray('Examples:')} ${this.state.examples}`);
    console.log(
      `• ${chalk.gray('Reasoning:')} ${this.state.reasoning ? 'Yes' : 'No'}`
    );

    console.log();
    await this.prompt('Press Enter to start optimization');
  }

  /**
   * Step 4: Run optimization
   *
   * Executes the actual optimization using PromptWizard with the
   * configured parameters. Provides real-time progress updates and
   * displays quick metrics upon completion.
   *
   * @private
   * @returns Promise that resolves when optimization completes
   *
   * @example
   * ```
   * 🚀 Step 4: Running Optimization
   *
   * ✓ Optimization completed successfully!
   *
   * 🎉 Optimization Results:
   * • Token Reduction: 23%
   * • Accuracy Improvement: 18%
   * • Processing Time: 15.7s
   * • Quality Score: 89/100
   *
   * Press Enter to see detailed comparison
   * ```
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
          name: this.state.task,
          version: '1.0.0',
          description: this.state.task,
          files: [
            {
              path: 'content.txt',
              source: 'content.txt',
              destination: 'content.txt',
              content: this.state.originalPrompt,
              name: 'content',
            },
          ],
          variables: {},
          commands: [],
        },
        config: {
          task: this.state.task,
          targetModel: this.state.targetModel as
            | 'gpt-4'
            | 'gpt-3.5-turbo'
            | 'claude-3-opus'
            | 'claude-3-sonnet'
            | 'gemini-pro',
          mutateRefineIterations: this.state.iterations,
          fewShotCount: this.state.examples,
          generateReasoning: this.state.reasoning,
        },
      });

      // Extract content from optimized template files
      this.state.currentOptimized =
        (result.optimizedTemplate.files?.[0] as any)?.content || '';

      spinner.succeed('Optimization completed successfully!');
      console.log();

      // Show quick metrics
      console.log(chalk.green('🎉 Optimization Results:'));
      console.log(
        `• ${chalk.gray('Token Reduction:')} ${chalk.green(`${result.metrics.tokenReduction}%`)}`
      );
      console.log(
        `• ${chalk.gray('Accuracy Improvement:')} ${chalk.green(`${result.metrics.accuracyImprovement}%`)}`
      );
      console.log(
        `• ${chalk.gray('Processing Time:')} ${chalk.blue(`${(result.metrics.optimizationTime / 1000).toFixed(2)}s`)}`
      );
      console.log(
        `• ${chalk.gray('Quality Score:')} ${this.getScoreColor(result.qualityScore.overall)(`${result.qualityScore.overall}/100`)}`
      );

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
   *
   * Generates and displays detailed side-by-side comparison of original
   * vs optimized prompts. Shows metrics, improvements, and the full
   * optimized content. Allows user to request refinements if unsatisfied.
   *
   * @private
   * @returns Promise that resolves when comparison is complete
   *
   * @example
   * ```
   * 🔍 Step 5: Compare Results
   *
   * ✓ Comparison completed!
   *
   * 📊 Before vs After
   * ┌─────────────────────────────────┐
   * │ Metric          │ Before  │ After   │
   * ├─────────────────────────────────┤
   * │ Overall Score   │ 72      │ 89      │
   * │ Clarity         │ 68      │ 91      │
   * │ Task Alignment  │ 75      │ 87      │
   * └─────────────────────────────────┘
   *
   * 🎯 Key Improvements:
   * • Quality improved by 23.6%
   * • Tokens reduced by 18.5%
   * • Cost savings of 15.2%
   * ```
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
      console.log(
        '┌─────────────────────────────────┬─────────────┬─────────────┐'
      );
      console.log(
        '│ Metric                          │ Before      │ After       │'
      );
      console.log(
        '├─────────────────────────────────┼─────────────┼─────────────┤'
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
          'Est. Tokens',
          comparison.original.estimatedTokens,
          comparison.optimized.estimatedTokens,
        ],
      ];

      metrics.forEach(([metric, before, after]) => {
        const beforeStr = String(before).padEnd(11);
        const afterStr = String(after).padEnd(11);
        const afterColor =
          typeof before === 'number' &&
          typeof after === 'number' &&
          after > before
            ? chalk.green
            : chalk.white;
        console.log(
          `│ ${String(metric).padEnd(31)} │ ${beforeStr} │ ${afterColor(afterStr)} │`
        );
      });

      console.log(
        '└─────────────────────────────────┴─────────────┴─────────────┘'
      );

      if (comparison.improvements) {
        console.log();
        console.log(chalk.green('🎯 Key Improvements:'));
        console.log(
          `• Quality improved by ${comparison.improvements.qualityImprovement.toFixed(1)}%`
        );
        console.log(
          `• Tokens reduced by ${comparison.improvements.tokenReduction.toFixed(1)}%`
        );
        console.log(
          `• Cost savings of ${comparison.improvements.costSavings.toFixed(1)}%`
        );
      }

      // Show optimized content
      console.log();
      console.log(chalk.magenta.bold('✨ Optimized Content:'));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(this.state.currentOptimized!);
      console.log(chalk.gray('─'.repeat(50)));

      console.log();
      const satisfied = await this.confirm(
        'Are you satisfied with these results?'
      );

      if (!satisfied && this.state.refinements < 2) {
        console.log();
        console.log(chalk.yellow("💡 Let's try refining the optimization..."));
        this.state.refinements += 1;
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
   *
   * Available in advanced and expert modes. Analyzes current results
   * and suggests parameter adjustments for better optimization.
   * Can trigger re-optimization with refined settings.
   *
   * @private
   * @returns Promise that resolves when refinement is complete
   *
   * @example
   * ```
   * 🎛️ Step 6: Refine Settings
   *
   * The score could be better. Let's try different settings.
   * ? Increase refinement iterations for better quality? Yes
   * ? Generate more examples for better context? Yes
   *
   * Running optimization with refined settings...
   * ```
   */
  private async stepRefineSettings(): Promise<void> {
    console.log(chalk.yellow.bold('🎛️ Step 6: Refine Settings'));
    console.log();

    const currentScore = this.state.scores[this.state.scores.length - 1];
    if (currentScore.score.overall < 85) {
      console.log(
        chalk.yellow("The score could be better. Let's try different settings.")
      );

      const increaseIterations = await this.confirm(
        'Increase refinement iterations for better quality?'
      );
      if (increaseIterations) {
        this.state.iterations = Math.min(this.state.iterations + 2, 10);
      }

      const moreExamples = await this.confirm(
        'Generate more examples for better context?'
      );
      if (moreExamples) {
        this.state.examples = Math.min(this.state.examples + 3, 15);
      }

      if (increaseIterations || moreExamples) {
        console.log();
        console.log(
          chalk.blue('Running optimization with refined settings...')
        );
        this.state.step = 3; // Go back to optimization step
        return;
      }
    } else {
      console.log(
        chalk.green('Great results! The optimization is performing well.')
      );
    }

    console.log();
    await this.prompt('Press Enter to continue');
  }

  /**
   * Step 7: Advanced tuning
   *
   * Available in advanced and expert modes. Shows detailed analysis
   * of optimization results including strengths gained and potential
   * risks from the optimization process.
   *
   * @private
   * @returns Promise that resolves when advanced tuning review completes
   *
   * @example
   * ```
   * 🔬 Step 7: Advanced Tuning
   *
   * Advanced features for expert users...
   *
   * 🔍 Analysis Insights:
   *
   * ✅ Strengths Gained:
   *   • Improved task specificity
   *   • Better output format guidance
   *   • Enhanced context clarity
   *
   * ⚠️  Potential Risks:
   *   • Slight increase in complexity
   *   • May require domain knowledge
   * ```
   */
  private async stepAdvancedTuning(): Promise<void> {
    console.log(chalk.yellow.bold('🔬 Step 7: Advanced Tuning'));
    console.log();
    console.log(chalk.gray('Advanced features for expert users...'));

    // Show advanced metrics and options
    const latestComparison =
      this.state.comparisons[this.state.comparisons.length - 1];

    if (latestComparison.comparison.analysis) {
      console.log();
      console.log(chalk.cyan('🔍 Analysis Insights:'));

      if (latestComparison.comparison.analysis.strengthsGained.length > 0) {
        console.log(chalk.green('\n✅ Strengths Gained:'));
        latestComparison.comparison.analysis.strengthsGained.forEach(
          (strength: string) => {
            console.log(`  • ${strength}`);
          }
        );
      }

      if (latestComparison.comparison.analysis.potentialRisks.length > 0) {
        console.log(chalk.red('\n⚠️  Potential Risks:'));
        latestComparison.comparison.analysis.potentialRisks.forEach(
          (risk: string) => {
            console.log(`  • ${risk}`);
          }
        );
      }
    }

    console.log();
    await this.prompt('Press Enter to continue');
  }

  /**
   * Step 8: Expert analysis
   *
   * Available only in expert mode. Provides comprehensive performance
   * analytics, optimization history, and detailed statistics for
   * power users who need deep insights.
   *
   * @private
   * @returns Promise that resolves when expert analysis completes
   *
   * @example
   * ```
   * 🧠 Step 8: Expert Analysis
   *
   * 📈 Performance Analytics:
   * • Score improvement: +17.0 points
   * • Refinement cycles: 1
   * • Total comparisons: 2
   * • Average token reduction: 18.5%
   *
   * Press Enter to complete the wizard
   * ```
   */
  private async stepExpertAnalysis(): Promise<void> {
    console.log(chalk.yellow.bold('🧠 Step 8: Expert Analysis'));
    console.log();

    // Show detailed performance analytics
    console.log(chalk.cyan('📈 Performance Analytics:'));

    const scoreHistory = this.state.scores.map(s => s.score.overall);
    const improvement =
      scoreHistory.length > 1
        ? scoreHistory[scoreHistory.length - 1] - scoreHistory[0]
        : 0;

    console.log(
      `• Score improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)} points`
    );
    console.log(`• Refinement cycles: ${this.state.refinements}`);
    console.log(`• Total comparisons: ${this.state.comparisons.length}`);

    if (this.state.comparisons.length > 0) {
      const totalTokenReduction =
        this.state.comparisons.reduce(
          (sum, c) => sum + (c.comparison.improvements?.tokenReduction || 0),
          0
        ) / this.state.comparisons.length;

      console.log(
        `• Average token reduction: ${totalTokenReduction.toFixed(1)}%`
      );
    }

    console.log();
    await this.prompt('Press Enter to complete the wizard');
  }

  /**
   * Show completion summary
   *
   * Displays final optimization results and offers to save the
   * optimized prompt. Shows improvement metrics and thanks user.
   *
   * @private
   * @returns Promise that resolves when completion flow finishes
   *
   * @example
   * ```
   * 🎉 Optimization Complete!
   * ═════════════════════════
   *
   * ✨ Optimization Summary:
   * • Original Score: 72/100
   * • Final Score: 89/100
   * • Improvement: +17.0 points
   * • Refinements: 1 cycles
   *
   * ? Would you like to save the optimized prompt? Yes
   * Output file path (optimized-prompt.json):
   * ✓ Optimized prompt saved to: optimized-prompt.json
   *
   * Thank you for using PromptWizard! 🧿
   * ```
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
    console.log(
      `• ${chalk.blue('Original Score:')} ${originalScore.score.overall}/100`
    );
    console.log(
      `• ${chalk.green('Final Score:')} ${finalScore.score.overall}/100`
    );
    console.log(
      `• ${chalk.yellow('Improvement:')} ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)} points`
    );
    console.log(
      `• ${chalk.magenta('Refinements:')} ${this.state.refinements} cycles`
    );

    console.log();
    const savePrompt = await this.confirm(
      'Would you like to save the optimized prompt?'
    );

    if (savePrompt) {
      const outputPath = await this.prompt(
        'Output file path',
        'optimized-prompt.json'
      );
      await this.saveOptimizedPrompt(outputPath);
    }

    console.log();
    console.log(chalk.blue('Thank you for using PromptWizard! 🧙'));
    console.log(
      chalk.gray('Run the wizard again anytime to optimize more prompts.')
    );
  }

  /**
   * Save optimized prompt with complete wizard results
   *
   * Saves comprehensive wizard results including original prompt,
   * optimized version, configuration used, and all comparison data.
   *
   * @private
   * @param outputPath - File path for saving results
   * @returns Promise that resolves when file is saved
   *
   * @example
   * ```json
   * {
   *   "wizard": {
   *     "completed": "2024-01-15T10:30:00Z",
   *     "refinements": 1,
   *     "finalScore": {
   *       "overall": 89,
   *       "metrics": {
   *         "clarity": 91,
   *         "taskAlignment": 87,
   *         "tokenEfficiency": 89
   *       }
   *     }
   *   },
   *   "original": {
   *     "prompt": "Original prompt content...",
   *     "task": "User onboarding guide",
   *     "score": { "overall": 72 }
   *   },
   *   "optimized": {
   *     "prompt": "Optimized prompt content...",
   *     "configuration": {
   *       "targetModel": "gpt-4",
   *       "iterations": 5,
   *       "examples": 8,
   *       "reasoning": true
   *     }
   *   },
   *   "comparisons": [...]
   * }
   * ```
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
      this.error(
        `Failed to save optimized prompt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get color for score display
   *
   * Returns appropriate chalk color function based on score ranges
   * for consistent color-coded quality indicators throughout the wizard.
   *
   * @private
   * @param score - Quality score (0-100)
   * @returns Chalk color function for score formatting
   *
   * Color Mapping:
   * - 90+: Green (Excellent)
   * - 80-89: Cyan (Good)
   * - 70-79: Yellow (Fair)
   * - 60-69: Magenta (Poor)
   * - <60: Red (Very Poor)
   */
  private getScoreColor(score: number): typeof chalk.green {
    if (score >= 90) return chalk.green;
    if (score >= 80) return chalk.cyan;
    if (score >= 70) return chalk.yellow;
    if (score >= 60) return chalk.magenta;
    return chalk.red;
  }

  /**
   * Get descriptive label for score
   *
   * Returns human-readable quality label corresponding to score ranges
   * used throughout the wizard for consistent terminology.
   *
   * @private
   * @param score - Quality score (0-100)
   * @returns Descriptive label for the score
   *
   * @example
   * ```typescript
   * getScoreLabel(95); // "Excellent"
   * getScoreLabel(82); // "Good"
   * getScoreLabel(75); // "Fair"
   * getScoreLabel(65); // "Poor"
   * getScoreLabel(45); // "Very Poor"
   * ```
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

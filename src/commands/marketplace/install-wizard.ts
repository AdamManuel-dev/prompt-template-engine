/**
 * @fileoverview Interactive template installation wizard
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Guided installation, template discovery, smart recommendations
 * Main APIs: execute(), runWizard(), discoverTemplates()
 * Constraints: Interactive prompts, user input validation
 * Patterns: Wizard pattern, step-by-step workflow, user guidance
 */

import chalk from 'chalk';
import { BaseCommand } from '../../cli/base-command';
import { ICommand } from '../../cli/command-registry';
import { MarketplaceService } from '../../marketplace/core/marketplace.service';
import { TemplateRegistry } from '../../marketplace/core/template.registry';
import {
  TemplateModel,
  TemplateCategory,
} from '../../marketplace/models/template.model';
import { MarketplaceCommandOptions, MarketplaceTemplate } from '../../types';
import { logger } from '../../utils/logger';

export class InstallWizardCommand extends BaseCommand implements ICommand {
  name = 'install-wizard';

  description = 'Guided template installation with smart recommendations';

  aliases = ['wizard', 'guided-install'];

  options = [
    {
      flags: '--category <category>',
      description: 'Start with specific category',
    },
    {
      flags: '--featured-only',
      description: 'Show only featured templates',
      defaultValue: false,
    },
    {
      flags: '--quick-mode',
      description: 'Skip detailed information and use defaults',
      defaultValue: false,
    },
  ];

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options as MarketplaceCommandOptions);
  }

  async execute(
    _args: string,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      logger.info(chalk.bold.blue('\n🧙‍♂️ Template Installation Wizard\n'));
      logger.info(
        chalk.gray('Let me help you find and install the perfect template!\n')
      );

      await this.runWizard(options);
    } catch (error) {
      this.error(
        `Installation wizard failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async runWizard(options: MarketplaceCommandOptions): Promise<void> {
    const marketplace = await MarketplaceService.getInstance();
    const registry = new TemplateRegistry();

    // Step 1: Project analysis
    if (!options.quickMode) {
      const projectInfo = await InstallWizardCommand.analyzeProject();
      if (projectInfo.recommendations.length > 0) {
        logger.info(chalk.bold('🔍 Based on your project, I recommend:'));
        projectInfo.recommendations.forEach((rec, i) => {
          logger.info(`   ${i + 1}. ${chalk.cyan(rec)}`);
        });
        logger.info('');

        const useRecommendation = await this.confirm(
          'Would you like to see recommended templates?'
        );
        if (useRecommendation) {
          await this.showRecommendedTemplates(
            projectInfo.recommendations,
            marketplace
          );
        }
      }
    }

    // Step 2: Category selection
    let selectedCategory = options.category;
    if (!selectedCategory && !options.quickMode) {
      selectedCategory = await this.selectCategory();
    }

    // Step 3: Template discovery
    logger.info(chalk.bold('🔎 Discovering templates...\n'));
    const templates = await InstallWizardCommand.discoverTemplates(
      marketplace,
      {
        category: selectedCategory,
        featured: options.featured,
        limit: 20,
      }
    );

    if (templates.length === 0) {
      logger.info(chalk.yellow('No templates found matching your criteria.'));
      const browseAll = await this.confirm(
        'Would you like to browse all templates?'
      );
      if (browseAll) {
        const allTemplates = await InstallWizardCommand.discoverTemplates(
          marketplace,
          {
            limit: 50,
          }
        );
        await this.selectAndInstallTemplate(
          allTemplates,
          marketplace,
          registry,
          options
        );
      }
      return;
    }

    // Step 4: Template selection and installation
    await this.selectAndInstallTemplate(
      templates,
      marketplace,
      registry,
      options
    );
  }

  private static async analyzeProject(): Promise<{
    hasPackageJson: boolean;
    hasTsConfig: boolean;
    hasGitRepo: boolean;
    frameworks: string[];
    recommendations: string[];
  }> {
    const fs = await import('fs/promises');

    const analysis = {
      hasPackageJson: false,
      hasTsConfig: false,
      hasGitRepo: false,
      frameworks: [] as string[],
      recommendations: [] as string[],
    };

    try {
      // Check for package.json
      await fs.access('package.json');
      analysis.hasPackageJson = true;

      const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));

      // Detect frameworks
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      if (deps.react) analysis.frameworks.push('React');
      if (deps.vue) analysis.frameworks.push('Vue');
      if (deps.angular) analysis.frameworks.push('Angular');
      if (deps.next) analysis.frameworks.push('Next.js');
      if (deps.express) analysis.frameworks.push('Express');
    } catch {
      // No package.json
    }

    try {
      // Check for TypeScript
      await fs.access('tsconfig.json');
      analysis.hasTsConfig = true;
    } catch {
      // No TypeScript
    }

    try {
      // Check for Git repository
      await fs.access('.git');
      analysis.hasGitRepo = true;
    } catch {
      // No Git repo
    }

    // Generate recommendations based on analysis
    if (analysis.frameworks.includes('React')) {
      analysis.recommendations.push(
        'react-component',
        'react-hook',
        'jsx-template'
      );
    }
    if (analysis.frameworks.includes('Next.js')) {
      analysis.recommendations.push(
        'nextjs-page',
        'nextjs-api',
        'nextjs-component'
      );
    }
    if (analysis.hasTsConfig) {
      analysis.recommendations.push(
        'typescript-interface',
        'typescript-class',
        'type-definitions'
      );
    }
    if (analysis.hasGitRepo) {
      analysis.recommendations.push(
        'git-commit',
        'github-readme',
        'pull-request'
      );
    }
    if (analysis.hasPackageJson) {
      analysis.recommendations.push(
        'npm-package',
        'package-scripts',
        'node-module'
      );
    }

    // Default recommendations
    if (analysis.recommendations.length === 0) {
      analysis.recommendations.push(
        'documentation',
        'readme-template',
        'basic-config'
      );
    }

    return analysis;
  }

  // eslint-disable-next-line class-methods-use-this
  private async showRecommendedTemplates(
    recommendations: string[],
    marketplace: MarketplaceService
  ): Promise<void> {
    logger.info(chalk.bold('\n🌟 Recommended Templates:\n'));

    // Process recommendations sequentially for ordered display
    // eslint-disable-next-line no-restricted-syntax
    for (const rec of recommendations.slice(0, 5)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const searchResult = await marketplace.search({
          query: rec,
          limit: 1,
          sortBy: 'downloads',
        });

        if (searchResult.templates.length > 0) {
          const template = searchResult.templates[0];
          logger.info(
            `📦 ${chalk.cyan(template.displayName || template.name)}`
          );
          logger.info(`   ${template.description}`);
          const ratingValue = (() => {
            if (typeof template.rating === 'number') {
              return template.rating;
            }
            if (
              template.rating &&
              typeof template.rating === 'object' &&
              'average' in template.rating
            ) {
              return template.rating.average;
            }
            return 0;
          })();
          logger.info(
            `   ${InstallWizardCommand.formatRating(ratingValue)} • ${chalk.gray(`${InstallWizardCommand.formatNumber(template.stats?.downloads || 0)} downloads`)}`
          );
          logger.info('');
        }
      } catch {
        // Skip if template not found
      }
    }
  }

  private async selectCategory(): Promise<string> {
    logger.info(chalk.bold('📂 Select a category:\n'));

    const categories = [
      {
        value: 'development',
        name: '💻 Development - Code templates and snippets',
      },
      {
        value: 'documentation',
        name: '📚 Documentation - READMEs, guides, and docs',
      },
      { value: 'git', name: '🔧 Git - Commit messages, workflows, and hooks' },
      {
        value: 'testing',
        name: '🧪 Testing - Test templates and configurations',
      },
      {
        value: 'deployment',
        name: '🚀 Deployment - CI/CD and deployment configs',
      },
      {
        value: 'productivity',
        name: '⚡ Productivity - Workflow and automation templates',
      },
      {
        value: 'education',
        name: '🎓 Education - Learning and tutorial templates',
      },
      { value: 'other', name: '🔍 Other - Browse all categories' },
    ];

    categories.forEach((category, index) => {
      logger.info(`   ${index + 1}. ${category.name}`);
    });

    const selection = await this.prompt('\nEnter category number (1-8): ');
    const selectedIndex = parseInt(selection, 10) - 1;

    if (selectedIndex >= 0 && selectedIndex < categories.length) {
      const selected = categories[selectedIndex];
      logger.info(chalk.green(`\n✓ Selected: ${selected.name}\n`));
      return selected.value === 'other' ? '' : selected.value;
    }

    logger.info(chalk.yellow('Invalid selection, showing all categories...\n'));
    return '';
  }

  private static async discoverTemplates(
    marketplace: MarketplaceService,
    filters: {
      category?: string;
      featured?: boolean;
      limit?: number;
    }
  ): Promise<TemplateModel[]> {
    const searchResult = await marketplace.search({
      category: filters.category as TemplateCategory,
      featured: filters.featured,
      limit: filters.limit || 20,
      sortBy: 'downloads',
      sortOrder: 'desc',
    });

    return searchResult.templates;
  }

  private async selectAndInstallTemplate(
    templates: TemplateModel[],
    marketplace: MarketplaceService,
    registry: TemplateRegistry,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    logger.info(chalk.bold(`📋 Available Templates (${templates.length}):\n`));

    // Show template list with details
    templates.forEach((template, index) => {
      const isInstalled = registry.getTemplate(template.id)
        ? chalk.green('[INSTALLED]')
        : '';
      logger.info(
        `   ${index + 1}. ${chalk.cyan(template.displayName || template.name)} ${isInstalled}`
      );

      if (!options.quickMode) {
        logger.info(`      ${chalk.gray(template.description)}`);
        const ratingValue = (() => {
          if (typeof template.rating === 'number') {
            return template.rating;
          }
          if (
            template.rating &&
            typeof template.rating === 'object' &&
            'average' in template.rating
          ) {
            return template.rating.average;
          }
          return 0;
        })();
        logger.info(
          `      ${InstallWizardCommand.formatRating(ratingValue)} • ${chalk.gray(`${InstallWizardCommand.formatNumber(template.stats?.downloads ?? 0)} downloads`)} • v${template.currentVersion}`
        );
        logger.info('');
      }
    });

    // Template selection
    const selection = await this.prompt(
      `\nSelect template to install (1-${templates.length}), or 'q' to quit: `
    );

    if (selection.toLowerCase() === 'q') {
      logger.info(chalk.gray('Installation cancelled.'));
      return;
    }

    const selectedIndex = parseInt(selection, 10) - 1;
    if (selectedIndex < 0 || selectedIndex >= templates.length) {
      logger.info(chalk.red('Invalid selection.'));
      return;
    }

    const selectedTemplate = templates[selectedIndex];

    // Show detailed template information
    await this.showTemplateDetails(
      selectedTemplate as unknown as MarketplaceTemplate
    );

    // Confirm installation
    const confirmed = await this.confirm(
      `Install ${selectedTemplate.displayName || selectedTemplate.name}?`
    );

    if (!confirmed) {
      logger.info(chalk.gray('Installation cancelled.'));

      // Ask if they want to select another template
      const selectAnother = await this.confirm(
        'Would you like to select another template?'
      );
      if (selectAnother) {
        await this.selectAndInstallTemplate(
          templates,
          marketplace,
          registry,
          options
        );
      }
      return;
    }

    // Perform installation
    try {
      logger.info(chalk.blue('\n🚀 Installing template...\n'));

      const installation = await marketplace.install(selectedTemplate.id);

      logger.info(chalk.green('✅ Installation completed successfully!\n'));
      logger.info(chalk.bold('📦 Template Details:'));
      logger.info(
        `   Name: ${chalk.cyan(selectedTemplate.displayName || selectedTemplate.name)}`
      );
      logger.info(`   Version: ${chalk.yellow(installation.version)}`);
      logger.info(`   Location: ${chalk.gray(installation.installPath)}`);

      logger.info(chalk.bold('\n🚀 Next Steps:'));
      logger.info(
        `   • Generate: ${chalk.green(`cursor-prompt generate ${selectedTemplate.name}`)}`
      );
      logger.info(`   • List templates: ${chalk.green('cursor-prompt list')}`);
      logger.info(
        `   • Get help: ${chalk.green(`cursor-prompt help ${selectedTemplate.name}`)}`
      );
    } catch (error) {
      this.error(
        `Installation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private async showTemplateDetails(
    template: MarketplaceTemplate
  ): Promise<void> {
    logger.info(chalk.bold(`\n📋 Template Details:\n`));
    logger.info(
      `📦 ${chalk.cyan(template.displayName || template.name)} v${template.currentVersion}`
    );
    logger.info(`📝 ${template.description}`);
    logger.info(
      `👤 ${chalk.blue(template.author.name)}${template.author.verified ? ' ✓' : ''}`
    );
    logger.info(
      `⭐ ${InstallWizardCommand.formatRating(typeof template.rating === 'number' ? template.rating : template.rating.average)} (${typeof template.rating === 'number' ? template.reviewCount : template.rating.total} reviews)`
    );
    logger.info(
      `📊 ${chalk.gray(`${InstallWizardCommand.formatNumber(template.stats?.downloads ?? 0)} downloads`)}`
    );
    logger.info(`🏷️  ${chalk.magenta(template.category)}`);

    if (template.tags && template.tags.length > 0) {
      logger.info(
        `🔖 ${template.tags
          .slice(0, 5)
          .map((tag: string) => chalk.gray(`#${tag}`))
          .join(' ')}`
      );
    }

    if (template.featured) {
      logger.info(`${chalk.yellow('⭐ Featured Template')}`);
    }

    if (template.verified) {
      logger.info(`${chalk.green('✓ Verified by Marketplace')}`);
    }
  }

  private static formatRating(rating: number): string {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let stars = '';
    stars += '★'.repeat(fullStars);
    if (hasHalfStar) stars += '☆';
    stars += '☆'.repeat(emptyStars);

    return `${chalk.yellow(stars)} ${chalk.gray(`(${rating.toFixed(1)})`)}`;
  }

  private static formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }
}

export default new InstallWizardCommand();

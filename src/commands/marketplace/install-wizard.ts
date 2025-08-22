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
    await this.execute(args as string, options);
  }

  async execute(_args: string, options: any): Promise<void> {
    try {
      console.log(chalk.bold.blue('\n🧙‍♂️ Template Installation Wizard\n'));
      console.log(
        chalk.gray('Let me help you find and install the perfect template!\n')
      );

      await this.runWizard(options);
    } catch (error) {
      this.error(
        `Installation wizard failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async runWizard(options: any): Promise<void> {
    const marketplace = MarketplaceService.getInstance();
    const registry = new TemplateRegistry();

    // Step 1: Project analysis
    if (!options.quickMode) {
      const projectInfo = await this.analyzeProject();
      if (projectInfo.recommendations.length > 0) {
        console.log(chalk.bold('🔍 Based on your project, I recommend:'));
        projectInfo.recommendations.forEach((rec, i) => {
          console.log(`   ${i + 1}. ${chalk.cyan(rec)}`);
        });
        console.log();

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
    console.log(chalk.bold('🔎 Discovering templates...\n'));
    const templates = await this.discoverTemplates(marketplace, {
      category: selectedCategory,
      featured: options.featuredOnly,
      limit: 20,
    });

    if (templates.length === 0) {
      console.log(chalk.yellow('No templates found matching your criteria.'));
      const browseAll = await this.confirm(
        'Would you like to browse all templates?'
      );
      if (browseAll) {
        const allTemplates = await this.discoverTemplates(marketplace, {
          limit: 50,
        });
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

  private async analyzeProject(): Promise<{
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

  private async showRecommendedTemplates(
    recommendations: string[],
    marketplace: MarketplaceService
  ): Promise<void> {
    console.log(chalk.bold('\n🌟 Recommended Templates:\n'));

    for (const rec of recommendations.slice(0, 5)) {
      try {
        const searchResult = await marketplace.search({
          query: rec,
          limit: 1,
          sortBy: 'downloads',
        });

        if (searchResult.templates.length > 0) {
          const template = searchResult.templates[0];
          console.log(
            `📦 ${chalk.cyan(template.displayName || template.name)}`
          );
          console.log(`   ${template.description}`);
          console.log(
            `   ${this.formatRating(template.rating.average)} • ${chalk.gray(`${this.formatNumber(template.stats.downloads)} downloads`)}`
          );
          console.log();
        }
      } catch (error) {
        // Skip if template not found
      }
    }
  }

  private async selectCategory(): Promise<string> {
    console.log(chalk.bold('📂 Select a category:\n'));

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

    for (const [index, category] of categories.entries()) {
      console.log(`   ${index + 1}. ${category.name}`);
    }

    const selection = await this.prompt('\nEnter category number (1-8): ');
    const selectedIndex = parseInt(selection, 10) - 1;

    if (selectedIndex >= 0 && selectedIndex < categories.length) {
      const selected = categories[selectedIndex];
      console.log(chalk.green(`\n✓ Selected: ${selected.name}\n`));
      return selected.value === 'other' ? '' : selected.value;
    }

    console.log(chalk.yellow('Invalid selection, showing all categories...\n'));
    return '';
  }

  private async discoverTemplates(
    marketplace: MarketplaceService,
    filters: {
      category?: string;
      featured?: boolean;
      limit?: number;
    }
  ): Promise<any[]> {
    const searchResult = await marketplace.search({
      category: filters.category as any,
      featured: filters.featured,
      limit: filters.limit || 20,
      sortBy: 'downloads',
      sortOrder: 'desc',
    });

    return searchResult.templates;
  }

  private async selectAndInstallTemplate(
    templates: any[],
    marketplace: MarketplaceService,
    registry: TemplateRegistry,
    options: any
  ): Promise<void> {
    console.log(chalk.bold(`📋 Available Templates (${templates.length}):\n`));

    // Show template list with details
    templates.forEach((template, index) => {
      const isInstalled = registry.getTemplate(template.id)
        ? chalk.green('[INSTALLED]')
        : '';
      console.log(
        `   ${index + 1}. ${chalk.cyan(template.displayName || template.name)} ${isInstalled}`
      );

      if (!options.quickMode) {
        console.log(`      ${chalk.gray(template.description)}`);
        console.log(
          `      ${this.formatRating(template.rating.average)} • ${chalk.gray(`${this.formatNumber(template.stats.downloads)} downloads`)} • v${template.currentVersion}`
        );
        console.log();
      }
    });

    // Template selection
    const selection = await this.prompt(
      `\nSelect template to install (1-${templates.length}), or 'q' to quit: `
    );

    if (selection.toLowerCase() === 'q') {
      console.log(chalk.gray('Installation cancelled.'));
      return;
    }

    const selectedIndex = parseInt(selection, 10) - 1;
    if (selectedIndex < 0 || selectedIndex >= templates.length) {
      console.log(chalk.red('Invalid selection.'));
      return;
    }

    const selectedTemplate = templates[selectedIndex];

    // Show detailed template information
    await this.showTemplateDetails(selectedTemplate);

    // Confirm installation
    const confirmed = await this.confirm(
      `Install ${selectedTemplate.displayName || selectedTemplate.name}?`
    );

    if (!confirmed) {
      console.log(chalk.gray('Installation cancelled.'));

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
      console.log(chalk.blue('\n🚀 Installing template...\n'));

      const installation = await marketplace.install(selectedTemplate.id);

      console.log(chalk.green('✅ Installation completed successfully!\n'));
      console.log(chalk.bold('📦 Template Details:'));
      console.log(
        `   Name: ${chalk.cyan(selectedTemplate.displayName || selectedTemplate.name)}`
      );
      console.log(`   Version: ${chalk.yellow(installation.version)}`);
      console.log(`   Location: ${chalk.gray(installation.installPath)}`);

      console.log(chalk.bold('\n🚀 Next Steps:'));
      console.log(
        `   • Generate: ${chalk.green(`cursor-prompt generate ${selectedTemplate.name}`)}`
      );
      console.log(`   • List templates: ${chalk.green('cursor-prompt list')}`);
      console.log(
        `   • Get help: ${chalk.green(`cursor-prompt help ${selectedTemplate.name}`)}`
      );
    } catch (error) {
      this.error(
        `Installation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showTemplateDetails(template: any): Promise<void> {
    console.log(chalk.bold(`\n📋 Template Details:\n`));
    console.log(
      `📦 ${chalk.cyan(template.displayName || template.name)} v${template.currentVersion}`
    );
    console.log(`📝 ${template.description}`);
    console.log(
      `👤 ${chalk.blue(template.author.name)}${template.author.verified ? ' ✓' : ''}`
    );
    console.log(
      `⭐ ${this.formatRating(template.rating.average)} (${template.rating.total} reviews)`
    );
    console.log(
      `📊 ${chalk.gray(`${this.formatNumber(template.stats.downloads)} downloads`)}`
    );
    console.log(`🏷️  ${chalk.magenta(template.category)}`);

    if (template.tags && template.tags.length > 0) {
      console.log(
        `🔖 ${template.tags
          .slice(0, 5)
          .map((tag: string) => chalk.gray(`#${tag}`))
          .join(' ')}`
      );
    }

    if (template.featured) {
      console.log(`${chalk.yellow('⭐ Featured Template')}`);
    }

    if (template.verified) {
      console.log(`${chalk.green('✓ Verified by Marketplace')}`);
    }
  }

  private formatRating(rating: number): string {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let stars = '';
    stars += '★'.repeat(fullStars);
    if (hasHalfStar) stars += '☆';
    stars += '☆'.repeat(emptyStars);

    return `${chalk.yellow(stars)} ${chalk.gray(`(${rating.toFixed(1)})`)}`;
  }

  private formatNumber(num: number): string {
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

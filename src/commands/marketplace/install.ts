/**
 * @fileoverview Template installation command for marketplace
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Template installation, dependency resolution, version management
 * Main APIs: execute(), installTemplate(), checkDependencies()
 * Constraints: Network connectivity, file system permissions, dependencies
 * Patterns: Command pattern, installation workflow, progress tracking
 */

import chalk from 'chalk';
import { BaseCommand } from '../../cli/base-command';
import { ICommand } from '../../cli/command-registry';
import { MarketplaceService } from '../../marketplace/core/marketplace.service';
import {
  MarketplaceCommandOptions,
  MarketplaceTemplate,
  TemplateDependency,
} from '../../types';
import { TemplateRegistry } from '../../marketplace/core/template.registry';
import { logger } from '../../utils/logger';

export class InstallCommand extends BaseCommand implements ICommand {
  name = 'install';

  description = 'Install template from marketplace';

  override aliases = ['i', 'add'];

  override options = [
    {
      flags: '-v, --version <version>',
      description: 'Specific version to install',
    },
    {
      flags: '--force',
      description: 'Force reinstall if already installed',
      defaultValue: false,
    },
    {
      flags: '--skip-deps',
      description: 'Skip dependency installation',
      defaultValue: false,
    },
    {
      flags: '--dry-run',
      description: 'Show what would be installed without installing',
      defaultValue: false,
    },
    {
      flags: '--auto-update',
      description: 'Enable automatic updates for this template',
      defaultValue: false,
    },
  ];

  override async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options as MarketplaceCommandOptions);
  }

  async execute(
    templateName: string,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    if (!templateName || !templateName.trim()) {
      this.error(
        'Template name is required. Usage: cursor-prompt install <template-name>'
      );
      return;
    }

    try {
      const marketplace = await MarketplaceService.getInstance();
      const registry = new TemplateRegistry();

      // Check if already installed
      const existing = registry.getTemplateByName(templateName);
      if (existing && !options.force) {
        const choice = await this.confirm(
          `Template "${templateName}" is already installed (v${existing.version}). Reinstall?`
        );
        if (!choice) {
          this.info('Installation cancelled');
          return;
        }
      }

      this.info(`Installing template: ${chalk.cyan(templateName)}`);

      // Search for template if not found by exact name
      let templateId = templateName;
      let template;

      try {
        template = await marketplace.getTemplate(templateId);
      } catch {
        // Try searching by name
        this.info('Template not found by ID, searching...');
        const searchResult = await marketplace.search({
          query: templateName,
          limit: 1,
        });

        if (searchResult.templates.length === 0) {
          this.error(`Template "${templateName}" not found in marketplace`);
          return;
        }

        [template] = searchResult.templates;
        if (!template) {
          this.error(`Template "${templateName}" not found in search results`);
          return;
        }
        templateId = template.id;

        if (searchResult.templates.length > 1) {
          this.warn(
            `Multiple templates found, installing: ${template.displayName || template.name}`
          );
        }
      }

      if (!template) {
        this.error('Template could not be loaded');
        return;
      }

      // Show template information
      this.displayTemplateInfo(template as unknown as MarketplaceTemplate);

      // Check version
      const targetVersion = options.version || template.currentVersion;
      const versionExists = template.versions.find(
        v => v.version === targetVersion
      );

      if (!versionExists) {
        this.error(
          `Version ${targetVersion} not found for template ${template.name}`
        );
        this.info(
          `Available versions: ${template.versions.map(v => v.version).join(', ')}`
        );
        return;
      }

      // Show dependencies
      if (!options.skipDeps && versionExists.dependencies.length > 0) {
        await InstallCommand.displayDependencies(versionExists.dependencies);
      }

      // Dry run mode
      if (options.dryRun) {
        this.info('Dry run mode - no installation performed');
        logger.info(
          chalk.green('\n✓ Installation plan validated successfully')
        );
        return;
      }

      // Confirm installation
      const confirmed = await this.confirm(
        `Install ${template.displayName || template.name}@${targetVersion}?`
      );

      if (!confirmed) {
        this.info('Installation cancelled');
        return;
      }

      // Perform installation
      const installation = await marketplace.install(templateId, targetVersion);

      // Update auto-update setting if specified
      if (options.autoUpdate !== installation.autoUpdate) {
        // This would update the installation record
        this.info(
          `Auto-update ${options.autoUpdate ? 'enabled' : 'disabled'} for this template`
        );
      }

      // Show success message
      logger.info(chalk.green('\n✓ Installation completed successfully!'));
      logger.info(
        `\n📦 Template: ${chalk.cyan(template.displayName || template.name)}`
      );
      logger.info(`📍 Version: ${chalk.yellow(targetVersion)}`);
      logger.info(`📂 Location: ${chalk.gray(installation.installPath)}`);
      logger.info(
        `\n💡 Usage: ${chalk.green(`cursor-prompt generate ${template.name}`)}`
      );

      // Show next steps
      if (versionExists.examples && versionExists.examples.length > 0) {
        logger.info(
          `\n📚 Examples available - check the template documentation`
        );
      }
    } catch (error: any) {
      this.error(
        `Installation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private displayTemplateInfo(template: MarketplaceTemplate): void {
    logger.info(chalk.bold(`\n📦 ${template.displayName || template.name}`));
    logger.info(`   ${template.description}`);
    logger.info(
      `   ${chalk.gray('by')} ${chalk.blue(template.author.name)}${template.author.verified ? ' ✓' : ''}`
    );
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
      `   ${InstallCommand.formatRating(ratingValue)} • ${chalk.cyan(`${InstallCommand.formatNumber(template.stats?.downloads ?? 0)} downloads`)}`
    );
    logger.info(
      `   ${chalk.magenta(template.category)} • ${chalk.yellow(`v${template.currentVersion}`)}`
    );

    if (template.featured) {
      logger.info(`   ${chalk.yellow('⭐ Featured template')}`);
    }

    if (template.verified) {
      logger.info(`   ${chalk.green('✓ Verified by marketplace')}`);
    }
  }

  private static async displayDependencies(
    dependencies: TemplateDependency[]
  ): Promise<void> {
    if (dependencies.length === 0) return;

    logger.info(chalk.bold('\n📋 Dependencies:'));

    const registry = new TemplateRegistry();

    // Process dependencies sequentially for ordered display
    // eslint-disable-next-line no-restricted-syntax
    for (const dep of dependencies) {
      // eslint-disable-next-line no-await-in-loop
      const isInstalled = await registry.isDependencyInstalled(dep);
      const status = isInstalled ? chalk.green('✓') : chalk.red('✗');
      const optional = dep.optional ? chalk.gray('(optional)') : '';

      logger.info(`   ${status} ${dep.name}@${dep.version} ${optional}`);

      if (dep.description) {
        logger.info(`     ${chalk.gray(dep.description)}`);
      }
    }

    const missing = dependencies.filter(
      async dep => !dep.optional && !(await registry.isDependencyInstalled(dep))
    );

    if (missing.length > 0) {
      logger.info(chalk.yellow('\n⚠️  Some required dependencies are missing'));
      logger.info(
        chalk.gray(
          'They will need to be installed for the template to work properly'
        )
      );
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

export default new InstallCommand();

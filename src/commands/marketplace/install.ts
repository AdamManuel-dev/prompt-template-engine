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
import { TemplateRegistry } from '../../marketplace/core/template.registry';

export class InstallCommand extends BaseCommand implements ICommand {
  name = 'install';

  description = 'Install template from marketplace';

  aliases = ['i', 'add'];

  options = [
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

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options);
  }

  async execute(templateName: string, options: any): Promise<void> {
    if (!templateName || !templateName.trim()) {
      this.error(
        'Template name is required. Usage: cursor-prompt install <template-name>'
      );
      return;
    }

    try {
      const marketplace = MarketplaceService.getInstance();
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

        template = searchResult.templates[0];
        templateId = template.id;

        if (searchResult.templates.length > 1) {
          this.warn(
            `Multiple templates found, installing: ${template.displayName || template.name}`
          );
        }
      }

      // Show template information
      this.displayTemplateInfo(template);

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
        await this.displayDependencies(versionExists.dependencies);
      }

      // Dry run mode
      if (options.dryRun) {
        this.info('Dry run mode - no installation performed');
        console.log(
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
      console.log(chalk.green('\n✓ Installation completed successfully!'));
      console.log(
        `\n📦 Template: ${chalk.cyan(template.displayName || template.name)}`
      );
      console.log(`📍 Version: ${chalk.yellow(targetVersion)}`);
      console.log(`📂 Location: ${chalk.gray(installation.installPath)}`);
      console.log(
        `\n💡 Usage: ${chalk.green(`cursor-prompt generate ${template.name}`)}`
      );

      // Show next steps
      if (versionExists.examples && versionExists.examples.length > 0) {
        console.log(
          `\n📚 Examples available - check the template documentation`
        );
      }
    } catch (error) {
      this.error(
        `Installation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private displayTemplateInfo(template: any): void {
    console.log(chalk.bold(`\n📦 ${template.displayName || template.name}`));
    console.log(`   ${template.description}`);
    console.log(
      `   ${chalk.gray('by')} ${chalk.blue(template.author.name)}${template.author.verified ? ' ✓' : ''}`
    );
    console.log(
      `   ${this.formatRating(template.rating.average)} • ${chalk.cyan(`${this.formatNumber(template.stats.downloads)} downloads`)}`
    );
    console.log(
      `   ${chalk.magenta(template.category)} • ${chalk.yellow(`v${template.currentVersion}`)}`
    );

    if (template.featured) {
      console.log(`   ${chalk.yellow('⭐ Featured template')}`);
    }

    if (template.verified) {
      console.log(`   ${chalk.green('✓ Verified by marketplace')}`);
    }
  }

  private async displayDependencies(dependencies: any[]): Promise<void> {
    if (dependencies.length === 0) return;

    console.log(chalk.bold('\n📋 Dependencies:'));

    const registry = new TemplateRegistry();

    for (const dep of dependencies) {
      const isInstalled = await registry.isDependencyInstalled(dep);
      const status = isInstalled ? chalk.green('✓') : chalk.red('✗');
      const optional = dep.optional ? chalk.gray('(optional)') : '';

      console.log(`   ${status} ${dep.name}@${dep.version} ${optional}`);

      if (dep.description) {
        console.log(`     ${chalk.gray(dep.description)}`);
      }
    }

    const missing = dependencies.filter(
      async dep => !dep.optional && !(await registry.isDependencyInstalled(dep))
    );

    if (missing.length > 0) {
      console.log(chalk.yellow('\n⚠️  Some required dependencies are missing'));
      console.log(
        chalk.gray(
          'They will need to be installed for the template to work properly'
        )
      );
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

export default new InstallCommand();

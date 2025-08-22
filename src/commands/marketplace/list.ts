/**
 * @fileoverview List installed templates command
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: List installed templates, show details, update status
 * Main APIs: execute(), displayTemplate(), checkUpdates()
 * Constraints: Local registry access, marketplace connectivity for updates
 * Patterns: Command pattern, template listing, status display
 */

import chalk from 'chalk';
import { BaseCommand } from '../../cli/base-command';
import { ICommand } from '../../cli/command-registry';
import { MarketplaceService } from '../../marketplace/core/marketplace.service';
import { TemplateRegistry } from '../../marketplace/core/template.registry';

export class ListCommand extends BaseCommand implements ICommand {
  name = 'list';

  description = 'List installed templates';

  aliases = ['ls', 'installed'];

  options = [
    {
      flags: '--detailed',
      description: 'Show detailed template information',
      defaultValue: false,
    },
    {
      flags: '--check-updates',
      description: 'Check for available updates',
      defaultValue: false,
    },
    {
      flags: '--category <category>',
      description: 'Filter by category',
    },
    {
      flags: '--author <author>',
      description: 'Filter by author',
    },
    {
      flags: '--outdated',
      description: 'Show only templates with available updates',
      defaultValue: false,
    },
    {
      flags: '--stats',
      description: 'Show installation statistics',
      defaultValue: false,
    },
  ];

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options);
  }

  async execute(_args: string, options: any): Promise<void> {
    try {
      const registry = new TemplateRegistry();
      const marketplace = MarketplaceService.getInstance();

      let templates = registry.listTemplates();

      if (templates.length === 0) {
        this.warn('No templates installed');
        console.log(
          `\n💡 Install templates with: ${chalk.green('cursor-prompt install <template-name>')}`
        );
        console.log(
          `💡 Search templates with: ${chalk.green('cursor-prompt search <query>')}`
        );
        return;
      }

      // Apply filters
      if (options.category) {
        templates = templates.filter(
          t => t.metadata.category === options.category
        );
      }

      if (options.author) {
        templates = templates.filter(t =>
          t.metadata.author.name
            .toLowerCase()
            .includes(options.author.toLowerCase())
        );
      }

      // Check for updates if requested
      let updateInfo: Map<string, string> = new Map();
      if (options.checkUpdates || options.outdated) {
        this.info('Checking for updates...');
        try {
          const updates = await marketplace.checkUpdates();
          updateInfo = new Map(
            updates.map(u => [u.templateId, u.latestVersion])
          );
        } catch (error) {
          this.warn(
            `Failed to check updates: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Filter outdated if requested
      if (options.outdated) {
        templates = templates.filter(t => updateInfo.has(t.id));

        if (templates.length === 0) {
          this.success('All templates are up to date!');
          return;
        }
      }

      // Show statistics if requested
      if (options.stats) {
        this.displayStats(registry.getStats());
      }

      // Display templates
      console.log(
        chalk.bold(`\n📦 Installed Templates (${templates.length}):\n`)
      );

      templates.forEach((template, index) => {
        if (options.detailed) {
          this.displayDetailedTemplate(template, index + 1, updateInfo);
        } else {
          this.displayCompactTemplate(template, index + 1, updateInfo);
        }
      });

      // Show update summary
      if (updateInfo.size > 0) {
        const availableUpdates = templates.filter(t => updateInfo.has(t.id));
        if (availableUpdates.length > 0) {
          console.log(
            chalk.yellow(
              `\n🔄 ${availableUpdates.length} template(s) have updates available`
            )
          );
          console.log(
            `💡 Update all: ${chalk.green('cursor-prompt update --all')}`
          );
        }
      }
    } catch (error) {
      this.error(
        `Failed to list templates: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private displayCompactTemplate(
    template: any,
    position: number,
    updateInfo: Map<string, string>
  ): void {
    const hasUpdate = updateInfo.has(template.id);
    const updateText = hasUpdate
      ? chalk.yellow(` → ${updateInfo.get(template.id)}`)
      : '';

    const badges = this.formatBadges(template);
    const ratingStars = this.formatRating(template.metadata.rating.average);

    console.log(
      `${position}. ${chalk.bold(template.metadata.displayName || template.name)} ${badges}`
    );
    console.log(`   ${chalk.gray(template.metadata.description)}`);
    console.log(
      `   ${chalk.yellow(`v${template.version}`)}${updateText} ${chalk.gray('•')} ${chalk.magenta(template.metadata.category)} ${chalk.gray('•')} ${ratingStars}`
    );
    console.log(
      `   ${chalk.gray('by')} ${chalk.blue(template.metadata.author.name)} ${chalk.gray('•')} ${chalk.gray('installed')} ${chalk.gray(new Date(template.registered).toLocaleDateString())}`
    );
    console.log();
  }

  private displayDetailedTemplate(
    template: any,
    position: number,
    updateInfo: Map<string, string>
  ): void {
    const hasUpdate = updateInfo.has(template.id);
    const updateText = hasUpdate
      ? chalk.yellow(` (update available: ${updateInfo.get(template.id)})`)
      : chalk.green(' (up to date)');

    const badges = this.formatBadges(template);

    console.log(
      `${position}. ${chalk.bold.underline(template.metadata.displayName || template.name)} ${badges}`
    );
    console.log(`   ID: ${chalk.gray(template.id)}`);
    console.log(`   ${template.metadata.description}`);
    console.log(`   Version: ${chalk.yellow(template.version)}${updateText}`);
    console.log(`   Category: ${chalk.magenta(template.metadata.category)}`);
    console.log(
      `   Author: ${chalk.blue(template.metadata.author.name)}${template.metadata.author.verified ? ' ✓' : ''}`
    );
    console.log(
      `   Rating: ${this.formatRating(template.metadata.rating.average)} (${template.metadata.rating.total} reviews)`
    );
    console.log(
      `   Downloads: ${chalk.cyan(this.formatNumber(template.metadata.stats.downloads))}`
    );
    console.log(
      `   Installed: ${chalk.gray(new Date(template.registered).toLocaleDateString())}`
    );
    console.log(`   Location: ${chalk.gray(template.path)}`);

    if (template.metadata.tags.length > 0) {
      console.log(
        `   Tags: ${template.metadata.tags.map((tag: string) => chalk.gray(`#${tag}`)).join(' ')}`
      );
    }

    // Show dependencies
    if (template.versionInfo.dependencies.length > 0) {
      console.log(
        `   Dependencies: ${template.versionInfo.dependencies.length} required`
      );
    }

    // Show auto-update status
    const installation = MarketplaceService.getInstance().getInstallation(
      template.id
    );
    if (installation) {
      const autoUpdateStatus = installation.autoUpdate
        ? chalk.green('enabled')
        : chalk.gray('disabled');
      console.log(`   Auto-update: ${autoUpdateStatus}`);
    }

    console.log(
      `   Commands: ${chalk.green(`cursor-prompt generate ${template.name}`)}`
    );

    if (hasUpdate) {
      console.log(
        `   Update: ${chalk.green(`cursor-prompt update ${template.name}`)}`
      );
    }

    console.log();
  }

  private displayStats(stats: any): void {
    console.log(chalk.bold('\n📊 Installation Statistics:\n'));
    console.log(`   Total templates: ${chalk.cyan(stats.total)}`);
    console.log(`   Active templates: ${chalk.green(stats.active)}`);

    if (Object.keys(stats.categories).length > 0) {
      console.log('\n   Categories:');
      Object.entries(stats.categories).forEach(([category, count]) => {
        console.log(`     ${chalk.magenta(category)}: ${count}`);
      });
    }

    if (Object.keys(stats.authors).length > 0) {
      console.log('\n   Top Authors:');
      Object.entries(stats.authors)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .forEach(([author, count]) => {
          console.log(
            `     ${chalk.blue(author)}: ${count} template${(count as number) > 1 ? 's' : ''}`
          );
        });
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

  private formatBadges(template: any): string {
    const badges: string[] = [];

    if (template.metadata.featured) {
      badges.push(chalk.yellow('⭐'));
    }

    if (template.metadata.verified) {
      badges.push(chalk.green('✓'));
    }

    if (template.metadata.stats.trending) {
      badges.push(chalk.red('🔥'));
    }

    if (template.metadata.deprecated) {
      badges.push(chalk.red('⚠️'));
    }

    return badges.join(' ');
  }
}

export default new ListCommand();

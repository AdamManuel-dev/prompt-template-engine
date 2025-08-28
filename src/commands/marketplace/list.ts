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
import {
  TemplateRegistry,
  RegisteredTemplate,
} from '../../marketplace/core/template.registry';
import { MarketplaceCommandOptions, MarketplaceTemplate } from '../../types';
import { TemplateModel } from '../../marketplace/models/template.model';
import { logger } from '../../utils/logger';

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
    await this.execute(args as string, options as MarketplaceCommandOptions);
  }

  async execute(
    _args: string,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const registry = new TemplateRegistry();
      const marketplace = await MarketplaceService.getInstance();

      let templates = registry.listTemplates();

      if (templates.length === 0) {
        this.warn('No templates installed');
        logger.info(
          `\n💡 Install templates with: ${chalk.green('cursor-prompt install <template-name>')}`
        );
        logger.info(
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
        templates = templates.filter(t => {
          const authorName =
            typeof t.metadata.author === 'string'
              ? t.metadata.author
              : t.metadata.author?.name;
          return authorName
            ?.toLowerCase()
            .includes(options.author!.toLowerCase());
        });
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
        ListCommand.displayStats(registry.getStats());
      }

      // Display templates
      logger.info(
        chalk.bold(`\n📦 Installed Templates (${templates.length}):\n`)
      );

      // Process templates sequentially to handle async operations properly
      // eslint-disable-next-line no-restricted-syntax
      for (const [index, template] of templates.entries()) {
        // Convert RegisteredTemplate to MarketplaceTemplate format for display
        const marketplaceTemplate = this.convertToMarketplaceTemplate(template);
        if (options.detailed) {
          // eslint-disable-next-line no-await-in-loop
          await this.displayDetailedTemplate(
            marketplaceTemplate,
            index + 1,
            updateInfo
          );
        } else {
          this.displayCompactTemplate(
            marketplaceTemplate,
            index + 1,
            updateInfo
          );
        }
      }

      // Show update summary
      if (updateInfo.size > 0) {
        const availableUpdates = templates.filter(t => updateInfo.has(t.id));
        if (availableUpdates.length > 0) {
          logger.info(
            chalk.yellow(
              `\n🔄 ${availableUpdates.length} template(s) have updates available`
            )
          );
          logger.info(
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

  // eslint-disable-next-line class-methods-use-this
  private convertToMarketplaceTemplate(
    registered: RegisteredTemplate
  ): MarketplaceTemplate {
    const authorInfo =
      typeof registered.metadata.author === 'string'
        ? registered.metadata.author
        : registered.metadata.author?.name || 'Unknown Author';

    return {
      id: registered.id,
      name: registered.name,
      description: registered.metadata.description || '',
      category: registered.metadata.category || 'general',
      tags: registered.metadata.tags || [],
      author: {
        id:
          typeof registered.metadata.author === 'string'
            ? registered.metadata.author
            : registered.metadata.author?.id || 'unknown',
        name: authorInfo,
        verified:
          typeof registered.metadata.author === 'object'
            ? registered.metadata.author?.verified || false
            : false,
      },
      currentVersion: registered.version,
      versions: [],
      downloads: 0,
      rating: 0,
      reviewCount: 0,
      createdAt: registered.registered.toISOString(),
      updatedAt: registered.registered.toISOString(),
      displayName: registered.metadata.displayName || registered.name,
      registered: registered.registered.toISOString(),
      path: registered.path,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  private displayCompactTemplate(
    template: MarketplaceTemplate,
    position: number,
    updateInfo: Map<string, string>
  ): void {
    const hasUpdate = updateInfo.has(template.id);
    const updateText = hasUpdate
      ? chalk.yellow(` → ${updateInfo.get(template.id)}`)
      : '';

    const badges = ListCommand.formatBadges(template);
    const rating =
      typeof template.rating === 'number'
        ? template.rating
        : template.rating.average;
    const ratingStars = ListCommand.formatRating(rating);

    logger.info(
      `${position}. ${chalk.bold(template.displayName || template.name)} ${badges}`
    );
    logger.info(`   ${chalk.gray(template.description)}`);
    logger.info(
      `   ${chalk.yellow(`v${template.currentVersion}`)}${updateText} ${chalk.gray('•')} ${chalk.magenta(template.category)} ${chalk.gray('•')} ${ratingStars}`
    );
    logger.info(
      `   ${chalk.gray('by')} ${chalk.blue(template.author.name)} ${chalk.gray('•')} ${chalk.gray('installed')} ${chalk.gray(new Date(template.registered || template.createdAt).toLocaleDateString())}`
    );
    logger.info('');
  }

  // eslint-disable-next-line class-methods-use-this
  private async displayDetailedTemplate(
    template: MarketplaceTemplate,
    position: number,
    updateInfo: Map<string, string>
  ): Promise<void> {
    const hasUpdate = updateInfo.has(template.id);
    const updateText = hasUpdate
      ? chalk.yellow(` (update available: ${updateInfo.get(template.id)})`)
      : chalk.green(' (up to date)');

    const badges = ListCommand.formatBadges(template);

    logger.info(
      `${position}. ${chalk.bold.underline(template.displayName || template.name)} ${badges}`
    );
    logger.info(`   ID: ${chalk.gray(template.id)}`);
    logger.info(`   ${template.description}`);
    logger.info(
      `   Version: ${chalk.yellow(template.currentVersion)}${updateText}`
    );
    logger.info(`   Category: ${chalk.magenta(template.category)}`);
    logger.info(
      `   Author: ${chalk.blue(template.author.name)}${template.author.verified ? ' ✓' : ''}`
    );
    const ratingValue =
      typeof template.rating === 'number'
        ? template.rating
        : template.rating.average;
    const totalReviews =
      typeof template.rating === 'number'
        ? template.reviewCount
        : template.rating.total;
    logger.info(
      `   Rating: ${ListCommand.formatRating(ratingValue)} (${totalReviews} reviews)`
    );
    logger.info(
      `   Downloads: ${chalk.cyan(ListCommand.formatNumber(template.stats?.downloads || 0))}`
    );
    logger.info(
      `   Installed: ${chalk.gray(new Date(template.registered || template.createdAt).toLocaleDateString())}`
    );
    logger.info(`   Location: ${chalk.gray(template.path)}`);

    if (template.tags && template.tags.length > 0) {
      logger.info(
        `   Tags: ${template.tags.map((tag: string) => chalk.gray(`#${tag}`)).join(' ')}`
      );
    }

    // Show dependencies
    if (
      template.versionInfo?.dependencies &&
      template.versionInfo.dependencies.length > 0
    ) {
      logger.info(
        `   Dependencies: ${template.versionInfo.dependencies.length} required`
      );
    }

    // Show auto-update status
    const marketplace = await MarketplaceService.getInstance();
    const installation = marketplace.getInstallation(template.id);
    if (installation) {
      const autoUpdateStatus = installation.autoUpdate
        ? chalk.green('enabled')
        : chalk.gray('disabled');
      logger.info(`   Auto-update: ${autoUpdateStatus}`);
    }

    logger.info(
      `   Commands: ${chalk.green(`cursor-prompt generate ${template.name}`)}`
    );

    if (hasUpdate) {
      logger.info(
        `   Update: ${chalk.green(`cursor-prompt update ${template.name}`)}`
      );
    }

    logger.info('');
  }

  private static displayStats(stats: Record<string, unknown>): void {
    logger.info(chalk.bold('\n📊 Installation Statistics:\n'));
    logger.info(`   Total templates: ${chalk.cyan(stats.total)}`);
    logger.info(`   Active templates: ${chalk.green(stats.active)}`);

    const categories = stats.categories as Record<string, number> | undefined;
    if (categories && Object.keys(categories).length > 0) {
      logger.info('\n   Categories:');
      Object.entries(categories).forEach(([category, count]) => {
        logger.info(`     ${chalk.magenta(category)}: ${count}`);
      });
    }

    const authors = stats.authors as Record<string, number> | undefined;
    if (authors && Object.keys(authors).length > 0) {
      logger.info('\n   Top Authors:');
      Object.entries(authors)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .forEach(([author, count]) => {
          logger.info(
            `     ${chalk.blue(author)}: ${count} template${(count as number) > 1 ? 's' : ''}`
          );
        });
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

  private static formatBadges(
    template: MarketplaceTemplate | TemplateModel
  ): string {
    const badges: string[] = [];

    if (template.featured) {
      badges.push(chalk.yellow('⭐'));
    }

    if (template.verified) {
      badges.push(chalk.green('✓'));
    }

    if (
      template.stats &&
      ('trending' in template.stats ? template.stats.trending : false)
    ) {
      badges.push(chalk.red('🔥'));
    }

    if (template.deprecated) {
      badges.push(chalk.red('⚠️'));
    }

    return badges.join(' ');
  }
}

export default new ListCommand();

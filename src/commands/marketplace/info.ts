/**
 * @fileoverview Template information command for detailed view
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Detailed template information, version history, dependencies
 * Main APIs: execute(), displayTemplateInfo(), showVersionHistory()
 * Constraints: Network connectivity for marketplace data
 * Patterns: Command pattern, information display, data formatting
 */

import chalk from 'chalk';
import { BaseCommand } from '../../cli/base-command';
import { ICommand } from '../../cli/command-registry';
import { MarketplaceService } from '../../marketplace/core/marketplace.service';
import { TemplateRegistry } from '../../marketplace/core/template.registry';
import { MarketplaceCommandOptions } from '../../types';
import { TemplateModel } from '../../marketplace/models/template.model';
import { logger } from '../../utils/logger';

export class InfoCommand extends BaseCommand implements ICommand {
  name = 'info';

  description = 'Show detailed template information';

  aliases = ['show', 'details'];

  options = [
    {
      flags: '--versions',
      description: 'Show version history',
      defaultValue: false,
    },
    {
      flags: '--dependencies',
      description: 'Show template dependencies',
      defaultValue: false,
    },
    {
      flags: '--examples',
      description: 'Show usage examples',
      defaultValue: false,
    },
    {
      flags: '--reviews',
      description: 'Show recent reviews',
      defaultValue: false,
    },
    {
      flags: '--stats',
      description: 'Show detailed statistics',
      defaultValue: false,
    },
    {
      flags: '--all',
      description: 'Show all information',
      defaultValue: false,
    },
  ];

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options as MarketplaceCommandOptions);
  }

  async execute(
    templateName: string,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    if (!templateName || !templateName.trim()) {
      this.error(
        'Template name is required. Usage: cursor-prompt info <template-name>'
      );
      return;
    }

    try {
      const marketplace = await MarketplaceService.getInstance();
      const registry = new TemplateRegistry();

      // Try to find template locally first
      let template: TemplateModel;
      let isInstalled = false;

      const installedTemplate = registry.getTemplateByName(templateName);
      if (installedTemplate) {
        template = installedTemplate.metadata;
        isInstalled = true;
      } else {
        // Search marketplace
        this.info('Searching marketplace...');
        const searchResult = await marketplace.search({
          query: templateName,
          limit: 1,
        });

        if (searchResult.templates.length === 0) {
          this.error(`Template "${templateName}" not found`);
          return;
        }

        [template] = searchResult.templates;
      }

      // Display template information
      this.displayBasicInfo(template, isInstalled);

      if (options.all || options.versions) {
        InfoCommand.displayVersionHistory(template);
      }

      if (options.all || options.dependencies) {
        InfoCommand.displayDependencies(template);
      }

      if (options.all || options.examples) {
        InfoCommand.displayExamples(template);
      }

      if (options.all || options.showReviews) {
        await InfoCommand.displayRecentReviews(template);
      }

      if (options.all || options.stats) {
        InfoCommand.displayDetailedStats(template);
      }

      // Show installation/usage instructions
      InfoCommand.displayUsageInstructions(template, isInstalled);
    } catch (error) {
      this.error(
        `Failed to get template info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private displayBasicInfo(
    template: TemplateModel,
    isInstalled: boolean
  ): void {
    const badges = InfoCommand.formatBadges(template);
    const installStatus = isInstalled
      ? chalk.green('✓ Installed')
      : chalk.gray('Not installed');

    logger.info(
      chalk.bold.underline(`\n📦 ${template.displayName || template.name}`)
    );
    logger.info(`${badges} ${installStatus}\n`);

    logger.info(`${template.description}`);

    if (template.longDescription) {
      logger.info(`\n${chalk.gray(template.longDescription)}`);
    }

    // Basic metadata
    logger.info(chalk.bold('\n📋 Details:'));
    logger.info(`   ID: ${chalk.gray(template.id)}`);
    logger.info(`   Category: ${chalk.magenta(template.category)}`);
    logger.info(`   Current Version: ${chalk.yellow(template.currentVersion)}`);
    logger.info(
      `   Author: ${chalk.blue(typeof template.author === 'string' ? template.author : ((template.author as any)?.name ?? 'Unknown'))}${(template.author as any)?.verified ? ' ✓' : ''}`
    );
    logger.info(`   License: ${chalk.gray(template.metadata.license)}`);
    logger.info(
      `   Created: ${chalk.gray(new Date(template.created).toLocaleDateString())}`
    );
    logger.info(
      `   Updated: ${chalk.gray(new Date(template.updated).toLocaleDateString())}`
    );

    // Rating and stats
    logger.info(chalk.bold('\n⭐ Rating & Stats:'));
    logger.info(
      `   Rating: ${InfoCommand.formatRating(typeof template.rating === 'number' ? template.rating : ((template.rating as any)?.average ?? 0))} (${(template.rating as any)?.total ?? 0} reviews)`
    );
    logger.info(
      `   Downloads: ${chalk.cyan(InfoCommand.formatNumber(template.stats?.downloads || 0))}`
    );
    logger.info(
      `   Weekly: ${chalk.cyan(InfoCommand.formatNumber(template.stats?.weeklyDownloads || 0))}`
    );
    logger.info(
      `   Monthly: ${chalk.cyan(InfoCommand.formatNumber(template.stats?.monthlyDownloads || 0))}`
    );

    if (template.stats?.trending) {
      logger.info(`   ${chalk.red('🔥 Trending')}`);
    }

    // Tags
    if (template.tags && template.tags.length > 0) {
      logger.info(chalk.bold('\n🏷️  Tags:'));
      logger.info(
        `   ${template.tags.map(tag => chalk.gray(`#${tag}`)).join(' ')}`
      );
    }

    // Repository
    if (template.metadata.repository) {
      logger.info(chalk.bold('\n🔗 Links:'));
      logger.info(
        `   Repository: ${chalk.blue(template.metadata.repository.url)}`
      );
    }

    if ((template.author as any)?.website) {
      logger.info(
        `   Author Website: ${chalk.blue((template.author as any).website)}`
      );
    }

    if ((template.author as any)?.github) {
      logger.info(
        `   GitHub: ${chalk.blue(`https://github.com/${(template.author as any).github}`)}`
      );
    }
  }

  private static displayVersionHistory(template: TemplateModel): void {
    logger.info(chalk.bold('\n📚 Version History:'));

    const versions = template.versions.slice(0, 5); // Show latest 5 versions

    versions.forEach(version => {
      const isCurrent = version.version === template.currentVersion;
      const versionText = isCurrent
        ? chalk.bold.yellow(`v${version.version} (current)`)
        : chalk.yellow(`v${version.version}`);

      logger.info(`\n   ${versionText}`);
      logger.info(`   ${chalk.gray(version.description)}`);
      logger.info(
        `   Released: ${chalk.gray(new Date(version.created).toLocaleDateString())}`
      );
      logger.info(
        `   Downloads: ${chalk.cyan(InfoCommand.formatNumber(version.downloads))}`
      );
      logger.info(`   Size: ${InfoCommand.formatBytes(version.size)}`);

      if (version.changelog) {
        const changelog =
          version.changelog.length > 100
            ? `${version.changelog.substring(0, 100)}...`
            : version.changelog;
        logger.info(`   ${chalk.gray(`Changes: ${changelog}`)}`);
      }
    });

    if (template.versions.length > 5) {
      logger.info(
        `\n   ${chalk.gray(`... and ${template.versions.length - 5} more versions`)}`
      );
    }
  }

  private static displayDependencies(template: TemplateModel): void {
    const currentVersion = template.versions.find(
      v => v.version === template.currentVersion
    );
    if (!currentVersion || currentVersion.dependencies.length === 0) {
      logger.info(chalk.bold('\n🔗 Dependencies:'));
      logger.info('   None');
      return;
    }

    logger.info(chalk.bold('\n🔗 Dependencies:'));

    currentVersion.dependencies.forEach(dep => {
      const optional = dep.optional ? chalk.gray('(optional)') : '';
      let typeIcon = '⚙️'; // default
      if (dep.type === 'plugin') {
        typeIcon = '🔌';
      } else if (dep.type === 'template') {
        typeIcon = '📦';
      }

      logger.info(`   ${typeIcon} ${dep.name}@${dep.version} ${optional}`);

      if (dep.description) {
        logger.info(`     ${chalk.gray(dep.description)}`);
      }
    });
  }

  private static displayExamples(template: TemplateModel): void {
    const currentVersion = template.versions.find(
      v => v.version === template.currentVersion
    );
    if (!currentVersion || currentVersion.examples.length === 0) {
      logger.info(chalk.bold('\n💡 Examples:'));
      logger.info('   No examples available');
      return;
    }

    logger.info(chalk.bold('\n💡 Usage Examples:'));

    currentVersion.examples.forEach((example, index) => {
      logger.info(`\n   ${index + 1}. ${chalk.bold(example.name)}`);
      logger.info(`      ${example.description}`);

      logger.info(chalk.gray('      Variables:'));
      Object.entries(example.variables).forEach(([key, value]) => {
        logger.info(`        ${key}: "${value}"`);
      });

      if (example.expectedOutput) {
        logger.info(chalk.gray('      Expected output:'));
        const output =
          example.expectedOutput.length > 100
            ? `${example.expectedOutput.substring(0, 100)}...`
            : example.expectedOutput;
        logger.info(`        ${chalk.gray(output)}`);
      }
    });
  }

  private static async displayRecentReviews(
    template: TemplateModel
  ): Promise<void> {
    logger.info(chalk.bold('\n💬 Recent Reviews:'));

    try {
      const marketplace = await MarketplaceService.getInstance();
      const reviews = await marketplace.apiClient.getTemplateRatings(
        template.id,
        1,
        3
      );

      if (reviews.length === 0) {
        logger.info('   No reviews yet');
        return;
      }

      reviews.forEach(review => {
        const stars = InfoCommand.formatStars(review.rating);
        const date = new Date(review.created).toLocaleDateString();

        logger.info(`\n   ${stars} ${chalk.bold(review.title || 'Review')}`);
        logger.info(
          `   by ${chalk.blue(review.userName)} on ${chalk.gray(date)}`
        );

        if (review.comment) {
          const comment =
            review.comment.length > 150
              ? `${review.comment.substring(0, 150)}...`
              : review.comment;
          logger.info(`   ${chalk.gray(comment)}`);
        }
      });

      if ((template.rating as any)?.total > 3) {
        logger.info(
          `\n   ${chalk.gray(`... and ${(template.rating as any).total - 3} more reviews`)}`
        );
      }
    } catch {
      logger.info('   Unable to load reviews');
    }
  }

  private static displayDetailedStats(template: TemplateModel): void {
    logger.info(chalk.bold('\n📊 Detailed Statistics:'));

    const { stats } = template;

    if (stats) {
      logger.info(
        `   Total Downloads: ${chalk.cyan(InfoCommand.formatNumber(stats.downloads))}`
      );
      logger.info(
        `   Weekly Downloads: ${chalk.cyan(InfoCommand.formatNumber(stats.weeklyDownloads))}`
      );
      logger.info(
        `   Monthly Downloads: ${chalk.cyan(InfoCommand.formatNumber(stats.monthlyDownloads))}`
      );
      logger.info(
        `   Favorites: ${chalk.cyan(InfoCommand.formatNumber(stats.favorites))}`
      );
      logger.info(
        `   Forks: ${chalk.cyan(InfoCommand.formatNumber(stats.forks))}`
      );

      if (stats.issues > 0) {
        logger.info(`   Open Issues: ${chalk.yellow(stats.issues)}`);
      }

      logger.info(
        `   Popularity Score: ${chalk.cyan(stats.popularityScore.toFixed(1))}`
      );
      logger.info(
        `   Last Download: ${chalk.gray(new Date(stats.lastDownload).toLocaleDateString())}`
      );
    } else {
      logger.info('   Statistics not available');
    }

    // Author stats
    if ((template.author as any)?.totalTemplates !== undefined) {
      logger.info(chalk.bold('\n👤 Author Statistics:'));
      logger.info(
        `   Templates: ${chalk.cyan((template.author as any).totalTemplates)}`
      );
      logger.info(
        `   Total Downloads: ${chalk.cyan(InfoCommand.formatNumber((template.author as any).totalDownloads))}`
      );
      logger.info(
        `   Reputation: ${chalk.cyan((template.author as any).reputation)}`
      );
    }
  }

  private static displayUsageInstructions(
    template: TemplateModel,
    isInstalled: boolean
  ): void {
    logger.info(chalk.bold('\n🚀 Usage:'));

    if (!isInstalled) {
      logger.info(
        `   Install: ${chalk.green(`cursor-prompt install ${template.name}`)}`
      );
    }

    logger.info(
      `   Generate: ${chalk.green(`cursor-prompt generate ${template.name}`)}`
    );
    logger.info(
      `   Rate: ${chalk.green(`cursor-prompt rate ${template.name} --rating 5`)}`
    );

    if (isInstalled) {
      logger.info(
        `   Update: ${chalk.green(`cursor-prompt update ${template.name}`)}`
      );
      logger.info(
        `   Uninstall: ${chalk.green(`cursor-prompt uninstall ${template.name}`)}`
      );
    }
  }

  private static formatBadges(template: TemplateModel): string {
    const badges: string[] = [];

    if (template.featured) {
      badges.push(chalk.yellow('⭐ FEATURED'));
    }

    if (template.verified) {
      badges.push(chalk.green('✓ VERIFIED'));
    }

    if (template.stats?.trending) {
      badges.push(chalk.red('🔥 TRENDING'));
    }

    if (template.deprecated) {
      badges.push(chalk.red('⚠️ DEPRECATED'));
    }

    return badges.join(' ');
  }

  private static formatRating(rating: number): string {
    return `${InfoCommand.formatStars(rating)} ${chalk.gray(`(${rating.toFixed(1)})`)}`;
  }

  private static formatStars(rating: number): string {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let stars = '';
    stars += '★'.repeat(fullStars);
    if (hasHalfStar) stars += '☆';
    stars += '☆'.repeat(emptyStars);

    return chalk.yellow(stars);
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

  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  }
}

export default new InfoCommand();

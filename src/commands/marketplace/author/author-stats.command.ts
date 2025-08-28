/**
 * @fileoverview Author statistics command
 * @lastmodified 2025-08-22T22:30:00Z
 *
 * Features: Display author statistics and metrics
 * Main APIs: execute(), showStats()
 * Constraints: Requires valid author ID
 * Patterns: Command pattern with chart display
 */

import chalk from 'chalk';

import { BaseCommand } from '../../../cli/base-command';
import { AuthorService } from '../../../marketplace/core/author.service';
import { MarketplaceCommandOptions } from '../../../types';
import { logger } from '../../../utils/logger';

export class AuthorStatsCommand extends BaseCommand {
  name = 'marketplace:author:stats';

  description = 'show author statistics';

  private authorService: AuthorService;

  constructor() {
    super();
    this.authorService = AuthorService.getInstance();
  }

  async execute(
    authorId: string,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      await this.showStats(authorId, options);
    } catch (error: any) {
      logger.error(
        `Failed to show author stats: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async showStats(
    authorId: string,
    _options: MarketplaceCommandOptions
  ): Promise<void> {
    logger.info('Loading author statistics...');

    try {
      // For now, get profile which includes stats
      const profile = await this.authorService.getProfile(authorId);
      const stats = profile?.stats;

      if (!stats) {
        logger.error(`No statistics found for author ${authorId}`);
        return;
      }

      logger.info('');
      logger.info(
        chalk.bold.cyan('═══════════════════════════════════════════')
      );
      logger.info(chalk.bold.white(`  Author Statistics: ${authorId}`));
      logger.info(
        chalk.bold.cyan('═══════════════════════════════════════════')
      );
      logger.info('');

      // Overall Statistics
      logger.info(chalk.bold('📊 Overall Statistics'));
      logger.info(chalk.gray('─────────────────────'));
      logger.info(
        `  ${chalk.bold('Total Templates:')}     ${stats.totalTemplates || 0}`
      );
      logger.info(
        `  ${chalk.bold('Total Downloads:')}     ${this.formatNumber(stats.totalDownloads || 0)}`
      );
      logger.info(
        `  ${chalk.bold('Average Rating:')}      ${this.formatRating(stats.averageRating || 0)}`
      );
      logger.info(
        `  ${chalk.bold('Total Reviews:')}       ${stats.totalReviews || 0}`
      );
      logger.info(
        `  ${chalk.bold('Followers:')}           ${this.formatNumber(stats.followers || 0)}`
      );
      logger.info(
        `  ${chalk.bold('Following:')}           ${this.formatNumber(stats.following || 0)}`
      );
      logger.info('');

      // Additional Statistics
      logger.info(chalk.bold('📈 Additional Statistics'));
      logger.info(chalk.gray('─────────────────────'));
      logger.info(
        `  ${chalk.bold('Reputation:')}          ${stats.reputation || 0}`
      );
      logger.info(
        `  ${chalk.bold('Contribution Score:')}  ${stats.contributionScore || 0}`
      );
      logger.info(
        `  ${chalk.bold('Response Rate:')}       ${stats.responseRate || 0}%`
      );
      logger.info(
        `  ${chalk.bold('Response Time:')}       ${stats.responseTime || 0} hours`
      );

      if (stats.lastPublished) {
        logger.info(
          `  ${chalk.bold('Last Published:')}      ${this.formatDate(stats.lastPublished.toISOString())}`
        );
      }

      logger.info('');

      // Top Categories
      if (stats.topCategories && stats.topCategories.length > 0) {
        logger.info(chalk.bold('📂 Top Categories'));
        logger.info(chalk.gray('─────────────────────'));
        stats.topCategories.slice(0, 5).forEach(category => {
          logger.info(`  • ${category.category}: ${category.count} templates`);
        });
        logger.info('');
      }
    } catch (error: any) {
      throw error;
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  }

  private formatRating(rating: number): string {
    const stars = '★'.repeat(Math.floor(rating));
    const emptyStars = '☆'.repeat(5 - Math.floor(rating));
    return `${stars}${emptyStars} ${rating.toFixed(1)}`;
  }

  private formatDate(date?: string): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}

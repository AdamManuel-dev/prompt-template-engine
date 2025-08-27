/**
 * @fileoverview Author templates listing command
 * @lastmodified 2025-08-22T22:30:00Z
 *
 * Features: List templates by author
 * Main APIs: execute(), showAuthorTemplates()
 * Constraints: Pagination support
 * Patterns: Command pattern with table display
 */

import chalk from 'chalk';
import Table from 'cli-table3';

import { BaseCommand } from '../../../cli/base-command';
import { AuthorService } from '../../../marketplace/core/author.service';
import { MarketplaceService } from '../../../marketplace/core/marketplace.service';
import { MarketplaceCommandOptions } from '../../../types';
import { logger } from '../../../utils/logger';
import { TemplateSortOption } from '../../../marketplace/models/template.model';

export class AuthorTemplatesCommand extends BaseCommand {
  name = 'marketplace:author:templates';

  description = 'list templates by author';

  private authorService: AuthorService;

  private marketplaceService: MarketplaceService | null = null;

  constructor() {
    super();
    this.authorService = AuthorService.getInstance();
  }

  private async getMarketplaceService(): Promise<MarketplaceService> {
    if (!this.marketplaceService) {
      this.marketplaceService = await MarketplaceService.getInstance();
    }
    return this.marketplaceService;
  }

  async execute(
    authorId: string,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      await this.showAuthorTemplates(authorId, options);
    } catch (error) {
      logger.error(
        `Failed to show author templates: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async showAuthorTemplates(
    authorId: string,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    logger.info('Loading author templates...');

    try {
      const page = parseInt(String(options.page || 1), 10);
      const limit = parseInt(String(options.limit || 10), 10);

      const marketplaceService = await this.getMarketplaceService();
      const result = await marketplaceService.search({
        author: authorId,
        page,
        limit,
        sortBy: (options.sort as TemplateSortOption) || 'updated',
      });

      if (!result.templates || result.templates.length === 0) {
        logger.info(`No templates found for author ${authorId}`);
        return;
      }

      // Get author profile for display
      const profile = await this.authorService.getProfile(authorId);
      const authorName = profile?.displayName || profile?.username || authorId;

      logger.info('');
      logger.info(chalk.bold.cyan(`Templates by ${authorName}`));
      logger.info(chalk.gray(`Found ${result.total} templates`));
      logger.info('');

      // Create table for templates
      const table = new Table({
        head: [
          chalk.bold('Name'),
          chalk.bold('Category'),
          chalk.bold('Downloads'),
          chalk.bold('Rating'),
          chalk.bold('Updated'),
        ],
        style: {
          head: ['cyan'],
        },
        colWidths: [30, 15, 12, 10, 12],
      });

      result.templates.forEach(template => {
        const ratingValue =
          typeof template.rating === 'number'
            ? template.rating
            : template.rating &&
                typeof template.rating === 'object' &&
                'average' in template.rating
              ? template.rating.average
              : 0;
        const rating =
          ratingValue > 0
            ? `${this.formatRating(ratingValue)} (${ratingValue.toFixed(1)})`
            : 'N/A';

        const updated = template.updated
          ? new Date(template.updated).toLocaleDateString()
          : 'Unknown';

        table.push([
          chalk.bold(template.name),
          template.category || 'uncategorized',
          this.formatNumber(template.downloads || 0),
          rating,
          updated,
        ]);

        // Add description row if available
        if (template.description) {
          table.push([
            {
              colSpan: 5,
              content: chalk.gray(`  ${template.description}`),
            },
          ]);
        }
      });

      logger.info(table.toString());

      // Pagination info
      if (result.hasMore) {
        logger.info('');
        logger.info(
          chalk.gray(
            `Showing ${result.templates.length} of ${result.total} templates (page ${page})`
          )
        );
        logger.info(chalk.gray(`Use --page ${page + 1} to see more templates`));
      }

      // Show action hints
      logger.info('');
      logger.info(chalk.gray('Actions:'));
      logger.info(
        chalk.gray('  • Install a template:  marketplace:install <template-id>')
      );
      logger.info(
        chalk.gray('  • View template info:  marketplace:info <template-id>')
      );
    } catch (error) {
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
    return `${stars}${emptyStars}`;
  }
}

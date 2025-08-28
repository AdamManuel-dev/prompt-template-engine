/**
 * @fileoverview Template rating and review command
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Template rating, review submission, review management
 * Main APIs: execute(), submitRating(), displayReviews()
 * Constraints: Authentication required, one review per user per template
 * Patterns: Command pattern, rating system, user feedback
 */

import chalk from 'chalk';
import { BaseCommand } from '../../cli/base-command';
import { ICommand } from '../../cli/command-registry';
import { MarketplaceService } from '../../marketplace/core/marketplace.service';
import { TemplateRegistry } from '../../marketplace/core/template.registry';
import {
  TemplateReview,
  TemplateModel,
} from '../../marketplace/models/template.model';
import { MarketplaceCommandOptions, MarketplaceTemplate } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Convert TemplateModel to MarketplaceTemplate
 */
function convertToMarketplaceTemplate(
  template: TemplateModel
): MarketplaceTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description || '',
    category: template.category || 'other',
    tags: template.tags || [],
    author: template.author || {
      id: 'unknown',
      name: 'Unknown',
      verified: false,
    },
    currentVersion: template.currentVersion || '1.0.0',
    versions: [],
    downloads: template.downloads || 0,
    rating: template.rating || 0,
    reviewCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    repository: template.repository,
    displayName: template.displayName,
    stats: template.stats,
  } as MarketplaceTemplate;
}

export class RateCommand extends BaseCommand implements ICommand {
  name = 'rate';

  description = 'Rate and review a template';

  override aliases = ['review', 'feedback'];

  override options = [
    {
      flags: '-r, --rating <rating>',
      description: 'Rating from 1 to 5 stars',
    },
    {
      flags: '-t, --title <title>',
      description: 'Review title',
    },
    {
      flags: '-c, --comment <comment>',
      description: 'Review comment',
    },
    {
      flags: '--show-reviews',
      description: 'Show existing reviews for the template',
      defaultValue: false,
    },
    {
      flags: '--interactive',
      description: 'Interactive rating mode',
      defaultValue: false,
    },
    {
      flags: '--edit',
      description: 'Edit existing review',
      defaultValue: false,
    },
    {
      flags: '--delete',
      description: 'Delete existing review',
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
        'Template name is required. Usage: cursor-prompt rate <template-name>'
      );
      return;
    }

    try {
      const marketplace = await MarketplaceService.getInstance();
      const registry = new TemplateRegistry();

      // Find installed template
      const installedTemplate = registry.getTemplateByName(templateName);
      if (!installedTemplate) {
        this.error(`Template "${templateName}" is not installed`);
        this.info(
          `Install it first with: ${chalk.green(`cursor-prompt install ${templateName}`)}`
        );
        return;
      }

      // Get marketplace template info
      const template = await marketplace.getTemplate(installedTemplate.id);

      // Show existing reviews if requested
      if (options.showReviews) {
        await this.displayReviews(convertToMarketplaceTemplate(template));
        return;
      }

      // Delete review if requested
      if (options.delete) {
        await this.deleteReview(template.id);
        return;
      }

      // Interactive mode
      if (options.interactive) {
        await this.interactiveRating(convertToMarketplaceTemplate(template));
        return;
      }

      // Validate rating
      const rating = options.rating ? parseInt(options.rating, 10) : null;
      if (!rating || rating < 1 || rating > 5) {
        this.error('Rating must be between 1 and 5');
        this.info('Usage: cursor-prompt rate <template-name> --rating <1-5>');
        return;
      }

      // Submit rating
      await this.submitRating(convertToMarketplaceTemplate(template), rating, {
        title: options.title,
        comment: options.comment,
        version: installedTemplate.version,
      });
    } catch (error: any) {
      this.error(
        `Rating failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async interactiveRating(
    template: MarketplaceTemplate
  ): Promise<void> {
    logger.info(
      chalk.bold(
        `\n⭐ Rate Template: ${template.displayName || template.name}\n`
      )
    );
    logger.info(`${template.description}\n`);
    logger.info(`Author: ${chalk.blue(template.author.name)}`);
    logger.info(`Version: ${chalk.yellow(template.currentVersion)}`);
    logger.info(`Category: ${chalk.magenta(template.category)}\n`);

    // Get rating
    const ratingPrompt = 'Rate this template (1-5 stars): ';
    const ratingInput = await this.prompt(ratingPrompt);
    const rating = parseInt(ratingInput, 10);

    if (!rating || rating < 1 || rating > 5) {
      this.error('Invalid rating. Must be between 1 and 5');
      return;
    }

    // Get optional title
    const title = await this.prompt('Review title (optional): ');

    // Get optional comment
    const comment = await this.prompt('Review comment (optional): ');

    // Confirm submission
    logger.info(chalk.bold('\n📝 Review Summary:'));
    logger.info(`Rating: ${RateCommand.formatStars(rating)}`);
    if (title) logger.info(`Title: ${title}`);
    if (comment) logger.info(`Comment: ${comment}`);

    const confirmed = await this.confirm('\nSubmit this review?');
    if (!confirmed) {
      this.info('Review cancelled');
      return;
    }

    // Submit rating
    await this.submitRating(template, rating, { title, comment });
  }

  private async submitRating(
    template: MarketplaceTemplate,
    rating: number,
    review: { title?: string; comment?: string; version?: string }
  ): Promise<void> {
    const marketplace = await MarketplaceService.getInstance();

    try {
      const reviewData: Partial<TemplateReview> = {
        rating,
        title: review.title || undefined,
        comment: review.comment || undefined,
        version: review.version || template.currentVersion,
      };

      await marketplace.rate(template.id, rating, reviewData);

      // Show success message
      logger.info(chalk.green('\n✓ Review submitted successfully!'));
      logger.info(`\n⭐ Your rating: ${RateCommand.formatStars(rating)}`);

      if (review.title) {
        logger.info(`📝 Title: ${review.title}`);
      }

      if (review.comment) {
        logger.info(`💬 Comment: ${review.comment}`);
      }

      logger.info(`\n💡 Thank you for helping the community!`);
    } catch (error: any) {
      if (
        error instanceof Error &&
        error.message.includes('already reviewed')
      ) {
        this.warn('You have already reviewed this template');

        const edit = await this.confirm(
          'Would you like to edit your existing review?'
        );
        if (edit) {
          // Implementation for editing would go here
          this.info('Review editing not yet implemented');
        }
      } else {
        throw error;
      }
    }
  }

  private async displayReviews(template: MarketplaceTemplate): Promise<void> {
    logger.info(
      chalk.bold(`\n📋 Reviews for ${template.displayName || template.name}\n`)
    );

    // Show overall rating
    const { rating } = template;
    logger.info(
      `Overall Rating: ${RateCommand.formatStars(typeof rating === 'number' ? rating : rating.average)} (${typeof rating === 'number' ? template.reviewCount : rating.total} reviews)`
    );

    // Show rating distribution
    if (typeof rating !== 'number' && rating.distribution) {
      RateCommand.displayRatingDistribution(rating.distribution);
    }

    // Get and display reviews
    try {
      const marketplace = await MarketplaceService.getInstance();
      const reviews = await marketplace.apiClient.getTemplateRatings(
        template.id,
        1,
        10
      );

      if (reviews.length === 0) {
        logger.info(
          chalk.gray('\nNo reviews yet. Be the first to review this template!')
        );
        return;
      }

      logger.info(chalk.bold('\n📝 Recent Reviews:\n'));

      reviews.forEach((review, index) => {
        this.displayReview(review, index + 1);
      });

      if (reviews.length >= 10) {
        logger.info(chalk.gray('\n💡 Showing latest 10 reviews'));
      }
    } catch (error: any) {
      this.warn(
        `Failed to load reviews: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private static displayRatingDistribution(
    distribution: Record<string, number>
  ): void {
    logger.info(chalk.bold('\n📊 Rating Distribution:\n'));

    const total = Object.values(distribution).reduce(
      (sum, count) => sum + count,
      0
    );

    for (let i = 5; i >= 1; i -= 1) {
      const count = distribution[i.toString()] || 0;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      const barLength = Math.round(percentage / 5); // Scale to max 20 chars
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);

      logger.info(`${i} ⭐ ${chalk.cyan(bar)} ${count} (${percentage}%)`);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private displayReview(review: TemplateReview, position: number): void {
    const stars = RateCommand.formatStars(review.rating);
    const date = new Date(review.created).toLocaleDateString();
    const helpful =
      review.helpful > 0 ? chalk.green(`👍 ${review.helpful}`) : '';

    logger.info(
      `${position}. ${stars} ${chalk.bold(review.title || 'Review')}`
    );
    logger.info(
      `   by ${chalk.blue(review.userName)} on ${chalk.gray(date)} ${helpful}`
    );

    if (review.comment) {
      const truncated =
        review.comment.length > 200
          ? `${review.comment.substring(0, 200)}...`
          : review.comment;
      logger.info(`   ${chalk.gray(truncated)}`);
    }

    if (review.version) {
      logger.info(`   ${chalk.gray(`for version ${review.version}`)}`);
    }

    logger.info('');
  }

  // eslint-disable-next-line no-unused-vars
  private async deleteReview(_templateId: string): Promise<void> {
    const confirmed = await this.confirm(
      'Are you sure you want to delete your review?'
    );
    if (!confirmed) {
      this.info('Deletion cancelled');
      return;
    }

    try {
      // Implementation would call API to delete review
      // await marketplace.api.deleteReview(templateId);
      this.info('Review deletion not yet implemented');
    } catch (error: any) {
      this.error(
        `Failed to delete review: ${error instanceof Error ? error.message : String(error)}`
      );
    }
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
}

export default new RateCommand();

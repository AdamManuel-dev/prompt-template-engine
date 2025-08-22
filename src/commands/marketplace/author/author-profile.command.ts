/**
 * @fileoverview Author profile command for marketplace
 * @lastmodified 2025-08-22T22:30:00Z
 *
 * Features: Display author profile information
 * Main APIs: execute(), showProfile()
 * Constraints: Requires valid author ID
 * Patterns: Command pattern with service integration
 */

import chalk from 'chalk';

import { BaseCommand } from '../../../cli/base-command';
import { AuthorService } from '../../../marketplace/core/author.service';
import { MarketplaceCommandOptions } from '../../../types';
import { logger } from '../../../utils/logger';

export class AuthorProfileCommand extends BaseCommand {
  name = 'marketplace:author:profile';

  description = 'show author profile information';

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
      await this.showProfile(authorId, options);
    } catch (error) {
      logger.error(
        `Failed to show author profile: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private async showProfile(
    authorId: string,
    _options: MarketplaceCommandOptions
  ): Promise<void> {
    logger.info('Loading author profile...');

    try {
      const profile = await this.authorService.getProfile(authorId);

      if (!profile) {
        logger.error(`Author ${authorId} not found`);
        return;
      }

      // Display profile header
      logger.info('');
      logger.info(
        chalk.bold.cyan('═══════════════════════════════════════════')
      );
      logger.info(
        chalk.bold.white(
          `  Author Profile: ${profile.displayName || profile.username || authorId}`
        )
      );
      logger.info(
        chalk.bold.cyan('═══════════════════════════════════════════')
      );
      logger.info('');

      // Basic information
      logger.info(chalk.bold('📝 Basic Information'));
      logger.info(chalk.gray('─────────────────────'));
      logger.info(
        `  ${chalk.bold('Name:')}     ${profile.displayName || profile.username || authorId}`
      );
      logger.info(
        `  ${chalk.bold('Username:')} @${profile.username || authorId}`
      );

      if (profile.email && profile.settings?.contactVisible) {
        logger.info(`  ${chalk.bold('Email:')}    ${profile.email}`);
      }

      if (profile.website) {
        logger.info(
          `  ${chalk.bold('Website:')}  ${chalk.blue.underline(profile.website)}`
        );
      }

      if (profile.social?.github) {
        logger.info(
          `  ${chalk.bold('GitHub:')}   ${chalk.blue.underline(`https://github.com/${profile.social.github}`)}`
        );
      }

      if (profile.social?.twitter) {
        logger.info(
          `  ${chalk.bold('Twitter:')}  ${chalk.blue.underline(`https://twitter.com/${profile.social.twitter}`)}`
        );
      }

      logger.info('');

      // Bio
      if (profile.bio) {
        logger.info(chalk.bold('📖 Bio'));
        logger.info(chalk.gray('─────────────────────'));
        logger.info(`  ${profile.bio}`);
        logger.info('');
      }

      // Statistics
      if (profile.stats) {
        logger.info(chalk.bold('📊 Statistics'));
        logger.info(chalk.gray('─────────────────────'));
        logger.info(
          `  ${chalk.bold('Templates:')}    ${profile.stats.totalTemplates || 0}`
        );
        logger.info(
          `  ${chalk.bold('Total Downloads:')} ${this.formatNumber(profile.stats.totalDownloads || 0)}`
        );
        logger.info(
          `  ${chalk.bold('Average Rating:')}  ${this.formatRating(profile.stats.averageRating || 0)}`
        );
        logger.info(
          `  ${chalk.bold('Followers:')}      ${this.formatNumber(profile.stats.followers || 0)}`
        );
        logger.info(
          `  ${chalk.bold('Following:')}      ${this.formatNumber(profile.stats.following || 0)}`
        );
        logger.info('');
      }

      // Badges
      if (profile.verification?.badges && profile.verification.badges.length > 0) {
        logger.info(chalk.bold('🏆 Badges'));
        logger.info(chalk.gray('─────────────────────'));
        profile.verification.badges.forEach(badge => {
          const icon = this.getBadgeIcon(badge.type);
          logger.info(
            `  ${icon} ${chalk.bold(badge.name)} - ${badge.description}`
          );
        });
        logger.info('');
      }

      // Featured templates
      if (profile.stats?.featuredTemplates && profile.stats.featuredTemplates.length > 0) {
        logger.info(chalk.bold('⭐ Featured Templates'));
        logger.info(chalk.gray('─────────────────────'));
        profile.stats.featuredTemplates.slice(0, 5).forEach(templateId => {
          logger.info(`  • ${chalk.bold(templateId)}`);
        });
        logger.info('');
      }

      // Member since
      if (profile.created) {
        const memberSince = new Date(profile.created).toLocaleDateString(
          'en-US',
          {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }
        );
        logger.info(chalk.gray(`Member since ${memberSince}`));
      }

      // Verification status
      if (profile.verification?.verified) {
        logger.info(chalk.green('✓ Verified Author'));
      }

      logger.info('');

      // Show action options
      logger.info(chalk.gray('Actions:'));
      logger.info(
        chalk.gray(
          `  • View templates:  marketplace:author templates ${authorId}`
        )
      );
      logger.info(
        chalk.gray(
          `  • View activity:   marketplace:author activity ${authorId}`
        )
      );
      logger.info(
        chalk.gray(
          `  • Follow author:   marketplace:author follow ${authorId}`
        )
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
    return `${stars}${emptyStars} ${rating.toFixed(1)}`;
  }

  private getBadgeIcon(type: string): string {
    const icons: Record<string, string> = {
      contributor: '🤝',
      popular: '🔥',
      quality: '✨',
      veteran: '🎖️',
      verified: '✓',
      staff: '👤',
      partner: '🤝',
      default: '🏆',
    };
    return icons[type] || icons.default;
  }
}

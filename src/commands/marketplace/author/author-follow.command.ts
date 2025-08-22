/**
 * @fileoverview Author follow/unfollow commands
 * @lastmodified 2025-08-22T22:30:00Z
 *
 * Features: Follow and unfollow authors
 * Main APIs: follow(), unfollow()
 * Constraints: Authentication required
 * Patterns: Command pattern with service integration
 */

import chalk from 'chalk';
import { BaseCommand } from '../../../cli/base-command';
import { AuthorService } from '../../../marketplace/core/author.service';
import { MarketplaceCommandOptions } from '../../../types';
import { logger } from '../../../utils/logger';

export class AuthorFollowCommand extends BaseCommand {
  name = 'marketplace:author:follow';

  description = 'follow an author';

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
      await this.follow(authorId, options);
    } catch (error) {
      logger.error(
        `Failed to follow author: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  async follow(
    authorId: string,
    _options: MarketplaceCommandOptions
  ): Promise<void> {
    logger.info(`Following author ${authorId}...`);

    try {
      await this.authorService.followAuthor(authorId);
      logger.success(`✓ Now following ${authorId}`);

      logger.info('');
      logger.info(chalk.gray('You will receive notifications about:'));
      logger.info(chalk.gray('  • New templates from this author'));
      logger.info(chalk.gray('  • Updates to existing templates'));
      logger.info(chalk.gray('  • Author announcements'));
    } catch (error) {
      throw error;
    }
  }
}

export class AuthorUnfollowCommand extends BaseCommand {
  name = 'marketplace:author:unfollow';

  description = 'unfollow an author';

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
      await this.unfollow(authorId, options);
    } catch (error) {
      logger.error(
        `Failed to unfollow author: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  async unfollow(
    authorId: string,
    _options: MarketplaceCommandOptions
  ): Promise<void> {
    logger.info(`Unfollowing author ${authorId}...`);

    try {
      await this.authorService.unfollowAuthor(authorId);
      logger.success(`✓ Unfollowed ${authorId}`);

      logger.info('');
      logger.info(
        chalk.gray('You will no longer receive notifications from this author')
      );
    } catch (error) {
      throw error;
    }
  }
}

/**
 * @fileoverview Refactored author command orchestrator
 * @lastmodified 2025-08-22T22:30:00Z
 *
 * Features: Orchestrates author-related subcommands
 * Main APIs: execute() with action routing
 * Constraints: Requires valid action and author ID
 * Patterns: Command pattern with delegation
 */

import chalk from 'chalk';

import { BaseCommand } from '../../../cli/base-command';
import { MarketplaceCommandOptions } from '../../../types';
import { logger } from '../../../utils/logger';
import {
  AuthorFollowCommand,
  AuthorUnfollowCommand,
} from './author-follow.command';
import { AuthorProfileCommand } from './author-profile.command';
import { AuthorStatsCommand } from './author-stats.command';
import { AuthorTemplatesCommand } from './author-templates.command';

export class AuthorRefactoredCommand extends BaseCommand {
  name = 'marketplace:author';

  description = 'manage marketplace authors';

  private subCommands: Map<string, BaseCommand>;

  constructor() {
    super();
    this.subCommands = new Map<string, BaseCommand>();
    this.subCommands.set('profile', new AuthorProfileCommand());
    this.subCommands.set('templates', new AuthorTemplatesCommand());
    this.subCommands.set('follow', new AuthorFollowCommand());
    this.subCommands.set('unfollow', new AuthorUnfollowCommand());
    this.subCommands.set('stats', new AuthorStatsCommand());
  }

  async execute(
    action: string,
    options: MarketplaceCommandOptions & { author?: string }
  ): Promise<void> {
    try {
      // Handle different action formats
      let authorId: string;
      let subAction: string;

      if (options.author) {
        // Format: marketplace:author <action> --author <id>
        authorId = options.author;
        subAction = action;
      } else {
        // Format: marketplace:author <action> <author-id>
        // Or: marketplace:author profile <author-id>
        const args = action.split(' ');
        if (args.length === 1) {
          // Default to profile if only author ID provided
          authorId = args[0];
          subAction = 'profile';
        } else {
          subAction = args[0];
          authorId = args[1];
        }
      }

      // Validate inputs
      if (!authorId) {
        this.showHelp();
        throw new Error('Author ID is required');
      }

      if (!subAction || !this.subCommands.has(subAction)) {
        this.showHelp();
        throw new Error(`Invalid action: ${subAction}`);
      }

      // Execute the appropriate subcommand
      const command = this.subCommands.get(subAction)!;
      await command.execute(authorId, options);
    } catch (error) {
      logger.error(`Author command failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private showHelp(): void {
    logger.info('');
    logger.info(chalk.bold('Author Command Usage:'));
    logger.info('');
    logger.info('  marketplace:author <action> <author-id> [options]');
    logger.info('');
    logger.info(chalk.bold('Available Actions:'));
    logger.info('');
    logger.info('  profile <author-id>    Show author profile information');
    logger.info('  templates <author-id>  List templates by author');
    logger.info('  follow <author-id>     Follow an author');
    logger.info('  unfollow <author-id>   Unfollow an author');
    logger.info('  stats <author-id>      Show author statistics');
    logger.info('');
    logger.info(chalk.bold('Options:'));
    logger.info('');
    logger.info('  --page <number>        Page number for paginated results');
    logger.info('  --limit <number>       Number of items per page');
    logger.info(
      '  --sort <field>         Sort field (downloads, rating, updated)'
    );
    logger.info('  --order <order>        Sort order (asc, desc)');
    logger.info('');
    logger.info(chalk.bold('Examples:'));
    logger.info('');
    logger.info('  marketplace:author profile john-doe');
    logger.info('  marketplace:author templates john-doe --page 2 --limit 20');
    logger.info('  marketplace:author follow jane-smith');
    logger.info('  marketplace:author stats developer-123');
    logger.info('');
  }
}

// Export for backward compatibility
export class AuthorCommand extends AuthorRefactoredCommand {
  constructor() {
    super();
    logger.debug('Using refactored AuthorCommand');
  }
}

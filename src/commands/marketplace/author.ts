/**
 * @fileoverview Author profile management command
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Author profiles, following, statistics, activity feeds
 * Main APIs: execute(), showProfile(), followAuthor(), listAuthors()
 * Constraints: Profile visibility, rate limiting, authentication
 * Patterns: Command pattern, profile management, social features
 */

import chalk from 'chalk';
import { BaseCommand } from '../../cli/base-command';
import { ICommand } from '../../cli/command-registry';
import { AuthorService } from '../../marketplace/core/author.service';
import { MarketplaceCommandOptions, MarketplaceTemplate } from '../../types';
import { logger } from '../../utils/logger';

export class AuthorCommand extends BaseCommand implements ICommand {
  name = 'author';

  description = 'Author profile management and discovery';

  aliases = ['authors', 'profile'];

  options = [
    {
      flags: '--profile <username>',
      description: 'Show author profile',
    },
    {
      flags: '--templates <username>',
      description: 'Show author templates',
    },
    {
      flags: '--follow <username>',
      description: 'Follow/unfollow author',
    },
    {
      flags: '--activity <username>',
      description: 'Show author activity feed',
    },
    {
      flags: '--search <query>',
      description: 'Search authors',
    },
    {
      flags: '--featured',
      description: 'Show featured authors',
      defaultValue: false,
    },
    {
      flags: '--trending',
      description: 'Show trending authors',
      defaultValue: false,
    },
    {
      flags: '--stats <username>',
      description: 'Show detailed author statistics',
    },
    {
      flags: '--badges <username>',
      description: 'Show author badges and achievements',
    },
    {
      flags: '--followers <username>',
      description: 'Show author followers',
    },
    {
      flags: '--following <username>',
      description: 'Show who author is following',
    },
    {
      flags: '--format <format>',
      description: 'Output format (table, json, plain)',
      defaultValue: 'table',
    },
    {
      flags: '--limit <number>',
      description: 'Limit number of results',
      defaultValue: '10',
    },
  ];

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options);
  }

  async execute(
    _args: string,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    const authorService = AuthorService.getInstance();

    try {
      // Show author profile
      if (options.profile) {
        await this.showProfile(options.profile, authorService, options);
        return;
      }

      // Show author templates
      if (options.templates) {
        await this.showAuthorTemplates(
          options.templates,
          authorService,
          options
        );
        return;
      }

      // Follow/unfollow author
      if (options.follow) {
        await this.toggleFollow(options.follow, authorService, options);
        return;
      }

      // Show activity feed
      if (options.activity) {
        await this.showActivity(options.activity, authorService, options);
        return;
      }

      // Search authors
      if (options.search) {
        await this.searchAuthors(options.search, authorService, options);
        return;
      }

      // Show featured authors
      if (options.featured) {
        await this.showFeaturedAuthors(authorService, options);
        return;
      }

      // Show trending authors
      if (options.trending) {
        await this.showTrendingAuthors(authorService, options);
        return;
      }

      // Show author statistics
      if (options.stats) {
        await this.showStats(options.stats, authorService, options);
        return;
      }

      // Show author badges
      if (options.badges) {
        await this.showBadges(options.badges, authorService, options);
        return;
      }

      // Show followers
      if (options.followers) {
        await this.showFollowers(options.followers, authorService, options);
        return;
      }

      // Show following
      if (options.following) {
        await this.showFollowing(options.following, authorService, options);
        return;
      }

      // Show general help
      AuthorCommand.showHelp();
    } catch (error) {
      this.error(
        `Author command failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showProfile(
    username: string,
    authorService: AuthorService,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const profile = await authorService.getProfile(username);

      logger.info(
        chalk.bold(`\n👤 ${profile.displayName} (@${profile.username})\n`)
      );

      // Basic info
      if (profile.bio) {
        logger.info(`${profile.bio}\n`);
      }

      logger.info(`📍 ${profile.location || 'Location not specified'}`);
      if (profile.company) {
        logger.info(`🏢 ${profile.company}`);
      }
      if (profile.website) {
        logger.info(`🌐 ${chalk.blue(profile.website)}`);
      }

      // Verification and badges
      if (profile.verification.verified) {
        logger.info(`✅ ${chalk.green('Verified Author')}`);
      }

      if (profile.verification.badges.length > 0) {
        logger.info(`\n🏆 Badges:`);
        profile.verification.badges.slice(0, 5).forEach(badge => {
          logger.info(
            `   ${badge.icon} ${chalk.cyan(badge.name)} - ${chalk.gray(badge.description)}`
          );
        });
        if (profile.verification.badges.length > 5) {
          logger.info(
            `   ${chalk.gray(`... and ${profile.verification.badges.length - 5} more`)}`
          );
        }
      }

      // Statistics
      logger.info(chalk.bold('\n📊 Statistics:'));
      logger.info(`   Templates: ${chalk.cyan(profile.stats.totalTemplates)}`);
      logger.info(
        `   Downloads: ${chalk.cyan(AuthorCommand.formatNumber(profile.stats.totalDownloads))}`
      );
      logger.info(
        `   Average Rating: ${chalk.yellow('★'.repeat(Math.floor(profile.stats.averageRating)))} ${chalk.gray(`(${profile.stats.averageRating.toFixed(1)})`)}`
      );
      logger.info(`   Reputation: ${chalk.green(profile.stats.reputation)}`);
      logger.info(`   Followers: ${chalk.blue(profile.stats.followers)}`);
      logger.info(`   Following: ${chalk.blue(profile.stats.following)}`);

      // Social links
      if (Object.values(profile.social).some(link => link)) {
        logger.info(chalk.bold('\n🔗 Social Links:'));
        if (profile.social.github) {
          logger.info(`   GitHub: ${chalk.blue(profile.social.github)}`);
        }
        if (profile.social.twitter) {
          logger.info(`   Twitter: ${chalk.blue(profile.social.twitter)}`);
        }
        if (profile.social.linkedin) {
          logger.info(`   LinkedIn: ${chalk.blue(profile.social.linkedin)}`);
        }
      }

      // Activity info
      logger.info(chalk.bold('\n📅 Activity:'));
      logger.info(
        `   Joined: ${chalk.gray(new Date(profile.created).toLocaleDateString())}`
      );
      logger.info(
        `   Last Active: ${chalk.gray(new Date(profile.lastActive).toLocaleDateString())}`
      );
      if (profile.stats.lastPublished) {
        logger.info(
          `   Last Published: ${chalk.gray(new Date(profile.stats.lastPublished).toLocaleDateString())}`
        );
      }

      // Top categories
      if (profile.stats.topCategories.length > 0) {
        logger.info(chalk.bold('\n📂 Top Categories:'));
        profile.stats.topCategories.slice(0, 3).forEach(cat => {
          logger.info(
            `   ${chalk.magenta(cat.category)}: ${cat.count} templates`
          );
        });
      }

      // Quick actions
      logger.info(chalk.bold('\n🚀 Quick Actions:'));
      logger.info(
        `   View templates: ${chalk.green(`cursor-prompt author --templates ${username}`)}`
      );
      logger.info(
        `   Follow author: ${chalk.green(`cursor-prompt author --follow ${username}`)}`
      );
      logger.info(
        `   View activity: ${chalk.green(`cursor-prompt author --activity ${username}`)}`
      );

      if (options.format === 'json') {
        logger.info(`\n${JSON.stringify(profile, null, 2)}`);
      }
    } catch (error) {
      this.error(
        `Failed to fetch profile for ${username}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showAuthorTemplates(
    username: string,
    authorService: AuthorService,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const profile = await authorService.getProfile(username);
      const templates = await authorService.getAuthorTemplates(profile.id, {
        limit: parseInt(options.limit, 10),
      });

      logger.info(
        chalk.bold(
          `\n📦 Templates by ${chalk.cyan(profile.displayName)} (${templates.total})\n`
        )
      );

      if (templates.templates.length === 0) {
        logger.info(chalk.gray('No templates published yet.'));
        return;
      }

      templates.templates.forEach(
        (template: MarketplaceTemplate, index: number) => {
          const rating = '★'.repeat(Math.floor(template.rating.average));
          const downloads = AuthorCommand.formatNumber(
            template.stats.downloads
          );

          logger.info(
            `${index + 1}. ${chalk.cyan(template.displayName || template.name)}`
          );
          logger.info(`   ${template.description}`);
          logger.info(
            `   ${chalk.yellow(rating)} ${chalk.gray(`(${template.rating.average.toFixed(1)})`)} • ${chalk.gray(`${downloads} downloads`)} • v${template.currentVersion}`
          );
          logger.info(
            `   ${chalk.magenta(template.category)} • ${chalk.gray(`Updated ${new Date(template.updated).toLocaleDateString()}`)}`
          );
          logger.info();
        }
      );

      // Show pagination info
      if (templates.hasMore) {
        logger.info(
          chalk.gray(
            `Showing ${templates.templates.length} of ${templates.total} templates`
          )
        );
        logger.info(
          `💡 View more: ${chalk.green(`cursor-prompt search --author ${username}`)}`
        );
      }

      if (options.format === 'json') {
        logger.info(`\n${JSON.stringify(templates, null, 2)}`);
      }
    } catch (error) {
      this.error(
        `Failed to fetch templates for ${username}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async toggleFollow(
    username: string,
    authorService: AuthorService,
    // eslint-disable-next-line no-unused-vars
    _options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      // In a real implementation, we'd get the current user ID
      const currentUserId = process.env.USER_ID || 'current-user';

      const profile = await authorService.getProfile(username);
      const result = await authorService.toggleFollow(
        currentUserId,
        profile.id
      );

      if (result.following) {
        logger.info(
          chalk.green(`✅ Now following ${profile.displayName} (@${username})`)
        );
        logger.info(
          `💡 View their activity: ${chalk.blue(`cursor-prompt author --activity ${username}`)}`
        );
      } else {
        logger.info(
          chalk.yellow(`➖ Unfollowed ${profile.displayName} (@${username})`)
        );
      }
    } catch (error) {
      this.error(
        `Failed to toggle follow for ${username}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showActivity(
    username: string,
    authorService: AuthorService,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const profile = await authorService.getProfile(username);
      const activities = await authorService.getAuthorActivity(profile.id, {
        limit: parseInt(options.limit, 10),
      });

      logger.info(
        chalk.bold(`\n📈 Activity Feed: ${chalk.cyan(profile.displayName)}\n`)
      );

      if (activities.length === 0) {
        logger.info(chalk.gray('No recent activity.'));
        return;
      }

      activities.forEach((activity, index) => {
        const icon = AuthorCommand.getActivityIcon(activity.type);
        const date = new Date(activity.timestamp).toLocaleDateString();

        logger.info(`${index + 1}. ${icon} ${chalk.bold(activity.title)}`);
        if (activity.description) {
          logger.info(`   ${chalk.gray(activity.description)}`);
        }
        logger.info(`   ${chalk.gray(date)}`);
        logger.info();
      });

      if (options.format === 'json') {
        logger.info(`\n${JSON.stringify(activities, null, 2)}`);
      }
    } catch (error) {
      this.error(
        `Failed to fetch activity for ${username}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async searchAuthors(
    query: string,
    authorService: AuthorService,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const result = await authorService.searchAuthors({
        query,
        limit: parseInt(options.limit, 10),
        verified: options.verified,
      });

      logger.info(
        chalk.bold(`\n🔍 Author Search: "${query}" (${result.total} results)\n`)
      );

      if (result.authors.length === 0) {
        logger.info(chalk.gray('No authors found matching your search.'));
        return;
      }

      result.authors.forEach((author, index) => {
        const verified = author.verification.verified ? chalk.green('✓') : '';
        const { reputation } = author.stats;
        const templates = author.stats.totalTemplates;
        const downloads = AuthorCommand.formatNumber(
          author.stats.totalDownloads
        );

        logger.info(
          `${index + 1}. ${chalk.cyan(author.displayName)} (@${author.username}) ${verified}`
        );
        if (author.bio) {
          logger.info(
            `   ${author.bio.substring(0, 80)}${author.bio.length > 80 ? '...' : ''}`
          );
        }
        logger.info(
          `   📦 ${templates} templates • 📊 ${downloads} downloads • ⭐ ${reputation} reputation`
        );
        if (author.location) {
          logger.info(`   📍 ${chalk.gray(author.location)}`);
        }
        logger.info();
      });

      logger.info(
        `💡 View profile: ${chalk.green('cursor-prompt author --profile <username>')}`
      );

      if (options.format === 'json') {
        logger.info(`\n${JSON.stringify(result, null, 2)}`);
      }
    } catch (error) {
      this.error(
        `Author search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showFeaturedAuthors(
    authorService: AuthorService,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const authors = await authorService.getFeaturedAuthors(
        parseInt(options.limit, 10)
      );

      logger.info(chalk.bold(`\n⭐ Featured Authors (${authors.length})\n`));

      authors.forEach((author, index) => {
        const verified = author.verification.verified ? chalk.green('✓') : '';
        const badges = author.verification.badges
          .slice(0, 2)
          .map(b => b.icon)
          .join(' ');

        logger.info(
          `${index + 1}. ${chalk.cyan(author.displayName)} (@${author.username}) ${verified} ${badges}`
        );
        if (author.bio) {
          logger.info(
            `   ${author.bio.substring(0, 100)}${author.bio.length > 100 ? '...' : ''}`
          );
        }
        logger.info(
          `   📦 ${author.stats.totalTemplates} templates • 📊 ${AuthorCommand.formatNumber(author.stats.totalDownloads)} downloads`
        );
        logger.info();
      });

      if (options.format === 'json') {
        logger.info(`\n${JSON.stringify(authors, null, 2)}`);
      }
    } catch (error) {
      this.error(
        `Failed to fetch featured authors: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showTrendingAuthors(
    authorService: AuthorService,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const authors = await authorService.getTrendingAuthors(
        'week',
        parseInt(options.limit, 10)
      );

      logger.info(
        chalk.bold(`\n📈 Trending Authors This Week (${authors.length})\n`)
      );

      authors.forEach((author, index) => {
        const verified = author.verification.verified ? chalk.green('✓') : '';
        const growth = chalk.green('↗'); // Would show actual growth metrics

        logger.info(
          `${index + 1}. ${growth} ${chalk.cyan(author.displayName)} (@${author.username}) ${verified}`
        );
        if (author.bio) {
          logger.info(
            `   ${author.bio.substring(0, 80)}${author.bio.length > 80 ? '...' : ''}`
          );
        }
        logger.info(
          `   📊 ${AuthorCommand.formatNumber(author.stats.monthlyDownloads)} downloads this month`
        );
        logger.info();
      });

      if (options.format === 'json') {
        logger.info(`\n${JSON.stringify(authors, null, 2)}`);
      }
    } catch (error) {
      this.error(
        `Failed to fetch trending authors: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showStats(
    username: string,
    authorService: AuthorService,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const profile = await authorService.getProfile(username);
      const stats = await authorService.getAuthorStats(profile.id);

      logger.info(
        chalk.bold(
          `\n📊 Detailed Statistics: ${chalk.cyan(profile.displayName)}\n`
        )
      );

      // Template stats
      logger.info(chalk.bold('📦 Templates:'));
      logger.info(`   Total: ${chalk.cyan(stats.totalTemplates)}`);
      logger.info(`   Published: ${chalk.green(stats.publishedTemplates)}`);
      logger.info(`   Drafts: ${chalk.yellow(stats.draftTemplates)}`);
      logger.info(`   Deprecated: ${chalk.red(stats.deprecatedTemplates)}`);

      // Download stats
      logger.info(chalk.bold('\n📈 Downloads:'));
      logger.info(
        `   Total: ${chalk.cyan(AuthorCommand.formatNumber(stats.totalDownloads))}`
      );
      logger.info(
        `   This Month: ${chalk.blue(AuthorCommand.formatNumber(stats.monthlyDownloads))}`
      );

      // Quality stats
      logger.info(chalk.bold('\n⭐ Quality:'));
      logger.info(
        `   Average Rating: ${chalk.yellow(stats.averageRating.toFixed(2))}`
      );
      logger.info(`   Total Reviews: ${chalk.gray(stats.totalReviews)}`);

      // Social stats
      logger.info(chalk.bold('\n👥 Community:'));
      logger.info(`   Followers: ${chalk.blue(stats.followers)}`);
      logger.info(`   Following: ${chalk.blue(stats.following)}`);
      logger.info(`   Reputation: ${chalk.green(stats.reputation)}`);

      // Activity stats
      logger.info(chalk.bold('\n📅 Activity:'));
      logger.info(
        `   Joined: ${chalk.gray(new Date(stats.joinedDate).toLocaleDateString())}`
      );
      if (stats.lastPublished) {
        logger.info(
          `   Last Published: ${chalk.gray(new Date(stats.lastPublished).toLocaleDateString())}`
        );
      }
      logger.info(
        `   Response Rate: ${chalk.cyan(`${(stats.responseRate * 100).toFixed(1)}%`)}`
      );

      // Top categories
      if (stats.topCategories.length > 0) {
        logger.info(chalk.bold('\n📂 Top Categories:'));
        stats.topCategories.forEach(cat => {
          const percentage = ((cat.count / stats.totalTemplates) * 100).toFixed(
            1
          );
          logger.info(
            `   ${chalk.magenta(cat.category)}: ${cat.count} templates (${percentage}%)`
          );
        });
      }

      if (options.format === 'json') {
        logger.info(`\n${JSON.stringify(stats, null, 2)}`);
      }
    } catch (error) {
      this.error(
        `Failed to fetch stats for ${username}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showBadges(
    username: string,
    authorService: AuthorService,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const profile = await authorService.getProfile(username);
      const badges = await authorService.getAuthorBadges(profile.id);

      logger.info(
        chalk.bold(
          `\n🏆 Badges & Achievements: ${chalk.cyan(profile.displayName)}\n`
        )
      );

      if (badges.length === 0) {
        logger.info(chalk.gray('No badges earned yet.'));
        return;
      }

      badges.forEach((badge, index) => {
        const date = new Date(badge.earned).toLocaleDateString();
        logger.info(`${index + 1}. ${badge.icon} ${chalk.bold(badge.name)}`);
        logger.info(`   ${badge.description}`);
        logger.info(`   ${chalk.gray(`Earned: ${date}`)}`);
        if (badge.criteria) {
          logger.info(`   ${chalk.gray(`Criteria: ${badge.criteria}`)}`);
        }
        logger.info();
      });

      if (options.format === 'json') {
        logger.info(`\n${JSON.stringify(badges, null, 2)}`);
      }
    } catch (error) {
      this.error(
        `Failed to fetch badges for ${username}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showFollowers(
    username: string,
    authorService: AuthorService,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const profile = await authorService.getProfile(username);
      const result = await authorService.getFollowers(
        profile.id,
        1,
        parseInt(options.limit, 10)
      );

      logger.info(
        chalk.bold(
          `\n👥 Followers: ${chalk.cyan(profile.displayName)} (${result.total})\n`
        )
      );

      if (result.followers.length === 0) {
        logger.info(chalk.gray('No followers yet.'));
        return;
      }

      result.followers.forEach((follower, index) => {
        const verified = follower.verification.verified ? chalk.green('✓') : '';
        logger.info(
          `${index + 1}. ${chalk.cyan(follower.displayName)} (@${follower.username}) ${verified}`
        );
        logger.info(
          `   📦 ${follower.stats.totalTemplates} templates • ⭐ ${follower.stats.reputation} reputation`
        );
        logger.info();
      });

      if (options.format === 'json') {
        logger.info(`\n${JSON.stringify(result, null, 2)}`);
      }
    } catch (error) {
      this.error(
        `Failed to fetch followers for ${username}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showFollowing(
    username: string,
    authorService: AuthorService,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const profile = await authorService.getProfile(username);
      const result = await authorService.getFollowing(
        profile.id,
        1,
        parseInt(options.limit, 10)
      );

      logger.info(
        chalk.bold(
          `\n👤 Following: ${chalk.cyan(profile.displayName)} (${result.total})\n`
        )
      );

      if (result.following.length === 0) {
        logger.info(chalk.gray('Not following anyone yet.'));
        return;
      }

      result.following.forEach((following, index) => {
        const verified = following.verification.verified
          ? chalk.green('✓')
          : '';
        logger.info(
          `${index + 1}. ${chalk.cyan(following.displayName)} (@${following.username}) ${verified}`
        );
        logger.info(
          `   📦 ${following.stats.totalTemplates} templates • ⭐ ${following.stats.reputation} reputation`
        );
        logger.info();
      });

      if (options.format === 'json') {
        logger.info(`\n${JSON.stringify(result, null, 2)}`);
      }
    } catch (error) {
      this.error(
        `Failed to fetch following for ${username}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private static showHelp(): void {
    logger.info(chalk.bold('\n👤 Author Profile Commands\n'));

    logger.info('View author profile:');
    logger.info(`  ${chalk.green('cursor-prompt author --profile username')}`);

    logger.info('\nView author templates:');
    logger.info(
      `  ${chalk.green('cursor-prompt author --templates username')}`
    );

    logger.info('\nFollow/unfollow author:');
    logger.info(`  ${chalk.green('cursor-prompt author --follow username')}`);

    logger.info('\nView activity feed:');
    logger.info(`  ${chalk.green('cursor-prompt author --activity username')}`);

    logger.info('\nSearch authors:');
    logger.info(`  ${chalk.green('cursor-prompt author --search "query"')}`);

    logger.info('\nDiscover authors:');
    logger.info(`  ${chalk.green('cursor-prompt author --featured')}`);
    logger.info(`  ${chalk.green('cursor-prompt author --trending')}`);

    logger.info('\nDetailed information:');
    logger.info(`  ${chalk.green('cursor-prompt author --stats username')}`);
    logger.info(`  ${chalk.green('cursor-prompt author --badges username')}`);

    logger.info(
      chalk.gray('\nTip: Add --format json for machine-readable output')
    );
  }

  private static getActivityIcon(type: string): string {
    const icons: Record<string, string> = {
      'template-published': '📦',
      'template-updated': '🔄',
      'template-featured': '⭐',
      'badge-earned': '🏆',
      'milestone-reached': '🎯',
      'joined-marketplace': '👋',
      'profile-updated': '✏️',
      'verification-received': '✅',
      'community-contribution': '🤝',
    };

    return icons[type] || '📄';
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
}

export default new AuthorCommand();

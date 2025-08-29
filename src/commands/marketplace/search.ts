/**
 * @fileoverview Template search command for marketplace discovery
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Template search, filtering, sorting, pagination
 * Main APIs: execute(), displayResults(), formatTemplate()
 * Constraints: Network connectivity, API rate limits
 * Patterns: Command pattern, marketplace integration, result formatting
 */

import chalk from 'chalk';
import { BaseCommand } from '../../cli/base-command';
import { ICommand } from '../../cli/command-registry';
import { MarketplaceService } from '../../marketplace/core/marketplace.service';
import {
  TemplateSearchQuery,
  TemplateModel,
  TemplateSortOption,
  TemplateCategory,
  TemplateSearchResult,
  SearchFacets,
} from '../../marketplace/models/template.model';
import { MarketplaceCommandOptions } from '../../types';
import { logger } from '../../utils/logger';

export class SearchCommand extends BaseCommand implements ICommand {
  name = 'search';

  description = 'Search templates in the marketplace';

  override aliases = ['find', 's'];

  override options = [
    {
      flags: '-q, --query <query>',
      description: 'Search query text',
    },
    {
      flags: '-c, --category <category>',
      description:
        'Filter by category (development, documentation, git, testing, etc.)',
    },
    {
      flags: '-t, --tags <tags>',
      description: 'Filter by tags (comma-separated)',
    },
    {
      flags: '-a, --author <author>',
      description: 'Filter by author name',
    },
    {
      flags: '--min-rating <rating>',
      description: 'Minimum rating (1-5)',
      defaultValue: 0,
    },
    {
      flags: '--sort <field>',
      description:
        'Sort by: relevance, downloads, rating, created, updated, name, popularity',
      defaultValue: 'relevance',
    },
    {
      flags: '--order <order>',
      description: 'Sort order: asc or desc',
      defaultValue: 'desc',
    },
    {
      flags: '--page <page>',
      description: 'Page number for pagination',
      defaultValue: 1,
    },
    {
      flags: '--limit <limit>',
      description: 'Results per page',
      defaultValue: 10,
    },
    {
      flags: '--featured',
      description: 'Show only featured templates',
      defaultValue: false,
    },
    {
      flags: '--verified',
      description: 'Show only verified templates',
      defaultValue: false,
    },
    {
      flags: '--trending',
      description: 'Show only trending templates',
      defaultValue: false,
    },
    {
      flags: '--detailed',
      description: 'Show detailed template information',
      defaultValue: false,
    },
  ];

  override async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options as MarketplaceCommandOptions);
  }

  async execute(
    args: string,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      this.info('Searching marketplace...');

      const marketplace = await MarketplaceService.getInstance();
      const query = SearchCommand.buildSearchQuery(args, options);

      const result = await marketplace.search(query);

      if (result.templates.length === 0) {
        this.warn('No templates found matching your criteria');
        return;
      }

      this.displayResults(result, options);
      this.success(
        `Found ${result.total} templates (showing ${result.templates.length})`
      );

      if (result.hasMore) {
        logger.info(
          chalk.gray(
            `\n💡 Use --page ${(query.page || 1) + 1} to see more results`
          )
        );
      }
    } catch (error: unknown) {
      this.error(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private static buildSearchQuery(
    args: string,
    options: MarketplaceCommandOptions
  ): TemplateSearchQuery {
    const query: TemplateSearchQuery = {
      page: options.page ? parseInt(options.page, 10) : undefined,
      limit: options.limit ? parseInt(options.limit, 10) : undefined,
      sortBy: options.sort as TemplateSortOption,
      sortOrder: options.order,
    };

    // Use args as query if provided, otherwise use --query option
    if (args && args.trim()) {
      query.query = args.trim();
    } else if (options.query) {
      query.query = options.query;
    }

    if (options.category) {
      query.category = options.category as TemplateCategory;
    }

    if (options.tag) {
      query.tags = options.tag.split(',').map((tag: string) => tag.trim());
    }

    if (options.author) {
      query.author = options.author;
    }

    if (options.rating && parseFloat(options.rating) > 0) {
      query.minRating = parseFloat(options.rating);
    }

    if (options.featured) {
      query.featured = true;
    }

    if (options.verified) {
      query.verified = true;
    }

    if (options.trending) {
      query.trending = true;
    }

    return query;
  }

  private displayResults(
    result: TemplateSearchResult,
    options: MarketplaceCommandOptions
  ): void {
    logger.info('\n📦 Search Results:\n');

    result.templates.forEach((template: TemplateModel, index: number) => {
      const position = (result.page - 1) * result.limit + index + 1;

      if (options.detailed) {
        this.displayDetailedTemplate(template, position);
      } else {
        this.displayCompactTemplate(template, position);
      }
    });

    // Show search facets if available
    if (result.facets && Object.keys(result.facets).length > 0) {
      SearchCommand.displaySearchFacets(result.facets);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private displayCompactTemplate(
    template: TemplateModel,
    position: number
  ): void {
    const ratingAverage = (() => {
      if (typeof template.rating === 'number') {
        return template.rating;
      }
      if (
        template.rating &&
        typeof template.rating === 'object' &&
        'average' in template.rating
      ) {
        return template.rating.average;
      }
      return 0;
    })();
    const ratingStars = SearchCommand.formatRating(ratingAverage);
    const downloadsFormatted = SearchCommand.formatNumber(
      template.stats?.downloads ?? 0
    );
    const badges = SearchCommand.formatBadges(template);

    logger.info(
      `${position}. ${chalk.bold(template.displayName || template.name)} ${badges}`
    );
    logger.info(`   ${chalk.gray(template.description)}`);
    logger.info(
      `   ${ratingStars} ${chalk.cyan(`${downloadsFormatted} downloads`)} ${chalk.yellow(`v${template.currentVersion}`)}`
    );
    logger.info(
      `   ${chalk.gray('by')} ${chalk.blue(typeof template.author === 'string' ? template.author : (template.author?.name ?? 'Unknown'))} ${chalk.gray('•')} ${chalk.magenta(template.category)}`
    );

    if (template.tags && template.tags.length > 0) {
      const tags = template.tags
        .slice(0, 3)
        .map(tag => chalk.gray(`#${tag}`))
        .join(' ');
      logger.info(
        `   ${tags}${template.tags.length > 3 ? chalk.gray(` +${template.tags.length - 3} more`) : ''}`
      );
    }

    logger.info('');
  }

  // eslint-disable-next-line class-methods-use-this
  private displayDetailedTemplate(
    template: TemplateModel,
    position: number
  ): void {
    const ratingAverage = (() => {
      if (typeof template.rating === 'number') {
        return template.rating;
      }
      if (
        template.rating &&
        typeof template.rating === 'object' &&
        'average' in template.rating
      ) {
        return template.rating.average;
      }
      return 0;
    })();
    const ratingStars = SearchCommand.formatRating(ratingAverage);
    const badges = SearchCommand.formatBadges(template);

    logger.info(
      `${position}. ${chalk.bold.underline(template.displayName || template.name)} ${badges}`
    );
    logger.info(`   ID: ${chalk.gray(template.id)}`);
    logger.info(`   ${template.description}`);

    if (template.longDescription) {
      logger.info(
        `   ${chalk.gray(template.longDescription.substring(0, 200) + (template.longDescription.length > 200 ? '...' : ''))}`
      );
    }

    logger.info(
      `   ${ratingStars} (${typeof template.rating === 'object' && template.rating && 'total' in template.rating ? (template.rating.total ?? 0) : 0} reviews) • ${chalk.cyan(`${SearchCommand.formatNumber(template.stats?.downloads ?? 0)} downloads`)}`
    );
    logger.info(
      `   Version: ${chalk.yellow(template.currentVersion)} • Category: ${chalk.magenta(template.category)}`
    );
    logger.info(
      `   Author: ${chalk.blue(typeof template.author === 'string' ? template.author : (template.author?.name ?? 'Unknown'))}${typeof template.author === 'object' && template.author?.verified ? ' ✓' : ''}`
    );
    logger.info(
      `   Created: ${chalk.gray(new Date(template.created).toLocaleDateString())}`
    );
    logger.info(
      `   Updated: ${chalk.gray(new Date(template.updated).toLocaleDateString())}`
    );

    if (template.tags && template.tags.length > 0) {
      logger.info(
        `   Tags: ${template.tags.map(tag => chalk.gray(`#${tag}`)).join(' ')}`
      );
    }

    if (template.metadata.repository) {
      logger.info(
        `   Repository: ${chalk.blue(template.metadata.repository.url)}`
      );
    }

    logger.info(
      `   Install: ${chalk.green(`cursor-prompt install ${template.name}`)}`
    );
    logger.info('');
  }

  private static displaySearchFacets(facets: SearchFacets): void {
    logger.info(chalk.bold('\n🔍 Refine Your Search:\n'));

    if (facets.categories && facets.categories.length > 0) {
      logger.info('📂 Categories:');
      facets.categories.slice(0, 5).forEach(cat => {
        logger.info(`   ${chalk.magenta(cat.category)} (${cat.count})`);
      });
      logger.info('');
    }

    if (facets.tags && facets.tags.length > 0) {
      logger.info('🏷️  Popular Tags:');
      facets.tags.slice(0, 8).forEach((tag, index: number) => {
        const separator =
          index < facets.tags.slice(0, 8).length - 1 ? ', ' : '';
        process.stdout.write(`${chalk.gray(`#${tag.tag}`)}${separator}`);
      });
      logger.info('\n');
    }

    if (facets.authors && facets.authors.length > 0) {
      logger.info('👥 Top Authors:');
      facets.authors.slice(0, 3).forEach(author => {
        logger.info(
          `   ${chalk.blue(author.author)} (${author.count} templates)`
        );
      });
      logger.info('');
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
}

export default new SearchCommand();

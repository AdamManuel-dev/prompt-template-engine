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
} from '../../marketplace/models/template.model';

export class SearchCommand extends BaseCommand implements ICommand {
  name = 'search';

  description = 'Search templates in the marketplace';

  aliases = ['find', 's'];

  options = [
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

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options);
  }

  async execute(args: string, options: any): Promise<void> {
    try {
      this.info('Searching marketplace...');

      const marketplace = MarketplaceService.getInstance();
      const query = this.buildSearchQuery(args, options);

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
        console.log(
          chalk.gray(
            `\n💡 Use --page ${(query.page || 1) + 1} to see more results`
          )
        );
      }
    } catch (error) {
      this.error(
        `Search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private buildSearchQuery(args: string, options: any): TemplateSearchQuery {
    const query: TemplateSearchQuery = {
      page: parseInt(options.page, 10),
      limit: parseInt(options.limit, 10),
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
      query.category = options.category;
    }

    if (options.tags) {
      query.tags = options.tags.split(',').map((tag: string) => tag.trim());
    }

    if (options.author) {
      query.author = options.author;
    }

    if (options.minRating && options.minRating > 0) {
      query.minRating = parseFloat(options.minRating);
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

  private displayResults(result: any, options: any): void {
    console.log('\n📦 Search Results:\n');

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
      this.displaySearchFacets(result.facets);
    }
  }

  private displayCompactTemplate(
    template: TemplateModel,
    position: number
  ): void {
    const ratingStars = this.formatRating(template.rating.average);
    const downloadsFormatted = this.formatNumber(template.stats.downloads);
    const badges = this.formatBadges(template);

    console.log(
      `${position}. ${chalk.bold(template.displayName || template.name)} ${badges}`
    );
    console.log(`   ${chalk.gray(template.description)}`);
    console.log(
      `   ${ratingStars} ${chalk.cyan(`${downloadsFormatted} downloads`)} ${chalk.yellow(`v${template.currentVersion}`)}`
    );
    console.log(
      `   ${chalk.gray('by')} ${chalk.blue(template.author.name)} ${chalk.gray('•')} ${chalk.magenta(template.category)}`
    );

    if (template.tags.length > 0) {
      const tags = template.tags
        .slice(0, 3)
        .map(tag => chalk.gray(`#${tag}`))
        .join(' ');
      console.log(
        `   ${tags}${template.tags.length > 3 ? chalk.gray(` +${template.tags.length - 3} more`) : ''}`
      );
    }

    console.log();
  }

  private displayDetailedTemplate(
    template: TemplateModel,
    position: number
  ): void {
    const ratingStars = this.formatRating(template.rating.average);
    const badges = this.formatBadges(template);

    console.log(
      `${position}. ${chalk.bold.underline(template.displayName || template.name)} ${badges}`
    );
    console.log(`   ID: ${chalk.gray(template.id)}`);
    console.log(`   ${template.description}`);

    if (template.longDescription) {
      console.log(
        `   ${chalk.gray(template.longDescription.substring(0, 200) + (template.longDescription.length > 200 ? '...' : ''))}`
      );
    }

    console.log(
      `   ${ratingStars} (${template.rating.total} reviews) • ${chalk.cyan(`${this.formatNumber(template.stats.downloads)} downloads`)}`
    );
    console.log(
      `   Version: ${chalk.yellow(template.currentVersion)} • Category: ${chalk.magenta(template.category)}`
    );
    console.log(
      `   Author: ${chalk.blue(template.author.name)}${template.author.verified ? ' ✓' : ''}`
    );
    console.log(
      `   Created: ${chalk.gray(new Date(template.created).toLocaleDateString())}`
    );
    console.log(
      `   Updated: ${chalk.gray(new Date(template.updated).toLocaleDateString())}`
    );

    if (template.tags.length > 0) {
      console.log(
        `   Tags: ${template.tags.map(tag => chalk.gray(`#${tag}`)).join(' ')}`
      );
    }

    if (template.metadata.repository) {
      console.log(
        `   Repository: ${chalk.blue(template.metadata.repository.url)}`
      );
    }

    console.log(
      `   Install: ${chalk.green(`cursor-prompt install ${template.name}`)}`
    );
    console.log();
  }

  private displaySearchFacets(facets: any): void {
    console.log(chalk.bold('\n🔍 Refine Your Search:\n'));

    if (facets.categories && facets.categories.length > 0) {
      console.log('📂 Categories:');
      facets.categories.slice(0, 5).forEach((cat: any) => {
        console.log(`   ${chalk.magenta(cat.category)} (${cat.count})`);
      });
      console.log();
    }

    if (facets.tags && facets.tags.length > 0) {
      console.log('🏷️  Popular Tags:');
      facets.tags.slice(0, 8).forEach((tag: any, index: number) => {
        const separator =
          index < facets.tags.slice(0, 8).length - 1 ? ', ' : '';
        process.stdout.write(`${chalk.gray(`#${tag.tag}`)}${separator}`);
      });
      console.log('\n');
    }

    if (facets.authors && facets.authors.length > 0) {
      console.log('👥 Top Authors:');
      facets.authors.slice(0, 3).forEach((author: any) => {
        console.log(
          `   ${chalk.blue(author.author)} (${author.count} templates)`
        );
      });
      console.log();
    }
  }

  private formatRating(rating: number): string {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let stars = '';
    stars += '★'.repeat(fullStars);
    if (hasHalfStar) stars += '☆';
    stars += '☆'.repeat(emptyStars);

    return `${chalk.yellow(stars)} ${chalk.gray(`(${rating.toFixed(1)})`)}`;
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  private formatBadges(template: TemplateModel): string {
    const badges: string[] = [];

    if (template.featured) {
      badges.push(chalk.yellow('⭐ FEATURED'));
    }

    if (template.verified) {
      badges.push(chalk.green('✓ VERIFIED'));
    }

    if (template.stats.trending) {
      badges.push(chalk.red('🔥 TRENDING'));
    }

    if (template.deprecated) {
      badges.push(chalk.red('⚠️ DEPRECATED'));
    }

    return badges.join(' ');
  }
}

export default new SearchCommand();

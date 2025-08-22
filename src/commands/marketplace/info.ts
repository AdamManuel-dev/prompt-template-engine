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
import { TemplateModel } from '../../marketplace/models/template.model';

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
    await this.execute(args as string, options);
  }

  async execute(templateName: string, options: any): Promise<void> {
    if (!templateName || !templateName.trim()) {
      this.error(
        'Template name is required. Usage: cursor-prompt info <template-name>'
      );
      return;
    }

    try {
      const marketplace = MarketplaceService.getInstance();
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

        template = searchResult.templates[0];
      }

      // Display template information
      this.displayBasicInfo(template, isInstalled);

      if (options.all || options.versions) {
        this.displayVersionHistory(template);
      }

      if (options.all || options.dependencies) {
        this.displayDependencies(template);
      }

      if (options.all || options.examples) {
        this.displayExamples(template);
      }

      if (options.all || options.reviews) {
        await this.displayRecentReviews(template);
      }

      if (options.all || options.stats) {
        this.displayDetailedStats(template);
      }

      // Show installation/usage instructions
      this.displayUsageInstructions(template, isInstalled);
    } catch (error) {
      this.error(
        `Failed to get template info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private displayBasicInfo(
    template: TemplateModel,
    isInstalled: boolean
  ): void {
    const badges = this.formatBadges(template);
    const installStatus = isInstalled
      ? chalk.green('✓ Installed')
      : chalk.gray('Not installed');

    console.log(
      chalk.bold.underline(`\n📦 ${template.displayName || template.name}`)
    );
    console.log(`${badges} ${installStatus}\n`);

    console.log(`${template.description}`);

    if (template.longDescription) {
      console.log(`\n${chalk.gray(template.longDescription)}`);
    }

    // Basic metadata
    console.log(chalk.bold('\n📋 Details:'));
    console.log(`   ID: ${chalk.gray(template.id)}`);
    console.log(`   Category: ${chalk.magenta(template.category)}`);
    console.log(`   Current Version: ${chalk.yellow(template.currentVersion)}`);
    console.log(
      `   Author: ${chalk.blue(template.author.name)}${template.author.verified ? ' ✓' : ''}`
    );
    console.log(`   License: ${chalk.gray(template.metadata.license)}`);
    console.log(
      `   Created: ${chalk.gray(new Date(template.created).toLocaleDateString())}`
    );
    console.log(
      `   Updated: ${chalk.gray(new Date(template.updated).toLocaleDateString())}`
    );

    // Rating and stats
    console.log(chalk.bold('\n⭐ Rating & Stats:'));
    console.log(
      `   Rating: ${this.formatRating(template.rating.average)} (${template.rating.total} reviews)`
    );
    console.log(
      `   Downloads: ${chalk.cyan(this.formatNumber(template.stats.downloads))}`
    );
    console.log(
      `   Weekly: ${chalk.cyan(this.formatNumber(template.stats.weeklyDownloads))}`
    );
    console.log(
      `   Monthly: ${chalk.cyan(this.formatNumber(template.stats.monthlyDownloads))}`
    );

    if (template.stats.trending) {
      console.log(`   ${chalk.red('🔥 Trending')}`);
    }

    // Tags
    if (template.tags.length > 0) {
      console.log(chalk.bold('\n🏷️  Tags:'));
      console.log(
        `   ${template.tags.map(tag => chalk.gray(`#${tag}`)).join(' ')}`
      );
    }

    // Repository
    if (template.metadata.repository) {
      console.log(chalk.bold('\n🔗 Links:'));
      console.log(
        `   Repository: ${chalk.blue(template.metadata.repository.url)}`
      );
    }

    if (template.author.website) {
      console.log(`   Author Website: ${chalk.blue(template.author.website)}`);
    }

    if (template.author.github) {
      console.log(
        `   GitHub: ${chalk.blue(`https://github.com/${template.author.github}`)}`
      );
    }
  }

  private displayVersionHistory(template: TemplateModel): void {
    console.log(chalk.bold('\n📚 Version History:'));

    const versions = template.versions.slice(0, 5); // Show latest 5 versions

    versions.forEach(version => {
      const isCurrent = version.version === template.currentVersion;
      const versionText = isCurrent
        ? chalk.bold.yellow(`v${version.version} (current)`)
        : chalk.yellow(`v${version.version}`);

      console.log(`\n   ${versionText}`);
      console.log(`   ${chalk.gray(version.description)}`);
      console.log(
        `   Released: ${chalk.gray(new Date(version.created).toLocaleDateString())}`
      );
      console.log(
        `   Downloads: ${chalk.cyan(this.formatNumber(version.downloads))}`
      );
      console.log(`   Size: ${this.formatBytes(version.size)}`);

      if (version.changelog) {
        const changelog =
          version.changelog.length > 100
            ? `${version.changelog.substring(0, 100)}...`
            : version.changelog;
        console.log(`   ${chalk.gray(`Changes: ${changelog}`)}`);
      }
    });

    if (template.versions.length > 5) {
      console.log(
        `\n   ${chalk.gray(`... and ${template.versions.length - 5} more versions`)}`
      );
    }
  }

  private displayDependencies(template: TemplateModel): void {
    const currentVersion = template.versions.find(
      v => v.version === template.currentVersion
    );
    if (!currentVersion || currentVersion.dependencies.length === 0) {
      console.log(chalk.bold('\n🔗 Dependencies:'));
      console.log('   None');
      return;
    }

    console.log(chalk.bold('\n🔗 Dependencies:'));

    currentVersion.dependencies.forEach(dep => {
      const optional = dep.optional ? chalk.gray('(optional)') : '';
      const typeIcon =
        dep.type === 'plugin' ? '🔌' : dep.type === 'template' ? '📦' : '⚙️';

      console.log(`   ${typeIcon} ${dep.name}@${dep.version} ${optional}`);

      if (dep.description) {
        console.log(`     ${chalk.gray(dep.description)}`);
      }
    });
  }

  private displayExamples(template: TemplateModel): void {
    const currentVersion = template.versions.find(
      v => v.version === template.currentVersion
    );
    if (!currentVersion || currentVersion.examples.length === 0) {
      console.log(chalk.bold('\n💡 Examples:'));
      console.log('   No examples available');
      return;
    }

    console.log(chalk.bold('\n💡 Usage Examples:'));

    currentVersion.examples.forEach((example, index) => {
      console.log(`\n   ${index + 1}. ${chalk.bold(example.name)}`);
      console.log(`      ${example.description}`);

      console.log(chalk.gray('      Variables:'));
      Object.entries(example.variables).forEach(([key, value]) => {
        console.log(`        ${key}: "${value}"`);
      });

      if (example.expectedOutput) {
        console.log(chalk.gray('      Expected output:'));
        const output =
          example.expectedOutput.length > 100
            ? `${example.expectedOutput.substring(0, 100)}...`
            : example.expectedOutput;
        console.log(`        ${chalk.gray(output)}`);
      }
    });
  }

  private async displayRecentReviews(template: TemplateModel): Promise<void> {
    console.log(chalk.bold('\n💬 Recent Reviews:'));

    try {
      const marketplace = MarketplaceService.getInstance();
      const reviews = await marketplace.apiClient.getTemplateRatings(
        template.id,
        1,
        3
      );

      if (reviews.length === 0) {
        console.log('   No reviews yet');
        return;
      }

      reviews.forEach(review => {
        const stars = this.formatStars(review.rating);
        const date = new Date(review.created).toLocaleDateString();

        console.log(`\n   ${stars} ${chalk.bold(review.title || 'Review')}`);
        console.log(
          `   by ${chalk.blue(review.userName)} on ${chalk.gray(date)}`
        );

        if (review.comment) {
          const comment =
            review.comment.length > 150
              ? `${review.comment.substring(0, 150)}...`
              : review.comment;
          console.log(`   ${chalk.gray(comment)}`);
        }
      });

      if (template.rating.total > 3) {
        console.log(
          `\n   ${chalk.gray(`... and ${template.rating.total - 3} more reviews`)}`
        );
      }
    } catch (error) {
      console.log('   Unable to load reviews');
    }
  }

  private displayDetailedStats(template: TemplateModel): void {
    console.log(chalk.bold('\n📊 Detailed Statistics:'));

    const { stats } = template;

    console.log(
      `   Total Downloads: ${chalk.cyan(this.formatNumber(stats.downloads))}`
    );
    console.log(
      `   Weekly Downloads: ${chalk.cyan(this.formatNumber(stats.weeklyDownloads))}`
    );
    console.log(
      `   Monthly Downloads: ${chalk.cyan(this.formatNumber(stats.monthlyDownloads))}`
    );
    console.log(
      `   Favorites: ${chalk.cyan(this.formatNumber(stats.favorites))}`
    );
    console.log(`   Forks: ${chalk.cyan(this.formatNumber(stats.forks))}`);

    if (stats.issues > 0) {
      console.log(`   Open Issues: ${chalk.yellow(stats.issues)}`);
    }

    console.log(
      `   Popularity Score: ${chalk.cyan(stats.popularityScore.toFixed(1))}`
    );
    console.log(
      `   Last Download: ${chalk.gray(new Date(stats.lastDownload).toLocaleDateString())}`
    );

    // Author stats
    console.log(chalk.bold('\n👤 Author Statistics:'));
    console.log(`   Templates: ${chalk.cyan(template.author.totalTemplates)}`);
    console.log(
      `   Total Downloads: ${chalk.cyan(this.formatNumber(template.author.totalDownloads))}`
    );
    console.log(`   Reputation: ${chalk.cyan(template.author.reputation)}`);
  }

  private displayUsageInstructions(
    template: TemplateModel,
    isInstalled: boolean
  ): void {
    console.log(chalk.bold('\n🚀 Usage:'));

    if (!isInstalled) {
      console.log(
        `   Install: ${chalk.green(`cursor-prompt install ${template.name}`)}`
      );
    }

    console.log(
      `   Generate: ${chalk.green(`cursor-prompt generate ${template.name}`)}`
    );
    console.log(
      `   Rate: ${chalk.green(`cursor-prompt rate ${template.name} --rating 5`)}`
    );

    if (isInstalled) {
      console.log(
        `   Update: ${chalk.green(`cursor-prompt update ${template.name}`)}`
      );
      console.log(
        `   Uninstall: ${chalk.green(`cursor-prompt uninstall ${template.name}`)}`
      );
    }
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

  private formatRating(rating: number): string {
    return `${this.formatStars(rating)} ${chalk.gray(`(${rating.toFixed(1)})`)}`;
  }

  private formatStars(rating: number): string {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let stars = '';
    stars += '★'.repeat(fullStars);
    if (hasHalfStar) stars += '☆';
    stars += '☆'.repeat(emptyStars);

    return chalk.yellow(stars);
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

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  }
}

export default new InfoCommand();

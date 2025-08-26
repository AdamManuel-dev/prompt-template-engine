/**
 * @fileoverview Batch template installation for marketplace
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Multi-template installation, parallel processing, error handling
 * Main APIs: execute(), processBatch(), showResults()
 * Constraints: Network connectivity, API rate limits, concurrency control
 * Patterns: Command pattern, batch processing, progress tracking
 */

import chalk from 'chalk';
import { BaseCommand } from '../../cli/base-command';
import { ICommand } from '../../cli/command-registry';
import { MarketplaceService } from '../../marketplace/core/marketplace.service';
import { MarketplaceCommandOptions } from '../../types';
import {
  TemplateModel,
  TemplateInstallation,
} from '../../marketplace/models/template.model';
import { logger } from '../../utils/logger';

export class BatchInstallCommand extends BaseCommand implements ICommand {
  name = 'batch-install';

  description = 'Install multiple templates at once';

  aliases = ['multi-install', 'bulk-install'];

  options = [
    {
      flags: '-f, --file <file>',
      description: 'Install templates from file (one per line)',
    },
    {
      flags: '--continue-on-error',
      description: 'Continue installing even if some templates fail',
      defaultValue: true,
    },
    {
      flags: '--max-concurrent <number>',
      description: 'Maximum concurrent installations',
      defaultValue: '3',
    },
    {
      flags: '--dry-run',
      description: 'Show what would be installed without installing',
      defaultValue: false,
    },
    {
      flags: '--show-progress',
      description: 'Show installation progress',
      defaultValue: true,
    },
    {
      flags: '--auto-update',
      description: 'Enable auto-updates for all installed templates',
      defaultValue: false,
    },
  ];

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options as MarketplaceCommandOptions);
  }

  async execute(
    templateList: string,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const templates = await BatchInstallCommand.parseTemplateList(
        templateList,
        options
      );

      if (templates.length === 0) {
        this.error('No templates specified for batch installation');
        this.info(
          'Usage: cursor-prompt batch-install "template1,template2,template3"'
        );
        this.info('   or: cursor-prompt batch-install --file templates.txt');
        return;
      }

      logger.info(
        chalk.bold(`\n🚀 Batch Installation (${templates.length} templates)`)
      );

      if (options.dryRun) {
        await BatchInstallCommand.showDryRun(templates);
        return;
      }

      const confirmed = await this.confirm(
        `Install ${templates.length} template(s) with up to ${options.maxConcurrent} concurrent operations?`
      );

      if (!confirmed) {
        this.info('Batch installation cancelled');
        return;
      }

      await BatchInstallCommand.processBatch(templates, options);
    } catch (error) {
      this.error(
        `Batch installation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private static async parseTemplateList(
    templateList: string,
    options: MarketplaceCommandOptions
  ): Promise<string[]> {
    let templates: string[] = [];

    if (options.file) {
      // Read templates from file
      const fs = await import('fs/promises');
      try {
        const fileContent = await fs.readFile(options.file, 'utf8');
        templates = fileContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#')); // Skip empty lines and comments
      } catch (error) {
        throw new Error(`Failed to read file ${options.file}: ${error}`);
      }
    } else if (templateList) {
      // Parse comma-separated template list
      templates = templateList
        .split(',')
        .map(name => name.trim())
        .filter(name => name);
    }

    // Remove duplicates
    return [...new Set(templates)];
  }

  private static async showDryRun(templates: string[]): Promise<void> {
    logger.info(chalk.bold('\n📋 Dry Run - Templates to Install:'));

    const marketplace = await MarketplaceService.getInstance();
    let validTemplates = 0;
    let invalidTemplates = 0;

    // Process templates sequentially to show progress in order and avoid rate limiting
    // eslint-disable-next-line no-restricted-syntax
    for (const [index, templateName] of templates.entries()) {
      try {
        logger.info(chalk.gray(`${index + 1}. Resolving ${templateName}...`));

        // Try to resolve template
        let template;
        try {
          // eslint-disable-next-line no-await-in-loop
          template = await marketplace.getTemplate(templateName);
        } catch {
          // eslint-disable-next-line no-await-in-loop
          const searchResult = await marketplace.search({
            query: templateName,
            limit: 1,
          });
          if (searchResult.templates.length > 0) {
            [template] = searchResult.templates;
          }
        }

        if (template) {
          logger.info(
            `   ✓ ${chalk.green(template.displayName || template.name)} v${template.currentVersion}`
          );
          logger.info(`     ${chalk.gray(template.description)}`);
          validTemplates += 1;
        } else {
          logger.info(`   ✗ ${chalk.red(templateName)} - not found`);
          invalidTemplates += 1;
        }
      } catch (error) {
        logger.info(`   ✗ ${chalk.red(templateName)} - error: ${error}`);
        invalidTemplates += 1;
      }
    }

    logger.info(chalk.bold('\n📊 Summary:'));
    logger.info(`   Valid templates: ${chalk.green(validTemplates)}`);
    if (invalidTemplates > 0) {
      logger.info(`   Invalid templates: ${chalk.red(invalidTemplates)}`);
    }
    logger.info(`   Total: ${templates.length}`);
  }

  private static async processBatch(
    templates: string[],
    options: MarketplaceCommandOptions
  ): Promise<void> {
    const marketplace = await MarketplaceService.getInstance();
    const maxConcurrent = parseInt(String(options.maxConcurrent || '3'), 10);
    const startTime = Date.now();

    logger.info(chalk.bold('\n⚡ Starting batch installation...\n'));

    const results = await marketplace.batchInstall(templates, {
      continueOnError: options.continueOnError,
      maxConcurrency: maxConcurrent,
    });

    const duration = Date.now() - startTime;
    await BatchInstallCommand.showResults(results, duration);
  }

  private static async showResults(
    results: Array<{
      templateQuery: string;
      success: boolean;
      template?: TemplateModel;
      installation?: TemplateInstallation;
      error?: Error;
    }>,
    duration: number
  ): Promise<void> {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    logger.info(
      chalk.bold(`\n🎉 Batch Installation Complete (${duration}ms)\n`)
    );

    // Show successful installations
    if (successful.length > 0) {
      logger.info(
        chalk.green(`✅ Successfully Installed (${successful.length}):`)
      );
      successful.forEach((result, index) => {
        const { template } = result;
        if (template) {
          logger.info(
            `   ${index + 1}. ${chalk.cyan(template.displayName || template.name)} v${template.currentVersion}`
          );
        }
      });
    }

    // Show failed installations
    if (failed.length > 0) {
      logger.info(chalk.red(`\n❌ Failed Installations (${failed.length}):`));
      failed.forEach((result, index) => {
        logger.info(`   ${index + 1}. ${chalk.red(result.templateQuery)}`);
        if (result.error) {
          logger.info(`      ${chalk.gray(`Error: ${result.error.message}`)}`);
        }
      });
    }

    // Show summary statistics
    logger.info(chalk.bold('\n📊 Summary:'));
    logger.info(`   ${chalk.green('✓')} Successful: ${successful.length}`);
    if (failed.length > 0) {
      logger.info(`   ${chalk.red('✗')} Failed: ${failed.length}`);
    }
    logger.info(
      `   ⏱️  Duration: ${BatchInstallCommand.formatDuration(duration)}`
    );
    logger.info(
      `   🚀 Average per template: ${Math.round(duration / results.length)}ms`
    );

    // Show next steps
    if (successful.length > 0) {
      logger.info(chalk.bold('\n💡 Next Steps:'));
      logger.info(`   • List installed: ${chalk.green('cursor-prompt list')}`);
      logger.info(
        `   • Generate template: ${chalk.green('cursor-prompt generate <template-name>')}`
      );
      logger.info(
        `   • Check for updates: ${chalk.green('cursor-prompt update --check-only')}`
      );
    }

    // Suggest retry for failed installations
    if (failed.length > 0) {
      const failedNames = failed.map(f => f.templateQuery).join(',');
      logger.info(`\n💡 Retry failed installations:`);
      logger.info(
        `   ${chalk.yellow(`cursor-prompt batch-install "${failedNames}"`)}`
      );
    }
  }

  private static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

export default new BatchInstallCommand();

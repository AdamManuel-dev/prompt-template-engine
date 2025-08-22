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
    await this.execute(args as string, options);
  }

  async execute(templateList: string, options: any): Promise<void> {
    try {
      const templates = await this.parseTemplateList(templateList, options);

      if (templates.length === 0) {
        this.error('No templates specified for batch installation');
        this.info(
          'Usage: cursor-prompt batch-install "template1,template2,template3"'
        );
        this.info('   or: cursor-prompt batch-install --file templates.txt');
        return;
      }

      console.log(
        chalk.bold(`\n🚀 Batch Installation (${templates.length} templates)`)
      );

      if (options.dryRun) {
        await this.showDryRun(templates);
        return;
      }

      const confirmed = await this.confirm(
        `Install ${templates.length} template(s) with up to ${options.maxConcurrent} concurrent operations?`
      );

      if (!confirmed) {
        this.info('Batch installation cancelled');
        return;
      }

      await this.processBatch(templates, options);
    } catch (error) {
      this.error(
        `Batch installation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async parseTemplateList(
    templateList: string,
    options: any
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

  private async showDryRun(templates: string[]): Promise<void> {
    console.log(chalk.bold('\n📋 Dry Run - Templates to Install:'));

    const marketplace = MarketplaceService.getInstance();
    let validTemplates = 0;
    let invalidTemplates = 0;

    for (const [index, templateName] of templates.entries()) {
      try {
        console.log(chalk.gray(`${index + 1}. Resolving ${templateName}...`));

        // Try to resolve template
        let template;
        try {
          template = await marketplace.getTemplate(templateName);
        } catch {
          const searchResult = await marketplace.search({
            query: templateName,
            limit: 1,
          });
          if (searchResult.templates.length > 0) {
            template = searchResult.templates[0];
          }
        }

        if (template) {
          console.log(
            `   ✓ ${chalk.green(template.displayName || template.name)} v${template.currentVersion}`
          );
          console.log(`     ${chalk.gray(template.description)}`);
          validTemplates++;
        } else {
          console.log(`   ✗ ${chalk.red(templateName)} - not found`);
          invalidTemplates++;
        }
      } catch (error) {
        console.log(`   ✗ ${chalk.red(templateName)} - error: ${error}`);
        invalidTemplates++;
      }
    }

    console.log(chalk.bold('\n📊 Summary:'));
    console.log(`   Valid templates: ${chalk.green(validTemplates)}`);
    if (invalidTemplates > 0) {
      console.log(`   Invalid templates: ${chalk.red(invalidTemplates)}`);
    }
    console.log(`   Total: ${templates.length}`);
  }

  private async processBatch(templates: string[], options: any): Promise<void> {
    const marketplace = MarketplaceService.getInstance();
    const maxConcurrent = parseInt(options.maxConcurrent, 10);
    const startTime = Date.now();

    console.log(chalk.bold('\n⚡ Starting batch installation...\n'));

    const results = await marketplace.batchInstall(templates, {
      continueOnError: options.continueOnError,
      maxConcurrency: maxConcurrent,
    });

    const duration = Date.now() - startTime;
    await this.showResults(results, duration);
  }

  private async showResults(
    results: Array<{
      templateQuery: string;
      success: boolean;
      template?: any;
      installation?: any;
      error?: Error;
    }>,
    duration: number
  ): Promise<void> {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(
      chalk.bold(`\n🎉 Batch Installation Complete (${duration}ms)\n`)
    );

    // Show successful installations
    if (successful.length > 0) {
      console.log(
        chalk.green(`✅ Successfully Installed (${successful.length}):`)
      );
      successful.forEach((result, index) => {
        const { template } = result;
        if (template) {
          console.log(
            `   ${index + 1}. ${chalk.cyan(template.displayName || template.name)} v${template.currentVersion}`
          );
        }
      });
    }

    // Show failed installations
    if (failed.length > 0) {
      console.log(chalk.red(`\n❌ Failed Installations (${failed.length}):`));
      failed.forEach((result, index) => {
        console.log(`   ${index + 1}. ${chalk.red(result.templateQuery)}`);
        if (result.error) {
          console.log(`      ${chalk.gray(`Error: ${result.error.message}`)}`);
        }
      });
    }

    // Show summary statistics
    console.log(chalk.bold('\n📊 Summary:'));
    console.log(`   ${chalk.green('✓')} Successful: ${successful.length}`);
    if (failed.length > 0) {
      console.log(`   ${chalk.red('✗')} Failed: ${failed.length}`);
    }
    console.log(`   ⏱️  Duration: ${this.formatDuration(duration)}`);
    console.log(
      `   🚀 Average per template: ${Math.round(duration / results.length)}ms`
    );

    // Show next steps
    if (successful.length > 0) {
      console.log(chalk.bold('\n💡 Next Steps:'));
      console.log(`   • List installed: ${chalk.green('cursor-prompt list')}`);
      console.log(
        `   • Generate template: ${chalk.green('cursor-prompt generate <template-name>')}`
      );
      console.log(
        `   • Check for updates: ${chalk.green('cursor-prompt update --check-only')}`
      );
    }

    // Suggest retry for failed installations
    if (failed.length > 0) {
      const failedNames = failed.map(f => f.templateQuery).join(',');
      console.log(`\n💡 Retry failed installations:`);
      console.log(
        `   ${chalk.yellow(`cursor-prompt batch-install "${failedNames}"`)}`
      );
    }
  }

  private formatDuration(ms: number): string {
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

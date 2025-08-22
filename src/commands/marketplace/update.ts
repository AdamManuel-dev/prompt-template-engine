/**
 * @fileoverview Template update command for marketplace
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Template updates, version management, batch updates
 * Main APIs: execute(), updateTemplate(), updateAll()
 * Constraints: Network connectivity, version compatibility
 * Patterns: Command pattern, update workflow, progress tracking
 */

import chalk from 'chalk';
import { BaseCommand } from '../../cli/base-command';
import { ICommand } from '../../cli/command-registry';
import { MarketplaceService } from '../../marketplace/core/marketplace.service';
import { TemplateRegistry } from '../../marketplace/core/template.registry';
import { VersionManager } from '../../marketplace/core/version.manager';
import {
  MarketplaceCommandOptions,
  MarketplaceTemplate,
  MarketplaceTemplateVersion,
} from '../../types';
import { logger } from '../../utils/logger';

export class UpdateCommand extends BaseCommand implements ICommand {
  name = 'update';

  description = 'Update installed templates';

  aliases = ['upgrade', 'up'];

  options = [
    {
      flags: '-v, --version <version>',
      description: 'Update to specific version',
    },
    {
      flags: '--all',
      description: 'Update all templates',
      defaultValue: false,
    },
    {
      flags: '--check-only',
      description: 'Only check for updates without installing',
      defaultValue: false,
    },
    {
      flags: '--force',
      description: 'Force update even if no newer version',
      defaultValue: false,
    },
    {
      flags: '--backup',
      description: 'Create backup before updating',
      defaultValue: true,
    },
    {
      flags: '--include-prerelease',
      description: 'Include prerelease versions',
      defaultValue: false,
    },
    {
      flags: '--major',
      description: 'Allow major version updates',
      defaultValue: false,
    },
  ];

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options);
  }

  async execute(
    templateName: string,
    options: MarketplaceCommandOptions
  ): Promise<void> {
    try {
      const marketplace = MarketplaceService.getInstance();
      const registry = new TemplateRegistry();
      const versionManager = new VersionManager();

      if (options.all) {
        await this.updateAll(options);
        return;
      }

      if (!templateName || !templateName.trim()) {
        if (options.checkOnly) {
          await this.checkAllUpdates();
          return;
        }
        this.error(
          'Template name is required. Usage: cursor-prompt update <template-name>'
        );
        this.info('Or use --all to update all templates');
        return;
      }

      // Find installed template
      const template = registry.getTemplateByName(templateName);
      if (!template) {
        this.error(`Template "${templateName}" is not installed`);
        this.info(
          `Install it with: ${chalk.green(`cursor-prompt install ${templateName}`)}`
        );
        return;
      }

      this.info(`Checking for updates: ${chalk.cyan(template.name)}`);

      // Get latest template information
      const latestTemplate = await marketplace.getTemplate(template.id);
      const currentVersion = template.version;
      const latestVersion = latestTemplate.currentVersion;

      // Find appropriate version to update to
      let targetVersion = options.version || latestVersion;

      if (!options.version) {
        const availableVersions = latestTemplate.versions.map(
          (v: MarketplaceTemplateVersion) => v.version
        );
        const updateOptions = versionManager.getUpgradeOptions(
          currentVersion,
          availableVersions
        );

        // Choose appropriate version based on options
        if (
          !options.major &&
          updateOptions.major.length > 0 &&
          updateOptions.minor.length === 0 &&
          updateOptions.patch.length === 0
        ) {
          this.warn(
            `Major version update available (${currentVersion} → ${latestVersion})`
          );
          this.info('Use --major flag to allow major version updates');
          this.info(
            `Available patch/minor updates: ${updateOptions.patch.concat(updateOptions.minor).join(', ') || 'none'}`
          );

          if (updateOptions.minor.length > 0) {
            targetVersion = updateOptions.minor[updateOptions.minor.length - 1];
          } else if (updateOptions.patch.length > 0) {
            targetVersion = updateOptions.patch[updateOptions.patch.length - 1];
          } else {
            this.info('No safe updates available');
            return;
          }
        }

        // Filter out prerelease versions unless explicitly allowed
        if (
          !options.includePrerelease &&
          versionManager.isPrerelease(targetVersion)
        ) {
          const stableVersions = availableVersions.filter(v =>
            versionManager.isStable(v)
          );
          if (stableVersions.length > 0) {
            targetVersion =
              versionManager.findLatestSatisfying(
                stableVersions,
                `>=${currentVersion}`
              ) || currentVersion;
          }
        }
      }

      // Check if update is needed
      if (
        versionManager.compareVersions(targetVersion, currentVersion) <= 0 &&
        !options.force
      ) {
        this.success(
          `Template "${template.name}" is already up to date (v${currentVersion})`
        );
        return;
      }

      // Show update information
      this.displayUpdateInfo(
        template,
        currentVersion,
        targetVersion,
        latestTemplate,
        versionManager
      );

      // Check only mode
      if (options.checkOnly) {
        this.success('Update check completed');
        return;
      }

      // Confirm update
      const isBreaking = versionManager.isBreakingChange(
        currentVersion,
        targetVersion
      );
      const confirmMessage = isBreaking
        ? `⚠️  This is a major version update that may include breaking changes. Continue?`
        : `Update ${template.name} from v${currentVersion} to v${targetVersion}?`;

      const confirmed = await this.confirm(confirmMessage);
      if (!confirmed) {
        this.info('Update cancelled');
        return;
      }

      // Perform update
      this.info(`Updating ${template.name}...`);
      const installation = await marketplace.update(template.id, targetVersion);

      // Show success message
      logger.info(chalk.green('\n✓ Update completed successfully!'));
      logger.info(`\n📦 Template: ${chalk.cyan(template.name)}`);
      logger.info(
        `📈 Version: ${chalk.yellow(currentVersion)} → ${chalk.yellow(targetVersion)}`
      );
      logger.info(`📂 Location: ${chalk.gray(installation.installPath)}`);

      // Show changelog if available
      const versionInfo = latestTemplate.versions.find(
        v => v.version === targetVersion
      );
      if (versionInfo?.changelog) {
        logger.info(chalk.bold('\n📝 Changelog:'));
        logger.info(versionInfo.changelog);
      }
    } catch (error) {
      this.error(
        `Update failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async updateAll(options: MarketplaceCommandOptions): Promise<void> {
    const marketplace = MarketplaceService.getInstance();

    this.info('Checking for updates on all installed templates...');

    try {
      const updates = await marketplace.checkUpdates();

      if (updates.length === 0) {
        this.success('All templates are up to date!');
        return;
      }

      logger.info(
        chalk.bold(`\n🔄 Found ${updates.length} template(s) with updates:\n`)
      );

      updates.forEach((update, index) => {
        logger.info(
          `${index + 1}. ${chalk.cyan(update.templateId)}: ${chalk.yellow(update.currentVersion)} → ${chalk.yellow(update.latestVersion)}`
        );
      });

      if (options.checkOnly) {
        this.success('Update check completed');
        return;
      }

      const confirmed = await this.confirm(
        `\nUpdate all ${updates.length} template(s)?`
      );
      if (!confirmed) {
        this.info('Update cancelled');
        return;
      }

      // Update each template
      let successful = 0;
      let failed = 0;

      // Process updates sequentially to maintain order and show progress
      // eslint-disable-next-line no-restricted-syntax
      for (const update of updates) {
        try {
          this.info(`Updating ${update.templateId}...`);
          // eslint-disable-next-line no-await-in-loop
          await marketplace.update(update.templateId, update.latestVersion);
          logger.info(
            chalk.green(`✓ ${update.templateId} updated successfully`)
          );
          successful += 1;
        } catch (error) {
          logger.info(
            chalk.red(
              `✗ Failed to update ${update.templateId}: ${error instanceof Error ? error.message : String(error)}`
            )
          );
          failed += 1;
        }
      }

      // Show summary
      logger.info(chalk.bold(`\n📊 Update Summary:`));
      logger.info(`   ${chalk.green('✓')} Successful: ${successful}`);

      if (failed > 0) {
        logger.info(`   ${chalk.red('✗')} Failed: ${failed}`);
      }
    } catch (error) {
      this.error(
        `Failed to check updates: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async checkAllUpdates(): Promise<void> {
    const marketplace = MarketplaceService.getInstance();

    this.info('Checking for updates...');

    try {
      const updates = await marketplace.checkUpdates();

      if (updates.length === 0) {
        this.success('All templates are up to date!');
        return;
      }

      logger.info(chalk.bold(`\n🔄 Available Updates (${updates.length}):\n`));

      updates.forEach((update, index) => {
        logger.info(`${index + 1}. ${chalk.cyan(update.templateId)}`);
        logger.info(`   Current: ${chalk.yellow(update.currentVersion)}`);
        logger.info(`   Latest: ${chalk.yellow(update.latestVersion)}`);
        logger.info();
      });

      logger.info(
        `💡 Update all: ${chalk.green('cursor-prompt update --all')}`
      );
      logger.info(
        `💡 Update specific: ${chalk.green('cursor-prompt update <template-name>')}`
      );
    } catch (error) {
      this.error(
        `Failed to check updates: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private displayUpdateInfo(
    template: MarketplaceTemplate,
    currentVersion: string,
    targetVersion: string,
    latestTemplate: MarketplaceTemplate,
    versionManager: VersionManager
  ): void {
    logger.info(chalk.bold(`\n📦 ${template.name}`));
    logger.info(`   Current: ${chalk.yellow(currentVersion)}`);
    logger.info(`   Target: ${chalk.yellow(targetVersion)}`);

    if (targetVersion !== latestTemplate.currentVersion) {
      logger.info(`   Latest: ${chalk.gray(latestTemplate.currentVersion)}`);
    }

    const diffType = versionManager.diff(currentVersion, targetVersion);
    let diffText = chalk.green(diffType); // default
    if (diffType === 'major') {
      diffText = chalk.red(diffType);
    } else if (diffType === 'minor') {
      diffText = chalk.yellow(diffType);
    }

    logger.info(`   Change: ${diffText} version update`);

    if (diffType === 'major') {
      logger.info(
        chalk.yellow(
          '   ⚠️  Major version updates may include breaking changes'
        )
      );
    }

    // Show version information
    const versionInfo = latestTemplate.versions.find(
      (v: MarketplaceTemplateVersion) => v.version === targetVersion
    );
    if (versionInfo) {
      logger.info(`   Size: ${UpdateCommand.formatBytes(versionInfo.size)}`);

      if (versionInfo.dependencies.length > 0) {
        logger.info(`   Dependencies: ${versionInfo.dependencies.length}`);
      }

      logger.info(
        `   Released: ${new Date(versionInfo.created).toLocaleDateString()}`
      );
    }
  }

  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  }
}

export default new UpdateCommand();

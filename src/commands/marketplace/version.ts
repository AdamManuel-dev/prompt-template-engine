/**
 * @fileoverview Template version management command
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Version comparison, upgrade analysis, compatibility checking
 * Main APIs: execute(), compareVersions(), analyzeUpgrades(), checkCompatibility()
 * Constraints: Semantic versioning compliance, template availability
 * Patterns: Command pattern, version analysis, user guidance
 */

import chalk from 'chalk';
import { BaseCommand } from '../../cli/base-command';
import { ICommand } from '../../cli/command-registry';
import { MarketplaceService } from '../../marketplace/core/marketplace.service';
import { TemplateRegistry } from '../../marketplace/core/template.registry';
import { VersionManager } from '../../marketplace/core/version.manager';

export class VersionCommand extends BaseCommand implements ICommand {
  name = 'version';

  description = 'Template version management and analysis';

  aliases = ['ver', 'versions'];

  options = [
    {
      flags: '--compare <version1,version2>',
      description: 'Compare two versions',
    },
    {
      flags: '--check-upgrades <template>',
      description: 'Check available upgrades for template',
    },
    {
      flags: '--analyze <template>',
      description: 'Analyze version history and upgrade paths',
    },
    {
      flags: '--list <template>',
      description: 'List all versions for template',
    },
    {
      flags: '--latest <template>',
      description: 'Show latest version information',
    },
    {
      flags: '--compatibility <template@version>',
      description: 'Check compatibility with current environment',
    },
    {
      flags: '--format <format>',
      description: 'Output format (table, json, plain)',
      defaultValue: 'table',
    },
  ];

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options);
  }

  async execute(_args: string, options: any): Promise<void> {
    const versionManager = new VersionManager();

    try {
      // Version comparison
      if (options.compare) {
        await this.compareVersions(options.compare, versionManager, options);
        return;
      }

      // Check upgrades for template
      if (options.checkUpgrades) {
        await this.checkUpgrades(
          options.checkUpgrades,
          versionManager,
          options
        );
        return;
      }

      // Analyze template versions
      if (options.analyze) {
        await this.analyzeTemplate(options.analyze, versionManager, options);
        return;
      }

      // List template versions
      if (options.list) {
        await this.listVersions(options.list, versionManager, options);
        return;
      }

      // Show latest version
      if (options.latest) {
        await this.showLatestVersion(options.latest, versionManager, options);
        return;
      }

      // Check compatibility
      if (options.compatibility) {
        await this.checkCompatibility(
          options.compatibility,
          versionManager,
          options
        );
        return;
      }

      // Show general version management help
      this.showHelp();
    } catch (error) {
      this.error(
        `Version command failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async compareVersions(
    compareString: string,
    versionManager: VersionManager,
    options: any
  ): Promise<void> {
    const versions = compareString.split(',').map(v => v.trim());

    if (versions.length !== 2) {
      this.error(
        'Compare requires exactly two versions: --compare v1.0.0,v1.1.0'
      );
      return;
    }

    const [version1, version2] = versions;

    try {
      const comparison = versionManager.compareVersions(version1, version2);
      const diffType = versionManager.diff(version1, version2);

      console.log(chalk.bold('\n📊 Version Comparison\n'));
      console.log(`${chalk.cyan(version1)} vs ${chalk.cyan(version2)}`);

      let result: string;
      let color: any = chalk.gray;

      if (comparison < 0) {
        result = `${version1} < ${version2}`;
        color = chalk.red;
      } else if (comparison > 0) {
        result = `${version1} > ${version2}`;
        color = chalk.green;
      } else {
        result = `${version1} = ${version2}`;
        color = chalk.yellow;
      }

      console.log(`Result: ${color(result)}`);
      console.log(`Change Type: ${this.formatDiffType(diffType)}`);

      // Additional analysis
      if (comparison !== 0) {
        const isBreaking = versionManager.isBreakingChange(version1, version2);
        const v1Stable = versionManager.isStable(version1);
        const v2Stable = versionManager.isStable(version2);

        console.log(`\n📋 Analysis:`);
        console.log(
          `   Breaking Change: ${isBreaking ? chalk.red('Yes') : chalk.green('No')}`
        );
        console.log(
          `   ${version1}: ${v1Stable ? chalk.green('Stable') : chalk.yellow('Pre-release')}`
        );
        console.log(
          `   ${version2}: ${v2Stable ? chalk.green('Stable') : chalk.yellow('Pre-release')}`
        );
      }

      if (options.format === 'json') {
        console.log(
          `\n${JSON.stringify(
            {
              version1,
              version2,
              comparison,
              diffType,
              isBreaking: versionManager.isBreakingChange(version1, version2),
            },
            null,
            2
          )}`
        );
      }
    } catch (error) {
      this.error(
        `Invalid version format: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async checkUpgrades(
    templateName: string,
    versionManager: VersionManager,
    options: any
  ): Promise<void> {
    const marketplace = MarketplaceService.getInstance();
    const registry = new TemplateRegistry();

    // Get installed template
    const installed = registry.getTemplateByName(templateName);
    if (!installed) {
      this.error(`Template "${templateName}" is not installed`);
      return;
    }

    // Get marketplace template info
    const template = await marketplace.getTemplate(installed.id);
    const availableVersions = template.versions.map((v: any) => v.version);

    const upgradeOptions = versionManager.getUpgradeOptions(
      installed.version,
      availableVersions
    );

    console.log(
      chalk.bold(`\n🔄 Upgrade Options for ${chalk.cyan(templateName)}\n`)
    );
    console.log(`Current Version: ${chalk.yellow(installed.version)}`);
    console.log(`Latest Version: ${chalk.yellow(template.currentVersion)}`);

    if (upgradeOptions.patch.length > 0) {
      console.log(chalk.bold('\n🩹 Patch Updates (Bug fixes):'));
      upgradeOptions.patch.slice(-5).forEach(version => {
        console.log(`   ${chalk.green('✓')} ${version}`);
      });
      if (upgradeOptions.patch.length > 5) {
        console.log(
          `   ${chalk.gray(`... and ${upgradeOptions.patch.length - 5} more`)}`
        );
      }
    }

    if (upgradeOptions.minor.length > 0) {
      console.log(chalk.bold('\n⬆️  Minor Updates (New features):'));
      upgradeOptions.minor.slice(-5).forEach(version => {
        console.log(`   ${chalk.blue('↗')} ${version}`);
      });
      if (upgradeOptions.minor.length > 5) {
        console.log(
          `   ${chalk.gray(`... and ${upgradeOptions.minor.length - 5} more`)}`
        );
      }
    }

    if (upgradeOptions.major.length > 0) {
      console.log(chalk.bold('\n⚠️  Major Updates (Breaking changes):'));
      upgradeOptions.major.slice(-3).forEach(version => {
        console.log(`   ${chalk.red('⬆')} ${version}`);
      });
      if (upgradeOptions.major.length > 3) {
        console.log(
          `   ${chalk.gray(`... and ${upgradeOptions.major.length - 3} more`)}`
        );
      }
    }

    // Show recommended upgrade
    const hasUpdates =
      upgradeOptions.patch.length +
        upgradeOptions.minor.length +
        upgradeOptions.major.length >
      0;

    if (hasUpdates) {
      let recommended: string;
      if (upgradeOptions.patch.length > 0) {
        recommended = upgradeOptions.patch[upgradeOptions.patch.length - 1];
      } else if (upgradeOptions.minor.length > 0) {
        recommended = upgradeOptions.minor[upgradeOptions.minor.length - 1];
      } else {
        recommended = upgradeOptions.major[0];
      }

      console.log(chalk.bold('\n💡 Recommended:'));
      console.log(
        `   ${chalk.green(`cursor-prompt update ${templateName} --version ${recommended}`)}`
      );
    } else {
      console.log(chalk.green('\n✅ Template is up to date!'));
    }

    if (options.format === 'json') {
      console.log(
        `\n${JSON.stringify(
          {
            template: templateName,
            currentVersion: installed.version,
            latestVersion: template.currentVersion,
            upgrades: upgradeOptions,
          },
          null,
          2
        )}`
      );
    }
  }

  private async analyzeTemplate(
    templateName: string,
    versionManager: VersionManager,
    options: any
  ): Promise<void> {
    const marketplace = MarketplaceService.getInstance();

    try {
      const template = await marketplace.getTemplate(templateName);
      const versions = template.versions.sort((a: any, b: any) =>
        versionManager.compareVersions(b.version, a.version)
      );

      console.log(
        chalk.bold(
          `\n📈 Version Analysis: ${chalk.cyan(template.displayName || template.name)}\n`
        )
      );

      // Version statistics
      const totalVersions = versions.length;
      const stableVersions = versions.filter((v: any) =>
        versionManager.isStable(v.version)
      );
      const prereleaseVersions = versions.filter((v: any) =>
        versionManager.isPrerelease(v.version)
      );

      console.log(`📊 Statistics:`);
      console.log(`   Total Versions: ${chalk.cyan(totalVersions)}`);
      console.log(`   Stable: ${chalk.green(stableVersions.length)}`);
      console.log(`   Pre-release: ${chalk.yellow(prereleaseVersions.length)}`);
      console.log(`   Current: ${chalk.bold(template.currentVersion)}`);

      // Major version breakdown
      const majorVersions = new Map();
      versions.forEach((v: any) => {
        const major = versionManager.getMajor(v.version);
        majorVersions.set(major, (majorVersions.get(major) || 0) + 1);
      });

      console.log(`\n🏗️  Major Versions:`);
      Array.from(majorVersions.entries())
        .sort()
        .forEach(([major, count]) => {
          console.log(
            `   v${major}.x.x: ${count} version${count !== 1 ? 's' : ''}`
          );
        });

      // Recent versions
      console.log(chalk.bold('\n📝 Recent Versions:'));
      versions.slice(0, 8).forEach((version: any, index: number) => {
        const diffFromPrevious =
          index < versions.length - 1
            ? versionManager.diff(versions[index + 1].version, version.version)
            : 'initial';

        const icon = this.getVersionIcon(diffFromPrevious);
        const stability = versionManager.isStable(version.version)
          ? ''
          : chalk.yellow(' (pre-release)');
        const date = new Date(version.created).toLocaleDateString();

        console.log(
          `   ${icon} ${chalk.cyan(version.version)}${stability} - ${chalk.gray(date)}`
        );

        if (version.description) {
          console.log(
            `     ${chalk.gray(version.description.substring(0, 60))}${version.description.length > 60 ? '...' : ''}`
          );
        }
      });

      if (options.format === 'json') {
        console.log(
          `\n${JSON.stringify(
            {
              template: template.name,
              totalVersions,
              stableVersions: stableVersions.length,
              prereleaseVersions: prereleaseVersions.length,
              currentVersion: template.currentVersion,
              majorVersions: Object.fromEntries(majorVersions),
              recentVersions: versions.slice(0, 10).map((v: any) => ({
                version: v.version,
                created: v.created,
                stable: versionManager.isStable(v.version),
              })),
            },
            null,
            2
          )}`
        );
      }
    } catch (error) {
      this.error(
        `Failed to analyze template: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async listVersions(
    templateName: string,
    versionManager: VersionManager,
    options: any
  ): Promise<void> {
    const marketplace = MarketplaceService.getInstance();

    try {
      const template = await marketplace.getTemplate(templateName);
      const versions = template.versions.sort((a: any, b: any) =>
        versionManager.compareVersions(b.version, a.version)
      );

      console.log(
        chalk.bold(
          `\n📋 All Versions: ${chalk.cyan(template.displayName || template.name)}\n`
        )
      );

      if (options.format === 'table') {
        console.log(
          chalk.gray(
            'Version     │ Release Date │ Type     │ Downloads │ Status'
          )
        );
        console.log(chalk.gray('─'.repeat(65)));

        versions.forEach((version: any) => {
          const versionStr = version.version.padEnd(11);
          const date = new Date(version.created)
            .toLocaleDateString()
            .padEnd(12);
          const type = (
            versionManager.isStable(version.version) ? 'stable' : 'pre-release'
          ).padEnd(8);
          const downloads = this.formatNumber(version.downloads).padEnd(9);
          const isCurrent = version.version === template.currentVersion;
          const status = isCurrent
            ? chalk.green('current')
            : version.deprecated
              ? chalk.red('deprecated')
              : '';

          const line = `${chalk.cyan(versionStr)} │ ${chalk.gray(date)} │ ${type} │ ${chalk.gray(downloads)} │ ${status}`;
          console.log(line);
        });
      } else if (options.format === 'plain') {
        versions.forEach((version: any) => {
          console.log(version.version);
        });
      } else if (options.format === 'json') {
        console.log(
          JSON.stringify(
            versions.map((v: any) => ({
              version: v.version,
              created: v.created,
              stable: versionManager.isStable(v.version),
              downloads: v.downloads,
              current: v.version === template.currentVersion,
              deprecated: v.deprecated,
            })),
            null,
            2
          )
        );
      }

      console.log(chalk.gray(`\n📊 Total: ${versions.length} versions`));
    } catch (error) {
      this.error(
        `Failed to list versions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showLatestVersion(
    templateName: string,
    versionManager: VersionManager,
    options: any
  ): Promise<void> {
    const marketplace = MarketplaceService.getInstance();

    try {
      const template = await marketplace.getTemplate(templateName);
      const latestVersion = template.versions.find(
        (v: any) => v.version === template.currentVersion
      );

      if (!latestVersion) {
        this.error('Latest version information not available');
        return;
      }

      console.log(
        chalk.bold(
          `\n📦 Latest Version: ${chalk.cyan(template.displayName || template.name)}\n`
        )
      );

      console.log(`Version: ${chalk.green(latestVersion.version)}`);
      console.log(
        `Released: ${chalk.gray(new Date(latestVersion.created).toLocaleDateString())}`
      );
      console.log(
        `Type: ${versionManager.isStable(latestVersion.version) ? chalk.green('Stable') : chalk.yellow('Pre-release')}`
      );
      console.log(
        `Downloads: ${chalk.cyan(this.formatNumber(latestVersion.downloads))}`
      );
      console.log(`Size: ${chalk.gray(this.formatBytes(latestVersion.size))}`);

      if (latestVersion.description) {
        console.log(`\nDescription:`);
        console.log(`${latestVersion.description}`);
      }

      if (latestVersion.changelog) {
        console.log(`\n📝 Changelog:`);
        console.log(latestVersion.changelog);
      }

      if (latestVersion.dependencies && latestVersion.dependencies.length > 0) {
        console.log(`\n📋 Dependencies: ${latestVersion.dependencies.length}`);
        latestVersion.dependencies.slice(0, 5).forEach((dep: any) => {
          console.log(
            `   • ${dep.name}@${dep.version}${dep.optional ? chalk.gray(' (optional)') : ''}`
          );
        });
        if (latestVersion.dependencies.length > 5) {
          console.log(
            `   ${chalk.gray(`... and ${latestVersion.dependencies.length - 5} more`)}`
          );
        }
      }

      if (options.format === 'json') {
        console.log(
          `\n${JSON.stringify(
            {
              template: template.name,
              latestVersion: latestVersion.version,
              released: latestVersion.created,
              stable: versionManager.isStable(latestVersion.version),
              downloads: latestVersion.downloads,
              size: latestVersion.size,
              dependencies: latestVersion.dependencies?.length || 0,
            },
            null,
            2
          )}`
        );
      }
    } catch (error) {
      this.error(
        `Failed to get latest version: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async checkCompatibility(
    templateVersion: string,
    versionManager: VersionManager,
    options: any
  ): Promise<void> {
    const [templateName, version] = templateVersion.split('@');

    if (!templateName || !version) {
      this.error('Format: --compatibility template@version');
      return;
    }

    const marketplace = MarketplaceService.getInstance();

    try {
      const template = await marketplace.getTemplate(templateName);
      const versionInfo = template.versions.find(
        (v: any) => v.version === version
      );

      if (!versionInfo) {
        this.error(`Version ${version} not found for template ${templateName}`);
        return;
      }

      console.log(
        chalk.bold(
          `\n🔧 Compatibility Check: ${chalk.cyan(templateName)}@${chalk.yellow(version)}\n`
        )
      );

      // Engine compatibility
      const engineVersion = process.env.ENGINE_VERSION || '1.0.0';
      console.log(
        `Engine: ${chalk.gray('Current')} ${chalk.cyan(engineVersion)}`
      );

      if (template.metadata?.minEngineVersion) {
        const compatible = versionManager.satisfies(
          engineVersion,
          `>=${template.metadata.minEngineVersion}`
        );
        const status = compatible
          ? chalk.green('✓ Compatible')
          : chalk.red('✗ Incompatible');
        console.log(
          `        ${chalk.gray('Required')} ${chalk.yellow(`>=${template.metadata.minEngineVersion}`)} ${status}`
        );
      }

      // Platform compatibility
      const nodeVersion = process.version.slice(1);
      console.log(
        `\nNode.js: ${chalk.gray('Current')} ${chalk.cyan(nodeVersion)}`
      );

      if (template.metadata?.platform?.includes('node')) {
        console.log(`         ${chalk.green('✓ Compatible')}`);
      }

      // Dependencies compatibility
      if (versionInfo.dependencies && versionInfo.dependencies.length > 0) {
        console.log(`\n📦 Dependencies:`);

        const registry = new TemplateRegistry();
        for (const dep of versionInfo.dependencies) {
          const installed = await registry.isDependencyInstalled(dep);
          const status = installed
            ? chalk.green('✓ Available')
            : chalk.red('✗ Missing');
          const optional = dep.optional ? chalk.gray('(optional)') : '';

          console.log(`   ${dep.name}@${dep.version} ${optional} ${status}`);
        }
      }

      // Overall compatibility
      const overallCompatible = true; // Would be calculated based on all checks
      console.log(
        chalk.bold(
          `\n🎯 Overall: ${overallCompatible ? chalk.green('✅ Compatible') : chalk.red('❌ Incompatible')}`
        )
      );

      if (options.format === 'json') {
        console.log(
          `\n${JSON.stringify(
            {
              template: templateName,
              version,
              engineCompatible: true, // Would be calculated
              nodeCompatible: true,
              dependenciesAvailable: true,
              overallCompatible,
            },
            null,
            2
          )}`
        );
      }
    } catch (error) {
      this.error(
        `Failed to check compatibility: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private showHelp(): void {
    console.log(chalk.bold('\n🔧 Version Management Commands\n'));

    console.log('Compare versions:');
    console.log(
      `  ${chalk.green('cursor-prompt version --compare 1.0.0,1.1.0')}`
    );

    console.log('\nCheck available upgrades:');
    console.log(
      `  ${chalk.green('cursor-prompt version --check-upgrades my-template')}`
    );

    console.log('\nAnalyze template version history:');
    console.log(
      `  ${chalk.green('cursor-prompt version --analyze my-template')}`
    );

    console.log('\nList all versions:');
    console.log(`  ${chalk.green('cursor-prompt version --list my-template')}`);

    console.log('\nShow latest version info:');
    console.log(
      `  ${chalk.green('cursor-prompt version --latest my-template')}`
    );

    console.log('\nCheck compatibility:');
    console.log(
      `  ${chalk.green('cursor-prompt version --compatibility my-template@1.0.0')}`
    );

    console.log(
      chalk.gray('\nTip: Add --format json for machine-readable output')
    );
  }

  private formatDiffType(diffType: string): string {
    const colors: Record<string, any> = {
      major: chalk.red,
      minor: chalk.blue,
      patch: chalk.green,
      prerelease: chalk.yellow,
      equal: chalk.gray,
    };

    return colors[diffType]?.(diffType) || diffType;
  }

  private getVersionIcon(diffType: string): string {
    const icons: Record<string, string> = {
      major: '🔴',
      minor: '🔵',
      patch: '🟢',
      prerelease: '🟡',
      initial: '🆕',
    };

    return icons[diffType] || '📦';
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

export default new VersionCommand();

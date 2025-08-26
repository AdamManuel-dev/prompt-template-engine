/**
 * @fileoverview Plugin management command for cursor-prompt-template-engine
 * @lastmodified 2025-08-23T02:40:00Z
 *
 * Features: Plugin installation, management, listing, enabling/disabling
 * Main APIs: pluginCommand() - manages plugins
 * Constraints: Plugin security, filesystem permissions
 * Patterns: CLI command pattern, plugin management
 */

import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { EnhancedPluginManager } from '../cli/enhanced-plugin-manager';
import { CommandRegistry } from '../cli/command-registry';

export interface PluginOptions {
  list?: boolean;
  install?: string;
  uninstall?: string;
  enable?: string;
  disable?: string;
  info?: string;
  stats?: boolean;
  dev?: string; // For development: link a local plugin directory
}

async function listPlugins(
  pluginManager: EnhancedPluginManager
): Promise<void> {
  logger.info(chalk.cyan('📦 Installed Plugins:'));

  const plugins = pluginManager.getLoadedPlugins();

  if (plugins.length === 0) {
    logger.info(chalk.gray('  No plugins installed.'));
    return;
  }

  plugins.forEach(plugin => {
    const status = plugin.loaded ? chalk.green('✓') : chalk.red('✗');
    const name = chalk.bold(plugin.metadata.name);
    const version = chalk.gray(`v${plugin.metadata.version}`);
    const description = plugin.metadata.description || '';

    logger.info(`  ${status} ${name} ${version}`);
    if (description) {
      logger.info(chalk.gray(`    ${description}`));
    }

    // Show extension counts
    const extensions = [];
    if (plugin.commands?.length)
      extensions.push(`${plugin.commands.length} commands`);
    if (plugin.processors?.length)
      extensions.push(`${plugin.processors.length} processors`);
    if (plugin.validators?.length)
      extensions.push(`${plugin.validators.length} validators`);
    if (plugin.transformers?.length)
      extensions.push(`${plugin.transformers.length} transformers`);
    if (plugin.marketplaceHooks?.length)
      extensions.push(`${plugin.marketplaceHooks.length} hooks`);
    if (plugin.contextProviders?.length)
      extensions.push(`${plugin.contextProviders.length} providers`);
    if (plugin.fileGenerators?.length)
      extensions.push(`${plugin.fileGenerators.length} generators`);

    if (extensions.length > 0) {
      logger.info(chalk.gray(`    Extensions: ${extensions.join(', ')}`));
    }

    logger.info('');
  });
}

async function installPlugin(
  pluginName: string,
  _pluginManager: EnhancedPluginManager
): Promise<void> {
  logger.info(chalk.cyan(`📥 Installing plugin: ${pluginName}`));

  // In a real implementation, this would:
  // 1. Download from npm registry or marketplace
  // 2. Verify plugin integrity and security
  // 3. Install to the plugin directory
  // 4. Register with plugin manager

  logger.info(
    chalk.yellow('⚠️  Plugin installation from registry not yet implemented')
  );
  logger.info('💡 To install a development plugin, use: --dev /path/to/plugin');
}

async function uninstallPlugin(
  pluginName: string,
  pluginManager: EnhancedPluginManager
): Promise<void> {
  logger.info(chalk.cyan(`🗑️  Uninstalling plugin: ${pluginName}`));

  const success = await pluginManager.unloadPlugin(pluginName);

  if (success) {
    // In a real implementation, also remove files from disk
    logger.info(
      chalk.green(`✅ Plugin ${pluginName} uninstalled successfully`)
    );
  } else {
    logger.error(chalk.red(`❌ Failed to uninstall plugin ${pluginName}`));
  }
}

async function showPluginInfo(
  pluginName: string,
  pluginManager: EnhancedPluginManager
): Promise<void> {
  const plugins = pluginManager.getLoadedPlugins();
  const plugin = plugins.find(p => p.metadata.name === pluginName);

  if (!plugin) {
    logger.error(chalk.red(`❌ Plugin not found: ${pluginName}`));
    return;
  }

  logger.info(chalk.cyan(`📋 Plugin Information: ${plugin.metadata.name}`));
  logger.info('');
  logger.info(`Name: ${chalk.bold(plugin.metadata.name)}`);
  logger.info(`Version: ${chalk.cyan(plugin.metadata.version)}`);
  logger.info(
    `Description: ${plugin.metadata.description || 'No description'}`
  );
  logger.info(`Author: ${plugin.metadata.author || 'Unknown'}`);
  logger.info(
    `Status: ${plugin.loaded ? chalk.green('Loaded') : chalk.red('Not loaded')}`
  );
  logger.info(`Path: ${chalk.gray(plugin.path)}`);

  if (
    plugin.metadata.dependencies &&
    Object.keys(plugin.metadata.dependencies).length > 0
  ) {
    logger.info('');
    logger.info('Dependencies:');
    Object.entries(plugin.metadata.dependencies).forEach(([dep, version]) => {
      logger.info(`  - ${dep}: ${version}`);
    });
  }

  logger.info('');
  logger.info('Extensions:');

  if (plugin.commands?.length) {
    logger.info(`  Commands (${plugin.commands.length}):`);
    plugin.commands.forEach(cmd => {
      logger.info(`    - ${cmd.name}: ${cmd.description}`);
    });
  }

  if (plugin.processors?.length) {
    logger.info(`  Template Processors (${plugin.processors.length}):`);
    plugin.processors.forEach(proc => {
      const priority = proc.priority ? ` (priority: ${proc.priority})` : '';
      logger.info(`    - ${proc.name}${priority}: ${proc.description}`);
    });
  }

  if (plugin.validators?.length) {
    logger.info(`  Template Validators (${plugin.validators.length}):`);
    plugin.validators.forEach(val => {
      logger.info(`    - ${val.name}: ${val.description}`);
    });
  }

  if (plugin.transformers?.length) {
    logger.info(`  Template Transformers (${plugin.transformers.length}):`);
    plugin.transformers.forEach(trans => {
      logger.info(`    - ${trans.name}: ${trans.description}`);
    });
  }

  if (plugin.marketplaceHooks?.length) {
    logger.info(`  Marketplace Hooks (${plugin.marketplaceHooks.length}):`);
    plugin.marketplaceHooks.forEach(hook => {
      logger.info(`    - ${hook.name}: ${hook.description}`);
    });
  }

  if (plugin.contextProviders?.length) {
    logger.info(`  Context Providers (${plugin.contextProviders.length}):`);
    plugin.contextProviders.forEach(provider => {
      const priority = provider.priority
        ? ` (priority: ${provider.priority})`
        : '';
      logger.info(`    - ${provider.name}${priority}: ${provider.description}`);
    });
  }

  if (plugin.fileGenerators?.length) {
    logger.info(`  File Generators (${plugin.fileGenerators.length}):`);
    plugin.fileGenerators.forEach(gen => {
      logger.info(`    - ${gen.name}: ${gen.description}`);
      logger.info(`      Extensions: ${gen.supportedExtensions.join(', ')}`);
    });
  }
}

async function showPluginStats(
  pluginManager: EnhancedPluginManager
): Promise<void> {
  const stats = pluginManager.getPluginStats();

  logger.info(chalk.cyan('📊 Plugin Statistics:'));
  logger.info('');
  logger.info(`Total plugins discovered: ${stats.totalPlugins}`);
  logger.info(`Loaded plugins: ${stats.loadedPlugins}`);
  logger.info('');
  logger.info('Extension counts:');
  Object.entries(stats.extensionCounts).forEach(([type, count]) => {
    logger.info(`  ${type}: ${count}`);
  });
}

async function linkDevPlugin(
  pluginPath: string,
  _pluginManager: EnhancedPluginManager
): Promise<void> {
  logger.info(chalk.cyan(`🔗 Linking development plugin: ${pluginPath}`));

  try {
    // Resolve absolute path
    const absolutePath = path.resolve(pluginPath);

    // Check if path exists
    await fs.access(absolutePath);

    // Check if it's a valid plugin directory
    const packagePath = path.join(absolutePath, 'package.json');
    const pluginJsonPath = path.join(absolutePath, 'plugin.json');

    const hasPackageJson = await fs
      .access(packagePath)
      .then(() => true)
      .catch(() => false);
    const hasPluginJson = await fs
      .access(pluginJsonPath)
      .then(() => true)
      .catch(() => false);

    if (!hasPackageJson && !hasPluginJson) {
      throw new Error('Directory does not contain package.json or plugin.json');
    }

    // Create symlink in plugins directory
    const pluginsDir = path.join(process.cwd(), '.cursor-prompt', 'plugins');
    await fs.mkdir(pluginsDir, { recursive: true });

    const pluginName = path.basename(absolutePath);
    const linkPath = path.join(pluginsDir, pluginName);

    // Remove existing link if it exists
    try {
      await fs.unlink(linkPath);
    } catch {
      // Ignore if doesn't exist
    }

    // Create symlink
    await fs.symlink(absolutePath, linkPath);

    logger.info(chalk.green(`✅ Development plugin linked successfully`));
    logger.info(`   Source: ${absolutePath}`);
    logger.info(`   Link: ${linkPath}`);
    logger.info('');
    logger.info('💡 Run plugin discovery to load the plugin:');
    logger.info('   cursor-prompt plugin --list');
  } catch (error) {
    logger.error(chalk.red('❌ Failed to link development plugin'));
    if (error instanceof Error) {
      logger.error(chalk.red(error.message));
    }
    throw error;
  }
}

function showPluginHelp(): void {
  logger.info(chalk.cyan('🔌 Plugin Management Help:'));
  logger.info('');
  logger.info('Usage:');
  logger.info('  cursor-prompt plugin [options]');
  logger.info('');
  logger.info('Options:');
  logger.info('  --list                    List all installed plugins');
  logger.info('  --install <name>          Install a plugin from registry');
  logger.info('  --uninstall <name>        Uninstall a plugin');
  logger.info('  --info <name>             Show detailed plugin information');
  logger.info('  --stats                   Show plugin statistics');
  logger.info(
    '  --dev <path>              Link a development plugin directory'
  );
  logger.info('');
  logger.info('Examples:');
  logger.info('  cursor-prompt plugin --list');
  logger.info('  cursor-prompt plugin --info my-plugin');
  logger.info('  cursor-prompt plugin --dev ./my-plugin-dev');
}

export async function pluginCommand(options: PluginOptions): Promise<void> {
  try {
    // Get the enhanced plugin manager instance
    // Note: In real implementation, this would be injected from the main CLI
    // For now, we'll create a temporary command registry - in production this would be passed in
    const { Command } = require('commander');
    const tempProgram = new Command();
    const commandRegistry = CommandRegistry.getInstance(tempProgram);
    const pluginManager = EnhancedPluginManager.getInstance(commandRegistry);

    if (options.list) {
      await listPlugins(pluginManager);
    } else if (options.install) {
      await installPlugin(options.install, pluginManager);
    } else if (options.uninstall) {
      await uninstallPlugin(options.uninstall, pluginManager);
    } else if (options.info) {
      await showPluginInfo(options.info, pluginManager);
    } else if (options.stats) {
      await showPluginStats(pluginManager);
    } else if (options.dev) {
      await linkDevPlugin(options.dev, pluginManager);
    } else {
      // Default: show help
      showPluginHelp();
    }
  } catch (error) {
    logger.error(chalk.red('❌ Plugin command failed'));
    if (error instanceof Error) {
      logger.error(chalk.red(error.message));
    }
    throw error;
  }
}

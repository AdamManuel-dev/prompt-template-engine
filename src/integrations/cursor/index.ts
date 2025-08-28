/**
 * @fileoverview Cursor IDE Integration Main Module
 * @lastmodified 2025-08-26T03:27:11Z
 *
 * Features: Orchestrate Cursor IDE integration components
 * Main APIs: CursorIntegration class
 * Constraints: Handle both VS Code extension and standalone modes
 * Patterns: Facade pattern for integration components
 */

import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import * as vscode from 'vscode';
import { TemplateToRulesConverter } from './template-to-rules-converter';
import { ContextBridge } from './context-bridge';
import { CursorRule } from '../../types';
import { logger } from '../../utils/logger';

export interface CursorIntegrationConfig {
  autoSync?: boolean;
  syncInterval?: number;
  enableCommands?: boolean;
  enableQuickFix?: boolean;
  enableAutoSuggest?: boolean;
  rulesOutputDir?: string;
  legacySupport?: boolean;
  projectRoot?: string; // Project root directory
}

interface CommandIntegration {
  registerCommands(): Promise<void>;
  dispose(): void;
}

// Forward declaration for self-referencing type
export class CursorIntegration {
  // eslint-disable-next-line no-use-before-define
  private static instance: CursorIntegration | null = null;

  private converter: TemplateToRulesConverter;

  private bridge: ContextBridge;

  private commandIntegration?: CommandIntegration; // Dynamic import with proper interface

  private syncTimer?: ReturnType<typeof setTimeout>;

  private fileWatcher?: chokidar.FSWatcher;

  private isInitialized = false;

  private readonly defaultConfig: CursorIntegrationConfig = {
    autoSync: true,
    syncInterval: 60000, // 1 minute
    enableCommands: true,
    enableQuickFix: true,
    enableAutoSuggest: false,
    rulesOutputDir: '.cursor/rules',
    legacySupport: true,
  };

  private constructor(private config: CursorIntegrationConfig = {}) {
    this.config = { ...this.defaultConfig, ...config };
    this.converter = new TemplateToRulesConverter({
      outputDir: this.config.rulesOutputDir,
      legacySupport: this.config.legacySupport,
    });
    this.bridge = new ContextBridge();
  }

  /**
   * Get singleton instance of CursorIntegration with optional configuration
   * @param config - Optional configuration to merge with defaults
   * @returns Singleton CursorIntegration instance
   */
  static getInstance(config?: CursorIntegrationConfig): CursorIntegration {
    if (!CursorIntegration.instance) {
      CursorIntegration.instance = new CursorIntegration(config);
    }
    return CursorIntegration.instance;
  }

  /**
   * Initialize Cursor integration with VS Code context and command registration
   * @param context - Optional VS Code extension context for command integration
   * @returns Promise that resolves when initialization is complete
   * @throws Error if initialization fails
   */
  async initialize(context?: vscode.ExtensionContext): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Cursor integration already initialized');
      return;
    }

    logger.info('Initializing Cursor IDE integration...');

    try {
      // Initialize command integration if in VS Code context
      if (context && this.config.enableCommands) {
        try {
          // Dynamically import command integration only when in VS Code context
          const { CursorCommandIntegration } = await import(
            './command-integration'
          );
          this.commandIntegration = new CursorCommandIntegration(
            context as vscode.ExtensionContext,
            {
              enableQuickFix: this.config.enableQuickFix,
              enableAutoSuggest: this.config.enableAutoSuggest,
            }
          ) as CommandIntegration;
          await this.commandIntegration.registerCommands();
          logger.info('Cursor commands registered');
        } catch (_error) {
          logger.warn(
            'Command integration not available (running outside VS Code)'
          );
        }
      }

      // Perform initial sync
      await this.syncTemplates();

      // Start auto-sync if enabled
      if (this.config.autoSync) {
        this.startAutoSync();
      }

      this.isInitialized = true;
      logger.info('Cursor integration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Cursor integration');
      throw error;
    }
  }

  /**
   * Sync templates to Cursor rules format for IDE integration
   * @returns Promise that resolves when templates are converted and written
   * @throws Error if template directory cannot be read or rules cannot be written
   */
  async syncTemplates(): Promise<void> {
    logger.info('Syncing templates to Cursor rules...');

    try {
      // Try multiple template directories as fallbacks
      const templateDirs = ['.cursor/templates', './templates'];
      let allRules: CursorRule[] = [];

      for (const templateDir of templateDirs) {
        try {
          const rules = await this.converter.convertDirectory(templateDir);
          allRules = allRules.concat(rules);
        } catch (error) {
          logger.warn(`Skipped template directory ${templateDir}: ${error}`);
        }
      }

      // Write all collected rules
      for (const rule of allRules) {
        await this.converter.writeRule(rule);
      }

      logger.info(`Synced ${allRules.length} templates to rules`);
    } catch (error) {
      logger.error('Failed to sync templates');
      throw error;
    }
  }

  /**
   * Start automatic template sync with configurable interval
   * @private
   */
  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      try {
        await this.syncTemplates();
      } catch (_error) {
        logger.error('Auto-sync failed');
      }
    }, this.config.syncInterval!);

    logger.info(`Auto-sync started (interval: ${this.config.syncInterval}ms)`);
  }

  /**
   * Stop automatic sync timer if running
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
      logger.info('Auto-sync stopped');
    }
  }

  /**
   * Get converter instance for manual template-to-rules conversion
   * @returns TemplateToRulesConverter instance
   */
  getConverter(): TemplateToRulesConverter {
    return this.converter;
  }

  /**
   * Get context bridge instance for template context management
   * @returns ContextBridge instance
   */
  getContextBridge(): ContextBridge {
    return this.bridge;
  }

  /**
   * Get command integration instance for VS Code command access
   * @returns Command integration instance or undefined if not in VS Code context
   */
  getCommandIntegration(): unknown | undefined {
    return this.commandIntegration;
  }

  /**
   * Update configuration and reinitialize affected components
   * @param config - Partial configuration to merge with current settings
   */
  updateConfig(config: Partial<CursorIntegrationConfig>): void {
    this.config = { ...this.config, ...config };

    // Recreate converter with new config
    this.converter = new TemplateToRulesConverter({
      outputDir: this.config.rulesOutputDir,
      legacySupport: this.config.legacySupport,
    });

    // Restart auto-sync if interval changed
    if (config.syncInterval || config.autoSync !== undefined) {
      this.stopAutoSync();
      if (this.config.autoSync) {
        this.startAutoSync();
      }
    }

    logger.info('Configuration updated');
  }

  /**
   * Check if current project is a Cursor project by looking for .cursor directory
   * @param projectPath - Optional project path to check (defaults to current working directory)
   * @returns True if project contains .cursor directory
   */
  isCursorProject(projectPath?: string): boolean {
    const basePath = projectPath || process.cwd();
    const cursorDir = path.join(basePath, '.cursor');

    try {
      return fs.existsSync(cursorDir) && fs.statSync(cursorDir).isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Optimize template for Cursor context by compressing whitespace and truncating if needed
   * @param template - Template string or object with content to optimize
   * @param maxLength - Maximum allowed length (default: 8000 characters)
   * @returns Promise resolving to optimized template content
   */
  async optimizeForContext(
    template: string | { name: string; content: string },
    maxLength = 8000
  ): Promise<string> {
    // Handle both string and object inputs
    const content: string =
      typeof template === 'string' ? template : template.content;

    let optimized = content;

    // Compress whitespace
    optimized = optimized
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim(); // Remove leading/trailing whitespace

    // Truncate if too large
    if (optimized.length > maxLength) {
      optimized = `${optimized.substring(0, maxLength - 3)}...`;
      logger.warn(
        `Template truncated to ${maxLength} characters for Cursor context`
      );
    }

    return optimized;
  }

  /**
   * Start watching files for changes with automatic template sync
   * @param watchPath - Optional path to watch (defaults to multiple fallback paths)
   */
  startWatching(watchPath?: string): void {
    if (this.fileWatcher) {
      logger.warn('File watching already started');
      return;
    }

    // Use provided path or fallback to common template directories
    const watchPaths = watchPath
      ? [watchPath]
      : ['./templates', '.cursor/templates'];

    // Find the first existing path to watch
    let validWatchPath: string | null = null;
    for (const templatePath of watchPaths) {
      if (fs.existsSync(templatePath)) {
        validWatchPath = templatePath;
        break;
      }
    }

    if (!validWatchPath) {
      logger.warn(`No valid watch paths found from: ${watchPaths.join(', ')}`);
      return;
    }

    this.fileWatcher = chokidar.watch(validWatchPath, {
      ignored: /node_modules|\.git/,
      persistent: true,
      ignoreInitial: true,
    });

    this.fileWatcher.on('add', filePath => {
      logger.info(`Template added: ${filePath}`);
      this.syncTemplates().catch(error => {
        logger.error(`Auto-sync failed after file add: ${error.message}`);
      });
    });

    this.fileWatcher.on('change', filePath => {
      logger.info(`Template changed: ${filePath}`);
      this.syncTemplates().catch(error => {
        logger.error(`Auto-sync failed after file change: ${error.message}`);
      });
    });

    this.fileWatcher.on('unlink', filePath => {
      logger.info(`Template removed: ${filePath}`);
      this.syncTemplates().catch(error => {
        logger.error(`Auto-sync failed after file removal: ${error.message}`);
      });
    });

    this.fileWatcher.on('error', error => {
      logger.error(
        `File watcher error: ${error instanceof Error ? error.message : String(error)}`
      );
    });

    logger.info(`Started watching for changes in: ${validWatchPath}`);
  }

  /**
   * Stop watching files for changes and cleanup file watchers
   */
  stopWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
      logger.info('File watching stopped');
    }
  }

  /**
   * Dispose integration resources and cleanup singleton instance
   * Stops all timers, watchers, and clears caches
   */
  dispose(): void {
    this.stopAutoSync();
    this.stopWatching();
    this.commandIntegration?.dispose();
    this.bridge.clearCache();
    this.isInitialized = false;
    CursorIntegration.instance = null;
    logger.info('Cursor integration disposed');
  }
}

// Export main components
export { TemplateToRulesConverter } from './template-to-rules-converter';
export { ContextBridge, CursorContext } from './context-bridge';
// CursorCommandIntegration is not exported directly due to VS Code dependency

// Export types
export type { ConversionOptions } from './template-to-rules-converter';
export type { BridgeOptions, TemplateContext } from './context-bridge';
// CommandOptions and CommandHandler types are not exported due to VS Code dependency

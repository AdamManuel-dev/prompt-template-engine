/**
 * @fileoverview Cursor IDE Integration Main Module
 * @lastmodified 2025-08-25T21:44:14-05:00
 *
 * Features: Orchestrate Cursor IDE integration components
 * Main APIs: CursorIntegration class
 * Constraints: Handle both VS Code extension and standalone modes
 * Patterns: Facade pattern for integration components
 */

import { TemplateToRulesConverter } from './template-to-rules-converter';
import { ContextBridge } from './context-bridge';
import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';

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

export class CursorIntegration {
  private static instance: CursorIntegration | null = null;

  private converter: TemplateToRulesConverter;

  private bridge: ContextBridge;

  private commandIntegration?: any; // Dynamic import, type not available at compile time

  private syncTimer?: NodeJS.Timeout;

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
   * Get singleton instance
   */
  static getInstance(config?: CursorIntegrationConfig): CursorIntegration {
    if (!CursorIntegration.instance) {
      CursorIntegration.instance = new CursorIntegration(config);
    }
    return CursorIntegration.instance;
  }

  /**
   * Initialize Cursor integration
   */
  async initialize(context?: any): Promise<void> {
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
          this.commandIntegration = new CursorCommandIntegration(context, {
            enableQuickFix: this.config.enableQuickFix,
            enableAutoSuggest: this.config.enableAutoSuggest,
          });
          await this.commandIntegration.registerCommands();
          logger.info('Cursor commands registered');
        } catch (error) {
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
   * Sync templates to Cursor rules
   */
  async syncTemplates(): Promise<void> {
    logger.info('Syncing templates to Cursor rules...');

    try {
      const templateDir = '.cursor/templates';
      const rules = await this.converter.convertDirectory(templateDir);

      for (const rule of rules) {
        await this.converter.writeRule(rule);
      }

      logger.info(`Synced ${rules.length} templates to rules`);
    } catch (error) {
      logger.error('Failed to sync templates');
      throw error;
    }
  }

  /**
   * Start automatic template sync
   */
  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      try {
        await this.syncTemplates();
      } catch (error) {
        logger.error('Auto-sync failed');
      }
    }, this.config.syncInterval!);

    logger.info(`Auto-sync started (interval: ${this.config.syncInterval}ms)`);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
      logger.info('Auto-sync stopped');
    }
  }

  /**
   * Get converter instance
   */
  getConverter(): TemplateToRulesConverter {
    return this.converter;
  }

  /**
   * Get context bridge instance
   */
  getContextBridge(): ContextBridge {
    return this.bridge;
  }

  /**
   * Get command integration instance
   */
  getCommandIntegration(): any | undefined {
    return this.commandIntegration;
  }

  /**
   * Update configuration
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
   * Check if current project is a Cursor project
   * Required by TODO: Check for .cursor directory
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
   * Optimize template for Cursor context
   * Required by TODO: Truncate if too large, compress whitespace
   */
  async optimizeForContext(
    template: string | { name: string; content: string },
    maxLength = 8000
  ): Promise<string> {
    // Handle both string and object inputs
    let content: string;
    if (typeof template === 'string') {
      content = template;
    } else {
      content = template.content;
    }

    let optimized = content;

    // Compress whitespace
    optimized = optimized
      .replace(/\s+/g, ' ')           // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n')      // Remove empty lines
      .trim();                        // Remove leading/trailing whitespace

    // Truncate if too large
    if (optimized.length > maxLength) {
      optimized = optimized.substring(0, maxLength - 3) + '...';
      logger.warn(`Template truncated to ${maxLength} characters for Cursor context`);
    }

    return optimized;
  }

  /**
   * Start watching files for changes
   * Required by TODO: Set up file watchers, auto-sync on changes
   */
  startWatching(watchPath?: string): void {
    if (this.fileWatcher) {
      logger.warn('File watching already started');
      return;
    }

    const templatePath = watchPath || '.cursor/templates';
    
    if (!fs.existsSync(templatePath)) {
      logger.warn(`Watch path does not exist: ${templatePath}`);
      return;
    }

    this.fileWatcher = chokidar.watch(templatePath, {
      ignored: /node_modules|\.git/,
      persistent: true,
      ignoreInitial: true,
    });

    this.fileWatcher.on('add', (filePath) => {
      logger.info(`Template added: ${filePath}`);
      this.syncTemplates().catch(error => {
        logger.error(`Auto-sync failed after file add: ${error.message}`);
      });
    });

    this.fileWatcher.on('change', (filePath) => {
      logger.info(`Template changed: ${filePath}`);
      this.syncTemplates().catch(error => {
        logger.error(`Auto-sync failed after file change: ${error.message}`);
      });
    });

    this.fileWatcher.on('unlink', (filePath) => {
      logger.info(`Template removed: ${filePath}`);
      this.syncTemplates().catch(error => {
        logger.error(`Auto-sync failed after file removal: ${error.message}`);
      });
    });

    this.fileWatcher.on('error', (error) => {
      logger.error(`File watcher error: ${error instanceof Error ? error.message : String(error)}`);
    });

    logger.info(`Started watching for changes in: ${templatePath}`);
  }

  /**
   * Stop watching files for changes  
   * Required by TODO: Clear file watchers, stop auto-sync
   */
  stopWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
      logger.info('File watching stopped');
    }
  }

  /**
   * Dispose integration resources
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

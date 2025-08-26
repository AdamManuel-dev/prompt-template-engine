/**
 * @fileoverview Cursor IDE Integration Main Module
 * @lastmodified 2025-08-23T14:45:00Z
 *
 * Features: Orchestrate Cursor IDE integration components
 * Main APIs: CursorIntegration class
 * Constraints: Handle both VS Code extension and standalone modes
 * Patterns: Facade pattern for integration components
 */

import * as vscode from 'vscode';
import { TemplateToRulesConverter } from './template-to-rules-converter';
import { ContextBridge } from './context-bridge';
import { CursorCommandIntegration } from './command-integration';
import { logger } from '../../utils/logger';

export interface CursorIntegrationConfig {
  autoSync?: boolean;
  syncInterval?: number;
  enableCommands?: boolean;
  enableQuickFix?: boolean;
  enableAutoSuggest?: boolean;
  rulesOutputDir?: string;
  legacySupport?: boolean;
}

export class CursorIntegration {
  private static instance: CursorIntegration | null = null;

  private converter: TemplateToRulesConverter;

  private bridge: ContextBridge;

  private commandIntegration?: CursorCommandIntegration;

  private syncTimer?: NodeJS.Timeout;

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
  async initialize(context?: vscode.ExtensionContext): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Cursor integration already initialized');
      return;
    }

    logger.info('Initializing Cursor IDE integration...');

    try {
      // Initialize command integration if in VS Code context
      if (context && this.config.enableCommands) {
        this.commandIntegration = new CursorCommandIntegration(context, {
          enableQuickFix: this.config.enableQuickFix,
          enableAutoSuggest: this.config.enableAutoSuggest,
        });
        await this.commandIntegration.registerCommands();
        logger.info('Cursor commands registered');
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
  getCommandIntegration(): CursorCommandIntegration | undefined {
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
   * Dispose integration resources
   */
  dispose(): void {
    this.stopAutoSync();
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
export { CursorCommandIntegration } from './command-integration';

// Export types
export type { ConversionOptions } from './template-to-rules-converter';
export type { BridgeOptions, TemplateContext } from './context-bridge';
export type { CommandOptions, CommandHandler } from './command-integration';

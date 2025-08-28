/**
 * @fileoverview File watcher service for auto-optimization
 * @lastmodified 2025-08-27T04:50:00Z
 *
 * Features: File system watching, template file detection, debounced change handling
 * Main APIs: start(), stop(), addPattern(), removePattern()
 * Constraints: Single responsibility - only handles file watching
 * Patterns: Observer pattern, event emitter, debouncing
 */

import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../utils/logger';

export interface FileWatcherOptions {
  /** Watch patterns for template files */
  watchPatterns: string[];
  /** Debounce delay after file change (ms) */
  debounceMs: number;
  /** Working directory for relative patterns */
  cwd?: string;
}

export interface FileChangeEvent {
  filePath: string;
  absolutePath: string;
  eventType: 'add' | 'change' | 'unlink';
  timestamp: Date;
}

/**
 * File watcher service focused solely on monitoring file system changes
 *
 * This service replaces the file watching functionality that was previously
 * embedded in AutoOptimizeManager, following single responsibility principle.
 */
export class FileWatcherService extends EventEmitter {
  private watchers: FSWatcher[] = [];

  private options: FileWatcherOptions;

  private isWatching: boolean = false;

  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: FileWatcherOptions) {
    super();
    this.options = {
      cwd: process.cwd(),
      ...options,
    };
  }

  /**
   * Start file watching
   */
  async start(): Promise<void> {
    if (this.isWatching) {
      logger.warn('File watcher is already active');
      return;
    }

    try {
      this.options.watchPatterns.forEach(pattern => {
        const watcher = watch(pattern, {
          cwd: this.options.cwd,
          ignoreInitial: true,
          persistent: true,
          awaitWriteFinish: {
            stabilityThreshold: 1000,
            pollInterval: 100,
          },
        });

        watcher.on('add', (filePath: string) =>
          this.handleFileChange(filePath, 'add')
        );
        watcher.on('change', (filePath: string) =>
          this.handleFileChange(filePath, 'change')
        );
        watcher.on('unlink', (filePath: string) =>
          this.handleFileChange(filePath, 'unlink')
        );
        watcher.on('error', (error: unknown) =>
          this.emit(
            'error',
            error instanceof Error ? error : new Error(String(error))
          )
        );

        this.watchers.push(watcher);
      });

      this.isWatching = true;
      this.emit('started', { patterns: this.options.watchPatterns });

      logger.info(
        `File watcher started monitoring ${this.options.watchPatterns.length} patterns`
      );
    } catch (error: any) {
      logger.error('Failed to start file watcher', error as Error);
      throw error;
    }
  }

  /**
   * Stop file watching
   */
  async stop(): Promise<void> {
    if (!this.isWatching) {
      logger.warn('File watcher is not active');
      return;
    }

    try {
      // Clear debounce timers
      this.debounceTimers.forEach(timer => clearTimeout(timer));
      this.debounceTimers.clear();

      // Close all watchers
      await Promise.all(this.watchers.map(watcher => watcher.close()));
      this.watchers = [];

      this.isWatching = false;
      this.emit('stopped');

      logger.info('File watcher stopped');
    } catch (error: any) {
      logger.error('Failed to stop file watcher', error as Error);
      throw error;
    }
  }

  /**
   * Add a watch pattern
   */
  addPattern(pattern: string): void {
    if (this.options.watchPatterns.includes(pattern)) {
      logger.debug(`Pattern already being watched: ${pattern}`);
      return;
    }

    this.options.watchPatterns.push(pattern);

    if (this.isWatching) {
      // Add watcher for new pattern
      const watcher = watch(pattern, {
        cwd: this.options.cwd,
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 1000,
          pollInterval: 100,
        },
      });

      watcher.on('add', (filePath: string) =>
        this.handleFileChange(filePath, 'add')
      );
      watcher.on('change', (filePath: string) =>
        this.handleFileChange(filePath, 'change')
      );
      watcher.on('unlink', (filePath: string) =>
        this.handleFileChange(filePath, 'unlink')
      );
      watcher.on('error', (error: unknown) =>
        this.emit(
          'error',
          error instanceof Error ? error : new Error(String(error))
        )
      );

      this.watchers.push(watcher);
    }

    logger.info(`Added watch pattern: ${pattern}`);
  }

  /**
   * Remove a watch pattern
   */
  async removePattern(pattern: string): Promise<void> {
    const index = this.options.watchPatterns.indexOf(pattern);
    if (index === -1) {
      logger.debug(`Pattern not found: ${pattern}`);
      return;
    }

    this.options.watchPatterns.splice(index, 1);

    if (this.isWatching) {
      // This is simplified - in practice you'd need to track which watcher corresponds to which pattern
      logger.info(
        `Pattern removed (restart required to fully remove): ${pattern}`
      );
    }

    logger.info(`Removed watch pattern: ${pattern}`);
  }

  /**
   * Check if currently watching files
   */
  isActive(): boolean {
    return this.isWatching;
  }

  /**
   * Get current watch patterns
   */
  getPatterns(): string[] {
    return [...this.options.watchPatterns];
  }

  /**
   * Update debounce delay
   */
  setDebounceDelay(ms: number): void {
    this.options.debounceMs = ms;
    logger.info(`Updated debounce delay to ${ms}ms`);
  }

  // Private methods

  private handleFileChange(
    filePath: string,
    eventType: 'add' | 'change' | 'unlink'
  ): void {
    try {
      const absolutePath = path.resolve(this.options.cwd!, filePath);

      // Check if file is a template file
      if (!this.isTemplateFile(absolutePath)) {
        return;
      }

      // Debounce file changes
      const debounceKey = `${absolutePath}-${eventType}`;
      const existingTimer = this.debounceTimers.get(debounceKey);

      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        const event: FileChangeEvent = {
          filePath,
          absolutePath,
          eventType,
          timestamp: new Date(),
        };

        this.emit('file-change', event);
        this.debounceTimers.delete(debounceKey);
      }, this.options.debounceMs);

      this.debounceTimers.set(debounceKey, timer);

      logger.debug('Template file change detected', { filePath, eventType });
    } catch (error: any) {
      logger.error('Error handling file change', error as Error, {
        filePath,
        eventType,
      });
    }
  }

  private isTemplateFile(filePath: string): boolean {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const supportedExts = ['.prompt', '.md', '.txt', '.json'];

      // Check extension
      if (!supportedExts.includes(ext)) {
        return false;
      }

      // Check if file exists and is readable (for add/change events)
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        return stats.isFile() && stats.size > 0;
      }

      // For unlink events, we can't check the file but we trust the extension
      return true;
    } catch {
      return false;
    }
  }
}

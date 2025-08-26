/**
 * @fileoverview Context Bridge for Cursor IDE Integration
 * @lastmodified 2025-08-23T14:15:00Z
 *
 * Features: Bridge template context with Cursor's @file system
 * Main APIs: ContextBridge class
 * Constraints: Handle file references, caching, validation
 * Patterns: Adapter pattern for context translation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { Minimatch } from 'minimatch';
import { logger } from '../../utils/logger';

export interface CursorContext {
  activeFile?: string;
  selection?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  openFiles: string[];
  errors: Array<{
    file: string;
    line: number;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  gitStatus?: {
    branch: string;
    modified: string[];
    staged: string[];
    untracked: string[];
  };
  terminalOutput?: string;
  workspaceRoot: string;
}

export interface TemplateContext {
  files: string[];
  variables: Record<string, unknown>;
  references: string[];
  gitDiff?: string;
  errors?: string[];
  metadata?: Record<string, unknown>;
}

export interface BridgeOptions {
  maxFileSize?: number;
  includePaths?: string[];
  excludePaths?: string[];
  autoDetect?: boolean;
  cacheTimeout?: number;
  maxReferences?: number;
}

export class ContextBridge {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();

  private readonly defaultOptions: BridgeOptions = {
    maxFileSize: 1024 * 1024, // 1MB
    includePaths: ['src', 'lib', 'app'],
    excludePaths: ['node_modules', '.git', 'dist', 'build'],
    autoDetect: true,
    cacheTimeout: 60000, // 1 minute
    maxReferences: 50,
  };

  constructor(private options: BridgeOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Bridge Cursor context to template context
   */
  async bridgeContext(cursorContext: CursorContext): Promise<TemplateContext> {
    const cacheKey = this.getCacheKey(cursorContext);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as TemplateContext;
    }

    const templateContext: TemplateContext = {
      files: await this.mapFilesToContext(cursorContext),
      variables: await this.extractVariables(cursorContext),
      references: await this.generateReferences(cursorContext),
    };

    // Add optional context
    if (cursorContext.gitStatus) {
      templateContext.gitDiff = await this.getGitDiff(cursorContext.gitStatus);
    }

    if (cursorContext.errors && cursorContext.errors.length > 0) {
      templateContext.errors = this.formatErrors(cursorContext.errors);
    }

    if (cursorContext.terminalOutput) {
      templateContext.metadata = {
        ...templateContext.metadata,
        terminalOutput: this.truncateOutput(cursorContext.terminalOutput),
      };
    }

    this.setCache(cacheKey, templateContext);
    return templateContext;
  }

  /**
   * Convert file patterns to Cursor @file references
   */
  async mapFilesToReferences(patterns: string[]): Promise<string[]> {
    const references: Set<string> = new Set();

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          ignore: this.options.excludePaths,
          cwd: process.cwd(),
        });

        for (const file of files) {
          if (await this.isValidFile(file)) {
            references.add(this.toFileReference(file));
          }
        }
      } catch (error) {
        logger.warn(`Failed to resolve pattern ${pattern}`);
      }
    }

    // Limit references to prevent context overflow
    const refs = Array.from(references);
    if (refs.length > this.options.maxReferences!) {
      logger.warn(
        `Truncating references from ${refs.length} to ${this.options.maxReferences}`
      );
      return refs.slice(0, this.options.maxReferences);
    }

    return refs;
  }

  /**
   * Resolve context variables from Cursor state
   */
  async resolveContextVariables(
    context: CursorContext
  ): Promise<Record<string, unknown>> {
    const variables: Record<string, unknown> = {};

    // File-related variables
    if (context.activeFile) {
      variables.currentFile = context.activeFile;
      variables.fileName = path.basename(context.activeFile);
      variables.fileDir = path.dirname(context.activeFile);
      variables.fileExt = path.extname(context.activeFile);
    }

    // Selection variables
    if (context.selection) {
      variables.selectedText = await this.getSelectedText(context);
      variables.selectionStart = context.selection.start;
      variables.selectionEnd = context.selection.end;
    }

    // Error variables
    if (context.errors && context.errors.length > 0) {
      variables.hasErrors = true;
      variables.errorCount = context.errors.length;
      variables.firstError = context.errors[0];
    }

    // Git variables
    if (context.gitStatus) {
      variables.gitBranch = context.gitStatus.branch;
      variables.hasChanges = context.gitStatus.modified.length > 0;
      variables.modifiedFiles = context.gitStatus.modified;
    }

    // Workspace variables
    variables.workspaceRoot = context.workspaceRoot;
    variables.workspaceName = path.basename(context.workspaceRoot);

    return variables;
  }

  /**
   * Generate file references for Cursor
   */
  private async generateReferences(context: CursorContext): Promise<string[]> {
    const references: string[] = [];

    // Add active file
    if (context.activeFile) {
      references.push(this.toFileReference(context.activeFile));
    }

    // Add open files
    for (const file of context.openFiles) {
      if (!references.includes(this.toFileReference(file))) {
        references.push(this.toFileReference(file));
      }
    }

    // Add error files
    if (context.errors) {
      for (const error of context.errors) {
        const ref = this.toFileReference(error.file);
        if (!references.includes(ref)) {
          references.push(ref);
        }
      }
    }

    // Add modified files from git
    if (context.gitStatus?.modified) {
      for (const file of context.gitStatus.modified.slice(0, 5)) {
        const ref = this.toFileReference(file);
        if (!references.includes(ref)) {
          references.push(ref);
        }
      }
    }

    // Auto-detect related files if enabled
    if (this.options.autoDetect && context.activeFile) {
      const related = await this.findRelatedFiles(context.activeFile);
      for (const file of related) {
        const ref = this.toFileReference(file);
        if (
          !references.includes(ref) &&
          references.length < this.options.maxReferences!
        ) {
          references.push(ref);
        }
      }
    }

    return references;
  }

  /**
   * Map files to context based on Cursor state
   */
  private async mapFilesToContext(context: CursorContext): Promise<string[]> {
    const files: string[] = [];

    // Priority 1: Active file
    if (context.activeFile) {
      files.push(context.activeFile);
    }

    // Priority 2: Files with errors
    if (context.errors) {
      for (const error of context.errors) {
        if (!files.includes(error.file)) {
          files.push(error.file);
        }
      }
    }

    // Priority 3: Open files
    for (const file of context.openFiles) {
      if (!files.includes(file) && files.length < 10) {
        files.push(file);
      }
    }

    // Priority 4: Modified files
    if (context.gitStatus?.modified) {
      for (const file of context.gitStatus.modified) {
        if (!files.includes(file) && files.length < 15) {
          files.push(file);
        }
      }
    }

    return files;
  }

  /**
   * Extract variables from Cursor context
   */
  private async extractVariables(
    context: CursorContext
  ): Promise<Record<string, unknown>> {
    return this.resolveContextVariables(context);
  }

  /**
   * Convert file path to Cursor @file reference
   */
  private toFileReference(filePath: string): string {
    // Normalize path
    let normalized = filePath.replace(/\\/g, '/');

    // Make relative to workspace if absolute
    if (path.isAbsolute(normalized)) {
      normalized = path.relative(process.cwd(), normalized);
    }

    // Remove leading ./ if present
    if (normalized.startsWith('./')) {
      normalized = normalized.substring(2);
    }

    // Add @ prefix
    return `@${normalized}`;
  }

  /**
   * Find files related to the given file
   */
  private async findRelatedFiles(filePath: string): Promise<string[]> {
    const related: string[] = [];
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));

    // Look for test files
    const testPatterns = [
      `${baseName}.test.*`,
      `${baseName}.spec.*`,
      `test-${baseName}.*`,
      `${baseName}-test.*`,
    ];

    for (const pattern of testPatterns) {
      try {
        const files = await glob(path.join(dir, pattern));
        related.push(...files);
      } catch {
        // Ignore glob errors
      }
    }

    // Look for related component files (for React/Vue)
    if (filePath.match(/\.(tsx?|jsx?)$/)) {
      const componentPatterns = [
        `${baseName}.css`,
        `${baseName}.scss`,
        `${baseName}.module.css`,
        `${baseName}.styles.*`,
      ];

      for (const pattern of componentPatterns) {
        try {
          const files = await glob(path.join(dir, pattern));
          related.push(...files);
        } catch {
          // Ignore glob errors
        }
      }
    }

    // Look for interface/type definitions
    if (baseName.endsWith('.service') || baseName.endsWith('.controller')) {
      const interfaceFiles = [
        `${baseName.replace(/.service|.controller/, '')}.interface.ts`,
        `${baseName.replace(/.service|.controller/, '')}.types.ts`,
      ];

      for (const file of interfaceFiles) {
        const fullPath = path.join(dir, file);
        if (await this.fileExists(fullPath)) {
          related.push(fullPath);
        }
      }
    }

    return related.slice(0, 5); // Limit related files
  }

  /**
   * Check if file is valid for inclusion
   */
  private async isValidFile(filePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);

      // Check file size
      if (stats.size > this.options.maxFileSize!) {
        return false;
      }

      // Check if it's a file (not directory)
      if (!stats.isFile()) {
        return false;
      }

      // Check against exclude patterns
      for (const exclude of this.options.excludePaths!) {
        const mm = new Minimatch(exclude);
        if (mm.match(filePath)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get selected text from file
   */
  private async getSelectedText(context: CursorContext): Promise<string> {
    if (!context.activeFile || !context.selection) {
      return '';
    }

    try {
      const content = await fs.readFile(context.activeFile, 'utf-8');
      const lines = content.split('\n');

      const startLine = context.selection.start.line;
      const endLine = context.selection.end.line;
      const startChar = context.selection.start.character;
      const endChar = context.selection.end.character;

      if (startLine === endLine) {
        return lines[startLine].substring(startChar, endChar);
      }

      const selectedLines = [];
      selectedLines.push(lines[startLine].substring(startChar));

      for (let i = startLine + 1; i < endLine; i++) {
        selectedLines.push(lines[i]);
      }

      selectedLines.push(lines[endLine].substring(0, endChar));

      return selectedLines.join('\n');
    } catch (error) {
      logger.warn('Failed to get selected text');
      return '';
    }
  }

  /**
   * Get git diff for modified files
   */
  private async getGitDiff(
    gitStatus: CursorContext['gitStatus']
  ): Promise<string> {
    if (!gitStatus || gitStatus.modified.length === 0) {
      return '';
    }

    try {
      const { execSync } = require('child_process');
      const diff = execSync('git diff --cached', { encoding: 'utf-8' });
      return this.truncateOutput(diff);
    } catch (error) {
      logger.warn('Failed to get git diff');
      return '';
    }
  }

  /**
   * Format errors for template context
   */
  private formatErrors(errors: CursorContext['errors']): string[] {
    return errors.map(
      error =>
        `[${error.severity.toUpperCase()}] ${error.file}:${error.line} - ${error.message}`
    );
  }

  /**
   * Truncate output to reasonable size
   */
  private truncateOutput(output: string, maxLength = 5000): string {
    if (output.length <= maxLength) {
      return output;
    }
    return `${output.substring(0, maxLength)}\n... (truncated)`;
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cache management
   */
  private getCacheKey(context: CursorContext): string {
    const key = JSON.stringify({
      activeFile: context.activeFile,
      openFiles: context.openFiles,
      errors: context.errors?.length,
      gitBranch: context.gitStatus?.branch,
    });
    return Buffer.from(key).toString('base64');
  }

  private getFromCache(key: string): unknown | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.options.cacheTimeout!) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }
}

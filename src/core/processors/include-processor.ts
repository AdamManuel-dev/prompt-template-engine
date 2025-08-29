/**
 * @fileoverview Include processor for template engine
 * @lastmodified 2025-08-22T21:30:00Z
 *
 * Features: Template file inclusion with circular dependency detection
 * Main APIs: processIncludes(), resolveIncludePath()
 * Constraints: Prevents circular includes, validates file paths
 * Patterns: File system integration with safety checks
 */

import * as fs from 'fs';
import * as path from 'path';
import { TemplateContext } from '../../types';
import { logger } from '../../utils/logger';

export class IncludeProcessor {
  private includePattern = /\{\{#include\s+["']([^"']+)["']\s*\}\}/g;

  private includedFiles = new Set<string>();

  private maxFileSize = 1024 * 1024; // 1MB limit

  constructor(private basePath?: string) {
    this.basePath = basePath || process.cwd();
  }

  /**
   * Process include directives in template
   */
  public async processIncludes(
    template: string,
    context: TemplateContext,
    depth = 0
  ): Promise<string> {
    // Reset tracking for top-level calls
    if (depth === 0) {
      this.includedFiles.clear();
    }

    const maxDepth = 10;
    if (depth > maxDepth) {
      throw new Error('Maximum include depth exceeded');
    }

    const matches = Array.from(template.matchAll(this.includePattern));
    if (matches.length === 0) {
      return template;
    }

    let result = template;

    for (const match of matches) {
      const [fullMatch, includePath] = match;
      if (!includePath) {
        continue;
      }
      const absolutePath = this.resolveIncludePath(includePath);

      // Check for circular dependencies
      if (this.includedFiles.has(absolutePath)) {
        throw new Error(
          `Circular dependency detected: ${absolutePath} is already included`
        );
      }

      try {
        // Validate file exists and is safe to read
        const stats = await fs.promises.stat(absolutePath);
        if (!stats.isFile()) {
          throw new Error(`Include path is not a file: ${absolutePath}`);
        }
        if (stats.size > this.maxFileSize) {
          throw new Error(
            `Include file too large: ${absolutePath} (${stats.size} bytes)`
          );
        }

        // Read and process the included file
        this.includedFiles.add(absolutePath);
        const content = await fs.promises.readFile(absolutePath, 'utf8');

        // Recursively process includes in the included content
        const processed = await this.processIncludes(
          content,
          context,
          depth + 1
        );

        result = result.replace(fullMatch, processed);

        // Remove from tracking after successful processing at this depth level
        this.includedFiles.delete(absolutePath);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`Failed to include file ${includePath}: ${errorMessage}`);

        throw new Error(`Failed to include template: ${includePath}`);
      }
    }

    return result;
  }

  /**
   * Resolve include path to absolute path
   */
  private resolveIncludePath(includePath: string): string {
    // Prevent path traversal attacks
    if (includePath.includes('..')) {
      throw new Error(`Invalid include path: ${includePath}`);
    }

    // If absolute path, validate it's within allowed directory
    if (path.isAbsolute(includePath)) {
      const normalizedPath = path.normalize(includePath);
      const normalizedBase = path.normalize(this.basePath!);

      if (!normalizedPath.startsWith(normalizedBase)) {
        throw new Error(
          `Include path outside of base directory: ${includePath}`
        );
      }

      return normalizedPath;
    }

    // Resolve relative to base path
    return path.resolve(this.basePath!, includePath);
  }

  /**
   * Reset included files tracking
   */
  public reset(): void {
    this.includedFiles.clear();
  }
}

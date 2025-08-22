/**
 * @fileoverview File system implementation of repository pattern
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: File system storage operations
 * Main APIs: Implements BaseRepository for local file system
 * Constraints: Node.js fs module based
 * Patterns: Repository pattern implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
  AbstractRepository,
  ListOptions,
  StorageMetadata,
} from './base.repository';
import { FileNotFoundError } from '../utils/errors';

export interface FileSystemOptions {
  encoding?:
    | 'ascii'
    | 'utf8'
    | 'utf-8'
    | 'utf16le'
    | 'ucs2'
    | 'ucs-2'
    | 'base64'
    | 'base64url'
    | 'latin1'
    | 'binary'
    | 'hex';
  rootPath?: string;
  createDirectories?: boolean;
}

export class FileSystemRepository extends AbstractRepository<string> {
  private readonly encoding:
    | 'ascii'
    | 'utf8'
    | 'utf-8'
    | 'utf16le'
    | 'ucs2'
    | 'ucs-2'
    | 'base64'
    | 'base64url'
    | 'latin1'
    | 'binary'
    | 'hex';

  private readonly rootPath: string;

  private readonly createDirectories: boolean;

  constructor(options: FileSystemOptions = {}) {
    super();
    this.encoding = options.encoding || 'utf8';
    this.rootPath = options.rootPath || process.cwd();
    this.createDirectories = options.createDirectories ?? true;
  }

  /**
   * Resolve path relative to root
   */
  private resolvePath(relativePath: string): string {
    return path.isAbsolute(relativePath)
      ? relativePath
      : path.join(this.rootPath, relativePath);
  }

  /**
   * Read file content
   */
  async read(filePath: string): Promise<string> {
    const resolvedPath = this.resolvePath(filePath);

    if (!(await this.exists(filePath))) {
      throw new FileNotFoundError(
        `File not found: ${resolvedPath}`,
        resolvedPath
      );
    }

    return fs.promises.readFile(resolvedPath, this.encoding);
  }

  /**
   * Write file content
   */
  async write(filePath: string, content: string): Promise<void> {
    const resolvedPath = this.resolvePath(filePath);

    // Create directory if needed
    if (this.createDirectories) {
      const dir = path.dirname(resolvedPath);
      if (!(await this.exists(dir))) {
        await this.createDirectory(dir);
      }
    }

    await fs.promises.writeFile(resolvedPath, content, this.encoding);
  }

  /**
   * Check if path exists
   */
  async exists(filePath: string): Promise<boolean> {
    const resolvedPath = this.resolvePath(filePath);
    try {
      await fs.promises.access(resolvedPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete file or directory
   */
  async delete(filePath: string): Promise<void> {
    const resolvedPath = this.resolvePath(filePath);

    if (!(await this.exists(filePath))) {
      throw new FileNotFoundError(
        `Path not found: ${resolvedPath}`,
        resolvedPath
      );
    }

    const stats = await fs.promises.stat(resolvedPath);

    if (stats.isDirectory()) {
      await fs.promises.rm(resolvedPath, { recursive: true, force: true });
    } else {
      await fs.promises.unlink(resolvedPath);
    }
  }

  /**
   * List directory contents
   */
  async list(dirPath: string, options?: ListOptions): Promise<string[]> {
    const resolvedPath = this.resolvePath(dirPath);

    if (!(await this.exists(dirPath))) {
      throw new FileNotFoundError(
        `Directory not found: ${resolvedPath}`,
        resolvedPath
      );
    }

    const stats = await fs.promises.stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedPath}`);
    }

    if (options?.pattern) {
      // Use glob for pattern matching
      const pattern = path.join(resolvedPath, options.pattern);
      const files = await glob(pattern, {
        nodir: !options.includeDirectories,
        dot: true,
        maxDepth: options.maxDepth,
      });
      return files.map(f => path.relative(resolvedPath, f));
    }

    // Simple directory listing
    if (!options?.recursive) {
      const entries = await fs.promises.readdir(resolvedPath, {
        withFileTypes: true,
      });

      return entries
        .filter(entry => {
          if (options?.includeDirectories === false && entry.isDirectory()) {
            return false;
          }
          if (options?.includeFiles === false && entry.isFile()) {
            return false;
          }
          return true;
        })
        .map(entry => entry.name);
    }

    // Recursive listing
    const results: string[] = [];
    await this.listRecursive(resolvedPath, resolvedPath, results, options);
    return results;
  }

  /**
   * Recursive directory listing helper
   */
  private async listRecursive(
    basePath: string,
    currentPath: string,
    results: string[],
    options?: ListOptions,
    depth: number = 0
  ): Promise<void> {
    if (options?.maxDepth !== undefined && depth > options.maxDepth) {
      return;
    }

    const entries = await fs.promises.readdir(currentPath, {
      withFileTypes: true,
    });

    await Promise.all(
      entries.map(async entry => {
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
          if (options?.includeDirectories !== false) {
            results.push(relativePath);
          }
          await this.listRecursive(
            basePath,
            fullPath,
            results,
            options,
            depth + 1
          );
        } else if (entry.isFile()) {
          if (options?.includeFiles !== false) {
            results.push(relativePath);
          }
        }
      })
    );
  }

  /**
   * Get file/directory metadata
   */
  async getMetadata(filePath: string): Promise<StorageMetadata> {
    const resolvedPath = this.resolvePath(filePath);

    if (!(await this.exists(filePath))) {
      throw new FileNotFoundError(
        `Path not found: ${resolvedPath}`,
        resolvedPath
      );
    }

    const stats = await fs.promises.stat(resolvedPath);

    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isDirectory: stats.isDirectory(),
      permissions: stats.mode.toString(8),
    };
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath: string): Promise<void> {
    const resolvedPath = this.resolvePath(dirPath);
    await fs.promises.mkdir(resolvedPath, { recursive: true });
  }

  /**
   * Copy file or directory
   */
  async copy(source: string, destination: string): Promise<void> {
    const sourcePath = this.resolvePath(source);
    const destPath = this.resolvePath(destination);

    if (!(await this.exists(source))) {
      throw new FileNotFoundError(
        `Source not found: ${sourcePath}`,
        sourcePath
      );
    }

    const stats = await fs.promises.stat(sourcePath);

    if (stats.isDirectory()) {
      // Copy directory recursively
      await this.copyDirectory(sourcePath, destPath);
    } else {
      // Copy file
      await fs.promises.copyFile(sourcePath, destPath);
    }
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(
    source: string,
    destination: string
  ): Promise<void> {
    await this.createDirectory(destination);

    const entries = await fs.promises.readdir(source, { withFileTypes: true });

    await Promise.all(
      entries.map(async entry => {
        const sourcePath = path.join(source, entry.name);
        const destPath = path.join(destination, entry.name);

        if (entry.isDirectory()) {
          await this.copyDirectory(sourcePath, destPath);
        } else {
          await fs.promises.copyFile(sourcePath, destPath);
        }
      })
    );
  }

  /**
   * Move file or directory
   */
  async move(source: string, destination: string): Promise<void> {
    const sourcePath = this.resolvePath(source);
    const destPath = this.resolvePath(destination);

    if (!(await this.exists(source))) {
      throw new FileNotFoundError(
        `Source not found: ${sourcePath}`,
        sourcePath
      );
    }

    // Try rename first (fast for same filesystem)
    try {
      await fs.promises.rename(sourcePath, destPath);
    } catch {
      // Fall back to copy and delete
      await this.copy(source, destination);
      await this.delete(source);
    }
  }
}

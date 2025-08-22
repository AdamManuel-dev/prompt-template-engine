/**
 * @fileoverview In-memory implementation of repository pattern for testing
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: In-memory storage for testing and caching
 * Main APIs: Implements BaseRepository with Map storage
 * Constraints: Data lost on process restart
 * Patterns: Repository pattern, test double
 */

import * as path from 'path';
import {
  AbstractRepository,
  ListOptions,
  StorageMetadata,
} from './base.repository';
import { FileNotFoundError } from '../utils/errors';

interface MemoryFile {
  content: string;
  metadata: StorageMetadata;
}

export default class MemoryRepository extends AbstractRepository<string> {
  private storage: Map<string, MemoryFile>;

  constructor() {
    super();
    this.storage = new Map();
  }

  /**
   * Normalize path for consistency
   */
  private static normalizePath(filePath: string): string {
    return path.normalize(filePath).replace(/\\/g, '/');
  }

  /**
   * Create metadata for a file
   */
  private static createMetadata(isDirectory: boolean = false): StorageMetadata {
    const now = new Date();
    return {
      size: 0,
      created: now,
      modified: now,
      isDirectory,
      permissions: '644',
    };
  }

  /**
   * Read content from memory
   */
  async read(filePath: string): Promise<string> {
    const normalizedPath = MemoryRepository.normalizePath(filePath);
    const file = this.storage.get(normalizedPath);

    if (!file) {
      throw new FileNotFoundError(`File not found: ${filePath}`, filePath);
    }

    if (file.metadata.isDirectory) {
      throw new Error(`Path is a directory: ${filePath}`);
    }

    return file.content;
  }

  /**
   * Write content to memory
   */
  async write(filePath: string, content: string): Promise<void> {
    const normalizedPath = MemoryRepository.normalizePath(filePath);
    const existing = this.storage.get(normalizedPath);

    const metadata = existing?.metadata || MemoryRepository.createMetadata();
    metadata.modified = new Date();
    metadata.size = content.length;

    this.storage.set(normalizedPath, {
      content,
      metadata,
    });

    // Create parent directories
    const dir = path.dirname(normalizedPath);
    if (dir && dir !== '.' && dir !== '/') {
      await this.createDirectory(dir);
    }
  }

  /**
   * Check if path exists
   */
  async exists(filePath: string): Promise<boolean> {
    const normalizedPath = MemoryRepository.normalizePath(filePath);
    return this.storage.has(normalizedPath);
  }

  /**
   * Delete from memory
   */
  async delete(filePath: string): Promise<void> {
    const normalizedPath = MemoryRepository.normalizePath(filePath);

    if (!this.storage.has(normalizedPath)) {
      throw new FileNotFoundError(`Path not found: ${filePath}`, filePath);
    }

    const file = this.storage.get(normalizedPath);

    if (file?.metadata.isDirectory) {
      // Delete directory and all contents
      const prefix = `${normalizedPath}/`;
      const toDelete = [normalizedPath];

      this.storage.forEach((_, key) => {
        if (key.startsWith(prefix)) {
          toDelete.push(key);
        }
      });

      toDelete.forEach(key => this.storage.delete(key));
    } else {
      this.storage.delete(normalizedPath);
    }
  }

  /**
   * List directory contents
   */
  async list(dirPath: string, options?: ListOptions): Promise<string[]> {
    const normalizedPath = MemoryRepository.normalizePath(dirPath);
    const file = this.storage.get(normalizedPath);

    if (!file && normalizedPath !== '/' && normalizedPath !== '.') {
      throw new FileNotFoundError(`Directory not found: ${dirPath}`, dirPath);
    }

    if (file && !file.metadata.isDirectory) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    const results: string[] = [];
    const prefix =
      normalizedPath === '/' || normalizedPath === '.'
        ? ''
        : `${normalizedPath}/`;
    const prefixLength = prefix.length;

    this.storage.forEach((fileData, key) => {
      if (prefix && !key.startsWith(prefix)) {
        return;
      }

      const relativePath = prefix ? key.substring(prefixLength) : key;

      // Skip the directory itself
      if (!relativePath) {
        return;
      }

      const depth = relativePath.split('/').length - 1;

      // Check depth limit
      if (options?.maxDepth !== undefined && depth > options.maxDepth) {
        return;
      }

      // Non-recursive: only immediate children
      if (!options?.recursive && depth > 0) {
        return;
      }

      // Filter by type
      if (
        options?.includeDirectories === false &&
        fileData.metadata.isDirectory
      ) {
        return;
      }
      if (options?.includeFiles === false && !fileData.metadata.isDirectory) {
        return;
      }

      // Pattern matching
      if (options?.pattern) {
        const pattern = new RegExp(
          options.pattern.replace(/\*/g, '.*').replace(/\?/g, '.')
        );
        if (!pattern.test(relativePath)) {
          return;
        }
      }

      results.push(relativePath);
    });

    return results.sort();
  }

  /**
   * Get metadata
   */
  async getMetadata(filePath: string): Promise<StorageMetadata> {
    const normalizedPath = MemoryRepository.normalizePath(filePath);
    const file = this.storage.get(normalizedPath);

    if (!file) {
      throw new FileNotFoundError(`Path not found: ${filePath}`, filePath);
    }

    return { ...file.metadata };
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath: string): Promise<void> {
    const normalizedPath = MemoryRepository.normalizePath(dirPath);

    if (!this.storage.has(normalizedPath)) {
      this.storage.set(normalizedPath, {
        content: '',
        metadata: MemoryRepository.createMetadata(true),
      });
    }

    // Create parent directories
    const parent = path.dirname(normalizedPath);
    if (
      parent &&
      parent !== '.' &&
      parent !== '/' &&
      parent !== normalizedPath
    ) {
      await this.createDirectory(parent);
    }
  }

  /**
   * Clear all storage
   */
  clear(): void {
    this.storage.clear();
  }

  /**
   * Get storage size
   */
  size(): number {
    return this.storage.size;
  }

  /**
   * Export storage for debugging
   */
  export(): Map<string, MemoryFile> {
    return new Map(this.storage);
  }

  /**
   * Import storage for testing
   */
  import(data: Map<string, MemoryFile>): void {
    this.storage = new Map(data);
  }
}

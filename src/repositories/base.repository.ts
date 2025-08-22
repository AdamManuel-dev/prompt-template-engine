/**
 * @fileoverview Base repository interface for storage abstraction
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: Abstract storage operations for different backends
 * Main APIs: read, write, exists, delete, list
 * Constraints: Async operations, error handling
 * Patterns: Repository pattern, abstraction layer
 */

export interface StorageMetadata {
  size?: number;
  created?: Date;
  modified?: Date;
  isDirectory?: boolean;
  permissions?: string;
}

export interface ListOptions {
  recursive?: boolean;
  pattern?: string;
  includeDirectories?: boolean;
  includeFiles?: boolean;
  maxDepth?: number;
}

export interface BaseRepository<T = string> {
  /**
   * Read content from storage
   */
  read(path: string): Promise<T>;

  /**
   * Write content to storage
   */
  write(path: string, content: T): Promise<void>;

  /**
   * Check if path exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Delete content from storage
   */
  delete(path: string): Promise<void>;

  /**
   * List contents of a directory
   */
  list(path: string, options?: ListOptions): Promise<string[]>;

  /**
   * Get metadata about a path
   */
  getMetadata(path: string): Promise<StorageMetadata>;

  /**
   * Create a directory
   */
  createDirectory(path: string): Promise<void>;

  /**
   * Copy content from one path to another
   */
  copy(source: string, destination: string): Promise<void>;

  /**
   * Move content from one path to another
   */
  move(source: string, destination: string): Promise<void>;
}

export abstract class AbstractRepository<T = string>
  implements BaseRepository<T>
{
  abstract read(path: string): Promise<T>;

  abstract write(path: string, content: T): Promise<void>;

  abstract exists(path: string): Promise<boolean>;

  abstract delete(path: string): Promise<void>;

  abstract list(path: string, options?: ListOptions): Promise<string[]>;

  abstract getMetadata(path: string): Promise<StorageMetadata>;

  abstract createDirectory(path: string): Promise<void>;

  /**
   * Default copy implementation using read/write
   */
  async copy(source: string, destination: string): Promise<void> {
    const content = await this.read(source);
    await this.write(destination, content);
  }

  /**
   * Default move implementation using copy/delete
   */
  async move(source: string, destination: string): Promise<void> {
    await this.copy(source, destination);
    await this.delete(source);
  }
}

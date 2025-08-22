/**
 * @fileoverview File system abstraction interfaces for dependency injection
 * @lastmodified 2025-08-22T15:00:00Z
 *
 * Features: Abstractions for filesystem operations, glob operations, and ignore patterns
 * Main APIs: IFileSystem, IGlobService, IIgnoreService
 * Constraints: Async operations, error handling, testability
 * Patterns: Interface segregation principle, dependency injection ready
 */

import { Dirent, Stats } from 'fs';
// Use Node.js built-in type for buffer encoding
type BufferEncoding =
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

/**
 * File system operations interface
 */
export interface IFileSystem {
  /**
   * Read file content asynchronously
   */
  readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer>;

  /**
   * Read file content synchronously
   */
  readFileSync(path: string, encoding?: BufferEncoding): string | Buffer;

  /**
   * Get file/directory stats asynchronously
   */
  stat(path: string): Promise<Stats>;

  /**
   * Check if file/directory exists
   */
  exists(path: string): boolean;

  /**
   * Read directory contents
   */
  readdir(
    path: string,
    options?: { withFileTypes?: boolean }
  ): Promise<string[] | Dirent[]>;

  /**
   * Open file for reading
   */
  openSync(path: string, flags: string): number;

  /**
   * Read from file descriptor
   */
  readSync(
    fd: number,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number
  ): number;

  /**
   * Close file descriptor
   */
  closeSync(fd: number): void;
}

/**
 * Glob pattern matching interface
 */
export interface IGlobService {
  /**
   * Find files matching glob patterns
   */
  glob(
    pattern: string,
    options: {
      cwd: string;
      absolute?: boolean;
      nodir?: boolean;
      ignore?: string[];
    }
  ): Promise<string[]>;
}

/**
 * Ignore pattern matcher interface
 */
export interface IIgnoreMatcher {
  /**
   * Add ignore patterns
   */
  add(patterns: string | string[]): IIgnoreMatcher;

  /**
   * Check if path is ignored
   */
  ignores(path: string): boolean;
}

/**
 * Gitignore pattern matching interface
 */
export interface IIgnoreService {
  /**
   * Create ignore matcher from content
   */
  create(): IIgnoreMatcher;
}

/**
 * File operations result types
 */
export interface FileOperationResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * File system error types
 */
export enum FileSystemErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_PATH = 'INVALID_PATH',
  READ_ERROR = 'READ_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Custom file system error
 */
export class FileSystemError extends Error {
  constructor(
    public readonly type: FileSystemErrorType,
    message: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}

/**
 * @fileoverview Mock file system implementation for testing
 * @lastmodified 2025-08-22T15:05:00Z
 *
 * Features: Mock file system operations, configurable error handling
 * Main APIs: MockFileSystem class with IFileSystem interface implementation
 * Constraints: Jest-compatible mocking, supports both async and sync operations
 * Patterns: Mock pattern, dependency injection testing
 */

import { Dirent, Stats } from 'fs';
import {
  IFileSystem,
  FileSystemError,
  FileSystemErrorType,
} from '../interfaces/file-system.interface';
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
 * Mock file data structure
 */
export interface MockFileData {
  content: string | Buffer;
  stats: Partial<Stats>;
  isDirectory?: boolean;
  exists?: boolean;
}

/**
 * Mock file system for testing
 */
export class MockFileSystem implements IFileSystem {
  private files: Map<string, MockFileData> = new Map();

  private shouldThrowErrors: Map<string, FileSystemError> = new Map();

  /**
   * Set mock file data
   */
  setFile(path: string, data: MockFileData): void {
    this.files.set(path, data);
  }

  /**
   * Set error to throw for specific path
   */
  setError(path: string, error: FileSystemError): void {
    this.shouldThrowErrors.set(path, error);
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.files.clear();
    this.shouldThrowErrors.clear();
  }

  async readFile(
    path: string,
    encoding?: BufferEncoding
  ): Promise<string | Buffer> {
    if (this.shouldThrowErrors.has(path)) {
      const error = this.shouldThrowErrors.get(path)!;
      throw new Error(error.message);
    }

    const file = this.files.get(path);
    if (!file || file.exists === false) {
      throw new FileSystemError(
        FileSystemErrorType.FILE_NOT_FOUND,
        `File not found: ${path}`
      );
    }

    return encoding ? file.content.toString(encoding) : file.content;
  }

  readFileSync(path: string, encoding?: BufferEncoding): string | Buffer {
    if (this.shouldThrowErrors.has(path)) {
      const error = this.shouldThrowErrors.get(path)!;
      throw new Error(error.message);
    }

    const file = this.files.get(path);
    if (!file || file.exists === false) {
      throw new FileSystemError(
        FileSystemErrorType.FILE_NOT_FOUND,
        `File not found: ${path}`
      );
    }

    return encoding ? file.content.toString(encoding) : file.content;
  }

  async stat(path: string): Promise<Stats> {
    if (this.shouldThrowErrors.has(path)) {
      const error = this.shouldThrowErrors.get(path)!;
      throw new Error(error.message);
    }

    const file = this.files.get(path);
    if (!file || file.exists === false) {
      throw new FileSystemError(
        FileSystemErrorType.FILE_NOT_FOUND,
        `File not found: ${path}`
      );
    }

    const defaultStats: Stats = {
      isFile: () => !file.isDirectory,
      isDirectory: () => !!file.isDirectory,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      dev: 0,
      ino: 0,
      mode: 0,
      nlink: 0,
      uid: 0,
      gid: 0,
      rdev: 0,
      size:
        typeof file.content === 'string'
          ? file.content.length
          : file.content.length,
      blksize: 0,
      blocks: 0,
      atimeMs: Date.now(),
      mtimeMs: Date.now(),
      ctimeMs: Date.now(),
      birthtimeMs: Date.now(),
      atime: new Date(),
      mtime: new Date(),
      ctime: new Date(),
      birthtime: new Date(),
    };

    return { ...defaultStats, ...file.stats } as Stats;
  }

  exists(path: string): boolean {
    const file = this.files.get(path);
    return !!file && file.exists !== false;
  }

  async readdir(
    path: string,
    options?: { withFileTypes?: boolean }
  ): Promise<string[] | Dirent[]> {
    if (this.shouldThrowErrors.has(path)) {
      const error = this.shouldThrowErrors.get(path)!;
      throw new Error(error.message);
    }

    const file = this.files.get(path);
    if (!file || !file.isDirectory) {
      throw new FileSystemError(
        FileSystemErrorType.INVALID_PATH,
        `Not a directory: ${path}`
      );
    }

    // Get all files that are children of this directory
    const filePaths = Array.from(this.files.keys());
    const children = filePaths
      .filter(filePath => filePath.startsWith(`${path}/`))
      .map(filePath => filePath.substring(path.length + 1))
      .filter(relativePath => !relativePath.includes('/'));

    if (options?.withFileTypes) {
      return children.map((name): Dirent => {
        const fullPath = `${path}/${name}`;
        const childFile = this.files.get(fullPath);

        return {
          name,
          isFile: () => !childFile?.isDirectory,
          isDirectory: () => !!childFile?.isDirectory,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        } as Dirent;
      });
    }

    return children;
  }

  openSync(path: string, _flags: string): number {
    if (this.shouldThrowErrors.has(path)) {
      const error = this.shouldThrowErrors.get(path)!;
      throw new Error(error.message);
    }

    const file = this.files.get(path);
    if (!file || file.exists === false) {
      throw new FileSystemError(
        FileSystemErrorType.FILE_NOT_FOUND,
        `File not found: ${path}`
      );
    }

    // Return a mock file descriptor
    return Math.floor(Math.random() * 1000) + 1;
  }

  // eslint-disable-next-line class-methods-use-this
  readSync(
    _fd: number,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number
  ): number {
    // Mock implementation - write some test data to the buffer
    const testData = 'test file content';
    const bytesToWrite = Math.min(length, testData.length - position);

    if (bytesToWrite > 0) {
      buffer.write(
        testData.substring(position, position + bytesToWrite),
        offset
      );
    }

    return bytesToWrite;
  }

  // eslint-disable-next-line class-methods-use-this
  closeSync(_fd: number): void {
    // Mock implementation - no-op
  }
}

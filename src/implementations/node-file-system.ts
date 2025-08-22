/**
 * @fileoverview Node.js file system implementation
 * @lastmodified 2025-08-22T15:00:00Z
 *
 * Features: Production implementation of file system interfaces using Node.js fs module
 * Main APIs: NodeFileSystem, NodeGlobService, NodeIgnoreService
 * Constraints: Node.js environment, async operations, error handling
 * Patterns: Adapter pattern, dependency injection implementation
 */

/* eslint-disable max-classes-per-file */
import * as fs from 'fs';
import { promisify } from 'util';
import { Dirent, Stats } from 'fs';
import { glob } from 'glob';
import ignore from 'ignore';
import { NodeJS } from 'node:process';
import {
  IFileSystem,
  IGlobService,
  IIgnoreService,
  IIgnoreMatcher,
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

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

/**
 * Node.js file system implementation
 */
export class NodeFileSystem implements IFileSystem {
  async readFile(
    path: string,
    encoding?: BufferEncoding
  ): Promise<string | Buffer> {
    try {
      return await readFile(path, encoding);
    } catch (error) {
      throw this.handleFileSystemError(error as NodeJS.ErrnoException, path);
    }
  }

  readFileSync(path: string, encoding?: BufferEncoding): string | Buffer {
    try {
      return fs.readFileSync(path, encoding);
    } catch (error) {
      throw this.handleFileSystemError(error as NodeJS.ErrnoException, path);
    }
  }

  async stat(path: string): Promise<Stats> {
    try {
      return await stat(path);
    } catch (error) {
      throw this.handleFileSystemError(error as NodeJS.ErrnoException, path);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  exists(path: string): boolean {
    return fs.existsSync(path);
  }

  async readdir(
    path: string,
    options?: { withFileTypes?: boolean }
  ): Promise<string[] | Dirent[]> {
    try {
      if (options?.withFileTypes) {
        return await readdir(path, { withFileTypes: true });
      }
      return await readdir(path);
    } catch (error) {
      throw this.handleFileSystemError(error as NodeJS.ErrnoException, path);
    }
  }

  openSync(path: string, flags: string): number {
    try {
      return fs.openSync(path, flags);
    } catch (error) {
      throw this.handleFileSystemError(error as NodeJS.ErrnoException, path);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  readSync(
    fd: number,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number
  ): number {
    try {
      return fs.readSync(fd, buffer, offset, length, position);
    } catch (error) {
      throw new FileSystemError(
        FileSystemErrorType.READ_ERROR,
        `Failed to read from file descriptor: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  // eslint-disable-next-line class-methods-use-this
  closeSync(fd: number): void {
    try {
      fs.closeSync(fd);
    } catch (error) {
      throw new FileSystemError(
        FileSystemErrorType.UNKNOWN_ERROR,
        `Failed to close file descriptor: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  // eslint-disable-next-line class-methods-use-this
  private handleFileSystemError(
    error: NodeJS.ErrnoException,
    path: string
  ): FileSystemError {
    switch (error.code) {
      case 'ENOENT':
        return new FileSystemError(
          FileSystemErrorType.FILE_NOT_FOUND,
          `File not found: ${path}`,
          error
        );
      case 'EACCES':
      case 'EPERM':
        return new FileSystemError(
          FileSystemErrorType.PERMISSION_DENIED,
          `Permission denied: ${path}`,
          error
        );
      case 'EINVAL':
        return new FileSystemError(
          FileSystemErrorType.INVALID_PATH,
          `Invalid path: ${path}`,
          error
        );
      default:
        return new FileSystemError(
          FileSystemErrorType.UNKNOWN_ERROR,
          `File system error: ${error.message}`,
          error
        );
    }
  }
}

/**
 * Node.js glob service implementation
 */
export class NodeGlobService implements IGlobService {
  // eslint-disable-next-line class-methods-use-this
  async glob(
    pattern: string,
    options: {
      cwd: string;
      absolute?: boolean;
      nodir?: boolean;
      ignore?: string[];
    }
  ): Promise<string[]> {
    try {
      return await glob(pattern, options);
    } catch (error) {
      throw new FileSystemError(
        FileSystemErrorType.UNKNOWN_ERROR,
        `Glob operation failed: ${(error as Error).message}`,
        error as Error
      );
    }
  }
}

/**
 * Node.js ignore matcher implementation
 */
class NodeIgnoreMatcher implements IIgnoreMatcher {
  // eslint-disable-next-line no-useless-constructor, no-empty-function
  constructor(private ignoreInstance: ReturnType<typeof ignore>) {}

  add(patterns: string | string[]): IIgnoreMatcher {
    this.ignoreInstance.add(patterns);
    return this;
  }

  ignores(path: string): boolean {
    return this.ignoreInstance.ignores(path);
  }
}

/**
 * Node.js ignore service implementation using 'ignore' library
 */
export class NodeIgnoreService implements IIgnoreService {
  // eslint-disable-next-line class-methods-use-this
  create(): IIgnoreMatcher {
    return new NodeIgnoreMatcher(ignore());
  }
}

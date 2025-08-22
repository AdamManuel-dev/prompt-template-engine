/**
 * @fileoverview Comprehensive fs module mock for testing
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Mock file system operations with realistic behavior
 * Main APIs: Provides mocked fs methods with state management
 * Constraints: Memory-based file system simulation
 * Patterns: Jest mocking with state persistence and edge case handling
 */

import { Dirent, Stats } from 'fs';
import {
  IFileSystem,
} from '../../src/interfaces/file-system.interface';

export interface MockFileSystemState {
  files: Map<string, string>;
  directories: Set<string>;
  stats: Map<string, any>;
}

class MockFileSystem implements IFileSystem {
  private state: MockFileSystemState = {
    files: new Map(),
    directories: new Set(),
    stats: new Map(),
  };

  reset(): void {
    this.state.files.clear();
    this.state.directories.clear();
    this.state.stats.clear();
  }

  addFile(path: string, content: string, stats: any = {}): void {
    this.state.files.set(path, content);
    this.state.stats.set(path, {
      size: content.length,
      mtime: new Date(),
      isDirectory: () => false,
      isFile: () => true,
      ...stats,
    });
  }

  addDirectory(path: string): void {
    this.state.directories.add(path);
    this.state.stats.set(path, {
      size: 0,
      mtime: new Date(),
      isDirectory: () => true,
      isFile: () => false,
    });
  }

  existsSync = jest.fn((path: string): boolean => {
    return this.state.files.has(path) || this.state.directories.has(path);
  });

  readFileSync = jest.fn(
    (path: string, encoding?: unknown): string | Buffer => {
      const content = this.state.files.get(path);
      if (content === undefined) {
        const error = new Error(
          `ENOENT: no such file or directory, open '${path}'`
        ) as any;
        error.code = 'ENOENT';
        error.errno = -2;
        error.syscall = 'open';
        error.path = path;
        throw error;
      }

      if (encoding === 'utf8' || encoding === 'utf-8') {
        return content;
      }
      return Buffer.from(content);
    }
  );

  // readFile with callback for backward compatibility
  readFileCallback = jest.fn((path: string, encoding: any, callback?: any): void => {
    if (typeof encoding === 'function') {
      callback = encoding;
      encoding = undefined;
    }

    const content = this.state.files.get(path);
    if (content === undefined) {
      const error = new Error(
        `ENOENT: no such file or directory, open '${path}'`
      ) as any;
      error.code = 'ENOENT';
      callback(error, null);
      return;
    }

    const result = encoding === 'utf8' ? content : Buffer.from(content);
    callback(null, result);
  });

  writeFileSync = jest.fn((path: string, content: string): void => {
    this.state.files.set(path, content);
    this.state.stats.set(path, {
      size: content.length,
      mtime: new Date(),
      isDirectory: () => false,
      isFile: () => true,
    });
  });

  statCallback = jest.fn((path: string, callback: any): void => {
    const stats = this.state.stats.get(path);
    if (!stats) {
      const error = new Error(
        `ENOENT: no such file or directory, stat '${path}'`
      ) as any;
      error.code = 'ENOENT';
      callback(error, null);
      return;
    }
    callback(null, stats);
  });

  lstat = jest.fn((path: string, callback: any): void => {
    this.statCallback(path, callback);
  });

  readdirCallback = jest.fn((path: string, callback: any): void => {
    const entries: string[] = [];

    // Find files and directories in this path
    const fileKeys = Array.from(this.state.files.keys());
    for (const filePath of fileKeys) {
      const relativePath = filePath.replace(path + '/', '');
      if (!relativePath.includes('/') && relativePath !== filePath) {
        entries.push(relativePath);
      }
    }

    const dirPaths = Array.from(this.state.directories);
    for (const dirPath of dirPaths) {
      const relativePath = dirPath.replace(path + '/', '');
      if (!relativePath.includes('/') && relativePath !== dirPath) {
        entries.push(relativePath);
      }
    }

    callback(null, entries);
  });

  openSync = jest.fn((path: string): number => {
    if (!this.state.files.has(path)) {
      const error = new Error(
        `ENOENT: no such file or directory, open '${path}'`
      ) as any;
      error.code = 'ENOENT';
      throw error;
    }
    return Math.floor(Math.random() * 1000) + 1; // Return a fake file descriptor
  });

  readSync = jest.fn(
    (_fd: number, buffer: Buffer, offset: number, length: number): number => {
      // For testing purposes, just return the length requested
      return Math.min(length, buffer.length - offset);
    }
  );

  closeSync = jest.fn((_fd: number): void => {
    // No-op for mock
  });

  mkdirSync = jest.fn((path: string): void => {
    this.addDirectory(path);
  });

  // Interface methods required by IFileSystem
  async readFile(path: string, encoding?: any): Promise<string | Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const result = this.readFileSync(path, encoding);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  async stat(path: string): Promise<Stats> {
    return new Promise((resolve, reject) => {
      this.statCallback(path, (err: any, stats: any) => {
        if (err) reject(err);
        else resolve(stats);
      });
    });
  }

  exists(path: string): boolean {
    return this.existsSync(path);
  }

  async readdir(
    path: string,
    _options?: { withFileTypes?: boolean }
  ): Promise<string[] | Dirent[]> {
    return new Promise((resolve, reject) => {
      this.readdirCallback(path, (err: any, files: any) => {
        if (err) reject(err);
        else resolve(files);
      });
    });
  }

  promises = {
    readFile: jest.fn(
      async (path: string, encoding?: any): Promise<string | Buffer> => {
        return this.readFile(path, encoding);
      }
    ),

    stat: jest.fn((path: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        this.statCallback(path, (err: any, stats: any) => {
          if (err) reject(err);
          else resolve(stats);
        });
      });
    }),

    readdir: jest.fn((path: string): Promise<string[]> => {
      return new Promise((resolve, reject) => {
        this.readdirCallback(path, (err: any, files: any) => {
          if (err) reject(err);
          else resolve(files);
        });
      });
    }),

    writeFile: jest.fn((path: string, content: string): Promise<void> => {
      this.writeFileSync(path, content);
      return Promise.resolve();
    }),

    mkdir: jest.fn((path: string): Promise<void> => {
      this.mkdirSync(path);
      return Promise.resolve();
    }),
  };
}

export const mockFileSystem = new MockFileSystem();

// Export the mock implementation
export const fsMock = mockFileSystem;

export default mockFileSystem;

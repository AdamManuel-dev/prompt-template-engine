/**
 * @fileoverview Comprehensive fs module mock for testing
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Mock file system operations with realistic behavior
 * Main APIs: Provides mocked fs methods with state management
 * Constraints: Memory-based file system simulation
 * Patterns: Jest mocking with state persistence and edge case handling
 */

export interface MockFileSystemState {
  files: Map<string, string>;
  directories: Set<string>;
  stats: Map<string, any>;
}

class MockFileSystem {
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

  readFileSync = jest.fn((path: string, encoding?: unknown): string | Buffer => {
    const content = this.state.files.get(path);
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as any;
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
  });

  readFile = jest.fn((path: string, encoding: any, callback?: any): void => {
    if (typeof encoding === 'function') {
      callback = encoding;
      encoding = undefined;
    }

    const content = this.state.files.get(path);
    if (content === undefined) {
      const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as any;
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

  stat = jest.fn((path: string, callback: any): void => {
    const stats = this.state.stats.get(path);
    if (!stats) {
      const error = new Error(`ENOENT: no such file or directory, stat '${path}'`) as any;
      error.code = 'ENOENT';
      callback(error, null);
      return;
    }
    callback(null, stats);
  });

  lstat = jest.fn((path: string, callback: any): void => {
    this.stat(path, callback);
  });

  readdir = jest.fn((path: string, callback: any): void => {
    const entries: string[] = [];
    
    // Find files and directories in this path
    for (const filePath of this.state.files.keys()) {
      const relativePath = filePath.replace(path + '/', '');
      if (!relativePath.includes('/') && relativePath !== filePath) {
        entries.push(relativePath);
      }
    }
    
    for (const dirPath of this.state.directories) {
      const relativePath = dirPath.replace(path + '/', '');
      if (!relativePath.includes('/') && relativePath !== dirPath) {
        entries.push(relativePath);
      }
    }
    
    callback(null, entries);
  });

  openSync = jest.fn((path: string): number => {
    if (!this.state.files.has(path)) {
      const error = new Error(`ENOENT: no such file or directory, open '${path}'`) as any;
      error.code = 'ENOENT';
      throw error;
    }
    return Math.floor(Math.random() * 1000) + 1; // Return a fake file descriptor
  });

  readSync = jest.fn((_fd: number, buffer: Buffer, offset: number, length: number): number => {
    // For testing purposes, just return the length requested
    return Math.min(length, buffer.length - offset);
  });

  closeSync = jest.fn((_fd: number): void => {
    // No-op for mock
  });

  mkdirSync = jest.fn((path: string): void => {
    this.addDirectory(path);
  });

  promises = {
    readFile: jest.fn((path: string, encoding?: any): Promise<string | Buffer> => {
      return new Promise((resolve, reject) => {
        this.readFile(path, encoding, (err: any, data: any) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    }),

    stat: jest.fn((path: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        this.stat(path, (err: any, stats: any) => {
          if (err) reject(err);
          else resolve(stats);
        });
      });
    }),

    readdir: jest.fn((path: string): Promise<string[]> => {
      return new Promise((resolve, reject) => {
        this.readdir(path, (err: any, files: any) => {
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
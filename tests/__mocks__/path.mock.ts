/**
 * @fileoverview Path module mock for consistent testing
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Mock path operations with cross-platform consistency
 * Main APIs: Provides mocked path methods
 * Constraints: Unix-style path handling for consistent tests
 * Patterns: Jest mocking with deterministic behavior
 */

export const pathMock = {
  join: jest.fn((...paths: string[]): string => {
    return paths
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/'); // Normalize multiple slashes
  }),

  resolve: jest.fn((...paths: string[]): string => {
    const resolved = paths
      .filter(Boolean)
      .join('/')
      .replace(/\/+/g, '/');
    
    // Make absolute if not already
    if (!resolved.startsWith('/')) {
      return `/test/cwd/${resolved}`;
    }
    return resolved;
  }),

  dirname: jest.fn((path: string): string => {
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) return '.';
    if (lastSlash === 0) return '/';
    return path.slice(0, lastSlash);
  }),

  basename: jest.fn((path: string, ext?: string): string => {
    const lastSlash = path.lastIndexOf('/');
    let basename = lastSlash === -1 ? path : path.slice(lastSlash + 1);
    
    if (ext && basename.endsWith(ext)) {
      basename = basename.slice(0, -ext.length);
    }
    
    return basename;
  }),

  extname: jest.fn((path: string): string => {
    const lastDot = path.lastIndexOf('.');
    const lastSlash = path.lastIndexOf('/');
    
    if (lastDot === -1 || lastDot < lastSlash) {
      return '';
    }
    
    return path.slice(lastDot);
  }),

  relative: jest.fn((from: string, to: string): string => {
    // Simple mock implementation
    if (to.startsWith(from)) {
      return to.slice(from.length + 1);
    }
    return to;
  }),

  isAbsolute: jest.fn((path: string): boolean => {
    return path.startsWith('/');
  }),

  normalize: jest.fn((path: string): string => {
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }),

  sep: '/',
  delimiter: ':',
  posix: {} as any, // Will be filled with the same methods
  win32: {} as any, // Will be filled with Windows-specific methods
};

// Fill posix with the same methods (we're mocking as Unix)
pathMock.posix = { ...pathMock };

// Mock Windows methods (simplified)
pathMock.win32 = {
  ...pathMock,
  sep: '\\',
  delimiter: ';',
  join: jest.fn((...paths: string[]): string => {
    return paths
      .filter(Boolean)
      .join('\\')
      .replace(/\\+/g, '\\');
  }),
};

export default pathMock;
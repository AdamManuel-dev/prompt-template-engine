/**
 * @fileoverview Test utilities barrel export
 * @lastmodified 2025-08-22T15:05:00Z
 *
 * Features: Centralized exports for all test utilities
 * Main APIs: All mock classes and helper functions
 * Constraints: Maintains backward compatibility
 * Patterns: Barrel export pattern
 */

// Export all mock classes
// Export helper function
import { MockFileSystem } from './mock-file-system';
import { MockGlobService } from './mock-glob-service';
import { MockIgnoreService } from './mock-ignore-service';

export { MockFileSystem, type MockFileData } from './mock-file-system';
export { MockGlobService } from './mock-glob-service';
export { MockIgnoreService } from './mock-ignore-service';
export { MockIgnoreMatcher } from './mock-ignore-matcher';

/**
 * Helper function to create a complete mock file system setup
 */
export function createMockFileSystemSetup(): {
  fileSystem: MockFileSystem;
  globService: MockGlobService;
  ignoreService: MockIgnoreService;
} {
  return {
    fileSystem: new MockFileSystem(),
    globService: new MockGlobService(),
    ignoreService: new MockIgnoreService(),
  };
}

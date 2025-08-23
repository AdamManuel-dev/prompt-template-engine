/**
 * @fileoverview Glob module mock for file pattern matching
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Mock glob operations with pattern matching simulation
 * Main APIs: Provides mocked glob methods
 * Constraints: Simplified pattern matching for testing
 * Patterns: Jest mocking with configurable file matching
 */

class MockGlob {
  private mockFiles: string[] = [];

  setMockFiles(files: string[]): void {
    this.mockFiles = files;
  }

  addMockFile(file: string): void {
    this.mockFiles.push(file);
  }

  reset(): void {
    this.mockFiles = [];
  }

  // Simple pattern matching for testing
  private matchesPattern(pattern: string, filePath: string): boolean {
    // Convert glob pattern to regex (simplified)
    let regexPattern = pattern
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\*\*/g, '.*') // ** matches any path segments
      .replace(/\*/g, '[^/]*') // * matches within path segment
      .replace(/\?/g, '[^/]'); // ? matches single character

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  glob = jest.fn(
    (pattern: string | string[], _options?: any): Promise<string[]> => {
      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      const matchedFiles = this.mockFiles.filter(file =>
        patterns.some(p => this.matchesPattern(p, file))
      );

      return Promise.resolve(matchedFiles);
    }
  );

  globSync = jest.fn((pattern: string | string[], _options?: any): string[] => {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    return this.mockFiles.filter(file =>
      patterns.some(p => this.matchesPattern(p, file))
    );
  });
}

export const mockGlob = new MockGlob();

export default mockGlob;

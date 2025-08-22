/**
 * @fileoverview Mock ignore matcher implementation for testing
 * @lastmodified 2025-08-22T15:05:00Z
 *
 * Features: Mock ignore pattern matching implementation
 * Main APIs: MockIgnoreMatcher class with IIgnoreMatcher interface
 * Constraints: Jest-compatible mocking, configurable ignore behavior
 * Patterns: Mock pattern, dependency injection testing
 */

import { IIgnoreMatcher } from '../interfaces/file-system.interface';

/**
 * Mock ignore matcher for testing
 */
export class MockIgnoreMatcher implements IIgnoreMatcher {
  private patterns: string[] = [];

  private ignoredPaths: Set<string> = new Set();

  add(patterns: string | string[]): IIgnoreMatcher {
    const patternArray = Array.isArray(patterns) ? patterns : [patterns];
    this.patterns.push(...patternArray);
    return this;
  }

  ignores(path: string): boolean {
    return this.ignoredPaths.has(path);
  }

  /**
   * Set specific paths to be ignored (for testing)
   */
  setIgnored(path: string, ignored: boolean = true): void {
    if (ignored) {
      this.ignoredPaths.add(path);
    } else {
      this.ignoredPaths.delete(path);
    }
  }

  /**
   * Get added patterns (for testing)
   */
  getPatterns(): string[] {
    return [...this.patterns];
  }
}

// Additional export to satisfy import/prefer-default-export
export type MockIgnoreMatcherType = typeof MockIgnoreMatcher;

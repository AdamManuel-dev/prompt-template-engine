/**
 * @fileoverview Mock glob service implementation for testing
 * @lastmodified 2025-08-22T15:05:00Z
 *
 * Features: Mock glob pattern matching, configurable error handling
 * Main APIs: MockGlobService class with IGlobService interface implementation
 * Constraints: Jest-compatible mocking, supports async operations
 * Patterns: Mock pattern, dependency injection testing
 */

import { IGlobService } from '../interfaces/file-system.interface';

/**
 * Mock glob service for testing
 */
export class MockGlobService implements IGlobService {
  private globResults: Map<string, string[]> = new Map();

  private shouldThrowError: boolean = false;

  private errorToThrow?: Error;

  /**
   * Set mock glob results
   */
  setGlobResults(pattern: string, results: string[]): void {
    this.globResults.set(pattern, results);
  }

  /**
   * Set error to throw
   */
  setError(error: Error): void {
    this.shouldThrowError = true;
    this.errorToThrow = error;
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.globResults.clear();
    this.shouldThrowError = false;
    this.errorToThrow = undefined;
  }

  async glob(
    pattern: string,
    _options: {
      cwd: string;
      absolute?: boolean;
      nodir?: boolean;
      ignore?: string[];
    }
  ): Promise<string[]> {
    if (this.shouldThrowError) {
      throw this.errorToThrow || new Error('Mock glob error');
    }

    return this.globResults.get(pattern) || [];
  }
}

// Additional export to satisfy import/prefer-default-export
export type MockGlobServiceType = typeof MockGlobService;

/**
 * @fileoverview Mock ignore service implementation for testing
 * @lastmodified 2025-08-22T15:05:00Z
 *
 * Features: Mock ignore service factory
 * Main APIs: MockIgnoreService class with IIgnoreService interface
 * Constraints: Jest-compatible mocking, creates mock ignore matchers
 * Patterns: Mock pattern, factory pattern, dependency injection testing
 */

import {
  IIgnoreService,
  IIgnoreMatcher,
} from '../interfaces/file-system.interface';
import { MockIgnoreMatcher } from './mock-ignore-matcher';

/**
 * Mock ignore service for testing
 */
export class MockIgnoreService implements IIgnoreService {
  // eslint-disable-next-line class-methods-use-this
  create(): IIgnoreMatcher {
    return new MockIgnoreMatcher();
  }
}

// Additional export to satisfy import/prefer-default-export
export type MockIgnoreServiceType = typeof MockIgnoreService;

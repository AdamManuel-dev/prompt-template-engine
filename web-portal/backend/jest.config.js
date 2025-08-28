/**
 * @fileoverview Jest configuration for Node.js backend testing
 * @lastmodified 2025-01-28T10:30:00Z
 * 
 * Features: TypeScript support, API testing, mock support
 * Main APIs: Jest test runner with supertest integration
 * Constraints: Requires test database setup for integration tests
 * Patterns: Supports both unit and integration testing
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts',
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/generated/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
  ],
  coverageThreshold: {
    global: {
      branches: 50, // Lower threshold for now
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  testTimeout: 10000,
  globals: {
    'ts-jest': {
      useESM: false,
    },
  },
}
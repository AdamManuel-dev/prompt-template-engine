/**
 * @fileoverview Test setup configuration for backend testing
 * @lastmodified 2025-01-28T10:30:00Z
 * 
 * Features: Database setup/teardown, environment configuration
 * Main APIs: Jest setup hooks, test database management
 * Constraints: Requires separate test database for isolation
 * Patterns: Sets up test environment and cleans up after tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-secret-key-for-testing-only'
process.env.TEST_DATABASE_URL = 'postgresql://test:test@localhost:5432/cursor_prompt_test'
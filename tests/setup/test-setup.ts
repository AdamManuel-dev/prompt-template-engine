/**
 * @fileoverview Simplified test setup with comprehensive mocking
 * @lastmodified 2025-08-22T20:30:00Z
 *
 * Features: Basic test configuration with mock setup and teardown
 * Main APIs: Test environment configuration and utilities
 * Constraints: Works with Jest testing framework
 * Patterns: Setup/teardown hooks with mock state management
 */

import { MockFactory } from '../__mocks__/mock-factory';

// Initialize marketplace mocks globally (stubbed)
MockFactory.initializeMarketplaceMocks();

// Mock the database factory to return mocked database
jest.mock('../../src/marketplace/database/database.factory', () => {
  const { MockMarketplaceDatabase } = require('../__mocks__/marketplace.mock');
  
  return {
    DatabaseFactory: {
      createDatabase: jest.fn().mockImplementation(async () => {
        const mockDb = new MockMarketplaceDatabase();
        await mockDb.connect();
        return mockDb;
      }),
      createConfigFromEnv: jest.fn().mockReturnValue({
        type: 'file',
        dataDir: '/tmp/test',
        enableCache: false,
      }),
      validateConfig: jest.fn(),
    },
    getDatabase: jest.fn().mockImplementation(async () => {
      const mockDb = new MockMarketplaceDatabase();
      await mockDb.connect();
      return mockDb;
    }),
    closeDatabase: jest.fn().mockResolvedValue(undefined),
    DEFAULT_DATABASE_CONFIG: {
      type: 'file',
      dataDir: '/tmp/test',
      enableCache: false,
    },
  };
});

// Mock the MarketplaceAPI to prevent real network calls
jest.mock('../../src/marketplace/api/marketplace.api', () => {
  const { MockMarketplaceAPI } = require('../__mocks__/marketplace.mock');
  
  return {
    MarketplaceAPI: MockMarketplaceAPI,
  };
});

// Ensure integrations that open sockets/intervals are disabled in tests
process.env.CURSOR_PROMPT_CURSOR_INTEGRATION = 'false';
process.env.CURSOR_PROMPT_PLUGINS_ENABLED = 'false';
process.env.CURSOR_PROMPT_CURSOR_AUTOSYNC = 'false';

// Mock Cursor integration modules to avoid network/socket handles in tests
jest.mock('../../src/integrations/cursor-ide', () => ({
  CursorIntegration: {
    getInstance: () => ({
      connect: jest.fn().mockResolvedValue(false),
      sync: jest.fn().mockResolvedValue(undefined),
      inject: jest.fn(),
      updateTemplate: jest.fn(),
      getTemplates: jest.fn(() => []),
      isConnected: jest.fn(() => false),
      getConnectionStatus: jest.fn(() => ({ connected: false, endpoint: '' })),
      disconnect: jest.fn(),
    }),
  },
}));

jest.mock('../../src/integrations/cursor-extension-bridge', () => ({
  CursorExtensionBridge: {
    getInstance: () => ({}),
  },
}));

// Set test timeout
jest.setTimeout(30000);

// Test environment configuration
export class TestEnvironment {
  private static instance: TestEnvironment;
  private mocks: { [key: string]: any } = {};

  static getInstance(): TestEnvironment {
    if (!TestEnvironment.instance) {
      TestEnvironment.instance = new TestEnvironment();
    }
    return TestEnvironment.instance;
  }

  /**
   * Setup test environment with common mocks
   */
  setup(
    options: {
      mockFileSystem?: boolean;
      mockGit?: boolean;
      mockLogger?: boolean;
      fileSystemFiles?: Record<string, string>;
      gitState?: any;
    } = {}
  ): void {
    // Setup file system mock
    if (options.mockFileSystem !== false) {
      this.mocks.fileSystem = MockFactory.createFileSystemMock({
        files: options.fileSystemFiles,
      });
    }

    // Setup git service mock
    if (options.mockGit) {
      this.mocks.gitService = MockFactory.createGitServiceMock(
        options.gitState
      );
    }

    // Setup logger mock
    if (options.mockLogger !== false) {
      this.mocks.logger = MockFactory.createLoggerMock();
    }

    // Mock console methods for cleaner test output
    this.mockConsole();
  }

  /**
   * Clean up test environment
   */
  teardown(): void {
    MockFactory.resetAll();
    this.mocks = {};
    jest.useRealTimers();
    this.restoreConsole();
  }

  /**
   * Get a mock by name
   */
  getMock(name: string): any {
    return this.mocks[name];
  }

  /**
   * Mock console methods to reduce test noise
   */
  private mockConsole(): void {
    // Store original console methods
    this.mocks.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };

    // Mock console methods only if not in verbose mode
    if (process.env.NODE_ENV !== 'verbose') {
      console.log = jest.fn();
      console.warn = jest.fn();
      console.error = jest.fn();
      console.info = jest.fn();
    }
  }

  /**
   * Restore original console methods
   */
  private restoreConsole(): void {
    if (this.mocks.originalConsole) {
      console.log = this.mocks.originalConsole.log;
      console.warn = this.mocks.originalConsole.warn;
      console.error = this.mocks.originalConsole.error;
      console.info = this.mocks.originalConsole.info;
    }
  }
}

// Test utilities
export class TestUtils {
  /**
   * Create a temporary test context
   */
  static createTestContext(overrides: Record<string, any> = {}): any {
    return {
      name: 'Test User',
      email: 'test@example.com',
      project: {
        name: 'test-project',
        version: '1.0.0',
      },
      system: {
        platform: 'darwin',
        nodeVersion: 'v22.0.0',
      },
      ...overrides,
    };
  }

  /**
   * Create a test template with variables
   */
  static createTestTemplate(variables: string[] = []): string {
    const variableList = variables.map(v => `{{${v}}}`).join(' ');
    return `# Test Template

Hello ${variableList}!

This is a test template for: {{project.name}}`;
  }

  /**
   * Wait for async operations to complete
   */
  static async flushPromises(): Promise<void> {
    await new Promise(resolve => setImmediate(resolve));
  }

  /**
   * Create a mock error with specific properties
   */
  static createMockError(
    message: string,
    code?: string,
    statusCode?: number
  ): Error {
    const error = new Error(message) as any;
    if (code) error.code = code;
    if (statusCode) error.statusCode = statusCode;
    return error;
  }

  /**
   * Assert that an async function throws a specific error
   */
  static async expectAsyncThrow(
    fn: () => Promise<any>,
    expectedMessage?: string,
    expectedCode?: string
  ): Promise<void> {
    let error: any;
    try {
      await fn();
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    if (expectedMessage) {
      expect(error.message).toContain(expectedMessage);
    }
    if (expectedCode) {
      expect(error.code).toBe(expectedCode);
    }
  }

  /**
   * Measure execution time of a function
   */
  static async measureTime<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }
}

// Global test environment instance
export const testEnv = TestEnvironment.getInstance();

// Export for use in individual test files
export { MockFactory };

// Global setup and teardown for all tests
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Ensure all async operations complete
afterEach(async () => {
  await TestUtils.flushPromises();
});

export default {
  TestEnvironment,
  TestUtils,
  testEnv,
  MockFactory,
};

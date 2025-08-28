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

// Mock PromptWizard Client to prevent real network calls
jest.mock('../../src/integrations/promptwizard/client', () => {
  return {
    PromptWizardClient: jest.fn().mockImplementation(() => ({
      healthCheck: jest.fn().mockResolvedValue(true),
      scorePrompt: jest.fn().mockResolvedValue({
        overall: 85,
        confidence: 92.5,
        metrics: {
          clarity: 88,
          taskAlignment: 82,
          tokenEfficiency: 85,
          exampleQuality: 90,
        },
        suggestions: [
          'Consider adding more specific examples',
          'Improve task alignment with clearer instructions',
          'Optimize token usage for better efficiency',
        ],
      }),
      optimizePrompt: jest.fn().mockResolvedValue({
        optimized: 'Optimized prompt content',
        score: 95,
        improvements: ['Better structure', 'Clearer instructions'],
      }),
      comparePrompts: jest.fn().mockResolvedValue({
        winner: 'prompt1',
        confidence: 85.5,
        comparison: {
          prompt1: { score: 90, strengths: ['Clear'], weaknesses: [] },
          prompt2: { score: 80, strengths: [], weaknesses: ['Unclear'] },
        },
      }),
      isHealthy: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(undefined),
    })),
    createDefaultConfig: jest.fn().mockReturnValue({
      serviceUrl: 'http://localhost:8080',
      timeout: 10000,
      retries: 3,
    }),
  };
});

// Mock PromptWizard index module
jest.mock('../../src/integrations/promptwizard', () => {
  return {
    PromptWizardClient: jest.fn().mockImplementation(() => ({
      healthCheck: jest.fn().mockResolvedValue(true),
      scorePrompt: jest.fn().mockResolvedValue({
        overall: 85,
        confidence: 92.5,
        metrics: {
          clarity: 88,
          taskAlignment: 82,
          tokenEfficiency: 85,
          exampleQuality: 90,
        },
        suggestions: [],
      }),
      optimizePrompt: jest.fn().mockResolvedValue({
        optimized: 'Optimized prompt content',
        score: 95,
        improvements: [],
      }),
      comparePrompts: jest.fn().mockResolvedValue({
        winner: 'prompt1',
        confidence: 85.5,
        comparison: {
          prompt1: { score: 90, strengths: [], weaknesses: [] },
          prompt2: { score: 80, strengths: [], weaknesses: [] },
        },
      }),
      isHealthy: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(undefined),
    })),
    createDefaultConfig: jest.fn().mockReturnValue({
      serviceUrl: 'http://localhost:8080',
      timeout: 10000,
      retries: 3,
    }),
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

// Set test timeout - increased for stability
jest.setTimeout(30000);

// Mock timers for faster test execution
jest.useFakeTimers({
  advanceTimers: true,
  doNotFake: ['nextTick', 'setImmediate', 'performance'],
  // Ensure fake timers work properly with promises
  now: Date.now(),
});

// Disable real network calls in tests
process.env.NODE_ENV = 'test';
process.env.DISABLE_NETWORK = 'true';
process.env.PROMPTWIZARD_SERVICE_URL = 'http://localhost:8080/test';
process.env.PROMPTWIZARD_ENABLED = 'false';

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
    // Fast-forward any pending timers
    if (jest.isMockFunction(setTimeout)) {
      jest.runOnlyPendingTimers();
    }
  }

  /**
   * Fast-forward time and flush promises
   */
  static async advanceTime(ms: number): Promise<void> {
    if (jest.isMockFunction(setTimeout)) {
      jest.advanceTimersByTime(ms);
    }
    await this.flushPromises();
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
  jest.clearAllTimers();
  jest.resetAllMocks();
  // Ensure fake timers are active for each test
  if (!jest.isMockFunction(setTimeout)) {
    jest.useFakeTimers({
      advanceTimers: true,
      doNotFake: ['nextTick', 'setImmediate', 'performance'],
    });
  }
});

afterEach(async () => {
  // Clear all timers and flush promises
  jest.clearAllTimers();
  await TestUtils.flushPromises();
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Reset modules to prevent memory leaks
  jest.resetModules();
});

// Global test cleanup
afterAll(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  
  // Final memory cleanup
  if (global.gc) {
    global.gc();
  }
});

export default {
  TestEnvironment,
  TestUtils,
  testEnv,
  MockFactory,
};

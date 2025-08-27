/**
 * @fileoverview Centralized mock factory for consistent test mocking
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Factory methods for creating consistent mocks across tests
 * Main APIs: MockFactory class with various mock creation methods
 * Constraints: Type-safe mock generation with realistic defaults
 * Patterns: Factory pattern with builder methods for complex mocks
 */

import { mockFileSystem } from './fs.mock';
import { mockGlob } from './glob.mock';
import { TemplateContext } from '../../src/core/template-engine';
// Note: Marketplace mocks disabled due to TypeScript errors in E2E tests
// import { 
//   MockMarketplaceAPI, 
//   MockMarketplaceDatabase, 
//   initializeMarketplaceMocks,
//   resetMarketplaceMocks
// } from './marketplace.mock';

export interface MockServiceOptions {
  throwOnError?: boolean;
  delayMs?: number;
  mockReturnValue?: unknown;
}

export interface MockFileSystemOptions {
  files?: Record<string, string>;
  directories?: string[];
  throwOnMissing?: boolean;
}

export interface MockGitServiceOptions {
  isRepo?: boolean;
  branch?: string;
  isClean?: boolean;
  files?: string[];
  commits?: Array<{ hash: string; message: string; date: Date }>;
}

export class MockFactory {
  /**
   * Create a comprehensive file system mock with predefined structure
   */
  static createFileSystemMock(
    options: MockFileSystemOptions = {}
  ): typeof mockFileSystem {
    mockFileSystem.reset();

    // Add default directories
    const defaultDirectories = [
      'src',
      'tests',
      'dist',
      ...(options.directories || []),
    ];
    defaultDirectories.forEach(dir =>
      mockFileSystem.addDirectory(`/test/project/${dir}`)
    );

    // Add default files
    const defaultFiles = {
      '/test/project/package.json': JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
      }),
      '/test/project/README.md': '# Test Project\n\nThis is a test project.',
      '/test/project/.gitignore': 'node_modules/\n*.log\n.DS_Store',
      ...(options.files || {}),
    };

    Object.entries(defaultFiles).forEach(([path, content]) => {
      mockFileSystem.addFile(path, content);
    });

    return mockFileSystem;
  }

  /**
   * Create a mock git service with configurable state
   */
  static createGitServiceMock(options: MockGitServiceOptions = {}): unknown {
    const mockGitService = {
      isGitRepository: jest.fn().mockResolvedValue(options.isRepo ?? true),
      getCurrentBranch: jest.fn().mockResolvedValue(options.branch ?? 'main'),
      getWorkingTreeStatus: jest.fn().mockResolvedValue({
        isClean: options.isClean ?? true,
        modifiedFiles: options.files || [],
        stagedFiles: [],
        untrackedFiles: [],
      }),
      getCommitHistory: jest.fn().mockResolvedValue(
        options.commits || [
          {
            hash: 'abc123',
            message: 'Initial commit',
            date: new Date('2025-01-01'),
            author: 'Test Author <test@example.com>',
          },
        ]
      ),
      getRecentCommits: jest.fn().mockResolvedValue([]),
      getGitContext: jest.fn().mockResolvedValue({
        isRepo: options.isRepo ?? true,
        branch: options.branch ?? 'main',
        isClean: options.isClean ?? true,
        modifiedFiles: options.files || [],
        commits: options.commits || [],
      }),
    };

    return mockGitService;
  }

  /**
   * Create a mock file context service
   */
  static createFileContextServiceMock(
    options: MockServiceOptions = {}
  ): unknown {
    const mockService = {
      getFileInfo: jest.fn().mockImplementation((path: string) => {
        if (options.throwOnError) {
          throw new Error(`File not found: ${path}`);
        }
        return Promise.resolve({
          path,
          relativePath: path.replace('/test/project/', ''),
          size: 1024,
          modified: new Date(),
          isDirectory: false,
          extension: '.ts',
        });
      }),

      getFileContent: jest.fn().mockImplementation((path: string) => {
        if (options.throwOnError) {
          throw new Error(`Cannot read file: ${path}`);
        }
        return Promise.resolve({
          path,
          content: `// Mock content for ${path}`,
          truncated: false,
          size: 100,
          lines: 5,
        });
      }),

      getProjectStructure: jest.fn().mockResolvedValue({
        root: '/test/project',
        tree: [
          { name: 'src', type: 'directory', children: [] },
          { name: 'package.json', type: 'file', size: 500 },
        ],
        totalFiles: 10,
        totalDirectories: 3,
      }),

      findFiles: jest.fn().mockResolvedValue([
        {
          path: '/test/project/src/index.ts',
          relativePath: 'src/index.ts',
          size: 1024,
          modified: new Date(),
          extension: '.ts',
        },
      ]),

      getContext: jest
        .fn()
        .mockResolvedValue(
          new Map([['src/index.ts', { content: '// Mock content', lines: 10 }]])
        ),

      getProjectSummary: jest
        .fn()
        .mockResolvedValue(
          'Project: test-project\nFiles: 10\nLanguages: TypeScript, JSON'
        ),
    };

    return mockService;
  }

  /**
   * Create a mock template engine with configurable behavior
   */
  static createTemplateEngineMock(options: MockServiceOptions = {}): unknown {
    const mockEngine = {
      render: jest
        .fn()
        .mockImplementation(
          async (template: string, context: TemplateContext) => {
            if (options.throwOnError) {
              throw new Error('Template rendering failed');
            }

            if (options.delayMs) {
              await new Promise(resolve =>
                setTimeout(resolve, options.delayMs)
              );
            }

            // Simple template replacement for testing
            return template.replace(/\{\{(\w+(\.\w+)*)\}\}/g, (match, key) => {
              const value = MockFactory.getNestedValue(context, key);
              return value !== undefined ? String(value) : match;
            });
          }
        ),

      renderFile: jest
        .fn()
        .mockImplementation(
          async (filePath: string, context: TemplateContext) => {
            const template = mockFileSystem.readFileSync(
              filePath,
              'utf8'
            ) as string;
            return mockEngine.render(template, context);
          }
        ),

      hasVariables: jest.fn().mockImplementation((template: string) => {
        return /\{\{\w+(\.\w+)*\}\}/.test(template);
      }),

      extractVariables: jest.fn().mockImplementation((template: string) => {
        const matches = template.match(/\{\{(\w+(?:\.\w+)*)\}\}/g) || [];
        return matches.map(match => match.slice(2, -2).trim());
      }),

      validateContext: jest
        .fn()
        .mockImplementation((template: string, context: TemplateContext) => {
          const variables = mockEngine.extractVariables(template);
          const missing = variables.filter(
            (variable: string) =>
              MockFactory.getNestedValue(context, variable) === undefined
          );

          return {
            valid: missing.length === 0,
            missing,
          };
        }),
    };

    return mockEngine;
  }

  /**
   * Create a mock config service
   */
  static createConfigServiceMock(config: Record<string, any> = {}): unknown {
    const defaultConfig: Record<string, any> = {
      templatePaths: ['./templates'],
      outputPath: './output',
      defaultVariables: {},
      ...config,
    };

    return {
      getConfig: jest.fn().mockReturnValue(defaultConfig),
      setConfig: jest.fn().mockImplementation((key: string, value: any) => {
        defaultConfig[key] = value;
      }),
      getMergedConfig: jest.fn().mockReturnValue(defaultConfig),
      getConfigValue: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: any) => {
          return MockFactory.getNestedValue(defaultConfig, key) ?? defaultValue;
        }),
      validateConfig: jest.fn().mockReturnValue({ valid: true, errors: [] }),
    };
  }

  /**
   * Create a logger mock with different log levels
   */
  static createLoggerMock(): unknown {
    return {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      success: jest.fn(),
      setLevel: jest.fn(),
      configure: jest.fn(),
    };
  }

  /**
   * Create a marketplace API mock with configurable behavior (STUB)
   */
  static createMarketplaceAPIMock(_options: MockServiceOptions = {}): any {
    // Return a simple stub to avoid TypeScript errors
    return {
      searchTemplates: jest.fn().mockResolvedValue({ templates: [], total: 0 }),
      getTemplate: jest.fn().mockResolvedValue(null),
      publishTemplate: jest.fn().mockResolvedValue({ success: true }),
    };
  }

  /**
   * Create a marketplace database mock (STUB)
   */
  static createMarketplaceDatabaseMock(_options: MockServiceOptions = {}): any {
    // Return a simple stub to avoid TypeScript errors
    return {
      templates: {
        findById: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ success: true }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
  }

  /**
   * Initialize all marketplace mocks (STUB)
   */
  static initializeMarketplaceMocks(): void {
    // Stub - does nothing to avoid TypeScript errors
    // Silently skip marketplace mocks to avoid test noise
  }

  /**
   * Helper method to get nested object values
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Create a promise that resolves after a delay (for async testing)
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a promise that rejects after a delay (for error testing)
   */
  static rejectAfter(
    ms: number,
    message: string = 'Mock rejection'
  ): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    );
  }

  /**
   * Reset all mock implementations and state
   */
  static resetAll(): void {
    mockFileSystem.reset();
    mockGlob.reset();
    // Marketplace mocks will be reset in test setup
    jest.clearAllMocks();
  }
}

export default MockFactory;

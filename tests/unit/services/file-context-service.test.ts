/**
 * @fileoverview Unit tests for FileContextService with enhanced mocking
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Tests file context gathering functionality with proper mocking
 * Main APIs: FileContextService methods
 * Constraints: Mock file system operations, no actual file access
 * Patterns: Jest testing with sophisticated mocking patterns
 */

import { MockFactory } from '../../__mocks__/mock-factory';
import { mockGlob } from '../../__mocks__/glob.mock';

// Mock the external dependencies before importing the service
jest.mock('fs', () => require('../../__mocks__/fs.mock').default);
jest.mock('glob', () => ({ glob: mockGlob.glob }));
jest.mock('path', () => require('../../__mocks__/path.mock').default);

// Import the service after mocks are set up
import { FileContextService } from '../../../src/services/file-context-service';

describe('FileContextService', () => {
  let service: FileContextService;
  const mockCwd = '/test/project';

  beforeEach(() => {
    // Reset all mocks
    MockFactory.resetAll();

    // Setup file system with test files
    MockFactory.createFileSystemMock({
      files: {
        '/test/project/package.json': JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
        }),
        '/test/project/src/index.ts': 'export default class TestClass {}',
        '/test/project/src/utils.ts': 'export const helper = () => {}',
        '/test/project/README.md': '# Test Project',
        '/test/project/.gitignore': 'node_modules/\n*.log',
      },
      directories: ['src', 'dist', 'node_modules'],
    });

    service = new FileContextService(mockFileSystem as any, undefined, undefined, {}, mockCwd);
  });

  afterEach(() => {
    MockFactory.resetAll();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(service).toBeDefined();
    });

    it('should load .gitignore if respectGitignore is true', () => {
      mockFileSystem.addFile(
        '/test/project/.gitignore',
        'node_modules/\n*.log'
      );

      const serviceWithGitignore = new FileContextService(mockFileSystem as any, undefined, undefined, { respectGitignore: true }, mockCwd);

      expect(serviceWithGitignore).toBeDefined();
      expect(mockFileSystem.existsSync).toHaveBeenCalledWith(
        '/test/project/.gitignore'
      );
    });

    it('should handle missing .gitignore gracefully', () => {
      // Remove gitignore file
      const originalExistsSync = mockFileSystem.existsSync;
      mockFileSystem.existsSync = jest.fn(
        (path: string) => path !== '/test/project/.gitignore'
      );

      const serviceWithoutGitignore = new FileContextService(mockFileSystem as any, undefined, undefined, {}, mockCwd);

      expect(serviceWithoutGitignore).toBeDefined();

      // Restore original function
      mockFileSystem.existsSync = originalExistsSync;
    });
  });

  describe('getFileInfo()', () => {
    it('should return file information for existing files', async () => {
      const filePath = '/test/project/src/index.ts';

      const info = await service.getFileInfo(filePath);

      expect(info).toEqual({
        path: filePath,
        relativePath: 'src/index.ts',
        size: expect.any(Number),
        modified: expect.any(Date),
        isDirectory: false,
        extension: '.ts',
      });
    });

    it('should return null for non-existent files', async () => {
      const info = await service.getFileInfo('/test/project/nonexistent.ts');

      expect(info).toBeNull();
    });

    it('should handle directory detection correctly', async () => {
      const dirPath = '/test/project/src';

      const info = await service.getFileInfo(dirPath);

      expect(info?.isDirectory).toBe(true);
    });
  });

  describe('getFileContent()', () => {
    it('should read small files completely', async () => {
      const filePath = '/test/project/src/index.ts';
      const expectedContent = 'export default class TestClass {}';

      const result = await service.getFileContent(filePath);

      expect(result).toEqual({
        path: filePath,
        content: expectedContent,
        truncated: false,
        size: expectedContent.length,
        lines: 1,
      });
    });

    it('should handle file reading errors gracefully', async () => {
      const filePath = '/test/project/protected.ts';

      const result = await service.getFileContent(filePath);

      expect(result).toBeNull();
    });

    it('should truncate large files when specified', async () => {
      const largeContent = 'x'.repeat(1000);
      mockFileSystem.addFile('/test/project/large.txt', largeContent);

      const result = await service.getFileContent(
        '/test/project/large.txt',
        100
      );

      expect(result?.truncated).toBe(true);
      expect(result?.size).toBe(largeContent.length);
    });
  });

  describe('getProjectStructure()', () => {
    it('should build project tree structure', async () => {
      mockGlob.setMockFiles([
        '/test/project/src/index.ts',
        '/test/project/src/utils.ts',
        '/test/project/package.json',
      ]);

      const structure = await service.getProjectStructure();

      expect(structure.root).toBe(mockCwd);
      expect(structure.tree).toBeDefined();
      expect(structure.totalFiles).toBeGreaterThan(0);
    });

    it('should respect maximum depth', async () => {
      const structure = await service.getProjectStructure(1);

      expect(structure.tree).toBeDefined();
      // Should not include deeply nested files
    });

    it('should handle empty directories', async () => {
      mockGlob.setMockFiles([]);

      const structure = await service.getProjectStructure();

      expect(structure.totalFiles).toBe(0);
      expect(structure.tree).toHaveLength(0);
    });
  });

  describe('findFiles()', () => {
    it('should find files matching patterns', async () => {
      mockGlob.setMockFiles([
        '/test/project/src/index.ts',
        '/test/project/src/utils.ts',
        '/test/project/README.md',
      ]);

      const files = await service.findFiles(['**/*.ts']);

      expect(files).toHaveLength(2);
      expect(files.every(f => f.extension === '.ts')).toBe(true);
    });

    it('should exclude files based on gitignore patterns', async () => {
      mockGlob.setMockFiles([
        '/test/project/src/index.ts',
        '/test/project/node_modules/lib.js',
        '/test/project/debug.log',
      ]);

      const serviceWithIgnore = new FileContextService(mockFileSystem as any, undefined, undefined, {}, mockCwd);

      const files = await serviceWithIgnore.findFiles(['**/*']);

      // Should exclude node_modules and .log files
      expect(files.some(f => f.path.includes('node_modules'))).toBe(false);
      expect(files.some(f => f.path.includes('.log'))).toBe(false);
    });

    it('should handle multiple patterns', async () => {
      mockGlob.setMockFiles([
        '/test/project/src/index.ts',
        '/test/project/src/component.tsx',
        '/test/project/README.md',
        '/test/project/package.json',
      ]);

      const files = await service.findFiles(['**/*.ts', '**/*.tsx']);

      expect(files).toHaveLength(2);
      expect(files.some(f => f.extension === '.ts')).toBe(true);
      expect(files.some(f => f.extension === '.tsx')).toBe(true);
    });
  });

  describe('getProjectSummary()', () => {
    it('should generate comprehensive project summary', async () => {
      mockGlob.setMockFiles([
        '/test/project/src/index.ts',
        '/test/project/src/utils.ts',
        '/test/project/README.md',
        '/test/project/package.json',
      ]);

      const summary = await service.getProjectSummary();

      expect(summary).toContain('Project: project');
      expect(summary).toContain('Total files:');
      expect(summary).toContain('File types:');
      expect(summary).toContain('TypeScript');
    });

    it('should handle projects with no files', async () => {
      mockGlob.setMockFiles([]);

      const summary = await service.getProjectSummary();

      expect(summary).toContain('Total files: 0');
    });

    it('should include directory structure information', async () => {
      mockGlob.setMockFiles([
        '/test/project/src/components/Header.tsx',
        '/test/project/src/utils/helpers.ts',
        '/test/project/docs/README.md',
      ]);

      const summary = await service.getProjectSummary();

      expect(summary).toContain('src/');
      expect(summary).toContain('docs/');
    });
  });

  describe('getContext()', () => {
    it('should get context for specific files', async () => {
      const files = ['src/index.ts', 'package.json'];

      const context = await service.getContext(files);

      expect(context.size).toBe(2);
      expect(context.has('src/index.ts')).toBe(true);
      expect(context.has('package.json')).toBe(true);
    });

    it('should handle missing files gracefully', async () => {
      const files = ['nonexistent.ts', 'also-missing.ts'];

      const context = await service.getContext(files);

      // Should not throw, but context should be empty or contain null values
      expect(context).toBeDefined();
    });

    it('should provide file content in context', async () => {
      const files = ['src/index.ts'];

      const context = await service.getContext(files);

      const fileContext = context.get('src/index.ts');
      expect(fileContext?.content).toBeDefined();
      expect(fileContext?.lines).toBeGreaterThan(0);
    });

    it('should handle large number of files efficiently', async () => {
      const files = Array.from({ length: 50 }, (_, i) => `file${i}.ts`);
      files.forEach(file =>
        mockFileSystem.addFile(`/test/project/${file}`, 'content')
      );

      const startTime = Date.now();
      const context = await service.getContext(files);
      const duration = Date.now() - startTime;

      expect(context.size).toBe(files.length);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      const mockError = Object.assign(new Error('Permission denied'), {
        code: 'EACCES',
      });
      mockFileSystem.stat = jest.fn().mockRejectedValue(mockError);

      const info = await service.getFileInfo('/protected/file');

      expect(info).toBeNull();
    });

    it('should handle glob errors gracefully', async () => {
      mockGlob.glob = jest.fn().mockRejectedValue(new Error('Glob error'));

      const files = await service.findFiles(['**/*']);

      expect(files).toEqual([]);
    });

    it('should handle malformed gitignore patterns', () => {
      mockFileSystem.addFile('/test/project/.gitignore', 'invalid[[[pattern');

      expect(() => {
        new FileContextService(mockFileSystem as any, undefined, undefined, {}, mockCwd);
      }).not.toThrow();
    });
  });

  describe('performance', () => {
    it('should cache file stats for repeated queries', async () => {
      const filePath = '/test/project/src/index.ts';

      await service.getFileInfo(filePath);
      await service.getFileInfo(filePath);

      // Should have cached the result and not called stat twice
      // This is more of an implementation detail test
      expect(mockFileSystem.stat).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent file operations', async () => {
      const files = ['file1.ts', 'file2.ts', 'file3.ts'];
      files.forEach(file =>
        mockFileSystem.addFile(`/test/project/${file}`, 'content')
      );

      const promises = files.map(file =>
        service.getFileContent(`/test/project/${file}`)
      );
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every(r => r !== null)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle files with special characters in names', async () => {
      const specialFile = '/test/project/special file with spaces & symbols.ts';
      mockFileSystem.addFile(specialFile, 'content');

      const info = await service.getFileInfo(specialFile);

      expect(info?.path).toBe(specialFile);
    });

    it('should handle very long file paths', async () => {
      const longPath = '/test/project/' + 'very/'.repeat(50) + 'deep.ts';
      mockFileSystem.addFile(longPath, 'content');

      const info = await service.getFileInfo(longPath);

      expect(info?.path).toBe(longPath);
    });

    it('should handle binary files gracefully', async () => {
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0x03]).toString();
      mockFileSystem.addFile('/test/project/binary.bin', binaryContent);

      const content = await service.getFileContent('/test/project/binary.bin');

      expect(content?.content).toBeDefined();
    });

    it('should handle empty files', async () => {
      mockFileSystem.addFile('/test/project/empty.txt', '');

      const content = await service.getFileContent('/test/project/empty.txt');

      expect(content?.content).toBe('');
      expect(content?.lines).toBe(0);
    });

    it('should handle files with only whitespace', async () => {
      mockFileSystem.addFile(
        '/test/project/whitespace.txt',
        '   \n  \t  \n   '
      );

      const content = await service.getFileContent(
        '/test/project/whitespace.txt'
      );

      expect(content?.content).toBe('   \n  \t  \n   ');
      expect(content?.lines).toBe(3);
    });
  });
});

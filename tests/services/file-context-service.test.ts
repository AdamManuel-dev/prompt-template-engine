/**
 * @fileoverview Unit tests for FileContextService
 * @lastmodified 2025-08-22T14:47:00Z
 *
 * Features: Tests file context gathering functionality
 * Main APIs: FileContextService methods
 * Constraints: Mock file system operations
 * Patterns: Jest testing with mocking
 */

import { FileContextService } from '../../src/services/file-context-service';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

jest.mock('fs', () => {
  const originalFs = jest.requireActual('fs');
  return {
    ...originalFs,
    readFileSync: jest.fn(),
    existsSync: jest.fn(),
    openSync: jest.fn(),
    readSync: jest.fn(),
    closeSync: jest.fn(),
    readFile: jest.fn((_path, encoding, callback) => {
      if (typeof encoding === 'function') {
        callback = encoding;
      }
      callback(null, Buffer.from(''));
    }),
    stat: jest.fn((_path, callback) => callback(null, { size: 0 })),
    readdir: jest.fn((_path, callback) => callback(null, [])),
    promises: {
      stat: jest.fn(),
      readFile: jest.fn(),
    },
  };
});
jest.mock('glob', () => ({
  glob: jest.fn(() => Promise.resolve([])),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockGlob = glob as jest.MockedFunction<typeof glob>;

describe('FileContextService', () => {
  let service: FileContextService;
  const mockCwd = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    (mockFs.readFileSync as jest.Mock).mockReturnValue('');
    (mockFs.existsSync as jest.Mock).mockReturnValue(false);
    (mockFs.openSync as jest.Mock).mockReturnValue(1);
    (mockFs.readSync as jest.Mock).mockImplementation(() => 0);
    (mockFs.closeSync as jest.Mock).mockImplementation(() => {});
    
    service = new FileContextService(mockCwd);
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(service).toBeDefined();
    });

    it('should load .gitignore if respectGitignore is true', () => {
      mockFs.readFileSync = jest.fn().mockReturnValue('node_modules/\n*.log');
      mockFs.existsSync = jest.fn().mockReturnValue(true);
      
      const serviceWithGitignore = new FileContextService(mockCwd, {
        respectGitignore: true,
      });
      
      expect(serviceWithGitignore).toBeDefined();
      expect(mockFs.readFileSync).toHaveBeenCalledWith(
        path.join(mockCwd, '.gitignore'),
        'utf8'
      );
    });

    it('should handle missing .gitignore gracefully', () => {
      mockFs.readFileSync = jest.fn().mockImplementation(() => {
        throw new Error('ENOENT');
      });
      
      const serviceWithoutGitignore = new FileContextService(mockCwd, {
        respectGitignore: true,
      });
      
      expect(serviceWithoutGitignore).toBeDefined();
    });
  });

  describe('getFileInfo()', () => {
    it('should return file information', async () => {
      const mockStats = {
        size: 1024,
        mtime: new Date('2025-01-01'),
        isDirectory: () => false,
        isFile: () => true,
      };
      
      const statSpy = jest.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      const filePath = path.join(mockCwd, 'test.ts');
      const info = await service.getFileInfo(filePath);
      
      expect(info).toEqual({
        path: filePath,
        relativePath: 'test.ts',
        size: 1024,
        modified: new Date('2025-01-01'),
        isDirectory: false,
        extension: '.ts',
      });
      
      statSpy.mockRestore();
    });

    it('should return null for non-existent files', async () => {
      const statSpy = jest.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('ENOENT'));
      
      const info = await service.getFileInfo('/non/existent/file');
      
      expect(info).toBeNull();
      
      statSpy.mockRestore();
    });
  });

  describe('getFileContent()', () => {
    it('should read small files completely', async () => {
      const content = 'console.log("Hello");';
      const mockStats = {
        size: content.length,
      };
      
      const statSpy = jest.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      const readFileSpy = jest.spyOn(fs.promises, 'readFile').mockResolvedValue(content);
      
      const filePath = path.join(mockCwd, 'test.js');
      const result = await service.getFileContent(filePath);
      
      expect(result).toEqual({
        path: filePath,
        content,
        truncated: false,
        size: content.length,
        lines: 1,
      });
      
      statSpy.mockRestore();
      readFileSpy.mockRestore();
    });

    it('should truncate large files', async () => {
      const mockStats = {
        size: 200 * 1024, // 200KB
      };
      
      const statSpy = jest.spyOn(fs.promises, 'stat').mockResolvedValue(mockStats as any);
      
      (mockFs.readSync as jest.Mock) = jest.fn().mockImplementation((_fd, buffer) => {
        buffer.write('truncated content');
        return 17;
      });
      
      const filePath = path.join(mockCwd, 'large.txt');
      const result = await service.getFileContent(filePath, 50);
      
      expect(result).toBeDefined();
      expect(result?.truncated).toBe(true);
      expect(result?.size).toBe(200 * 1024);
      
      statSpy.mockRestore();
    });

    it('should handle read errors gracefully', async () => {
      const statSpy = jest.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('EACCES'));
      
      const result = await service.getFileContent('/protected/file');
      
      expect(result).toBeNull();
      
      statSpy.mockRestore();
    });
  });

  describe('getProjectStructure()', () => {
    it('should build project tree', async () => {
      const readdirSpy = jest.spyOn(fs.promises, 'readdir').mockImplementation((dir) => {
        if (dir === mockCwd) {
          return Promise.resolve([
            { name: 'src', isDirectory: () => true, isFile: () => false },
            { name: 'package.json', isDirectory: () => false, isFile: () => true },
          ] as any);
        }
        return Promise.resolve([]);
      });
      
      const statSpy = jest.spyOn(fs.promises, 'stat').mockResolvedValue({
        size: 100,
      } as any);
      
      const structure = await service.getProjectStructure();
      
      expect(structure.root).toBe(mockCwd);
      expect(structure.tree).toHaveLength(2);
      expect(structure.tree[0].type).toBe('directory');
      expect(structure.tree[1].type).toBe('file');
      
      readdirSpy.mockRestore();
      statSpy.mockRestore();
    });

    it('should respect max depth', async () => {
      const readdirSpy = jest.spyOn(fs.promises, 'readdir').mockResolvedValue([
        { name: 'deep', isDirectory: () => true, isFile: () => false },
      ] as any);
      
      const structure = await service.getProjectStructure(0);
      
      expect(structure.tree).toHaveLength(0);
      
      readdirSpy.mockRestore();
    });
  });

  describe('findFiles()', () => {
    it('should find files matching patterns', async () => {
      const mockFiles = [
        '/test/project/src/file1.ts',
        '/test/project/src/file2.ts',
      ];
      
      mockGlob.mockResolvedValue(mockFiles);
      
      const statSpy = jest.spyOn(fs.promises, 'stat').mockResolvedValue({
        size: 100,
        mtime: new Date(),
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      
      const files = await service.findFiles(['**/*.ts']);
      
      expect(files).toHaveLength(2);
      expect(files[0].extension).toBe('.ts');
      
      statSpy.mockRestore();
    });

    it('should exclude ignored files', async () => {
      mockFs.readFileSync = jest.fn().mockReturnValue('*.log\nnode_modules/');
      
      const serviceWithIgnore = new FileContextService(mockCwd, {
        respectGitignore: true,
      });
      
      mockGlob.mockResolvedValue([
        '/test/project/app.ts',
        '/test/project/debug.log',
        '/test/project/node_modules/lib.js',
      ]);
      
      const statSpy = jest.spyOn(fs.promises, 'stat').mockResolvedValue({
        size: 100,
        mtime: new Date(),
        isDirectory: () => false,
        isFile: () => true,
      } as any);
      
      const files = await serviceWithIgnore.findFiles(['**/*']);
      
      // Should only include app.ts, not the log or node_modules files
      expect(files.length).toBeLessThan(3);
      
      statSpy.mockRestore();
    });
  });

  describe('getProjectSummary()', () => {
    it('should generate project summary', async () => {
      const readdirSpy = jest.spyOn(fs.promises, 'readdir').mockResolvedValue([
        { name: 'index.ts', isDirectory: () => false, isFile: () => true },
        { name: 'test.js', isDirectory: () => false, isFile: () => true },
      ] as any);
      
      const statSpy = jest.spyOn(fs.promises, 'stat').mockResolvedValue({
        size: 1024,
      } as any);
      
      const summary = await service.getProjectSummary();
      
      expect(summary).toContain('Project: project');
      expect(summary).toContain('Total files: 2');
      expect(summary).toContain('File types:');
      
      readdirSpy.mockRestore();
      statSpy.mockRestore();
    });
  });

  describe('getContext()', () => {
    it('should get context for specific files', async () => {
      const content = 'test content';
      
      const statSpy = jest.spyOn(fs.promises, 'stat').mockResolvedValue({
        size: content.length,
      } as any);
      
      const readFileSpy = jest.spyOn(fs.promises, 'readFile').mockResolvedValue(content);
      
      const context = await service.getContext(['file1.ts', 'file2.ts']);
      
      expect(context.size).toBe(2);
      expect(context.get('file1.ts')).toBeDefined();
      expect(context.get('file2.ts')).toBeDefined();
      
      statSpy.mockRestore();
      readFileSpy.mockRestore();
    });

    it('should handle missing files gracefully', async () => {
      const statSpy = jest.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('ENOENT'));
      
      const context = await service.getContext(['missing.ts']);
      
      expect(context.size).toBe(0);
      
      statSpy.mockRestore();
    });
  });
});
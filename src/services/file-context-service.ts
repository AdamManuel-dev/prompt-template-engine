/**
 * @fileoverview File context gathering service with dependency injection
 * @lastmodified 2025-08-22T15:00:00Z
 *
 * Features: File discovery, content reading, .gitignore respect, size management
 * Main APIs: getFileContext(), getProjectStructure(), getFileContent()
 * Constraints: Respects .gitignore, handles large files, configurable limits
 * Patterns: Dependency injection, interface segregation, async/await
 */

import * as path from 'path';
import {
  IFileSystem,
  IGlobService,
  IIgnoreService,
  IIgnoreMatcher,
  FileSystemError,
  FileSystemErrorType,
} from '../interfaces/file-system.interface';
import {
  NodeFileSystem,
  NodeGlobService,
  NodeIgnoreService,
} from '../implementations/node-file-system';
import { logger } from '../utils/logger';

export interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  modified: Date;
  isDirectory: boolean;
  extension?: string;
}

export interface FileContent {
  path: string;
  content: string;
  truncated: boolean;
  size: number;
  lines: number;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
  size?: number;
}

export interface ProjectStructure {
  root: string;
  totalFiles: number;
  totalSize: number;
  tree: TreeNode[];
  filesByExtension: Map<string, number>;
}

export interface FileContextOptions {
  maxFileSize?: number;
  maxTotalSize?: number;
  maxFiles?: number;
  excludePatterns?: string[];
  includePatterns?: string[];
  respectGitignore?: boolean;
  includeDotfiles?: boolean;
}

const DEFAULT_OPTIONS: FileContextOptions = {
  maxFileSize: 100 * 1024, // 100KB per file
  maxTotalSize: 1024 * 1024, // 1MB total
  maxFiles: 100,
  excludePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
  includePatterns: ['**/*'],
  respectGitignore: true,
  includeDotfiles: false,
};

export class FileContextService {
  private cwd: string;

  private options: FileContextOptions;

  private ignorer: IIgnoreMatcher | null = null;

  constructor(
    private fileSystem: IFileSystem = new NodeFileSystem(),
    private globService: IGlobService = new NodeGlobService(),
    private ignoreService: IIgnoreService = new NodeIgnoreService(),
    options: FileContextOptions = {},
    cwd = process.cwd()
  ) {
    this.cwd = cwd;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    if (this.options.respectGitignore) {
      this.loadGitignore();
    }
  }

  /**
   * Load .gitignore patterns
   */
  private loadGitignore(): void {
    try {
      const gitignorePath = path.join(this.cwd, '.gitignore');
      const gitignoreContent = this.fileSystem.readFileSync(
        gitignorePath,
        'utf8'
      ) as string;
      this.ignorer = this.ignoreService.create().add(gitignoreContent);

      // Also check for global gitignore
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (homeDir) {
        const globalGitignorePath = path.join(homeDir, '.gitignore_global');
        if (this.fileSystem.exists(globalGitignorePath)) {
          const globalContent = this.fileSystem.readFileSync(
            globalGitignorePath,
            'utf8'
          ) as string;
          this.ignorer.add(globalContent);
        }
      }
    } catch (error: any) {
      // No .gitignore found or error reading it
      this.ignorer = null;
      if (
        error instanceof FileSystemError &&
        error.type !== FileSystemErrorType.FILE_NOT_FOUND
      ) {
        // Log non-file-not-found errors for debugging
        logger.warn(`Could not load .gitignore: ${error.message}`);
      }
    }
  }

  /**
   * Check if a file should be ignored
   */
  private shouldIgnore(filePath: string): boolean {
    const relativePath = path.relative(this.cwd, filePath);

    // Check gitignore
    if (this.ignorer && this.ignorer.ignores(relativePath)) {
      return true;
    }

    // Check custom exclude patterns
    if (this.options.excludePatterns) {
      // eslint-disable-next-line no-restricted-syntax
      for (const pattern of this.options.excludePatterns) {
        if (FileContextService.matchesPattern(relativePath, pattern)) {
          return true;
        }
      }
    }

    // Check dotfiles
    if (
      !this.options.includeDotfiles &&
      path.basename(filePath).startsWith('.')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Simple pattern matching
   */
  private static matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<FileInfo | null> {
    try {
      const stats = await this.fileSystem.stat(filePath);
      const relativePath = path.relative(this.cwd, filePath);

      return {
        path: filePath,
        relativePath,
        size: stats.size,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
        extension: stats.isFile() ? path.extname(filePath) : undefined,
      };
    } catch (error: any) {
      if (
        error instanceof FileSystemError &&
        error.type === FileSystemErrorType.FILE_NOT_FOUND
      ) {
        return null;
      }
      // Re-throw non-file-not-found errors
      throw error;
    }
  }

  /**
   * Get project structure
   */
  async getProjectStructure(maxDepth: number = 3): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      root: this.cwd,
      totalFiles: 0,
      totalSize: 0,
      tree: [],
      filesByExtension: new Map(),
    };

    const buildTree = async (
      dirPath: string,
      depth: number
    ): Promise<TreeNode[]> => {
      if (depth >= maxDepth) {
        return [];
      }

      const entries = (await this.fileSystem.readdir(dirPath, {
        withFileTypes: true,
      })) as import('fs').Dirent[];
      const nodes: TreeNode[] = [];

      // eslint-disable-next-line no-restricted-syntax
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (this.shouldIgnore(fullPath)) {
          // eslint-disable-next-line no-continue
          continue;
        }

        if (entry.isDirectory()) {
          // eslint-disable-next-line no-await-in-loop
          const children = await buildTree(fullPath, depth + 1);
          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'directory',
            children,
          });
        } else {
          // eslint-disable-next-line no-await-in-loop
          const fileStats = await this.fileSystem.stat(fullPath);
          const ext = path.extname(entry.name);

          structure.totalFiles += 1;
          structure.totalSize += fileStats.size;

          if (ext) {
            const count = structure.filesByExtension.get(ext) || 0;
            structure.filesByExtension.set(ext, count + 1);
          }

          nodes.push({
            name: entry.name,
            path: fullPath,
            type: 'file',
            size: fileStats.size,
          });
        }
      }

      return nodes;
    };

    structure.tree = await buildTree(this.cwd, 0);
    return structure;
  }

  /**
   * Get file content with size limits
   */
  async getFileContent(
    filePath: string,
    maxSize?: number
  ): Promise<FileContent | null> {
    if (this.shouldIgnore(filePath)) {
      return null;
    }

    try {
      const stats = await this.fileSystem.stat(filePath);
      const limit = maxSize || this.options.maxFileSize || 100 * 1024;

      if (stats.size > limit) {
        // Read only the first part of large files
        const buffer = Buffer.alloc(limit);
        const fd = this.fileSystem.openSync(filePath, 'r');
        this.fileSystem.readSync(fd, buffer, 0, limit, 0);
        this.fileSystem.closeSync(fd);

        const content = buffer.toString('utf8');
        const lines = content.split('\n').length;

        return {
          path: filePath,
          content,
          truncated: true,
          size: stats.size,
          lines,
        };
      }

      const content = (await this.fileSystem.readFile(
        filePath,
        'utf8'
      )) as string;
      const lines = content.split('\n').length;

      return {
        path: filePath,
        content,
        truncated: false,
        size: stats.size,
        lines,
      };
    } catch (error: any) {
      if (
        error instanceof FileSystemError &&
        error.type === FileSystemErrorType.FILE_NOT_FOUND
      ) {
        return null;
      }
      // Re-throw non-file-not-found errors
      throw error;
    }
  }

  /**
   * Get multiple file contents
   */
  async getFileContents(patterns: string[]): Promise<FileContent[]> {
    const contents: FileContent[] = [];
    let totalSize = 0;

    // eslint-disable-next-line no-restricted-syntax
    for (const pattern of patterns) {
      // eslint-disable-next-line no-await-in-loop
      const files = await this.globService.glob(pattern, {
        cwd: this.cwd,
        absolute: true,
        nodir: true,
        ignore: this.options.excludePatterns,
      });

      // eslint-disable-next-line no-restricted-syntax
      for (const file of files) {
        if (this.shouldIgnore(file)) {
          // eslint-disable-next-line no-continue
          continue;
        }

        if (contents.length >= (this.options.maxFiles || 100)) {
          break;
        }

        // eslint-disable-next-line no-await-in-loop
        const content = await this.getFileContent(file);
        if (content) {
          if (
            totalSize + content.size >
            (this.options.maxTotalSize || 1024 * 1024)
          ) {
            break;
          }

          contents.push(content);
          totalSize += content.size;
        }
      }
    }

    return contents;
  }

  /**
   * Get files matching patterns
   */
  async findFiles(patterns: string[]): Promise<FileInfo[]> {
    const fileInfos: FileInfo[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const pattern of patterns) {
      // eslint-disable-next-line no-await-in-loop
      const files = await this.globService.glob(pattern, {
        cwd: this.cwd,
        absolute: true,
        ignore: this.options.excludePatterns,
      });

      // eslint-disable-next-line no-restricted-syntax
      for (const file of files) {
        if (this.shouldIgnore(file)) {
          // eslint-disable-next-line no-continue
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const info = await this.getFileInfo(file);
        if (info) {
          fileInfos.push(info);
        }
      }
    }

    return fileInfos;
  }

  /**
   * Get a summary of the project
   */
  async getProjectSummary(): Promise<string> {
    const structure = await this.getProjectStructure();
    const lines: string[] = [];

    lines.push(`Project: ${path.basename(this.cwd)}`);
    lines.push(`Total files: ${structure.totalFiles}`);
    lines.push(
      `Total size: ${FileContextService.formatSize(structure.totalSize)}`
    );

    if (structure.filesByExtension.size > 0) {
      lines.push('\nFile types:');
      const sorted = Array.from(structure.filesByExtension.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      // eslint-disable-next-line no-restricted-syntax
      for (const [ext, count] of sorted) {
        lines.push(`  ${ext}: ${count} files`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format file size
   */
  private static formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Get context for specific files
   */
  async getContext(files: string[]): Promise<Map<string, FileContent>> {
    const context = new Map<string, FileContent>();

    // eslint-disable-next-line no-restricted-syntax
    for (const file of files) {
      const absolutePath = path.isAbsolute(file)
        ? file
        : path.join(this.cwd, file);
      // eslint-disable-next-line no-await-in-loop
      const content = await this.getFileContent(absolutePath);

      if (content) {
        context.set(file, content);
      }
    }

    return context;
  }
}

// Export singleton instance with default dependencies
export const fileContextService = new FileContextService(
  new NodeFileSystem(),
  new NodeGlobService(),
  new NodeIgnoreService(),
  {},
  process.cwd()
);

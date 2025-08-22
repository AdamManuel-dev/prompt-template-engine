/**
 * @fileoverview File context gathering service with .gitignore support
 * @lastmodified 2025-08-22T14:45:00Z
 *
 * Features: File discovery, content reading, .gitignore respect, size management
 * Main APIs: getFileContext(), getProjectStructure(), getFileContent()
 * Constraints: Respects .gitignore, handles large files, configurable limits
 * Patterns: Service pattern with async/await, streaming for large files
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import ignore from 'ignore';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

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

  private ignorer: ReturnType<typeof ignore> | null = null;

  constructor(cwd: string = process.cwd(), options: FileContextOptions = {}) {
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
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      this.ignorer = ignore().add(gitignoreContent);

      // Also check for global gitignore
      const homeDir = process.env.HOME || process.env.USERPROFILE;
      if (homeDir) {
        const globalGitignorePath = path.join(homeDir, '.gitignore_global');
        if (fs.existsSync(globalGitignorePath)) {
          const globalContent = fs.readFileSync(globalGitignorePath, 'utf8');
          this.ignorer.add(globalContent);
        }
      }
    } catch {
      // No .gitignore found or error reading it
      this.ignorer = null;
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
      const stats = await stat(filePath);
      const relativePath = path.relative(this.cwd, filePath);

      return {
        path: filePath,
        relativePath,
        size: stats.size,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
        extension: stats.isFile() ? path.extname(filePath) : undefined,
      };
    } catch {
      return null;
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
      if (depth > maxDepth) {
        return [];
      }

      const entries = await readdir(dirPath, { withFileTypes: true });
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
          const fileStats = await stat(fullPath);
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
      const stats = await stat(filePath);
      const limit = maxSize || this.options.maxFileSize || 100 * 1024;

      if (stats.size > limit) {
        // Read only the first part of large files
        const buffer = Buffer.alloc(limit);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, limit, 0);
        fs.closeSync(fd);

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

      const content = await readFile(filePath, 'utf8');
      const lines = content.split('\n').length;

      return {
        path: filePath,
        content,
        truncated: false,
        size: stats.size,
        lines,
      };
    } catch {
      return null;
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
      const files = await glob(pattern, {
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
      const files = await glob(pattern, {
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

// Export singleton instance
export const fileContextService = new FileContextService();

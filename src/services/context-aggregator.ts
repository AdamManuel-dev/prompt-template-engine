/**
 * @fileoverview Context aggregation service that combines all context sources
 * @lastmodified 2025-08-22T14:50:00Z
 *
 * Features: Aggregates git, file, terminal, and custom context
 * Main APIs: gatherContext(), formatContext(), getContextSummary()
 * Constraints: Size limits, performance optimization
 * Patterns: Service aggregation, template-ready formatting
 */

import * as os from 'os';
import * as path from 'path';
import { GitService, GitContext } from './git-service';
import {
  FileContextService,
  FileContent,
  ProjectStructure,
} from './file-context-service';
import {
  IFileSystem,
  IGlobService,
  IIgnoreService,
} from '../interfaces/file-system.interface';
import {
  NodeFileSystem,
  NodeGlobService,
  NodeIgnoreService,
} from '../implementations/node-file-system';

export interface SystemContext {
  platform: string;
  nodeVersion: string;
  cwd: string;
  user: string;
  timestamp: Date;
}

export interface TerminalContext {
  lastCommand?: string;
  lastOutput?: string;
  errorOutput?: string;
  exitCode?: number;
}

export interface AggregatedContext {
  system: SystemContext;
  git?: GitContext;
  project?: ProjectStructure;
  files?: Map<string, FileContent>;
  terminal?: TerminalContext;
  custom?: Record<string, unknown>;
}

export interface ContextOptions {
  includeGit?: boolean;
  includeFiles?: boolean;
  includeTerminal?: boolean;
  includeSystem?: boolean;
  filePatterns?: string[];
  maxFileSize?: number;
  maxTotalSize?: number;
}

const DEFAULT_CONTEXT_OPTIONS: ContextOptions = {
  includeGit: true,
  includeFiles: true,
  includeTerminal: false,
  includeSystem: true,
  filePatterns: [],
  maxFileSize: 50 * 1024, // 50KB per file
  maxTotalSize: 500 * 1024, // 500KB total
};

export class ContextAggregator {
  private gitService: GitService;

  private fileService: FileContextService;

  private cwd: string;

  private terminalHistory: TerminalContext[] = [];

  constructor(
    gitService?: GitService,
    fileService?: FileContextService,
    cwd: string = process.cwd(),
    fileSystem: IFileSystem = new NodeFileSystem(),
    globService: IGlobService = new NodeGlobService(),
    ignoreService: IIgnoreService = new NodeIgnoreService()
  ) {
    this.cwd = cwd;
    this.gitService = gitService || new GitService(cwd);
    this.fileService =
      fileService ||
      new FileContextService(fileSystem, globService, ignoreService, {}, cwd);
  }

  /**
   * Gather all context based on options
   */
  async gatherContext(
    options: ContextOptions = {}
  ): Promise<AggregatedContext> {
    const opts = { ...DEFAULT_CONTEXT_OPTIONS, ...options };
    const context: AggregatedContext = {
      system: this.getSystemContext(),
    };

    // Gather contexts in parallel for performance
    const promises: Promise<void>[] = [];

    if (opts.includeGit) {
      promises.push(
        this.gitService
          .getContext()
          .then(gitContext => {
            context.git = gitContext;
          })
          .catch(() => {
            // Git context failed, continue without it
          })
      );
    }

    if (opts.includeFiles) {
      promises.push(
        this.gatherFileContext(opts)
          .then(fileData => {
            context.project = fileData.structure;
            context.files = fileData.files;
          })
          .catch(() => {
            // File context failed, continue without it
          })
      );
    }

    if (opts.includeTerminal && this.terminalHistory.length > 0) {
      context.terminal = this.terminalHistory[this.terminalHistory.length - 1];
    }

    await Promise.all(promises);

    return context;
  }

  /**
   * Get system context
   */
  private getSystemContext(): SystemContext {
    return {
      platform: process.platform,
      nodeVersion: process.version,
      cwd: this.cwd,
      user: os.userInfo().username,
      timestamp: new Date(),
    };
  }

  /**
   * Gather file context
   */
  private async gatherFileContext(options: ContextOptions): Promise<{
    structure: ProjectStructure;
    files: Map<string, FileContent>;
  }> {
    const structure = await this.fileService.getProjectStructure();

    const files = new Map<string, FileContent>();

    if (options.filePatterns && options.filePatterns.length > 0) {
      const contents = await this.fileService.getFileContents(
        options.filePatterns
      );
      contents.forEach(content => {
        files.set(content.path, content);
      });
    }

    return { structure, files };
  }

  /**
   * Add terminal output to history
   */
  addTerminalOutput(context: TerminalContext): void {
    this.terminalHistory.push(context);

    // Keep only last 10 terminal outputs
    if (this.terminalHistory.length > 10) {
      this.terminalHistory.shift();
    }
  }

  /**
   * Format context for template consumption
   */
  formatContext(
    context: AggregatedContext,
    format: 'markdown' | 'json' | 'plain' = 'markdown'
  ): string {
    switch (format) {
      case 'json':
        return ContextAggregator.formatAsJson(context);
      case 'plain':
        return ContextAggregator.formatAsPlain(context);
      case 'markdown':
      default:
        return this.formatAsMarkdown(context);
    }
  }

  /**
   * Format context as markdown
   */
  private formatAsMarkdown(context: AggregatedContext): string {
    const sections: string[] = [];

    // System context
    if (context.system) {
      sections.push('## System Information');
      sections.push(`- Platform: ${context.system.platform}`);
      sections.push(`- Node Version: ${context.system.nodeVersion}`);
      sections.push(`- Working Directory: ${context.system.cwd}`);
      sections.push(`- User: ${context.system.user}`);
      sections.push(`- Timestamp: ${context.system.timestamp.toISOString()}`);
      sections.push('');
    }

    // Git context
    if (context.git && context.git.isGitRepo) {
      sections.push('## Git Repository');

      if (context.git.branch) {
        sections.push(`- Branch: ${context.git.branch}`);
      }

      if (context.git.status) {
        const { status } = context.git;
        sections.push(`- Status: ${status.isClean ? 'Clean' : 'Modified'}`);

        if (!status.isClean) {
          if (status.staged.length > 0) {
            sections.push(`  - Staged: ${status.staged.length} files`);
          }
          if (status.modified.length > 0) {
            sections.push(`  - Modified: ${status.modified.length} files`);
          }
          if (status.untracked.length > 0) {
            sections.push(`  - Untracked: ${status.untracked.length} files`);
          }
        }

        if (status.ahead > 0 || status.behind > 0) {
          sections.push(
            `- Remote: ${status.ahead} ahead, ${status.behind} behind`
          );
        }
      }

      if (context.git.lastCommit) {
        sections.push(
          `- Last Commit: ${context.git.lastCommit.hash} - ${context.git.lastCommit.message}`
        );
      }

      sections.push('');
    }

    // Project structure
    if (context.project) {
      sections.push('## Project Structure');
      sections.push(`- Total Files: ${context.project.totalFiles}`);
      sections.push(
        `- Total Size: ${ContextAggregator.formatSize(context.project.totalSize)}`
      );

      if (context.project.filesByExtension.size > 0) {
        sections.push('- File Types:');
        const sorted = Array.from(context.project.filesByExtension.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        sorted.forEach(([ext, count]) => {
          sections.push(`  - ${ext}: ${count} files`);
        });
      }

      sections.push('');
    }

    // File contents
    if (context.files && context.files.size > 0) {
      sections.push('## File Contents');

      context.files.forEach((content, filePath) => {
        const relativePath = path.relative(this.cwd, filePath);
        sections.push(`### ${relativePath}`);

        if (content.truncated) {
          sections.push(
            `*Truncated - showing first ${ContextAggregator.formatSize(content.content.length)} of ${ContextAggregator.formatSize(content.size)}*`
          );
        }

        sections.push('```');
        sections.push(content.content);
        sections.push('```');
        sections.push('');
      });
    }

    // Terminal context
    if (context.terminal) {
      sections.push('## Terminal Output');

      if (context.terminal.lastCommand) {
        sections.push(`### Last Command`);
        sections.push(`\`\`\`bash`);
        sections.push(context.terminal.lastCommand);
        sections.push(`\`\`\``);
      }

      if (context.terminal.lastOutput) {
        sections.push(`### Output`);
        sections.push(`\`\`\``);
        sections.push(context.terminal.lastOutput);
        sections.push(`\`\`\``);
      }

      if (context.terminal.errorOutput) {
        sections.push(`### Error Output`);
        sections.push(`\`\`\``);
        sections.push(context.terminal.errorOutput);
        sections.push(`\`\`\``);
      }

      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Format context as plain text
   */
  private static formatAsPlain(context: AggregatedContext): string {
    const lines: string[] = [];

    // System
    if (context.system) {
      lines.push('=== SYSTEM ===');
      lines.push(`Platform: ${context.system.platform}`);
      lines.push(`Node: ${context.system.nodeVersion}`);
      lines.push(`CWD: ${context.system.cwd}`);
      lines.push('');
    }

    // Git
    if (context.git && context.git.isGitRepo) {
      lines.push('=== GIT ===');
      if (context.git.branch) {
        lines.push(`Branch: ${context.git.branch}`);
      }
      if (context.git.status) {
        lines.push(`Clean: ${context.git.status.isClean}`);
      }
      lines.push('');
    }

    // Project
    if (context.project) {
      lines.push('=== PROJECT ===');
      lines.push(`Files: ${context.project.totalFiles}`);
      lines.push(
        `Size: ${ContextAggregator.formatSize(context.project.totalSize)}`
      );
      lines.push('');
    }

    // Files
    if (context.files && context.files.size > 0) {
      lines.push('=== FILES ===');
      context.files.forEach((content, filePath) => {
        lines.push(`--- ${filePath} ---`);
        lines.push(content.content);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  /**
   * Format context as JSON
   */
  private static formatAsJson(context: AggregatedContext): string {
    // Convert Maps to objects for JSON serialization
    const serializable = {
      ...context,
      files: context.files ? Object.fromEntries(context.files) : undefined,
      project: context.project
        ? {
            ...context.project,
            filesByExtension: Object.fromEntries(
              context.project.filesByExtension
            ),
            tree: undefined, // Exclude tree for brevity
          }
        : undefined,
    };

    return JSON.stringify(serializable, null, 2);
  }

  /**
   * Get a summary of the context
   */
  static getContextSummary(context: AggregatedContext): string {
    const parts: string[] = [];

    if (context.git?.isGitRepo) {
      parts.push(`Git: ${context.git.branch || 'unknown'}`);
    }

    if (context.project) {
      parts.push(`Files: ${context.project.totalFiles}`);
    }

    if (context.files) {
      parts.push(`Context files: ${context.files.size}`);
    }

    if (context.terminal) {
      parts.push('Terminal: included');
    }

    return parts.join(' | ');
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

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  /**
   * Calculate total context size
   */
  static calculateContextSize(context: AggregatedContext): number {
    let size = 0;

    // Estimate JSON size of structured data
    size += JSON.stringify(context.system || {}).length;
    size += JSON.stringify(context.git || {}).length;
    size += JSON.stringify(context.terminal || {}).length;

    // Add file content sizes
    if (context.files) {
      context.files.forEach(content => {
        size += content.content.length;
      });
    }

    return size;
  }
}

// Export singleton instance
export const contextAggregator = new ContextAggregator();

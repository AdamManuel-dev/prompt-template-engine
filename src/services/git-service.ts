/**
 * @fileoverview Git integration service for context gathering
 * @lastmodified 2025-08-22T14:30:00Z
 *
 * Features: Git status, branch info, diff, commits, and more
 * Main APIs: getStatus(), getBranch(), getDiff(), getCommits(), getRemotes()
 * Constraints: Gracefully handles non-git repositories
 * Patterns: Service pattern with async/await, error handling
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface GitStatus {
  branch: string;
  isClean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  ahead: number;
  behind: number;
}

export interface GitCommit {
  hash: string;
  author: string;
  date: Date;
  message: string;
}

export interface GitRemote {
  name: string;
  url: string;
  type: 'fetch' | 'push';
}

export interface GitContext {
  isGitRepo: boolean;
  branch?: string;
  status?: GitStatus;
  recentCommits?: GitCommit[];
  remotes?: GitRemote[];
  lastCommit?: GitCommit;
  diff?: string;
}

export class GitService {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Check if the current directory is a git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      const gitDir = await this.findGitDirectory();
      return gitDir !== null;
    } catch {
      return false;
    }
  }

  /**
   * Find the .git directory by traversing up the directory tree
   */
  private async findGitDirectory(): Promise<string | null> {
    let currentDir = this.cwd;
    const { root } = path.parse(currentDir);

    // eslint-disable-next-line no-await-in-loop
    while (currentDir !== root) {
      const gitPath = path.join(currentDir, '.git');
      try {
        // eslint-disable-next-line no-await-in-loop
        const stat = await fs.promises.stat(gitPath);
        if (stat.isDirectory()) {
          return currentDir;
        }
      } catch {
        // Continue searching
      }
      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Execute a git command safely using spawn to prevent command injection
   */
  private async execGit(command: string): Promise<string> {
    // Parse command into args array for safe execution
    const args = this.parseGitCommand(command);

    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', args, {
        cwd: this.cwd,
      });

      let stdout = '';
      let stderr = '';

      if (gitProcess.stdout) {
        gitProcess.stdout.on('data', data => {
          stdout += data.toString();
        });
      }

      if (gitProcess.stderr) {
        gitProcess.stderr.on('data', data => {
          stderr += data.toString();
        });
      }

      gitProcess.on('error', error => {
        reject(error);
      });

      gitProcess.on('close', code => {
        if (code === 0) {
          // Only trim trailing newline, not leading spaces which are significant for git status
          resolve(stdout.replace(/\n$/, ''));
        } else if (code === 128) {
          reject(new Error('Not a git repository'));
        } else {
          reject(new Error(`Git command failed: ${stderr || stdout}`));
        }
      });
    });
  }

  /**
   * Parse git command string into safe args array
   * This prevents command injection by treating everything as arguments
   */
  private parseGitCommand(command: string): string[] {
    // Handle common git commands with their expected formats
    // This whitelist approach ensures only safe commands are executed

    // Simple commands without arguments
    if (command === 'rev-parse --abbrev-ref HEAD') {
      return ['rev-parse', '--abbrev-ref', 'HEAD'];
    }
    if (command === 'status --porcelain=v1') {
      return ['status', '--porcelain=v1'];
    }
    if (command === 'remote -v') {
      return ['remote', '-v'];
    }

    // Commands with dynamic parts
    if (command.startsWith('log -')) {
      // Parse log command safely
      const match = command.match(/^log -(\d+) --format="([^"]+)"$/);
      if (match) {
        return ['log', `-${match[1]}`, `--format=${match[2]}`];
      }
    }

    if (command.startsWith('symbolic-ref')) {
      const parts = command.split(' ');
      return parts;
    }

    if (command.startsWith('rev-list')) {
      const parts = command.split(' ');
      return parts;
    }

    if (command.startsWith('diff')) {
      const parts = command.split(' ').filter(p => p);
      return parts;
    }

    // For any other commands, parse conservatively
    // Split by spaces but respect quoted strings
    const args: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      if (char === '"' && (i === 0 || command[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      args.push(current);
    }

    return args;
  }

  /**
   * Get the current branch name
   */
  async getBranch(): Promise<string> {
    return this.execGit('rev-parse --abbrev-ref HEAD');
  }

  /**
   * Get the git status
   */
  async getStatus(): Promise<GitStatus> {
    const branch = await this.getBranch();
    const statusOutput = await this.execGit('status --porcelain=v1');

    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    const conflicted: string[] = [];

    if (statusOutput) {
      const lines = statusOutput.split('\n').filter(line => line.trim());

      // eslint-disable-next-line no-restricted-syntax
      for (const line of lines) {
        const status = line.substring(0, 2);
        const file = line.substring(3);

        if (status === '??') {
          untracked.push(file);
        } else if (status.includes('U') || status === 'AA' || status === 'DD') {
          conflicted.push(file);
        } else if (status[0] !== ' ' && status[0] !== '?') {
          staged.push(file);
        } else if (status[1] !== ' ' && status[1] !== '?') {
          modified.push(file);
        }
      }
    }

    // Get ahead/behind counts
    let ahead = 0;
    let behind = 0;
    try {
      const upstreamBranch = await this.execGit(
        `rev-parse --abbrev-ref --symbolic-full-name @{u}`
      );
      if (upstreamBranch) {
        const counts = await this.execGit(
          `rev-list --left-right --count ${branch}...${upstreamBranch}`
        );
        const [aheadStr, behindStr] = counts.split('\t');
        ahead = parseInt(aheadStr, 10) || 0;
        behind = parseInt(behindStr, 10) || 0;
      }
    } catch {
      // No upstream branch
    }

    return {
      branch,
      isClean:
        staged.length === 0 && modified.length === 0 && untracked.length === 0,
      staged,
      modified,
      untracked,
      conflicted,
      ahead,
      behind,
    };
  }

  /**
   * Get recent commits
   */
  async getCommits(limit: number = 10): Promise<GitCommit[]> {
    const format = '%H|%an|%aI|%s';
    const output = await this.execGit(`log -${limit} --format="${format}"`);

    if (!output) {
      return [];
    }

    return output.split('\n').map(line => {
      const [hash, author, date, message] = line.split('|');
      return {
        hash: hash.substring(0, 7),
        author,
        date: new Date(date),
        message,
      };
    });
  }

  /**
   * Get the last commit
   */
  async getLastCommit(): Promise<GitCommit | undefined> {
    const commits = await this.getCommits(1);
    return commits[0];
  }

  /**
   * Get git diff
   */
  async getDiff(staged: boolean = false): Promise<string> {
    const command = staged ? 'diff --cached' : 'diff';
    return this.execGit(command);
  }

  /**
   * Get git remotes
   */
  async getRemotes(): Promise<GitRemote[]> {
    const output = await this.execGit('remote -v');

    if (!output) {
      return [];
    }

    const remotes: GitRemote[] = [];
    const lines = output.split('\n');

    // eslint-disable-next-line no-restricted-syntax
    for (const line of lines) {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
      if (match) {
        remotes.push({
          name: match[1],
          url: match[2],
          type: match[3] as 'fetch' | 'push',
        });
      }
    }

    return remotes;
  }

  /**
   * Get comprehensive git context
   */
  async getContext(): Promise<GitContext> {
    const isGitRepo = await this.isGitRepo();

    if (!isGitRepo) {
      return { isGitRepo: false };
    }

    try {
      const [branch, status, recentCommits, remotes, lastCommit] =
        await Promise.all([
          this.getBranch(),
          this.getStatus(),
          this.getCommits(5),
          this.getRemotes(),
          this.getLastCommit(),
        ]);

      // Get diff only if there are changes
      let diff: string | undefined;
      if (!status.isClean) {
        diff = await this.getDiff();
      }

      return {
        isGitRepo: true,
        branch,
        status,
        recentCommits,
        remotes,
        lastCommit,
        diff,
      };
    } catch {
      // Return minimal context if git commands fail
      return { isGitRepo: true };
    }
  }

  /**
   * Get a formatted summary of git status
   */
  async getSummary(): Promise<string> {
    const context = await this.getContext();

    if (!context.isGitRepo) {
      return 'Not a git repository';
    }

    const lines: string[] = [];

    if (context.branch) {
      lines.push(`Branch: ${context.branch}`);
    }

    if (context.status) {
      const { status } = context;

      if (status.isClean) {
        lines.push('Working tree clean');
      } else {
        if (status.staged.length > 0) {
          lines.push(`Staged: ${status.staged.length} file(s)`);
        }
        if (status.modified.length > 0) {
          lines.push(`Modified: ${status.modified.length} file(s)`);
        }
        if (status.untracked.length > 0) {
          lines.push(`Untracked: ${status.untracked.length} file(s)`);
        }
        if (status.conflicted.length > 0) {
          lines.push(`Conflicted: ${status.conflicted.length} file(s)`);
        }
      }

      if (status.ahead > 0 || status.behind > 0) {
        const parts = [];
        if (status.ahead > 0) parts.push(`${status.ahead} ahead`);
        if (status.behind > 0) parts.push(`${status.behind} behind`);
        lines.push(`Remote: ${parts.join(', ')}`);
      }
    }

    if (context.lastCommit) {
      lines.push(
        `Last commit: ${context.lastCommit.hash} - ${context.lastCommit.message}`
      );
    }

    return lines.join('\n');
  }
}

// Export singleton instance for convenience
export const gitService = new GitService();

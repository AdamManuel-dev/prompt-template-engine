/**
 * @fileoverview Unit tests for GitService
 * @lastmodified 2025-08-22T14:35:00Z
 *
 * Features: Tests git integration functionality
 * Main APIs: GitService methods
 * Constraints: Mock git commands for testing
 * Patterns: Jest testing with mocking
 */

import { GitService } from '../../../src/services/git-service';
import { exec } from 'child_process';
import * as fs from 'fs';

jest.mock('child_process');
jest.mock('fs', () => ({
  promises: {
    stat: jest.fn(),
  },
}));

const mockExec = exec as any;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('GitService', () => {
  let gitService: GitService;
  const mockCwd = '/test/project';

  beforeEach(() => {
    gitService = new GitService(mockCwd);
    jest.clearAllMocks();
  });

  describe('isGitRepo()', () => {
    it('should return true when .git directory exists', async () => {
      const statMock = mockFs.promises.stat as jest.Mock;
      statMock.mockImplementation((pathArg: string) => {
        if (pathArg === '/test/project/.git') {
          return Promise.resolve({
            isDirectory: () => true,
          });
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await gitService.isGitRepo();
      expect(result).toBe(true);
      expect(statMock).toHaveBeenCalledWith('/test/project/.git');
    });

    it('should return false when .git directory does not exist', async () => {
      (mockFs.promises.stat as jest.Mock).mockRejectedValue(
        new Error('ENOENT')
      );

      const result = await gitService.isGitRepo();
      expect(result).toBe(false);
    });

    it('should search parent directories for .git', async () => {
      const statMock = mockFs.promises.stat as jest.Mock;
      let callCount = 0;
      statMock.mockImplementation((path: string) => {
        callCount++;
        if (callCount === 1 && path === '/test/project/.git') {
          return Promise.reject(new Error('ENOENT'));
        }
        if (callCount === 2 && path === '/test/.git') {
          return Promise.resolve({ isDirectory: () => true });
        }
        return Promise.reject(new Error('ENOENT'));
      });

      const result = await gitService.isGitRepo();
      expect(result).toBe(true);
      expect(statMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBranch()', () => {
    it('should return the current branch name', async () => {
      mockExec.mockImplementation(
        (
          _cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          callback(null, 'main\n', '');
          return null;
        }
      );

      const result = await gitService.getBranch();
      expect(result).toBe('main');
    });

    it('should throw error for non-git repository', async () => {
      mockExec.mockImplementation(
        (
          _cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          const error = new Error('fatal: not a git repository') as Error & {
            code: number;
          };
          error.code = 128;
          callback(error);
          return null;
        }
      );

      await expect(gitService.getBranch()).rejects.toThrow(
        'Not a git repository'
      );
    });
  });

  describe('getStatus()', () => {
    beforeEach(() => {
      // Mock getBranch to return 'main'
      mockExec.mockImplementation(
        (
          cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
            callback(null, 'main\n', '');
          } else if (cmd.includes('status --porcelain')) {
            callback(null, '', '');
          } else {
            callback(new Error('No upstream'));
          }
          return null;
        }
      );
    });

    it('should return clean status when no changes', async () => {
      const status = await gitService.getStatus();

      expect(status).toEqual({
        branch: 'main',
        isClean: true,
        staged: [],
        modified: [],
        untracked: [],
        conflicted: [],
        ahead: 0,
        behind: 0,
      });
    });

    it('should parse staged files correctly', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
            callback(null, 'main\n', '');
          } else if (cmd.includes('status --porcelain')) {
            callback(null, 'A  file1.ts\nM  file2.ts\n', '');
          } else {
            callback(new Error('No upstream'));
          }
          return null;
        }
      );

      const status = await gitService.getStatus();
      expect(status.staged).toEqual(['file1.ts', 'file2.ts']);
      expect(status.isClean).toBe(false);
    });

    it('should parse modified files correctly', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
            callback(null, 'main\n', '');
          } else if (cmd.includes('status --porcelain')) {
            callback(null, ' M file1.ts\n M file2.ts\n', '');
          } else {
            callback(new Error('No upstream'));
          }
          return null;
        }
      );

      const status = await gitService.getStatus();
      expect(status.modified).toEqual(['file1.ts', 'file2.ts']);
    });

    it('should parse untracked files correctly', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
            callback(null, 'main\n', '');
          } else if (cmd.includes('status --porcelain')) {
            callback(null, '?? file1.ts\n?? file2.ts\n', '');
          } else {
            callback(new Error('No upstream'));
          }
          return null;
        }
      );

      const status = await gitService.getStatus();
      expect(status.untracked).toEqual(['file1.ts', 'file2.ts']);
    });

    it('should parse conflicted files correctly', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
            callback(null, 'main\n', '');
          } else if (cmd.includes('status --porcelain')) {
            callback(null, 'UU file1.ts\nAA file2.ts\n', '');
          } else {
            callback(new Error('No upstream'));
          }
          return null;
        }
      );

      const status = await gitService.getStatus();
      expect(status.conflicted).toEqual(['file1.ts', 'file2.ts']);
    });

    it('should get ahead/behind counts', async () => {
      mockExec.mockImplementation(
        (
          cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
            callback(null, 'main\n', '');
          } else if (cmd.includes('status --porcelain')) {
            callback(null, '', '');
          } else if (
            cmd.includes('rev-parse --abbrev-ref --symbolic-full-name')
          ) {
            callback(null, 'origin/main\n', '');
          } else if (cmd.includes('rev-list --left-right --count')) {
            callback(null, '2\t3\n', '');
          }
          return null;
        }
      );

      const status = await gitService.getStatus();
      expect(status.ahead).toBe(2);
      expect(status.behind).toBe(3);
    });
  });

  describe('getCommits()', () => {
    it('should return parsed commits', async () => {
      const mockOutput = [
        'abc1234|John Doe|2025-01-01T10:00:00Z|Initial commit',
        'def5678|Jane Smith|2025-01-02T11:00:00Z|Add feature',
      ].join('\n');

      mockExec.mockImplementation(
        (
          _cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          callback(null, mockOutput, '');
          return null;
        }
      );

      const commits = await gitService.getCommits(2);

      expect(commits).toHaveLength(2);
      expect(commits[0]).toEqual({
        hash: 'abc1234',
        author: 'John Doe',
        date: new Date('2025-01-01T10:00:00Z'),
        message: 'Initial commit',
      });
    });

    it('should return empty array when no commits', async () => {
      mockExec.mockImplementation(
        (
          _cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          callback(null, '', '');
          return null;
        }
      );

      const commits = await gitService.getCommits();
      expect(commits).toEqual([]);
    });
  });

  describe('getDiff()', () => {
    it('should get unstaged diff by default', async () => {
      const mockDiff = 'diff --git a/file.ts b/file.ts\n+ added line';
      mockExec.mockImplementation(
        (
          cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          if (cmd.includes('git diff') && !cmd.includes('--cached')) {
            callback(null, mockDiff, '');
          }
          return null;
        }
      );

      const diff = await gitService.getDiff();
      expect(diff).toBe(mockDiff);
    });

    it('should get staged diff when specified', async () => {
      const mockDiff = 'diff --git a/file.ts b/file.ts\n+ staged line';
      mockExec.mockImplementation(
        (
          cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          if (cmd.includes('git diff --cached')) {
            callback(null, mockDiff, '');
          }
          return null;
        }
      );

      const diff = await gitService.getDiff(true);
      expect(diff).toBe(mockDiff);
    });
  });

  describe('getRemotes()', () => {
    it('should parse remotes correctly', async () => {
      const mockOutput = [
        'origin\thttps://github.com/user/repo.git\t(fetch)',
        'origin\thttps://github.com/user/repo.git\t(push)',
        'upstream\thttps://github.com/other/repo.git\t(fetch)',
      ].join('\n');

      mockExec.mockImplementation(
        (
          _cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          callback(null, mockOutput, '');
          return null;
        }
      );

      const remotes = await gitService.getRemotes();

      expect(remotes).toHaveLength(3);
      expect(remotes[0]).toEqual({
        name: 'origin',
        url: 'https://github.com/user/repo.git',
        type: 'fetch',
      });
    });

    it('should return empty array when no remotes', async () => {
      mockExec.mockImplementation(
        (
          _cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          callback(null, '', '');
          return null;
        }
      );

      const remotes = await gitService.getRemotes();
      expect(remotes).toEqual([]);
    });
  });

  describe('getContext()', () => {
    it('should return full context for git repo', async () => {
      (mockFs.promises.stat as jest.Mock).mockImplementation((path: string) => {
        if (path.endsWith('.git')) {
          return Promise.resolve({
            isDirectory: () => true,
          });
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockExec.mockImplementation(
        (
          cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
            callback(null, 'main\n', '');
          } else if (cmd.includes('status --porcelain')) {
            callback(null, ' M file.ts\n', '');
          } else if (cmd.includes('git log')) {
            callback(null, 'abc1234|John|2025-01-01T10:00:00Z|Commit\n', '');
          } else if (cmd.includes('remote -v')) {
            callback(
              null,
              'origin\thttps://github.com/user/repo.git\t(fetch)\n',
              ''
            );
          } else if (cmd.includes('git diff')) {
            callback(null, 'diff content', '');
          } else {
            callback(new Error('No upstream'));
          }
          return null;
        }
      );

      const context = await gitService.getContext();

      expect(context.isGitRepo).toBe(true);
      expect(context.branch).toBe('main');
      expect(context.status).toBeDefined();
      expect(context.recentCommits).toBeDefined();
      expect(context.remotes).toBeDefined();
      expect(context.diff).toBe('diff content');
    });

    it('should return minimal context for non-git repo', async () => {
      (mockFs.promises.stat as jest.Mock).mockRejectedValue(
        new Error('ENOENT')
      );

      const context = await gitService.getContext();
      expect(context).toEqual({ isGitRepo: false });
    });
  });

  describe('getSummary()', () => {
    it('should generate summary for clean repo', async () => {
      (mockFs.promises.stat as jest.Mock).mockImplementation((path: string) => {
        if (path.endsWith('.git')) {
          return Promise.resolve({
            isDirectory: () => true,
          });
        }
        return Promise.reject(new Error('ENOENT'));
      });

      mockExec.mockImplementation(
        (
          cmd: string,
          _opts: unknown,
          callback: (
            error: Error | null,
            stdout?: string,
            stderr?: string
          ) => void
        ) => {
          if (cmd.includes('rev-parse --abbrev-ref HEAD')) {
            callback(null, 'main\n', '');
          } else if (cmd.includes('status --porcelain')) {
            callback(null, '', '');
          } else if (cmd.includes('git log')) {
            callback(
              null,
              'abc1234|John|2025-01-01T10:00:00Z|Initial commit\n',
              ''
            );
          } else if (cmd.includes('remote -v')) {
            callback(null, '', '');
          } else {
            callback(new Error('No upstream'));
          }
          return null;
        }
      );

      const summary = await gitService.getSummary();

      expect(summary).toContain('Branch: main');
      expect(summary).toContain('Working tree clean');
      expect(summary).toContain('Last commit: abc1234 - Initial commit');
    });

    it('should show message for non-git repo', async () => {
      (mockFs.promises.stat as jest.Mock).mockRejectedValue(
        new Error('ENOENT')
      );

      const summary = await gitService.getSummary();
      expect(summary).toBe('Not a git repository');
    });
  });
});

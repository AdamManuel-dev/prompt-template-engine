/**
 * @fileoverview Git context command for gathering git information
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Git status, branch info, commit history, diff analysis
 * Main APIs: execute(), gatherGitContext(), formatGitInfo()
 * Constraints: Requires git repository, simple-git dependency
 * Patterns: Command pattern, git integration, template generation
 */

import { BaseCommand } from '../../../src/cli/base-command';
import { ICommand } from '../../../src/cli/command-registry';
import * as path from 'path';
import * as fs from 'fs/promises';

export class GitContextCommand extends BaseCommand implements ICommand {
  name = 'git-context';
  description = 'Gather comprehensive git context for templates';
  aliases = ['gc', 'git-info'];
  
  options = [
    {
      flags: '-f, --format <format>',
      description: 'Output format (json, yaml, template)',
      defaultValue: 'json'
    },
    {
      flags: '-o, --output <file>',
      description: 'Save context to file'
    },
    {
      flags: '--include-diff',
      description: 'Include current diff in context',
      defaultValue: false
    },
    {
      flags: '--history <count>',
      description: 'Number of commits to include in history',
      defaultValue: 10
    }
  ];

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options);
  }

  async execute(_args: string, options: Record<string, unknown>): Promise<void> {
    try {
      this.info('Gathering git context...');
      
      const context = await this.gatherGitContext(options);
      const formatted = await this.formatContext(context, options.format);
      
      if (options.output) {
        await this.saveToFile(options.output, formatted);
        this.success(`Git context saved to: ${options.output}`);
      } else {
        console.log(formatted);
      }
      
      this.success('Git context gathered successfully!');
    } catch (error) {
      this.error(`Failed to gather git context: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async gatherGitContext(options: Record<string, unknown>): Promise<GitContext> {
    const simpleGit = await this.getSimpleGit();
    const isRepo = await simpleGit.checkIsRepo();
    
    if (!isRepo) {
      throw new Error('Not a git repository');
    }

    const context: GitContext = {
      repository: await this.getRepositoryInfo(simpleGit),
      branch: await this.getBranchInfo(simpleGit),
      status: await this.getStatusInfo(simpleGit),
      history: await this.getCommitHistory(simpleGit, options.history),
      remote: await this.getRemoteInfo(simpleGit),
      stats: await this.getRepoStats(simpleGit),
      timestamp: new Date().toISOString()
    };

    if (options.includeDiff) {
      context.diff = await this.getDiffInfo(simpleGit);
    }

    return context;
  }

  private async getSimpleGit(): Promise<any> {
    try {
      const { simpleGit } = await import('simple-git');
      return simpleGit();
    } catch (error) {
      throw new Error('simple-git dependency not found. Please install: npm install simple-git');
    }
  }

  private async getRepositoryInfo(git: Record<string, unknown>): Promise<RepositoryInfo> {
    const root = await git.revparse(['--show-toplevel']);
    const gitDir = await git.revparse(['--git-dir']);
    
    return {
      root: root.trim(),
      gitDir: gitDir.trim(),
      name: path.basename(root.trim())
    };
  }

  private async getBranchInfo(git: Record<string, unknown>): Promise<BranchInfo> {
    const current = await git.branch(['-v']);
    const all = await git.branch(['-a']);
    
    return {
      current: current.current,
      all: all.all,
      tracking: current.tracking || null,
      ahead: current.ahead || 0,
      behind: current.behind || 0
    };
  }

  private async getStatusInfo(git: Record<string, unknown>): Promise<StatusInfo> {
    const status = await git.status();
    
    return {
      clean: status.isClean(),
      staged: status.staged,
      modified: status.modified,
      deleted: status.deleted,
      created: status.created,
      renamed: status.renamed,
      untracked: status.not_added,
      conflicted: status.conflicted
    };
  }

  private async getCommitHistory(git: Record<string, unknown>, count: number): Promise<CommitInfo[]> {
    const log = await git.log({ maxCount: count });
    
    return log.all.map((commit: Record<string, unknown>) => ({
      hash: commit.hash,
      hashShort: commit.hash.substring(0, 7),
      date: commit.date,
      message: commit.message,
      author: {
        name: commit.author_name,
        email: commit.author_email
      },
      refs: commit.refs
    }));
  }

  private async getRemoteInfo(git: Record<string, unknown>): Promise<RemoteInfo[]> {
    try {
      const remotes = await git.getRemotes(true);
      return remotes.map((remote: Record<string, unknown>) => ({
        name: remote.name,
        url: remote.refs.fetch,
        pushUrl: remote.refs.push
      }));
    } catch {
      return [];
    }
  }

  private async getRepoStats(git: Record<string, unknown>): Promise<RepoStats> {
    try {
      const totalCommits = await git.raw(['rev-list', '--count', 'HEAD']);
      const contributors = await git.raw(['shortlog', '-sn']);
      
      return {
        totalCommits: parseInt(totalCommits.trim()),
        contributors: contributors.trim().split('\n').length,
        size: await this.getRepoSize()
      };
    } catch {
      return {
        totalCommits: 0,
        contributors: 0,
        size: 0
      };
    }
  }

  private async getDiffInfo(git: Record<string, unknown>): Promise<DiffInfo> {
    const staged = await git.diff(['--cached']);
    const unstaged = await git.diff();
    
    return {
      staged: staged || '',
      unstaged: unstaged || '',
      hasChanges: !!(staged || unstaged)
    };
  }

  private async getRepoSize(): Promise<number> {
    try {
      const gitDir = path.join(process.cwd(), '.git');
      const stats = await fs.stat(gitDir);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private async formatContext(context: GitContext, format: string): Promise<string> {
    switch (format.toLowerCase()) {
      case 'yaml':
        const yaml = await import('js-yaml');
        return yaml.dump(context);
      
      case 'template':
        return this.formatAsTemplate(context);
      
      case 'json':
      default:
        return JSON.stringify(context, null, 2);
    }
  }

  private formatAsTemplate(context: GitContext): string {
    return `# Git Context Template

## Repository Information
- **Name**: ${context.repository.name}
- **Path**: ${context.repository.root}
- **Current Branch**: ${context.branch.current}
- **Clean**: ${context.status.clean ? 'Yes' : 'No'}

## Branch Status
- **Tracking**: ${context.branch.tracking || 'None'}
- **Ahead**: ${context.branch.ahead} commits
- **Behind**: ${context.branch.behind} commits

## Working Directory Status
- **Modified**: ${context.status.modified.length} files
- **Staged**: ${context.status.staged.length} files
- **Untracked**: ${context.status.untracked.length} files
- **Deleted**: ${context.status.deleted.length} files

## Recent Commits
${context.history.slice(0, 5).map(commit => 
  `- **${commit.hashShort}**: ${commit.message} (${commit.author.name})`
).join('\n')}

## Repository Stats
- **Total Commits**: ${context.stats.totalCommits}
- **Contributors**: ${context.stats.contributors}

## Variables for Templates
\`\`\`json
{
  "git": {
    "branch": "${context.branch.current}",
    "clean": ${context.status.clean},
    "repoName": "${context.repository.name}",
    "lastCommit": "${context.history[0]?.message || 'No commits'}",
    "author": "${context.history[0]?.author.name || 'Unknown'}"
  }
}
\`\`\`
`;
  }

  private async saveToFile(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf8');
  }
}

// Type definitions
interface GitContext {
  repository: RepositoryInfo;
  branch: BranchInfo;
  status: StatusInfo;
  history: CommitInfo[];
  remote: RemoteInfo[];
  stats: RepoStats;
  diff?: DiffInfo;
  timestamp: string;
}

interface RepositoryInfo {
  root: string;
  gitDir: string;
  name: string;
}

interface BranchInfo {
  current: string;
  all: string[];
  tracking: string | null;
  ahead: number;
  behind: number;
}

interface StatusInfo {
  clean: boolean;
  staged: string[];
  modified: string[];
  deleted: string[];
  created: string[];
  renamed: string[];
  untracked: string[];
  conflicted: string[];
}

interface CommitInfo {
  hash: string;
  hashShort: string;
  date: string;
  message: string;
  author: {
    name: string;
    email: string;
  };
  refs: string;
}

interface RemoteInfo {
  name: string;
  url: string;
  pushUrl: string;
}

interface RepoStats {
  totalCommits: number;
  contributors: number;
  size: number;
}

interface DiffInfo {
  staged: string;
  unstaged: string;
  hasChanges: boolean;
}

export default new GitContextCommand();
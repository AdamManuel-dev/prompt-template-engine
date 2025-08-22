/**
 * @fileoverview Git template command for creating git-aware templates
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Template generation with git context, branch-specific templates
 * Main APIs: execute(), generateTemplate(), injectGitContext()
 * Constraints: Requires git repository, template engine
 * Patterns: Template generation, git integration, context injection
 */

import { BaseCommand } from '../../../src/cli/base-command';
import { ICommand } from '../../../src/cli/command-registry';
import { TemplateEngine } from '../../../src/core/template-engine';
import * as path from 'path';
import * as fs from 'fs/promises';

export class GitTemplateCommand extends BaseCommand implements ICommand {
  name = 'git-template';
  description = 'Generate templates with automatic git context injection';
  aliases = ['gt', 'git-gen'];
  
  options = [
    {
      flags: '-t, --template <name>',
      description: 'Template name to generate'
    },
    {
      flags: '-o, --output <file>',
      description: 'Output file path'
    },
    {
      flags: '--branch-specific',
      description: 'Generate branch-specific template',
      defaultValue: false
    },
    {
      flags: '--include-status',
      description: 'Include git status in template',
      defaultValue: true
    },
    {
      flags: '--include-diff',
      description: 'Include git diff in template',
      defaultValue: false
    }
  ];

  async action(args: unknown, options: unknown): Promise<void> {
    await this.execute(args as string, options);
  }

  async execute(_args: string, options: any): Promise<void> {
    try {
      this.info('Generating git-aware template...');
      
      if (!options.template) {
        this.error('Template name is required. Use -t or --template');
        return;
      }

      const gitContext = await this.gatherGitContext(options);
      const templateEngine = new TemplateEngine();
      
      // Load the template
      const templatePath = await this.findTemplate(options.template);
      const templateContent = await fs.readFile(templatePath, 'utf8');
      
      // Inject git context into template variables
      const variables = await this.prepareTemplateVariables(gitContext, options);
      
      // Render template with git context
      const rendered = await templateEngine.render(templateContent, variables);
      
      if (options.output) {
        await fs.writeFile(options.output, rendered, 'utf8');
        this.success(`Git template saved to: ${options.output}`);
      } else {
        console.log(rendered);
      }
      
      this.success('Git template generated successfully!');
    } catch (error) {
      this.error(`Failed to generate git template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async gatherGitContext(options: any): Promise<GitContext> {
    const simpleGit = await this.getSimpleGit();
    const isRepo = await simpleGit.checkIsRepo();
    
    if (!isRepo) {
      throw new Error('Not a git repository');
    }

    const branch = await simpleGit.branch(['-v']);
    const status = await simpleGit.status();
    const log = await simpleGit.log({ maxCount: 5 });
    
    const context: GitContext = {
      branch: {
        current: branch.current,
        tracking: branch.tracking,
        ahead: branch.ahead || 0,
        behind: branch.behind || 0
      },
      status: {
        clean: status.isClean(),
        modified: status.modified,
        staged: status.staged,
        untracked: status.not_added,
        conflicted: status.conflicted
      },
      commits: log.all.slice(0, 5).map((commit: any) => ({
        hash: commit.hash.substring(0, 7),
        message: commit.message,
        author: commit.author_name,
        date: commit.date
      })),
      repository: {
        name: path.basename(await simpleGit.revparse(['--show-toplevel'])),
        root: await simpleGit.revparse(['--show-toplevel'])
      }
    };

    if (options.includeDiff) {
      context.diff = {
        staged: await simpleGit.diff(['--cached']),
        unstaged: await simpleGit.diff()
      };
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

  private async findTemplate(templateName: string): Promise<string> {
    const possiblePaths = [
      path.join(process.cwd(), 'templates', `${templateName}.md`),
      path.join(process.cwd(), '.cursor-prompt', 'templates', `${templateName}.md`),
      path.join(__dirname, '..', '..', '..', 'templates', `${templateName}.md`)
    ];

    for (const templatePath of possiblePaths) {
      try {
        await fs.access(templatePath);
        return templatePath;
      } catch {
        continue;
      }
    }

    throw new Error(`Template not found: ${templateName}`);
  }

  private async prepareTemplateVariables(gitContext: GitContext, options: any): Promise<Record<string, any>> {
    const now = new Date();
    
    const variables: Record<string, any> = {
      // Git context variables
      git: {
        branch: gitContext.branch.current,
        tracking: gitContext.branch.tracking,
        ahead: gitContext.branch.ahead,
        behind: gitContext.branch.behind,
        clean: gitContext.status.clean,
        repository: gitContext.repository.name,
        repositoryPath: gitContext.repository.root
      },
      
      // Time variables
      timestamp: now.toISOString(),
      date: now.toLocaleDateString(),
      time: now.toLocaleTimeString(),
      
      // Commit information
      lastCommit: gitContext.commits[0] || null,
      recentCommits: gitContext.commits,
      
      // Status information
      modifiedFiles: gitContext.status.modified,
      stagedFiles: gitContext.status.staged,
      untrackedFiles: gitContext.status.untracked,
      conflictedFiles: gitContext.status.conflicted
    };

    // Add status summary if requested
    if (options.includeStatus) {
      variables.git.statusSummary = this.createStatusSummary(gitContext.status);
    }

    // Add diff information if requested
    if (options.includeDiff && gitContext.diff) {
      variables.git.diff = gitContext.diff;
      variables.git.hasChanges = !!(gitContext.diff.staged || gitContext.diff.unstaged);
    }

    // Branch-specific variables
    if (options.branchSpecific) {
      variables.git.branchType = this.determineBranchType(gitContext.branch.current);
      variables.git.isFeatureBranch = gitContext.branch.current.startsWith('feature/');
      variables.git.isBugfixBranch = gitContext.branch.current.startsWith('bugfix/');
      variables.git.isHotfixBranch = gitContext.branch.current.startsWith('hotfix/');
      variables.git.isMainBranch = ['main', 'master', 'develop'].includes(gitContext.branch.current);
    }

    return variables;
  }

  private createStatusSummary(status: any): string {
    const parts = [];
    
    if (status.clean) {
      return 'Working directory clean';
    }
    
    if (status.modified.length > 0) {
      parts.push(`${status.modified.length} modified`);
    }
    
    if (status.staged.length > 0) {
      parts.push(`${status.staged.length} staged`);
    }
    
    if (status.untracked.length > 0) {
      parts.push(`${status.untracked.length} untracked`);
    }
    
    if (status.conflicted.length > 0) {
      parts.push(`${status.conflicted.length} conflicted`);
    }
    
    return parts.join(', ');
  }

  private determineBranchType(branchName: string): string {
    if (branchName.startsWith('feature/')) return 'feature';
    if (branchName.startsWith('bugfix/')) return 'bugfix';
    if (branchName.startsWith('hotfix/')) return 'hotfix';
    if (branchName.startsWith('release/')) return 'release';
    if (['main', 'master'].includes(branchName)) return 'main';
    if (branchName === 'develop') return 'develop';
    return 'other';
  }
}

// Type definitions
interface GitContext {
  branch: {
    current: string;
    tracking: string | null;
    ahead: number;
    behind: number;
  };
  status: {
    clean: boolean;
    modified: string[];
    staged: string[];
    untracked: string[];
    conflicted: string[];
  };
  commits: Array<{
    hash: string;
    message: string;
    author: string;
    date: string;
  }>;
  repository: {
    name: string;
    root: string;
  };
  diff?: {
    staged: string;
    unstaged: string;
  };
}

export default new GitTemplateCommand();
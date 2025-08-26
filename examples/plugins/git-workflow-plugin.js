/**
 * Git Workflow Plugin
 * 
 * Enhances templates with git information and provides workflow automation
 * for common git operations.
 */

module.exports = {
  name: 'git-workflow',
  version: '1.0.0',
  description: 'Git integration and workflow automation for templates',
  author: 'cursor-prompt-community',
  
  permissions: ['exec:git', 'fs:read'],
  
  defaultConfig: {
    autoStage: false,
    includeHistory: true,
    historyLimit: 10,
    includeBranches: true,
    includeRemotes: true,
    conventionalCommits: true
  },
  
  async init(api) {
    this.api = api;
    this.config = { ...this.defaultConfig, ...api.getConfig('git-workflow') };
    
    // Register git commands
    this.registerCommands(api);
    
    // Register variable providers
    this.registerVariableProviders(api);
    
    // Register commit message formatter
    api.registerFormatter('commit-message', (message) => {
      return this.formatCommitMessage(message);
    });
    
    return true;
  },
  
  registerCommands(api) {
    // Git status command
    api.registerCommand('git:status', {
      execute: async () => {
        const status = await this.getGitStatus();
        return this.formatStatus(status);
      },
      description: 'Show enhanced git status with template context'
    });
    
    // Smart commit command
    api.registerCommand('git:smart-commit', {
      execute: async (args) => {
        const message = await this.generateCommitMessage(args.files);
        if (args.execute) {
          await this.executeCommit(message);
        }
        return message;
      },
      description: 'Generate and optionally execute smart commit',
      options: [
        { name: 'files', type: 'array', description: 'Files to analyze' },
        { name: 'execute', type: 'boolean', description: 'Execute commit' }
      ]
    });
    
    // Branch management
    api.registerCommand('git:branch-template', {
      execute: async (args) => {
        const branchName = this.generateBranchName(args.type, args.description);
        if (args.create) {
          await this.createBranch(branchName);
        }
        return branchName;
      },
      description: 'Generate branch name from template',
      options: [
        { name: 'type', type: 'string', description: 'Branch type (feature/fix/chore)' },
        { name: 'description', type: 'string', description: 'Branch description' },
        { name: 'create', type: 'boolean', description: 'Create the branch' }
      ]
    });
    
    // PR template generator
    api.registerCommand('git:pr-template', {
      execute: async (args) => {
        const template = await this.generatePRTemplate(args.target);
        return template;
      },
      description: 'Generate PR template with context',
      options: [
        { name: 'target', type: 'string', description: 'Target branch' }
      ]
    });
  },
  
  registerVariableProviders(api) {
    // Current branch
    api.registerVariableProvider('git.branch', async () => {
      return await this.getCurrentBranch();
    });
    
    // Git diff
    api.registerVariableProvider('git.diff', async () => {
      return await this.getGitDiff();
    });
    
    // Staged files
    api.registerVariableProvider('git.staged', async () => {
      return await this.getStagedFiles();
    });
    
    // Modified files
    api.registerVariableProvider('git.modified', async () => {
      return await this.getModifiedFiles();
    });
    
    // Commit history
    api.registerVariableProvider('git.history', async () => {
      return await this.getCommitHistory(this.config.historyLimit);
    });
    
    // Remote info
    api.registerVariableProvider('git.remote', async () => {
      return await this.getRemoteInfo();
    });
  },
  
  hooks: {
    'before-template': async (context) => {
      // Add git context to all templates
      if (await this.isGitRepository()) {
        context.variables.git = {
          branch: await this.getCurrentBranch(),
          status: await this.getGitStatus(),
          lastCommit: await this.getLastCommit()
        };
        
        if (context.includeGitDiff !== false) {
          context.variables.git.diff = await this.getGitDiff();
        }
        
        if (this.config.includeHistory) {
          context.variables.git.history = await this.getCommitHistory(5);
        }
      }
      
      return context;
    },
    
    'after-generate': async (result, context) => {
      // Auto-stage files if configured
      if (this.config.autoStage && context.modifiedFiles) {
        await this.stageFiles(context.modifiedFiles);
        result.gitStatus = 'Files staged for commit';
      }
      
      return result;
    }
  },
  
  // Git operations
  async isGitRepository() {
    try {
      const result = await this.api.exec('git rev-parse --is-inside-work-tree');
      return result.stdout.trim() === 'true';
    } catch {
      return false;
    }
  },
  
  async getCurrentBranch() {
    try {
      const result = await this.api.exec('git branch --show-current');
      return result.stdout.trim();
    } catch {
      return 'unknown';
    }
  },
  
  async getGitStatus() {
    try {
      const result = await this.api.exec('git status --porcelain');
      const lines = result.stdout.trim().split('\n').filter(Boolean);
      
      const status = {
        staged: [],
        modified: [],
        untracked: [],
        deleted: [],
        renamed: []
      };
      
      lines.forEach(line => {
        const [statusCode, ...fileParts] = line.split(' ');
        const file = fileParts.join(' ');
        
        if (statusCode.includes('M')) status.modified.push(file);
        if (statusCode.includes('A')) status.staged.push(file);
        if (statusCode.includes('?')) status.untracked.push(file);
        if (statusCode.includes('D')) status.deleted.push(file);
        if (statusCode.includes('R')) status.renamed.push(file);
      });
      
      return status;
    } catch (error) {
      return { error: error.message };
    }
  },
  
  async getGitDiff(staged = false) {
    try {
      const command = staged ? 'git diff --staged' : 'git diff';
      const result = await this.api.exec(command);
      return result.stdout;
    } catch {
      return '';
    }
  },
  
  async getStagedFiles() {
    try {
      const result = await this.api.exec('git diff --staged --name-only');
      return result.stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  },
  
  async getModifiedFiles() {
    try {
      const result = await this.api.exec('git diff --name-only');
      return result.stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  },
  
  async getCommitHistory(limit = 10) {
    try {
      const result = await this.api.exec(
        `git log --oneline --pretty=format:"%h|%s|%an|%ar" -n ${limit}`
      );
      
      return result.stdout.trim().split('\n').map(line => {
        const [hash, message, author, time] = line.split('|');
        return { hash, message, author, time };
      });
    } catch {
      return [];
    }
  },
  
  async getLastCommit() {
    const history = await this.getCommitHistory(1);
    return history[0] || null;
  },
  
  async getRemoteInfo() {
    try {
      const remoteResult = await this.api.exec('git remote -v');
      const remotes = {};
      
      remoteResult.stdout.trim().split('\n').forEach(line => {
        const [name, url, type] = line.split(/\s+/);
        if (!remotes[name]) remotes[name] = {};
        remotes[name][type.replace(/[()]/g, '')] = url;
      });
      
      const branchResult = await this.api.exec('git branch -vv');
      const currentBranch = branchResult.stdout
        .split('\n')
        .find(line => line.startsWith('*'));
      
      const tracking = currentBranch?.match(/\[([^\]]+)\]/)?.[1];
      
      return {
        remotes,
        tracking,
        defaultRemote: Object.keys(remotes)[0] || 'origin'
      };
    } catch {
      return { remotes: {}, tracking: null, defaultRemote: 'origin' };
    }
  },
  
  async stageFiles(files) {
    try {
      const fileList = Array.isArray(files) ? files.join(' ') : files;
      await this.api.exec(`git add ${fileList}`);
      return true;
    } catch (error) {
      this.api.log('error', `Failed to stage files: ${error.message}`);
      return false;
    }
  },
  
  async executeCommit(message) {
    try {
      await this.api.exec(`git commit -m "${message}"`);
      return true;
    } catch (error) {
      this.api.log('error', `Failed to commit: ${error.message}`);
      return false;
    }
  },
  
  async createBranch(name) {
    try {
      await this.api.exec(`git checkout -b ${name}`);
      return true;
    } catch (error) {
      this.api.log('error', `Failed to create branch: ${error.message}`);
      return false;
    }
  },
  
  // Formatters and generators
  formatStatus(status) {
    let output = '# Git Status\n\n';
    
    if (status.error) {
      return `Error: ${status.error}`;
    }
    
    if (status.staged.length > 0) {
      output += '## Staged Files\n';
      status.staged.forEach(file => output += `- ${file}\n`);
      output += '\n';
    }
    
    if (status.modified.length > 0) {
      output += '## Modified Files\n';
      status.modified.forEach(file => output += `- ${file}\n`);
      output += '\n';
    }
    
    if (status.untracked.length > 0) {
      output += '## Untracked Files\n';
      status.untracked.forEach(file => output += `- ${file}\n`);
      output += '\n';
    }
    
    if (status.deleted.length > 0) {
      output += '## Deleted Files\n';
      status.deleted.forEach(file => output += `- ${file}\n`);
      output += '\n';
    }
    
    return output;
  },
  
  async generateCommitMessage(files) {
    const diff = await this.getGitDiff(true);
    const status = await this.getGitStatus();
    
    // Analyze changes
    const changeTypes = this.analyzeChanges(diff, status);
    
    // Generate conventional commit message
    let type = 'chore';
    let scope = '';
    let description = 'Update files';
    
    if (changeTypes.features > changeTypes.fixes) {
      type = 'feat';
      description = 'Add new functionality';
    } else if (changeTypes.fixes > 0) {
      type = 'fix';
      description = 'Fix issues';
    } else if (changeTypes.refactoring > 0) {
      type = 'refactor';
      description = 'Refactor code';
    } else if (changeTypes.tests > 0) {
      type = 'test';
      description = 'Update tests';
    } else if (changeTypes.docs > 0) {
      type = 'docs';
      description = 'Update documentation';
    }
    
    // Determine scope from files
    if (files && files.length > 0) {
      const commonPath = this.findCommonPath(files);
      scope = commonPath ? `(${commonPath})` : '';
    }
    
    const message = this.config.conventionalCommits
      ? `${type}${scope}: ${description}`
      : description;
    
    return message;
  },
  
  analyzeChanges(diff, status) {
    const analysis = {
      features: 0,
      fixes: 0,
      refactoring: 0,
      tests: 0,
      docs: 0
    };
    
    // Analyze diff content
    const lines = diff.split('\n');
    
    lines.forEach(line => {
      if (line.includes('+ function') || line.includes('+ class')) {
        analysis.features++;
      }
      if (line.includes('fix') || line.includes('Fix') || line.includes('bug')) {
        analysis.fixes++;
      }
      if (line.includes('refactor') || line.includes('Refactor')) {
        analysis.refactoring++;
      }
    });
    
    // Analyze file types
    [...status.modified, ...status.staged].forEach(file => {
      if (file.includes('.test.') || file.includes('.spec.')) {
        analysis.tests++;
      }
      if (file.includes('.md') || file.includes('README')) {
        analysis.docs++;
      }
    });
    
    return analysis;
  },
  
  findCommonPath(files) {
    if (files.length === 0) return '';
    if (files.length === 1) {
      const parts = files[0].split('/');
      return parts[parts.length - 2] || '';
    }
    
    const paths = files.map(f => f.split('/'));
    const commonParts = [];
    
    for (let i = 0; i < paths[0].length - 1; i++) {
      const part = paths[0][i];
      if (paths.every(p => p[i] === part)) {
        commonParts.push(part);
      } else {
        break;
      }
    }
    
    return commonParts[commonParts.length - 1] || '';
  },
  
  generateBranchName(type, description) {
    const prefix = {
      feature: 'feature/',
      fix: 'fix/',
      chore: 'chore/',
      hotfix: 'hotfix/',
      release: 'release/'
    }[type] || 'feature/';
    
    const sanitized = description
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
    
    return `${prefix}${sanitized}`;
  },
  
  formatCommitMessage(message) {
    if (!this.config.conventionalCommits) {
      return message;
    }
    
    // Ensure conventional commit format
    const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?!?:\s.+/;
    
    if (conventionalPattern.test(message)) {
      return message;
    }
    
    // Try to convert to conventional format
    const keywords = {
      add: 'feat',
      added: 'feat',
      feature: 'feat',
      fix: 'fix',
      fixed: 'fix',
      update: 'chore',
      updated: 'chore',
      refactor: 'refactor',
      test: 'test',
      docs: 'docs'
    };
    
    const firstWord = message.split(' ')[0].toLowerCase();
    const type = keywords[firstWord] || 'chore';
    
    return `${type}: ${message}`;
  },
  
  async generatePRTemplate(targetBranch = 'main') {
    const currentBranch = await this.getCurrentBranch();
    const commits = await this.getCommitHistory(20);
    const diff = await this.api.exec(`git diff ${targetBranch}...HEAD`);
    
    const branchCommits = commits.filter(c => 
      !c.message.includes('Merge') && !c.message.includes('merge')
    );
    
    const template = `## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Changes Made
${branchCommits.map(c => `- ${c.message}`).join('\n')}

## Testing
- [ ] Unit tests pass locally
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have made corresponding changes to documentation
- [ ] My changes generate no new warnings
- [ ] New and existing unit tests pass locally

## Screenshots (if applicable)
N/A

## Additional Notes
Add any additional notes or context here`;
    
    return template;
  }
};
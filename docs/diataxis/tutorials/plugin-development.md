# Plugin Development Tutorial

**You'll build:** A complete plugin that adds Git workflow automation to the template engine
**Time:** 60 minutes  
**You'll learn:** Plugin architecture, hooks system, security model, and marketplace publishing

## Before we begin

By the end of this tutorial, you'll have:
- Created a fully functional plugin from scratch
- Implemented custom CLI commands and template processors
- Used the secure plugin sandbox environment
- Published your plugin to the marketplace

Let's see what we'll create:

```bash
# Final result - your plugin in action
cursor-prompt plugin:load git-workflow
cursor-prompt git:create-feature "user-authentication"
# Output: Automated branch creation, template generation, and commit setup
```

## Step 1: Plugin Architecture Overview

The plugin system provides several extension points:

```
Plugin Architecture:
├── Commands: Add new CLI commands
├── Processors: Transform template content
├── Hooks: React to system events
├── Helpers: Add template functions
└── Validators: Custom validation logic
```

### Security Model

All plugins run in a secure sandbox with:
- **Resource limits**: CPU, memory, file access restrictions
- **Permission system**: Explicit capability grants
- **Code analysis**: Static analysis before loading
- **Behavior monitoring**: Runtime security monitoring

## Step 2: Initialize Your Plugin

Create a new plugin directory:

```bash
mkdir plugins/git-workflow
cd plugins/git-workflow
```

Create the plugin manifest `plugin.json`:

```json
{
  "name": "git-workflow",
  "version": "1.0.0",
  "description": "Automated Git workflow integration for template generation",
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "keywords": ["git", "workflow", "automation"],
  
  "main": "index.js",
  "engines": {
    "cursor-prompt": ">=0.1.0",
    "node": ">=18.0.0"
  },
  
  "permissions": {
    "fileSystem": {
      "read": [".", ".git/*"],
      "write": [".git/*", "src/*", "docs/*"]
    },
    "commands": {
      "git": ["status", "branch", "checkout", "commit", "add"]
    },
    "network": {
      "outbound": ["github.com", "api.github.com"]
    }
  },
  
  "capabilities": [
    "commands",
    "processors", 
    "hooks",
    "helpers"
  ],
  
  "configuration": {
    "defaultBranch": {
      "type": "string",
      "default": "main",
      "description": "Default branch for feature branches"
    },
    "branchPrefix": {
      "type": "string", 
      "default": "feature/",
      "description": "Prefix for new feature branches"
    },
    "autoCommit": {
      "type": "boolean",
      "default": false,
      "description": "Automatically commit generated templates"
    }
  }
}
```

## Step 3: Plugin Implementation

Create the main plugin file `index.js`:

```javascript
/**
 * Git Workflow Plugin
 * Provides automated Git integration for template generation
 */

class GitWorkflowPlugin {
  constructor(api) {
    this.api = api;
    this.name = 'git-workflow';
    this.version = '1.0.0';
  }

  /**
   * Plugin initialization
   */
  async initialize() {
    console.log(`[${this.name}] Initializing Git Workflow Plugin v${this.version}`);
    
    // Verify Git is available
    try {
      await this.api.execute('git', ['--version']);
    } catch (error) {
      throw new Error('Git is not available. Please install Git to use this plugin.');
    }
    
    // Register all plugin capabilities
    this.registerCommands();
    this.registerProcessors();
    this.registerHooks();
    this.registerHelpers();
    
    console.log(`[${this.name}] Plugin initialized successfully`);
  }

  /**
   * Register custom CLI commands
   */
  registerCommands() {
    // Command: Create feature branch and generate template
    this.api.command('git:create-feature', {
      description: 'Create feature branch and generate template',
      arguments: [
        {
          name: 'featureName',
          description: 'Name of the feature to create',
          required: true,
          type: 'string'
        }
      ],
      options: [
        {
          name: '--template',
          description: 'Template to generate',
          default: 'feature',
          type: 'string'
        },
        {
          name: '--base',
          description: 'Base branch for feature',
          default: 'main',
          type: 'string'
        }
      ],
      handler: async (args, options) => {
        return await this.createFeatureWorkflow(args.featureName, options);
      }
    });

    // Command: Git status with template suggestions
    this.api.command('git:smart-status', {
      description: 'Show git status with template suggestions',
      options: [
        {
          name: '--suggest',
          description: 'Suggest templates based on changes',
          default: true,
          type: 'boolean'
        }
      ],
      handler: async (args, options) => {
        return await this.smartStatus(options);
      }
    });

    // Command: Auto-commit with template-generated messages
    this.api.command('git:template-commit', {
      description: 'Commit with AI-generated commit message',
      options: [
        {
          name: '--type',
          description: 'Type of commit (feat, fix, docs, etc.)',
          type: 'string'
        },
        {
          name: '--scope',
          description: 'Scope of the change',
          type: 'string'
        }
      ],
      handler: async (args, options) => {
        return await this.templateCommit(options);
      }
    });
  }

  /**
   * Register template processors
   */
  registerProcessors() {
    // Processor: Add git context to templates
    this.api.processor('git-context', {
      description: 'Inject Git repository context into templates',
      priority: 100,
      handler: async (templateContent, context) => {
        const gitContext = await this.getGitContext();
        context.git = gitContext;
        
        // Add git-specific helpers
        context.helpers = {
          ...context.helpers,
          currentBranch: () => gitContext.branch,
          commitHash: (length = 7) => gitContext.commit.substring(0, length),
          isDirty: () => gitContext.hasChanges
        };
        
        return templateContent;
      }
    });

    // Processor: Auto-format generated files
    this.api.processor('git-formatting', {
      description: 'Format generated files according to project standards',
      priority: 200,
      handler: async (templateContent, context) => {
        // Run prettier/eslint if available
        if (await this.hasFormatter()) {
          return await this.formatCode(templateContent, context.outputPath);
        }
        return templateContent;
      }
    });
  }

  /**
   * Register event hooks
   */
  registerHooks() {
    // Hook: Before template generation
    this.api.hook('template:before', async (templateName, variables) => {
      console.log(`[${this.name}] Preparing Git context for template: ${templateName}`);
      
      // Stash uncommitted changes if needed
      if (await this.hasUncommittedChanges()) {
        const shouldStash = await this.api.prompt({
          type: 'confirm',
          message: 'You have uncommitted changes. Stash them before generating template?',
          default: true
        });
        
        if (shouldStash) {
          await this.api.execute('git', ['stash', 'push', '-m', `Auto-stash before ${templateName} generation`]);
          console.log('[git-workflow] Changes stashed successfully');
        }
      }
    });

    // Hook: After template generation
    this.api.hook('template:after', async (templateName, variables, outputFiles) => {
      const config = await this.api.getConfig();
      
      if (config.autoCommit) {
        await this.autoCommitGenerated(templateName, outputFiles);
      } else {
        console.log(`[${this.name}] Template generated. Run 'cursor-prompt git:template-commit' to commit changes.`);
      }
    });

    // Hook: On plugin error
    this.api.hook('plugin:error', async (error, context) => {
      if (error.plugin === this.name) {
        // Restore stashed changes on error
        if (await this.hasStash()) {
          await this.api.execute('git', ['stash', 'pop']);
          console.log('[git-workflow] Restored stashed changes after error');
        }
      }
    });
  }

  /**
   * Register template helpers
   */
  registerHelpers() {
    this.api.helper('gitBranch', () => {
      return this.api.cache.get('git.branch', async () => {
        const result = await this.api.execute('git', ['branch', '--show-current']);
        return result.stdout.trim();
      });
    });

    this.api.helper('gitCommit', (length = 7) => {
      return this.api.cache.get('git.commit', async () => {
        const result = await this.api.execute('git', ['rev-parse', 'HEAD']);
        return result.stdout.trim().substring(0, length);
      });
    });

    this.api.helper('gitRemoteUrl', () => {
      return this.api.cache.get('git.remote', async () => {
        const result = await this.api.execute('git', ['remote', 'get-url', 'origin']);
        return result.stdout.trim();
      });
    });
  }

  /**
   * Implementation methods
   */
  async createFeatureWorkflow(featureName, options) {
    const config = await this.api.getConfig();
    const branchName = `${config.branchPrefix}${featureName}`;
    
    try {
      // 1. Ensure we're on the base branch
      await this.api.execute('git', ['checkout', options.base]);
      
      // 2. Pull latest changes
      await this.api.execute('git', ['pull', 'origin', options.base]);
      
      // 3. Create and checkout feature branch
      await this.api.execute('git', ['checkout', '-b', branchName]);
      console.log(`✅ Created and switched to branch: ${branchName}`);
      
      // 4. Generate template
      const templateResult = await this.api.template.generate(options.template, {
        featureName: featureName,
        branchName: branchName,
        baseBranch: options.base
      });
      
      console.log(`✅ Generated template: ${options.template}`);
      console.log(`   Files created: ${templateResult.files.join(', ')}`);
      
      // 5. Stage generated files
      for (const file of templateResult.files) {
        await this.api.execute('git', ['add', file]);
      }
      
      console.log('✅ Files staged for commit');
      console.log('\nNext steps:');
      console.log(`  1. Review the generated files`);
      console.log(`  2. Run: cursor-prompt git:template-commit`);
      console.log(`  3. Start developing your feature!`);
      
      return {
        success: true,
        branch: branchName,
        template: options.template,
        files: templateResult.files
      };
      
    } catch (error) {
      console.error(`❌ Failed to create feature workflow: ${error.message}`);
      throw error;
    }
  }

  async smartStatus(options) {
    try {
      // Get git status
      const statusResult = await this.api.execute('git', ['status', '--porcelain']);
      const changes = statusResult.stdout.split('\n').filter(line => line.trim());
      
      console.log('📊 Git Status:');
      if (changes.length === 0) {
        console.log('   ✅ Working tree clean');
        return { clean: true };
      }
      
      // Parse and display changes
      const parsedChanges = this.parseGitStatus(changes);
      this.displayStatusSummary(parsedChanges);
      
      // Suggest templates based on changes
      if (options.suggest) {
        const suggestions = await this.suggestTemplates(parsedChanges);
        if (suggestions.length > 0) {
          console.log('\n💡 Template Suggestions:');
          suggestions.forEach(suggestion => {
            console.log(`   ${suggestion.template}: ${suggestion.reason}`);
          });
        }
      }
      
      return {
        clean: false,
        changes: parsedChanges,
        suggestions: options.suggest ? suggestions : []
      };
      
    } catch (error) {
      console.error(`❌ Failed to get git status: ${error.message}`);
      throw error;
    }
  }

  async templateCommit(options) {
    try {
      // Get staged changes
      const diffResult = await this.api.execute('git', ['diff', '--cached', '--name-only']);
      const stagedFiles = diffResult.stdout.split('\n').filter(line => line.trim());
      
      if (stagedFiles.length === 0) {
        console.log('❌ No staged changes to commit');
        return { success: false, reason: 'no-staged-changes' };
      }
      
      // Generate commit message using template
      const commitMessage = await this.generateCommitMessage(stagedFiles, options);
      
      // Confirm commit message
      const confirmed = await this.api.prompt({
        type: 'confirm',
        message: `Commit with message: "${commitMessage}"?`,
        default: true
      });
      
      if (!confirmed) {
        console.log('❌ Commit cancelled');
        return { success: false, reason: 'cancelled' };
      }
      
      // Commit changes
      await this.api.execute('git', ['commit', '-m', commitMessage]);
      console.log(`✅ Committed changes: ${commitMessage}`);
      
      return {
        success: true,
        message: commitMessage,
        files: stagedFiles
      };
      
    } catch (error) {
      console.error(`❌ Failed to commit: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  async getGitContext() {
    try {
      const [branchResult, commitResult, statusResult] = await Promise.all([
        this.api.execute('git', ['branch', '--show-current']),
        this.api.execute('git', ['rev-parse', 'HEAD']),
        this.api.execute('git', ['status', '--porcelain'])
      ]);
      
      return {
        branch: branchResult.stdout.trim(),
        commit: commitResult.stdout.trim(),
        hasChanges: statusResult.stdout.trim().length > 0
      };
    } catch (error) {
      return {
        branch: 'unknown',
        commit: 'unknown', 
        hasChanges: false
      };
    }
  }

  parseGitStatus(changes) {
    return changes.map(line => {
      const status = line.substring(0, 2);
      const file = line.substring(3);
      
      return {
        status: status.trim(),
        file: file,
        type: this.getChangeType(status)
      };
    });
  }

  getChangeType(status) {
    if (status.includes('A')) return 'added';
    if (status.includes('M')) return 'modified';
    if (status.includes('D')) return 'deleted';
    if (status.includes('R')) return 'renamed';
    if (status.includes('??')) return 'untracked';
    return 'unknown';
  }

  async suggestTemplates(changes) {
    const suggestions = [];
    
    // Analyze file types and suggest templates
    const hasNewComponents = changes.some(c => 
      c.file.includes('component') && c.type === 'added'
    );
    const hasTests = changes.some(c => 
      c.file.includes('.test.') || c.file.includes('.spec.')
    );
    const hasAPI = changes.some(c => 
      c.file.includes('api/') || c.file.includes('routes/')
    );
    
    if (hasNewComponents && !hasTests) {
      suggestions.push({
        template: 'test-generation',
        reason: 'New components detected - generate tests'
      });
    }
    
    if (hasAPI) {
      suggestions.push({
        template: 'api-docs',
        reason: 'API changes detected - update documentation'
      });
    }
    
    return suggestions;
  }

  async generateCommitMessage(files, options) {
    // Use template to generate commit message
    const context = {
      files: files,
      type: options.type,
      scope: options.scope,
      git: await this.getGitContext()
    };
    
    const messageTemplate = options.type 
      ? `{{type}}{{#if scope}}({{scope}}){{/if}}: {{>commit-summary}}`
      : `{{>smart-commit-message}}`;
    
    return await this.api.template.render(messageTemplate, context);
  }

  // Additional helper methods...
  async hasUncommittedChanges() {
    const result = await this.api.execute('git', ['status', '--porcelain']);
    return result.stdout.trim().length > 0;
  }

  async hasStash() {
    try {
      const result = await this.api.execute('git', ['stash', 'list']);
      return result.stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async hasFormatter() {
    try {
      await this.api.execute('npx', ['prettier', '--version']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Plugin cleanup
   */
  async cleanup() {
    console.log(`[${this.name}] Cleaning up plugin resources`);
    // Clear any caches, close connections, etc.
  }
}

// Export the plugin class
module.exports = GitWorkflowPlugin;
```

## Step 4: Testing Your Plugin

Create a test script `test-plugin.js`:

```javascript
const GitWorkflowPlugin = require('./index.js');

// Mock API for testing
const mockAPI = {
  command: (name, config) => console.log(`Registered command: ${name}`),
  processor: (name, config) => console.log(`Registered processor: ${name}`),
  hook: (name, handler) => console.log(`Registered hook: ${name}`),
  helper: (name, handler) => console.log(`Registered helper: ${name}`),
  execute: async (cmd, args) => ({ stdout: 'mock-output', stderr: '' }),
  prompt: async (options) => true,
  template: {
    generate: async (name, vars) => ({ files: ['mock-file.js'] }),
    render: async (template, context) => 'mock commit message'
  },
  getConfig: async () => ({ branchPrefix: 'feature/', autoCommit: false }),
  cache: {
    get: async (key, fn) => await fn()
  }
};

async function testPlugin() {
  const plugin = new GitWorkflowPlugin(mockAPI);
  
  try {
    await plugin.initialize();
    console.log('✅ Plugin initialized successfully');
    
    // Test command
    const result = await plugin.createFeatureWorkflow('test-feature', {
      template: 'feature',
      base: 'main'
    });
    console.log('✅ Feature workflow test passed', result);
    
  } catch (error) {
    console.error('❌ Plugin test failed:', error.message);
  } finally {
    await plugin.cleanup();
  }
}

testPlugin();
```

Run the test:

```bash
node test-plugin.js
```

## Step 5: Security and Validation

Create a security configuration file `security.json`:

```json
{
  "codeAnalysis": {
    "enabled": true,
    "rules": [
      "no-eval",
      "no-file-system-write-outside-project",
      "no-network-without-permission",
      "no-spawn-processes"
    ]
  },
  
  "resourceLimits": {
    "maxMemory": "100MB",
    "maxCpuTime": "5000ms",
    "maxFileSize": "10MB",
    "maxNetworkRequests": 10
  },
  
  "permissions": {
    "validateCommands": true,
    "restrictFileAccess": true,
    "monitorBehavior": true
  }
}
```

## Step 6: Documentation and Examples

Create comprehensive documentation in `README.md`:

```markdown
# Git Workflow Plugin

Automated Git workflow integration for the Cursor Prompt Template Engine.

## Installation

```bash
cursor-prompt plugin:install git-workflow
```

## Commands

### `git:create-feature <featureName>`
Creates a feature branch and generates templates.

**Options:**
- `--template <name>`: Template to generate (default: feature)
- `--base <branch>`: Base branch (default: main)

**Example:**
```bash
cursor-prompt git:create-feature user-authentication --template api-endpoint
```

### `git:smart-status`
Shows git status with template suggestions.

**Example:**
```bash
cursor-prompt git:smart-status --suggest
```

### `git:template-commit`
Commits with AI-generated commit messages.

**Options:**
- `--type <type>`: Commit type (feat, fix, docs, etc.)
- `--scope <scope>`: Change scope

**Example:**
```bash
cursor-prompt git:template-commit --type feat --scope auth
```

## Configuration

```json
{
  "plugins": {
    "git-workflow": {
      "defaultBranch": "main",
      "branchPrefix": "feature/",
      "autoCommit": false
    }
  }
}
```

## Template Helpers

- `{{gitBranch}}`: Current Git branch
- `{{gitCommit 8}}`: Git commit hash (8 characters)
- `{{gitRemoteUrl}}`: Remote repository URL

## Hooks

The plugin provides several hooks for integration:

- `template:before`: Stash changes before generation
- `template:after`: Auto-commit generated templates
- `plugin:error`: Restore stashed changes on errors

## Security

This plugin requires the following permissions:
- File system read/write access to Git repository
- Execute Git commands
- Network access to GitHub API (optional)

## Troubleshooting

### Git not found
Ensure Git is installed and available in your PATH.

### Permission denied
Check that the plugin has necessary file system permissions.

### Branch creation fails
Verify you have a clean working tree or stash your changes.
```

## Step 7: Publishing to Marketplace

Create marketplace metadata in `marketplace.json`:

```json
{
  "category": "workflow",
  "tags": ["git", "automation", "branch", "commit"],
  "screenshots": [
    "screenshots/feature-creation.png",
    "screenshots/smart-status.png"
  ],
  "documentation": {
    "homepage": "https://github.com/your-username/git-workflow-plugin",
    "repository": "https://github.com/your-username/git-workflow-plugin",
    "issues": "https://github.com/your-username/git-workflow-plugin/issues"
  },
  "pricing": {
    "model": "free",
    "license": "MIT"
  },
  "support": {
    "email": "support@example.com",
    "documentation": "https://github.com/your-username/git-workflow-plugin/wiki"
  }
}
```

Publish to marketplace:

```bash
# Package your plugin
cursor-prompt plugin:package

# Publish to marketplace
cursor-prompt marketplace:publish git-workflow-plugin.tar.gz
```

## What you've accomplished

✅ **Plugin Architecture**: Built a complete plugin with all extension points  
✅ **Security Model**: Implemented proper permissions and sandboxing  
✅ **CLI Integration**: Added custom commands with full argument parsing  
✅ **Template Integration**: Created processors and helpers for templates  
✅ **Event System**: Used hooks for workflow automation  
✅ **Testing**: Created comprehensive test coverage  
✅ **Documentation**: Added complete usage documentation  
✅ **Marketplace**: Published plugin for community use  

## Next steps

1. **Advanced Features**: Add GitHub API integration, PR automation
2. **UI Components**: Create web interface for plugin configuration  
3. **Analytics**: Track plugin usage and performance metrics
4. **Integrations**: Connect with other development tools
5. **Community**: Gather feedback and iterate on features

## Need help?

- 📖 [Plugin API Reference](../reference/plugin-api.md)
- 🔧 [Security Guidelines](../explanation/plugin-security.md)  
- 💬 [Plugin Development Forum](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/discussions/categories/plugin-development)

**You've created a production-ready plugin that extends the template engine with powerful Git workflow automation!**
# Phase 4 Migration Guide

**Migration Target:** Cursor Prompt Template Engine v0.1.0  
**Migration Scope:** Legacy systems to Phase 4 architecture  
**Estimated Time:** 2-4 weeks depending on customizations

This guide covers migrating from legacy template systems to the new Phase 4 architecture with enhanced security, performance, and functionality.

## Overview

Phase 4 introduces significant architectural improvements:

- **Enhanced Security**: RBAC, encryption, plugin sandboxing
- **Performance Optimizations**: 50% faster template processing
- **New Features**: Web portal, PromptWizard integration, marketplace
- **Breaking Changes**: Template format updates, API changes

## Pre-Migration Assessment

### Compatibility Check

Run the compatibility assessment tool:

```bash
# Install migration toolkit
npm install -g @cursor-prompt/migration-toolkit

# Assess your current setup
cursor-prompt-migrate assess ./templates

# Expected output:
# ✅ 45 templates compatible
# ⚠️  8 templates need updates  
# ❌ 2 templates require manual migration
# 📊 Estimated migration time: 6 hours
```

### Backup Current System

```bash
# Create complete backup
mkdir backup-$(date +%Y%m%d)
cp -r templates/ backup-$(date +%Y%m%d)/templates/
cp .cursorprompt.json backup-$(date +%Y%m%d)/config.json
cp -r plugins/ backup-$(date +%Y%m%d)/plugins/ 2>/dev/null || true

# Export current data
cursor-prompt export --output backup-$(date +%Y%m%d)/export.json
```

## Migration Steps

### Step 1: Install Phase 4

```bash
# Uninstall old version
npm uninstall -g cursor-prompt-old

# Install new version
npm install -g cursor-prompt@latest

# Verify installation
cursor-prompt --version
# Should show: 0.1.0 or higher
```

### Step 2: Configuration Migration

The configuration format has been updated with new security and feature options.

**Old format (`.cursorprompt.json`):**
```json
{
  "templateDir": "./templates",
  "outputDir": "./output",
  "plugins": ["git-helper"]
}
```

**New format (`.cursorprompt.json`):**
```json
{
  "version": "1.0.0",
  "templates": {
    "paths": ["./templates", "./shared-templates"],
    "watch": true,
    "validation": "strict"
  },
  "cursor": {
    "autoSync": true,
    "rulesDir": ".cursor/rules",
    "legacySupport": true,
    "syncInterval": 5000
  },
  "optimization": {
    "enablePromptWizard": true,
    "defaultModel": "gpt-4",
    "maxIterations": 3,
    "autoOptimize": false
  },
  "plugins": {
    "enabled": true,
    "autoLoad": ["git-helper", "security-scanner"],
    "marketplace": {
      "autoUpdate": true,
      "allowBeta": false
    }
  },
  "security": {
    "encryption": true,
    "auditLogging": true,
    "rbacEnabled": true
  },
  "analytics": {
    "enabled": true,
    "trackUsage": true,
    "shareAnonymous": false
  }
}
```

**Automatic migration:**
```bash
cursor-prompt migrate config
# Migrates .cursorprompt.json to new format
# Creates backup at .cursorprompt.json.backup
```

### Step 3: Template Format Migration

Phase 4 introduces enhanced template format with YAML frontmatter.

**Old template format:**
```handlebars
{{! Bug Fix Template }}
{{! Description: Fix bugs efficiently }}

# Bug Fix: {{issue}}

## Problem
{{description}}

## Context
{{context}}

## Solution
Please fix the issue in {{file}} around line {{line}}.
```

**New template format:**
```yaml
---
name: bug-fix
description: Fix bugs efficiently with context
version: 1.0.0
author: system
tags: [debugging, fix, issue]

variables:
  - name: issue
    type: string
    description: Brief issue description
    required: true
  - name: description
    type: string
    description: Detailed problem description
    required: true
  - name: file
    type: string
    description: File path with the issue
    required: false
  - name: line
    type: number
    description: Line number (if known)
    required: false

context:
  - git.diff
  - file.content
  - terminal.error

validation:
  strict: true
  maxLength: 10000
---

# Bug Fix: {{issue}}

## Problem
{{description}}

## Context
{{>context}}

{{#if file}}
## File Location
- **File**: `{{file}}`{{#if line}} (line {{line}}){{/if}}
{{/if}}

## Solution
Please analyze the issue and provide a fix.
```

**Migration command:**
```bash
cursor-prompt migrate templates ./templates
# Converts all templates to new format
# Creates backup in ./templates-backup/
```

### Step 4: Plugin Migration

Phase 4 introduces a new plugin API with enhanced security.

**Old plugin format:**
```javascript
module.exports = {
  name: 'git-helper',
  commands: {
    'git-status': function() {
      return require('child_process').execSync('git status');
    }
  }
};
```

**New plugin format:**
```javascript
class GitHelperPlugin {
  constructor(api) {
    this.api = api;
    this.name = 'git-helper';
  }

  async initialize() {
    this.api.command('git:status', {
      description: 'Get Git repository status',
      handler: async () => {
        // Secure command execution
        return await this.api.execute('git', ['status']);
      }
    });
  }

  async cleanup() {
    // Plugin cleanup
  }
}

module.exports = GitHelperPlugin;
```

**Plugin migration:**
```bash
cursor-prompt migrate plugins ./plugins
# Migrates plugin format
# Updates security permissions
# Creates plugin.json manifests
```

### Step 5: Data Migration

If you have stored template executions or user data:

```bash
# Export data from old system
cursor-prompt-old export --format json --output old-data.json

# Import into new system
cursor-prompt import --input old-data.json --merge
```

### Step 6: Web Portal Setup (Optional)

If you want to enable the web portal for non-technical users:

```bash
# Navigate to web portal directory
cd node_modules/cursor-prompt/web-portal

# Install dependencies
npm install

# Set up database
npm run db:setup

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start services
npm run dev
```

## Breaking Changes

### API Changes

| Old API | New API | Migration |
|---------|---------|-----------|
| `cursor-prompt template <name>` | `cursor-prompt generate <name>` | Update scripts |
| `cursor-prompt init --basic` | `cursor-prompt init` | Remove --basic flag |
| `cursor-prompt plugin add <name>` | `cursor-prompt plugin:install <name>` | Use colon syntax |

### Template Syntax Changes

| Old Syntax | New Syntax | Notes |
|------------|------------|-------|
| `{{! comment }}` | `{{!-- comment --}}` | Updated comment syntax |
| `{{context}}` | `{{>context}}` | Use partial syntax |
| `{{#git-status}}` | `{{#if git.hasChanges}}` | Structured context |

### Configuration Changes

| Old Option | New Option | Default |
|------------|------------|---------|
| `templateDir` | `templates.paths` | `["./templates"]` |
| `outputDir` | Removed | Dynamic output |
| `plugins` | `plugins.autoLoad` | `[]` |

## Post-Migration Verification

### Test Core Functionality

```bash
# Test template generation
cursor-prompt generate bug-fix --variables '{"issue":"test","description":"testing migration"}'

# Test plugin loading
cursor-prompt plugin:list

# Test context gathering
cursor-prompt generate feature --variables '{"name":"test"}' --preview

# Test Cursor integration
cursor-prompt sync --dry-run
```

### Performance Verification

```bash
# Run performance benchmarks
cursor-prompt benchmark

# Expected results (should be >40% faster):
# Template Loading: ~50ms (was ~85ms)
# Context Gathering: ~30ms (was ~50ms)  
# Total Generation: ~80ms (was ~135ms)
```

### Security Verification

```bash
# Run security audit
cursor-prompt audit

# Expected results:
# ✅ All templates validated
# ✅ All plugins sandboxed
# ✅ No security vulnerabilities
```

## Rollback Plan

If you encounter issues during migration:

### Immediate Rollback

```bash
# Stop new services
pkill -f cursor-prompt

# Restore old version
npm uninstall -g cursor-prompt
npm install -g cursor-prompt-old@0.0.8

# Restore configuration
cp backup-$(date +%Y%m%d)/config.json .cursorprompt.json

# Restore templates  
rm -rf templates/
cp -r backup-$(date +%Y%m%d)/templates/ ./
```

### Partial Rollback

Keep Phase 4 but disable new features:

```json
{
  "templates": { "validation": "permissive" },
  "cursor": { "autoSync": false },
  "optimization": { "enablePromptWizard": false },
  "plugins": { "enabled": false },
  "security": { "rbacEnabled": false }
}
```

## Common Issues & Solutions

### Template Validation Errors

**Issue**: Templates fail validation after migration
```bash
❌ Template 'my-template' validation failed: Missing required field 'version'
```

**Solution**: Add missing YAML frontmatter
```bash
cursor-prompt template fix my-template --auto-add-metadata
```

### Plugin Loading Failures  

**Issue**: Old plugins won't load
```bash
❌ Plugin 'my-plugin' failed to load: SecurityError: Unauthorized file access
```

**Solution**: Update plugin permissions
```bash
cursor-prompt plugin:migrate my-plugin --add-permissions
```

### Performance Regression

**Issue**: Slower performance after migration
```bash
cursor-prompt debug --performance
# Check for:
# - Heavy context gathering
# - Unoptimized templates
# - Plugin overhead
```

**Solution**: Enable optimizations
```bash
cursor-prompt optimize --templates --context --plugins
```

### Configuration Conflicts

**Issue**: Multiple configuration files causing conflicts
```bash
❌ Configuration conflict: Found both .cursorprompt.json and cursor-prompt.config.js
```

**Solution**: Consolidate to single config
```bash
cursor-prompt config:consolidate --format json
```

## Advanced Migration Scenarios

### Large Enterprise Migration

For organizations with 100+ templates and multiple teams:

```bash
# 1. Staged migration approach
cursor-prompt migrate --batch-size 10 --parallel 3

# 2. Team-by-team rollout
cursor-prompt migrate --team frontend --templates ./frontend-templates
cursor-prompt migrate --team backend --templates ./backend-templates

# 3. Gradual feature enablement
cursor-prompt config set optimization.enablePromptWizard false
cursor-prompt config set plugins.enabled false
# Enable features incrementally after validation
```

### Custom Template Engine Migration

If migrating from a custom template engine:

```bash
# 1. Export templates in standard format
your-template-engine export --format handlebars --output ./exported/

# 2. Convert to Phase 4 format
cursor-prompt convert --input ./exported/ --format phase4

# 3. Validate and test
cursor-prompt validate --all --strict
```

### CI/CD Pipeline Migration

Update your continuous integration:

**Old pipeline:**
```yaml
- name: Generate prompts
  run: cursor-prompt-old template feature
```

**New pipeline:**
```yaml
- name: Generate prompts
  run: |
    cursor-prompt generate feature --variables file://variables.json
    cursor-prompt validate --all
    cursor-prompt optimize --batch
```

## Performance Optimization

After migration, optimize for best performance:

```bash
# Enable all optimizations
cursor-prompt config set templates.cache true
cursor-prompt config set context.lazy true
cursor-prompt config set optimization.enabled true

# Run performance tuning
cursor-prompt tune --auto

# Verify improvements
cursor-prompt benchmark --compare-baseline
```

## Migration Support

### Getting Help

- **Documentation**: [Migration FAQ](./migration-faq.md)
- **Community**: [Discord #migration-help](https://discord.gg/cursor-prompt)
- **Professional**: [Enterprise Support](mailto:enterprise@cursor-prompt.dev)

### Migration Service

For complex migrations, professional migration services are available:

- **Assessment**: Free compatibility analysis
- **Planning**: Custom migration strategy
- **Execution**: Hands-on migration support
- **Training**: Team training on Phase 4 features

Contact: [migration@cursor-prompt.dev](mailto:migration@cursor-prompt.dev)

## Post-Migration Best Practices

### Security Hardening

```bash
# Enable all security features
cursor-prompt config set security.encryption true
cursor-prompt config set security.auditLogging true
cursor-prompt config set security.rbacEnabled true

# Run security scan
cursor-prompt security:scan --comprehensive
```

### Performance Monitoring

```bash
# Set up monitoring
cursor-prompt monitor:setup --metrics --alerts

# Configure thresholds
cursor-prompt monitor:config --response-time 200ms --memory 100MB
```

### Team Training

Schedule training sessions on new features:
- Web portal usage for designers/PMs
- New CLI commands for developers  
- Security features for administrators
- Plugin development for advanced users

## Conclusion

Migration to Phase 4 provides significant benefits in security, performance, and functionality. Following this guide ensures a smooth transition with minimal disruption to your development workflow.

Key migration success factors:
1. **Thorough assessment** before starting
2. **Complete backups** for safety
3. **Gradual rollout** for large teams
4. **Comprehensive testing** after migration
5. **Team training** on new features

The migration investment pays off through improved developer productivity, enhanced security posture, and access to powerful new features like the web portal and AI optimization.
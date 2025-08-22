# Troubleshooting Guide

Common issues and their solutions for the Cursor Prompt Template Engine.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Template Errors](#template-errors)
- [Context Gathering Issues](#context-gathering-issues)
- [Performance Problems](#performance-problems)
- [Configuration Issues](#configuration-issues)
- [Git Integration Issues](#git-integration-issues)

## Installation Issues

### npm install fails

**Problem:** Installation fails with permission errors.

**Solution:**
```bash
# Use npm with proper permissions
sudo npm install -g cursor-prompt

# Or install locally
npm install cursor-prompt --save-dev

# Or use npx
npx cursor-prompt <command>
```

### Command not found after installation

**Problem:** `cursor-prompt` command is not recognized.

**Solution:**
1. Check if installed globally:
   ```bash
   npm list -g cursor-prompt
   ```
2. Check npm bin path:
   ```bash
   npm bin -g
   ```
3. Add to PATH if needed:
   ```bash
   export PATH=$PATH:$(npm bin -g)
   ```

### Node version incompatibility

**Problem:** Error about Node.js version.

**Solution:**
- Upgrade Node.js to v22 or higher:
  ```bash
  # Using nvm
  nvm install 22
  nvm use 22
  
  # Or download from nodejs.org
  ```

## Template Errors

### Template not found

**Problem:** `Error: Template 'my-template' not found`

**Solution:**
1. List available templates:
   ```bash
   cursor-prompt list
   ```
2. Check templates directory:
   ```bash
   cursor-prompt config get templatesDir
   ```
3. Verify template exists:
   ```bash
   ls .cursor/templates/
   ```

### Invalid template syntax

**Problem:** `SyntaxError: Unexpected token in template`

**Solution:**
1. Validate template:
   ```bash
   cursor-prompt validate my-template
   ```
2. Common syntax issues:
   - Missing closing tags: `{{#if}}` needs `{{/if}}`
   - Incorrect variable syntax: Use `{{variable}}` not `${variable}`
   - Unescaped special characters

### Variable not defined

**Problem:** `Error: Variable 'myVar' is not defined`

**Solution:**
1. Provide required variables:
   ```bash
   cursor-prompt generate my-template \
     --variables '{"myVar":"value"}'
   ```
2. Check template requirements:
   ```bash
   cursor-prompt validate my-template --detailed
   ```

### Circular include detected

**Problem:** `Error: Circular dependency detected in template includes`

**Solution:**
1. Check include chain in templates
2. Remove circular references
3. Use maximum depth limit:
   ```javascript
   // In template
   {{#include "partial.md" maxDepth=3}}
   ```

## Context Gathering Issues

### Git context not available

**Problem:** Git information not included in context.

**Solution:**
1. Verify git repository:
   ```bash
   git status
   ```
2. Initialize git if needed:
   ```bash
   git init
   ```
3. Enable git context:
   ```bash
   cursor-prompt generate template --include-git
   ```

### File context missing

**Problem:** Files not included in generated prompt.

**Solution:**
1. Check file patterns:
   ```bash
   cursor-prompt generate template \
     --file-patterns "src/**/*.ts"
   ```
2. Verify files exist:
   ```bash
   ls src/**/*.ts
   ```
3. Check .gitignore:
   - Ignored files won't be included
   - Use `--no-ignore` flag if needed

### Context size too large

**Problem:** `Warning: Context exceeds size limit`

**Solution:**
1. Limit file patterns:
   ```bash
   --file-patterns "src/specific/*.ts"
   ```
2. Adjust size limits in config:
   ```json
   {
     "performance": {
       "maxFileSize": 102400,
       "maxTotalSize": 512000
     }
   }
   ```
3. Exclude large files:
   ```bash
   --exclude "**/*.min.js"
   ```

## Performance Problems

### Slow template generation

**Problem:** Template generation takes too long.

**Solution:**
1. Enable caching:
   ```json
   {
     "performance": {
       "cacheTemplates": true
     }
   }
   ```
2. Reduce context gathering:
   ```bash
   --no-context
   ```
3. Use specific file patterns instead of wildcards

### High memory usage

**Problem:** Process uses excessive memory.

**Solution:**
1. Limit file size:
   ```json
   {
     "performance": {
       "maxFileSize": 50000
     }
   }
   ```
2. Process files sequentially:
   ```json
   {
     "performance": {
       "parallel": false
     }
   }
   ```

## Configuration Issues

### Configuration not loading

**Problem:** Custom configuration ignored.

**Solution:**
1. Check config file location:
   ```bash
   # Local config
   ls .cursorprompt.json
   
   # Global config
   ls ~/.cursorprompt/config.json
   ```
2. Validate JSON syntax:
   ```bash
   cat .cursorprompt.json | jq .
   ```
3. Use explicit config:
   ```bash
   cursor-prompt --config ./my-config.json
   ```

### Invalid configuration values

**Problem:** `Error: Invalid configuration`

**Solution:**
1. Reset to defaults:
   ```bash
   cursor-prompt config reset
   ```
2. Set values individually:
   ```bash
   cursor-prompt config set key value
   ```
3. Check configuration schema in documentation

## Git Integration Issues

### Cannot read git information

**Problem:** Git commands fail or return empty.

**Solution:**
1. Check git installation:
   ```bash
   git --version
   ```
2. Verify repository:
   ```bash
   git rev-parse --git-dir
   ```
3. Check permissions:
   ```bash
   ls -la .git/
   ```

### Git diff too large

**Problem:** Git diff exceeds limits.

**Solution:**
1. Stage specific files:
   ```bash
   git add specific-file.ts
   ```
2. Use diff filters:
   ```bash
   cursor-prompt generate --git-diff-filter "*.ts"
   ```
3. Limit diff context:
   ```json
   {
     "gitIntegration": {
       "maxDiffSize": 50000
     }
   }
   ```

## Clipboard Issues

### Clipboard access denied

**Problem:** Cannot copy to clipboard.

**Solution:**
1. Use output file instead:
   ```bash
   cursor-prompt generate template --output prompt.md
   ```
2. Pipe to clipboard manually:
   ```bash
   # macOS
   cursor-prompt generate template | pbcopy
   
   # Linux
   cursor-prompt generate template | xclip
   
   # Windows
   cursor-prompt generate template | clip
   ```
3. Disable clipboard:
   ```bash
   cursor-prompt generate template --no-clipboard
   ```

## Debug Mode

Enable debug mode for detailed error information:

```bash
# Set environment variable
export CURSOR_PROMPT_DEBUG=true

# Or use debug flag
cursor-prompt --debug generate template
```

Debug output includes:
- File paths being processed
- Template resolution steps
- Context gathering details
- Error stack traces

## Getting Help

If issues persist:

1. Check documentation:
   ```bash
   cursor-prompt --help
   cursor-prompt <command> --help
   ```

2. View logs:
   ```bash
   cat ~/.cursorprompt/logs/error.log
   ```

3. Report issues:
   - GitHub Issues: [Report a bug](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/issues)
   - Include debug output
   - Provide reproduction steps

## Common Error Messages

### "ENOENT: no such file or directory"
- File or directory doesn't exist
- Check paths and permissions

### "EACCES: permission denied"
- Insufficient permissions
- Use sudo or fix file ownership

### "SyntaxError: Unexpected token"
- Invalid JSON or template syntax
- Validate with appropriate tools

### "RangeError: Maximum call stack exceeded"
- Circular reference in templates
- Check include directives

### "EMFILE: too many open files"
- System file limit reached
- Increase ulimit or reduce parallel operations

---

*Last Updated: 2025-08-22*
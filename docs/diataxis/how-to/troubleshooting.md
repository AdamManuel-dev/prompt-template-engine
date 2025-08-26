# Troubleshooting

Solve common problems with the Cursor Prompt Template Engine.

## Validation Errors

### Fix YAML syntax errors
**Problem**: Template fails validation with YAML syntax errors.
```bash
cursor-prompt validate templates/my-template.yaml
# Error: Invalid YAML syntax at line 15
```

**Solution**:
```bash
# Check YAML syntax
yamllint templates/my-template.yaml

# Common fixes:
# 1. Fix indentation (use spaces, not tabs)
# 2. Quote strings with special characters
# 3. Escape colons in values: "http://example.com"
```

### Resolve missing required variables
**Problem**: Template validation fails due to missing required variables.

**Solution**:
```yaml
# Add missing required variables
variables:
  feature_name:
    type: string
    required: true  # Make sure this is set
    description: "Name of the feature"  # Always add description
```

### Fix variable type mismatches
**Problem**: Variable type doesn't match expected format.

**Solution**:
```yaml
variables:
  port:
    type: number  # Not string
    min: 1000
    max: 65535
  enable_feature:
    type: boolean  # Not string "true"/"false"
    default: false
```

### Resolve circular dependencies
**Problem**: Template inheritance creates circular reference.

**Solution**:
```bash
# Check dependency chain
cursor-prompt validate templates/template-a.yaml --trace-deps

# Remove circular reference
# template-a.yaml should not extend template-b.yaml if template-b extends template-a
```

## Marketplace Issues

### Fix authentication failures
**Problem**: Cannot connect to marketplace or authentication expired.
```bash
cursor-prompt marketplace:list
# Error: Authentication failed
```

**Solution**:
```bash
# Re-authenticate
cursor-prompt marketplace:logout
cursor-prompt marketplace:login

# Or set token directly
cursor-prompt marketplace:token --set $NEW_TOKEN
```

### Resolve template installation failures
**Problem**: Template installation fails with network or permission errors.
```bash
cursor-prompt marketplace:install awesome-template
# Error: Installation failed - permission denied
```

**Solution**:
```bash
# Check permissions
ls -la ~/.cursor-prompt/templates/

# Fix permissions
chmod 755 ~/.cursor-prompt/templates/
chmod 644 ~/.cursor-prompt/templates/*

# Clear cache and retry
cursor-prompt marketplace:cache:clear
cursor-prompt marketplace:install awesome-template --force
```

### Handle marketplace connectivity issues
**Problem**: Cannot connect to marketplace.

**Solution**:
```bash
# Check marketplace status
cursor-prompt marketplace:status

# Try different endpoint
cursor-prompt config set marketplace.api "https://backup-marketplace.com"

# Use offline mode
cursor-prompt marketplace:list --offline
```

### Fix template conflicts
**Problem**: Template name conflicts with existing template.

**Solution**:
```bash
# Install with different name
cursor-prompt marketplace:install awesome-template --as my-awesome-template

# Or remove existing template first
cursor-prompt template:remove awesome-template
cursor-prompt marketplace:install awesome-template
```

## Cursor Integration

### Fix sync failures
**Problem**: Templates don't sync to Cursor IDE.
```bash
cursor-prompt sync
# Error: Failed to write to .cursor/rules
```

**Solution**:
```bash
# Check .cursor directory exists and is writable
mkdir -p .cursor/rules
chmod 755 .cursor/rules

# Try force sync
cursor-prompt sync --force

# Check Cursor IDE is running
ps aux | grep -i cursor
```

### Resolve watch mode issues
**Problem**: Watch mode doesn't detect template changes.
```bash
cursor-prompt watch
# Templates change but sync doesn't trigger
```

**Solution**:
```bash
# Check file system events
# On macOS, increase file watch limits:
sudo sysctl -w kern.maxfiles=65536
sudo sysctl -w kern.maxfilesperproc=32768

# Use polling instead of native events
cursor-prompt watch --polling

# Watch specific directory
cursor-prompt watch --dir ./templates --verbose
```

### Fix Cursor IDE communication
**Problem**: Cannot communicate with Cursor IDE.

**Solution**:
```bash
# Check if Cursor IDE is running
pgrep -f "cursor"

# Restart Cursor IDE extension bridge
cursor-prompt cursor:restart-bridge

# Check WebSocket connection
cursor-prompt cursor:status --verbose

# Reset Cursor integration
cursor-prompt cursor:reset
```

## Plugin Issues

### Fix plugin loading failures
**Problem**: Plugin fails to load with syntax or dependency errors.
```bash
cursor-prompt plugin:load my-plugin
# Error: Plugin failed to initialize
```

**Solution**:
```bash
# Check plugin syntax
node -c ~/.cursor-prompt/plugins/my-plugin.js

# Check plugin dependencies
cursor-prompt plugin:check-deps my-plugin

# Load with verbose logging
cursor-prompt plugin:load my-plugin --verbose

# Reinstall plugin
cursor-prompt plugin:unload my-plugin
cursor-prompt plugin:install my-plugin
```

### Resolve plugin conflicts
**Problem**: Multiple plugins conflict or override each other.

**Solution**:
```bash
# List loaded plugins
cursor-prompt plugin:list --loaded

# Disable conflicting plugin
cursor-prompt plugin:disable conflicting-plugin

# Load plugins in specific order
cursor-prompt config set plugins.loadOrder '["plugin1", "plugin2"]'
```

### Fix plugin security issues
**Problem**: Plugin is blocked due to security restrictions.

**Solution**:
```bash
# Check plugin permissions
cursor-prompt plugin:info my-plugin --permissions

# Allow specific plugin (use with caution)
cursor-prompt plugin:trust my-plugin

# Run plugin in sandbox mode
cursor-prompt plugin:load my-plugin --sandbox
```

## Template Generation Issues

### Fix variable substitution errors
**Problem**: Variables not being replaced in generated content.
```bash
cursor-prompt generate my-template --variables '{"name": "test"}'
# Output still contains {{name}}
```

**Solution**:
```bash
# Check variable names match exactly (case-sensitive)
cursor-prompt generate my-template --variables '{"feature_name": "test"}' --debug

# Verify JSON syntax
echo '{"name": "test"}' | jq .

# Use file instead of command line
echo '{"name": "test"}' > vars.json
cursor-prompt generate my-template --file vars.json
```

### Resolve conditional logic errors
**Problem**: Conditional statements in templates don't work as expected.

**Solution**:
```yaml
# Check condition syntax
content: |
  {{#if variable}}  <!-- Not {{if variable}} -->
  Content here
  {{/if}}

  # Use proper comparison operators
  {{#if status === "active"}}  <!-- Not {{#if status == "active"}} -->
  Active content
  {{/if}}
```

### Fix loop iteration problems
**Problem**: Loops don't iterate over arrays correctly.

**Solution**:
```yaml
# Ensure array format is correct
variables:
  items:
    type: array
    items:
      type: string

# Use proper loop syntax
content: |
  {{#each items}}
  - {{this}}  <!-- Use 'this' for simple arrays -->
  {{/each}}
  
  # For object arrays
  {{#each users}}
  - {{this.name}}: {{this.email}}
  {{/each}}
```

## Configuration Problems

### Fix config file corruption
**Problem**: Configuration file is corrupted or invalid.
```bash
cursor-prompt config --show
# Error: Invalid configuration file
```

**Solution**:
```bash
# Backup current config
cp ~/.cursor-prompt/config.json ~/.cursor-prompt/config.json.bak

# Reset to defaults
cursor-prompt config --reset

# Or recreate manually
cursor-prompt init --force
```

### Resolve path resolution issues
**Problem**: Templates or files not found due to incorrect paths.

**Solution**:
```bash
# Use absolute paths
cursor-prompt generate /full/path/to/template

# Or set working directory
cd /path/to/project
cursor-prompt generate my-template

# Check template search paths
cursor-prompt config get templatesDir
cursor-prompt list  # Should show your templates
```

## Performance Issues

### Fix slow template generation
**Problem**: Template generation takes too long.

**Solution**:
```bash
# Disable context gathering for faster execution
cursor-prompt generate my-template --no-context

# Use simpler templates without complex logic
# Profile template performance
cursor-prompt generate my-template --profile

# Clear template cache
cursor-prompt cache:clear
```

### Resolve memory issues
**Problem**: Out of memory errors during generation.

**Solution**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
cursor-prompt generate large-template

# Split large templates into smaller ones
# Reduce context size in configuration
cursor-prompt config set autoContext.terminalLines 10
cursor-prompt config set autoContext.maxFileSize "50KB"
```

## File System Issues

### Fix permission errors
**Problem**: Cannot read/write templates or config files.
```bash
cursor-prompt init
# Error: Permission denied
```

**Solution**:
```bash
# Fix directory permissions
sudo chown -R $USER ~/.cursor-prompt
chmod -R 755 ~/.cursor-prompt

# For project directories
sudo chown -R $USER .cursor/
chmod -R 755 .cursor/
```

### Resolve file path issues on Windows
**Problem**: Path separators causing issues on Windows.

**Solution**:
```bash
# Use forward slashes in templates
{{> ./partials/header}}  # Not .\partials\header

# Or use path.join() in config
```

## Debug Mode

### Enable verbose logging
```bash
cursor-prompt generate my-template --verbose --debug
```

### Check internal state
```bash
cursor-prompt debug --show-config
cursor-prompt debug --show-cache
cursor-prompt debug --show-plugins
```

### Generate debug report
```bash
cursor-prompt debug --report > debug-report.txt
```

## Getting Help

### Check version and status
```bash
cursor-prompt --version
cursor-prompt status --health-check
```

### Validate installation
```bash
cursor-prompt doctor  # Comprehensive health check
```

### Get community support
```bash
# Check documentation
cursor-prompt help generate

# Report issues
cursor-prompt bug-report --template my-template
```

---

*For specific template creation issues, see the [Template Management](./template-management.md) guide.*
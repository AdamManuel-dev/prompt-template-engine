# Getting Started Guide

Complete guide to get up and running with the Cursor Prompt Template Engine.

## Prerequisites

Before installing, ensure you have:

- **Node.js**: Version 22.0.0 or higher
- **npm**: Version 10.0.0 or higher (comes with Node.js)
- **Git**: For version control (optional but recommended)
- **Cursor IDE**: The target IDE for generated prompts

### Verify Prerequisites

```bash
# Check Node.js version
node --version  # Should show v22.x.x or higher

# Check npm version
npm --version  # Should show 10.x.x or higher

# Check git (optional)
git --version
```

## Installation

### Method 1: Global Installation (Recommended)

Install globally to use from anywhere:

```bash
npm install -g cursor-prompt-template-engine
```

Verify installation:

```bash
cursor-prompt --version
```

### Method 2: Local Project Installation

Add to a specific project:

```bash
npm install --save-dev cursor-prompt-template-engine
```

Use with npx:

```bash
npx cursor-prompt <command>
```

### Method 3: Install from Source

Clone and build from source:

```bash
# Clone repository
git clone https://github.com/AdamManuel-dev/cursor-prompt-template-engine.git
cd cursor-prompt-template-engine

# Install dependencies
npm install

# Build TypeScript
npm run build

# Link globally
npm link

# Verify
cursor-prompt --version
```

## Initial Setup

### Step 1: Initialize Configuration

Create a configuration file in your project:

```bash
cursor-prompt init
```

This creates `.cursorprompt.json` with default settings:

```json
{
  "templatesDir": ".cursor/templates",
  "defaultTemplate": "feature",
  "autoContext": {
    "includeGit": true,
    "includeFiles": true,
    "terminalLines": 50
  },
  "outputPreferences": {
    "copyToClipboard": true,
    "colorOutput": true
  }
}
```

### Step 2: Create Templates Directory

Set up your templates folder:

```bash
mkdir -p .cursor/templates
```

### Step 3: Create Your First Template

Create a simple bug fix template:

```bash
cat > .cursor/templates/bug-fix.md << 'EOF'
# Bug Fix Request

## Error Information
- **Error Message**: {{error}}
- **Location**: {{location}}
- **Severity**: {{severity}}

## Current Behavior
{{currentBehavior}}

## Expected Behavior
{{expectedBehavior}}

{{#if context}}
## Additional Context
{{context}}
{{/if}}

Please analyze and fix the bug described above.
EOF
```

## Basic Usage

### Generate Your First Prompt

Use the template you created:

```bash
cursor-prompt generate bug-fix \
  --variables '{
    "error": "Undefined variable 'user'",
    "location": "auth.js:45",
    "severity": "High",
    "currentBehavior": "App crashes on login",
    "expectedBehavior": "User should be authenticated"
  }'
```

The prompt is automatically copied to your clipboard!

### Using with Cursor IDE

1. Open Cursor IDE
2. Press `Cmd+L` (Mac) or `Ctrl+L` (Windows/Linux)
3. Paste the generated prompt
4. Claude will analyze and provide solutions

## Common Workflows

### Workflow 1: Bug Fixing

```bash
# Include git diff for context
cursor-prompt generate bug-fix \
  --include-git \
  --variables '{"error": "TypeError", "location": "app.js:10"}'
```

### Workflow 2: Feature Development

```bash
# Generate feature prompt with file context
cursor-prompt generate feature \
  --include-files \
  --file-patterns "src/**/*.js" \
  --variables '{"description": "Add user authentication"}'
```

### Workflow 3: Code Review

```bash
# Generate review prompt for staged changes
cursor-prompt generate review --include-git --git-staged
```

## Template Variables

### System Variables

Available in all templates:

- `{{timestamp}}` - Current date/time
- `{{cwd}}` - Current working directory
- `{{user}}` - System username
- `{{platform}}` - Operating system

### Git Variables (when --include-git)

- `{{git.branch}}` - Current branch
- `{{git.status}}` - Repository status
- `{{git.diff}}` - Uncommitted changes
- `{{git.lastCommit}}` - Latest commit info

### File Variables (when --include-files)

- `{{files}}` - Map of file contents
- `{{project.structure}}` - Directory tree
- `{{project.fileCount}}` - Number of files

## Advanced Features

### Custom Context

Add custom context to any template:

```bash
cursor-prompt generate feature \
  --context-file requirements.md \
  --variables '{"customField": "value"}'
```

### Output Options

Save to file instead of clipboard:

```bash
cursor-prompt generate bug-fix \
  --output prompt.md \
  --no-clipboard
```

Preview without copying:

```bash
cursor-prompt generate feature --preview
```

### Template Discovery

List all available templates:

```bash
cursor-prompt list --detailed
```

## Configuration Tips

### Environment Variables

Override settings with environment variables:

```bash
export CURSOR_PROMPT_TEMPLATES=/custom/templates
export CURSOR_PROMPT_NO_COLOR=1
export CURSOR_PROMPT_DEBUG=1
```

### Per-Project Configuration

Create project-specific settings:

```bash
# In project root
echo '{
  "templatesDir": "./prompts",
  "defaultTemplate": "custom"
}' > .cursorprompt.json
```

### Global Configuration

Set user-wide defaults:

```bash
# Create global config directory
mkdir -p ~/.cursorprompt

# Add global configuration
cursor-prompt config set --global templatesDir ~/.cursorprompt/templates
```

## Troubleshooting

### Common Issues

**Command not found:**

```bash
# Reinstall globally
npm uninstall -g cursor-prompt-template-engine
npm install -g cursor-prompt-template-engine
```

**Template not found:**

```bash
# Check templates directory
cursor-prompt config get templatesDir

# List available templates
cursor-prompt list
```

**Clipboard not working:**

```bash
# Use output file instead
cursor-prompt generate template --output prompt.md

# Or pipe to clipboard manually
cursor-prompt generate template | pbcopy  # Mac
cursor-prompt generate template | xclip   # Linux
```

## Next Steps

1. **Create Custom Templates**: See [Template Creation Guide](./TEMPLATE_CREATION.md)
2. **Learn Template Syntax**: Read [Template Syntax Reference](../api/TEMPLATE_SYNTAX.md)
3. **Explore Examples**: Check [Example Templates](../examples/BASIC_TEMPLATES.md)
4. **Configure Advanced Options**: See [Configuration Guide](./CONFIGURATION.md)

## Getting Help

- **Documentation**: [Full Documentation](../INDEX.md)
- **Examples**: [Example Templates](../examples/)
- **Issues**: [GitHub Issues](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/issues)
- **Community**: [Discussions](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/discussions)

---

*Last Updated: 2025-08-22*
# CLI Commands Reference

Complete specification of all command-line interface commands for the Cursor Prompt Template Engine.

## Global Options

These options are available for all commands:

| Option | Description | Default |
|--------|-------------|---------|
| `--version` | Show version number | - |
| `--help` | Show help information | - |

## Core Commands

### generate

Generate a prompt from a template.

**Syntax:**
```bash
cursor-prompt generate <template> [options]
```

**Aliases:** `g`

**Parameters:**
- `<template>` (required) - Template name or path

**Options:**
| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--variables` | `-v` | string | Variables as JSON string | `{}` |
| `--file` | `-f` | string | Variables from JSON file | - |
| `--output` | `-o` | string | Output to file instead of stdout | - |
| `--copy` | `-c` | boolean | Copy to clipboard | `false` |

**Examples:**
```bash
# Basic usage
cursor-prompt generate feature

# With variables
cursor-prompt generate feature -v '{"name":"auth","type":"service"}'

# From variables file
cursor-prompt generate feature -f ./vars.json

# Save to file
cursor-prompt generate feature -o prompt.md

# Copy to clipboard
cursor-prompt generate feature --copy
```

**Exit Codes:**
- `0` - Success
- `1` - Template not found or generation failed

### list

List available templates.

**Syntax:**
```bash
cursor-prompt list [options]
```

**Aliases:** `ls`

**Options:**
| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--detailed` | `-d` | boolean | Show detailed information | `false` |
| `--tags` | `-t` | string | Filter by tags (comma-separated) | - |

**Output Format:**
- Simple: `• template-name - description`
- Detailed: Name, description, version, tags

**Examples:**
```bash
# List all templates
cursor-prompt list

# Detailed view
cursor-prompt list --detailed

# Filter by tags
cursor-prompt list --tags feature,bug-fix
```

### init

Initialize Cursor Prompt in current project.

**Syntax:**
```bash
cursor-prompt init [options]
```

**Options:**
| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--force` | boolean | Overwrite existing configuration | `false` |

**Created Structure:**
```
.cursor/                     # Cursor IDE integration
.cursor/rules/              # Generated rules directory
templates/                  # Template files
.cursorprompt.json         # Configuration file
templates/example.yaml      # Example template
```

**Default Configuration:**
```json
{
  "version": "1.0.0",
  "templates": {
    "paths": ["./templates"],
    "watch": true
  },
  "cursor": {
    "autoSync": true,
    "rulesDir": ".cursor/rules",
    "legacySupport": true
  }
}
```

### sync

Sync templates to Cursor rules.

**Syntax:**
```bash
cursor-prompt sync [options]
```

**Options:**
| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--dir` | `-d` | string | Output directory for rules | `.cursor/rules` |
| `--legacy` | - | boolean | Generate legacy .cursorrules file | `false` |

**Generated Files:**
- `.cursor/rules/*.mdc` - Cursor rule files
- `.cursorrules` - Legacy format (if --legacy)

### validate

Validate a template file.

**Syntax:**
```bash
cursor-prompt validate <template> [options]
```

**Parameters:**
- `<template>` (required) - Template name or path

**Validation Checks:**
- Template syntax
- Variable references
- File structure
- Metadata completeness

**Output:**
- ✅ Template is valid
- ❌ Template validation failed
- ⚠ Warnings (if any)

**Exit Codes:**
- `0` - Valid template
- `1` - Invalid template

### watch

Watch templates and auto-sync to Cursor rules.

**Syntax:**
```bash
cursor-prompt watch [options]
```

**Options:**
| Option | Short | Type | Description | Default |
|--------|-------|------|-------------|---------|
| `--dir` | `-d` | string | Template directory to watch | `./templates` |

**Behavior:**
- Monitors template files for changes
- Automatically syncs to Cursor rules
- Runs until Ctrl+C

## Marketplace Commands

### marketplace list

List installed marketplace templates.

**Syntax:**
```bash
cursor-prompt marketplace list [options]
```

**Options:**
| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--check-updates` | boolean | Check for available updates | `false` |
| `--outdated` | boolean | Show only outdated templates | `false` |
| `--detailed` | boolean | Show detailed information | `false` |

### marketplace search

Search marketplace templates.

**Syntax:**
```bash
cursor-prompt marketplace search [query] [options]
```

**Options:**
| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--category` | string | Filter by category | - |
| `--tag` | string | Filter by tag | - |
| `--author` | string | Filter by author | - |
| `--sort` | string | Sort order (downloads, rating, recent) | `relevance` |
| `--limit` | number | Number of results | `20` |

### marketplace install

Install a marketplace template.

**Syntax:**
```bash
cursor-prompt marketplace install <template-id> [options]
```

**Options:**
| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--version` | string | Specific version to install | `latest` |
| `--skip-deps` | boolean | Skip dependency installation | `false` |
| `--auto-update` | boolean | Enable auto-updates | `true` |

### marketplace info

Show template information.

**Syntax:**
```bash
cursor-prompt marketplace info <template-id> [options]
```

**Options:**
| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--dependencies` | boolean | Show dependencies | `false` |
| `--examples` | boolean | Show usage examples | `false` |
| `--versions` | boolean | Show version history | `false` |

### marketplace update

Update installed templates.

**Syntax:**
```bash
cursor-prompt marketplace update [template-id] [options]
```

**Options:**
| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--check-only` | boolean | Check for updates without installing | `false` |
| `--major` | boolean | Include major version updates | `false` |
| `--include-prerelease` | boolean | Include prerelease versions | `false` |

### marketplace rate

Rate and review a template.

**Syntax:**
```bash
cursor-prompt marketplace rate <template-id> <rating> [options]
```

**Parameters:**
- `<template-id>` (required) - Template identifier
- `<rating>` (required) - Rating from 1-5

**Options:**
| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--comment` | string | Review comment | - |
| `--anonymous` | boolean | Submit anonymously | `false` |

### marketplace publish

Publish a template to marketplace.

**Syntax:**
```bash
cursor-prompt marketplace publish <template-path> [options]
```

**Options:**
| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--category` | string | Template category | `utility` |
| `--tags` | string | Comma-separated tags | - |
| `--version` | string | Version number | `1.0.0` |
| `--public` | boolean | Make template public | `true` |

## Configuration Commands

### config get

Get configuration value.

**Syntax:**
```bash
cursor-prompt config get <key>
```

**Parameters:**
- `<key>` (required) - Configuration key (dot notation supported)

### config set

Set configuration value.

**Syntax:**
```bash
cursor-prompt config set <key> <value>
```

**Parameters:**
- `<key>` (required) - Configuration key
- `<value>` (required) - Value to set

### config list

List all configuration values.

**Syntax:**
```bash
cursor-prompt config list [options]
```

**Options:**
| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--format` | string | Output format (table, json, yaml) | `table` |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CURSOR_PROMPT_CONFIG` | Configuration file path | - |
| `CURSOR_PROMPT_TEMPLATES_DIR` | Templates directory | `./templates` |
| `CURSOR_PROMPT_DEBUG` | Enable debug logging | `false` |
| `CURSOR_PROMPT_NO_COLOR` | Disable colored output | `false` |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments |
| `3` | Configuration error |
| `4` | Template not found |
| `5` | Validation failed |

## File Paths

All file paths can be:
- Absolute: `/full/path/to/file`
- Relative to current directory: `./templates/file.md`
- Relative to home directory: `~/templates/file.md`

## JSON Schema

Command line arguments follow these schemas:

```typescript
interface GenerateOptions {
  template: string;
  variables?: Record<string, string>;
  output?: string;
  copy?: boolean;
}

interface ListOptions {
  detailed?: boolean;
  tags?: string;
}

interface InitOptions {
  force?: boolean;
}
```
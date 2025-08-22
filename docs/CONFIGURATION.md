# Configuration Guide

The Cursor Prompt Template Engine supports a flexible hierarchical configuration system that allows you to customize behavior at multiple levels.

## Configuration Hierarchy

Configuration is loaded from multiple sources in the following priority order (highest to lowest):

1. **Environment Variables** - Override any configuration
2. **Project Configuration** - `.cursor-prompt.json` in project root
3. **Global Configuration** - `~/.cursor-prompt/config.json`
4. **Default Configuration** - Built-in defaults

## Configuration File Structure

```json
{
  "templates": {
    "directory": "./templates",
    "extension": ".prompt"
  },
  "output": {
    "format": "markdown",
    "clipboard": false
  },
  "cursor": {
    "integration": true,
    "apiEndpoint": "http://localhost:3000",
    "autoSync": false
  },
  "plugins": {
    "enabled": true,
    "directories": ["./plugins", "~/.cursor-prompt/plugins"],
    "autoLoad": true
  },
  "logging": {
    "level": "info",
    "file": ""
  }
}
```

## Configuration Options

### Templates Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `templates.directory` | string | `./templates` | Directory containing template files |
| `templates.extension` | string | `.prompt` | File extension for template files |

### Output Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `output.format` | string | `markdown` | Default output format (markdown, plain, json) |
| `output.clipboard` | boolean | `false` | Automatically copy output to clipboard |

### Cursor IDE Integration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cursor.integration` | boolean | `true` | Enable Cursor IDE integration |
| `cursor.apiEndpoint` | string | `http://localhost:3000` | Cursor API endpoint URL |
| `cursor.autoSync` | boolean | `false` | Automatically sync templates with Cursor |
| `cursor.syncInterval` | number | `30000` | Sync interval in milliseconds |

### Plugin System

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `plugins.enabled` | boolean | `true` | Enable plugin system |
| `plugins.directories` | string[] | `[]` | Additional plugin directories to search |
| `plugins.autoLoad` | boolean | `true` | Automatically load plugins on startup |

### Logging

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logging.level` | string | `info` | Log level (debug, info, warn, error) |
| `logging.file` | string | `` | Log file path (empty for console only) |

## Environment Variables

All configuration options can be overridden using environment variables with the prefix `CURSOR_PROMPT_`:

```bash
# Override templates directory
export CURSOR_PROMPT_TEMPLATES_DIRECTORY=/custom/templates

# Disable Cursor integration
export CURSOR_PROMPT_CURSOR_INTEGRATION=false

# Set log level to debug
export CURSOR_PROMPT_LOGGING_LEVEL=debug

# Enable auto-sync
export CURSOR_PROMPT_CURSOR_AUTOSYNC=true
```

## Managing Configuration

### Using the CLI

```bash
# View current configuration
cursor-prompt config --list

# Set a configuration value
cursor-prompt config --set templates.directory=/new/path

# Use global configuration
cursor-prompt config --global --set cursor.autoSync=true
```

### Configuration Watchers

The configuration system supports real-time updates. Changes to configuration files are automatically detected and applied without restarting the application.

## Per-Project Configuration

Create a `.cursor-prompt.json` file in your project root to override global settings:

```json
{
  "templates": {
    "directory": "./project-templates"
  },
  "cursor": {
    "autoSync": true
  }
}
```

## Plugin Configuration

Plugins can define their own configuration schemas that are merged with the main configuration:

```json
{
  "plugins": {
    "myPlugin": {
      "apiKey": "xxx",
      "enabled": true
    }
  }
}
```

## Best Practices

1. **Use project configuration** for team-shared settings
2. **Use global configuration** for personal preferences
3. **Use environment variables** for sensitive data and CI/CD
4. **Keep templates directory** in version control for team sharing
5. **Document custom plugins** in your project README

## Troubleshooting

### Configuration Not Loading

1. Check file permissions
2. Validate JSON syntax
3. Use `--debug` flag to see configuration loading details
4. Check environment variable naming (use underscores, not dots)

### Cursor Integration Issues

1. Ensure Cursor IDE is running
2. Check API endpoint configuration
3. Verify network connectivity
4. Review logs with `--debug` flag

### Plugin Loading Failures

1. Check plugin directory paths
2. Verify plugin dependencies are installed
3. Review plugin metadata files
4. Check for naming conflicts
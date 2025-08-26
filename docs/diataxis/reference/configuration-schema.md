# Configuration Schema Reference

Complete specification of configuration options and file formats for the Cursor Prompt Template Engine.

## Configuration Files

Configuration files are searched in the following order of precedence:

1. `.cursor-prompt.config.json` (highest priority)
2. `.cursor-prompt.json`
3. `cursor-prompt.config.json`
4. `.cursorprompt.json` (lowest priority)

## Primary Configuration Schema

### Root Configuration

```typescript
interface Config {
  projectName: string;
  templatePaths: string[];
  outputPath?: string;
  defaultTemplate?: string;
  variables: Record<string, string>;
  formats: FormatsConfig;
  features: FeaturesConfig;
  metadata: MetadataConfig;
}
```

### Complete JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "projectName": {
      "type": "string",
      "description": "Project identifier",
      "minLength": 1
    },
    "templatePaths": {
      "type": "array",
      "description": "Directories to search for templates",
      "items": {
        "type": "string"
      },
      "minItems": 1
    },
    "outputPath": {
      "type": "string",
      "description": "Default output directory for generated files"
    },
    "defaultTemplate": {
      "type": "string",
      "description": "Default template to use when none specified"
    },
    "variables": {
      "type": "object",
      "description": "Global template variables",
      "additionalProperties": {
        "type": "string"
      }
    },
    "formats": {
      "type": "object",
      "properties": {
        "default": {
          "type": "string",
          "enum": ["markdown", "plain", "json"],
          "description": "Default output format"
        },
        "supported": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Supported output formats"
        }
      },
      "required": ["default", "supported"]
    },
    "features": {
      "type": "object",
      "properties": {
        "clipboard": {
          "type": "boolean",
          "description": "Enable clipboard functionality"
        },
        "preview": {
          "type": "boolean",
          "description": "Enable template preview mode"
        },
        "validation": {
          "type": "boolean",
          "description": "Enable template validation"
        },
        "autoBackup": {
          "type": "boolean",
          "description": "Create backups before overwriting files"
        }
      },
      "required": ["clipboard", "preview", "validation", "autoBackup"]
    },
    "metadata": {
      "type": "object",
      "properties": {
        "version": {
          "type": "string",
          "description": "Configuration version"
        },
        "created": {
          "type": "string",
          "format": "date-time",
          "description": "Creation timestamp"
        },
        "lastModified": {
          "type": "string",
          "format": "date-time",
          "description": "Last modification timestamp"
        }
      },
      "required": ["version", "created", "lastModified"]
    }
  },
  "required": ["projectName", "templatePaths", "variables", "formats", "features", "metadata"]
}
```

### Default Configuration

```json
{
  "projectName": "cursor-prompt-templates",
  "templatePaths": [
    "./templates",
    "./.cursor-prompt/templates"
  ],
  "outputPath": "./generated",
  "defaultTemplate": "basic",
  "variables": {},
  "formats": {
    "default": "markdown",
    "supported": ["markdown", "plain", "json"]
  },
  "features": {
    "clipboard": true,
    "preview": true,
    "validation": true,
    "autoBackup": false
  },
  "metadata": {
    "version": "1.0.0",
    "created": "2024-01-01T00:00:00.000Z",
    "lastModified": "2024-01-01T00:00:00.000Z"
  }
}
```

## Extended Configuration Schema

### Enhanced Configuration

The engine supports an extended configuration format with additional options:

```typescript
interface ExtendedConfig {
  templatesDir: string;
  defaultTemplate: string;
  autoContext?: AutoContextConfig;
  outputPreferences?: OutputPreferencesConfig;
  validation?: ValidationConfig;
  performance?: PerformanceConfig;
  gitIntegration?: GitIntegrationConfig;
  marketplace?: MarketplaceConfig;
  plugins?: PluginsConfig;
}
```

### Auto Context Configuration

```typescript
interface AutoContextConfig {
  includeGit: boolean;
  includeFiles: boolean;
  includeTerminal: boolean;
  includeEnvironment: boolean;
  terminalLines: number;
  filePatterns: string[];
  excludePatterns: string[];
}
```

**Default Values:**
```json
{
  "autoContext": {
    "includeGit": true,
    "includeFiles": true,
    "includeTerminal": true,
    "includeEnvironment": false,
    "terminalLines": 50,
    "filePatterns": [],
    "excludePatterns": ["node_modules/**", ".git/**"]
  }
}
```

### Output Preferences Configuration

```typescript
interface OutputPreferencesConfig {
  copyToClipboard: boolean;
  showPreview: boolean;
  colorOutput: boolean;
  format: 'markdown' | 'plain' | 'json';
}
```

**Default Values:**
```json
{
  "outputPreferences": {
    "copyToClipboard": true,
    "showPreview": false,
    "colorOutput": true,
    "format": "markdown"
  }
}
```

### Validation Configuration

```typescript
interface ValidationConfig {
  strict: boolean;
  autoFix: boolean;
  warnOnMissingVars: boolean;
  maxNestingDepth: number;
  allowedTags: string[];
}
```

**Default Values:**
```json
{
  "validation": {
    "strict": false,
    "autoFix": false,
    "warnOnMissingVars": true,
    "maxNestingDepth": 10,
    "allowedTags": ["if", "unless", "each", "include"]
  }
}
```

### Performance Configuration

```typescript
interface PerformanceConfig {
  maxFileSize: number;
  maxTotalSize: number;
  cacheTemplates: boolean;
  parallel: boolean;
}
```

**Default Values:**
```json
{
  "performance": {
    "maxFileSize": 1048576,
    "maxTotalSize": 10485760,
    "cacheTemplates": true,
    "parallel": true
  }
}
```

### Git Integration Configuration

```typescript
interface GitIntegrationConfig {
  enabled: boolean;
  includeStatus: boolean;
  includeDiff: boolean;
  includeCommits: boolean;
  commitLimit: number;
}
```

**Default Values:**
```json
{
  "gitIntegration": {
    "enabled": true,
    "includeStatus": true,
    "includeDiff": true,
    "includeCommits": true,
    "commitLimit": 10
  }
}
```

### Marketplace Configuration

```typescript
interface MarketplaceConfig {
  enabled: boolean;
  apiUrl: string;
  apiKey?: string;
  cacheDir: string;
  autoUpdate: boolean;
  updateCheckInterval: number;
  maxCacheSize: number;
  timeout: number;
}
```

**Default Values:**
```json
{
  "marketplace": {
    "enabled": true,
    "apiUrl": "https://api.cursor-prompt.com",
    "cacheDir": ".cursor/.marketplace-cache",
    "autoUpdate": true,
    "updateCheckInterval": 86400,
    "maxCacheSize": 100,
    "timeout": 30000
  }
}
```

### Plugins Configuration

```typescript
interface PluginsConfig {
  enabled: boolean;
  directory: string;
  autoLoad: boolean;
  sandboxed: boolean;
}
```

**Default Values:**
```json
{
  "plugins": {
    "enabled": true,
    "directory": ".cursor/plugins",
    "autoLoad": true,
    "sandboxed": true
  }
}
```

## Template Configuration Schema

### Template Metadata

Templates can include metadata in YAML frontmatter or separate JSON files.

```typescript
interface TemplateConfig {
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];
  variables?: Record<string, VariableConfig>;
  files?: TemplateFile[];
  commands?: TemplateCommand[];
  metadata?: TemplateMetadata;
}
```

### Variable Configuration

```typescript
interface VariableConfig {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  default?: unknown;
  required?: boolean;
  description?: string;
  validation?: VariableValidation;
  transform?: string;
}
```

### Variable Validation Schema

```typescript
interface VariableValidation {
  pattern?: string;
  min?: number;
  max?: number;
  enum?: unknown[];
  custom?: string;
}
```

### Template File Schema

```typescript
interface TemplateFile {
  path: string;
  name?: string;
  content: string;
  encoding?: string;
  mode?: string;
}
```

### Template Command Schema

```typescript
interface TemplateCommand {
  command: string;
  description?: string;
  when?: string;
  workingDirectory?: string;
  timeout?: number;
}
```

### Complete Template Example

```yaml
---
name: feature-template
version: 1.2.0
description: Template for creating new features
author: John Doe
tags: [feature, development, typescript]
variables:
  name:
    type: string
    required: true
    description: Feature name in camelCase
    validation:
      pattern: "^[a-z][a-zA-Z0-9]*$"
  type:
    type: string
    default: component
    description: Feature type
    validation:
      enum: [component, service, utility, hook]
  includeTests:
    type: boolean
    default: true
    description: Generate test files
  dependencies:
    type: array
    default: []
    description: Required dependencies
files:
  - path: "src/{{name}}/index.ts"
    content: |
      export { default } from './{{name}}';
  - path: "src/{{name}}/{{name}}.ts"
    content: |
      // {{description}}
      // TODO: Implement {{name}}
commands:
  - command: "npm install"
    description: "Install dependencies"
    when: "dependencies.length > 0"
metadata:
  repository: "https://github.com/user/repo"
  license: "MIT"
---

# {{name | capitalize}} {{type | capitalize}}

{{description}}

## Usage

```typescript
import {{name}} from './{{name}}';
```
```

## Environment Variables

Configuration can be overridden using environment variables:

| Variable | Description | Type | Default |
|----------|-------------|------|---------|
| `CURSOR_PROMPT_PROJECT_NAME` | Project name | string | - |
| `CURSOR_PROMPT_TEMPLATE_PATHS` | Template paths (colon-separated) | string | - |
| `CURSOR_PROMPT_OUTPUT_PATH` | Output path | string | - |
| `CURSOR_PROMPT_DEFAULT_TEMPLATE` | Default template | string | - |
| `CURSOR_PROMPT_CLIPBOARD` | Enable clipboard | boolean | - |
| `CURSOR_PROMPT_PREVIEW` | Enable preview | boolean | - |
| `CURSOR_PROMPT_VALIDATION` | Enable validation | boolean | - |
| `CURSOR_PROMPT_CONFIG` | Config file path | string | - |
| `CURSOR_PROMPT_DEBUG` | Debug mode | boolean | `false` |
| `CURSOR_PROMPT_NO_COLOR` | Disable colors | boolean | `false` |

### Environment Variable Examples

```bash
# Set project name
export CURSOR_PROMPT_PROJECT_NAME="my-project"

# Add additional template paths
export CURSOR_PROMPT_TEMPLATE_PATHS="./templates:./custom-templates:~/.templates"

# Disable clipboard integration
export CURSOR_PROMPT_CLIPBOARD=false

# Use specific config file
export CURSOR_PROMPT_CONFIG="./config/cursor-prompt.json"

# Enable debug output
export CURSOR_PROMPT_DEBUG=true
```

## Validation Rules

### Required Fields

| Field | Required | Description |
|-------|----------|-------------|
| `projectName` | ✅ | Must be non-empty string |
| `templatePaths` | ✅ | Must contain at least one path |
| `variables` | ✅ | Can be empty object |
| `formats` | ✅ | Must specify default and supported |
| `features` | ✅ | Must specify all boolean flags |
| `metadata` | ✅ | Must include version and timestamps |

### Field Constraints

| Field | Constraint | Error |
|-------|------------|-------|
| `projectName` | Non-empty string | "projectName must be a non-empty string" |
| `templatePaths` | Non-empty array | "templatePaths must contain at least one path" |
| `formats.default` | Valid enum value | "formats.default must be one of: markdown, plain, json" |
| `metadata.version` | Semantic version | "version must follow semver format" |

### Custom Validation

```typescript
import { Validator, ConfigSchema } from 'cursor-prompt/validation';

// Validate configuration
const result = Validator.validate(ConfigSchema, configData);
if (!result.success) {
  console.error('Config validation failed:', result.errors);
}
```

## Migration Guide

### Version 1.x to 2.x

**Breaking Changes:**
- `templatesPath` → `templatePaths` (now array)
- `features.autoSync` → removed
- Added required `metadata` section

**Migration Script:**
```javascript
function migrateConfig(oldConfig) {
  const newConfig = {
    ...oldConfig,
    templatePaths: Array.isArray(oldConfig.templatePaths) 
      ? oldConfig.templatePaths 
      : [oldConfig.templatesPath || './templates'],
    metadata: {
      version: '2.0.0',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }
  };
  
  // Remove deprecated fields
  delete newConfig.templatesPath;
  if (newConfig.features) {
    delete newConfig.features.autoSync;
  }
  
  return newConfig;
}
```

## Configuration Merging

Configuration sources are merged in this order (later sources override earlier):

1. Default configuration
2. Configuration file
3. Environment variables
4. Command-line arguments

### Merge Strategy

- **Primitive values**: Direct override
- **Objects**: Deep merge (nested properties preserved)
- **Arrays**: Complete replacement

### Example Merge

**Base config:**
```json
{
  "features": {
    "clipboard": true,
    "validation": true
  },
  "templatePaths": ["./templates"]
}
```

**Override config:**
```json
{
  "features": {
    "clipboard": false
  },
  "templatePaths": ["./custom-templates"]
}
```

**Result:**
```json
{
  "features": {
    "clipboard": false,
    "validation": true
  },
  "templatePaths": ["./custom-templates"]
}
```

## File Locations

### Search Paths

Configuration files are searched in these directories:

1. Current working directory
2. Parent directories (recursively up to root)
3. Home directory (`~/`)
4. Global config directory (`~/.config/cursor-prompt/`)

### Directory Structure

```
project/
├── .cursor-prompt.config.json    # Project config
├── templates/                    # Templates directory
├── .cursor/                      # Cursor integration
│   ├── rules/                   # Generated rules
│   └── plugins/                 # Custom plugins
└── generated/                   # Generated output
```

### Global Configuration

```
~/.config/cursor-prompt/
├── config.json                  # Global config
├── templates/                   # Global templates
└── plugins/                     # Global plugins
```

## JSON Schema Files

Complete JSON Schema files are available for editor integration:

- **Configuration**: `schemas/config.schema.json`
- **Template**: `schemas/template.schema.json`
- **Marketplace**: `schemas/marketplace.schema.json`

### VS Code Integration

Add to `settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": [
        ".cursor-prompt.config.json",
        ".cursor-prompt.json",
        ".cursorprompt.json"
      ],
      "url": "./node_modules/cursor-prompt/schemas/config.schema.json"
    }
  ]
}
```
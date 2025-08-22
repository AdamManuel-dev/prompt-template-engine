# API Reference

Complete API documentation for the Cursor Prompt Template Engine.

## Table of Contents

- [CLI Commands](#cli-commands)
- [Core Classes](#core-classes)
- [Services](#services)
- [Interfaces](#interfaces)
- [Configuration](#configuration)

## CLI Commands

### cursor-prompt init

Initialize a new project configuration.

```bash
cursor-prompt init [options]
```

**Options:**
- `-d, --dir <path>` - Directory to initialize (default: current)
- `-t, --templates <path>` - Templates directory path
- `-f, --force` - Overwrite existing configuration
- `--no-git` - Skip git repository check

**Example:**
```bash
cursor-prompt init --dir ./my-project --templates ./templates
```

### cursor-prompt generate

Generate a prompt from a template.

```bash
cursor-prompt generate <template> [options]
```

**Arguments:**
- `template` - Template name or path

**Options:**
- `-v, --variables <json>` - Variables as JSON string
- `-o, --output <file>` - Output to file instead of clipboard
- `-c, --clipboard` - Copy to clipboard (default: true)
- `-p, --preview` - Preview output without copying
- `--context` - Include context gathering
- `--include-git` - Include git context
- `--include-files` - Include file context
- `--file-patterns <patterns>` - File patterns to include

**Example:**
```bash
cursor-prompt generate bug-fix \
  --variables '{"error":"undefined variable","location":"auth.ts:45"}' \
  --include-git
```

### cursor-prompt apply

Apply a template to files.

```bash
cursor-prompt apply <template> <files...> [options]
```

**Arguments:**
- `template` - Template to apply
- `files` - Files to process

**Options:**
- `-f, --force` - Overwrite without confirmation
- `-b, --backup` - Create backups before applying
- `-d, --dry-run` - Preview changes without applying

**Example:**
```bash
cursor-prompt apply header-template src/**/*.ts --backup
```

### cursor-prompt validate

Validate template syntax.

```bash
cursor-prompt validate <template> [options]
```

**Arguments:**
- `template` - Template to validate

**Options:**
- `-s, --strict` - Enable strict validation
- `--fix` - Attempt to fix issues
- `-f, --format <type>` - Output format (table|json|yaml)

**Example:**
```bash
cursor-prompt validate my-template --strict --format json
```

### cursor-prompt list

List available templates.

```bash
cursor-prompt list [options]
```

**Options:**
- `-d, --detailed` - Show detailed information
- `-c, --category <name>` - Filter by category
- `-f, --format <type>` - Output format (table|json|list)

**Example:**
```bash
cursor-prompt list --detailed --category debug
```

### cursor-prompt config

Manage configuration.

```bash
cursor-prompt config <action> [key] [value] [options]
```

**Actions:**
- `get <key>` - Get configuration value
- `set <key> <value>` - Set configuration value
- `list` - List all settings
- `reset` - Reset to defaults

**Example:**
```bash
cursor-prompt config set templatesDir ./my-templates
cursor-prompt config get outputPreferences.copyToClipboard
```

## Core Classes

### TemplateEngine

The main template processing engine.

```typescript
class TemplateEngine {
  constructor()
  
  async render(
    template: string, 
    context: TemplateContext
  ): Promise<string>
  
  async renderFile(
    filePath: string,
    context: TemplateContext
  ): Promise<string>
}
```

**Methods:**

#### render(template, context)
Renders a template string with the provided context.

**Parameters:**
- `template: string` - Template content
- `context: TemplateContext` - Variables and data

**Returns:** `Promise<string>` - Rendered output

**Example:**
```typescript
const engine = new TemplateEngine();
const result = await engine.render(
  'Hello {{name}}!',
  { name: 'World' }
);
// Result: "Hello World!"
```

### TemplateValidator

Validates template syntax and structure.

```typescript
class TemplateValidator {
  validate(template: string): ValidationResult
  
  validateFile(filePath: string): Promise<ValidationResult>
  
  canAutoFix(errors: ValidationError[]): boolean
  
  autoFix(template: string): string
}
```

**Methods:**

#### validate(template)
Validates template syntax.

**Parameters:**
- `template: string` - Template to validate

**Returns:** `ValidationResult` - Validation results

## Services

### ContextAggregator

Aggregates context from multiple sources.

```typescript
class ContextAggregator {
  async gatherContext(
    options?: ContextOptions
  ): Promise<AggregatedContext>
  
  formatContext(
    context: AggregatedContext,
    format?: string
  ): string
  
  getContextSummary(
    context: AggregatedContext
  ): ContextSummary
}
```

### GitService

Git repository operations.

```typescript
class GitService {
  async isGitRepo(): Promise<boolean>
  
  async getStatus(): Promise<GitStatus>
  
  async getBranch(): Promise<string>
  
  async getDiff(staged?: boolean): Promise<string>
  
  async getCommits(limit?: number): Promise<GitCommit[]>
  
  async getContext(): Promise<GitContext>
}
```

### FileContextService

File system context operations.

```typescript
class FileContextService {
  async getFileInfo(filePath: string): Promise<FileInfo>
  
  async getProjectStructure(
    maxDepth?: number
  ): Promise<ProjectStructure>
  
  async getFileContent(
    filePath: string,
    options?: FileReadOptions
  ): Promise<FileContent>
  
  async getFileContents(
    patterns: string[]
  ): Promise<FileContent[]>
}
```

### ConfigService

Configuration management.

```typescript
class ConfigService {
  get<T>(key: string, defaultValue?: T): T
  
  set(key: string, value: any): void
  
  reset(): void
  
  load(configPath?: string): void
  
  save(): void
}
```

### TemplateService

Template discovery and management.

```typescript
class TemplateService {
  async discoverTemplates(): Promise<Template[]>
  
  async loadTemplate(name: string): Promise<Template>
  
  async saveTemplate(
    name: string,
    content: string
  ): Promise<void>
  
  async deleteTemplate(name: string): Promise<void>
  
  getTemplateInfo(name: string): TemplateInfo
}
```

## Interfaces

### TemplateContext

Variables and data for template rendering.

```typescript
interface TemplateContext {
  [key: string]: unknown;
}
```

### AggregatedContext

Combined context from all sources.

```typescript
interface AggregatedContext {
  system: SystemContext;
  git?: GitContext;
  project?: ProjectStructure;
  files?: Map<string, FileContent>;
  terminal?: TerminalContext;
  custom?: Record<string, unknown>;
}
```

### GitStatus

Git repository status information.

```typescript
interface GitStatus {
  branch: string;
  isClean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  ahead: number;
  behind: number;
}
```

### FileContent

File content with metadata.

```typescript
interface FileContent {
  path: string;
  content: string;
  size: number;
  encoding: string;
  truncated: boolean;
  lines: number;
}
```

### Template

Template definition.

```typescript
interface Template {
  name: string;
  path: string;
  description?: string;
  category?: string;
  variables?: VariableConfig[];
  metadata?: TemplateMetadata;
  content?: string;
  commands?: TemplateCommand[];
}
```

### ValidationResult

Template validation results.

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info: ValidationInfo[];
}
```

## Configuration

### Configuration Schema

```typescript
interface Config {
  templatesDir: string;
  defaultTemplate: string;
  autoContext: {
    includeGit: boolean;
    includeFiles: boolean;
    includeTerminal: boolean;
    terminalLines: number;
    filePatterns: string[];
  };
  outputPreferences: {
    copyToClipboard: boolean;
    showPreview: boolean;
    colorOutput: boolean;
    format: 'markdown' | 'plain' | 'json';
  };
  validation: {
    strict: boolean;
    autoFix: boolean;
    warnOnMissingVars: boolean;
  };
  performance: {
    maxFileSize: number;
    maxTotalSize: number;
    cacheTemplates: boolean;
    parallel: boolean;
  };
  gitIntegration: {
    enabled: boolean;
    includeStatus: boolean;
    includeDiff: boolean;
    includeCommits: boolean;
    commitLimit: number;
  };
}
```

### Environment Variables

- `CURSOR_PROMPT_TEMPLATES` - Override templates directory
- `CURSOR_PROMPT_CONFIG` - Custom config file path
- `CURSOR_PROMPT_NO_COLOR` - Disable colored output
- `CURSOR_PROMPT_DEBUG` - Enable debug logging
- `CURSOR_PROMPT_CACHE_DIR` - Cache directory location

## Error Handling

### Error Classes

```typescript
class TemplateError extends Error {
  code: string;
  details?: any;
}

class ValidationError extends TemplateError {
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
}

class ConfigError extends TemplateError {
  key?: string;
}

class FileError extends TemplateError {
  path?: string;
  operation?: string;
}
```

### Error Codes

- `TEMPLATE_NOT_FOUND` - Template does not exist
- `INVALID_SYNTAX` - Template syntax error
- `MISSING_VARIABLE` - Required variable not provided
- `CIRCULAR_INCLUDE` - Circular include detected
- `FILE_ACCESS_ERROR` - Cannot access file
- `CONFIG_INVALID` - Invalid configuration
- `GIT_NOT_REPO` - Not a git repository

## Template Syntax

See [Template Syntax Guide](./api/TEMPLATE_SYNTAX.md) for detailed template language documentation.

## Examples

### Basic Usage

```typescript
import { TemplateEngine, ContextAggregator } from 'cursor-prompt';

const engine = new TemplateEngine();
const aggregator = new ContextAggregator();

// Gather context
const context = await aggregator.gatherContext({
  includeGit: true,
  includeFiles: true,
  filePatterns: ['src/**/*.ts']
});

// Render template
const template = `
# Bug Fix Request

{{#if git.branch}}
Branch: {{git.branch}}
{{/if}}

{{#each files}}
## {{this.path}}
\`\`\`
{{this.content}}
\`\`\`
{{/each}}

Please fix the bug in the above code.
`;

const result = await engine.render(template, context);
console.log(result);
```

### Custom Service Integration

```typescript
import { TemplateService, ConfigService } from 'cursor-prompt';

const templateService = new TemplateService();
const configService = new ConfigService();

// Load configuration
configService.load('./my-config.json');

// Discover templates
const templates = await templateService.discoverTemplates();

// Load and render specific template
const template = await templateService.loadTemplate('bug-fix');
const rendered = await engine.render(template.content, {
  error: 'undefined variable',
  location: 'auth.ts:45'
});
```

---

*API Version: 1.0.0 | Last Updated: 2025-08-22*
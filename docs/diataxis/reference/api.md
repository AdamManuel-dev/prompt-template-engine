# Programmatic API Reference

Complete API specification for using the Cursor Prompt Template Engine programmatically in Node.js applications.

## Installation

```bash
npm install cursor-prompt
```

## Core Classes

### TemplateEngine

Main engine class for template processing.

**Import:**
```typescript
import { TemplateEngine } from 'cursor-prompt';
```

**Constructor:**
```typescript
new TemplateEngine()
```

#### Methods

##### render(template, context)

Renders a template string with provided context.

**Signature:**
```typescript
async render(template: string, context: TemplateContext): Promise<string>
```

**Parameters:**
- `template` (string) - Template string with template syntax
- `context` (TemplateContext) - Variables and data for rendering

**Returns:** Promise<string> - Rendered template

**Example:**
```typescript
const engine = new TemplateEngine();
const result = await engine.render('Hello {{name}}!', { name: 'World' });
// → "Hello World!"
```

##### renderFile(templatePath, context)

Renders a template file with provided context.

**Signature:**
```typescript
async renderFile(templatePath: string, context: TemplateContext): Promise<string>
```

**Parameters:**
- `templatePath` (string) - Path to template file
- `context` (TemplateContext) - Variables and data for rendering

**Returns:** Promise<string> - Rendered template

**Example:**
```typescript
const result = await engine.renderFile('./templates/feature.md', {
  name: 'Authentication',
  type: 'service'
});
```

##### hasVariables(template)

Checks if template contains variables or expressions.

**Signature:**
```typescript
hasVariables(template: string): boolean
```

**Parameters:**
- `template` (string) - Template string to check

**Returns:** boolean - True if template has variables

**Example:**
```typescript
engine.hasVariables('Hello {{name}}!'); // → true
engine.hasVariables('Hello World!');    // → false
```

##### extractVariables(template)

Extracts all variable names from a template.

**Signature:**
```typescript
extractVariables(template: string): string[]
```

**Parameters:**
- `template` (string) - Template string to analyze

**Returns:** string[] - Array of variable names

**Example:**
```typescript
engine.extractVariables('{{name}} is {{age}} years old');
// → ['name', 'age']
```

##### validateContext(template, context)

Validates that all required variables are present in context.

**Signature:**
```typescript
validateContext(template: string, context: TemplateContext): {
  valid: boolean;
  missing: string[];
}
```

**Parameters:**
- `template` (string) - Template to validate against
- `context` (TemplateContext) - Context to check

**Returns:** Validation result object

**Example:**
```typescript
const result = engine.validateContext('Hello {{name}}!', {});
// → { valid: false, missing: ['name'] }
```

##### registerPartial(name, template)

Registers a partial template.

**Signature:**
```typescript
registerPartial(name: string, template: string): void
```

**Parameters:**
- `name` (string) - Partial name
- `template` (string) - Partial template content

**Example:**
```typescript
engine.registerPartial('header', '# {{title}}\n{{description}}');
```

##### registerPartialFromFile(name, filePath)

Registers a partial from a file.

**Signature:**
```typescript
registerPartialFromFile(name: string, filePath: string): void
```

**Parameters:**
- `name` (string) - Partial name
- `filePath` (string) - Path to partial file

**Example:**
```typescript
engine.registerPartialFromFile('footer', './partials/footer.md');
```

##### setPartialsDirectory(dir)

Sets the directory for partial templates.

**Signature:**
```typescript
setPartialsDirectory(dir: string): void
```

**Parameters:**
- `dir` (string) - Directory path

**Example:**
```typescript
engine.setPartialsDirectory('./templates/partials');
```

##### loadPartials(dir?)

Loads all partials from a directory.

**Signature:**
```typescript
loadPartials(dir?: string): void
```

**Parameters:**
- `dir` (string, optional) - Directory path (uses set directory if omitted)

**Example:**
```typescript
engine.loadPartials('./partials');
```

##### registerTransform(name, fn)

Registers a custom transformation.

**Signature:**
```typescript
registerTransform(name: string, fn: (value: unknown, ...args: unknown[]) => unknown): void
```

**Parameters:**
- `name` (string) - Transform name
- `fn` (function) - Transform function

**Example:**
```typescript
engine.registerTransform('reverse', (str: string) => str.split('').reverse().join(''));
```

### TemplateService

High-level service for template management and rendering.

**Import:**
```typescript
import { TemplateService } from 'cursor-prompt';
```

**Constructor:**
```typescript
new TemplateService()
```

#### Methods

##### findTemplate(templateName)

Finds a template by name or path.

**Signature:**
```typescript
async findTemplate(templateName: string): Promise<string | null>
```

**Parameters:**
- `templateName` (string) - Template name or path

**Returns:** Promise<string | null> - Template path or null if not found

##### loadTemplate(templatePath)

Loads and parses a template file.

**Signature:**
```typescript
async loadTemplate(templatePath: string): Promise<Template>
```

**Parameters:**
- `templatePath` (string) - Path to template file

**Returns:** Promise<Template> - Parsed template object

##### renderTemplate(template, variables)

Renders a template with variables.

**Signature:**
```typescript
async renderTemplate(template: Template, variables: Record<string, unknown>): Promise<RenderedTemplate>
```

**Parameters:**
- `template` (Template) - Template object
- `variables` (Record<string, unknown>) - Variables for rendering

**Returns:** Promise<RenderedTemplate> - Rendered template result

##### listTemplates()

Lists all available templates.

**Signature:**
```typescript
async listTemplates(): Promise<TemplateMetadata[]>
```

**Returns:** Promise<TemplateMetadata[]> - Array of template metadata

##### validateTemplate(template)

Validates a template configuration.

**Signature:**
```typescript
static async validateTemplate(template: Template): Promise<ValidationResult>
```

**Parameters:**
- `template` (Template) - Template to validate

**Returns:** Promise<ValidationResult> - Validation result

### ConfigManager

Configuration management class.

**Import:**
```typescript
import { loadConfig, writeConfig } from 'cursor-prompt/config';
```

#### Functions

##### loadConfig(configPath?)

Loads configuration from file system.

**Signature:**
```typescript
async function loadConfig(configPath?: string): Promise<Config>
```

**Parameters:**
- `configPath` (string, optional) - Path to config file

**Returns:** Promise<Config> - Configuration object

**Example:**
```typescript
const config = await loadConfig('./my-config.json');
```

##### writeConfig(configPath, config)

Writes configuration to file.

**Signature:**
```typescript
async function writeConfig(configPath: string, config: Config): Promise<void>
```

**Parameters:**
- `configPath` (string) - Path to config file
- `config` (Config) - Configuration object

**Example:**
```typescript
await writeConfig('./.cursor-prompt.json', config);
```

##### createDefaultConfig(options?)

Creates default configuration with overrides.

**Signature:**
```typescript
function createDefaultConfig(options?: ConfigOptions): Config
```

**Parameters:**
- `options` (ConfigOptions, optional) - Configuration overrides

**Returns:** Config - Default configuration

## Type Definitions

### TemplateContext

Context object for variable resolution.

```typescript
interface TemplateContext {
  [key: string]: unknown;
}
```

### Template

Template configuration object.

```typescript
interface Template {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
  content?: string;
  variables?: Record<string, unknown>;
  commands?: Record<string, string>;
  requirements?: string[];
  examples?: string[];
  filePatterns?: string[];
  contextFiles?: string[];
  references?: string[];
  priority?: 'low' | 'medium' | 'high';
  alwaysApply?: boolean;
}
```

### RenderedTemplate

Result of template rendering.

```typescript
interface RenderedTemplate {
  files: Array<{
    path: string;
    content: string;
  }>;
  metadata: Record<string, unknown>;
}
```

### ValidationResult

Template validation result.

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
```

### Config

Application configuration.

```typescript
interface Config {
  projectName: string;
  templatePaths: string[];
  outputPath?: string;
  defaultTemplate?: string;
  variables: Record<string, string>;
  formats: {
    default: 'markdown' | 'plain' | 'json';
    supported: string[];
  };
  features: {
    clipboard: boolean;
    preview: boolean;
    validation: boolean;
    autoBackup: boolean;
  };
  metadata: {
    version: string;
    created: string;
    lastModified: string;
  };
}
```

### TemplateMetadata

Template discovery metadata.

```typescript
interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags: string[];
  type: TemplateType;
  path: string;
  lastModified: Date;
  size: number;
}
```

## Error Handling

### Error Types

All errors extend from base `TemplateEngineError` class:

```typescript
class TemplateEngineError extends Error {
  code?: string;
  context?: Record<string, unknown>;
}
```

### Specific Errors

#### FileNotFoundError

Thrown when template file is not found.

```typescript
class FileNotFoundError extends TemplateEngineError {
  code: 'TEMPLATE_NOT_FOUND' | 'INCLUDE_NOT_FOUND';
}
```

#### ValidationError

Thrown when validation fails.

```typescript
class ValidationError extends TemplateEngineError {
  code: 'VALIDATION_ERROR';
}
```

#### ConfigError

Thrown when configuration is invalid.

```typescript
class ConfigError extends TemplateEngineError {
  code: 'CONFIG_PARSE_ERROR' | 'CONFIG_LOAD_ERROR' | 'CONFIG_WRITE_ERROR';
}
```

### Error Handling Example

```typescript
try {
  const result = await engine.render(template, context);
  console.log(result);
} catch (error) {
  if (error instanceof FileNotFoundError) {
    console.error('Template not found:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.message);
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

## Usage Examples

### Basic Template Rendering

```typescript
import { TemplateEngine } from 'cursor-prompt';

const engine = new TemplateEngine();

// Simple variable substitution
const template = 'Hello {{name}}!';
const result = await engine.render(template, { name: 'World' });
console.log(result); // "Hello World!"
```

### Complex Template with Loops

```typescript
const template = `
# Users
{{#each users}}
- {{name}} ({{email}})
  {{#each roles}}
  - Role: {{this}}
  {{/each}}
{{/each}}
`;

const context = {
  users: [
    {
      name: 'John Doe',
      email: 'john@example.com',
      roles: ['admin', 'user']
    },
    {
      name: 'Jane Smith',
      email: 'jane@example.com',
      roles: ['user']
    }
  ]
};

const result = await engine.render(template, context);
```

### Template Service Usage

```typescript
import { TemplateService } from 'cursor-prompt';

const service = new TemplateService();

// Find and render template
const templatePath = await service.findTemplate('feature');
if (templatePath) {
  const template = await service.loadTemplate(templatePath);
  const rendered = await service.renderTemplate(template, {
    name: 'Authentication',
    type: 'service'
  });
  
  console.log(rendered.files[0].content);
}
```

### Configuration Management

```typescript
import { loadConfig, writeConfig } from 'cursor-prompt/config';

// Load existing config
const config = await loadConfig();

// Modify config
config.templatePaths.push('./custom-templates');

// Save config
await writeConfig('./.cursor-prompt.json', config);
```

### Helper Registration

```typescript
// Register custom helper
engine.helpers.register('formatCurrency', (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
});

// Use in template
const template = 'Price: {{formatCurrency amount "EUR"}}';
const result = await engine.render(template, { amount: 29.99 });
// → "Price: €29.99"
```

### Partial Templates

```typescript
// Register partial
engine.registerPartial('userCard', `
**{{name}}**
Email: {{email}}
Status: {{#if active}}Active{{else}}Inactive{{/if}}
`);

// Use partial in template
const template = `
# Team Members
{{#each users}}
{{> userCard}}
---
{{/each}}
`;
```

## Integration Examples

### Express.js Integration

```typescript
import express from 'express';
import { TemplateService } from 'cursor-prompt';

const app = express();
const templateService = new TemplateService();

app.get('/generate/:template', async (req, res) => {
  try {
    const { template } = req.params;
    const variables = req.query;
    
    const templatePath = await templateService.findTemplate(template);
    if (!templatePath) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    const templateObj = await templateService.loadTemplate(templatePath);
    const result = await templateService.renderTemplate(templateObj, variables);
    
    res.json({ content: result.files[0].content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Build Tool Integration

```typescript
import { TemplateEngine } from 'cursor-prompt';
import { readFileSync, writeFileSync } from 'fs';

async function generateFromTemplate(templatePath: string, outputPath: string, variables: Record<string, unknown>) {
  const engine = new TemplateEngine();
  const template = readFileSync(templatePath, 'utf-8');
  
  const result = await engine.render(template, variables);
  writeFileSync(outputPath, result);
  
  console.log(`Generated ${outputPath} from ${templatePath}`);
}

// Usage in build script
await generateFromTemplate(
  './templates/component.tsx',
  './src/components/Button.tsx',
  { name: 'Button', props: ['onClick', 'children'] }
);
```

## Performance Considerations

### Caching

Templates and partials are automatically cached. For high-frequency rendering:

```typescript
// Pre-load frequently used templates
const frequentTemplates = ['feature', 'component', 'service'];
for (const name of frequentTemplates) {
  const path = await service.findTemplate(name);
  if (path) await service.loadTemplate(path);
}
```

### Memory Management

```typescript
// Clear caches when needed
engine.clearCache();

// Or create new instance for isolation
const isolatedEngine = new TemplateEngine();
```

### Batch Processing

```typescript
// Process multiple templates efficiently
const templates = ['template1', 'template2', 'template3'];
const results = await Promise.all(
  templates.map(name => 
    service.renderTemplate(name, variables)
  )
);
```
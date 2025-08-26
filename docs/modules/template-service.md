# Template Service Module

## Purpose
The Template Service module manages template discovery, loading, saving, and metadata operations. It provides a high-level interface for working with templates across the filesystem and handles template lifecycle management.

## Dependencies
- Internal: File System Interface, Template Validator, Config Service
- External: glob, fs-extra, js-yaml

## Key Components

### TemplateService
Core service for template management operations.

#### Public API
- `discoverTemplates(): Promise<Template[]>` - Discovers all available templates
- `loadTemplate(name: string): Promise<Template>` - Loads a specific template
- `saveTemplate(name: string, content: string): Promise<void>` - Saves template content
- `deleteTemplate(name: string): Promise<void>` - Deletes a template
- `getTemplateInfo(name: string): TemplateInfo` - Gets template metadata
- `validateTemplate(name: string): Promise<ValidationResult>` - Validates template
- `importTemplate(path: string): Promise<Template>` - Imports external template
- `exportTemplate(name: string, outputPath: string): Promise<void>` - Exports template

### TemplateRegistry (Marketplace Integration)
Manages template registration and marketplace interactions.

#### Public API
- `register(template: Template): Promise<void>` - Registers template in marketplace
- `search(query: string): Promise<Template[]>` - Searches marketplace
- `install(templateId: string): Promise<void>` - Installs from marketplace
- `update(templateId: string): Promise<void>` - Updates installed template
- `getPopular(): Promise<Template[]>` - Gets popular templates
- `getByAuthor(authorId: string): Promise<Template[]>` - Gets templates by author

## Usage Examples

### Discovering Templates
```typescript
import { TemplateService } from './services/template.service';

const service = new TemplateService();
const templates = await service.discoverTemplates();

templates.forEach(template => {
  console.log(`Found: ${template.name} - ${template.description}`);
});
```

### Loading and Using Templates
```typescript
const service = new TemplateService();
const template = await service.loadTemplate('bug-fix');

// Access template properties
console.log('Template:', template.name);
console.log('Category:', template.category);
console.log('Variables:', template.variables);
console.log('Content:', template.content);
```

### Saving Custom Templates
```typescript
const service = new TemplateService();

const content = `
# Custom Template
{{#if description}}
Description: {{description}}
{{/if}}

Please implement the following:
{{#each features}}
- {{this}}
{{/each}}
`;

await service.saveTemplate('custom-feature', content);
```

### Template Import/Export
```typescript
// Import external template
const imported = await service.importTemplate('/path/to/template.md');
console.log('Imported:', imported.name);

// Export template for sharing
await service.exportTemplate('my-template', './exports/my-template.zip');
```

### Marketplace Operations
```typescript
import { TemplateRegistry } from './marketplace/core/template.registry';

const registry = new TemplateRegistry();

// Search marketplace
const results = await registry.search('typescript testing');

// Install template
await registry.install('awesome-testing-template');

// Get popular templates
const popular = await registry.getPopular();
popular.forEach(t => console.log(`${t.name}: ${t.downloads} downloads`));
```

## Configuration
Template service configuration in `.cursorprompt.json`:

```json
{
  "templatesDir": ".cursor/templates",
  "templatePatterns": ["*.md", "*.yaml", "*.yml"],
  "marketplace": {
    "enabled": true,
    "apiUrl": "https://api.cursor-prompt.com",
    "cacheDir": ".cursor/.cache",
    "autoUpdate": true
  },
  "discovery": {
    "recursive": true,
    "maxDepth": 5,
    "excludeDirs": ["node_modules", ".git", "dist"]
  }
}
```

## Template Structure

### File-based Template
```markdown
---
name: feature-template
version: 1.0.0
description: Feature implementation template
category: development
tags: [feature, implementation]
variables:
  - name: feature_name
    type: string
    required: true
  - name: complexity
    type: choice
    choices: [simple, medium, complex]
---

# Feature: {{feature_name}}

Implementation template content...
```

### YAML Template
```yaml
name: advanced-template
version: 2.0.0
extends: base-template
description: Advanced template with inheritance

variables:
  project:
    type: string
    default: my-project
  framework:
    type: choice
    choices: [react, vue, angular]

includes:
  - condition: ${framework === 'react'}
    path: ./react-specifics.yaml

content: |
  # {{project}} Template
  Framework: {{framework}}
  ...
```

## Error Handling
Common errors and their handling:

```typescript
try {
  const template = await service.loadTemplate('non-existent');
} catch (error) {
  if (error.code === 'TEMPLATE_NOT_FOUND') {
    console.error('Template not found');
  } else if (error.code === 'INVALID_TEMPLATE') {
    console.error('Template validation failed:', error.details);
  }
}
```

## Security Considerations
- Path traversal prevention in template loading
- Sanitization of template names
- Validation of external templates before import
- Secure marketplace API communications
- Template signature verification for marketplace templates

## Performance Notes
- Template discovery results are cached
- Lazy loading of template content
- Parallel template loading for bulk operations
- Optimized file watching for template changes
- Incremental template validation

## Related Documentation
- [Template Engine](./template-engine.md) - Template processing
- [Template Validator](./template-validator.md) - Validation logic
- [Marketplace Service](./marketplace-service.md) - Marketplace operations
- [Configuration](../CONFIGURATION.md) - Configuration options
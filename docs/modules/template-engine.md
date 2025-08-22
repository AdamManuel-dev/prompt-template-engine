# Template Engine Module

Core template processing engine for the Cursor Prompt Template Engine.

## Overview

The Template Engine is responsible for parsing and rendering templates with variable substitution, conditional logic, iteration, and include directives. It implements a Handlebars-style syntax with additional features specific to prompt generation.

## Location

`/src/core/template-engine.ts`

## Key Features

- Variable substitution with nested object support
- Conditional blocks (`{{#if}}`, `{{#unless}}`)
- Iteration blocks (`{{#each}}`)
- Template includes with circular dependency detection
- Flexible context resolution
- Performance optimized rendering

## Public API

### Class: TemplateEngine

```typescript
export class TemplateEngine {
  async render(template: string, context: TemplateContext): Promise<string>
  async renderFile(filePath: string, context: TemplateContext): Promise<string>
}
```

### Interface: TemplateContext

```typescript
export interface TemplateContext {
  [key: string]: unknown;
}
```

## Methods

### render(template, context)

Renders a template string with the provided context variables.

**Parameters:**
- `template: string` - The template content to render
- `context: TemplateContext` - Object containing variables for substitution

**Returns:** `Promise<string>` - The rendered template

**Example:**
```typescript
const engine = new TemplateEngine();
const result = await engine.render(
  'Hello {{name}}, you have {{count}} messages',
  { name: 'Alice', count: 5 }
);
// Result: "Hello Alice, you have 5 messages"
```

### renderFile(filePath, context)

Renders a template from a file.

**Parameters:**
- `filePath: string` - Path to the template file
- `context: TemplateContext` - Object containing variables

**Returns:** `Promise<string>` - The rendered template

## Template Syntax

### Variables

Basic variable substitution:
```handlebars
{{variableName}}
{{user.name}}
{{items.0.title}}
```

### Conditionals

If blocks:
```handlebars
{{#if condition}}
  Content when true
{{/if}}

{{#unless condition}}
  Content when false
{{/unless}}
```

### Iteration

Each loops:
```handlebars
{{#each items}}
  Item: {{this}}
{{/each}}

{{#each users}}
  Name: {{this.name}}
  Email: {{this.email}}
{{/each}}
```

### Includes

Include other templates:
```handlebars
{{#include "partials/header.md"}}
{{#include "./relative/path.md"}}
```

## Internal Implementation

### Variable Resolution

The engine uses a sophisticated variable resolution system:

1. Direct property access
2. Nested object navigation (dot notation)
3. Array index access
4. Special variables (`@root`, `@index`)

### Processing Order

1. Process includes (recursive with circular detection)
2. Process conditional blocks
3. Process iteration blocks
4. Process variable substitutions

### Performance Optimizations

- Regex patterns pre-compiled
- Template caching for includes
- Lazy evaluation of conditionals
- Minimal string allocations

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Circular dependency detected` | Template includes itself | Remove circular reference |
| `Maximum include depth exceeded` | Too many nested includes | Reduce nesting or increase limit |
| `Template file not found` | Include path invalid | Check file path |
| `Invalid template syntax` | Malformed tags | Validate template syntax |

### Error Recovery

The engine provides graceful degradation:
- Missing variables leave placeholders unchanged
- Failed includes show error message
- Invalid syntax preserves original text

## Configuration

### Options

```typescript
interface TemplateEngineOptions {
  maxIncludeDepth?: number;  // Default: 10
  throwOnMissingVar?: boolean;  // Default: false
  trimWhitespace?: boolean;  // Default: false
}
```

## Usage Examples

### Basic Template

```typescript
const template = `
# Bug Report

**Error:** {{error}}
**Location:** {{file}}:{{line}}

{{#if stackTrace}}
## Stack Trace
\`\`\`
{{stackTrace}}
\`\`\`
{{/if}}
`;

const result = await engine.render(template, {
  error: 'Undefined variable',
  file: 'app.js',
  line: 42,
  stackTrace: 'Error: ...'
});
```

### Complex Template with Iteration

```typescript
const template = `
# Project Files

{{#each files}}
## {{this.name}}
- Size: {{this.size}} bytes
- Modified: {{this.modified}}

{{#if this.hasErrors}}
**Errors found!**
{{/if}}
{{/each}}
`;

const result = await engine.render(template, {
  files: [
    { name: 'app.js', size: 1024, modified: '2024-01-01' },
    { name: 'test.js', size: 512, modified: '2024-01-02', hasErrors: true }
  ]
});
```

### Template with Includes

```typescript
const template = `
{{#include "templates/header.md"}}

# Main Content

{{content}}

{{#include "templates/footer.md"}}
`;

const result = await engine.render(template, {
  content: 'This is the main content'
});
```

## Testing

The Template Engine has comprehensive test coverage:

```bash
# Run tests
npm test -- template-engine

# Test files
tests/core/template-engine.test.ts
```

## Performance Benchmarks

| Operation | Time | Complexity |
|-----------|------|------------|
| Simple variable | <1ms | O(n) |
| Conditional block | <2ms | O(n) |
| Each iteration (10 items) | <5ms | O(n*m) |
| Include processing | <10ms | O(n) |
| Large template (1000 lines) | <50ms | O(n) |

## Best Practices

1. **Use specific variable names** to avoid conflicts
2. **Limit include depth** for performance
3. **Validate templates** before rendering
4. **Cache rendered templates** when possible
5. **Handle missing variables** gracefully

## Dependencies

- Node.js fs module (file operations)
- Node.js path module (path resolution)

## Related Modules

- [Template Validator](./template-validator.md) - Syntax validation
- [Template Service](./template-service.md) - Template management
- [Context Aggregator](./context-aggregator.md) - Context preparation

---

*Module Version: 1.0.0 | Last Updated: 2025-08-22*
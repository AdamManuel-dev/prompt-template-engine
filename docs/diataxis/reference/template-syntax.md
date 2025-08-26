# Template Syntax Reference

Complete language specification for the Cursor Prompt Template Engine template system.

## Overview

Templates use Handlebars-inspired syntax with enhanced features for conditional logic, loops, includes, helpers, and transformations.

## File Formats

Templates can be written in multiple formats:

| Format | Extension | Content Type |
|--------|-----------|--------------|
| Markdown | `.md` | Markdown with template syntax |
| YAML | `.yaml`, `.yml` | YAML with template content |
| JSON | `.json` | JSON template configuration |
| Text | `.txt` | Plain text with template syntax |

## Basic Syntax

### Variable Substitution

**Syntax:** `{{variable}}`

**Description:** Substitutes variable value from context.

**Examples:**
```handlebars
{{name}}                    # Simple variable
{{user.email}}              # Dot notation
{{items[0]}}               # Array access
{{config.database.host}}   # Nested object
```

**Context Resolution:**
- Simple variables: `{{name}}` → context.name
- Dot notation: `{{user.name}}` → context.user.name
- Array access: `{{items[0]}}` → context.items[0]
- Mixed: `{{users[0].profile.name}}` → context.users[0].profile.name

## Control Structures

### Conditional Blocks

#### If Blocks

**Syntax:**
```handlebars
{{#if condition}}
  content when true
{{/if}}
```

**With Else:**
```handlebars
{{#if condition}}
  content when true
{{else}}
  content when false
{{/if}}
```

**Nested Conditions:**
```handlebars
{{#if user}}
  {{#if user.active}}
    Active user: {{user.name}}
  {{else}}
    Inactive user: {{user.name}}
  {{/if}}
{{else}}
  No user found
{{/if}}
```

#### Unless Blocks

**Syntax:**
```handlebars
{{#unless condition}}
  content when false
{{/unless}}
```

**With Else:**
```handlebars
{{#unless condition}}
  content when false
{{else}}
  content when true
{{/unless}}
```

### Truthiness Rules

Values are considered truthy/falsy according to these rules:

| Value | Truthy |
|-------|--------|
| `true` | ✅ |
| `false` | ❌ |
| `"string"` (non-empty) | ✅ |
| `""` (empty string) | ❌ |
| `42` (non-zero number) | ✅ |
| `0` | ❌ |
| `[1, 2, 3]` (non-empty array) | ✅ |
| `[]` (empty array) | ❌ |
| `{key: "value"}` (non-empty object) | ✅ |
| `{}` (empty object) | ❌ |
| `null` | ❌ |
| `undefined` | ❌ |

### Iteration Blocks

#### Each Blocks

**Array Iteration:**
```handlebars
{{#each items}}
  {{@index}}: {{this}}
{{/each}}
```

**Object Iteration:**
```handlebars
{{#each config}}
  {{@key}}: {{this}}
{{/each}}
```

**With Else (Empty Collections):**
```handlebars
{{#each items}}
  Item: {{this}}
{{else}}
  No items found
{{/each}}
```

**Context Variables:**

| Variable | Type | Description |
|----------|------|-------------|
| `this` | any | Current item value |
| `@index` | number | Zero-based index |
| `@first` | boolean | True for first item |
| `@last` | boolean | True for last item |
| `@key` | string | Object key (object iteration only) |

**Nested Loops:**
```handlebars
{{#each categories}}
  ## {{name}}
  {{#each items}}
    - {{this}} (category: {{../name}})
  {{/each}}
{{/each}}
```

**Complex Example:**
```handlebars
{{#each users}}
  {{#if @first}}
  # User List
  {{/if}}
  
  {{@index}}. {{name}} ({{email}})
  {{#each roles}}
    - Role: {{this}}
  {{/each}}
  
  {{#if @last}}
  Total: {{@../length}} users
  {{/if}}
{{else}}
  No users found.
{{/each}}
```

## File Operations

### Include Directive

**Syntax:** `{{#include "path/to/file"}}`

**Description:** Includes and processes external template files.

**Examples:**
```handlebars
{{#include "partials/header.md"}}

Content here...

{{#include "partials/footer.md"}}
```

**Path Resolution:**
- Relative paths: Resolved from template location
- Absolute paths: Used as-is
- Extensions: Optional (searches common extensions)

**Recursive Includes:**
- Maximum depth: 10 levels
- Circular dependency detection
- Error handling for missing files

**Conditional Includes:**
```handlebars
{{#if includeHeader}}
  {{#include "partials/header.md"}}
{{/if}}
```

## Helper Functions

### Built-in Helpers

#### String Helpers

| Helper | Syntax | Description |
|--------|--------|-------------|
| `capitalize` | `{{capitalize name}}` | Capitalizes first letter |
| `uppercase` | `{{uppercase text}}` | Converts to uppercase |
| `lowercase` | `{{lowercase text}}` | Converts to lowercase |
| `trim` | `{{trim text}}` | Removes whitespace |
| `split` | `{{split text ","}}` | Splits string by delimiter |
| `join` | `{{join array ","}}` | Joins array with delimiter |
| `replace` | `{{replace text "old" "new"}}` | Replaces text |

#### Date Helpers

| Helper | Syntax | Description |
|--------|--------|-------------|
| `now` | `{{now}}` | Current timestamp |
| `date` | `{{date timestamp}}` | Formats date |
| `formatDate` | `{{formatDate date "YYYY-MM-DD"}}` | Custom date format |

#### Array Helpers

| Helper | Syntax | Description |
|--------|--------|-------------|
| `length` | `{{length array}}` | Array length |
| `first` | `{{first array}}` | First element |
| `last` | `{{last array}}` | Last element |
| `slice` | `{{slice array 0 3}}` | Array slice |
| `sort` | `{{sort array}}` | Sorts array |

#### Math Helpers

| Helper | Syntax | Description |
|--------|--------|-------------|
| `add` | `{{add a b}}` | Addition |
| `subtract` | `{{subtract a b}}` | Subtraction |
| `multiply` | `{{multiply a b}}` | Multiplication |
| `divide` | `{{divide a b}}` | Division |
| `round` | `{{round number}}` | Round number |

#### Conditional Helpers

| Helper | Syntax | Description |
|--------|--------|-------------|
| `eq` | `{{eq a b}}` | Equality check |
| `ne` | `{{ne a b}}` | Not equal |
| `lt` | `{{lt a b}}` | Less than |
| `gt` | `{{gt a b}}` | Greater than |
| `and` | `{{and a b}}` | Logical AND |
| `or` | `{{or a b}}` | Logical OR |
| `not` | `{{not value}}` | Logical NOT |

### Helper Usage

**Simple Call:**
```handlebars
{{capitalize "hello world"}}  # → "Hello world"
```

**Variable Arguments:**
```handlebars
{{capitalize name}}           # → Uses variable
{{join items ", "}}          # → Joins with comma
```

**Nested Helpers:**
```handlebars
{{capitalize (first names)}} # → Capitalize first name
{{uppercase (join tags " ")}} # → Join and uppercase
```

**Function Call Syntax:**
```handlebars
{{capitalize(firstName)}}
{{join(items, ", ")}}
{{formatDate(createdAt, "YYYY-MM-DD")}}
```

**With Conditionals:**
```handlebars
{{#if (eq status "active")}}
  User is active
{{/if}}
```

## Variable Transformations (Pipes)

### Syntax

**Basic Pipe:**
```handlebars
{{variable|transform}}
```

**Chained Pipes:**
```handlebars
{{variable|transform1|transform2|transform3}}
```

**With Arguments:**
```handlebars
{{text|replace("old", "new")|uppercase}}
```

### Built-in Transforms

| Transform | Syntax | Description |
|-----------|--------|-------------|
| `upper` | `{{text\|upper}}` | Uppercase |
| `lower` | `{{text\|lower}}` | Lowercase |
| `title` | `{{text\|title}}` | Title case |
| `trim` | `{{text\|trim}}` | Remove whitespace |
| `reverse` | `{{text\|reverse}}` | Reverse string |
| `length` | `{{array\|length}}` | Get length |
| `json` | `{{object\|json}}` | JSON stringify |
| `default` | `{{value\|default("fallback")}}` | Default value |

### Examples

```handlebars
{{name|upper|trim}}                    # Chain transforms
{{description|default("No description")}} # Fallback value
{{tags|join(", ")|upper}}              # Join then uppercase
{{user.email|lower|trim}}              # Clean email
```

## Partials

### Registration

**From String:**
```typescript
engine.registerPartial('header', '# {{title}}\n\n{{description}}');
```

**From File:**
```typescript
engine.registerPartialFromFile('footer', './partials/footer.md');
```

**Directory Loading:**
```typescript
engine.loadPartials('./partials');
```

### Usage

**Syntax:** `{{> partialName}}`

**With Context:**
```handlebars
{{> header title="Welcome" description="Getting started"}}
```

**Current Context:**
```handlebars
{{#each users}}
  {{> userCard}}  # Uses current user context
{{/each}}
```

## Template Metadata

### YAML Frontmatter

```yaml
---
name: feature-template
version: 1.0.0
description: Template for new features
author: John Doe
tags: [feature, development]
variables:
  name:
    type: string
    required: true
    description: Feature name
  type:
    type: choice
    choices: [component, service, utility]
    default: component
---

# Feature: {{name}}

This {{type}} implements {{description}}.
```

### JSON Configuration

```json
{
  "name": "feature-template",
  "version": "1.0.0",
  "description": "Template for new features",
  "content": "# Feature: {{name}}\n\nThis {{type}} implements {{description}}.",
  "variables": {
    "name": {
      "type": "string",
      "required": true,
      "description": "Feature name"
    },
    "type": {
      "type": "choice",
      "choices": ["component", "service", "utility"],
      "default": "component"
    }
  }
}
```

## Variable Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text value | `"Hello World"` |
| `number` | Numeric value | `42`, `3.14` |
| `boolean` | True/false | `true`, `false` |
| `choice` | Predefined options | `["small", "medium", "large"]` |
| `array` | List of values | `["item1", "item2"]` |
| `object` | Key-value pairs | `{"key": "value"}` |

## Comments

### Template Comments

**Syntax:** `{{!-- comment --}}`

**Examples:**
```handlebars
{{!-- This is a comment --}}
{{!-- 
Multi-line comment
spanning several lines
--}}
```

**Conditional Comments:**
```handlebars
{{!-- Only show in debug mode --}}
{{#if debug}}
  Debug info: {{debugData}}
{{/if}}
```

## Context Variables

### Special Variables

| Variable | Description | Availability |
|----------|-------------|--------------|
| `@index` | Current index in loop | Inside `#each` blocks |
| `@first` | First iteration | Inside `#each` blocks |
| `@last` | Last iteration | Inside `#each` blocks |
| `@key` | Object key | Inside `#each` object iteration |
| `this` | Current item | Inside `#each` blocks |
| `@root` | Root context | Anywhere |
| `../` | Parent context | Inside nested blocks |

### Context Access

**Current Context:**
```handlebars
{{name}}        # Current context
{{this.name}}   # Explicit current context
```

**Parent Context:**
```handlebars
{{#each items}}
  {{../title}} - {{name}}  # Parent title, current name
{{/each}}
```

**Root Context:**
```handlebars
{{#each categories}}
  {{#each items}}
    {{@root.appName}} - {{../../title}} - {{name}}
  {{/each}}
{{/each}}
```

## Error Handling

### Missing Variables

**Behavior:** Missing variables render as empty string

**Example:**
```handlebars
{{existingVar}}    # → "value"
{{missingVar}}     # → ""
```

### Invalid Syntax

**Unclosed Blocks:**
```handlebars
{{#if condition}}
  content
# Missing {{/if}} - throws error
```

**Invalid Helpers:**
```handlebars
{{unknownHelper}}  # → renders as "{{unknownHelper}}"
```

### File Errors

**Missing Includes:**
```handlebars
{{#include "missing.md"}}  # → throws error
```

## Performance Considerations

### Best Practices

- Use helpers instead of complex logic
- Limit nesting depth (recommended: < 5 levels)
- Cache frequently used partials
- Avoid large datasets in templates
- Use includes sparingly (file I/O overhead)

### Optimization

- Templates are compiled and cached
- Variables resolved once per render
- Includes cached by file path
- Helpers memoized for repeated calls

## Syntax Limitations

### Restrictions

- No JavaScript expressions in templates
- No template-defined functions
- No variable assignment within templates
- No dynamic helper registration
- Maximum include depth: 10 levels

### Workarounds

**Complex Logic:** Use helpers
```typescript
// Register helper
engine.helpers.register('isEven', (n) => n % 2 === 0);
```

```handlebars
{{#if (isEven number)}}
  Even number
{{/if}}
```

**Dynamic Content:** Use context manipulation
```typescript
// Prepare context
const context = {
  items: data.map((item, index) => ({
    ...item,
    isEven: index % 2 === 0
  }))
};
```

## Regular Expressions

### Patterns Used Internally

| Pattern | Usage |
|---------|-------|
| `/\{\{(\s*[@\w.[\]]+\s*)\}\}/g` | Variable matching |
| `/\{\{#if\s+([^}]+)\s*\}\}/g` | If block start |
| `/\{\{#each\s+([\w.]+)\s*\}\}/g` | Each block start |
| `/\{\{#include\s+["']([^"']+)["']\s*\}\}/g` | Include directive |
| `/\{\{([^|}]+\|[^}]+)\}\}/g` | Transform pipes |
# Template Syntax Reference

Complete guide to the template language used by the Cursor Prompt Template Engine.

## Table of Contents

- [Basic Syntax](#basic-syntax)
- [Variables](#variables)
- [Conditionals](#conditionals)
- [Iteration](#iteration)
- [Includes](#includes)
- [Special Variables](#special-variables)
- [Advanced Patterns](#advanced-patterns)
- [Best Practices](#best-practices)

## Basic Syntax

Templates use Handlebars-style double curly braces for dynamic content:

```handlebars
{{variable}}
```

Everything outside of `{{}}` is treated as literal text.

## Variables

### Simple Variables

Basic variable substitution:

```handlebars
Hello {{name}}!
Your email is {{email}}.
```

Context:
```json
{
  "name": "Alice",
  "email": "alice@example.com"
}
```

Result:
```
Hello Alice!
Your email is alice@example.com.
```

### Nested Objects

Access nested properties with dot notation:

```handlebars
User: {{user.name}}
Email: {{user.contact.email}}
City: {{user.address.city}}
```

Context:
```json
{
  "user": {
    "name": "Bob",
    "contact": {
      "email": "bob@example.com"
    },
    "address": {
      "city": "New York"
    }
  }
}
```

### Array Access

Access array elements by index:

```handlebars
First item: {{items.0}}
Second item: {{items.1}}
Last name: {{users.0.name}}
```

Context:
```json
{
  "items": ["apple", "banana", "orange"],
  "users": [
    { "name": "Alice" },
    { "name": "Bob" }
  ]
}
```

### Missing Variables

Missing variables are left as-is:

```handlebars
Hello {{unknownVariable}}!
```

Result:
```
Hello {{unknownVariable}}!
```

## Conditionals

### If Blocks

Show content conditionally:

```handlebars
{{#if isLoggedIn}}
  Welcome back, {{username}}!
{{/if}}

{{#if error}}
  Error: {{error.message}}
  Code: {{error.code}}
{{/if}}
```

### Unless Blocks

Show content when condition is false:

```handlebars
{{#unless hasPermission}}
  Access denied. Please login.
{{/unless}}

{{#unless items}}
  No items found.
{{/unless}}
```

### Nested Conditionals

Conditionals can be nested:

```handlebars
{{#if user}}
  {{#if user.isAdmin}}
    Admin panel available
  {{/if}}
  {{#unless user.isVerified}}
    Please verify your email
  {{/unless}}
{{/if}}
```

### Truthy/Falsy Values

Falsy values:
- `false`
- `null`
- `undefined`
- `0`
- `""`
- `[]` (empty array)
- `{}` (empty object)

Everything else is truthy.

## Iteration

### Each Loops

Iterate over arrays:

```handlebars
## Files:
{{#each files}}
- {{this}}
{{/each}}
```

Context:
```json
{
  "files": ["app.js", "index.js", "utils.js"]
}
```

Result:
```
## Files:
- app.js
- index.js
- utils.js
```

### Object Properties in Loops

Access object properties:

```handlebars
## Users:
{{#each users}}
- Name: {{this.name}}
  Email: {{this.email}}
  Role: {{this.role}}
{{/each}}
```

Context:
```json
{
  "users": [
    { "name": "Alice", "email": "alice@example.com", "role": "admin" },
    { "name": "Bob", "email": "bob@example.com", "role": "user" }
  ]
}
```

### Nested Loops

Loops can be nested:

```handlebars
{{#each categories}}
## {{this.name}}
{{#each this.items}}
  - {{this.title}}: {{this.description}}
{{/each}}
{{/each}}
```

### Loop with Conditionals

Combine loops with conditionals:

```handlebars
## Active Users:
{{#each users}}
{{#if this.isActive}}
- {{this.name}} ({{this.email}})
{{/if}}
{{/each}}
```

## Includes

### Basic Include

Include another template file:

```handlebars
{{#include "templates/header.md"}}

Main content here

{{#include "templates/footer.md"}}
```

### Relative Paths

Use relative paths from current template:

```handlebars
{{#include "./partials/section.md"}}
{{#include "../shared/common.md"}}
```

### Include with Context

Included templates inherit the current context:

Main template:
```handlebars
{{#include "user-card.md"}}
```

user-card.md:
```handlebars
Name: {{user.name}}
Email: {{user.email}}
```

### Circular Include Protection

The engine prevents circular includes:

```handlebars
<!-- template-a.md -->
{{#include "template-b.md"}}

<!-- template-b.md -->
{{#include "template-a.md"}}  <!-- Error: Circular dependency -->
```

## Special Variables

### System Variables

Available in all templates:

- `{{@timestamp}}` - Current date/time
- `{{@date}}` - Current date
- `{{@time}}` - Current time
- `{{@cwd}}` - Current working directory
- `{{@user}}` - System username
- `{{@platform}}` - Operating system

### Git Variables

When git context is included:

- `{{@git.branch}}` - Current branch
- `{{@git.hash}}` - Current commit hash
- `{{@git.author}}` - Last commit author
- `{{@git.message}}` - Last commit message

### Loop Variables

Inside `{{#each}}` blocks:

- `{{@index}}` - Current iteration index (0-based)
- `{{@first}}` - True if first iteration
- `{{@last}}` - True if last iteration
- `{{@key}}` - Current key (for object iteration)

Example:
```handlebars
{{#each items}}
  {{@index}}. {{this}}{{#unless @last}},{{/unless}}
{{/each}}
```

## Advanced Patterns

### Complex Conditionals

Multiple conditions:

```handlebars
{{#if user}}
  {{#if user.isActive}}
    {{#if user.hasSubscription}}
      Premium features enabled
    {{/if}}
  {{/if}}
{{/if}}
```

### Default Values

Provide fallbacks for missing values:

```handlebars
Name: {{#if name}}{{name}}{{/if}}{{#unless name}}Unknown{{/unless}}

<!-- Or using nested approach -->
{{#if user.name}}
  Hello {{user.name}}
{{/if}}
{{#unless user.name}}
  Hello Guest
{{/unless}}
```

### Conditional Classes

Dynamic content based on conditions:

```handlebars
Status: {{#if isActive}}✅ Active{{/if}}{{#unless isActive}}❌ Inactive{{/unless}}

Priority: {{#if priority}}
  {{#if priority.high}}🔴 High{{/if}}
  {{#if priority.medium}}🟡 Medium{{/if}}
  {{#if priority.low}}🟢 Low{{/if}}
{{/if}}
```

### Template Composition

Build complex templates from parts:

```handlebars
<!-- main.md -->
{{#include "header.md"}}

{{#if showIntro}}
  {{#include "intro.md"}}
{{/if}}

{{#each sections}}
  {{#include "section.md"}}
{{/each}}

{{#include "footer.md"}}
```

## Best Practices

### 1. Use Meaningful Variable Names

Good:
```handlebars
{{user.firstName}} {{user.lastName}}
{{error.message}}
{{config.apiUrl}}
```

Bad:
```handlebars
{{u.fn}} {{u.ln}}
{{e.m}}
{{c.url}}
```

### 2. Structure Templates Logically

```handlebars
<!-- 1. Header/Title -->
# {{title}}

<!-- 2. Metadata -->
Author: {{author}}
Date: {{date}}

<!-- 3. Main Content -->
{{#if content}}
{{content}}
{{/if}}

<!-- 4. Additional Sections -->
{{#each sections}}
## {{this.title}}
{{this.body}}
{{/each}}

<!-- 5. Footer -->
{{#include "footer.md"}}
```

### 3. Handle Missing Data Gracefully

```handlebars
{{#if data}}
  <!-- Show data -->
  {{#each data.items}}
    - {{this}}
  {{/each}}
{{/if}}
{{#unless data}}
  No data available
{{/unless}}
```

### 4. Use Comments for Clarity

```handlebars
<!-- User information section -->
{{#if user}}
  <!-- Show premium features for subscribed users -->
  {{#if user.isPremium}}
    Premium features...
  {{/if}}
{{/if}}
```

### 5. Avoid Deep Nesting

Instead of:
```handlebars
{{#if a}}{{#if b}}{{#if c}}{{#if d}}
  Deep nesting is hard to read
{{/if}}{{/if}}{{/if}}{{/if}}
```

Consider:
```handlebars
{{#if showContent}}
  Content here
{{/if}}
```

### 6. Consistent Formatting

```handlebars
<!-- Good: Consistent indentation -->
{{#if condition}}
  {{#each items}}
    - {{this.name}}
  {{/each}}
{{/if}}

<!-- Bad: Inconsistent -->
{{#if condition}}
{{#each items}}
- {{this.name}}
  {{/each}}
  {{/if}}
```

## Common Patterns

### Error Messages

```handlebars
{{#if error}}
## ❌ Error

**Message**: {{error.message}}
**Code**: {{error.code}}

{{#if error.stack}}
### Stack Trace
\`\`\`
{{error.stack}}
\`\`\`
{{/if}}
{{/if}}
```

### File Listings

```handlebars
## Files Modified

{{#each files}}
### {{this.path}}

**Status**: {{this.status}}
**Lines Changed**: +{{this.additions}} -{{this.deletions}}

{{#if this.diff}}
\`\`\`diff
{{this.diff}}
\`\`\`
{{/if}}
{{/each}}
```

### Task Lists

```handlebars
## Tasks

{{#each tasks}}
- [{{#if this.completed}}x{{/if}}{{#unless this.completed}} {{/unless}}] {{this.title}}
  {{#if this.description}}
  {{this.description}}
  {{/if}}
{{/each}}
```

## Escaping

To output literal `{{}}`:

```handlebars
Use \{{variable\}} to show curly braces
```

Result:
```
Use {{variable}} to show curly braces
```

---

*Syntax Version: 1.0.0 | Last Updated: 2025-08-22*
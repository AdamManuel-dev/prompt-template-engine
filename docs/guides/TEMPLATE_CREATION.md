# Template Creation Guide

A comprehensive guide to creating powerful, reusable templates for the Cursor Prompt Template Engine.

## Table of Contents
- [Getting Started](#getting-started)
- [Template Anatomy](#template-anatomy)
- [Variable System](#variable-system)
- [Control Flow](#control-flow)
- [Advanced Features](#advanced-features)
- [YAML Templates](#yaml-templates)
- [Best Practices](#best-practices)
- [Testing Templates](#testing-templates)
- [Publishing Templates](#publishing-templates)

## Getting Started

### Creating Your First Template

1. **Create template directory**:
```bash
mkdir -p .cursor/templates
```

2. **Create a simple template**:
```bash
cat > .cursor/templates/my-first-template.md << 'EOF'
# Task: {{task_name}}

## Description
{{description}}

## Requirements
{{#each requirements}}
- {{this}}
{{/each}}

Please implement the above requirements.
EOF
```

3. **Test your template**:
```bash
cursor-prompt generate my-first-template \
  --variables '{
    "task_name": "Add User Authentication",
    "description": "Implement JWT-based authentication",
    "requirements": ["Login endpoint", "Token validation", "Refresh tokens"]
  }'
```

## Template Anatomy

### Basic Structure
```markdown
---
# Optional front matter (YAML)
name: template-name
version: 1.0.0
description: Template description
category: development
tags: [feature, automation]
---

# Template Content

Static text and {{variables}} are processed here.

{{#if condition}}
Conditional content
{{/if}}
```

### File Naming Conventions
- Use kebab-case: `feature-request.md`, `bug-fix.md`
- Add category prefix: `debug-memory-leak.md`, `test-unit.md`
- Use `.md` for Markdown, `.yaml` for YAML templates

## Variable System

### Basic Variables
```markdown
Simple: {{variable_name}}
Nested: {{user.profile.name}}
Array: {{items.0.title}}
With default: {{name || "Anonymous"}}
```

### Variable Transformations
```markdown
# Pipes and Filters
{{name | upper}}                    # UPPERCASE
{{title | lower | trim}}           # chained
{{description | truncate:50:...}}  # with arguments
{{price | currency:USD}}           # formatting

# Built-in Transformations
{{text | upper}}                    # UPPERCASE
{{text | lower}}                    # lowercase
{{text | capitalize}}               # Capitalize First
{{text | title}}                    # Title Case
{{text | trim}}                     # Remove whitespace
{{text | truncate:20}}              # Limit length
{{number | round:2}}                # Round decimals
{{date | format:YYYY-MM-DD}}       # Format date
{{array | join:, }}                 # Join array
{{text | replace:old:new}}         # Replace text
{{text | slugify}}                  # create-slug
{{json | pretty}}                   # Format JSON
```

### Expression Support
```markdown
# Mathematical expressions
{{price * quantity + tax}}

# Conditional expressions
{{isPremium ? premiumPrice : regularPrice}}

# Nullish coalescing
{{userInput ?? defaultValue}}

# String concatenation
{{"Hello, " + userName + "!"}}

# Array operations
{{items.length}}
{{items.filter(i => i.active).length}}
```

### Environment Variables
```markdown
# Access environment variables
{{env.NODE_ENV}}
{{env.API_URL || "http://localhost:3000"}}

# System variables
{{system.timestamp}}
{{system.platform}}
{{system.cwd}}
```

## Control Flow

### Conditionals
```markdown
# If statement
{{#if hasError}}
Error: {{errorMessage}}
{{/if}}

# If-else
{{#if isLoggedIn}}
Welcome, {{username}}!
{{else}}
Please log in.
{{/if}}

# Unless (negative if)
{{#unless isProduction}}
Debug mode enabled
{{/unless}}

# Nested conditions
{{#if user}}
  {{#if user.isAdmin}}
    Admin Dashboard
  {{else}}
    User Dashboard
  {{/if}}
{{/if}}
```

### Loops
```markdown
# Basic loop
{{#each items}}
  - {{this}}
{{/each}}

# Loop with index
{{#each items}}
  {{@index}}. {{this}}
{{/each}}

# Loop with key-value
{{#each user}}
  {{@key}}: {{this}}
{{/each}}

# Nested loops
{{#each categories}}
  ## {{this.name}}
  {{#each this.items}}
    - {{this.title}}: {{this.description}}
  {{/each}}
{{/each}}
```

### Includes
```markdown
# Include another template
{{#include "partials/header.md"}}

# Include with context
{{#include "partials/component.md" context=componentData}}

# Conditional include
{{#if needsAuth}}
  {{#include "partials/auth-section.md"}}
{{/if}}
```

## Advanced Features

### Template Inheritance (YAML)
```yaml
# base-template.yaml
name: base-template
version: 1.0.0

variables:
  project_name:
    type: string
    required: true

content: |
  # Project: {{project_name}}
  {{content}}

---
# child-template.yaml
extends: ./base-template.yaml
name: feature-template

variables:
  feature_name:
    type: string
    required: true

content: |
  ## Feature: {{feature_name}}
  Implementation details...
```

### Custom Helpers
```markdown
# Register custom helper in template
{{#helper "formatCurrency"}}
  {{amount}} {{currency}}
{{/helper}}

# Use custom helper
Price: {{formatCurrency price "USD"}}
```

### Dynamic Content
```markdown
# Execute commands
{{#exec "git branch --show-current"}}

# Read files
{{#read "package.json" | json | pretty}}

# Fetch remote content
{{#fetch "https://api.example.com/data" | json}}
```

### Context Gathering
```markdown
# Automatic context variables
{{git.branch}}                    # Current git branch
{{git.status}}                     # Git status
{{git.diff}}                       # Git diff
{{files.src/index.ts}}            # File content
{{terminal.lastCommand}}          # Last terminal command
{{terminal.output}}               # Terminal output
```

## YAML Templates

### Complete YAML Template Example
```yaml
name: advanced-feature
version: 2.0.0
description: Advanced feature template with full configuration
author: your-username
license: MIT

extends: ./base-template.yaml

variables:
  feature_name:
    type: string
    required: true
    description: Name of the feature to implement
    default: new-feature
    
  complexity:
    type: choice
    choices: [simple, medium, complex]
    default: medium
    
  include_tests:
    type: boolean
    default: true
    description: Include test files
    
  components:
    type: array
    items:
      type: object
      properties:
        name:
          type: string
        type:
          type: choice
          choices: [ui, service, utility]

# Conditional includes
includes:
  - condition: ${include_tests}
    path: ./test-template.yaml
  - condition: ${complexity === 'complex'}
    path: ./complex-feature-additions.yaml

# Environment-specific variables
environments:
  development:
    variables:
      api_url:
        default: http://localhost:3000
      debug:
        default: true
  production:
    variables:
      api_url:
        default: https://api.example.com
      debug:
        default: false

# Commands to run
commands:
  pre: 
    - echo "Starting feature generation"
    - git checkout -b feature/{{feature_name}}
  post:
    - npm install
    - npm test
    - git add .

# Template content
content: |
  # Feature: {{feature_name}}
  
  Complexity: {{complexity}}
  Environment: {{env.NODE_ENV}}
  API URL: {{api_url}}
  
  ## Components
  {{#each components}}
  ### {{this.name}} ({{this.type}})
  {{#if (eq this.type "ui")}}
  ```tsx
  import React from 'react';
  
  export const {{this.name}}: React.FC = () => {
    return <div>{{this.name}} Component</div>;
  };
  ```
  {{/if}}
  {{#if (eq this.type "service")}}
  ```typescript
  export class {{this.name}}Service {
    constructor() {}
    
    // Service implementation
  }
  ```
  {{/if}}
  {{/each}}
  
  {{#if include_tests}}
  ## Test Files
  {{#include "partials/test-setup.md"}}
  {{/if}}

# Validation rules
validation:
  - rule: feature_name
    pattern: ^[a-z][a-z0-9-]*$
    message: Feature name must be kebab-case
  - rule: components
    min: 1
    max: 10
    message: Must have between 1 and 10 components
```

## Best Practices

### 1. Template Organization
```
.cursor/templates/
├── categories/
│   ├── debug/
│   │   ├── memory-leak.md
│   │   └── performance.md
│   ├── feature/
│   │   ├── api-endpoint.md
│   │   └── ui-component.md
│   └── test/
│       ├── unit-test.md
│       └── integration-test.md
├── partials/
│   ├── header.md
│   ├── footer.md
│   └── common-sections.md
└── base-templates/
    ├── base.yaml
    └── base-with-tests.yaml
```

### 2. Variable Naming
- Use descriptive names: `feature_description` not `desc`
- Use snake_case for consistency
- Group related variables: `user.name`, `user.email`
- Provide defaults for optional variables

### 3. Documentation
```markdown
---
name: template-name
description: |
  Detailed description of what this template does
  and when to use it.
  
usage: |
  cursor-prompt generate template-name \
    --variables '{"key": "value"}'
    
examples:
  - description: Basic usage
    command: cursor-prompt generate template-name
  - description: With custom variables
    command: |
      cursor-prompt generate template-name \
        --variables '{"feature": "auth"}'
---
```

### 4. Error Handling
```markdown
{{#if (not feature_name)}}
  ERROR: feature_name is required
  {{#exit 1}}
{{/if}}

{{#if (and include_tests (not test_framework))}}
  WARNING: include_tests is true but test_framework not specified
  Using default: jest
  {{test_framework = "jest"}}
{{/if}}
```

### 5. Performance Tips
- Minimize includes for frequently used templates
- Use lazy evaluation with `{{#lazy}}` for expensive operations
- Cache compiled templates with `cache: true` in metadata
- Limit file reading to necessary files only

## Testing Templates

### Local Testing
```bash
# Test with preview (no clipboard)
cursor-prompt generate my-template --preview

# Test with specific variables
cursor-prompt generate my-template \
  --variables '{"test": "value"}' \
  --preview

# Validate template syntax
cursor-prompt validate my-template --strict

# Test with different contexts
cursor-prompt generate my-template \
  --no-git \
  --no-files \
  --preview
```

### Automated Testing
```javascript
// test-template.js
const { TemplateEngine } = require('cursor-prompt');

describe('My Template', () => {
  const engine = new TemplateEngine();
  
  test('renders with required variables', async () => {
    const result = await engine.renderFile(
      '.cursor/templates/my-template.md',
      {
        feature_name: 'test-feature',
        description: 'Test description'
      }
    );
    
    expect(result).toContain('test-feature');
    expect(result).toContain('Test description');
  });
  
  test('handles missing variables', async () => {
    await expect(
      engine.renderFile('.cursor/templates/my-template.md', {})
    ).rejects.toThrow('Required variable: feature_name');
  });
});
```

## Publishing Templates

### Prepare for Publishing
1. **Add metadata**:
```yaml
# template.manifest.yaml
name: awesome-template
version: 1.0.0
author: your-username
description: Production-ready template for X
category: productivity
tags:
  - automation
  - typescript
  - testing
license: MIT
homepage: https://github.com/user/template
repository: https://github.com/user/template
```

2. **Add documentation**:
```markdown
# README.md
# Awesome Template

## Installation
cursor-prompt marketplace:install awesome-template

## Usage
cursor-prompt generate awesome-template --variables '{...}'

## Examples
[Include 3-5 real examples]

## Configuration
[Document all variables]

## Support
[How to get help]
```

3. **Test thoroughly**:
```bash
# Run validation
cursor-prompt validate awesome-template --strict

# Test all examples
./test-all-examples.sh

# Check performance
time cursor-prompt generate awesome-template --preview
```

### Publish to Marketplace
```bash
# First-time publishing
cursor-prompt marketplace:publish \
  --template awesome-template \
  --version 1.0.0

# Update existing
cursor-prompt marketplace:update awesome-template \
  --version 1.0.1 \
  --changelog "Fixed bug in variable handling"

# Check stats
cursor-prompt marketplace:info awesome-template
```

### Maintenance
- Monitor user feedback and ratings
- Respond to issues promptly
- Keep dependencies updated
- Follow semantic versioning
- Maintain backwards compatibility

## Advanced Examples

### Multi-file Generation Template
```yaml
name: full-feature
version: 1.0.0

files:
  - path: src/features/{{feature_name}}/index.ts
    content: |
      export * from './{{feature_name}}.component';
      export * from './{{feature_name}}.service';
      
  - path: src/features/{{feature_name}}/{{feature_name}}.component.tsx
    content: |
      import React from 'react';
      
      export const {{feature_name | capitalize}}Component = () => {
        return <div>{{feature_name}}</div>;
      };
      
  - path: src/features/{{feature_name}}/{{feature_name}}.service.ts
    content: |
      export class {{feature_name | capitalize}}Service {
        // Service implementation
      }
      
  - path: src/features/{{feature_name}}/{{feature_name}}.test.ts
    condition: ${include_tests}
    content: |
      describe('{{feature_name}}', () => {
        it('should work', () => {
          expect(true).toBe(true);
        });
      });
```

### Interactive Template
```yaml
name: interactive-setup
version: 1.0.0

prompts:
  - name: project_type
    message: What type of project?
    type: choice
    choices: [web, api, cli, library]
    
  - name: use_typescript
    message: Use TypeScript?
    type: boolean
    default: true
    
  - name: features
    message: Select features to include
    type: multiselect
    choices:
      - authentication
      - database
      - testing
      - docker
      - ci/cd

content: |
  # Project Setup: {{project_type}}
  
  TypeScript: {{use_typescript}}
  
  ## Features
  {{#each features}}
  - {{this}}
  {{/each}}
```

## Resources

- [Template Syntax Reference](../api/TEMPLATE_SYNTAX.md)
- [Variable Reference](../api/VARIABLES.md)
- [Plugin Development](../PLUGIN_DEVELOPMENT.md)
- [Marketplace Guidelines](../MARKETPLACE.md)
- [Examples Repository](https://github.com/cursor-prompt/templates)

---

*Happy template creating! 🚀*
# Template Management

Create, customize, and manage templates for your workflow.

## Create Template with Variables

### Basic YAML template
```yaml
# templates/my-feature.yaml
name: my-feature
description: Custom feature template
version: 1.0.0
tags: [feature, custom]

variables:
  feature_name:
    type: string
    description: Name of the feature
    required: true
  priority:
    type: choice
    choices: [low, medium, high, urgent]
    default: medium

content: |
  # Feature: {{feature_name}}
  
  Priority: {{priority}}
  
  ## Implementation
  {{#if priority == "urgent"}}
  🚨 This is urgent - implement immediately!
  {{/if}}
```

### Markdown template with frontmatter
```markdown
---
name: bug-report
description: Bug reporting template
variables:
  - bug_title: Title of the bug
  - steps: Steps to reproduce
  - expected: Expected behavior
---

# Bug: {{bug_title}}

## Steps to Reproduce
{{steps}}

## Expected Behavior
{{expected}}
```

## Template Inheritance

### Create base template
```yaml
# templates/base.yaml
name: base
variables:
  project_name:
    type: string
    default: "My Project"
  author:
    type: string
    default: "Developer"

content: |
  # {{project_name}}
  Author: {{author}}
```

### Extend base template
```yaml
# templates/feature-extended.yaml
name: feature-extended
extends: ./base.yaml
description: Feature template extending base

variables:
  feature_description:
    type: string
    required: true

content: |
  {{> base}}
  
  ## Feature Description
  {{feature_description}}
```

## Advanced Variable Types

### String with validation
```yaml
variables:
  email:
    type: string
    pattern: '^[^@]+@[^@]+\.[^@]+$'
    description: Valid email address
```

### Number with constraints
```yaml
variables:
  port:
    type: number
    min: 1000
    max: 65535
    default: 3000
```

### Array/list variables
```yaml
variables:
  features:
    type: array
    items:
      type: string
    description: List of features to implement
```

### Object variables
```yaml
variables:
  database:
    type: object
    properties:
      host:
        type: string
        default: localhost
      port:
        type: number
        default: 5432
```

## Template Metadata

### Complete metadata example
```yaml
name: comprehensive-template
version: 2.1.0
description: A comprehensive template example
author: Your Name
license: MIT
homepage: https://github.com/user/template
repository: git+https://github.com/user/template.git

tags:
  - productivity
  - automation
  - typescript

keywords:
  - development
  - template
  - cursor

# Template compatibility
engines:
  cursor-prompt: ">=0.1.0"

# Dependencies on other templates
dependencies:
  - base-template: "^1.0.0"
  - utils-template: "~2.0.0"

# Category for marketplace
category: development
```

## Conditional Logic in Templates

### Simple conditionals
```yaml
content: |
  {{#if use_typescript}}
  import type { Config } from './types';
  {{else}}
  const config = require('./config');
  {{/if}}
```

### Complex conditions
```yaml
content: |
  {{#if environment === "production" && security_enabled}}
  // Production security measures
  app.use(helmet());
  {{else if environment === "development"}}
  // Development debugging
  app.use(logger('dev'));
  {{/if}}
```

### Loops and iterations
```yaml
variables:
  apis:
    type: array
    items:
      type: object

content: |
  {{#each apis}}
  export const {{this.name}}Api = {
    url: '{{this.url}}',
    timeout: {{this.timeout}}
  };
  {{/each}}
```

## File Generation Templates

### Multi-file template
```yaml
name: component-generator
description: Generate React component with tests

variables:
  component_name:
    type: string
    required: true

files:
  - path: "components/{{component_name}}.tsx"
    content: |
      import React from 'react';
      
      interface {{component_name}}Props {
        // Props here
      }
      
      export const {{component_name}}: React.FC<{{component_name}}Props> = () => {
        return <div>{{component_name}}</div>;
      };

  - path: "components/__tests__/{{component_name}}.test.tsx"
    content: |
      import { render } from '@testing-library/react';
      import { {{component_name}} } from '../{{component_name}}';
      
      describe('{{component_name}}', () => {
        it('renders correctly', () => {
          render(<{{component_name}} />);
        });
      });
```

## Validate Templates

### Validate syntax
```bash
cursor-prompt validate templates/my-template.yaml
```

### Validate with verbose output
```bash
cursor-prompt validate templates/my-template.yaml --verbose
```

### Validate all templates in directory
```bash
cursor-prompt validate templates/ --recursive
```

### Check template dependencies
```bash
cursor-prompt validate templates/extended-template.yaml --check-deps
```

## Template Partials

### Create reusable partial
```yaml
# templates/partials/header.yaml
name: header-partial
type: partial

content: |
  # {{title || "Default Title"}}
  
  {{#if author}}
  **Author**: {{author}}
  {{/if}}
  
  {{#if date}}
  **Date**: {{date}}
  {{/if}}
```

### Use partial in main template
```yaml
# templates/document.yaml
name: document
includes:
  - ./partials/header.yaml

variables:
  title: Document title
  content: Main content

content: |
  {{> header}}
  
  ## Content
  {{content}}
```

## Environment-Specific Templates

### Development environment
```yaml
# templates/config/development.yaml
variables:
  api_url:
    default: "http://localhost:3000"
  debug:
    default: true
  log_level:
    default: "debug"
```

### Production environment
```yaml
# templates/config/production.yaml
variables:
  api_url:
    default: "https://api.production.com"
  debug:
    default: false
  log_level:
    default: "error"
```

### Environment-aware template
```yaml
name: config-template
description: Environment-aware configuration

variables:
  environment:
    type: choice
    choices: [development, production, staging]
    required: true

includes:
  - condition: "{{environment === 'development'}}"
    path: ./config/development.yaml
  - condition: "{{environment === 'production'}}"
    path: ./config/production.yaml

content: |
  # Configuration for {{environment}}
  
  API_URL={{api_url}}
  DEBUG={{debug}}
  LOG_LEVEL={{log_level}}
```

## Template Testing

### Create test data
```json
{
  "feature_name": "user authentication",
  "priority": "high",
  "files_to_modify": ["src/auth/", "src/api/auth.ts"],
  "testing_required": true
}
```

### Test template rendering
```bash
cursor-prompt generate my-template --file test-data.json --preview
```

### Automated testing in CI
```bash
#!/bin/bash
# test-templates.sh
for template in templates/*.yaml; do
  echo "Testing $template..."
  cursor-prompt validate "$template"
  cursor-prompt generate "$template" --variables '{}' --preview > /dev/null
done
```

## Template Organization

### Directory structure
```
templates/
├── core/              # Essential templates
│   ├── bug-fix.yaml
│   ├── feature.yaml
│   └── refactor.yaml
├── specialized/       # Domain-specific templates
│   ├── api-design.yaml
│   ├── database.yaml
│   └── ui-component.yaml
├── partials/          # Reusable components
│   ├── header.yaml
│   ├── footer.yaml
│   └── common.yaml
└── examples/          # Template examples
    └── sample.yaml
```

### Naming conventions
- Use kebab-case: `my-template.yaml`
- Include version in name for major changes: `api-v2.yaml`
- Group by purpose: `bug-fix-security.yaml`
- Use descriptive names: `react-component-with-tests.yaml`

## Template Versioning

### Version management
```yaml
name: my-template
version: 1.2.3  # major.minor.patch

# Version compatibility
compatibility:
  min_version: "1.0.0"
  max_version: "2.0.0"

# Migration notes
migration:
  from_1_0:
    - "Renamed 'title' variable to 'name'"
    - "Added required 'description' variable"
```

### Update existing templates
```bash
# Update template version
cursor-prompt template update my-template --version 1.3.0

# Check for breaking changes
cursor-prompt template check my-template --breaking-changes
```

---

*For marketplace operations like sharing templates, see the [Marketplace](./marketplace.md) guide.*
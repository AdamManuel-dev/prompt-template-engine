# Creating Your First Template

**You'll build:** A simple but complete prompt template for bug fixes  
**Time:** 20 minutes  
**You'll learn:** Template basics, variables, and context integration through hands-on practice

## Before we begin

By the end of this tutorial, you'll have:
- Created your first working template
- Used variables to make templates dynamic
- Added context gathering for real project data
- Generated your first custom prompt

Let's see what we'll create:

```handlebars
# Bug Fix: {{issue}}

## Context
Current branch: {{git.branch}}
Files changed: {{git.changedFiles}}

## Problem
{{description}}

Please analyze and fix this issue.
```

## Step 1: Set up your workspace

First, make sure you have the engine installed:

```bash
# Check if already installed
cursor-prompt --version

# If not installed
npm install -g cursor-prompt
```

Create a project directory:

```bash
mkdir my-first-template
cd my-first-template
cursor-prompt init
```

This creates a basic project structure:
```
my-first-template/
├── .cursorprompt.json      # Configuration
├── templates/              # Your templates go here
└── README.md              # Project documentation
```

## Step 2: Create your first template

Create a new template file:

```bash
mkdir -p templates/bug-fix
cd templates/bug-fix
```

Create `template.yaml`:

```yaml
---
name: bug-fix
description: Generate prompts for fixing bugs efficiently
version: 1.0.0
author: me
tags: [debugging, fix, issue]

variables:
  - name: issue
    type: string
    description: Brief description of the issue
    required: true
    
  - name: description
    type: string
    description: Detailed problem description
    required: true

context:
  - git.branch
  - git.status

prompt: |
  # Bug Fix: {{issue}}

  ## Current Context
  - **Branch**: {{git.branch}}
  - **Status**: {{git.status}}

  ## Problem Description
  {{description}}

  ## Request
  Please help me fix this issue. Provide:
  1. Root cause analysis
  2. Step-by-step solution
  3. Code changes needed
  4. Testing approach

  Focus on clean, maintainable solutions.
---
```

## Step 3: Test your template

Generate a prompt using your template:

```bash
# Go back to project root
cd ../..

# Test the template
cursor-prompt generate bug-fix --variables '{
  "issue": "Login button not working",
  "description": "Users click the login button but nothing happens. No errors in console."
}'
```

You should see output like:

```
# Bug Fix: Login button not working

## Current Context
- **Branch**: main
- **Status**: clean

## Problem Description
Users click the login button but nothing happens. No errors in console.

## Request
Please help me fix this issue. Provide:
1. Root cause analysis
2. Step-by-step solution
3. Code changes needed
4. Testing approach

Focus on clean, maintainable solutions.
```

## Step 4: Make it more dynamic

Let's improve the template with conditional logic and more variables.

Update `templates/bug-fix/template.yaml`:

```yaml
---
name: bug-fix
description: Generate prompts for fixing bugs efficiently
version: 1.1.0
author: me
tags: [debugging, fix, issue]

variables:
  - name: issue
    type: string
    description: Brief description of the issue
    required: true
    
  - name: description
    type: string
    description: Detailed problem description
    required: true
    
  - name: severity
    type: string
    description: Bug severity level
    required: false
    default: medium
    options: [low, medium, high, critical]
    
  - name: file
    type: string
    description: File where the issue occurs
    required: false

context:
  - git.branch
  - git.status
  - git.recentCommits

prompt: |
  # 🐛 Bug Fix: {{issue}}

  {{#if_eq severity "critical"}}
  ## ⚠️ CRITICAL ISSUE
  This is a critical bug requiring immediate attention.
  {{/if_eq}}

  {{#if_eq severity "high"}}
  ## 🔥 HIGH PRIORITY
  This bug should be fixed as soon as possible.
  {{/if_eq}}

  ## Current Context
  - **Branch**: {{git.branch}}
  - **Repository Status**: {{git.status}}
  {{#if file}}
  - **Affected File**: `{{file}}`
  {{/if}}

  ## Recent Changes
  {{#if git.recentCommits}}
  Recent commits that might be related:
  {{#each git.recentCommits}}
  - {{this.hash}}: {{this.message}}
  {{/each}}
  {{/if}}

  ## Problem Description
  {{description}}

  ## Analysis Request
  Please provide:

  ### 1. Root Cause Analysis
  - Examine the issue thoroughly
  - Identify the likely cause
  {{#if file}}
  - Focus on file: `{{file}}`
  {{/if}}

  ### 2. Solution Strategy
  - Step-by-step fix approach
  - Consider edge cases
  - Ensure backwards compatibility

  ### 3. Implementation
  - Specific code changes needed
  - Configuration updates (if any)
  - Database changes (if applicable)

  ### 4. Testing Plan
  - Unit tests to add/update
  - Integration test scenarios
  - Manual testing checklist

  {{#if_eq severity "critical"}}
  ### 5. Rollback Plan
  Since this is critical, also provide:
  - Quick rollback strategy
  - Monitoring points to watch
  {{/if_eq}}

  Focus on clean, maintainable, and well-tested solutions.
---
```

## Step 5: Test the enhanced template

Try the enhanced version with different parameters:

```bash
# Test with high severity
cursor-prompt generate bug-fix --variables '{
  "issue": "Database connection failing",
  "description": "Application cannot connect to database, all requests failing with 500 errors",
  "severity": "critical",
  "file": "src/database/connection.js"
}'
```

```bash
# Test with minimal parameters
cursor-prompt generate bug-fix --variables '{
  "issue": "Typo in header text",
  "description": "The word welcome is misspelled as welcom on the homepage"
}'
```

## Step 6: Add template helpers

Create a helpers file for reusable functions. Create `templates/bug-fix/helpers.js`:

```javascript
module.exports = {
  // Format severity with appropriate emoji
  severityIcon: function(severity) {
    const icons = {
      low: '🟢',
      medium: '🟡', 
      high: '🔥',
      critical: '⚠️'
    };
    return icons[severity] || '🟡';
  },
  
  // Generate a bug ID
  bugId: function(issue) {
    const words = issue.toLowerCase().split(' ');
    const shortWords = words.slice(0, 3).join('-');
    const timestamp = Date.now().toString().slice(-4);
    return `BUG-${shortWords}-${timestamp}`;
  },
  
  // Priority level text
  priorityText: function(severity) {
    const priorities = {
      low: 'Low Priority - Address when convenient',
      medium: 'Medium Priority - Fix in next iteration',
      high: 'High Priority - Fix soon',
      critical: 'CRITICAL - Fix immediately'
    };
    return priorities[severity] || 'Medium Priority';
  }
};
```

Update your template to use helpers:

```yaml
prompt: |
  # {{severityIcon severity}} Bug Fix: {{issue}}
  **Bug ID**: {{bugId issue}}  
  **Priority**: {{priorityText severity}}

  ## Current Context
  - **Branch**: {{git.branch}}
  - **Repository Status**: {{git.status}}
  {{#if file}}
  - **Affected File**: `{{file}}`
  {{/if}}

  ## Problem Description
  {{description}}

  ## Analysis Request
  Please provide a complete solution for Bug ID `{{bugId issue}}`:
  
  [rest of template...]
```

## Step 7: Add input validation

Update the template with validation rules:

```yaml
variables:
  - name: issue
    type: string
    description: Brief description of the issue
    required: true
    validation:
      minLength: 5
      maxLength: 100
      pattern: "^[A-Za-z0-9\\s\\-_]+$"
    
  - name: description
    type: string
    description: Detailed problem description  
    required: true
    validation:
      minLength: 20
      maxLength: 1000
      
  - name: severity
    type: string
    description: Bug severity level
    required: false
    default: medium
    options: [low, medium, high, critical]
    
  - name: file
    type: string
    description: File where the issue occurs
    required: false
    validation:
      pattern: "^[a-zA-Z0-9\\/\\._-]+\\.(js|ts|jsx|tsx|py|java|php|rb|go)$"

validation:
  strict: true
  
  # Custom validation rules
  rules:
    - name: critical_needs_file
      condition: "severity == 'critical'"
      requires: ["file"]
      message: "Critical bugs must specify the affected file"
```

## Step 8: Test validation

Try invalid inputs to see validation in action:

```bash
# This will fail - issue too short
cursor-prompt generate bug-fix --variables '{
  "issue": "Bug",
  "description": "Something is wrong"
}'

# This will fail - critical without file
cursor-prompt generate bug-fix --variables '{
  "issue": "System down",
  "description": "The entire system is not responding to any requests",
  "severity": "critical"
}'
```

## Step 9: Create a template collection

You can group related templates. Create `templates/debug-collection.yaml`:

```yaml
---
collection: debug-collection
name: Debugging Templates
description: Collection of templates for debugging and fixing issues
version: 1.0.0

templates:
  - bug-fix
  - performance-issue
  - error-investigation

metadata:
  category: debugging
  difficulty: beginner
  estimatedTime: "5-10 minutes"
---
```

## Step 10: Document your template

Create `templates/bug-fix/README.md`:

```markdown
# Bug Fix Template

A comprehensive template for generating effective bug fix prompts.

## Features

- **Severity-based formatting**: Visual indicators and priority levels
- **Git context integration**: Automatic branch and status information
- **Conditional sections**: Different content based on severity
- **Input validation**: Ensures quality inputs
- **Helper functions**: Reusable formatting and ID generation

## Usage

### Basic usage:
```bash
cursor-prompt generate bug-fix --variables '{
  "issue": "Login button not working",
  "description": "Users cannot log in, button appears unresponsive"
}'
```

### With all options:
```bash
cursor-prompt generate bug-fix --variables '{
  "issue": "Payment processing fails",
  "description": "Credit card payments are being declined incorrectly",
  "severity": "high",
  "file": "src/payment/processor.js"
}'
```

## Variables

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `issue` | string | Yes | Brief description (5-100 chars) |
| `description` | string | Yes | Detailed description (20-1000 chars) |
| `severity` | string | No | One of: low, medium, high, critical |
| `file` | string | No | Path to affected file |

## Examples

See the `/examples` directory for sample outputs.
```

## What you've accomplished

✅ **Created your first template** with YAML configuration  
✅ **Used variables** to make templates dynamic  
✅ **Added conditional logic** for different scenarios  
✅ **Integrated context** from Git repository  
✅ **Added validation** to ensure quality inputs  
✅ **Created helper functions** for reusable logic  
✅ **Documented your work** for future reference  

Your template is now production-ready and can be:
- Shared with your team
- Published to the marketplace
- Extended with additional features
- Used as a base for other templates

## Next steps

1. **Create more templates**: Try making templates for features, refactoring, code review
2. **Learn advanced features**: Explore partials, includes, and complex helpers
3. **Share your work**: Publish templates to help other developers
4. **Integrate with tools**: Connect templates to your development workflow

## Need help?

- 📖 [Template Syntax Reference](../reference/template-syntax.md)
- 🔧 [Advanced Template Features](building-custom-templates.md)
- 💬 [Community Examples](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/discussions)

**Congratulations! You've created your first professional-quality prompt template!**
---
name: Smart Debug
description: Intelligent debugging prompt with full context awareness
context:
  git: true
  system: true
  files: 
    - package.json
  patterns:
    - "**/*.test.ts"
variables:
  issue:
    description: Description of the issue or error
    required: true
  errorMessage:
    description: Error message if available
    required: false
---

# Debug Assistance Request

## 🔍 Issue Description
{{issue}}

{{#if errorMessage}}
## ❌ Error Message
```
{{errorMessage}}
```
{{/if}}

## 📊 System Context
- **Platform**: {{system.platform}}
- **Node Version**: {{system.nodeVersion}}
- **Working Directory**: {{system.cwd}}
- **Timestamp**: {{timestamp}}

{{#if git}}
## 🔀 Git Status
- **Branch**: {{git.branch}}
- **Clean**: {{git.isClean}}
{{#if git.files.modified}}
- **Modified Files**: {{#each git.files.modified}}
  - {{this}}{{/each}}
{{/if}}
{{#if git.files.staged}}
- **Staged Files**: {{#each git.files.staged}}
  - {{this}}{{/each}}
{{/if}}
{{#if git.lastCommit}}
- **Last Commit**: {{git.lastCommit.hash}} - {{git.lastCommit.message}}
{{/if}}
{{/if}}

{{#if project}}
## 📁 Project Information
- **Total Files**: {{project.totalFiles}}
- **Primary Language**: {{project.mainLanguage}}
{{/if}}

{{#if files}}
## 📄 Relevant Files

{{#each files}}
### {{@key}}
```
{{this}}
```

{{/each}}
{{/if}}

## 🎯 Expected Behavior
Please help me debug this issue by:
1. Analyzing the error and context
2. Identifying the root cause
3. Providing a solution with code examples
4. Suggesting preventive measures

## Additional Context
- Context Summary: {{contextSummary}}

---
*Generated with cursor-prompt-template-engine*
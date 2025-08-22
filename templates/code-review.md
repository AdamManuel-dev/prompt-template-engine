---
name: Code Review
description: Comprehensive code review prompt with full repository context
context:
  git: true
  system: true
  patterns:
    - "**/*.{ts,js,tsx,jsx}"
    - "**/*.test.*"
variables:
  focus:
    description: Specific areas to focus on (e.g., security, performance, style)
    required: false
    default: general review
---

# Code Review Request

## 📋 Review Focus
{{#if focus}}
**Special Focus**: {{focus}}
{{else}}
General comprehensive code review requested.
{{/if}}

## 🔀 Repository Status
{{#if git}}
- **Current Branch**: {{git.branch}}
- **Repository State**: {{#if git.isClean}}Clean{{else}}Modified{{/if}}

### Recent Changes
{{#if git.files.modified}}
**Modified Files** ({{git.files.modified.length}}):
{{#each git.files.modified}}
- `{{this}}`
{{/each}}
{{/if}}

{{#if git.files.staged}}
**Staged Files** ({{git.files.staged.length}}):
{{#each git.files.staged}}
- `{{this}}`
{{/each}}
{{/if}}

{{#if git.lastCommit}}
**Last Commit**: {{git.lastCommit.hash}} - {{git.lastCommit.message}}
{{/if}}
{{/if}}

## 📊 Project Overview
{{#if project}}
- **Total Files**: {{project.totalFiles}}
- **Primary Language**: {{project.mainLanguage}}
- **Project Size**: {{project.totalSize}} bytes
{{/if}}

## 📝 Review Checklist

Please review the code for:

### Code Quality
- [ ] Clean, readable, and maintainable code
- [ ] Proper naming conventions
- [ ] DRY principle adherence
- [ ] SOLID principles compliance
- [ ] Appropriate abstractions

### Best Practices
- [ ] Error handling and edge cases
- [ ] Input validation
- [ ] Proper logging
- [ ] Documentation and comments
- [ ] Type safety (if applicable)

### Performance
- [ ] Algorithm efficiency
- [ ] Memory management
- [ ] Database query optimization
- [ ] Caching strategies
- [ ] Async/await usage

### Security
- [ ] Input sanitization
- [ ] Authentication/authorization
- [ ] Sensitive data handling
- [ ] SQL injection prevention
- [ ] XSS prevention

### Testing
- [ ] Test coverage
- [ ] Test quality
- [ ] Edge case testing
- [ ] Mock usage
- [ ] Integration tests

### Architecture
- [ ] Design patterns usage
- [ ] Separation of concerns
- [ ] Dependency management
- [ ] Scalability considerations
- [ ] Maintainability

## 🎯 Expected Deliverables

1. **Critical Issues**: Security vulnerabilities or bugs that must be fixed
2. **Major Improvements**: Significant code quality or performance issues
3. **Minor Suggestions**: Style improvements and nice-to-haves
4. **Positive Feedback**: What's done well
5. **Learning Opportunities**: Educational insights for the team

## Context
- **Review Date**: {{date}}
- **System**: {{system.platform}} / Node {{system.nodeVersion}}
- **Working Directory**: {{system.cwd}}

---
*Generated with cursor-prompt-template-engine*
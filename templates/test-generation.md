---
name: Test Generation
description: Generate comprehensive tests based on existing code
context:
  git: true
  system: true
  patterns:
    - "**/*.{ts,js}"
    - "!**/*.test.*"
    - "!**/*.spec.*"
variables:
  targetFile:
    description: File or module to generate tests for
    required: true
  framework:
    description: Testing framework (jest, mocha, vitest, etc.)
    required: false
    default: jest
  coverage:
    description: Target coverage percentage
    required: false
    default: "80"
---

# Test Generation Request

## 🎯 Target
**File/Module**: `{{targetFile}}`
**Testing Framework**: {{framework}}
**Target Coverage**: {{coverage}}%

## 📊 Current Project State
{{#if git}}
### Git Status
- **Branch**: {{git.branch}}
- **Clean**: {{git.isClean}}
{{#if git.lastCommit}}
- **Last Commit**: {{git.lastCommit.message}}
{{/if}}
{{/if}}

{{#if project}}
### Project Info
- **Language**: {{project.mainLanguage}}
- **Total Files**: {{project.totalFiles}}
{{/if}}

## 📝 Test Requirements

Please generate comprehensive tests that include:

### Test Coverage Areas
1. **Happy Path Tests**
   - Normal operation scenarios
   - Expected inputs and outputs
   - Common use cases

2. **Edge Cases**
   - Boundary conditions
   - Empty/null/undefined inputs
   - Maximum/minimum values
   - Special characters

3. **Error Handling**
   - Invalid inputs
   - Exception scenarios
   - Error recovery
   - Timeout handling

4. **Integration Points**
   - External dependencies
   - API calls
   - Database operations
   - File system operations

### Test Structure Requirements
- Use {{framework}} testing framework
- Follow AAA pattern (Arrange, Act, Assert)
- Include descriptive test names
- Group related tests in describe blocks
- Use appropriate matchers
- Mock external dependencies

### Specific Areas to Test
{{#if targetFile}}
For `{{targetFile}}`, ensure tests cover:
- All exported functions/classes
- Public methods
- Critical business logic
- State management (if applicable)
- Async operations
- Event handlers
{{/if}}

## 🔧 Test Implementation Guidelines

### Setup and Teardown
```javascript
beforeEach(() => {
  // Setup test environment
});

afterEach(() => {
  // Cleanup
});
```

### Mocking Strategy
- Mock external services
- Mock file system operations
- Mock network requests
- Preserve business logic

### Assertions
- Test return values
- Verify state changes
- Check error messages
- Validate side effects

## 📈 Success Criteria
- [ ] Minimum {{coverage}}% code coverage
- [ ] All critical paths tested
- [ ] No flaky tests
- [ ] Fast execution time
- [ ] Clear test descriptions
- [ ] Maintainable test code

## Context
- **Generated**: {{timestamp}}
- **Platform**: {{system.platform}}
- **Node Version**: {{system.nodeVersion}}

---
*Generated with cursor-prompt-template-engine*
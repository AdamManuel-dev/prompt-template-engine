# Contributing to Cursor Prompt Template Engine

Thank you for your interest in contributing to the Cursor Prompt Template Engine! We welcome contributions from the community and are grateful for any help you can provide.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## How to Contribute

### Types of Contributions

- **Bug Fixes**: Fix issues reported in GitHub Issues
- **Features**: Implement new functionality
- **Documentation**: Improve or add documentation
- **Tests**: Add missing tests or improve existing ones
- **Performance**: Optimize code for better performance
- **Refactoring**: Improve code quality and maintainability

### Getting Started

1. Fork the repository
2. Clone your fork locally
3. Create a feature branch
4. Make your changes
5. Submit a pull request

## Development Setup

### Prerequisites

- Node.js v22.0.0 or higher
- npm v10.0.0 or higher
- Git

### Initial Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/cursor-prompt-template-engine.git
cd cursor-prompt-template-engine

# Add upstream remote
git remote add upstream https://github.com/AdamManuel-dev/cursor-prompt-template-engine.git

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Link for local development
npm link
```

### Development Scripts

```bash
# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## Development Workflow

### 1. Create a Feature Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Write clean, maintainable code
- Follow existing patterns and conventions
- Add tests for new functionality
- Update documentation as needed

### 3. Commit Changes

We follow conventional commits:

```bash
# Format: <type>(<scope>): <subject>
git commit -m "feat(template-engine): add support for nested includes"
git commit -m "fix(cli): resolve path traversal issue"
git commit -m "docs(readme): update installation instructions"
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build process or auxiliary tool changes

### 4. Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- template-engine.test.ts

# Run with coverage
npm run test:coverage
```

### 5. Push Changes

```bash
git push origin feature/your-feature-name
```

## Coding Standards

### TypeScript Guidelines

- Use TypeScript strict mode
- Avoid `any` types
- Prefer interfaces over type aliases for objects
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Code Style

We use ESLint and Prettier for code formatting:

```typescript
// Good
export interface TemplateOptions {
  name: string;
  variables: Record<string, unknown>;
  strict?: boolean;
}

export async function renderTemplate(
  template: string,
  options: TemplateOptions
): Promise<string> {
  // Implementation
}

// Bad
export async function render(t: any, o: any): Promise<any> {
  // Don't do this
}
```

### File Structure

```
src/
├── commands/       # CLI commands
├── core/          # Core engine logic
├── services/      # Business logic services
├── repositories/  # Data access layer
├── validators/    # Validation logic
├── utils/         # Utility functions
└── types/         # TypeScript type definitions
```

### Error Handling

- Use custom error classes
- Provide meaningful error messages
- Include recovery suggestions

```typescript
export class TemplateError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TemplateError';
  }
}

// Usage
throw new TemplateError(
  'Template not found',
  'TEMPLATE_NOT_FOUND',
  { templateName: name }
);
```

## Testing Guidelines

### Test Structure

```typescript
describe('TemplateEngine', () => {
  describe('render', () => {
    it('should render basic variables', async () => {
      const engine = new TemplateEngine();
      const result = await engine.render(
        'Hello {{name}}',
        { name: 'World' }
      );
      expect(result).toBe('Hello World');
    });

    it('should handle missing variables', async () => {
      // Test implementation
    });
  });
});
```

### Test Coverage

- Aim for >80% code coverage
- Test edge cases and error conditions
- Include integration tests for commands
- Add E2E tests for critical workflows

### Running Tests

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# E2E tests
npm run test:e2e
```

## Documentation

### Code Documentation

Add JSDoc comments for:
- All public APIs
- Complex functions
- Non-obvious implementations

```typescript
/**
 * Renders a template with the provided context
 * 
 * @param template - The template string to render
 * @param context - Variables for substitution
 * @returns The rendered template
 * @throws {TemplateError} If template syntax is invalid
 * 
 * @example
 * const result = await render('Hello {{name}}', { name: 'World' });
 * // Returns: "Hello World"
 */
export async function render(
  template: string,
  context: TemplateContext
): Promise<string> {
  // Implementation
}
```

### Documentation Updates

When adding features or making changes:

1. Update relevant markdown documentation
2. Add examples if applicable
3. Update the README if needed
4. Document breaking changes

## Pull Request Process

### Before Submitting

1. **Test your changes**: Run `npm test`
2. **Lint your code**: Run `npm run lint`
3. **Format your code**: Run `npm run format`
4. **Update documentation**: If applicable
5. **Add tests**: For new functionality
6. **Check coverage**: Run `npm run test:coverage`

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. Automated checks run (tests, linting)
2. Code review by maintainers
3. Address feedback
4. Approval and merge

## Issue Guidelines

### Bug Reports

Include:
- Clear description of the issue
- Steps to reproduce
- Expected behavior
- Actual behavior
- System information
- Error messages/logs

### Feature Requests

Include:
- Problem description
- Proposed solution
- Use cases
- Alternative solutions considered
- Implementation suggestions (optional)

## Release Process

We use semantic versioning (SemVer):

- **Major**: Breaking changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes

Releases are automated via GitHub Actions when tags are pushed.

## Getting Help

- **Discord**: [Join our community](https://discord.gg/cursor-prompt)
- **Discussions**: [GitHub Discussions](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/discussions)
- **Issues**: [GitHub Issues](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/issues)

## Recognition

Contributors are recognized in:
- The README contributors section
- Release notes
- The AUTHORS file

Thank you for contributing to the Cursor Prompt Template Engine!

---

*Last Updated: 2025-08-22*
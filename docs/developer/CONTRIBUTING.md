# Contributing to Cursor Prompt Template Engine

*Last Updated: 2025-08-26*

Thank you for your interest in contributing to the Cursor Prompt Template Engine! This guide will help you get started with contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Requirements](#documentation-requirements)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

### Our Pledge

We are committed to making participation in this project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting the project team at [maintainer email]. All complaints will be reviewed and investigated promptly and fairly.

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0 or **yarn** >= 4.0.0
- **Git** for version control
- **TypeScript** knowledge (intermediate level recommended)

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/cursor-prompt-template-engine.git
   cd cursor-prompt-template-engine
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/AdamManuel-dev/cursor-prompt-template-engine.git
   ```

### Development Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests to ensure everything works
npm test

# Start development mode
npm run dev
```

### IDE Setup

#### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-jest",
    "streetsidesoftware.code-spell-checker"
  ]
}
```

## Development Process

### Branch Strategy

We use Git Flow for our branching strategy:

```
main                    # Production releases
├── develop            # Integration branch
├── feature/*          # New features
├── bugfix/*          # Bug fixes
├── hotfix/*          # Critical production fixes
└── release/*         # Release preparation
```

### Creating a Feature Branch

```bash
# Sync with upstream
git fetch upstream
git checkout develop
git merge upstream/develop

# Create feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... code, test, document ...

# Commit changes
git add .
git commit -m "feat(scope): add amazing feature"

# Push to your fork
git push origin feature/your-feature-name
```

### Commit Message Standards

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format
<type>(scope): <description>

# Types
feat     # New feature
fix      # Bug fix
docs     # Documentation changes
style    # Code style changes (formatting, etc)
refactor # Code refactoring
test     # Adding or updating tests
chore    # Build process or auxiliary tool changes
perf     # Performance improvements
ci       # CI/CD changes

# Examples
feat(core): add template caching mechanism
fix(cli): resolve argument parsing issue
docs(api): update JSDoc for TemplateEngine
test(services): add unit tests for ConfigService
refactor(utils): extract common validation logic
```

### Keeping Your Fork Up to Date

```bash
# Fetch upstream changes
git fetch upstream

# Merge upstream develop into your develop
git checkout develop
git merge upstream/develop

# Rebase your feature branch
git checkout feature/your-feature-name
git rebase develop
```

## Coding Standards

### TypeScript Guidelines

#### Type Safety
- Use **strict TypeScript mode** (`strict: true`)
- Avoid `any` type unless absolutely necessary
- Use **type assertions** sparingly and with good reason
- Define **comprehensive interfaces** for complex objects

```typescript
// ✅ Good: Strong typing
interface TemplateOptions {
  readonly cacheEnabled: boolean;
  readonly timeout?: number;
  readonly helpers?: Record<string, HelperFunction>;
}

// ❌ Bad: Loose typing
interface TemplateOptions {
  [key: string]: any;
}
```

#### Naming Conventions
- **PascalCase** for classes and interfaces: `TemplateEngine`, `ICommand`
- **camelCase** for methods and variables: `processTemplate`, `configOptions`
- **UPPER_SNAKE_CASE** for constants: `DEFAULT_CACHE_SIZE`
- **kebab-case** for file names: `template-engine.ts`

#### Code Organization

```typescript
// File structure order:
// 1. Imports (external, then internal)
// 2. Types and interfaces
// 3. Constants
// 4. Main class/function implementation

import { promises as fs } from 'fs';
import path from 'path';

import { Logger } from '../utils/logger';
import { CacheService } from '../services/cache.service';

interface ProcessingOptions {
  readonly timeout: number;
  readonly cacheKey?: string;
}

const DEFAULT_TIMEOUT = 30000;

export class TemplateProcessor {
  // Implementation
}
```

### Code Quality Standards

#### Function Design
- **Single Responsibility Principle**: Each function should do one thing well
- **Pure functions** when possible (no side effects)
- **Descriptive names** that explain what the function does
- **Small functions** (generally <50 lines)

```typescript
// ✅ Good: Clear, focused function
async function validateTemplateContent(content: string): Promise<ValidationResult> {
  if (!content.trim()) {
    return { valid: false, errors: ['Template content cannot be empty'] };
  }
  
  return await runSyntaxValidation(content);
}

// ❌ Bad: Does too many things
async function processTemplate(content: string, context: any): Promise<any> {
  // Validates, processes, caches, logs, etc.
}
```

#### Error Handling
- Use **custom error classes** with meaningful messages
- **Always handle promises** with try/catch or .catch()
- **Provide context** in error messages
- **Log errors appropriately** with different levels

```typescript
// Custom error classes
export class TemplateValidationError extends Error {
  constructor(
    message: string,
    public readonly template: string,
    public readonly line?: number
  ) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}

// Proper error handling
try {
  const result = await processTemplate(template, context);
  return result;
} catch (error) {
  if (error instanceof TemplateValidationError) {
    logger.warn('Template validation failed', {
      template: error.template,
      line: error.line,
      error: error.message
    });
    throw error; // Re-throw with context
  }
  
  logger.error('Unexpected error processing template', { error });
  throw new Error('Template processing failed');
}
```

#### Async Programming
- **Always use async/await** over callbacks or raw promises
- **Handle promise rejections** explicitly
- **Use Promise.all()** for parallel operations
- **Implement timeouts** for external operations

```typescript
// ✅ Good: Proper async handling
async function loadTemplates(paths: string[]): Promise<Template[]> {
  try {
    const loadPromises = paths.map(path => 
      loadTemplate(path).catch(error => {
        logger.warn(`Failed to load template: ${path}`, { error });
        return null; // Don't fail entire batch
      })
    );
    
    const results = await Promise.all(loadPromises);
    return results.filter((template): template is Template => template !== null);
  } catch (error) {
    logger.error('Failed to load templates', { error });
    throw new Error('Template loading failed');
  }
}
```

### File Header Standards

Every file must include a comprehensive header following CLAUDE.md standards:

```typescript
/**
 * @fileoverview [Brief description of file purpose and functionality]
 * @lastmodified 2025-08-26T06:43:08Z
 * 
 * Features: [List of key features provided by this module]
 * Main APIs: [Primary public methods, classes, or exports]
 * Constraints: [Important limitations, requirements, or dependencies]
 * Patterns: [Design patterns or architectural approaches used]
 */
```

### ESLint Configuration

The project uses Airbnb ESLint configuration with Prettier integration:

```bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Check formatting
npm run format:check

# Fix formatting
npm run format
```

## Testing Guidelines

### Test Structure

```
tests/
├── unit/              # Unit tests (>80% coverage required)
│   ├── core/         # Core engine tests
│   ├── services/     # Service layer tests
│   ├── cli/          # CLI tests
│   └── utils/        # Utility tests
├── integration/       # Integration tests
│   └── e2e/          # End-to-end tests
├── fixtures/         # Test data
└── __mocks__/        # Mock implementations
```

### Writing Unit Tests

#### Test Naming and Structure

```typescript
describe('TemplateEngine', () => {
  describe('processTemplate', () => {
    it('should process basic variable substitution correctly', async () => {
      // Arrange
      const engine = new TemplateEngine();
      const template = 'Hello {{name}}!';
      const context = { name: 'World' };

      // Act
      const result = await engine.processTemplate(template, context);

      // Assert
      expect(result).toBe('Hello World!');
    });

    it('should handle missing variables with default behavior', async () => {
      // Test missing variable handling
    });

    it('should throw TemplateValidationError for invalid syntax', async () => {
      // Test error conditions
      const engine = new TemplateEngine();
      const invalidTemplate = 'Hello {{unclosed';

      await expect(
        engine.processTemplate(invalidTemplate, {})
      ).rejects.toThrow(TemplateValidationError);
    });
  });
});
```

#### Coverage Requirements

- **Minimum 80% code coverage** for all modules
- **90%+ coverage** for core functionality
- **Test both success and failure paths**
- **Mock external dependencies** appropriately

#### Mocking Guidelines

```typescript
// Use Jest mocks for external dependencies
jest.mock('../services/cache.service');
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
  }
}));

// Create focused unit tests
describe('TemplateLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load template from file system', async () => {
    // Mock fs.readFile to return test data
    const mockReadFile = fs.promises.readFile as jest.MockedFunction<typeof fs.promises.readFile>;
    mockReadFile.mockResolvedValue('Hello {{name}}!');

    const loader = new TemplateLoader();
    const template = await loader.loadTemplate('test.md');

    expect(template.content).toBe('Hello {{name}}!');
    expect(mockReadFile).toHaveBeenCalledWith(
      expect.stringContaining('test.md'),
      'utf8'
    );
  });
});
```

### Integration Testing

Test component interactions without mocking internal dependencies:

```typescript
describe('Template Processing Workflow', () => {
  it('should process template with real services', async () => {
    // Use real TemplateEngine, CacheService, etc.
    const engine = new TemplateEngine({
      cacheService: new CacheService(),
      configService: new ConfigService()
    });

    const result = await engine.processTemplate(complexTemplate, context);
    
    expect(result).toMatchSnapshot();
  });
});
```

### E2E Testing

Test complete user workflows:

```typescript
describe('CLI Commands E2E', () => {
  it('should generate template via CLI', async () => {
    const { stdout, stderr, exitCode } = await execCommand([
      'node', 'dist/cli.js',
      'generate', 'feature',
      '--description', 'Add new feature'
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Template generated successfully');
    expect(stderr).toBe('');
  });
});
```

## Documentation Requirements

### JSDoc Standards

Every public API must have comprehensive JSDoc documentation:

```typescript
/**
 * Processes a template string with the provided context
 * 
 * This method handles variable substitution, conditional logic,
 * and loop processing to generate the final output. The template
 * is validated before processing and results are cached for
 * improved performance on subsequent calls.
 * 
 * @param template - The template string to process
 * @param context - Context data containing variables and metadata
 * @param options - Optional processing configuration
 * @returns Promise that resolves to the processed template content
 * @throws {TemplateValidationError} When template syntax is invalid
 * @throws {VariableResolutionError} When required variables are missing
 * 
 * @example Basic usage
 * ```typescript
 * const engine = new TemplateEngine();
 * const result = await engine.processTemplate(
 *   'Hello {{name}}!',
 *   { name: 'World' }
 * );
 * console.log(result); // "Hello World!"
 * ```
 * 
 * @example With options
 * ```typescript
 * const result = await engine.processTemplate(
 *   template,
 *   context,
 *   { timeout: 5000, cacheKey: 'my-template' }
 * );
 * ```
 * 
 * @since 1.0.0
 * @see {@link TemplateContext} for context structure details
 * @see {@link ProcessingOptions} for available options
 */
public async processTemplate(
  template: string,
  context: TemplateContext,
  options?: ProcessingOptions
): Promise<string>
```

### Documentation Types Required

1. **JSDoc Comments**: All public APIs
2. **README Updates**: For user-facing changes
3. **Architecture Docs**: For structural changes
4. **Migration Guides**: For breaking changes
5. **Example Code**: For new features

## Pull Request Process

### Before Submitting

1. **Ensure all tests pass**:
   ```bash
   npm run type-check:strict
   npm run lint
   npm test
   npm run test:coverage
   ```

2. **Update documentation** as needed
3. **Add tests** for new functionality
4. **Follow commit message conventions**

### Pull Request Template

When creating a pull request, use this template:

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed

## Documentation
- [ ] JSDoc comments added/updated
- [ ] README updated if needed
- [ ] Architecture docs updated if needed
- [ ] Migration guide created if needed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests pass locally
- [ ] Documentation is clear and complete
- [ ] No breaking changes (or clearly documented)

## Related Issues
Fixes #(issue number)

## Screenshots (if applicable)
```

### Review Process

Pull requests require:
- **Automated checks** must pass (CI/CD pipeline)
- **Code review** from at least one maintainer
- **Documentation review** for user-facing changes
- **Performance review** for core functionality changes

### Merge Criteria

- All CI checks pass
- Code review approval
- Adequate test coverage
- Documentation updated
- No merge conflicts

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

### Release Workflow

1. **Feature freeze** on develop branch
2. **Create release branch**: `release/1.x.0`
3. **Update version numbers** and changelog
4. **Final testing** and bug fixes
5. **Merge to main** and tag release
6. **Deploy to npm** and update documentation

### Changelog Maintenance

Keep CHANGELOG.md updated with:
- New features
- Bug fixes
- Breaking changes
- Deprecations
- Security updates

## Community Guidelines

### Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Discord**: Real-time community chat (coming soon)
- **Documentation**: Comprehensive guides and API reference

### Reporting Issues

When reporting bugs, include:

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., macOS 12.1]
- Node.js: [e.g., 18.12.0]
- Package version: [e.g., 1.2.3]

## Additional Context
Any other relevant information
```

### Suggesting Features

For feature requests, include:
- Clear description of the feature
- Use case and motivation
- Possible implementation approach
- Any related examples or references

## Recognition

Contributors are recognized in:
- **CONTRIBUTORS.md**: All contributors listed
- **Release notes**: Major contributors mentioned
- **README badges**: Contributor count displayed
- **GitHub insights**: Contribution graphs visible

## Questions?

If you have questions about contributing:

1. Check existing documentation
2. Search GitHub issues and discussions
3. Ask in GitHub discussions
4. Contact maintainers directly

Thank you for contributing to Cursor Prompt Template Engine! 🚀
# Developer Guide

_Last Updated: 2025-08-26_

A comprehensive guide for developers working on the Cursor Prompt Template Engine codebase.

## Table of Contents

- [Getting Started](#getting-started)
- [Architecture Overview](#architecture-overview)
- [Code Organization](#code-organization)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Documentation Standards](#documentation-standards)
- [Performance Guidelines](#performance-guidelines)
- [Security Practices](#security-practices)

## Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0 or **yarn** >= 4.0.0
- **TypeScript** >= 5.0.0
- **Git** for version control

### Development Setup

```bash
# Clone the repository
git clone https://github.com/AdamManuel-dev/cursor-prompt-template-engine.git
cd cursor-prompt-template-engine

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development mode
npm run dev
```

### IDE Setup

#### VS Code/Cursor Extensions

Recommended extensions for development:

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-jest"
  ]
}
```

#### Configuration Files

The project includes pre-configured:

- **TypeScript** - `tsconfig.json`, `tsconfig.build.json`, `tsconfig.test.json`
- **ESLint** - Airbnb configuration with Prettier integration
- **Jest** - Comprehensive testing setup
- **Prettier** - Code formatting standards

## Architecture Overview

### System Design

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Layer     │────┤  Service Layer  │────┤   Core Engine   │
│                 │    │                 │    │                 │
│ • Commands      │    │ • Template Svc  │    │ • Engine        │
│ • Plugin Loader │    │ • Cache Svc     │    │ • Processors    │
│ • Registry      │    │ • Config Svc    │    │ • Helpers       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────────────────────────────────┐
         │             Integration Layer               │
         │                                             │
         │ • Cursor IDE Integration                    │
         │ • PromptWizard Integration                  │
         │ • Claude Code Integration                   │
         └─────────────────────────────────────────────┘
```

### Core Principles

1. **Separation of Concerns**: Clear boundaries between CLI, services, and core engine
2. **Dependency Injection**: Services are injected where needed for testability
3. **Plugin Architecture**: Extensible system for custom functionality
4. **Event-Driven**: Asynchronous operations with event emission
5. **Type Safety**: Comprehensive TypeScript usage with strict mode

### Key Components

#### Core Engine (`src/core/`)

- **Template Engine**: Main processing engine
- **Processors**: Specialized logic for conditionals, loops, variables
- **Helpers**: 60+ utility functions for template processing
- **Partials**: Reusable template component management

#### Service Layer (`src/services/`)

- **Template Service**: Template discovery and management
- **Cache Service**: High-performance caching with LRU and TTL
- **Config Service**: Hierarchical configuration management
- **Context Services**: Git, file, and terminal context gathering

#### CLI Layer (`src/cli/`)

- **Commands**: User-facing CLI command implementations
- **Plugin System**: Dynamic plugin loading and execution
- **Command Registry**: Centralized command management

#### Integration Layer (`src/integrations/`)

- **Cursor IDE**: Deep integration with Cursor editor
- **PromptWizard**: AI-powered optimization service
- **Claude Code**: MCP protocol integration

## Code Organization

### Directory Structure

```
src/
├── cli/                    # CLI infrastructure
│   ├── commands/          # Command implementations
│   ├── base-command.ts    # Abstract command base
│   ├── command-registry.ts # Command registration
│   └── plugin-loader.ts   # Plugin management
├── core/                   # Core template engine
│   ├── processors/        # Template processors
│   ├── template-engine.ts # Main engine
│   ├── template-helpers.ts # Helper functions
│   └── template-partials.ts # Partial management
├── services/              # Service layer
│   ├── template.service.ts # Template management
│   ├── cache.service.ts   # Caching service
│   └── config.service.ts  # Configuration
├── integrations/          # External integrations
│   ├── cursor/           # Cursor IDE integration
│   └── promptwizard/     # PromptWizard integration
├── utils/                # Utility functions
├── types/                # TypeScript type definitions
└── validation/           # Schema validation
```

### Naming Conventions

#### Files and Directories

- **kebab-case** for file names: `template-engine.ts`
- **kebab-case** for directory names: `src/cli/commands/`
- **Service suffix** for service files: `cache.service.ts`
- **Interface files** in types: `src/types/template.types.ts`

#### Code Conventions

- **PascalCase** for classes and interfaces: `TemplateEngine`, `ICommand`
- **camelCase** for methods and variables: `processTemplate`, `configOptions`
- **UPPER_SNAKE_CASE** for constants: `DEFAULT_CACHE_SIZE`
- **Prefix interfaces** with `I` when needed: `ICommand`, `IPlugin`

### File Header Standards

Every file must include a CLAUDE.md compliant header:

```typescript
/**
 * @fileoverview [Brief description of file purpose]
 * @lastmodified 2025-08-26T06:43:08Z
 *
 * Features: [Key features provided]
 * Main APIs: [Primary public methods/classes]
 * Constraints: [Important limitations or requirements]
 * Patterns: [Design patterns or conventions used]
 */
```

## Development Workflow

### Branch Strategy

```
main                    # Production-ready code
├── develop            # Integration branch
├── feature/*          # Feature development
├── bugfix/*          # Bug fixes
├── hotfix/*          # Critical production fixes
└── release/*         # Release preparation
```

### Commit Standards

Use conventional commits for clear history:

```bash
# Feature commits
feat(core): add template caching mechanism
feat(cli): implement batch optimization command

# Bug fixes
fix(engine): resolve circular dependency detection
fix(cli): handle missing template files gracefully

# Documentation
docs(api): update JSDoc for TemplateEngine class
docs(readme): add installation instructions

# Refactoring
refactor(services): extract common cache logic
refactor(types): consolidate template interfaces

# Tests
test(core): add integration tests for processors
test(cli): increase command coverage to 95%
```

### Development Process

1. **Create Feature Branch**

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/amazing-feature
   ```

2. **Make Changes**
   - Write code following established patterns
   - Add comprehensive tests
   - Update documentation
   - Follow code style guidelines

3. **Test Thoroughly**

   ```bash
   npm run type-check:strict
   npm run lint
   npm test
   npm run test:coverage
   ```

4. **Commit and Push**

   ```bash
   git add .
   git commit -m "feat(core): add amazing feature"
   git push origin feature/amazing-feature
   ```

5. **Create Pull Request**
   - Use PR template
   - Add comprehensive description
   - Link related issues
   - Request appropriate reviewers

## Testing Strategy

### Test Hierarchy

```
tests/
├── unit/              # Unit tests (>80% coverage)
│   ├── core/         # Core engine tests
│   ├── services/     # Service layer tests
│   ├── cli/          # CLI command tests
│   └── utils/        # Utility tests
├── integration/       # Integration tests
│   ├── e2e/          # End-to-end workflows
│   └── template-workflow.test.ts
└── fixtures/         # Test data and mocks
    └── test-data.ts
```

### Testing Standards

#### Unit Tests

- **Minimum 80% code coverage** for all modules
- **Test both happy path and error cases**
- **Mock external dependencies** appropriately
- **Use descriptive test names**

```typescript
describe('TemplateEngine', () => {
  describe('processTemplate', () => {
    it('should process basic variable substitution', async () => {
      // Test implementation
    });

    it('should handle missing variables gracefully', async () => {
      // Error case testing
    });

    it('should throw error for invalid template syntax', async () => {
      // Exception testing
    });
  });
});
```

#### Integration Tests

- **Test component interactions**
- **Use real (non-mocked) dependencies where possible**
- **Test complete user workflows**
- **Validate CLI command integration**

#### E2E Tests

- **Test complete user scenarios**
- **Use temporary directories for file operations**
- **Clean up resources after tests**
- **Test CLI output and exit codes**

### Test Utilities

The project provides comprehensive test utilities:

```typescript
// Mock factories
import { createMockTemplateEngine } from '../test-utils/mock-factory';

// File system mocking
import { MockFileSystem } from '../test-utils/mock-file-system';

// Common test data
import { testTemplates, testContexts } from '../fixtures/test-data';
```

## Documentation Standards

### JSDoc Requirements

Every public method, class, and interface must have comprehensive JSDoc:

````typescript
/**
 * Processes a template with the provided context data
 *
 * This method performs variable substitution, conditional logic evaluation,
 * and loop processing to generate the final template output.
 *
 * @param template - The template string to process
 * @param context - Context data for variable substitution
 * @param options - Optional processing configuration
 * @returns Promise resolving to processed template content
 * @throws {TemplateValidationError} When template syntax is invalid
 * @throws {VariableResolutionError} When required variables are missing
 *
 * @example
 * ```typescript
 * const engine = new TemplateEngine();
 * const result = await engine.processTemplate(
 *   'Hello {{name}}!',
 *   { name: 'World' }
 * );
 * // Result: "Hello World!"
 * ```
 *
 * @since 1.0.0
 * @see {@link TemplateContext} for context structure
 */
public async processTemplate(
  template: string,
  context: TemplateContext,
  options?: ProcessingOptions
): Promise<string>
````

### Documentation Types

1. **API Documentation**: Complete JSDoc for all public APIs
2. **Architecture Docs**: High-level system design documentation
3. **User Guides**: Step-by-step instructions for end users
4. **Developer Guides**: Technical implementation details
5. **Reference Docs**: Complete parameter and return value documentation

## Performance Guidelines

### Optimization Strategies

#### Template Processing

- **Cache compiled templates** to avoid re-parsing
- **Limit context size** to essential data only
- **Use streaming** for large template processing
- **Profile critical paths** for bottlenecks

#### Memory Management

- **Clear caches periodically** to prevent memory leaks
- **Use weak references** where appropriate
- **Monitor heap usage** in long-running processes
- **Implement backpressure** for high-throughput scenarios

#### I/O Operations

- **Batch file operations** when possible
- **Use async/await** for all I/O
- **Implement connection pooling** for external services
- **Cache expensive operations** like git commands

### Performance Testing

```typescript
// Performance benchmarks
npm run benchmark

// Memory profiling
npm run profile:memory

// CPU profiling
npm run profile:cpu
```

### Monitoring

Key metrics to track:

- Template processing time
- Memory usage patterns
- Cache hit ratios
- Plugin loading times
- CLI command response times

## Security Practices

### Input Validation

- **Validate all user inputs** using Zod schemas
- **Sanitize file paths** to prevent directory traversal
- **Limit template complexity** to prevent DoS
- **Validate plugin code** before execution

### Plugin Security

```typescript
// Plugin sandboxing example
const plugin = await pluginLoader.loadPlugin(pluginPath, {
  allowFileSystem: false,
  allowNetwork: false,
  memoryLimit: '50MB',
  timeoutMs: 30000,
});
```

### Secure Defaults

- **No network access** for plugins by default
- **Limited file system access** for templates
- **Resource limits** on all operations
- **Input size limits** to prevent abuse

### Security Auditing

```bash
# Dependency vulnerability scanning
npm audit

# Security-focused linting
npm run lint:security

# License compliance checking
npm run check-licenses
```

## Best Practices

### Error Handling

- **Use custom error classes** with meaningful messages
- **Provide recovery suggestions** in error messages
- **Log errors appropriately** with context
- **Handle async errors** properly

```typescript
try {
  const result = await processTemplate(template, context);
  return result;
} catch (error) {
  if (error instanceof TemplateValidationError) {
    logger.warn('Template validation failed', { template, error });
    throw new Error(`Invalid template: ${error.message}`);
  }
  throw error; // Re-throw unexpected errors
}
```

### Async Programming

- **Always use async/await** for promises
- **Handle promise rejections** explicitly
- **Avoid callback patterns** in new code
- **Use Promise.all** for parallel operations

### Type Safety

- **Use strict TypeScript mode** everywhere
- **Avoid `any` type** unless absolutely necessary
- **Define comprehensive interfaces** for complex objects
- **Use type guards** for runtime type checking

### Code Quality

- **Follow single responsibility principle**
- **Keep functions small and focused**
- **Use meaningful variable names**
- **Comment complex logic** inline
- **Extract constants** for magic numbers/strings

## Troubleshooting

### Common Development Issues

#### TypeScript Compilation Errors

```bash
# Check TypeScript configuration
npm run type-check:strict

# Build with detailed errors
npx tsc --noEmit --strict --noUnusedLocals
```

#### Test Failures

```bash
# Run tests with detailed output
npm test -- --verbose

# Run specific test suite
npm test -- --testNamePattern="TemplateEngine"

# Debug failing tests
npm test -- --detectOpenHandles --forceExit
```

#### Performance Issues

```bash
# Profile template processing
npm run profile:templates

# Check memory usage
npm run analyze:memory

# Benchmark critical paths
npm run benchmark:core
```

## Contributing

### Pull Request Process

1. **Fork the repository** and create feature branch
2. **Make changes** following code standards
3. **Add tests** with >80% coverage
4. **Update documentation** as needed
5. **Run full test suite** and fix any issues
6. **Submit PR** with comprehensive description

### Review Criteria

Pull requests are evaluated on:

- **Code quality and style**
- **Test coverage and quality**
- **Documentation completeness**
- **Performance impact**
- **Security considerations**
- **Backward compatibility**

### Contributor Guidelines

- Follow established coding patterns
- Write comprehensive commit messages
- Add JSDoc for all public APIs
- Include tests for new functionality
- Update documentation for changes
- Respect existing architecture decisions

---

_This developer guide is continuously updated. For questions or suggestions, please open an issue or start a discussion on GitHub._

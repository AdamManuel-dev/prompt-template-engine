# System Architecture

## Overview

The Cursor Prompt Template Engine is a modular TypeScript CLI application designed for generating context-aware prompts for Cursor IDE. It follows a layered architecture with clear separation of concerns.

## Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│                    CLI Interface                       │
│                   (Commander.js)                       │
└────────────────────┬───────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────┐
│                  Command Layer                         │
│    (init, generate, apply, validate, list, config)     │
└────────────────────┬───────────────────────────────────┘
                     │
┌────────────────────▼───────────────────────────────────┐
│                  Service Layer                         │
│  (Template, Config, Context, Git, File, Terminal)      │
└────────────────────┬───────────────────────────────────┘
                     │
┌────────────────────┼───────────────────────────────────┐
│                    │                                   │
▼                    ▼                                   ▼
┌──────────┐  ┌──────────────┐                 ┌────────────┐
│   Core   │  │ Repositories │                 │ Validators │
│  Engine  │  │  (Storage)   │                 │  (Rules)   │
└──────────┘  └──────────────┘                 └────────────┘
```

## Core Components

### 1. CLI Interface (`/src/index.ts`)

The entry point that uses Commander.js to:

- Parse command-line arguments
- Route to appropriate commands
- Handle global options and errors
- Provide help documentation

### 2. Command Layer (`/src/commands/`)

Each command is a self-contained module:

- **init**: Initialize project configuration
- **generate**: Generate prompts from templates
- **generate-enhanced**: Advanced generation with context
- **apply**: Apply templates to files
- **validate**: Validate template syntax
- **list**: List available templates
- **config**: Manage configuration

### 3. Service Layer (`/src/services/`)

Core business logic services:

#### TemplateService

- Template discovery and loading
- Template parsing and validation
- Variable resolution
- Template caching

#### ConfigService

- Configuration management
- Settings persistence
- Default values handling
- Environment variable support

#### ContextAggregator

- Combines multiple context sources
- Manages context size limits
- Formats context for templates

#### GitService

- Git repository operations
- Branch information
- Diff generation
- Commit history

#### FileContextService

- File system operations
- Project structure analysis
- File content retrieval
- .gitignore respect

#### TerminalCaptureService

- Terminal output capture
- Command history
- Error output handling

### 4. Core Engine (`/src/core/`)

#### TemplateEngine

- Handlebars-style template processing
- Variable substitution (`{{variable}}`)
- Conditional blocks (`{{#if}}`, `{{#unless}}`)
- Iteration blocks (`{{#each}}`)
- Include directives (`{{#include}}`)
- Circular dependency detection

#### TemplateValidator

- Syntax validation
- Variable validation
- Schema validation
- Error reporting

### 5. Repository Layer (`/src/repositories/`)

Storage abstraction for templates:

- **BaseRepository**: Abstract interface
- **FileSystemRepository**: File-based storage
- **MemoryRepository**: In-memory storage for testing

### 6. Validators (`/src/validators/`)

Validation pipeline components:

- **BaseValidator**: Abstract validator interface
- **TemplateValidator**: Template syntax validation
- **VariableValidator**: Variable usage validation
- **SchemaValidator**: Schema compliance validation
- **ValidationPipeline**: Orchestrates validators

## Data Flow

### Template Generation Flow

```
User Input → Command Parser → Generate Command
    ↓
Template Service ← Config Service
    ↓
Context Aggregator → Git/File/Terminal Services
    ↓
Template Engine → Variable Resolution
    ↓
Output Formatter → Clipboard/File/Console
```

### Validation Flow

```
Template File → Template Validator
    ↓
Validation Pipeline → Schema/Variable/Syntax Validators
    ↓
Error Reporter → Formatted Output
```

## Design Patterns

### 1. Service Pattern

Services encapsulate business logic and are stateless where possible.

### 2. Repository Pattern

Abstracts storage mechanisms for templates and configuration.

### 3. Pipeline Pattern

Validation uses a pipeline of validators for extensibility.

### 4. Template Method Pattern

Base validators and repositories define template methods.

### 5. Singleton Services

Some services (GitService, TerminalCapture) use singleton instances.

## Technology Stack

### Core Technologies

- **Runtime**: Node.js v22+
- **Language**: TypeScript 5.7+
- **CLI Framework**: Commander.js
- **Output**: Chalk for colored output

### Development Tools

- **Build**: TypeScript Compiler (tsc)
- **Testing**: Jest with ts-jest
- **Linting**: ESLint with TypeScript plugins
- **Formatting**: Prettier

### Key Dependencies

- **commander**: CLI framework
- **chalk**: Terminal styling
- **glob**: File pattern matching
- **ignore**: .gitignore parsing
- **js-yaml**: YAML configuration support
- **clipboardy**: Clipboard integration

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Templates loaded on-demand
2. **Caching**: Template and configuration caching
3. **Parallel Processing**: Context gathering in parallel
4. **Size Limits**: Enforced limits on file and context sizes
5. **Streaming**: Large file handling with streams

### Performance Targets

- Startup time: <50ms
- Template rendering: <10ms
- Context gathering: <100ms
- Total execution: <200ms for typical use

## Security Considerations

### Input Validation

- All user input sanitized
- Path traversal prevention
- Template injection protection

### File Access

- Respects .gitignore patterns
- Size limits on file reads
- No execution of external commands in templates

### Sensitive Data

- No logging of template variables
- Git credentials never exposed
- Environment variables filtered

## Error Handling

### Error Categories

1. **User Errors**: Invalid input, missing files
2. **System Errors**: File system, permissions
3. **Template Errors**: Syntax, validation failures
4. **Network Errors**: Git remote operations

### Error Recovery

- Graceful degradation when optional features fail
- Clear error messages with recovery suggestions
- Non-zero exit codes for scripting

## Extension Points

### Adding New Commands

1. Create command module in `/src/commands/`
2. Register in CLI router
3. Add tests and documentation

### Adding New Context Sources

1. Create service in `/src/services/`
2. Integrate with ContextAggregator
3. Update template documentation

### Adding New Validators

1. Extend BaseValidator
2. Add to ValidationPipeline
3. Configure in validation settings

## Testing Strategy

### Unit Tests

- Individual service methods
- Template engine functions
- Validator logic

### Integration Tests

- Command execution
- Service interactions
- File system operations

### E2E Tests

- Full CLI workflows
- Template generation scenarios
- Error handling paths

## Deployment

### Distribution Methods

1. **npm Package**: Global installation via npm
2. **Binary**: Standalone executables
3. **Source**: Direct from GitHub

### Configuration

- Local: `.cursorprompt.json`
- Global: `~/.cursorprompt/config.json`
- Environment: `CURSOR_PROMPT_*` variables

## Future Enhancements

### Planned Features

- Template marketplace
- Cloud template storage
- Team template sharing
- AI-powered template generation
- Cursor IDE extension

### Architecture Evolution

- Plugin system for extensions
- Remote template repositories
- Real-time collaboration
- Analytics and metrics
- Template versioning

---

_Last Updated: 2025-08-22_

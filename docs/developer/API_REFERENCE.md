# Complete API Reference

*Last Updated: 2025-08-26*

This comprehensive API reference provides detailed documentation for all public classes, interfaces, and methods in the Cursor Prompt Template Engine.

## Table of Contents

- [Core Engine](#core-engine)
- [Services](#services)
- [CLI Infrastructure](#cli-infrastructure)
- [Integration Layer](#integration-layer)
- [Processors](#processors)
- [Utilities](#utilities)
- [Error Handling](#error-handling)

## Core Engine

### TemplateEngine

The core template processing engine that handles variable substitution, conditional logic, loops, and includes.

**Location**: `src/core/template-engine.ts`

#### Constructor

```typescript
constructor(options?: TemplateEngineOptions)
```

**Parameters:**
- `options` (optional): Configuration options for the template engine

#### Key Methods

##### `process(template: string, context: TemplateContext): Promise<string>`

Processes a template string with the provided context.

**Parameters:**
- `template`: The template string to process
- `context`: Variables and data to substitute

**Returns:** Promise resolving to the processed template

**Example:**
```typescript
const engine = new TemplateEngine();
const result = await engine.process(
  'Hello {{name}}!', 
  { name: 'World' }
);
// Result: "Hello World!"
```

### TemplateEngineRefactored

Enhanced version of the template engine with improved performance and features.

**Location**: `src/core/template-engine-refactored.ts`

#### Key Features
- Advanced caching mechanism
- Optimized parsing
- Enhanced error handling
- Performance monitoring

#### Methods

##### `processTemplate(template: string, context: TemplateContext): Promise<ProcessedTemplate>`

**Parameters:**
- `template`: Template content to process
- `context`: Processing context with variables and options

**Returns:** Promise resolving to processed template with metadata

## Services

### PromptOptimizationService

Service for optimizing prompt templates using various AI models and strategies.

**Location**: `src/services/prompt-optimization.service.ts`

#### Key Methods

##### `optimizeTemplate(request: OptimizationRequest): Promise<OptimizationResult>`

Optimizes a single template using specified strategies.

**Parameters:**
- `request`: Optimization configuration and template data

**Returns:** Promise resolving to optimization results with metrics

##### `batchOptimize(request: BatchOptimizationRequest): Promise<BatchOptimizationResult>`

Optimizes multiple templates in batch for efficiency.

### CacheService

High-performance LRU caching service with TTL support and persistence.

**Location**: `src/services/cache.service.ts`

#### Key Methods

##### `get<T>(key: string): Promise<T | undefined>`

Retrieves a value from cache.

##### `set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void>`

Stores a value in cache with optional TTL.

##### `getOrCompute<T>(key: string, computeFn: () => Promise<T>, options?: CacheSetOptions): Promise<T>`

Gets value from cache or computes it if not present.

### ConfigService

Hierarchical configuration management with validation and environment support.

**Location**: `src/services/config.service.ts`

#### Key Methods

##### `getConfig(): ProjectConfig`

Returns the complete merged configuration.

##### `setConfigValue(key: string, value: unknown): void`

Sets a specific configuration value with path notation.

## CLI Infrastructure

### CommandRegistry

Centralized command registration and execution system.

**Location**: `src/cli/command-registry.ts`

#### Key Methods

##### `register(name: string, command: ICommand): void`

Registers a new command with the registry.

##### `execute(name: string, args: string[], options: Record<string, unknown>): Promise<void>`

Executes a registered command with arguments.

### PluginLoader

Dynamic plugin discovery and loading system.

**Location**: `src/cli/plugin-loader.ts`

#### Key Methods

##### `discoverPlugins(directory: string): Promise<PluginMetadata[]>`

Discovers available plugins in a directory.

##### `loadPlugin(pluginPath: string): Promise<Plugin>`

Loads and validates a plugin from disk.

## Integration Layer

### CursorOptimizer

Optimization interface for Cursor IDE integration.

**Location**: `src/integrations/cursor/cursor-optimizer.ts`

#### Key Methods

##### `optimizeForCursor(template: CursorTemplate, options: CursorOptimizationOptions): Promise<CursorOptimizedTemplate>`

Optimizes templates specifically for Cursor IDE workflows.

### ContextBridge

Bridges context between Cursor IDE and template processing.

**Location**: `src/integrations/cursor/context-bridge.ts`

## Processors

### ConditionalProcessor

Handles conditional template logic (`{{#if}}`, `{{#unless}}`, etc.).

**Location**: `src/core/processors/conditional-processor.ts`

### LoopProcessor

Processes loop constructs (`{{#each}}`) with context enhancement.

**Location**: `src/core/processors/loop-processor.ts`

### VariableProcessor

Handles variable substitution and expression evaluation.

**Location**: `src/core/processors/variable-processor.ts`

## Utilities

### TemplateHelpers

Collection of 60+ helper functions for template processing.

**Location**: `src/core/template-helpers.ts`

#### Built-in Helpers

- **String helpers**: `upper`, `lower`, `trim`, `truncate`, `replace`
- **Math helpers**: `add`, `subtract`, `multiply`, `divide`, `round`
- **Array helpers**: `join`, `length`, `first`, `last`, `sort`
- **Date helpers**: `formatDate`, `now`, `addDays`, `diffDays`
- **Conditional helpers**: `if`, `unless`, `eq`, `ne`, `gt`, `lt`

### TemplatePartials

Manages reusable template components and includes.

**Location**: `src/core/template-partials.ts`

#### Key Methods

##### `register(name: string, content: string): void`

Registers a partial template for reuse.

##### `process(template: string, context: TemplateContext): Promise<string>`

Processes template with partial resolution.

## Error Handling

### Custom Error Types

All errors extend `EngineError` with specific error codes:

- `TemplateValidationError`: Template syntax errors
- `VariableResolutionError`: Variable resolution failures
- `PartialNotFoundError`: Missing partial templates
- `CircularDependencyError`: Circular includes detected
- `PluginLoadError`: Plugin loading failures
- `OptimizationError`: Optimization process errors

### Error Context

All errors include:
- Detailed error messages
- Context information
- Stack traces
- Recovery suggestions

## Type Definitions

### Core Types

```typescript
interface TemplateContext {
  [key: string]: unknown;
  system?: SystemContext;
  git?: GitContext;
  files?: Record<string, string>;
  terminal?: TerminalContext;
}

interface ProcessedTemplate {
  content: string;
  metadata: TemplateMetadata;
  performance: PerformanceMetrics;
}
```

### Configuration Types

```typescript
interface ProjectConfig {
  templatesDir: string;
  defaultTemplate: string;
  autoContext: AutoContextOptions;
  outputPreferences: OutputPreferences;
  marketplace: MarketplaceConfig;
  plugins: PluginConfig;
}
```

## Performance Characteristics

### Benchmarks

| Operation | Average Time | Memory Usage |
|-----------|-------------|--------------|
| Template Processing | <5ms | <2MB |
| Context Gathering | <30ms | <10MB |
| Plugin Loading | <10ms | <5MB |
| Cache Operations | <1ms | <100KB |

### Optimization Tips

1. **Use caching**: Enable template and result caching for better performance
2. **Limit context**: Only include necessary context to reduce processing time
3. **Batch operations**: Use batch APIs when processing multiple templates
4. **Monitor memory**: Use cache statistics to manage memory usage

## Security Considerations

### Plugin Sandboxing

All plugins run in secure VM contexts with:
- Limited file system access
- No network access by default
- Resource usage limits
- Permission-based API access

### Template Security

- No arbitrary code execution in templates
- Sandboxed helper functions
- Input validation and sanitization
- Safe variable resolution

## Migration Guide

### From v0.x to v1.x

Key breaking changes and migration steps for major version upgrades.

---

*This API reference is automatically generated from JSDoc comments in the source code. For the most up-to-date information, refer to the inline documentation.*
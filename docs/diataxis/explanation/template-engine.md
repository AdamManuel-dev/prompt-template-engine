# Template Engine Design

The template engine is the heart of the Cursor Prompt Template Engine, responsible for transforming templates with variables, conditionals, and loops into final output. Understanding its design helps explain how the system achieves both simplicity and power.

## Design Philosophy

### Progressive Complexity

The template engine follows a **progressive complexity** model:

**Basic Templates**: Simple variable substitution works immediately
```handlebars
Hello {{name}}, welcome to {{project}}!
```

**Intermediate Templates**: Conditionals and loops for dynamic content
```handlebars
{{#if hasFeatures}}
Features:
{{#each features}}
- {{this}}
{{/each}}
{{/if}}
```

**Advanced Templates**: Helpers, partials, and transformations
```handlebars
{{capitalize (join tags ", ")}} | Last updated: {{updated | dateFormat "MMM DD, YYYY"}}
```

This design allows users to start simple and gradually adopt more complex features as needed.

## Processing Architecture

### Pipeline Design

The engine uses a **multi-stage pipeline** architecture:

1. **Parsing Stage**: Template structure analysis
2. **Validation Stage**: Security and syntax validation  
3. **Context Resolution**: Variable and dependency gathering
4. **Processing Stage**: Sequential processor execution
5. **Output Stage**: Final rendering and formatting

### Why Pipeline Architecture?

**Separation of Concerns**: Each stage has a single, well-defined responsibility

**Composability**: Stages can be recombined for different use cases

**Testing**: Each stage can be tested independently

**Performance**: Stages can be optimized individually or run in parallel where safe

**Error Isolation**: Problems in one stage don't cascade to others

## Core Processing Components

### Variable Resolution System

The variable resolver handles the complexity of nested data access:

```typescript
// Supports dot notation: user.profile.name
// Supports array access: users[0].name  
// Supports context variables: @index, @first, @last
```

**Design Decision**: Rather than using a simple string replacement approach, the engine builds an **Abstract Syntax Tree (AST)** for variable expressions. This enables:

- **Type Safety**: Variables are resolved with proper type checking
- **Performance**: Complex expressions are pre-compiled
- **Extensibility**: New expression types can be added easily
- **Security**: Expressions are validated before execution

### Conditional Processing

Conditionals support both simple boolean checks and complex expressions:

```handlebars
{{#if (gt itemCount 0)}}
{{#each items}}
  {{#if @first}}First: {{/if}}{{name}}{{#unless @last}}, {{/unless}}
{{/each}}
{{/if}}
```

**Architecture Choice**: Conditionals are processed **recursively** rather than iteratively because:

- **Nesting Support**: Natural support for deeply nested conditions
- **Context Preservation**: Each conditional level maintains its own context
- **Else Block Handling**: Clean separation between if/else content processing
- **Error Boundaries**: Errors in nested conditions don't break parent processing

### Loop Processing

The loop processor handles arrays, objects, and provides iteration context:

```handlebars
{{#each users}}
  {{@index}}: {{name}} ({{@first}}{{@last}})
  {{#each roles}}
    - {{this}} {{#if @last}}(primary){{/if}}
  {{/each}}
{{/each}}
```

**Why Special Context Variables?**: The `@index`, `@first`, `@last` variables are provided because:

- **Common Patterns**: These are needed in most real-world templates
- **Performance**: Pre-calculated rather than computed on each access
- **Clarity**: More explicit than calculating position within templates
- **Consistency**: Same pattern works for arrays and object iteration

## Include System Design

### Hierarchical Includes

The include system supports recursive template composition:

```handlebars
{{#include "header.md"}}
{{#include "sections/{{sectionName}}.md"}}
{{#include "footer.md"}}
```

**Architecture Considerations**:

**Circular Dependency Detection**: The system tracks include chains to prevent infinite recursion

**Context Inheritance**: Included templates inherit variables from parent context

**Path Resolution**: Includes are resolved relative to template location for portability

**Conditional Includes**: Includes can be wrapped in conditionals for dynamic composition

### Why Includes Matter

Template composition enables several critical patterns:

**Modularity**: Large templates can be broken into manageable pieces

**Reusability**: Common sections can be shared across templates

**Maintenance**: Updates to shared sections propagate automatically

**Organization**: Related templates can be grouped in directories

## Security Architecture

### Template Validation

Before processing, templates go through multiple validation stages:

**Syntax Validation**: Ensures template syntax is correct
**Security Validation**: Scans for potentially dangerous patterns
**Variable Validation**: Checks that required variables are available
**Include Validation**: Verifies include paths are safe and accessible

### Sandboxed Execution

Template processing runs in a controlled environment:

**Resource Limits**: Memory and execution time constraints
**File System Restrictions**: Limited to safe directory paths
**API Restrictions**: Only approved functions are accessible
**Error Isolation**: Template errors don't crash the host process

### Why Security-First Design?

Templates can contain user-provided content and are executed with system privileges. The security-first approach:

- **Prevents Code Injection**: Templates cannot execute arbitrary code
- **Limits Resource Usage**: Protects against denial-of-service attacks
- **Isolates Failures**: Template errors don't compromise the system
- **Enables Safe Sharing**: Templates can be shared without security review

## Performance Considerations

### Caching Strategy

The engine implements **multi-level caching**:

**Template Parsing**: Parsed templates are cached to avoid re-parsing
**Variable Resolution**: Resolved variable paths are cached
**Helper Results**: Helper function results are cached when pure
**Include Processing**: Processed includes are cached with dependency tracking

### Lazy Evaluation

Processing is deferred until needed:

**Conditional Content**: Content in false conditions is never processed
**Unused Variables**: Variables not referenced in output are not resolved
**Helper Functions**: Only called when their result is actually needed

### Why These Performance Choices?

**Real-World Usage**: Templates are often reused with different contexts
**Resource Constraints**: CLI tools need to start quickly and use minimal memory
**Scalability**: Caching enables processing large numbers of templates efficiently

## Extension Points

### Helper System

Helpers provide computational capabilities within templates:

```typescript
// Built-in helpers
{{uppercase name}}
{{date created "YYYY-MM-DD"}}
{{#if (equals status "active")}}...{{/if}}

// Custom helpers via plugins
{{myCustomHelper value options}}
```

**Design Rationale**: Helpers are functions rather than template syntax because:

- **Reusability**: Same helper can be used in different contexts
- **Testing**: Helpers can be unit tested independently
- **Type Safety**: Parameters and return values can be type-checked
- **Performance**: Helpers can be optimized or memoized

### Transform System

Transforms provide data transformation pipelines:

```handlebars
{{name | uppercase | truncate 20}}
{{items | map "name" | join ", "}}
```

**Pipeline Philosophy**: Transforms use Unix-style piping because:

- **Familiarity**: Developers understand pipe syntax
- **Composability**: Transforms can be chained arbitrarily
- **Readability**: Data flow is left-to-right, easy to follow
- **Extensibility**: New transforms integrate seamlessly

## Error Handling Philosophy

### Graceful Degradation

The engine prioritizes **graceful degradation** over strict failure:

**Missing Variables**: Render empty strings rather than failing
**Invalid Includes**: Skip missing includes with warnings
**Helper Errors**: Fall back to original value if helper fails
**Syntax Errors**: Provide helpful error messages with context

### Why Graceful Degradation?

Templates are often used in automated workflows where:

- **Partial Success**: Better to get some output than none
- **Development Flow**: Easier to iterate with immediate feedback
- **Production Reliability**: Systems continue working with degraded functionality
- **User Experience**: Clear error messages rather than cryptic failures

## Evolution and Future Considerations

### Extensibility Design

The template engine is designed to evolve:

**Plugin Integration**: Processors can be added via plugins
**Custom Syntax**: New template syntax can be added through processors  
**Performance Optimization**: Individual processors can be optimized independently
**Feature Flags**: New features can be enabled gradually

### Backward Compatibility

Breaking changes are minimized through:

**Additive Changes**: New features don't change existing behavior
**Deprecation Path**: Old features are deprecated before removal
**Version Detection**: Templates can specify required engine versions
**Migration Tools**: Automated migration for breaking changes

## Conclusion

The template engine's design balances several competing concerns: simplicity for basic use cases, power for advanced scenarios, security for safe execution, and performance for real-world usage.

The pipeline architecture, progressive complexity model, and security-first approach create a system that is both approachable for newcomers and powerful enough for sophisticated template processing needs. Understanding these design decisions helps users make the most of the engine's capabilities while working within its intentional constraints.
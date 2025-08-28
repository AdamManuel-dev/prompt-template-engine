# Reference Documentation Index

This section provides complete specification and reference material for the Cursor Prompt Template Engine. The information here is dry, factual, and comprehensive - designed for developers who need precise technical details.

## Reference Categories

### [CLI Commands](./cli-commands.md)
Complete specification of all command-line interface commands, options, and arguments.

### [Template Syntax](./template-syntax.md)
Full language specification for template files including variables, conditionals, loops, includes, helpers, and transformations.

### [Programmatic API](./api.md)
Complete API reference for using the template engine programmatically in Node.js applications.

### [Configuration Schema](./configuration-schema.md)
Comprehensive configuration options and file formats.

### [PromptWizard API](./promptwizard-api.md)
Complete API reference for PromptWizard integration, types, and interfaces.

### [Optimization Commands](./optimization-commands.md)
Full specification of PromptWizard CLI commands and options.

## Quick Reference

### Core Commands
- `cursor-prompt generate <template>` - Generate prompt from template
- `cursor-prompt list` - List available templates
- `cursor-prompt init` - Initialize project
- `cursor-prompt validate <template>` - Validate template

### Template Syntax Elements
- `{{variable}}` - Variable substitution
- `{{#if condition}}...{{/if}}` - Conditional blocks
- `{{#each array}}...{{/each}}` - Iteration blocks
- `{{#include "file"}}` - Include external templates
- `{{helper arg1 arg2}}` - Helper functions

### Configuration Files
- `.cursor-prompt.config.json` - Primary configuration
- `.cursorprompt.json` - Alternative configuration
- `template.json` - Template metadata

## File Structure

```
project/
├── .cursor-prompt.config.json    # Configuration
├── templates/                    # Template directory
│   ├── feature.md               # Template files
│   └── partials/                # Shared template parts
├── .cursor/                     # Cursor IDE integration
│   └── rules/                   # Generated rules
└── dist/                        # Generated output
```

## Type Definitions

The engine is written in TypeScript and exports complete type definitions. Key interfaces:

- `Template` - Template configuration
- `TemplateContext` - Variable context
- `Config` - Application configuration
- `ValidationResult` - Validation output

## Compliance

- **Node.js**: Requires >= 18.0.0
- **File Formats**: JSON, YAML, Markdown
- **Encoding**: UTF-8
- **Path Separators**: Cross-platform (Node.js path module)
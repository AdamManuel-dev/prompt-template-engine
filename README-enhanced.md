# Cursor Prompt Template Engine 🚀

A powerful, context-aware template engine for generating intelligent prompts in Cursor IDE. Automatically gathers Git, file, and system context to create comprehensive, tailored prompts for AI-assisted development.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22.0%2B-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-273%20passing-brightgreen)](tests/)

## ✨ Features

### 🎯 Context-Aware Templates
- **Automatic Git Integration**: Branch, status, commits, diffs
- **Smart File Discovery**: Respects .gitignore, size-aware processing
- **System Information**: Platform, Node version, working directory
- **Terminal History**: Capture command outputs and errors

### 🔧 Advanced Templating
- **Conditionals**: `{{#if}}`, `{{#unless}}` blocks
- **Loops**: `{{#each}}` for arrays with index/first/last helpers
- **Includes**: `{{#include "path"}}` for modular templates
- **Variables**: Rich variable substitution with defaults

### 📋 Smart Templates
- **Debug Assistant**: Intelligent debugging with full context
- **Code Review**: Comprehensive review checklist with repo state
- **Test Generation**: Generate tests based on existing code
- **Performance Optimization**: Analyze and optimize with context

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/cursor-prompt-template-engine.git
cd cursor-prompt-template-engine

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

### Basic Usage

```bash
# Generate a prompt with automatic context
cursor-prompt gen smart-debug -v '{"issue": "App crashes on startup"}'

# Generate without context (faster)
cursor-prompt gen simple-template --no-context

# Preview mode
cursor-prompt gen code-review --preview

# Output to file
cursor-prompt gen test-generation -o output.md

# Copy to clipboard
cursor-prompt gen performance-optimization --clipboard
```

## 📖 Documentation

### CLI Commands

#### `generate` (alias: `gen`)
Generate prompts from templates with automatic context gathering.

```bash
cursor-prompt gen <template> [options]
```

**Options:**
- `-v, --variables <json>`: Template variables as JSON
- `-o, --output <file>`: Save to file
- `-c, --clipboard`: Copy to clipboard
- `-p, --preview`: Preview without generating
- `-f, --format <type>`: Output format (markdown/plain/json)
- `--no-context`: Disable context gathering
- `--include-git`: Force include git context
- `--include-files`: Force include file context
- `--file-patterns <patterns>`: File patterns to include
- `--context-files <files>`: Specific files to include

#### `list` (alias: `ls`)
List available templates.

```bash
cursor-prompt list [options]
```

#### `validate`
Validate template syntax.

```bash
cursor-prompt validate <template-path>
```

#### `config`
Manage configuration settings.

```bash
cursor-prompt config [options]
```

### Template Syntax

#### Variables
```markdown
Hello {{name}}!
Default: {{message|No message provided}}
```

#### Conditionals
```markdown
{{#if hasError}}
Error: {{errorMessage}}
{{else}}
Success!
{{/if}}
```

#### Loops
```markdown
{{#each items}}
- Item {{@index}}: {{this}}
  {{#if @first}}(First item){{/if}}
  {{#if @last}}(Last item){{/if}}
{{/each}}
```

#### Includes
```markdown
{{#include "templates/header.md"}}
Main content here
{{#include "templates/footer.md"}}
```

### Creating Templates

Templates use YAML frontmatter for metadata and configuration:

```markdown
---
name: My Template
description: A custom template
context:
  git: true
  system: true
  files:
    - package.json
    - tsconfig.json
  patterns:
    - "src/**/*.ts"
variables:
  projectName:
    description: Name of the project
    required: true
  environment:
    description: Target environment
    default: development
---

# {{projectName}}

Environment: {{environment}}

{{#if git}}
## Git Status
Branch: {{git.branch}}
Clean: {{git.isClean}}
{{/if}}

{{#if files}}
## Configuration Files
{{#each files}}
### {{@key}}
```
{{this}}
```
{{/each}}
{{/if}}
```

### Context Object

The context object available in templates includes:

```typescript
{
  system: {
    platform: string,
    nodeVersion: string,
    cwd: string,
    user: string,
    timestamp: Date
  },
  git: {
    branch: string,
    isClean: boolean,
    files: {
      staged: string[],
      modified: string[],
      untracked: string[]
    },
    lastCommit: {
      hash: string,
      author: string,
      date: Date,
      message: string
    }
  },
  project: {
    totalFiles: number,
    totalSize: number,
    mainLanguage: string
  },
  files: {
    [path: string]: string // File contents
  }
}
```

## 🧪 Development

### Project Structure

```
cursor-prompt-template-engine/
├── src/
│   ├── commands/          # CLI commands
│   ├── core/              # Template engine core
│   ├── services/          # Context gathering services
│   └── utils/             # Utilities
├── templates/             # Built-in templates
├── tests/                 # Test suites
└── docs/                  # Documentation
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Building

```bash
# TypeScript compilation
npm run build

# Watch mode
npm run dev

# Lint
npm run lint

# Format
npm run format
```

## 🎯 Use Cases

### 1. Debugging
Generate comprehensive debug prompts with full context:
```bash
cursor-prompt gen smart-debug -v '{"issue": "Memory leak in production"}'
```

### 2. Code Review
Create detailed review requests:
```bash
cursor-prompt gen code-review -v '{"focus": "security"}'
```

### 3. Test Generation
Generate test suites for existing code:
```bash
cursor-prompt gen test-generation -v '{"targetFile": "src/services/api.ts"}'
```

### 4. Performance Analysis
Analyze performance with repository context:
```bash
cursor-prompt gen performance-optimization -v '{"area": "database queries"}'
```

## 🔧 Configuration

Create `.cursor-prompt.json` in your project:

```json
{
  "templatePaths": ["./my-templates"],
  "defaultVariables": {
    "author": "Your Name",
    "team": "Your Team"
  },
  "context": {
    "maxFileSize": 102400,
    "excludePatterns": ["dist/**", "coverage/**"]
  }
}
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Commander.js](https://github.com/tj/commander.js/) for CLI
- Uses [Chalk](https://github.com/chalk/chalk) for terminal styling
- Inspired by Handlebars and Mustache template engines

## 📞 Support

- [Report Issues](https://github.com/yourusername/cursor-prompt-template-engine/issues)
- [Documentation](https://github.com/yourusername/cursor-prompt-template-engine/wiki)
- [Discussions](https://github.com/yourusername/cursor-prompt-template-engine/discussions)

---

Built with ❤️ for the Cursor IDE community
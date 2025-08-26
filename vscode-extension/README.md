# Cursor Prompt Template Engine

Transform your AI coding workflow with intelligent template-based prompt generation for Cursor IDE.

## 🚀 Features

### Template-Based Prompt Generation
- **50+ Built-in Templates**: Ready-to-use templates for common development tasks
- **Custom Templates**: Create your own templates with YAML or JSON
- **Variable Substitution**: Dynamic content generation with placeholders
- **Context Awareness**: Automatically includes relevant files and code

### Cursor IDE Integration
- **Rules Synchronization**: Auto-sync templates to `.cursor/rules/*.mdc` format
- **Legacy Support**: Compatible with `.cursorrules` files
- **Real-time Updates**: Changes sync automatically to Cursor
- **Command Palette**: Quick access to all features

### Smart Context Management
- **File References**: Automatic `@file` reference generation
- **Git Integration**: Include git status and branch information
- **Error Context**: Capture and include error messages
- **Selection Aware**: Use selected text as template input

### Developer Experience
- **Quick Fix Integration**: Apply templates directly from error diagnostics
- **Keyboard Shortcuts**: Fast access with customizable keybindings
- **Preview Mode**: See generated prompts before applying
- **Clipboard Support**: Copy prompts with one click

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code or Cursor IDE
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac)
3. Search for "Cursor Prompt Template Engine"
4. Click Install

### From Command Line
```bash
code --install-extension cursor-prompt-team.cursor-prompt-template-engine
```

### For CLI Usage
```bash
npm install -g cursor-prompt
```

## 🎯 Quick Start

### 1. Initialize in Your Project
```bash
cursor-prompt init
```
This creates:
- `.cursor/` - Cursor configuration directory
- `templates/` - Your template directory
- `.cursorprompt.json` - Configuration file
- Example templates to get started

### 2. Generate Your First Prompt
**Using Command Palette:**
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
2. Type "Cursor Prompt: Generate"
3. Select a template
4. Fill in variables
5. Prompt is generated and ready to use!

**Using Keyboard Shortcut:**
- Press `Ctrl+Shift+G` (or `Cmd+Shift+G`) to quickly generate

### 3. Sync to Cursor Rules
Templates automatically sync to Cursor's rules system:
```bash
cursor-prompt sync
```

## 📝 Template Examples

### Bug Fix Template
```yaml
name: bug-fix
description: Generate a bug fix prompt with context
variables:
  error_message:
    type: string
    description: The error message
  file_path:
    type: string
    description: File where error occurs

content: |
  Fix the following error in {{file_path}}:
  
  Error: {{error_message}}
  
  Context:
  @file:{{file_path}}
  
  Requirements:
  - Identify root cause
  - Implement fix
  - Add error handling
  - Include tests
```

### Feature Implementation Template
```yaml
name: feature
description: Implement a new feature
variables:
  feature_name:
    type: string
    required: true
  requirements:
    type: text
    required: true

content: |
  Implement {{feature_name}}
  
  Requirements:
  {{requirements}}
  
  Context:
  @file:src/**/*.ts
  
  Please:
  1. Design the implementation
  2. Write clean, maintainable code
  3. Add comprehensive tests
  4. Update documentation
```

## ⌨️ Keyboard Shortcuts

| Command | Windows/Linux | Mac |
|---------|--------------|-----|
| Generate from Template | `Ctrl+Shift+G` | `Cmd+Shift+G` |
| List Templates | `Ctrl+Shift+L` | `Cmd+Shift+L` |
| Sync Rules | `Ctrl+Shift+S` | `Cmd+Shift+S` |

## ⚙️ Configuration

Configure in VS Code settings or `.cursorprompt.json`:

```json
{
  "cursorPrompt.autoSync": true,
  "cursorPrompt.syncInterval": 30000,
  "cursorPrompt.rulesOutputDir": ".cursor/rules",
  "cursorPrompt.legacySupport": true,
  "cursorPrompt.templatePaths": [
    "./templates",
    "./.cursor/templates"
  ]
}
```

## 🔧 CLI Commands

The extension includes a powerful CLI:

```bash
# Generate prompt from template
cursor-prompt generate <template> -v '{"var": "value"}'

# List available templates
cursor-prompt list --detailed

# Sync templates to Cursor rules
cursor-prompt sync

# Watch templates for changes
cursor-prompt watch

# Validate template syntax
cursor-prompt validate <template-file>
```

## 🎨 Creating Custom Templates

### Template Structure
```yaml
name: my-template
description: Template description
version: 1.0.0
tags: [custom, example]

# Define variables
variables:
  component_name:
    type: string
    required: true
    description: React component name
  
  props:
    type: text
    default: ""
    description: Component props

# Template content with placeholders
content: |
  Create a React component named {{component_name}}
  
  Props:
  {{props}}
  
  Requirements:
  - Use TypeScript
  - Include proper types
  - Add JSDoc comments
  - Follow React best practices
```

### Variable Types
- `string` - Single line text
- `text` - Multi-line text
- `number` - Numeric values
- `boolean` - True/false
- `choice` - Select from options
- `array` - List of values

## 🔍 Advanced Features

### Context Injection
Automatically include file contents:
```yaml
content: |
  Review this code:
  @file:src/components/Button.tsx
  @file:src/components/Button.test.tsx
```

### Conditional Content
```yaml
content: |
  {{#if useTypeScript}}
  import type { FC } from 'react';
  {{else}}
  import React from 'react';
  {{/if}}
```

### Template Inheritance
```yaml
extends: base-template
variables:
  # Additional variables
  extra_var: value
```

## 🐛 Troubleshooting

### Templates Not Syncing
1. Check auto-sync is enabled: `cursorPrompt.autoSync: true`
2. Verify template directory exists
3. Check for syntax errors: `cursor-prompt validate <template>`

### Extension Not Activating
1. Ensure you're using VS Code 1.85.0 or later
2. Check the Output panel for errors
3. Try reloading the window: `Ctrl+R` (or `Cmd+R`)

### Command Not Found
1. Ensure global installation: `npm install -g cursor-prompt`
2. Check PATH includes npm global directory
3. Try using npx: `npx cursor-prompt <command>`

## 📚 Resources

- [Documentation](https://github.com/AdamManuel-dev/cursor-prompt-template-engine#readme)
- [Template Library](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/tree/main/templates)
- [Issue Tracker](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/issues)
- [Changelog](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/blob/main/CHANGELOG.md)

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](https://github.com/AdamManuel-dev/cursor-prompt-template-engine/blob/main/CONTRIBUTING.md) for guidelines.

## 📄 License

MIT © Adam Manuel

---

**Enjoy coding with Cursor Prompt Template Engine!** 🚀

If you find this extension helpful, please consider:
- ⭐ Starring the [GitHub repository](https://github.com/AdamManuel-dev/cursor-prompt-template-engine)
- 📝 Leaving a review on the VS Code Marketplace
- 🐛 Reporting issues or suggesting features
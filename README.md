# Cursor Prompt Template Engine 🚀

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A lightweight, high-performance TypeScript CLI tool that revolutionizes prompt creation for Cursor IDE + Claude AI. Generate consistent, context-rich prompts in seconds using reusable templates and automated context gathering.

## ✨ Features

### 🎯 Core Capabilities
- **Smart Templates**: Pre-built templates for common tasks (bug fixes, features, refactoring, reviews)
- **Automated Context**: Automatically gathers git diff, file contents, terminal output
- **Variable Substitution**: Powerful `{{variable}}` syntax with conditionals and loops
- **Zero Config**: Works out of the box with sensible defaults
- **Lightning Fast**: <100ms execution time for typical usage
- **Plugin System**: Extensible architecture for custom commands and integrations
- **Cursor IDE Integration**: Direct synchronization with Cursor IDE for seamless workflow
- **Advanced Configuration**: Hierarchical config with environment variable support

### 🔥 Why Cursor Prompt Template Engine?

- **50% Time Savings**: Cut prompt writing time in half
- **Consistency**: Ensure all prompts follow best practices
- **Context-Aware**: Automatically includes relevant project context
- **Cursor-Optimized**: Built specifically for Cursor IDE workflows with deep integration
- **Template Library**: Extensible template system for custom workflows
- **Plugin Architecture**: Create custom commands and extend functionality
- **Real-time Sync**: Live template synchronization with Cursor IDE

## 📦 Installation

### npm (Recommended)
```bash
npm install -g cursor-prompt
```

### Direct Binary
Download the latest release for your platform:
- [Windows](https://github.com/yourusername/cursor-prompt/releases)
- [macOS](https://github.com/yourusername/cursor-prompt/releases)
- [Linux](https://github.com/yourusername/cursor-prompt/releases)

### From Source
```bash
git clone https://github.com/yourusername/cursor-prompt-template-engine.git
cd cursor-prompt-template-engine
npm install
npm run build
npm link
```

## 🚀 Quick Start

### Basic Usage
```bash
# Initialize a new project
cursor-prompt init

# Generate a prompt from template
cursor-prompt generate <template> --variables '{"key": "value"}'

# List available templates
cursor-prompt list

# Sync with Cursor IDE
cursor-prompt cursor:sync

# Inject template directly into Cursor
cursor-prompt cursor:inject <template>
```

### Legacy Command Examples
```bash
# Generate a bug fix prompt
cursor-prompt generate bug-fix --variables '{"error": "undefined variable", "location": "auth.ts:45"}'

# Generate a feature prompt
cursor-prompt generate feature --variables '{"description": "Add user authentication"}'

# Generate a refactor prompt
cursor-prompt generate refactor --variables '{"files": "src/api/*.ts", "goal": "Extract service layer"}'
```

### Available Commands

#### Core Commands
- `init` - Initialize a new prompt template project
- `generate <template>` - Generate prompt from template
- `list` - List available templates
- `apply <template>` - Apply template to current project
- `validate <path>` - Validate template structure
- `config` - Manage configuration settings

#### Cursor IDE Integration
- `cursor:sync` - Sync templates with Cursor IDE
- `cursor:inject <template>` - Inject template into Cursor
- `cursor:status` - Show Cursor connection status

#### Plugin Management
- `plugin:list` - List installed plugins
- `plugin:load <name>` - Load a plugin
- `plugin:unload <name>` - Unload a plugin

### Built-in Templates
- `bug-fix` - Debug and fix issues
- `feature` - Implement new features
- `refactor` - Improve existing code
- `review` - Code review prompts
- `test` - Generate test cases

## 📖 Examples

### Bug Fix Template
```bash
cursor-prompt bug-fix \
  --error "Cannot read property 'id' of undefined" \
  --location "src/components/UserList.tsx:34" \
  --include-git-diff
```

Output:
```markdown
@src/components/UserList.tsx @git:diff

<error_context>
Error: Cannot read property 'id' of undefined
Location: src/components/UserList.tsx:34
</error_context>

<task>
Fix the bug described above. The error occurs when accessing user.id.
</task>

<requirements>
- Identify root cause
- Implement minimal fix
- Preserve existing functionality
- Add error handling if missing
</requirements>
```

### Feature Implementation
```bash
cursor-prompt feature \
  --description "Add dark mode toggle" \
  --files "src/components/Settings.tsx" \
  --context "React application with Material-UI"
```

### Custom Templates
Create your own templates in `.cursor/templates/`:

```markdown
# .cursor/templates/custom-analysis.md
{{#if files}}
{{files}}
{{/if}}

<analysis_request>
{{description}}
</analysis_request>

<focus_areas>
{{#each areas}}
- {{this}}
{{/each}}
</focus_areas>

Please analyze the code focusing on the specified areas.
```

## ⚙️ Configuration

### Default Configuration
The tool works with zero configuration. To customize, create `.cursorprompt.json`:

```json
{
  "templatesDir": ".cursor/templates",
  "defaultTemplate": "feature",
  "autoContext": {
    "includeGitDiff": true,
    "includeOpenFiles": true,
    "terminalLines": 50
  },
  "outputPreferences": {
    "copyToClipboard": true,
    "showPreview": false,
    "colorOutput": true
  }
}
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `templatesDir` | string | `.cursor/templates` | Template directory location |
| `defaultTemplate` | string | `feature` | Default template to use |
| `autoContext.includeGitDiff` | boolean | true | Include git diff in context |
| `autoContext.includeOpenFiles` | boolean | true | Include open files |
| `autoContext.terminalLines` | number | 50 | Terminal lines to capture |
| `outputPreferences.copyToClipboard` | boolean | true | Auto-copy to clipboard |
| `outputPreferences.showPreview` | boolean | false | Show preview before copying |
| `outputPreferences.colorOutput` | boolean | true | Use colored output |

## 🛠️ Advanced Usage

### Command Line Options
```bash
cursor-prompt [template] [options]

Options:
  -e, --error <message>      Error message for bug-fix template
  -l, --location <path>      Error location (file:line)
  -d, --description <text>   Feature/task description
  -f, --files <pattern>      File glob pattern to include
  -g, --goal <text>         Refactoring goal
  --preview                  Preview without copying
  --output <file>           Save to file instead of clipboard
  --no-clipboard            Don't copy to clipboard
  --no-context              Skip auto context gathering
  --config <path>           Custom config file path
  --verbose                 Detailed output
  -h, --help               Display help
  -v, --version            Display version
```

### Environment Variables
```bash
# Override default template directory
export CURSOR_PROMPT_TEMPLATES="/path/to/templates"

# Disable colored output
export NO_COLOR=1

# Custom config location
export CURSOR_PROMPT_CONFIG="/path/to/config.json"
```

### Programmatic Usage
```typescript
import { CursorPrompt } from 'cursor-prompt';

const prompt = new CursorPrompt({
  template: 'bug-fix',
  variables: {
    error_message: 'undefined variable',
    error_location: 'auth.ts:45'
  }
});

const result = await prompt.generate();
console.log(result);
```

## 📚 Template Syntax

### Variables
```markdown
Simple variable: {{variable_name}}
Nested object: {{user.name}}
Array access: {{items.0}}
```

### Conditionals
```markdown
{{#if variable}}
  This shows if variable exists
{{/if}}

{{#unless variable}}
  This shows if variable doesn't exist
{{/unless}}
```

### Loops
```markdown
{{#each items}}
  - {{this}}
{{/each}}

{{#each users}}
  - {{this.name}} ({{this.email}})
{{/each}}
```

### Special Variables
- `{{files}}` - Included file contents
- `{{git_diff}}` - Current git diff
- `{{git_branch}}` - Current branch name
- `{{terminal_output}}` - Recent terminal output
- `{{timestamp}}` - Current timestamp

## 🔄 Cursor Integration

### Workflow with Cursor
1. **Generate Prompt**: Run `cursor-prompt` with appropriate template
2. **Automatic Copy**: Prompt is copied to clipboard
3. **Paste in Cursor**: Press `Cmd+L` (Mac) or `Ctrl+L` (Windows/Linux)
4. **Claude Response**: Get instant, context-aware assistance

### .cursorrules Integration
The tool can generate dynamic `.cursorrules` based on your templates:

```bash
cursor-prompt generate-rules --template feature > .cursorrules
```

### Future Cursor-Native Features (Roadmap)
- Direct Cursor chat integration
- Composer mode templates
- Symbol-aware context gathering
- Cursor command palette integration

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --testNamePattern="Template"

# Watch mode for development
npm run test:watch
```

## 🚢 Development

### Setup Development Environment
```bash
# Clone repository
git clone https://github.com/yourusername/cursor-prompt-template-engine.git
cd cursor-prompt-template-engine

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Link for local testing
npm link
```

### Project Structure
```
cursor-prompt-template-engine/
├── src/
│   ├── cli/               # CLI entry point and commands
│   ├── templates/         # Template engine
│   ├── context/          # Context gathering
│   ├── output/           # Output formatting
│   └── config/           # Configuration management
├── templates/            # Default templates
├── tests/               # Test suites
├── docs/                # Documentation
└── plan/                # Project planning documents
```

### Contributing
We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

#### Development Workflow
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📈 Performance

### Benchmarks
| Operation | Time | Memory |
|-----------|------|--------|
| Startup | <50ms | <30MB |
| Template Load | <5ms | <2MB |
| Context Gather | <30ms | <10MB |
| Total (typical) | <100ms | <50MB |

### Optimization Tips
- Use `--no-context` for faster execution when context isn't needed
- Cache templates with frequent usage
- Limit file patterns to specific directories
- Use preview mode to verify before clipboard operations

## 🔧 Troubleshooting

### Common Issues

#### Clipboard Access Denied
**Solution**: The tool will fall back to console output. You can pipe to clipboard manually:
```bash
cursor-prompt feature --description "..." | pbcopy  # macOS
cursor-prompt feature --description "..." | clip    # Windows
cursor-prompt feature --description "..." | xclip   # Linux
```

#### Template Not Found
**Solution**: Check template directory path in config:
```bash
cursor-prompt list  # List available templates
```

#### Large Context Warning
**Solution**: The tool automatically truncates large contexts. Adjust limits in config:
```json
{
  "filePatterns": {
    "maxFileSize": "100KB"
  }
}
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the amazing [Cursor IDE](https://cursor.sh) community
- Inspired by best practices in prompt engineering
- Powered by TypeScript and Node.js ecosystem

## 🚀 Roadmap

### Version 1.0 (Current)
- ✅ Core template engine
- ✅ Context gathering
- ✅ CLI interface
- ✅ Configuration system

### Version 2.0 (Week 2)
- 🔄 Cursor-native integration
- 🔄 Interactive prompt builder
- 🔄 Intelligent caching

### Version 3.0 (Week 3)
- 📅 AI-powered optimization
- 📅 Template marketplace
- 📅 Team collaboration
- 📅 Analytics dashboard

## 📞 Support

- **Documentation**: [Full Docs](https://github.com/yourusername/cursor-prompt/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/cursor-prompt/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/cursor-prompt/discussions)
- **Discord**: [Join our Discord](https://discord.gg/cursor-prompt)

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=AdamManuel-dev/cursor-prompt-template-engine&type=Date)](https://www.star-history.com/#AdamManuel-dev/cursor-prompt-template-engine&Date)

---

**Built with ❤️ for developers using Cursor + Claude**

*Making prompt engineering delightful, one template at a time.*
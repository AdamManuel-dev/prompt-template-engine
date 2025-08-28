# Product Requirements Document: Cursor Prompt Template Engine

## Executive Summary

### Product Overview
A TypeScript CLI tool that accelerates Cursor + Claude interactions through reusable prompt templates and automated context gathering. The tool focuses on eliminating repetitive prompt writing while maintaining flexibility for developers.

### Target Users
- Developers using Cursor IDE with Claude AI
- Teams standardizing AI-assisted development workflows
- Individual developers seeking consistent prompt quality

### Success Metrics
- 50% reduction in time spent writing prompts
- <100ms execution time for template generation
- Zero-configuration setup for basic usage
- 80% of prompts use templates vs manual writing

## Functional Requirements

### Core Features

#### F1: Template Management
**Description**: Load and process markdown-based prompt templates with variable substitution.

**User Stories**:
- As a developer, I want to use predefined templates so I can quickly generate consistent prompts
- As a developer, I want to create custom templates so I can address project-specific needs
- As a developer, I want to override template variables so I can customize output

**Acceptance Criteria**:
- [ ] Templates load from `.cursor/templates/` directory
- [ ] Support `{{variable}}` placeholder syntax
- [ ] Templates support optional sections with `{{#if variable}}...{{/if}}`
- [ ] Default templates provided for: bug_fix, feature, refactor, review, test
- [ ] Custom templates can be added without code changes
- [ ] Template validation reports missing required variables

#### F2: Context Gathering
**Description**: Automatically collect relevant project context for template variables.

**User Stories**:
- As a developer, I want automatic file context so I don't manually specify files
- As a developer, I want git information included so Claude understands recent changes
- As a developer, I want terminal output captured so error context is preserved

**Acceptance Criteria**:
- [ ] Detect currently open files in workspace
- [ ] Capture git diff for staged/unstaged changes
- [ ] Capture last N lines of terminal output
- [ ] Support glob patterns for file selection (e.g., `src/**/*.ts`)
- [ ] Include file contents with line numbers for specified files
- [ ] Respect .gitignore when gathering context

#### F3: CLI Interface
**Description**: Simple command-line interface for template selection and execution.

**User Stories**:
- As a developer, I want quick command access so I can generate prompts rapidly
- As a developer, I want to see available templates so I know my options
- As a developer, I want helpful error messages so I can fix issues quickly

**Acceptance Criteria**:
- [ ] Primary command: `cursor-prompt <template> [options]`
- [ ] List templates: `cursor-prompt list`
- [ ] Show help: `cursor-prompt --help`
- [ ] Template-specific help: `cursor-prompt bug-fix --help`
- [ ] Support both flags and interactive mode for missing variables
- [ ] Colored output for better readability

#### F4: Output Management
**Description**: Deliver formatted prompts ready for Cursor consumption.

**User Stories**:
- As a developer, I want prompts copied to clipboard so I can paste directly
- As a developer, I want to preview prompts before copying so I can verify content
- As a developer, I want to save prompts to files so I can reuse them

**Acceptance Criteria**:
- [ ] Copy to clipboard by default
- [ ] Show preview with `--preview` flag
- [ ] Save to file with `--output <file>` option
- [ ] Format output as Cursor-compatible markdown
- [ ] Include success confirmation message
- [ ] Handle clipboard errors gracefully

### Template Specifications

#### Default Template Structure
```markdown
# templates/bug_fix.md
{{#if files}}
{{files}}
{{/if}}

<error_context>
Error: {{error_message}}
Location: {{error_location}}
{{#if stack_trace}}
Stack trace:
{{stack_trace}}
{{/if}}
</error_context>

<task>
Fix the bug described above. The error occurs {{error_context}}.
</task>

<requirements>
- Identify root cause
- Implement minimal fix
- Preserve existing functionality
- Add error handling if missing
{{#if test_required}}
- Include unit test for the fix
{{/if}}
</requirements>
```

#### Variable Types
| Variable | Type | Source | Required |
|----------|------|--------|----------|
| `files` | string | File selector | No |
| `error_message` | string | User input | Yes |
| `error_location` | string | User input | No |
| `stack_trace` | string | Terminal/User | No |
| `git_diff` | string | Git command | No |
| `current_branch` | string | Git command | No |
| `recent_commits` | string | Git command | No |

### Configuration

#### Configuration File Structure
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
  },
  "filePatterns": {
    "ignore": ["node_modules", "dist", ".git"],
    "maxFileSize": "100KB"
  }
}
```

## Non-Functional Requirements

### Performance
- **Startup time**: <50ms to command execution
- **Template processing**: <20ms for variable substitution
- **Context gathering**: <100ms for typical project
- **Memory usage**: <50MB for normal operation

### Usability
- **Zero configuration**: Works immediately after installation
- **Intuitive commands**: Follow Unix CLI conventions
- **Clear errors**: Actionable error messages with solutions
- **Documentation**: Built-in help for all commands

### Compatibility
- **Node.js**: Support v18+ (LTS versions)
- **Operating Systems**: Windows, macOS, Linux
- **Cursor**: Compatible with all Cursor versions
- **Git**: Works with git 2.0+

### Security
- **No network calls**: Fully offline operation
- **No data collection**: Zero telemetry
- **Safe file access**: Respect OS permissions
- **Secure clipboard**: Use OS-native clipboard APIs

## Technical Requirements

### Architecture

#### Component Structure
```
cursor-prompt/
├── src/
│   ├── cli/
│   │   ├── index.ts           # Entry point
│   │   ├── commands.ts        # Command handlers
│   │   └── parser.ts          # Argument parsing
│   ├── templates/
│   │   ├── loader.ts          # Template file loading
│   │   ├── processor.ts       # Variable substitution
│   │   └── validator.ts       # Template validation
│   ├── context/
│   │   ├── files.ts           # File context gathering
│   │   ├── git.ts             # Git information
│   │   └── terminal.ts        # Terminal output capture
│   ├── output/
│   │   ├── formatter.ts       # Markdown formatting
│   │   ├── clipboard.ts       # Clipboard operations
│   │   └── file.ts            # File output
│   └── config/
│       ├── loader.ts          # Config file loading
│       └── defaults.ts        # Default configuration
├── templates/                  # Default templates
├── tests/                      # Test files
└── package.json
```

### Dependencies
```json
{
  "dependencies": {
    "commander": "^11.0.0",      // CLI framework
    "clipboardy": "^3.0.0",       // Clipboard access
    "chalk": "^5.3.0",            // Colored output
    "glob": "^10.3.0",            // File pattern matching
    "inquirer": "^9.2.0"          // Interactive prompts (optional)
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.0.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "ts-node": "^10.9.0",
    "eslint": "^8.50.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0"
  }
}
```

### API Design

#### CLI Commands
```bash
# Basic usage
cursor-prompt <template> [options]

# Commands
cursor-prompt bug-fix --error "undefined variable" --location "auth.ts:45"
cursor-prompt feature --description "Add user authentication"
cursor-prompt refactor --files "src/api/*.ts" --goal "Extract service layer"
cursor-prompt list                   # List available templates
cursor-prompt validate <template>    # Validate template syntax

# Global options
--config <path>         # Custom config file
--template-dir <path>   # Custom templates directory
--preview              # Preview without copying
--output <file>        # Save to file
--no-clipboard         # Don't copy to clipboard
--no-context          # Skip auto context gathering
--verbose             # Detailed output
--help                # Show help
```

#### Core Interfaces
```typescript
interface Template {
  name: string;
  content: string;
  variables: TemplateVariable[];
  metadata: TemplateMetadata;
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'boolean' | 'array';
  required: boolean;
  source?: 'user' | 'git' | 'files' | 'terminal';
  default?: any;
  description?: string;
}

interface Context {
  files: FileContext[];
  git: GitContext;
  terminal: string[];
  userInputs: Map<string, any>;
}

interface FileContext {
  path: string;
  content?: string;
  lineNumbers?: boolean;
  selected: boolean;
}

interface GitContext {
  branch: string;
  diff: string;
  status: string;
  recentCommits: string[];
}

interface Config {
  templatesDir: string;
  defaultTemplate: string;
  autoContext: AutoContextConfig;
  outputPreferences: OutputConfig;
  filePatterns: FilePatternConfig;
}
```

## Edge Cases & Error Handling

### Edge Cases

#### E1: Large File Context
- **Scenario**: User selects files totaling >1MB
- **Handling**: Warn user, offer truncation or file list only
- **Implementation**: Check total size before processing

#### E2: Missing Git Repository
- **Scenario**: Project not under git version control
- **Handling**: Skip git context, continue with other context
- **Implementation**: Check for .git directory, handle gracefully

#### E3: Clipboard Access Denied
- **Scenario**: OS denies clipboard access
- **Handling**: Fall back to console output with copy instruction
- **Implementation**: Try-catch around clipboard operations

#### E4: Template Syntax Errors
- **Scenario**: Malformed template with unclosed tags
- **Handling**: Validate on load, show clear error with line number
- **Implementation**: Template parser with syntax validation

#### E5: Circular Template Includes
- **Scenario**: Template A includes Template B includes Template A
- **Handling**: Detect cycles, error with chain information
- **Implementation**: Track include chain during processing

### Error Messages

```typescript
enum ErrorCode {
  TEMPLATE_NOT_FOUND = 'E001',
  INVALID_TEMPLATE_SYNTAX = 'E002',
  MISSING_REQUIRED_VARIABLE = 'E003',
  CONTEXT_GATHERING_FAILED = 'E004',
  CLIPBOARD_ACCESS_DENIED = 'E005',
  CONFIG_INVALID = 'E006',
  FILE_TOO_LARGE = 'E007'
}

// Example error output
Error [E003]: Missing required variable 'error_message'
  Template: bug_fix
  Required variables: error_message, error_location
  
  Run with --help to see all options:
    cursor-prompt bug-fix --help
```

## User Journey

### First Time Usage
1. Install: `npm install -g cursor-prompt`
2. Run: `cursor-prompt feature --description "Add login"`
3. Tool auto-detects project, gathers context
4. Prompt copied to clipboard
5. User pastes in Cursor, gets quality response

### Daily Workflow
```bash
# Morning: Start new feature
cursor-prompt feature --description "Add user settings page"

# Found a bug
cursor-prompt bug-fix --error "Cannot read property 'id'" --location "user.ts:45"

# Code review
cursor-prompt review --files "src/api/*.ts" --focus "security"

# Refactoring
cursor-prompt refactor --files "src/utils/*" --goal "Extract common patterns"

# Custom template
cursor-prompt custom-analysis --complexity "high" --area "authentication"
```

## Testing Requirements

### Unit Tests
- Template loading and parsing
- Variable substitution logic
- Context gathering functions
- Configuration loading
- Output formatting

### Integration Tests
- CLI command execution
- File system operations
- Git command integration
- Clipboard operations
- Error handling flows

### End-to-End Tests
- Complete prompt generation flow
- Multiple template types
- Various project structures
- Error scenarios

### Test Coverage Goals
- **Overall**: 80% minimum
- **Core logic**: 95% minimum
- **CLI commands**: 70% minimum
- **Error paths**: 90% minimum

## Implementation Phases

### Phase 1: Core Foundation (Week 1)
- [x] Project setup with TypeScript
- [ ] Basic CLI structure with commander
- [ ] Template loading from files
- [ ] Simple variable substitution
- [ ] Clipboard output

### Phase 2: Context Gathering (Week 2)
- [ ] Git integration (diff, status, branch)
- [ ] File pattern matching
- [ ] Terminal output capture
- [ ] Context size management

### Phase 3: Enhanced Templates (Week 3)
- [ ] Conditional sections in templates
- [ ] Template validation
- [ ] Default templates creation
- [ ] Template includes/partials

### Phase 4: Polish & Release (Week 4)
- [ ] Error handling improvements
- [ ] Documentation and help text
- [ ] Performance optimization
- [ ] NPM package publication
- [ ] GitHub release with binaries

## Future Enhancements (Post-v1)
- Template sharing via GitHub gists
- VS Code extension for visual template selection
- Template marketplace/registry
- AI-powered template suggestions
- Team template synchronization
- Template versioning and updates
- Analytics on template usage
- Integration with other AI assistants

## Appendix

### A: Example Templates

#### Feature Template
```markdown
@{{files}}

<feature_request>
{{description}}
</feature_request>

<acceptance_criteria>
{{#each criteria}}
- {{this}}
{{/each}}
</acceptance_criteria>

<technical_approach>
{{#if approach}}
{{approach}}
{{else}}
Suggest an implementation approach following project patterns.
{{/if}}
</technical_approach>

Please implement this feature with:
- Error handling
- Input validation  
- Unit tests
- TypeScript types
```

#### Refactor Template
```markdown
@{{files}}

<refactoring_goal>
{{goal}}
</refactoring_goal>

<constraints>
- Maintain all existing functionality
- Keep all tests passing
- Preserve public API
- Improve {{focus_area}}
</constraints>

{{#if git_diff}}
<recent_changes>
{{git_diff}}
</recent_changes>
{{/if}}

Refactor the code incrementally with clear commit messages for each change.
```

### B: Configuration Examples

#### Minimal Config
```json
{
  "defaultTemplate": "feature"
}
```

#### Advanced Config
```json
{
  "templatesDir": "./prompts",
  "defaultTemplate": "custom-feature",
  "autoContext": {
    "includeGitDiff": true,
    "includeOpenFiles": false,
    "terminalLines": 100,
    "gitCommitCount": 5
  },
  "outputPreferences": {
    "copyToClipboard": true,
    "showPreview": true,
    "colorOutput": true,
    "format": "markdown"
  },
  "filePatterns": {
    "ignore": ["node_modules", "dist", "*.test.ts"],
    "maxFileSize": "50KB",
    "defaultGlob": "src/**/*.ts"
  },
  "customVariables": {
    "author": "Team Name",
    "project": "MyProject"
  }
}
```

---
*Document Version: 1.0*  
*Last Updated: 2025-08-22*  
*Status: Ready for Implementation*
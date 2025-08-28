# Feature Proposal: TypeScript Prompt Template Engine for Cursor

## Problem Statement
Developers using Cursor + Claude repeatedly write similar prompts with manual context gathering, leading to inconsistent prompt quality and wasted time. Current workflow lacks reusable templates and requires manual file selection for each interaction, making complex prompts time-consuming to construct.

## Proposed Solution
Build a lightweight TypeScript CLI tool that loads markdown prompt templates with variable placeholders and provides simple context helpers. Users can select from predefined templates (bug fix, feature, refactor), automatically gather relevant context (files, git status), and output formatted prompts ready for Cursor. Focus on template reusability over complex "optimization" logic.

## Key Benefits
- **50% reduction in prompt writing time** through reusable templates
- **Consistent prompt structure** across different task types
- **Automated context gathering** eliminates manual file selection

## Scope

### Included in v1
- TypeScript CLI tool with template loading
- 4-5 core templates (bug_fix, feature, refactor, review, test)
- Basic variable substitution (`{{variable}}` syntax)
- Context helpers for:
  - Currently open files
  - Git diff/status
  - Recent terminal output
  - File pattern matching
- Simple configuration file (.cursorprompt.json)
- Markdown output ready for Cursor

### Explicitly NOT Included
- Complex prompt "optimization" algorithms
- VS Code extension
- Interactive prompt builders with multiple steps
- AI-based prompt enhancement
- Template learning/adaptation
- Caching mechanisms
- Remote template repositories
- Team sharing features

## Technical Approach
Utilize Node.js filesystem APIs for template loading, simple string templating with regex replacement, and child_process for git commands. Templates stored as markdown files in `.cursor/templates/` directory. Configuration via JSON for simplicity. Output to clipboard using clipboardy or similar library.

### Core Components
1. **Template Loader**: Read and parse markdown templates
2. **Context Gatherer**: Collect file paths, git info, terminal output
3. **Variable Resolver**: Replace placeholders with actual values
4. **CLI Interface**: Simple commands like `cursor-prompt bug-fix`

## Complexity Assessment
**Overall Complexity**: Simple

Factors:
- Standard file I/O operations only
- No complex parsing or AST manipulation
- Minimal external dependencies (clipboard, commander.js)
- Simple string templating without logic
- Reuses Cursor's existing context features
- ~500 lines of TypeScript estimated

## Dependencies & Risks

### Technical Dependencies
- Node.js runtime (already required for development)
- TypeScript compiler
- 2-3 npm packages (commander, clipboardy, chalk)

### Risks
- **Adoption friction**: Developers might not change workflow
  - Mitigation: Make templates immediately valuable with minimal setup
- **Template maintenance**: Templates may become outdated
  - Mitigation: Keep templates simple and generic
- **Context accuracy**: Auto-gathered context might miss relevant files
  - Mitigation: Allow manual override/addition

## Success Criteria
- [ ] CLI executes in <100ms for template generation
- [ ] Templates reduce prompt writing time by 50%
- [ ] Zero configuration required for basic usage
- [ ] Works seamlessly with Cursor's copy/paste workflow
- [ ] Templates remain effective across different project types

## Open Questions
1. **Template syntax**: Use Handlebars-style `{{var}}` or simpler `$VAR` substitution?
2. **Configuration location**: Project-specific vs global templates?
3. **Context depth**: How many files should auto-context include by default?
4. **Output format**: Clipboard only or also file output option?

## Example Usage
```bash
# Generate a bug fix prompt
$ cursor-prompt bug --error "Cannot read property 'id' of undefined"

# Generate a feature prompt
$ cursor-prompt feature --description "Add user authentication"

# Generate a refactor prompt with specific files
$ cursor-prompt refactor --files "src/api/*.ts" --goal "Extract service layer"
```

## Implementation Priority
1. **Core CLI structure** - Basic command parsing and file I/O
2. **Template system** - Loading and variable substitution
3. **Context gathering** - Git and file helpers
4. **Initial templates** - Bug fix and feature templates
5. **Polish** - Error handling, colors, help text

## Human Review Required
- [ ] Assumption: Developers want templates more than "optimization"
- [ ] Derived requirement: 50% time savings is achievable and meaningful
- [ ] Technical decision: TypeScript over Python for ecosystem consistency
- [ ] Scope decision: CLI-only approach sufficient (no IDE integration)
- [ ] Risk assessment: Adoption friction accurately identified

## Next Steps
1. Validate core assumptions with usage patterns
2. Create technical specification with implementation details
3. Build MVP with single template to test workflow
4. Iterate based on actual usage feedback

---
*Created: 2025-08-22*
*Status: Proposal*
*Complexity: Simple*
# Feature Planning: Cursor Prompt Template Engine

## Problem Statement
Developers repeatedly write similar prompts with manual context gathering for Cursor + Claude interactions, leading to inconsistent prompt quality and wasted time. The current workflow lacks reusable templates and automated context collection.

## User Story
As a developer using Cursor + Claude, I want to quickly generate consistent, context-rich prompts from templates so that I can focus on problem-solving rather than prompt crafting.

## Proposed Solution
Build a lightweight TypeScript CLI tool that loads markdown prompt templates, performs variable substitution, gathers project context automatically, and outputs formatted prompts ready for Cursor. Focus on template reusability and simple workflows over complex optimization.

## Goals & Non-Goals

### Goals
- Reduce prompt writing time by 50%
- Provide consistent prompt structure across task types
- Automate context gathering (git, files, terminal)
- Zero-configuration for basic usage
- <100ms execution time

### Non-Goals  
- Complex prompt optimization algorithms
- VS Code extension development
- Interactive multi-step builders
- AI-based prompt enhancement
- Remote template repositories
- Team collaboration features

## Technical Breakdown

### Phase 1: Core Foundation

#### Task 1: Research and Design CLI Architecture
**Type:** research/design  
**Complexity:** Simple  
**Duration:** 1 session

**Todo List:**
- [ ] Research TypeScript CLI best practices 2024-2025
  - WebSearch: "TypeScript CLI tool architecture 2025 best practices"
  - WebSearch: "commander.js vs yargs vs oclif comparison 2024"
  - WebSearch: "TypeScript CLI testing strategies"
- [ ] Research template engine patterns
  - WebSearch: "JavaScript template engine performance comparison 2024"
  - WebSearch: "handlebars vs mustache vs custom templating"
- [ ] Design CLI command structure and argument parsing
- [ ] Design configuration file schema
- [ ] Document architecture decisions

#### Task 2: Implement Core CLI Structure
**Type:** implementation  
**Depends:** Task 1  
**Complexity:** Simple  

**Todo List:**
- [ ] Initialize TypeScript project with proper configuration
- [ ] Set up commander.js for CLI framework
- [ ] Implement main command entry point
- [ ] Add basic command parsing (template selection)
- [ ] Implement help and version commands
- [ ] Add error handling and user-friendly messages
- [ ] Write unit tests for CLI commands

#### Task 3: Build Template System
**Type:** implementation  
**Depends:** Task 1  
**Complexity:** Medium  

**Todo List:**
- [ ] Implement template loader from filesystem
- [ ] Build variable substitution engine with {{variable}} syntax
- [ ] Add conditional sections support {{#if}}...{{/if}}
- [ ] Implement template validation and error reporting
- [ ] Create default templates (bug_fix, feature, refactor, review, test)
- [ ] Add template caching for performance
- [ ] Write comprehensive tests for template processing

### Phase 2: Context Gathering

#### Task 4: Implement Context Gathering System
**Type:** implementation  
**Depends:** Task 3  
**Complexity:** Medium  

**Todo List:**
- [ ] Build git integration module
  - Get current branch
  - Capture git diff (staged/unstaged)
  - Get recent commit messages
  - Handle non-git repositories gracefully
- [ ] Implement file context gathering
  - Support glob patterns for file selection
  - Read file contents with line numbers
  - Respect .gitignore patterns
  - Handle large files appropriately
- [ ] Add terminal output capture
  - Capture last N lines of terminal
  - Parse error messages intelligently
- [ ] Create context size management
  - Implement truncation strategies
  - Add size warnings to user
- [ ] Write integration tests for context gathering

### Phase 3: Output and Configuration

#### Task 5: Implement Output Management
**Type:** implementation  
**Depends:** Task 2  
**Complexity:** Simple  

**Todo List:**
- [ ] Integrate clipboardy for clipboard operations
- [ ] Implement markdown formatting for Cursor
- [ ] Add preview mode with syntax highlighting
- [ ] Implement file output option
- [ ] Add colored console output with chalk
- [ ] Handle clipboard access errors gracefully
- [ ] Write tests for output scenarios

#### Task 6: Build Configuration System
**Type:** implementation  
**Depends:** Task 2  
**Complexity:** Simple  

**Todo List:**
- [ ] Implement configuration file loader
- [ ] Create default configuration schema
- [ ] Add configuration validation
- [ ] Support project-specific configs
- [ ] Implement config merge strategy (defaults + user)
- [ ] Add configuration CLI commands
- [ ] Write tests for configuration handling

### Phase 4: Polish and Release

#### Task 7: Integration Testing and Performance
**Type:** test  
**Depends:** Tasks 3, 4, 5, 6  
**Complexity:** Medium  

**Todo List:**
- [ ] Write end-to-end tests for complete workflows
- [ ] Test with various project structures
- [ ] Performance testing and optimization
  - Measure and optimize startup time
  - Profile template processing performance
  - Optimize context gathering speed
- [ ] Test error scenarios and edge cases
- [ ] Verify cross-platform compatibility
- [ ] Load testing with large templates/contexts

#### Task 8: Documentation and Package Preparation
**Type:** documentation  
**Depends:** Task 7  
**Complexity:** Simple  

**Todo List:**
- [ ] Write comprehensive README.md
- [ ] Create usage examples for each template type
- [ ] Document configuration options
- [ ] Write template creation guide
- [ ] Add troubleshooting section
- [ ] Create CHANGELOG.md
- [ ] Prepare package.json for npm publication
- [ ] Set up GitHub Actions for CI/CD
- [ ] Create release binaries for direct installation

## Task Flow Visualization

```
Phase 1: Foundation
┌──────────────────┐
│ Task 1: Research │
│ & Design CLI     │
└────────┬─────────┘
         ├─────────────┬────────────┐
         ↓             ↓            ↓
┌──────────────┐ ┌──────────┐ ┌──────────┐
│ Task 2: Core │ │ Task 3:  │ │          │
│ CLI Structure│ │ Template │ │          │
└──────┬───────┘ │ System   │ │          │
       │         └─────┬────┘ │          │
       │               │      │          │
Phase 2: Context       │      │          │
       │               ↓      │          │
       │      ┌──────────────┐│          │
       │      │ Task 4:      ││          │
       │      │ Context      ││          │
       │      │ Gathering    ││          │
       │      └──────┬───────┘│          │
       │             │        │          │
Phase 3: Output      │        │          │
       ├─────────────┼────────┤          │
       ↓             ↓        ↓          │
┌──────────────┐ ┌──────────────┐        │
│ Task 5:      │ │ Task 6:      │        │
│ Output Mgmt  │ │ Configuration│        │
└──────┬───────┘ └──────┬───────┘        │
       │                │                │
Phase 4: Polish         │                │
       └────────┬───────┴────────────────┘
                ↓
       ┌──────────────┐
       │ Task 7:      │
       │ Integration  │
       │ Testing      │
       └──────┬───────┘
              ↓
       ┌──────────────┐
       │ Task 8:      │
       │ Documentation│
       │ & Release    │
       └──────────────┘
```

## Dependencies & Risks

### Technical Dependencies
- Node.js 18+ runtime
- NPM packages: commander, clipboardy, chalk, glob
- Git CLI for context gathering
- OS clipboard access

### Identified Risks
1. **Clipboard Access Issues**
   - Mitigation: Graceful fallback to console output
   - Detection: Early testing on all platforms

2. **Template Complexity Growth**
   - Mitigation: Keep template syntax minimal
   - Prevention: Clear documentation on limitations

3. **Performance with Large Contexts**
   - Mitigation: Implement smart truncation
   - Monitoring: Performance benchmarks in tests

4. **Cross-Platform Compatibility**
   - Mitigation: Use cross-platform libraries
   - Testing: CI/CD on Windows, macOS, Linux

## Success Criteria
- [ ] All 5 default templates working correctly
- [ ] <100ms execution for typical usage
- [ ] 80% test coverage achieved
- [ ] Zero-config works out of the box
- [ ] Published to npm registry
- [ ] Documentation complete and clear

## Implementation Priority
1. **Week 1:** Tasks 1-3 (Foundation)
2. **Week 2:** Task 4 (Context Gathering)
3. **Week 3:** Tasks 5-6 (Output & Config)
4. **Week 4:** Tasks 7-8 (Polish & Release)

## Human Review Required

### Planning Decisions to Verify
- [ ] Task granularity appropriate for AI sessions (8 tasks vs 14+)
- [ ] Dependency chain enables parallel work where possible
- [ ] Research task includes relevant 2024-2025 searches
- [ ] Testing integrated throughout vs separate phase
- [ ] Documentation task at end vs continuous

### Technical Assumptions
- [ ] Commander.js is the right CLI framework choice
- [ ] {{variable}} syntax preferred over alternatives
- [ ] Clipboardy will work across all platforms
- [ ] 100ms performance target is achievable
- [ ] Template approach better than optimization

### Risk Assessment
- [ ] Identified risks are comprehensive
- [ ] Mitigation strategies are practical
- [ ] No critical risks overlooked

## Next Steps
1. Review and approve this plan
2. Create individual task files from breakdown
3. Start with Task 1: Research and Design
4. Set up project repository and initial structure

---
*Plan Created: 2025-08-22*  
*Complexity: Medium*  
*Estimated Duration: 4 weeks*
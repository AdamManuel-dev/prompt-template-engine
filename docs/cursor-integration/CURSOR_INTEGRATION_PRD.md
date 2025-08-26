# Cursor IDE Integration - Product Requirements Document

## Executive Summary

This document outlines the integration strategy for the Cursor Prompt Template Engine with Cursor IDE, enabling seamless template-based prompt generation within the IDE environment. The integration will leverage Cursor's unique features including its rules system, context awareness, and agent capabilities to provide a superior developer experience.

## 1. Problem Statement

### Current Pain Points
- Manual copy-paste workflow between CLI and Cursor IDE
- Loss of context when switching between terminal and IDE
- No automatic template selection based on current IDE state
- Lack of integration with Cursor's context awareness features
- Missing synchronization between project templates and Cursor rules

### User Needs
- Seamless template access within Cursor IDE
- Automatic context detection from IDE state
- Dynamic rule generation based on templates
- Integration with Cursor's chat and inline edit features
- Team collaboration through shared templates and rules

## 2. Solution Overview

### Vision
Create a native Cursor IDE integration that transforms our template engine into an intelligent prompt assistant, fully integrated with Cursor's workflow and enhancing its AI capabilities.

### Key Components
1. **Cursor Rules Generator**: Convert templates to `.cursor/rules/*.mdc` format
2. **Context Bridge**: Connect our context gathering with Cursor's `@file` system
3. **Command Integration**: Add template commands to Cursor's command palette
4. **Extension Module**: Optional VS Code extension for deeper integration
5. **Agent Enhancement**: Leverage Cursor's agent capabilities for automation

## 3. Technical Architecture

### 3.1 Integration Layers

```
┌─────────────────────────────────────────┐
│         Cursor IDE Interface            │
├─────────────────────────────────────────┤
│    Command Palette Integration          │
├─────────────────────────────────────────┤
│      Rules System (.cursor/rules)       │
├─────────────────────────────────────────┤
│     Context Bridge (@file refs)         │
├─────────────────────────────────────────┤
│   Template Engine Core (our system)     │
├─────────────────────────────────────────┤
│    Optional VS Code Extension           │
└─────────────────────────────────────────┘
```

### 3.2 File System Structure

```
project-root/
├── .cursor/
│   ├── rules/                    # Generated rules from templates
│   │   ├── bug-fix.mdc          # Bug fix template as rule
│   │   ├── feature.mdc          # Feature template as rule
│   │   ├── refactor.mdc         # Refactor template as rule
│   │   └── project-specific/    # Nested rules for specific areas
│   │       ├── api.mdc
│   │       └── frontend.mdc
│   ├── templates/               # Template definitions
│   │   └── *.yaml              # YAML template configs
│   └── context/                # Cached context data
│       └── current.json
├── .cursorrules                # Legacy support (deprecated)
└── .cursorprompt.json          # Our config file
```

### 3.3 Integration Points

#### A. Rules System Integration
- **Automatic Conversion**: Templates → `.mdc` format with frontmatter
- **Dynamic Generation**: Create rules based on project analysis
- **Glob Patterns**: Auto-attach rules to relevant files
- **Context References**: Include `@file` references in generated rules

#### B. Command Palette Integration
- `Cursor Prompt: Generate` - Generate prompt from template
- `Cursor Prompt: List Templates` - Show available templates
- `Cursor Prompt: Sync Rules` - Sync templates to rules
- `Cursor Prompt: Configure` - Open configuration

#### C. Context Awareness
- Detect current file, selection, errors from IDE
- Use Cursor's workspace analysis
- Integrate with Cursor's AI diagnostics
- Leverage terminal output and git state

## 4. Feature Specifications

### 4.1 Core Features

#### Feature 1: Template-to-Rules Converter
**Description**: Automatically convert templates to Cursor rules format

**Implementation**:
```typescript
interface RuleConverter {
  convertTemplate(template: Template): CursorRule;
  generateFrontmatter(template: Template): Frontmatter;
  mapVariablesToContext(variables: Variables): string[];
}
```

**Rule Format**:
```markdown
---
description: Bug fix template for debugging issues
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
---

# Bug Fix Context
- Error: {{error_message}}
- Location: @{{error_file}}
- Related files: @src/utils/logger.ts @src/config/index.ts

## Requirements
- Identify root cause
- Implement minimal fix
- Add appropriate error handling
- Include tests for the fix
```

#### Feature 2: Context Bridge
**Description**: Bridge our context system with Cursor's context

**Capabilities**:
- Map file patterns to `@file` references
- Convert git diff to Cursor-compatible format
- Include terminal output as context
- Reference related files automatically

#### Feature 3: Dynamic Rule Generation
**Description**: Generate rules based on current IDE state

**Triggers**:
- File save events
- Error detection
- Test failures
- Git operations

#### Feature 4: Command Palette Commands
**Description**: Native Cursor commands for template operations

**Commands**:
```json
{
  "commands": [
    {
      "command": "cursorPrompt.generate",
      "title": "Cursor Prompt: Generate from Template",
      "keybinding": "cmd+shift+g"
    },
    {
      "command": "cursorPrompt.quickFix",
      "title": "Cursor Prompt: Quick Fix with Template",
      "when": "editorHasError"
    }
  ]
}
```

### 4.2 Advanced Features

#### Feature 5: Agent Integration
**Description**: Leverage Cursor's agent capabilities

**Use Cases**:
- Auto-generate prompts in GitHub PRs
- Slack integration for team templates
- Terminal automation for complex workflows

#### Feature 6: Smart Template Selection
**Description**: AI-powered template recommendation

**Algorithm**:
1. Analyze current context (file type, errors, git state)
2. Score templates based on relevance
3. Suggest top 3 templates
4. Learn from user selections

#### Feature 7: Collaborative Templates
**Description**: Share templates across team

**Implementation**:
- Sync templates to team repository
- Version control for templates
- Merge conflict resolution
- Permission management

## 5. Implementation Plan

### Phase 1: Foundation (Week 1)
1. **Research & Design**
   - [ ] Study Cursor's internal APIs
   - [ ] Design rules conversion system
   - [ ] Plan command integration

2. **Core Implementation**
   - [ ] Build template-to-rules converter
   - [ ] Implement context bridge
   - [ ] Create basic commands

### Phase 2: Integration (Week 2)
1. **Cursor-Specific Features**
   - [ ] Implement .mdc file generation
   - [ ] Add @file reference mapping
   - [ ] Create command palette integration

2. **Testing & Refinement**
   - [ ] Test with various project types
   - [ ] Optimize performance
   - [ ] Handle edge cases

### Phase 3: Advanced Features (Week 3)
1. **AI Enhancement**
   - [ ] Smart template selection
   - [ ] Context intelligence
   - [ ] Learning system

2. **Collaboration**
   - [ ] Team template sharing
   - [ ] Version control integration
   - [ ] Conflict resolution

## 6. Technical Requirements

### Dependencies
```json
{
  "dependencies": {
    "vscode": "^1.85.0",
    "js-yaml": "^4.1.0",
    "glob": "^10.3.0",
    "gray-matter": "^4.0.3"
  }
}
```

### API Interfaces

#### Cursor Rule Interface
```typescript
interface CursorRule {
  name: string;
  description?: string;
  globs?: string[];
  alwaysApply?: boolean;
  content: string;
  references?: string[];
}
```

#### Template Converter
```typescript
class TemplateConverter {
  async convertToRule(template: Template): Promise<CursorRule> {
    const frontmatter = this.generateFrontmatter(template);
    const content = this.processContent(template);
    const references = this.extractReferences(template);
    
    return {
      name: template.name,
      description: template.description,
      globs: template.filePatterns,
      alwaysApply: template.priority === 'high',
      content,
      references
    };
  }
}
```

## 7. User Experience Design

### Workflow 1: Quick Template Generation
1. User presses `Cmd+Shift+G` in Cursor
2. Template selector appears with smart suggestions
3. User selects template
4. Variables are auto-filled from context
5. Prompt is generated and inserted into chat

### Workflow 2: Automatic Rule Application
1. User opens file matching glob pattern
2. Relevant template rules auto-attach
3. Context is enhanced with template guidance
4. AI responses follow template structure

### Workflow 3: Error-Driven Templates
1. Error detected in editor
2. Quick fix suggestion appears
3. User selects "Fix with template"
4. Bug-fix template generates targeted prompt
5. Solution is applied inline

## 8. Success Metrics

### Quantitative Metrics
- **Adoption Rate**: 80% of Cursor users install integration
- **Usage Frequency**: 10+ template uses per day per user
- **Time Savings**: 60% reduction in prompt writing time
- **Template Coverage**: 95% of common tasks have templates

### Qualitative Metrics
- **User Satisfaction**: 4.5+ star rating
- **Workflow Integration**: Seamless IDE experience
- **Context Quality**: Improved AI response accuracy
- **Team Collaboration**: Increased template sharing

## 9. Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| Cursor API changes | Version detection and compatibility layer |
| Performance impact | Lazy loading and caching strategies |
| Rule conflicts | Priority system and conflict resolution |
| Extension restrictions | Fallback to file-based integration |

### User Experience Risks
| Risk | Mitigation |
|------|------------|
| Learning curve | Interactive tutorials and examples |
| Template overload | Smart filtering and recommendations |
| Context bloat | Intelligent context pruning |
| Migration friction | Automatic migration tools |

## 10. Future Enhancements

### Version 2.0
- **Visual Template Builder**: GUI for creating templates
- **AI Template Generation**: Generate templates from examples
- **Multi-IDE Support**: Extend to other IDEs
- **Cloud Sync**: Sync templates across devices

### Version 3.0
- **Team Analytics**: Track template usage across team
- **Template Marketplace**: Community template sharing
- **Custom AI Models**: Support for proprietary models
- **Workflow Automation**: Complex multi-step workflows

## 11. Technical Specifications

### File Formats

#### .mdc Rule File
```markdown
---
description: Template for implementing new features
globs: ["src/**/*.ts", "src/**/*.tsx"]
alwaysApply: false
tags: ["feature", "implementation"]
author: cursor-prompt-engine
version: 1.0.0
---

# Feature Implementation Template

## Context References
- Architecture: @docs/architecture.md
- Style Guide: @docs/style-guide.md
- Similar Features: @src/features/*.ts

## Template Content
{{#include "feature-template.md"}}

## Variables
- Feature Name: {{feature_name}}
- Component Type: {{component_type}}
- Dependencies: {{dependencies}}
```

### Configuration Schema
```typescript
interface CursorIntegrationConfig {
  // Rule generation settings
  rules: {
    outputDir: string;        // Default: .cursor/rules
    autoGenerate: boolean;    // Auto-generate on template change
    legacySupport: boolean;   // Support .cursorrules file
    nestingDepth: number;     // Max nesting for directory rules
  };
  
  // Context settings
  context: {
    maxFileSize: number;      // Max size for @file references
    includePaths: string[];   // Paths to include in context
    excludePaths: string[];   // Paths to exclude
    autoDetect: boolean;      // Auto-detect relevant files
  };
  
  // Integration settings
  integration: {
    commandPalette: boolean;  // Enable command palette commands
    quickFix: boolean;        // Enable quick fix suggestions
    autoSuggest: boolean;     // Auto-suggest templates
    agentMode: boolean;       // Enable agent integrations
  };
}
```

## 12. Acceptance Criteria

### Must Have (P0)
- [ ] Generate .cursor/rules from templates
- [ ] Support both .cursorrules and new format
- [ ] Basic command palette integration
- [ ] Context awareness from IDE state
- [ ] File reference mapping

### Should Have (P1)
- [ ] Smart template selection
- [ ] Auto-attachment via globs
- [ ] Error-driven templates
- [ ] Team template sharing
- [ ] Performance optimization

### Nice to Have (P2)
- [ ] VS Code extension
- [ ] Agent integration
- [ ] Visual template builder
- [ ] Analytics dashboard
- [ ] Cloud sync

## Appendix A: Research Findings

### Cursor's Evolution (2024-2025)
- Transition from .cursorrules to .cursor/rules
- Addition of MDC format with frontmatter
- GitHub and Slack agent integrations
- Custom API key support
- Terminal integration for agents

### Key Integration Opportunities
1. **Rules System**: Primary integration point
2. **Command Palette**: User interaction layer
3. **Context System**: Enhanced awareness
4. **Agent Platform**: Automation potential
5. **Extension Ecosystem**: Deep integration option

## Appendix B: Competitive Analysis

### Existing Solutions
- **Manual .cursorrules**: Static, no dynamic generation
- **VS Code Snippets**: Limited context awareness
- **GitHub Copilot**: No template structure
- **Cline Extension**: Multi-file editing but no templates

### Our Differentiation
- **Dynamic Generation**: Templates adapt to context
- **Bi-directional Sync**: Templates ↔ Rules
- **Intelligence Layer**: Smart selection and learning
- **Team Features**: Collaboration and sharing
- **Workflow Integration**: Seamless IDE experience

---

*Document Version: 1.0*  
*Last Updated: 2025-08-23*  
*Author: Cursor Prompt Template Engine Team*  
*Status: In Development*
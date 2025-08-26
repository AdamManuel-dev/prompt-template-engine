# VS Code Extension Packaging & NPM Publishing - Product Requirements Document

## Executive Summary

This document outlines the requirements and strategy for packaging the Cursor Prompt Template Engine as both a VS Code extension and an npm package, enabling distribution through multiple channels for maximum reach and usability.

## 1. Problem Statement

### Current State
- Cursor integration code exists but isn't packaged for distribution
- No VS Code extension manifest or packaging configuration
- npm package setup incomplete for CLI distribution
- No automated publishing pipeline

### Distribution Goals
- VS Code Marketplace presence for Cursor/VS Code users
- npm registry availability for CLI users
- GitHub releases for direct downloads
- Automated CI/CD publishing pipeline

## 2. Solution Overview

### Dual Distribution Strategy
1. **VS Code Extension (VSIX)**: For IDE integration
2. **npm Package**: For CLI and programmatic usage
3. **GitHub Releases**: For binary distributions

## 3. VS Code Extension Requirements

### 3.1 Extension Manifest (package.json)

#### Required Fields
```json
{
  "name": "cursor-prompt-template-engine",
  "displayName": "Cursor Prompt Template Engine",
  "description": "Intelligent template-based prompt generation for Cursor IDE",
  "version": "0.1.0",
  "engines": {
    "vscode": "^1.85.0"
  },
  "categories": ["Other", "Snippets", "Programming Languages"],
  "keywords": ["cursor", "prompt", "template", "ai", "claude"],
  "publisher": "cursor-prompt-team",
  "icon": "resources/icon.png",
  "galleryBanner": {
    "color": "#2C3E50",
    "theme": "dark"
  }
}
```

#### Activation Events
```json
{
  "activationEvents": [
    "onCommand:cursorPrompt.generate",
    "onCommand:cursorPrompt.listTemplates",
    "onCommand:cursorPrompt.syncRules",
    "workspaceContains:.cursor/**",
    "workspaceContains:.cursorprompt.json"
  ]
}
```

#### Contribution Points
```json
{
  "contributes": {
    "commands": [
      {
        "command": "cursorPrompt.generate",
        "title": "Generate from Template",
        "category": "Cursor Prompt"
      }
    ],
    "keybindings": [
      {
        "command": "cursorPrompt.generate",
        "key": "ctrl+shift+g",
        "mac": "cmd+shift+g",
        "when": "editorTextFocus"
      }
    ],
    "configuration": {
      "title": "Cursor Prompt Template Engine",
      "properties": {
        "cursorPrompt.autoSync": {
          "type": "boolean",
          "default": true,
          "description": "Automatically sync templates to Cursor rules"
        }
      }
    },
    "menus": {
      "editor/context": [
        {
          "command": "cursorPrompt.generate",
          "group": "cursor-prompt",
          "when": "editorTextFocus"
        }
      ]
    }
  }
}
```

### 3.2 Extension Structure

```
cursor-prompt-extension/
├── src/
│   ├── extension.ts          # Main extension entry
│   ├── integrations/         # Cursor integration code
│   └── commands/             # Command implementations
├── resources/
│   ├── icon.png             # Extension icon (128x128)
│   └── templates/            # Default templates
├── package.json              # Extension manifest
├── tsconfig.json            # TypeScript config
├── webpack.config.js        # Bundling configuration
├── .vscodeignore           # Files to exclude
└── README.md               # Marketplace README
```

### 3.3 Extension Entry Point

```typescript
// src/extension.ts
import * as vscode from 'vscode';
import { CursorIntegration } from './integrations/cursor';

export function activate(context: vscode.ExtensionContext) {
    const integration = CursorIntegration.getInstance();
    integration.initialize(context);
    
    // Register telemetry
    // Initialize configuration
    // Set up watchers
}

export function deactivate() {
    // Cleanup resources
}
```

## 4. NPM Package Requirements

### 4.1 Package Configuration

#### Main package.json Updates
```json
{
  "name": "cursor-prompt",
  "version": "0.1.0",
  "description": "CLI tool for template-based prompt generation",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "cursor-prompt": "./dist/cli.js",
    "cprompt": "./dist/cli.js"
  },
  "files": [
    "dist/",
    "templates/",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "prepublishOnly": "npm run build && npm test",
    "postpublish": "git push && git push --tags"
  },
  "keywords": [
    "cursor",
    "prompt",
    "template",
    "cli",
    "ai",
    "claude"
  ],
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

### 4.2 CLI Entry Point

```typescript
#!/usr/bin/env node
// dist/cli.js
import { program } from 'commander';
import { version } from '../package.json';

program
  .version(version)
  .description('Cursor Prompt Template Engine CLI')
  // ... commands
```

## 5. Build & Bundle Configuration

### 5.1 VS Code Extension Webpack

```javascript
// webpack.config.js
module.exports = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: 'ts-loader'
      }
    ]
  }
};
```

### 5.2 NPM Package Build

```json
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": [
    "node_modules",
    "**/*.test.ts",
    "**/*.spec.ts",
    "tests"
  ]
}
```

## 6. Publishing Pipeline

### 6.1 GitHub Actions Workflow

```yaml
# .github/workflows/publish.yml
name: Publish

on:
  release:
    types: [created]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{secrets.NPM_TOKEN}}

  publish-vscode:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run vscode:package
      - run: npx vsce publish
        env:
          VSCE_PAT: ${{secrets.VSCE_TOKEN}}
```

### 6.2 Release Process

1. **Version Bump**
   ```bash
   npm version patch/minor/major
   ```

2. **Build & Test**
   ```bash
   npm run build
   npm test
   npm run package
   ```

3. **VS Code Extension**
   ```bash
   vsce package
   vsce publish
   ```

4. **NPM Package**
   ```bash
   npm publish
   ```

5. **GitHub Release**
   - Tag version
   - Upload VSIX file
   - Upload compiled binaries

## 7. Quality Requirements

### 7.1 Extension Requirements
- [ ] Icon and banner graphics
- [ ] Detailed README with screenshots
- [ ] CHANGELOG.md with version history
- [ ] LICENSE file
- [ ] Telemetry consent
- [ ] Error reporting

### 7.2 Package Requirements
- [ ] Comprehensive CLI help
- [ ] Man pages
- [ ] Shell completions
- [ ] Cross-platform support
- [ ] Minimal dependencies

### 7.3 Testing Requirements
- [ ] Extension integration tests
- [ ] CLI end-to-end tests
- [ ] Multi-platform testing
- [ ] Performance benchmarks

## 8. Marketing & Documentation

### 8.1 VS Code Marketplace Listing

#### Description Template
```markdown
# Cursor Prompt Template Engine

Transform your AI coding workflow with intelligent template-based prompt generation.

## Features
- 🚀 50+ built-in templates
- 🎯 Context-aware prompt generation
- 🔄 Cursor rules synchronization
- ⚡ Lightning-fast execution

## Quick Start
1. Install extension
2. Open command palette (Cmd+Shift+P)
3. Run "Cursor Prompt: Generate"

[View Documentation](https://github.com/...)
```

### 8.2 NPM Package README

```markdown
# cursor-prompt

CLI tool for template-based prompt generation.

## Installation
\`\`\`bash
npm install -g cursor-prompt
\`\`\`

## Usage
\`\`\`bash
cursor-prompt generate bug-fix --error "undefined variable"
\`\`\`
```

## 9. Success Metrics

### Launch Targets
- **Week 1**: 100+ VS Code installs
- **Week 2**: 500+ npm downloads
- **Month 1**: 1000+ active users
- **Month 3**: 5-star average rating

### Quality Metrics
- Zero critical bugs in first week
- <24hr response to issues
- 95% user satisfaction
- <5% uninstall rate

## 10. Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| VS Code API changes | Version range compatibility |
| npm security vulnerabilities | Automated scanning |
| Large bundle size | Code splitting, tree shaking |
| Platform compatibility | CI matrix testing |

### Market Risks
| Risk | Mitigation |
|------|------------|
| Low adoption | Marketing campaign |
| Competitive tools | Unique features |
| Poor reviews | Quick issue resolution |
| Naming conflicts | Trademark search |

## 11. Timeline

### Week 1: Preparation
- [ ] Finalize package.json configurations
- [ ] Create graphics and icons
- [ ] Write marketplace descriptions
- [ ] Set up CI/CD pipeline

### Week 2: Testing & Publishing
- [ ] Internal testing
- [ ] Beta release
- [ ] Gather feedback
- [ ] Official launch

### Week 3: Post-Launch
- [ ] Monitor metrics
- [ ] Address issues
- [ ] Plan updates
- [ ] Marketing push

## Appendix A: Checklist

### Pre-Publishing Checklist
- [ ] Version number updated
- [ ] CHANGELOG.md updated
- [ ] README.md complete
- [ ] All tests passing
- [ ] Build successful
- [ ] No security vulnerabilities
- [ ] Icon and graphics ready
- [ ] Publisher account ready
- [ ] Tokens configured
- [ ] CI/CD tested

### Post-Publishing Checklist
- [ ] Marketplace listing live
- [ ] npm package accessible
- [ ] GitHub release created
- [ ] Documentation updated
- [ ] Social media announcement
- [ ] Community notified

---

*Document Version: 1.0*  
*Last Updated: 2025-08-23*  
*Status: Ready for Implementation*
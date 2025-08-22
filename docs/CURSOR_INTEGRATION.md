# Cursor IDE Integration Guide

The Cursor Prompt Template Engine provides deep integration with Cursor IDE, enabling seamless template synchronization, direct prompt injection, and real-time collaboration features.

## Overview

The integration allows you to:
- Sync templates between your local environment and Cursor IDE
- Inject prompts directly into the Cursor chat interface
- Manage templates from within Cursor
- Use keyboard shortcuts for quick template access
- Real-time template updates across team members

## Setup

### Prerequisites

1. Cursor IDE installed and running
2. Cursor Prompt Template Engine CLI installed
3. Cursor extension API enabled (Settings → Extensions → Enable API)

### Initial Connection

```bash
# Check connection status
cursor-prompt cursor:status

# Establish connection
cursor-prompt cursor:sync
```

### Configuration

Enable Cursor integration in your configuration:

```json
{
  "cursor": {
    "integration": true,
    "apiEndpoint": "http://localhost:3000",
    "autoSync": true,
    "syncInterval": 30000
  }
}
```

## Features

### Template Synchronization

Templates are automatically synchronized between your local filesystem and Cursor IDE.

#### Manual Sync

```bash
# Sync all templates
cursor-prompt cursor:sync

# Sync specific template
cursor-prompt cursor:sync --template bug-fix
```

#### Auto-Sync

Enable automatic synchronization in config:

```json
{
  "cursor": {
    "autoSync": true,
    "syncInterval": 30000  // milliseconds
  }
}
```

### Direct Prompt Injection

Inject templates directly into the Cursor chat interface:

```bash
# Inject template with default variables
cursor-prompt cursor:inject bug-fix

# Inject with custom variables
cursor-prompt cursor:inject feature \
  --variables '{"description": "Add user authentication"}'

# Inject and execute immediately
cursor-prompt cursor:inject refactor --execute
```

### Cursor Commands

The integration adds several commands to the Cursor command palette:

| Command | Description | Keyboard Shortcut |
|---------|-------------|-------------------|
| `Cursor Prompt: Generate Template` | Create template from selection | `Cmd+Shift+G` (Mac) / `Ctrl+Shift+G` (Win/Linux) |
| `Cursor Prompt: Apply Template` | Apply template to current file | `Cmd+Shift+A` / `Ctrl+Shift+A` |
| `Cursor Prompt: Sync Templates` | Sync all templates | `Cmd+Shift+S` / `Ctrl+Shift+S` |
| `Cursor Prompt: Show Templates` | Browse available templates | `Cmd+Shift+T` / `Ctrl+Shift+T` |

### WebSocket Connection

For real-time features, the integration establishes a WebSocket connection:

```typescript
// Connection automatically established on startup
// Status available via:
cursor-prompt cursor:status
```

Features enabled by WebSocket:
- Real-time template updates
- Live collaboration
- Instant prompt injection
- Template hot-reloading

## Extension Bridge

The Cursor Extension Bridge provides programmatic access to Cursor features:

### Available APIs

```typescript
import { CursorExtensionBridge } from 'cursor-prompt';

const bridge = CursorExtensionBridge.getInstance();

// Execute Cursor commands
await bridge.executeCommand('cursorPrompt.generateTemplate', ['template-name']);

// Show messages
await bridge.showInformationMessage('Template applied successfully');
await bridge.showErrorMessage('Failed to apply template');

// Get workspace information
const folders = await bridge.getWorkspaceFolders();

// Show quick pick
const template = await bridge.showQuickPick(templates, {
  placeHolder: 'Select a template'
});

// Get user input
const name = await bridge.showInputBox({
  prompt: 'Enter template name',
  placeHolder: 'my-template'
});
```

## Template Metadata

Templates can include Cursor-specific metadata:

```yaml
---
name: bug-fix
description: Fix bugs with context
author: Your Name
version: 1.0.0
tags: [bug, fix, debug]
cursor:
  autoExecute: false
  position: "end"  # Where to inject: start, end, cursor
  focus: true      # Focus chat after injection
---

Your template content here...
```

## Workflow Integration

### Bug Fix Workflow

1. Encounter a bug in your code
2. Select the problematic code in Cursor
3. Press `Cmd+Shift+G` to generate a bug-fix template
4. Template automatically includes:
   - Selected code
   - File context
   - Error messages from console
   - Git diff
5. Press Enter to send to Claude

### Feature Development Workflow

1. Start with a feature template
2. Customize variables for your specific needs
3. Inject into Cursor with context
4. Iterate with Claude's assistance
5. Templates automatically update based on common patterns

### Code Review Workflow

1. Open PR or changed files
2. Run `cursor-prompt cursor:inject review`
3. Template includes:
   - Changed files
   - Diff context
   - Review checklist
4. Get comprehensive review from Claude

## Advanced Features

### Custom Template Processors

Create Cursor-specific template processors:

```typescript
export class CursorProcessor {
  async process(template: string, context: any): Promise<string> {
    // Add Cursor-specific context
    const cursorContext = {
      activeFile: context.activeEditor?.document.fileName,
      selection: context.activeEditor?.selection,
      openFiles: context.openEditors.map(e => e.document.fileName)
    };

    return template.replace('{{cursor_context}}', JSON.stringify(cursorContext));
  }
}
```

### Event Handling

Listen for Cursor events:

```typescript
bridge.on('command:executed', ({ commandId, args }) => {
  console.log(`Command ${commandId} executed with args:`, args);
});

bridge.on('template:applied', ({ template, result }) => {
  console.log(`Template ${template} applied successfully`);
});
```

### Template Hot-Reloading

Templates are automatically reloaded when changed:

```bash
# Watch templates directory for changes
cursor-prompt watch

# Changes are automatically synced to Cursor
```

## Troubleshooting

### Connection Issues

1. **Check Cursor is running**
   ```bash
   ps aux | grep Cursor
   ```

2. **Verify API endpoint**
   ```bash
   curl http://localhost:3000/api/status
   ```

3. **Check firewall settings**
   - Ensure port 3000 is not blocked
   - Allow localhost connections

4. **Review logs**
   ```bash
   cursor-prompt --debug cursor:status
   ```

### Sync Problems

1. **Manual sync force**
   ```bash
   cursor-prompt cursor:sync --force
   ```

2. **Clear cache**
   ```bash
   rm -rf ~/.cursor-prompt/cache
   ```

3. **Reset connection**
   ```bash
   cursor-prompt cursor:disconnect
   cursor-prompt cursor:connect
   ```

### Template Not Appearing

1. Check template file extension matches config
2. Verify template has valid frontmatter
3. Ensure template directory is correct
4. Check file permissions

### WebSocket Disconnections

1. **Increase timeout**
   ```json
   {
     "cursor": {
       "websocketTimeout": 60000
     }
   }
   ```

2. **Enable reconnection**
   ```json
   {
     "cursor": {
       "autoReconnect": true,
       "reconnectInterval": 5000
     }
   }
   ```

## Best Practices

1. **Use semantic template names** for easy discovery
2. **Include metadata** for better organization
3. **Version your templates** for team collaboration
4. **Test templates** before syncing
5. **Use template variables** for flexibility
6. **Document template purpose** in description
7. **Group related templates** with tags
8. **Set up auto-sync** for team environments

## Security Considerations

1. **API Endpoint Security**
   - Use localhost for local development
   - Use HTTPS for remote connections
   - Implement authentication for team setups

2. **Template Validation**
   - Templates are sanitized before injection
   - Variables are escaped to prevent injection attacks
   - File access is restricted to project scope

3. **WebSocket Security**
   - Connections are authenticated
   - Messages are validated
   - Rate limiting is applied

## Future Enhancements

Planned features for upcoming releases:

- Template marketplace integration
- Team template sharing
- AI-powered template suggestions
- Visual template builder in Cursor
- Template analytics and usage tracking
- Collaborative template editing
- Template version control integration
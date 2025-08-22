# Plugin Development Guide

The Cursor Prompt Template Engine provides a powerful plugin system that allows you to extend functionality with custom commands, template processors, and integrations.

## Plugin Structure

A plugin is a directory or npm package with the following structure:

```
my-plugin/
├── plugin.json           # Plugin metadata
├── package.json          # Optional: npm package info
├── index.js              # Main plugin file
└── commands/             # Command implementations
    ├── my-command.js
    └── another-command.js
```

## Plugin Metadata

### plugin.json

```json
{
  "name": "my-awesome-plugin",
  "version": "1.0.0",
  "description": "Adds awesome functionality",
  "author": "Your Name",
  "commands": ["my-command", "another-command"],
  "dependencies": {
    "axios": "^1.0.0"
  }
}
```

### package.json (Alternative)

If using npm package structure, add plugin metadata to package.json:

```json
{
  "name": "cursor-prompt-plugin-awesome",
  "version": "1.0.0",
  "cursor-prompt": {
    "commands": ["my-command", "another-command"]
  }
}
```

## Creating a Command

### TypeScript Example

```typescript
import { BaseCommand } from 'cursor-prompt/cli';
import { ICommand } from 'cursor-prompt/types';

export class MyCommand extends BaseCommand implements ICommand {
  name = 'my-command';
  description = 'Does something awesome';
  aliases = ['mc', 'awesome'];
  
  options = [
    {
      flags: '-f, --force',
      description: 'Force execution',
      defaultValue: false
    },
    {
      flags: '-o, --output <file>',
      description: 'Output file path'
    }
  ];

  async execute(args: string, options: any): Promise<void> {
    this.info('Executing my awesome command...');
    
    if (options.force) {
      this.warn('Force mode enabled!');
    }
    
    // Your command logic here
    const result = await this.doSomethingAwesome(args);
    
    if (options.output) {
      await this.saveToFile(options.output, result);
    }
    
    this.success('Command completed successfully!');
  }

  private async doSomethingAwesome(input: string): Promise<string> {
    // Implementation
    return `Processed: ${input}`;
  }

  private async saveToFile(path: string, content: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(path, content);
  }
}

export default new MyCommand();
```

### JavaScript Example

```javascript
const { BaseCommand } = require('cursor-prompt/cli');

class MyCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'my-command';
    this.description = 'Does something awesome';
    this.aliases = ['mc'];
    this.options = [
      {
        flags: '-f, --force',
        description: 'Force execution',
        defaultValue: false
      }
    ];
  }

  async execute(args, options) {
    this.info('Executing command...');
    // Command logic
    this.success('Done!');
  }
}

module.exports = new MyCommand();
```

## Plugin Lifecycle

### Loading

1. Plugin directories are scanned on startup
2. Plugin metadata is loaded from `plugin.json` or `package.json`
3. Dependencies are verified
4. Commands are registered with the CLI

### Execution

1. User invokes command via CLI
2. Command registry finds matching plugin command
3. Command's `execute` method is called
4. Plugin can access configuration and services

## Available APIs

### BaseCommand Methods

```typescript
// Logging
this.info(message: string): void
this.warn(message: string): void
this.error(message: string): void
this.success(message: string): void

// User Interaction
this.confirm(message: string): Promise<boolean>
this.prompt(message: string, defaultValue?: string): Promise<string>

// Configuration
this.getConfig<T>(key: string): Promise<T | undefined>
this.setConfig(key: string, value: any): Promise<void>
```

### Service Access

```typescript
import { 
  ConfigManager,
  TemplateEngine,
  CursorIntegration,
  PluginLoader 
} from 'cursor-prompt';

// In your command
async execute() {
  const config = ConfigManager.getInstance();
  const templates = new TemplateEngine();
  const cursor = CursorIntegration.getInstance();
  
  // Use services
  const setting = config.get('my.setting');
  const rendered = await templates.render(template, variables);
  await cursor.inject(templateId);
}
```

## Advanced Features

### Custom Template Processors

```typescript
export class CustomProcessor {
  name = 'custom-processor';

  async process(template: string, variables: Record<string, any>): Promise<string> {
    // Custom template processing logic
    return processedTemplate;
  }
}
```

### Event Handling

```typescript
import { EventEmitter } from 'events';

export class EventAwarePlugin extends EventEmitter {
  constructor() {
    super();
    
    // Listen for system events
    this.on('template:rendered', (data) => {
      console.log('Template rendered:', data);
    });
    
    // Emit custom events
    this.emit('plugin:ready', { name: 'my-plugin' });
  }
}
```

### Cursor IDE Integration

```typescript
export class CursorPlugin {
  async injectToEditor(content: string): Promise<void> {
    const cursor = CursorIntegration.getInstance();
    
    if (cursor.isConnected()) {
      await cursor.inject('custom-template', { content });
    }
  }
}
```

## Testing Your Plugin

### Unit Tests

```typescript
import { MyCommand } from '../src/my-command';

describe('MyCommand', () => {
  let command: MyCommand;

  beforeEach(() => {
    command = new MyCommand();
  });

  test('should execute successfully', async () => {
    const result = await command.execute('test', { force: true });
    expect(result).toBeDefined();
  });
});
```

### Integration Testing

```bash
# Install plugin locally
npm link

# Test in a project
cursor-prompt my-command --force
```

## Publishing Your Plugin

### NPM Package

1. Name your package with prefix: `cursor-prompt-plugin-*`
2. Include plugin metadata in package.json
3. Publish to npm registry

```bash
npm publish
```

### Installation

```bash
# Global installation
npm install -g cursor-prompt-plugin-awesome

# Project installation
npm install cursor-prompt-plugin-awesome
```

### Manual Installation

Place plugin directory in:
- Project: `.cursor-prompt/plugins/`
- Global: `~/.cursor-prompt/plugins/`

## Best Practices

1. **Use TypeScript** for better type safety
2. **Follow naming conventions** for discoverability
3. **Document your commands** with clear descriptions
4. **Handle errors gracefully** with try-catch blocks
5. **Respect configuration** hierarchy
6. **Test thoroughly** before publishing
7. **Version properly** using semantic versioning
8. **Provide examples** in your plugin README

## Example Plugins

### Git Helper Plugin

```typescript
export class GitStatusCommand extends BaseCommand {
  name = 'git-status';
  description = 'Show git status with template context';

  async execute() {
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);

    try {
      const { stdout } = await execPromise('git status --short');
      const template = await this.renderTemplate('git-status', {
        files: stdout.split('\n').filter(Boolean)
      });
      
      this.success('Git status template generated');
      return template;
    } catch (error) {
      this.error(`Git command failed: ${error}`);
    }
  }
}
```

### API Integration Plugin

```typescript
export class APICommand extends BaseCommand {
  name = 'api-fetch';
  description = 'Fetch API data for templates';

  options = [
    {
      flags: '--endpoint <url>',
      description: 'API endpoint URL'
    }
  ];

  async execute(args, options) {
    if (!options.endpoint) {
      this.error('Endpoint is required');
      return;
    }

    const axios = require('axios');
    
    try {
      const response = await axios.get(options.endpoint);
      const template = await this.renderTemplate('api-response', {
        data: response.data
      });
      
      this.success('API data fetched and templated');
      return template;
    } catch (error) {
      this.error(`API request failed: ${error.message}`);
    }
  }
}
```

## Troubleshooting

### Plugin Not Loading

1. Check plugin.json syntax
2. Verify directory structure
3. Check console for error messages
4. Ensure dependencies are installed

### Command Not Found

1. Verify command is exported correctly
2. Check command name matches metadata
3. Ensure plugin is in correct directory
4. Try manual registration

### Permission Issues

1. Check file permissions
2. Ensure plugin directory is readable
3. Verify npm global directory access
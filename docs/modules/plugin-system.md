# Plugin System Module

## Purpose
The Plugin System module provides a robust architecture for extending the Cursor Prompt Template Engine with custom functionality. It enables developers to create, load, and manage plugins that can add new commands, modify template processing, and integrate with external services.

## Dependencies
- Internal: Command Registry, Plugin API, Template Engine, Config Service
- External: vm2 (sandboxing), resolve, semver

## Key Components

### PluginManager
Core class for plugin lifecycle management.

#### Public API
- `load(pluginPath: string): Promise<Plugin>` - Load a plugin
- `unload(pluginName: string): Promise<void>` - Unload a plugin
- `reload(pluginName: string): Promise<void>` - Reload a plugin
- `list(): Plugin[]` - List loaded plugins
- `install(pluginName: string): Promise<void>` - Install from marketplace
- `create(name: string, template?: string): Promise<void>` - Create new plugin
- `enable(pluginName: string): void` - Enable a plugin
- `disable(pluginName: string): void` - Disable a plugin

### PluginAPI
API exposed to plugins for interacting with the system.

#### Public API
- `registerCommand(name: string, handler: CommandHandler): void` - Register command
- `on(event: string, callback: EventCallback): void` - Listen to events
- `emit(event: string, data: any): void` - Emit events
- `getConfig(key?: string): any` - Get configuration
- `setConfig(key: string, value: any): void` - Set configuration
- `storage: PluginStorage` - Persistent storage
- `fs: RestrictedFileSystem` - File system access
- `sendMessage(targetPlugin: string, message: any): void` - Inter-plugin communication
- `registerHook(hook: string, handler: HookHandler): void` - Register hook

### CommandRegistry
Manages custom commands registered by plugins.

#### Public API
- `register(command: Command): void` - Register command
- `unregister(commandName: string): void` - Unregister command
- `execute(commandName: string, args: any[]): Promise<any>` - Execute command
- `getCommand(name: string): Command | undefined` - Get command details
- `listCommands(): Command[]` - List all commands

## Plugin Structure

### Basic Plugin Example
```javascript
// my-plugin.js
module.exports = {
  // Required metadata
  name: 'my-plugin',
  version: '1.0.0',
  description: 'Custom functionality plugin',
  author: 'your-name',
  
  // Optional metadata
  homepage: 'https://github.com/user/plugin',
  license: 'MIT',
  engines: {
    'cursor-prompt': '>=1.5.0'
  },
  
  // Plugin initialization
  async init(api) {
    this.api = api;
    console.log('Plugin initialized:', this.name);
    
    // Register a command
    api.registerCommand('my-command', {
      execute: async (args) => {
        console.log('Command executed with args:', args);
        return 'Command result';
      },
      description: 'My custom command',
      usage: 'cursor-prompt my-command [options]',
      options: [
        { flag: '-f, --flag', description: 'Example flag' }
      ]
    });
    
    // Listen to events
    api.on('template:rendered', (result) => {
      console.log('Template rendered:', result.template);
    });
    
    // Register hooks
    api.registerHook('before-template', async (context) => {
      // Modify context before template processing
      context.pluginData = 'Added by plugin';
      return context;
    });
  },
  
  // Plugin cleanup
  async destroy() {
    console.log('Plugin destroyed:', this.name);
    // Cleanup resources
  },
  
  // Hook definitions
  hooks: {
    'before-generate': async (context) => {
      // Process before template generation
      console.log('Before generate hook');
      return context;
    },
    
    'after-generate': async (result) => {
      // Process after template generation
      console.log('After generate hook');
      return result;
    },
    
    'validate-template': async (template) => {
      // Custom template validation
      if (!template.includes('required-text')) {
        throw new Error('Template missing required text');
      }
      return template;
    }
  },
  
  // Custom methods
  customMethod() {
    return 'Custom functionality';
  }
};
```

### TypeScript Plugin Example
```typescript
// my-plugin.ts
import { Plugin, PluginAPI, CommandHandler } from 'cursor-prompt';

interface MyPluginConfig {
  apiUrl: string;
  timeout: number;
}

class MyPlugin implements Plugin {
  name = 'my-typescript-plugin';
  version = '1.0.0';
  description = 'TypeScript plugin example';
  
  private api!: PluginAPI;
  private config!: MyPluginConfig;
  
  async init(api: PluginAPI): Promise<void> {
    this.api = api;
    this.config = api.getConfig() as MyPluginConfig;
    
    // Register typed command
    api.registerCommand('typed-command', {
      execute: this.handleCommand.bind(this),
      description: 'Typed command example'
    });
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  private async handleCommand(args: string[]): Promise<string> {
    // Command implementation
    return `Processed: ${args.join(', ')}`;
  }
  
  private setupEventListeners(): void {
    this.api.on('template:validated', (data) => {
      console.log('Template validated:', data);
    });
  }
  
  async destroy(): Promise<void> {
    // Cleanup
  }
}

export = new MyPlugin();
```

## Plugin Development

### Creating a New Plugin
```bash
# Create plugin from template
cursor-prompt plugin:create my-awesome-plugin

# Interactive creation
cursor-prompt plugin:create --interactive

# From specific template
cursor-prompt plugin:create my-plugin --template advanced
```

Generated structure:
```
my-awesome-plugin/
├── package.json
├── index.js
├── lib/
│   ├── commands.js
│   └── hooks.js
├── test/
│   └── plugin.test.js
├── README.md
└── .cursorplugin.json
```

### Plugin Configuration
```json
// .cursorplugin.json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "main": "index.js",
  "enabled": true,
  "config": {
    "apiUrl": "https://api.example.com",
    "timeout": 5000,
    "features": {
      "autoComplete": true,
      "validation": true
    }
  },
  "permissions": [
    "fs:read",
    "fs:write",
    "network",
    "storage"
  ],
  "dependencies": {
    "axios": "^0.27.0"
  }
}
```

## Available Hooks

### Template Processing Hooks
- `before-template` - Before template rendering
- `after-template` - After template rendering
- `validate-template` - Template validation
- `transform-template` - Template transformation

### Context Hooks
- `before-context` - Before context gathering
- `after-context` - After context gathering
- `filter-context` - Filter context data

### Command Hooks
- `before-command` - Before command execution
- `after-command` - After command execution
- `command-error` - Command error handling

### System Hooks
- `plugin:loaded` - Plugin loaded
- `plugin:unloaded` - Plugin unloaded
- `config:changed` - Configuration changed

## Plugin Storage

### Persistent Storage API
```javascript
// Store data
await api.storage.set('key', { data: 'value' });

// Retrieve data
const data = await api.storage.get('key');

// Delete data
await api.storage.delete('key');

// List all keys
const keys = await api.storage.keys();

// Clear all data
await api.storage.clear();
```

### File System Access
```javascript
// Restricted file system access
const content = await api.fs.readFile('template.md');
await api.fs.writeFile('output.md', content);

// Check permissions
if (api.fs.canWrite('path/to/file')) {
  await api.fs.writeFile('path/to/file', 'content');
}
```

## Inter-Plugin Communication

### Message Passing
```javascript
// Send message to another plugin
api.sendMessage('other-plugin', {
  type: 'request',
  data: { key: 'value' }
});

// Listen for messages
api.on('plugin:message', (message) => {
  if (message.from === 'other-plugin') {
    console.log('Received:', message.data);
    
    // Send response
    api.sendMessage(message.from, {
      type: 'response',
      data: { result: 'processed' }
    });
  }
});
```

### Shared State
```javascript
// Set shared state
api.setState('shared-key', { shared: 'data' });

// Get shared state
const state = api.getState('shared-key');

// Watch state changes
api.watchState('shared-key', (newValue, oldValue) => {
  console.log('State changed:', oldValue, '->', newValue);
});
```

## Testing Plugins

### Unit Testing
```javascript
// test/plugin.test.js
const { PluginAPI } = require('cursor-prompt');
const myPlugin = require('../index');

describe('My Plugin', () => {
  let api;
  
  beforeEach(() => {
    api = new PluginAPI();
  });
  
  test('initializes correctly', async () => {
    await myPlugin.init(api);
    expect(api.getCommands()).toContain('my-command');
  });
  
  test('handles command', async () => {
    await myPlugin.init(api);
    const result = await api.executeCommand('my-command', ['arg1']);
    expect(result).toBe('Expected result');
  });
  
  test('processes hook', async () => {
    const context = { data: 'test' };
    const result = await myPlugin.hooks['before-generate'](context);
    expect(result.pluginData).toBeDefined();
  });
});
```

### Integration Testing
```bash
# Test plugin in isolation
cursor-prompt plugin:test my-plugin

# Test with specific template
cursor-prompt plugin:test my-plugin --template test-template

# Test all hooks
cursor-prompt plugin:test my-plugin --test-hooks

# Generate test report
cursor-prompt plugin:test my-plugin --report
```

## Plugin Distribution

### Publishing to Marketplace
```bash
# Publish plugin
cursor-prompt plugin:publish

# Update published plugin
cursor-prompt plugin:update --version 1.1.0

# Unpublish plugin
cursor-prompt plugin:unpublish my-plugin
```

### Plugin Manifest for Marketplace
```yaml
# plugin.manifest.yaml
name: my-awesome-plugin
version: 1.0.0
author: your-username
description: Adds awesome functionality
category: productivity
tags:
  - automation
  - enhancement
  - productivity
license: MIT
homepage: https://github.com/user/plugin
repository: https://github.com/user/plugin
bugs: https://github.com/user/plugin/issues

# Plugin requirements
requirements:
  'cursor-prompt': '>=1.5.0'
  node: '>=14.0.0'

# Marketplace metadata
marketplace:
  featured: false
  screenshots:
    - url: https://example.com/screenshot.png
      caption: Plugin in action
  documentation: https://example.com/docs
  demo: https://example.com/demo
```

## Security Considerations

### Plugin Sandboxing
- Plugins run in isolated VM context
- Limited file system access
- Network requests require permission
- Resource usage limits enforced

### Permission Model
```javascript
// Plugin requests permissions in manifest
{
  "permissions": [
    "fs:read:/templates/**",  // Read templates directory
    "fs:write:/output/**",     // Write to output directory
    "network:https://api.example.com",  // Specific API access
    "storage:10mb",           // Storage limit
    "commands:register"       // Register commands
  ]
}
```

### Security Best Practices
1. Validate all plugin inputs
2. Use permission system properly
3. Don't store sensitive data
4. Sanitize file paths
5. Limit resource consumption
6. Use secure communication

## Performance Guidelines

### Optimization Tips
1. Lazy load heavy dependencies
2. Cache expensive operations
3. Use async/await properly
4. Minimize hook processing time
5. Clean up resources in destroy()

### Resource Limits
- Maximum memory: 128MB per plugin
- Maximum storage: 10MB default
- Network timeout: 30 seconds
- Hook timeout: 5 seconds
- Command timeout: 30 seconds

## Debugging Plugins

### Debug Mode
```bash
# Run with debug output
DEBUG=plugin:* cursor-prompt my-command

# Verbose plugin loading
cursor-prompt --plugin-debug plugin:load my-plugin

# Plugin profiling
cursor-prompt --profile-plugins generate template
```

### Debug API
```javascript
// Log debug information
api.debug('Debug message');

// Conditional debugging
if (api.isDebug()) {
  api.debug('Detailed debug info:', data);
}

// Performance timing
const timer = api.startTimer('operation');
// ... operation ...
timer.end(); // Logs timing
```

## Related Documentation
- [Plugin API Reference](../api/PLUGIN_API.md) - Complete API documentation
- [Command Registry](./command-registry.md) - Command management
- [Plugin Development Guide](../PLUGIN_DEVELOPMENT.md) - Development guide
- [Marketplace Guidelines](../MARKETPLACE_GUIDELINES.md) - Publishing guidelines
- [Security Model](../SECURITY.md) - Security documentation
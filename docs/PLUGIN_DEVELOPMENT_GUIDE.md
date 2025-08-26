# Plugin Development Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Plugin Structure](#plugin-structure)
4. [Plugin API](#plugin-api)
5. [Lifecycle & Hooks](#lifecycle--hooks)
6. [Commands & Variables](#commands--variables)
7. [Best Practices](#best-practices)
8. [Testing Plugins](#testing-plugins)
9. [Publishing to Marketplace](#publishing-to-marketplace)
10. [Advanced Topics](#advanced-topics)

## Introduction

The Cursor Prompt Template Engine plugin system allows developers to extend functionality, add custom commands, integrate with external services, and enhance template generation capabilities.

### Why Create Plugins?

- **Custom Workflows**: Automate your specific development processes
- **Tool Integration**: Connect with your favorite tools and services
- **Template Enhancement**: Add dynamic content and transformations
- **Community Sharing**: Share your solutions with other developers

## Getting Started

### Quick Start

1. Create a new plugin file:
```javascript
// my-first-plugin.js
module.exports = {
  name: 'my-first-plugin',
  version: '1.0.0',
  description: 'My first cursor-prompt plugin',
  
  init(api) {
    api.registerCommand('hello', {
      execute: () => 'Hello from my plugin!',
      description: 'Say hello'
    });
    return true;
  }
};
```

2. Load the plugin:
```bash
cursor-prompt plugin:load ./my-first-plugin.js
```

3. Use your new command:
```bash
cursor-prompt hello
```

### Plugin Generator

Use the built-in generator to create a plugin scaffold:

```bash
cursor-prompt plugin:create my-plugin
```

This creates a plugin template with:
- Basic structure
- Example hooks
- Configuration schema
- Test setup

## Plugin Structure

### Basic Structure

```javascript
module.exports = {
  // Required metadata
  name: 'plugin-name',           // Unique identifier
  version: '1.0.0',              // Semantic version
  description: 'Plugin purpose', // Brief description
  
  // Optional metadata
  author: 'your-name',           // Author name/email
  homepage: 'https://...',       // Plugin homepage
  repository: 'https://...',     // Source repository
  license: 'MIT',                // License type
  
  // Dependencies
  dependencies: ['other-plugin@^1.0.0'], // Required plugins
  peerDependencies: {},                   // Optional plugins
  
  // Configuration
  defaultConfig: {},             // Default configuration
  configSchema: {},              // JSON schema for config validation
  
  // Permissions
  permissions: [],               // Required permissions
  
  // Lifecycle methods
  async init(api, config) {},    // Initialize plugin
  async activate() {},           // Activate plugin
  async deactivate() {},         // Deactivate plugin
  async dispose() {},            // Clean up resources
  
  // Hooks
  hooks: {
    'hook-name': async (context) => context
  }
};
```

### TypeScript Support

For TypeScript plugins, use the type definitions:

```typescript
import { IPlugin, PluginAPI, PluginContext } from 'cursor-prompt/types';

const plugin: IPlugin = {
  name: 'typescript-plugin',
  version: '1.0.0',
  
  async init(api: PluginAPI): Promise<boolean> {
    // Type-safe API usage
    api.registerCommand('typed-command', {
      execute: async (args: CommandArgs) => {
        return { success: true };
      }
    });
    return true;
  }
};

export = plugin;
```

## Plugin API

### Core API Methods

#### Command Registration
```javascript
api.registerCommand(name, {
  execute: async (args) => { /* implementation */ },
  description: 'Command description',
  options: [
    { name: 'option', type: 'string', description: 'Option desc' }
  ]
});
```

#### Event System
```javascript
// Listen to events
api.on('event-name', (data) => {
  console.log('Event received:', data);
});

// Emit events
api.emit('custom-event', { data: 'value' });

// Once listener
api.once('event-name', handler);

// Remove listener
api.off('event-name', handler);
```

#### Configuration
```javascript
// Get configuration
const config = api.getConfig('key');
const allConfig = api.getAllConfig();

// Set configuration
api.setConfig('key', 'value');

// Watch configuration changes
api.watchConfig('key', (newValue, oldValue) => {
  console.log(`Config changed from ${oldValue} to ${newValue}`);
});
```

#### Storage
```javascript
// Persistent storage for plugin data
await api.storage.set('key', { data: 'value' });
const data = await api.storage.get('key');
await api.storage.delete('key');
const allData = await api.storage.getAll();
```

#### File System (Restricted)
```javascript
// Read files (restricted to allowed paths)
const content = await api.fs.readFile('path/to/file');
const json = await api.fs.readJson('config.json');

// Write files (restricted to plugin directory)
await api.fs.writeFile('plugin-data/output.txt', 'content');
await api.fs.writeJson('plugin-data/data.json', { key: 'value' });

// File operations
const exists = await api.fs.exists('path');
const stats = await api.fs.stat('path');
const files = await api.fs.glob('**/*.js');
```

#### Template System
```javascript
// Register template enhancer
api.registerTemplateEnhancer('template-name', async (template, context) => {
  template.customData = await fetchData();
  return template;
});

// Register variable provider
api.registerVariableProvider('varName', async () => {
  return await computeValue();
});

// Register transformation
api.registerTransform('custom', (value, ...args) => {
  return transformValue(value, args);
});
```

#### Inter-Plugin Communication
```javascript
// Send message to another plugin
api.sendMessage('target-plugin', { 
  type: 'request',
  data: 'value'
});

// Receive messages
api.onMessage((message) => {
  console.log(`Message from ${message.from}:`, message.data);
});

// Get other plugin instance
const otherPlugin = api.getPlugin('other-plugin');
if (otherPlugin) {
  const result = await otherPlugin.someMethod();
}
```

#### Logging
```javascript
api.log('info', 'Information message');
api.log('warn', 'Warning message');
api.log('error', 'Error message', errorObject);
api.log('debug', 'Debug information');
```

## Lifecycle & Hooks

### Plugin Lifecycle

1. **Load**: Plugin file is loaded
2. **Init**: `init()` method called with API
3. **Activate**: `activate()` method called
4. **Running**: Plugin is active
5. **Deactivate**: `deactivate()` method called
6. **Dispose**: `dispose()` method called
7. **Unload**: Plugin is removed from memory

### Available Hooks

#### Template Hooks
```javascript
hooks: {
  // Before template processing
  'before-template': async (context) => {
    context.customData = await fetchData();
    return context;
  },
  
  // After template processing
  'after-template': async (result, context) => {
    result.enhanced = true;
    return result;
  },
  
  // Before variable substitution
  'before-variables': async (variables) => {
    variables.timestamp = Date.now();
    return variables;
  },
  
  // After generation
  'after-generate': async (output, context) => {
    await saveOutput(output);
    return output;
  }
}
```

#### Command Hooks
```javascript
hooks: {
  // Before any command execution
  'before-command': async (context) => {
    console.log(`Executing: ${context.command}`);
    return context;
  },
  
  // After command execution
  'after-command': async (result, context) => {
    logCommand(context.command, result);
    return result;
  },
  
  // Command error handling
  'command-error': async (error, context) => {
    reportError(error, context);
    throw error; // Re-throw to propagate
  }
}
```

#### File System Hooks
```javascript
hooks: {
  // Before file read
  'before-read': async (path) => {
    validatePath(path);
    return path;
  },
  
  // After file write
  'after-write': async (path, content) => {
    logFileChange(path);
  },
  
  // File operation error
  'file-error': async (error, operation, path) => {
    handleFileError(error, operation, path);
  }
}
```

### Hook Execution Order

Hooks are executed in priority order (higher priority first):

```javascript
module.exports = {
  name: 'high-priority-plugin',
  priority: 100, // Default is 50
  
  hooks: {
    'before-template': async (context) => {
      // Executes before lower priority plugins
      return context;
    }
  }
};
```

## Commands & Variables

### Creating Commands

```javascript
api.registerCommand('my-command', {
  execute: async (args) => {
    // Access arguments
    const { input, flags, options } = args;
    
    // Perform operations
    const result = await processData(input);
    
    // Return result (will be displayed to user)
    return {
      success: true,
      message: `Processed: ${result}`
    };
  },
  
  description: 'Process data with custom logic',
  
  options: [
    {
      name: 'format',
      type: 'string',
      description: 'Output format',
      choices: ['json', 'yaml', 'text'],
      default: 'json'
    },
    {
      name: 'verbose',
      type: 'boolean',
      description: 'Verbose output',
      default: false
    }
  ],
  
  // Command validation
  validate: (args) => {
    if (!args.input) {
      throw new Error('Input is required');
    }
    return true;
  }
});
```

### Providing Variables

```javascript
// Static variable
api.registerVariable('plugin.version', '1.0.0');

// Dynamic variable provider
api.registerVariableProvider('plugin.data', async () => {
  const data = await fetchExternalData();
  return data;
});

// Computed variables with dependencies
api.registerVariableProvider('plugin.computed', async (context) => {
  const baseValue = context.variables.baseValue;
  return computeFrom(baseValue);
});
```

### Variable Transformations

```javascript
// Register custom transformation
api.registerTransform('reverse', (value) => {
  return String(value).split('').reverse().join('');
});

api.registerTransform('capitalize', (value) => {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
});

// Usage in templates:
// {{text | reverse}}
// {{name | capitalize}}
```

## Best Practices

### 1. Error Handling

Always handle errors gracefully:

```javascript
async init(api) {
  try {
    await this.setupResources();
    return true;
  } catch (error) {
    api.log('error', 'Failed to initialize plugin', error);
    return false;
  }
}
```

### 2. Resource Management

Clean up resources properly:

```javascript
class MyPlugin {
  async activate() {
    this.interval = setInterval(() => this.check(), 5000);
    this.connection = await createConnection();
  }
  
  async deactivate() {
    clearInterval(this.interval);
    await this.connection?.close();
  }
}
```

### 3. Configuration Validation

Use JSON Schema for configuration:

```javascript
configSchema: {
  type: 'object',
  required: ['apiKey'],
  properties: {
    apiKey: {
      type: 'string',
      minLength: 10
    },
    timeout: {
      type: 'number',
      minimum: 0,
      default: 5000
    }
  }
}
```

### 4. Performance

- Cache expensive operations
- Use async/await properly
- Implement timeouts for external calls
- Batch operations when possible

```javascript
class CachedPlugin {
  constructor() {
    this.cache = new Map();
  }
  
  async getData(key) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    
    const data = await fetchExpensiveData(key);
    this.cache.set(key, data);
    
    // Expire cache after 5 minutes
    setTimeout(() => this.cache.delete(key), 5 * 60 * 1000);
    
    return data;
  }
}
```

### 5. Security

- Validate all inputs
- Use permissions system
- Don't expose sensitive data
- Sanitize file paths

```javascript
permissions: ['fs:read', 'network:https'],

async readFile(path) {
  // Validate path is within allowed directory
  const safePath = path.resolve(this.allowedDir, path);
  if (!safePath.startsWith(this.allowedDir)) {
    throw new Error('Access denied');
  }
  return await this.api.fs.readFile(safePath);
}
```

## Testing Plugins

### Unit Testing

```javascript
// test/my-plugin.test.js
const { describe, it, expect, beforeEach } = require('@jest/globals');
const plugin = require('../my-plugin');

describe('MyPlugin', () => {
  let mockApi;
  
  beforeEach(() => {
    mockApi = {
      registerCommand: jest.fn(),
      on: jest.fn(),
      getConfig: jest.fn(),
      log: jest.fn()
    };
  });
  
  it('should initialize successfully', async () => {
    const result = await plugin.init(mockApi);
    expect(result).toBe(true);
    expect(mockApi.registerCommand).toHaveBeenCalled();
  });
  
  it('should handle commands correctly', async () => {
    await plugin.init(mockApi);
    const [[name, handler]] = mockApi.registerCommand.mock.calls;
    
    expect(name).toBe('my-command');
    const result = await handler.execute({ input: 'test' });
    expect(result.success).toBe(true);
  });
});
```

### Integration Testing

```javascript
// test/integration.test.js
const { PluginManager } = require('cursor-prompt');

describe('Plugin Integration', () => {
  let manager;
  
  beforeEach(() => {
    manager = new PluginManager();
  });
  
  it('should work with other plugins', async () => {
    await manager.load('./my-plugin.js');
    await manager.load('./other-plugin.js');
    
    const result = await manager.execute('my-command', {
      input: 'test'
    });
    
    expect(result).toBeDefined();
  });
});
```

### Testing Hooks

```javascript
it('should modify context in before-template hook', async () => {
  const context = { variables: {} };
  const result = await plugin.hooks['before-template'](context);
  
  expect(result.variables.customData).toBeDefined();
});
```

## Publishing to Marketplace

### 1. Prepare Your Plugin

Create a manifest file:

```yaml
# plugin.manifest.yaml
name: my-awesome-plugin
version: 1.0.0
description: Awesome functionality for cursor-prompt
author:
  name: Your Name
  email: you@example.com
  github: yourusername
repository: https://github.com/yourusername/my-plugin
homepage: https://your-plugin-site.com
license: MIT
category: productivity
tags:
  - automation
  - workflow
  - enhancement
keywords:
  - cursor
  - prompt
  - template
compatibility:
  cursor-prompt: "^2.0.0"
  node: ">=18.0.0"
screenshots:
  - url: https://example.com/screenshot1.png
    caption: Main interface
  - url: https://example.com/screenshot2.png
    caption: Configuration screen
```

### 2. Add Documentation

Include comprehensive documentation:

```markdown
# README.md

## Installation
\`\`\`bash
cursor-prompt plugin:install my-awesome-plugin
\`\`\`

## Configuration
...

## Usage
...

## API Reference
...
```

### 3. Validate Plugin

```bash
# Validate plugin structure
cursor-prompt plugin:validate ./my-plugin.js

# Test plugin locally
cursor-prompt plugin:test ./my-plugin.js
```

### 4. Publish

```bash
# Publish to marketplace
cursor-prompt marketplace:publish \
  --plugin ./my-plugin.js \
  --manifest ./plugin.manifest.yaml
```

### 5. Version Updates

```bash
# Update plugin version
cursor-prompt marketplace:update my-awesome-plugin \
  --version 1.1.0 \
  --changelog "Added new features"
```

## Advanced Topics

### Plugin Composition

Combine multiple plugins for complex functionality:

```javascript
const basePlugin = require('./base-plugin');
const enhancerPlugin = require('./enhancer-plugin');

module.exports = {
  name: 'composed-plugin',
  version: '1.0.0',
  
  async init(api) {
    // Initialize base functionality
    await basePlugin.init(api);
    
    // Add enhancements
    await enhancerPlugin.enhance(api, basePlugin);
    
    return true;
  }
};
```

### Dynamic Plugin Loading

Load plugins at runtime based on conditions:

```javascript
async init(api) {
  const config = api.getConfig();
  
  if (config.enableAdvancedFeatures) {
    const advancedPlugin = await import('./advanced-features');
    await advancedPlugin.init(api);
  }
  
  return true;
}
```

### Plugin Sandboxing

For untrusted plugins, use sandboxing:

```javascript
const vm = require('vm');

function loadSandboxedPlugin(code) {
  const sandbox = {
    module: { exports: {} },
    console: console,
    require: (module) => {
      // Restricted require
      const allowed = ['path', 'url'];
      if (allowed.includes(module)) {
        return require(module);
      }
      throw new Error(`Module not allowed: ${module}`);
    }
  };
  
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  
  return sandbox.module.exports;
}
```

### Performance Monitoring

Track plugin performance:

```javascript
class PerformanceMonitor {
  constructor(api) {
    this.api = api;
    this.metrics = new Map();
  }
  
  async measure(name, fn) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      this.recordMetric(name, duration);
      return result;
    } catch (error) {
      this.recordError(name, error);
      throw error;
    }
  }
  
  recordMetric(name, duration) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(duration);
    
    // Log slow operations
    if (duration > 1000) {
      this.api.log('warn', `Slow operation: ${name} took ${duration}ms`);
    }
  }
}
```

### Custom Protocol Handlers

Register custom protocol handlers:

```javascript
api.registerProtocol('myplugin://', async (url) => {
  const path = url.replace('myplugin://', '');
  const data = await fetchCustomData(path);
  return data;
});

// Usage in templates:
// {{myplugin://data/config}}
```

## Troubleshooting

### Common Issues

1. **Plugin not loading**: Check syntax errors and dependencies
2. **Commands not working**: Verify command registration
3. **Hooks not firing**: Check hook names and return values
4. **Performance issues**: Profile and optimize expensive operations
5. **Permission errors**: Request necessary permissions in manifest

### Debug Mode

Enable debug logging:

```javascript
if (process.env.DEBUG) {
  api.log('debug', 'Detailed debugging information');
}
```

Run with debug mode:
```bash
DEBUG=true cursor-prompt my-command
```

## Resources

- [Plugin API Reference](./API_REFERENCE.md)
- [Example Plugins](../examples/plugins/)
- [Plugin Template](../templates/plugin-template/)
- [Community Plugins](https://github.com/cursor-prompt/community-plugins)
- [Support Forum](https://github.com/cursor-prompt/discussions)

## Contributing

We welcome plugin contributions! Please:

1. Follow the coding standards
2. Include comprehensive tests
3. Document your plugin thoroughly
4. Submit to the marketplace
5. Maintain your plugin

---

Happy plugin development! 🚀
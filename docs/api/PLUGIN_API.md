# Plugin API Reference

Complete API reference for developing Cursor Prompt Template Engine plugins.

## Table of Contents
- [Plugin Structure](#plugin-structure)
- [PluginAPI Interface](#pluginapi-interface)
- [Command Registration](#command-registration)
- [Event System](#event-system)
- [Hook System](#hook-system)
- [Storage API](#storage-api)
- [Configuration API](#configuration-api)
- [File System API](#file-system-api)
- [Inter-Plugin Communication](#inter-plugin-communication)
- [Utility Functions](#utility-functions)

## Plugin Structure

### Required Properties
```typescript
interface Plugin {
  // Required metadata
  name: string;           // Unique plugin identifier
  version: string;        // Semantic version (e.g., "1.0.0")
  description: string;    // Brief description of functionality
  
  // Lifecycle methods
  init(api: PluginAPI): Promise<void>;     // Initialize plugin
  destroy?(): Promise<void>;               // Cleanup on unload
  
  // Optional properties
  author?: string;        // Plugin author
  homepage?: string;      // Plugin homepage URL
  license?: string;       // License identifier
  engines?: {            // Version requirements
    'cursor-prompt'?: string;
    node?: string;
  };
  
  // Hook definitions
  hooks?: {
    [hookName: string]: HookHandler;
  };
}
```

## PluginAPI Interface

### Core Methods

#### registerCommand()
Register a new CLI command.
```typescript
api.registerCommand(name: string, handler: CommandHandler): void

interface CommandHandler {
  execute(args: string[], options: CommandOptions): Promise<any>;
  description?: string;
  usage?: string;
  options?: CommandOption[];
  examples?: string[];
}

// Example
api.registerCommand('my-command', {
  execute: async (args, options) => {
    return `Executed with ${args.length} arguments`;
  },
  description: 'My custom command',
  usage: 'my-command <arg1> [arg2]',
  options: [
    { flag: '-f, --force', description: 'Force operation' }
  ]
});
```

#### unregisterCommand()
Remove a registered command.
```typescript
api.unregisterCommand(name: string): void

// Example
api.unregisterCommand('my-command');
```

## Event System

### Event Methods

#### on()
Listen for events.
```typescript
api.on(event: string, callback: EventCallback): void

type EventCallback = (data: any) => void | Promise<void>;

// Example
api.on('template:rendered', async (data) => {
  console.log('Template rendered:', data.template);
});
```

#### once()
Listen for an event once.
```typescript
api.once(event: string, callback: EventCallback): void

// Example
api.once('config:loaded', (config) => {
  console.log('Config loaded once:', config);
});
```

#### off()
Remove event listener.
```typescript
api.off(event: string, callback: EventCallback): void
```

#### emit()
Emit custom events.
```typescript
api.emit(event: string, data?: any): void

// Example
api.emit('my-plugin:custom-event', { 
  message: 'Something happened' 
});
```

### Available Events

#### Template Events
- `template:loading` - Template load started
- `template:loaded` - Template loaded successfully
- `template:rendering` - Template rendering started
- `template:rendered` - Template rendered successfully
- `template:error` - Template processing error
- `template:validated` - Template validation complete

#### Command Events
- `command:registered` - Command registered
- `command:executing` - Command execution started
- `command:executed` - Command executed successfully
- `command:error` - Command execution error

#### Plugin Events
- `plugin:loaded` - Plugin loaded
- `plugin:unloaded` - Plugin unloaded
- `plugin:error` - Plugin error
- `plugin:message` - Inter-plugin message

#### System Events
- `config:changed` - Configuration changed
- `cache:cleared` - Cache cleared
- `marketplace:connected` - Connected to marketplace

## Hook System

### registerHook()
Register a processing hook.
```typescript
api.registerHook(name: string, handler: HookHandler): void

type HookHandler = (data: any) => any | Promise<any>;
```

### Available Hooks

#### Template Processing
```typescript
// Before template rendering
api.registerHook('before-template', async (context) => {
  context.customData = 'Added by plugin';
  return context;
});

// After template rendering
api.registerHook('after-template', async (result) => {
  result.footer = 'Added by plugin';
  return result;
});

// Template validation
api.registerHook('validate-template', async (template) => {
  if (!template.metadata) {
    throw new Error('Template missing metadata');
  }
  return template;
});
```

#### Context Hooks
```typescript
// Modify context before gathering
api.registerHook('before-context', async (options) => {
  options.includeCustom = true;
  return options;
});

// Process gathered context
api.registerHook('after-context', async (context) => {
  context.plugin = { data: 'custom' };
  return context;
});
```

## Storage API

### Persistent Storage
```typescript
interface PluginStorage {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  has(key: string): Promise<boolean>;
}

// Examples
// Store data
await api.storage.set('settings', {
  apiKey: 'secret',
  enabled: true
});

// Retrieve data
const settings = await api.storage.get('settings');

// Check existence
if (await api.storage.has('settings')) {
  // Settings exist
}

// List all keys
const keys = await api.storage.keys();

// Delete specific key
await api.storage.delete('old-data');

// Clear all plugin data
await api.storage.clear();
```

## Configuration API

### getConfig()
Get configuration values.
```typescript
api.getConfig(key?: string): any

// Get all config
const config = api.getConfig();

// Get specific value
const timeout = api.getConfig('timeout');

// Get nested value
const apiUrl = api.getConfig('api.url');
```

### setConfig()
Set configuration values.
```typescript
api.setConfig(key: string, value: any): void

// Set value
api.setConfig('timeout', 5000);

// Set nested value
api.setConfig('api.url', 'https://api.example.com');
```

### watchConfig()
Watch configuration changes.
```typescript
api.watchConfig(key: string, callback: (newValue: any, oldValue: any) => void): void

// Watch specific key
api.watchConfig('theme', (newTheme, oldTheme) => {
  console.log(`Theme changed: ${oldTheme} -> ${newTheme}`);
});
```

## File System API

### Restricted File System Access
```typescript
interface RestrictedFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<FileStats>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  canRead(path: string): boolean;
  canWrite(path: string): boolean;
}

// Examples
// Read file
const content = await api.fs.readFile('template.md');

// Write file (requires permission)
if (api.fs.canWrite('output.md')) {
  await api.fs.writeFile('output.md', 'Content');
}

// Check existence
if (await api.fs.exists('config.json')) {
  // File exists
}

// List directory
const files = await api.fs.readdir('./templates');

// Get file stats
const stats = await api.fs.stat('file.txt');
console.log(`Size: ${stats.size} bytes`);

// Create directory
await api.fs.mkdir('./output');

// Remove file/directory
await api.fs.remove('./temp');
```

## Inter-Plugin Communication

### sendMessage()
Send message to another plugin.
```typescript
api.sendMessage(targetPlugin: string, message: any): void

// Send request
api.sendMessage('other-plugin', {
  type: 'request',
  action: 'getData',
  params: { id: 123 }
});

// Listen for messages
api.on('plugin:message', (message) => {
  if (message.from === 'other-plugin') {
    // Handle message
    if (message.type === 'response') {
      console.log('Received data:', message.data);
    }
  }
});
```

### Shared State
```typescript
// Set shared state
api.setState(key: string, value: any): void
api.setState('shared-data', { count: 1 });

// Get shared state
api.getState(key: string): any
const data = api.getState('shared-data');

// Watch state changes
api.watchState(key: string, callback: StateWatcher): void
api.watchState('shared-data', (newValue, oldValue) => {
  console.log('State changed:', newValue);
});
```

## Utility Functions

### Logging
```typescript
// Log levels
api.log(message: string, ...args: any[]): void      // Info
api.debug(message: string, ...args: any[]): void    // Debug
api.warn(message: string, ...args: any[]): void     // Warning
api.error(message: string, ...args: any[]): void    // Error

// Examples
api.log('Plugin started');
api.debug('Debug info:', { data: 'value' });
api.warn('Deprecated feature used');
api.error('Operation failed:', error);
```

### Performance
```typescript
// Start timer
const timer = api.startTimer(label: string): Timer

interface Timer {
  end(): number;  // Returns elapsed time in ms
}

// Example
const timer = api.startTimer('processing');
// ... do work ...
const elapsed = timer.end();
api.log(`Processing took ${elapsed}ms`);
```

### Prompts
```typescript
// Show prompt to user
api.prompt(options: PromptOptions): Promise<any>

interface PromptOptions {
  type: 'input' | 'confirm' | 'select' | 'multiselect';
  message: string;
  default?: any;
  choices?: Array<string | { name: string; value: any }>;
  validate?: (value: any) => boolean | string;
}

// Examples
// Text input
const name = await api.prompt({
  type: 'input',
  message: 'Enter project name:',
  default: 'my-project'
});

// Confirmation
const proceed = await api.prompt({
  type: 'confirm',
  message: 'Continue with operation?',
  default: true
});

// Selection
const choice = await api.prompt({
  type: 'select',
  message: 'Select framework:',
  choices: ['React', 'Vue', 'Angular']
});
```

### Validation
```typescript
// Validate template
api.validateTemplate(template: string): ValidationResult

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// Example
const result = api.validateTemplate(templateContent);
if (!result.valid) {
  result.errors.forEach(error => {
    api.error(`Validation error: ${error.message}`);
  });
}
```

### Template Processing
```typescript
// Render template with context
api.renderTemplate(template: string, context: any): Promise<string>

// Example
const rendered = await api.renderTemplate(
  'Hello {{name}}!',
  { name: 'World' }
);
// Result: "Hello World!"
```

### Cache Management
```typescript
// Cache operations
api.cache.get(key: string): any
api.cache.set(key: string, value: any, ttl?: number): void
api.cache.delete(key: string): void
api.cache.clear(): void

// Examples
// Cache with TTL (in seconds)
api.cache.set('data', fetchedData, 300); // 5 minutes

// Retrieve from cache
const cached = api.cache.get('data');
if (!cached) {
  // Fetch fresh data
}
```

## Type Definitions

### Complete TypeScript Definitions
```typescript
// Import types for TypeScript plugins
import {
  Plugin,
  PluginAPI,
  CommandHandler,
  EventCallback,
  HookHandler,
  PromptOptions,
  ValidationResult,
  FileStats,
  Timer
} from 'cursor-prompt';

// Plugin class with full typing
class MyPlugin implements Plugin {
  name = 'my-plugin';
  version = '1.0.0';
  description = 'Typed plugin';
  
  private api!: PluginAPI;
  
  async init(api: PluginAPI): Promise<void> {
    this.api = api;
    // Plugin initialization
  }
  
  async destroy(): Promise<void> {
    // Cleanup
  }
}
```

## Error Handling

### Plugin Errors
```typescript
// Throw typed errors
class PluginError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
  }
}

// Usage
throw new PluginError(
  'Operation failed',
  'OPERATION_FAILED',
  { reason: 'Invalid input' }
);
```

### Error Recovery
```typescript
// Graceful error handling
api.on('error', (error) => {
  api.error('Plugin error:', error);
  // Attempt recovery
});

// Hook error handling
api.registerHook('before-template', async (context) => {
  try {
    // Processing
    return modifiedContext;
  } catch (error) {
    api.warn('Hook failed, using original context');
    return context; // Return unmodified
  }
});
```

## Examples

### Complete Plugin Example
```javascript
module.exports = {
  name: 'example-plugin',
  version: '1.0.0',
  description: 'Comprehensive plugin example',
  
  async init(api) {
    // Store API reference
    this.api = api;
    
    // Register command
    api.registerCommand('example', {
      execute: async (args) => {
        api.log('Executing example command');
        
        // Use storage
        const count = await api.storage.get('count') || 0;
        await api.storage.set('count', count + 1);
        
        // Render template
        const result = await api.renderTemplate(
          'Execution #{{count}}',
          { count: count + 1 }
        );
        
        return result;
      },
      description: 'Example command'
    });
    
    // Register hooks
    api.registerHook('before-template', async (context) => {
      context.pluginVersion = this.version;
      return context;
    });
    
    // Listen for events
    api.on('template:rendered', (data) => {
      api.debug('Template rendered:', data.template);
    });
    
    // Watch configuration
    api.watchConfig('enabled', (enabled) => {
      if (enabled) {
        this.enable();
      } else {
        this.disable();
      }
    });
  },
  
  async destroy() {
    api.log('Cleaning up example plugin');
    // Cleanup is automatic for registered commands/hooks
  },
  
  // Custom methods
  enable() {
    this.api.log('Plugin enabled');
  },
  
  disable() {
    this.api.log('Plugin disabled');
  }
};
```

---

*For more examples and guides, see the [Plugin Development Guide](../PLUGIN_DEVELOPMENT.md)*
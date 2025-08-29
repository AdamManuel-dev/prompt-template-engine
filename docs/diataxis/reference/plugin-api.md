# Plugin API Reference

**Version:** 1.0.0  
**Target Audience:** Plugin developers  
**Completion:** Complete technical specification

This reference provides the complete API specification for developing plugins in the Cursor Prompt Template Engine.

## Plugin Class Structure

### Base Plugin Interface

```typescript
interface Plugin {
  name: string;
  version: string;
  description?: string;
  dependencies?: string[];
  
  initialize(api: PluginAPI): Promise<void>;
  cleanup?(): Promise<void>;
}
```

### Plugin API Interface

```typescript
interface PluginAPI {
  // Core APIs
  command(name: string, config: CommandConfig): void;
  processor(name: string, config: ProcessorConfig): void;
  hook(event: string, handler: HookHandler): void;
  helper(name: string, handler: HelperFunction): void;
  
  // Execution APIs
  execute(command: string, args: string[]): Promise<ExecutionResult>;
  prompt(options: PromptOptions): Promise<any>;
  
  // Template APIs
  template: {
    generate(name: string, variables: any): Promise<GenerationResult>;
    render(content: string, context: any): Promise<string>;
    validate(template: string): ValidationResult;
  };
  
  // Utility APIs
  cache: Cache;
  logger: Logger;
  config: Config;
  events: EventEmitter;
}
```

## Command Registration

### Command Configuration

```typescript
interface CommandConfig {
  description: string;
  arguments?: ArgumentDefinition[];
  options?: OptionDefinition[];
  examples?: string[];
  handler: CommandHandler;
}

interface ArgumentDefinition {
  name: string;
  description: string;
  required?: boolean;
  type: 'string' | 'number' | 'boolean';
  choices?: string[];
  default?: any;
}

interface OptionDefinition {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  default?: any;
  required?: boolean;
  choices?: string[];
}

type CommandHandler = (
  args: Record<string, any>,
  options: Record<string, any>
) => Promise<any>;
```

### Example Command Registration

```typescript
// Register a command
api.command('git:status', {
  description: 'Show Git repository status with enhancements',
  arguments: [
    {
      name: 'path',
      description: 'Repository path',
      type: 'string',
      default: '.'
    }
  ],
  options: [
    {
      name: '--verbose',
      description: 'Show detailed status',
      type: 'boolean',
      default: false
    },
    {
      name: '--format',
      description: 'Output format',
      type: 'string',
      choices: ['json', 'table', 'plain'],
      default: 'table'
    }
  ],
  examples: [
    'git:status',
    'git:status /path/to/repo --verbose',
    'git:status --format json'
  ],
  handler: async (args, options) => {
    const result = await api.execute('git', ['status', args.path]);
    
    if (options.format === 'json') {
      return JSON.stringify(parseGitStatus(result.stdout));
    }
    
    return formatGitStatus(result.stdout, options.verbose);
  }
});
```

## Template Processors

### Processor Configuration

```typescript
interface ProcessorConfig {
  description: string;
  priority: number; // Higher numbers execute first
  handler: ProcessorHandler;
}

type ProcessorHandler = (
  content: string,
  context: TemplateContext
) => Promise<string>;

interface TemplateContext {
  variables: Record<string, any>;
  helpers: Record<string, Function>;
  partials: Record<string, string>;
  metadata: TemplateMetadata;
  outputPath?: string;
}
```

### Example Processor Registration

```typescript
// Register a template processor
api.processor('git-context-injector', {
  description: 'Inject Git repository context into templates',
  priority: 100,
  handler: async (content, context) => {
    // Gather Git context
    const gitContext = await gatherGitContext();
    
    // Add to template context
    context.variables.git = gitContext;
    
    // Add Git-specific helpers
    context.helpers.gitBranch = () => gitContext.branch;
    context.helpers.gitCommit = (length = 7) => 
      gitContext.commit.substring(0, length);
    
    return content;
  }
});
```

## Event Hooks

### Available Hook Events

```typescript
type HookEvent =
  | 'plugin:loaded'
  | 'plugin:unloaded'
  | 'template:before'
  | 'template:after'
  | 'template:error'
  | 'command:before'
  | 'command:after'
  | 'command:error'
  | 'context:gathered'
  | 'optimization:started'
  | 'optimization:completed';

type HookHandler = (data: any, context?: any) => Promise<void>;
```

### Hook Registration Examples

```typescript
// Before template generation
api.hook('template:before', async (templateName, variables) => {
  console.log(`Generating template: ${templateName}`);
  
  // Validate required variables
  if (templateName === 'api-endpoint' && !variables.name) {
    throw new Error('API endpoint name is required');
  }
});

// After template generation
api.hook('template:after', async (templateName, variables, result) => {
  // Log successful generation
  api.logger.info('Template generated', {
    template: templateName,
    files: result.files.length,
    duration: result.duration
  });
  
  // Auto-commit if enabled
  const config = await api.config.get('autoCommit');
  if (config) {
    await api.execute('git', ['add', ...result.files]);
    await api.execute('git', ['commit', '-m', `Generated ${templateName}`]);
  }
});

// Error handling
api.hook('template:error', async (error, context) => {
  api.logger.error('Template generation failed', {
    error: error.message,
    template: context.templateName,
    variables: context.variables
  });
  
  // Send error notification
  await sendErrorNotification(error, context);
});
```

## Template Helpers

### Helper Function Types

```typescript
type HelperFunction = (...args: any[]) => any | Promise<any>;

interface HelperOptions {
  name: string;
  description?: string;
  examples?: string[];
  async?: boolean;
}
```

### Helper Registration Examples

```typescript
// Simple synchronous helper
api.helper('uppercase', (text: string) => {
  return text.toUpperCase();
});

// Asynchronous helper with Git integration
api.helper('gitLog', async (count = 10) => {
  const result = await api.execute('git', [
    'log', 
    `--max-count=${count}`, 
    '--pretty=format:%h %s'
  ]);
  return result.stdout.split('\n');
});

// Helper with complex logic
api.helper('formatCode', async (code: string, language: string) => {
  try {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return await api.execute('prettier', [
          '--parser', 'typescript',
          '--stdin-filepath', `temp.${language === 'typescript' ? 'ts' : 'js'}`
        ], { input: code });
        
      case 'json':
        return JSON.stringify(JSON.parse(code), null, 2);
        
      default:
        return code;
    }
  } catch (error) {
    api.logger.warn('Code formatting failed', { language, error: error.message });
    return code;
  }
});
```

## Execution API

### Command Execution

```typescript
interface ExecutionOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  input?: string;
  stdio?: 'pipe' | 'ignore' | 'inherit';
}

interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

// Execute system commands safely
const result = await api.execute('git', ['status', '--porcelain'], {
  cwd: '/path/to/repo',
  timeout: 5000
});

if (result.exitCode === 0) {
  console.log('Git status:', result.stdout);
} else {
  console.error('Git command failed:', result.stderr);
}
```

### User Prompts

```typescript
interface PromptOptions {
  type: 'input' | 'confirm' | 'select' | 'multiselect' | 'password';
  message: string;
  default?: any;
  choices?: string[] | { name: string; value: any }[];
  validate?: (input: any) => boolean | string;
}

// Text input
const name = await api.prompt({
  type: 'input',
  message: 'Enter your name:',
  validate: (input) => input.length > 0 || 'Name is required'
});

// Confirmation
const confirmed = await api.prompt({
  type: 'confirm',
  message: 'Do you want to continue?',
  default: true
});

// Selection
const choice = await api.prompt({
  type: 'select',
  message: 'Select template type:',
  choices: [
    { name: 'Bug Fix', value: 'bug-fix' },
    { name: 'Feature', value: 'feature' },
    { name: 'Refactor', value: 'refactor' }
  ]
});
```

## Template API

### Template Generation

```typescript
interface GenerationOptions {
  variables: Record<string, any>;
  outputPath?: string;
  dryRun?: boolean;
  format?: 'text' | 'json';
}

interface GenerationResult {
  content: string;
  files: string[];
  duration: number;
  metadata: any;
}

// Generate template with variables
const result = await api.template.generate('feature', {
  name: 'user-authentication',
  framework: 'react',
  testing: true
});

console.log(`Generated files: ${result.files.join(', ')}`);
```

### Template Rendering

```typescript
// Render template content directly
const content = `
# {{title}}

Author: {{author}}
Date: {{date}}

{{#each features}}
- {{this}}
{{/each}}
`;

const rendered = await api.template.render(content, {
  title: 'My Project',
  author: 'John Doe',
  date: new Date().toISOString().split('T')[0],
  features: ['Authentication', 'Dashboard', 'Settings']
});

console.log(rendered);
// Output:
// # My Project
// 
// Author: John Doe
// Date: 2024-12-01
// 
// - Authentication
// - Dashboard  
// - Settings
```

### Template Validation

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  message: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning';
}

const validation = api.template.validate(`
name: invalid-template
variables:
  - name: required-field
    required: true

{{#each items}}
{{name}} - {{invalidHelper}}
{{/each}}
`);

if (!validation.valid) {
  console.log('Validation errors:');
  validation.errors.forEach(error => {
    console.log(`  ${error.severity}: ${error.message}`);
  });
}
```

## Utility APIs

### Cache API

```typescript
interface Cache {
  get<T>(key: string, fallback?: () => Promise<T>): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

// Cache expensive operations
const gitStatus = await api.cache.get('git-status', async () => {
  const result = await api.execute('git', ['status', '--porcelain']);
  return parseGitStatus(result.stdout);
});

// Cache with TTL (30 seconds)
await api.cache.set('user-preferences', preferences, 30000);
```

### Logger API

```typescript
interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  
  child(namespace: string): Logger;
}

// Structured logging
api.logger.info('Processing template', {
  template: 'feature',
  variables: { name: 'user-auth' },
  timestamp: Date.now()
});

// Create child logger for specific component
const gitLogger = api.logger.child('git-integration');
gitLogger.debug('Checking repository status');
```

### Configuration API

```typescript
interface Config {
  get<T>(key: string): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  
  getAll(): Promise<Record<string, any>>;
  merge(config: Record<string, any>): Promise<void>;
}

// Read configuration values
const enableOptimization = await api.config.get('optimization.enabled');
const maxIterations = await api.config.get('optimization.maxIterations');

// Plugin-specific configuration
const pluginConfig = await api.config.get(`plugins.${this.name}`);
```

## Security & Permissions

### Permission System

```typescript
interface PermissionRequest {
  fileSystem?: {
    read?: string[];
    write?: string[];
  };
  network?: {
    outbound?: string[];
  };
  commands?: {
    allowed?: string[];
  };
  env?: {
    read?: string[];
    write?: string[];
  };
}

// Plugin manifest permissions
{
  "permissions": {
    "fileSystem": {
      "read": [".", ".git/*"],
      "write": ["temp/*", "output/*"]
    },
    "network": {
      "outbound": ["api.github.com", "registry.npmjs.org"]
    },
    "commands": {
      "allowed": ["git", "npm", "node"]
    }
  }
}
```

### Sandbox Restrictions

```typescript
// Plugins run in secure sandbox with:
const sandbox = {
  // Limited globals
  console: sandboxedConsole,
  require: createSecureRequire(allowedModules),
  
  // No access to:
  process: undefined,
  global: undefined,
  Buffer: undefined,
  
  // Resource limits
  timeout: 5000, // 5 second max execution
  memory: 100 * 1024 * 1024, // 100MB memory limit
};
```

## Error Handling

### Plugin Error Types

```typescript
class PluginError extends Error {
  constructor(
    message: string,
    public code: string,
    public plugin: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'PluginError';
  }
}

// Common error codes
const ErrorCodes = {
  PERMISSION_DENIED: 'E_PERMISSION_DENIED',
  EXECUTION_FAILED: 'E_EXECUTION_FAILED',
  VALIDATION_ERROR: 'E_VALIDATION_ERROR',
  TIMEOUT: 'E_TIMEOUT',
  RESOURCE_LIMIT: 'E_RESOURCE_LIMIT',
  DEPENDENCY_MISSING: 'E_DEPENDENCY_MISSING'
};

// Error handling in plugins
try {
  await api.execute('git', ['status']);
} catch (error) {
  if (error.code === 'ENOENT') {
    throw new PluginError(
      'Git is not installed or not in PATH',
      ErrorCodes.DEPENDENCY_MISSING,
      this.name,
      false
    );
  }
  throw error;
}
```

## Plugin Lifecycle

### Lifecycle Methods

```typescript
class MyPlugin {
  async initialize(api: PluginAPI) {
    // Plugin initialization
    this.api = api;
    
    // Register capabilities
    this.registerCommands();
    this.registerProcessors();
    this.registerHooks();
    
    // Setup resources
    await this.setupResources();
    
    api.logger.info(`Plugin ${this.name} initialized`);
  }
  
  async cleanup() {
    // Cleanup resources
    await this.cleanupResources();
    
    // Unregister event listeners
    this.api.events.removeAllListeners(this.name);
    
    this.api.logger.info(`Plugin ${this.name} cleaned up`);
  }
  
  async healthCheck(): Promise<boolean> {
    // Optional: health check implementation
    try {
      await this.api.execute('git', ['--version']);
      return true;
    } catch {
      return false;
    }
  }
}
```

### Plugin States

```typescript
enum PluginState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  ERROR = 'error',
  UNLOADING = 'unloading'
}

// Plugin state transitions
api.events.on('plugin:state-changed', (plugin, oldState, newState) => {
  console.log(`Plugin ${plugin.name}: ${oldState} → ${newState}`);
});
```

## Testing Plugin Development

### Plugin Testing Framework

```typescript
import { createTestPluginAPI } from '@cursor-prompt/test-utils';

describe('MyPlugin', () => {
  let plugin: MyPlugin;
  let mockAPI: PluginAPI;
  
  beforeEach(async () => {
    mockAPI = createTestPluginAPI({
      // Mock configurations
      execute: jest.fn(),
      cache: createMockCache(),
      logger: createMockLogger()
    });
    
    plugin = new MyPlugin();
    await plugin.initialize(mockAPI);
  });
  
  afterEach(async () => {
    await plugin.cleanup();
  });
  
  test('should register git:status command', () => {
    expect(mockAPI.command).toHaveBeenCalledWith('git:status', {
      description: expect.any(String),
      handler: expect.any(Function)
    });
  });
  
  test('should execute git status command', async () => {
    const mockResult = { stdout: 'clean', stderr: '', exitCode: 0 };
    mockAPI.execute.mockResolvedValue(mockResult);
    
    const handler = mockAPI.command.mock.calls[0][1].handler;
    const result = await handler({}, {});
    
    expect(result).toContain('Repository is clean');
  });
});
```

## Plugin Distribution

### Plugin Manifest

```json
{
  "name": "git-workflow-plugin",
  "version": "1.0.0",
  "description": "Git workflow automation for template generation",
  "main": "index.js",
  "author": "John Doe <john@example.com>",
  "license": "MIT",
  
  "engines": {
    "cursor-prompt": ">=0.1.0",
    "node": ">=18.0.0"
  },
  
  "keywords": ["git", "workflow", "automation"],
  
  "permissions": {
    "fileSystem": {
      "read": [".", ".git/*"],
      "write": [".git/*"]
    },
    "commands": {
      "allowed": ["git"]
    }
  },
  
  "configuration": {
    "autoCommit": {
      "type": "boolean",
      "default": false,
      "description": "Automatically commit generated templates"
    }
  }
}
```

### Publishing to Marketplace

```bash
# Package plugin
cursor-prompt plugin:package

# Validate plugin
cursor-prompt plugin:validate git-workflow-plugin.tar.gz

# Publish to marketplace
cursor-prompt marketplace:publish git-workflow-plugin.tar.gz
```

This completes the comprehensive Plugin API reference. All interfaces, methods, and examples are documented for plugin developers to create robust extensions for the Cursor Prompt Template Engine.
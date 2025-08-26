# Context Aggregator Module

## Purpose
The Context Aggregator module collects, combines, and formats context information from multiple sources including git repositories, file systems, terminal output, and environment variables. It provides a unified interface for gathering all relevant context needed for template rendering.

## Dependencies
- Internal: GitService, FileContextService, TerminalCapture, ConfigService
- External: simple-git, glob, dotenv

## Key Components

### ContextAggregator
Main class that orchestrates context collection from all sources.

#### Public API
- `gatherContext(options?: ContextOptions): Promise<AggregatedContext>` - Gathers context from all sources
- `formatContext(context: AggregatedContext, format?: string): string` - Formats context for output
- `getContextSummary(context: AggregatedContext): ContextSummary` - Gets context statistics
- `mergeContexts(...contexts: Partial<AggregatedContext>[]): AggregatedContext` - Merges multiple contexts
- `filterContext(context: AggregatedContext, filter: ContextFilter): AggregatedContext` - Filters context

### Context Sources

#### GitService
Provides git repository information:
- Current branch and status
- Staged and unstaged changes
- Recent commit history
- Git diff output
- Remote repository information

#### FileContextService
Handles file system context:
- File contents based on patterns
- Project structure tree
- File metadata (size, modified date)
- Open files in editor
- Recent file modifications

#### TerminalCapture
Captures terminal/console output:
- Recent command history
- Command output
- Error messages
- Environment state

## Usage Examples

### Basic Context Gathering
```typescript
import { ContextAggregator } from './services/context-aggregator';

const aggregator = new ContextAggregator();
const context = await aggregator.gatherContext();

console.log('Git branch:', context.git?.branch);
console.log('Files included:', context.files?.size);
console.log('Terminal lines:', context.terminal?.lines.length);
```

### Custom Context Options
```typescript
const aggregator = new ContextAggregator();

const context = await aggregator.gatherContext({
  includeGit: true,
  includeFiles: true,
  includeTerminal: true,
  filePatterns: ['src/**/*.ts', 'tests/**/*.test.ts'],
  terminalLines: 100,
  gitOptions: {
    includeDiff: true,
    includeStatus: true,
    commitLimit: 10
  }
});
```

### Filtering Context
```typescript
const aggregator = new ContextAggregator();
const fullContext = await aggregator.gatherContext();

// Filter to only specific files
const filtered = aggregator.filterContext(fullContext, {
  files: {
    patterns: ['*.ts', '!*.test.ts'],
    maxSize: 50000
  },
  git: {
    excludeUntracked: true
  }
});
```

### Formatting Context
```typescript
const aggregator = new ContextAggregator();
const context = await aggregator.gatherContext();

// Format as markdown
const markdown = aggregator.formatContext(context, 'markdown');

// Format as JSON
const json = aggregator.formatContext(context, 'json');

// Custom format
const custom = aggregator.formatContext(context, 'custom-template');
```

### Context Summary
```typescript
const aggregator = new ContextAggregator();
const context = await aggregator.gatherContext();
const summary = aggregator.getContextSummary(context);

console.log('Total size:', summary.totalSize);
console.log('File count:', summary.fileCount);
console.log('Git changes:', summary.gitChanges);
console.log('Context sources:', summary.sources);
```

## Configuration
Context aggregator configuration in `.cursorprompt.json`:

```json
{
  "autoContext": {
    "includeGit": true,
    "includeFiles": true,
    "includeTerminal": true,
    "includeEnvironment": true,
    "filePatterns": ["src/**/*", "!**/*.test.*"],
    "terminalLines": 50,
    "maxFileSize": 100000,
    "maxTotalSize": 1000000,
    "excludePatterns": [
      "node_modules/**",
      "dist/**",
      ".git/**"
    ]
  },
  "gitContext": {
    "includeStatus": true,
    "includeDiff": true,
    "includeCommits": true,
    "commitLimit": 10,
    "diffOptions": {
      "unified": 3,
      "ignoreWhitespace": false
    }
  }
}
```

## Context Structure

### AggregatedContext Interface
```typescript
interface AggregatedContext {
  system: {
    timestamp: string;
    platform: string;
    nodeVersion: string;
    cwd: string;
  };
  
  git?: {
    branch: string;
    status: GitStatus;
    diff?: string;
    commits?: GitCommit[];
    remote?: string;
    isClean: boolean;
  };
  
  project?: {
    structure: ProjectStructure;
    rootPath: string;
    packageInfo?: PackageInfo;
    dependencies?: string[];
  };
  
  files?: Map<string, FileContent>;
  
  terminal?: {
    lines: string[];
    lastCommand?: string;
    exitCode?: number;
  };
  
  environment?: {
    variables: Record<string, string>;
    path: string[];
  };
  
  custom?: Record<string, unknown>;
}
```

## Error Handling
Context gathering is resilient to failures:

```typescript
const aggregator = new ContextAggregator();

try {
  const context = await aggregator.gatherContext();
} catch (error) {
  // Individual source failures don't fail entire operation
  console.warn('Some context sources failed:', error.partialContext);
  
  // Use partial context
  const partial = error.partialContext;
  if (partial.git) {
    console.log('Git context available');
  }
}
```

## Performance Optimization

### Caching
- Git status and diff cached for 5 seconds
- File contents cached during session
- Project structure cached until file changes

### Parallel Collection
```typescript
// Sources are gathered in parallel by default
const context = await aggregator.gatherContext({
  parallel: true, // default
  timeout: 5000  // 5 second timeout per source
});
```

### Size Limits
```typescript
const context = await aggregator.gatherContext({
  maxFileSize: 100 * 1024,      // 100KB per file
  maxTotalSize: 1024 * 1024,    // 1MB total
  truncateLargeFiles: true      // Truncate instead of skip
});
```

## Security Considerations
- Environment variable filtering (removes secrets)
- Path sanitization for file access
- Git credentials never included
- Terminal output sanitization
- Configurable sensitive data patterns

## Advanced Features

### Custom Context Sources
```typescript
aggregator.registerSource('custom', {
  name: 'custom-source',
  gather: async (options) => {
    // Custom gathering logic
    return {
      data: 'custom data'
    };
  }
});
```

### Context Transformation
```typescript
aggregator.addTransform('files', (files) => {
  // Transform file contents
  return Array.from(files.entries()).map(([path, content]) => ({
    path,
    preview: content.content.substring(0, 100)
  }));
});
```

### Event Hooks
```typescript
aggregator.on('source:start', (source) => {
  console.log(`Gathering from ${source}...`);
});

aggregator.on('source:complete', (source, data) => {
  console.log(`${source} complete:`, data);
});

aggregator.on('source:error', (source, error) => {
  console.error(`${source} failed:`, error);
});
```

## Related Documentation
- [Git Service](./git-service.md) - Git context operations
- [File Context Service](./file-context-service.md) - File system operations
- [Terminal Capture](./terminal-capture.md) - Terminal output capture
- [Configuration](../CONFIGURATION.md) - Configuration options
# PromptWizard Plugin API Reference

Complete API documentation for the PromptWizard Plugin.

## Table of Contents
- [Plugin Class](#plugin-class)
- [Quality Validator](#quality-validator)
- [Performance Tracker](#performance-tracker)
- [Marketplace Enhancer](#marketplace-enhancer)
- [UI Components](#ui-components)
- [Hook System](#hook-system)
- [Configuration API](#configuration-api)
- [CLI Commands](#cli-commands)

## Plugin Class

### PromptWizardPlugin

Main plugin class that orchestrates all optimization functionality.

#### Constructor

```javascript
constructor()
```

Creates a new PromptWizard plugin instance with default configuration.

#### Methods

##### init(api, config)

Initialize the plugin with API access and configuration.

**Parameters:**
- `api` (PluginAPI): Plugin API interface
- `config` (Object): Plugin configuration object

**Returns:** Promise&lt;boolean&gt; - Success status

**Example:**
```javascript
const plugin = new PromptWizardPlugin();
const success = await plugin.init(pluginAPI, {
  optimizationLevel: 'advanced',
  qualityThreshold: 80
});
```

##### activate()

Activate the plugin and start monitoring services.

**Returns:** Promise&lt;boolean&gt; - Activation success

##### deactivate()

Deactivate the plugin and stop monitoring services.

**Returns:** Promise&lt;boolean&gt; - Deactivation success

##### dispose()

Clean up plugin resources and dispose of services.

**Returns:** Promise&lt;void&gt;

#### Hook Handlers

##### handleTemplatePreprocess(context, options)

Process template before optimization.

**Parameters:**
- `context` (Object): Template context with metadata
- `options` (Object): Processing options

**Returns:** Promise&lt;Object&gt; - Enhanced context with analysis data

##### handleTemplateOptimize(context, options)

Apply optimization transformations to template.

**Parameters:**
- `context` (Object): Template context
- `options` (Object): Optimization options
  - `level` (string): Optimization level
  - `preserveStructure` (boolean): Preserve original structure
  - `maxTokenReduction` (number): Maximum token reduction ratio

**Returns:** Promise&lt;Object&gt; - Optimized template context

##### handleTemplatePostprocess(context, options)

Post-process template with final quality metrics.

**Parameters:**
- `context` (Object): Optimized template context
- `options` (Object): Post-processing options

**Returns:** Promise&lt;Object&gt; - Context with final metrics

## Quality Validator

### QualityValidator

Analyzes templates and calculates quality scores.

#### Constructor

```javascript
constructor(config = {})
```

**Parameters:**
- `config` (Object): Validator configuration
  - `qualityThreshold` (number): Minimum quality threshold

#### Methods

##### analyzeTemplate(template)

Perform comprehensive quality analysis on template.

**Parameters:**
- `template` (string): Template content to analyze

**Returns:** Promise&lt;Object&gt; - Analysis results

```javascript
{
  qualityScore: 85.5,
  metrics: {
    clarity: { ... },
    structure: { ... },
    completeness: { ... },
    efficiency: { ... }
  },
  issues: ["Missing examples", "Ambiguous language"],
  suggestions: ["Add concrete examples", "Use specific terms"],
  analysis: {
    strengths: ["Clear structure", "Good formatting"],
    weaknesses: ["Lacks examples"],
    recommendations: ["Add validation criteria"]
  }
}
```

#### Quality Metrics

##### Clarity Metrics
- `averageSentenceLength`: Average words per sentence
- `readabilityScore`: Flesch-Kincaid readability score (0-100)
- `complexityScore`: Sentence complexity score (0-100)
- `ambiguityScore`: Ambiguous language detection (0-100)

##### Structure Metrics
- `hasIntroduction`: Template has clear introduction
- `hasConclusion`: Template has conclusion/output format
- `usesFormatting`: Uses markdown formatting
- `hasHeaders`: Contains section headers
- `hasLists`: Contains lists or bullet points
- `hasVariables`: Uses template variables

##### Completeness Metrics
- `hasContext`: Provides sufficient context
- `hasInstructions`: Contains clear instructions
- `hasConstraints`: Specifies constraints or limitations
- `hasExamples`: Includes examples
- `specificityScore`: Concrete vs. abstract language (0-100)

##### Efficiency Metrics
- `tokenEstimate`: Estimated token count
- `redundancyScore`: Content redundancy analysis (0-100)
- `concisenesScore`: Conciseness measurement (0-100)
- `densityScore`: Information density (0-100)

## Performance Tracker

### PerformanceTracker

Tracks and analyzes optimization performance metrics.

#### Constructor

```javascript
constructor(config = {})
```

**Parameters:**
- `config` (Object): Tracker configuration
  - `trackTokenUsage` (boolean): Enable token tracking
  - `trackResponseTime` (boolean): Enable response time tracking
  - `trackCostEstimation` (boolean): Enable cost tracking

#### Methods

##### startTracking(templateId, options)

Begin performance tracking for an optimization session.

**Parameters:**
- `templateId` (string): Template identifier
- `options` (Object): Tracking options

**Returns:** Promise&lt;string&gt; - Tracking session ID

##### addCheckpoint(sessionId, checkpoint, data)

Add a performance checkpoint during optimization.

**Parameters:**
- `sessionId` (string): Tracking session ID
- `checkpoint` (string): Checkpoint name
- `data` (Object): Additional checkpoint data

**Returns:** Promise&lt;void&gt;

##### updateTokenUsage(sessionId, tokenUsage)

Update token usage metrics for session.

**Parameters:**
- `sessionId` (string): Session ID
- `tokenUsage` (Object): Token usage data
  - `input` (number): Input tokens
  - `output` (number): Output tokens

**Returns:** Promise&lt;void&gt;

##### endTracking(sessionId, results)

End tracking session and calculate final metrics.

**Parameters:**
- `sessionId` (string): Session ID
- `results` (Object): Optimization results

**Returns:** Promise&lt;Object&gt; - Final performance metrics

##### generateReport(options)

Generate comprehensive performance report.

**Parameters:**
- `options` (Object): Report options
  - `timeframe` (string): Time range ('1h', '24h', '7d', '30d')

**Returns:** Promise&lt;Object&gt; - Performance report

## Marketplace Enhancer

### MarketplaceEnhancer

Enhances marketplace listings with optimization data.

#### Constructor

```javascript
constructor(config = {})
```

#### Methods

##### enhanceListing(listing, options)

Enhance marketplace listing with optimization metadata.

**Parameters:**
- `listing` (Object): Original marketplace listing
- `options` (Object): Enhancement options

**Returns:** Promise&lt;Object&gt; - Enhanced listing

##### createFilterOptions()

Generate filter options for marketplace UI.

**Returns:** Object - Available filter configurations

##### enhanceSearchQuery(searchQuery)

Enhance search query with optimization filters.

**Parameters:**
- `searchQuery` (Object): Original search query

**Returns:** Object - Enhanced search query

##### generateOptimizationStatistics(listings)

Calculate optimization statistics for marketplace.

**Parameters:**
- `listings` (Array): Array of marketplace listings

**Returns:** Object - Optimization statistics

## UI Components

### UIComponents

Terminal-based UI components for plugin interaction.

#### Constructor

```javascript
constructor(config = {})
```

#### Methods

##### initialize()

Initialize UI components and terminal capabilities.

**Returns:** Promise&lt;void&gt;

##### renderConfigPanel(currentConfig)

Render interactive configuration panel.

**Parameters:**
- `currentConfig` (Object): Current plugin configuration

**Returns:** string - Rendered configuration panel

##### renderQualityScoreCard(score, analysis)

Render quality score display card.

**Parameters:**
- `score` (number): Quality score (0-100)
- `analysis` (Object): Quality analysis data

**Returns:** string - Rendered quality card

##### renderPerformanceDashboard(performanceData)

Render performance metrics dashboard.

**Parameters:**
- `performanceData` (Object): Performance metrics

**Returns:** string - Rendered dashboard

##### renderOptimizationStatus(status, progress)

Render optimization status indicator.

**Parameters:**
- `status` (string): Current optimization status
- `progress` (Object): Progress information

**Returns:** string - Rendered status

##### renderMetricsComparison(beforeMetrics, afterMetrics)

Render before/after metrics comparison.

**Parameters:**
- `beforeMetrics` (Object): Pre-optimization metrics
- `afterMetrics` (Object): Post-optimization metrics

**Returns:** string - Rendered comparison

## Hook System

### Available Hooks

#### Template Processing
- `template:preprocess` - Pre-optimization analysis
- `template:optimize` - Apply optimizations
- `template:postprocess` - Post-optimization metrics

#### Performance Tracking
- `performance:start` - Begin performance monitoring
- `performance:checkpoint` - Add performance checkpoint
- `performance:end` - End monitoring and collect metrics

#### Marketplace Integration
- `marketplace:enhance` - Enhance marketplace listings
- `marketplace:filter` - Apply optimization filters
- `marketplace:sort` - Sort by optimization metrics

#### CLI Extension
- `cli:extend` - Extend CLI with optimization commands

### Hook Registration

```javascript
// Register a custom hook
pluginManager.registerHook('template:custom-analyze', (template) => {
  // Custom analysis logic
  return customAnalysis;
});

// Execute hook
const result = await pluginManager.executeHook('template:custom-analyze', template);
```

## Configuration API

### Configuration Schema

```javascript
{
  enabled: boolean,                    // Enable/disable plugin
  optimizationLevel: string,           // 'basic'|'standard'|'advanced'|'aggressive'
  realTimeFeedback: boolean,           // Show real-time feedback
  qualityThreshold: number,            // Quality threshold (0-100)
  performanceMetrics: {
    trackTokenUsage: boolean,          // Track token usage
    trackResponseTime: boolean,        // Track response time
    trackCostEstimation: boolean       // Track cost estimation
  },
  marketplaceIntegration: {
    showOptimizedBadge: boolean,       // Show optimization badges
    displayQualityScore: boolean,      // Display quality scores
    enablePerformanceFilters: boolean  // Enable performance filters
  }
}
```

### Configuration Methods

##### getConfigValue(keyPath)

Get configuration value by dot-separated key path.

**Parameters:**
- `keyPath` (string): Configuration key path (e.g., 'performanceMetrics.trackTokenUsage')

**Returns:** * - Configuration value

##### setConfigValue(keyPath, value)

Set configuration value by key path.

**Parameters:**
- `keyPath` (string): Configuration key path
- `value` (*): Value to set

**Returns:** void

## CLI Commands

### optimize

Optimize a template with configurable options.

```bash
cursor-prompt optimize <template-file> [options]
```

**Options:**
- `--level <level>` - Optimization level
- `--preserve` - Preserve original structure
- `--max-reduction <percent>` - Maximum token reduction

### optimize:quality

Analyze template quality and display score.

```bash
cursor-prompt optimize:quality <template-file>
```

### optimize:metrics

View performance metrics for optimizations.

```bash
cursor-prompt optimize:metrics [template-id]
```

### optimize:config

Configure plugin settings.

```bash
cursor-prompt optimize:config [key] [value]
```

## Error Handling

### Error Types

#### PluginError
Base error class for plugin-related errors.

#### QualityAnalysisError
Errors during quality analysis.

#### PerformanceTrackingError
Errors during performance monitoring.

#### ConfigurationError
Configuration validation errors.

### Error Handling Patterns

```javascript
try {
  const result = await plugin.handleTemplateOptimize(context, options);
} catch (error) {
  if (error instanceof QualityAnalysisError) {
    console.error('Quality analysis failed:', error.message);
  } else if (error instanceof PerformanceTrackingError) {
    console.error('Performance tracking failed:', error.message);
  } else {
    console.error('Optimization failed:', error.message);
  }
}
```

## TypeScript Definitions

```typescript
interface PluginAPI {
  getVersion(): string;
  getConfig(key?: string): unknown;
  setConfig(key: string, value: unknown): void;
  registerCommand(name: string, handler: unknown): void;
  getCommand(name: string): unknown;
  on(event: string, callback: (...args: unknown[]) => void): void;
  emit(event: string, data: unknown): void;
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
  };
  fs: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    glob(pattern: string): Promise<string[]>;
  };
  exec(command: string): Promise<never>;
  log(level: string, message: string, ...args: unknown[]): void;
  sendMessage(plugin: string, data: unknown): void;
  onMessage(callback: (message: unknown) => void): void;
  getPlugin(name: string): IPlugin | null;
}

interface QualityAnalysis {
  qualityScore: number;
  metrics: QualityMetrics;
  issues: string[];
  suggestions: string[];
  analysis: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
}

interface PerformanceMetrics {
  sessionId: string;
  templateId: string;
  responseTime: number;
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  costEstimation: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  performanceScore: number;
}
```

## Examples

### Basic Plugin Usage

```javascript
// Initialize plugin
const plugin = new PromptWizardPlugin();
await plugin.init(pluginAPI, config);

// Analyze quality
const analysis = await plugin.qualityValidator.analyzeTemplate(template);
console.log(`Quality Score: ${analysis.qualityScore}`);

// Track performance
const trackingId = await plugin.performanceTracker.startTracking('my-template');
// ... perform optimization ...
const metrics = await plugin.performanceTracker.endTracking(trackingId);
console.log(`Optimization took ${metrics.responseTime}ms`);

// Enhance marketplace listing
const enhanced = await plugin.marketplaceEnhancer.enhanceListing(listing);
console.log(`Quality Tier: ${enhanced.optimizationFeatures.qualityTier}`);
```

### Advanced Configuration

```javascript
const advancedConfig = {
  enabled: true,
  optimizationLevel: 'aggressive',
  realTimeFeedback: true,
  qualityThreshold: 90,
  performanceMetrics: {
    trackTokenUsage: true,
    trackResponseTime: true,
    trackCostEstimation: true,
    trackMemoryUsage: true
  },
  marketplaceIntegration: {
    showOptimizedBadge: true,
    displayQualityScore: true,
    enablePerformanceFilters: true,
    showPerformanceMetrics: true
  }
};

await plugin.init(pluginAPI, advancedConfig);
```

## Best Practices

### Performance
- Enable caching for repeated optimizations
- Use appropriate optimization levels
- Monitor resource usage in production

### Quality Analysis
- Set realistic quality thresholds
- Review suggestions regularly
- Combine with human review for critical templates

### Marketplace Integration
- Keep optimization metadata up to date
- Use performance filters effectively
- Monitor user feedback on optimized templates

### Error Handling
- Always handle plugin initialization errors
- Implement graceful fallbacks for optimization failures
- Log errors for debugging and monitoring
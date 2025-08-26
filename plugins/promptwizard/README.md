# PromptWizard Plugin

Advanced template optimization plugin for Cursor Prompt Template Engine with quality scoring, performance metrics, and marketplace integration.

## Overview

PromptWizard is a comprehensive optimization plugin that enhances your prompt templates through:

- **AI-Powered Analysis**: Intelligent quality scoring and structural analysis
- **Performance Tracking**: Real-time monitoring of optimization metrics
- **Marketplace Integration**: Enhanced template discovery with quality indicators
- **Real-Time Feedback**: Immediate optimization suggestions and improvements

## Features

### 🤖 Template Optimization
- Quality analysis with detailed scoring (0-100)
- Token efficiency optimization
- Cost reduction strategies
- Performance enhancement recommendations

### 📊 Performance Metrics
- Response time tracking
- Token usage monitoring
- Cost estimation and optimization
- Cache hit rate analysis
- Success rate monitoring

### 🏪 Marketplace Enhancement
- Quality score badges and indicators
- Performance-based filtering
- Optimization leaderboards
- Community ratings for optimization quality

### ⚙️ Configuration Management
- Flexible optimization levels (basic, standard, advanced, aggressive)
- Real-time feedback controls
- Quality threshold settings
- Performance metric toggles

## Installation

### Method 1: Plugin Manager (Recommended)
```bash
cursor-prompt plugin install promptwizard
```

### Method 2: Manual Installation
1. Copy the `promptwizard` directory to your plugins folder
2. Enable the plugin in your configuration:
   ```json
   {
     "plugins": {
       "promptwizard": {
         "enabled": true
       }
     }
   }
   ```

## Quick Start

### Basic Usage

1. **Enable the Plugin**:
   ```bash
   cursor-prompt plugin enable promptwizard
   ```

2. **Optimize a Template**:
   ```bash
   cursor-prompt optimize my-template.md
   ```

3. **Check Quality Score**:
   ```bash
   cursor-prompt optimize:quality my-template.md
   ```

### Configuration

Create or update your plugin configuration:

```json
{
  "plugins": {
    "promptwizard": {
      "enabled": true,
      "optimizationLevel": "standard",
      "realTimeFeedback": true,
      "qualityThreshold": 75,
      "performanceMetrics": {
        "trackTokenUsage": true,
        "trackResponseTime": true,
        "trackCostEstimation": true
      },
      "marketplaceIntegration": {
        "showOptimizedBadge": true,
        "displayQualityScore": true,
        "enablePerformanceFilters": true
      }
    }
  }
}
```

## Usage Examples

### 1. Basic Template Optimization

```javascript
// In your template processing pipeline
const optimizedTemplate = await templateEngine.process(template, {
  plugins: ['promptwizard'],
  optimization: {
    level: 'standard',
    preserveStructure: true,
    maxTokenReduction: 0.3
  }
});
```

### 2. Quality Analysis

```javascript
// Get detailed quality analysis
const analysis = await pluginManager.executeHook('template:analyze', template);
console.log(analysis.qualityScore); // 85.5
console.log(analysis.suggestions); // ["Add more specific context", "Use bullet points for clarity"]
```

### 3. Performance Tracking

```javascript
// Start performance tracking
const trackingId = await pluginManager.executeHook('performance:start', templateId);

// ... perform optimization ...

// End tracking and get metrics
const metrics = await pluginManager.executeHook('performance:end', trackingId);
console.log(metrics.responseTime); // 1250ms
console.log(metrics.tokenReduction); // 0.25 (25% reduction)
```

### 4. Marketplace Integration

```javascript
// Search for optimized templates
const optimizedTemplates = await marketplace.getOptimizedTemplates({
  minQualityScore: 80,
  performance: {
    maxResponseTime: 2000,
    minTokenEfficiency: 75
  }
});

// Get quality leaderboard
const topQualityTemplates = await marketplace.getQualityLeaderboard(10);
```

## API Reference

### Plugin Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable the plugin |
| `optimizationLevel` | string | `"standard"` | Optimization intensity: `basic`, `standard`, `advanced`, `aggressive` |
| `realTimeFeedback` | boolean | `true` | Show real-time optimization feedback |
| `qualityThreshold` | number | `75` | Minimum quality score threshold (0-100) |
| `performanceMetrics.trackTokenUsage` | boolean | `true` | Track token usage metrics |
| `performanceMetrics.trackResponseTime` | boolean | `true` | Track response time metrics |
| `performanceMetrics.trackCostEstimation` | boolean | `true` | Track cost estimation |
| `marketplaceIntegration.showOptimizedBadge` | boolean | `true` | Show optimization badges in marketplace |
| `marketplaceIntegration.displayQualityScore` | boolean | `true` | Display quality scores |
| `marketplaceIntegration.enablePerformanceFilters` | boolean | `true` | Enable performance-based filtering |

### Hook API

#### Template Processing Hooks

- **`template:preprocess`**: Analyze template before optimization
- **`template:optimize`**: Apply optimization transformations
- **`template:postprocess`**: Add quality metrics and final analysis

#### Performance Hooks

- **`performance:start`**: Begin performance tracking
- **`performance:checkpoint`**: Add performance checkpoint
- **`performance:end`**: End tracking and calculate metrics

#### Marketplace Hooks

- **`marketplace:enhance`**: Enhance marketplace listings with optimization data
- **`marketplace:filter`**: Apply optimization-based filters
- **`marketplace:sort`**: Sort by optimization metrics

### CLI Commands

#### Core Commands

```bash
# Optimize a template
cursor-prompt optimize <template-file> [options]

# Options:
#   --level <level>     Optimization level (basic|standard|advanced|aggressive)
#   --preserve          Preserve original structure
#   --max-reduction     Maximum token reduction percentage

# Analyze quality
cursor-prompt optimize:quality <template-file>

# View performance metrics
cursor-prompt optimize:metrics [template-id]

# Configure plugin
cursor-prompt optimize:config [key] [value]
```

#### Examples

```bash
# Standard optimization
cursor-prompt optimize my-prompt.md

# Advanced optimization with structure preservation
cursor-prompt optimize my-prompt.md --level advanced --preserve

# Check quality score
cursor-prompt optimize:quality my-prompt.md

# View all metrics
cursor-prompt optimize:metrics

# Update configuration
cursor-prompt optimize:config optimizationLevel advanced
cursor-prompt optimize:config performanceMetrics.trackTokenUsage false
```

## Quality Scoring

PromptWizard uses a comprehensive quality scoring system (0-100) based on:

### Scoring Components

| Component | Weight | Description |
|-----------|--------|-------------|
| **Clarity** | 25% | Readability, complexity, and ambiguity analysis |
| **Structure** | 20% | Formatting, headers, lists, and organization |
| **Completeness** | 20% | Context, instructions, constraints, and examples |
| **Efficiency** | 15% | Token usage, redundancy, and information density |
| **Specificity** | 10% | Concrete language and specific instructions |
| **Examples** | 10% | Presence and quality of examples |

### Quality Tiers

- **🌟 Premium (95-100)**: Exceptional templates with outstanding clarity and structure
- **⭐⭐ Advanced (85-94)**: High-quality templates with excellent optimization
- **⭐ Standard (70-84)**: Good templates with solid optimization
- **📝 Basic (50-69)**: Acceptable templates with room for improvement
- **⚠️ Unoptimized (0-49)**: Templates requiring significant optimization

## Performance Metrics

### Tracked Metrics

- **Response Time**: Template processing and optimization time
- **Token Usage**: Input/output token consumption
- **Cost Estimation**: Approximate cost per optimization
- **Success Rate**: Percentage of successful optimizations
- **Cache Hit Rate**: Efficiency of optimization caching

### Performance Thresholds

| Metric | Excellent | Good | Fair | Poor |
|--------|-----------|------|------|------|
| Response Time | < 1s | < 3s | < 5s | ≥ 5s |
| Token Efficiency | ≥ 90% | ≥ 75% | ≥ 60% | < 60% |
| Cost per Request | < $0.01 | < $0.05 | < $0.10 | ≥ $0.10 |

## Marketplace Integration

### Enhanced Features

- **Quality Badges**: Visual indicators of template quality
- **Performance Filters**: Filter by response time, token efficiency, cost
- **Optimization Categories**: Browse templates by optimization level
- **Leaderboards**: Top-performing templates by quality and performance

### Badge System

- 🤖 **AI Optimized**: Template processed by PromptWizard
- ⚡ **Token Efficient**: Optimized for minimal token usage
- ⭐ **High Quality**: Quality score ≥ 90
- 🚀 **Performance+**: Optimized for fast response times
- 💰 **Cost Effective**: Optimized for cost efficiency

## Advanced Usage

### Custom Optimization Hooks

```javascript
// Register custom optimization hook
pluginManager.registerHook('template:custom-optimize', async (template, options) => {
  // Your custom optimization logic
  const optimized = await customOptimization(template, options);
  return optimized;
});
```

### Performance Monitoring

```javascript
// Set up continuous monitoring
const tracker = new PerformanceTracker(config);
await tracker.start();

// Add custom checkpoints
await tracker.addCheckpoint(sessionId, 'custom_stage', {
  customMetric: value
});

// Generate reports
const report = await tracker.generateReport({
  timeframe: '24h'
});
```

### Quality Validation

```javascript
// Custom quality validation
const validator = new QualityValidator(config);
const analysis = await validator.analyzeTemplate(template);

// Check against custom criteria
const meetsStandards = analysis.qualityScore >= 80 &&
                      analysis.metrics.clarity.readabilityScore > 70 &&
                      analysis.metrics.completeness.hasExamples;
```

## Troubleshooting

### Common Issues

#### Plugin Not Loading
```bash
# Check plugin status
cursor-prompt plugin list

# Reinstall plugin
cursor-prompt plugin uninstall promptwizard
cursor-prompt plugin install promptwizard
```

#### Low Quality Scores
- **Add Context**: Provide more background information
- **Use Examples**: Include specific examples of desired output
- **Improve Structure**: Add headers, bullet points, and clear sections
- **Be Specific**: Replace vague terms with concrete instructions

#### Performance Issues
- **Reduce Template Size**: Break large templates into smaller parts
- **Enable Caching**: Ensure optimization caching is enabled
- **Adjust Level**: Use lower optimization levels for faster processing

### Configuration Validation

```bash
# Validate plugin configuration
cursor-prompt optimize:config --validate

# Reset to defaults
cursor-prompt optimize:config --reset
```

### Debug Mode

```bash
# Enable debug logging
cursor-prompt optimize --debug my-template.md

# View detailed metrics
cursor-prompt optimize:metrics --detailed
```

## Contributing

We welcome contributions to PromptWizard! Areas for improvement:

- **Quality Algorithms**: Enhance scoring mechanisms
- **Performance Optimizations**: Improve processing speed
- **UI Components**: Better visualization and interaction
- **Integration Points**: Additional marketplace features

### Development Setup

```bash
# Clone and setup
git clone https://github.com/cursor-prompt/template-engine
cd template-engine/plugins/promptwizard

# Install dependencies
npm install

# Run tests
npm test

# Build plugin
npm run build
```

## License

MIT License - see [LICENSE](../../LICENSE) file for details.

## Support

- **Documentation**: [Full API Documentation](./docs/)
- **Issues**: [GitHub Issues](https://github.com/cursor-prompt/template-engine/issues)
- **Community**: [Discord](https://discord.gg/cursor-prompt)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and updates.
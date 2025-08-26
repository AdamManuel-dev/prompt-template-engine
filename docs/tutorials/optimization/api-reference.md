# API Reference Documentation

Complete reference for all PromptWizard optimization APIs, CLI commands, and configuration options.

## CLI Commands

### Core Optimization Commands

#### `cprompt optimize`

Optimize a single template using PromptWizard.

```bash
cprompt optimize [template-name] [options]
```

**Arguments:**
- `template-name` (optional) - Template name or path to optimize

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-t, --template <name>` | string | - | Template name or path to optimize |
| `--task <description>` | string | - | Task description for optimization |
| `-m, --model <model>` | string | `gpt-4` | Target model (gpt-4, claude-3-opus, claude-3-sonnet) |
| `-i, --iterations <number>` | number | `3` | Number of refinement iterations |
| `-e, --examples <number>` | number | `5` | Number of few-shot examples to generate |
| `--reasoning` | boolean | `true` | Generate reasoning steps in optimized prompt |
| `--batch` | boolean | `false` | Batch optimize multiple templates |
| `-o, --output <path>` | string | - | Output path for optimized template(s) |
| `--skip-cache` | boolean | `false` | Skip cache and force fresh optimization |
| `--priority <level>` | string | `normal` | Optimization priority (low, normal, high, critical) |
| `--timeout <ms>` | number | `120000` | Request timeout in milliseconds |
| `--debug` | boolean | `false` | Enable debug logging |

**Examples:**

```bash
# Basic optimization
cprompt optimize code-review

# Advanced optimization
cprompt optimize code-review \
  --model claude-3-opus \
  --iterations 5 \
  --examples 10 \
  --task "Review TypeScript code for bugs and improvements" \
  --output optimized-code-review.yaml

# Batch optimization
cprompt optimize --batch ./templates \
  --output ./optimized \
  --parallel 3 \
  --report
```

**Exit Codes:**
- `0` - Success
- `1` - Template not found
- `2` - Optimization failed
- `3` - Service unavailable
- `4` - Invalid configuration

#### `cprompt compare`

Compare two templates and their performance metrics.

```bash
cprompt compare <original> <optimized> [options]
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--metrics` | boolean | `false` | Show detailed metrics comparison |
| `--test-cases <path>` | string | - | Path to test cases JSON file |
| `--samples <number>` | number | `10` | Number of sample runs for comparison |
| `--output <format>` | string | `table` | Output format (table, json, csv) |

**Example:**

```bash
cprompt compare templates/original.yaml templates/optimized.yaml \
  --metrics \
  --test-cases ./test-data/test-cases.json \
  --samples 50
```

#### `cprompt score`

Get quality metrics for a template.

```bash
cprompt score <template-name> [options]
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--suggestions` | boolean | `false` | Include improvement suggestions |
| `--detailed` | boolean | `false` | Show detailed score breakdown |
| `--model <model>` | string | `gpt-4` | Model to use for scoring |

**Example:**

```bash
cprompt score my-template --suggestions --detailed
```

### Management Commands

#### `cprompt list`

List available templates with optional filtering and sorting.

```bash
cprompt list [options]
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--sort-by <field>` | string | `name` | Sort by: name, cost, usage, date |
| `--filter <expression>` | string | - | Filter expression (e.g., usage:>10/week) |
| `--format <format>` | string | `table` | Output format (table, json, yaml) |
| `--export <path>` | string | - | Export results to file |

**Filter Expressions:**
- `usage:>10/week` - Templates used more than 10 times per week
- `cost:>$10/month` - Templates costing more than $10/month  
- `updated:<7d` - Templates not updated in 7 days
- `score:<80` - Templates with quality score below 80

#### `cprompt config`

Manage configuration settings.

```bash
cprompt config <command> [options]
```

**Subcommands:**

- `show` - Display current configuration
- `set <key> <value>` - Set configuration value
- `get <key>` - Get configuration value
- `validate` - Validate configuration
- `reset` - Reset to defaults

**Examples:**

```bash
# Show current config
cprompt config show

# Set configuration value
cprompt config set promptWizard.defaults.targetModel claude-3-opus

# Validate configuration
cprompt config validate
```

### Monitoring Commands

#### `cprompt monitor`

Monitor optimization service and performance.

```bash
cprompt monitor [options]
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--live` | boolean | `false` | Real-time monitoring |
| `--dashboard` | boolean | `false` | Launch web dashboard |
| `--port <port>` | number | `3000` | Dashboard port |
| `--metrics <list>` | string | `all` | Metrics to display |

#### `cprompt logs`

View service logs.

```bash
cprompt logs [options]
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--tail <number>` | number | `50` | Number of recent log entries |
| `--follow` | boolean | `false` | Follow log output |
| `--level <level>` | string | `info` | Log level filter |
| `--since <duration>` | string | - | Show logs since duration (1h, 30m, etc.) |

## REST API Endpoints

### Base URL

```
http://localhost:8000/api/v1
```

### Authentication

Include your API key in the request headers:

```http
Authorization: Bearer YOUR_API_KEY
```

### Core Endpoints

#### POST `/optimize`

Optimize a single prompt.

**Request Body:**

```json
{
  "task": "Review code for bugs and improvements",
  "prompt": "Your original prompt content...",
  "targetModel": "gpt-4",
  "mutateRefineIterations": 3,
  "fewShotCount": 5,
  "generateReasoning": true,
  "customParams": {
    "maxLength": 8000,
    "priority": "quality"
  }
}
```

**Response:**

```json
{
  "requestId": "opt-1638123456-abc123",
  "status": "completed",
  "originalPrompt": "Your original prompt content...",
  "optimizedPrompt": "Optimized prompt content...",
  "metrics": {
    "tokenReduction": 32.5,
    "accuracyImprovement": 15.2,
    "optimizationTime": 45200,
    "apiCallsUsed": 23
  },
  "qualityScore": {
    "overall": 87,
    "breakdown": {
      "clarity": 92,
      "taskAlignment": 85,
      "tokenEfficiency": 84
    },
    "suggestions": [
      "Consider adding specific programming language context",
      "Structure feedback sections for better readability"
    ]
  },
  "comparison": {
    "improvements": {
      "tokenReduction": "Reduced from 287 to 195 tokens",
      "clarityImprovement": "Simplified instructions while maintaining accuracy",
      "structureEnhancement": "Better organized feedback categories"
    }
  },
  "timestamp": "2023-12-01T10:30:45.123Z"
}
```

#### POST `/batch-optimize`

Optimize multiple prompts in batch.

**Request Body:**

```json
{
  "prompts": [
    {
      "id": "template-1",
      "task": "Code review",
      "prompt": "Review this code..."
    },
    {
      "id": "template-2", 
      "task": "Documentation",
      "prompt": "Generate documentation..."
    }
  ],
  "config": {
    "targetModel": "gpt-4",
    "mutateRefineIterations": 3,
    "fewShotCount": 5
  }
}
```

**Response:**

```json
{
  "batchId": "batch-1638123456-def456",
  "status": "completed",
  "total": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "id": "template-1",
      "status": "completed",
      "optimizedPrompt": "Optimized prompt 1...",
      "metrics": { /* metrics object */ }
    },
    {
      "id": "template-2", 
      "status": "completed",
      "optimizedPrompt": "Optimized prompt 2...",
      "metrics": { /* metrics object */ }
    }
  ],
  "errors": [],
  "timestamp": "2023-12-01T10:35:20.456Z"
}
```

#### POST `/score`

Score prompt quality.

**Request Body:**

```json
{
  "prompt": "Your prompt content...",
  "task": "Code review assistance",
  "model": "gpt-4"
}
```

**Response:**

```json
{
  "score": {
    "overall": 87,
    "breakdown": {
      "clarity": 92,
      "specificity": 85,
      "coherence": 89,
      "completeness": 83
    }
  },
  "analysis": {
    "strengths": [
      "Clear instructions",
      "Well-structured format"
    ],
    "weaknesses": [
      "Could be more specific about output format",
      "Missing examples for complex cases"
    ]
  },
  "suggestions": [
    "Add specific examples",
    "Define expected output format",
    "Include error handling guidance"
  ],
  "tokenCount": 245,
  "estimatedCost": 0.0049
}
```

#### GET `/status/{requestId}`

Get optimization job status.

**Response:**

```json
{
  "requestId": "opt-1638123456-abc123",
  "status": "in_progress",
  "progress": 65,
  "currentStep": "Refining prompt iteration 2/3",
  "estimatedCompletion": "2023-12-01T10:32:15.000Z",
  "startTime": "2023-12-01T10:30:45.123Z"
}
```

#### GET `/health`

Service health check.

**Response:**

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "promptwizard": "available",
  "models": {
    "gpt-4": "available",
    "claude-3-opus": "available", 
    "claude-3-sonnet": "available"
  },
  "cache": {
    "status": "healthy",
    "hitRate": 0.73,
    "size": 156
  }
}
```

### Error Responses

All endpoints return structured error responses:

```json
{
  "error": {
    "code": "OPTIMIZATION_FAILED",
    "message": "Optimization failed due to invalid prompt format",
    "details": {
      "line": 15,
      "issue": "Invalid YAML syntax"
    },
    "requestId": "opt-1638123456-abc123",
    "timestamp": "2023-12-01T10:30:45.123Z"
  }
}
```

**Common Error Codes:**

- `TEMPLATE_NOT_FOUND` - Template doesn't exist
- `INVALID_CONFIGURATION` - Configuration validation failed
- `OPTIMIZATION_FAILED` - Optimization process failed
- `RATE_LIMIT_EXCEEDED` - API rate limit exceeded
- `SERVICE_UNAVAILABLE` - PromptWizard service unavailable
- `AUTHENTICATION_FAILED` - Invalid API key
- `TIMEOUT` - Request timeout exceeded

## TypeScript Client API

### Installation

```bash
npm install @cursor-prompt/promptwizard-client
```

### Basic Usage

```typescript
import { PromptWizardClient, createDefaultConfig } from '@cursor-prompt/promptwizard-client';

// Initialize client
const config = createDefaultConfig({
  apiKey: process.env.PROMPTWIZARD_API_KEY,
  baseUrl: 'http://localhost:8000/api/v1'
});

const client = new PromptWizardClient(config);
```

### Client Methods

#### `optimizePrompt(config)`

```typescript
interface OptimizationConfig {
  task: string;
  prompt: string;
  targetModel: 'gpt-4' | 'claude-3-opus' | 'claude-3-sonnet';
  mutateRefineIterations?: number;
  fewShotCount?: number;
  generateReasoning?: boolean;
  customParams?: Record<string, any>;
}

const result = await client.optimizePrompt({
  task: 'Code review assistance',
  prompt: 'Review the following code...',
  targetModel: 'gpt-4',
  mutateRefineIterations: 3,
  fewShotCount: 5
});

console.log(result.optimizedPrompt);
console.log(result.metrics.tokenReduction);
```

#### `batchOptimize(prompts, config)`

```typescript
const results = await client.batchOptimize(
  [
    { id: 'template-1', task: 'Code review', prompt: '...' },
    { id: 'template-2', task: 'Documentation', prompt: '...' }
  ],
  {
    targetModel: 'claude-3-opus',
    mutateRefineIterations: 4
  }
);

results.forEach(result => {
  console.log(`${result.id}: ${result.metrics.tokenReduction}% reduction`);
});
```

#### `scorePrompt(prompt, task?, model?)`

```typescript
const score = await client.scorePrompt(
  'Your prompt content...',
  'Code review task',
  'gpt-4'
);

console.log(`Overall score: ${score.overall}/100`);
console.log('Suggestions:', score.suggestions);
```

#### `getJobStatus(requestId)`

```typescript
const status = await client.getJobStatus('opt-1638123456-abc123');

if (status.status === 'completed') {
  console.log('Optimization completed!');
} else {
  console.log(`Progress: ${status.progress}% - ${status.currentStep}`);
}
```

#### `healthCheck()`

```typescript
const health = await client.healthCheck();

if (health.status === 'healthy') {
  console.log('Service is operational');
} else {
  console.error('Service health issues detected');
}
```

### Advanced Client Configuration

```typescript
const client = new PromptWizardClient({
  apiKey: process.env.PROMPTWIZARD_API_KEY,
  baseUrl: 'http://localhost:8000/api/v1',
  timeout: 120000,
  retries: 3,
  retryDelay: 1000,
  rateLimiting: {
    requestsPerSecond: 5,
    burstLimit: 10
  },
  cache: {
    enabled: true,
    ttl: 3600000 // 1 hour
  }
});
```

## Configuration Schema

### Main Configuration File (`.cursor-prompt.yaml`)

```yaml
# PromptWizard Service Configuration
promptWizard:
  # Service connection settings
  serviceUrl: string                    # Default: "http://localhost:8000"
  timeout: number                       # Default: 120000 (2 minutes)
  retries: number                       # Default: 3
  
  # Default optimization settings
  defaults:
    targetModel: string                 # Default: "gpt-4"
    mutateRefineIterations: number      # Default: 3
    fewShotCount: number               # Default: 5
    generateReasoning: boolean         # Default: true
    
  # Caching configuration
  cache:
    enabled: boolean                   # Default: true
    ttl: number                       # Default: 86400 (24 hours)
    maxSize: number                   # Default: 1000
    
    # Optional Redis configuration
    redis:
      enabled: boolean                 # Default: false
      url: string                     # Redis connection URL
      password: string                # Redis password
      db: number                      # Default: 0
      
  # Analytics and monitoring
  analytics:
    enabled: boolean                   # Default: true
    trackUsage: boolean               # Default: true
    reportInterval: number            # Default: 3600 (1 hour)

# Template-specific settings
templates:
  - name: string
    versions:
      original: string                 # Path to original template
      optimized: string               # Path to optimized template
    abTest:
      enabled: boolean
      split: number                   # Percentage split (0-100)
      duration: number                # Test duration in days
      metrics: string[]               # Metrics to track

# Model-specific configurations
models:
  gpt-4:
    maxTokens: number                 # Default: 8000
    temperature: number               # Default: 0.7
    topP: number                      # Default: 1.0
  claude-3-opus:
    maxTokens: number                 # Default: 200000
    temperature: number               # Default: 0.7
  claude-3-sonnet:
    maxTokens: number                 # Default: 200000
    temperature: number               # Default: 0.7

# Monitoring and alerting
monitoring:
  enabled: boolean                    # Default: true
  healthChecks:
    interval: number                  # Default: 30 seconds
    timeout: number                   # Default: 10 seconds
    retries: number                   # Default: 3
  alerts:
    - type: string                    # email, slack, webhook
      trigger: string                 # service_down, optimization_failure
      configuration: object           # Alert-specific config
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PROMPTWIZARD_SERVICE_URL` | PromptWizard service URL | `http://localhost:8000` |
| `PROMPTWIZARD_API_KEY` | API key for authentication | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `REDIS_URL` | Redis connection URL | - |
| `CURSOR_PROMPT_DEBUG` | Enable debug logging | `false` |
| `CURSOR_PROMPT_CONFIG` | Path to config file | `.cursor-prompt.yaml` |

## Response Formats

### Optimization Result

```typescript
interface OptimizationResult {
  requestId: string;
  templateId: string;
  originalTemplate: Template;
  optimizedTemplate: Template;
  metrics: {
    tokenReduction: number;        // Percentage
    accuracyImprovement: number;   // Percentage  
    optimizationTime: number;      // Milliseconds
    apiCalls: number;              // Count
  };
  qualityScore: QualityScore;
  comparison: PromptComparison;
  timestamp: Date;
}
```

### Quality Score

```typescript
interface QualityScore {
  overall: number;                    // 0-100
  breakdown: {
    clarity: number;                  // 0-100
    specificity: number;              // 0-100
    coherence: number;                // 0-100
    completeness: number;             // 0-100
  };
  suggestions: string[];
}
```

### Batch Result

```typescript
interface BatchOptimizationResult {
  batchId: string;
  total: number;
  successful: number;
  failed: number;
  results: OptimizationResult[];
  errors: Array<{
    templateId: string;
    error: string;
  }>;
  timestamp: Date;
}
```

This comprehensive API reference covers all available commands, endpoints, and configuration options for the PromptWizard optimization system. Use this as your complete guide for integration and usage.
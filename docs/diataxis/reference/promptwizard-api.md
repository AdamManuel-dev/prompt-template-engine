---
title: "PromptWizard API Reference"
description: "Complete technical reference for PromptWizard integration APIs, types, and interfaces"
category: "reference"
tags: [api, types, interfaces, reference]
---

# PromptWizard API Reference

Complete technical reference for all PromptWizard integration APIs, TypeScript interfaces, and service endpoints.

## TypeScript API

### Core Classes

#### PromptWizardClient

Main client class for interacting with PromptWizard service.

```typescript
class PromptWizardClient {
  constructor(config: PromptWizardConfig)
  
  // Health and status
  healthCheck(): Promise<boolean>
  getServiceInfo(): Promise<ServiceInfo>
  
  // Optimization operations
  optimizePrompt(request: OptimizationRequest): Promise<OptimizationResult>
  batchOptimize(request: BatchOptimizationRequest): Promise<BatchOptimizationResult>
  
  // Quality assessment
  scorePrompt(prompt: string, context?: string): Promise<QualityScore>
  comparePrompts(original: string, optimized: string): Promise<ComparisonResult>
  
  // Example generation
  generateExamples(task: string, count: number): Promise<Example[]>
  
  // Job management
  getOptimizationStatus(jobId: string): Promise<OptimizationStatus>
  cancelOptimization(jobId: string): Promise<boolean>
  
  // Configuration
  updateConfig(config: Partial<PromptWizardConfig>): void
  getConfig(): PromptWizardConfig
}
```

#### PromptOptimizationService

High-level service for optimization workflows.

```typescript
class PromptOptimizationService extends EventEmitter {
  constructor(
    client: PromptWizardClient,
    templateService: TemplateService,
    cacheService: CacheService
  )
  
  // Single optimization
  optimizeTemplate(request: OptimizationRequest): Promise<OptimizationResult>
  
  // Batch optimization
  batchOptimize(request: BatchOptimizationRequest): Promise<BatchOptimizationResult>
  
  // Quality operations
  scoreTemplate(templateId: string): Promise<QualityScore>
  compareTemplates(originalId: string, optimizedId: string): Promise<ComparisonResult>
  
  // Cache operations
  getCachedResult(key: string): Promise<OptimizationResult | null>
  invalidateCache(pattern: string): Promise<void>
  
  // Event handling
  on(event: OptimizationEvent, listener: (...args: any[]) => void): this
  emit(event: OptimizationEvent, ...args: any[]): boolean
}
```

### Configuration Types

#### PromptWizardConfig

Main configuration interface for PromptWizard integration.

```typescript
interface PromptWizardConfig {
  service: {
    /** Service URL (e.g., http://localhost:8000) */
    url: string
    /** Request timeout in milliseconds */
    timeout: number
    /** Number of retry attempts */
    retries: number
    /** API key for authentication */
    apiKey?: string
    /** Custom headers for requests */
    headers?: Record<string, string>
  }
  
  optimization: {
    /** Default target model for optimization */
    defaultModel: SupportedModel
    /** Default number of refine iterations */
    mutateRefineIterations: number
    /** Default number of few-shot examples */
    fewShotCount: number
    /** Whether to generate reasoning by default */
    generateReasoning: boolean
    /** Enable automatic optimization */
    autoOptimize: boolean
    /** Default optimization profile */
    defaultProfile: OptimizationProfile
  }
  
  cache: {
    /** Enable result caching */
    enabled: boolean
    /** Cache TTL in seconds */
    ttl: number
    /** Maximum cache size (number of entries) */
    maxSize: number
    /** Redis configuration for distributed caching */
    redis?: {
      enabled: boolean
      url: string
      keyPrefix?: string
    }
  }
  
  monitoring: {
    /** Enable monitoring and metrics */
    enabled: boolean
    /** Log level for PromptWizard operations */
    logLevel: 'debug' | 'info' | 'warn' | 'error'
    /** Track usage statistics */
    trackUsage: boolean
    /** Metrics reporting interval in seconds */
    reportInterval: number
  }
  
  batch: {
    /** Concurrent optimization limit */
    concurrency: number
    /** Retry failed optimizations */
    retryFailed: boolean
    /** Timeout for individual operations */
    operationTimeout: number
    /** Default batch priority */
    defaultPriority: Priority
  }
}
```

#### OptimizationRequest

Request configuration for single prompt optimization.

```typescript
interface OptimizationRequest {
  /** Unique identifier for the template */
  templateId: string
  
  /** Template object to optimize */
  template: Template
  
  /** Optimization configuration */
  config: {
    /** Task description for context */
    task: string
    /** Target AI model */
    targetModel: SupportedModel
    /** Number of mutation/refinement iterations */
    mutateRefineIterations: number
    /** Number of few-shot examples to generate */
    fewShotCount: number
    /** Generate step-by-step reasoning */
    generateReasoning: boolean
    /** Optimization profile to use */
    profile?: OptimizationProfile
    /** Custom hyperparameters */
    hyperparameters?: Record<string, any>
  }
  
  /** Request options */
  options?: {
    /** Skip cache and force fresh optimization */
    skipCache?: boolean
    /** Optimization priority */
    priority?: Priority
    /** Maximum optimization time in seconds */
    timeout?: number
    /** Webhook URL for completion notification */
    webhookUrl?: string
    /** Custom metadata */
    metadata?: Record<string, any>
  }
}
```

#### BatchOptimizationRequest

Request configuration for batch optimization.

```typescript
interface BatchOptimizationRequest {
  /** Array of templates to optimize */
  templates: Array<{
    /** Template identifier */
    id: string
    /** Template object */
    template: Template
    /** Template-specific task description (optional) */
    task?: string
  }>
  
  /** Shared optimization configuration */
  config: {
    /** Target AI model */
    targetModel: SupportedModel
    /** Number of mutation/refinement iterations */
    mutateRefineIterations: number
    /** Number of few-shot examples to generate */
    fewShotCount: number
    /** Generate step-by-step reasoning */
    generateReasoning: boolean
    /** Optimization profile to use */
    profile?: OptimizationProfile
  }
  
  /** Batch options */
  options?: {
    /** Skip cache for all templates */
    skipCache?: boolean
    /** Batch priority */
    priority?: Priority
    /** Maximum concurrent optimizations */
    concurrency?: number
    /** Continue on individual failures */
    continueOnError?: boolean
    /** Webhook URL for batch completion */
    webhookUrl?: string
  }
}
```

### Response Types

#### OptimizationResult

Result of a single prompt optimization.

```typescript
interface OptimizationResult {
  /** Original template ID */
  templateId: string
  
  /** Unique request identifier */
  requestId: string
  
  /** Optimization completion timestamp */
  timestamp: string
  
  /** Performance metrics */
  metrics: {
    /** Token count reduction percentage */
    tokenReduction: number
    /** Accuracy improvement percentage */
    accuracyImprovement: number
    /** Total optimization time in milliseconds */
    optimizationTime: number
    /** Number of API calls made */
    apiCalls: number
    /** Cost reduction estimate */
    costReduction: number
    /** Quality score improvement */
    qualityImprovement: number
  }
  
  /** Quality assessment */
  qualityScore: QualityScore
  
  /** Optimized template */
  optimizedTemplate: {
    /** Optimized prompt content */
    content: string
    /** Template metadata */
    metadata: {
      /** Original template name */
      originalName: string
      /** Optimization version */
      version: string
      /** Applied optimization techniques */
      techniques: string[]
      /** Target model used */
      targetModel: SupportedModel
    }
    /** Template variables (preserved from original) */
    variables: Record<string, VariableDefinition>
  }
  
  /** Optimization details */
  optimization: {
    /** Applied techniques */
    techniques: OptimizationTechnique[]
    /** Generated examples */
    examples: Example[]
    /** Reasoning steps (if enabled) */
    reasoning: string[]
    /** Model-specific adaptations */
    modelAdaptations: string[]
  }
}
```

#### BatchOptimizationResult

Result of batch optimization operation.

```typescript
interface BatchOptimizationResult {
  /** Unique batch identifier */
  batchId: string
  
  /** Batch completion timestamp */
  timestamp: string
  
  /** Summary statistics */
  summary: {
    /** Total templates processed */
    total: number
    /** Successfully optimized */
    successful: number
    /** Failed optimizations */
    failed: number
    /** Skipped (cached) results */
    cached: number
    /** Total processing time in milliseconds */
    totalTime: number
  }
  
  /** Successful optimization results */
  results: OptimizationResult[]
  
  /** Failed optimization details */
  errors: Array<{
    /** Template ID that failed */
    templateId: string
    /** Error message */
    error: string
    /** Error code */
    code: string
    /** Failure timestamp */
    timestamp: string
  }>
  
  /** Aggregate metrics */
  aggregateMetrics: {
    /** Average token reduction across successful optimizations */
    avgTokenReduction: number
    /** Average accuracy improvement */
    avgAccuracyImprovement: number
    /** Average quality score improvement */
    avgQualityImprovement: number
    /** Total cost savings estimate */
    totalCostSavings: number
  }
}
```

#### QualityScore

Comprehensive quality assessment of a prompt.

```typescript
interface QualityScore {
  /** Overall quality score (0-100) */
  overall: number
  
  /** Detailed quality metrics */
  metrics: {
    /** Clarity and readability (0-100) */
    clarity: number
    /** Task alignment and relevance (0-100) */
    taskAlignment: number
    /** Token efficiency (0-100) */
    tokenEfficiency: number
    /** Completeness of instructions (0-100) */
    completeness: number
    /** Consistency and coherence (0-100) */
    consistency: number
    /** Robustness to input variations (0-100) */
    robustness: number
  }
  
  /** Actionable improvement suggestions */
  suggestions: string[]
  
  /** Quality assessment details */
  assessment: {
    /** Identified strengths */
    strengths: string[]
    /** Identified weaknesses */
    weaknesses: string[]
    /** Risk factors */
    risks: string[]
    /** Confidence level in assessment (0-100) */
    confidence: number
  }
  
  /** Scoring timestamp */
  timestamp: string
  
  /** Assessment metadata */
  metadata: {
    /** Scoring model used */
    scoringModel: string
    /** Assessment version */
    version: string
    /** Context used for scoring */
    context?: string
  }
}
```

#### ComparisonResult

Detailed comparison between two prompts.

```typescript
interface ComparisonResult {
  /** Comparison identifier */
  comparisonId: string
  
  /** Comparison timestamp */
  timestamp: string
  
  /** Original prompt information */
  original: {
    /** Content hash for identification */
    hash: string
    /** Token count */
    tokenCount: number
    /** Quality score */
    qualityScore: QualityScore
  }
  
  /** Optimized prompt information */
  optimized: {
    /** Content hash for identification */
    hash: string
    /** Token count */
    tokenCount: number
    /** Quality score */
    qualityScore: QualityScore
  }
  
  /** Improvement metrics */
  improvements: {
    /** Token reduction (positive = improvement) */
    tokenReduction: number
    /** Quality score improvement */
    qualityImprovement: number
    /** Estimated cost reduction percentage */
    costReduction: number
    /** Readability improvement */
    readabilityImprovement: number
  }
  
  /** Detailed differences */
  differences: {
    /** Structural changes made */
    structural: string[]
    /** Content modifications */
    content: string[]
    /** Added elements */
    additions: string[]
    /** Removed elements */
    removals: string[]
  }
  
  /** Side-by-side comparison */
  comparison: {
    /** Original content with highlighting */
    originalHighlighted: string
    /** Optimized content with highlighting */
    optimizedHighlighted: string
    /** Diff format representation */
    diffFormat: string
  }
  
  /** Recommendation */
  recommendation: {
    /** Whether to adopt the optimization */
    adopt: boolean
    /** Confidence in recommendation (0-100) */
    confidence: number
    /** Reasoning for recommendation */
    reasoning: string[]
  }
}
```

### Enumeration Types

#### SupportedModel

Supported AI models for optimization.

```typescript
type SupportedModel = 
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  | 'gemini-pro'
  | 'gemini-pro-vision'
  | 'llama-2-70b'
  | 'llama-2-13b'
  | 'mixtral-8x7b'
  | 'custom';
```

#### OptimizationProfile

Predefined optimization profiles.

```typescript
type OptimizationProfile = 
  | 'quick'        // Fast optimization with minimal iterations
  | 'balanced'     // Default optimization profile
  | 'thorough'     // Comprehensive optimization with maximum iterations
  | 'economy'      // Focus on cost reduction
  | 'quality'      // Focus on quality improvement
  | 'reasoning'    // Optimize for chain-of-thought reasoning
  | 'efficiency'   // Optimize for token efficiency
  | 'custom';      // Use custom hyperparameters
```

#### Priority

Optimization priority levels.

```typescript
type Priority = 
  | 'low'
  | 'normal'
  | 'high'
  | 'critical';
```

#### OptimizationTechnique

Optimization techniques that can be applied.

```typescript
type OptimizationTechnique = 
  | 'token_reduction'
  | 'structure_optimization'
  | 'clarity_enhancement'
  | 'example_generation'
  | 'reasoning_chain'
  | 'instruction_refinement'
  | 'context_pruning'
  | 'variable_optimization'
  | 'format_standardization'
  | 'model_specific_adaptation';
```

#### OptimizationEvent

Events emitted by the optimization service.

```typescript
type OptimizationEvent = 
  | 'optimization:started'
  | 'optimization:progress'
  | 'optimization:completed'
  | 'optimization:failed'
  | 'batch:started'
  | 'batch:progress'
  | 'batch:completed'
  | 'batch:failed'
  | 'cache:hit'
  | 'cache:miss';
```

## REST API Endpoints

### Base URL

All API endpoints are relative to the base service URL configured in your PromptWizard service.

Default: `http://localhost:8000/api/v1`

### Authentication

All API requests require authentication via API key in the header:

```http
Authorization: Bearer <your-api-key>
Content-Type: application/json
```

### Health and Status

#### GET /health

Check service health status.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-01-15T10:30:00Z",
  "dependencies": {
    "database": "healthy",
    "redis": "healthy",
    "models": {
      "openai": "healthy",
      "anthropic": "healthy"
    }
  }
}
```

#### GET /info

Get service information and capabilities.

**Response:**
```json
{
  "service": "PromptWizard",
  "version": "1.0.0",
  "capabilities": {
    "models": ["gpt-4", "claude-3-opus", "gemini-pro"],
    "maxConcurrentOptimizations": 10,
    "maxPromptLength": 50000,
    "supportedLanguages": ["en", "es", "fr", "de", "zh"]
  },
  "limits": {
    "requestsPerHour": 1000,
    "tokensPerRequest": 100000,
    "batchSize": 50
  }
}
```

### Optimization Endpoints

#### POST /optimize

Optimize a single prompt.

**Request Body:**
```json
{
  "prompt": "Your prompt content here",
  "task": "Task description",
  "model": "gpt-4",
  "config": {
    "mutateRefineIterations": 3,
    "fewShotCount": 5,
    "generateReasoning": true,
    "profile": "balanced"
  },
  "options": {
    "skipCache": false,
    "priority": "normal",
    "timeout": 120
  }
}
```

**Response:**
```json
{
  "requestId": "req_abc123",
  "status": "completed",
  "result": {
    // OptimizationResult object
  }
}
```

#### POST /batch-optimize

Optimize multiple prompts in batch.

**Request Body:**
```json
{
  "prompts": [
    {
      "id": "prompt1",
      "content": "First prompt content",
      "task": "Task description"
    },
    {
      "id": "prompt2", 
      "content": "Second prompt content",
      "task": "Another task description"
    }
  ],
  "config": {
    "model": "gpt-4",
    "mutateRefineIterations": 3,
    "fewShotCount": 5,
    "generateReasoning": true
  },
  "options": {
    "concurrency": 3,
    "continueOnError": true,
    "priority": "normal"
  }
}
```

#### GET /status/{requestId}

Get optimization status and progress.

**Response:**
```json
{
  "requestId": "req_abc123",
  "status": "in_progress",
  "progress": {
    "currentStep": "refinement",
    "completedSteps": 2,
    "totalSteps": 5,
    "estimatedTimeRemaining": 45
  },
  "startedAt": "2024-01-15T10:30:00Z",
  "estimatedCompletion": "2024-01-15T10:32:00Z"
}
```

### Quality Assessment Endpoints

#### POST /score

Get quality score for a prompt.

**Request Body:**
```json
{
  "prompt": "Prompt content to score",
  "context": "customer-support",
  "criteria": ["clarity", "completeness", "efficiency"]
}
```

**Response:**
```json
{
  // QualityScore object
}
```

#### POST /compare

Compare two prompts.

**Request Body:**
```json
{
  "original": "Original prompt content",
  "optimized": "Optimized prompt content",
  "includeDetails": true
}
```

**Response:**
```json
{
  // ComparisonResult object
}
```

### Utility Endpoints

#### POST /examples

Generate examples for a task.

**Request Body:**
```json
{
  "task": "Generate customer support responses",
  "count": 5,
  "model": "gpt-4",
  "criteria": {
    "diversity": "high",
    "quality": "high",
    "relevance": "high"
  }
}
```

**Response:**
```json
{
  "examples": [
    {
      "input": "Customer complaint about slow service",
      "output": "I apologize for the inconvenience...",
      "context": "Support ticket #12345"
    }
  ]
}
```

#### DELETE /cancel/{requestId}

Cancel an ongoing optimization.

**Response:**
```json
{
  "requestId": "req_abc123",
  "status": "cancelled",
  "cancelledAt": "2024-01-15T10:31:00Z"
}
```

### Cache Management Endpoints

#### DELETE /cache

Clear optimization cache.

**Request Body:**
```json
{
  "pattern": "user_*",
  "olderThan": "2024-01-01T00:00:00Z"
}
```

#### GET /cache/stats

Get cache statistics.

**Response:**
```json
{
  "size": 1500,
  "maxSize": 10000,
  "hitRate": 0.75,
  "totalHits": 3000,
  "totalMisses": 1000,
  "evictions": 50
}
```

## Error Handling

### Error Response Format

All API errors follow this format:

```json
{
  "error": {
    "code": "OPTIMIZATION_FAILED",
    "message": "Optimization failed due to invalid prompt format",
    "details": {
      "field": "prompt",
      "reason": "Prompt exceeds maximum length limit"
    },
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Request format or parameters invalid |
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `OPTIMIZATION_FAILED` | 500 | Optimization process failed |
| `SERVICE_UNAVAILABLE` | 503 | PromptWizard service unavailable |
| `TIMEOUT` | 504 | Request timeout |

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/optimize` | 100 requests | 1 hour |
| `/batch-optimize` | 10 requests | 1 hour |
| `/score` | 200 requests | 1 hour |
| `/compare` | 150 requests | 1 hour |
| All endpoints | 1000 requests | 1 hour |

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1642276800
```

## SDK Usage Examples

### TypeScript SDK

```typescript
import { PromptWizardClient, createDefaultConfig } from '@cursor/promptwizard';

// Initialize client
const config = createDefaultConfig();
config.service.url = 'http://localhost:8000';
config.service.apiKey = 'your-api-key';

const client = new PromptWizardClient(config);

// Optimize a prompt
const result = await client.optimizePrompt({
  templateId: 'my-prompt',
  template: myTemplate,
  config: {
    task: 'Generate customer support responses',
    targetModel: 'gpt-4',
    mutateRefineIterations: 3,
    fewShotCount: 5,
    generateReasoning: true
  }
});

console.log('Token reduction:', result.metrics.tokenReduction + '%');
console.log('Quality score:', result.qualityScore.overall);
```

### Python SDK

```python
from promptwizard_client import PromptWizardClient

# Initialize client
client = PromptWizardClient(
    base_url='http://localhost:8000',
    api_key='your-api-key'
)

# Optimize a prompt
result = client.optimize_prompt(
    prompt="Your prompt content",
    task="Generate customer support responses",
    model="gpt-4",
    config={
        "mutate_refine_iterations": 3,
        "few_shot_count": 5,
        "generate_reasoning": True
    }
)

print(f"Token reduction: {result['metrics']['tokenReduction']}%")
print(f"Quality score: {result['qualityScore']['overall']}")
```

## Webhooks

### Webhook Configuration

Configure webhooks for optimization completion:

```json
{
  "webhookUrl": "https://your-app.com/webhooks/optimization-complete",
  "events": ["optimization:completed", "optimization:failed"],
  "secret": "your-webhook-secret"
}
```

### Webhook Payload

```json
{
  "event": "optimization:completed",
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_abc123",
  "data": {
    // OptimizationResult object
  },
  "signature": "sha256=..."
}
```

This completes the comprehensive API reference for the PromptWizard integration.
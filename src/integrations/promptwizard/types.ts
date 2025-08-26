/**
 * @fileoverview TypeScript interfaces and types for PromptWizard integration
 * @lastmodified 2025-08-26T12:00:00Z
 *
 * Features: Type-safe interfaces for PromptWizard API communication
 * Main APIs: OptimizationConfig, OptimizedResult, PromptWizardService interfaces
 * Constraints: Must align with Microsoft PromptWizard API specification
 * Patterns: Interface segregation, type safety, API contract definitions
 */

export interface OptimizationConfig {
  /** The prompt template to optimize */
  prompt: string;

  /** Task description for the prompt */
  task: string;

  /** Target model for optimization */
  targetModel?:
    | 'gpt-4'
    | 'gpt-3.5-turbo'
    | 'claude-3-opus'
    | 'claude-3-sonnet'
    | 'gemini-pro';

  /** Number of refinement iterations */
  mutateRefineIterations?: number;

  /** Number of few-shot examples to generate */
  fewShotCount?: number;

  /** Whether to generate reasoning steps */
  generateReasoning?: boolean;

  /** Custom optimization parameters */
  customParams?: Record<string, unknown>;

  /** Template metadata */
  metadata?: {
    templateId?: string;
    templateName?: string;
    version?: string;
    author?: string;
  };

  /** Focus areas for optimization */
  focusAreas?: string[];

  /** Improvement targets */
  improvementTargets?: string[];

  /** Constraints for optimization */
  constraints?: {
    maxLength?: number;
    preserveVariables?: boolean;
    maintainStructure?: boolean;
    focusAreas?: string[];
    [key: string]: any;
  };
}

export interface OptimizedResult {
  /** Optimization job ID */
  jobId: string;

  /** Original prompt */
  originalPrompt: string;

  /** Optimized prompt */
  optimizedPrompt: string;

  /** Optimization status */
  status: 'pending' | 'processing' | 'completed' | 'failed';

  /** Performance metrics */
  metrics: {
    /** Accuracy improvement percentage */
    accuracyImprovement: number;

    /** Token count reduction percentage */
    tokenReduction: number;

    /** Cost reduction multiplier */
    costReduction: number;

    /** Processing time in seconds */
    processingTime: number;

    /** API calls used in optimization */
    apiCallsUsed: number;
  };

  /** Generated few-shot examples */
  examples?: Array<{
    input: string;
    output: string;
  }>;

  /** Reasoning chain if generated */
  reasoning?: string[];

  /** The optimized template */
  optimizedTemplate?: string;

  /** Quality score of optimization */
  qualityScore?: number;

  /** Comparison data */
  comparison?: any;

  /** Error information if failed */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };

  /** Timestamps */
  createdAt: Date;
  completedAt?: Date;
}

export interface QualityScore {
  /** Overall quality score (0-100) */
  overall: number;

  /** Individual scoring metrics */
  metrics: {
    /** Clarity and specificity score */
    clarity: number;

    /** Task alignment score */
    taskAlignment: number;

    /** Token efficiency score */
    tokenEfficiency: number;

    /** Example quality score */
    exampleQuality?: number;
  };

  /** Suggestions for improvement */
  suggestions: string[];

  /** Confidence level of scoring */
  confidence: number;
}

export interface PromptComparison {
  /** Comparison ID */
  comparisonId: string;

  /** Original prompt metrics */
  original: {
    prompt: string;
    score: QualityScore;
    estimatedTokens: number;
    estimatedCost: number;
  };

  /** Optimized prompt metrics */
  optimized: {
    prompt: string;
    score: QualityScore;
    estimatedTokens: number;
    estimatedCost: number;
  };

  /** Comparison results */
  improvements?: {
    qualityImprovement: number;
    tokenReduction: number;
    costSavings: number;
  };

  /** Side-by-side analysis */
  analysis: {
    strengthsGained: string[];
    potentialRisks: string[];
    recommendations: string[];
  };
}

export interface Example {
  /** Example ID */
  id: string;

  /** Input text */
  input: string;

  /** Expected output */
  output: string;

  /** Quality rating */
  quality: number;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface OptimizationJob {
  /** Job identifier */
  jobId: string;

  /** Current status */
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

  /** Progress percentage */
  progress: number;

  /** Current step description */
  currentStep: string;

  /** Estimated completion time */
  estimatedCompletion?: Date;

  /** Configuration used */
  config: OptimizationConfig;

  /** Results (if completed) */
  result?: OptimizedResult;

  /** Error information (if failed) */
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

export interface PromptWizardService {
  /**
   * Optimize a prompt using PromptWizard
   */
  optimizePrompt(config: OptimizationConfig): Promise<OptimizedResult>;

  /**
   * Score a prompt for quality
   */
  scorePrompt(prompt: string, task?: string): Promise<QualityScore>;

  /**
   * Compare two prompts
   */
  comparePrompts(
    original: string,
    optimized: string,
    task?: string
  ): Promise<PromptComparison>;

  /**
   * Generate examples for a task
   */
  generateExamples(task: string, count: number): Promise<Example[]>;

  /**
   * Get optimization job status
   */
  getJobStatus(jobId: string): Promise<OptimizationJob>;

  /**
   * Cancel an optimization job
   */
  cancelJob(jobId: string): Promise<boolean>;

  /**
   * Validate service health
   */
  healthCheck(): Promise<boolean>;
}

export interface PromptWizardConfig {
  /** Service endpoint URL */
  serviceUrl: string;

  /** API timeout in milliseconds */
  timeout: number;

  /** Maximum retry attempts */
  retries: number;

  /** Default optimization parameters */
  defaults: {
    targetModel: string;
    mutateRefineIterations: number;
    fewShotCount: number;
    generateReasoning: boolean;
  };

  /** Caching configuration */
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };

  /** Authentication configuration */
  auth?: {
    apiKey?: string;
    tokenUrl?: string;
  };

  /** Rate limiting configuration */
  rateLimiting?: {
    maxRequests: number;
    windowMs: number;
  };
}

export interface ServiceResponse<T> {
  /** Success status */
  success: boolean;

  /** Response data */
  data?: T;

  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };

  /** Response metadata */
  metadata?: {
    requestId: string;
    timestamp: Date;
    processingTime: number;
  };
}

export type OptimizationEvent =
  | { type: 'started'; jobId: string; config: OptimizationConfig }
  | { type: 'progress'; jobId: string; progress: number; step: string }
  | { type: 'completed'; jobId: string; result: OptimizedResult }
  | { type: 'failed'; jobId: string; error: { code: string; message: string } }
  | { type: 'cancelled'; jobId: string };

export interface OptimizationEventHandler {
  (event: OptimizationEvent): void;
}

// Type aliases for compatibility with new integration code
export type OptimizationRequest = OptimizationConfig;
export type OptimizationResult = OptimizedResult;

export interface OptimizationResponse {
  /** Response job ID */
  jobId: string;

  /** Optimization result */
  result?: OptimizationResult;

  /** Response status */
  status: 'success' | 'error' | 'pending';

  /** Error message if failed */
  error?: string;

  /** Confidence score */
  confidence?: number;

  /** Performance metrics */
  metrics?: {
    accuracyImprovement: number;
    tokenReduction: number;
    costReduction: number;
    processingTime: number;
    apiCallsUsed: number;
  };

  /** Original prompt */
  originalPrompt?: string;

  /** Optimized prompt */
  optimizedPrompt?: string;

  /** Response metadata */
  metadata?: {
    processingTime: number;
    requestId: string;
    timestamp: Date;
  };
}

export interface OptimizationMetrics {
  /** Accuracy improvement percentage */
  accuracyImprovement: number;

  /** Token count reduction percentage */
  tokenReduction: number;

  /** Cost reduction multiplier */
  costReduction: number;

  /** Processing time in seconds */
  processingTime: number;

  /** API calls used in optimization */
  apiCallsUsed: number;

  /** Quality score */
  qualityScore?: number;
}

export interface OptimizationContext {
  /** Template ID */
  templateId: string;

  /** Target model for optimization */
  targetModel: string;

  /** Task description */
  task: string;

  /** User preferences */
  preferences?: Record<string, unknown>;

  /** Context metadata */
  metadata?: Record<string, unknown>;
}

export interface PipelineStage {
  /** Stage name */
  name: string;

  /** Stage description */
  description: string;

  /** Stage function */
  execute: (context: OptimizationContext, data: any) => Promise<any>;

  /** Stage dependencies */
  dependencies?: string[];

  /** Stage timeout in ms */
  timeout?: number;
}

export interface PipelineResult {
  /** Pipeline execution success */
  success: boolean;

  /** Pipeline result data */
  data?: OptimizationResult;

  /** Optimization result - alias for backwards compatibility */
  optimizationResult?: OptimizationResult;

  /** Pipeline error */
  error?: {
    stage: string;
    message: string;
    code: string;
  };

  /** Pipeline metrics */
  metrics: {
    totalTime: number;
    stagesCompleted: number;
    stagesFailed: number;
  };

  /** Stage results */
  stageResults: Record<string, any>;
}

// Additional types needed for gRPC client
export interface ScoringRequest {
  prompt: string;
  criteria?: string[];
  model?: string;
}

export interface ScoringResponse {
  overallScore: number;
  componentScores: Record<string, number>;
  suggestions: string[];
  metrics: Record<string, any>;
}

export interface ComparisonRequest {
  originalPrompt: string;
  optimizedPrompt: string;
  criteria?: string[];
}

export interface ComparisonResponse {
  improvementScore: number;
  improvements: string[];
  potentialIssues: string[];
  metrics: Record<string, any>;
}

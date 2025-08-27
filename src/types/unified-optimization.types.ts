/**
 * @fileoverview Unified optimization type definitions
 * @lastmodified 2025-08-27T05:10:00Z
 *
 * Features: Consolidated optimization types, eliminates duplication
 * Main Types: OptimizationResult, OptimizationRequest, OptimizationMetrics, OptimizationStatus
 * Constraints: Single source of truth for all optimization-related types
 * Patterns: Type unification, interface consolidation
 */

/**
 * Status of an optimization operation
 */
export type OptimizationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Optimization metrics and performance data
 */
export interface OptimizationMetrics {
  /** Token count reduction percentage */
  tokenReduction: number;
  /** Estimated cost reduction percentage */
  costReduction: number;
  /** Processing time in milliseconds */
  processingTime: number;
  /** Memory usage in MB */
  memoryUsage?: number;
  /** Model used for optimization */
  modelUsed: string;
  /** Original token count */
  originalTokenCount: number;
  /** Optimized token count */
  optimizedTokenCount: number;
  /** Original character count */
  originalCharCount: number;
  /** Optimized character count */
  optimizedCharCount: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Quality score (0-100) */
  qualityScore: number;
}

/**
 * Unified optimization result - replaces both OptimizationResult and OptimizedResult
 *
 * This is the single, canonical interface for optimization results across the entire system.
 * Previously, we had duplicate interfaces causing confusion and maintenance issues.
 */
export interface OptimizationResult {
  /** Unique job identifier */
  jobId: string;
  /** Current status of the optimization */
  status: OptimizationStatus;
  /** Original prompt text */
  originalPrompt: string;
  /** Optimized prompt text (available when completed) */
  optimizedPrompt?: string;
  /** Quality/confidence score (0-100) */
  qualityScore: number;
  /** Optimization reasoning steps */
  reasoning?: string[];
  /** Performance metrics */
  metrics?: OptimizationMetrics;
  /** Error message if failed */
  error?: string;
  /** Timestamp when optimization was created */
  createdAt: Date;
  /** Timestamp when optimization was completed */
  completedAt?: Date;
  /** Metadata associated with the optimization */
  metadata?: Record<string, unknown>;
}

/**
 * Optimization request configuration
 */
export interface OptimizationRequest {
  /** The prompt text to optimize */
  prompt: string;
  /** Task description for context */
  task: string;
  /** Target model for optimization */
  targetModel:
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
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Priority level (higher = more urgent) */
  priority?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Batch optimization request
 */
export interface BatchOptimizationRequest {
  /** Array of individual optimization requests */
  requests: OptimizationRequest[];
  /** Batch-level configuration */
  batchConfig?: {
    /** Maximum concurrent optimizations */
    maxConcurrent: number;
    /** Stop batch if failure rate exceeds threshold */
    failureThreshold: number;
    /** Overall batch timeout */
    timeoutMs: number;
  };
  /** Batch metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Batch optimization result
 */
export interface BatchOptimizationResult {
  /** Unique batch identifier */
  batchId: string;
  /** Overall batch status */
  status: OptimizationStatus;
  /** Individual optimization results */
  results: OptimizationResult[];
  /** Batch-level metrics */
  batchMetrics: {
    totalRequests: number;
    successCount: number;
    failureCount: number;
    averageProcessingTime: number;
    totalProcessingTime: number;
    averageQualityScore: number;
    overallTokenReduction: number;
  };
  /** Batch creation timestamp */
  createdAt: Date;
  /** Batch completion timestamp */
  completedAt?: Date;
}

/**
 * Optimization history for a specific template
 */
export interface OptimizationHistory {
  /** Template path or identifier */
  templatePath: string;
  /** Array of optimization attempts */
  optimizations: Array<{
    /** Job ID for this optimization */
    jobId: string;
    /** Timestamp of optimization */
    timestamp: Date;
    /** Original prompt */
    originalPrompt: string;
    /** Optimized prompt */
    optimizedPrompt: string;
    /** Quality score achieved */
    qualityScore: number;
    /** Metrics for this optimization */
    metrics?: OptimizationMetrics;
    /** Reasoning steps */
    reasoning?: string[];
  }>;
  /** When history was first created */
  createdAt: Date;
  /** When history was last updated */
  updatedAt: Date;
}

/**
 * Template comparison result
 */
export interface TemplateComparison {
  /** Original template information */
  original: {
    path: string;
    content: string;
    tokenCount: number;
    length: number;
  };
  /** Optimized template information */
  optimized: {
    path: string;
    content: string;
    tokenCount: number;
    length: number;
  };
  /** Comparison metrics */
  metrics: {
    tokenReduction: number;
    lengthReduction: number;
    estimatedCostReduction: number;
  };
  /** When comparison was performed */
  comparedAt: Date;
}

/**
 * Optimization service configuration
 */
export interface OptimizationServiceConfig {
  /** PromptWizard service configuration */
  promptWizard: {
    enabled: boolean;
    serviceUrl: string;
    timeout: number;
    retries: number;
    apiKey?: string;
  };
  /** Caching configuration */
  cache: {
    maxSize: number;
    ttlMs: number;
    useRedis: boolean;
    redisUrl?: string;
  };
  /** Queue configuration */
  queue: {
    maxConcurrent: number;
    retryAttempts: number;
    backoffMs: number;
    maxQueueSize: number;
  };
  /** Default optimization settings */
  defaults: {
    targetModel: string;
    mutateRefineIterations: number;
    fewShotCount: number;
    generateReasoning: boolean;
    timeout: number;
  };
}

/**
 * Optimization event types for event emitters
 */
export interface OptimizationEvents {
  'optimization:started': {
    jobId: string;
    templatePath: string;
    request: OptimizationRequest;
  };
  'optimization:completed': {
    jobId: string;
    templatePath: string;
    result: OptimizationResult;
  };
  'optimization:failed': { jobId: string; templatePath: string; error: Error };
  'optimization:cached': {
    jobId: string;
    templatePath: string;
    result: OptimizationResult;
  };
  'batch:started': { batchId: string; templatePaths: string[] };
  'batch:completed': { batchId: string; results: OptimizationResult[] };
  'batch:progress': { batchId: string; completed: number; total: number };
}

/**
 * Auto-optimization specific types
 */
export interface AutoOptimizationJob {
  id: string;
  templatePath: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: Date;
  completedTime?: Date;
  result?: OptimizationResult;
  error?: string;
  priority: number;
  retryCount: number;
  source: 'file-watcher' | 'manual' | 'batch';
}

/**
 * File change event for auto-optimization
 */
export interface FileChangeEvent {
  filePath: string;
  absolutePath: string;
  eventType: 'add' | 'change' | 'unlink';
  timestamp: Date;
}

/**
 * Notification types for optimization events
 */
export interface OptimizationNotification {
  id: string;
  type: 'started' | 'completed' | 'failed' | 'batch-completed';
  title: string;
  message: string;
  timestamp: Date;
  templatePath?: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Type guards for optimization types
 */
export const OptimizationTypeGuards = {
  /**
   * Type guard to check if result is completed
   */
  isCompletedResult(
    result: OptimizationResult
  ): result is OptimizationResult & {
    status: 'completed';
    optimizedPrompt: string;
    completedAt: Date;
  } {
    return (
      result.status === 'completed' &&
      !!result.optimizedPrompt &&
      !!result.completedAt
    );
  },

  /**
   * Type guard to check if result is failed
   */
  isFailedResult(result: OptimizationResult): result is OptimizationResult & {
    status: 'failed';
    error: string;
  } {
    return result.status === 'failed' && !!result.error;
  },

  /**
   * Type guard to check if metrics are available
   */
  hasMetrics(result: OptimizationResult): result is OptimizationResult & {
    metrics: OptimizationMetrics;
  } {
    return !!result.metrics;
  },
};

/**
 * Utility type for creating partial optimization requests
 */
export type PartialOptimizationRequest = Partial<OptimizationRequest> & {
  prompt: string;
  task: string;
};

/**
 * Utility type for optimization result without internal fields
 */
export type PublicOptimizationResult = Omit<OptimizationResult, 'metadata'> & {
  metadata?: Readonly<Record<string, unknown>>;
};

/**
 * Legacy type aliases for backward compatibility
 * These are deprecated and should be migrated to OptimizationResult
 */

/** @deprecated Use OptimizationResult instead */
export type OptimizedResult = OptimizationResult;

/** @deprecated Use OptimizationRequest instead */
export type OptimizeRequest = OptimizationRequest;

/** @deprecated Use OptimizationMetrics instead */
export type OptimizeMetrics = OptimizationMetrics;

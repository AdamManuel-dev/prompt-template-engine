/**
 * @fileoverview TypeScript interfaces for optimized templates with performance metrics
 * @lastmodified 2025-08-26T16:55:00Z
 *
 * Features: Template optimization metadata, performance metrics, version comparison, A/B testing
 * Main APIs: OptimizedTemplate, OptimizationHistory, TemplateComparison, OptimizationJob
 * Constraints: Compatible with existing Template interface, backward compatibility maintained
 * Patterns: Extension types, metadata enrichment, version tracking, service integration
 */

import { Template } from './index';

export interface OptimizationMetrics {
  /** Overall accuracy improvement score (0-1) */
  accuracyImprovement: number;

  /** Token reduction percentage (0-1) */
  tokenReduction: number;

  /** Cost reduction factor (1x = no change, 2x = half cost, etc.) */
  costReduction: number;

  /** Processing time for optimization in milliseconds */
  processingTime: number;

  /** Number of API calls used during optimization */
  apiCallsUsed: number;

  /** Confidence score for the optimization (0-1) */
  confidence?: number;

  /** Original token count */
  originalTokens?: number;

  /** Optimized token count */
  optimizedTokens?: number;

  /** Complexity reduction score (0-1) */
  complexityReduction?: number;

  /** Quality score improvement (0-1) */
  qualityImprovement?: number;

  /** Readability score improvement (0-1) */
  readabilityImprovement?: number;
}

export interface OptimizationContext {
  /** Template ID being optimized */
  templateId?: string;

  /** Target AI model for optimization */
  targetModel: string;

  /** Task description for the optimization */
  task: string;

  /** Optimization preferences */
  preferences?: {
    maxLength?: number;
    preserveVariables?: boolean;
    maintainStructure?: boolean;
    focusAreas?: string[];
    [key: string]: any;
  };

  /** Optimization constraints and preferences - alias for compatibility */
  constraints?: {
    maxLength?: number;
    preserveVariables?: boolean;
    maintainStructure?: boolean;
    focusAreas?: string[];
    [key: string]: any;
  };

  /** Additional metadata for optimization */
  metadata?: Record<string, any>;
}

export interface OptimizationHistory {
  /** Unique identifier for this optimization run */
  optimizationId: string;

  /** Timestamp when optimization was performed */
  timestamp: Date;

  /** Version number for this optimization */
  version: string;

  /** Optimization context used */
  context: OptimizationContext;

  /** Performance metrics achieved */
  metrics: OptimizationMetrics;

  /** Original template content before optimization */
  originalContent: string;

  /** Optimized template content */
  optimizedContent: string;

  /** User who initiated the optimization */
  optimizedBy?: string;

  /** Optimization method/algorithm used */
  method: string;

  /** Success status of the optimization */
  success: boolean;

  /** Error message if optimization failed */
  error?: string;

  /** Additional notes or comments */
  notes?: string;
}

export interface OptimizedTemplate extends Template {
  /** Flag indicating this is an optimized template */
  isOptimized: true;

  /** Reference to the original template */
  originalTemplateId?: string;

  /** Current optimization metrics */
  optimizationMetrics: OptimizationMetrics;

  /** Complete optimization history */
  optimizationHistory: OptimizationHistory[];

  /** Current optimization context */
  optimizationContext: OptimizationContext;

  /** Optimization level applied */
  optimizationLevel: 'basic' | 'advanced' | 'aggressive';

  /** Current optimization metrics - alias for compatibility */
  currentOptimizationMetrics: OptimizationMetrics;

  /** Auto-optimization settings */
  autoOptimization?: {
    enabled: boolean;
    schedule?: string; // Cron expression for scheduled optimizations
    triggers?: Array<
      'poor_feedback' | 'performance_decline' | 'usage_increase'
    >;
    lastCheck?: Date;
  };

  /** Performance tracking data */
  performance?: {
    usageCount: number;
    averageRating: number;
    lastUsed: Date;
    successRate: number;
    averageResponseTime: number;
  };

  /** A/B testing configuration */
  abTesting?: {
    enabled: boolean;
    variants: Array<{
      name: string;
      content: string;
      weight: number; // 0-1, weights should sum to 1
      metrics: OptimizationMetrics;
    }>;
    testResults?: {
      winner?: string;
      confidence: number;
      sampleSize: number;
    };
  };
}

/** Template comparison result interface */
export interface TemplateComparison {
  /** Original template being compared */
  original: Template;

  /** Optimized template being compared */
  optimized: OptimizedTemplate;

  /** Comparison improvements summary */
  improvements?: {
    tokenReduction: number;
    costSavings: number;
    qualityImprovement: number;
    complexityReduction: number;
  };

  /** Analysis breakdown */
  analysis?: {
    contentChanges: string[];
    structuralChanges: string[];
    variableChanges: string[];
  };

  /** Comparison metrics */
  comparison: {
    /** Overall improvement score (-1 to 1, negative means worse) */
    overallImprovement: number;

    /** Detailed metric comparisons */
    metrics: OptimizationMetrics;

    /** Side-by-side content comparison */
    contentDiff: {
      additions: string[];
      deletions: string[];
      modifications: Array<{
        original: string;
        modified: string;
      }>;
    };

    /** Structural changes */
    structuralChanges: {
      variablesAdded: string[];
      variablesRemoved: string[];
      sectionsReorganized: boolean;
      logicSimplified: boolean;
    };

    /** Quality assessments */
    qualityAssessment: {
      clarity: number; // -1 to 1
      conciseness: number; // -1 to 1
      completeness: number; // -1 to 1
      accuracy: number; // -1 to 1
    };
  };

  /** Recommendation based on comparison */
  recommendation: {
    useOptimized: boolean;
    confidence: number;
    reasons: string[];
    warnings?: string[];
  };
}

export interface OptimizationJob {
  /** Unique job identifier */
  jobId: string;

  /** Template being optimized */
  templateId: string;

  /** Job status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

  /** Progress percentage (0-100) */
  progress: number;

  /** Current processing step */
  currentStep?: string;

  /** Optimization request parameters */
  request: OptimizationContext & {
    mutateRefineIterations?: number;
    fewShotCount?: number;
    generateReasoning?: boolean;
  };

  /** Job priority */
  priority: 'low' | 'normal' | 'high' | 'urgent';

  /** Timestamps */
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  /** Results */
  result?: OptimizedTemplate;
  error?: string;

  /** Job metadata */
  metadata?: Record<string, any>;
}

export interface OptimizationBatch {
  /** Batch identifier */
  batchId: string;

  /** Templates in the batch */
  templateIds: string[];

  /** Batch processing status */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

  /** Individual job statuses */
  jobs: OptimizationJob[];

  /** Batch-level metrics */
  batchMetrics?: {
    totalTemplates: number;
    completedTemplates: number;
    failedTemplates: number;
    averageImprovement: number;
    totalProcessingTime: number;
  };

  /** Batch configuration */
  config: {
    concurrency: number;
    failFast: boolean; // Stop on first failure
    context: OptimizationContext;
  };

  /** Timestamps */
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface OptimizationReport {
  /** Report identifier */
  reportId: string;

  /** Report generation timestamp */
  generatedAt: Date;

  /** Time period covered by the report */
  period: {
    start: Date;
    end: Date;
  };

  /** Templates analyzed */
  templatesAnalyzed: number;

  /** Overall statistics */
  summary: {
    totalOptimizations: number;
    successfulOptimizations: number;
    averageImprovement: number;
    totalCostSavings: number;
    totalTimeSavings: number;
  };

  /** Breakdown by category */
  categoryBreakdown: Record<
    string,
    {
      count: number;
      averageImprovement: number;
      topPerformers: string[];
    }
  >;

  /** Trending data */
  trends: {
    improvementOverTime: Array<{
      date: Date;
      averageImprovement: number;
      count: number;
    }>;

    mostOptimizedCategories: Array<{
      category: string;
      count: number;
      trend: 'up' | 'down' | 'stable';
    }>;
  };

  /** Recommendations */
  recommendations: Array<{
    type: 'optimize_template' | 'review_category' | 'adjust_settings';
    priority: 'low' | 'medium' | 'high';
    description: string;
    templateIds?: string[];
    estimatedImpact: string;
  }>;

  /** Detailed results for top performers and worst performers */
  highlights: {
    topPerformers: Array<{
      templateId: string;
      templateName: string;
      improvement: number;
      metrics: OptimizationMetrics;
    }>;

    underperformers: Array<{
      templateId: string;
      templateName: string;
      issues: string[];
      recommendations: string[];
    }>;
  };
}

export interface OptimizationSettings {
  /** Global optimization preferences */
  global: {
    enabled: boolean;
    defaultModel: string;
    autoOptimizeNewTemplates: boolean;
    optimizationSchedule?: string; // Cron expression
    maxOptimizationAge?: number;
  };

  /** Per-category settings */
  categorySettings: Record<
    string,
    {
      enabled: boolean;
      targetModel: string;
      optimizationLevel: 'conservative' | 'balanced' | 'aggressive';
      specificConstraints?: Record<string, any>;
    }
  >;

  /** Quality thresholds */
  qualityThresholds: {
    minimumImprovement: number; // Don't save if improvement is below this
    maximumDegradation: number; // Rollback if quality drops below this
    confidenceThreshold: number; // Require this confidence level
  };

  /** Feedback integration */
  feedbackSettings: {
    enableFeedbackLoop: boolean;
    reoptimizationThreshold: number; // Rating threshold for re-optimization
    feedbackWeight: number; // How much to weight user feedback vs. metrics
  };

  /** Performance settings */
  performance?: {
    targetTokenReduction: number;
    targetQualityImprovement: number;
  };

  /** Feedback loop settings - alias for compatibility */
  feedback?: {
    enableAutoReoptimization: boolean;
    reoptimizationThreshold: number;
  };

  /** Advanced settings */
  advanced: {
    enableABTesting: boolean;
    maxOptimizationHistory: number;
    enableExperimentalFeatures: boolean;
    customOptimizationRules?: Array<{
      condition: string;
      action: string;
      priority: number;
    }>;
  };
}

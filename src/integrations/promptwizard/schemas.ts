/**
 * @fileoverview Zod schemas for PromptWizard API validation
 * @lastmodified 2025-08-27T02:45:00Z
 *
 * Features: Runtime type validation using Zod schemas for PromptWizard API responses
 * Main APIs: Schema definitions for OptimizedResult, QualityScore, PromptComparison, etc.
 * Constraints: Must match PromptWizard API specification, provides type safety at runtime
 * Patterns: Schema-based validation, type inference, API contract enforcement
 */

import { z } from 'zod';

// Quality Score Schema
export const QualityScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  metrics: z.object({
    clarity: z.number().min(0).max(100),
    taskAlignment: z.number().min(0).max(100),
    tokenEfficiency: z.number().min(0).max(100),
    exampleQuality: z.number().min(0).max(100).optional(),
  }),
  suggestions: z.array(z.string()),
  confidence: z.number().min(0).max(100),
});

// Optimization Metrics Schema
export const OptimizationMetricsSchema = z.object({
  accuracyImprovement: z.number(),
  tokenReduction: z.number(),
  costReduction: z.number(),
  processingTime: z.number().nonnegative(),
  apiCallsUsed: z.number().int().nonnegative(),
});

// Example Schema
export const ExampleSchema = z.object({
  input: z.string(),
  output: z.string(),
});

// Error Schema
export const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

// Optimized Result Schema
export const OptimizedResultSchema = z.object({
  jobId: z.string(),
  originalPrompt: z.string(),
  optimizedPrompt: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  metrics: OptimizationMetricsSchema,
  examples: z.array(ExampleSchema).optional(),
  reasoning: z.array(z.string()).optional(),
  optimizedTemplate: z.string().optional(),
  qualityScore: z.number().min(0).max(100).optional(),
  comparison: z.unknown().optional(), // Replace any with unknown
  error: ErrorSchema.optional(),
  createdAt: z.string().transform(str => new Date(str)), // Transform string to Date
  completedAt: z
    .string()
    .transform(str => new Date(str))
    .optional(),
});

// Optimization Config Schema
export const OptimizationConfigSchema = z.object({
  prompt: z.string().min(1),
  task: z.string().min(1),
  targetModel: z
    .enum([
      'gpt-4',
      'gpt-3.5-turbo',
      'claude-3-opus',
      'claude-3-sonnet',
      'gemini-pro',
    ])
    .optional(),
  mutateRefineIterations: z.number().int().min(1).max(10).optional(),
  fewShotCount: z.number().int().min(0).max(20).optional(),
  generateReasoning: z.boolean().optional(),
  customParams: z.record(z.string(), z.unknown()).optional(),
  metadata: z
    .object({
      templateId: z.string().optional(),
      templateName: z.string().optional(),
      version: z.string().optional(),
      author: z.string().optional(),
    })
    .optional(),
  focusAreas: z.array(z.string()).optional(),
  improvementTargets: z.array(z.string()).optional(),
  constraints: z
    .object({
      maxLength: z.number().int().positive().optional(),
      preserveVariables: z.boolean().optional(),
      maintainStructure: z.boolean().optional(),
      focusAreas: z.array(z.string()).optional(),
    })
    .passthrough()
    .optional(), // Allow additional properties
});

// Prompt Comparison Schema
export const PromptComparisonSchema = z.object({
  comparisonId: z.string(),
  original: z.object({
    prompt: z.string(),
    score: QualityScoreSchema,
    estimatedTokens: z.number().int().nonnegative(),
    estimatedCost: z.number().nonnegative(),
  }),
  optimized: z.object({
    prompt: z.string(),
    score: QualityScoreSchema,
    estimatedTokens: z.number().int().nonnegative(),
    estimatedCost: z.number().nonnegative(),
  }),
  improvements: z
    .object({
      qualityImprovement: z.number(),
      tokenReduction: z.number(),
      costSavings: z.number(),
    })
    .optional(),
  analysis: z.object({
    strengthsGained: z.array(z.string()),
    potentialRisks: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
});

// Optimization Job Schema
export const OptimizationJobSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']),
  progress: z.number().min(0).max(100),
  currentStep: z.string(),
  estimatedCompletion: z
    .string()
    .transform(str => new Date(str))
    .optional(),
  config: OptimizationConfigSchema,
  result: OptimizedResultSchema.optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
});

// Service Response Schema (Generic)
export const ServiceResponseSchema = <T extends z.ZodType>(
  dataSchema: T
): z.ZodObject<{
  success: z.ZodBoolean;
  data: T;
  error: z.ZodOptional<
    z.ZodObject<{
      code: z.ZodString;
      message: z.ZodString;
      details: z.ZodOptional<z.ZodUnknown>;
    }>
  >;
  timestamp: z.ZodString;
}> =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ErrorSchema.optional(),
    metadata: z
      .object({
        requestId: z.string(),
        timestamp: z.string().transform(str => new Date(str)),
        processingTime: z.number().nonnegative(),
      })
      .optional(),
  });

// Optimization Response Schema
export const OptimizationResponseSchema = z.object({
  jobId: z.string(),
  result: OptimizedResultSchema.optional(),
  status: z.enum(['success', 'error', 'pending']),
  error: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
  metrics: OptimizationMetricsSchema.optional(),
  originalPrompt: z.string().optional(),
  optimizedPrompt: z.string().optional(),
  metadata: z
    .object({
      processingTime: z.number().nonnegative(),
      requestId: z.string(),
      timestamp: z.string().transform(str => new Date(str)),
    })
    .optional(),
});

// Scoring Request/Response Schemas for gRPC client
export const ScoringRequestSchema = z.object({
  prompt: z.string().min(1),
  criteria: z.array(z.string()).optional(),
  model: z.string().optional(),
});

export const ScoringResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  componentScores: z.record(z.string(), z.number()),
  suggestions: z.array(z.string()),
  metrics: z.record(z.string(), z.unknown()),
});

// Comparison Request/Response Schemas
export const ComparisonRequestSchema = z.object({
  originalPrompt: z.string().min(1),
  optimizedPrompt: z.string().min(1),
  criteria: z.array(z.string()).optional(),
});

export const ComparisonResponseSchema = z.object({
  improvementScore: z.number(),
  improvements: z.array(z.string()),
  potentialIssues: z.array(z.string()),
  metrics: z.record(z.string(), z.unknown()),
});

// Optimization Event Schema
export const OptimizationEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('started'),
    jobId: z.string(),
    config: OptimizationConfigSchema,
  }),
  z.object({
    type: z.literal('progress'),
    jobId: z.string(),
    progress: z.number().min(0).max(100),
    step: z.string(),
  }),
  z.object({
    type: z.literal('completed'),
    jobId: z.string(),
    result: OptimizedResultSchema,
  }),
  z.object({
    type: z.literal('failed'),
    jobId: z.string(),
    error: z.object({
      code: z.string(),
      message: z.string(),
    }),
  }),
  z.object({
    type: z.literal('cancelled'),
    jobId: z.string(),
  }),
]);

// Type inference helpers
export type QualityScore = z.infer<typeof QualityScoreSchema>;
export type OptimizedResult = z.infer<typeof OptimizedResultSchema>;
export type OptimizationConfig = z.infer<typeof OptimizationConfigSchema>;
export type PromptComparison = z.infer<typeof PromptComparisonSchema>;
export type OptimizationJob = z.infer<typeof OptimizationJobSchema>;
export type OptimizationResponse = z.infer<typeof OptimizationResponseSchema>;
export type ScoringRequest = z.infer<typeof ScoringRequestSchema>;
export type ScoringResponse = z.infer<typeof ScoringResponseSchema>;
export type ComparisonRequest = z.infer<typeof ComparisonRequestSchema>;
export type ComparisonResponse = z.infer<typeof ComparisonResponseSchema>;
export type OptimizationEvent = z.infer<typeof OptimizationEventSchema>;

// Validation helper functions
export const validateQualityScore = (data: unknown): QualityScore =>
  QualityScoreSchema.parse(data);

export const validateOptimizedResult = (data: unknown): OptimizedResult =>
  OptimizedResultSchema.parse(data);

export const validateOptimizationConfig = (data: unknown): OptimizationConfig =>
  OptimizationConfigSchema.parse(data);

export const validatePromptComparison = (data: unknown): PromptComparison =>
  PromptComparisonSchema.parse(data);

export const validateOptimizationJob = (data: unknown): OptimizationJob =>
  OptimizationJobSchema.parse(data);

export const validateOptimizationResponse = (
  data: unknown
): OptimizationResponse => OptimizationResponseSchema.parse(data);

export const validateScoringRequest = (data: unknown): ScoringRequest =>
  ScoringRequestSchema.parse(data);

export const validateScoringResponse = (data: unknown): ScoringResponse =>
  ScoringResponseSchema.parse(data);

export const validateComparisonRequest = (data: unknown): ComparisonRequest =>
  ComparisonRequestSchema.parse(data);

export const validateComparisonResponse = (data: unknown): ComparisonResponse =>
  ComparisonResponseSchema.parse(data);

export const validateOptimizationEvent = (data: unknown): OptimizationEvent =>
  OptimizationEventSchema.parse(data);

// Safe validation functions that return Result<T, Error>
export const safeValidateQualityScore = (
  data: unknown
):
  | { success: true; data: QualityScore }
  | { success: false; error: z.ZodError } => {
  const result = QualityScoreSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
};

export const safeValidateOptimizedResult = (
  data: unknown
):
  | { success: true; data: OptimizedResult }
  | { success: false; error: z.ZodError } => {
  const result = OptimizedResultSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
};

export const safeValidateOptimizationResponse = (
  data: unknown
):
  | { success: true; data: OptimizationResponse }
  | { success: false; error: z.ZodError } => {
  const result = OptimizationResponseSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
};

export const safeValidatePromptComparison = (
  data: unknown
):
  | { success: true; data: PromptComparison }
  | { success: false; error: z.ZodError } => {
  const result = PromptComparisonSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
};

export const safeValidateOptimizationJob = (
  data: unknown
):
  | { success: true; data: OptimizationJob }
  | { success: false; error: z.ZodError } => {
  const result = OptimizationJobSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
};

/**
 * @fileoverview Core module exports for PromptWizard Phase PW-2 integration
 * @lastmodified 2025-08-26T16:00:00Z
 *
 * Features: Centralized exports for optimization pipeline and feedback loop
 * Main APIs: OptimizationPipeline, FeedbackLoop, factory functions
 * Constraints: Ensures proper dependency injection and service initialization
 * Patterns: Factory pattern, dependency injection, service locator
 */

import {
  OptimizationPipeline,
  OptimizationPipelineConfig,
} from './optimization-pipeline';
import { FeedbackLoop, FeedbackLoopConfig } from './feedback-loop';
import { PromptOptimizationService } from '../services/prompt-optimization.service';
import { TemplateService } from '../services/template.service';
import { CacheService } from '../services/cache.service';
import {
  PromptWizardClient,
  createDefaultConfig,
} from '../integrations/promptwizard/client';
import { logger } from '../utils/logger';

export { OptimizationPipeline, FeedbackLoop };
export type { OptimizationPipelineConfig, FeedbackLoopConfig };

/**
 * Factory function to create a complete optimization pipeline
 */
export function createOptimizationPipeline(
  templateService: TemplateService,
  cacheService: CacheService,
  pipelineConfig?: Partial<OptimizationPipelineConfig>
): OptimizationPipeline {
  logger.debug('Creating optimization pipeline with PromptWizard integration');

  // Create PromptWizard client
  const promptWizardClient = new PromptWizardClient(createDefaultConfig());

  // Create optimization service
  const optimizationService = new PromptOptimizationService(
    promptWizardClient,
    templateService,
    cacheService
  );

  // Create and return pipeline
  return new OptimizationPipeline(
    optimizationService,
    templateService,
    cacheService,
    pipelineConfig
  );
}

/**
 * Factory function to create a feedback loop system
 */
export function createFeedbackLoop(
  templateService: TemplateService,
  cacheService: CacheService,
  feedbackConfig?: Partial<FeedbackLoopConfig>
): FeedbackLoop {
  logger.debug('Creating feedback loop system');

  // Create PromptWizard client
  const promptWizardClient = new PromptWizardClient(createDefaultConfig());

  // Create optimization service (available for other systems)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-expect-error - Intentionally unused for now but available for future extension
  const _optimizationService = new PromptOptimizationService(
    promptWizardClient,
    templateService,
    cacheService
  );

  // Create optimization pipeline
  const optimizationPipeline = createOptimizationPipeline(
    templateService,
    cacheService
  );

  // Create and return feedback loop
  return new FeedbackLoop(optimizationPipeline, cacheService, feedbackConfig);
}

/**
 * Complete Phase PW-2 integration system
 */
export interface PW2IntegrationSystem {
  pipeline: OptimizationPipeline;
  feedbackLoop: FeedbackLoop;
  optimizationService: PromptOptimizationService;
}

/**
 * Factory function to create complete Phase PW-2 system
 */
export function createPW2IntegrationSystem(
  templateService: TemplateService,
  cacheService: CacheService,
  config?: {
    pipeline?: Partial<OptimizationPipelineConfig>;
    feedback?: Partial<FeedbackLoopConfig>;
  }
): PW2IntegrationSystem {
  logger.info('Initializing Phase PW-2 Core Integration System');

  const pipeline = createOptimizationPipeline(
    templateService,
    cacheService,
    config?.pipeline
  );

  const feedbackLoop = createFeedbackLoop(
    templateService,
    cacheService,
    config?.feedback
  );

  // Extract the optimization service from the pipeline
  const promptWizardClient = new PromptWizardClient(createDefaultConfig());
  const optimizationService = new PromptOptimizationService(
    promptWizardClient,
    templateService,
    cacheService
  );

  // Set up cross-system event handling
  pipeline.on('pipeline:completed', result => {
    logger.debug(
      `Pipeline completed, notifying feedback system for template ${result.data?.templateId || 'unknown'} (success: ${result.success})`
    );

    // The feedback loop can listen for optimization completions
    feedbackLoop.emit('optimization:completed', result);
  });

  feedbackLoop.on('reoptimization:triggered', trigger => {
    logger.debug(
      `Re-optimization triggered by feedback system for template ${trigger.templateId}: ${trigger.reason}`
    );
  });

  logger.info('Phase PW-2 Core Integration System initialized successfully');

  return {
    pipeline,
    feedbackLoop,
    optimizationService,
  };
}

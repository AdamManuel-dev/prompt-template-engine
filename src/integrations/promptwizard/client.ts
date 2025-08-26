/**
 * @fileoverview TypeScript client library for PromptWizard integration
 * @lastmodified 2025-08-26T12:05:00Z
 *
 * Features: HTTP client for PromptWizard API with retry logic and error handling
 * Main APIs: PromptWizardClient class implementing PromptWizardService interface
 * Constraints: Requires Python microservice running, handles network failures gracefully
 * Patterns: Service client pattern, retry with exponential backoff, type-safe API
 */

import { logger } from '../../utils/logger';
import {
  OptimizationConfig,
  OptimizedResult,
  QualityScore,
  PromptComparison,
  Example,
  OptimizationJob,
  PromptWizardService,
  PromptWizardConfig,
  ServiceResponse,
  OptimizationEvent,
  OptimizationEventHandler,
} from './types';

export class PromptWizardClient implements PromptWizardService {
  private config: PromptWizardConfig;

  private eventHandlers: Set<OptimizationEventHandler> = new Set();

  constructor(config: PromptWizardConfig) {
    this.config = config;
  }

  /**
   * Optimize a prompt using PromptWizard
   */
  async optimizePrompt(
    optimizationConfig: OptimizationConfig
  ): Promise<OptimizedResult> {
    logger.info(
      `Starting prompt optimization for task: ${optimizationConfig.task}`
    );

    try {
      const response = await this.makeRequest<OptimizedResult>(
        'POST',
        '/api/v1/optimize',
        {
          ...optimizationConfig,
          ...this.config.defaults,
          ...optimizationConfig, // Allow config to override defaults
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Optimization failed');
      }

      // Emit started event
      this.emitEvent({
        type: 'started',
        jobId: response.data.jobId,
        config: optimizationConfig,
      });

      // If job is processing, poll for completion
      if (response.data.status === 'processing') {
        return await this.pollForCompletion(response.data.jobId);
      }

      return response.data;
    } catch (error) {
      logger.error(
        `Prompt optimization failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Score a prompt for quality
   */
  async scorePrompt(prompt: string, task?: string): Promise<QualityScore> {
    logger.info(`Scoring prompt quality${task ? ` for task: ${task}` : ''}`);

    try {
      const response = await this.makeRequest<QualityScore>(
        'POST',
        '/api/v1/score',
        {
          prompt,
          task,
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Scoring failed');
      }

      return response.data;
    } catch (error) {
      logger.error(
        `Prompt scoring failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Compare two prompts
   */
  async comparePrompts(
    original: string,
    optimized: string,
    task?: string
  ): Promise<PromptComparison> {
    logger.info(`Comparing prompts${task ? ` for task: ${task}` : ''}`);

    try {
      const response = await this.makeRequest<PromptComparison>(
        'POST',
        '/api/v1/compare',
        {
          original,
          optimized,
          task,
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Comparison failed');
      }

      return response.data;
    } catch (error) {
      logger.error(
        `Prompt comparison failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Generate examples for a task
   */
  async generateExamples(task: string, count: number): Promise<Example[]> {
    logger.info(`Generating ${count} examples for task: ${task}`);

    try {
      const response = await this.makeRequest<Example[]>(
        'POST',
        '/api/v1/examples',
        {
          task,
          count,
        }
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Example generation failed');
      }

      return response.data;
    } catch (error) {
      logger.error(
        `Example generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get optimization job status
   */
  async getJobStatus(jobId: string): Promise<OptimizationJob> {
    try {
      const response = await this.makeRequest<OptimizationJob>(
        'GET',
        `/api/v1/status/${jobId}`
      );

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to get job status');
      }

      return response.data;
    } catch (error) {
      logger.error(
        `Failed to get job status: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Cancel an optimization job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    logger.info(`Cancelling optimization job: ${jobId}`);

    try {
      const response = await this.makeRequest<{ cancelled: boolean }>(
        'POST',
        `/api/v1/cancel/${jobId}`
      );

      if (!response.success || !response.data) {
        return false;
      }

      // Emit cancelled event
      this.emitEvent({
        type: 'cancelled',
        jobId,
      });

      return response.data.cancelled;
    } catch (error) {
      logger.error(
        `Failed to cancel job: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Validate service health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest<{
        healthy: boolean;
        version: string;
      }>('GET', '/api/v1/health');
      return response.success && response.data?.healthy === true;
    } catch (error) {
      logger.error(
        `Health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }

  /**
   * Add event handler for optimization events
   */
  addEventListener(handler: OptimizationEventHandler): () => void {
    this.eventHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Poll for job completion
   */
  private async pollForCompletion(jobId: string): Promise<OptimizedResult> {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const job = await this.getJobStatus(jobId);

        // Emit progress event
        this.emitEvent({
          type: 'progress',
          jobId,
          progress: job.progress,
          step: job.currentStep,
        });

        if (job.status === 'completed' && job.result) {
          // Emit completed event
          this.emitEvent({
            type: 'completed',
            jobId,
            result: job.result,
          });
          return job.result;
        }

        if (job.status === 'failed') {
          const error = job.error || { code: 'UNKNOWN', message: 'Job failed' };
          // Emit failed event
          this.emitEvent({
            type: 'failed',
            jobId,
            error,
          });
          throw new Error(`Optimization failed: ${error.message}`);
        }

        if (job.status === 'cancelled') {
          throw new Error('Optimization was cancelled');
        }

        // Wait before next poll
        await new Promise<void>(resolve => {
          setTimeout(() => resolve(), pollInterval);
        });
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
        // Continue polling on temporary errors
        await new Promise<void>(resolve => {
          setTimeout(() => resolve(), pollInterval);
        });
      }
    }

    throw new Error('Optimization timed out');
  }

  /**
   * Emit optimization event
   */
  private emitEvent(event: OptimizationEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        logger.error(
          `Error in event handler: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: unknown
  ): Promise<ServiceResponse<T>> {
    const url = `${this.config.serviceUrl}${endpoint}`;
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= this.config.retries; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.config.timeout
        );

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
          },
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = (await response.json()) as ServiceResponse<T>;
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.retries) {
          const delay = Math.min(1000 * 2 ** attempt, 10000); // Exponential backoff, max 10s
          logger.warn(
            `Request failed (attempt ${attempt + 1}), retrying in ${delay}ms: ${lastError.message}`
          );
          await new Promise<void>(resolve => {
            setTimeout(() => resolve(), delay);
          });
        }
      }
    }

    throw lastError;
  }

  /**
   * Get authentication headers
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.config.auth?.apiKey) {
      headers.Authorization = `Bearer ${this.config.auth.apiKey}`;
    }

    return headers;
  }
}

/**
 * Create default PromptWizard configuration
 */
export function createDefaultConfig(
  overrides?: Partial<PromptWizardConfig>
): PromptWizardConfig {
  const config = {
    serviceUrl: process.env.PROMPTWIZARD_SERVICE_URL || 'http://localhost:8000',
    timeout: 120000, // 2 minutes
    retries: 3,
    defaults: {
      targetModel: 'gpt-4',
      mutateRefineIterations: 3,
      fewShotCount: 5,
      generateReasoning: true,
    },
    cache: {
      enabled: true,
      ttl: 86400, // 24 hours
      maxSize: 1000,
    },
    auth: {
      apiKey: process.env.PROMPTWIZARD_API_KEY,
    },
    rateLimiting: {
      maxRequests: 100,
      windowMs: 3600000, // 1 hour
    },
  };

  return overrides ? { ...config, ...overrides } : config;
}

/**
 * @fileoverview gRPC client for PromptWizard service integration
 * @lastmodified 2025-08-26T14:20:00Z
 *
 * Features: gRPC client with streaming, retries, connection pooling
 * Main APIs: optimizePrompt(), scorePrompt(), streamOptimization()
 * Constraints: Requires @grpc/grpc-js package and generated proto files
 * Patterns: gRPC client with interceptors, streaming, error handling
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import {
  OptimizationRequest,
  OptimizationResponse,
  OptimizationMetrics,
  OptimizationJob,
  ScoringRequest,
  ScoringResponse,
  ComparisonRequest,
  ComparisonResponse,
} from './types'; // Using manual types until proto generation is configured
import {
  validateScoringResponse,
  validateComparisonResponse,
  safeValidateOptimizationResponse,
} from './schemas';

export interface GrpcClientConfig {
  serviceUrl: string;
  timeout: number;
  retries: number;
  keepAlive: boolean;
  maxReceiveMessageLength?: number;
  maxSendMessageLength?: number;
  credentials?: grpc.ChannelCredentials;
}

export interface StreamOptimizationUpdate {
  jobId: string;
  progress: number;
  currentStep: string;
  status: 'processing' | 'completed' | 'failed';
  partialResult?: OptimizationResponse;
  error?: string;
}

interface GrpcStreamClient {
  on: (
    event: 'data' | 'end' | 'error',
    listener: (data?: unknown) => void
  ) => void;
  cancel: () => void;
}

interface GrpcClient {
  healthCheck: (
    request: unknown,
    options: { deadline: Date },
    callback: (error: unknown, response: { healthy: boolean }) => void
  ) => void;
  optimizePrompt: (
    request: OptimizationRequest,
    options: { deadline: Date },
    callback: (error: unknown, response: OptimizationResponse) => void
  ) => void;
  scorePrompt: (
    request: ScoringRequest,
    options: { deadline: Date },
    callback: (error: unknown, response: ScoringResponse) => void
  ) => void;
  comparePrompts: (
    request: ComparisonRequest,
    options: { deadline: Date },
    callback: (error: unknown, response: ComparisonResponse) => void
  ) => void;
  getJobStatus: (
    request: { job_id: string },
    options: { deadline: Date },
    callback: (error: unknown, response: OptimizationJob) => void
  ) => void;
  cancelJob: (
    request: { job_id: string },
    options: { deadline: Date },
    callback: (error: unknown, response: { success: boolean }) => void
  ) => void;
  streamOptimization: (
    request: OptimizationRequest,
    options: { deadline: Date }
  ) => GrpcStreamClient;
}

interface GrpcError {
  code: number;
  details?: string;
  message: string;
}

interface GrpcStreamUpdate {
  job_id: string;
  progress_percentage: number;
  current_step: string;
  status: string;
  partial_result?: unknown;
}

export class PromptWizardGrpcClient extends EventEmitter {
  private client: GrpcClient | null = null;

  private config: GrpcClientConfig;

  private isConnected: boolean = false;

  constructor(config: GrpcClientConfig) {
    super();
    this.config = {
      ...config,
      maxReceiveMessageLength:
        config.maxReceiveMessageLength || 4 * 1024 * 1024, // 4MB
      maxSendMessageLength: config.maxSendMessageLength || 4 * 1024 * 1024, // 4MB
    };

    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      // Load proto definition
      const packageDefinition = protoLoader.loadSync(
        './proto/promptwizard/optimization.proto',
        {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
        }
      );

      const protoDescriptor = grpc.loadPackageDefinition(
        packageDefinition
      ) as unknown as {
        promptwizard: {
          PromptOptimizationService: new (
            url: string,
            credentials: grpc.ChannelCredentials,
            options: Record<string, unknown>
          ) => GrpcClient;
        };
      };
      const promptwizardProto = protoDescriptor.promptwizard;

      // Create client with credentials
      const credentials =
        this.config.credentials || grpc.credentials.createInsecure();

      this.client = new promptwizardProto.PromptOptimizationService(
        this.config.serviceUrl,
        credentials,
        {
          'grpc.keepalive_time_ms': this.config.keepAlive ? 10000 : 0,
          'grpc.keepalive_timeout_ms': 5000,
          'grpc.keepalive_permit_without_calls': true,
          'grpc.http2.max_pings_without_data': 0,
          'grpc.max_receive_message_length':
            this.config.maxReceiveMessageLength,
          'grpc.max_send_message_length': this.config.maxSendMessageLength,
        }
      );

      // Test connection
      await this.healthCheck();
      this.isConnected = true;

      logger.info('gRPC client initialized successfully', {
        serviceUrl: this.config.serviceUrl,
      });
    } catch (error) {
      logger.error('Failed to initialize gRPC client', error as Error);
      throw new Error(`gRPC client initialization failed: ${error}`);
    }
  }

  /**
   * Health check via gRPC
   */
  async healthCheck(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);

      this.client.healthCheck(
        {},
        { deadline },
        (error: unknown, response: { healthy: boolean }) => {
          if (error) {
            logger.error('gRPC health check failed', error);
            resolve(false);
          } else {
            resolve(response.healthy === true);
          }
        }
      );
    });
  }

  /**
   * Optimize prompt via gRPC
   */
  async optimizePrompt(
    request: OptimizationRequest
  ): Promise<OptimizationResponse> {
    return this.executeWithRetry(
      'optimizePrompt',
      request
    ) as Promise<OptimizationResponse>;
  }

  /**
   * Score prompt via gRPC
   */
  async scorePrompt(request: ScoringRequest): Promise<ScoringResponse> {
    return this.executeWithRetry(
      'scorePrompt',
      request
    ) as Promise<ScoringResponse>;
  }

  /**
   * Compare prompts via gRPC
   */
  async comparePrompts(
    request: ComparisonRequest
  ): Promise<ComparisonResponse> {
    return this.executeWithRetry(
      'comparePrompts',
      request
    ) as Promise<ComparisonResponse>;
  }

  /**
   * Stream optimization updates via gRPC
   */
  streamOptimization(request: OptimizationRequest): EventEmitter {
    const streamEmitter = new EventEmitter();

    if (!this.client) {
      streamEmitter.emit('error', new Error('gRPC client not initialized'));
      return streamEmitter;
    }

    try {
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + this.config.timeout / 1000);

      const stream = this.client.streamOptimization(request, { deadline });

      stream.on('data', (update: unknown) => {
        const grpcUpdate = update as GrpcStreamUpdate;
        const typedUpdate: StreamOptimizationUpdate = {
          jobId: grpcUpdate.job_id,
          progress: grpcUpdate.progress_percentage,
          currentStep: grpcUpdate.current_step,
          status: grpcUpdate.status as 'processing' | 'completed' | 'failed',
          partialResult: grpcUpdate.partial_result
            ? this.convertGrpcOptimizationResponse(grpcUpdate.partial_result)
            : undefined,
        };

        streamEmitter.emit('update', typedUpdate);

        // Emit final result if completed
        if (grpcUpdate.status === 'completed' && grpcUpdate.partial_result) {
          streamEmitter.emit('completed', typedUpdate.partialResult);
        }
      });

      stream.on('end', () => {
        streamEmitter.emit('end');
      });

      stream.on('error', (error: unknown) => {
        const grpcError = error as GrpcError;
        logger.error('gRPC stream error', error);
        streamEmitter.emit('error', this.parseGrpcError(grpcError));
      });

      // Add cancel method
      Object.defineProperty(streamEmitter, 'cancel', {
        value: () => stream.cancel(),
        enumerable: false,
        writable: false,
      });
    } catch (error) {
      logger.error('Failed to start gRPC stream', error as Error);
      streamEmitter.emit('error', error);
    }

    return streamEmitter;
  }

  /**
   * Get job status via gRPC
   */
  async getJobStatus(
    jobId: string
  ): Promise<{ status: string; progress?: number; error?: string }> {
    return this.executeWithRetry('getJobStatus', { job_id: jobId }) as Promise<{
      status: string;
      progress?: number;
      error?: string;
    }>;
  }

  /**
   * Cancel job via gRPC
   */
  async cancelJob(
    jobId: string
  ): Promise<{ cancelled: boolean; message: string }> {
    return this.executeWithRetry('cancelJob', { job_id: jobId }) as Promise<{
      cancelled: boolean;
      message: string;
    }>;
  }

  /**
   * Execute gRPC method with retry logic
   */
  private async executeWithRetry(
    method: string,
    request:
      | OptimizationRequest
      | ScoringRequest
      | ComparisonRequest
      | { job_id: string },
    retryCount: number = 0
  ): Promise<
    | OptimizationResponse
    | ScoringResponse
    | ComparisonResponse
    | { status: string; progress?: number; error?: string }
    | { cancelled: boolean; message: string }
  > {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + this.config.timeout / 1000);

      (
        this.client as unknown as Record<
          string,
          (...args: unknown[]) => unknown
        >
      )[method](request, { deadline }, (error: unknown, response: unknown) => {
        if (error) {
          const grpcError = this.parseGrpcError(error);

          // Retry on specific error conditions
          if (
            retryCount < this.config.retries &&
            this.isRetryableError(error)
          ) {
            logger.warn(
              `gRPC ${method} failed, retrying (${retryCount + 1}/${this.config.retries})`,
              {
                error: grpcError.message,
                retryCount: retryCount + 1,
              }
            );

            // Exponential backoff
            const backoffDelay = 2 ** retryCount * 1000;
            setTimeout(() => {
              this.executeWithRetry(method, request, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, backoffDelay);
            return;
          }

          logger.error(`gRPC ${method} failed`, grpcError);
          reject(grpcError);
        } else {
          resolve(this.convertGrpcResponse(method, response));
        }
      });
    });
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    const retryableCodes = [
      grpc.status.UNAVAILABLE,
      grpc.status.DEADLINE_EXCEEDED,
      grpc.status.RESOURCE_EXHAUSTED,
      grpc.status.INTERNAL,
    ];

    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      retryableCodes.includes((error as GrpcError).code)
    );
  }

  /**
   * Parse gRPC error into standard format
   */
  private parseGrpcError(error: unknown): Error {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const grpcError = error as GrpcError;
      const statusText =
        Object.keys(grpc.status as unknown as Record<string, number>).find(
          key =>
            (grpc.status as unknown as Record<string, number>)[key] ===
            grpcError.code
        ) || 'UNKNOWN';

      return new Error(
        `gRPC ${statusText}: ${grpcError.details || grpcError.message}`
      );
    }

    return new Error(`Unknown gRPC error: ${String(error)}`);
  }

  /**
   * Convert gRPC response to TypeScript types
   */
  private convertGrpcResponse(
    method: string,
    response: unknown
  ):
    | OptimizationResponse
    | ScoringResponse
    | ComparisonResponse
    | { status: string; progress?: number; error?: string }
    | { cancelled: boolean; message: string } {
    switch (method) {
      case 'optimizePrompt':
        return this.convertGrpcOptimizationResponse(response);
      case 'scorePrompt':
        return this.convertGrpcScoringResponse(response);
      case 'comparePrompts':
        return this.convertGrpcComparisonResponse(response);
      case 'getJobStatus':
        return this.convertGrpcJobStatusResponse(response);
      default:
        return response as
          | OptimizationResponse
          | ScoringResponse
          | ComparisonResponse
          | { status: string; progress?: number; error?: string }
          | { cancelled: boolean; message: string };
    }
  }

  /**
   * Convert gRPC optimization response
   */
  private convertGrpcOptimizationResponse(
    response: unknown
  ): OptimizationResponse {
    const grpcResponse = response as {
      job_id?: string;
      status?: string;
      original_prompt?: string;
      optimized_prompt?: string;
      metrics?: {
        accuracy_improvement?: number;
        token_reduction?: number;
        cost_reduction?: number;
        processing_time?: number;
        api_calls_used?: number;
      };
      error_message?: string;
    };

    const converted = {
      jobId: grpcResponse.job_id || '',
      status: grpcResponse.status || 'failed',
      originalPrompt: grpcResponse.original_prompt || '',
      optimizedPrompt: grpcResponse.optimized_prompt || '',
      metrics: {
        accuracyImprovement: grpcResponse.metrics?.accuracy_improvement || 0,
        tokenReduction: grpcResponse.metrics?.token_reduction || 0,
        costReduction: grpcResponse.metrics?.cost_reduction || 0,
        processingTime: grpcResponse.metrics?.processing_time || 0,
        apiCallsUsed: grpcResponse.metrics?.api_calls_used || 0,
      } as OptimizationMetrics,
      error: grpcResponse.error_message,
    };

    // Validate converted response with Zod schema
    const validationResult = safeValidateOptimizationResponse(converted);
    if (!validationResult.success) {
      logger.error(
        'Invalid OptimizationResponse from gRPC API:',
        validationResult.error.issues
      );
      throw new Error(
        `Invalid gRPC response: ${validationResult.error.issues.map((i: { message: string }) => i.message).join(', ')}`
      );
    }

    return validationResult.data;
  }

  /**
   * Convert gRPC scoring response
   */
  private convertGrpcScoringResponse(response: unknown): ScoringResponse {
    const grpcResponse = response as {
      overall_score?: number;
      component_scores?: Record<string, unknown>;
      suggestions?: string[];
      metrics?: Record<string, unknown>;
    };

    // Ensure componentScores is properly typed
    const componentScores: Record<string, number> = {};
    if (
      grpcResponse.component_scores &&
      typeof grpcResponse.component_scores === 'object'
    ) {
      Object.entries(grpcResponse.component_scores).forEach(([key, value]) => {
        componentScores[key] = typeof value === 'number' ? value : 0;
      });
    }

    const converted = {
      overallScore: grpcResponse.overall_score || 0,
      componentScores,
      suggestions: grpcResponse.suggestions || [],
      metrics: grpcResponse.metrics || {},
    };

    // Validate converted response with Zod schema
    try {
      return validateScoringResponse(converted);
    } catch (error) {
      logger.error('Invalid ScoringResponse from gRPC API:', error);
      throw new Error(
        `Invalid gRPC response: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Convert gRPC comparison response
   */
  private convertGrpcComparisonResponse(response: unknown): ComparisonResponse {
    const grpcResponse = response as {
      improvement_score?: number;
      improvements?: string[];
      potential_issues?: string[];
      metrics?: Record<string, unknown>;
    };

    const converted = {
      improvementScore: grpcResponse.improvement_score || 0,
      improvements: grpcResponse.improvements || [],
      potentialIssues: grpcResponse.potential_issues || [],
      metrics: grpcResponse.metrics || {},
    };

    // Validate converted response with Zod schema
    try {
      return validateComparisonResponse(converted);
    } catch (error) {
      logger.error('Invalid ComparisonResponse from gRPC API:', error);
      throw new Error(
        `Invalid gRPC response: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Convert gRPC job status response
   */
  private convertGrpcJobStatusResponse(response: unknown): {
    jobId: string;
    status: string;
    progressPercentage?: number;
    currentStep?: string;
    result?: OptimizationResponse | null;
    error?: string;
  } {
    const grpcResponse = response as {
      job_id?: string;
      status?: string;
      progress_percentage?: number;
      current_step?: string;
      result?: unknown;
      error_message?: string;
    };

    return {
      jobId: grpcResponse.job_id || '',
      status: grpcResponse.status || 'unknown',
      progressPercentage: grpcResponse.progress_percentage,
      currentStep: grpcResponse.current_step,
      result: grpcResponse.result
        ? this.convertGrpcOptimizationResponse(grpcResponse.result)
        : null,
      error: grpcResponse.error_message,
    };
  }

  /**
   * Close gRPC client
   */
  async close(): Promise<void> {
    if (this.client) {
      (this.client as unknown as { close: () => void }).close();
      this.isConnected = false;
      logger.info('gRPC client closed');
    }
  }

  /**
   * Get connection status
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }
}

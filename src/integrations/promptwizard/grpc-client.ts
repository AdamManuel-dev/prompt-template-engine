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
  ScoringRequest,
  ScoringResponse,
  ComparisonRequest,
  ComparisonResponse 
} from './types';

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

export class PromptWizardGrpcClient extends EventEmitter {
  private client: any;
  private config: GrpcClientConfig;
  private isConnected: boolean = false;

  constructor(config: GrpcClientConfig) {
    super();
    this.config = {
      timeout: 30000,
      retries: 3,
      keepAlive: true,
      maxReceiveMessageLength: 4 * 1024 * 1024, // 4MB
      maxSendMessageLength: 4 * 1024 * 1024,    // 4MB
      ...config
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

      const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
      const promptwizardProto = protoDescriptor.promptwizard;

      // Create client with credentials
      const credentials = this.config.credentials || grpc.credentials.createInsecure();
      
      this.client = new promptwizardProto.PromptOptimizationService(
        this.config.serviceUrl,
        credentials,
        {
          'grpc.keepalive_time_ms': this.config.keepAlive ? 10000 : 0,
          'grpc.keepalive_timeout_ms': 5000,
          'grpc.keepalive_permit_without_calls': true,
          'grpc.http2.max_pings_without_data': 0,
          'grpc.max_receive_message_length': this.config.maxReceiveMessageLength,
          'grpc.max_send_message_length': this.config.maxSendMessageLength,
        }
      );

      // Test connection
      await this.healthCheck();
      this.isConnected = true;
      
      logger.info('gRPC client initialized successfully', {
        serviceUrl: this.config.serviceUrl
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

      this.client.healthCheck({}, { deadline }, (error: any, response: any) => {
        if (error) {
          logger.error('gRPC health check failed', error);
          resolve(false);
        } else {
          resolve(response.healthy === true);
        }
      });
    });
  }

  /**
   * Optimize prompt via gRPC
   */
  async optimizePrompt(request: OptimizationRequest): Promise<OptimizationResponse> {
    return this.executeWithRetry('optimizePrompt', request);
  }

  /**
   * Score prompt via gRPC
   */
  async scorePrompt(request: ScoringRequest): Promise<ScoringResponse> {
    return this.executeWithRetry('scorePrompt', request);
  }

  /**
   * Compare prompts via gRPC
   */
  async comparePrompts(request: ComparisonRequest): Promise<ComparisonResponse> {
    return this.executeWithRetry('comparePrompts', request);
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

      stream.on('data', (update: any) => {
        const typedUpdate: StreamOptimizationUpdate = {
          jobId: update.job_id,
          progress: update.progress_percentage,
          currentStep: update.current_step,
          status: update.status,
          partialResult: update.partial_result ? this.convertGrpcOptimizationResponse(update.partial_result) : undefined
        };

        streamEmitter.emit('update', typedUpdate);

        // Emit final result if completed
        if (update.status === 'completed' && update.partial_result) {
          streamEmitter.emit('completed', typedUpdate.partialResult);
        }
      });

      stream.on('end', () => {
        streamEmitter.emit('end');
      });

      stream.on('error', (error: any) => {
        logger.error('gRPC stream error', error);
        streamEmitter.emit('error', this.parseGrpcError(error));
      });

      // Add cancel method
      (streamEmitter as any).cancel = () => {
        stream.cancel();
      };

    } catch (error) {
      logger.error('Failed to start gRPC stream', error as Error);
      streamEmitter.emit('error', error);
    }

    return streamEmitter;
  }

  /**
   * Get job status via gRPC
   */
  async getJobStatus(jobId: string): Promise<any> {
    return this.executeWithRetry('getJobStatus', { job_id: jobId });
  }

  /**
   * Cancel job via gRPC
   */
  async cancelJob(jobId: string): Promise<{ cancelled: boolean; message: string }> {
    return this.executeWithRetry('cancelJob', { job_id: jobId });
  }

  /**
   * Execute gRPC method with retry logic
   */
  private async executeWithRetry(method: string, request: any, retryCount: number = 0): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('gRPC client not initialized'));
        return;
      }

      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + this.config.timeout / 1000);

      this.client[method](request, { deadline }, (error: any, response: any) => {
        if (error) {
          const grpcError = this.parseGrpcError(error);

          // Retry on specific error conditions
          if (retryCount < this.config.retries && this.isRetryableError(error)) {
            logger.warn(`gRPC ${method} failed, retrying (${retryCount + 1}/${this.config.retries})`, {
              error: grpcError.message,
              retryCount: retryCount + 1
            });

            // Exponential backoff
            const backoffDelay = Math.pow(2, retryCount) * 1000;
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
  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      grpc.status.UNAVAILABLE,
      grpc.status.DEADLINE_EXCEEDED,
      grpc.status.RESOURCE_EXHAUSTED,
      grpc.status.INTERNAL
    ];

    return retryableCodes.includes(error.code);
  }

  /**
   * Parse gRPC error into standard format
   */
  private parseGrpcError(error: any): Error {
    const statusText = Object.keys(grpc.status).find(
      key => (grpc.status as any)[key] === error.code
    ) || 'UNKNOWN';

    return new Error(`gRPC ${statusText}: ${error.details || error.message}`);
  }

  /**
   * Convert gRPC response to TypeScript types
   */
  private convertGrpcResponse(method: string, response: any): any {
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
        return response;
    }
  }

  /**
   * Convert gRPC optimization response
   */
  private convertGrpcOptimizationResponse(response: any): OptimizationResponse {
    return {
      jobId: response.job_id,
      status: response.status,
      originalPrompt: response.original_prompt,
      optimizedPrompt: response.optimized_prompt,
      metrics: {
        accuracyImprovement: response.metrics?.accuracy_improvement || 0,
        tokenReduction: response.metrics?.token_reduction || 0,
        costReduction: response.metrics?.cost_reduction || 0,
        processingTime: response.metrics?.processing_time || 0,
        apiCallsUsed: response.metrics?.api_calls_used || 0,
      } as OptimizationMetrics,
      errorMessage: response.error_message
    };
  }

  /**
   * Convert gRPC scoring response
   */
  private convertGrpcScoringResponse(response: any): ScoringResponse {
    return {
      overallScore: response.overall_score,
      componentScores: response.component_scores || {},
      suggestions: response.suggestions || [],
      metrics: response.metrics || {}
    };
  }

  /**
   * Convert gRPC comparison response
   */
  private convertGrpcComparisonResponse(response: any): ComparisonResponse {
    return {
      improvementScore: response.improvement_score,
      improvements: response.improvements || [],
      potentialIssues: response.potential_issues || [],
      metrics: response.metrics || {}
    };
  }

  /**
   * Convert gRPC job status response
   */
  private convertGrpcJobStatusResponse(response: any): any {
    return {
      jobId: response.job_id,
      status: response.status,
      progressPercentage: response.progress_percentage,
      currentStep: response.current_step,
      result: response.result ? this.convertGrpcOptimizationResponse(response.result) : null,
      errorMessage: response.error_message
    };
  }

  /**
   * Close gRPC client
   */
  async close(): Promise<void> {
    if (this.client) {
      this.client.close();
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
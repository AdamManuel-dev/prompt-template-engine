/**
 * @fileoverview WebSocket client for real-time PromptWizard optimization updates
 * @lastmodified 2025-08-26T14:30:00Z
 *
 * Features: WebSocket client with reconnection, message queuing, event handling
 * Main APIs: connect(), optimizePrompt(), subscribeToJob(), disconnect()
 * Constraints: Requires WebSocket support and EventEmitter
 * Patterns: WebSocket client with auto-reconnect, message queue, heartbeat
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { 
  OptimizationRequest, 
  OptimizationResponse,
  OptimizationMetrics
} from './types';

export interface WebSocketClientConfig {
  url: string;
  token?: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  timeout: number;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  jobId?: string;
  timestamp?: string;
}

export interface OptimizationUpdate {
  jobId: string;
  progress: number;
  currentStep: string;
  status: 'processing' | 'completed' | 'failed';
  result?: OptimizationResponse;
  error?: string;
}

export class PromptWizardWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketClientConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private messageQueue: WebSocketMessage[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private subscribedJobs: Set<string> = new Set();

  constructor(config: WebSocketClientConfig) {
    super();
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      timeout: 60000,
      ...config
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.config.token 
          ? `${this.config.url}?token=${this.config.token}`
          : this.config.url;

        this.ws = new WebSocket(wsUrl);

        const connectTimeout = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, this.config.timeout);

        this.ws.onopen = () => {
          clearTimeout(connectTimeout);
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          logger.info('WebSocket connected successfully');
          this.emit('connected');
          
          // Process queued messages
          this.processMessageQueue();
          
          // Start heartbeat
          this.startHeartbeat();
          
          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(connectTimeout);
          this.handleDisconnection(event);
        };

        this.ws.onerror = (error) => {
          clearTimeout(connectTimeout);
          logger.error('WebSocket error', error);
          this.emit('error', error);
          
          if (!this.isConnected) {
            reject(new Error(`WebSocket connection failed: ${error}`));
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection(event: CloseEvent): void {
    this.isConnected = false;
    this.stopHeartbeat();

    logger.warn('WebSocket disconnected', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean
    });

    this.emit('disconnected', event);

    // Attempt reconnection if not manually closed
    if (event.code !== 1000 && event.code !== 1001) {
      this.attemptReconnection();
    }
  }

  /**
   * Attempt to reconnect to WebSocket
   */
  private attemptReconnection(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      this.emit('reconnectionFailed');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);

    logger.info(`Attempting WebSocket reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        
        // Re-subscribe to jobs after reconnection
        for (const jobId of this.subscribedJobs) {
          this.subscribeToJob(jobId);
        }
        
      } catch (error) {
        logger.error('Reconnection attempt failed', error as Error);
        this.attemptReconnection();
      }
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      
      logger.debug('WebSocket message received', { type: message.type });

      switch (message.type) {
        case 'job_started':
          this.emit('jobStarted', message.data);
          break;

        case 'progress_update':
          this.emit('progressUpdate', this.convertToOptimizationUpdate(message.data));
          break;

        case 'optimization_complete':
          this.emit('optimizationComplete', this.convertToOptimizationUpdate(message.data));
          break;

        case 'optimization_failed':
          this.emit('optimizationFailed', {
            jobId: message.data.job_id,
            error: message.data.error
          });
          break;

        case 'job_status':
          this.emit('jobStatus', message.data);
          break;

        case 'job_cancelled':
          this.emit('jobCancelled', message.data);
          break;

        case 'cached_result':
          this.emit('cachedResult', message.data);
          break;

        case 'error':
          logger.error('WebSocket server error', message);
          this.emit('serverError', message);
          break;

        case 'pong':
          // Heartbeat response - connection is alive
          break;

        default:
          logger.warn('Unknown WebSocket message type', { type: message.type });
      }
    } catch (error) {
      logger.error('Failed to parse WebSocket message', error as Error);
    }
  }

  /**
   * Convert server data to OptimizationUpdate format
   */
  private convertToOptimizationUpdate(data: any): OptimizationUpdate {
    return {
      jobId: data.job_id,
      progress: data.progress,
      currentStep: data.current_step,
      status: data.status,
      result: data.result ? this.convertToOptimizationResponse(data.result) : undefined,
      error: data.error
    };
  }

  /**
   * Convert server data to OptimizationResponse format
   */
  private convertToOptimizationResponse(data: any): OptimizationResponse {
    return {
      jobId: data.job_id,
      status: data.status,
      originalPrompt: data.original_prompt,
      optimizedPrompt: data.optimized_prompt,
      metrics: data.metrics as OptimizationMetrics,
      errorMessage: data.error_message
    };
  }

  /**
   * Start optimization with real-time updates
   */
  async optimizePrompt(request: OptimizationRequest): Promise<void> {
    const message: WebSocketMessage = {
      type: 'optimize',
      data: request
    };

    this.sendMessage(message);
  }

  /**
   * Subscribe to existing job updates
   */
  subscribeToJob(jobId: string): void {
    this.subscribedJobs.add(jobId);
    
    const message: WebSocketMessage = {
      type: 'subscribe_job',
      jobId
    };

    this.sendMessage(message);
  }

  /**
   * Unsubscribe from job updates
   */
  unsubscribeFromJob(jobId: string): void {
    this.subscribedJobs.delete(jobId);
    
    const message: WebSocketMessage = {
      type: 'unsubscribe_job',
      jobId
    };

    this.sendMessage(message);
  }

  /**
   * Cancel optimization job
   */
  cancelJob(jobId: string): void {
    const message: WebSocketMessage = {
      type: 'cancel_job',
      jobId
    };

    this.sendMessage(message);
  }

  /**
   * Send message to WebSocket server
   */
  private sendMessage(message: WebSocketMessage): void {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error('Failed to send WebSocket message', error as Error);
        this.messageQueue.push(message);
      }
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
      logger.debug('Message queued - WebSocket not connected');
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  /**
   * Start heartbeat ping/pong
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({ type: 'ping' });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Get connection status
   */
  isClientConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): any {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      subscribedJobs: Array.from(this.subscribedJobs),
      readyState: this.ws?.readyState,
      config: {
        url: this.config.url,
        reconnectInterval: this.config.reconnectInterval,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
        heartbeatInterval: this.config.heartbeatInterval
      }
    };
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnected = false;
    this.messageQueue = [];
    this.subscribedJobs.clear();
    
    logger.info('WebSocket client disconnected');
    this.emit('disconnect');
  }
}
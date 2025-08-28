/**
 * @fileoverview Server-Sent Events client for real-time execution progress
 * @lastmodified 2025-08-28T13:00:00Z
 *
 * Features: SSE connection management, authentication, reconnection
 * Main APIs: SSEClient class with event handling
 * Constraints: Requires authentication token, handles connection errors
 * Patterns: Event-driven architecture, connection resilience
 */

import { ProgressUpdate } from '@cursor-prompt/shared';

export interface SSEClientOptions {
  baseURL: string;
  authToken?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export interface SSEEventHandlers {
  onProgress?: (update: ProgressUpdate) => void;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export class SSEClient {
  private eventSource: EventSource | null = null;

  private options: Required<SSEClientOptions>;

  private handlers: SSEEventHandlers = {};

  private retryCount = 0;

  private retryTimeout: NodeJS.Timeout | null = null;

  private isManuallyClosing = false;

  constructor(options: SSEClientOptions) {
    this.options = {
      maxRetries: 3,
      retryDelay: 2000,
      authToken: '',
      ...options,
    };
  }

  public connect(executionId: string, handlers: SSEEventHandlers): void {
    this.handlers = handlers;
    this.isManuallyClosing = false;
    this.createConnection(executionId);
  }

  private createConnection(executionId: string): void {
    try {
      // Clean up existing connection
      this.cleanup();

      // Build URL with auth token
      const url = new URL(
        `/executions/${executionId}/stream`,
        this.options.baseURL
      );
      if (this.options.authToken) {
        url.searchParams.set('token', this.options.authToken);
      }

      // Create EventSource connection
      this.eventSource = new EventSource(url.toString());

      // Set up event listeners
      this.eventSource.onopen = () => {
        console.log(`[SSE] Connected to execution stream: ${executionId}`);
        this.retryCount = 0;
        this.handlers.onConnect?.();
      };

      this.eventSource.onmessage = event => {
        try {
          const update: ProgressUpdate = JSON.parse(event.data);
          this.handlers.onProgress?.(update);

          // Handle completion
          if (update.stage === 'completed') {
            this.handlers.onComplete?.(update);
            this.disconnect();
          } else if (update.stage === 'error') {
            this.handlers.onError?.(update.message);
            this.disconnect();
          }
        } catch (error) {
          console.error('[SSE] Failed to parse progress update:', error);
          this.handlers.onError?.('Failed to parse progress update');
        }
      };

      this.eventSource.onerror = error => {
        console.error('[SSE] EventSource error:', error);

        if (!this.isManuallyClosing) {
          this.handleConnectionError(executionId);
        }
      };
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      this.handlers.onError?.('Failed to establish connection');
    }
  }

  private handleConnectionError(executionId: string): void {
    this.cleanup();

    if (this.retryCount < this.options.maxRetries && !this.isManuallyClosing) {
      this.retryCount++;
      const delay = this.options.retryDelay * 2 ** (this.retryCount - 1); // Exponential backoff

      console.log(
        `[SSE] Retrying connection in ${delay}ms (attempt ${this.retryCount}/${this.options.maxRetries})`
      );

      this.retryTimeout = setTimeout(() => {
        if (!this.isManuallyClosing) {
          this.createConnection(executionId);
        }
      }, delay);
    } else {
      console.error('[SSE] Max retries exceeded or manually closed');
      this.handlers.onError?.('Connection failed after multiple retries');
      this.handlers.onDisconnect?.();
    }
  }

  public disconnect(): void {
    this.isManuallyClosing = true;
    this.cleanup();
    this.handlers.onDisconnect?.();
  }

  private cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
  }

  public updateAuthToken(token: string): void {
    this.options.authToken = token;
  }

  public isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  public getConnectionState(): string {
    if (!this.eventSource) return 'CLOSED';

    switch (this.eventSource.readyState) {
      case EventSource.CONNECTING:
        return 'CONNECTING';
      case EventSource.OPEN:
        return 'OPEN';
      case EventSource.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

// Singleton instance for the application
let sseClient: SSEClient | null = null;

export const createSSEClient = (options: SSEClientOptions): SSEClient => {
  if (sseClient) {
    sseClient.disconnect();
  }

  sseClient = new SSEClient(options);
  return sseClient;
};

export const getSSEClient = (): SSEClient | null => sseClient;

// Helper function to get auth token from localStorage
export const getAuthTokenFromStorage = (): string => {
  try {
    const authStore = localStorage.getItem('auth-store');
    if (authStore) {
      const parsed = JSON.parse(authStore);
      return parsed.state?.token || '';
    }
  } catch (error) {
    console.warn('[SSE] Failed to parse auth token from storage:', error);
  }
  return '';
};

export default SSEClient;

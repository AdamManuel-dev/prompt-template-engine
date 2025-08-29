/**
 * @fileoverview API client for backend communication with authentication
 * @lastmodified 2025-08-28T11:45:00Z
 *
 * Features: Axios-based HTTP client, request/response interceptors, error handling
 * Main APIs: templates, executions, auth, health endpoints
 * Constraints: Handles authentication tokens, request/response logging
 * Patterns: Interceptor pattern, centralized error handling
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import toast from 'react-hot-toast';
import {
  Template,
  TemplateSearchQuery,
  TemplateSearchResult,
  ExecutionRequest,
  ExecutionResult,
  ExecutionHistory,
  UserSession,
  ApiResponse,
  HealthStatus,
  FigmaImportRequest,
  FigmaImportResult,
} from '@cursor-prompt/shared';

class ApiClient {
  private client: AxiosInstance;

  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  // Expose client methods for direct access (for auth store compatibility)
  get defaults() {
    return this.client.defaults;
  }

  async post<T = any>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }

  async get<T = any>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }

  async put<T = any>(url: string, data?: any, config?: any) {
    return this.client.put<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: any) {
    return this.client.delete<T>(url, config);
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.client.interceptors.request.use(
      config => {
        const token = localStorage.getItem('auth-store');
        if (token) {
          try {
            const authData = JSON.parse(token);
            if (authData.state?.token) {
              config.headers.Authorization = `Bearer ${authData.state.token}`;
            }
          } catch (error) {
            console.warn('Failed to parse auth token:', error);
          }
        }

        // Log requests in development
        if (import.meta.env.DEV) {
          console.log(
            `[API] ${config.method?.toUpperCase()} ${config.url}`,
            config.data
          );
        }

        return config;
      },
      error => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      response => {
        // Log responses in development
        if (import.meta.env.DEV) {
          console.log(
            `[API] Response from ${response.config.url}:`,
            response.data
          );
        }
        return response;
      },
      (error: AxiosError<ApiResponse<any>>) => {
        this.handleError(error);
        return Promise.reject(error);
      }
    );
  }

  private handleError(error: AxiosError<ApiResponse<any>>): void {
    const message =
      error.response?.data?.error?.message ||
      error.message ||
      'An error occurred';
    const status = error.response?.status;

    // Handle specific error types
    switch (status) {
      case 401:
        toast.error('Authentication required');
        // Clear auth state on 401
        localStorage.removeItem('auth-store');
        window.location.href = '/login';
        break;
      case 403:
        toast.error('Access forbidden');
        break;
      case 404:
        toast.error('Resource not found');
        break;
      case 429:
        toast.error('Too many requests. Please try again later.');
        break;
      case 500:
        toast.error('Server error. Please try again.');
        break;
      default:
        if (status && status >= 400) {
          toast.error(message);
        }
    }

    // Log errors in development
    if (import.meta.env.DEV) {
      console.error('[API] Error:', {
        status,
        message,
        url: error.config?.url,
        data: error.response?.data,
      });
    }
  }

  // Health endpoint
  async getHealth(): Promise<HealthStatus> {
    const response =
      await this.client.get<ApiResponse<HealthStatus>>('/api/health');
    if (!response.data.data) {
      throw new Error('Health check failed: No data returned');
    }
    return response.data.data;
  }

  // Authentication endpoints
  async login(credentials: {
    email?: string;
    username?: string;
    apiKey?: string;
  }): Promise<{ user: UserSession; token: string }> {
    const response = await this.client.post<
      ApiResponse<{ user: UserSession; token: string }>
    >('/auth/login', credentials);
    if (!response.data.data) {
      throw new Error('Login failed: No data returned');
    }
    return response.data.data;
  }

  async getUserInfo(): Promise<UserSession> {
    const response =
      await this.client.get<ApiResponse<UserSession>>('/auth/me');
    if (!response.data.data) {
      throw new Error('Failed to get user info: No data returned');
    }
    return response.data.data;
  }

  // Template endpoints
  async getTemplates(): Promise<Template[]> {
    const response =
      await this.client.get<ApiResponse<Template[]>>('/templates');
    return response.data.data || [];
  }

  async getTemplate(id: string): Promise<Template> {
    const response = await this.client.get<ApiResponse<Template>>(
      `/templates/${id}`
    );
    if (!response.data.data) {
      throw new Error('Template not found');
    }
    return response.data.data;
  }

  async searchTemplates(
    query: TemplateSearchQuery
  ): Promise<TemplateSearchResult> {
    const response = await this.client.post<ApiResponse<TemplateSearchResult>>(
      '/templates/search',
      query
    );
    if (!response.data.data) {
      throw new Error('Search failed: No data returned');
    }
    return response.data.data;
  }

  async getTemplateSchema(id: string): Promise<Record<string, any>> {
    const response = await this.client.get<ApiResponse<Record<string, any>>>(
      `/templates/${id}/schema`
    );
    return response.data.data || {};
  }

  // Execution endpoints
  async executeTemplate(request: ExecutionRequest): Promise<ExecutionResult> {
    const response = await this.client.post<ApiResponse<ExecutionResult>>(
      '/executions',
      request
    );
    if (!response.data.data) {
      throw new Error('Execution failed: No data returned');
    }
    return response.data.data;
  }

  async getExecution(id: string): Promise<ExecutionResult> {
    const response = await this.client.get<ApiResponse<ExecutionResult>>(
      `/executions/${id}`
    );
    if (!response.data.data) {
      throw new Error('Execution not found');
    }
    return response.data.data;
  }

  async getExecutionHistory(userId?: string): Promise<ExecutionHistory[]> {
    const url = userId
      ? `/executions/history?userId=${userId}`
      : '/executions/history';
    const response =
      await this.client.get<ApiResponse<ExecutionHistory[]>>(url);
    return response.data.data || [];
  }

  async cancelExecution(id: string): Promise<void> {
    await this.client.post(`/executions/${id}/cancel`);
  }

  // Figma integration endpoints
  async importFromFigma(
    request: FigmaImportRequest
  ): Promise<FigmaImportResult> {
    const response = await this.client.post<ApiResponse<FigmaImportResult>>(
      '/figma/import',
      request
    );
    if (!response.data.data) {
      throw new Error('Figma import failed: No data returned');
    }
    return response.data.data;
  }

  async getFigmaComponents(fileId: string): Promise<any[]> {
    const response = await this.client.get<ApiResponse<any[]>>(
      `/figma/components/${fileId}`
    );
    return response.data.data || [];
  }

  // WebSocket connection for real-time updates
  createWebSocket(): WebSocket | null {
    try {
      const wsUrl = `${this.baseURL.replace('http', 'ws')}/ws`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WS] Connected to WebSocket server');
      };

      ws.onerror = error => {
        console.error('[WS] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[WS] WebSocket connection closed');
      };

      return ws;
    } catch (error) {
      console.error('[WS] Failed to create WebSocket connection:', error);
      return null;
    }
  }

  // Server-Sent Events for execution progress
  createEventSource(executionId: string): EventSource | null {
    try {
      const token = localStorage.getItem('auth-store');
      let authToken = '';

      if (token) {
        try {
          const authData = JSON.parse(token);
          authToken = authData.state?.token || '';
        } catch (error) {
          console.warn('Failed to parse auth token for SSE:', error);
        }
      }

      const url = `${this.baseURL}/executions/${executionId}/stream?token=${authToken}`;
      const eventSource = new EventSource(url);

      eventSource.onopen = () => {
        console.log(`[SSE] Connected to execution stream: ${executionId}`);
      };

      eventSource.onerror = error => {
        console.error(`[SSE] Error in execution stream: ${executionId}`, error);
      };

      return eventSource;
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      return null;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;

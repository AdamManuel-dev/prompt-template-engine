/**
 * @fileoverview React hook for Figma API operations with caching and rate limiting
 * @lastmodified 2025-08-28T10:30:00Z
 * 
 * Features: File info fetching, URL validation, caching, rate limit handling
 * Main APIs: validateUrl, getFileInfo, getDesignTokens, getPreview
 * Constraints: Figma API rate limits (30req/min), requires backend proxy
 * Patterns: React Query integration, error handling, loading states
 */

import { useState, useCallback } from 'react';
import {
  FigmaFileInfo,
  FigmaUrlInfo,
  DesignToken,
  FigmaPreview,
  FigmaApiError,
  RateLimit
} from '@cursor-prompt/shared';
import { apiClient } from '../services/api-client';

interface UseFigmaApiResult {
  // State
  loading: boolean;
  error: string | null;
  rateLimitInfo: RateLimit | null;
  
  // Actions
  validateUrl: (url: string) => Promise<FigmaUrlInfo>;
  getFileInfo: (fileId: string, forceRefresh?: boolean) => Promise<FigmaFileInfo>;
  getDesignTokens: (fileId: string, forceRefresh?: boolean) => Promise<DesignToken[]>;
  getPreview: (fileId: string, nodeId?: string, options?: PreviewOptions) => Promise<FigmaPreview>;
  clearCache: (fileId?: string) => Promise<void>;
  getCacheStats: () => Promise<any>;
}

interface PreviewOptions {
  scale?: number;
  format?: 'png' | 'jpg' | 'svg';
  useFrameBounds?: boolean;
}

export const useFigmaApi = (): UseFigmaApiResult => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimit | null>(null);

  const handleApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>
  ): Promise<T> => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await apiCall();
      return result;
    } catch (err) {
      let errorMessage = 'An unexpected error occurred';
      
      if (err instanceof FigmaApiError) {
        errorMessage = err.message;
        if (err.rateLimitInfo) {
          setRateLimitInfo(err.rateLimitInfo);
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const validateUrl = useCallback(async (url: string): Promise<FigmaUrlInfo> => {
    return handleApiCall(async () => {
      const response = await apiClient.post<FigmaUrlInfo>('/api/figma/validate-url', {
        url
      });
      return response.data;
    });
  }, [handleApiCall]);

  const getFileInfo = useCallback(async (
    fileId: string, 
    forceRefresh = false
  ): Promise<FigmaFileInfo> => {
    return handleApiCall(async () => {
      const params = new URLSearchParams();
      if (forceRefresh) {
        params.set('refresh', 'true');
      }
      
      const queryString = params.toString();
      const url = `/api/figma/file/${fileId}${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient.get<FigmaFileInfo>(url);
      
      // Update rate limit info if available
      if (response.headers['x-ratelimit-remaining']) {
        setRateLimitInfo({
          remaining: parseInt(response.headers['x-ratelimit-remaining']),
          reset: parseInt(response.headers['x-ratelimit-reset']),
          limit: parseInt(response.headers['x-ratelimit-limit']),
        });
      }
      
      return response.data;
    });
  }, [handleApiCall]);

  const getDesignTokens = useCallback(async (
    fileId: string, 
    forceRefresh = false
  ): Promise<DesignToken[]> => {
    return handleApiCall(async () => {
      const params = new URLSearchParams();
      if (forceRefresh) {
        params.set('refresh', 'true');
      }
      
      const queryString = params.toString();
      const url = `/api/figma/file/${fileId}/tokens${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient.get<DesignToken[]>(url);
      
      // Update rate limit info if available
      if (response.headers['x-ratelimit-remaining']) {
        setRateLimitInfo({
          remaining: parseInt(response.headers['x-ratelimit-remaining']),
          reset: parseInt(response.headers['x-ratelimit-reset']),
          limit: parseInt(response.headers['x-ratelimit-limit']),
        });
      }
      
      return response.data;
    });
  }, [handleApiCall]);

  const getPreview = useCallback(async (
    fileId: string, 
    nodeId?: string,
    options: PreviewOptions = {}
  ): Promise<FigmaPreview> => {
    return handleApiCall(async () => {
      const params = new URLSearchParams();
      
      if (options.scale) {
        params.set('scale', options.scale.toString());
      }
      if (options.format) {
        params.set('format', options.format);
      }
      if (options.useFrameBounds !== undefined) {
        params.set('use_frame_bounds', options.useFrameBounds.toString());
      }
      
      const queryString = params.toString();
      const baseUrl = nodeId 
        ? `/api/figma/file/${fileId}/node/${nodeId}/preview`
        : `/api/figma/file/${fileId}/preview`;
      const url = `${baseUrl}${queryString ? `?${queryString}` : ''}`;
      
      const response = await apiClient.get<FigmaPreview>(url);
      
      // Update rate limit info if available
      if (response.headers['x-ratelimit-remaining']) {
        setRateLimitInfo({
          remaining: parseInt(response.headers['x-ratelimit-remaining']),
          reset: parseInt(response.headers['x-ratelimit-reset']),
          limit: parseInt(response.headers['x-ratelimit-limit']),
        });
      }
      
      return response.data;
    });
  }, [handleApiCall]);

  const clearCache = useCallback(async (fileId?: string): Promise<void> => {
    return handleApiCall(async () => {
      const url = fileId 
        ? `/api/figma/cache/clear/${fileId}`
        : '/api/figma/cache/clear';
      
      await apiClient.delete(url);
    });
  }, [handleApiCall]);

  const getCacheStats = useCallback(async (): Promise<any> => {
    return handleApiCall(async () => {
      const response = await apiClient.get('/api/figma/cache/stats');
      return response.data;
    });
  }, [handleApiCall]);

  return {
    // State
    loading,
    error,
    rateLimitInfo,
    
    // Actions
    validateUrl,
    getFileInfo,
    getDesignTokens,
    getPreview,
    clearCache,
    getCacheStats
  };
};
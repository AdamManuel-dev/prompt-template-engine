/**
 * @fileoverview Hook for template execution with SSE progress tracking
 * @lastmodified 2025-08-28T12:35:00Z
 *
 * Features: Template execution, real-time progress, error handling
 * Main APIs: useTemplateExecution hook with state management
 * Constraints: Requires valid template ID and variables
 * Patterns: Custom hook, SSE integration, state management
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ExecutionRequest,
  ExecutionResult,
  ProgressUpdate,
} from '@cursor-prompt/shared';
import toast from 'react-hot-toast';
import { apiClient } from '../services/api-client';

export interface ExecutionState {
  isExecuting: boolean;
  progress: number;
  stage:
    | 'idle'
    | 'initializing'
    | 'processing'
    | 'rendering'
    | 'completed'
    | 'error';
  message: string;
  result?: ExecutionResult;
  error?: string;
}

export interface UseTemplateExecutionReturn {
  state: ExecutionState;
  executeTemplate: (request: ExecutionRequest) => Promise<void>;
  cancelExecution: () => void;
  clearResult: () => void;
}

export const useTemplateExecution = (): UseTemplateExecutionReturn => {
  const [state, setState] = useState<ExecutionState>({
    isExecuting: false,
    progress: 0,
    stage: 'idle',
    message: '',
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const executionIdRef = useRef<string | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    executionIdRef.current = null;
  }, []);

  // Cancel execution
  const cancelExecution = useCallback(async () => {
    if (executionIdRef.current) {
      try {
        await apiClient.cancelExecution(executionIdRef.current);
        toast.success('Execution cancelled');
      } catch (error) {
        console.error('Failed to cancel execution:', error);
        toast.error('Failed to cancel execution');
      }
    }

    cleanup();
    setState(prev => ({
      ...prev,
      isExecuting: false,
      stage: 'idle',
      message: 'Execution cancelled',
    }));
  }, [cleanup]);

  // Clear result and reset state
  const clearResult = useCallback(() => {
    cleanup();
    setState({
      isExecuting: false,
      progress: 0,
      stage: 'idle',
      message: '',
    });
  }, [cleanup]);

  // Execute template
  const executeTemplate = useCallback(
    async (request: ExecutionRequest) => {
      try {
        // Reset state
        setState({
          isExecuting: true,
          progress: 0,
          stage: 'initializing',
          message: 'Starting execution...',
        });

        // Start execution
        const result = await apiClient.executeTemplate(request);
        executionIdRef.current = result.id;

        // Set up SSE connection for progress updates
        const eventSource = apiClient.createEventSource(result.id);

        if (!eventSource) {
          throw new Error('Failed to establish progress connection');
        }

        eventSourceRef.current = eventSource;

        // Handle progress updates
        eventSource.onmessage = event => {
          try {
            const update: ProgressUpdate = JSON.parse(event.data);

            setState(prev => ({
              ...prev,
              progress: update.progress,
              stage: update.stage,
              message: update.message,
            }));

            // Handle completion
            if (update.stage === 'completed') {
              // Fetch final result
              apiClient
                .getExecution(result.id)
                .then(finalResult => {
                  setState(prev => ({
                    ...prev,
                    isExecuting: false,
                    result: finalResult,
                    stage: 'completed',
                    message: 'Execution completed successfully!',
                    progress: 100,
                  }));

                  cleanup();
                  toast.success('Template executed successfully!');
                })
                .catch(error => {
                  console.error('Failed to fetch final result:', error);
                  setState(prev => ({
                    ...prev,
                    isExecuting: false,
                    stage: 'error',
                    error: 'Failed to fetch execution result',
                    message: 'Error fetching result',
                  }));
                  cleanup();
                  toast.error('Failed to fetch execution result');
                });
            } else if (update.stage === 'error') {
              setState(prev => ({
                ...prev,
                isExecuting: false,
                stage: 'error',
                error: update.message,
                message: update.message,
              }));
              cleanup();
              toast.error(`Execution failed: ${update.message}`);
            }
          } catch (error) {
            console.error('Failed to parse progress update:', error);
          }
        };

        eventSource.onerror = error => {
          console.error('SSE connection error:', error);
          setState(prev => ({
            ...prev,
            isExecuting: false,
            stage: 'error',
            error: 'Connection lost during execution',
            message: 'Connection error',
          }));
          cleanup();
          toast.error('Connection lost during execution');
        };
      } catch (error: any) {
        console.error('Template execution failed:', error);
        const errorMessage =
          error.response?.data?.error?.message ||
          error.message ||
          'Execution failed';

        setState(prev => ({
          ...prev,
          isExecuting: false,
          stage: 'error',
          error: errorMessage,
          message: errorMessage,
        }));

        cleanup();
        toast.error(`Execution failed: ${errorMessage}`);
      }
    },
    [cleanup]
  );

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  return {
    state,
    executeTemplate,
    cancelExecution,
    clearResult,
  };
};

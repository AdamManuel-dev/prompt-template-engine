/**
 * @fileoverview Integration tests for optimization service with PromptWizard client
 * @lastmodified 2025-08-26T16:30:00Z
 *
 * Features: Integration tests for PromptWizard client, service communication, error handling
 * Main APIs: Tests for client-service integration, WebSocket/HTTP communication, caching
 * Constraints: Uses Jest with real HTTP mocks, simulates network conditions
 * Patterns: Integration testing with controlled dependencies, network simulation
 */

import { PromptOptimizationService } from '../../src/services/prompt-optimization.service';
import { PromptWizardClient, createDefaultConfig } from '../../src/integrations/promptwizard/client';
import { OptimizationCacheService } from '../../src/services/optimization-cache.service';
import { TemplateService } from '../../src/services/template.service';
import { CacheService } from '../../src/services/cache.service';
import { Template } from '../../src/types';
import { TestUtils, testEnv } from '../setup/test-setup';
import { 
  OptimizationConfig,
  OptimizedResult,
  QualityScore,
  PromptComparison,
  OptimizationJob
} from '../../src/integrations/promptwizard/types';

// Mock fetch for HTTP client testing
global.fetch = jest.fn();

// Mock WebSocket for real-time communication testing
global.WebSocket = jest.fn().mockImplementation(() => ({
  readyState: 1, // OPEN
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
})) as any;

describe('PromptWizard Integration Tests', () => {
  let client: PromptWizardClient;
  let optimizationService: PromptOptimizationService;
  let mockTemplateService: jest.Mocked<TemplateService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  const createMockTemplate = (): Template => ({
    id: 'integration-template-1',
    name: 'Integration Test Template',
    content: 'You are a helpful assistant. Please help the user with: {{task}}. Context: {{context}}',
    variables: { task: 'string', context: 'string' },
    category: 'assistant',
    version: '1.0.0',
    author: 'test@example.com',
    description: 'A template for integration testing'
  });

  const createMockOptimizedResult = (): OptimizedResult => ({
    jobId: 'job-integration-123',
    originalPrompt: 'You are a helpful assistant. Please help the user with: {{task}}. Context: {{context}}',
    optimizedPrompt: 'Help with: {{task}}. Context: {{context}}',
    status: 'completed',
    progress: 100,
    currentStep: 'completed',
    qualityScore: {
      overall: 0.89,
      breakdown: {
        clarity: 0.92,
        conciseness: 0.85,
        effectiveness: 0.91,
        specificity: 0.88
      },
      confidence: 0.87
    },
    comparison: {
      improvements: {
        'Token reduction': '22%',
        'Clarity improvement': '+0.15',
        'Conciseness gain': '+0.31'
      },
      metrics: {
        originalTokens: 32,
        optimizedTokens: 25,
        readabilityImprovement: 0.18
      }
    },
    metrics: {
      tokenReduction: 22,
      accuracyImprovement: 12.5,
      optimizationTime: 3200,
      apiCallsUsed: 4,
      costSaving: 0.15
    },
    metadata: {
      model: 'gpt-4',
      iterations: 3,
      timestamp: new Date().toISOString()
    }
  });

  beforeEach(() => {
    testEnv.setup({
      mockFileSystem: true,
      mockLogger: true
    });

    fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock.mockClear();

    // Create mock services
    mockTemplateService = {
      getTemplate: jest.fn(),
      listTemplates: jest.fn(),
      validateTemplate: jest.fn()
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      cleanup: jest.fn()
    } as any;

    // Create client with test configuration
    const config = createDefaultConfig({
      serviceUrl: 'http://localhost:8888',
      timeout: 10000,
      retries: 2,
      auth: {
        apiKey: 'test-api-key'
      }
    });

    client = new PromptWizardClient(config);

    // Create optimization service with real dependencies
    optimizationService = new PromptOptimizationService(
      client,
      mockTemplateService,
      mockCacheService
    );
  });

  afterEach(() => {
    testEnv.teardown();
    jest.clearAllMocks();
  });

  describe('PromptWizard Client Integration', () => {
    it('should successfully optimize a prompt via HTTP API', async () => {
      const optimizationConfig: OptimizationConfig = {
        task: 'Help users with general tasks',
        prompt: 'You are a helpful assistant. Please help the user with: {{task}}. Context: {{context}}',
        targetModel: 'gpt-4',
        mutateRefineIterations: 3,
        fewShotCount: 5,
        generateReasoning: true
      };

      const mockResponse = createMockOptimizedResult();
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockResponse
        })
      } as Response);

      const result = await client.optimizePrompt(optimizationConfig);

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8888/api/v1/optimize',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          }),
          body: JSON.stringify(optimizationConfig)
        })
      );
    });

    it('should handle HTTP errors gracefully', async () => {
      const optimizationConfig: OptimizationConfig = {
        task: 'Test task',
        prompt: 'Test prompt',
        targetModel: 'gpt-4',
        mutateRefineIterations: 3,
        fewShotCount: 5,
        generateReasoning: true
      };

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      await expect(client.optimizePrompt(optimizationConfig))
        .rejects
        .toThrow('HTTP 500: Internal Server Error');
    });

    it('should retry failed requests with exponential backoff', async () => {
      const optimizationConfig: OptimizationConfig = {
        task: 'Test task',
        prompt: 'Test prompt',
        targetModel: 'gpt-4',
        mutateRefineIterations: 3,
        fewShotCount: 5,
        generateReasoning: true
      };

      // First two calls fail, third succeeds
      fetchMock
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: createMockOptimizedResult()
          })
        } as Response);

      const result = await client.optimizePrompt(optimizationConfig);

      expect(result).toBeDefined();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should handle request timeout', async () => {
      const optimizationConfig: OptimizationConfig = {
        task: 'Test task',
        prompt: 'Test prompt',
        targetModel: 'gpt-4',
        mutateRefineIterations: 3,
        fewShotCount: 5,
        generateReasoning: true
      };

      // Create a client with very short timeout
      const shortTimeoutClient = new PromptWizardClient(
        createDefaultConfig({ timeout: 100 })
      );

      fetchMock.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200)) // Longer than timeout
      );

      await expect(shortTimeoutClient.optimizePrompt(optimizationConfig))
        .rejects
        .toThrow();
    });

    it('should poll for job completion when optimization is async', async () => {
      const optimizationConfig: OptimizationConfig = {
        task: 'Test task',
        prompt: 'Test prompt',
        targetModel: 'gpt-4',
        mutateRefineIterations: 3,
        fewShotCount: 5,
        generateReasoning: true
      };

      const jobId = 'async-job-123';
      const processingResponse = {
        ...createMockOptimizedResult(),
        jobId,
        status: 'processing',
        progress: 0
      };

      const completedResponse = {
        ...createMockOptimizedResult(),
        jobId,
        status: 'completed',
        progress: 100
      };

      // Initial request returns processing status
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: processingResponse
        })
      } as Response);

      // Status check returns completed
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: completedResponse
        })
      } as Response);

      const result = await client.optimizePrompt(optimizationConfig);

      expect(result).toEqual(completedResponse);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://localhost:8888/api/v1/status/${jobId}`,
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should score prompts correctly', async () => {
      const prompt = 'You are a helpful assistant.';
      const task = 'General assistance';
      const expectedScore: QualityScore = {
        overall: 0.82,
        breakdown: {
          clarity: 0.85,
          conciseness: 0.78,
          effectiveness: 0.84
        },
        confidence: 0.89
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: expectedScore
        })
      } as Response);

      const result = await client.scorePrompt(prompt, task);

      expect(result).toEqual(expectedScore);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8888/api/v1/score',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ prompt, task })
        })
      );
    });

    it('should compare prompts correctly', async () => {
      const original = 'You are a helpful assistant. Please help the user.';
      const optimized = 'Help the user as requested.';
      const task = 'General assistance';

      const expectedComparison: PromptComparison = {
        improvements: {
          'Token reduction': '45%',
          'Clarity': 'Maintained',
          'Conciseness': '+0.67'
        },
        metrics: {
          originalTokens: 11,
          optimizedTokens: 6,
          readabilityImprovement: 0.12
        }
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: expectedComparison
        })
      } as Response);

      const result = await client.comparePrompts(original, optimized, task);

      expect(result).toEqual(expectedComparison);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8888/api/v1/compare',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ original, optimized, task })
        })
      );
    });

    it('should perform health checks', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { healthy: true, version: '1.0.0' }
        })
      } as Response);

      const result = await client.healthCheck();

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8888/api/v1/health',
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('End-to-End Service Integration', () => {
    it('should optimize template through complete service stack', async () => {
      const template = createMockTemplate();
      const mockOptimizedResult = createMockOptimizedResult();

      // Mock successful HTTP response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockOptimizedResult
        })
      } as Response);

      const result = await optimizationService.optimizeTemplate({
        templateId: template.id,
        template,
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: {
          priority: 'high',
          skipCache: true,
          timeoutMs: 30000
        }
      });

      expect(result).toBeDefined();
      expect(result.templateId).toBe(template.id);
      expect(result.optimizedTemplate.content).toBeDefined();
      expect(result.metrics.tokenReduction).toBeGreaterThan(0);
    });

    it('should handle service communication failures', async () => {
      const template = createMockTemplate();

      // Mock network failure
      fetchMock.mockRejectedValue(new Error('Service unavailable'));

      await expect(optimizationService.optimizeTemplate({
        templateId: template.id,
        template,
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: {
          priority: 'high',
          skipCache: true,
          timeoutMs: 5000
        }
      })).rejects.toThrow();
    });

    it('should cache optimization results correctly', async () => {
      const template = createMockTemplate();
      const mockOptimizedResult = createMockOptimizedResult();

      // First call - cache miss, fetch from service
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockOptimizedResult
        })
      } as Response);

      const firstResult = await optimizationService.optimizeTemplate({
        templateId: template.id,
        template,
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: {
          priority: 'normal',
          skipCache: false,
          timeoutMs: 30000
        }
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const secondResult = await optimizationService.optimizeTemplate({
        templateId: template.id,
        template,
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: {
          priority: 'normal',
          skipCache: false,
          timeoutMs: 30000
        }
      });

      // Should not make additional HTTP calls due to caching
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(secondResult.optimizedTemplate.content).toBeDefined();
    });

    it('should handle batch optimization with mixed results', async () => {
      const templates = [
        { id: 'template-1', template: { ...createMockTemplate(), id: 'template-1' } },
        { id: 'template-2', template: { ...createMockTemplate(), id: 'template-2' } },
        { id: 'template-3', template: { ...createMockTemplate(), id: 'template-3' } }
      ];

      // Mock responses: success, failure, success
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { ...createMockOptimizedResult(), jobId: 'job-1' }
          })
        } as Response)
        .mockRejectedValueOnce(new Error('Service error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { ...createMockOptimizedResult(), jobId: 'job-3' }
          })
        } as Response);

      const result = await optimizationService.batchOptimize({
        templates,
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3
        },
        options: {
          priority: 'normal',
          timeoutMs: 30000
        }
      });

      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].templateId).toBe('template-2');
    });

    it('should emit events during optimization lifecycle', async () => {
      const template = createMockTemplate();
      const mockOptimizedResult = createMockOptimizedResult();
      const eventSpy = jest.spyOn(optimizationService, 'emit');

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockOptimizedResult
        })
      } as Response);

      await optimizationService.optimizeTemplate({
        templateId: template.id,
        template,
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: {
          priority: 'high',
          skipCache: true,
          timeoutMs: 30000
        }
      });

      // Check that events were emitted
      expect(eventSpy).toHaveBeenCalledWith('optimization:queued', expect.any(Object));
    });
  });

  describe('Cache Service Integration', () => {
    it('should integrate with optimization cache service', async () => {
      const template = createMockTemplate();
      const cacheKey = 'test-cache-key';
      const cachedResult = {
        optimizedPrompt: 'Cached optimized prompt',
        qualityScore: { overall: 0.85, breakdown: {} },
        comparison: { improvements: {} },
        metrics: { tokenReduction: 10, accuracyImprovement: 5, apiCallsUsed: 1 }
      };

      // Mock cache service methods
      const optimizationCacheService = new OptimizationCacheService();
      jest.spyOn(optimizationCacheService, 'generateCacheKey').mockReturnValue(cacheKey);
      jest.spyOn(optimizationCacheService, 'get').mockResolvedValue(cachedResult);
      jest.spyOn(optimizationCacheService, 'set').mockResolvedValue();

      const result = await optimizationService.optimizeTemplate({
        templateId: template.id,
        template,
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: {
          priority: 'normal',
          skipCache: false,
          timeoutMs: 30000
        }
      });

      // Should use cached result
      expect(result.optimizedTemplate.content).toBe(cachedResult.optimizedPrompt);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should handle cache service errors gracefully', async () => {
      const template = createMockTemplate();
      const mockOptimizedResult = createMockOptimizedResult();

      // Mock cache service to throw error
      jest.spyOn(OptimizationCacheService.prototype, 'get')
        .mockRejectedValue(new Error('Cache service error'));

      // Mock successful HTTP response as fallback
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockOptimizedResult
        })
      } as Response);

      const result = await optimizationService.optimizeTemplate({
        templateId: template.id,
        template,
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: {
          priority: 'normal',
          skipCache: false,
          timeoutMs: 30000
        }
      });

      // Should fallback to HTTP service when cache fails
      expect(result).toBeDefined();
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle partial service failures gracefully', async () => {
      const template = createMockTemplate();

      // Mock service returning error response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: false,
          error: {
            code: 'OPTIMIZATION_FAILED',
            message: 'Unable to optimize prompt'
          }
        })
      } as Response);

      await expect(optimizationService.optimizeTemplate({
        templateId: template.id,
        template,
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: {
          priority: 'normal',
          skipCache: true,
          timeoutMs: 30000
        }
      })).rejects.toThrow('Unable to optimize prompt');
    });

    it('should handle service rate limiting', async () => {
      const template = createMockTemplate();

      // Mock rate limit response
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as Response);

      await expect(optimizationService.optimizeTemplate({
        templateId: template.id,
        template,
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: {
          priority: 'normal',
          skipCache: true,
          timeoutMs: 30000
        }
      })).rejects.toThrow('HTTP 429: Too Many Requests');
    });

    it('should handle malformed service responses', async () => {
      const template = createMockTemplate();

      // Mock malformed JSON response
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      } as Response);

      await expect(optimizationService.optimizeTemplate({
        templateId: template.id,
        template,
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: {
          priority: 'normal',
          skipCache: true,
          timeoutMs: 30000
        }
      })).rejects.toThrow();
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track optimization metrics', async () => {
      const template = createMockTemplate();
      const mockOptimizedResult = createMockOptimizedResult();

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockOptimizedResult
        })
      } as Response);

      const { result, duration } = await TestUtils.measureTime(async () => {
        return await optimizationService.optimizeTemplate({
          templateId: template.id,
          template,
          config: {
            targetModel: 'gpt-4',
            mutateRefineIterations: 3,
            fewShotCount: 5,
            generateReasoning: true
          },
          options: {
            priority: 'normal',
            skipCache: true,
            timeoutMs: 30000
          }
        });
      });

      expect(result.metrics.optimizationTime).toBeGreaterThan(0);
      expect(duration).toBeGreaterThan(0);
    });

    it('should provide service health status', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { healthy: true, version: '1.0.0' }
        })
      } as Response);

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});
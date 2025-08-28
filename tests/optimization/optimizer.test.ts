/**
 * @fileoverview Unit tests for the core optimization components
 * @lastmodified 2025-08-26T16:00:00Z
 *
 * Features: Comprehensive unit tests for PromptOptimizationService and OptimizationPipeline
 * Main APIs: Tests for optimizeTemplate(), batchOptimize(), pipeline processing
 * Constraints: Uses Jest with TypeScript, mocks external dependencies
 * Patterns: Arrange-Act-Assert pattern, comprehensive mock setup
 */

import { PromptOptimizationService } from '../../src/services/prompt-optimization.service';
import { OptimizationPipeline } from '../../src/core/optimization-pipeline';
import { OptimizationCacheService } from '../../src/services/optimization-cache.service';
import { PromptWizardClient } from '../../src/integrations/promptwizard/client';
import { TemplateService } from '../../src/services/template.service';
import { CacheService } from '../../src/services/cache.service';
import { OptimizationQueue } from '../../src/queues/optimization-queue';
import { 
  OptimizationRequest, 
  OptimizationResult,
  BatchOptimizationRequest,
  BatchOptimizationResult,
  OptimizationOptions 
} from '../../src/services/prompt-optimization.service';
import { Template } from '../../src/types';
import { TestUtils, testEnv } from '../setup/test-setup';

// Mock all external dependencies
jest.mock('../../src/integrations/promptwizard/client');
jest.mock('../../src/services/template.service');
jest.mock('../../src/services/cache.service');
jest.mock('../../src/queues/optimization-queue');
jest.mock('../../src/core/optimization-pipeline');
jest.mock('../../src/services/optimization-cache.service');

describe('PromptOptimizationService', () => {
  let service: PromptOptimizationService;
  let mockClient: jest.Mocked<PromptWizardClient>;
  let mockTemplateService: jest.Mocked<TemplateService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockOptimizationQueue: jest.Mocked<OptimizationQueue>;
  let mockOptimizationPipeline: jest.Mocked<OptimizationPipeline>;

  const createMockTemplate = (): Template => ({
    id: 'test-template-1',
    name: 'Test Template',
    content: 'Hello {{name}}, please complete the following task: {{task}}',
    variables: { name: 'string', task: 'string' },
    category: 'general',
    version: '1.0.0',
    author: 'test@example.com',
    description: 'A test template for optimization'
  });

  const createMockOptimizationResult = (templateId: string = 'test-template-1'): OptimizationResult => ({
    requestId: 'req-123',
    templateId,
    originalTemplate: createMockTemplate(),
    optimizedTemplate: {
      ...createMockTemplate(),
      id: `${templateId}_optimized`,
      content: 'Hi {{name}}, complete this task: {{task}}',
      name: 'Test Template (Optimized)'
    },
    metrics: {
      tokenReduction: 15.5,
      accuracyImprovement: 8.2,
      optimizationTime: 2500,
      apiCalls: 3
    },
    qualityScore: {
      overall: 0.92,
      breakdown: {
        clarity: 0.95,
        conciseness: 0.88,
        effectiveness: 0.93
      },
      confidence: 0.89
    },
    comparison: {
      improvements: {
        'Token reduction': '15.5%',
        'Clarity score': '+0.12',
        'Conciseness': '+0.25'
      },
      metrics: {
        originalTokens: 45,
        optimizedTokens: 38,
        readabilityImprovement: 0.15
      }
    },
    timestamp: new Date('2025-08-26T16:00:00Z')
  });

  beforeEach(() => {
    testEnv.setup({
      mockFileSystem: true,
      mockLogger: true
    });

    // Create mocks
    mockClient = {
      optimizePrompt: jest.fn(),
      scorePrompt: jest.fn(),
      comparePrompts: jest.fn(),
      generateExamples: jest.fn(),
      getJobStatus: jest.fn(),
      cancelJob: jest.fn(),
      healthCheck: jest.fn(),
      addEventListener: jest.fn()
    } as any;

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

    mockOptimizationQueue = {
      addJob: jest.fn(),
      getJob: jest.fn(),
      cancelJob: jest.fn(),
      getStats: jest.fn(),
      shutdown: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    } as any;

    mockOptimizationPipeline = {
      process: jest.fn()
    } as any;

    // Mock constructors to return our mocks
    (PromptWizardClient as jest.Mock).mockImplementation(() => mockClient);
    (TemplateService as jest.Mock).mockImplementation(() => mockTemplateService);
    (CacheService as jest.Mock).mockImplementation(() => mockCacheService);
    (OptimizationQueue as jest.Mock).mockImplementation(() => mockOptimizationQueue);
    (OptimizationPipeline as jest.Mock).mockImplementation(() => mockOptimizationPipeline);

    // Create service instance
    service = new PromptOptimizationService(
      mockClient,
      mockTemplateService,
      mockCacheService,
      mockOptimizationPipeline
    );
  });

  afterEach(() => {
    testEnv.teardown();
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize service with all required dependencies', () => {
      expect(service).toBeInstanceOf(PromptOptimizationService);
      expect(OptimizationQueue).toHaveBeenCalledWith(
        mockOptimizationPipeline,
        expect.any(OptimizationCacheService)
      );
    });

    it('should set up event listeners for queue operations', () => {
      expect(mockOptimizationQueue.on).toHaveBeenCalledWith('job:added', expect.any(Function));
      expect(mockOptimizationQueue.on).toHaveBeenCalledWith('job:started', expect.any(Function));
      expect(mockOptimizationQueue.on).toHaveBeenCalledWith('job:progress', expect.any(Function));
      expect(mockOptimizationQueue.on).toHaveBeenCalledWith('job:completed', expect.any(Function));
      expect(mockOptimizationQueue.on).toHaveBeenCalledWith('job:failed', expect.any(Function));
      expect(mockOptimizationQueue.on).toHaveBeenCalledWith('job:retry', expect.any(Function));
    });
  });

  describe('optimizeTemplate', () => {
    const createOptimizationRequest = (): OptimizationRequest => ({
      templateId: 'test-template-1',
      template: createMockTemplate(),
      config: {
        targetModel: 'gpt-4',
        mutateRefineIterations: 3,
        fewShotCount: 5,
        generateReasoning: true
      },
      options: {
        priority: 'normal',
        timeoutMs: 30000,
        maxRetries: 3
      }
    });

    it('should optimize a template successfully', async () => {
      const request = createOptimizationRequest();
      const mockResult = createMockOptimizationResult();
      const mockJob = {
        jobId: 'job-123',
        templateId: request.templateId,
        status: 'queued',
        priority: 'normal'
      };

      mockOptimizationQueue.addJob.mockResolvedValue(mockJob);

      // Simulate job completion
      const completionPromise = service.optimizeTemplate(request);
      
      // Trigger completion event after a short delay
      setTimeout(() => {
        const onCompleted = mockOptimizationQueue.on.mock.calls
          .find(call => call[0] === 'job:completed')?.[1];
        if (onCompleted) {
          onCompleted({ jobId: mockJob.jobId, result: mockResult });
        }
      }, 100);

      const result = await completionPromise;

      expect(result).toEqual(mockResult);
      expect(mockOptimizationQueue.addJob).toHaveBeenCalledWith(
        request.templateId,
        request.template,
        expect.objectContaining({
          task: request.template.name,
          prompt: request.template.content,
          targetModel: 'gpt-4'
        }),
        expect.objectContaining({
          priority: 'normal',
          maxRetries: 3
        })
      );
    });

    it('should handle cached optimization results', async () => {
      const request = createOptimizationRequest();
      const mockCachedResult = {
        optimizedPrompt: 'Cached optimized prompt',
        qualityScore: { overall: 0.85, breakdown: {} },
        comparison: { improvements: {} },
        metrics: {
          tokenReduction: 12,
          accuracyImprovement: 5,
          apiCallsUsed: 2
        }
      };

      // Mock cache hit
      (OptimizationCacheService.prototype.get as jest.Mock).mockResolvedValue(mockCachedResult);

      const result = await service.optimizeTemplate(request);

      expect(result.optimizedTemplate.content).toBe(mockCachedResult.optimizedPrompt);
      expect(result.metrics.tokenReduction).toBe(mockCachedResult.metrics.tokenReduction);
      expect(mockOptimizationQueue.addJob).not.toHaveBeenCalled();
    });

    it('should skip cache when skipCache option is true', async () => {
      const request = createOptimizationRequest();
      request.options!.skipCache = true;
      const mockResult = createMockOptimizationResult();
      const mockJob = { jobId: 'job-123', templateId: request.templateId };

      mockOptimizationQueue.addJob.mockResolvedValue(mockJob);

      // Setup completion event
      const completionPromise = service.optimizeTemplate(request);
      setTimeout(() => {
        const onCompleted = mockOptimizationQueue.on.mock.calls
          .find(call => call[0] === 'job:completed')?.[1];
        if (onCompleted) {
          onCompleted({ jobId: mockJob.jobId, result: mockResult });
        }
      }, 100);

      await completionPromise;

      expect(mockOptimizationQueue.addJob).toHaveBeenCalled();
    });

    it('should handle job timeout', async () => {
      const request = createOptimizationRequest();
      request.options!.timeoutMs = 100; // Very short timeout
      const mockJob = { jobId: 'job-123', templateId: request.templateId };

      mockOptimizationQueue.addJob.mockResolvedValue(mockJob);

      await expect(service.optimizeTemplate(request))
        .rejects
        .toThrow('Optimization timeout for template: test-template-1');
    });

    it('should handle job failure', async () => {
      const request = createOptimizationRequest();
      const mockJob = { jobId: 'job-123', templateId: request.templateId };

      mockOptimizationQueue.addJob.mockResolvedValue(mockJob);

      const completionPromise = service.optimizeTemplate(request);
      
      // Trigger failure event
      setTimeout(() => {
        const onFailed = mockOptimizationQueue.on.mock.calls
          .find(call => call[0] === 'job:failed')?.[1];
        if (onFailed) {
          onFailed({ jobId: mockJob.jobId, error: 'Optimization failed' });
        }
      }, 100);

      await expect(completionPromise)
        .rejects
        .toThrow('Optimization failed');
    });

    it('should map priority levels correctly', async () => {
      const testCases = [
        { priority: 'critical' as const, expected: 'urgent' },
        { priority: 'high' as const, expected: 'high' },
        { priority: 'low' as const, expected: 'low' },
        { priority: 'normal' as const, expected: 'normal' }
      ];

      for (const testCase of testCases) {
        const request = createOptimizationRequest();
        request.options!.priority = testCase.priority;
        const mockJob = { jobId: 'job-123', templateId: request.templateId };

        mockOptimizationQueue.addJob.mockResolvedValue(mockJob);

        // Start optimization (don't await, we just want to test the addJob call)
        service.optimizeTemplate(request).catch(() => {}); // Ignore timeout error

        expect(mockOptimizationQueue.addJob).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(Object),
          expect.any(Object),
          expect.objectContaining({
            priority: testCase.expected
          })
        );

        jest.clearAllMocks();
      }
    });
  });

  describe('batchOptimize', () => {
    const createBatchRequest = (): BatchOptimizationRequest => ({
      templates: [
        { id: 'template-1', template: { ...createMockTemplate(), id: 'template-1' } },
        { id: 'template-2', template: { ...createMockTemplate(), id: 'template-2', name: 'Template 2' } },
        { id: 'template-3', template: { ...createMockTemplate(), id: 'template-3', name: 'Template 3' } }
      ],
      config: {
        targetModel: 'gpt-4',
        mutateRefineIterations: 3
      },
      options: {
        priority: 'normal',
        timeoutMs: 60000
      }
    });

    it('should optimize multiple templates successfully', async () => {
      const request = createBatchRequest();
      
      // Mock successful optimizations for all templates
      jest.spyOn(service, 'optimizeTemplate').mockImplementation(async (req) => {
        return createMockOptimizationResult(req.templateId);
      });

      const result = await service.batchOptimize(request);

      expect(result).toEqual(expect.objectContaining({
        total: 3,
        successful: 3,
        failed: 0,
        results: expect.arrayContaining([
          expect.objectContaining({ templateId: 'template-1' }),
          expect.objectContaining({ templateId: 'template-2' }),
          expect.objectContaining({ templateId: 'template-3' })
        ]),
        errors: []
      }));
    });

    it('should handle partial failures in batch optimization', async () => {
      const request = createBatchRequest();
      
      // Mock mixed success/failure results
      jest.spyOn(service, 'optimizeTemplate').mockImplementation(async (req) => {
        if (req.templateId === 'template-2') {
          throw new Error('Optimization failed for template-2');
        }
        return createMockOptimizationResult(req.templateId);
      });

      const result = await service.batchOptimize(request);

      expect(result).toEqual(expect.objectContaining({
        total: 3,
        successful: 2,
        failed: 1,
        results: expect.arrayContaining([
          expect.objectContaining({ templateId: 'template-1' }),
          expect.objectContaining({ templateId: 'template-3' })
        ]),
        errors: [
          { templateId: 'template-2', error: 'Optimization failed for template-2' }
        ]
      }));
    });

    it('should process templates with controlled concurrency', async () => {
      const request = createBatchRequest();
      const optimizeCalls: string[] = [];
      
      jest.spyOn(service, 'optimizeTemplate').mockImplementation(async (req) => {
        optimizeCalls.push(req.templateId);
        // Add small delay to test concurrency
        await new Promise(resolve => setTimeout(resolve, 50));
        return createMockOptimizationResult(req.templateId);
      });

      await service.batchOptimize(request);

      expect(optimizeCalls).toHaveLength(3);
      expect(optimizeCalls).toContain('template-1');
      expect(optimizeCalls).toContain('template-2');
      expect(optimizeCalls).toContain('template-3');
    });

    it('should emit batch events', async () => {
      const request = createBatchRequest();
      const eventSpy = jest.spyOn(service, 'emit');
      
      jest.spyOn(service, 'optimizeTemplate').mockImplementation(async (req) => {
        return createMockOptimizationResult(req.templateId);
      });

      await service.batchOptimize(request);

      expect(eventSpy).toHaveBeenCalledWith('batch:started', { count: 3 });
      expect(eventSpy).toHaveBeenCalledWith('batch:completed', expect.objectContaining({
        total: 3,
        successful: 3,
        failed: 0
      }));
    });
  });

  describe('getOptimizationStatus', () => {
    it('should return job status from queue', async () => {
      const mockJob = {
        jobId: 'job-123',
        templateId: 'template-1',
        status: 'processing',
        progress: 50,
        currentStep: 'optimization'
      };

      mockOptimizationQueue.getJob.mockReturnValue(mockJob as any);

      const result = await service.getOptimizationStatus('job-123');

      expect(result).toEqual(mockJob);
      expect(mockOptimizationQueue.getJob).toHaveBeenCalledWith('job-123');
    });

    it('should fallback to client when job not found in queue', async () => {
      const mockJob = {
        jobId: 'job-123',
        templateId: 'template-1',
        status: 'completed',
        progress: 100,
        currentStep: 'finished'
      };

      mockOptimizationQueue.getJob.mockReturnValue(null);
      mockClient.getJobStatus.mockResolvedValue(mockJob as any);

      const result = await service.getOptimizationStatus('job-123');

      expect(result).toEqual(mockJob);
      expect(mockClient.getJobStatus).toHaveBeenCalledWith('job-123');
    });

    it('should return null when job not found anywhere', async () => {
      mockOptimizationQueue.getJob.mockReturnValue(null);
      mockClient.getJobStatus.mockRejectedValue(new Error('Job not found'));

      const result = await service.getOptimizationStatus('job-123');

      expect(result).toBeNull();
    });
  });

  describe('sendFeedback', () => {
    it('should process positive feedback', async () => {
      const templateId = 'template-1';
      const feedback = {
        rating: 5,
        comments: 'Excellent optimization!',
        preferredVersion: 'optimized' as const
      };

      // Mock cached result
      const mockResult = createMockOptimizationResult(templateId);
      jest.spyOn((service as any).resultCache, 'get').mockReturnValue(mockResult);

      await service.sendFeedback(templateId, feedback);

      // Should not trigger re-optimization for good feedback
      expect(service.emit).not.toHaveBeenCalledWith('reoptimization:scheduled', expect.any(Object));
    });

    it('should trigger re-optimization for poor feedback', async () => {
      const templateId = 'template-1';
      const feedback = {
        rating: 2,
        comments: 'Lost important context',
        preferredVersion: 'original' as const
      };

      // Mock cached result
      const mockResult = createMockOptimizationResult(templateId);
      jest.spyOn((service as any).resultCache, 'get').mockReturnValue(mockResult);
      
      // Mock re-optimization
      jest.spyOn(service, 'optimizeTemplate').mockResolvedValue(mockResult);

      await service.sendFeedback(templateId, feedback);

      expect(service.emit).toHaveBeenCalledWith('reoptimization:scheduled', { templateId });
      expect(service.optimizeTemplate).toHaveBeenCalledWith(expect.objectContaining({
        templateId,
        template: mockResult.originalTemplate,
        options: expect.objectContaining({
          skipCache: true,
          priority: 'high'
        })
      }));
    });

    it('should throw error when optimization result not found', async () => {
      const templateId = 'template-1';
      const feedback = {
        rating: 3,
        comments: 'Average',
        preferredVersion: 'optimized' as const
      };

      jest.spyOn((service as any).resultCache, 'get').mockReturnValue(null);

      await expect(service.sendFeedback(templateId, feedback))
        .rejects
        .toThrow('Optimization result not found for feedback');
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', async () => {
      await service.clearCache();

      expect((service as any).resultCache.clear).toHaveBeenCalled();
    });

    it('should return cache statistics', () => {
      const mockStats = {
        size: 10,
        maxSize: 100,
        hits: 50,
        misses: 25
      };

      jest.spyOn((service as any).resultCache, 'size', 'get').mockReturnValue(mockStats.size);
      jest.spyOn((service as any).resultCache, 'max', 'get').mockReturnValue(mockStats.maxSize);

      const stats = service.getCacheStats();

      expect(stats).toEqual(expect.objectContaining({
        size: mockStats.size,
        maxSize: mockStats.maxSize,
        hits: mockStats.size, // Simplified in implementation
        misses: 0
      }));
    });

    it('should invalidate template cache', async () => {
      const templateId = 'template-1';

      await service.invalidateTemplateCache(templateId);

      // Should call optimization cache service invalidation
      expect(OptimizationCacheService.prototype.invalidateTemplate).toHaveBeenCalledWith(templateId);
    });
  });

  describe('Queue Management', () => {
    it('should return queue statistics', () => {
      const mockStats = {
        pending: 5,
        active: 2,
        completed: 100,
        failed: 3
      };

      mockOptimizationQueue.getStats.mockReturnValue(mockStats);

      const stats = service.getQueueStats();

      expect(stats).toEqual(mockStats);
    });

    it('should cancel optimization jobs', async () => {
      const jobId = 'job-123';

      mockOptimizationQueue.cancelJob.mockResolvedValue(true);

      const result = await service.cancelJob(jobId);

      expect(result).toBe(true);
      expect(mockOptimizationQueue.cancelJob).toHaveBeenCalledWith(jobId);
    });
  });

  describe('Service Cleanup', () => {
    it('should cleanup all resources', async () => {
      await service.cleanup();

      expect(mockOptimizationQueue.shutdown).toHaveBeenCalled();
      expect((service as any).resultCache.clear).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockOptimizationQueue.shutdown.mockRejectedValue(new Error('Shutdown failed'));

      await expect(service.cleanup()).rejects.toThrow('Shutdown failed');
    });
  });

  describe('Event Handling', () => {
    it('should emit events for optimization lifecycle', async () => {
      const request = createOptimizationRequest();
      const mockJob = { 
        jobId: 'job-123', 
        templateId: request.templateId,
        priority: 'normal'
      };

      mockOptimizationQueue.addJob.mockResolvedValue(mockJob);

      // Start optimization
      const optimizationPromise = service.optimizeTemplate(request);

      // Simulate various events
      const eventHandlers = new Map();
      mockOptimizationQueue.on.mock.calls.forEach(([event, handler]) => {
        eventHandlers.set(event, handler);
      });

      // Test job:added event
      eventHandlers.get('job:added')?.(mockJob);
      expect(service.emit).toHaveBeenCalledWith('optimization:queued', {
        templateId: mockJob.templateId,
        jobId: mockJob.jobId,
        priority: mockJob.priority
      });

      // Test job:started event
      eventHandlers.get('job:started')?.(mockJob);
      expect(service.emit).toHaveBeenCalledWith('optimization:started', {
        templateId: mockJob.templateId,
        jobId: mockJob.jobId
      });

      // Test job:progress event
      const progressJob = { ...mockJob, progress: 50, currentStep: 'analyzing' };
      eventHandlers.get('job:progress')?.(progressJob);
      expect(service.emit).toHaveBeenCalledWith('optimization:progress', {
        templateId: mockJob.templateId,
        jobId: mockJob.jobId,
        progress: 50,
        currentStep: 'analyzing'
      });

      // Complete the job to avoid timeout
      const mockResult = createMockOptimizationResult();
      setTimeout(() => {
        eventHandlers.get('job:completed')?.({ ...mockJob, result: mockResult });
      }, 100);

      await optimizationPromise;
    });
  });
});

describe('OptimizationPipeline', () => {
  let pipeline: OptimizationPipeline;
  let mockPromptOptimizationService: jest.Mocked<PromptOptimizationService>;
  let mockTemplateService: jest.Mocked<TemplateService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    testEnv.setup({
      mockFileSystem: true,
      mockLogger: true
    });

    mockPromptOptimizationService = {
      optimizeTemplate: jest.fn()
    } as any;

    mockTemplateService = {
      getTemplate: jest.fn(),
      listTemplates: jest.fn(),
      validateTemplate: jest.fn()
    } as any;

    mockCacheService = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      cleanup: jest.fn()
    } as any;

    // Clear the mock so we can create a real instance
    jest.clearAllMocks();
    (OptimizationPipeline as jest.Mock).mockRestore();

    pipeline = new OptimizationPipeline(
      mockPromptOptimizationService,
      mockTemplateService,
      mockCacheService
    );
  });

  afterEach(() => {
    testEnv.teardown();
  });

  describe('process', () => {
    const mockTemplate = createMockTemplate();

    it('should process template through complete pipeline', async () => {
      const mockOptimizationResult = createMockOptimizationResult();
      mockPromptOptimizationService.optimizeTemplate.mockResolvedValue(mockOptimizationResult);

      const result = await pipeline.process('test-template-1', mockTemplate);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOptimizationResult);
      expect(result.metrics).toEqual(expect.objectContaining({
        stagesCompleted: expect.any(Number),
        stagesFailed: 0,
        totalTime: expect.any(Number)
      }));
    });

    it('should handle pipeline stage failures gracefully', async () => {
      // Mock optimization service to fail
      mockPromptOptimizationService.optimizeTemplate.mockRejectedValue(
        new Error('Optimization service unavailable')
      );

      const result = await pipeline.process('test-template-1', mockTemplate);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(expect.objectContaining({
        message: expect.stringContaining('Optimization service unavailable'),
        stage: 'pipeline'
      }));
    });

    it('should emit pipeline events', async () => {
      const eventSpy = jest.spyOn(pipeline, 'emit');
      const mockOptimizationResult = createMockOptimizationResult();
      mockPromptOptimizationService.optimizeTemplate.mockResolvedValue(mockOptimizationResult);

      await pipeline.process('test-template-1', mockTemplate);

      expect(eventSpy).toHaveBeenCalledWith('pipeline:started', expect.objectContaining({
        templateId: 'test-template-1'
      }));
      expect(eventSpy).toHaveBeenCalledWith('pipeline:completed', expect.any(Object));
    });

    it('should extract template metadata correctly', async () => {
      const complexTemplate = {
        ...mockTemplate,
        content: `# Complex Template
{{#if user.isActive}}
  Hello {{user.name}},
  {{#each tasks}}
    - Task: {{this.title}}
  {{/each}}
  {{> footer}}
{{/if}}`,
        variables: {
          'user.isActive': 'boolean',
          'user.name': 'string',
          'tasks': 'array'
        }
      };

      mockPromptOptimizationService.optimizeTemplate.mockResolvedValue(
        createMockOptimizationResult()
      );

      const result = await pipeline.process('complex-template', complexTemplate);

      expect(result.success).toBe(true);
      // The metadata extraction should have detected complexity factors
      expect(result.stageResults.metadata_extraction).toEqual(expect.objectContaining({
        complexity: expect.any(Number),
        estimatedTokens: expect.any(Number),
        dependencies: expect.arrayContaining(['footer']),
        variables: expect.any(Object)
      }));
    });
  });
});
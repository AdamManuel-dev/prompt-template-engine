/**
 * @fileoverview End-to-end workflow tests for the optimization system
 * @lastmodified 2025-08-26T17:00:00Z
 *
 * Features: Complete optimization workflow testing from CLI to service integration
 * Main APIs: Tests for optimize command, template processing, result validation
 * Constraints: Uses Jest with real service mocks, simulates user workflows
 * Patterns: E2E testing with workflow simulation, comprehensive scenarios
 */

import { PromptOptimizationService } from '../../src/services/prompt-optimization.service';
import { OptimizationPipeline } from '../../src/core/optimization-pipeline';
import { PromptWizardClient } from '../../src/integrations/promptwizard/client';
import { TemplateService } from '../../src/services/template.service';
import { CacheService } from '../../src/services/cache.service';
import { OptimizeCommand } from '../../src/commands/optimize';
import { Template } from '../../src/types';
import { TestUtils, testEnv } from '../setup/test-setup';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock file system operations
jest.mock('fs/promises');
const fsMock = fs as jest.Mocked<typeof fs>;

// Mock CLI dependencies
jest.mock('../../src/services/prompt-optimization.service');
jest.mock('../../src/integrations/promptwizard/client');

describe('End-to-End Optimization Workflows', () => {
  let optimizeCommand: OptimizeCommand;
  let mockOptimizationService: jest.Mocked<PromptOptimizationService>;
  let mockClient: jest.Mocked<PromptWizardClient>;
  let mockTemplateService: jest.Mocked<TemplateService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let testWorkspaceDir: string;

  const createTestTemplate = (id: string, name: string, content: string): Template => ({
    id,
    name,
    content,
    variables: { task: 'string', context: 'string', user: 'string' },
    category: 'general',
    version: '1.0.0',
    author: 'test@example.com',
    description: `Test template ${id}`
  });

  const createComplexTemplate = (): Template => ({
    id: 'complex-template',
    name: 'Complex Assistant Template',
    content: `# Professional Assistant Prompt

You are {{assistant_type}}, a highly skilled professional assistant with expertise in {{domain}}.

## Your Role and Responsibilities:
{{#if is_technical}}
- Provide technical guidance and solutions
- Explain complex concepts clearly
- Offer code examples when relevant
{{/if}}

{{#unless is_technical}}
- Provide general assistance and support
- Help with planning and organization
- Offer creative solutions
{{/unless}}

## Context:
User's current situation: {{user_context}}
Task priority: {{priority_level}}
Available time: {{time_constraint}}

{{#each required_skills}}
- Skill: {{this.name}} (Level: {{this.level}})
{{/each}}

## Instructions:
1. Always greet the user professionally
2. Understand their specific needs
3. Provide actionable solutions
4. Follow up to ensure satisfaction

Please help the user with: {{user_request}}

{{#if include_examples}}
## Examples:
{{> examples_partial}}
{{/if}}`,
    variables: {
      assistant_type: 'string',
      domain: 'string',
      is_technical: 'boolean',
      user_context: 'string',
      priority_level: 'string',
      time_constraint: 'string',
      required_skills: 'array',
      user_request: 'string',
      include_examples: 'boolean'
    },
    category: 'assistant',
    version: '2.1.0',
    author: 'advanced@example.com',
    description: 'Complex template with conditionals, loops, and partials'
  });

  beforeEach(async () => {
    testEnv.setup({
      mockFileSystem: true,
      mockLogger: true
    });

    testWorkspaceDir = '/tmp/test-workspace';

    // Create mock services
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
      validateTemplate: jest.fn(),
      loadTemplate: jest.fn(),
      saveTemplate: jest.fn()
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      cleanup: jest.fn()
    } as any;

    mockOptimizationService = {
      optimizeTemplate: jest.fn(),
      batchOptimize: jest.fn(),
      getOptimizationStatus: jest.fn(),
      sendFeedback: jest.fn(),
      clearCache: jest.fn(),
      getCacheStats: jest.fn(),
      getQueueStats: jest.fn(),
      cancelJob: jest.fn(),
      invalidateTemplateCache: jest.fn(),
      cleanup: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    } as any;

    // Mock constructors
    (PromptOptimizationService as jest.Mock).mockImplementation(() => mockOptimizationService);
    (PromptWizardClient as jest.Mock).mockImplementation(() => mockClient);

    // Setup file system mocks
    fsMock.readFile.mockImplementation(async (filePath) => {
      if (typeof filePath === 'string' && filePath.includes('test-template.json')) {
        return JSON.stringify(createTestTemplate('test-1', 'Test Template', 'Hello {{user}}, help with {{task}}'));
      }
      if (typeof filePath === 'string' && filePath.includes('complex-template.json')) {
        return JSON.stringify(createComplexTemplate());
      }
      throw new Error(`File not found: ${filePath}`);
    });

    fsMock.writeFile.mockResolvedValue();
    fsMock.mkdir.mockResolvedValue();
    fsMock.stat.mockResolvedValue({ isDirectory: () => true, isFile: () => true } as any);

    optimizeCommand = new OptimizeCommand();
  });

  afterEach(() => {
    testEnv.teardown();
    jest.clearAllMocks();
  });

  describe('Complete Optimization Workflows', () => {
    it('should complete full template optimization workflow', async () => {
      const templatePath = path.join(testWorkspaceDir, 'test-template.json');
      const outputPath = path.join(testWorkspaceDir, 'optimized-template.json');

      // Mock optimization result
      const mockResult = {
        requestId: 'req-e2e-1',
        templateId: 'test-1',
        originalTemplate: createTestTemplate('test-1', 'Test Template', 'Hello {{user}}, help with {{task}}'),
        optimizedTemplate: {
          ...createTestTemplate('test-1', 'Test Template', 'Hello {{user}}, help with {{task}}'),
          content: 'Hi {{user}}, assist with {{task}}',
          name: 'Test Template (Optimized)'
        },
        metrics: {
          tokenReduction: 18.2,
          accuracyImprovement: 12.5,
          optimizationTime: 3500,
          apiCalls: 4
        },
        qualityScore: {
          overall: 0.91,
          breakdown: {
            clarity: 0.93,
            conciseness: 0.89,
            effectiveness: 0.92
          },
          confidence: 0.88
        },
        comparison: {
          improvements: {
            'Token reduction': '18.2%',
            'Clarity improvement': '+0.15',
            'Conciseness boost': '+0.21'
          },
          metrics: {
            originalTokens: 22,
            optimizedTokens: 18,
            readabilityImprovement: 0.18
          }
        },
        timestamp: new Date()
      };

      mockOptimizationService.optimizeTemplate.mockResolvedValue(mockResult);

      // Execute optimization command
      await optimizeCommand.execute({
        templatePath,
        outputPath,
        model: 'gpt-4',
        iterations: 3,
        examples: 5,
        reasoning: true,
        skipCache: false,
        priority: 'normal'
      });

      // Verify service was called correctly
      expect(mockOptimizationService.optimizeTemplate).toHaveBeenCalledWith({
        templateId: 'test-1',
        template: expect.objectContaining({
          id: 'test-1',
          name: 'Test Template',
          content: 'Hello {{user}}, help with {{task}}'
        }),
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: {
          skipCache: false,
          priority: 'normal',
          timeoutMs: expect.any(Number)
        }
      });

      // Verify optimized template was written
      expect(fsMock.writeFile).toHaveBeenCalledWith(
        outputPath,
        JSON.stringify(mockResult.optimizedTemplate, null, 2),
        'utf-8'
      );
    });

    it('should handle complex template with advanced features', async () => {
      const complexTemplate = createComplexTemplate();
      const templatePath = path.join(testWorkspaceDir, 'complex-template.json');
      const outputPath = path.join(testWorkspaceDir, 'complex-optimized.json');

      const mockResult = {
        requestId: 'req-complex-1',
        templateId: 'complex-template',
        originalTemplate: complexTemplate,
        optimizedTemplate: {
          ...complexTemplate,
          content: 'Optimized complex template content...',
          name: 'Complex Assistant Template (Optimized)'
        },
        metrics: {
          tokenReduction: 35.8,
          accuracyImprovement: 22.3,
          optimizationTime: 8500,
          apiCalls: 7
        },
        qualityScore: {
          overall: 0.94,
          breakdown: {
            clarity: 0.96,
            conciseness: 0.91,
            effectiveness: 0.95
          },
          confidence: 0.92
        },
        comparison: {
          improvements: {
            'Token reduction': '35.8%',
            'Structure simplification': 'Significant',
            'Conditional logic optimization': 'Enhanced'
          },
          metrics: {
            originalTokens: 450,
            optimizedTokens: 289,
            readabilityImprovement: 0.45
          }
        },
        timestamp: new Date()
      };

      mockOptimizationService.optimizeTemplate.mockResolvedValue(mockResult);

      await optimizeCommand.execute({
        templatePath,
        outputPath,
        model: 'gpt-4',
        iterations: 5,
        examples: 10,
        reasoning: true,
        skipCache: false,
        priority: 'high'
      });

      expect(mockOptimizationService.optimizeTemplate).toHaveBeenCalledWith({
        templateId: 'complex-template',
        template: expect.objectContaining({
          id: 'complex-template',
          variables: expect.objectContaining({
            assistant_type: 'string',
            domain: 'string',
            is_technical: 'boolean'
          })
        }),
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 5,
          fewShotCount: 10,
          generateReasoning: true
        },
        options: {
          skipCache: false,
          priority: 'high',
          timeoutMs: expect.any(Number)
        }
      });
    });

    it('should handle batch optimization of multiple templates', async () => {
      const templatesDir = path.join(testWorkspaceDir, 'templates');
      const outputDir = path.join(testWorkspaceDir, 'optimized');

      // Mock template files
      fsMock.readdir = jest.fn().mockResolvedValue([
        'template1.json',
        'template2.json',
        'template3.json'
      ] as any);

      const templates = [
        createTestTemplate('template-1', 'Template 1', 'Content 1 {{var1}}'),
        createTestTemplate('template-2', 'Template 2', 'Content 2 {{var2}}'),
        createTestTemplate('template-3', 'Template 3', 'Content 3 {{var3}}')
      ];

      fsMock.readFile.mockImplementation(async (filePath) => {
        if (typeof filePath === 'string') {
          if (filePath.includes('template1.json')) return JSON.stringify(templates[0]);
          if (filePath.includes('template2.json')) return JSON.stringify(templates[1]);
          if (filePath.includes('template3.json')) return JSON.stringify(templates[2]);
        }
        throw new Error(`File not found: ${filePath}`);
      });

      const mockBatchResult = {
        batchId: 'batch-e2e-1',
        total: 3,
        successful: 2,
        failed: 1,
        results: [
          {
            requestId: 'req-1',
            templateId: 'template-1',
            originalTemplate: templates[0],
            optimizedTemplate: { ...templates[0], content: 'Optimized content 1 {{var1}}' },
            metrics: { tokenReduction: 15, accuracyImprovement: 10, optimizationTime: 2000, apiCalls: 2 },
            qualityScore: { overall: 0.85, breakdown: {}, confidence: 0.82 },
            comparison: { improvements: {}, metrics: {} },
            timestamp: new Date()
          },
          {
            requestId: 'req-3',
            templateId: 'template-3',
            originalTemplate: templates[2],
            optimizedTemplate: { ...templates[2], content: 'Optimized content 3 {{var3}}' },
            metrics: { tokenReduction: 20, accuracyImprovement: 15, optimizationTime: 2500, apiCalls: 3 },
            qualityScore: { overall: 0.89, breakdown: {}, confidence: 0.86 },
            comparison: { improvements: {}, metrics: {} },
            timestamp: new Date()
          }
        ],
        errors: [
          { templateId: 'template-2', error: 'Optimization failed: Invalid template format' }
        ],
        timestamp: new Date()
      };

      mockOptimizationService.batchOptimize.mockResolvedValue(mockBatchResult);

      await optimizeCommand.execute({
        templatePath: templatesDir,
        outputPath: outputDir,
        model: 'gpt-4',
        iterations: 3,
        examples: 5,
        reasoning: true,
        batch: true
      });

      expect(mockOptimizationService.batchOptimize).toHaveBeenCalledWith({
        templates: [
          { id: 'template-1', template: templates[0] },
          { id: 'template-2', template: templates[1] },
          { id: 'template-3', template: templates[2] }
        ],
        config: {
          targetModel: 'gpt-4',
          mutateRefineIterations: 3,
          fewShotCount: 5,
          generateReasoning: true
        },
        options: expect.any(Object)
      });

      // Verify successful templates were written
      expect(fsMock.writeFile).toHaveBeenCalledWith(
        path.join(outputDir, 'template-1.json'),
        expect.stringContaining('Optimized content 1'),
        'utf-8'
      );
      expect(fsMock.writeFile).toHaveBeenCalledWith(
        path.join(outputDir, 'template-3.json'),
        expect.stringContaining('Optimized content 3'),
        'utf-8'
      );
    });

    it('should provide progress updates during optimization', async () => {
      const templatePath = path.join(testWorkspaceDir, 'test-template.json');
      const outputPath = path.join(testWorkspaceDir, 'optimized-template.json');

      const progressEvents = [
        { stage: 'queued', progress: 0, message: 'Optimization queued' },
        { stage: 'started', progress: 10, message: 'Processing started' },
        { stage: 'analyzing', progress: 30, message: 'Analyzing template' },
        { stage: 'optimizing', progress: 60, message: 'Applying optimizations' },
        { stage: 'validating', progress: 90, message: 'Validating results' },
        { stage: 'completed', progress: 100, message: 'Optimization completed' }
      ];

      const mockResult = {
        requestId: 'req-progress-1',
        templateId: 'test-1',
        originalTemplate: createTestTemplate('test-1', 'Test Template', 'Hello {{user}}, help with {{task}}'),
        optimizedTemplate: {
          ...createTestTemplate('test-1', 'Test Template', 'Hello {{user}}, help with {{task}}'),
          content: 'Hi {{user}}, assist with {{task}}'
        },
        metrics: { tokenReduction: 18.2, accuracyImprovement: 12.5, optimizationTime: 3500, apiCalls: 4 },
        qualityScore: { overall: 0.91, breakdown: {}, confidence: 0.88 },
        comparison: { improvements: {}, metrics: {} },
        timestamp: new Date()
      };

      // Mock progress events
      mockOptimizationService.optimizeTemplate.mockImplementation(async () => {
        // Simulate progress events
        for (const event of progressEvents) {
          setTimeout(() => {
            mockOptimizationService.emit('optimization:progress', event);
          }, 100);
        }
        return mockResult;
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await optimizeCommand.execute({
        templatePath,
        outputPath,
        model: 'gpt-4',
        iterations: 3,
        examples: 5,
        reasoning: true,
        verbose: true
      });

      // Allow events to process
      await TestUtils.flushPromises();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Optimization completed')
      );

      consoleSpy.mockRestore();
    });

    it('should handle optimization failures gracefully', async () => {
      const templatePath = path.join(testWorkspaceDir, 'faulty-template.json');
      const outputPath = path.join(testWorkspaceDir, 'optimized-template.json');

      // Mock faulty template
      fsMock.readFile.mockImplementation(async (filePath) => {
        if (typeof filePath === 'string' && filePath.includes('faulty-template.json')) {
          return JSON.stringify(createTestTemplate('faulty-1', 'Faulty Template', 'Invalid template {{}}'));
        }
        throw new Error(`File not found: ${filePath}`);
      });

      mockOptimizationService.optimizeTemplate.mockRejectedValue(
        new Error('Template validation failed: Empty variable placeholder')
      );

      await expect(optimizeCommand.execute({
        templatePath,
        outputPath,
        model: 'gpt-4',
        iterations: 3,
        examples: 5,
        reasoning: true
      })).rejects.toThrow('Template validation failed');

      // Verify no output file was created
      expect(fsMock.writeFile).not.toHaveBeenCalledWith(
        outputPath,
        expect.anything(),
        expect.anything()
      );
    });

    it('should validate optimization results before saving', async () => {
      const templatePath = path.join(testWorkspaceDir, 'test-template.json');
      const outputPath = path.join(testWorkspaceDir, 'optimized-template.json');

      // Mock invalid optimization result
      const invalidResult = {
        requestId: 'req-invalid-1',
        templateId: 'test-1',
        originalTemplate: createTestTemplate('test-1', 'Test Template', 'Hello {{user}}, help with {{task}}'),
        optimizedTemplate: {
          ...createTestTemplate('test-1', 'Test Template', 'Hello {{user}}, help with {{task}}'),
          content: 'Hello, help with task' // Missing variables!
        },
        metrics: { tokenReduction: -5, accuracyImprovement: -10, optimizationTime: 100, apiCalls: 1 },
        qualityScore: { overall: 0.3, breakdown: {}, confidence: 0.2 },
        comparison: { improvements: {}, metrics: {} },
        timestamp: new Date()
      };

      mockOptimizationService.optimizeTemplate.mockResolvedValue(invalidResult);

      await expect(optimizeCommand.execute({
        templatePath,
        outputPath,
        model: 'gpt-4',
        iterations: 3,
        examples: 5,
        reasoning: true,
        validate: true
      })).rejects.toThrow();
    });

    it('should support optimization comparison and analysis', async () => {
      const templatePath = path.join(testWorkspaceDir, 'test-template.json');
      const outputPath = path.join(testWorkspaceDir, 'analysis-report.json');

      const mockResult = {
        requestId: 'req-analysis-1',
        templateId: 'test-1',
        originalTemplate: createTestTemplate('test-1', 'Test Template', 'You are a helpful assistant. Please provide detailed assistance to the user with their request: {{user_request}}. Make sure to be thorough and helpful.'),
        optimizedTemplate: {
          ...createTestTemplate('test-1', 'Test Template', 'You are a helpful assistant. Please provide detailed assistance to the user with their request: {{user_request}}. Make sure to be thorough and helpful.'),
          content: 'Assist the user with: {{user_request}}. Be thorough and helpful.'
        },
        metrics: {
          tokenReduction: 45.6,
          accuracyImprovement: 8.2,
          optimizationTime: 4200,
          apiCalls: 5
        },
        qualityScore: {
          overall: 0.93,
          breakdown: {
            clarity: 0.95,
            conciseness: 0.92,
            effectiveness: 0.92,
            specificity: 0.91
          },
          confidence: 0.91
        },
        comparison: {
          improvements: {
            'Token reduction': '45.6%',
            'Redundancy removal': 'Significant',
            'Clarity maintenance': 'Excellent',
            'Core message preserved': 'Yes'
          },
          metrics: {
            originalTokens: 34,
            optimizedTokens: 18,
            readabilityImprovement: 0.28,
            coherenceScore: 0.94
          }
        },
        timestamp: new Date()
      };

      mockOptimizationService.optimizeTemplate.mockResolvedValue(mockResult);

      await optimizeCommand.execute({
        templatePath,
        outputPath,
        model: 'gpt-4',
        iterations: 3,
        examples: 5,
        reasoning: true,
        analyze: true,
        format: 'detailed'
      });

      // Verify detailed analysis was written
      expect(fsMock.writeFile).toHaveBeenCalledWith(
        outputPath,
        expect.stringContaining('Token reduction'),
        'utf-8'
      );

      const writeCall = fsMock.writeFile.mock.calls.find(call => 
        typeof call[0] === 'string' && call[0].includes('analysis-report.json')
      );
      
      if (writeCall) {
        const analysisContent = JSON.parse(writeCall[1] as string);
        expect(analysisContent).toHaveProperty('originalTemplate');
        expect(analysisContent).toHaveProperty('optimizedTemplate');
        expect(analysisContent).toHaveProperty('metrics');
        expect(analysisContent).toHaveProperty('comparison');
        expect(analysisContent.metrics.tokenReduction).toBe(45.6);
      }
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from service interruptions', async () => {
      const templatePath = path.join(testWorkspaceDir, 'test-template.json');
      const outputPath = path.join(testWorkspaceDir, 'optimized-template.json');

      // First attempt fails, second succeeds
      mockOptimizationService.optimizeTemplate
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockResolvedValueOnce({
          requestId: 'req-retry-1',
          templateId: 'test-1',
          originalTemplate: createTestTemplate('test-1', 'Test Template', 'Hello {{user}}, help with {{task}}'),
          optimizedTemplate: {
            ...createTestTemplate('test-1', 'Test Template', 'Hello {{user}}, help with {{task}}'),
            content: 'Hi {{user}}, assist with {{task}}'
          },
          metrics: { tokenReduction: 18.2, accuracyImprovement: 12.5, optimizationTime: 3500, apiCalls: 4 },
          qualityScore: { overall: 0.91, breakdown: {}, confidence: 0.88 },
          comparison: { improvements: {}, metrics: {} },
          timestamp: new Date()
        });

      await optimizeCommand.execute({
        templatePath,
        outputPath,
        model: 'gpt-4',
        iterations: 3,
        examples: 5,
        reasoning: true,
        retries: 3
      });

      // Should have retried and succeeded
      expect(mockOptimizationService.optimizeTemplate).toHaveBeenCalledTimes(2);
      expect(fsMock.writeFile).toHaveBeenCalled();
    });

    it('should handle partial batch failures with recovery', async () => {
      const templatesDir = path.join(testWorkspaceDir, 'templates');
      const outputDir = path.join(testWorkspaceDir, 'optimized');

      fsMock.readdir = jest.fn().mockResolvedValue(['template1.json', 'template2.json'] as any);
      
      const templates = [
        createTestTemplate('template-1', 'Template 1', 'Content 1 {{var1}}'),
        createTestTemplate('template-2', 'Template 2', 'Content 2 {{var2}}')
      ];

      fsMock.readFile.mockImplementation(async (filePath) => {
        if (typeof filePath === 'string') {
          if (filePath.includes('template1.json')) return JSON.stringify(templates[0]);
          if (filePath.includes('template2.json')) return JSON.stringify(templates[1]);
        }
        throw new Error(`File not found: ${filePath}`);
      });

      // First batch attempt partially fails
      const partialFailureResult = {
        batchId: 'batch-partial-1',
        total: 2,
        successful: 1,
        failed: 1,
        results: [
          {
            requestId: 'req-1',
            templateId: 'template-1',
            originalTemplate: templates[0],
            optimizedTemplate: { ...templates[0], content: 'Optimized content 1 {{var1}}' },
            metrics: { tokenReduction: 15, accuracyImprovement: 10, optimizationTime: 2000, apiCalls: 2 },
            qualityScore: { overall: 0.85, breakdown: {}, confidence: 0.82 },
            comparison: { improvements: {}, metrics: {} },
            timestamp: new Date()
          }
        ],
        errors: [
          { templateId: 'template-2', error: 'Optimization failed: Service timeout' }
        ],
        timestamp: new Date()
      };

      mockOptimizationService.batchOptimize.mockResolvedValue(partialFailureResult);

      // For retry, only process failed template
      mockOptimizationService.optimizeTemplate.mockResolvedValue({
        requestId: 'req-retry-2',
        templateId: 'template-2',
        originalTemplate: templates[1],
        optimizedTemplate: { ...templates[1], content: 'Optimized content 2 {{var2}}' },
        metrics: { tokenReduction: 20, accuracyImprovement: 15, optimizationTime: 2500, apiCalls: 3 },
        qualityScore: { overall: 0.89, breakdown: {}, confidence: 0.86 },
        comparison: { improvements: {}, metrics: {} },
        timestamp: new Date()
      });

      await optimizeCommand.execute({
        templatePath: templatesDir,
        outputPath: outputDir,
        model: 'gpt-4',
        iterations: 3,
        examples: 5,
        reasoning: true,
        batch: true,
        retryFailed: true
      });

      // Should process failed templates individually
      expect(mockOptimizationService.optimizeTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'template-2'
        })
      );
    });
  });

  describe('Performance and Monitoring', () => {
    it('should track and report optimization performance', async () => {
      const templatePath = path.join(testWorkspaceDir, 'test-template.json');
      const outputPath = path.join(testWorkspaceDir, 'optimized-template.json');
      const metricsPath = path.join(testWorkspaceDir, 'optimization-metrics.json');

      const mockResult = {
        requestId: 'req-perf-1',
        templateId: 'test-1',
        originalTemplate: createTestTemplate('test-1', 'Test Template', 'Hello {{user}}, help with {{task}}'),
        optimizedTemplate: {
          ...createTestTemplate('test-1', 'Test Template', 'Hello {{user}}, help with {{task}}'),
          content: 'Hi {{user}}, assist with {{task}}'
        },
        metrics: {
          tokenReduction: 18.2,
          accuracyImprovement: 12.5,
          optimizationTime: 3500,
          apiCalls: 4
        },
        qualityScore: { overall: 0.91, breakdown: {}, confidence: 0.88 },
        comparison: { improvements: {}, metrics: {} },
        timestamp: new Date()
      };

      mockOptimizationService.optimizeTemplate.mockResolvedValue(mockResult);

      const { result, duration } = await TestUtils.measureTime(async () => {
        return await optimizeCommand.execute({
          templatePath,
          outputPath,
          model: 'gpt-4',
          iterations: 3,
          examples: 5,
          reasoning: true,
          reportMetrics: true,
          metricsOutput: metricsPath
        });
      });

      // Verify metrics were saved
      expect(fsMock.writeFile).toHaveBeenCalledWith(
        metricsPath,
        expect.stringContaining('optimizationTime'),
        'utf-8'
      );

      expect(duration).toBeGreaterThan(0);
    });
  });
});
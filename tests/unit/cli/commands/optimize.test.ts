/**
 * @fileoverview Unit tests for optimize CLI command
 * @lastmodified 2025-08-26T15:30:00Z
 *
 * Features: Tests for optimize command functionality, service integration, and error handling
 * Test Coverage: Command execution, batch optimization, service health checks, output generation
 * Patterns: Mocked dependencies, async testing, error scenarios
 */

import { OptimizeCommand } from '../../../../src/cli/commands/optimize';
import { TemplateService } from '../../../../src/services/template.service';
import { CacheService } from '../../../../src/services/cache.service';
import { PromptOptimizationService } from '../../../../src/services/prompt-optimization.service';
import { PromptWizardClient } from '../../../../src/integrations/promptwizard';
import { Template } from '../../../../src/types';

// Mock all external dependencies
jest.mock('../../../../src/services/template.service');
jest.mock('../../../../src/services/cache.service');
jest.mock('../../../../src/services/prompt-optimization.service');
jest.mock('../../../../src/integrations/promptwizard');
jest.mock('chalk', () => ({
  green: {
    bold: jest.fn(str => `[GREEN]${str}[/GREEN]`),
  },
  cyan: jest.fn(str => `[CYAN]${str}[/CYAN]`),
  blue: jest.fn(str => `[BLUE]${str}[/BLUE]`),
  yellow: {
    bold: jest.fn(str => `[YELLOW]${str}[/YELLOW]`),
  },
  gray: jest.fn(str => `[GRAY]${str}[/GRAY]`),
  magenta: {
    bold: jest.fn(str => `[MAGENTA]${str}[/MAGENTA]`),
  },
}));
jest.mock('ora', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    text: '',
  })),
}));

describe('OptimizeCommand', () => {
  let optimizeCommand: OptimizeCommand;
  let mockTemplateService: jest.Mocked<TemplateService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockOptimizationService: jest.Mocked<PromptOptimizationService>;
  let mockClient: jest.Mocked<PromptWizardClient>;
  
  // Mock console methods
  const mockLog = jest.spyOn(console, 'log').mockImplementation();
  const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
    throw new Error(`Process exit called with code: ${code}`);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocked services
    mockTemplateService = {
      findTemplate: jest.fn(),
      loadTemplate: jest.fn(),
      renderTemplate: jest.fn(),
      listTemplates: jest.fn(),
    } as any;
    
    mockCacheService = {} as any;
    
    mockOptimizationService = {
      optimizeTemplate: jest.fn(),
      batchOptimize: jest.fn(),
      on: jest.fn(),
    } as any;
    
    mockClient = {
      healthCheck: jest.fn(),
    } as any;

    // Mock constructors
    (TemplateService as jest.MockedClass<typeof TemplateService>).mockImplementation(() => mockTemplateService);
    (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);
    (PromptOptimizationService as jest.MockedClass<typeof PromptOptimizationService>).mockImplementation(() => mockOptimizationService);
    (PromptWizardClient as jest.MockedClass<typeof PromptWizardClient>).mockImplementation(() => mockClient);

    optimizeCommand = new OptimizeCommand();
  });

  afterEach(() => {
    mockLog.mockRestore();
    mockExit.mockRestore();
  });

  describe('command metadata', () => {
    it('should have correct command name', () => {
      expect(optimizeCommand.name).toBe('prompt:optimize');
    });

    it('should have correct description', () => {
      expect(optimizeCommand.description).toBe('Optimize prompts using Microsoft PromptWizard');
    });

    it('should have correct aliases', () => {
      expect(optimizeCommand.aliases).toEqual(['optimize', 'opt']);
    });

    it('should have all required options', () => {
      const optionFlags = optimizeCommand.options.map(opt => opt.flags);
      expect(optionFlags).toContain('-t, --template <name>');
      expect(optionFlags).toContain('--task <description>');
      expect(optionFlags).toContain('-m, --model <model>');
      expect(optionFlags).toContain('-i, --iterations <number>');
      expect(optionFlags).toContain('-e, --examples <number>');
      expect(optionFlags).toContain('--reasoning');
      expect(optionFlags).toContain('--batch');
      expect(optionFlags).toContain('-o, --output <path>');
      expect(optionFlags).toContain('--skip-cache');
      expect(optionFlags).toContain('--priority <level>');
    });
  });

  describe('service initialization', () => {
    it('should exit with error if service health check fails', async () => {
      mockClient.healthCheck.mockResolvedValue(false);

      await expect(async () => {
        await optimizeCommand.execute([], {});
      }).rejects.toThrow('Process exit called with code: 1');
    });

    it('should proceed if service health check passes', async () => {
      mockClient.healthCheck.mockResolvedValue(true);
      
      // Mock prompt method to avoid hanging
      optimizeCommand.prompt = jest.fn().mockResolvedValue('test-template');
      optimizeCommand.error = jest.fn();
      
      mockTemplateService.findTemplate.mockResolvedValue(null);

      await optimizeCommand.execute([], {});
      
      expect(mockClient.healthCheck).toHaveBeenCalled();
    });
  });

  describe('single template optimization', () => {
    beforeEach(() => {
      mockClient.healthCheck.mockResolvedValue(true);
      optimizeCommand.prompt = jest.fn();
      optimizeCommand.success = jest.fn();
      optimizeCommand.error = jest.fn();
    });

    it('should optimize template when template option is provided', async () => {
      const mockTemplate: Template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test description',
        content: 'Test content',
        author: 'Test Author',
        version: '1.0.0',
        tags: [],
        variables: [],
        metadata: {},
        outputConfig: { files: [] },
      };

      const mockOptimizationResult = {
        requestId: 'req-123',
        templateId: 'test-template',
        optimizedTemplate: {
          content: 'Optimized content',
        },
        metrics: {
          tokenReduction: 15.5,
          accuracyImprovement: 12.3,
          optimizationTime: 2500,
          apiCalls: 3,
        },
        qualityScore: {
          overall: 85,
          metrics: {
            clarity: 88,
            taskAlignment: 82,
            tokenEfficiency: 85,
          },
          suggestions: ['Add more context', 'Improve clarity'],
        },
        timestamp: new Date().toISOString(),
      };

      mockTemplateService.findTemplate.mockResolvedValue('/path/to/template.json');
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockResolvedValue({
        files: [{ path: 'output.txt', content: 'Rendered content' }],
        metadata: {},
      });
      mockOptimizationService.optimizeTemplate.mockResolvedValue(mockOptimizationResult);

      await optimizeCommand.execute([], { template: 'test-template' });

      expect(mockTemplateService.findTemplate).toHaveBeenCalledWith('test-template');
      expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith('/path/to/template.json');
      expect(mockOptimizationService.optimizeTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'Test Template',
          template: expect.objectContaining({
            content: 'Rendered content',
          }),
        })
      );
    });

    it('should handle template not found error', async () => {
      mockTemplateService.findTemplate.mockResolvedValue(null);

      await optimizeCommand.execute([], { template: 'nonexistent-template' });

      expect(optimizeCommand.error).not.toHaveBeenCalled(); // Should display fail message via spinner
    });

    it('should prompt for template name if not provided', async () => {
      (optimizeCommand.prompt as jest.Mock).mockResolvedValue('prompted-template');
      mockTemplateService.findTemplate.mockResolvedValue(null);

      await optimizeCommand.execute([], {});

      expect(optimizeCommand.prompt).toHaveBeenCalledWith('Enter template name or path');
    });

    it('should handle optimization service errors gracefully', async () => {
      const mockTemplate: Template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test description',
        content: 'Test content',
        author: 'Test Author',
        version: '1.0.0',
        tags: [],
        variables: [],
        metadata: {},
        outputConfig: { files: [] },
      };

      mockTemplateService.findTemplate.mockResolvedValue('/path/to/template.json');
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockResolvedValue({
        files: [{ path: 'output.txt', content: 'Rendered content' }],
        metadata: {},
      });
      mockOptimizationService.optimizeTemplate.mockRejectedValue(new Error('Optimization failed'));

      await optimizeCommand.execute([], { template: 'test-template' });

      expect(mockOptimizationService.optimizeTemplate).toHaveBeenCalled();
      // Should handle error gracefully without crashing
    });
  });

  describe('batch optimization', () => {
    beforeEach(() => {
      mockClient.healthCheck.mockResolvedValue(true);
      optimizeCommand.confirm = jest.fn();
      optimizeCommand.info = jest.fn();
    });

    it('should perform batch optimization on multiple templates', async () => {
      const mockTemplates: Template[] = [
        {
          id: 'template1',
          name: 'Template 1',
          description: 'First template',
          content: 'Content 1',
          author: 'Author',
          version: '1.0.0',
          tags: [],
          variables: [],
          metadata: {},
          outputConfig: { files: [] },
        },
        {
          id: 'template2',
          name: 'Template 2',
          description: 'Second template',
          content: 'Content 2',
          author: 'Author',
          version: '1.0.0',
          tags: [],
          variables: [],
          metadata: {},
          outputConfig: { files: [] },
        },
      ];

      const mockBatchResult = {
        batchId: 'batch-123',
        total: 2,
        successful: 2,
        failed: 0,
        results: [
          {
            templateId: 'template1',
            metrics: { tokenReduction: 10, accuracyImprovement: 5, optimizationTime: 1000 },
          },
          {
            templateId: 'template2',
            metrics: { tokenReduction: 15, accuracyImprovement: 8, optimizationTime: 1200 },
          },
        ],
        errors: [],
      };

      mockTemplateService.listTemplates.mockResolvedValue([
        { name: 'template1', path: '/path/to/template1.json', metadata: {} },
        { name: 'template2', path: '/path/to/template2.json', metadata: {} },
      ]);
      mockTemplateService.loadTemplate.mockImplementation((path) => {
        const index = path.includes('template1') ? 0 : 1;
        return Promise.resolve(mockTemplates[index]);
      });
      (optimizeCommand.confirm as jest.Mock).mockResolvedValue(true);
      mockOptimizationService.batchOptimize.mockResolvedValue(mockBatchResult);

      await optimizeCommand.execute([], { batch: true });

      expect(mockTemplateService.listTemplates).toHaveBeenCalled();
      expect(mockOptimizationService.batchOptimize).toHaveBeenCalledWith(
        expect.objectContaining({
          templates: expect.arrayContaining([
            expect.objectContaining({ template: mockTemplates[0] }),
            expect.objectContaining({ template: mockTemplates[1] }),
          ]),
        })
      );
    });

    it('should handle empty template list for batch optimization', async () => {
      mockTemplateService.listTemplates.mockResolvedValue([]);

      await optimizeCommand.execute([], { batch: true });

      expect(mockTemplateService.listTemplates).toHaveBeenCalled();
      // Should handle empty list gracefully
    });

    it('should cancel batch optimization if user declines', async () => {
      mockTemplateService.listTemplates.mockResolvedValue([
        { name: 'template1', path: '/path/to/template1.json', metadata: {} },
      ]);
      mockTemplateService.loadTemplate.mockResolvedValue({
        id: 'template1',
        name: 'Template 1',
        content: 'Content',
        author: 'Author',
        version: '1.0.0',
        tags: [],
        variables: [],
        metadata: {},
        outputConfig: { files: [] },
      });
      (optimizeCommand.confirm as jest.Mock).mockResolvedValue(false);

      await optimizeCommand.execute([], { batch: true });

      expect(optimizeCommand.confirm).toHaveBeenCalled();
      expect(optimizeCommand.info).toHaveBeenCalledWith('Batch optimization cancelled');
      expect(mockOptimizationService.batchOptimize).not.toHaveBeenCalled();
    });
  });

  describe('configuration handling', () => {
    beforeEach(() => {
      mockClient.healthCheck.mockResolvedValue(true);
      optimizeCommand.prompt = jest.fn().mockResolvedValue('test-template');
      mockTemplateService.findTemplate.mockResolvedValue(null);
    });

    it('should use default configuration values', async () => {
      await optimizeCommand.execute([], {});

      // Should use defaults: gpt-4, 3 iterations, 5 examples, reasoning enabled
      expect(mockOptimizationService.optimizeTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            targetModel: 'gpt-4',
            mutateRefineIterations: 3,
            fewShotCount: 5,
            generateReasoning: true,
          }),
        })
      );
    });

    it('should respect custom configuration values', async () => {
      const options = {
        model: 'claude-3-opus',
        iterations: '5',
        examples: '8',
        reasoning: false,
        priority: 'high',
        skipCache: true,
      };

      mockTemplateService.findTemplate.mockResolvedValue('/path/to/template.json');
      mockTemplateService.loadTemplate.mockResolvedValue({
        id: 'test',
        name: 'Test',
        content: 'Content',
        author: 'Author',
        version: '1.0.0',
        tags: [],
        variables: [],
        metadata: {},
        outputConfig: { files: [] },
      });
      mockTemplateService.renderTemplate.mockResolvedValue({
        files: [{ path: 'output.txt', content: 'Rendered' }],
        metadata: {},
      });

      await optimizeCommand.execute([], { template: 'test', ...options });

      expect(mockOptimizationService.optimizeTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            targetModel: 'claude-3-opus',
            mutateRefineIterations: 5,
            fewShotCount: 8,
            generateReasoning: false,
          }),
          options: expect.objectContaining({
            skipCache: true,
            priority: 'high',
          }),
        })
      );
    });
  });

  describe('output saving', () => {
    beforeEach(() => {
      mockClient.healthCheck.mockResolvedValue(true);
      optimizeCommand.success = jest.fn();
      optimizeCommand.error = jest.fn();
    });

    it('should save optimized template when output path is provided', async () => {
      const mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
      };
      
      // Mock dynamic import of fs
      jest.doMock('fs', () => mockFs, { virtual: true });

      const mockTemplate: Template = {
        id: 'test',
        name: 'Test',
        content: 'Content',
        author: 'Author',
        version: '1.0.0',
        tags: [],
        variables: [],
        metadata: {},
        outputConfig: { files: [] },
      };

      const mockResult = {
        templateId: 'test',
        requestId: 'req-123',
        optimizedTemplate: { content: 'Optimized content' },
        metrics: { tokenReduction: 10 },
        qualityScore: { overall: 85 },
        timestamp: new Date().toISOString(),
      };

      mockTemplateService.findTemplate.mockResolvedValue('/path/to/template.json');
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockResolvedValue({
        files: [{ path: 'output.txt', content: 'Rendered' }],
        metadata: {},
      });
      mockOptimizationService.optimizeTemplate.mockResolvedValue(mockResult);

      await optimizeCommand.execute([], { 
        template: 'test',
        output: '/path/to/output.json',
      });

      expect(optimizeCommand.success).toHaveBeenCalledWith(
        expect.stringContaining('Optimized template saved to:')
      );
    });
  });

  describe('event handling', () => {
    beforeEach(() => {
      mockClient.healthCheck.mockResolvedValue(true);
    });

    it('should set up optimization event listeners', async () => {
      const mockTemplate: Template = {
        id: 'test',
        name: 'Test',
        content: 'Content',
        author: 'Author',
        version: '1.0.0',
        tags: [],
        variables: [],
        metadata: {},
        outputConfig: { files: [] },
      };

      mockTemplateService.findTemplate.mockResolvedValue('/path/to/template.json');
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockResolvedValue({
        files: [{ path: 'output.txt', content: 'Rendered' }],
        metadata: {},
      });

      await optimizeCommand.execute([], { template: 'test' });

      expect(mockOptimizationService.on).toHaveBeenCalledWith('optimization:started', expect.any(Function));
      expect(mockOptimizationService.on).toHaveBeenCalledWith('optimization:completed', expect.any(Function));
      expect(mockOptimizationService.on).toHaveBeenCalledWith('optimization:failed', expect.any(Function));
    });

    it('should set up batch optimization event listeners', async () => {
      mockTemplateService.listTemplates.mockResolvedValue([]);

      await optimizeCommand.execute([], { batch: true });

      expect(mockOptimizationService.on).toHaveBeenCalledWith('batch:started', expect.any(Function));
    });
  });
});
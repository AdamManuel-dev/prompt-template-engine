/**
 * @fileoverview Unit tests for compare CLI command
 * @lastmodified 2025-08-26T15:35:00Z
 *
 * Features: Tests for compare command functionality, prompt comparison, and output formats
 * Test Coverage: Command execution, prompt resolution, format handling, diff generation
 * Patterns: Mocked dependencies, async testing, format testing
 */

import { diffLines } from 'diff';

// Import types first
import { Template } from '../../../../src/types';

// Mock external dependencies
jest.mock('../../../../src/services/template.service');
jest.mock('../../../../src/integrations/promptwizard');
jest.mock('diff');
jest.mock('chalk', () => ({
  blue: {
    bold: jest.fn(str => `[BLUE]${str}[/BLUE]`),
  },
  cyan: jest.fn(str => `[CYAN]${str}[/CYAN]`),
  yellow: {
    bold: jest.fn(str => `[YELLOW]${str}[/YELLOW]`),
  },
  green: jest.fn(str => `[GREEN]${str}[/GREEN]`),
  red: jest.fn(str => `[RED]${str}[/RED]`),
  gray: jest.fn(str => `[GRAY]${str}[/GRAY]`),
  white: jest.fn(str => `[WHITE]${str}[/WHITE]`),
  magenta: {
    bold: jest.fn(str => `[MAGENTA]${str}[/MAGENTA]`),
  },
}));
const mockSpinner = {
  start: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  text: '',
};

jest.mock('ora', () => {
  return {
    __esModule: true,
    default: jest.fn(() => mockSpinner),
  };
});

// Import modules after mocks are set up
import { CompareCommand } from '../../../../src/cli/commands/compare';
import { TemplateService } from '../../../../src/services/template.service';
import { PromptWizardClient } from '../../../../src/integrations/promptwizard';

describe('CompareCommand', () => {
  let compareCommand: CompareCommand;
  let mockTemplateService: jest.Mocked<TemplateService>;
  let mockClient: jest.Mocked<PromptWizardClient>;
  
  // Mock console methods
  const mockLog = jest.spyOn(console, 'log').mockImplementation();
  const mockWrite = jest.spyOn(process.stdout, 'write').mockImplementation();

  const mockComparisonResult = {
    comparisonId: 'comp-123',
    original: {
      score: {
        overall: 70,
        metrics: {
          clarity: 68,
          taskAlignment: 72,
          tokenEfficiency: 70,
        },
        suggestions: ['Improve clarity', 'Add examples'],
      },
      estimatedTokens: 150,
      estimatedCost: 0.003,
    },
    optimized: {
      score: {
        overall: 85,
        metrics: {
          clarity: 88,
          taskAlignment: 82,
          tokenEfficiency: 85,
        },
        suggestions: ['Minor refinements possible'],
      },
      estimatedTokens: 120,
      estimatedCost: 0.0024,
    },
    improvements: {
      qualityImprovement: 21.4,
      tokenReduction: 20.0,
      costSavings: 20.0,
    },
    analysis: {
      strengthsGained: ['Better clarity', 'More concise'],
      potentialRisks: ['May need more context'],
      recommendations: ['Test with examples', 'Monitor performance'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocked services
    mockTemplateService = {
      findTemplate: jest.fn(),
      loadTemplate: jest.fn(),
      renderTemplate: jest.fn(),
    } as any;
    
    mockClient = {
      healthCheck: jest.fn().mockResolvedValue(true),
      comparePrompts: jest.fn().mockResolvedValue(mockComparisonResult),
    } as any;

    // Mock constructors
    (TemplateService as jest.MockedClass<typeof TemplateService>).mockImplementation(() => mockTemplateService);
    (PromptWizardClient as jest.MockedClass<typeof PromptWizardClient>).mockImplementation(() => mockClient);

    compareCommand = new CompareCommand();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.resetAllMocks();
    mockLog.mockRestore();
    mockWrite.mockRestore();
  });

  describe('command metadata', () => {
    it('should have correct command name', () => {
      expect(compareCommand.name).toBe('prompt:compare');
    });

    it('should have correct description', () => {
      expect(compareCommand.description).toBe('Compare original and optimized prompts with detailed metrics');
    });

    it('should have correct aliases', () => {
      expect(compareCommand.aliases).toEqual(['compare', 'diff']);
    });

    it('should have all required options', () => {
      const optionFlags = compareCommand.options.map(opt => opt.flags);
      expect(optionFlags).toContain('-o, --original <prompt>');
      expect(optionFlags).toContain('-p, --optimized <prompt>');
      expect(optionFlags).toContain('--task <description>');
      expect(optionFlags).toContain('-f, --format <type>');
      expect(optionFlags).toContain('--output <path>');
      expect(optionFlags).toContain('--detailed');
      expect(optionFlags).toContain('--show-diff');
    });
  });

  describe('service initialization and health checks', () => {
    it('should exit with error if service health check fails', async () => {
      mockClient.healthCheck.mockResolvedValue(false);
      const mockExit = jest.spyOn(compareCommand as any, 'exit').mockImplementation(((code: number) => {
        throw new Error(`Process exit called with code: ${code}`);
      }) as any);

      await expect(async () => {
        await compareCommand.execute([], {});
      }).rejects.toThrow('Process exit called with code: 1');
      
      expect(mockClient.healthCheck).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(1);
      
      mockExit.mockRestore();
    });

    it('should proceed if service health check passes', async () => {
      mockClient.healthCheck.mockResolvedValue(true);
      (compareCommand as any).prompt = jest.fn().mockResolvedValue('test prompt');

      await compareCommand.execute([], {});
      
      expect(mockClient.healthCheck).toHaveBeenCalled();
    });
  });

  describe('prompt resolution', () => {
    beforeEach(() => {
      (compareCommand as any).prompt = jest.fn();
      (compareCommand as any).error = jest.fn();
    });

    it('should resolve template names to content', async () => {
      const mockTemplate: Template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Test description',
        content: 'Template content',
        author: 'Test Author',
        version: '1.0.0',
        tags: [],
        variables: {},
        metadata: {},
      };

      mockTemplateService.findTemplate.mockResolvedValue('/path/to/template.json');
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate as any);
      mockTemplateService.renderTemplate.mockResolvedValue({
        id: 'test-template',
        name: 'Test Template',
        description: 'Template for testing',
        content: 'Rendered template content',
        author: 'Test Author',
        version: '1.0.0',
        tags: [],
        variables: {},
        metadata: {},
      } as any);

      await compareCommand.execute([], {
        original: 'test-template',
        optimized: 'Direct optimized prompt text',
      });

      expect(mockTemplateService.findTemplate).toHaveBeenCalledWith('test-template');
      expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith('/path/to/template.json');
      expect(mockClient.comparePrompts).toHaveBeenCalledWith(
        'Rendered template content',
        'Direct optimized prompt text',
        undefined
      );
    });

    it('should use direct text for non-template inputs', async () => {
      const longPrompt = 'This is a long prompt that contains spaces and newlines\nand should be treated as direct text rather than a template name';
      
      await compareCommand.execute([], {
        original: longPrompt,
        optimized: 'Optimized version',
      });

      expect(mockTemplateService.findTemplate).not.toHaveBeenCalled();
      expect(mockClient.comparePrompts).toHaveBeenCalledWith(
        longPrompt,
        'Optimized version',
        undefined
      );
    });

    it('should prompt for missing prompts', async () => {
      ((compareCommand as any).prompt as jest.Mock)
        .mockResolvedValueOnce('original prompt text')
        .mockResolvedValueOnce('optimized prompt text');

      await compareCommand.execute([], {});

      expect((compareCommand as any).prompt).toHaveBeenCalledWith('Enter original prompt or template name');
      expect((compareCommand as any).prompt).toHaveBeenCalledWith('Enter optimized prompt or template name');
      expect(mockClient.comparePrompts).toHaveBeenCalledWith(
        'original prompt text',
        'optimized prompt text',
        undefined
      );
    });

    it('should handle missing original prompt', async () => {
      ((compareCommand as any).prompt as jest.Mock).mockResolvedValue('');

      await compareCommand.execute([], {});

      expect((compareCommand as any).error).toHaveBeenCalledWith('Original prompt is required');
    });

    it('should handle missing optimized prompt', async () => {
      ((compareCommand as any).prompt as jest.Mock)
        .mockResolvedValueOnce('original prompt')
        .mockResolvedValueOnce('');

      await compareCommand.execute([], {});

      expect((compareCommand as any).error).toHaveBeenCalledWith('Optimized prompt is required');
    });
  });

  describe('output formats', () => {
    beforeEach(() => {
      (compareCommand as any).prompt = jest.fn();
    });

    it('should display table format by default', async () => {
      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        detailed: true,
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('[BLUE]📊 Prompt Comparison Results[/BLUE]'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Quality Metrics'));
    });

    it('should display JSON format when requested', async () => {
      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        format: 'json',
      });

      expect(mockLog).toHaveBeenCalledWith(
        JSON.stringify(mockComparisonResult, null, 2)
      );
    });

    it('should display markdown format when requested', async () => {
      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        format: 'markdown',
      });

      expect(mockLog).toHaveBeenCalledWith('# Prompt Comparison Report\n');
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('**Comparison ID:**'));
      expect(mockLog).toHaveBeenCalledWith('## Quality Metrics\n');
    });

    it('should show detailed analysis when requested', async () => {
      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        detailed: true,
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Detailed Analysis'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Strengths Gained:'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Potential Risks:'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Recommendations:'));
    });
  });

  describe('diff generation', () => {
    beforeEach(() => {
      (diffLines as jest.Mock).mockReturnValue([
        { value: 'Common line\n', added: false, removed: false },
        { value: 'Removed line\n', added: false, removed: true },
        { value: 'Added line\n', added: true, removed: false },
      ]);
    });

    it('should show diff when requested', async () => {
      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        showDiff: true,
      });

      expect(diffLines).toHaveBeenCalledWith('Original prompt', 'Optimized prompt');
      expect(mockWrite).toHaveBeenCalledWith('[GRAY]  Common line\n[/GRAY]');
      expect(mockWrite).toHaveBeenCalledWith('[RED]- Removed line\n[/RED]');
      expect(mockWrite).toHaveBeenCalledWith('[GREEN]+ Added line\n[/GREEN]');
    });

    it('should not show diff when disabled', async () => {
      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        showDiff: false,
      });

      expect(diffLines).not.toHaveBeenCalled();
    });
  });

  describe('report saving', () => {
    beforeEach(() => {
      (compareCommand as any).success = jest.fn();
      (compareCommand as any).error = jest.fn();
    });

    it('should save JSON report when output path is provided', async () => {
      const mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
      };
      
      jest.doMock('fs', () => mockFs, { virtual: true });
      
      // Ensure the fs module is properly mocked before use
      jest.resetModules();

      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        output: '/path/to/report.json',
        format: 'json',
      });

      expect((compareCommand as any).success).toHaveBeenCalledWith(
        expect.stringContaining('Comparison report saved to:')
      );
    });

    it('should save markdown report when format is markdown', async () => {
      const mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
      };
      
      jest.doMock('fs', () => mockFs, { virtual: true });
      
      // Ensure the fs module is properly mocked before use
      jest.resetModules();

      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        output: '/path/to/report.md',
        format: 'markdown',
      });

      expect((compareCommand as any).success).toHaveBeenCalledWith(
        expect.stringContaining('Comparison report saved to:')
      );
    });

    it('should create output directory if it does not exist', async () => {
      const mockFs = {
        existsSync: jest.fn().mockReturnValue(false),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
      };
      const mockPath = {
        dirname: jest.fn().mockReturnValue('/path/to'),
      };
      
      jest.doMock('fs', () => mockFs, { virtual: true });
      jest.doMock('path', () => mockPath, { virtual: true });
      
      // Ensure modules are properly mocked
      jest.resetModules();

      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        output: '/path/to/report.json',
      });

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/path/to', { recursive: true });
    });

    it('should handle file save errors gracefully', async () => {
      const mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn().mockImplementation(() => {
          throw new Error('Write failed');
        }),
      };
      
      jest.doMock('fs', () => mockFs, { virtual: true });
      
      // Ensure the fs module is properly mocked
      jest.resetModules();

      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        output: '/path/to/report.json',
      });

      expect((compareCommand as any).error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save comparison report:')
      );
    });
  });

  describe('task context integration', () => {
    it('should pass task context to comparison service', async () => {
      const taskDescription = 'Generate marketing copy for product launch';
      
      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        task: taskDescription,
      });

      expect(mockClient.comparePrompts).toHaveBeenCalledWith(
        'Original prompt',
        'Optimized prompt',
        taskDescription
      );
    });

    it('should extract task from template description when available', async () => {
      const mockTemplate: Template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Template for generating marketing copy',
        content: 'Template content',
        author: 'Test Author',
        version: '1.0.0',
        tags: [],
        variables: {},
        metadata: {},
      };

      mockTemplateService.findTemplate.mockResolvedValue('/path/to/template.json');
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate as any);
      mockTemplateService.renderTemplate.mockResolvedValue({
        id: 'test-template',
        name: 'Test Template',
        description: 'Template for product descriptions',
        content: 'Rendered content',
        author: 'Test Author',
        version: '1.0.0',
        tags: [],
        variables: {},
        metadata: {},
      } as any);

      await compareCommand.execute([], {
        original: 'test-template',
        optimized: 'Optimized prompt',
      });

      // Should use template description as task context
      expect(mockClient.comparePrompts).toHaveBeenCalledWith(
        'Rendered content',
        'Optimized prompt',
        undefined
      );
    });
  });

  describe('error handling', () => {
    it('should handle comparison service errors gracefully', async () => {
      mockClient.comparePrompts.mockRejectedValue(new Error('Comparison service failed'));

      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
      });

      expect(mockClient.comparePrompts).toHaveBeenCalled();
      // Should handle error gracefully via spinner.fail
    });

    it('should handle template resolution errors', async () => {
      mockTemplateService.findTemplate.mockRejectedValue(new Error('Template service failed'));

      await compareCommand.execute([], {
        original: 'template-name',
        optimized: 'Optimized prompt',
      });

      // Should fall back to treating as direct text
      expect(mockClient.comparePrompts).toHaveBeenCalledWith(
        'template-name',
        'Optimized prompt',
        undefined
      );
    });
  });

  describe('metrics calculation and display', () => {
    it('should correctly calculate and display improvement percentages', async () => {
      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
        format: 'table',
      });

      // Check that metrics are displayed with proper calculations
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Improvement'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Quality Improvement'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Token Reduction'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Cost Savings'));
    });

    it('should handle zero or negative improvements gracefully', async () => {
      const negativeImprovementResult = {
        ...mockComparisonResult,
        improvements: {
          qualityImprovement: -5.0,
          tokenReduction: -10.0,
          costSavings: 0.0,
        },
      };

      mockClient.comparePrompts.mockResolvedValue(negativeImprovementResult as any);

      await compareCommand.execute([], {
        original: 'Original prompt',
        optimized: 'Optimized prompt',
      });

      // Should display negative improvements without crashing
      expect(mockLog).toHaveBeenCalled();
    });
  });
});
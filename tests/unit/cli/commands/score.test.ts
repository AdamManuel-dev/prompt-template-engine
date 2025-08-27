/**
 * @fileoverview Unit tests for score CLI command
 * @lastmodified 2025-08-26T15:40:00Z
 *
 * Features: Tests for score command functionality, quality scoring, and batch operations
 * Test Coverage: Command execution, scoring formats, threshold checking, batch scoring
 * Patterns: Mocked dependencies, async testing, format validation
 */

// Mock ora with direct import
const mockOra = () => {
  const spinner = {
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    text: '',
    color: 'cyan',
    isSpinning: false,
    clear: jest.fn().mockReturnThis(),
    render: jest.fn().mockReturnThis(),
    frame: jest.fn().mockReturnValue('⠋'),
  };
  return spinner;
};

jest.mock('ora', () => mockOra);

import { ScoreCommand } from '../../../../src/cli/commands/score';
import { TemplateService } from '../../../../src/services/template.service';
import { PromptWizardClient } from '../../../../src/integrations/promptwizard';
import { Template } from '../../../../src/types';
import chalk from 'chalk';

// Mock external dependencies
jest.mock('../../../../src/services/template.service');
jest.mock('../../../../src/integrations/promptwizard');
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    blue: Object.assign(jest.fn((str: string) => `[BLUE]${str}[/BLUE]`), {
      bold: jest.fn((str: string) => `[BLUE]${str}[/BLUE]`),
    }),
    cyan: jest.fn((str: string) => `[CYAN]${str}[/CYAN]`),
    yellow: Object.assign(jest.fn((str: string) => `[YELLOW]${str}[/YELLOW]`), {
      bold: jest.fn((str: string) => `[YELLOW]${str}[/YELLOW]`),
    }),
    green: jest.fn((str: string) => `[GREEN]${str}[/GREEN]`),
    red: jest.fn((str: string) => `[RED]${str}[/RED]`),
    gray: Object.assign(jest.fn((str: string) => `[GRAY]${str}[/GRAY]`), {
      bold: jest.fn((str: string) => `[GRAY]${str}[/GRAY]`),
    }),
    magenta: Object.assign(jest.fn((str: string) => `[MAGENTA]${str}[/MAGENTA]`), {
      bold: jest.fn((str: string) => `[MAGENTA]${str}[/MAGENTA]`),
    }),
    white: jest.fn((str: string) => `[WHITE]${str}[/WHITE]`),
  },
}));

describe('ScoreCommand', () => {
  let scoreCommand: ScoreCommand;
  let mockTemplateService: jest.Mocked<TemplateService>;
  let mockClient: jest.Mocked<PromptWizardClient>;
  
  // Mock console methods
  const mockLog = jest.spyOn(console, 'log').mockImplementation(() => {
    // Swallow console.log calls but capture them for testing
  });

  const mockScoreResult = {
    overall: 85,
    confidence: 92.5,
    metrics: {
      clarity: 88,
      taskAlignment: 82,
      tokenEfficiency: 85,
      exampleQuality: 90,
    },
    suggestions: [
      'Consider adding more specific examples',
      'Improve task alignment with clearer instructions',
      'Optimize token usage for better efficiency',
    ],
  };

  beforeEach(() => {
    // Clear mock call history
    mockLog.mockClear();
    jest.clearAllMocks();
    
    // Manually setup chalk mock functions
    (chalk.blue as any) = jest.fn((str: string) => `[BLUE]${str}[/BLUE]`);
    (chalk.blue as any).bold = jest.fn((str: string) => `[BLUE]${str}[/BLUE]`);
    (chalk.cyan as any) = jest.fn((str: string) => `[CYAN]${str}[/CYAN]`);
    (chalk.yellow as any) = jest.fn((str: string) => `[YELLOW]${str}[/YELLOW]`);
    (chalk.yellow as any).bold = jest.fn((str: string) => `[YELLOW]${str}[/YELLOW]`);
    (chalk.green as any) = jest.fn((str: string) => `[GREEN]${str}[/GREEN]`);
    (chalk.red as any) = jest.fn((str: string) => `[RED]${str}[/RED]`);
    (chalk.gray as any) = jest.fn((str: string) => `[GRAY]${str}[/GRAY]`);
    (chalk.gray as any).bold = jest.fn((str: string) => `[GRAY]${str}[/GRAY]`);
    (chalk.magenta as any) = jest.fn((str: string) => `[MAGENTA]${str}[/MAGENTA]`);
    (chalk.magenta as any).bold = jest.fn((str: string) => `[MAGENTA]${str}[/MAGENTA]`);
    (chalk.white as any) = jest.fn((str: string) => `[WHITE]${str}[/WHITE]`);
    
    // Setup mocked services
    mockTemplateService = {
      findTemplate: jest.fn(),
      loadTemplate: jest.fn(),
      renderTemplate: jest.fn(),
      listTemplates: jest.fn(),
    } as any;
    
    mockClient = {
      healthCheck: jest.fn().mockResolvedValue(true),
      scorePrompt: jest.fn().mockResolvedValue(mockScoreResult),
    } as any;

    // Mock constructors
    (TemplateService as jest.MockedClass<typeof TemplateService>).mockImplementation(() => mockTemplateService);
    (PromptWizardClient as jest.MockedClass<typeof PromptWizardClient>).mockImplementation(() => mockClient);

    scoreCommand = new ScoreCommand();
    
    // Mock all interactive methods to prevent hanging
    (scoreCommand as any).prompt = jest.fn().mockResolvedValue('p');
    (scoreCommand as any).promptText = jest.fn().mockResolvedValue('test prompt');
    (scoreCommand as any).promptSelect = jest.fn().mockResolvedValue('template1');
    (scoreCommand as any).success = jest.fn();
    (scoreCommand as any).warn = jest.fn();
    (scoreCommand as any).error = jest.fn();
    (scoreCommand as any).exit = jest.fn().mockImplementation(() => {
      throw new Error('Process exit called');
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    // Don't clear/reset mocks here since we need to check them in tests
    // Individual tests can clear mocks if needed
  });

  describe('command metadata', () => {
    it('should have correct command name', () => {
      expect(scoreCommand.name).toBe('prompt:score');
    });

    it('should have correct description', () => {
      expect(scoreCommand.description).toBe('Score prompt quality and get improvement suggestions');
    });

    it('should have correct aliases', () => {
      expect(scoreCommand.aliases).toEqual(['score', 'rate']);
    });

    it('should have all required options', () => {
      const optionFlags = scoreCommand.options.map(opt => opt.flags);
      expect(optionFlags).toContain('-p, --prompt <text>');
      expect(optionFlags).toContain('-t, --template <name>');
      expect(optionFlags).toContain('--task <description>');
      expect(optionFlags).toContain('-f, --format <type>');
      expect(optionFlags).toContain('--output <path>');
      expect(optionFlags).toContain('--threshold <number>');
      expect(optionFlags).toContain('--detailed');
      expect(optionFlags).toContain('--batch');
    });
  });

  describe('service initialization and health checks', () => {
    it('should exit with error if service health check fails', async () => {
      mockClient.healthCheck.mockResolvedValue(false);

      await expect(async () => {
        await scoreCommand.execute([], {});
      }).rejects.toThrow('Process exit called');
      
      expect(mockClient.healthCheck).toHaveBeenCalled();
      expect((scoreCommand as any).exit).toHaveBeenCalledWith(1);
    });

    it('should proceed if service health check passes', async () => {
      mockClient.healthCheck.mockResolvedValue(true);
      (scoreCommand as any).prompt = jest.fn().mockResolvedValue('p');
      (scoreCommand as any).promptText = jest.fn().mockResolvedValue('test prompt');

      await scoreCommand.execute([], {});
      
      expect(mockClient.healthCheck).toHaveBeenCalled();
      expect(mockClient.scorePrompt).toHaveBeenCalledWith('test prompt', undefined);
    });
  });

  describe('single prompt scoring', () => {
    beforeEach(() => {
      (scoreCommand as any).prompt = jest.fn();
      (scoreCommand as any).success = jest.fn();
      (scoreCommand as any).warn = jest.fn();
    });

    it('should score direct prompt text', async () => {
      const promptText = 'This is a test prompt for scoring';
      
      await scoreCommand.execute([], {
        prompt: promptText,
      });

      expect(mockClient.scorePrompt).toHaveBeenCalledWith(promptText, undefined);
    });

    it('should score template by name', async () => {
      const mockTemplate: Template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Template for testing',
        content: 'Template content for scoring',
        author: 'Test Author',
        version: '1.0.0',
        tags: [],
        variables: {},
        metadata: {},
      };

      mockTemplateService.findTemplate.mockResolvedValue('/path/to/template.json');
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate as any);
      mockTemplateService.renderTemplate.mockResolvedValue({
        files: [{
          path: 'template.txt',
          content: 'Rendered template content',
          variables: {}
        }]
      } as any);

      await scoreCommand.execute([], {
        template: 'test-template',
      });

      expect(mockTemplateService.findTemplate).toHaveBeenCalledWith('test-template');
      expect(mockTemplateService.loadTemplate).toHaveBeenCalledWith('/path/to/template.json');
      expect(mockClient.scorePrompt).toHaveBeenCalledWith('Rendered template content', 'Template for testing');
    });

    it('should handle template not found', async () => {
      (scoreCommand as any).error = jest.fn();
      mockTemplateService.findTemplate.mockResolvedValue(null);

      await scoreCommand.execute([], {
        template: 'nonexistent-template',
      });

      // Should fail via spinner without calling scorePrompt
      expect(mockClient.scorePrompt).not.toHaveBeenCalled();
    });

    it('should prompt user for input when neither prompt nor template provided', async () => {
      ((scoreCommand as any).prompt as jest.Mock)
        .mockResolvedValueOnce('p') // Choose prompt text
        .mockResolvedValueOnce('Test prompt text');

      await scoreCommand.execute([], {});

      expect((scoreCommand as any).prompt).toHaveBeenCalledWith('Score (p)rompt text or (t)emplate? [p/t]');
      expect((scoreCommand as any).prompt).toHaveBeenCalledWith('Enter prompt text');
      expect(mockClient.scorePrompt).toHaveBeenCalledWith('Test prompt text', undefined);
    });

    it('should prompt user for template when choosing template option', async () => {
      const mockTemplate: Template = {
        id: 'user-template',
        name: 'User Template',
        description: 'User selected template',
        content: 'User template content',
        author: 'User',
        version: '1.0.0',
        tags: [],
        variables: {},
        metadata: {},
      };

      ((scoreCommand as any).prompt as jest.Mock)
        .mockResolvedValueOnce('t') // Choose template
        .mockResolvedValueOnce('user-template');

      mockTemplateService.findTemplate.mockResolvedValue('/path/to/user-template.json');
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate as any);
      mockTemplateService.renderTemplate.mockResolvedValue({
        files: [{
          path: 'user-template.txt',
          content: 'Rendered user template',
          variables: {}
        }]
      } as any);

      await scoreCommand.execute([], {});

      expect((scoreCommand as any).prompt).toHaveBeenCalledWith('Enter template name');
      expect(mockClient.scorePrompt).toHaveBeenCalledWith('Rendered user template', 'User selected template');
    });
  });

  describe('output formats', () => {
    const promptText = 'Test prompt for format testing';

    beforeEach(() => {
      (scoreCommand as any).success = jest.fn();
      (scoreCommand as any).warn = jest.fn();
    });

    it('should display table format by default', async () => {
      // Capture console output to verify formatting is working
      const consoleSpy = jest.spyOn(console, 'log');
      
      await scoreCommand.execute([], {
        prompt: promptText,
        detailed: true,
      });

      // Verify that console.log was called multiple times (indicating output was generated)
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(0);
      
      // Verify key content appears in the output
      const allOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join(' ');
      expect(allOutput).toContain('Prompt Quality Score');
      expect(allOutput).toContain('Quality Metrics');
      expect(allOutput).toContain('Improvement Suggestions');
      
      consoleSpy.mockRestore();
    });

    it('should display JSON format when requested', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      await scoreCommand.execute([], {
        prompt: promptText,
        format: 'json',
      });

      // Verify JSON output was generated
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(0);
      const allOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join(' ');
      expect(allOutput).toContain('"source"');
      expect(allOutput).toContain('"score"');
      expect(allOutput).toContain('"overall"');
      
      consoleSpy.mockRestore();
    });

    it('should display markdown format when requested', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      await scoreCommand.execute([], {
        prompt: promptText,
        format: 'markdown',
      });

      // Verify markdown output was generated
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(0);
      const allOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join(' ');
      expect(allOutput).toContain('# Prompt Quality Report');
      expect(allOutput).toContain('**Source:** prompt');
      expect(allOutput).toContain('## Quality Metrics');
      expect(allOutput).toContain('## Improvement Suggestions');
      
      consoleSpy.mockRestore();
    });

    it('should display badge format when requested', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      
      await scoreCommand.execute([], {
        prompt: promptText,
        format: 'badge',
      });

      // Verify badge output was generated
      expect(consoleSpy.mock.calls.length).toBeGreaterThan(0);
      const allOutput = consoleSpy.mock.calls.map(call => call.join(' ')).join(' ');
      expect(allOutput).toContain('QUALITY SCORE');
      expect(allOutput).toContain('85/100');
      
      consoleSpy.mockRestore();
    });

    it('should show detailed content for short prompts', async () => {
      const shortPrompt = 'Short test prompt';
      
      await scoreCommand.execute([], {
        prompt: shortPrompt,
        detailed: true,
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Prompt Content'));
      expect(mockLog).toHaveBeenCalledWith(shortPrompt);
    });

    it('should truncate content display for long prompts', async () => {
      const longPrompt = 'a'.repeat(600); // Longer than 500 characters
      
      await scoreCommand.execute([], {
        prompt: longPrompt,
        detailed: true,
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('600 characters (truncated for display)'));
    });
  });

  describe('threshold checking', () => {
    beforeEach(() => {
      (scoreCommand as any).success = jest.fn();
      (scoreCommand as any).warn = jest.fn();
    });

    it('should report success when score meets threshold', async () => {
      await scoreCommand.execute([], {
        prompt: 'Test prompt',
        threshold: 80, // Score is 85, should pass
      });

      expect((scoreCommand as any).success).toHaveBeenCalledWith(
        expect.stringContaining('Quality score meets threshold (85 >= 80)')
      );
    });

    it('should report warning when score is below threshold', async () => {
      await scoreCommand.execute([], {
        prompt: 'Test prompt',
        threshold: 90, // Score is 85, should fail
      });

      expect((scoreCommand as any).warn).toHaveBeenCalledWith(
        expect.stringContaining('Quality score below threshold (85 < 90)')
      );
    });

    it('should use default threshold of 70', async () => {
      mockClient.scorePrompt.mockResolvedValue({
        ...mockScoreResult,
        overall: 75, // Above default threshold
      });

      await scoreCommand.execute([], {
        prompt: 'Test prompt',
      });

      expect((scoreCommand as any).success).toHaveBeenCalledWith(
        expect.stringContaining('75 >= 70')
      );
    });
  });

  describe('batch scoring', () => {
    const mockTemplates: Template[] = [
      {
        id: 'template1',
        name: 'Template 1',
        description: 'First template',
        content: 'First template content',
        author: 'Author',
        version: '1.0.0',
        tags: [],
        variables: {},
        metadata: {},
      },
      {
        id: 'template2',
        name: 'Template 2',
        description: 'Second template',
        content: 'Second template content',
        author: 'Author',
        version: '1.0.0',
        tags: [],
        variables: {},
        metadata: {},
      },
    ];

    beforeEach(() => {
      (scoreCommand as any).success = jest.fn();
      (scoreCommand as any).error = jest.fn();
    });

    it('should perform batch scoring on all templates', async () => {
      mockTemplateService.listTemplates.mockResolvedValue([
        { name: 'template1', path: '/path/to/template1.json' },
        { name: 'template2', path: '/path/to/template2.json' },
      ]);
      
      mockTemplateService.loadTemplate.mockImplementation((path) => {
        const index = path.includes('template1') ? 0 : 1;
        return Promise.resolve(mockTemplates[index] as any);
      });

      mockTemplateService.renderTemplate.mockImplementation((template, _variables) => {
        return Promise.resolve({
          ...template,
          files: [{
            path: 'template.txt',
            source: 'template.txt',
            destination: 'rendered-template.txt',
            content: (template as any).content, // Cast to access content field
          }]
        });
      });

      mockClient.scorePrompt
        .mockResolvedValueOnce({ ...mockScoreResult, overall: 80 })
        .mockResolvedValueOnce({ ...mockScoreResult, overall: 75 });

      await scoreCommand.execute([], {
        batch: true,
        threshold: 70,
      });

      expect(mockTemplateService.listTemplates).toHaveBeenCalled();
      expect(mockClient.scorePrompt).toHaveBeenCalledTimes(2);
      expect(mockClient.scorePrompt).toHaveBeenCalledWith('First template content', 'First template');
      expect(mockClient.scorePrompt).toHaveBeenCalledWith('Second template content', 'Second template');
    });

    it('should handle empty template list', async () => {
      mockTemplateService.listTemplates.mockResolvedValue([]);

      await scoreCommand.execute([], { batch: true });

      expect(mockTemplateService.listTemplates).toHaveBeenCalled();
      // Should handle empty list gracefully via spinner.fail
    });

    it('should handle individual template scoring errors in batch', async () => {
      mockTemplateService.listTemplates.mockResolvedValue([
        { name: 'template1', path: '/path/to/template1.json' },
        { name: 'template2', path: '/path/to/template2.json' },
      ]);
      
      mockTemplateService.loadTemplate.mockImplementation((path) => {
        const index = path.includes('template1') ? 0 : 1;
        return Promise.resolve(mockTemplates[index] as any);
      });

      mockTemplateService.renderTemplate.mockImplementation((template, _variables) => {
        return Promise.resolve({
          ...template,
          files: [{
            path: 'template.txt',
            source: 'template.txt',
            destination: 'rendered-template.txt',
            content: (template as any).content, // Cast to access content field
          }]
        });
      });

      mockClient.scorePrompt
        .mockResolvedValueOnce({ ...mockScoreResult, overall: 80 })
        .mockRejectedValueOnce(new Error('Scoring failed for template2'));

      await scoreCommand.execute([], {
        batch: true,
        threshold: 70,
      });

      expect(mockClient.scorePrompt).toHaveBeenCalledTimes(2);
      // Should continue processing despite individual errors
    });

    it('should display batch results summary', async () => {
      mockTemplateService.listTemplates.mockResolvedValue([
        { name: 'template1', path: '/path/to/template1.json' },
        { name: 'template2', path: '/path/to/template2.json' },
      ]);
      
      mockTemplateService.loadTemplate.mockImplementation((path) => {
        const index = path.includes('template1') ? 0 : 1;
        return Promise.resolve(mockTemplates[index] as any);
      });

      mockTemplateService.renderTemplate.mockImplementation((template, _variables) => {
        return Promise.resolve({
          ...template,
          files: [{
            path: 'template.txt',
            source: 'template.txt',
            destination: 'rendered-template.txt',
            content: (template as any).content, // Cast to access content field
          }]
        });
      });

      mockClient.scorePrompt
        .mockResolvedValueOnce({ ...mockScoreResult, overall: 85 })
        .mockResolvedValueOnce({ ...mockScoreResult, overall: 65 }); // Below threshold

      await scoreCommand.execute([], {
        batch: true,
        threshold: 70,
        format: 'table',
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Batch Quality Scoring Results'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Passed: 1/2'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Failed: 1/2'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Summary Statistics'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Average Score:'));
    });
  });

  describe('score color coding and labels', () => {
    const testScores = [
      { score: 95, expectedLabel: 'Excellent' },
      { score: 85, expectedLabel: 'Good' },
      { score: 75, expectedLabel: 'Fair' },
      { score: 65, expectedLabel: 'Poor' },
      { score: 55, expectedLabel: 'Very Poor' },
    ];

    testScores.forEach(({ score, expectedLabel }) => {
      it(`should display correct label for score ${score}`, async () => {
        mockClient.scorePrompt.mockResolvedValue({
          ...mockScoreResult,
          overall: score,
        });

        await scoreCommand.execute([], {
          prompt: 'Test prompt',
          format: 'table',
        });

        expect(mockLog).toHaveBeenCalledWith(expect.stringContaining(expectedLabel));
      });
    });
  });

  describe('report saving', () => {
    beforeEach(() => {
      (scoreCommand as any).success = jest.fn();
      (scoreCommand as any).error = jest.fn();
    });

    it('should save single score report', async () => {
      const mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
      };
      
      jest.doMock('fs', () => mockFs, { virtual: true });
      
      // Ensure the fs module is properly reset
      jest.resetModules();

      await scoreCommand.execute([], {
        prompt: 'Test prompt',
        output: '/path/to/score-report.json',
      });

      expect((scoreCommand as any).success).toHaveBeenCalledWith(
        expect.stringContaining('Score report saved to:')
      );
    });

    it('should save batch score report', async () => {
      const mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
      };
      
      jest.doMock('fs', () => mockFs, { virtual: true });
      
      // Ensure the fs module is properly reset
      jest.resetModules();

      mockTemplateService.listTemplates.mockResolvedValue([
        { name: 'template1', path: '/path/to/template1.json' },
      ]);
      mockTemplateService.loadTemplate.mockResolvedValue({
        id: 'template1',
        name: 'Template 1',
        description: 'First template',
        author: 'Author',
        version: '1.0.0',
        tags: [],
        variables: {},
        metadata: {},
      } as any);

      await scoreCommand.execute([], {
        batch: true,
        output: '/path/to/batch-report.json',
      });

      expect((scoreCommand as any).success).toHaveBeenCalledWith(
        expect.stringContaining('Batch score report saved to:')
      );
    });

    it('should handle save errors gracefully', async () => {
      const mockFs = {
        existsSync: jest.fn().mockReturnValue(true),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn().mockImplementation(() => {
          throw new Error('Write failed');
        }),
      };
      
      jest.doMock('fs', () => mockFs, { virtual: true });
      
      // Ensure the fs module is properly reset
      jest.resetModules();

      await scoreCommand.execute([], {
        prompt: 'Test prompt',
        output: '/path/to/report.json',
      });

      expect((scoreCommand as any).error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save score report:')
      );
    });
  });

  describe('task context handling', () => {
    it('should use provided task context', async () => {
      const taskDescription = 'Generate product descriptions';
      
      await scoreCommand.execute([], {
        prompt: 'Test prompt',
        task: taskDescription,
      });

      expect(mockClient.scorePrompt).toHaveBeenCalledWith('Test prompt', taskDescription);
    });

    it('should extract task from template description', async () => {
      const mockTemplate: Template = {
        id: 'test-template',
        name: 'Test Template',
        description: 'Template for product descriptions',
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
        files: [{
          path: 'template.txt',
          content: 'Rendered content',
          variables: {}
        }]
      } as any);

      await scoreCommand.execute([], {
        template: 'test-template',
      });

      expect(mockClient.scorePrompt).toHaveBeenCalledWith('Rendered content', 'Template for product descriptions');
    });
  });

  describe('error handling', () => {
    it('should handle scoring service errors gracefully', async () => {
      mockClient.scorePrompt.mockRejectedValue(new Error('Scoring service failed'));

      await scoreCommand.execute([], {
        prompt: 'Test prompt',
      });

      expect(mockClient.scorePrompt).toHaveBeenCalled();
      // Should handle error gracefully via spinner.fail
    });
  });
});
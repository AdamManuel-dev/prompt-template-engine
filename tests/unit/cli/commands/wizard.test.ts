/**
 * @fileoverview Unit tests for optimization wizard CLI command
 * @lastmodified 2025-08-26T15:45:00Z
 *
 * Features: Tests for wizard command functionality, step progression, and state management
 * Test Coverage: Command execution, wizard steps, state transitions, user interactions
 * Patterns: Mocked dependencies, async testing, state testing
 */

import { OptimizationWizardCommand } from '../../../../src/cli/commands/wizard';
import { TemplateService } from '../../../../src/services/template.service';
import { CacheService } from '../../../../src/services/cache.service';
import { PromptOptimizationService } from '../../../../src/services/prompt-optimization.service';
import { PromptWizardClient } from '../../../../src/integrations/promptwizard';
import { Template } from '../../../../src/types';

// Mock external dependencies
jest.mock('../../../../src/services/template.service');
jest.mock('../../../../src/services/cache.service');
jest.mock('../../../../src/services/prompt-optimization.service');
jest.mock('../../../../src/integrations/promptwizard');
jest.mock('chalk', () => ({
  blue: {
    bold: jest.fn(str => `[BLUE]${str}[/BLUE]`),
  },
  cyan: jest.fn(str => `[CYAN]${str}[/CYAN]`),
  yellow: {
    bold: jest.fn(str => `[YELLOW]${str}[/YELLOW]`),
  },
  green: {
    bold: jest.fn(str => `[GREEN]${str}[/GREEN]`),
  },
  red: jest.fn(str => `[RED]${str}[/RED]`),
  gray: jest.fn(str => `[GRAY]${str}[/GRAY]`),
  white: {
    bold: jest.fn(str => `[WHITE]${str}[/WHITE]`),
  },
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

// Mock console.clear to avoid clearing test output
jest.spyOn(console, 'clear').mockImplementation(() => {});

describe('OptimizationWizardCommand', () => {
  let wizardCommand: OptimizationWizardCommand;
  let mockTemplateService: jest.Mocked<TemplateService>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockOptimizationService: jest.Mocked<PromptOptimizationService>;
  let mockClient: jest.Mocked<PromptWizardClient>;
  
  // Mock console methods
  const mockLog = jest.spyOn(console, 'log').mockImplementation();
  const mockExit = jest.spyOn(process, 'exit').mockImplementation((code?: number) => {
    throw new Error(`Process exit called with code: ${code}`);
  });

  const mockTemplate: Template = {
    id: 'test-template',
    name: 'Test Template',
    description: 'Template for testing wizard',
    content: 'Test prompt content',
    author: 'Test Author',
    version: '1.0.0',
    tags: [],
    variables: [],
    metadata: {},
    outputConfig: { files: [] },
  };

  const mockScoreResult = {
    overall: 75,
    confidence: 88.5,
    metrics: {
      clarity: 78,
      taskAlignment: 72,
      tokenEfficiency: 75,
    },
    suggestions: ['Add more context', 'Improve clarity'],
  };

  const mockOptimizationResult = {
    requestId: 'req-123',
    templateId: 'test-template',
    optimizedTemplate: {
      content: 'Optimized prompt content that is better',
    },
    metrics: {
      tokenReduction: 15.0,
      accuracyImprovement: 12.0,
      optimizationTime: 3000,
      apiCalls: 4,
    },
    qualityScore: {
      overall: 88,
      metrics: {
        clarity: 90,
        taskAlignment: 86,
        tokenEfficiency: 88,
      },
      suggestions: ['Minor refinements possible'],
    },
    timestamp: new Date().toISOString(),
  };

  const mockComparisonResult = {
    comparisonId: 'comp-123',
    original: {
      score: mockScoreResult,
      estimatedTokens: 100,
      estimatedCost: 0.002,
    },
    optimized: {
      score: mockOptimizationResult.qualityScore,
      estimatedTokens: 85,
      estimatedCost: 0.0017,
    },
    improvements: {
      qualityImprovement: 17.3,
      tokenReduction: 15.0,
      costSavings: 15.0,
    },
    analysis: {
      strengthsGained: ['Better clarity', 'More concise'],
      potentialRisks: ['May need validation'],
      recommendations: ['Test with examples'],
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
    
    mockCacheService = {} as any;
    
    mockOptimizationService = {
      optimizeTemplate: jest.fn().mockResolvedValue(mockOptimizationResult),
      on: jest.fn(),
    } as any;
    
    mockClient = {
      healthCheck: jest.fn().mockResolvedValue(true),
      scorePrompt: jest.fn().mockResolvedValue(mockScoreResult),
      comparePrompts: jest.fn().mockResolvedValue(mockComparisonResult),
    } as any;

    // Mock constructors
    (TemplateService as jest.MockedClass<typeof TemplateService>).mockImplementation(() => mockTemplateService);
    (CacheService as jest.MockedClass<typeof CacheService>).mockImplementation(() => mockCacheService);
    (PromptOptimizationService as jest.MockedClass<typeof PromptOptimizationService>).mockImplementation(() => mockOptimizationService);
    (PromptWizardClient as jest.MockedClass<typeof PromptWizardClient>).mockImplementation(() => mockClient);

    wizardCommand = new OptimizationWizardCommand();
  });

  afterEach(() => {
    mockLog.mockRestore();
    mockExit.mockRestore();
  });

  describe('command metadata', () => {
    it('should have correct command name', () => {
      expect(wizardCommand.name).toBe('prompt:wizard');
    });

    it('should have correct description', () => {
      expect(wizardCommand.description).toBe('Interactive optimization wizard with guided step-by-step refinement');
    });

    it('should have correct aliases', () => {
      expect(wizardCommand.aliases).toEqual(['wizard', 'guide']);
    });

    it('should have all required options', () => {
      const optionFlags = wizardCommand.options.map(opt => opt.flags);
      expect(optionFlags).toContain('-t, --template <name>');
      expect(optionFlags).toContain('--skip-intro');
      expect(optionFlags).toContain('-m, --mode <type>');
    });
  });

  describe('service initialization and health checks', () => {
    it('should exit with error if service health check fails', async () => {
      mockClient.healthCheck.mockResolvedValue(false);

      await expect(async () => {
        await wizardCommand.execute([], {});
      }).rejects.toThrow('Process exit called with code: 1');
    });

    it('should proceed if service health check passes', async () => {
      wizardCommand.confirm = jest.fn().mockResolvedValue(true);
      wizardCommand.prompt = jest.fn().mockResolvedValue('test prompt');
      wizardCommand.confirm = jest.fn().mockResolvedValue(false); // Skip save at end

      await wizardCommand.execute([], { skipIntro: true });
      
      expect(mockClient.healthCheck).toHaveBeenCalled();
    });
  });

  describe('wizard introduction', () => {
    it('should show introduction by default', async () => {
      wizardCommand.confirm = jest.fn()
        .mockResolvedValueOnce(true) // Continue with wizard
        .mockResolvedValueOnce(false); // Don't save at end
      wizardCommand.prompt = jest.fn().mockResolvedValue('test prompt');

      await wizardCommand.execute([], {});

      expect(wizardCommand.confirm).toHaveBeenCalledWith('Ready to start optimizing your prompts?');
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('🧙 PromptWizard Optimization Wizard'));
    });

    it('should skip introduction when requested', async () => {
      wizardCommand.prompt = jest.fn().mockResolvedValue('test prompt');
      wizardCommand.confirm = jest.fn().mockResolvedValue(false); // Don't save at end

      await wizardCommand.execute([], { skipIntro: true });

      expect(wizardCommand.confirm).not.toHaveBeenCalledWith('Ready to start optimizing your prompts?');
    });

    it('should exit when user declines to continue', async () => {
      wizardCommand.confirm = jest.fn().mockResolvedValue(false);

      await expect(async () => {
        await wizardCommand.execute([], {});
      }).rejects.toThrow('Process exit called with code: 0');

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Wizard cancelled'));
    });
  });

  describe('wizard modes and step configuration', () => {
    it('should configure correct steps for beginner mode', async () => {
      wizardCommand.prompt = jest.fn().mockResolvedValue('test prompt');
      wizardCommand.confirm = jest.fn().mockResolvedValue(false);

      await wizardCommand.execute([], { skipIntro: true, mode: 'beginner' });

      // Beginner mode should have 5 steps
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Step 1/5'));
    });

    it('should configure correct steps for advanced mode', async () => {
      wizardCommand.prompt = jest.fn().mockResolvedValue('test prompt');
      wizardCommand.confirm = jest.fn().mockResolvedValue(false);

      await wizardCommand.execute([], { skipIntro: true, mode: 'advanced' });

      // Advanced mode should have 6 steps
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Step 1/6'));
    });

    it('should configure correct steps for expert mode', async () => {
      wizardCommand.prompt = jest.fn().mockResolvedValue('test prompt');
      wizardCommand.confirm = jest.fn().mockResolvedValue(false);

      await wizardCommand.execute([], { skipIntro: true, mode: 'expert' });

      // Expert mode should have 8 steps
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Step 1/8'));
    });
  });

  describe('step 1: prompt selection', () => {
    beforeEach(() => {
      wizardCommand.prompt = jest.fn();
      wizardCommand.error = jest.fn();
      wizardCommand.confirm = jest.fn().mockResolvedValue(false); // Don't save at end
    });

    it('should use provided template', async () => {
      mockTemplateService.findTemplate.mockResolvedValue('/path/to/template.json');
      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockTemplateService.renderTemplate.mockResolvedValue({
        files: [{ path: 'output.txt', content: 'Rendered template content' }],
        metadata: {},
      });

      await wizardCommand.execute([], {
        skipIntro: true,
        template: 'test-template',
      });

      expect(mockTemplateService.findTemplate).toHaveBeenCalledWith('test-template');
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Template: test-template'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('✓ Template loaded successfully'));
    });

    it('should handle template not found', async () => {
      mockTemplateService.findTemplate.mockResolvedValue(null);
      (wizardCommand.prompt as jest.Mock).mockResolvedValue('Direct prompt text');

      await wizardCommand.execute([], {
        skipIntro: true,
        template: 'nonexistent-template',
      });

      expect(wizardCommand.error).toHaveBeenCalledWith('Template not found: nonexistent-template');
    });

    it('should prompt for template when user chooses template option', async () => {
      (wizardCommand.prompt as jest.Mock)
        .mockResolvedValueOnce('Press Enter to continue') // Step 1 continue
        .mockResolvedValueOnce('Press Enter to continue') // Step 2 continue
        .mockResolvedValueOnce('Press Enter to start optimization') // Step 3 continue
        .mockResolvedValueOnce('Press Enter to see detailed comparison') // Step 4 continue
        .mockResolvedValueOnce('Press Enter to continue') // Step 5 continue
        .mockResolvedValueOnce('t') // Choose template
        .mockResolvedValueOnce('user-template');

      mockTemplateService.findTemplate.mockResolvedValue('/path/to/user-template.json');
      mockTemplateService.loadTemplate.mockResolvedValue({
        ...mockTemplate,
        name: 'User Template',
      });
      mockTemplateService.renderTemplate.mockResolvedValue({
        files: [{ path: 'output.txt', content: 'User template content' }],
        metadata: {},
      });

      await wizardCommand.execute([], { skipIntro: true });

      expect(wizardCommand.prompt).toHaveBeenCalledWith('Enter (t)emplate name or (p)rompt text directly? [t/p]');
      expect(wizardCommand.prompt).toHaveBeenCalledWith('Template name');
    });

    it('should accept direct prompt text', async () => {
      (wizardCommand.prompt as jest.Mock)
        .mockResolvedValueOnce('Press Enter to continue') // Step 1 continue
        .mockResolvedValueOnce('Press Enter to continue') // Step 2 continue
        .mockResolvedValueOnce('Press Enter to start optimization') // Step 3 continue
        .mockResolvedValueOnce('Press Enter to see detailed comparison') // Step 4 continue
        .mockResolvedValueOnce('Press Enter to continue') // Step 5 continue
        .mockResolvedValueOnce('p') // Choose prompt text
        .mockResolvedValueOnce('Direct prompt text')
        .mockResolvedValueOnce('Task description');

      await wizardCommand.execute([], { skipIntro: true });

      expect(wizardCommand.prompt).toHaveBeenCalledWith('Prompt text');
      expect(wizardCommand.prompt).toHaveBeenCalledWith('Task description');
    });

    it('should throw error if no prompt content provided', async () => {
      (wizardCommand.prompt as jest.Mock)
        .mockResolvedValueOnce('p') // Choose prompt text
        .mockResolvedValueOnce(''); // Empty prompt

      await expect(async () => {
        await wizardCommand.execute([], { skipIntro: true });
      }).rejects.toThrow('Wizard failed: No prompt content provided');
    });
  });

  describe('step 2: quality analysis', () => {
    beforeEach(() => {
      wizardCommand.prompt = jest.fn().mockResolvedValue('Press Enter to continue');
      wizardCommand.confirm = jest.fn().mockResolvedValue(false);
    });

    it('should analyze prompt quality and display results', async () => {
      await wizardCommand.execute([], {
        skipIntro: true,
        template: 'test-template',
      });

      expect(mockClient.scorePrompt).toHaveBeenCalled();
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Step 2: Analyze Current Quality'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Overall Score:'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Confidence:'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Detailed Metrics:'));
    });

    it('should provide different messages based on score', async () => {
      // Test low score message
      mockClient.scorePrompt.mockResolvedValue({
        ...mockScoreResult,
        overall: 65,
      });

      await wizardCommand.execute([], {
        skipIntro: true,
        template: 'test-template',
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Good news! There\'s significant room for optimization'));
    });

    it('should handle quality analysis errors', async () => {
      mockClient.scorePrompt.mockRejectedValue(new Error('Scoring failed'));

      await expect(async () => {
        await wizardCommand.execute([], {
          skipIntro: true,
          template: 'test-template',
        });
      }).rejects.toThrow('Wizard failed: Scoring failed');
    });
  });

  describe('step 3: configuration', () => {
    beforeEach(() => {
      wizardCommand.prompt = jest.fn()
        .mockResolvedValueOnce('Press Enter to continue') // Step 1
        .mockResolvedValueOnce('Press Enter to continue') // Step 2
        .mockResolvedValueOnce('Press Enter to start optimization'); // Step 3
      wizardCommand.confirm = jest.fn().mockResolvedValue(false);
    });

    it('should use recommended settings for beginner mode', async () => {
      await wizardCommand.execute([], {
        skipIntro: true,
        mode: 'beginner',
        template: 'test-template',
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Using recommended settings'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Configuration Summary:'));
    });

    it('should allow custom configuration for advanced mode', async () => {
      (wizardCommand.prompt as jest.Mock)
        .mockResolvedValueOnce('Press Enter to continue') // Step 1
        .mockResolvedValueOnce('Press Enter to continue') // Step 2
        .mockResolvedValueOnce('claude-3-opus') // Model choice
        .mockResolvedValueOnce('5') // Iterations
        .mockResolvedValueOnce('8') // Examples
        .mockResolvedValueOnce('no') // Reasoning
        .mockResolvedValueOnce('Press Enter to start optimization'); // Step 3 continue

      await wizardCommand.execute([], {
        skipIntro: true,
        mode: 'advanced',
        template: 'test-template',
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('claude-3-opus'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('5'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('8'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('No'));
    });
  });

  describe('step 4: optimization execution', () => {
    beforeEach(() => {
      wizardCommand.prompt = jest.fn()
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to start optimization')
        .mockResolvedValueOnce('Press Enter to see detailed comparison');
      wizardCommand.confirm = jest.fn().mockResolvedValue(false);
    });

    it('should run optimization and display results', async () => {
      await wizardCommand.execute([], {
        skipIntro: true,
        template: 'test-template',
      });

      expect(mockOptimizationService.optimizeTemplate).toHaveBeenCalled();
      expect(mockOptimizationService.on).toHaveBeenCalledWith('optimization:started', expect.any(Function));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('🎉 Optimization Results:'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Token Reduction:'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Accuracy Improvement:'));
    });

    it('should handle optimization failures', async () => {
      mockOptimizationService.optimizeTemplate.mockRejectedValue(new Error('Optimization failed'));

      await expect(async () => {
        await wizardCommand.execute([], {
          skipIntro: true,
          template: 'test-template',
        });
      }).rejects.toThrow('Wizard failed: Optimization failed');
    });
  });

  describe('step 5: results comparison', () => {
    beforeEach(() => {
      wizardCommand.prompt = jest.fn()
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to start optimization')
        .mockResolvedValueOnce('Press Enter to see detailed comparison')
        .mockResolvedValueOnce('Press Enter to continue');
      wizardCommand.confirm = jest.fn()
        .mockResolvedValueOnce(true) // Satisfied with results
        .mockResolvedValueOnce(false); // Don't save
    });

    it('should compare results and display improvements', async () => {
      await wizardCommand.execute([], {
        skipIntro: true,
        template: 'test-template',
      });

      expect(mockClient.comparePrompts).toHaveBeenCalled();
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('📊 Before vs After'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('🎯 Key Improvements:'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('✨ Optimized Content:'));
      expect(wizardCommand.confirm).toHaveBeenCalledWith('Are you satisfied with these results?');
    });

    it('should allow refinement when user is not satisfied', async () => {
      wizardCommand.confirm = jest.fn()
        .mockResolvedValueOnce(false) // Not satisfied with results
        .mockResolvedValueOnce(false); // Don't save (after re-optimization)

      await wizardCommand.execute([], {
        skipIntro: true,
        template: 'test-template',
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Let\'s try refining the optimization'));
    });

    it('should handle comparison failures', async () => {
      mockClient.comparePrompts.mockRejectedValue(new Error('Comparison failed'));

      await expect(async () => {
        await wizardCommand.execute([], {
          skipIntro: true,
          template: 'test-template',
        });
      }).rejects.toThrow('Wizard failed: Comparison failed');
    });
  });

  describe('completion and saving', () => {
    beforeEach(() => {
      wizardCommand.prompt = jest.fn()
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to start optimization')
        .mockResolvedValueOnce('Press Enter to see detailed comparison')
        .mockResolvedValueOnce('Press Enter to continue');
      wizardCommand.success = jest.fn();
      wizardCommand.error = jest.fn();
    });

    it('should show completion summary', async () => {
      wizardCommand.confirm = jest.fn()
        .mockResolvedValueOnce(true) // Satisfied with results
        .mockResolvedValueOnce(false); // Don't save

      await wizardCommand.execute([], {
        skipIntro: true,
        template: 'test-template',
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('🎉 Optimization Complete!'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Optimization Summary:'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Original Score:'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Final Score:'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Improvement:'));
    });

    it('should save optimized prompt when requested', async () => {
      const mockFs = {
        writeFileSync: jest.fn(),
      };
      
      jest.doMock('fs', () => mockFs, { virtual: true });

      wizardCommand.confirm = jest.fn()
        .mockResolvedValueOnce(true) // Satisfied with results
        .mockResolvedValueOnce(true); // Save prompt

      (wizardCommand.prompt as jest.Mock)
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to start optimization')
        .mockResolvedValueOnce('Press Enter to see detailed comparison')
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('output.json'); // Output path

      await wizardCommand.execute([], {
        skipIntro: true,
        template: 'test-template',
      });

      expect(wizardCommand.confirm).toHaveBeenCalledWith('Would you like to save the optimized prompt?');
      expect(wizardCommand.prompt).toHaveBeenCalledWith('Output file path', 'optimized-prompt.json');
      expect(wizardCommand.success).toHaveBeenCalledWith(expect.stringContaining('Optimized prompt saved to:'));
    });

    it('should handle save errors gracefully', async () => {
      const mockFs = {
        writeFileSync: jest.fn().mockImplementation(() => {
          throw new Error('Write failed');
        }),
      };
      
      jest.doMock('fs', () => mockFs, { virtual: true });

      wizardCommand.confirm = jest.fn()
        .mockResolvedValueOnce(true) // Satisfied with results
        .mockResolvedValueOnce(true); // Save prompt

      (wizardCommand.prompt as jest.Mock)
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to start optimization')
        .mockResolvedValueOnce('Press Enter to see detailed comparison')
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('output.json');

      await wizardCommand.execute([], {
        skipIntro: true,
        template: 'test-template',
      });

      expect(wizardCommand.error).toHaveBeenCalledWith(expect.stringContaining('Failed to save optimized prompt:'));
    });
  });

  describe('advanced and expert steps', () => {
    beforeEach(() => {
      wizardCommand.prompt = jest.fn().mockResolvedValue('Press Enter to continue');
      wizardCommand.confirm = jest.fn()
        .mockResolvedValueOnce(true) // Satisfied with results
        .mockResolvedValueOnce(false); // Don't save
    });

    it('should include refinement step for advanced mode', async () => {
      await wizardCommand.execute([], {
        skipIntro: true,
        mode: 'advanced',
        template: 'test-template',
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Step 6: Refine Settings'));
    });

    it('should include advanced tuning step for expert mode', async () => {
      await wizardCommand.execute([], {
        skipIntro: true,
        mode: 'expert',
        template: 'test-template',
      });

      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Step 7: Advanced Tuning'));
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Step 8: Expert Analysis'));
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle service initialization errors', async () => {
      // Mock constructor to throw
      (PromptWizardClient as jest.MockedClass<typeof PromptWizardClient>).mockImplementation(() => {
        throw new Error('Service init failed');
      });

      const newWizard = new OptimizationWizardCommand();
      
      await expect(async () => {
        await newWizard.execute([], {});
      }).rejects.toThrow('Process exit called with code: 1');
    });

    it('should handle wizard execution errors gracefully', async () => {
      wizardCommand.prompt = jest.fn().mockRejectedValue(new Error('Prompt failed'));

      await expect(async () => {
        await wizardCommand.execute([], { skipIntro: true });
      }).rejects.toThrow('Wizard failed: Prompt failed');
    });
  });

  describe('state management', () => {
    it('should maintain wizard state throughout execution', async () => {
      wizardCommand.prompt = jest.fn()
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to continue')
        .mockResolvedValueOnce('Press Enter to start optimization')
        .mockResolvedValueOnce('Press Enter to see detailed comparison')
        .mockResolvedValueOnce('Press Enter to continue');
      wizardCommand.confirm = jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await wizardCommand.execute([], {
        skipIntro: true,
        template: 'test-template',
      });

      // Verify that state is maintained by checking optimization call
      expect(mockOptimizationService.optimizeTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'test-template',
        })
      );
    });
  });
});
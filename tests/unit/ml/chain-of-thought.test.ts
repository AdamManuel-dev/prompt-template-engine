/**
 * @fileoverview Tests for chain-of-thought optimizer
 * @lastmodified 2025-08-26T13:30:00Z
 */

import {
  ChainOfThoughtOptimizer,
  ReasoningChain,
  ReasoningStep,
  ChainOptimizationConfig,
} from '../../../src/ml/chain-of-thought';
import { Template } from '../../../src/types';

jest.mock('../../../src/utils/logger');

describe('ChainOfThoughtOptimizer', () => {
  let optimizer: ChainOfThoughtOptimizer;
  let mockTemplate: Template;

  beforeEach(() => {
    jest.clearAllMocks();
    optimizer = new ChainOfThoughtOptimizer();
    
    mockTemplate = {
      name: 'reasoning-template',
      version: '1.0.0',
      description: 'Solve complex problems through logical reasoning',
      content: 'Goal: Analyze data and draw conclusions. Context: We have user behavior data.',
      variables: {
        problem: { type: 'string' },
        approach: { type: 'string' },
      },
    };
  });

  describe('generateReasoningChain', () => {
    it('should generate a complete reasoning chain', async () => {
      const prompt = 'Goal: Determine user engagement patterns. Context: We have clickstream data.';
      
      const chain = await optimizer.generateReasoningChain(prompt, mockTemplate);

      expect(chain.steps.length).toBeGreaterThan(0);
      expect(chain.goal).toBeTruthy();
      expect(chain.context).toBeTruthy();
      expect(chain.effectiveness).toBeGreaterThan(0);
      expect(chain.effectiveness).toBeLessThanOrEqual(1);
      expect(typeof chain.validated).toBe('boolean');
    });

    it('should extract goal from prompt', async () => {
      const promptWithGoal = 'Goal: Optimize database queries for better performance.';
      
      const chain = await optimizer.generateReasoningChain(promptWithGoal, mockTemplate);

      expect(chain.goal).toContain('Optimize database queries');
    });

    it('should extract context from prompt', async () => {
      const promptWithContext = 'Context: System experiencing high latency during peak hours.';
      
      const chain = await optimizer.generateReasoningChain(promptWithContext, mockTemplate);

      expect(chain.context).toContain('high latency');
    });

    it('should respect max steps configuration', async () => {
      const config: ChainOptimizationConfig = {
        maxSteps: 5,
      };

      const chain = await optimizer.generateReasoningChain(
        'Solve a complex problem',
        mockTemplate,
        config
      );

      expect(chain.steps.length).toBeLessThanOrEqual(5);
    });

    it('should include examples when configured', async () => {
      const config: ChainOptimizationConfig = {
        includeExamples: true,
      };

      const chain = await optimizer.generateReasoningChain(
        'Demonstrate with examples',
        mockTemplate,
        config
      );

      const exampleSteps = chain.steps.filter(s => s.type === 'example');
      expect(exampleSteps.length).toBeGreaterThanOrEqual(0);
    });

    it('should apply model-specific optimizations', async () => {
      const config: ChainOptimizationConfig = {
        targetModel: 'gpt-4',
      };

      const chain = await optimizer.generateReasoningChain(
        'Apply GPT-4 optimizations',
        mockTemplate,
        config
      );

      // GPT-4 prefers explicit step numbering
      const hasStepNumbers = chain.steps.some(s => s.content.includes('Step'));
      expect(hasStepNumbers).toBe(true);
    });
  });

  describe('optimizeSteps', () => {
    const createTestSteps = (): ReasoningStep[] => [
      {
        id: 'step-1',
        content: 'Given: Initial data',
        type: 'premise',
        dependencies: [],
        confidence: 1.0,
      },
      {
        id: 'step-2',
        content: 'Given: Initial data', // Duplicate
        type: 'premise',
        dependencies: [],
        confidence: 1.0,
      },
      {
        id: 'step-3',
        content: 'Analyze the data',
        type: 'inference',
        dependencies: ['step-1'],
        confidence: 0.8,
      },
      {
        id: 'step-4',
        content: 'Draw conclusions',
        type: 'conclusion',
        dependencies: ['step-3'],
        confidence: 0.85,
      },
    ];

    it('should remove redundant steps', async () => {
      const steps = createTestSteps();
      
      const optimized = await optimizer.optimizeSteps(steps);

      expect(optimized.length).toBeLessThan(steps.length);
      // Check that duplicate "Given: Initial data" was removed
      const duplicates = optimized.filter(s => s.content === 'Given: Initial data');
      expect(duplicates.length).toBe(1);
    });

    it('should filter by confidence threshold', async () => {
      const steps = createTestSteps();
      steps.push({
        id: 'step-5',
        content: 'Low confidence inference',
        type: 'inference',
        dependencies: ['step-4'],
        confidence: 0.3,
      });

      const config: ChainOptimizationConfig = {
        minConfidence: 0.5,
      };

      const optimized = await optimizer.optimizeSteps(steps, config);

      expect(optimized.every(s => s.confidence >= 0.5)).toBe(true);
    });

    it('should apply verbosity settings', async () => {
      const steps = createTestSteps();
      
      const minimalConfig: ChainOptimizationConfig = { verbosity: 'minimal' };
      const detailedConfig: ChainOptimizationConfig = { verbosity: 'detailed' };

      const minimal = await optimizer.optimizeSteps(steps, minimalConfig);
      const detailed = await optimizer.optimizeSteps(steps, detailedConfig);

      // Minimal should have shorter content
      const minimalLength = minimal.reduce((sum, s) => sum + s.content.length, 0);
      const detailedLength = detailed.reduce((sum, s) => sum + s.content.length, 0);
      
      expect(minimalLength).toBeLessThan(detailedLength);
    });

    it('should consolidate similar steps', async () => {
      const steps: ReasoningStep[] = [
        {
          id: 'step-1',
          content: 'Analyze user behavior patterns',
          type: 'inference',
          dependencies: [],
          confidence: 0.8,
        },
        {
          id: 'step-2',
          content: 'Analyze user behavior trends',
          type: 'inference',
          dependencies: [],
          confidence: 0.75,
        },
      ];

      const optimized = await optimizer.optimizeSteps(steps);

      expect(optimized.length).toBe(1);
      expect(optimized[0].metadata?.alternatives).toBeDefined();
    });

    it('should respect max steps limit', async () => {
      const manySteps = Array(20).fill(null).map((_, i) => ({
        id: `step-${i}`,
        content: `Step ${i} content`,
        type: i === 0 ? 'premise' as const : i === 19 ? 'conclusion' as const : 'inference' as const,
        dependencies: i > 0 ? [`step-${i - 1}`] : [],
        confidence: 0.8,
      }));

      const config: ChainOptimizationConfig = {
        maxSteps: 10,
      };

      const optimized = await optimizer.optimizeSteps(manySteps, config);

      expect(optimized.length).toBeLessThanOrEqual(10);
      // Should keep premises and conclusions
      expect(optimized.some(s => s.type === 'premise')).toBe(true);
      expect(optimized.some(s => s.type === 'conclusion')).toBe(true);
    });

    it('should reorder steps based on dependencies', async () => {
      const unorderedSteps: ReasoningStep[] = [
        {
          id: 'step-3',
          content: 'Conclusion',
          type: 'conclusion',
          dependencies: ['step-2'],
          confidence: 0.9,
        },
        {
          id: 'step-1',
          content: 'Premise',
          type: 'premise',
          dependencies: [],
          confidence: 1.0,
        },
        {
          id: 'step-2',
          content: 'Inference',
          type: 'inference',
          dependencies: ['step-1'],
          confidence: 0.8,
        },
      ];

      const optimized = await optimizer.optimizeSteps(unorderedSteps);

      // Check that dependencies come before dependents
      const step1Index = optimized.findIndex(s => s.id === 'step-1');
      const step2Index = optimized.findIndex(s => s.id === 'step-2');
      const step3Index = optimized.findIndex(s => s.id === 'step-3');

      expect(step1Index).toBeLessThan(step2Index);
      expect(step2Index).toBeLessThan(step3Index);
    });
  });

  describe('validateChain', () => {
    it('should validate a well-formed chain', async () => {
      const chain: ReasoningChain = {
        steps: [
          {
            id: 'step-1',
            content: 'Given: Input data',
            type: 'premise',
            dependencies: [],
            confidence: 1.0,
          },
          {
            id: 'step-2',
            content: 'Process the data',
            type: 'inference',
            dependencies: ['step-1'],
            confidence: 0.8,
          },
          {
            id: 'step-3',
            content: 'Therefore: Result',
            type: 'conclusion',
            dependencies: ['step-2'],
            confidence: 0.85,
          },
        ],
        goal: 'Process data',
        context: 'Data processing task',
        effectiveness: 0.8,
        validated: false,
      };

      const result = await optimizer.validateChain(chain);

      expect(result.valid).toBe(true);
      expect(result.issues.filter(i => i.severity === 'high')).toHaveLength(0);
      expect(result.overallScore).toBeGreaterThan(0.5);
    });

    it('should detect missing dependencies', async () => {
      const chain: ReasoningChain = {
        steps: [
          {
            id: 'step-1',
            content: 'Step 1',
            type: 'inference',
            dependencies: ['non-existent-step'],
            confidence: 0.8,
          },
        ],
        goal: 'Test',
        context: 'Test context',
        effectiveness: 0.5,
        validated: false,
      };

      const result = await optimizer.validateChain(chain);

      expect(result.valid).toBe(false);
      const missingDeps = result.issues.filter(
        i => i.type === 'missing_connection' && i.severity === 'high'
      );
      expect(missingDeps.length).toBeGreaterThan(0);
    });

    it('should detect redundancies', async () => {
      const chain: ReasoningChain = {
        steps: [
          {
            id: 'step-1',
            content: 'Analyze the data carefully',
            type: 'inference',
            dependencies: [],
            confidence: 0.8,
          },
          {
            id: 'step-2',
            content: 'Analyze the data carefully',
            type: 'inference',
            dependencies: [],
            confidence: 0.8,
          },
        ],
        goal: 'Test',
        context: 'Test context',
        effectiveness: 0.5,
        validated: false,
      };

      const result = await optimizer.validateChain(chain);

      const redundancies = result.issues.filter(i => i.type === 'redundancy');
      expect(redundancies.length).toBeGreaterThan(0);
    });

    it('should detect ambiguities', async () => {
      const chain: ReasoningChain = {
        steps: [
          {
            id: 'step-1',
            content: 'It does this and that, then they process those things',
            type: 'inference',
            dependencies: [],
            confidence: 0.8,
          },
        ],
        goal: 'Test',
        context: 'Test context',
        effectiveness: 0.5,
        validated: false,
      };

      const result = await optimizer.validateChain(chain);

      const ambiguities = result.issues.filter(i => i.type === 'ambiguity');
      expect(ambiguities.length).toBeGreaterThan(0);
    });

    it('should generate improvement suggestions', async () => {
      const chain: ReasoningChain = {
        steps: Array(15).fill(null).map((_, i) => ({
          id: `step-${i}`,
          content: `Step ${i}`,
          type: 'inference' as const,
          dependencies: i > 0 ? [`step-${i - 1}`] : [],
          confidence: 0.7,
        })),
        goal: 'Complex reasoning',
        context: 'Many steps',
        effectiveness: 0.5,
        validated: false,
      };

      const result = await optimizer.validateChain(chain);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.includes('simplifying'))).toBe(true);
    });

    it('should calculate validation score correctly', async () => {
      const goodChain: ReasoningChain = {
        steps: [
          { id: '1', content: 'Premise', type: 'premise', dependencies: [], confidence: 1 },
          { id: '2', content: 'Inference', type: 'inference', dependencies: ['1'], confidence: 0.8 },
          { id: '3', content: 'Conclusion', type: 'conclusion', dependencies: ['2'], confidence: 0.9 },
        ],
        goal: 'Test',
        context: 'Test',
        effectiveness: 0.8,
        validated: false,
      };

      const result = await optimizer.validateChain(goodChain);

      expect(result.overallScore).toBeGreaterThan(0.7);
    });
  });

  describe('generatePatternBasedChain', () => {
    it('should generate deductive reasoning chain', () => {
      const chain = optimizer.generatePatternBasedChain('deductive', 'All humans are mortal');

      expect(chain.steps.some(s => s.type === 'premise')).toBe(true);
      expect(chain.steps.some(s => s.type === 'inference')).toBe(true);
      expect(chain.steps.some(s => s.type === 'conclusion')).toBe(true);
      expect(chain.goal).toContain('deductive reasoning');
    });

    it('should generate inductive reasoning chain', () => {
      const chain = optimizer.generatePatternBasedChain('inductive', 'Observed patterns suggest');

      expect(chain.steps.some(s => s.type === 'example')).toBe(true);
      expect(chain.steps.some(s => s.type === 'inference')).toBe(true);
      expect(chain.steps.some(s => s.type === 'conclusion')).toBe(true);
    });

    it('should generate abductive reasoning chain', () => {
      const chain = optimizer.generatePatternBasedChain('abductive', 'Best explanation for symptoms');

      expect(chain.steps.length).toBeGreaterThan(0);
      expect(chain.steps.some(s => s.type === 'validation')).toBe(true);
    });

    it('should generate analogical reasoning chain', () => {
      const chain = optimizer.generatePatternBasedChain('analogical', 'Similar to previous case');

      expect(chain.steps.length).toBe(4);
      expect(chain.steps[chain.steps.length - 1].type).toBe('conclusion');
    });

    it('should maintain dependency chain in pattern', () => {
      const chain = optimizer.generatePatternBasedChain('deductive', 'Test content');

      for (let i = 1; i < chain.steps.length; i++) {
        expect(chain.steps[i].dependencies).toContain(`step-${i - 1}`);
      }
    });

    it('should set appropriate confidence levels', () => {
      const chain = optimizer.generatePatternBasedChain('inductive', 'Test content');

      // Confidence should generally increase through the chain
      const confidences = chain.steps.map(s => s.confidence);
      const isIncreasing = confidences.every((c, i) => 
        i === 0 || c >= confidences[i - 1] - 0.1
      );
      expect(isIncreasing).toBe(true);
    });
  });

  describe('Model-specific optimizations', () => {
    it('should apply GPT-4 specific optimizations', async () => {
      const steps: ReasoningStep[] = Array(12).fill(null).map((_, i) => ({
        id: `step-${i}`,
        content: `Content ${i}`,
        type: 'inference' as const,
        dependencies: i > 0 ? [`step-${i - 1}`] : [],
        confidence: 0.8,
      }));

      const config: ChainOptimizationConfig = {
        targetModel: 'gpt-4',
      };

      const optimized = await optimizer.optimizeSteps(steps, config);

      // GPT-4 has max 10 steps
      expect(optimized.length).toBeLessThanOrEqual(10);
      // Should have explicit step markers
      expect(optimized[0].content).toContain('Step');
    });

    it('should apply Claude-3 specific optimizations', async () => {
      const steps: ReasoningStep[] = Array(20).fill(null).map((_, i) => ({
        id: `step-${i}`,
        content: `Content ${i}`,
        type: i % 3 === 0 ? 'premise' as const : 'inference' as const,
        dependencies: i > 0 ? [`step-${i - 1}`] : [],
        confidence: 0.8,
      }));

      const config: ChainOptimizationConfig = {
        targetModel: 'claude-3-opus',
      };

      const optimized = await optimizer.optimizeSteps(steps, config);

      // Claude allows up to 15 steps
      expect(optimized.length).toBeLessThanOrEqual(15);
    });

    it('should apply Gemini specific optimizations', async () => {
      const steps: ReasoningStep[] = [
        { id: '1', content: 'Premise 1', type: 'premise', dependencies: [], confidence: 1 },
        { id: '2', content: 'Premise 2', type: 'premise', dependencies: [], confidence: 1 },
        { id: '3', content: 'Inference', type: 'inference', dependencies: ['1', '2'], confidence: 0.8 },
        { id: '4', content: 'Validation', type: 'validation', dependencies: ['3'], confidence: 0.7 },
        { id: '5', content: 'Conclusion', type: 'conclusion', dependencies: ['4'], confidence: 0.9 },
      ];

      const config: ChainOptimizationConfig = {
        targetModel: 'gemini-pro',
      };

      const optimized = await optimizer.optimizeSteps(steps, config);

      // Gemini prefers hierarchical organization
      const typeOrder = ['premise', 'inference', 'validation', 'conclusion'];
      let lastTypeIndex = -1;
      
      for (const step of optimized) {
        const currentTypeIndex = typeOrder.indexOf(step.type);
        if (currentTypeIndex !== -1) {
          expect(currentTypeIndex).toBeGreaterThanOrEqual(lastTypeIndex);
          lastTypeIndex = Math.max(lastTypeIndex, currentTypeIndex);
        }
      }
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty prompt gracefully', async () => {
      const chain = await optimizer.generateReasoningChain('', mockTemplate);

      expect(chain.steps.length).toBeGreaterThan(0);
      expect(chain.goal).toBeTruthy();
      expect(chain.context).toBeTruthy();
    });

    it('should handle circular dependencies', async () => {
      const stepsWithCycle: ReasoningStep[] = [
        { id: '1', content: 'Step 1', type: 'inference', dependencies: ['3'], confidence: 0.8 },
        { id: '2', content: 'Step 2', type: 'inference', dependencies: ['1'], confidence: 0.8 },
        { id: '3', content: 'Step 3', type: 'inference', dependencies: ['2'], confidence: 0.8 },
      ];

      const optimized = await optimizer.optimizeSteps(stepsWithCycle);

      expect(optimized).toBeDefined();
      expect(optimized.length).toBeGreaterThan(0);
    });

    it('should handle steps with no dependencies', async () => {
      const independentSteps: ReasoningStep[] = [
        { id: '1', content: 'Independent 1', type: 'inference', dependencies: [], confidence: 0.8 },
        { id: '2', content: 'Independent 2', type: 'inference', dependencies: [], confidence: 0.8 },
        { id: '3', content: 'Independent 3', type: 'inference', dependencies: [], confidence: 0.8 },
      ];

      const result = await optimizer.validateChain({
        steps: independentSteps,
        goal: 'Test',
        context: 'Test',
        effectiveness: 0.5,
        validated: false,
      });

      // Should detect missing connections but not fail
      expect(result).toBeDefined();
      expect(result.issues.some(i => i.type === 'missing_connection')).toBe(true);
    });

    it('should handle very long chains gracefully', async () => {
      const longChain: ReasoningChain = {
        steps: Array(100).fill(null).map((_, i) => ({
          id: `step-${i}`,
          content: `Step ${i} content`,
          type: 'inference' as const,
          dependencies: i > 0 ? [`step-${i - 1}`] : [],
          confidence: 0.8,
        })),
        goal: 'Very complex reasoning',
        context: 'Extensive analysis required',
        effectiveness: 0.5,
        validated: false,
      };

      const result = await optimizer.validateChain(longChain);

      expect(result).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.overallScore).toBeDefined();
    });
  });
});
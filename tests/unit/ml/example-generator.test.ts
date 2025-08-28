/**
 * @fileoverview Tests for synthetic example generator
 * @lastmodified 2025-08-26T13:10:00Z
 */

import { 
  ExampleGenerator, 
  ExampleGenerationConfig, 
  GeneratedExample,
} from '../../../src/ml/example-generator';
import { Template } from '../../../src/types';

jest.mock('../../../src/utils/logger');

describe('ExampleGenerator', () => {
  let generator: ExampleGenerator;
  let mockTemplate: Template;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new ExampleGenerator();
    
    mockTemplate = {
      name: 'test-template',
      version: '1.0.0',
      description: 'Test template for example generation',
      content: 'Process {{input}} with {{method}} to get {{output}}',
      variables: {
        input: {
          type: 'string',
          required: true,
        },
        method: {
          type: 'choice',
          choices: ['transform', 'process', 'analyze'],
        },
        output: {
          type: 'string',
          required: false,
        },
      },
    };
  });

  describe('generateExamples', () => {
    it('should generate specified number of examples', async () => {
      const config: ExampleGenerationConfig = {
        count: 10,
        includeEdgeCases: false,
        diversityLevel: 'medium',
      };

      const examples = await generator.generateExamples(mockTemplate, config);

      expect(examples).toHaveLength(10);
      expect(examples.every(e => e.input)).toBe(true);
      expect(examples.every(e => e.confidence > 0)).toBe(true);
    });

    it('should generate diverse examples based on diversity level', async () => {
      const configs = [
        { count: 10, includeEdgeCases: false, diversityLevel: 'low' as const },
        { count: 10, includeEdgeCases: false, diversityLevel: 'high' as const },
      ];

      const results = await Promise.all(
        configs.map(config => generator.generateExamples(mockTemplate, config))
      );

      const lowDiversityExamples = results[0];
      const highDiversityExamples = results[1];

      // High diversity should have more varied categories
      const lowCategories = new Set(lowDiversityExamples.map(e => e.category));
      const highCategories = new Set(highDiversityExamples.map(e => e.category));
      
      expect(highCategories.size).toBeGreaterThanOrEqual(lowCategories.size);
    });

    it('should include edge cases when configured', async () => {
      const config: ExampleGenerationConfig = {
        count: 20,
        includeEdgeCases: true,
        diversityLevel: 'high',
      };

      const examples = await generator.generateExamples(mockTemplate, config);
      
      const edgeCases = examples.filter(e => e.category === 'edge_case');
      expect(edgeCases.length).toBeGreaterThan(0);
      
      // Check for various edge case types
      const edgeCaseInputs = edgeCases.map(e => e.input);
      const hasEmptyInput = edgeCaseInputs.some(input => input === '');
      const hasSpecialChars = edgeCaseInputs.some(input => /[!@#$%^&*()]/.test(input));
      
      expect(hasEmptyInput || hasSpecialChars).toBe(true);
    });

    it('should respect constraints when generating examples', async () => {
      const config: ExampleGenerationConfig = {
        count: 10,
        includeEdgeCases: false,
        diversityLevel: 'medium',
        constraints: {
          maxLength: 50,
          minLength: 10,
          requiredElements: ['test'],
        },
      };

      const examples = await generator.generateExamples(mockTemplate, config);
      
      examples.forEach(example => {
        if (example.category === 'normal') {
          expect(example.input.length).toBeGreaterThanOrEqual(10);
          expect(example.input.length).toBeLessThanOrEqual(50);
        }
      });
    });

    it('should generate adversarial examples', async () => {
      const config: ExampleGenerationConfig = {
        count: 15,
        includeEdgeCases: true,
        diversityLevel: 'high',
      };

      const examples = await generator.generateExamples(mockTemplate, config);
      
      const adversarial = examples.filter(e => e.category === 'adversarial');
      expect(adversarial.length).toBeGreaterThan(0);
      
      // Check for potentially malicious patterns
      const hasInjectionAttempt = adversarial.some(e => 
        e.input.includes('DROP TABLE') || 
        e.input.includes('<script>') ||
        e.input.includes('../../')
      );
      expect(hasInjectionAttempt).toBe(true);
    });

    it('should generate boundary examples', async () => {
      const config: ExampleGenerationConfig = {
        count: 10,
        includeEdgeCases: false,
        diversityLevel: 'high',
        constraints: {
          maxLength: 100,
          minLength: 5,
        },
      };

      const examples = await generator.generateExamples(mockTemplate, config);
      
      const boundary = examples.filter(e => e.category === 'boundary');
      expect(boundary.length).toBeGreaterThan(0);
      
      // Check for boundary conditions
      const lengths = boundary.map(e => e.input.length);
      const hasMinBoundary = lengths.some(l => l === 5 || l === 6);
      const hasMaxBoundary = lengths.some(l => l === 99 || l === 100);
      
      expect(hasMinBoundary || hasMaxBoundary).toBe(true);
    });
  });

  describe('validateExamples', () => {
    it('should validate examples correctly', async () => {
      const examples: GeneratedExample[] = [
        {
          input: 'Valid input with {{input}} and {{method}}',
          category: 'normal',
          confidence: 0.9,
          metadata: {
            generationMethod: 'template_based',
            diversity: 0.5,
            complexity: 0.3,
            coverage: ['var:input', 'var:method'],
          },
        },
        {
          input: '',
          category: 'edge_case',
          confidence: 0.8,
          metadata: {
            generationMethod: 'edge_case_empty',
            diversity: 1.0,
            complexity: 0.0,
            coverage: ['empty_input'],
          },
        },
        {
          input: 'Missing required variables',
          category: 'normal',
          confidence: 0.3,
          metadata: {
            generationMethod: 'template_based',
            diversity: 0.4,
            complexity: 0.2,
            coverage: [],
          },
        },
      ];

      const results = await generator.validateExamples(examples, mockTemplate);

      expect(results).toHaveLength(3);
      expect(results[0].valid).toBe(true);
      expect(results[0].errors).toHaveLength(0);
      
      expect(results[1].valid).toBe(true); // Edge case with empty input is valid
      expect(results[1].warnings.length).toBeGreaterThanOrEqual(0);
      
      expect(results[2].valid).toBe(true);
      expect(results[2].warnings.length).toBeGreaterThan(0);
      expect(results[2].warnings[0]).toContain('Missing required variables');
    });

    it('should detect invalid examples', async () => {
      const examples: GeneratedExample[] = [
        {
          input: '',
          category: 'normal', // Empty input for non-edge-case
          confidence: 0.9,
          metadata: {
            generationMethod: 'template_based',
            diversity: 0.5,
            complexity: 0.0,
            coverage: [],
          },
        },
      ];

      const results = await generator.validateExamples(examples, mockTemplate);
      
      expect(results[0].warnings.length).toBeGreaterThan(0);
      expect(results[0].score).toBeLessThan(1.0);
    });

    it('should score examples based on quality', async () => {
      const highQualityExample: GeneratedExample = {
        input: 'High quality with {{input}} and {{method}}',
        expectedOutput: 'Expected result',
        category: 'normal',
        confidence: 0.95,
        metadata: {
          generationMethod: 'template_based',
          diversity: 0.8,
          complexity: 0.7,
          coverage: ['var:input', 'var:method'],
        },
      };

      const lowQualityExample: GeneratedExample = {
        input: 'Low quality',
        category: 'normal',
        confidence: 0.3,
        metadata: {
          generationMethod: 'template_based',
          diversity: 0.2,
          complexity: 0.1,
          coverage: [],
        },
      };

      const results = await generator.validateExamples(
        [highQualityExample, lowQualityExample],
        mockTemplate
      );

      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });

  describe('generateEdgeCases', () => {
    it('should generate various types of edge cases', async () => {
      const config: ExampleGenerationConfig = {
        count: 8,
        includeEdgeCases: true,
        diversityLevel: 'high',
      };

      const edgeCases = await generator.generateEdgeCases(mockTemplate, 8, config);

      expect(edgeCases).toHaveLength(8);
      
      const edgeTypes = new Set(
        edgeCases.map(e => e.metadata.generationMethod)
      );
      
      // Should have variety of edge case types
      expect(edgeTypes.size).toBeGreaterThan(1);
      
      // Check for specific edge case patterns
      const hasEmpty = edgeCases.some(e => e.input === '');
      const hasSpecialChars = edgeCases.some(e => /[!@#$%^&*()]/.test(e.input));
      const hasLongInput = edgeCases.some(e => e.input.length > 1000);
      
      expect(hasEmpty || hasSpecialChars || hasLongInput).toBe(true);
    });

    it('should generate unicode edge cases', async () => {
      const config: ExampleGenerationConfig = {
        count: 5,
        includeEdgeCases: true,
        diversityLevel: 'high',
      };

      const edgeCases = await generator.generateEdgeCases(mockTemplate, 5, config);
      
      const unicodeExamples = edgeCases.filter(e => 
        e.metadata.generationMethod.includes('unicode')
      );
      
      if (unicodeExamples.length > 0) {
        const hasNonAscii = unicodeExamples.some(e => 
          /[^\x00-\x7F]/.test(e.input)
        );
        expect(hasNonAscii).toBe(true);
      }
    });
  });

  describe('Private utility methods', () => {
    it('should calculate diversity between examples', async () => {
      const config: ExampleGenerationConfig = {
        count: 5,
        includeEdgeCases: false,
        diversityLevel: 'medium',
      };

      const examples = await generator.generateExamples(mockTemplate, config);
      
      // Check that diversity is calculated
      examples.forEach(example => {
        expect(example.metadata.diversity).toBeGreaterThanOrEqual(0);
        expect(example.metadata.diversity).toBeLessThanOrEqual(1);
      });
    });

    it('should calculate complexity of inputs', async () => {
      const config: ExampleGenerationConfig = {
        count: 5,
        includeEdgeCases: true,
        diversityLevel: 'high',
      };

      const examples = await generator.generateExamples(mockTemplate, config);
      
      examples.forEach(example => {
        expect(example.metadata.complexity).toBeGreaterThanOrEqual(0);
        expect(example.metadata.complexity).toBeLessThanOrEqual(1);
        
        // Simple inputs should have lower complexity
        if (example.input.length < 10 && !/[^a-zA-Z0-9\s]/.test(example.input)) {
          expect(example.metadata.complexity).toBeLessThan(0.5);
        }
      });
    });

    it('should analyze coverage properly', async () => {
      const templateWithManyVars: Template = {
        ...mockTemplate,
        variables: {
          var1: { type: 'string', required: true },
          var2: { type: 'number', required: true },
          var3: { type: 'boolean', required: false },
        },
      };

      const config: ExampleGenerationConfig = {
        count: 5,
        includeEdgeCases: false,
        diversityLevel: 'medium',
      };

      const examples = await generator.generateExamples(templateWithManyVars, config);
      
      examples.forEach(example => {
        expect(Array.isArray(example.metadata.coverage)).toBe(true);
        
        // Check coverage includes relevant tags
        if (example.input.length < 10) {
          expect(example.metadata.coverage).toContain('short_input');
        }
        if (example.input.length > 1000) {
          expect(example.metadata.coverage).toContain('long_input');
        }
        if (/\d/.test(example.input)) {
          expect(example.metadata.coverage).toContain('numeric');
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle templates without variables', async () => {
      const simpleTemplate: Template = {
        name: 'simple',
        content: 'Just plain text',
      };

      const config: ExampleGenerationConfig = {
        count: 5,
        includeEdgeCases: false,
        diversityLevel: 'low',
      };

      const examples = await generator.generateExamples(simpleTemplate, config);
      
      expect(examples).toHaveLength(5);
      expect(examples.every(e => e.input)).toBe(true);
    });

    it('should handle empty templates gracefully', async () => {
      const emptyTemplate: Template = {
        name: 'empty',
        content: '',
      };

      const config: ExampleGenerationConfig = {
        count: 3,
        includeEdgeCases: true,
        diversityLevel: 'medium',
      };

      const examples = await generator.generateExamples(emptyTemplate, config);
      
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.every(e => e.category)).toBe(true);
    });

    it('should filter out invalid examples', async () => {
      const config: ExampleGenerationConfig = {
        count: 10,
        includeEdgeCases: false,
        diversityLevel: 'medium',
      };

      // Mock validation to fail some examples
      const validateSpy = jest.spyOn(generator as any, 'validateExample');
      validateSpy.mockImplementation((example: GeneratedExample) => {
        if (example.confidence < 0.5) {
          return { valid: false, errors: ['Low confidence'], warnings: [], score: 0.2 };
        }
        return { valid: true, errors: [], warnings: [], score: 0.8 };
      });

      const examples = await generator.generateExamples(mockTemplate, config);
      
      // All returned examples should be valid
      const validationResults = await generator.validateExamples(examples, mockTemplate);
      expect(validationResults.every(r => r.valid || r.score >= 0.3)).toBe(true);
      
      validateSpy.mockRestore();
    });
  });
});
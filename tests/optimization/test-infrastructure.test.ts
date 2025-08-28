/**
 * @fileoverview Basic test infrastructure validation for optimization system
 * @lastmodified 2025-08-26T20:30:00Z
 *
 * Features: Simple validation of test setup and infrastructure
 * Main APIs: Basic test validation, fixture loading, mock setup
 * Constraints: Uses Jest with minimal dependencies
 * Patterns: Infrastructure testing, setup validation
 */

import { TestUtils, testEnv } from '../setup/test-setup';
import { 
  TemplateFixtures, 
  OptimizationConfigFactory,
  OptimizationResultFactory,
  TemplateCategory,
  getAvailableCategories,
  createRandomizedTestData
} from './fixtures-simplified';

describe('Optimization Test Infrastructure', () => {
  beforeEach(() => {
    testEnv.setup({
      mockFileSystem: true,
      mockLogger: true
    });
  });

  afterEach(() => {
    testEnv.teardown();
    jest.clearAllMocks();
  });

  describe('Test Environment Setup', () => {
    it('should have proper test environment configuration', () => {
      expect(testEnv).toBeDefined();
      expect(TestUtils).toBeDefined();
      expect(TestUtils.createTestTemplate).toBeDefined();
      expect(TestUtils.flushPromises).toBeDefined();
    });

    it('should create test contexts correctly', () => {
      const context = TestUtils.createTestContext({
        name: 'Test User',
        project: { name: 'optimization-test' }
      });

      expect(context.name).toBe('Test User');
      expect(context.project.name).toBe('optimization-test');
      expect(context.email).toBe('test@example.com');
    });

    it('should create test templates with variables', () => {
      const template = TestUtils.createTestTemplate(['name', 'task', 'priority']);
      
      expect(template).toContain('{{name}}');
      expect(template).toContain('{{task}}');
      expect(template).toContain('{{priority}}');
      expect(template).toContain('{{project.name}}');
    });

    it('should measure execution time accurately', async () => {
      const { result, duration } = await TestUtils.measureTime(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'test-result';
      });

      expect(result).toBe('test-result');
      expect(duration).toBeGreaterThan(90);
      expect(duration).toBeLessThan(150);
    });
  });

  describe('Template Fixtures', () => {
    it('should create simple templates', () => {
      const template = TemplateFixtures.createSimpleTemplate('test-simple');
      
      expect(template.id).toBe('test-simple');
      expect(template.name).toBe('Simple Greeting Template');
      expect(template.content).toContain('{{name}}');
      expect(template.variables).toHaveProperty('name', 'string');
      expect(template.category).toBe(TemplateCategory.SIMPLE);
    });

    it('should create complex templates', () => {
      const template = TemplateFixtures.createComplexTemplate('test-complex');
      
      expect(template.id).toBe('test-complex');
      expect(template.name).toBe('Advanced Customer Support Template');
      expect(template.content).toContain('{{#if');
      expect(template.content).toContain('{{#each');
      expect(template.variables?.['customer.name']).toBe('string');
      expect(template.category).toBe(TemplateCategory.COMPLEX);
    });

    it('should create coding templates', () => {
      const template = TemplateFixtures.createCodingTemplate('test-coding');
      
      expect(template.id).toBe('test-coding');
      expect(template.name).toBe('Code Review Assistant');
      expect(template.content).toContain('```{{language}}');
      expect(template.variables).toHaveProperty('language', 'string');
      expect(template.category).toBe(TemplateCategory.CODING);
    });

    it('should create analysis templates', () => {
      const template = TemplateFixtures.createAnalysisTemplate('test-analysis');
      
      expect(template.id).toBe('test-analysis');
      expect(template.name).toBe('Data Analysis Report');
      expect(template.content).toContain('## Key Findings');
      expect(template.variables?.['dataset.name']).toBe('string');
      expect(template.category).toBe(TemplateCategory.ANALYSIS);
    });

    it('should create creative templates', () => {
      const template = TemplateFixtures.createCreativeTemplate('test-creative');
      
      expect(template.id).toBe('test-creative');
      expect(template.name).toBe('Story Writing Assistant');
      expect(template.content).toContain('## Characters');
      expect(template.variables?.['story.title']).toBe('string');
      expect(template.category).toBe(TemplateCategory.CREATIVE);
    });

    it('should create batch templates', () => {
      const templates = TemplateFixtures.createBatchTemplates(5, TemplateCategory.SIMPLE);
      
      expect(templates).toHaveLength(5);
      expect(templates[0].id).toBe('batch-simple-0');
      expect(templates[4].id).toBe('batch-simple-4');
      expect(templates.every(t => t.category === TemplateCategory.SIMPLE)).toBe(true);
    });

    it('should get templates by category', () => {
      const categories = getAvailableCategories();
      
      expect(categories).toContain(TemplateCategory.SIMPLE);
      expect(categories).toContain(TemplateCategory.COMPLEX);
      expect(categories).toContain(TemplateCategory.CODING);
      
      categories.forEach(category => {
        const template = TemplateFixtures.getTemplateByCategory(category);
        expect(template.category).toBe(category);
      });
    });
  });

  describe('Optimization Config Factory', () => {
    it('should create basic configurations', () => {
      const config = OptimizationConfigFactory.createBasicConfig();
      
      expect(config.task).toBe('General purpose optimization');
      expect(config.prompt).toBe('Test prompt for optimization');
      expect(config.targetModel).toBe('gpt-4');
      expect(config.mutateRefineIterations).toBe(3);
      expect(config.fewShotCount).toBe(5);
      expect(config.generateReasoning).toBe(true);
    });

    it('should create advanced configurations', () => {
      const config = OptimizationConfigFactory.createAdvancedConfig();
      
      expect(config.task).toBe('Advanced template optimization');
      expect(config.mutateRefineIterations).toBe(7);
      expect(config.fewShotCount).toBe(15);
      expect(config.metadata).toBeDefined();
      expect(config.metadata?.templateName).toBe('Advanced Template');
    });

    it('should create minimal configurations', () => {
      const config = OptimizationConfigFactory.createMinimalConfig();
      
      expect(config.targetModel).toBe('gpt-3.5-turbo');
      expect(config.mutateRefineIterations).toBe(1);
      expect(config.fewShotCount).toBe(2);
      expect(config.generateReasoning).toBe(false);
    });
  });

  describe('Optimization Result Factory', () => {
    it('should create successful results', () => {
      const result = OptimizationResultFactory.createSuccessfulResult('test-success');
      
      expect(result.jobId).toMatch(/^job-test-success-\d+-[a-z0-9]{6}$/);
      expect(result.status).toBe('completed');
      expect(result.originalPrompt).toBeDefined();
      expect(result.optimizedPrompt).toBeDefined();
      expect(result.metrics.tokenReduction).toBeGreaterThan(0);
      expect(result.metrics.accuracyImprovement).toBeGreaterThan(0);
      expect(result.examples).toBeDefined();
      expect(result.reasoning).toBeDefined();
    });

    it('should create partial success results', () => {
      const result = OptimizationResultFactory.createPartialSuccessResult('test-partial');
      
      expect(result.jobId).toContain('test-partial');
      expect(result.status).toBe('completed');
      expect(result.metrics.tokenReduction).toBeLessThan(10);
      expect(result.metrics.accuracyImprovement).toBeLessThan(5);
      expect(result.metrics.costReduction).toBeLessThan(0.1);
    });

    it('should create failed results', () => {
      const result = OptimizationResultFactory.createFailedOptimizationResult('test-failed');
      
      expect(result.jobId).toContain('test-failed');
      expect(result.status).toBe('failed');
      expect(result.metrics.tokenReduction).toBeLessThan(0);
      expect(result.metrics.accuracyImprovement).toBeLessThan(0);
      expect(result.metrics.costReduction).toBeLessThan(0);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('OPTIMIZATION_FAILED');
    });

    it('should create batch results', () => {
      const templateIds = ['batch-1', 'batch-2', 'batch-3', 'batch-4', 'batch-5'];
      const results = OptimizationResultFactory.createBatchResults(templateIds);
      
      expect(results).toHaveLength(5);
      expect(results.some(r => r.status === 'failed')).toBe(true); // Some failures
      expect(results.some(r => r.status === 'completed' && r.metrics.tokenReduction > 10)).toBe(true); // Some successes
    });
  });

  describe('Randomized Test Data', () => {
    it('should create consistent randomized data with seed', () => {
      const seed = 12345;
      const data1 = createRandomizedTestData(seed);
      const data2 = createRandomizedTestData(seed);
      
      expect(data1.templates.length).toBe(data2.templates.length);
      expect(data1.configs.length).toBe(data2.configs.length);
      expect(data1.results.length).toBe(data2.results.length);
      
      expect(data1.templates[0].id).toBe(data2.templates[0].id);
      expect(data1.templates[0].category).toBe(data2.templates[0].category);
    });

    it('should create different data with different seeds', () => {
      const data1 = createRandomizedTestData(11111);
      const data2 = createRandomizedTestData(22222);
      
      // Should have different content but same structure
      expect(data1.templates.length).toBeGreaterThan(0);
      expect(data2.templates.length).toBeGreaterThan(0);
      
      // Very unlikely to have identical first result job IDs with different seeds
      const result1JobId = data1.results[0]?.jobId;
      const result2JobId = data2.results[0]?.jobId;
      if (result1JobId && result2JobId && data1.results.length > 0 && data2.results.length > 0) {
        expect(result1JobId === result2JobId).toBe(false);
      }
    });

    it('should generate reasonable amounts of test data', () => {
      const data = createRandomizedTestData();
      
      expect(data.templates.length).toBeGreaterThanOrEqual(5);
      expect(data.templates.length).toBeLessThanOrEqual(15);
      expect(data.configs.length).toBe(data.templates.length);
      expect(data.results.length).toBe(data.templates.length);
      
      // Validate data consistency
      data.templates.forEach((template, index) => {
        expect(template.id).toBe(`random-${index}`);
        expect(getAvailableCategories()).toContain(template.category);
      });
    });
  });

  describe('Test Performance', () => {
    it('should create fixtures quickly', async () => {
      const { duration } = await TestUtils.measureTime(async () => {
        // Create multiple fixtures
        const templates = [];
        for (let i = 0; i < 50; i++) {
          templates.push(TemplateFixtures.createSimpleTemplate(`perf-${i}`));
        }
        
        const configs = [];
        for (let i = 0; i < 50; i++) {
          configs.push(OptimizationConfigFactory.createBasicConfig());
        }
        
        const results = [];
        for (let i = 0; i < 50; i++) {
          results.push(OptimizationResultFactory.createSuccessfulResult(`perf-${i}`));
        }
        
        return { templates, configs, results };
      });

      // Should create 150 objects in under 100ms
      expect(duration).toBeLessThan(100);
      console.log(`Created 150 test objects in ${duration.toFixed(2)}ms`);
    });

    it('should handle large batch creation efficiently', () => {
      const startTime = Date.now();
      
      const largeTemplate = TemplateFixtures.createBatchTemplates(100, TemplateCategory.COMPLEX);
      const largeResults = OptimizationResultFactory.createBatchResults(
        largeTemplate.map(t => t.id || `template-${Math.random()}`)
      );
      
      const duration = Date.now() - startTime;
      
      expect(largeTemplate).toHaveLength(100);
      expect(largeResults).toHaveLength(100);
      expect(duration).toBeLessThan(500); // Should complete in under 500ms
      
      console.log(`Created 200 complex objects in ${duration}ms`);
    });
  });

  describe('Mock Data Quality', () => {
    it('should generate realistic template content', () => {
      const categories = getAvailableCategories();
      
      categories.forEach(category => {
        const template = TemplateFixtures.getTemplateByCategory(category);
        
        // Should have reasonable content length
        expect(template.content?.length || 0).toBeGreaterThan(50);
        expect(template.content?.length || 0).toBeLessThan(5000);
        
        // Should contain template variables
        expect(template.content || '').toMatch(/\{\{[^}]+\}\}/);
        
        // Should have consistent metadata
        expect(template.name).toBeTruthy();
        expect(template.version).toBeTruthy();
        expect(template.author).toBeTruthy();
        expect(template.description).toBeTruthy();
      });
    });

    it('should generate realistic optimization metrics', () => {
      const templateIds = ['metric-1', 'metric-2', 'metric-3'];
      const results = OptimizationResultFactory.createBatchResults(templateIds);
      
      results.forEach(result => {
        // Metrics should be within reasonable ranges
        expect(result.metrics.tokenReduction).toBeGreaterThan(-50);
        expect(result.metrics.tokenReduction).toBeLessThan(80);
        
        expect(result.metrics.accuracyImprovement).toBeGreaterThan(-20);
        expect(result.metrics.accuracyImprovement).toBeLessThan(50);
        
        expect(result.metrics.processingTime).toBeGreaterThan(0);
        expect(result.metrics.processingTime).toBeLessThan(60);
        
        expect(result.status).toMatch(/^(completed|failed|processing)$/);
        
        if (result.status === 'completed') {
          expect(result.completedAt).toBeDefined();
        }
        
        if (result.error) {
          expect(result.error.code).toBeDefined();
          expect(result.error.message).toBeDefined();
        }
      });
    });
  });
});
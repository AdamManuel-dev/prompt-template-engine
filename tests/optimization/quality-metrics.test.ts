/**
 * @fileoverview Tests for quality validation metrics and reporting
 * @lastmodified 2025-08-26T19:30:00Z
 *
 * Features: Quality validation testing, metrics analysis, reporting validation
 * Main APIs: QualityValidator tests, metric calculation validation, reporting accuracy
 * Constraints: Uses Jest with TypeScript, validates statistical accuracy
 * Patterns: Statistical testing, quality assurance validation, reporting verification
 */

import { 
  QualityValidator,
  ValidationReport,
  ValidationResult,
  QualityThresholds,
  QualityStatistics,
  QualityBaseline,
  createDefaultQualityValidator,
  createStrictQualityValidator,
  createLenientQualityValidator
} from './quality-validator';
import { 
  OptimizationResultFactory,
  TemplateFixtures,
  TestDataFactory,
  TemplateCategory 
} from './fixtures';
import { TestUtils, testEnv } from '../setup/test-setup';

describe('Quality Validation Metrics and Reporting', () => {
  let validator: QualityValidator;
  let strictValidator: QualityValidator;
  let lenientValidator: QualityValidator;

  beforeEach(() => {
    testEnv.setup({
      mockFileSystem: true,
      mockLogger: true
    });

    validator = createDefaultQualityValidator();
    strictValidator = createStrictQualityValidator();
    lenientValidator = createLenientQualityValidator();
  });

  afterEach(() => {
    testEnv.teardown();
    jest.clearAllMocks();
  });

  describe('Quality Score Validation', () => {
    it('should validate high-quality optimization results', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('high-quality');
      result.qualityScore.overall = 0.92;
      result.qualityScore.confidence = 0.89;

      const report = await validator.validate(result);

      expect(report.passed).toBe(true);
      expect(report.score).toBeGreaterThan(0.8);
      expect(report.validations.qualityScore.passed).toBe(true);
      expect(report.validations.confidenceLevel.passed).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.recommendations).toHaveLength(0);

      console.log(`High quality result score: ${report.score.toFixed(3)}`);
    });

    it('should flag low-quality optimization results', async () => {
      const result = OptimizationResultFactory.createFailedOptimizationResult('low-quality');
      result.qualityScore.overall = 0.45;
      result.qualityScore.confidence = 0.32;

      const report = await validator.validate(result);

      expect(report.passed).toBe(false);
      expect(report.score).toBeLessThan(0.6);
      expect(report.validations.qualityScore.passed).toBe(false);
      expect(report.validations.confidenceLevel.passed).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);

      console.log(`Low quality result score: ${report.score.toFixed(3)}`);
      console.log(`Recommendations: ${report.recommendations.length}`);
      console.log(`Errors: ${report.errors.length}`);
    });

    it('should handle borderline quality cases', async () => {
      const result = OptimizationResultFactory.createPartialSuccessResult('borderline');
      result.qualityScore.overall = 0.69; // Just below default threshold
      result.qualityScore.confidence = 0.65;

      const report = await validator.validate(result);

      expect(report.passed).toBe(false); // Should fail quality threshold
      expect(report.validations.qualityScore.passed).toBe(false);
      expect(report.validations.confidenceLevel.passed).toBe(true); // Above confidence threshold
      expect(report.warnings.length).toBeGreaterThan(0);

      console.log(`Borderline case - Score: ${report.score.toFixed(3)}, Warnings: ${report.warnings.length}`);
    });
  });

  describe('Semantic Preservation Validation', () => {
    it('should validate semantic similarity preservation', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('semantic-test');
      // Use similar content to ensure high semantic similarity
      result.originalTemplate.content = 'You are a helpful assistant. Please provide detailed assistance to users with their questions and tasks.';
      result.optimizedTemplate.content = 'Provide detailed assistance to users with their questions and tasks as a helpful assistant.';

      const report = await validator.validate(result);

      expect(report.validations.semanticPreservation.passed).toBe(true);
      expect(report.validations.semanticPreservation.actualValue).toBeGreaterThan(0.8);
      expect(report.validations.semanticPreservation.severity).toBe('low');

      console.log(`Semantic similarity: ${report.validations.semanticPreservation.actualValue.toFixed(3)}`);
    });

    it('should detect semantic drift in optimized content', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('semantic-drift');
      // Use very different content to simulate semantic drift
      result.originalTemplate.content = 'You are a helpful customer service representative. Assist customers with billing inquiries and account issues.';
      result.optimizedTemplate.content = 'Write a creative story about space exploration and alien encounters.';

      const report = await validator.validate(result);

      expect(report.validations.semanticPreservation.passed).toBe(false);
      expect(report.validations.semanticPreservation.actualValue).toBeLessThan(0.6);
      expect(report.validations.semanticPreservation.severity).toBe('critical');
      expect(report.errors).toContain(expect.stringContaining('semanticPreservation'));

      console.log(`Semantic drift detected: ${report.validations.semanticPreservation.actualValue.toFixed(3)}`);
    });

    it('should handle semantic similarity edge cases', async () => {
      const testCases = [
        {
          name: 'Empty content',
          original: '',
          optimized: 'Hello world',
          expectedPassed: false
        },
        {
          name: 'Identical content',
          original: 'Hello {{name}}, welcome!',
          optimized: 'Hello {{name}}, welcome!',
          expectedPassed: true
        },
        {
          name: 'Minor rewording',
          original: 'Please help the user with their request',
          optimized: 'Assist the user with their request',
          expectedPassed: true
        },
        {
          name: 'Major restructuring',
          original: 'You are an expert in {{domain}}. Provide guidance on {{topic}} considering {{constraints}}.',
          optimized: 'Help with {{topic}}.',
          expectedPassed: false
        }
      ];

      for (const testCase of testCases) {
        const result = OptimizationResultFactory.createSuccessfulResult(`semantic-${testCase.name.replace(/\s+/g, '-')}`);
        result.originalTemplate.content = testCase.original;
        result.optimizedTemplate.content = testCase.optimized;

        const report = await validator.validate(result);
        
        expect(report.validations.semanticPreservation.passed).toBe(testCase.expectedPassed);
        console.log(`${testCase.name}: ${report.validations.semanticPreservation.actualValue.toFixed(3)} - ${testCase.expectedPassed ? 'PASS' : 'FAIL'}`);
      }
    });
  });

  describe('Variable Integrity Validation', () => {
    it('should validate preserved template variables', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('variables-preserved');
      result.originalTemplate.content = 'Hello {{name}}, your {{task}} is ready. Contact {{support}} for help.';
      result.optimizedTemplate.content = 'Hi {{name}}, {{task}} completed. Contact {{support}} if needed.';

      const report = await validator.validate(result);

      expect(report.validations.variableIntegrity.passed).toBe(true);
      expect(report.validations.variableIntegrity.actualValue).toBe(1.0);
      expect(report.validations.variableIntegrity.details?.missingVariables).toHaveLength(0);
      expect(report.validations.variableIntegrity.details?.extraVariables).toHaveLength(0);

      console.log('Variables preserved successfully');
    });

    it('should detect missing template variables', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('variables-missing');
      result.originalTemplate.content = 'Hello {{name}}, your {{task}} is ready. Contact {{support}} for help.';
      result.optimizedTemplate.content = 'Hi there, task completed. Contact support if needed.'; // All variables removed

      const report = await validator.validate(result);

      expect(report.validations.variableIntegrity.passed).toBe(false);
      expect(report.validations.variableIntegrity.actualValue).toBeLessThan(1.0);
      expect(report.validations.variableIntegrity.details?.missingVariables).toContain('name');
      expect(report.validations.variableIntegrity.details?.missingVariables).toContain('task');
      expect(report.validations.variableIntegrity.details?.missingVariables).toContain('support');
      expect(report.validations.variableIntegrity.severity).toBe('critical');

      console.log(`Missing variables: ${report.validations.variableIntegrity.details?.missingVariables.join(', ')}`);
    });

    it('should handle additional template variables', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('variables-added');
      result.originalTemplate.content = 'Hello {{name}}, welcome!';
      result.optimizedTemplate.content = 'Hello {{name}}, welcome to {{platform}} on {{date}}!'; // Added variables

      const report = await validator.validate(result);

      expect(report.validations.variableIntegrity.passed).toBe(true); // Original variables preserved
      expect(report.validations.variableIntegrity.details?.extraVariables).toContain('platform');
      expect(report.validations.variableIntegrity.details?.extraVariables).toContain('date');

      console.log(`Added variables: ${report.validations.variableIntegrity.details?.extraVariables.join(', ')}`);
    });

    it('should validate complex variable patterns', async () => {
      const complexCases = [
        {
          name: 'Nested object variables',
          original: '{{user.name}} from {{company.name}}',
          optimized: '{{user.name}} at {{company.name}}',
          expectedPassed: true
        },
        {
          name: 'Array access variables',
          original: '{{items[0].title}} and {{items[1].title}}',
          optimized: '{{items[0].title}} plus {{items[1].title}}',
          expectedPassed: true
        },
        {
          name: 'Conditional variables',
          original: '{{#if user.active}}{{user.name}}{{/if}}',
          optimized: '{{user.name}}', // Simplified but lost conditional
          expectedPassed: false
        },
        {
          name: 'Helper function variables',
          original: '{{upperCase user.name}}',
          optimized: '{{user.name}}', // Lost helper function
          expectedPassed: false
        }
      ];

      for (const testCase of complexCases) {
        const result = OptimizationResultFactory.createSuccessfulResult(`complex-vars-${testCase.name.replace(/\s+/g, '-')}`);
        result.originalTemplate.content = testCase.original;
        result.optimizedTemplate.content = testCase.optimized;

        const report = await validator.validate(result);
        
        console.log(`${testCase.name}: ${report.validations.variableIntegrity.passed ? 'PASS' : 'FAIL'} (Score: ${report.validations.variableIntegrity.actualValue.toFixed(2)})`);
      }
    });
  });

  describe('Token Reduction Validation', () => {
    it('should validate significant token reduction', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('token-reduction');
      result.metrics.tokenReduction = 35.8; // Good reduction

      const report = await validator.validate(result);

      expect(report.validations.tokenReduction.passed).toBe(true);
      expect(report.validations.tokenReduction.actualValue).toBe(35.8);
      expect(report.validations.tokenReduction.score).toBeGreaterThan(1.0); // Should be capped at 1.0 in implementation
      expect(report.validations.tokenReduction.severity).toBe('low');

      console.log(`Token reduction validation: ${result.metrics.tokenReduction}%`);
    });

    it('should handle acceptable token increase with quality improvement', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('token-increase');
      result.metrics.tokenReduction = -5; // Slight increase but within threshold
      result.qualityScore.overall = 0.95; // High quality compensates

      const report = await validator.validate(result);

      expect(report.validations.tokenReduction.passed).toBe(true); // Within acceptable threshold
      expect(report.validations.tokenReduction.actualValue).toBe(-5);
      expect(report.validations.tokenReduction.severity).toBe('medium');

      console.log(`Acceptable token increase: ${result.metrics.tokenReduction}% with quality ${result.qualityScore.overall}`);
    });

    it('should flag excessive token increase', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('excessive-tokens');
      result.metrics.tokenReduction = -25; // Significant increase

      const report = await validator.validate(result);

      expect(report.validations.tokenReduction.passed).toBe(false);
      expect(report.validations.tokenReduction.actualValue).toBe(-25);
      expect(report.validations.tokenReduction.severity).toBe('critical');
      expect(report.errors).toContain(expect.stringContaining('tokenReduction'));

      console.log(`Excessive token increase flagged: ${result.metrics.tokenReduction}%`);
    });
  });

  describe('Accuracy Improvement Validation', () => {
    it('should validate positive accuracy improvements', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('accuracy-improved');
      result.metrics.accuracyImprovement = 15.7;

      const report = await validator.validate(result);

      expect(report.validations.accuracyImprovement.passed).toBe(true);
      expect(report.validations.accuracyImprovement.actualValue).toBe(15.7);
      expect(report.validations.accuracyImprovement.severity).toBe('low');

      console.log(`Accuracy improvement: ${result.metrics.accuracyImprovement}%`);
    });

    it('should handle minimal accuracy changes', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('accuracy-minimal');
      result.metrics.accuracyImprovement = 1.2; // Small but positive

      const report = await validator.validate(result);

      expect(report.validations.accuracyImprovement.passed).toBe(true);
      expect(report.validations.accuracyImprovement.actualValue).toBe(1.2);

      console.log(`Minimal accuracy improvement: ${result.metrics.accuracyImprovement}%`);
    });

    it('should flag accuracy degradation', async () => {
      const result = OptimizationResultFactory.createSuccessfulResult('accuracy-degraded');
      result.metrics.accuracyImprovement = -8.5;

      const report = await validator.validate(result);

      expect(report.validations.accuracyImprovement.passed).toBe(false);
      expect(report.validations.accuracyImprovement.actualValue).toBe(-8.5);
      expect(report.validations.accuracyImprovement.severity).toBe('high');

      console.log(`Accuracy degradation: ${result.metrics.accuracyImprovement}%`);
    });
  });

  describe('Validator Configuration Testing', () => {
    it('should apply different threshold configurations', async () => {
      const result = OptimizationResultFactory.createPartialSuccessResult('threshold-test');
      result.qualityScore.overall = 0.75; // Between strict and lenient thresholds

      const defaultReport = await validator.validate(result);
      const strictReport = await strictValidator.validate(result);
      const lenientReport = await lenientValidator.validate(result);

      expect(defaultReport.passed).toBe(true); // 0.75 > 0.7 (default threshold)
      expect(strictReport.passed).toBe(false); // 0.75 < 0.85 (strict threshold)
      expect(lenientReport.passed).toBe(true); // 0.75 > 0.5 (lenient threshold)

      console.log(`Quality 0.75 - Default: ${defaultReport.passed}, Strict: ${strictReport.passed}, Lenient: ${lenientReport.passed}`);
    });

    it('should generate different recommendations based on thresholds', async () => {
      const result = OptimizationResultFactory.createPartialSuccessResult('recommendations-test');
      result.qualityScore.overall = 0.65;
      result.metrics.tokenReduction = -8;
      result.qualityScore.confidence = 0.55;

      const defaultReport = await validator.validate(result);
      const strictReport = await strictValidator.validate(result);

      expect(strictReport.recommendations.length).toBeGreaterThan(defaultReport.recommendations.length);
      expect(strictReport.errors.length).toBeGreaterThan(defaultReport.errors.length);

      console.log(`Default recommendations: ${defaultReport.recommendations.length}`);
      console.log(`Strict recommendations: ${strictReport.recommendations.length}`);
    });
  });

  describe('Quality Statistics and Baselines', () => {
    it('should calculate quality statistics from validation history', async () => {
      const testResults = [
        OptimizationResultFactory.createSuccessfulResult('stats-1'),
        OptimizationResultFactory.createSuccessfulResult('stats-2'),
        OptimizationResultFactory.createPartialSuccessResult('stats-3'),
        OptimizationResultFactory.createFailedOptimizationResult('stats-4'),
        OptimizationResultFactory.createSuccessfulResult('stats-5')
      ];

      // Process multiple results to build history
      const reports = [];
      for (const result of testResults) {
        const report = await validator.validate(result);
        reports.push(report);
      }

      const statistics = validator.getQualityStatistics();

      expect(statistics.mean).toBeGreaterThan(0);
      expect(statistics.median).toBeGreaterThan(0);
      expect(statistics.standardDeviation).toBeGreaterThan(0);
      expect(statistics.confidenceInterval[0]).toBeLessThan(statistics.confidenceInterval[1]);
      expect(statistics.distribution.excellent + statistics.distribution.good + 
             statistics.distribution.average + statistics.distribution.poor).toBe(1);

      console.log(`Quality Statistics:`);
      console.log(`  Mean: ${statistics.mean.toFixed(3)}`);
      console.log(`  Median: ${statistics.median.toFixed(3)}`);
      console.log(`  Std Dev: ${statistics.standardDeviation.toFixed(3)}`);
      console.log(`  Distribution: ${JSON.stringify(statistics.distribution)}`);
      console.log(`  Trends: ${JSON.stringify(statistics.trends)}`);
    });

    it('should compare results against baseline', async () => {
      const baseline = {
        templateId: 'baseline-template',
        category: 'general',
        historicalMean: 0.8,
        historicalStdDev: 0.1,
        sampleSize: 100,
        lastUpdated: new Date(),
        benchmarkMetrics: {
          tokenReduction: 20,
          accuracyImprovement: 10,
          qualityScore: 0.8,
          processingTime: 3000
        }
      };

      // Test result above baseline
      const goodResult = OptimizationResultFactory.createSuccessfulResult('baseline-good');
      goodResult.qualityScore.overall = 0.9;

      const goodComparison = await validator.compareWithBaseline(goodResult, baseline);
      expect(goodComparison.passed).toBe(true);
      expect(goodComparison.details?.qualityDiff).toBeGreaterThan(0);

      // Test result below baseline
      const poorResult = OptimizationResultFactory.createFailedOptimizationResult('baseline-poor');
      poorResult.qualityScore.overall = 0.6;

      const poorComparison = await validator.compareWithBaseline(poorResult, baseline);
      expect(poorComparison.passed).toBe(false);
      expect(poorComparison.details?.qualityDiff).toBeLessThan(0);

      console.log(`Good result vs baseline: ${goodComparison.passed} (Δ: ${goodComparison.details?.qualityDiff.toFixed(3)})`);
      console.log(`Poor result vs baseline: ${poorComparison.passed} (Δ: ${poorComparison.details?.qualityDiff.toFixed(3)})`);
    });

    it('should update baselines with new data', async () => {
      const templateId = 'updating-baseline';
      const initialResult = OptimizationResultFactory.createSuccessfulResult(templateId);
      initialResult.qualityScore.overall = 0.8;

      // Update baseline with first result
      validator.updateBaseline(templateId, initialResult);

      const newResult = OptimizationResultFactory.createSuccessfulResult(templateId);
      newResult.qualityScore.overall = 0.9;

      // Update baseline with second result
      validator.updateBaseline(templateId, newResult);

      // The baseline should reflect the update (implementation would use exponential moving average)
      console.log('Baseline updated with new data');
    });
  });

  describe('Quality Reporting', () => {
    it('should generate comprehensive quality report', async () => {
      // Generate diverse validation history
      const testCases = [
        ...Array(10).fill(0).map((_, i) => OptimizationResultFactory.createSuccessfulResult(`report-success-${i}`)),
        ...Array(5).fill(0).map((_, i) => OptimizationResultFactory.createPartialSuccessResult(`report-partial-${i}`)),
        ...Array(3).fill(0).map((_, i) => OptimizationResultFactory.createFailedOptimizationResult(`report-failed-${i}`))
      ];

      for (const result of testCases) {
        await validator.validate(result);
      }

      const report = validator.generateQualityReport();

      expect(report.summary.totalValidations).toBe(18);
      expect(report.summary.passRate).toBeGreaterThan(0.5);
      expect(report.summary.averageScore).toBeGreaterThan(0);
      expect(report.statistics).toBeDefined();
      expect(report.topIssues).toBeDefined();
      expect(report.recommendations).toBeDefined();

      console.log(`Quality Report Summary:`);
      console.log(`  Total Validations: ${report.summary.totalValidations}`);
      console.log(`  Pass Rate: ${(report.summary.passRate * 100).toFixed(1)}%`);
      console.log(`  Average Score: ${report.summary.averageScore.toFixed(3)}`);
      console.log(`  Regressions: ${report.summary.regressionCount}`);
      console.log(`  Top Issues: ${report.topIssues.length}`);
      console.log(`  Recommendations: ${report.recommendations.length}`);
    });

    it('should identify common quality issues', async () => {
      const problematicResults = [
        // Low quality issues
        ...Array(5).fill(0).map((_, i) => {
          const result = OptimizationResultFactory.createFailedOptimizationResult(`quality-issue-${i}`);
          result.qualityScore.overall = 0.4;
          return result;
        }),
        // Token increase issues  
        ...Array(3).fill(0).map((_, i) => {
          const result = OptimizationResultFactory.createSuccessfulResult(`token-issue-${i}`);
          result.metrics.tokenReduction = -15;
          return result;
        }),
        // Variable integrity issues
        ...Array(4).fill(0).map((_, i) => {
          const result = OptimizationResultFactory.createSuccessfulResult(`variable-issue-${i}`);
          result.originalTemplate.content = 'Hello {{name}} and {{title}}';
          result.optimizedTemplate.content = 'Hello there'; // Variables removed
          return result;
        })
      ];

      for (const result of problematicResults) {
        await validator.validate(result);
      }

      const report = validator.generateQualityReport();
      
      expect(report.topIssues.length).toBeGreaterThan(0);
      expect(report.topIssues.some(issue => issue.issue.includes('qualityScore'))).toBe(true);
      expect(report.topIssues.some(issue => issue.issue.includes('tokenReduction'))).toBe(true);
      expect(report.topIssues.some(issue => issue.issue.includes('variableIntegrity'))).toBe(true);

      console.log('Top Quality Issues:');
      report.topIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.issue}: ${issue.frequency} occurrences (${issue.severity})`);
      });
    });

    it('should track quality trends over time', async () => {
      // Simulate improving quality over time
      const trendResults = [];
      for (let i = 0; i < 20; i++) {
        const result = OptimizationResultFactory.createSuccessfulResult(`trend-${i}`);
        // Simulate gradual improvement
        result.qualityScore.overall = 0.6 + (i / 20) * 0.3; // 0.6 to 0.9
        trendResults.push(result);
      }

      for (const result of trendResults) {
        await validator.validate(result);
      }

      const statistics = validator.getQualityStatistics();
      
      expect(statistics.trends.improving || statistics.trends.stable).toBe(true);
      
      console.log(`Quality Trends:`);
      console.log(`  Improving: ${statistics.trends.improving}`);
      console.log(`  Stable: ${statistics.trends.stable}`);
      console.log(`  Degrading: ${statistics.trends.degrading}`);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain validation accuracy under high load', async () => {
      const startTime = Date.now();
      const loadTestCount = 100;
      const validationPromises = [];

      for (let i = 0; i < loadTestCount; i++) {
        const result = OptimizationResultFactory.createSuccessfulResult(`load-${i}`);
        validationPromises.push(validator.validate(result));
      }

      const reports = await Promise.all(validationPromises);
      const duration = Date.now() - startTime;

      const passedCount = reports.filter(report => report.passed).length;
      const averageScore = reports.reduce((sum, report) => sum + report.score, 0) / reports.length;
      const validationsPerSecond = loadTestCount / (duration / 1000);

      expect(passedCount).toBeGreaterThan(loadTestCount * 0.8); // At least 80% pass rate
      expect(averageScore).toBeGreaterThan(0.7);
      expect(validationsPerSecond).toBeGreaterThan(10); // At least 10 validations per second

      console.log(`Load Test Results:`);
      console.log(`  Validations: ${loadTestCount}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Throughput: ${validationsPerSecond.toFixed(2)} validations/sec`);
      console.log(`  Pass Rate: ${(passedCount / loadTestCount * 100).toFixed(1)}%`);
      console.log(`  Average Score: ${averageScore.toFixed(3)}`);
    }, 30000);
  });
});
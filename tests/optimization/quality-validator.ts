/**
 * @fileoverview Quality validation utilities for optimization results
 * @lastmodified 2025-08-26T18:00:00Z
 *
 * Features: Semantic similarity validation, quality regression detection, statistical analysis
 * Main APIs: QualityValidator class, ValidationReport, ComparisonMetrics
 * Constraints: Requires NLP libraries for semantic analysis, statistical functions
 * Patterns: Validator pattern, statistical analysis, quality assurance
 */

import { 
  OptimizationResult,
  QualityScore,
  PromptComparison 
} from '../../src/services/prompt-optimization.service';
import { Template } from '../../src/types';
import { logger } from '../../src/utils/logger';

/**
 * Quality validation thresholds and configuration
 */
export interface QualityThresholds {
  minQualityScore: number;
  maxTokenReductionLoss: number;
  minAccuracyImprovement: number;
  minSemanticSimilarity: number;
  maxQualityRegression: number;
  minConfidenceLevel: number;
}

/**
 * Detailed validation report for optimization results
 */
export interface ValidationReport {
  passed: boolean;
  score: number;
  timestamp: Date;
  templateId: string;
  validations: {
    qualityScore: ValidationResult;
    tokenReduction: ValidationResult;
    accuracyImprovement: ValidationResult;
    semanticPreservation: ValidationResult;
    variableIntegrity: ValidationResult;
    confidenceLevel: ValidationResult;
  };
  metrics: {
    overallScore: number;
    regressionRisk: number;
    improvementFactor: number;
    reliabilityIndex: number;
  };
  recommendations: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Individual validation result
 */
export interface ValidationResult {
  passed: boolean;
  score: number;
  threshold: number;
  actualValue: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details?: Record<string, any>;
}

/**
 * Comparison metrics between original and optimized templates
 */
export interface ComparisonMetrics {
  similarity: {
    semantic: number;
    structural: number;
    lexical: number;
  };
  preservation: {
    variables: number;
    intent: number;
    context: number;
  };
  improvement: {
    clarity: number;
    conciseness: number;
    effectiveness: number;
  };
}

/**
 * Statistical analysis results for quality assessment
 */
export interface QualityStatistics {
  mean: number;
  median: number;
  standardDeviation: number;
  confidenceInterval: [number, number];
  distribution: {
    excellent: number;
    good: number;
    average: number;
    poor: number;
  };
  trends: {
    improving: boolean;
    stable: boolean;
    degrading: boolean;
  };
}

/**
 * Quality baseline for comparison
 */
export interface QualityBaseline {
  templateId: string;
  category: string;
  historicalMean: number;
  historicalStdDev: number;
  sampleSize: number;
  lastUpdated: Date;
  benchmarkMetrics: {
    tokenReduction: number;
    accuracyImprovement: number;
    qualityScore: number;
    processingTime: number;
  };
}

/**
 * Comprehensive quality validator for optimization results
 */
export class QualityValidator {
  private thresholds: QualityThresholds;
  private baselines: Map<string, QualityBaseline> = new Map();
  private validationHistory: ValidationReport[] = [];

  constructor(thresholds: Partial<QualityThresholds> = {}) {
    this.thresholds = {
      minQualityScore: 0.7,
      maxTokenReductionLoss: -10, // Allow slight increase if quality improves significantly
      minAccuracyImprovement: 0,
      minSemanticSimilarity: 0.8,
      maxQualityRegression: 0.1,
      minConfidenceLevel: 0.6,
      ...thresholds
    };
  }

  /**
   * Validate optimization result against quality standards
   */
  async validate(result: OptimizationResult): Promise<ValidationReport> {
    logger.info(`Validating optimization result for template: ${result.templateId}`);

    const report: ValidationReport = {
      passed: false,
      score: 0,
      timestamp: new Date(),
      templateId: result.templateId,
      validations: {
        qualityScore: await this.validateQualityScore(result),
        tokenReduction: this.validateTokenReduction(result),
        accuracyImprovement: this.validateAccuracyImprovement(result),
        semanticPreservation: await this.validateSemanticPreservation(result),
        variableIntegrity: this.validateVariableIntegrity(result),
        confidenceLevel: this.validateConfidenceLevel(result)
      },
      metrics: {
        overallScore: 0,
        regressionRisk: 0,
        improvementFactor: 0,
        reliabilityIndex: 0
      },
      recommendations: [],
      warnings: [],
      errors: []
    };

    // Calculate overall metrics
    report.metrics = this.calculateMetrics(report.validations, result);
    
    // Generate recommendations
    report.recommendations = this.generateRecommendations(report.validations, result);
    
    // Collect warnings and errors
    this.collectIssues(report);

    // Determine pass/fail status
    report.passed = this.determinePassStatus(report.validations);
    report.score = this.calculateOverallScore(report.validations);

    // Store in history
    this.validationHistory.push(report);

    logger.info(`Validation completed: ${report.passed ? 'PASS' : 'FAIL'} (Score: ${report.score.toFixed(2)})`);

    return report;
  }

  /**
   * Validate quality score meets minimum threshold
   */
  private async validateQualityScore(result: OptimizationResult): Promise<ValidationResult> {
    const actualValue = result.qualityScore.overall;
    const threshold = this.thresholds.minQualityScore;
    const passed = actualValue >= threshold;

    return {
      passed,
      score: passed ? 1.0 : actualValue / threshold,
      threshold,
      actualValue,
      message: passed 
        ? `Quality score ${actualValue.toFixed(2)} meets minimum threshold`
        : `Quality score ${actualValue.toFixed(2)} below threshold ${threshold}`,
      severity: passed ? 'low' : (actualValue < threshold * 0.8 ? 'critical' : 'high'),
      details: {
        breakdown: result.qualityScore.breakdown,
        confidence: result.qualityScore.confidence
      }
    };
  }

  /**
   * Validate token reduction is within acceptable limits
   */
  private validateTokenReduction(result: OptimizationResult): ValidationResult {
    const actualValue = result.metrics.tokenReduction;
    const threshold = this.thresholds.maxTokenReductionLoss;
    const passed = actualValue >= threshold;

    return {
      passed,
      score: passed ? Math.min(actualValue / 20, 1.0) : 0, // Scale based on 20% reduction target
      threshold,
      actualValue,
      message: passed
        ? `Token reduction ${actualValue.toFixed(1)}% is acceptable`
        : `Token reduction ${actualValue.toFixed(1)}% exceeds loss threshold`,
      severity: actualValue < -20 ? 'critical' : (actualValue < 0 ? 'medium' : 'low'),
      details: {
        originalTokens: result.comparison.metrics?.originalTokens,
        optimizedTokens: result.comparison.metrics?.optimizedTokens
      }
    };
  }

  /**
   * Validate accuracy improvement meets expectations
   */
  private validateAccuracyImprovement(result: OptimizationResult): ValidationResult {
    const actualValue = result.metrics.accuracyImprovement;
    const threshold = this.thresholds.minAccuracyImprovement;
    const passed = actualValue >= threshold;

    return {
      passed,
      score: passed ? Math.min(actualValue / 10, 1.0) : Math.max(0, (actualValue + 10) / 10),
      threshold,
      actualValue,
      message: passed
        ? `Accuracy improvement ${actualValue.toFixed(1)}% meets expectations`
        : `Accuracy improvement ${actualValue.toFixed(1)}% below threshold`,
      severity: actualValue < -10 ? 'critical' : (actualValue < 0 ? 'high' : 'low')
    };
  }

  /**
   * Validate semantic similarity between original and optimized templates
   */
  private async validateSemanticPreservation(result: OptimizationResult): Promise<ValidationResult> {
    // Simulate semantic similarity calculation
    // In a real implementation, this would use NLP libraries like sentence-transformers
    const semanticSimilarity = this.calculateSemanticSimilarity(
      result.originalTemplate.content || '',
      result.optimizedTemplate.content || ''
    );

    const threshold = this.thresholds.minSemanticSimilarity;
    const passed = semanticSimilarity >= threshold;

    return {
      passed,
      score: semanticSimilarity,
      threshold,
      actualValue: semanticSimilarity,
      message: passed
        ? `Semantic similarity ${semanticSimilarity.toFixed(2)} preserves original meaning`
        : `Semantic similarity ${semanticSimilarity.toFixed(2)} may have lost meaning`,
      severity: semanticSimilarity < 0.6 ? 'critical' : (semanticSimilarity < 0.7 ? 'high' : 'low'),
      details: {
        originalLength: result.originalTemplate.content?.length || 0,
        optimizedLength: result.optimizedTemplate.content?.length || 0,
        compressionRatio: this.calculateCompressionRatio(result)
      }
    };
  }

  /**
   * Validate variable integrity (all variables preserved)
   */
  private validateVariableIntegrity(result: OptimizationResult): ValidationResult {
    const originalVariables = this.extractVariables(result.originalTemplate.content || '');
    const optimizedVariables = this.extractVariables(result.optimizedTemplate.content || '');
    
    const missingVariables = originalVariables.filter(v => !optimizedVariables.includes(v));
    const extraVariables = optimizedVariables.filter(v => !originalVariables.includes(v));
    
    const integrityScore = Math.max(0, 1 - (missingVariables.length * 0.5 + extraVariables.length * 0.3));
    const passed = missingVariables.length === 0;

    return {
      passed,
      score: integrityScore,
      threshold: 1.0,
      actualValue: integrityScore,
      message: passed
        ? 'All template variables preserved'
        : `${missingVariables.length} variables missing, ${extraVariables.length} added`,
      severity: missingVariables.length > 2 ? 'critical' : (missingVariables.length > 0 ? 'high' : 'low'),
      details: {
        originalVariables,
        optimizedVariables,
        missingVariables,
        extraVariables
      }
    };
  }

  /**
   * Validate confidence level meets minimum requirements
   */
  private validateConfidenceLevel(result: OptimizationResult): ValidationResult {
    const actualValue = result.qualityScore.confidence || 0;
    const threshold = this.thresholds.minConfidenceLevel;
    const passed = actualValue >= threshold;

    return {
      passed,
      score: actualValue,
      threshold,
      actualValue,
      message: passed
        ? `Confidence level ${actualValue.toFixed(2)} is acceptable`
        : `Confidence level ${actualValue.toFixed(2)} too low for reliable optimization`,
      severity: actualValue < 0.4 ? 'critical' : (actualValue < 0.5 ? 'high' : 'medium')
    };
  }

  /**
   * Calculate comprehensive metrics from validation results
   */
  private calculateMetrics(
    validations: ValidationReport['validations'], 
    result: OptimizationResult
  ): ValidationReport['metrics'] {
    const validationScores = Object.values(validations).map(v => v.score);
    const overallScore = validationScores.reduce((sum, score) => sum + score, 0) / validationScores.length;

    const regressionRisk = this.calculateRegressionRisk(validations, result);
    const improvementFactor = this.calculateImprovementFactor(result);
    const reliabilityIndex = this.calculateReliabilityIndex(validations);

    return {
      overallScore,
      regressionRisk,
      improvementFactor,
      reliabilityIndex
    };
  }

  /**
   * Generate actionable recommendations based on validation results
   */
  private generateRecommendations(
    validations: ValidationReport['validations'],
    result: OptimizationResult
  ): string[] {
    const recommendations: string[] = [];

    if (!validations.qualityScore.passed) {
      recommendations.push(
        'Consider increasing mutation-refinement iterations to improve quality score'
      );
    }

    if (!validations.tokenReduction.passed && result.metrics.tokenReduction < -10) {
      recommendations.push(
        'Template became significantly longer - review optimization parameters'
      );
    }

    if (!validations.semanticPreservation.passed) {
      recommendations.push(
        'Semantic similarity is low - manually review optimized content for meaning preservation'
      );
    }

    if (!validations.variableIntegrity.passed) {
      const missingVars = (validations.variableIntegrity.details?.missingVariables as string[]) || [];
      if (missingVars.length > 0) {
        recommendations.push(
          `Restore missing template variables: ${missingVars.join(', ')}`
        );
      }
    }

    if (!validations.confidenceLevel.passed) {
      recommendations.push(
        'Low confidence score suggests re-optimization with different parameters'
      );
    }

    if (validations.accuracyImprovement.actualValue < 5) {
      recommendations.push(
        'Consider increasing few-shot examples to improve accuracy gains'
      );
    }

    // Performance recommendations
    if (result.metrics.optimizationTime > 10000) {
      recommendations.push(
        'Optimization took longer than expected - consider caching or parameter tuning'
      );
    }

    return recommendations;
  }

  /**
   * Collect warnings and errors from validation results
   */
  private collectIssues(report: ValidationReport): void {
    Object.entries(report.validations).forEach(([key, validation]) => {
      if (!validation.passed) {
        const issue = `${key}: ${validation.message}`;
        
        if (validation.severity === 'critical') {
          report.errors.push(issue);
        } else if (validation.severity === 'high' || validation.severity === 'medium') {
          report.warnings.push(issue);
        }
      }
    });
  }

  /**
   * Determine overall pass/fail status
   */
  private determinePassStatus(validations: ValidationReport['validations']): boolean {
    // Must pass all critical validations
    const criticalValidations = ['qualityScore', 'semanticPreservation', 'variableIntegrity'];
    const criticalPassed = criticalValidations.every(key => 
      validations[key as keyof typeof validations].passed
    );

    // Must pass majority of all validations
    const allValidations = Object.values(validations);
    const passedCount = allValidations.filter(v => v.passed).length;
    const majorityPassed = passedCount >= Math.ceil(allValidations.length * 0.6);

    return criticalPassed && majorityPassed;
  }

  /**
   * Calculate weighted overall score
   */
  private calculateOverallScore(validations: ValidationReport['validations']): number {
    const weights = {
      qualityScore: 0.25,
      tokenReduction: 0.15,
      accuracyImprovement: 0.15,
      semanticPreservation: 0.25,
      variableIntegrity: 0.15,
      confidenceLevel: 0.05
    };

    return Object.entries(validations).reduce((score, [key, validation]) => {
      const weight = weights[key as keyof typeof weights] || 0;
      return score + (validation.score * weight);
    }, 0);
  }

  /**
   * Calculate regression risk based on validation results
   */
  private calculateRegressionRisk(
    validations: ValidationReport['validations'],
    result: OptimizationResult
  ): number {
    let risk = 0;

    // High risk if quality score drops
    if (result.qualityScore.overall < 0.7) risk += 0.3;
    
    // Risk from semantic changes
    if (!validations.semanticPreservation.passed) risk += 0.4;
    
    // Risk from variable issues
    if (!validations.variableIntegrity.passed) risk += 0.2;
    
    // Risk from low confidence
    if (validations.confidenceLevel.actualValue < 0.5) risk += 0.1;

    return Math.min(risk, 1.0);
  }

  /**
   * Calculate improvement factor
   */
  private calculateImprovementFactor(result: OptimizationResult): number {
    const qualityImprovement = Math.max(0, result.qualityScore.overall - 0.5) * 2;
    const tokenImprovement = Math.max(0, result.metrics.tokenReduction) / 30;
    const accuracyImprovement = Math.max(0, result.metrics.accuracyImprovement) / 20;

    return (qualityImprovement + tokenImprovement + accuracyImprovement) / 3;
  }

  /**
   * Calculate reliability index
   */
  private calculateReliabilityIndex(validations: ValidationReport['validations']): number {
    const passedCount = Object.values(validations).filter(v => v.passed).length;
    const totalCount = Object.values(validations).length;
    const passRate = passedCount / totalCount;

    // Weight by confidence level
    const avgConfidence = Object.values(validations).reduce((sum, v) => sum + v.score, 0) / totalCount;
    
    return (passRate * 0.7) + (avgConfidence * 0.3);
  }

  /**
   * Calculate semantic similarity (simplified implementation)
   */
  private calculateSemanticSimilarity(original: string, optimized: string): number {
    // Simplified semantic similarity - in reality would use embeddings
    const originalWords = this.tokenize(original.toLowerCase());
    const optimizedWords = this.tokenize(optimized.toLowerCase());
    
    const commonWords = originalWords.filter(word => optimizedWords.includes(word));
    const uniqueWords = new Set([...originalWords, ...optimizedWords]);
    
    const jaccardSimilarity = commonWords.length / uniqueWords.size;
    
    // Adjust for length similarity
    const lengthRatio = Math.min(optimized.length, original.length) / Math.max(optimized.length, original.length);
    
    // Combine metrics
    return (jaccardSimilarity * 0.7) + (lengthRatio * 0.3);
  }

  /**
   * Extract template variables
   */
  private extractVariables(content: string): string[] {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const variable = match[1].trim();
      if (variable && !variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables.sort();
  }

  /**
   * Calculate compression ratio
   */
  private calculateCompressionRatio(result: OptimizationResult): number {
    const originalLength = result.originalTemplate.content?.length || 1;
    const optimizedLength = result.optimizedTemplate.content?.length || 1;
    return optimizedLength / originalLength;
  }

  /**
   * Tokenize text for similarity calculation
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  /**
   * Compare optimization result against baseline
   */
  async compareWithBaseline(
    result: OptimizationResult, 
    baseline: QualityBaseline
  ): Promise<ValidationResult> {
    const qualityDiff = result.qualityScore.overall - baseline.historicalMean;
    const tokenDiff = result.metrics.tokenReduction - baseline.benchmarkMetrics.tokenReduction;
    const accuracyDiff = result.metrics.accuracyImprovement - baseline.benchmarkMetrics.accuracyImprovement;
    
    // Calculate Z-score for statistical significance
    const zScore = qualityDiff / baseline.historicalStdDev;
    const statisticallySignificant = Math.abs(zScore) > 1.96; // 95% confidence

    const overallDiff = (qualityDiff + tokenDiff/30 + accuracyDiff/20) / 3;
    const passed = overallDiff >= -this.thresholds.maxQualityRegression;

    return {
      passed,
      score: Math.max(0, 0.5 + overallDiff),
      threshold: baseline.historicalMean - this.thresholds.maxQualityRegression,
      actualValue: result.qualityScore.overall,
      message: passed
        ? `Performance meets or exceeds baseline (Δ: ${(overallDiff * 100).toFixed(1)}%)`
        : `Performance below baseline (Δ: ${(overallDiff * 100).toFixed(1)}%)`,
      severity: overallDiff < -0.2 ? 'critical' : (overallDiff < -0.1 ? 'high' : 'low'),
      details: {
        baseline: baseline.historicalMean,
        zScore,
        statisticallySignificant,
        qualityDiff,
        tokenDiff,
        accuracyDiff
      }
    };
  }

  /**
   * Generate quality statistics from validation history
   */
  getQualityStatistics(templateCategory?: string): QualityStatistics {
    let relevantReports = this.validationHistory;
    
    if (templateCategory) {
      relevantReports = this.validationHistory.filter(report => {
        // This would need template category information
        return true; // Simplified for now
      });
    }

    if (relevantReports.length === 0) {
      return {
        mean: 0,
        median: 0,
        standardDeviation: 0,
        confidenceInterval: [0, 0],
        distribution: { excellent: 0, good: 0, average: 0, poor: 0 },
        trends: { improving: false, stable: true, degrading: false }
      };
    }

    const scores = relevantReports.map(r => r.score);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const sortedScores = [...scores].sort((a, b) => a - b);
    const median = sortedScores[Math.floor(sortedScores.length / 2)];
    
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    const confidenceInterval: [number, number] = [
      mean - (1.96 * standardDeviation / Math.sqrt(scores.length)),
      mean + (1.96 * standardDeviation / Math.sqrt(scores.length))
    ];

    // Distribution analysis
    const distribution = {
      excellent: scores.filter(s => s >= 0.9).length / scores.length,
      good: scores.filter(s => s >= 0.7 && s < 0.9).length / scores.length,
      average: scores.filter(s => s >= 0.5 && s < 0.7).length / scores.length,
      poor: scores.filter(s => s < 0.5).length / scores.length
    };

    // Trend analysis (simplified)
    const recentScores = scores.slice(-10);
    const olderScores = scores.slice(0, -10);
    
    const recentMean = recentScores.length > 0 ? 
      recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length : mean;
    const olderMean = olderScores.length > 0 ? 
      olderScores.reduce((sum, s) => sum + s, 0) / olderScores.length : mean;

    const trends = {
      improving: recentMean > olderMean + 0.05,
      stable: Math.abs(recentMean - olderMean) <= 0.05,
      degrading: recentMean < olderMean - 0.05
    };

    return {
      mean,
      median,
      standardDeviation,
      confidenceInterval,
      distribution,
      trends
    };
  }

  /**
   * Update quality baseline with new data
   */
  updateBaseline(templateId: string, result: OptimizationResult): void {
    const existing = this.baselines.get(templateId);
    
    if (existing) {
      // Update existing baseline with exponential moving average
      const alpha = 0.1; // Learning rate
      existing.historicalMean = (1 - alpha) * existing.historicalMean + alpha * result.qualityScore.overall;
      existing.sampleSize += 1;
      existing.lastUpdated = new Date();
    } else {
      // Create new baseline
      const baseline: QualityBaseline = {
        templateId,
        category: result.originalTemplate.category || 'general',
        historicalMean: result.qualityScore.overall,
        historicalStdDev: 0.1, // Initial assumption
        sampleSize: 1,
        lastUpdated: new Date(),
        benchmarkMetrics: {
          tokenReduction: result.metrics.tokenReduction,
          accuracyImprovement: result.metrics.accuracyImprovement,
          qualityScore: result.qualityScore.overall,
          processingTime: result.metrics.optimizationTime
        }
      };
      
      this.baselines.set(templateId, baseline);
    }
  }

  /**
   * Generate comprehensive quality report
   */
  generateQualityReport(): {
    summary: {
      totalValidations: number;
      passRate: number;
      averageScore: number;
      regressionCount: number;
    };
    statistics: QualityStatistics;
    topIssues: Array<{
      issue: string;
      frequency: number;
      severity: string;
    }>;
    recommendations: string[];
  } {
    const totalValidations = this.validationHistory.length;
    const passedValidations = this.validationHistory.filter(r => r.passed).length;
    const passRate = totalValidations > 0 ? passedValidations / totalValidations : 0;
    const averageScore = totalValidations > 0 ? 
      this.validationHistory.reduce((sum, r) => sum + r.score, 0) / totalValidations : 0;
    const regressionCount = this.validationHistory.filter(r => r.metrics.regressionRisk > 0.5).length;

    const statistics = this.getQualityStatistics();

    // Analyze common issues
    const issueFrequency = new Map<string, { count: number; severity: string }>();
    
    this.validationHistory.forEach(report => {
      [...report.warnings, ...report.errors].forEach(issue => {
        const key = issue.split(':')[0]; // Extract issue type
        const current = issueFrequency.get(key) || { count: 0, severity: 'low' };
        current.count += 1;
        if (report.errors.includes(issue)) current.severity = 'critical';
        else if (current.severity === 'low') current.severity = 'medium';
        issueFrequency.set(key, current);
      });
    });

    const topIssues = Array.from(issueFrequency.entries())
      .map(([issue, data]) => ({ issue, frequency: data.count, severity: data.severity }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    const recommendations = [
      ...new Set(
        this.validationHistory
          .flatMap(report => report.recommendations)
          .filter(rec => rec)
      )
    ].slice(0, 10);

    return {
      summary: {
        totalValidations,
        passRate,
        averageScore,
        regressionCount
      },
      statistics,
      topIssues,
      recommendations
    };
  }
}

/**
 * Create a default quality validator with standard thresholds
 */
export function createDefaultQualityValidator(): QualityValidator {
  return new QualityValidator({
    minQualityScore: 0.7,
    maxTokenReductionLoss: -10,
    minAccuracyImprovement: 0,
    minSemanticSimilarity: 0.8,
    maxQualityRegression: 0.1,
    minConfidenceLevel: 0.6
  });
}

/**
 * Create a strict quality validator for production use
 */
export function createStrictQualityValidator(): QualityValidator {
  return new QualityValidator({
    minQualityScore: 0.85,
    maxTokenReductionLoss: -5,
    minAccuracyImprovement: 5,
    minSemanticSimilarity: 0.9,
    maxQualityRegression: 0.05,
    minConfidenceLevel: 0.8
  });
}

/**
 * Create a lenient quality validator for experimental use
 */
export function createLenientQualityValidator(): QualityValidator {
  return new QualityValidator({
    minQualityScore: 0.5,
    maxTokenReductionLoss: -25,
    minAccuracyImprovement: -10,
    minSemanticSimilarity: 0.6,
    maxQualityRegression: 0.2,
    minConfidenceLevel: 0.4
  });
}
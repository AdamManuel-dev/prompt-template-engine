/**
 * @fileoverview Token reduction optimizer for cost and efficiency optimization
 * @lastmodified 2025-08-26T14:55:00Z
 *
 * Features: Token reduction strategies, cost optimization, semantic preservation
 * Main APIs: TokenReductionOptimizer class with various reduction techniques
 * Constraints: Maintain semantic meaning while reducing token count
 * Patterns: Strategy pattern, semantic analysis, cost optimization
 */

import { logger } from '../utils/logger';

export interface TokenReductionConfig {
  targetReduction: number; // Percentage (0-90)
  preserveSemanticMeaning: boolean;
  aggressiveReduction: boolean;
  maintainStructure: boolean;
  enableAbbreviations: boolean;
  enableSynonymReplacement: boolean;
}

export interface TokenReductionResult {
  originalPrompt: string;
  optimizedPrompt: string;
  originalTokens: number;
  optimizedTokens: number;
  reductionPercentage: number;
  costSavings: {
    estimated: number;
    percentage: number;
  };
  techniquesApplied: string[];
  semanticPreservation: {
    score: number;
    warnings: string[];
  };
}

export interface CostCalculation {
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  platform: string;
  model: string;
}

export class TokenReductionOptimizer {
  private readonly defaultConfig: TokenReductionConfig = {
    targetReduction: 30, // 30% reduction by default
    preserveSemanticMeaning: true,
    aggressiveReduction: false,
    maintainStructure: true,
    enableAbbreviations: false,
    enableSynonymReplacement: true,
  };

  // Common redundant phrases and their replacements
  private readonly redundantPhrases = [
    [/please note that/gi, ''],
    [/it is important to understand that/gi, ''],
    [/you should be aware that/gi, ''],
    [/it should be mentioned that/gi, ''],
    [/it is worth noting that/gi, ''],
    [/as previously mentioned/gi, ''],
    [/as we have discussed/gi, ''],
    [/in order to/gi, 'to'],
    [/due to the fact that/gi, 'because'],
    [/for the purpose of/gi, 'to'],
    [/with regard to/gi, 'regarding'],
    [/in relation to/gi, 'regarding'],
    [/a large number of/gi, 'many'],
    [/a small number of/gi, 'few'],
    [/at this point in time/gi, 'now'],
    [/in the event that/gi, 'if'],
  ];

  // Verbose expressions and their concise alternatives
  private readonly verboseExpressions = [
    [/make a decision/gi, 'decide'],
    [/come to a conclusion/gi, 'conclude'],
    [/give consideration to/gi, 'consider'],
    [/make an improvement/gi, 'improve'],
    [/conduct an analysis/gi, 'analyze'],
    [/perform an evaluation/gi, 'evaluate'],
    [/carry out an investigation/gi, 'investigate'],
    [/provide assistance/gi, 'assist'],
    [/make a recommendation/gi, 'recommend'],
    [/give an explanation/gi, 'explain'],
  ];

  // Common abbreviations for technical contexts
  private readonly abbreviations = [
    [/application/gi, 'app'],
    [/configuration/gi, 'config'],
    [/information/gi, 'info'],
    [/documentation/gi, 'docs'],
    [/implementation/gi, 'impl'],
    [/specification/gi, 'spec'],
    [/optimization/gi, 'opt'],
    [/development/gi, 'dev'],
    [/environment/gi, 'env'],
    [/management/gi, 'mgmt'],
  ];

  // Synonym replacements for shorter alternatives
  private readonly synonymReplacements = [
    [/utilize/gi, 'use'],
    [/demonstrate/gi, 'show'],
    [/accomplish/gi, 'do'],
    [/facilitate/gi, 'help'],
    [/initialize/gi, 'start'],
    [/terminate/gi, 'end'],
    [/construct/gi, 'build'],
    [/additional/gi, 'more'],
    [/numerous/gi, 'many'],
    [/frequently/gi, 'often'],
    [/immediately/gi, 'now'],
    [/subsequently/gi, 'then'],
  ];

  constructor(
    private config: TokenReductionConfig = {} as TokenReductionConfig
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Optimize prompt for token reduction
   */
  async optimizeTokens(prompt: string): Promise<TokenReductionResult> {
    logger.info(
      `Starting token reduction optimization with ${this.config.targetReduction}% target`
    );

    const originalTokens = this.estimateTokens(prompt);
    let optimizedPrompt = prompt;
    const techniquesApplied: string[] = [];
    const semanticWarnings: string[] = [];

    // Apply reduction techniques in order of semantic safety
    if (this.config.preserveSemanticMeaning) {
      // Conservative approaches first
      optimizedPrompt = this.removeRedundantPhrases(optimizedPrompt);
      if (optimizedPrompt !== prompt)
        techniquesApplied.push('Redundant phrase removal');

      optimizedPrompt = this.simplifyVerboseExpressions(optimizedPrompt);
      if (optimizedPrompt !== prompt)
        techniquesApplied.push('Verbose expression simplification');

      if (this.config.enableSynonymReplacement) {
        const synonymResult = this.applySynonymReplacements(optimizedPrompt);
        optimizedPrompt = synonymResult.prompt;
        if (synonymResult.applied)
          techniquesApplied.push('Synonym replacement');
      }
    }

    // Whitespace and formatting optimization (always safe)
    const whitespaceResult = this.optimizeWhitespace(optimizedPrompt);
    optimizedPrompt = whitespaceResult.prompt;
    if (whitespaceResult.applied)
      techniquesApplied.push('Whitespace optimization');

    // More aggressive techniques if enabled
    if (this.config.aggressiveReduction) {
      const aggressiveResult = this.applyAggressiveReduction(optimizedPrompt);
      optimizedPrompt = aggressiveResult.prompt;
      if (aggressiveResult.applied) {
        techniquesApplied.push(...aggressiveResult.techniques);
        semanticWarnings.push(...aggressiveResult.warnings);
      }
    }

    // Technical abbreviations if enabled
    if (this.config.enableAbbreviations) {
      const abbrevResult = this.applyAbbreviations(optimizedPrompt);
      optimizedPrompt = abbrevResult.prompt;
      if (abbrevResult.applied) {
        techniquesApplied.push('Technical abbreviations');
        semanticWarnings.push('Abbreviations may reduce readability');
      }
    }

    // Structure preservation check
    if (!this.config.maintainStructure) {
      const structureResult = this.optimizeStructure(optimizedPrompt);
      optimizedPrompt = structureResult.prompt;
      if (structureResult.applied) {
        techniquesApplied.push('Structure optimization');
        semanticWarnings.push(...structureResult.warnings);
      }
    }

    const optimizedTokens = this.estimateTokens(optimizedPrompt);
    const reductionPercentage =
      ((originalTokens - optimizedTokens) / originalTokens) * 100;

    // Calculate semantic preservation score
    const semanticScore = this.calculateSemanticPreservation(
      prompt,
      optimizedPrompt
    );

    // Estimate cost savings
    const costSavings = this.calculateCostSavings(
      originalTokens,
      optimizedTokens
    );

    return {
      originalPrompt: prompt,
      optimizedPrompt,
      originalTokens,
      optimizedTokens,
      reductionPercentage,
      costSavings,
      techniquesApplied,
      semanticPreservation: {
        score: semanticScore,
        warnings: semanticWarnings,
      },
    };
  }

  /**
   * Remove redundant phrases that don't add meaning
   */
  private removeRedundantPhrases(prompt: string): string {
    let optimized = prompt;

    for (const [pattern, replacement] of this.redundantPhrases) {
      optimized = optimized.replace(pattern as RegExp, replacement as string);
    }

    return optimized;
  }

  /**
   * Simplify verbose expressions
   */
  private simplifyVerboseExpressions(prompt: string): string {
    let optimized = prompt;

    for (const [pattern, replacement] of this.verboseExpressions) {
      optimized = optimized.replace(pattern as RegExp, replacement as string);
    }

    return optimized;
  }

  /**
   * Apply synonym replacements for shorter words
   */
  private applySynonymReplacements(prompt: string): {
    prompt: string;
    applied: boolean;
  } {
    let optimized = prompt;
    let applied = false;

    for (const [pattern, replacement] of this.synonymReplacements) {
      const original = optimized;
      optimized = optimized.replace(pattern as RegExp, replacement as string);
      if (optimized !== original) applied = true;
    }

    return { prompt: optimized, applied };
  }

  /**
   * Optimize whitespace and formatting
   */
  private optimizeWhitespace(prompt: string): {
    prompt: string;
    applied: boolean;
  } {
    const original = prompt;

    // Remove extra spaces
    let optimized = prompt.replace(/\s+/g, ' ');

    // Remove excessive line breaks
    optimized = optimized.replace(/\n\s*\n\s*\n/g, '\n\n');

    // Remove leading/trailing whitespace
    optimized = optimized.trim();

    // Remove spaces around punctuation where appropriate
    optimized = optimized.replace(/\s+([.,;:!?])/g, '$1');

    return { prompt: optimized, applied: optimized !== original };
  }

  /**
   * Apply aggressive reduction techniques
   */
  private applyAggressiveReduction(prompt: string): {
    prompt: string;
    applied: boolean;
    techniques: string[];
    warnings: string[];
  } {
    let optimized = prompt;
    const techniques: string[] = [];
    const warnings: string[] = [];
    const original = prompt;

    // Remove filler words
    const fillerWords = [
      /\b(really|very|quite|rather|pretty|fairly|somewhat)\s+/gi,
      /\b(actually|basically|essentially|generally|typically)\s+/gi,
      /\b(obviously|clearly|certainly|definitely|absolutely)\s+/gi,
    ];

    for (const pattern of fillerWords) {
      const before = optimized;
      optimized = optimized.replace(pattern, '');
      if (optimized !== before) {
        techniques.push('Filler word removal');
        warnings.push('Removed emphasis words - may affect tone');
        break;
      }
    }

    // Simplify complex sentences
    optimized = optimized.replace(/,\s*which\s+/gi, ' that ');
    optimized = optimized.replace(/,\s*and\s+also\s+/gi, ', ');
    if (optimized !== original) {
      techniques.push('Sentence simplification');
    }

    // Remove courtesies if being very aggressive
    if (this.config.targetReduction > 50) {
      optimized = optimized.replace(/please\s+/gi, '');
      optimized = optimized.replace(/thank you/gi, '');
      optimized = optimized.replace(/if you don't mind/gi, '');
      techniques.push('Courtesy removal');
      warnings.push('Removed courtesies - may sound abrupt');
    }

    return {
      prompt: optimized,
      applied: optimized !== original,
      techniques,
      warnings,
    };
  }

  /**
   * Apply technical abbreviations
   */
  private applyAbbreviations(prompt: string): {
    prompt: string;
    applied: boolean;
  } {
    let optimized = prompt;
    let applied = false;

    for (const [pattern, replacement] of this.abbreviations) {
      const original = optimized;
      optimized = optimized.replace(pattern as RegExp, replacement as string);
      if (optimized !== original) applied = true;
    }

    return { prompt: optimized, applied };
  }

  /**
   * Optimize prompt structure
   */
  private optimizeStructure(prompt: string): {
    prompt: string;
    applied: boolean;
    warnings: string[];
  } {
    let optimized = prompt;
    const warnings: string[] = [];
    const original = prompt;

    // Convert numbered lists to more compact format
    optimized = optimized.replace(/\n\d+\.\s+/g, ' ');
    if (optimized !== original) {
      warnings.push('Converted numbered lists to compact format');
    }

    // Combine short paragraphs
    const paragraphs = optimized.split('\n\n');
    const combined: string[] = [];
    let currentParagraph = '';

    for (const paragraph of paragraphs) {
      if (paragraph.trim().length < 100 && currentParagraph.length < 200) {
        currentParagraph += (currentParagraph ? ' ' : '') + paragraph.trim();
      } else {
        if (currentParagraph) combined.push(currentParagraph);
        currentParagraph = paragraph.trim();
      }
    }
    if (currentParagraph) combined.push(currentParagraph);

    const restructured = combined.join('\n\n');
    if (restructured !== optimized) {
      optimized = restructured;
      warnings.push('Combined short paragraphs for efficiency');
    }

    return {
      prompt: optimized,
      applied: optimized !== original,
      warnings,
    };
  }

  /**
   * Calculate semantic preservation score
   */
  private calculateSemanticPreservation(
    original: string,
    optimized: string
  ): number {
    // Simple heuristic based on content preservation
    let score = 100;

    // Check for significant length reduction
    const lengthReduction =
      (original.length - optimized.length) / original.length;
    if (lengthReduction > 0.5) score -= 20;
    else if (lengthReduction > 0.3) score -= 10;

    // Check for key concept preservation
    const originalWords = original.toLowerCase().match(/\b\w+\b/g) || [];
    const optimizedWords = optimized.toLowerCase().match(/\b\w+\b/g) || [];

    const uniqueOriginal = new Set(originalWords);
    const uniqueOptimized = new Set(optimizedWords);

    const preservedConcepts = [...uniqueOriginal].filter(word =>
      uniqueOptimized.has(word)
    );
    const conceptPreservation = preservedConcepts.length / uniqueOriginal.size;

    score = Math.min(score, conceptPreservation * 100);

    // Deduct for aggressive techniques
    if (this.config.aggressiveReduction) score -= 10;
    if (!this.config.maintainStructure) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate estimated cost savings
   */
  private calculateCostSavings(
    originalTokens: number,
    optimizedTokens: number
  ): {
    estimated: number;
    percentage: number;
  } {
    const tokenReduction = originalTokens - optimizedTokens;
    const reductionPercentage = (tokenReduction / originalTokens) * 100;

    // Rough cost estimation (varies by provider)
    // Using approximate GPT-4 pricing as baseline
    const costPerToken = 0.00003; // $0.03 per 1K tokens
    const estimatedSavings = tokenReduction * costPerToken;

    return {
      estimated: estimatedSavings,
      percentage: reductionPercentage,
    };
  }

  /**
   * Calculate cost for different platforms
   */
  calculatePlatformCosts(tokenCount: number): Record<string, CostCalculation> {
    const platforms = {
      'openai-gpt4': { input: 0.03, output: 0.06 }, // per 1K tokens
      'anthropic-claude': { input: 0.015, output: 0.075 },
      'google-gemini': { input: 0.0025, output: 0.0075 },
      'xai-grok': { input: 0.01, output: 0.02 },
    };

    const results: Record<string, CostCalculation> = {};

    for (const [platform, pricing] of Object.entries(platforms)) {
      const inputCost = (tokenCount / 1000) * pricing.input;
      const outputCost = (tokenCount / 1000) * pricing.output; // Assuming similar output

      results[platform] = {
        inputTokens: tokenCount,
        outputTokens: tokenCount, // Estimate
        totalCost: inputCost + outputCost,
        platform,
        model: platform.split('-')[1] || platform,
      };
    }

    return results;
  }

  /**
   * Estimate token count (approximation)
   */
  private estimateTokens(text: string): number {
    // Average tokenization approximation
    return Math.ceil(text.length / 4);
  }

  /**
   * Get reduction recommendations based on target
   */
  getReductionRecommendations(targetReduction: number): {
    techniques: string[];
    risks: string[];
    alternatives: string[];
  } {
    if (targetReduction <= 20) {
      return {
        techniques: [
          'Remove redundant phrases',
          'Optimize whitespace',
          'Simplify verbose expressions',
        ],
        risks: ['Minimal semantic impact'],
        alternatives: ['Focus on whitespace and redundancy removal'],
      };
    }
    if (targetReduction <= 40) {
      return {
        techniques: [
          'All conservative techniques',
          'Synonym replacement',
          'Technical abbreviations',
          'Filler word removal',
        ],
        risks: ['Slight reduction in readability', 'Potential tone changes'],
        alternatives: [
          'Consider multiple shorter prompts',
          'Use more specific instructions',
        ],
      };
    }
    return {
      techniques: [
        'All available techniques',
        'Aggressive reduction',
        'Structure optimization',
        'Courtesy removal',
      ],
      risks: [
        'Significant semantic changes',
        'Reduced clarity',
        'Potential misunderstanding',
      ],
      alternatives: [
        'Break into multiple shorter prompts',
        'Use bullet points instead of paragraphs',
        'Consider different model with larger context',
      ],
    };
  }
}

export default TokenReductionOptimizer;

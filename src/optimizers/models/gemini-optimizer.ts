/**
 * @fileoverview Gemini-specific prompt optimization strategies and patterns
 * @lastmodified 2025-08-26T14:15:00Z
 *
 * Features: Gemini-optimized prompt patterns, multimodal capabilities, efficiency
 * Main APIs: GeminiOptimizer class with Google-specific optimization strategies
 * Constraints: Optimized for Gemini's multimodal and efficiency characteristics
 * Patterns: Strategy pattern, multimodal optimization, efficiency-focused tuning
 */

import { logger } from '../../utils/logger';

export interface GeminiOptimizationConfig {
  maxTokens: number;
  model: 'gemini-pro' | 'gemini-pro-vision' | 'gemini-ultra';
  enableMultimodal: boolean;
  optimizeForEfficiency: boolean;
  enableStructuredPrompts: boolean;
  optimizeForCode: boolean;
}

export interface GeminiOptimizationResult {
  optimizedPrompt: string;
  techniquesApplied: string[];
  estimatedTokens: number;
  improvements: {
    efficiencyScore: number;
    clarityScore: number;
    structureScore: number;
    multimodalScore: number;
  };
  geminiEnhancements: {
    multimodalOptimized: boolean;
    efficiencyImproved: boolean;
    structuredFormat: boolean;
    codeOptimized: boolean;
  };
}

export class GeminiOptimizer {
  private readonly defaultConfig: GeminiOptimizationConfig = {
    maxTokens: 30000, // Gemini Pro has ~32k context
    model: 'gemini-pro',
    enableMultimodal: false,
    optimizeForEfficiency: true,
    enableStructuredPrompts: true,
    optimizeForCode: true,
  };

  constructor(
    private config: GeminiOptimizationConfig = {} as GeminiOptimizationConfig
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  async optimizeForGemini(
    prompt: string,
    _task: string,
    context?: {
      hasImages?: boolean;
      codeRelated?: boolean;
      expectedFormat?: string;
    }
  ): Promise<GeminiOptimizationResult> {
    logger.info('Optimizing prompt for Gemini capabilities');

    let optimizedPrompt = prompt;
    const techniquesApplied: string[] = [];
    const geminiEnhancements = {
      multimodalOptimized: false,
      efficiencyImproved: false,
      structuredFormat: false,
      codeOptimized: false,
    };

    // Apply Gemini-specific optimizations
    if (this.config.optimizeForEfficiency) {
      const efficiencyResult = this.optimizeForEfficiency(optimizedPrompt);
      optimizedPrompt = efficiencyResult.prompt;
      if (efficiencyResult.applied) {
        techniquesApplied.push('Efficiency optimization');
        geminiEnhancements.efficiencyImproved = true;
      }
    }

    if (this.config.optimizeForCode && context?.codeRelated) {
      const codeResult = this.optimizeForCode(optimizedPrompt);
      optimizedPrompt = codeResult.prompt;
      if (codeResult.applied) {
        techniquesApplied.push('Code optimization');
        geminiEnhancements.codeOptimized = true;
      }
    }

    if (this.config.enableMultimodal && context?.hasImages) {
      const multimodalResult = this.optimizeForMultimodal(optimizedPrompt);
      optimizedPrompt = multimodalResult.prompt;
      if (multimodalResult.applied) {
        techniquesApplied.push('Multimodal optimization');
        geminiEnhancements.multimodalOptimized = true;
      }
    }

    if (this.config.enableStructuredPrompts) {
      const structureResult = this.addStructuredFormat(
        optimizedPrompt,
        context?.expectedFormat
      );
      optimizedPrompt = structureResult.prompt;
      if (structureResult.applied) {
        techniquesApplied.push('Structured formatting');
        geminiEnhancements.structuredFormat = true;
      }
    }

    // Apply Gemini patterns
    optimizedPrompt = this.applyGeminiPatterns(optimizedPrompt);
    techniquesApplied.push('Gemini-specific patterns');

    const improvements = this.calculateImprovements(
      prompt,
      optimizedPrompt,
      context
    );

    return {
      optimizedPrompt,
      techniquesApplied,
      estimatedTokens: this.estimateTokens(optimizedPrompt),
      improvements,
      geminiEnhancements,
    };
  }

  private optimizeForEfficiency(prompt: string): {
    prompt: string;
    applied: boolean;
  } {
    let optimized = prompt;
    let applied = false;

    // Remove redundant words
    const redundancies = [
      [/very very/gi, 'very'],
      [/really really/gi, 'really'],
      [/quite quite/gi, 'quite'],
      [/please please/gi, 'please'],
    ];

    for (const [pattern, replacement] of redundancies) {
      const original = optimized;
      optimized = optimized.replace(pattern as RegExp, replacement as string);
      if (optimized !== original) applied = true;
    }

    // Simplify verbose expressions
    const simplifications = [
      [/in order to/gi, 'to'],
      [/for the purpose of/gi, 'to'],
      [/with regard to/gi, 'regarding'],
      [/a large number of/gi, 'many'],
    ];

    for (const [pattern, replacement] of simplifications) {
      const original = optimized;
      optimized = optimized.replace(pattern as RegExp, replacement as string);
      if (optimized !== original) applied = true;
    }

    return { prompt: optimized, applied };
  }

  private optimizeForCode(prompt: string): {
    prompt: string;
    applied: boolean;
  } {
    if (
      !prompt.toLowerCase().includes('code') &&
      !prompt.toLowerCase().includes('programming')
    ) {
      return { prompt, applied: false };
    }

    let codePrompt = prompt;
    codePrompt += '\n\nFor code examples:';
    codePrompt += '\n- Use clear, readable formatting';
    codePrompt += '\n- Include relevant comments';
    codePrompt += '\n- Follow best practices for the language';
    codePrompt += '\n- Provide complete, working examples when possible';

    return { prompt: codePrompt, applied: true };
  }

  private optimizeForMultimodal(prompt: string): {
    prompt: string;
    applied: boolean;
  } {
    let multimodalPrompt = prompt;
    multimodalPrompt += '\n\nWhen analyzing any images:';
    multimodalPrompt += '\n- Describe relevant visual elements clearly';
    multimodalPrompt += '\n- Connect visual information to the text context';
    multimodalPrompt += '\n- Be specific about what you observe';

    return { prompt: multimodalPrompt, applied: true };
  }

  private addStructuredFormat(
    prompt: string,
    expectedFormat?: string
  ): { prompt: string; applied: boolean } {
    if (prompt.includes('format:') || prompt.includes('structure:')) {
      return { prompt, applied: false };
    }

    let structured = prompt;

    if (expectedFormat) {
      structured += `\n\nPlease format your response as ${expectedFormat}.`;
    } else {
      structured += '\n\nPlease structure your response clearly with:';
      structured += '\n1. Main points organized logically';
      structured += '\n2. Clear headings or sections where appropriate';
      structured += '\n3. Concise and actionable information';
    }

    return { prompt: structured, applied: true };
  }

  private applyGeminiPatterns(prompt: string): string {
    let patterned = prompt;

    // Gemini works well with direct, clear instructions
    patterned = patterned.replace(/could you please/gi, 'please');
    patterned = patterned.replace(/would you mind/gi, 'please');
    patterned = patterned.replace(/if possible/gi, '');

    // Gemini prefers specific over vague requests
    patterned = patterned.replace(/some information/gi, 'specific information');
    patterned = patterned.replace(/a bit about/gi, 'details about');

    return patterned;
  }

  private estimateTokens(text: string): number {
    // Gemini tokenization approximation
    return Math.ceil(text.length / 4);
  }

  private calculateImprovements(
    _original: string,
    optimized: string,
    context?: Record<string, unknown>
  ) {
    const efficiencyScore = this.calculateEfficiencyScore(optimized);
    const clarityScore = this.calculateClarityScore(optimized);
    const structureScore = this.calculateStructureScore(optimized);
    const multimodalScore = context?.hasImages
      ? this.calculateMultimodalScore(optimized)
      : 0;

    return {
      efficiencyScore: Math.min(100, efficiencyScore),
      clarityScore: Math.min(100, clarityScore),
      structureScore: Math.min(100, structureScore),
      multimodalScore: Math.min(100, multimodalScore),
    };
  }

  private calculateEfficiencyScore(text: string): number {
    let score = 70;

    // Award for conciseness
    if (text.length < 500) score += 15;
    else if (text.length < 1000) score += 10;

    // Award for direct language
    if (!text.includes('perhaps') && !text.includes('maybe')) score += 10;

    return score;
  }

  private calculateClarityScore(text: string): number {
    let score = 60;

    if (text.includes('specific')) score += 10;
    if (text.includes('clear')) score += 10;
    if (text.includes(':')) score += 5;

    return score;
  }

  private calculateStructureScore(text: string): number {
    let score = 60;

    if (/\d+\./.test(text)) score += 15;
    if (text.includes('- ')) score += 10;
    if (text.includes('\n\n')) score += 10;

    return score;
  }

  private calculateMultimodalScore(text: string): number {
    let score = 50;

    if (text.includes('image')) score += 20;
    if (text.includes('visual')) score += 15;
    if (text.includes('describe')) score += 15;

    return score;
  }

  getGeminiRecommendations(): {
    bestPractices: string[];
    efficiencyTips: string[];
    multimodalTips: string[];
  } {
    return {
      bestPractices: [
        'Use direct, clear instructions for best results',
        'Structure prompts with numbered lists or bullet points',
        'Be specific about desired output format',
        'Keep prompts concise while maintaining necessary context',
        'Use Gemini Pro Vision for multimodal tasks',
      ],
      efficiencyTips: [
        'Remove redundant words and phrases',
        'Use simple, direct language over complex expressions',
        'Combine related requests into single prompts',
        'Specify output length requirements clearly',
      ],
      multimodalTips: [
        'Describe what you want analyzed in images',
        'Ask specific questions about visual elements',
        'Combine text and image context effectively',
        'Use Gemini Pro Vision for image analysis tasks',
      ],
    };
  }
}

export default GeminiOptimizer;

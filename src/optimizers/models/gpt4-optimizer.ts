/**
 * @fileoverview GPT-4 specific prompt optimization strategies and patterns
 * @lastmodified 2025-08-26T14:00:00Z
 *
 * Features: GPT-4 optimized prompt patterns, token management, context utilization
 * Main APIs: GPT4Optimizer class with model-specific optimization strategies
 * Constraints: Optimized for GPT-4 context window and reasoning capabilities
 * Patterns: Strategy pattern, model-specific optimization, performance tuning
 */

import { logger } from '../../utils/logger';

export interface GPT4OptimizationConfig {
  /** Maximum tokens to use (GPT-4 has 128k context) */
  maxTokens: number;

  /** Temperature for optimization requests */
  temperature: number;

  /** Enable chain-of-thought optimization */
  enableChainOfThought: boolean;

  /** Use GPT-4's advanced reasoning capabilities */
  enableAdvancedReasoning: boolean;

  /** Optimize for structured outputs */
  optimizeForStructuredOutput: boolean;

  /** Enable system message optimization */
  optimizeSystemMessages: boolean;
}

export interface GPT4OptimizationResult {
  /** Optimized prompt */
  optimizedPrompt: string;

  /** Optimization techniques applied */
  techniquesApplied: string[];

  /** Estimated token usage */
  estimatedTokens: number;

  /** Performance improvements */
  improvements: {
    clarityScore: number;
    reasoningScore: number;
    structureScore: number;
    efficiencyScore: number;
  };

  /** GPT-4 specific enhancements */
  gpt4Enhancements: {
    chainOfThoughtAdded: boolean;
    systemMessageOptimized: boolean;
    structuredOutputEnabled: boolean;
    reasoningStepsAdded: number;
  };
}

export class GPT4Optimizer {
  private readonly defaultConfig: GPT4OptimizationConfig = {
    maxTokens: 120000, // Leave some room for response
    temperature: 0.1, // Low temperature for optimization tasks
    enableChainOfThought: true,
    enableAdvancedReasoning: true,
    optimizeForStructuredOutput: true,
    optimizeSystemMessages: true,
  };

  constructor(
    private config: GPT4OptimizationConfig = {} as GPT4OptimizationConfig
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Optimize prompt specifically for GPT-4's capabilities
   */
  async optimizeForGPT4(
    prompt: string,
    task: string,
    context?: {
      expectedFormat?: 'json' | 'markdown' | 'code' | 'text';
      complexity?: 'simple' | 'medium' | 'complex';
      domain?: string;
    }
  ): Promise<GPT4OptimizationResult> {
    logger.info('Optimizing prompt for GPT-4 specific capabilities');

    let optimizedPrompt = prompt;
    const techniquesApplied: string[] = [];
    const gpt4Enhancements = {
      chainOfThoughtAdded: false,
      systemMessageOptimized: false,
      structuredOutputEnabled: false,
      reasoningStepsAdded: 0,
    };

    // Apply GPT-4 specific optimizations
    if (this.config.enableChainOfThought) {
      const cotResult = this.addChainOfThought(optimizedPrompt, context);
      optimizedPrompt = cotResult.prompt;
      if (cotResult.applied) {
        techniquesApplied.push('Chain-of-thought reasoning');
        gpt4Enhancements.chainOfThoughtAdded = true;
        gpt4Enhancements.reasoningStepsAdded = cotResult.stepsAdded;
      }
    }

    if (this.config.optimizeSystemMessages) {
      const systemResult = this.optimizeSystemMessage(optimizedPrompt, task);
      optimizedPrompt = systemResult.prompt;
      if (systemResult.applied) {
        techniquesApplied.push('System message optimization');
        gpt4Enhancements.systemMessageOptimized = true;
      }
    }

    if (this.config.optimizeForStructuredOutput && context?.expectedFormat) {
      const structureResult = this.addStructuredOutput(
        optimizedPrompt,
        context.expectedFormat
      );
      optimizedPrompt = structureResult.prompt;
      if (structureResult.applied) {
        techniquesApplied.push('Structured output formatting');
        gpt4Enhancements.structuredOutputEnabled = true;
      }
    }

    if (this.config.enableAdvancedReasoning) {
      const reasoningResult = this.enhanceReasoning(optimizedPrompt, context);
      optimizedPrompt = reasoningResult.prompt;
      if (reasoningResult.applied) {
        techniquesApplied.push('Advanced reasoning patterns');
      }
    }

    // Apply GPT-4 specific prompt patterns
    optimizedPrompt = this.applyGPT4Patterns(optimizedPrompt, context);
    techniquesApplied.push('GPT-4 specific patterns');

    // Ensure token limits
    const tokenOptimizedResult = this.optimizeTokenUsage(optimizedPrompt);
    optimizedPrompt = tokenOptimizedResult.prompt;
    if (tokenOptimizedResult.tokensReduced > 0) {
      techniquesApplied.push(
        `Token optimization (-${tokenOptimizedResult.tokensReduced} tokens)`
      );
    }

    // Calculate improvements
    const improvements = this.calculateImprovements(prompt, optimizedPrompt);

    const result: GPT4OptimizationResult = {
      optimizedPrompt,
      techniquesApplied,
      estimatedTokens: this.estimateTokens(optimizedPrompt),
      improvements,
      gpt4Enhancements,
    };

    logger.info(
      `GPT-4 optimization completed: ${techniquesApplied.length} techniques applied`
    );
    return result;
  }

  /**
   * Add chain-of-thought reasoning patterns optimized for GPT-4
   */
  private addChainOfThought(
    prompt: string,
    context?: { complexity?: string; domain?: string }
  ): { prompt: string; applied: boolean; stepsAdded: number } {
    // Check if chain-of-thought is already present
    if (this.hasChainOfThought(prompt)) {
      return { prompt, applied: false, stepsAdded: 0 };
    }

    let cotPrompt = prompt;
    let stepsAdded = 0;

    // Add appropriate CoT based on complexity
    if (context?.complexity === 'complex') {
      cotPrompt += "\n\nLet's approach this step-by-step:\n";
      cotPrompt += '1. First, analyze the key requirements\n';
      cotPrompt += '2. Break down the problem into components\n';
      cotPrompt += '3. Consider potential challenges and solutions\n';
      cotPrompt += '4. Synthesize a comprehensive response\n';
      cotPrompt +=
        '\nPlease work through each step explicitly before providing your final answer.';
      stepsAdded = 4;
    } else if (context?.complexity === 'medium') {
      cotPrompt += "\n\nLet's think through this systematically:\n";
      cotPrompt += '1. Identify the main objective\n';
      cotPrompt += '2. Consider the key factors involved\n';
      cotPrompt += '3. Formulate the best approach\n';
      stepsAdded = 3;
    } else {
      // Simple complexity or default
      cotPrompt += '\n\nPlease think step-by-step before responding:';
      stepsAdded = 1;
    }

    return { prompt: cotPrompt, applied: true, stepsAdded };
  }

  /**
   * Optimize system message for GPT-4
   */
  private optimizeSystemMessage(
    prompt: string,
    task: string
  ): { prompt: string; applied: boolean } {
    // Check if system message pattern exists
    if (prompt.includes('You are') || prompt.includes('System:')) {
      return { prompt, applied: false };
    }

    // Add optimized system message for GPT-4
    let systemMessage =
      'You are an expert assistant designed to provide accurate, helpful, and comprehensive responses. ';

    // Customize based on task
    if (
      task.toLowerCase().includes('code') ||
      task.toLowerCase().includes('programming')
    ) {
      systemMessage +=
        'You excel at code analysis, debugging, and software development guidance. ';
    } else if (
      task.toLowerCase().includes('analysis') ||
      task.toLowerCase().includes('research')
    ) {
      systemMessage +=
        'You excel at analytical thinking, research, and providing well-reasoned insights. ';
    } else if (
      task.toLowerCase().includes('creative') ||
      task.toLowerCase().includes('writing')
    ) {
      systemMessage +=
        'You excel at creative thinking and effective communication. ';
    }

    systemMessage +=
      'Always strive for clarity, accuracy, and usefulness in your responses.';

    const optimizedPrompt = `${systemMessage}\n\n${prompt}`;
    return { prompt: optimizedPrompt, applied: true };
  }

  /**
   * Add structured output formatting for GPT-4
   */
  private addStructuredOutput(
    prompt: string,
    format: 'json' | 'markdown' | 'code' | 'text'
  ): { prompt: string; applied: boolean } {
    // Check if structured output already specified
    if (
      prompt.toLowerCase().includes('format') &&
      prompt.toLowerCase().includes(format)
    ) {
      return { prompt, applied: false };
    }

    let structurePrompt = prompt;

    switch (format) {
      case 'json':
        structurePrompt +=
          '\n\nPlease provide your response in valid JSON format with appropriate structure and field names.';
        break;
      case 'markdown':
        structurePrompt +=
          '\n\nPlease format your response using Markdown with appropriate headers, lists, and formatting for clarity.';
        break;
      case 'code':
        structurePrompt +=
          '\n\nPlease provide code examples with appropriate syntax highlighting and clear explanations.';
        break;
      default:
        structurePrompt +=
          '\n\nPlease structure your response clearly with logical organization and appropriate formatting.';
    }

    return { prompt: structurePrompt, applied: true };
  }

  /**
   * Enhance reasoning patterns for GPT-4's advanced capabilities
   */
  private enhanceReasoning(
    prompt: string,
    context?: { domain?: string; complexity?: string }
  ): { prompt: string; applied: boolean } {
    let enhancedPrompt = prompt;

    // Add domain-specific reasoning patterns
    if (context?.domain) {
      enhancedPrompt += `\n\nWhen addressing this ${context.domain} question, please:`;
      enhancedPrompt += '\n- Draw upon relevant domain expertise';
      enhancedPrompt += '\n- Consider multiple perspectives and approaches';
      enhancedPrompt += '\n- Provide evidence-based reasoning';
      enhancedPrompt += '\n- Acknowledge any limitations or assumptions';
    }

    // Add metacognitive prompting for complex tasks
    if (context?.complexity === 'complex') {
      enhancedPrompt += '\n\nBefore responding, please:';
      enhancedPrompt += '\n1. Assess the complexity and scope of the question';
      enhancedPrompt += '\n2. Identify potential edge cases or complications';
      enhancedPrompt += '\n3. Consider alternative solutions or viewpoints';
      enhancedPrompt += '\n4. Verify your reasoning for logical consistency';
    }

    return { prompt: enhancedPrompt, applied: enhancedPrompt !== prompt };
  }

  /**
   * Apply GPT-4 specific prompt patterns and best practices
   */
  private applyGPT4Patterns(
    prompt: string,
    _context?: { expectedFormat?: string; domain?: string }
  ): string {
    let patterned = prompt;

    // Add GPT-4 specific instruction clarity
    if (!patterned.includes('Please') && !patterned.includes('I need')) {
      patterned = `Please ${patterned.charAt(0).toLowerCase()}${patterned.slice(1)}`;
    }

    // Optimize for GPT-4's instruction following
    patterned = patterned.replace(
      /\b(do|make|create|write|generate)\b/gi,
      match => `please ${match.toLowerCase()}`
    );

    // Add context preservation for long conversations
    if (patterned.length > 1000) {
      patterned +=
        '\n\n(Please maintain context from this entire prompt when responding.)';
    }

    return patterned;
  }

  /**
   * Optimize token usage for GPT-4's context window
   */
  private optimizeTokenUsage(prompt: string): {
    prompt: string;
    tokensReduced: number;
  } {
    const originalTokens = this.estimateTokens(prompt);

    if (originalTokens <= this.config.maxTokens) {
      return { prompt, tokensReduced: 0 };
    }

    let optimized = prompt;

    // Remove redundant whitespace
    optimized = optimized.replace(/\s+/g, ' ').trim();

    // Compress repeated patterns
    optimized = optimized.replace(/(\n\s*){3,}/g, '\n\n');

    // Simplify verbose expressions while maintaining meaning
    const replacements = [
      [/in order to/gi, 'to'],
      [/due to the fact that/gi, 'because'],
      [/it is important to note that/gi, 'note that'],
      [/please be aware that/gi, 'note that'],
      [/it should be mentioned that/gi, ''],
      [/as previously mentioned/gi, ''],
    ];

    for (const [pattern, replacement] of replacements) {
      optimized = optimized.replace(pattern as RegExp, replacement as string);
    }

    const newTokens = this.estimateTokens(optimized);
    const tokensReduced = originalTokens - newTokens;

    return { prompt: optimized, tokensReduced };
  }

  /**
   * Check if chain-of-thought is already present
   */
  private hasChainOfThought(prompt: string): boolean {
    const cotPatterns = [
      /step.by.step/i,
      /think through/i,
      /let's approach/i,
      /first.*second.*third/i,
      /\d+\.\s/g, // Numbered lists
    ];

    return cotPatterns.some(pattern => pattern.test(prompt));
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // GPT-4 tokenization is roughly 4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate improvement scores
   */
  private calculateImprovements(original: string, optimized: string) {
    // This is a simplified scoring system - in production, you'd want more sophisticated metrics
    const originalLength = original.length;
    const optimizedLength = optimized.length;

    // Structure score based on formatting and organization
    const structureScore = this.calculateStructureScore(optimized);

    // Clarity score based on specific phrases and patterns
    const clarityScore = this.calculateClarityScore(optimized);

    // Reasoning score based on CoT and reasoning patterns
    const reasoningScore = this.calculateReasoningScore(optimized);

    // Efficiency score based on token usage
    const efficiencyScore = Math.max(
      0,
      100 - ((optimizedLength - originalLength) / originalLength) * 100
    );

    return {
      clarityScore: Math.min(100, clarityScore),
      reasoningScore: Math.min(100, reasoningScore),
      structureScore: Math.min(100, structureScore),
      efficiencyScore: Math.min(100, Math.max(0, efficiencyScore)),
    };
  }

  private calculateStructureScore(text: string): number {
    let score = 60; // Base score

    // Award points for good structure
    if (text.includes('\n\n')) score += 10; // Paragraphs
    if (/\d+\./.test(text)) score += 10; // Numbered lists
    if (/[-*]/.test(text)) score += 5; // Bullet points
    if (text.includes(':')) score += 5; // Colons for structure

    return score;
  }

  private calculateClarityScore(text: string): number {
    let score = 60; // Base score

    // Award points for clarity indicators
    if (text.toLowerCase().includes('please')) score += 5;
    if (text.toLowerCase().includes('specific')) score += 5;
    if (text.toLowerCase().includes('clear')) score += 5;
    if (text.toLowerCase().includes('detailed')) score += 5;

    // Deduct for unclear patterns
    if (text.includes('...')) score -= 5;
    if (text.length > 2000) score -= 10; // Too verbose

    return score;
  }

  private calculateReasoningScore(text: string): number {
    let score = 50; // Base score

    // Award points for reasoning patterns
    if (text.toLowerCase().includes('step')) score += 15;
    if (text.toLowerCase().includes('because')) score += 10;
    if (text.toLowerCase().includes('therefore')) score += 10;
    if (text.toLowerCase().includes('consider')) score += 10;
    if (text.toLowerCase().includes('analyze')) score += 10;

    return score;
  }

  /**
   * Get GPT-4 specific recommendations
   */
  getGPT4Recommendations(): {
    bestPractices: string[];
    avoidances: string[];
    tips: string[];
  } {
    return {
      bestPractices: [
        'Use clear, specific instructions for better results',
        'Leverage chain-of-thought reasoning for complex tasks',
        'Structure prompts with numbered steps when appropriate',
        'Include context and constraints explicitly',
        'Use system messages to set the right tone and expertise level',
        'Specify desired output format clearly',
      ],
      avoidances: [
        'Avoid overly verbose or redundant instructions',
        "Don't use ambiguous language or unclear references",
        'Avoid assuming GPT-4 knows your specific context without explaining',
        "Don't overload with too many simultaneous requests",
      ],
      tips: [
        'GPT-4 excels at following structured, step-by-step instructions',
        'Use temperature 0.1-0.3 for focused, deterministic outputs',
        'Break complex tasks into smaller, manageable components',
        'Provide examples when the desired format is specific',
        'Use metacognitive prompting for complex reasoning tasks',
      ],
    };
  }
}

export default GPT4Optimizer;

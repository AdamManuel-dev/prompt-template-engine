/**
 * @fileoverview Claude-specific prompt optimization strategies and patterns
 * @lastmodified 2025-08-26T14:10:00Z
 *
 * Features: Claude-optimized prompt patterns, constitutional AI principles, reasoning
 * Main APIs: ClaudeOptimizer class with Anthropic-specific optimization strategies
 * Constraints: Optimized for Claude's constitutional AI and helpfulness principles
 * Patterns: Strategy pattern, constitutional AI alignment, ethical reasoning
 */

import { logger } from '../../utils/logger';

export interface ClaudeOptimizationConfig {
  /** Maximum tokens for Claude (varies by model: Claude-3 has 200k context) */
  maxTokens: number;

  /** Claude model variant */
  model: 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku' | 'claude-2';

  /** Enable constitutional AI principles */
  enableConstitutionalAI: boolean;

  /** Optimize for helpfulness, harmlessness, honesty */
  optimizeForHHH: boolean;

  /** Enable XML-style structured reasoning */
  enableStructuredReasoning: boolean;

  /** Optimize for long-form reasoning */
  optimizeForLongForm: boolean;

  /** Enable Claude's thinking process */
  enableThinkingProcess: boolean;
}

export interface ClaudeOptimizationResult {
  /** Optimized prompt */
  optimizedPrompt: string;

  /** Optimization techniques applied */
  techniquesApplied: string[];

  /** Estimated token usage */
  estimatedTokens: number;

  /** Performance improvements */
  improvements: {
    helpfulnessScore: number;
    clarityScore: number;
    structureScore: number;
    reasoningScore: number;
  };

  /** Claude-specific enhancements */
  claudeEnhancements: {
    constitutionalPrinciplesAdded: boolean;
    xmlStructuringUsed: boolean;
    thinkingProcessAdded: boolean;
    hhhOptimized: boolean;
  };
}

export class ClaudeOptimizer {
  private readonly defaultConfig: ClaudeOptimizationConfig = {
    maxTokens: 180000, // Leave room for response
    model: 'claude-3-sonnet',
    enableConstitutionalAI: true,
    optimizeForHHH: true,
    enableStructuredReasoning: true,
    optimizeForLongForm: true,
    enableThinkingProcess: true,
  };

  constructor(
    private config: ClaudeOptimizationConfig = {} as ClaudeOptimizationConfig
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Optimize prompt specifically for Claude's capabilities and principles
   */
  async optimizeForClaude(
    prompt: string,
    task: string,
    context?: {
      expectedFormat?: 'xml' | 'markdown' | 'json' | 'text';
      reasoning?: 'simple' | 'complex' | 'analytical';
      domain?: string;
      ethicalConsiderations?: boolean;
    }
  ): Promise<ClaudeOptimizationResult> {
    logger.info("Optimizing prompt for Claude's constitutional AI principles");

    let optimizedPrompt = prompt;
    const techniquesApplied: string[] = [];
    const claudeEnhancements = {
      constitutionalPrinciplesAdded: false,
      xmlStructuringUsed: false,
      thinkingProcessAdded: false,
      hhhOptimized: false,
    };

    // Apply Claude-specific optimizations
    if (this.config.enableConstitutionalAI) {
      const constitutionalResult = this.addConstitutionalPrinciples(
        optimizedPrompt,
        context
      );
      optimizedPrompt = constitutionalResult.prompt;
      if (constitutionalResult.applied) {
        techniquesApplied.push('Constitutional AI principles');
        claudeEnhancements.constitutionalPrinciplesAdded = true;
      }
    }

    if (this.config.optimizeForHHH) {
      const hhhResult = this.optimizeForHHH(optimizedPrompt, task);
      optimizedPrompt = hhhResult.prompt;
      if (hhhResult.applied) {
        techniquesApplied.push(
          'Helpfulness, Harmlessness, Honesty optimization'
        );
        claudeEnhancements.hhhOptimized = true;
      }
    }

    if (this.config.enableStructuredReasoning) {
      const structureResult = this.addXMLStructuring(optimizedPrompt, context);
      optimizedPrompt = structureResult.prompt;
      if (structureResult.applied) {
        techniquesApplied.push('XML-structured reasoning');
        claudeEnhancements.xmlStructuringUsed = true;
      }
    }

    if (this.config.enableThinkingProcess) {
      const thinkingResult = this.addThinkingProcess(optimizedPrompt, context);
      optimizedPrompt = thinkingResult.prompt;
      if (thinkingResult.applied) {
        techniquesApplied.push('Structured thinking process');
        claudeEnhancements.thinkingProcessAdded = true;
      }
    }

    // Apply Claude-specific prompt patterns
    optimizedPrompt = this.applyClaudePatterns(optimizedPrompt, context);
    techniquesApplied.push('Claude-specific patterns');

    // Optimize for Claude's preferred communication style
    optimizedPrompt = this.optimizeCommunicationStyle(optimizedPrompt);
    techniquesApplied.push('Communication style optimization');

    // Ensure token limits for specific Claude model
    const tokenOptimizedResult = this.optimizeTokenUsage(optimizedPrompt);
    optimizedPrompt = tokenOptimizedResult.prompt;
    if (tokenOptimizedResult.tokensReduced > 0) {
      techniquesApplied.push(
        `Token optimization (-${tokenOptimizedResult.tokensReduced} tokens)`
      );
    }

    // Calculate improvements
    const improvements = this.calculateImprovements(
      prompt,
      optimizedPrompt,
      context
    );

    const result: ClaudeOptimizationResult = {
      optimizedPrompt,
      techniquesApplied,
      estimatedTokens: this.estimateTokens(optimizedPrompt),
      improvements,
      claudeEnhancements,
    };

    logger.info(
      `Claude optimization completed: ${techniquesApplied.length} techniques applied`
    );
    return result;
  }

  /**
   * Add constitutional AI principles to prompt
   */
  private addConstitutionalPrinciples(
    prompt: string,
    context?: { ethicalConsiderations?: boolean; domain?: string }
  ): { prompt: string; applied: boolean } {
    // Check if constitutional principles already mentioned
    if (
      prompt.toLowerCase().includes('helpful') ||
      prompt.toLowerCase().includes('harmless')
    ) {
      return { prompt, applied: false };
    }

    let constitutionalPrompt = prompt;

    // Add appropriate constitutional framing
    if (context?.ethicalConsiderations) {
      constitutionalPrompt = `Please respond in a way that is helpful, harmless, and honest. Consider ethical implications and potential impacts of your response.\n\n${constitutionalPrompt}`;
    } else {
      // Add lighter constitutional framing
      constitutionalPrompt = `Please provide a helpful and accurate response.\n\n${constitutionalPrompt}`;
    }

    // Add domain-specific constitutional considerations
    if (context?.domain === 'medical') {
      constitutionalPrompt +=
        '\n\nNote: This should not be considered medical advice. Please consult healthcare professionals for medical decisions.';
    } else if (context?.domain === 'legal') {
      constitutionalPrompt +=
        '\n\nNote: This should not be considered legal advice. Please consult qualified legal professionals for legal matters.';
    } else if (context?.domain === 'financial') {
      constitutionalPrompt +=
        '\n\nNote: This should not be considered financial advice. Please consult financial advisors for investment decisions.';
    }

    return { prompt: constitutionalPrompt, applied: true };
  }

  /**
   * Optimize for Helpfulness, Harmlessness, and Honesty
   */
  private optimizeForHHH(
    prompt: string,
    task: string
  ): { prompt: string; applied: boolean } {
    let hhhPrompt = prompt;
    let applied = false;

    // Enhance helpfulness
    if (
      !prompt.toLowerCase().includes('specific') &&
      !prompt.toLowerCase().includes('detailed')
    ) {
      hhhPrompt +=
        '\n\nPlease be specific and thorough in your response to be as helpful as possible.';
      applied = true;
    }

    // Enhance honesty/accuracy
    if (
      task.toLowerCase().includes('fact') ||
      task.toLowerCase().includes('information')
    ) {
      hhhPrompt +=
        "\n\nIf you're uncertain about any facts, please indicate this clearly and suggest where to verify the information.";
      applied = true;
    }

    // Enhance harmlessness for sensitive topics
    const sensitiveTriggers = [
      'harm',
      'danger',
      'risk',
      'illegal',
      'unethical',
    ];
    if (
      sensitiveTriggers.some(trigger => prompt.toLowerCase().includes(trigger))
    ) {
      hhhPrompt +=
        '\n\nPlease ensure your response promotes safety and well-being, and avoid any potentially harmful advice.';
      applied = true;
    }

    return { prompt: hhhPrompt, applied };
  }

  /**
   * Add XML structuring for Claude's reasoning
   */
  private addXMLStructuring(
    prompt: string,
    context?: { expectedFormat?: string; reasoning?: string }
  ): { prompt: string; applied: boolean } {
    // Check if XML structure already present
    if (prompt.includes('<') || prompt.includes('/>')) {
      return { prompt, applied: false };
    }

    let xmlPrompt = prompt;

    // Add XML structuring based on reasoning complexity
    if (
      context?.reasoning === 'complex' ||
      context?.reasoning === 'analytical'
    ) {
      xmlPrompt +=
        '\n\nPlease structure your response using the following format:';
      xmlPrompt += '\n<analysis>';
      xmlPrompt += '\n<problem>Identify the key problem or question</problem>';
      xmlPrompt += '\n<approach>Describe your analytical approach</approach>';
      xmlPrompt +=
        '\n<reasoning>Work through the reasoning step by step</reasoning>';
      xmlPrompt += '\n<conclusion>Provide your final conclusion</conclusion>';
      xmlPrompt += '\n</analysis>';
    } else if (context?.reasoning === 'simple') {
      xmlPrompt += '\n\nPlease structure your response as:';
      xmlPrompt += '\n<response>';
      xmlPrompt += '\n<answer>Your main answer</answer>';
      xmlPrompt += '\n<explanation>Brief explanation</explanation>';
      xmlPrompt += '\n</response>';
    }

    // Add format-specific XML
    if (context?.expectedFormat === 'xml') {
      xmlPrompt +=
        '\n\nPlease use appropriate XML tags to structure your content clearly.';
    }

    return { prompt: xmlPrompt, applied: xmlPrompt !== prompt };
  }

  /**
   * Add structured thinking process for Claude
   */
  private addThinkingProcess(
    prompt: string,
    context?: { reasoning?: string; domain?: string }
  ): { prompt: string; applied: boolean } {
    // Check if thinking process already present
    if (
      prompt.includes('think') &&
      (prompt.includes('step') || prompt.includes('process'))
    ) {
      return { prompt, applied: false };
    }

    let thinkingPrompt = prompt;

    // Add thinking structure based on context
    if (context?.reasoning === 'complex') {
      thinkingPrompt += '\n\nPlease work through this systematically:';
      thinkingPrompt += '\n1. Break down the problem into components';
      thinkingPrompt += '\n2. Analyze each component carefully';
      thinkingPrompt += '\n3. Consider relationships and dependencies';
      thinkingPrompt += '\n4. Synthesize insights into a cohesive response';
      thinkingPrompt += '\n\nShow your thinking process clearly.';
    } else if (context?.reasoning === 'analytical') {
      thinkingPrompt += '\n\nPlease approach this analytically:';
      thinkingPrompt += '\n- Examine the evidence or information provided';
      thinkingPrompt += '\n- Consider multiple perspectives';
      thinkingPrompt += '\n- Identify key insights and implications';
      thinkingPrompt += '\n- Draw well-reasoned conclusions';
    } else {
      thinkingPrompt +=
        '\n\nPlease think through this carefully and explain your reasoning.';
    }

    return { prompt: thinkingPrompt, applied: true };
  }

  /**
   * Apply Claude-specific prompt patterns and preferences
   */
  private applyClaudePatterns(
    prompt: string,
    context?: { domain?: string; expectedFormat?: string }
  ): string {
    let patterned = prompt;

    // Claude responds well to polite, conversational language
    if (!patterned.toLowerCase().includes('please')) {
      patterned = patterned.replace(/^([A-Z])/, 'Please $1');
    }

    // Claude likes explicit structure and organization
    if (context?.domain && !patterned.includes(context.domain)) {
      patterned = `Regarding ${context.domain}: ${patterned}`;
    }

    // Claude excels with clear expectations
    if (!patterned.includes('I need') && !patterned.includes('help me')) {
      patterned = patterned.replace(
        /\?$/,
        '? Please help me understand this clearly.'
      );
    }

    // Add conversational elements that Claude responds well to
    patterned = patterned.replace(/\bgenerate\b/gi, 'help me create');
    patterned = patterned.replace(/\bmake\b/gi, 'help me make');

    return patterned;
  }

  /**
   * Optimize communication style for Claude
   */
  private optimizeCommunicationStyle(prompt: string): string {
    let styled = prompt;

    // Claude prefers natural, conversational language
    styled = styled.replace(/\byou must\b/gi, 'please');
    styled = styled.replace(/\brequired\b/gi, 'needed');
    styled = styled.replace(/\bdemand\b/gi, 'request');

    // Add collaborative framing
    if (!styled.includes('we') && !styled.includes('together')) {
      styled = styled.replace(/\bI want\b/gi, "I'd like us to work on");
    }

    // Ensure respectful tone
    styled = styled.replace(/\bdo this\b/gi, 'help with this');
    styled = styled.replace(/\bgive me\b/gi, 'please provide');

    return styled;
  }

  /**
   * Optimize token usage for Claude models
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

    // Claude-specific token optimizations
    // Remove redundant politeness (Claude is naturally polite)
    optimized = optimized.replace(/\bplease please\b/gi, 'please');
    optimized = optimized.replace(/\bthank you very much\b/gi, 'thank you');

    // Compress while maintaining conversational tone
    optimized = optimized.replace(/\s+/g, ' ').trim();
    optimized = optimized.replace(/(\n\s*){3,}/g, '\n\n');

    // Simplify verbose expressions while keeping Claude's preferred style
    const replacements = [
      [/I would like you to please/gi, 'please'],
      [/if you could please/gi, 'please'],
      [/would you be able to/gi, 'can you'],
      [/it would be great if you could/gi, 'please'],
    ];

    for (const [pattern, replacement] of replacements) {
      optimized = optimized.replace(pattern as RegExp, replacement as string);
    }

    const newTokens = this.estimateTokens(optimized);
    const tokensReduced = originalTokens - newTokens;

    return { prompt: optimized, tokensReduced };
  }

  /**
   * Estimate token count for Claude (similar to GPT but slightly different)
   */
  private estimateTokens(text: string): number {
    // Claude tokenization is roughly 3.8 characters per token for English
    return Math.ceil(text.length / 3.8);
  }

  /**
   * Calculate improvement scores specific to Claude's strengths
   */
  private calculateImprovements(
    _original: string,
    optimized: string,
    context?: { reasoning?: string }
  ) {
    // Helpfulness score based on Claude's helpfulness patterns
    const helpfulnessScore = this.calculateHelpfulnessScore(optimized);

    // Clarity score with Claude's preference for clear communication
    const clarityScore = this.calculateClarityScore(optimized);

    // Structure score considering XML and organized thinking
    const structureScore = this.calculateStructureScore(optimized);

    // Reasoning score for analytical thinking
    const reasoningScore = this.calculateReasoningScore(optimized, context);

    return {
      helpfulnessScore: Math.min(100, helpfulnessScore),
      clarityScore: Math.min(100, clarityScore),
      structureScore: Math.min(100, structureScore),
      reasoningScore: Math.min(100, reasoningScore),
    };
  }

  private calculateHelpfulnessScore(text: string): number {
    let score = 60; // Base score

    // Award points for helpfulness indicators
    if (text.toLowerCase().includes('please')) score += 10;
    if (text.toLowerCase().includes('help')) score += 10;
    if (text.toLowerCase().includes('specific')) score += 5;
    if (text.toLowerCase().includes('detailed')) score += 5;
    if (text.toLowerCase().includes('thorough')) score += 5;
    if (text.toLowerCase().includes('clear')) score += 5;

    return score;
  }

  private calculateClarityScore(text: string): number {
    let score = 60; // Base score

    // Award points for clarity
    if (text.includes('\n\n')) score += 10; // Clear paragraphs
    if (text.includes(':')) score += 5; // Structure
    if (text.includes('example')) score += 5;
    if (text.includes('specifically')) score += 5;

    // Deduct for unclear patterns
    if (text.includes('...')) score -= 5;
    if (text.length > 3000 && !text.includes('<')) score -= 10; // Too verbose without structure

    return score;
  }

  private calculateStructureScore(text: string): number {
    let score = 60; // Base score

    // Award points for structure
    if (text.includes('<') && text.includes('>')) score += 20; // XML structure
    if (/\d+\./.test(text)) score += 10; // Numbered lists
    if (text.includes('- ')) score += 5; // Bullet points
    if (text.includes('\n\n')) score += 10; // Proper spacing

    return score;
  }

  private calculateReasoningScore(
    text: string,
    context?: { reasoning?: string }
  ): number {
    let score = 50; // Base score

    // Award points for reasoning patterns
    if (text.toLowerCase().includes('because')) score += 10;
    if (text.toLowerCase().includes('therefore')) score += 10;
    if (text.toLowerCase().includes('analysis')) score += 10;
    if (text.toLowerCase().includes('consider')) score += 10;
    if (text.toLowerCase().includes('reasoning')) score += 15;

    // Bonus for complex reasoning structure
    if (context?.reasoning === 'complex' && text.includes('<')) score += 15;

    return score;
  }

  /**
   * Get Claude-specific recommendations
   */
  getClaudeRecommendations(): {
    bestPractices: string[];
    constitutionalPrinciples: string[];
    communicationTips: string[];
  } {
    return {
      bestPractices: [
        'Use conversational, polite language - Claude responds well to natural communication',
        'Structure complex requests with XML tags for clarity',
        'Ask Claude to show its thinking process for complex reasoning',
        'Be specific about the type of analysis or reasoning you want',
        'Include context about ethics or safety when relevant',
        'Use collaborative language ("help me" vs "do this")',
      ],
      constitutionalPrinciples: [
        'Helpfulness: Claude aims to be maximally helpful while being safe',
        'Harmlessness: Claude avoids harmful, dangerous, or illegal content',
        'Honesty: Claude strives for accuracy and admits uncertainty',
        'Constitutional AI: Claude follows built-in safety guidelines',
      ],
      communicationTips: [
        'Claude excels at long-form reasoning and analysis',
        'Use XML structuring for complex multi-part requests',
        'Ask for step-by-step thinking when you need detailed reasoning',
        'Claude can handle very long contexts (200k tokens for Claude-3)',
        'Conversational tone works better than overly formal instructions',
        'Claude is particularly good at ethical reasoning and nuanced analysis',
      ],
    };
  }

  /**
   * Get model-specific configuration recommendations
   */
  getModelSpecificRecommendations(): Record<
    string,
    {
      contextWindow: number;
      strengths: string[];
      bestUseCase: string;
    }
  > {
    return {
      'claude-3-opus': {
        contextWindow: 200000,
        strengths: [
          'Complex reasoning',
          'Long-form analysis',
          'Creative tasks',
        ],
        bestUseCase:
          'High-complexity analytical tasks requiring deep reasoning',
      },
      'claude-3-sonnet': {
        contextWindow: 200000,
        strengths: ['Balanced performance', 'Good reasoning', 'Efficiency'],
        bestUseCase:
          'General-purpose tasks with good balance of speed and capability',
      },
      'claude-3-haiku': {
        contextWindow: 200000,
        strengths: ['Speed', 'Efficiency', 'Simple tasks'],
        bestUseCase: 'Fast responses for straightforward tasks',
      },
      'claude-2': {
        contextWindow: 100000,
        strengths: ['Solid reasoning', 'Good safety', 'Reliability'],
        bestUseCase: 'Reliable performance for standard prompting tasks',
      },
    };
  }
}

export default ClaudeOptimizer;

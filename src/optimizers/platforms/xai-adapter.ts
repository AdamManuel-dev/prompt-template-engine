/**
 * @fileoverview xAI (Grok) platform adapter for prompt optimization
 * @lastmodified 2025-08-26T14:50:00Z
 *
 * Features: xAI API format adaptation, reasoning optimization, real-time capabilities
 * Main APIs: xAIAdapter class for converting optimized prompts to xAI format
 * Constraints: xAI API specifications and token limits
 * Patterns: Adapter pattern, reasoning-focused optimization, real-time integration
 */

import { logger } from '../../utils/logger';

export interface xAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface xAIRequest {
  model: string;
  messages: xAIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string[];
  frequency_penalty?: number;
  presence_penalty?: number;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: object;
    };
  }>;
}

export interface xAIAdapterConfig {
  model: 'grok-beta' | 'grok-vision-beta';
  maxTokens: number;
  temperature: number;
  enableRealtimeData: boolean;
  enableReasoningOptimization: boolean;
  enableToolCalling: boolean;
  optimizeForHumor: boolean;
}

export interface xAIAdaptationResult {
  request: xAIRequest;
  tokenEstimate: number;
  adaptationNotes: string[];
  warnings: string[];
  xaiFeatures?: {
    realtimeEnabled: boolean;
    reasoningOptimized: boolean;
    toolsConfigured: boolean;
    humorEnhanced: boolean;
  };
}

export class xAIAdapter {
  private readonly defaultConfig: xAIAdapterConfig = {
    model: 'grok-beta',
    maxTokens: 4096,
    temperature: 0.7,
    enableRealtimeData: true,
    enableReasoningOptimization: true,
    enableToolCalling: false,
    optimizeForHumor: false,
  };

  private readonly modelLimits = {
    'grok-beta': 128000,
    'grok-vision-beta': 128000,
  };

  constructor(private config: xAIAdapterConfig = {} as xAIAdapterConfig) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Convert optimized prompt to xAI API format
   */
  adaptToXAI(
    optimizedPrompt: string,
    context?: {
      systemMessage?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
      enableRealtime?: boolean;
      tools?: Array<{ name: string; description: string; parameters: object }>;
      personality?: 'standard' | 'witty' | 'serious' | 'technical';
    }
  ): xAIAdaptationResult {
    logger.info(`Adapting prompt for xAI ${this.config.model}`);

    const messages: xAIMessage[] = [];
    const adaptationNotes: string[] = [];
    const warnings: string[] = [];
    const xaiFeatures = {
      realtimeEnabled: false,
      reasoningOptimized: false,
      toolsConfigured: false,
      humorEnhanced: false,
    };

    // Add system message with xAI-specific enhancements
    const systemMessage = this.createSystemMessage(optimizedPrompt, context);
    if (systemMessage) {
      messages.push({
        role: 'system',
        content: systemMessage,
      });
      adaptationNotes.push('System message optimized for xAI/Grok');
    }

    // Add conversation history if available
    if (context?.conversationHistory) {
      const historyMessages = this.formatConversationHistory(
        context.conversationHistory
      );
      messages.push(...historyMessages);
      adaptationNotes.push(
        `Added ${historyMessages.length} conversation history messages`
      );
    }

    // Process the main prompt for xAI optimization
    let processedPrompt = this.optimizePromptForXAI(optimizedPrompt, context);

    // Add real-time context if enabled
    if (this.config.enableRealtimeData && context?.enableRealtime !== false) {
      const realtimeResult = this.addRealtimeContext(processedPrompt);
      processedPrompt = realtimeResult.prompt;
      if (realtimeResult.applied) {
        xaiFeatures.realtimeEnabled = true;
        adaptationNotes.push('Real-time data context added');
      }
    }

    // Apply reasoning optimization
    if (this.config.enableReasoningOptimization) {
      const reasoningResult = this.optimizeForReasoning(processedPrompt);
      processedPrompt = reasoningResult.prompt;
      if (reasoningResult.applied) {
        xaiFeatures.reasoningOptimized = true;
        adaptationNotes.push('Reasoning optimization applied');
      }
    }

    // Add humor optimization if enabled
    if (this.config.optimizeForHumor || context?.personality === 'witty') {
      const humorResult = this.addHumorOptimization(processedPrompt);
      processedPrompt = humorResult.prompt;
      if (humorResult.applied) {
        xaiFeatures.humorEnhanced = true;
        adaptationNotes.push('Humor optimization applied');
      }
    }

    // Create user message
    messages.push({
      role: 'user',
      content: processedPrompt,
    });

    // Check token limits
    const totalTokens = this.estimateTokens(messages);
    const modelLimit = this.modelLimits[this.config.model];

    if (totalTokens > modelLimit * 0.8) {
      // Leave room for response
      warnings.push(
        `Prompt approaching model limit (${totalTokens}/${modelLimit} tokens)`
      );
    }

    // Build the request
    const request: xAIRequest = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    };

    // Add tools if configured
    if (this.config.enableToolCalling && context?.tools) {
      request.tools = this.formatTools(context.tools);
      xaiFeatures.toolsConfigured = true;
      adaptationNotes.push(`Configured ${context.tools.length} tools`);
    }

    // Add xAI-specific parameters
    if (this.config.model === 'grok-vision-beta') {
      request.top_p = 0.9;
      adaptationNotes.push('Vision model parameters applied');
    }

    return {
      request,
      tokenEstimate: totalTokens,
      adaptationNotes,
      warnings,
      xaiFeatures: Object.values(xaiFeatures).some(Boolean)
        ? xaiFeatures
        : undefined,
    };
  }

  /**
   * Create xAI-optimized system message
   */
  private createSystemMessage(
    prompt: string,
    context?: { systemMessage?: string; personality?: string }
  ): string {
    let systemMessage = context?.systemMessage || '';

    // Extract existing system message from prompt if not provided
    if (!systemMessage) {
      const systemPatterns = [
        /^You are (.*?)(?:\n\n|\.\s)/i,
        /^System: (.*?)(?:\n\n|\.\s)/i,
        /^Instructions: (.*?)(?:\n\n|\.\s)/i,
      ];

      for (const pattern of systemPatterns) {
        const match = prompt.match(pattern);
        if (match) {
          systemMessage = match[0].trim();
          break;
        }
      }
    }

    // Create base system message if none found
    if (!systemMessage) {
      systemMessage = 'You are Grok, an AI assistant created by xAI.';
    }

    // Enhance with xAI-specific characteristics
    systemMessage +=
      ' You have access to real-time information and excel at providing current, relevant responses.';

    // Add personality-specific enhancements
    switch (context?.personality) {
      case 'witty':
        systemMessage +=
          ' You have a witty, engaging personality and can use appropriate humor in your responses.';
        break;
      case 'serious':
        systemMessage +=
          ' You maintain a professional, serious tone focused on accuracy and thoroughness.';
        break;
      case 'technical':
        systemMessage +=
          ' You excel at technical explanations and detailed analysis with precision and clarity.';
        break;
      default:
        systemMessage +=
          ' You are helpful, informative, and engaging while maintaining accuracy.';
    }

    // Add reasoning guidance
    if (this.config.enableReasoningOptimization) {
      systemMessage +=
        ' When tackling complex problems, show your reasoning process clearly.';
    }

    return systemMessage;
  }

  /**
   * Format conversation history for xAI
   */
  private formatConversationHistory(
    history: Array<{ role: string; content: string }>
  ): xAIMessage[] {
    return history.map(msg => ({
      role: this.normalizeRole(msg.role),
      content: msg.content,
    }));
  }

  /**
   * Optimize prompt specifically for xAI/Grok
   */
  private optimizePromptForXAI(
    prompt: string,
    _context?: { personality?: string }
  ): string {
    let optimized = prompt;

    // Remove system message content if it was extracted
    const systemPatterns = [
      /^You are .*?(?:\n\n|\.\s)/i,
      /^System: .*?(?:\n\n|\.\s)/i,
      /^Instructions: .*?(?:\n\n|\.\s)/i,
    ];

    for (const pattern of systemPatterns) {
      optimized = optimized.replace(pattern, '').trim();
    }

    // Optimize for Grok's conversational style
    optimized = optimized.replace(/could you please/gi, 'please');
    optimized = optimized.replace(/would you be able to/gi, 'can you');
    optimized = optimized.replace(/if possible/gi, '');

    // Add specificity for better results
    optimized = optimized.replace(/some information/gi, 'detailed information');
    optimized = optimized.replace(
      /a bit about/gi,
      'comprehensive details about'
    );

    return optimized.trim();
  }

  /**
   * Add real-time data context
   */
  private addRealtimeContext(prompt: string): {
    prompt: string;
    applied: boolean;
  } {
    // Check if the prompt would benefit from real-time data
    const realtimeIndicators = [
      /current/i,
      /recent/i,
      /latest/i,
      /today/i,
      /now/i,
      /up.to.date/i,
    ];

    const needsRealtime = realtimeIndicators.some(pattern =>
      pattern.test(prompt)
    );

    if (needsRealtime) {
      const realtimePrompt = `${prompt}\n\nPlease use the most current and up-to-date information available to you.`;
      return { prompt: realtimePrompt, applied: true };
    }

    return { prompt, applied: false };
  }

  /**
   * Optimize for reasoning capabilities
   */
  private optimizeForReasoning(prompt: string): {
    prompt: string;
    applied: boolean;
  } {
    // Check if prompt involves complex reasoning
    const reasoningIndicators = [
      /analyze/i,
      /compare/i,
      /evaluate/i,
      /explain why/i,
      /reasoning/i,
      /logic/i,
      /step.by.step/i,
    ];

    const needsReasoning = reasoningIndicators.some(pattern =>
      pattern.test(prompt)
    );

    if (needsReasoning && !prompt.includes('reasoning')) {
      const reasoningPrompt = `${prompt}\n\nPlease show your reasoning process and explain your thought process clearly.`;
      return { prompt: reasoningPrompt, applied: true };
    }

    return { prompt, applied: false };
  }

  /**
   * Add humor optimization (Grok's specialty)
   */
  private addHumorOptimization(prompt: string): {
    prompt: string;
    applied: boolean;
  } {
    // Check if humor would be appropriate
    const seriousTopics = [
      /medical/i,
      /legal/i,
      /emergency/i,
      /crisis/i,
      /serious/i,
      /important.*matter/i,
    ];

    const isSeriousTopic = seriousTopics.some(pattern => pattern.test(prompt));

    if (
      !isSeriousTopic &&
      !prompt.includes('humor') &&
      !prompt.includes('funny')
    ) {
      const humorPrompt = `${prompt}\n\nFeel free to add appropriate wit or humor to make your response engaging, while maintaining accuracy.`;
      return { prompt: humorPrompt, applied: true };
    }

    return { prompt, applied: false };
  }

  /**
   * Format tools for xAI function calling
   */
  private formatTools(
    tools: Array<{ name: string; description: string; parameters: object }>
  ) {
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Normalize role names for xAI
   */
  private normalizeRole(role: string): 'system' | 'user' | 'assistant' {
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === 'system') return 'system';
    if (
      normalizedRole === 'assistant' ||
      normalizedRole === 'ai' ||
      normalizedRole === 'grok'
    )
      return 'assistant';
    return 'user';
  }

  /**
   * Estimate token count for xAI models
   */
  private estimateTokens(messages: xAIMessage[]): number {
    let totalTokens = 0;

    for (const message of messages) {
      // xAI tokenization approximation (similar to OpenAI)
      totalTokens += Math.ceil(message.content.length / 4);
      totalTokens += 4; // Overhead per message
    }

    return totalTokens;
  }

  /**
   * Get xAI-specific recommendations
   */
  getXAIRecommendations(): {
    bestPractices: string[];
    realtimeUsage: string[];
    reasoning: string[];
    personality: Record<string, string[]>;
  } {
    return {
      bestPractices: [
        'Leverage real-time data capabilities for current information',
        'Use clear, direct instructions for best results',
        "Take advantage of Grok's reasoning capabilities",
        'Consider personality settings for appropriate tone',
        'Use function calling for complex workflows',
      ],
      realtimeUsage: [
        'Great for current events and recent information',
        'Excellent for time-sensitive queries',
        'Can provide up-to-date facts and figures',
        'Useful for trending topics and current analysis',
      ],
      reasoning: [
        'Excels at step-by-step reasoning',
        'Shows clear thought processes',
        'Good at explaining complex concepts',
        'Can break down multi-step problems',
      ],
      personality: {
        witty: [
          'Adds appropriate humor to responses',
          'Engaging and entertaining communication style',
          'Good for creative and casual interactions',
        ],
        serious: [
          'Professional and focused responses',
          'Best for business and formal contexts',
          'Emphasizes accuracy and thoroughness',
        ],
        technical: [
          'Detailed technical explanations',
          'Precise and comprehensive analysis',
          'Great for engineering and scientific topics',
        ],
        standard: [
          'Balanced approach to all topics',
          'Helpful and informative responses',
          'Good general-purpose setting',
        ],
      },
    };
  }

  /**
   * Validate xAI request format
   */
  validateRequest(request: xAIRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.model) {
      errors.push('Model is required');
    }

    if (!request.messages || request.messages.length === 0) {
      errors.push('At least one message is required');
    }

    if (request.messages) {
      for (const message of request.messages) {
        if (!['system', 'user', 'assistant'].includes(message.role)) {
          errors.push(`Invalid role: ${message.role}`);
        }
        if (!message.content) {
          errors.push('Message content cannot be empty');
        }
      }
    }

    if (
      request.max_tokens &&
      (request.max_tokens < 1 || request.max_tokens > 32768)
    ) {
      errors.push('max_tokens must be between 1 and 32768');
    }

    if (
      request.temperature &&
      (request.temperature < 0 || request.temperature > 2)
    ) {
      errors.push('Temperature must be between 0 and 2');
    }

    if (request.top_p && (request.top_p < 0 || request.top_p > 1)) {
      errors.push('top_p must be between 0 and 1');
    }

    if (request.tools) {
      for (const tool of request.tools) {
        if (tool.type !== 'function') {
          errors.push('Only function tools are supported');
        }
        if (!tool.function.name || !tool.function.description) {
          errors.push('Function tools must have name and description');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default xAIAdapter;

/**
 * @fileoverview OpenAI platform adapter for prompt optimization
 * @lastmodified 2025-08-26T14:35:00Z
 *
 * Features: OpenAI API format adaptation, token management, model selection
 * Main APIs: OpenAIAdapter class for converting optimized prompts to OpenAI format
 * Constraints: OpenAI API specifications and token limits
 * Patterns: Adapter pattern, platform-specific formatting, API compatibility
 */

import { logger } from '../../utils/logger';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
}

export interface OpenAIAdapterConfig {
  model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'gpt-4o' | 'gpt-4o-mini';
  maxTokens: number;
  temperature: number;
  enableSystemMessage: boolean;
  splitLongPrompts: boolean;
}

export interface OpenAIAdaptationResult {
  request: OpenAIRequest;
  tokenEstimate: number;
  adaptationNotes: string[];
  warnings: string[];
}

export class OpenAIAdapter {
  private readonly defaultConfig: OpenAIAdapterConfig = {
    model: 'gpt-4',
    maxTokens: 4096,
    temperature: 0.7,
    enableSystemMessage: true,
    splitLongPrompts: true,
  };

  private readonly modelLimits = {
    'gpt-4': 128000,
    'gpt-4-turbo': 128000,
    'gpt-3.5-turbo': 16385,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
  };

  constructor(private config: OpenAIAdapterConfig = {} as OpenAIAdapterConfig) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Convert optimized prompt to OpenAI API format
   */
  adaptToOpenAI(
    optimizedPrompt: string,
    context?: {
      systemMessage?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
      userContext?: string;
    }
  ): OpenAIAdaptationResult {
    logger.info(`Adapting prompt for OpenAI ${this.config.model}`);

    const messages: OpenAIMessage[] = [];
    const adaptationNotes: string[] = [];
    const warnings: string[] = [];

    // Add system message if enabled and available
    if (this.config.enableSystemMessage) {
      const systemMessage = this.extractSystemMessage(
        optimizedPrompt,
        context?.systemMessage
      );
      if (systemMessage) {
        messages.push({
          role: 'system',
          content: systemMessage,
        });
        adaptationNotes.push('System message extracted and formatted');
      }
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

    // Process the main prompt
    const userMessage = this.formatUserMessage(
      optimizedPrompt,
      context?.userContext
    );

    // Check token limits and split if necessary
    const totalTokens =
      this.estimateTokens(messages) + this.estimateTokens([userMessage]);
    const modelLimit = this.modelLimits[this.config.model];

    if (totalTokens > modelLimit && this.config.splitLongPrompts) {
      const splitResult = this.splitLongPrompt(
        userMessage,
        modelLimit - this.estimateTokens(messages)
      );
      messages.push(...splitResult.messages);
      adaptationNotes.push(...splitResult.notes);
      warnings.push(...splitResult.warnings);
    } else if (totalTokens > modelLimit) {
      warnings.push(
        `Prompt exceeds model limit (${totalTokens}/${modelLimit} tokens)`
      );
      messages.push(userMessage);
    } else {
      messages.push(userMessage);
    }

    const request: OpenAIRequest = {
      model: this.config.model,
      messages,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    };

    // Add optional parameters based on model and use case
    if (this.config.model.includes('gpt-4')) {
      request.top_p = 0.95;
    }

    return {
      request,
      tokenEstimate: this.estimateTokens(messages),
      adaptationNotes,
      warnings,
    };
  }

  /**
   * Extract system message from optimized prompt
   */
  private extractSystemMessage(
    prompt: string,
    explicitSystemMessage?: string
  ): string | null {
    if (explicitSystemMessage) {
      return explicitSystemMessage;
    }

    // Look for common system message patterns
    const systemPatterns = [
      /^You are (.*?)(?:\n\n|\.\s)/i,
      /^System: (.*?)(?:\n\n|\.\s)/i,
      /^Instructions: (.*?)(?:\n\n|\.\s)/i,
    ];

    for (const pattern of systemPatterns) {
      const match = prompt.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    // Create a generic system message based on prompt content
    if (
      prompt.toLowerCase().includes('code') ||
      prompt.toLowerCase().includes('programming')
    ) {
      return 'You are a helpful coding assistant that provides accurate, well-commented code examples and explanations.';
    }
    if (
      prompt.toLowerCase().includes('analysis') ||
      prompt.toLowerCase().includes('research')
    ) {
      return 'You are a knowledgeable research assistant that provides thorough, evidence-based analysis and insights.';
    }
    if (
      prompt.toLowerCase().includes('creative') ||
      prompt.toLowerCase().includes('writing')
    ) {
      return 'You are a creative writing assistant that helps with engaging, well-structured content creation.';
    }

    return 'You are a helpful, harmless, and honest assistant.';
  }

  /**
   * Format conversation history for OpenAI
   */
  private formatConversationHistory(
    history: Array<{ role: string; content: string }>
  ): OpenAIMessage[] {
    return history.map(msg => ({
      role: this.normalizeRole(msg.role),
      content: msg.content,
    }));
  }

  /**
   * Format the main user message
   */
  private formatUserMessage(
    prompt: string,
    userContext?: string
  ): OpenAIMessage {
    let content = prompt;

    // Remove system message if it was extracted
    const systemPatterns = [
      /^You are .*?(?:\n\n|\.\s)/i,
      /^System: .*?(?:\n\n|\.\s)/i,
      /^Instructions: .*?(?:\n\n|\.\s)/i,
    ];

    for (const pattern of systemPatterns) {
      content = content.replace(pattern, '').trim();
    }

    // Add user context if provided
    if (userContext) {
      content = `Context: ${userContext}\n\n${content}`;
    }

    return {
      role: 'user',
      content: content.trim(),
    };
  }

  /**
   * Split long prompts into multiple messages
   */
  private splitLongPrompt(
    message: OpenAIMessage,
    maxTokens: number
  ): { messages: OpenAIMessage[]; notes: string[]; warnings: string[] } {
    const { content } = message;
    const messages: OpenAIMessage[] = [];
    const notes: string[] = [];
    const warnings: string[] = [];

    // Simple splitting by paragraphs first
    const paragraphs = content.split('\n\n');
    let currentChunk = '';
    let chunkIndex = 1;

    for (const paragraph of paragraphs) {
      const testChunk = currentChunk + (currentChunk ? '\n\n' : '') + paragraph;

      if (
        this.estimateTokens([{ role: 'user', content: testChunk }]) <= maxTokens
      ) {
        currentChunk = testChunk;
      } else if (currentChunk) {
        messages.push({
          role: 'user',
          content: `Part ${chunkIndex}: ${currentChunk}`,
        });
        chunkIndex += 1;
        currentChunk = paragraph;
      } else {
        // Single paragraph is too long, need to split by sentences
        const sentences = paragraph.split(/[.!?]+\s/);
        for (const sentence of sentences) {
          if (
            this.estimateTokens([{ role: 'user', content: sentence }]) <=
            maxTokens
          ) {
            messages.push({
              role: 'user',
              content: `Part ${chunkIndex}: ${sentence}`,
            });
            chunkIndex += 1;
          } else {
            warnings.push(
              `Sentence too long to fit in token limit: ${sentence.substring(0, 100)}...`
            );
          }
        }
      }
    }

    // Add final chunk
    if (currentChunk) {
      messages.push({
        role: 'user',
        content: `Part ${chunkIndex}: ${currentChunk}`,
      });
    }

    if (messages.length > 1) {
      messages.push({
        role: 'user',
        content:
          'Please provide a comprehensive response considering all the parts above.',
      });
      notes.push(`Split into ${messages.length - 1} parts due to token limit`);
    }

    return { messages, notes, warnings };
  }

  /**
   * Normalize role names for OpenAI
   */
  private normalizeRole(role: string): 'system' | 'user' | 'assistant' {
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === 'system') return 'system';
    if (normalizedRole === 'assistant' || normalizedRole === 'ai')
      return 'assistant';
    return 'user';
  }

  /**
   * Estimate token count for OpenAI models
   */
  private estimateTokens(messages: OpenAIMessage[]): number {
    let totalTokens = 0;

    for (const message of messages) {
      // OpenAI tokenization approximation
      totalTokens += Math.ceil(message.content.length / 4);
      totalTokens += 4; // Overhead per message
    }

    return totalTokens;
  }

  /**
   * Get model-specific recommendations
   */
  getModelRecommendations(): {
    gpt4: string[];
    gpt35turbo: string[];
    bestPractices: string[];
  } {
    return {
      gpt4: [
        'Use system messages to set context and behavior',
        'Leverage advanced reasoning capabilities',
        'Can handle complex, multi-turn conversations',
        'Good for tasks requiring deep understanding',
      ],
      gpt35turbo: [
        'More cost-effective for simpler tasks',
        'Faster response times',
        'Good for straightforward Q&A and basic tasks',
        'Watch token limits more carefully (16K context)',
      ],
      bestPractices: [
        'Use clear, specific instructions',
        'Provide examples when possible',
        'Structure conversations with appropriate roles',
        'Monitor token usage and costs',
        'Use temperature 0.0-0.3 for focused outputs',
        'Use temperature 0.7-1.0 for creative tasks',
      ],
    };
  }

  /**
   * Validate OpenAI request format
   */
  validateRequest(request: OpenAIRequest): {
    valid: boolean;
    errors: string[];
  } {
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
      (request.max_tokens < 1 || request.max_tokens > 4096)
    ) {
      errors.push('max_tokens must be between 1 and 4096');
    }

    if (
      request.temperature &&
      (request.temperature < 0 || request.temperature > 2)
    ) {
      errors.push('Temperature must be between 0 and 2');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default OpenAIAdapter;

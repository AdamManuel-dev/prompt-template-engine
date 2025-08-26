/**
 * @fileoverview Anthropic Claude platform adapter for prompt optimization
 * @lastmodified 2025-08-26T14:40:00Z
 *
 * Features: Anthropic API format adaptation, constitutional AI principles, XML structuring
 * Main APIs: AnthropicAdapter class for converting optimized prompts to Anthropic format
 * Constraints: Anthropic API specifications and token limits
 * Patterns: Adapter pattern, constitutional AI compliance, XML-structured reasoning
 */

import { logger } from '../../utils/logger';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
}

export interface AnthropicAdapterConfig {
  model:
    | 'claude-3-opus-20240229'
    | 'claude-3-sonnet-20240229'
    | 'claude-3-haiku-20240307'
    | 'claude-3-5-sonnet-20241022';
  maxTokens: number;
  temperature: number;
  enableSystemMessage: boolean;
  enableXMLStructuring: boolean;
  enableConstitutionalAI: boolean;
}

export interface AnthropicAdaptationResult {
  request: AnthropicRequest;
  tokenEstimate: number;
  adaptationNotes: string[];
  warnings: string[];
  xmlStructure?: {
    thinkingEnabled: boolean;
    reasoningSteps: string[];
    structuredSections: string[];
  };
}

export class AnthropicAdapter {
  private readonly defaultConfig: AnthropicAdapterConfig = {
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    temperature: 0.0,
    enableSystemMessage: true,
    enableXMLStructuring: true,
    enableConstitutionalAI: true,
  };

  private readonly modelLimits = {
    'claude-3-opus-20240229': 200000,
    'claude-3-sonnet-20240229': 200000,
    'claude-3-haiku-20240307': 200000,
    'claude-3-5-sonnet-20241022': 200000,
  };

  constructor(
    private config: AnthropicAdapterConfig = {} as AnthropicAdapterConfig
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Convert optimized prompt to Anthropic API format
   */
  adaptToAnthropic(
    optimizedPrompt: string,
    context?: {
      systemMessage?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
      taskComplexity?: 'simple' | 'medium' | 'complex';
      enableThinking?: boolean;
    }
  ): AnthropicAdaptationResult {
    logger.info(`Adapting prompt for Anthropic ${this.config.model}`);

    const messages: AnthropicMessage[] = [];
    const adaptationNotes: string[] = [];
    const warnings: string[] = [];
    let xmlStructure: any = {};

    // Extract and format system message
    let systemMessage = '';
    if (this.config.enableSystemMessage) {
      systemMessage = this.extractSystemMessage(
        optimizedPrompt,
        context?.systemMessage
      );
      if (systemMessage) {
        adaptationNotes.push(
          'System message extracted and formatted for Anthropic'
        );
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

    // Process and structure the main prompt
    let processedPrompt = this.removeSystemMessageFromPrompt(optimizedPrompt);

    // Apply XML structuring if enabled
    if (this.config.enableXMLStructuring) {
      const xmlResult = this.addXMLStructuring(processedPrompt, context);
      processedPrompt = xmlResult.prompt;
      xmlStructure = xmlResult.structure;
      if (xmlResult.applied) {
        adaptationNotes.push('XML structuring applied for better reasoning');
      }
    }

    // Apply constitutional AI principles if enabled
    if (this.config.enableConstitutionalAI) {
      const constitutionalResult = this.applyConstitutionalAI(
        processedPrompt,
        systemMessage
      );
      processedPrompt = constitutionalResult.prompt;
      systemMessage = constitutionalResult.systemMessage;
      if (constitutionalResult.applied) {
        adaptationNotes.push('Constitutional AI principles applied');
      }
    }

    // Create user message
    messages.push({
      role: 'user',
      content: processedPrompt,
    });

    // Check token limits
    const totalTokens =
      this.estimateTokens(systemMessage) +
      this.estimateTokens(messages.map(m => m.content).join(''));
    const modelLimit = this.modelLimits[this.config.model];

    if (totalTokens > modelLimit * 0.8) {
      // Leave room for response
      warnings.push(
        `Prompt approaching model limit (${totalTokens}/${modelLimit} tokens)`
      );
    }

    const request: AnthropicRequest = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      messages,
      temperature: this.config.temperature,
    };

    // Add system message if present
    if (systemMessage) {
      request.system = systemMessage;
    }

    // Add model-specific parameters
    if (this.config.model.includes('claude-3')) {
      request.top_p = 0.99;
    }

    return {
      request,
      tokenEstimate: totalTokens,
      adaptationNotes,
      warnings,
      xmlStructure: xmlStructure.applied ? xmlStructure : undefined,
    };
  }

  /**
   * Extract system message optimized for Claude
   */
  private extractSystemMessage(
    prompt: string,
    explicitSystemMessage?: string
  ): string {
    if (explicitSystemMessage) {
      return this.enhanceSystemMessageForClaude(explicitSystemMessage);
    }

    // Look for system message patterns in the prompt
    const systemPatterns = [
      /^You are (.*?)(?:\n\n|\.\s)/i,
      /^System: (.*?)(?:\n\n|\.\s)/i,
      /^Instructions: (.*?)(?:\n\n|\.\s)/i,
    ];

    for (const pattern of systemPatterns) {
      const match = prompt.match(pattern);
      if (match) {
        return this.enhanceSystemMessageForClaude(match[0].trim());
      }
    }

    // Create Claude-optimized system message based on prompt content
    let baseMessage =
      'You are Claude, a helpful, harmless, and honest AI assistant created by Anthropic.';

    if (
      prompt.toLowerCase().includes('code') ||
      prompt.toLowerCase().includes('programming')
    ) {
      baseMessage +=
        ' You excel at code analysis, debugging, and providing well-structured programming solutions with clear explanations.';
    } else if (
      prompt.toLowerCase().includes('analysis') ||
      prompt.toLowerCase().includes('research')
    ) {
      baseMessage +=
        ' You excel at analytical thinking, research, and providing thorough, evidence-based insights with clear reasoning.';
    } else if (
      prompt.toLowerCase().includes('creative') ||
      prompt.toLowerCase().includes('writing')
    ) {
      baseMessage +=
        ' You excel at creative tasks and help produce engaging, well-structured content while maintaining accuracy.';
    }

    return baseMessage;
  }

  /**
   * Enhance system message with Claude-specific guidance
   */
  private enhanceSystemMessageForClaude(systemMessage: string): string {
    let enhanced = systemMessage;

    // Add constitutional AI principles if not present
    if (
      !enhanced.toLowerCase().includes('helpful') ||
      !enhanced.toLowerCase().includes('harmless') ||
      !enhanced.toLowerCase().includes('honest')
    ) {
      enhanced +=
        ' Always strive to be helpful, harmless, and honest in your responses.';
    }

    // Add XML reasoning guidance
    if (!enhanced.includes('thinking')) {
      enhanced +=
        ' When tackling complex problems, you may use <thinking> tags to show your reasoning process.';
    }

    return enhanced;
  }

  /**
   * Format conversation history for Anthropic
   */
  private formatConversationHistory(
    history: Array<{ role: string; content: string }>
  ): AnthropicMessage[] {
    const messages: AnthropicMessage[] = [];

    for (const msg of history) {
      const role = this.normalizeRole(msg.role);
      if (role) {
        messages.push({
          role,
          content: msg.content,
        });
      }
    }

    // Ensure alternating user/assistant pattern
    return this.ensureAlternatingPattern(messages);
  }

  /**
   * Add XML structuring for better Claude reasoning
   */
  private addXMLStructuring(
    prompt: string,
    context?: { taskComplexity?: string; enableThinking?: boolean }
  ): { prompt: string; applied: boolean; structure: any } {
    let structuredPrompt = prompt;
    const structure = {
      thinkingEnabled: false,
      reasoningSteps: [],
      structuredSections: [],
      applied: false,
    };

    // Add thinking tags for complex tasks
    if (context?.enableThinking || context?.taskComplexity === 'complex') {
      if (!prompt.includes('<thinking>')) {
        structuredPrompt = `<thinking>\nLet me break down this request and think through the best approach.\n</thinking>\n\n${structuredPrompt}`;
        structure.thinkingEnabled = true;
      }
    }

    // Structure multi-part requests
    if (this.isMultiPartRequest(prompt)) {
      const parts = this.identifyPromptSections(prompt);
      if (parts.length > 1) {
        let restructured = '';
        parts.forEach((part, index) => {
          restructured += `<section name="part_${index + 1}">\n${part}\n</section>\n\n`;
          structure.structuredSections.push(`part_${index + 1}`);
        });
        structuredPrompt = restructured + structuredPrompt;
      }
    }

    // Add reasoning structure for analytical tasks
    if (
      prompt.toLowerCase().includes('analysis') ||
      prompt.toLowerCase().includes('evaluate')
    ) {
      if (!prompt.includes('<analysis>')) {
        structuredPrompt +=
          '\n\nPlease structure your analysis using <analysis></analysis> tags and break down your reasoning clearly.';
        structure.reasoningSteps.push('analysis');
      }
    }

    structure.applied =
      structure.thinkingEnabled ||
      structure.structuredSections.length > 0 ||
      structure.reasoningSteps.length > 0;

    return {
      prompt: structuredPrompt,
      applied: structure.applied,
      structure,
    };
  }

  /**
   * Apply constitutional AI principles
   */
  private applyConstitutionalAI(
    prompt: string,
    systemMessage: string
  ): {
    prompt: string;
    systemMessage: string;
    applied: boolean;
  } {
    let enhancedPrompt = prompt;
    let enhancedSystemMessage = systemMessage;
    let applied = false;

    // Check for potentially harmful requests
    const harmfulPatterns = [
      /\b(harm|hurt|damage|illegal|unethical|dangerous)\b/i,
      /\b(hack|exploit|manipulate|deceive)\b/i,
    ];

    const isHarmfulRequest = harmfulPatterns.some(pattern =>
      pattern.test(prompt)
    );

    if (isHarmfulRequest) {
      enhancedPrompt = `${enhancedPrompt}\n\nPlease note: If this request involves anything harmful, illegal, or unethical, please decline politely and suggest constructive alternatives.`;
      applied = true;
    }

    // Add accuracy reminders for factual requests
    if (
      prompt.toLowerCase().includes('fact') ||
      prompt.toLowerCase().includes('information') ||
      prompt.toLowerCase().includes('research')
    ) {
      enhancedPrompt = `${enhancedPrompt}\n\nPlease ensure all factual claims are accurate and cite uncertainty when appropriate.`;
      applied = true;
    }

    // Enhance system message with constitutional principles
    if (!systemMessage.includes('constitutional')) {
      enhancedSystemMessage +=
        ' Follow constitutional AI principles: be helpful while avoiding harmful outputs, be honest about limitations and uncertainties, and prioritize human wellbeing.';
      applied = true;
    }

    return {
      prompt: enhancedPrompt,
      systemMessage: enhancedSystemMessage,
      applied,
    };
  }

  /**
   * Remove system message content from the main prompt
   */
  private removeSystemMessageFromPrompt(prompt: string): string {
    const systemPatterns = [
      /^You are .*?(?:\n\n|\.\s)/i,
      /^System: .*?(?:\n\n|\.\s)/i,
      /^Instructions: .*?(?:\n\n|\.\s)/i,
    ];

    let cleaned = prompt;
    for (const pattern of systemPatterns) {
      cleaned = cleaned.replace(pattern, '').trim();
    }

    return cleaned;
  }

  /**
   * Check if prompt has multiple distinct parts
   */
  private isMultiPartRequest(prompt: string): boolean {
    const multiPartIndicators = [
      /\d+\./g, // Numbered lists
      /first.*second.*third/i,
      /part\s+\d+/i,
      /step\s+\d+/i,
    ];

    return multiPartIndicators.some(pattern => {
      const matches = prompt.match(pattern);
      return matches && matches.length > 2;
    });
  }

  /**
   * Identify distinct sections in the prompt
   */
  private identifyPromptSections(prompt: string): string[] {
    // Split by numbered lists
    if (/\d+\./.test(prompt)) {
      return prompt.split(/(?=\d+\.)/).filter(part => part.trim());
    }

    // Split by paragraph breaks
    const paragraphs = prompt.split('\n\n').filter(p => p.trim());
    return paragraphs.length > 3 ? paragraphs : [prompt];
  }

  /**
   * Normalize role names for Anthropic
   */
  private normalizeRole(role: string): 'user' | 'assistant' | null {
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === 'user' || normalizedRole === 'human') return 'user';
    if (
      normalizedRole === 'assistant' ||
      normalizedRole === 'ai' ||
      normalizedRole === 'claude'
    )
      return 'assistant';
    return null; // System messages are handled separately
  }

  /**
   * Ensure alternating user/assistant pattern required by Anthropic
   */
  private ensureAlternatingPattern(
    messages: AnthropicMessage[]
  ): AnthropicMessage[] {
    const result: AnthropicMessage[] = [];
    let lastRole: string | null = null;

    for (const message of messages) {
      if (message.role !== lastRole) {
        result.push(message);
        lastRole = message.role;
      } else {
        // Combine with previous message of same role
        if (
          result.length > 0 &&
          result[result.length - 1].role === message.role
        ) {
          result[result.length - 1].content += `\n\n${message.content}`;
        }
      }
    }

    return result;
  }

  /**
   * Estimate token count for Claude models
   */
  private estimateTokens(text: string): number {
    // Claude tokenization approximation (slightly different from OpenAI)
    return Math.ceil(text.length / 3.8);
  }

  /**
   * Get Claude-specific recommendations
   */
  getClaudeRecommendations(): {
    bestPractices: string[];
    xmlStructuring: string[];
    constitutionalAI: string[];
    modelSpecific: Record<string, string[]>;
  } {
    return {
      bestPractices: [
        'Use clear, specific instructions for best results',
        'Leverage XML tags for structured reasoning',
        'Separate system message from user content',
        'Use thinking tags for complex problem-solving',
        'Be explicit about desired output format',
      ],
      xmlStructuring: [
        'Use <thinking></thinking> for reasoning steps',
        'Structure complex requests with section tags',
        'Use <analysis></analysis> for analytical tasks',
        'Organize multi-part requests with numbered sections',
      ],
      constitutionalAI: [
        'Always prioritize helpful, harmless, honest responses',
        'Acknowledge limitations and uncertainties clearly',
        'Decline harmful requests politely with alternatives',
        'Provide accurate information with appropriate caveats',
      ],
      modelSpecific: {
        'claude-3-opus': [
          'Best for complex reasoning and analysis',
          'Excellent at following nuanced instructions',
          'Strong performance on creative tasks',
        ],
        'claude-3-sonnet': [
          'Balanced performance and speed',
          'Good for most general tasks',
          'Cost-effective for regular use',
        ],
        'claude-3-haiku': [
          'Fastest response times',
          'Good for simple, quick tasks',
          'Most cost-effective option',
        ],
      },
    };
  }

  /**
   * Validate Anthropic request format
   */
  validateRequest(request: AnthropicRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.model) {
      errors.push('Model is required');
    }

    if (!request.max_tokens || request.max_tokens < 1) {
      errors.push('max_tokens must be a positive integer');
    }

    if (!request.messages || request.messages.length === 0) {
      errors.push('At least one message is required');
    }

    if (request.messages) {
      // Check alternating pattern
      for (let i = 1; i < request.messages.length; i++) {
        if (request.messages[i].role === request.messages[i - 1].role) {
          errors.push(
            'Messages must alternate between user and assistant roles'
          );
          break;
        }
      }

      // Check for empty content
      for (const message of request.messages) {
        if (!message.content || message.content.trim() === '') {
          errors.push('Message content cannot be empty');
        }
      }

      // Must start with user message
      if (request.messages[0].role !== 'user') {
        errors.push('Conversation must start with a user message');
      }
    }

    if (
      request.temperature &&
      (request.temperature < 0 || request.temperature > 1)
    ) {
      errors.push('Temperature must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default AnthropicAdapter;

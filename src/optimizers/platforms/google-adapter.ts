/**
 * @fileoverview Google AI (Gemini) platform adapter for prompt optimization
 * @lastmodified 2025-08-26T14:45:00Z
 *
 * Features: Google AI API format adaptation, multimodal support, efficiency optimization
 * Main APIs: GoogleAdapter class for converting optimized prompts to Google AI format
 * Constraints: Google AI API specifications and token limits
 * Patterns: Adapter pattern, multimodal integration, efficiency-focused formatting
 */

import { logger } from '../../utils/logger';

export interface GoogleContent {
  parts: Array<{
    text?: string;
    inlineData?: {
      mimeType: string;
      data: string;
    };
  }>;
  role?: 'user' | 'model';
}

export interface GoogleRequest {
  model: string;
  contents: GoogleContent[];
  generationConfig?: {
    temperature?: number;
    topK?: number;
    topP?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
    candidateCount?: number;
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

export interface GoogleAdapterConfig {
  model:
    | 'gemini-pro'
    | 'gemini-pro-vision'
    | 'gemini-1.5-pro'
    | 'gemini-1.5-flash';
  maxOutputTokens: number;
  temperature: number;
  topK: number;
  topP: number;
  enableMultimodal: boolean;
  enableSafetySettings: boolean;
  optimizeForEfficiency: boolean;
}

export interface GoogleAdaptationResult {
  request: GoogleRequest;
  tokenEstimate: number;
  adaptationNotes: string[];
  warnings: string[];
  multimodalFeatures?: {
    imageSupport: boolean;
    fileSupport: boolean;
    optimizedForVision: boolean;
  };
}

export class GoogleAdapter {
  private readonly defaultConfig: GoogleAdapterConfig = {
    model: 'gemini-1.5-pro',
    maxOutputTokens: 8192,
    temperature: 0.4,
    topK: 40,
    topP: 0.95,
    enableMultimodal: true,
    enableSafetySettings: true,
    optimizeForEfficiency: true,
  };

  private readonly modelLimits = {
    'gemini-pro': 32000,
    'gemini-pro-vision': 16000,
    'gemini-1.5-pro': 2000000,
    'gemini-1.5-flash': 1000000,
  };

  constructor(private config: GoogleAdapterConfig = {} as GoogleAdapterConfig) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Convert optimized prompt to Google AI API format
   */
  adaptToGoogle(
    optimizedPrompt: string,
    context?: {
      systemMessage?: string;
      conversationHistory?: Array<{ role: string; content: string }>;
      images?: Array<{ data: string; mimeType: string }>;
      files?: Array<{ data: string; mimeType: string }>;
      safetyLevel?: 'strict' | 'moderate' | 'permissive';
    }
  ): GoogleAdaptationResult {
    logger.info(`Adapting prompt for Google ${this.config.model}`);

    const contents: GoogleContent[] = [];
    const adaptationNotes: string[] = [];
    const warnings: string[] = [];
    let multimodalFeatures: Record<string, unknown> = {};

    // Add conversation history if available
    if (context?.conversationHistory) {
      const historyContents = this.formatConversationHistory(
        context.conversationHistory
      );
      contents.push(...historyContents);
      adaptationNotes.push(
        `Added ${historyContents.length} conversation history entries`
      );
    }

    // Process the main prompt
    const processedPrompt = this.processPromptForGoogle(optimizedPrompt);

    // Create main user content
    const userContent: GoogleContent = {
      parts: [{ text: processedPrompt }],
      role: 'user',
    };

    // Add multimodal content if available and supported
    if (this.config.enableMultimodal && this.supportsMultimodal()) {
      const multimodalResult = this.addMultimodalContent(userContent, context);
      if (multimodalResult.added) {
        multimodalFeatures = multimodalResult.features;
        adaptationNotes.push(...multimodalResult.notes);
      }
    }

    contents.push(userContent);

    // Check token limits
    const totalTokens = this.estimateTokens(contents);
    const modelLimit = this.modelLimits[this.config.model];

    if (totalTokens > modelLimit * 0.8) {
      // Leave room for response
      warnings.push(
        `Prompt approaching model limit (${totalTokens}/${modelLimit} tokens)`
      );
    }

    // Build the request
    const request: GoogleRequest = {
      model: this.config.model,
      contents,
      generationConfig: {
        temperature: this.config.temperature,
        topK: this.config.topK,
        topP: this.config.topP,
        maxOutputTokens: this.config.maxOutputTokens,
      },
    };

    // Add system instruction if available
    if (context?.systemMessage) {
      const systemInstruction = this.formatSystemInstruction(
        context.systemMessage
      );
      request.systemInstruction = systemInstruction;
      adaptationNotes.push('System instruction formatted for Google AI');
    }

    // Add safety settings if enabled
    if (this.config.enableSafetySettings) {
      request.safetySettings = this.createSafetySettings(context?.safetyLevel);
      adaptationNotes.push('Safety settings configured');
    }

    return {
      request,
      tokenEstimate: totalTokens,
      adaptationNotes,
      warnings,
      multimodalFeatures:
        Object.keys(multimodalFeatures).length > 0
          ? multimodalFeatures
          : undefined,
    };
  }

  /**
   * Process prompt for Google AI optimization
   */
  private processPromptForGoogle(prompt: string): string {
    let processed = prompt;

    if (this.config.optimizeForEfficiency) {
      // Remove verbose language
      processed = processed.replace(/please note that/gi, '');
      processed = processed.replace(/it is important to understand that/gi, '');
      processed = processed.replace(/you should know that/gi, '');

      // Simplify complex phrases
      processed = processed.replace(/in order to/gi, 'to');
      processed = processed.replace(/for the purpose of/gi, 'to');
      processed = processed.replace(/due to the fact that/gi, 'because');
    }

    // Optimize for Gemini's instruction following
    if (!processed.includes('Please') && !processed.startsWith('I need')) {
      processed = `Please ${processed.charAt(0).toLowerCase()}${processed.slice(1)}`;
    }

    // Clean up whitespace
    processed = processed.replace(/\s+/g, ' ').trim();

    return processed;
  }

  /**
   * Format conversation history for Google AI
   */
  private formatConversationHistory(
    history: Array<{ role: string; content: string }>
  ): GoogleContent[] {
    const contents: GoogleContent[] = [];

    for (const msg of history) {
      const role = this.normalizeRole(msg.role);
      if (role) {
        contents.push({
          parts: [{ text: msg.content }],
          role,
        });
      }
    }

    // Ensure alternating pattern (Google AI requirement)
    return this.ensureAlternatingPattern(contents);
  }

  /**
   * Add multimodal content (images, files)
   */
  private addMultimodalContent(
    userContent: GoogleContent,
    context?: {
      images?: Array<{ data: string; mimeType: string }>;
      files?: Array<{ data: string; mimeType: string }>;
    }
  ): { added: boolean; features: Record<string, unknown>; notes: string[] } {
    const features = {
      imageSupport: false,
      fileSupport: false,
      optimizedForVision: false,
    };
    const notes: string[] = [];
    let added = false;

    // Add images if available
    if (context?.images && context.images.length > 0) {
      for (const image of context.images) {
        userContent.parts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.data,
          },
        });
      }
      features.imageSupport = true;
      features.optimizedForVision = this.config.model.includes('vision');
      notes.push(`Added ${context.images.length} images`);
      added = true;
    }

    // Add files if available (for supported models)
    if (context?.files && context.files.length > 0) {
      const supportedMimeTypes = [
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/json',
      ];

      for (const file of context.files) {
        if (supportedMimeTypes.includes(file.mimeType)) {
          userContent.parts.push({
            inlineData: {
              mimeType: file.mimeType,
              data: file.data,
            },
          });
          features.fileSupport = true;
          added = true;
        }
      }

      if (features.fileSupport) {
        notes.push(`Added ${context.files.length} files`);
      }
    }

    return { added, features, notes };
  }

  /**
   * Format system instruction for Google AI
   */
  private formatSystemInstruction(systemMessage: string): {
    parts: Array<{ text: string }>;
  } {
    // Enhance system message for Google AI
    let enhanced = systemMessage;

    // Add Google AI specific guidance
    if (!enhanced.includes('accurate') && !enhanced.includes('helpful')) {
      enhanced +=
        ' Provide accurate, helpful responses based on the given instructions.';
    }

    // Add efficiency guidance for Gemini
    if (this.config.optimizeForEfficiency) {
      enhanced +=
        ' Be concise and direct in your responses while maintaining completeness.';
    }

    return {
      parts: [{ text: enhanced }],
    };
  }

  /**
   * Create safety settings based on safety level
   */
  private createSafetySettings(
    safetyLevel?: 'strict' | 'moderate' | 'permissive'
  ) {
    const level = safetyLevel || 'moderate';

    const thresholds = {
      strict: 'BLOCK_LOW_AND_ABOVE',
      moderate: 'BLOCK_MEDIUM_AND_ABOVE',
      permissive: 'BLOCK_ONLY_HIGH',
    };

    const threshold = thresholds[level];

    return [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold,
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold,
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold,
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold,
      },
    ];
  }

  /**
   * Check if current model supports multimodal input
   */
  private supportsMultimodal(): boolean {
    return (
      this.config.model.includes('vision') || this.config.model.includes('1.5')
    );
  }

  /**
   * Normalize role names for Google AI
   */
  private normalizeRole(role: string): 'user' | 'model' | null {
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === 'user' || normalizedRole === 'human') return 'user';
    if (
      normalizedRole === 'assistant' ||
      normalizedRole === 'ai' ||
      normalizedRole === 'model'
    )
      return 'model';
    return null;
  }

  /**
   * Ensure alternating user/model pattern
   */
  private ensureAlternatingPattern(contents: GoogleContent[]): GoogleContent[] {
    const result: GoogleContent[] = [];
    let lastRole: string | undefined;

    for (const content of contents) {
      if (content.role !== lastRole) {
        result.push(content);
        lastRole = content.role;
      } else if (
        result.length > 0 &&
        result[result.length - 1].role === content.role
      ) {
        // Combine with previous content of same role
        const lastContent = result[result.length - 1];
        const newText = content.parts.map(p => p.text).join(' ');
        lastContent.parts[0].text += ` ${newText}`;
      }
    }

    return result;
  }

  /**
   * Estimate token count for Google AI models
   */
  private estimateTokens(contents: GoogleContent[]): number {
    let totalTokens = 0;

    for (const content of contents) {
      for (const part of content.parts) {
        if (part.text) {
          // Google AI tokenization approximation
          totalTokens += Math.ceil(part.text.length / 4);
        }
        if (part.inlineData) {
          // Estimate for multimodal content
          totalTokens += 1000; // Rough estimate for images/files
        }
      }
    }

    return totalTokens;
  }

  /**
   * Get Google AI specific recommendations
   */
  getGoogleRecommendations(): {
    bestPractices: string[];
    multimodal: string[];
    efficiency: string[];
    modelSpecific: Record<string, string[]>;
  } {
    return {
      bestPractices: [
        'Use clear, direct instructions for best results',
        'Structure prompts with logical flow',
        'Provide specific examples when needed',
        'Use appropriate safety settings for your use case',
        'Consider multimodal capabilities for vision models',
      ],
      multimodal: [
        'Use Gemini Pro Vision or 1.5 models for image analysis',
        'Provide clear context about what to analyze in images',
        'Combine text and visual information effectively',
        'Consider file upload capabilities for document analysis',
      ],
      efficiency: [
        'Remove redundant words and phrases',
        'Use direct, imperative language',
        'Structure requests with clear objectives',
        "Leverage Gemini's efficiency optimizations",
      ],
      modelSpecific: {
        'gemini-pro': [
          'Best for text-only tasks',
          'Fast and efficient responses',
          'Good for general conversations and analysis',
        ],
        'gemini-pro-vision': [
          'Designed for image analysis tasks',
          'Can process images alongside text',
          'Good for visual question answering',
        ],
        'gemini-1.5-pro': [
          'Largest context window (2M tokens)',
          'Best for complex, long-form tasks',
          'Supports multimodal input (text, images, files)',
        ],
        'gemini-1.5-flash': [
          'Fastest response times',
          'Good balance of speed and capability',
          'Supports multimodal with 1M token context',
        ],
      },
    };
  }

  /**
   * Validate Google AI request format
   */
  validateRequest(request: GoogleRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.model) {
      errors.push('Model is required');
    }

    if (!request.contents || request.contents.length === 0) {
      errors.push('At least one content entry is required');
    }

    if (request.contents) {
      for (const content of request.contents) {
        if (!content.parts || content.parts.length === 0) {
          errors.push('Each content entry must have at least one part');
        }

        for (const part of content.parts) {
          if (!part.text && !part.inlineData) {
            errors.push('Each part must have either text or inlineData');
          }
        }
      }

      // Check alternating pattern
      for (let i = 1; i < request.contents.length; i++) {
        if (request.contents[i].role === request.contents[i - 1].role) {
          errors.push('Contents should alternate between user and model roles');
          break;
        }
      }
    }

    if (request.generationConfig) {
      const config = request.generationConfig;

      if (
        config.temperature &&
        (config.temperature < 0 || config.temperature > 2)
      ) {
        errors.push('Temperature must be between 0 and 2');
      }

      if (config.topK && config.topK < 1) {
        errors.push('topK must be a positive integer');
      }

      if (config.topP && (config.topP < 0 || config.topP > 1)) {
        errors.push('topP must be between 0 and 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default GoogleAdapter;

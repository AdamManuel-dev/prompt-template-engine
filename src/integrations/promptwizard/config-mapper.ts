/**
 * @fileoverview Configuration mapper for translating template configs to PromptWizard format
 * @lastmodified 2025-08-26T12:10:00Z
 *
 * Features: Maps YAML template configs to PromptWizard optimization parameters
 * Main APIs: ConfigMapper class with template-to-optimization-config mapping
 * Constraints: Must handle all template configuration variations and edge cases
 * Patterns: Mapper pattern, configuration transformation, validation
 */

import { logger } from '../../utils/logger';
import { OptimizationConfig } from './types';

export interface TemplateConfig {
  /** Template metadata */
  name?: string;
  description?: string;
  version?: string;
  author?: string;

  /** Template content */
  prompt?: string;
  content?: string;

  /** Variable definitions */
  variables?: Record<
    string,
    {
      type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
      description?: string;
      default?: unknown;
      required?: boolean;
      examples?: unknown[];
    }
  >;

  /** Template configuration */
  config?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    format?: 'markdown' | 'plain' | 'json';
    examples?: Array<{
      input: unknown;
      output: unknown;
    }>;
  };

  /** Optimization hints */
  optimization?: {
    enabled?: boolean;
    targetModel?: string;
    iterations?: number;
    generateExamples?: boolean;
    generateReasoning?: boolean;
    priority?: 'speed' | 'quality' | 'cost';
  };

  /** Metadata */
  metadata?: Record<string, unknown>;
}

export class ConfigMapper {
  /**
   * Map template configuration to PromptWizard optimization config
   */
  static mapToOptimizationConfig(
    templateConfig: TemplateConfig,
    options?: {
      task?: string;
      targetModel?: string;
      customParams?: Record<string, unknown>;
    }
  ): OptimizationConfig {
    logger.debug(
      `Mapping template config to PromptWizard format: ${templateConfig.name || 'unnamed'}`
    );

    // Extract prompt content
    const prompt = this.extractPromptContent(templateConfig);
    if (!prompt) {
      throw new Error('Template must contain prompt content');
    }

    // Determine task description
    const task =
      options?.task ||
      templateConfig.description ||
      templateConfig.name ||
      'General purpose prompt optimization';

    // Map target model
    const targetModel = this.mapTargetModel(
      options?.targetModel ||
        templateConfig.optimization?.targetModel ||
        templateConfig.config?.model
    );

    // Map optimization parameters
    const optimizationConfig: OptimizationConfig = {
      prompt,
      task,
      targetModel,
      mutateRefineIterations: this.mapIterations(templateConfig),
      fewShotCount: this.mapFewShotCount(templateConfig),
      generateReasoning: this.shouldGenerateReasoning(templateConfig),
      customParams: {
        ...options?.customParams,
        ...this.extractCustomParams(templateConfig),
      },
      metadata: {
        templateId: this.generateTemplateId(templateConfig),
        templateName: templateConfig.name,
        version: templateConfig.version,
        author: templateConfig.author,
      },
    };

    return optimizationConfig;
  }

  /**
   * Extract prompt content from template config
   */
  private static extractPromptContent(templateConfig: TemplateConfig): string {
    // Try prompt field first
    if (templateConfig.prompt) {
      return templateConfig.prompt.trim();
    }

    // Try content field
    if (templateConfig.content) {
      return templateConfig.content.trim();
    }

    // If neither exists, this is an invalid template
    return '';
  }

  /**
   * Map target model from various config sources
   */
  private static mapTargetModel(
    model?: string
  ): OptimizationConfig['targetModel'] {
    if (!model) {
      return 'gpt-4'; // Default
    }

    const modelLower = model.toLowerCase();

    // Map common model names to supported formats
    if (modelLower.includes('gpt-4')) {
      return 'gpt-4';
    }

    if (modelLower.includes('gpt-3.5') || modelLower.includes('gpt-35')) {
      return 'gpt-3.5-turbo';
    }

    if (
      modelLower.includes('claude-3-opus') ||
      modelLower.includes('claude-opus')
    ) {
      return 'claude-3-opus';
    }

    if (
      modelLower.includes('claude-3-sonnet') ||
      modelLower.includes('claude-sonnet')
    ) {
      return 'claude-3-sonnet';
    }

    if (modelLower.includes('gemini') || modelLower.includes('bard')) {
      return 'gemini-pro';
    }

    logger.warn(`Unknown model '${model}', defaulting to gpt-4`);
    return 'gpt-4';
  }

  /**
   * Map refinement iterations from config
   */
  private static mapIterations(templateConfig: TemplateConfig): number {
    // Check optimization-specific setting
    if (templateConfig.optimization?.iterations) {
      return Math.min(Math.max(templateConfig.optimization.iterations, 1), 10);
    }

    // Map from priority setting
    const priority = templateConfig.optimization?.priority;
    switch (priority) {
      case 'speed':
        return 1;
      case 'quality':
        return 5;
      case 'cost':
        return 2;
      default:
        return 3; // Balanced default
    }
  }

  /**
   * Map few-shot example count
   */
  private static mapFewShotCount(templateConfig: TemplateConfig): number {
    // If template already has examples, use that count as a base
    const existingExamples = templateConfig.config?.examples?.length || 0;

    // Check if example generation is explicitly enabled
    const shouldGenerate =
      templateConfig.optimization?.generateExamples !== false;

    if (!shouldGenerate) {
      return 0;
    }

    // Generate additional examples beyond what exists
    const baseCount = Math.max(5 - existingExamples, 0);

    // Adjust based on priority
    const priority = templateConfig.optimization?.priority;
    switch (priority) {
      case 'speed':
        return Math.min(baseCount, 3);
      case 'quality':
        return baseCount + 2;
      case 'cost':
        return Math.min(baseCount, 2);
      default:
        return baseCount;
    }
  }

  /**
   * Determine if reasoning should be generated
   */
  private static shouldGenerateReasoning(
    templateConfig: TemplateConfig
  ): boolean {
    // Check explicit setting
    if (templateConfig.optimization?.generateReasoning !== undefined) {
      return templateConfig.optimization.generateReasoning;
    }

    // Check if prompt contains reasoning patterns
    const prompt = this.extractPromptContent(templateConfig);
    const hasReasoningKeywords =
      /think|reason|step|because|therefore|analyze|consider/i.test(prompt);

    // Default based on priority and content
    const priority = templateConfig.optimization?.priority;
    if (priority === 'speed') {
      return false;
    }

    if (priority === 'quality' || hasReasoningKeywords) {
      return true;
    }

    return true; // Default to generating reasoning
  }

  /**
   * Extract custom parameters from template config
   */
  private static extractCustomParams(
    templateConfig: TemplateConfig
  ): Record<string, unknown> {
    const customParams: Record<string, unknown> = {};

    // Include template variables as context
    if (templateConfig.variables) {
      customParams.templateVariables = Object.entries(
        templateConfig.variables
      ).map(([name, config]) => ({
        name,
        type: config.type || 'string',
        description: config.description,
        required: config.required || false,
        examples: config.examples,
      }));
    }

    // Include existing examples
    if (templateConfig.config?.examples) {
      customParams.existingExamples = templateConfig.config.examples;
    }

    // Include template-specific settings
    if (templateConfig.config?.temperature !== undefined) {
      customParams.preferredTemperature = templateConfig.config.temperature;
    }

    if (templateConfig.config?.maxTokens !== undefined) {
      customParams.preferredMaxTokens = templateConfig.config.maxTokens;
    }

    if (templateConfig.config?.format) {
      customParams.outputFormat = templateConfig.config.format;
    }

    // Include any additional metadata
    if (templateConfig.metadata) {
      customParams.templateMetadata = templateConfig.metadata;
    }

    return customParams;
  }

  /**
   * Generate a unique template ID
   */
  private static generateTemplateId(templateConfig: TemplateConfig): string {
    const name = templateConfig.name || 'unnamed';
    const version = templateConfig.version || '1.0.0';

    // Create a deterministic ID based on template content
    const content = this.extractPromptContent(templateConfig);
    const hash = this.simpleHash(content);

    return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${version}-${hash}`;
  }

  /**
   * Simple hash function for generating consistent IDs
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      const char = str.charCodeAt(i);
      hash = hash * 5 - hash + char;
      hash = Math.abs(hash) % 0x7fffffff; // Convert to 32-bit integer without bitwise ops
    }
    return hash.toString(16).substring(0, 8);
  }

  /**
   * Validate template configuration for optimization
   */
  static validateForOptimization(templateConfig: TemplateConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required fields
    const prompt = this.extractPromptContent(templateConfig);
    if (!prompt) {
      errors.push(
        'Template must contain prompt content (prompt or content field)'
      );
    }

    if (prompt.length < 10) {
      warnings.push('Very short prompts may not benefit from optimization');
    }

    if (prompt.length > 8000) {
      warnings.push(
        'Very long prompts may hit token limits during optimization'
      );
    }

    // Check for description/task
    if (!templateConfig.description && !templateConfig.name) {
      warnings.push(
        'Templates should include a description or name for better optimization context'
      );
    }

    // Check optimization settings
    const iterations = templateConfig.optimization?.iterations;
    if (iterations !== undefined && (iterations < 1 || iterations > 10)) {
      warnings.push('Optimization iterations should be between 1 and 10');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Create optimization config from raw template data
   */
  static fromRawTemplate(
    templatePath: string,
    templateContent: string,
    frontmatter?: Record<string, unknown>,
    options?: {
      task?: string;
      targetModel?: string;
    }
  ): OptimizationConfig {
    const templateConfig: TemplateConfig = {
      name:
        (frontmatter?.name as string) || this.extractNameFromPath(templatePath),
      description: frontmatter?.description as string,
      version: (frontmatter?.version as string) || '1.0.0',
      author: frontmatter?.author as string,
      prompt: templateContent,
      config: frontmatter?.config as TemplateConfig['config'],
      optimization: frontmatter?.optimization as TemplateConfig['optimization'],
      variables: frontmatter?.variables as TemplateConfig['variables'],
      metadata: frontmatter?.metadata as Record<string, unknown>,
    };

    return this.mapToOptimizationConfig(templateConfig, options);
  }

  /**
   * Extract template name from file path
   */
  private static extractNameFromPath(templatePath: string): string {
    const basename = templatePath.split('/').pop() || 'unnamed';
    return basename.replace(/\.[^.]*$/, ''); // Remove extension
  }
}

/**
 * @fileoverview Claude Code MCP tools for prompt optimization with PromptWizard
 * @lastmodified 2025-08-26T13:40:00Z
 *
 * Features: MCP tools for prompt optimization, scoring, and batch processing
 * Main APIs: MCP tool implementations for Claude Code integration
 * Constraints: Follows MCP protocol, integrates with PromptWizard service
 * Patterns: Tool-based architecture, async operations, structured responses
 */

import { logger } from '../../utils/logger';
import { PromptWizardClient, createDefaultConfig } from '../promptwizard';
import { TemplateService } from '../../services/template.service';
import { PromptOptimizationService } from '../../services/prompt-optimization.service';
import { CacheService } from '../../services/cache.service';
import { Template } from '../../types';

export interface MCPOptimizePromptRequest {
  /** Prompt text to optimize */
  prompt: string;

  /** Task description for optimization context */
  task?: string;

  /** Target model for optimization */
  model?: 'gpt-4' | 'claude-3-opus' | 'claude-3-sonnet' | 'gemini-pro';

  /** Number of refinement iterations */
  iterations?: number;

  /** Number of few-shot examples */
  examples?: number;

  /** Generate reasoning steps */
  reasoning?: boolean;

  /** Template name if optimizing from template */
  templateName?: string;
}

export interface MCPOptimizePromptResponse {
  /** Success status */
  success: boolean;

  /** Original prompt */
  originalPrompt: string;

  /** Optimized prompt */
  optimizedPrompt: string;

  /** Optimization metrics */
  metrics: {
    accuracyImprovement: number;
    tokenReduction: number;
    costReduction: number;
    processingTime: number;
  };

  /** Quality scores */
  qualityScores: {
    originalScore: number;
    optimizedScore: number;
  };

  /** Generated examples if requested */
  examples?: Array<{
    input: string;
    output: string;
  }>;

  /** Reasoning steps if generated */
  reasoning?: string[];

  /** Error message if failed */
  error?: string;
}

export interface MCPScorePromptRequest {
  /** Prompt text to score */
  prompt: string;

  /** Task description for context */
  task?: string;

  /** Template name if scoring from template */
  templateName?: string;
}

export interface MCPScorePromptResponse {
  /** Success status */
  success: boolean;

  /** Overall quality score (0-100) */
  overallScore: number;

  /** Detailed metrics */
  metrics: {
    clarity: number;
    taskAlignment: number;
    tokenEfficiency: number;
    exampleQuality?: number;
  };

  /** Improvement suggestions */
  suggestions: string[];

  /** Confidence level */
  confidence: number;

  /** Error message if failed */
  error?: string;
}

export interface MCPBatchOptimizeRequest {
  /** Template names to optimize */
  templateNames?: string[];

  /** Direct prompts to optimize */
  prompts?: Array<{
    text: string;
    task?: string;
    name?: string;
  }>;

  /** Optimization configuration */
  config?: {
    model?: string;
    iterations?: number;
    examples?: number;
    reasoning?: boolean;
  };
}

export interface MCPBatchOptimizeResponse {
  /** Success status */
  success: boolean;

  /** Number of successfully optimized items */
  optimized: number;

  /** Number of failed optimizations */
  failed: number;

  /** Individual results */
  results: Array<{
    name: string;
    success: boolean;
    originalPrompt?: string;
    optimizedPrompt?: string;
    metrics?: {
      accuracyImprovement: number;
      tokenReduction: number;
    };
    error?: string;
  }>;

  /** Summary statistics */
  summary: {
    avgAccuracyImprovement: number;
    avgTokenReduction: number;
    totalProcessingTime: number;
  };

  /** Error message if batch failed */
  error?: string;
}

export class MCPOptimizationTools {
  private client: PromptWizardClient;

  private templateService: TemplateService;

  private optimizationService: PromptOptimizationService;

  constructor() {
    // Initialize services
    const config = createDefaultConfig();
    this.client = new PromptWizardClient(config);
    this.templateService = new TemplateService();
    const cacheService = new CacheService();
    this.optimizationService = new PromptOptimizationService(
      this.client,
      this.templateService,
      cacheService
    );
  }

  /**
   * MCP Tool: Optimize a prompt using PromptWizard
   */
  async optimizePrompt(
    request: MCPOptimizePromptRequest
  ): Promise<MCPOptimizePromptResponse> {
    logger.info('MCP: optimize_prompt called');

    try {
      let promptText = request.prompt;
      let { templateName } = request;

      // If template name provided, load template content
      if (request.templateName) {
        const templatePath = await this.templateService.findTemplate(
          request.templateName
        );
        if (templatePath) {
          const template =
            await this.templateService.loadTemplate(templatePath);
          const renderedTemplate = await this.templateService.renderTemplate(
            template,
            {}
          );
          promptText =
            renderedTemplate.files?.map(f => f.content).join('\n') || '';
          templateName = template.name;
        } else {
          return {
            success: false,
            originalPrompt: request.prompt,
            optimizedPrompt: '',
            metrics: {
              accuracyImprovement: 0,
              tokenReduction: 0,
              costReduction: 0,
              processingTime: 0,
            },
            qualityScores: { originalScore: 0, optimizedScore: 0 },
            error: `Template not found: ${request.templateName}`,
          };
        }
      }

      // Create template object for optimization
      const template: Template = {
        id: templateName || 'mcp-prompt',
        name: templateName || 'MCP Prompt',
        content: promptText,
        description: request.task || 'Prompt optimization via MCP',
      };

      // Run optimization
      const startTime = Date.now();
      const result = await this.optimizationService.optimizeTemplate({
        templateId: template.id || 'mcp-prompt',
        template,
        config: {
          task: request.task || 'Optimize this prompt for better performance',
          targetModel: request.model || 'gpt-4',
          mutateRefineIterations: request.iterations || 3,
          fewShotCount: request.examples || 5,
          generateReasoning: request.reasoning ?? true,
        },
      });

      // Score both original and optimized prompts
      const [originalScore, optimizedScore] = await Promise.all([
        this.client.scorePrompt(promptText, request.task),
        this.client.scorePrompt(
          result.optimizedTemplate.files
            ?.map(f => ('content' in f ? f.content : f.source) || '')
            .join('\n') || '',
          request.task
        ),
      ]);

      const processingTime = Date.now() - startTime;

      const response: MCPOptimizePromptResponse = {
        success: true,
        originalPrompt: promptText,
        optimizedPrompt:
          result.optimizedTemplate.files
            ?.map(f => ('content' in f ? f.content : f.source) || '')
            .join('\n') || '',
        metrics: {
          accuracyImprovement: result.metrics.accuracyImprovement,
          tokenReduction: result.metrics.tokenReduction,
          costReduction: result.comparison.improvements?.costSavings || 0,
          processingTime,
        },
        qualityScores: {
          originalScore: originalScore.overall,
          optimizedScore: optimizedScore.overall,
        },
      };

      // Add examples if optimization generated them
      if (result.optimizedTemplate.examples) {
        // Convert string[] to expected format
        response.examples = result.optimizedTemplate.examples.map(ex => ({
          input: ex,
          output: ex,
        }));
      }

      // Add reasoning if generated
      if (result.optimizedTemplate.reasoning) {
        response.reasoning = [result.optimizedTemplate.reasoning];
      }

      logger.info(
        `MCP: optimize_prompt completed successfully - ${result.metrics.accuracyImprovement}% improvement`
      );
      return response;
    } catch (error: unknown) {
      logger.error(
        `MCP: optimize_prompt failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        success: false,
        originalPrompt: request.prompt,
        optimizedPrompt: '',
        metrics: {
          accuracyImprovement: 0,
          tokenReduction: 0,
          costReduction: 0,
          processingTime: 0,
        },
        qualityScores: { originalScore: 0, optimizedScore: 0 },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * MCP Tool: Score a prompt for quality
   */
  async scorePrompt(
    request: MCPScorePromptRequest
  ): Promise<MCPScorePromptResponse> {
    logger.info('MCP: score_prompt called');

    try {
      let promptText = request.prompt;

      // If template name provided, load template content
      if (request.templateName) {
        const templatePath = await this.templateService.findTemplate(
          request.templateName
        );
        if (templatePath) {
          const template =
            await this.templateService.loadTemplate(templatePath);
          const renderedTemplate = await this.templateService.renderTemplate(
            template,
            {}
          );
          promptText =
            renderedTemplate.files?.map(f => f.content).join('\n') || '';
        } else {
          return {
            success: false,
            overallScore: 0,
            metrics: { clarity: 0, taskAlignment: 0, tokenEfficiency: 0 },
            suggestions: [],
            confidence: 0,
            error: `Template not found: ${request.templateName}`,
          };
        }
      }

      // Score the prompt
      const score = await this.client.scorePrompt(promptText, request.task);

      const response: MCPScorePromptResponse = {
        success: true,
        overallScore: score.overall,
        metrics: {
          clarity: score.metrics.clarity,
          taskAlignment: score.metrics.taskAlignment,
          tokenEfficiency: score.metrics.tokenEfficiency,
          exampleQuality: score.metrics.exampleQuality,
        },
        suggestions: score.suggestions,
        confidence: score.confidence,
      };

      logger.info(`MCP: score_prompt completed - score: ${score.overall}/100`);
      return response;
    } catch (error: unknown) {
      logger.error(
        `MCP: score_prompt failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        success: false,
        overallScore: 0,
        metrics: { clarity: 0, taskAlignment: 0, tokenEfficiency: 0 },
        suggestions: [],
        confidence: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * MCP Tool: Get improvement suggestions for a prompt
   */
  async suggestImprovements(request: MCPScorePromptRequest): Promise<{
    success: boolean;
    suggestions: Array<{
      category: string;
      suggestion: string;
      impact: 'low' | 'medium' | 'high';
      example?: string;
    }>;
    prioritizedActions: string[];
    estimatedImprovement: number;
    error?: string;
  }> {
    logger.info('MCP: suggest_improvements called');

    try {
      const scoreResult = await this.scorePrompt(request);

      if (!scoreResult.success) {
        return {
          success: false,
          suggestions: [],
          prioritizedActions: [],
          estimatedImprovement: 0,
          error: scoreResult.error,
        };
      }

      // Categorize suggestions with impact assessment
      const categorizedSuggestions = scoreResult.suggestions.map(suggestion => {
        let category = 'General';
        let impact: 'low' | 'medium' | 'high' = 'medium';

        if (
          suggestion.toLowerCase().includes('clarity') ||
          suggestion.toLowerCase().includes('specific')
        ) {
          category = 'Clarity';
          impact = 'high';
        } else if (
          suggestion.toLowerCase().includes('example') ||
          suggestion.toLowerCase().includes('format')
        ) {
          category = 'Examples';
          impact = 'medium';
        } else if (
          suggestion.toLowerCase().includes('context') ||
          suggestion.toLowerCase().includes('background')
        ) {
          category = 'Context';
          impact = 'high';
        } else if (
          suggestion.toLowerCase().includes('length') ||
          suggestion.toLowerCase().includes('concise')
        ) {
          category = 'Length';
          impact = 'medium';
        }

        return {
          category,
          suggestion,
          impact,
        };
      });

      // Prioritize actions based on current scores
      const prioritizedActions = [];

      if (scoreResult.metrics.clarity < 70) {
        prioritizedActions.push(
          'Improve clarity by being more specific and direct'
        );
      }

      if (scoreResult.metrics.taskAlignment < 70) {
        prioritizedActions.push(
          'Better align the prompt with the intended task'
        );
      }

      if (scoreResult.metrics.tokenEfficiency < 70) {
        prioritizedActions.push(
          'Optimize token usage by removing redundant information'
        );
      }

      if (scoreResult.overallScore < 60) {
        prioritizedActions.unshift(
          'Consider complete prompt restructuring for better results'
        );
      }

      // Estimate potential improvement
      const maxPossibleScore = 100;
      const currentScore = scoreResult.overallScore;
      const improvementPotential = (maxPossibleScore - currentScore) * 0.7; // Assume 70% of gap can be closed

      logger.info(
        `MCP: suggest_improvements completed - ${categorizedSuggestions.length} suggestions generated`
      );

      return {
        success: true,
        suggestions: categorizedSuggestions,
        prioritizedActions,
        estimatedImprovement: improvementPotential,
      };
    } catch (error: unknown) {
      logger.error(
        `MCP: suggest_improvements failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        success: false,
        suggestions: [],
        prioritizedActions: [],
        estimatedImprovement: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * MCP Tool: Batch optimize multiple prompts or templates
   */
  async batchOptimize(
    request: MCPBatchOptimizeRequest
  ): Promise<MCPBatchOptimizeResponse> {
    logger.info('MCP: batch_optimize called');

    try {
      const results: Array<{
        name: string;
        success: boolean;
        originalPrompt?: string;
        optimizedPrompt?: string;
        metrics?: {
          accuracyImprovement: number;
          tokenReduction: number;
        };
        error?: string;
      }> = [];

      let totalAccuracyImprovement = 0;
      let totalTokenReduction = 0;
      let totalProcessingTime = 0;
      let successCount = 0;

      const startTime = Date.now();

      // Process template names
      if (request.templateNames && request.templateNames.length > 0) {
        for (const templateName of request.templateNames) {
          try {
            const optimizeRequest: MCPOptimizePromptRequest = {
              prompt: '', // Will be loaded from template
              templateName,
              task: `Optimize template: ${templateName}`,
              model: request.config?.model as
                | 'gpt-4'
                | 'claude-3-opus'
                | 'claude-3-sonnet'
                | 'gemini-pro'
                | undefined,
              iterations: request.config?.iterations,
              examples: request.config?.examples,
              reasoning: request.config?.reasoning,
            };

            const result = await this.optimizePrompt(optimizeRequest);

            if (result.success) {
              results.push({
                name: templateName,
                success: true,
                originalPrompt: result.originalPrompt,
                optimizedPrompt: result.optimizedPrompt,
                metrics: {
                  accuracyImprovement: result.metrics.accuracyImprovement,
                  tokenReduction: result.metrics.tokenReduction,
                },
              });

              totalAccuracyImprovement += result.metrics.accuracyImprovement;
              totalTokenReduction += result.metrics.tokenReduction;
              successCount += 1;
            } else {
              results.push({
                name: templateName,
                success: false,
                error: result.error,
              });
            }
          } catch (error: unknown) {
            results.push({
              name: templateName,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Process direct prompts
      if (request.prompts && request.prompts.length > 0) {
        for (const promptData of request.prompts) {
          try {
            const optimizeRequest: MCPOptimizePromptRequest = {
              prompt: promptData.text,
              task: promptData.task,
              model: request.config?.model as
                | 'gpt-4'
                | 'claude-3-opus'
                | 'claude-3-sonnet'
                | 'gemini-pro'
                | undefined,
              iterations: request.config?.iterations,
              examples: request.config?.examples,
              reasoning: request.config?.reasoning,
            };

            const result = await this.optimizePrompt(optimizeRequest);

            if (result.success) {
              results.push({
                name: promptData.name || 'Direct Prompt',
                success: true,
                originalPrompt: result.originalPrompt,
                optimizedPrompt: result.optimizedPrompt,
                metrics: {
                  accuracyImprovement: result.metrics.accuracyImprovement,
                  tokenReduction: result.metrics.tokenReduction,
                },
              });

              totalAccuracyImprovement += result.metrics.accuracyImprovement;
              totalTokenReduction += result.metrics.tokenReduction;
              successCount += 1;
            } else {
              results.push({
                name: promptData.name || 'Direct Prompt',
                success: false,
                error: result.error,
              });
            }
          } catch (error: unknown) {
            results.push({
              name: promptData.name || 'Direct Prompt',
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      totalProcessingTime = Date.now() - startTime;
      const failedCount = results.length - successCount;

      const response: MCPBatchOptimizeResponse = {
        success: successCount > 0,
        optimized: successCount,
        failed: failedCount,
        results,
        summary: {
          avgAccuracyImprovement:
            successCount > 0 ? totalAccuracyImprovement / successCount : 0,
          avgTokenReduction:
            successCount > 0 ? totalTokenReduction / successCount : 0,
          totalProcessingTime,
        },
      };

      logger.info(
        `MCP: batch_optimize completed - ${successCount} optimized, ${failedCount} failed`
      );
      return response;
    } catch (error: unknown) {
      logger.error(
        `MCP: batch_optimize failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        success: false,
        optimized: 0,
        failed: 0,
        results: [],
        summary: {
          avgAccuracyImprovement: 0,
          avgTokenReduction: 0,
          totalProcessingTime: 0,
        },
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if PromptWizard service is available
   */
  async checkService(): Promise<{
    available: boolean;
    version?: string;
    capabilities?: string[];
    error?: string;
  }> {
    try {
      const isHealthy = await this.client.healthCheck();

      return {
        available: isHealthy,
        capabilities: [
          'prompt_optimization',
          'quality_scoring',
          'batch_processing',
          'improvement_suggestions',
        ],
      };
    } catch (error: unknown) {
      return {
        available: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

/**
 * MCP tool definitions for Claude Code integration
 */
export const MCPToolDefinitions = {
  optimize_prompt: {
    name: 'optimize_prompt',
    description:
      'Optimize a prompt using Microsoft PromptWizard for better performance and quality',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt text to optimize',
        },
        task: {
          type: 'string',
          description: 'Task description for optimization context (optional)',
        },
        model: {
          type: 'string',
          enum: ['gpt-4', 'claude-3-opus', 'claude-3-sonnet', 'gemini-pro'],
          description:
            'Target model for optimization (optional, default: gpt-4)',
        },
        iterations: {
          type: 'number',
          description: 'Number of refinement iterations (optional, default: 3)',
          minimum: 1,
          maximum: 10,
        },
        examples: {
          type: 'number',
          description:
            'Number of few-shot examples to generate (optional, default: 5)',
          minimum: 0,
          maximum: 20,
        },
        reasoning: {
          type: 'boolean',
          description:
            'Generate reasoning steps in optimized prompt (optional, default: true)',
        },
        templateName: {
          type: 'string',
          description:
            'Template name to optimize instead of direct prompt (optional)',
        },
      },
      required: ['prompt'],
    },
  },

  score_prompt: {
    name: 'score_prompt',
    description:
      'Score a prompt for quality using PromptWizard quality metrics',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt text to score',
        },
        task: {
          type: 'string',
          description: 'Task description for scoring context (optional)',
        },
        templateName: {
          type: 'string',
          description:
            'Template name to score instead of direct prompt (optional)',
        },
      },
      required: ['prompt'],
    },
  },

  suggest_improvements: {
    name: 'suggest_improvements',
    description: 'Get specific improvement suggestions for a prompt',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The prompt text to analyze',
        },
        task: {
          type: 'string',
          description: 'Task description for analysis context (optional)',
        },
        templateName: {
          type: 'string',
          description:
            'Template name to analyze instead of direct prompt (optional)',
        },
      },
      required: ['prompt'],
    },
  },

  batch_optimize: {
    name: 'batch_optimize',
    description: 'Optimize multiple prompts or templates in batch',
    inputSchema: {
      type: 'object',
      properties: {
        templateNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of template names to optimize (optional)',
        },
        prompts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              task: { type: 'string' },
              name: { type: 'string' },
            },
            required: ['text'],
          },
          description: 'Array of prompt objects to optimize (optional)',
        },
        config: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            iterations: { type: 'number' },
            examples: { type: 'number' },
            reasoning: { type: 'boolean' },
          },
          description: 'Optimization configuration (optional)',
        },
      },
    },
  },
};

export default MCPOptimizationTools;

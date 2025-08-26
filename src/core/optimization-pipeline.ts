/**
 * @fileoverview PromptWizard optimization pipeline with metadata extraction and result processing
 * @lastmodified 2025-08-26T15:00:00Z
 *
 * Features: Template metadata extraction, optimization request preparation, result processing
 * Main APIs: OptimizationPipeline.process(), extractMetadata(), processResults()
 * Constraints: Requires PromptWizard service connection and template service
 * Patterns: Pipeline pattern, strategy pattern for optimization types
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { Template } from '../types/index';
import { PromptOptimizationService } from '../services/prompt-optimization.service';
import { TemplateService } from '../services/template.service';
import { getPromptWizardConfig } from '../config/promptwizard.config';
import {
  OptimizationRequest,
  OptimizationResponse,
  OptimizationResult,
  OptimizationMetrics,
  OptimizationContext,
  PipelineStage,
  PipelineResult
} from '../integrations/promptwizard/types';

export interface TemplateMetadata {
  id: string;
  name: string;
  category: string;
  complexity: number;
  variables: Record<string, any>;
  dependencies: string[];
  estimatedTokens: number;
  language?: string;
  domain?: string;
  useCase?: string;
}

export interface OptimizationPipelineConfig {
  enablePreprocessing: boolean;
  enablePostprocessing: boolean;
  enableValidation: boolean;
  enableCaching: boolean;
  parallelProcessing: boolean;
  maxConcurrency: number;
  progressCallback?: (stage: PipelineStage, progress: number) => void;
}

export interface PipelineStageResult {
  stage: PipelineStage;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  metadata?: Record<string, any>;
}

export class OptimizationPipeline extends EventEmitter {
  private promptOptimizationService: PromptOptimizationService;
  private templateService: TemplateService;
  private config: OptimizationPipelineConfig;

  constructor(
    promptOptimizationService: PromptOptimizationService,
    templateService: TemplateService,
    config: Partial<OptimizationPipelineConfig> = {}
  ) {
    super();
    
    this.promptOptimizationService = promptOptimizationService;
    this.templateService = templateService;
    this.config = {
      enablePreprocessing: true,
      enablePostprocessing: true,
      enableValidation: true,
      enableCaching: true,
      parallelProcessing: false,
      maxConcurrency: 3,
      ...config
    };
  }

  /**
   * Process template optimization through the complete pipeline
   */
  async process(
    templateId: string,
    template: Template,
    optimizationRequest: Partial<OptimizationRequest> = {}
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const pipelineId = this.generatePipelineId();
    const results: PipelineStageResult[] = [];
    
    logger.info('Starting optimization pipeline', {
      pipelineId,
      templateId,
      template: template.name
    });

    this.emit('pipeline:started', { pipelineId, templateId });

    try {
      // Stage 1: Extract template metadata
      const metadataResult = await this.executeStage(
        'metadata_extraction',
        () => this.extractTemplateMetadata(template)
      );
      results.push(metadataResult);

      if (!metadataResult.success) {
        throw new Error(`Metadata extraction failed: ${metadataResult.error}`);
      }

      const metadata = metadataResult.data as TemplateMetadata;
      
      // Stage 2: Prepare optimization context
      const contextResult = await this.executeStage(
        'context_preparation',
        () => this.prepareOptimizationContext(template, metadata, optimizationRequest)
      );
      results.push(contextResult);

      if (!contextResult.success) {
        throw new Error(`Context preparation failed: ${contextResult.error}`);
      }

      const context = contextResult.data as OptimizationContext;

      // Stage 3: Pre-processing (if enabled)
      let preprocessedContext = context;
      if (this.config.enablePreprocessing) {
        const preprocessResult = await this.executeStage(
          'preprocessing',
          () => this.preprocessTemplate(template, context)
        );
        results.push(preprocessResult);

        if (preprocessResult.success) {
          preprocessedContext = preprocessResult.data as OptimizationContext;
        } else {
          logger.warn('Preprocessing failed, continuing with original context', {
            error: preprocessResult.error
          });
        }
      }

      // Stage 4: Generate training examples
      const examplesResult = await this.executeStage(
        'example_generation',
        () => this.generateTrainingExamples(template, metadata)
      );
      results.push(examplesResult);

      const examples = examplesResult.success ? examplesResult.data : [];

      // Stage 5: Build optimization request
      const optimizationRequestFinal = this.buildOptimizationRequest(
        template,
        preprocessedContext,
        examples,
        optimizationRequest
      );

      // Stage 6: Execute optimization
      const optimizationResult = await this.executeStage(
        'optimization',
        () => this.promptOptimizationService.optimizeTemplate({
          templateId,
          template: template as any,
          config: optimizationRequestFinal,
          options: {
            skipCache: !this.config.enableCaching,
            priority: 'normal'
          }
        })
      );
      results.push(optimizationResult);

      if (!optimizationResult.success) {
        throw new Error(`Optimization failed: ${optimizationResult.error}`);
      }

      const optimizationResponse = optimizationResult.data as OptimizationResult;

      // Stage 7: Post-processing (if enabled)
      let finalResult = optimizationResponse;
      if (this.config.enablePostprocessing) {
        const postprocessResult = await this.executeStage(
          'postprocessing',
          () => this.postprocessResults(optimizationResponse, metadata)
        );
        results.push(postprocessResult);

        if (postprocessResult.success) {
          finalResult = postprocessResult.data as OptimizationResult;
        }
      }

      // Stage 8: Validation (if enabled)
      if (this.config.enableValidation) {
        const validationResult = await this.executeStage(
          'validation',
          () => this.validateOptimizationResult(finalResult, template)
        );
        results.push(validationResult);

        if (!validationResult.success) {
          logger.warn('Optimization validation failed', {
            error: validationResult.error
          });
        }
      }

      // Stage 9: Update template with optimization
      const updateResult = await this.executeStage(
        'template_update',
        () => this.updateTemplateWithOptimization(templateId, finalResult)
      );
      results.push(updateResult);

      const totalDuration = Date.now() - startTime;

      const pipelineResult: PipelineResult = {
        pipelineId,
        templateId,
        success: true,
        optimizationResult: finalResult,
        stages: results,
        metadata: {
          template: metadata,
          context: preprocessedContext,
          duration: totalDuration,
          stagesCompleted: results.filter(r => r.success).length,
          totalStages: results.length
        }
      };

      logger.info('Optimization pipeline completed successfully', {
        pipelineId,
        duration: totalDuration,
        stagesCompleted: results.filter(r => r.success).length
      });

      this.emit('pipeline:completed', pipelineResult);
      return pipelineResult;

    } catch (error) {
      const totalDuration = Date.now() - startTime;
      
      const pipelineResult: PipelineResult = {
        pipelineId,
        templateId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stages: results,
        metadata: {
          duration: totalDuration,
          stagesCompleted: results.filter(r => r.success).length,
          totalStages: results.length
        }
      };

      logger.error('Optimization pipeline failed', {
        pipelineId,
        error: pipelineResult.error,
        duration: totalDuration
      });

      this.emit('pipeline:failed', pipelineResult);
      return pipelineResult;
    }
  }

  /**
   * Execute a pipeline stage with timing and error handling
   */
  private async executeStage<T>(
    stage: PipelineStage,
    executor: () => Promise<T>
  ): Promise<PipelineStageResult> {
    const startTime = Date.now();
    
    try {
      logger.debug(`Executing pipeline stage: ${stage}`);
      this.emit('stage:started', { stage });
      
      if (this.config.progressCallback) {
        this.config.progressCallback(stage, 0);
      }

      const result = await executor();
      const duration = Date.now() - startTime;

      if (this.config.progressCallback) {
        this.config.progressCallback(stage, 100);
      }

      const stageResult: PipelineStageResult = {
        stage,
        success: true,
        data: result,
        duration
      };

      logger.debug(`Pipeline stage completed: ${stage}`, { duration });
      this.emit('stage:completed', stageResult);
      
      return stageResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const stageResult: PipelineStageResult = {
        stage,
        success: false,
        error: errorMessage,
        duration
      };

      logger.error(`Pipeline stage failed: ${stage}`, { error: errorMessage, duration });
      this.emit('stage:failed', stageResult);
      
      return stageResult;
    }
  }

  /**
   * Extract metadata from template
   */
  private async extractTemplateMetadata(template: Template): Promise<TemplateMetadata> {
    // Calculate template complexity based on various factors
    const complexity = this.calculateTemplateComplexity(template);
    
    // Estimate token count
    const estimatedTokens = this.estimateTokenCount(template.content);
    
    // Extract variables
    const variables = template.variables || {};
    
    // Extract dependencies (templates referenced via includes)
    const dependencies = this.extractTemplateDependencies(template.content);

    return {
      id: template.id,
      name: template.name,
      category: template.category || 'general',
      complexity,
      variables,
      dependencies,
      estimatedTokens,
      language: template.language || 'en',
      domain: template.domain,
      useCase: template.useCase
    };
  }

  /**
   * Calculate template complexity score
   */
  private calculateTemplateComplexity(template: Template): number {
    let complexity = 0;
    
    // Base complexity from content length
    complexity += Math.min(template.content.length / 1000, 5);
    
    // Complexity from variables
    const variableCount = Object.keys(template.variables || {}).length;
    complexity += variableCount * 0.5;
    
    // Complexity from conditional logic
    const conditionalMatches = template.content.match(/\{\{#if|\{\{#unless|\{\{#each/g);
    complexity += (conditionalMatches?.length || 0) * 1.0;
    
    // Complexity from includes/partials
    const includeMatches = template.content.match(/\{\{>\s*\w+/g);
    complexity += (includeMatches?.length || 0) * 0.8;
    
    return Math.min(complexity, 10); // Cap at 10
  }

  /**
   * Estimate token count for template content
   */
  private estimateTokenCount(content: string): number {
    // Rough estimation: ~4 characters per token on average
    return Math.ceil(content.length / 4);
  }

  /**
   * Extract template dependencies from includes
   */
  private extractTemplateDependencies(content: string): string[] {
    const includeMatches = content.match(/\{\{>\s*(\w+)/g);
    if (!includeMatches) return [];
    
    return includeMatches.map(match => {
      const partialName = match.replace(/\{\{>\s*/, '');
      return partialName;
    });
  }

  /**
   * Prepare optimization context
   */
  private async prepareOptimizationContext(
    template: Template,
    metadata: TemplateMetadata,
    request: Partial<OptimizationRequest>
  ): Promise<OptimizationContext> {
    const promptwizardConfig = getPromptWizardConfig();
    
    return {
      templateId: template.id,
      originalPrompt: template.content,
      targetModel: request.targetModel || promptwizardConfig.optimization.defaultModel,
      task: template.description || 'General purpose prompt optimization',
      constraints: {
        maxLength: promptwizardConfig.optimization.maxPromptLength,
        preserveVariables: true,
        maintainStructure: true,
        ...request.constraints
      },
      metadata: {
        complexity: metadata.complexity,
        estimatedTokens: metadata.estimatedTokens,
        category: metadata.category,
        variables: Object.keys(metadata.variables),
        dependencies: metadata.dependencies
      }
    };
  }

  /**
   * Preprocess template before optimization
   */
  private async preprocessTemplate(
    template: Template,
    context: OptimizationContext
  ): Promise<OptimizationContext> {
    // Apply preprocessing transformations
    let processedContent = context.originalPrompt;
    
    // Normalize whitespace
    processedContent = processedContent.replace(/\s+/g, ' ').trim();
    
    // Extract and preserve variable placeholders
    const variables = processedContent.match(/\{\{[^}]+\}\}/g) || [];
    const variableMap = new Map();
    variables.forEach((variable, index) => {
      const placeholder = `__VAR_${index}__`;
      variableMap.set(placeholder, variable);
      processedContent = processedContent.replace(variable, placeholder);
    });
    
    return {
      ...context,
      originalPrompt: processedContent,
      metadata: {
        ...context.metadata,
        variableMap: Object.fromEntries(variableMap)
      }
    };
  }

  /**
   * Generate training examples for optimization
   */
  private async generateTrainingExamples(
    template: Template,
    metadata: TemplateMetadata
  ): Promise<string[]> {
    const examples: string[] = [];
    const promptwizardConfig = getPromptWizardConfig();
    const maxExamples = promptwizardConfig.optimization.fewShotCount;
    
    // Generate examples based on template category and use case
    if (template.category === 'coding') {
      examples.push(
        'Write a Python function that calculates the factorial of a number.',
        'Create a React component for user authentication.',
        'Implement a binary search algorithm in JavaScript.'
      );
    } else if (template.category === 'analysis') {
      examples.push(
        'Analyze the sentiment of customer reviews.',
        'Compare the performance of two marketing campaigns.',
        'Summarize the key findings from a research paper.'
      );
    } else {
      // General examples
      examples.push(
        'Provide a detailed explanation of the topic.',
        'Generate creative content based on the requirements.',
        'Solve the problem step by step with clear reasoning.'
      );
    }
    
    return examples.slice(0, maxExamples);
  }

  /**
   * Build final optimization request
   */
  private buildOptimizationRequest(
    template: Template,
    context: OptimizationContext,
    examples: string[],
    request: Partial<OptimizationRequest>
  ): OptimizationRequest {
    const promptwizardConfig = getPromptWizardConfig();
    
    return {
      task: context.task,
      prompt: context.originalPrompt,
      targetModel: context.targetModel,
      mutateRefineIterations: request.mutateRefineIterations || promptwizardConfig.optimization.mutateRefineIterations,
      fewShotCount: examples.length,
      generateReasoning: request.generateReasoning ?? promptwizardConfig.optimization.generateReasoning,
      examples,
      constraints: context.constraints || {}
    };
  }

  /**
   * Post-process optimization results
   */
  private async postprocessResults(
    result: OptimizationResult,
    metadata: TemplateMetadata
  ): Promise<OptimizationResult> {
    let processedContent = result.optimizedTemplate.content;
    
    // Restore variable placeholders if they were preserved during preprocessing
    if (result.optimizedTemplate.metadata?.variableMap) {
      const variableMap = result.optimizedTemplate.metadata.variableMap;
      Object.entries(variableMap).forEach(([placeholder, originalVariable]) => {
        processedContent = processedContent.replace(
          new RegExp(placeholder, 'g'),
          originalVariable as string
        );
      });
    }
    
    // Update metrics with additional information
    const enhancedMetrics: OptimizationMetrics = {
      ...result.metrics,
      originalComplexity: metadata.complexity,
      originalTokens: metadata.estimatedTokens,
      optimizedTokens: this.estimateTokenCount(processedContent),
      complexityReduction: Math.max(0, metadata.complexity - this.calculateTemplateComplexity({
        ...result.optimizedTemplate,
        content: processedContent
      } as Template))
    };
    
    return {
      ...result,
      optimizedTemplate: {
        ...result.optimizedTemplate,
        content: processedContent
      },
      metrics: enhancedMetrics
    };
  }

  /**
   * Validate optimization result
   */
  private async validateOptimizationResult(
    result: OptimizationResult,
    originalTemplate: Template
  ): Promise<boolean> {
    // Check if optimization actually improved the template
    if (result.metrics.accuracyImprovement <= 0 && result.metrics.tokenReduction <= 0) {
      throw new Error('Optimization did not show improvements');
    }
    
    // Validate that essential variables are preserved
    const originalVariables = originalTemplate.content.match(/\{\{[^}]+\}\}/g) || [];
    const optimizedVariables = result.optimizedTemplate.content.match(/\{\{[^}]+\}\}/g) || [];
    
    const missingVariables = originalVariables.filter(variable => 
      !optimizedVariables.includes(variable)
    );
    
    if (missingVariables.length > 0) {
      logger.warn('Some variables may have been lost during optimization', {
        missingVariables
      });
    }
    
    // Check minimum confidence threshold
    const promptwizardConfig = getPromptWizardConfig();
    if (result.confidence && result.confidence < promptwizardConfig.optimization.minConfidence) {
      throw new Error(`Optimization confidence ${result.confidence} below threshold ${promptwizardConfig.optimization.minConfidence}`);
    }
    
    return true;
  }

  /**
   * Update template with optimization results
   */
  private async updateTemplateWithOptimization(
    templateId: string,
    result: OptimizationResult
  ): Promise<boolean> {
    try {
      // Create optimized version alongside original
      const optimizedTemplate = {
        ...result.optimizedTemplate,
        id: `${templateId}_optimized`,
        name: `${result.optimizedTemplate.name} (Optimized)`,
        metadata: {
          ...result.optimizedTemplate.metadata,
          originalId: templateId,
          optimizationDate: new Date().toISOString(),
          optimizationMetrics: result.metrics
        }
      };
      
      // Save optimized version
      await this.templateService.save(optimizedTemplate as any);
      
      logger.info('Template optimization results saved', {
        originalId: templateId,
        optimizedId: optimizedTemplate.id,
        metrics: result.metrics
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to save optimization results', {
        templateId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Generate unique pipeline ID
   */
  private generatePipelineId(): string {
    return `pipeline_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
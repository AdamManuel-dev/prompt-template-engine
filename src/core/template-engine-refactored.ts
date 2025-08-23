/**
 * @fileoverview Refactored template engine using composition pattern
 * @lastmodified 2025-08-22T21:30:00Z
 *
 * Features: Template rendering with modular processors
 * Main APIs: render(), renderSync()
 * Constraints: Maintains backward compatibility
 * Patterns: Composition over inheritance, processor pipeline
 */

import { TemplateContext } from '../types';
import { VariableProcessor } from './processors/variable-processor';
import { ConditionalProcessor } from './processors/conditional-processor';
import { LoopProcessor } from './processors/loop-processor';
import { IncludeProcessor } from './processors/include-processor';
import { TemplateHelpers } from './template-helpers';
import { TemplatePartials } from './template-partials';
import { TemplateTransforms } from './template-transforms';
import { logger } from '../utils/logger';

export class TemplateEngineRefactored {
  private variableProcessor: VariableProcessor;

  private conditionalProcessor: ConditionalProcessor;

  private loopProcessor: LoopProcessor;

  private includeProcessor: IncludeProcessor;

  private helpers: TemplateHelpers;

  private partials: TemplatePartials;

  private transforms: TemplateTransforms;

  constructor(options?: {
    basePath?: string;
    helpers?: TemplateHelpers;
    partials?: TemplatePartials;
    transforms?: TemplateTransforms;
  }) {
    this.variableProcessor = new VariableProcessor();
    this.conditionalProcessor = new ConditionalProcessor();
    this.loopProcessor = new LoopProcessor(
      this.conditionalProcessor,
      this.variableProcessor
    );
    this.includeProcessor = new IncludeProcessor(options?.basePath);
    this.helpers = options?.helpers || new TemplateHelpers();
    this.partials = options?.partials || new TemplatePartials();
    this.transforms = options?.transforms || new TemplateTransforms();
  }

  /**
   * Render a template string with variables
   */
  async render(template: string, context: TemplateContext): Promise<string> {
    try {
      // Reset state for new render
      this.includeProcessor.reset();

      // Process includes first (async)
      let processed = await this.includeProcessor.processIncludes(
        template,
        context
      );

      // Process conditionals
      processed = this.conditionalProcessor.processConditionalBlocks(
        processed,
        context
      );

      // Process loops
      processed = this.loopProcessor.processEachBlocks(processed, context);

      // Process partials
      processed = this.processPartials(processed, context);

      // Process helpers
      processed = this.processHelpers(processed, context);

      // Process transforms
      processed = this.processTransforms(processed, context);

      // Finally process variables
      return this.variableProcessor.processVariables(processed, context);
    } catch (error) {
      logger.error(
        `Template rendering failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Synchronous render (without includes)
   */
  renderSync(template: string, context: TemplateContext): string {
    // Process conditionals
    let processed = this.conditionalProcessor.processConditionalBlocks(
      template,
      context
    );

    // Process loops
    processed = this.loopProcessor.processEachBlocks(processed, context);

    // Process partials
    processed = this.processPartials(processed, context);

    // Process helpers
    processed = this.processHelpers(processed, context);

    // Process transforms
    processed = this.processTransforms(processed, context);

    // Finally process variables
    return this.variableProcessor.processVariables(processed, context);
  }

  /**
   * Process partials in template
   */
  private processPartials(template: string, context: TemplateContext): string {
    return this.partials.process(template, {
      ...context.variables,
      ...context.metadata,
      ...context.environment,
    });
  }

  /**
   * Process helper functions
   */
  private processHelpers(template: string, context: TemplateContext): string {
    const helperPattern = /\{\{(\w+)\s*\((.*?)\)\}\}/g;

    return template.replace(helperPattern, (match, helperName, args) => {
      if (!this.helpers.has(helperName)) {
        return match;
      }

      try {
        const parsedArgs = this.parseHelperArgs(args, context);
        const result = this.helpers.execute(helperName, parsedArgs);
        return String(result);
      } catch (error) {
        logger.error(
          `Helper ${helperName} failed: ${error instanceof Error ? error.message : String(error)}`
        );
        return match;
      }
    });
  }

  /**
   * Process variable transforms
   */
  private processTransforms(
    template: string,
    context: TemplateContext
  ): string {
    const transformPattern = /\{\{([^|}]+\|[^}]+)\}\}/g;

    return template.replace(transformPattern, (match, expression) => {
      const parts = expression.split('|').map((p: string) => p.trim());
      if (parts.length < 2) return match;

      let value = this.variableProcessor.resolveVariable(parts[0], context);

      for (let i = 1; i < parts.length; i++) {
        const transform = parts[i];
        if (this.transforms.has(transform)) {
          value = this.transforms.apply(transform, value);
        }
      }

      return String(value);
    });
  }

  /**
   * Parse helper arguments
   */
  private parseHelperArgs(argsString: string, context: TemplateContext): any[] {
    if (!argsString.trim()) return [];

    const args: any[] = [];
    const parts = argsString.split(',');

    for (const part of parts) {
      const trimmed = part.trim();

      // Handle string literals
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        args.push(trimmed.slice(1, -1));
      }
      // Handle number literals
      else if (!Number.isNaN(Number(trimmed))) {
        args.push(Number(trimmed));
      }
      // Handle boolean literals
      else if (trimmed === 'true' || trimmed === 'false') {
        args.push(trimmed === 'true');
      }
      // Handle variable references
      else {
        args.push(this.variableProcessor.resolveVariable(trimmed, context));
      }
    }

    return args;
  }

  /**
   * Check if value is truthy (exposed for compatibility)
   */
  isTruthy(value: unknown): boolean {
    return this.conditionalProcessor.isTruthy(value);
  }

  /**
   * Extract variables from template (exposed for compatibility)
   */
  extractVariables(template: string): string[] {
    return this.variableProcessor.extractSimpleVariables(template);
  }
}

/**
 * @fileoverview Refactored template engine using composition pattern - main orchestrator for template processing
 * @lastmodified 2025-08-26T11:10:32Z
 *
 * Features: Template rendering with modular processors, async includes, helpers, partials, and transforms
 * Main APIs: render(), renderSync(), extractVariables(), isTruthy()
 * Constraints: Maintains backward compatibility, deterministic processing order, error handling
 * Patterns: Composition over inheritance, processor pipeline, dependency injection, async processing
 * Performance: Pipeline optimization with minimal passes, async include processing
 * Error Handling: Graceful degradation, detailed error logging, processor isolation
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

/**
 * Refactored template engine that orchestrates multiple processors in a deterministic pipeline.
 * Uses composition pattern to combine variable resolution, conditionals, loops, includes, helpers, and transforms.
 * Provides both async and synchronous rendering capabilities.
 *
 * @example
 * ```typescript
 * const engine = new TemplateEngineRefactored({
 *   basePath: './templates',
 *   helpers: customHelpers,
 *   partials: customPartials
 * });
 *
 * const template = `
 *   {{>header}}
 *   {{#if user}}
 *     Welcome {{user.name}}!
 *     {{#each user.notifications}}
 *       <div class="{{type}}">{{message | capitalize}}</div>
 *     {{/each}}
 *   {{/if}}
 *   {{>footer}}
 * `;
 *
 * const result = await engine.render(template, {
 *   variables: {
 *     user: {
 *       name: "Alice",
 *       notifications: [{type: "info", message: "welcome back"}]
 *     }
 *   }
 * });
 * ```
 */
export class TemplateEngineRefactored {
  private variableProcessor: VariableProcessor;

  private conditionalProcessor: ConditionalProcessor;

  private loopProcessor: LoopProcessor;

  private includeProcessor: IncludeProcessor;

  private helpers: TemplateHelpers;

  private partials: TemplatePartials;

  private transforms: TemplateTransforms;

  /**
   * Creates a new template engine with configurable processors and options.
   *
   * @param options - Configuration options for the template engine
   * @param options.basePath - Base path for template includes (default: current directory)
   * @param options.helpers - Custom helper functions for template processing
   * @param options.partials - Custom partial templates for reuse
   * @param options.transforms - Custom value transformation functions
   *
   * @example
   * ```typescript
   * const engine = new TemplateEngineRefactored({
   *   basePath: './src/templates',
   *   helpers: new CustomHelpers(),
   *   partials: new CustomPartials()
   * });
   * ```
   */
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
   * Renders a template string asynchronously with full feature support including file includes.
   * Processes template through a deterministic pipeline: includes → conditionals → loops → partials → helpers → transforms → variables.
   *
   * @param template - Template string to render
   * @param context - Template context containing variables, metadata, and environment
   * @returns Promise resolving to fully rendered template string
   *
   * @example
   * ```typescript
   * const template = `
   *   {{include "header.hbs"}}
   *   {{#if showContent}}
   *     {{#each items}}
   *       {{name | uppercase}} ({{@index}})
   *     {{/each}}
   *   {{/if}}
   * `;
   *
   * const result = await engine.render(template, {
   *   variables: {
   *     showContent: true,
   *     items: [{name: "apple"}, {name: "banana"}]
   *   }
   * });
   * ```
   *
   * @throws {Error} When template processing fails or includes cannot be resolved
   * @see {@link renderSync} for synchronous rendering without includes
   * @see {@link processPartials} for partial template processing
   * @see {@link processHelpers} for helper function processing
   * @see {@link processTransforms} for value transformation processing
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
   * Renders a template string synchronously without file include support.
   * Faster than async render but cannot process {{include}} directives.
   * Uses the same pipeline as async render except for includes.
   *
   * @param template - Template string to render
   * @param context - Template context containing variables, metadata, and environment
   * @returns Fully rendered template string
   *
   * @example
   * ```typescript
   * const template = "{{#if user}}Hello {{user.name}}!{{/if}}";
   * const result = engine.renderSync(template, {
   *   variables: { user: { name: "World" } }
   * });
   * // Returns: "Hello World!"
   * ```
   *
   * @see {@link render} for async rendering with include support
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
   * Processes partial template inclusions using {{>partialName}} syntax.
   * Partials are pre-registered template fragments that can be reused across templates.
   *
   * @param template - Template string containing partial references
   * @param context - Template context for partial rendering
   * @returns Template with partials expanded and rendered
   *
   * @example
   * ```typescript
   * // Template: "{{>userCard user}}"
   * // Partial "userCard": "<div>{{name}} ({{email}})</div>"
   * // Result: "<div>John (john@example.com)</div>"
   * ```
   *
   * @private
   * @see {@link render} for usage in the processing pipeline
   */
  private processPartials(template: string, context: TemplateContext): string {
    return this.partials.process(template, {
      ...context.variables,
      ...context.metadata,
      ...context.environment,
    });
  }

  /**
   * Processes helper function calls using {{helperName(arg1, arg2, ...)}} syntax.
   * Helpers are registered functions that can perform complex logic and formatting.
   *
   * @param template - Template string containing helper function calls
   * @param context - Template context for argument resolution
   * @returns Template with helper functions executed and replaced with results
   *
   * @example
   * ```typescript
   * // Template: "{{formatDate(user.createdAt, 'YYYY-MM-DD')}}"
   * // Helper: formatDate(date, format) => moment(date).format(format)
   * // Result: "2023-12-25"
   * ```
   *
   * @throws {Error} When helper execution fails
   * @private
   * @see {@link parseHelperArgs} for argument parsing logic
   * @see {@link render} for usage in the processing pipeline
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
   * Processes variable transformations using {{variable | transform1 | transform2}} syntax.
   * Transforms are chainable functions that modify variable values during rendering.
   *
   * @param template - Template string containing variable transformations
   * @param context - Template context for variable resolution
   * @returns Template with transformations applied to variables
   *
   * @example
   * ```typescript
   * // Template: "{{user.name | lowercase | capitalize}}"
   * // Transforms: lowercase("JOHN") => "john", capitalize("john") => "John"
   * // Result: "John"
   * ```
   *
   * @private
   * @see {@link render} for usage in the processing pipeline
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
   * Parses helper function arguments from string format to typed values.
   * Supports string literals, numbers, booleans, and variable references.
   *
   * @param argsString - Comma-separated argument string from helper call
   * @param context - Template context for variable resolution
   * @returns Array of parsed and resolved argument values
   *
   * @example
   * ```typescript
   * // Input: '"hello", 42, true, user.name'
   * // Output: ["hello", 42, true, "John"]
   *
   * // Handles various types:
   * // - String literals: "text" or 'text'
   * // - Numbers: 42, 3.14
   * // - Booleans: true, false
   * // - Variables: user.name, items[0]
   * ```
   *
   * @private
   * @see {@link processHelpers} for usage in helper execution
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
   * Checks if a value should be considered truthy in template conditions.
   * Delegates to the conditional processor for consistent truthiness evaluation.
   * Exposed as public API for external usage and backward compatibility.
   *
   * @param value - Value to evaluate for truthiness
   * @returns True if value should be considered truthy, false otherwise
   *
   * @example
   * ```typescript
   * engine.isTruthy("hello")    // true
   * engine.isTruthy([])         // false (empty array)
   * engine.isTruthy({})         // false (empty object)
   * engine.isTruthy(0)          // false
   * ```
   *
   * @see {@link ConditionalProcessor.isTruthy} for implementation details
   */
  isTruthy(value: unknown): boolean {
    return this.conditionalProcessor.isTruthy(value);
  }

  /**
   * Extracts all variable names from a template string for analysis or validation.
   * Delegates to the variable processor to maintain consistency.
   * Exposed as public API for external usage and backward compatibility.
   *
   * @param template - Template string to analyze
   * @returns Array of unique variable names found in the template
   *
   * @example
   * ```typescript
   * const template = "Hello {{user.name}}, you have {{count}} messages";
   * const variables = engine.extractVariables(template);
   * // Returns: ["user.name", "count"]
   * ```
   *
   * @see {@link VariableProcessor.extractSimpleVariables} for implementation details
   */
  extractVariables(template: string): string[] {
    return this.variableProcessor.extractSimpleVariables(template);
  }
}

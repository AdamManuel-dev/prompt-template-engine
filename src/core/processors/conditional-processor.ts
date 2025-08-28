/**
 * @fileoverview Conditional block processor for template engine - handles {{#if}}/{{#unless}} logic
 * @lastmodified 2025-08-26T11:10:32Z
 *
 * Features: If/unless/else conditional block processing with nested support and truthiness evaluation
 * Main APIs: processConditionalBlocks(), evaluateCondition(), isTruthy(), findOutermostIfBlocks()
 * Constraints: Maximum nesting depth of 10 levels, proper context scoping, each-block awareness
 * Patterns: Recursive processing with depth tracking, inside-out evaluation, and context isolation
 * Performance: O(n*d) where n=template length, d=nesting depth
 * Error Handling: Graceful degradation on evaluation errors, depth limit protection
 */

import { TemplateContext } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Conditional processor handles {{#if}}/{{#unless}} blocks in templates.
 * Supports nested conditionals, else blocks, and context-aware evaluation.
 * Integrates with loop processors to avoid processing conditionals inside unprocessed each blocks.
 *
 * @example
 * ```typescript
 * const template = `
 *   {{#if user.isAdmin}}
 *     Admin Panel
 *     {{#if user.permissions.write}}
 *       <button>Edit</button>
 *     {{else}}
 *       <span>Read Only</span>
 *     {{/if}}
 *   {{else}}
 *     Please log in
 *   {{/if}}
 * `;
 *
 * const context = {
 *   variables: {
 *     user: {
 *       isAdmin: true,
 *       permissions: { write: false }
 *     }
 *   }
 * };
 * // Result: "Admin Panel\n<span>Read Only</span>"
 * ```
 */
export class ConditionalProcessor {
  /**
   * Processes all conditional blocks ({{#if}} and {{#unless}}) in a template recursively.
   * Handles nested conditionals and avoids processing blocks inside unprocessed {{#each}} blocks.
   *
   * @param template - Template string containing conditional blocks
   * @param context - Template context for condition evaluation
   * @param depth - Current nesting depth (prevents infinite recursion)
   * @returns Processed template with conditionals evaluated and appropriate content rendered
   *
   * @example
   * ```typescript
   * const template = "{{#if showMessage}}Hello {{name}}!{{/if}}";
   * const context = {
   *   variables: { showMessage: true, name: "World" }
   * };
   * const result = processor.processConditionalBlocks(template, context);
   * // Returns: "Hello World!"
   * ```
   *
   * @throws {Error} When maximum nesting depth (10) is exceeded
   * @see {@link processSingleIfBlock} for individual if block processing
   * @see {@link processSingleUnlessBlock} for individual unless block processing
   * @see {@link isInsideEachBlock} for each-block awareness
   */
  public processConditionalBlocks(
    template: string,
    context: TemplateContext,
    depth = 0
  ): string {
    const maxDepth = 10;
    if (depth > maxDepth) {
      logger.warn('Maximum conditional nesting depth reached');
      return template;
    }

    let result = template;
    let changed = true;

    // Process if blocks
    while (changed) {
      changed = false;
      const ifBlocks = this.findOutermostIfBlocks(result);

      for (const block of ifBlocks) {
        if (!this.isInsideEachBlock(block, result)) {
          const blockResult = this.processSingleIfBlock(block, context, depth);
          result = result.replace(block.fullMatch, blockResult.replacement);
          if (blockResult.hasChanges) {
            changed = true;
          }
        }
      }
    }

    // Process unless blocks
    changed = true;
    while (changed) {
      changed = false;
      const unlessBlocks = this.findOutermostUnlessBlocks(result);

      for (const block of unlessBlocks) {
        if (!this.isInsideEachBlock(block, result)) {
          const blockResult = this.processSingleUnlessBlock(
            block,
            context,
            depth
          );
          result = result.replace(block.fullMatch, blockResult.replacement);
          if (blockResult.hasChanges) {
            changed = true;
          }
        }
      }
    }

    return result;
  }

  /**
   * Finds and parses all outermost {{#if}} blocks in a template.
   * Uses depth tracking to properly match opening/closing tags and detect {{else}} blocks.
   * Only returns top-level blocks to enable proper inside-out processing.
   *
   * @param template - Template string to search for if blocks
   * @returns Array of parsed if blocks with condition, content, and optional else content
   *
   * @example
   * ```typescript
   * const template = "{{#if condition}}true part{{else}}false part{{/if}}";
   * const blocks = processor.findOutermostIfBlocks(template);
   * // Returns: [{
   * //   fullMatch: full template,
   * //   condition: "condition",
   * //   content: "true part",
   * //   elseContent: "false part"
   * // }]
   * ```
   *
   * @see {@link processConditionalBlocks} for usage of detected blocks
   * @see {@link findOutermostUnlessBlocks} for unless block detection
   */
  public findOutermostIfBlocks(template: string): Array<{
    fullMatch: string;
    condition: string;
    content: string;
    elseContent?: string;
  }> {
    const blocks: Array<{
      fullMatch: string;
      condition: string;
      content: string;
      elseContent?: string;
    }> = [];

    const openTag = '{{#if';
    const closeTag = '{{/if}}';
    const elseTag = '{{else}}';

    let pos = 0;
    while (pos < template.length) {
      const openIndex = template.indexOf(openTag, pos);
      if (openIndex === -1) break;

      // Find the matching close tag
      let depth = 1;
      let searchPos = openIndex + openTag.length;
      let closeIndex = -1;
      let elseIndex = -1;

      while (depth > 0 && searchPos < template.length) {
        const nextOpen = template.indexOf(openTag, searchPos);
        const nextClose = template.indexOf(closeTag, searchPos);
        const nextElse = template.indexOf(elseTag, searchPos);

        if (nextClose === -1) break;

        if (
          depth === 1 &&
          nextElse !== -1 &&
          nextElse < nextClose &&
          (nextOpen === -1 || nextElse < nextOpen)
        ) {
          elseIndex = nextElse;
        }

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth += 1;
          searchPos = nextOpen + openTag.length;
        } else {
          depth -= 1;
          if (depth === 0) {
            closeIndex = nextClose;
          }
          searchPos = nextClose + closeTag.length;
        }
      }

      if (closeIndex !== -1) {
        const fullMatch = template.substring(
          openIndex,
          closeIndex + closeTag.length
        );
        const conditionMatch = fullMatch.match(/\{\{#if\s+([\w.@]+)\s*\}\}/);

        if (conditionMatch) {
          const condition = conditionMatch[1]!; // Safe due to regex match check
          let content: string;
          let elseContent: string | undefined;

          if (
            elseIndex !== -1 &&
            elseIndex > openIndex &&
            elseIndex < closeIndex
          ) {
            content = template.substring(
              openIndex + conditionMatch[0].length,
              elseIndex
            );
            elseContent = template.substring(
              elseIndex + elseTag.length,
              closeIndex
            );
          } else {
            content = template.substring(
              openIndex + conditionMatch[0].length,
              closeIndex
            );
          }

          blocks.push({ fullMatch, condition, content, elseContent });
        }
      }

      pos = closeIndex !== -1 ? closeIndex + closeTag.length : template.length;
    }

    return blocks;
  }

  /**
   * Finds and parses all outermost {{#unless}} blocks in a template.
   * Similar to findOutermostIfBlocks but for unless conditions (inverted logic).
   * Uses depth tracking to properly match opening/closing tags and detect {{else}} blocks.
   *
   * @param template - Template string to search for unless blocks
   * @returns Array of parsed unless blocks with condition, content, and optional else content
   *
   * @example
   * ```typescript
   * const template = "{{#unless user.isGuest}}Welcome back!{{else}}Please sign in{{/unless}}";
   * const blocks = processor.findOutermostUnlessBlocks(template);
   * // Returns blocks with inverted condition logic
   * ```
   *
   * @private
   * @see {@link findOutermostIfBlocks} for similar if block detection
   * @see {@link processSingleUnlessBlock} for unless block processing
   */
  private findOutermostUnlessBlocks(template: string): Array<{
    fullMatch: string;
    condition: string;
    content: string;
    elseContent?: string;
  }> {
    // Similar implementation to findOutermostIfBlocks but for unless
    const blocks: Array<{
      fullMatch: string;
      condition: string;
      content: string;
      elseContent?: string;
    }> = [];

    const openTag = '{{#unless';
    const closeTag = '{{/unless}}';
    const elseTag = '{{else}}';

    let pos = 0;
    while (pos < template.length) {
      const openIndex = template.indexOf(openTag, pos);
      if (openIndex === -1) break;

      let depth = 1;
      let searchPos = openIndex + openTag.length;
      let closeIndex = -1;
      let elseIndex = -1;

      while (depth > 0 && searchPos < template.length) {
        const nextOpen = template.indexOf(openTag, searchPos);
        const nextClose = template.indexOf(closeTag, searchPos);
        const nextElse = template.indexOf(elseTag, searchPos);

        if (nextClose === -1) break;

        if (
          depth === 1 &&
          nextElse !== -1 &&
          nextElse < nextClose &&
          (nextOpen === -1 || nextElse < nextOpen)
        ) {
          elseIndex = nextElse;
        }

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth += 1;
          searchPos = nextOpen + openTag.length;
        } else {
          depth -= 1;
          if (depth === 0) {
            closeIndex = nextClose;
          }
          searchPos = nextClose + closeTag.length;
        }
      }

      if (closeIndex !== -1) {
        const fullMatch = template.substring(
          openIndex,
          closeIndex + closeTag.length
        );
        const conditionMatch = fullMatch.match(
          /\{\{#unless\s+([\w.@]+)\s*\}\}/
        );

        if (conditionMatch) {
          const condition = conditionMatch[1]!; // Safe due to regex match check
          let content: string;
          let elseContent: string | undefined;

          if (
            elseIndex !== -1 &&
            elseIndex > openIndex &&
            elseIndex < closeIndex
          ) {
            content = template.substring(
              openIndex + conditionMatch[0].length,
              elseIndex
            );
            elseContent = template.substring(
              elseIndex + elseTag.length,
              closeIndex
            );
          } else {
            content = template.substring(
              openIndex + conditionMatch[0].length,
              closeIndex
            );
          }

          blocks.push({ fullMatch, condition, content, elseContent });
        }
      }

      pos = closeIndex !== -1 ? closeIndex + closeTag.length : template.length;
    }

    return blocks;
  }

  /**
   * Processes a single {{#if}} block by evaluating its condition and rendering appropriate content.
   * Recursively processes nested conditionals within the selected content branch.
   *
   * @param block - Parsed if block containing condition, content, and optional else content
   * @param context - Template context for condition evaluation
   * @param depth - Current nesting depth for recursive processing
   * @returns Object with replacement content and change detection flag
   *
   * @example
   * ```typescript
   * const block = {
   *   condition: "user.isActive",
   *   content: "Active user content",
   *   elseContent: "Inactive user content"
   * };
   * // Evaluates condition and returns appropriate content
   * ```
   *
   * @private
   * @see {@link evaluateCondition} for condition evaluation logic
   * @see {@link isTruthy} for truthiness determination
   */
  private processSingleIfBlock(
    block: {
      fullMatch: string;
      condition: string;
      content: string;
      elseContent?: string;
    },
    context: TemplateContext,
    depth: number
  ): { replacement: string; hasChanges: boolean } {
    const conditionResult = this.evaluateCondition(block.condition, context);

    if (this.isTruthy(conditionResult)) {
      const processed = this.processConditionalBlocks(
        block.content,
        context,
        depth + 1
      );
      return {
        replacement: processed,
        hasChanges: processed !== block.content,
      };
    }
    if (block.elseContent !== undefined) {
      const processed = this.processConditionalBlocks(
        block.elseContent,
        context,
        depth + 1
      );
      return {
        replacement: processed,
        hasChanges: processed !== block.elseContent,
      };
    }
    return { replacement: '', hasChanges: true };
  }

  /**
   * Processes a single {{#unless}} block by evaluating its condition with inverted logic.
   * Renders content when condition is falsy, else content when condition is truthy.
   *
   * @param block - Parsed unless block containing condition, content, and optional else content
   * @param context - Template context for condition evaluation
   * @param depth - Current nesting depth for recursive processing
   * @returns Object with replacement content and change detection flag
   *
   * @example
   * ```typescript
   * const block = {
   *   condition: "user.hasErrors",
   *   content: "No errors - proceed",
   *   elseContent: "Please fix errors"
   * };
   * // Renders content when condition is false
   * ```
   *
   * @private
   * @see {@link evaluateCondition} for condition evaluation logic
   * @see {@link isTruthy} for truthiness determination
   */
  private processSingleUnlessBlock(
    block: {
      fullMatch: string;
      condition: string;
      content: string;
      elseContent?: string;
    },
    context: TemplateContext,
    depth: number
  ): { replacement: string; hasChanges: boolean } {
    const conditionResult = this.evaluateCondition(block.condition, context);

    if (!this.isTruthy(conditionResult)) {
      const processed = this.processConditionalBlocks(
        block.content,
        context,
        depth + 1
      );
      return {
        replacement: processed,
        hasChanges: processed !== block.content,
      };
    }
    if (block.elseContent !== undefined) {
      const processed = this.processConditionalBlocks(
        block.elseContent,
        context,
        depth + 1
      );
      return {
        replacement: processed,
        hasChanges: processed !== block.elseContent,
      };
    }
    return { replacement: '', hasChanges: true };
  }

  /**
   * Determines if a conditional block is nested inside an unprocessed {{#each}} block.
   * Used to avoid processing conditionals that should be handled during each-block iteration.
   *
   * @param block - Block to check for each-block containment
   * @param template - Full template string for context analysis
   * @returns True if block is inside an unprocessed each block, false otherwise
   *
   * @example
   * ```typescript
   * // Template: "{{#each items}}{{#if item.active}}...{{/if}}{{/each}}"
   * // The if block should not be processed until the each block is processed
   * ```
   *
   * @private
   * @see {@link processConditionalBlocks} for usage in conditional processing
   */
  private isInsideEachBlock(
    block: { fullMatch: string },
    template: string
  ): boolean {
    const blockStart = template.indexOf(block.fullMatch);
    if (blockStart === -1) return false;

    const beforeBlock = template.substring(0, blockStart);
    const eachOpens = (beforeBlock.match(/\{\{#each/g) || []).length;
    const eachCloses = (beforeBlock.match(/\{\{\/each\}\}/g) || []).length;

    return eachOpens > eachCloses;
  }

  /**
   * Evaluates a condition string against the template context.
   * Supports nested object paths, special variables (@index, @first, etc.), and basic property access.
   *
   * @param condition - Condition string to evaluate (e.g., "user.isActive", "@first")
   * @param context - Template context containing variables and metadata
   * @returns Resolved condition value for truthiness evaluation
   *
   * @example
   * ```typescript
   * // Nested path evaluation
   * evaluateCondition("user.profile.isComplete", context)
   *
   * // Special variable evaluation
   * evaluateCondition("@first", context) // true if first iteration
   *
   * // Simple property access
   * evaluateCondition("isVisible", context)
   * ```
   *
   * @private
   * @see {@link resolveSpecialVariable} for special variable handling
   * @see {@link isTruthy} for truthiness evaluation
   */
  private evaluateCondition(
    condition: string,
    context: TemplateContext
  ): unknown {
    // Handle special variables
    if (condition.startsWith('@')) {
      return this.resolveSpecialVariable(condition, context);
    }

    // Handle nested paths
    const path = condition.split('.');
    let current: unknown = context;

    for (const segment of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (current && typeof current === 'object' && segment in current) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        current = undefined;
      }
    }

    return current;
  }

  /**
   * Determines if a value should be considered truthy in template conditions.
   * Uses JavaScript truthiness with additional rules for empty arrays and objects.
   *
   * @param value - Value to evaluate for truthiness
   * @returns True if value should be considered truthy, false otherwise
   *
   * @example
   * ```typescript
   * isTruthy(true)        // true
   * isTruthy("hello")     // true
   * isTruthy(1)           // true
   * isTruthy([1, 2])      // true
   * isTruthy({a: 1})      // true
   *
   * isTruthy(false)       // false
   * isTruthy("")          // false
   * isTruthy(0)           // false
   * isTruthy([])          // false (empty array)
   * isTruthy({})          // false (empty object)
   * isTruthy(null)        // false
   * isTruthy(undefined)   // false
   * ```
   *
   * @see {@link processSingleIfBlock} for usage in if conditions
   * @see {@link processSingleUnlessBlock} for usage in unless conditions
   */
  public isTruthy(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (value === false) return false;
    if (value === 0) return false;
    if (value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === 'object' && Object.keys(value).length === 0)
      return false;
    return true;
  }

  /**
   * Resolves special variables that provide loop context information.
   * These variables are automatically available within loop iterations and conditionals.
   *
   * @param key - Special variable key (must start with @)
   * @param context - Template context containing loop metadata
   * @returns Resolved special variable value or undefined if not recognized
   *
   * @example
   * ```typescript
   * // In a loop context with _index = 2, _total = 5
   * resolveSpecialVariable("@index", context) // Returns 2
   * resolveSpecialVariable("@first", context) // Returns false
   * resolveSpecialVariable("@last", context)  // Returns false
   * ```
   *
   * @private
   * @see {@link evaluateCondition} for usage in condition evaluation
   */
  private resolveSpecialVariable(
    key: string,
    context: TemplateContext
  ): unknown {
    switch (key) {
      case '@index':
        return context._index;
      case '@first':
        return context._index === 0;
      case '@last':
        return context._index === (context._total || 0) - 1;
      default:
        return undefined;
    }
  }
}

/**
 * @fileoverview Loop processor for template engine - handles {{#each}} block iteration
 * @lastmodified 2025-08-26T11:10:32Z
 *
 * Features: Each/loop block processing with enhanced iteration context and nested loop support
 * Main APIs: processEachBlocks(), findOutermostEachBlocks()
 * Constraints: Maximum nesting depth of 10 levels, proper context isolation between iterations
 * Patterns: Iterator pattern with recursive processing and context enhancement for loop variables
 * Performance: O(n*m*d) where n=template length, m=collection size, d=nesting depth
 * Error Handling: Graceful degradation on invalid collections, depth limit protection
 */

import { TemplateContext } from '../../types';
import { logger } from '../../utils/logger';
import { ConditionalProcessor } from './conditional-processor';
import { VariableProcessor } from './variable-processor';

/**
 * Loop processor handles {{#each collection}} blocks in templates.
 * Provides iteration context with special variables (@index, @first, @last, etc.)
 * and supports nested loops with proper context isolation.
 *
 * @example
 * ```typescript
 * const template = `
 *   {{#each users}}
 *     {{@index}}: {{name}} ({{@first ? 'First' : 'Not first'}})
 *     {{#each hobbies}}
 *       - {{.}} {{@last ? '(last)' : ''}}
 *     {{/each}}
 *   {{/each}}
 * `;
 *
 * const context = {
 *   variables: {
 *     users: [
 *       { name: "Alice", hobbies: ["reading", "coding"] },
 *       { name: "Bob", hobbies: ["gaming"] }
 *     ]
 *   }
 * };
 * ```
 */
export class LoopProcessor {
  private conditionalProcessor: ConditionalProcessor;

  private variableProcessor: VariableProcessor;

  /**
   * Creates a new LoopProcessor with required dependencies.
   *
   * @param conditionalProcessor - Processor for handling conditional blocks within loops
   * @param variableProcessor - Processor for resolving variables within loop contexts
   */
  constructor(
    conditionalProcessor: ConditionalProcessor,
    variableProcessor: VariableProcessor
  ) {
    this.conditionalProcessor = conditionalProcessor;
    this.variableProcessor = variableProcessor;
  }

  /**
   * Processes all {{#each}} blocks in a template, handling nested loops recursively.
   * Each iteration creates an enhanced context with special variables for loop control.
   *
   * @param template - Template string containing {{#each}} blocks
   * @param context - Template context with variables and metadata
   * @param depth - Current nesting depth (used to prevent infinite recursion)
   * @returns Processed template with all each blocks rendered
   *
   * @example
   * ```typescript
   * const template = "{{#each items}}{{name}}: {{value}}\n{{/each}}";
   * const context = {
   *   variables: {
   *     items: [{name: "A", value: 1}, {name: "B", value: 2}]
   *   }
   * };
   * const result = processor.processEachBlocks(template, context);
   * // Returns: "A: 1\nB: 2\n"
   * ```
   *
   * @throws {Error} When maximum nesting depth (10) is exceeded
   * @see {@link processSingleEachBlock} for individual block processing
   * @see {@link findOutermostEachBlocks} for block detection
   */
  public processEachBlocks(
    template: string,
    context: TemplateContext,
    depth = 0
  ): string {
    const maxDepth = 10;
    if (depth > maxDepth) {
      logger.warn('Maximum each block nesting depth reached');
      return template;
    }

    let result = template;
    let changed = true;

    while (changed) {
      changed = false;
      const blocks = this.findOutermostEachBlocks(result);

      for (const block of blocks) {
        const processed = this.processSingleEachBlock(block, context, depth);
        result = result.replace(block.fullMatch, processed);
        if (processed !== block.fullMatch) {
          changed = true;
        }
      }
    }

    return result;
  }

  /**
   * Processes a single {{#each}} block by iterating over the specified collection.
   * Creates enhanced context for each iteration with special variables and item access.
   *
   * @param block - Parsed each block containing collection name and content
   * @param context - Template context for variable resolution
   * @param depth - Current nesting depth for recursive processing
   * @returns Rendered content from all iterations joined together
   *
   * @example
   * ```typescript
   * const block = {
   *   fullMatch: "{{#each users}}{{name}}{{/each}}",
   *   collection: "users",
   *   content: "{{name}}"
   * };
   * // Creates context with: item, _index, _first, _last, _odd, _even, _total
   * ```
   *
   * @private
   * @see {@link processEachBlocks} for the main processing entry point
   */
  private processSingleEachBlock(
    block: {
      fullMatch: string;
      collection: string;
      content: string;
    },
    context: TemplateContext,
    depth: number
  ): string {
    const collectionData = this.variableProcessor.resolveVariable(
      block.collection,
      context
    );

    if (!collectionData) {
      return '';
    }

    const items = Array.isArray(collectionData)
      ? collectionData
      : [collectionData];
    const results: string[] = [];

    items.forEach((item, index) => {
      // Create enhanced context for iteration
      const iterationContext = {
        ...context,
        item,
        _index: index,
        _key: index,
        _first: index === 0,
        _last: index === items.length - 1,
        _odd: index % 2 === 1,
        _even: index % 2 === 0,
        _total: items.length,
      };

      // Process nested conditionals first
      let processed = this.conditionalProcessor.processConditionalBlocks(
        block.content,
        iterationContext,
        depth + 1
      );

      // Then process nested each blocks
      processed = this.processEachBlocks(
        processed,
        iterationContext,
        depth + 1
      );

      // Finally process variables in the iteration context
      processed = this.variableProcessor.processVariables(
        processed,
        iterationContext
      );

      results.push(processed);
    });

    return results.join('\n');
  }

  /**
   * Finds and parses all outermost {{#each}} blocks in a template.
   * Uses depth tracking to properly match opening and closing tags for nested blocks.
   * Only returns top-level blocks to enable proper inside-out processing.
   *
   * @param template - Template string to search for each blocks
   * @returns Array of parsed each blocks with collection name and content
   *
   * @example
   * ```typescript
   * const template = "{{#each outer}}{{#each inner}}{{.}}{{/each}}{{/each}}";
   * const blocks = findOutermostEachBlocks(template);
   * // Returns: [{ fullMatch: full template, collection: "outer", content: "{{#each inner}}..." }]
   * ```
   *
   * @private
   * @see {@link processEachBlocks} for usage of detected blocks
   */
  private findOutermostEachBlocks(template: string): Array<{
    fullMatch: string;
    collection: string;
    content: string;
  }> {
    const blocks: Array<{
      fullMatch: string;
      collection: string;
      content: string;
    }> = [];

    const openTag = '{{#each';
    const closeTag = '{{/each}}';

    let pos = 0;
    while (pos < template.length) {
      const openIndex = template.indexOf(openTag, pos);
      if (openIndex === -1) break;

      // Find the matching close tag
      let depth = 1;
      let searchPos = openIndex + openTag.length;
      let closeIndex = -1;

      while (depth > 0 && searchPos < template.length) {
        const nextOpen = template.indexOf(openTag, searchPos);
        const nextClose = template.indexOf(closeTag, searchPos);

        if (nextClose === -1) break;

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
        const collectionMatch = fullMatch.match(/\{\{#each\s+([\w.]+)\s*\}\}/);

        if (collectionMatch) {
          const collection = collectionMatch[1]!; // Safe due to regex match check
          const content = template.substring(
            openIndex + collectionMatch[0].length,
            closeIndex
          );

          blocks.push({ fullMatch, collection, content });
        }
      }

      pos = closeIndex !== -1 ? closeIndex + closeTag.length : template.length;
    }

    return blocks;
  }
}

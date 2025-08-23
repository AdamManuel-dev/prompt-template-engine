/**
 * @fileoverview Loop processor for template engine
 * @lastmodified 2025-08-22T21:30:00Z
 *
 * Features: Each/loop block processing with iteration context
 * Main APIs: processEachBlocks(), processSingleEachBlock()
 * Constraints: Handles nested loops with proper context isolation
 * Patterns: Iterator pattern with context enhancement
 */

import { TemplateContext } from '../../types';
import { logger } from '../../utils/logger';
import { ConditionalProcessor } from './conditional-processor';
import { VariableProcessor } from './variable-processor';

export class LoopProcessor {
  private conditionalProcessor: ConditionalProcessor;

  private variableProcessor: VariableProcessor;

  constructor(
    conditionalProcessor: ConditionalProcessor,
    variableProcessor: VariableProcessor
  ) {
    this.conditionalProcessor = conditionalProcessor;
    this.variableProcessor = variableProcessor;
  }

  /**
   * Process each blocks in template
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
   * Process single each block
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

    return results.join('');
  }

  /**
   * Find outermost each blocks
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
          const collection = collectionMatch[1];
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

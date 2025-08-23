/**
 * @fileoverview Conditional block processor for template engine
 * @lastmodified 2025-08-22T21:30:00Z
 *
 * Features: If/unless/else conditional block processing
 * Main APIs: processConditionalBlocks(), evaluateCondition()
 * Constraints: Handles nested conditionals with proper scoping
 * Patterns: Recursive processing with depth tracking
 */

import { TemplateContext } from '../../types';
import { logger } from '../../utils/logger';

export class ConditionalProcessor {
  /**
   * Process all conditional blocks in template
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
   * Find outermost if blocks
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
          const condition = conditionMatch[1];
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
   * Find outermost unless blocks
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
          const condition = conditionMatch[1];
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
   * Process single if block
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
   * Process single unless block
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
   * Check if block is inside an each block
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
   * Evaluate condition
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
    let current: any = context;

    for (const segment of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[segment];
    }

    return current;
  }

  /**
   * Check if value is truthy
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

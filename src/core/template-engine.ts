/**
 * @fileoverview Template engine for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T19:00:00Z
 *
 * Features: Template rendering with variable substitution
 * Main APIs: TemplateEngine.render()
 * Constraints: Supports Handlebars-style variable substitution
 * Patterns: Variable replacement, template parsing
 */

import * as fs from 'fs';

export interface TemplateContext {
  [key: string]: unknown;
}

export class TemplateEngine {
  private variablePattern = /\{\{(\s*[@\w.]+\s*)\}\}/g;

  private eachPattern = /\{\{#each\s+([\w.]+)\s*\}\}(.*?)\{\{\/each\}\}/gs;

  private ifPattern = /\{\{#if\s+([\w.@]+)\s*\}\}(.*?)\{\{\/if\}\}/gs;

  private unlessPattern =
    /\{\{#unless\s+([\w.@]+)\s*\}\}(.*?)\{\{\/unless\}\}/gs;

  /**
   * Render a template string with variables
   */
  async render(template: string, context: TemplateContext): Promise<string> {
    // First process conditional blocks (which handle nested #each blocks internally)
    let processed = this.processConditionalBlocks(template, context);

    // Then process any standalone #each blocks not inside conditionals
    processed = this.processEachBlocks(processed, context);

    // Finally process regular variables
    return processed.replace(this.variablePattern, (match, variable) => {
      const key = variable.trim();
      const value = this.resolveVariable(key, context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Process {{#each}} blocks for array iteration with proper nesting support
   */
  // eslint-disable-next-line class-methods-use-this
  private processEachBlocks(
    template: string,
    context: TemplateContext,
    depth = 0
  ): string {
    // Prevent infinite recursion
    if (depth > 10) {
      return template;
    }

    let result = template;
    let changed = true;

    // Keep processing until no more changes are made (to handle nested blocks)
    while (changed) {
      changed = false;
      const eachBlocks = this.findOutermostEachBlocks(result);

      for (let i = 0; i < eachBlocks.length; i += 1) {
        const block = eachBlocks[i];
        const blockResult = this.processSingleEachBlock(block, context, depth);
        result = result.replace(block.fullMatch, blockResult.replacement);
        if (blockResult.hasChanges) {
          changed = true;
        }
      }
    }

    return result;
  }

  /**
   * Process {{#if}} and {{#unless}} blocks for conditional rendering
   */
  // eslint-disable-next-line class-methods-use-this
  public processConditionalBlocks(
    template: string,
    context: TemplateContext,
    depth = 0
  ): string {
    // Prevent infinite recursion
    if (depth > 10) {
      return template;
    }

    let result = template;
    let changed = true;

    // Keep processing until no more changes are made (to handle nested blocks)
    while (changed) {
      changed = false;

      // Process #if blocks (only those not inside #each blocks at depth 0)
      const ifBlocks = this.findOutermostIfBlocks(result);
      for (let i = 0; i < ifBlocks.length; i += 1) {
        const block = ifBlocks[i];
        // Skip conditionals inside #each blocks during the top-level pass
        if (depth === 0 && this.isInsideEachBlock(block, result)) {
          // Skip this block
        } else {
          const blockResult = this.processSingleIfBlock(block, context, depth);
          result = result.replace(block.fullMatch, blockResult.replacement);
          if (blockResult.hasChanges) {
            changed = true;
          }
        }
      }

      // Process #unless blocks (only those not inside #each blocks at depth 0)
      const unlessBlocks = this.findOutermostUnlessBlocks(result);
      for (let i = 0; i < unlessBlocks.length; i += 1) {
        const block = unlessBlocks[i];
        // Skip conditionals inside #each blocks during the top-level pass
        if (depth === 0 && this.isInsideEachBlock(block, result)) {
          // Skip this block
        } else {
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
   * Check if a conditional block is inside an #each block
   */
  // eslint-disable-next-line class-methods-use-this
  private isInsideEachBlock(
    block: { fullMatch: string; condition: string; innerTemplate: string },
    template: string
  ): boolean {
    const blockStart = template.indexOf(block.fullMatch);
    if (blockStart === -1) return false;

    // Find all #each blocks in the template
    const eachBlocks = this.findOutermostEachBlocks(template);

    // Check if our conditional block is inside any #each block
    for (let i = 0; i < eachBlocks.length; i += 1) {
      const eachBlock = eachBlocks[i];
      const eachStart = template.indexOf(eachBlock.fullMatch);
      const eachEnd = eachStart + eachBlock.fullMatch.length;

      if (blockStart > eachStart && blockStart < eachEnd) {
        return true;
      }
    }

    return false;
  }

  /**
   * Process a single #if block
   */
  // eslint-disable-next-line class-methods-use-this
  private processSingleIfBlock(
    block: { fullMatch: string; condition: string; innerTemplate: string },
    context: TemplateContext,
    depth: number
  ): { replacement: string; hasChanges: boolean } {
    const conditionValue = this.resolveVariable(
      block.condition.trim(),
      context
    );
    const isTruthy = this.isTruthy(conditionValue);

    if (isTruthy) {
      // First process any #each blocks in the inner template (which will handle their own conditionals)
      let processedInner = this.processEachBlocks(
        block.innerTemplate,
        context,
        depth + 1
      );

      // Then recursively process remaining conditional blocks
      processedInner = this.processConditionalBlocks(
        processedInner,
        context,
        depth + 1
      );

      return { replacement: processedInner, hasChanges: true };
    }

    return { replacement: '', hasChanges: true };
  }

  /**
   * Process a single #unless block
   */
  // eslint-disable-next-line class-methods-use-this
  private processSingleUnlessBlock(
    block: { fullMatch: string; condition: string; innerTemplate: string },
    context: TemplateContext,
    depth: number
  ): { replacement: string; hasChanges: boolean } {
    const conditionValue = this.resolveVariable(
      block.condition.trim(),
      context
    );
    const isTruthy = this.isTruthy(conditionValue);

    if (!isTruthy) {
      // First process any #each blocks in the inner template (which will handle their own conditionals)
      let processedInner = this.processEachBlocks(
        block.innerTemplate,
        context,
        depth + 1
      );

      // Then recursively process remaining conditional blocks
      processedInner = this.processConditionalBlocks(
        processedInner,
        context,
        depth + 1
      );

      return { replacement: processedInner, hasChanges: true };
    }

    return { replacement: '', hasChanges: true };
  }

  /**
   * Find only the outermost #if blocks (we'll handle nesting recursively)
   */
  // eslint-disable-next-line class-methods-use-this
  public findOutermostIfBlocks(
    template: string
  ): Array<{ fullMatch: string; condition: string; innerTemplate: string }> {
    return this.findOutermostConditionalBlocks(template, 'if');
  }

  /**
   * Find only the outermost #unless blocks (we'll handle nesting recursively)
   */
  // eslint-disable-next-line class-methods-use-this
  private findOutermostUnlessBlocks(
    template: string
  ): Array<{ fullMatch: string; condition: string; innerTemplate: string }> {
    return this.findOutermostConditionalBlocks(template, 'unless');
  }

  /**
   * Generic method to find outermost conditional blocks
   */
  // eslint-disable-next-line class-methods-use-this
  public findOutermostConditionalBlocks(
    template: string,
    blockType: 'if' | 'unless'
  ): Array<{ fullMatch: string; condition: string; innerTemplate: string }> {
    const blocks: Array<{
      fullMatch: string;
      condition: string;
      innerTemplate: string;
    }> = [];
    const openPattern =
      blockType === 'if'
        ? /\{\{#if\s+([\w.@]+)\s*\}\}/g
        : /\{\{#unless\s+([\w.@]+)\s*\}\}/g;
    const closeTag = `{{/${blockType}}}`;

    // Reset regex lastIndex
    openPattern.lastIndex = 0;

    let match = openPattern.exec(template);
    while (match !== null) {
      const startPos = match.index;
      const condition = match[1];
      let depth = 1;
      let pos = openPattern.lastIndex;

      // Find the matching closing tag
      while (depth > 0 && pos < template.length) {
        const nextOpen = template.indexOf(`{{#${blockType}`, pos);
        const nextClose = template.indexOf(closeTag, pos);

        if (nextClose === -1) break; // No more closing tags

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth += 1;
          pos = nextOpen + blockType.length + 3; // Move past '{{#if' or '{{#unless'
        } else {
          depth -= 1;
          pos = nextClose + closeTag.length;
        }
      }

      if (depth === 0) {
        const endPos = pos;
        const fullMatch = template.substring(startPos, endPos);
        const innerStart = template.indexOf('}}', startPos) + 2;
        const innerEnd = template.lastIndexOf(closeTag, endPos);
        const innerTemplate = template.substring(innerStart, innerEnd);

        blocks.push({
          fullMatch,
          condition,
          innerTemplate,
        });

        // Skip past this block to avoid nested blocks
        openPattern.lastIndex = endPos;
      }

      match = openPattern.exec(template);
    }

    return blocks;
  }

  /**
   * Determine if a value is truthy according to template logic
   */
  // eslint-disable-next-line class-methods-use-this
  public isTruthy(value: unknown): boolean {
    // Handle JavaScript truthiness but with template-specific rules
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.length > 0;
    }
    if (typeof value === 'number') {
      return value !== 0 && !Number.isNaN(value);
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return Boolean(value);
  }

  /**
   * Process a single #each block
   */
  // eslint-disable-next-line class-methods-use-this
  private processSingleEachBlock(
    block: { fullMatch: string; arrayPath: string; innerTemplate: string },
    context: TemplateContext,
    depth: number
  ): { replacement: string; hasChanges: boolean } {
    const arrayValue = this.resolveVariable(block.arrayPath.trim(), context);

    // Handle non-array or undefined values
    if (!Array.isArray(arrayValue)) {
      return { replacement: '', hasChanges: true };
    }

    // Process each item in the array
    const processedItems = arrayValue.map((item, index) => {
      // Create context for this iteration
      const itemContext: TemplateContext = {
        ...context,
        this: item,
        '@index': index,
        '@first': index === 0,
        '@last': index === arrayValue.length - 1,
      };

      // Add item properties to context for easier access
      if (typeof item === 'object' && item !== null) {
        Object.assign(itemContext, item);
      }

      // First recursively process any nested #each blocks in this context
      let itemTemplate = this.processEachBlocks(
        block.innerTemplate,
        itemContext,
        depth + 1
      );

      // Then process conditional blocks in this iteration context
      itemTemplate = this.processConditionalBlocks(
        itemTemplate,
        itemContext,
        depth + 1
      );

      // Then process regular variables in this iteration
      return itemTemplate.replace(
        this.variablePattern,
        (_innerMatch, innerVariable: string) => {
          const key = innerVariable.trim();

          // Handle special context variables
          if (key === 'this') {
            return item !== undefined ? String(item) : '';
          }

          if (key.startsWith('@')) {
            // Handle special iteration variables
            const specialValue = itemContext[key];
            return specialValue !== undefined
              ? String(specialValue)
              : _innerMatch;
          }

          // For regular variables, resolve from item context
          const value = this.resolveVariable(key, itemContext);
          return value !== undefined ? String(value) : _innerMatch;
        }
      );
    });

    return { replacement: processedItems.join(''), hasChanges: true };
  }

  /**
   * Find only the outermost #each blocks (we'll handle nesting recursively)
   */
  // eslint-disable-next-line class-methods-use-this
  private findOutermostEachBlocks(
    template: string
  ): Array<{ fullMatch: string; arrayPath: string; innerTemplate: string }> {
    const blocks: Array<{
      fullMatch: string;
      arrayPath: string;
      innerTemplate: string;
    }> = [];
    const openPattern = /\{\{#each\s+([\w.]+)\s*\}\}/g;

    // Reset regex lastIndex
    openPattern.lastIndex = 0;

    let match = openPattern.exec(template);
    while (match !== null) {
      const startPos = match.index;
      const arrayPath = match[1];
      let depth = 1;
      let pos = openPattern.lastIndex;

      // Find the matching closing tag
      while (depth > 0 && pos < template.length) {
        const nextOpen = template.indexOf('{{#each', pos);
        const nextClose = template.indexOf('{{/each}}', pos);

        if (nextClose === -1) break; // No more closing tags

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth += 1;
          pos = nextOpen + 7; // Move past '{{#each'
        } else {
          depth -= 1;
          pos = nextClose + 9; // Move past '{{/each}}'
        }
      }

      if (depth === 0) {
        const endPos = pos;
        const fullMatch = template.substring(startPos, endPos);
        const innerStart = template.indexOf('}}', startPos) + 2;
        const innerEnd = template.lastIndexOf('{{/each}}', endPos);
        const innerTemplate = template.substring(innerStart, innerEnd);

        blocks.push({
          fullMatch,
          arrayPath,
          innerTemplate,
        });

        // Skip past this block to avoid nested blocks
        openPattern.lastIndex = endPos;
      }

      match = openPattern.exec(template);
    }

    return blocks;
  }

  /**
   * Render a template file with variables
   */
  async renderFile(
    templatePath: string,
    context: TemplateContext
  ): Promise<string> {
    const template = await fs.promises.readFile(templatePath, 'utf8');
    return this.render(template, context);
  }

  /**
   * Resolve a variable from context (supports dot notation)
   */
  // eslint-disable-next-line class-methods-use-this
  private resolveVariable(key: string, context: TemplateContext): unknown {
    const keys = key.split('.');
    let value: unknown = context;

    keys.forEach(k => {
      if (value && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        value = undefined;
      }
    });

    return value;
  }

  /**
   * Check if a string contains template variables
   */
  hasVariables(template: string): boolean {
    return (
      this.variablePattern.test(template) ||
      this.eachPattern.test(template) ||
      this.ifPattern.test(template) ||
      this.unlessPattern.test(template)
    );
  }

  /**
   * Extract variable names from a template
   */
  extractVariables(template: string): string[] {
    const variables = new Set<string>();
    let match;

    // Extract variables from #each blocks
    this.eachPattern.lastIndex = 0;
    // eslint-disable-next-line no-cond-assign
    while ((match = this.eachPattern.exec(template)) !== null) {
      // Add the array path variable
      variables.add(match[1].trim());

      // Extract variables from inner template (excluding special context variables)
      const innerTemplate = match[2];
      const innerVariables = this.extractSimpleVariables(innerTemplate);
      innerVariables.forEach(variable => {
        if (!['this', '@index', '@first', '@last'].includes(variable)) {
          variables.add(variable);
        }
      });
    }

    // Extract variables from #if blocks
    this.ifPattern.lastIndex = 0;
    // eslint-disable-next-line no-cond-assign
    while ((match = this.ifPattern.exec(template)) !== null) {
      // Add the condition variable
      variables.add(match[1].trim());

      // Extract variables from inner template
      const innerTemplate = match[2];
      const innerVariables = this.extractSimpleVariables(innerTemplate);
      innerVariables.forEach(variable => variables.add(variable));
    }

    // Extract variables from #unless blocks
    this.unlessPattern.lastIndex = 0;
    // eslint-disable-next-line no-cond-assign
    while ((match = this.unlessPattern.exec(template)) !== null) {
      // Add the condition variable
      variables.add(match[1].trim());

      // Extract variables from inner template
      const innerTemplate = match[2];
      const innerVariables = this.extractSimpleVariables(innerTemplate);
      innerVariables.forEach(variable => variables.add(variable));
    }

    // Extract regular variables
    const simpleVariables = this.extractSimpleVariables(template);
    simpleVariables.forEach(variable => variables.add(variable));

    return Array.from(variables);
  }

  /**
   * Extract simple variables (helper method)
   */
  // eslint-disable-next-line class-methods-use-this
  private extractSimpleVariables(template: string): string[] {
    const variables = new Set<string>();
    const regex = /\{\{(\s*[\w.@]+\s*)\}\}/g;
    let match;

    // Reset regex lastIndex
    regex.lastIndex = 0;

    // eslint-disable-next-line no-cond-assign
    while ((match = regex.exec(template)) !== null) {
      variables.add(match[1].trim());
    }

    return Array.from(variables);
  }

  /**
   * Validate that all required variables are present in context
   */
  validateContext(
    template: string,
    context: TemplateContext
  ): { valid: boolean; missing: string[] } {
    const required = this.extractVariables(template);
    const missing: string[] = [];

    required.forEach(variable => {
      const value = this.resolveVariable(variable, context);
      if (value === undefined) {
        missing.push(variable);
      }
    });

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

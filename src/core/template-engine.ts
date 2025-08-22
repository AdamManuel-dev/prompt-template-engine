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

  /**
   * Render a template string with variables
   */
  async render(template: string, context: TemplateContext): Promise<string> {
    // First process #each blocks
    const processed = this.processEachBlocks(template, context);

    // Then process regular variables
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

      for (const block of eachBlocks) {
        const arrayValue = this.resolveVariable(
          block.arrayPath.trim(),
          context
        );

        // Handle non-array or undefined values
        if (!Array.isArray(arrayValue)) {
          result = result.replace(block.fullMatch, '');
          changed = true;
          continue;
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
          const itemTemplate = this.processEachBlocks(
            block.innerTemplate,
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

        result = result.replace(block.fullMatch, processedItems.join(''));
        changed = true;
      }
    }

    return result;
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

    let match;
    // Reset regex lastIndex
    openPattern.lastIndex = 0;

    while ((match = openPattern.exec(template)) !== null) {
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
          depth++;
          pos = nextOpen + 7; // Move past '{{#each'
        } else {
          depth--;
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
      this.variablePattern.test(template) || this.eachPattern.test(template)
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

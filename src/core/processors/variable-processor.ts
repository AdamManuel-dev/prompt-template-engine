/**
 * @fileoverview Variable processor for template engine
 * @lastmodified 2025-08-22T21:30:00Z
 *
 * Features: Variable resolution and replacement in templates
 * Main APIs: processVariables(), resolveVariable()
 * Constraints: Handles nested object paths and array indices
 * Patterns: Single responsibility processor pattern
 */

import { TemplateContext } from '../../types';

export class VariableProcessor {
  private variablePattern = /\{\{(\s*[@\w.[\]0-9]+\s*)\}\}/g;

  /**
   * Process variables in template
   */
  public processVariables(template: string, context: TemplateContext): string {
    return template.replace(this.variablePattern, (match, key) => {
      const trimmedKey = key.trim();
      const value = this.resolveVariable(trimmedKey, context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Resolve variable from context
   */
  public resolveVariable(key: string, context: TemplateContext): unknown {
    // Handle special @ variables
    if (key.startsWith('@')) {
      return this.resolveSpecialVariable(key, context);
    }

    // Handle nested path resolution
    const path = key.split('.');
    let current: any = context.variables;

    for (const segment of path) {
      if (current === null || current === undefined) {
        return undefined;
      }

      // Handle array index notation
      const arrayMatch = segment.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayName, index] = arrayMatch;
        current = current[arrayName]?.[parseInt(index, 10)];
      } else {
        current = current[segment];
      }
    }

    return current;
  }

  /**
   * Extract simple variables from template
   */
  public extractSimpleVariables(template: string): string[] {
    const variables: string[] = [];
    const matches = template.matchAll(this.variablePattern);

    for (const match of matches) {
      const varName = match[1].trim();
      if (!varName.startsWith('@') && !variables.includes(varName)) {
        variables.push(varName);
      }
    }

    return variables;
  }

  private resolveSpecialVariable(
    key: string,
    context: TemplateContext
  ): unknown {
    switch (key) {
      case '@index':
        return context._index;
      case '@key':
        return context._key;
      case '@first':
        return context._index === 0;
      case '@last':
        return context._index === (context._total || 0) - 1;
      case '@odd':
        return (context._index || 0) % 2 === 1;
      case '@even':
        return (context._index || 0) % 2 === 0;
      default:
        return undefined;
    }
  }
}

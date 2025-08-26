/**
 * @fileoverview Variable processor for template engine - handles variable resolution and replacement
 * @lastmodified 2025-08-26T11:10:32Z
 *
 * Features: Variable resolution with nested paths, array indices, and special variables
 * Main APIs: processVariables(), resolveVariable(), extractSimpleVariables()
 * Constraints: Handles nested object paths up to any depth, supports array notation [index]
 * Patterns: Single responsibility processor with regex-based parsing and recursive resolution
 * Performance: O(n*m) where n=template length, m=average variable path depth
 */

import { TemplateContext } from '../../types';

/**
 * Variable processor handles template variable resolution and replacement.
 * Supports nested object paths, array indices, and special loop variables.
 *
 * @example
 * ```typescript
 * const processor = new VariableProcessor();
 * const template = "Hello {{user.name}}, you have {{messages[0].count}} messages";
 * const context = {
 *   variables: {
 *     user: { name: "Alice" },
 *     messages: [{ count: 5 }]
 *   }
 * };
 * const result = processor.processVariables(template, context);
 * // Returns: "Hello Alice, you have 5 messages"
 * ```
 */
export class VariableProcessor {
  /**
   * Regular expression pattern for matching template variables.
   * Matches {{variable}}, {{object.property}}, {{array[0]}}, and {{@special}}
   * @private
   */
  private variablePattern = /\{\{(\s*[@\w.[\]0-9]+\s*)\}\}/g;

  /**
   * Processes all variables in a template string, replacing them with resolved values.
   * Handles nested object paths, array indices, and special variables like @index, @first, etc.
   *
   * @param template - Template string containing variables in {{variable}} format
   * @param context - Template context containing variables and metadata
   * @returns Processed template with variables replaced by their resolved values
   *
   * @example
   * ```typescript
   * const template = "{{user.name}} has {{@index}} items";
   * const context = {
   *   variables: { user: { name: "John" } },
   *   _index: 3
   * };
   * const result = processor.processVariables(template, context);
   * // Returns: "John has 3 items"
   * ```
   *
   * @see {@link resolveVariable} for variable resolution logic
   * @see {@link extractSimpleVariables} for variable extraction
   */
  public processVariables(template: string, context: TemplateContext): string {
    return template.replace(this.variablePattern, (match, key) => {
      const trimmedKey = key.trim();
      const value = this.resolveVariable(trimmedKey, context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Resolves a variable key to its value from the template context.
   * Supports nested object paths, array indices, and special variables.
   *
   * @param key - Variable key to resolve (e.g., "user.name", "items[0]", "@index")
   * @param context - Template context containing variables and metadata
   * @returns Resolved variable value or undefined if not found
   *
   * @example
   * ```typescript
   * // Nested object path
   * resolveVariable("user.profile.name", context) // Returns nested value
   *
   * // Array index notation
   * resolveVariable("items[0]", context) // Returns first array item
   *
   * // Special variables
   * resolveVariable("@index", context) // Returns current loop index
   * resolveVariable("@first", context) // Returns true if first iteration
   * ```
   *
   * @see {@link resolveSpecialVariable} for special variable handling
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
   * Extracts all non-special variable names from a template string.
   * Excludes special variables that start with @ (e.g., @index, @first).
   *
   * @param template - Template string to extract variables from
   * @returns Array of unique variable names found in the template
   *
   * @example
   * ```typescript
   * const template = "Hello {{name}}, {{@index}} of {{total}} items";
   * const variables = processor.extractSimpleVariables(template);
   * // Returns: ["name", "total"] (excludes @index)
   * ```
   *
   * @see {@link processVariables} for variable processing
   */
  public extractSimpleVariables(template: string): string[] {
    const variables: string[] = [];
    let match: RegExpExecArray | null;

    // Reset regex state
    this.variablePattern.lastIndex = 0;

    // eslint-disable-next-line no-cond-assign
    while ((match = this.variablePattern.exec(template)) !== null) {
      const varName = match[1].trim();
      if (!varName.startsWith('@') && !variables.includes(varName)) {
        variables.push(varName);
      }
    }

    return variables;
  }

  /**
   * Resolves special variables that start with @ and provide loop context information.
   * These variables are automatically available within loop iterations.
   *
   * @param key - Special variable key (must start with @)
   * @param context - Template context containing loop metadata
   * @returns Resolved special variable value or undefined if not recognized
   *
   * @example
   * ```typescript
   * // In a loop context with _index = 0, _total = 3
   * resolveSpecialVariable("@index", context) // Returns 0
   * resolveSpecialVariable("@first", context) // Returns true
   * resolveSpecialVariable("@last", context)  // Returns false
   * resolveSpecialVariable("@odd", context)   // Returns false
   * resolveSpecialVariable("@even", context)  // Returns true
   * ```
   *
   * @private
   * @see {@link resolveVariable} for general variable resolution
   */
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

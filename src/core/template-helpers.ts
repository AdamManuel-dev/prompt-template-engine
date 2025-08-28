/**
 * @fileoverview Template helper functions for cursor-prompt-template-engine
 * @lastmodified 2025-08-26T11:27:59Z
 *
 * Features: Comparison, math, string, and utility helper functions
 * Main APIs: TemplateHelpers class with various helper methods
 * Constraints: Designed for use within template expressions
 * Patterns: Pure functions for template transformations
 */

/**
 * Function signature for template helper functions.
 * Helpers accept variable arguments and return a value for template rendering.
 *
 * @example
 * ```typescript
 * const addHelper: HelperFunction = (a: unknown, b: unknown) => Number(a) + Number(b);
 * ```
 */
export type HelperFunction = (...args: unknown[]) => unknown;

/**
 * Context object containing variables and data available to helper functions.
 * Used for resolving variable references and providing runtime context.
 *
 * @example
 * ```typescript
 * const context: HelperContext = {
 *   user: { name: "Alice", age: 30 },
 *   settings: { theme: "dark" }
 * };
 * ```
 */
export interface HelperContext {
  [key: string]: unknown;
}

/**
 * Template helpers provide utility functions for use within template expressions.
 * Includes comparison, mathematical, string manipulation, array operations, and utility functions.
 * All helpers are designed to be safe for template use with proper type coercion and error handling.
 *
 * @example
 * ```typescript
 * const helpers = new TemplateHelpers();
 *
 * // Register custom helper
 * helpers.register('multiply', (a, b) => Number(a) * Number(b));
 *
 * // Execute helper in template context
 * const result = helpers.parseAndExecute('add 5 3', { value: 10 });
 * // Returns: 8
 *
 * // Use in template expressions
 * const template = '{{add user.age 5}}';
 * const context = { user: { age: 25 } };
 * // Would resolve to: 30
 * ```
 */
export class TemplateHelpers {
  private helpers: Map<string, HelperFunction> = new Map();

  /**
   * Creates a new TemplateHelpers instance with all default helpers pre-registered.
   * Default helpers include comparison, math, string, array, date/time, type checking, and utility functions.
   *
   * @example
   * ```typescript
   * const helpers = new TemplateHelpers();
   * console.log(helpers.getHelperNames()); // Lists all available helpers
   * ```
   */
  constructor() {
    this.registerDefaultHelpers();
  }

  /**
   * Registers all default helper functions available in the template engine.
   * This includes comprehensive sets of helpers for various operations:
   * - Comparison: eq, neq, lt, gt, and, or, not
   * - Math: add, subtract, multiply, divide, mod, round, floor, ceil, abs, min, max
   * - String: uppercase, lowercase, capitalize, titlecase, concat, trim, replace, substring, length, contains, startsWith, endsWith, split, join
   * - Array: first, last, reverse, sort, unique
   * - Date/time: now, date
   * - Type checking: isArray, isObject, isString, isNumber, isBoolean, isDefined, isUndefined, isNull, isEmpty
   * - Utility: default, json, parseJson
   *
   * @private
   * @see {@link register} for adding custom helpers
   */
  private registerDefaultHelpers(): void {
    // Comparison helpers
    this.register('eq', (a: unknown, b: unknown) => a === b);
    this.register('neq', (a: unknown, b: unknown) => a !== b);
    this.register('lt', (a: unknown, b: unknown) => Number(a) < Number(b));
    this.register('lte', (a: unknown, b: unknown) => Number(a) <= Number(b));
    this.register('gt', (a: unknown, b: unknown) => Number(a) > Number(b));
    this.register('gte', (a: unknown, b: unknown) => Number(a) >= Number(b));
    this.register('and', (...args: unknown[]) => args.every(Boolean));
    this.register('or', (...args: unknown[]) => args.some(Boolean));
    this.register('not', (value: unknown) => !value);

    // Math helpers
    this.register('add', (a: unknown, b: unknown) => Number(a) + Number(b));
    this.register(
      'subtract',
      (a: unknown, b: unknown) => Number(a) - Number(b)
    );
    this.register(
      'multiply',
      (a: unknown, b: unknown) => Number(a) * Number(b)
    );
    this.register('divide', (a: unknown, b: unknown) => {
      const divisor = Number(b);
      if (divisor === 0) return 0;
      return Number(a) / divisor;
    });
    this.register('mod', (a: unknown, b: unknown) => Number(a) % Number(b));
    this.register('round', (value: unknown) => Math.round(Number(value)));
    this.register('floor', (value: unknown) => Math.floor(Number(value)));
    this.register('ceil', (value: unknown) => Math.ceil(Number(value)));
    this.register('abs', (value: unknown) => Math.abs(Number(value)));
    this.register('min', (...args: unknown[]) => Math.min(...args.map(Number)));
    this.register('max', (...args: unknown[]) => Math.max(...args.map(Number)));

    // String helpers
    this.register('uppercase', (str: unknown) => String(str).toUpperCase());
    this.register('lowercase', (str: unknown) => String(str).toLowerCase());
    this.register('capitalize', (str: unknown) => {
      const s = String(str);
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    });
    this.register('titlecase', (str: unknown) => {
      const s = String(str);
      return s.replace(
        /\w\S*/g,
        txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
      );
    });
    this.register('concat', (...args: unknown[]) => args.map(String).join(''));
    this.register('trim', (str: unknown) => String(str).trim());
    this.register(
      'replace',
      (str: unknown, search: unknown, replace: unknown) =>
        String(str).replace(String(search), String(replace))
    );
    this.register(
      'substring',
      (str: unknown, start: unknown, end?: unknown) => {
        const s = String(str);
        const startIdx = Number(start);
        return end !== undefined
          ? s.substring(startIdx, Number(end))
          : s.substring(startIdx);
      }
    );
    this.register('length', (value: unknown) => {
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'string') return value.length;
      if (typeof value === 'object' && value !== null)
        return Object.keys(value).length;
      return 0;
    });
    this.register('contains', (str: unknown, search: unknown) =>
      String(str).includes(String(search))
    );
    this.register('startsWith', (str: unknown, search: unknown) =>
      String(str).startsWith(String(search))
    );
    this.register('endsWith', (str: unknown, search: unknown) =>
      String(str).endsWith(String(search))
    );
    this.register('split', (str: unknown, separator: unknown) =>
      String(str).split(String(separator))
    );
    this.register('join', (arr: unknown, separator: unknown) => {
      if (!Array.isArray(arr)) return '';
      return arr.join(String(separator));
    });

    // Array helpers
    this.register('first', (arr: unknown) =>
      Array.isArray(arr) ? arr[0] : undefined
    );
    this.register('last', (arr: unknown) =>
      Array.isArray(arr) ? arr[arr.length - 1] : undefined
    );
    this.register('reverse', (arr: unknown) =>
      Array.isArray(arr) ? [...arr].reverse() : []
    );
    this.register('sort', (arr: unknown) =>
      Array.isArray(arr) ? [...arr].sort() : []
    );
    this.register('unique', (arr: unknown) =>
      Array.isArray(arr) ? Array.from(new Set(arr)) : []
    );

    // Date/time helpers
    this.register('now', () => new Date().toISOString());
    this.register('date', (format?: unknown) => {
      const now = new Date();
      if (format === 'iso') return now.toISOString();
      if (format === 'date') return now.toDateString();
      if (format === 'time') return now.toTimeString();
      return now.toString();
    });

    // Type checking helpers
    this.register('isArray', (value: unknown) => Array.isArray(value));
    this.register(
      'isObject',
      (value: unknown) =>
        typeof value === 'object' && value !== null && !Array.isArray(value)
    );
    this.register('isString', (value: unknown) => typeof value === 'string');
    this.register('isNumber', (value: unknown) => typeof value === 'number');
    this.register('isBoolean', (value: unknown) => typeof value === 'boolean');
    this.register('isDefined', (value: unknown) => value !== undefined);
    this.register('isUndefined', (value: unknown) => value === undefined);
    this.register('isNull', (value: unknown) => value === null);
    this.register('isEmpty', (value: unknown) => {
      if (value == null) return true;
      if (Array.isArray(value) || typeof value === 'string')
        return value.length === 0;
      if (typeof value === 'object') return Object.keys(value).length === 0;
      return false;
    });

    // Utility helpers
    this.register('default', (value: unknown, defaultValue: unknown) =>
      value != null ? value : defaultValue
    );
    this.register('json', (value: unknown) => JSON.stringify(value, null, 2));
    this.register('parseJson', (str: unknown) => {
      try {
        return JSON.parse(String(str));
      } catch {
        return null;
      }
    });
  }

  /**
   * Registers a custom helper function that can be used in template expressions.
   * Helper functions should handle type coercion and error cases gracefully.
   *
   * @param name - Unique name for the helper function
   * @param fn - Function implementation that accepts variable arguments and returns a value
   *
   * @example
   * ```typescript
   * // Register a simple math helper
   * helpers.register('square', (num: unknown) => {
   *   const n = Number(num);
   *   return n * n;
   * });
   *
   * // Register a string formatter helper
   * helpers.register('formatName', (first: unknown, last: unknown) => {
   *   return `${String(first).trim()} ${String(last).trim()}`;
   * });
   *
   * // Register a conditional helper
   * helpers.register('ifThen', (condition: unknown, trueValue: unknown, falseValue: unknown) => {
   *   return condition ? trueValue : falseValue;
   * });
   * ```
   *
   * @throws {Error} If attempting to register over an existing helper name
   * @see {@link execute} for calling registered helpers
   * @see {@link has} for checking helper existence
   */
  register(name: string, fn: HelperFunction): void {
    this.helpers.set(name, fn);
  }

  /**
   * Executes a registered helper function with the provided arguments.
   * Arguments are passed directly to the helper function without modification.
   *
   * @param name - Name of the helper function to execute
   * @param args - Arguments to pass to the helper function
   * @returns Result returned by the helper function
   *
   * @example
   * ```typescript
   * // Execute built-in helpers
   * const sum = helpers.execute('add', 10, 5); // Returns: 15
   * const upper = helpers.execute('uppercase', 'hello'); // Returns: "HELLO"
   * const isEqual = helpers.execute('eq', 'test', 'test'); // Returns: true
   *
   * // Execute custom helper
   * helpers.register('greet', (name: unknown) => `Hello, ${name}!`);
   * const greeting = helpers.execute('greet', 'World'); // Returns: "Hello, World!"
   * ```
   *
   * @throws {Error} When the specified helper function is not registered
   * @see {@link register} for registering helper functions
   * @see {@link parseAndExecute} for parsing and executing from template expressions
   */
  execute(name: string, ...args: unknown[]): unknown {
    const helper = this.helpers.get(name);
    if (!helper) {
      throw new Error(`Helper function '${name}' not found`);
    }
    return helper(...args);
  }

  /**
   * Checks whether a helper function with the specified name is registered.
   * Useful for conditional helper usage and validation.
   *
   * @param name - Name of the helper function to check
   * @returns True if the helper is registered, false otherwise
   *
   * @example
   * ```typescript
   * console.log(helpers.has('add')); // true (built-in helper)
   * console.log(helpers.has('myCustomHelper')); // false (unless registered)
   *
   * // Conditional helper usage
   * if (helpers.has('formatCurrency')) {
   *   const formatted = helpers.execute('formatCurrency', 123.45);
   * } else {
   *   console.log('Currency formatter not available');
   * }
   * ```
   *
   * @see {@link register} for registering helpers
   * @see {@link getHelperNames} for getting all available helper names
   */
  has(name: string): boolean {
    return this.helpers.has(name);
  }

  /**
   * Retrieves the names of all registered helper functions.
   * Includes both built-in helpers and any custom helpers that have been registered.
   *
   * @returns Array of helper function names
   *
   * @example
   * ```typescript
   * const helpers = new TemplateHelpers();
   * const allHelpers = helpers.getHelperNames();
   *
   * console.log('Available helpers:', allHelpers);
   * // Output: ['eq', 'neq', 'add', 'subtract', 'uppercase', 'lowercase', ...]
   *
   * // Check for specific helper categories
   * const mathHelpers = allHelpers.filter(name =>
   *   ['add', 'subtract', 'multiply', 'divide', 'mod', 'round'].includes(name)
   * );
   * ```
   *
   * @see {@link has} for checking individual helper existence
   * @see {@link register} for adding new helpers
   */
  getHelperNames(): string[] {
    return Array.from(this.helpers.keys());
  }

  /**
   * Parses a template expression and executes the corresponding helper function.
   * Handles both helper function calls and simple variable resolution.
   * Supports quoted string arguments, numeric literals, and context variable references.
   *
   * @param expression - Template expression to parse (without outer curly braces)
   * @param context - Context object for resolving variable references
   * @returns Result of helper execution or resolved variable value
   *
   * @example
   * ```typescript
   * const context = {
   *   user: { name: 'Alice', age: 30 },
   *   items: ['apple', 'banana', 'cherry']
   * };
   *
   * // Helper function calls
   * helpers.parseAndExecute('add user.age 5', context); // Returns: 35
   * helpers.parseAndExecute('uppercase user.name', context); // Returns: "ALICE"
   * helpers.parseAndExecute('first items', context); // Returns: "apple"
   *
   * // With string literals
   * helpers.parseAndExecute('concat "Hello " user.name', context); // Returns: "Hello Alice"
   *
   * // Complex expressions
   * helpers.parseAndExecute('eq user.age 30', context); // Returns: true
   * helpers.parseAndExecute('length items', context); // Returns: 3
   *
   * // Variable resolution (non-helper)
   * helpers.parseAndExecute('user.name', context); // Returns: "Alice"
   * ```
   *
   * @throws {Error} When helper function is not found or execution fails
   * @see {@link execute} for direct helper execution
   * @see {@link parseExpression} for expression parsing logic
   * @see {@link resolveValue} for variable resolution
   */
  parseAndExecute(expression: string, context: HelperContext): unknown {
    const trimmed = expression.trim();
    const parts = this.parseExpression(trimmed);

    if (parts.length === 0) return '';

    const helperName = parts[0];
    if (!helperName) {
      return '';
    }
    if (!this.has(helperName)) {
      // Not a helper, return as-is or resolve from context
      return this.resolveValue(helperName, context);
    }

    // Resolve arguments from context
    const args = parts.slice(1).map(arg => this.resolveValue(arg, context));

    return this.execute(helperName, ...args);
  }

  /**
   * Parses a template expression string into individual parts (helper name and arguments).
   * Handles quoted strings (both single and double quotes) and properly splits on whitespace.
   * Supports escaped quotes within quoted strings.
   *
   * @param expression - Expression string to parse
   * @returns Array of parsed parts where first element is helper name, rest are arguments
   *
   * @example
   * ```typescript
   * parseExpression('add 5 10'); // Returns: ['add', '5', '10']
   * parseExpression('concat "Hello world" user.name'); // Returns: ['concat', 'Hello world', 'user.name']
   * parseExpression('eq status "active"'); // Returns: ['eq', 'status', 'active']
   * parseExpression('replace text "old value" "new value"'); // Returns: ['replace', 'text', 'old value', 'new value']
   * ```
   *
   * @private
   * @see {@link parseAndExecute} for usage of parsed expressions
   */
  // eslint-disable-next-line class-methods-use-this
  private parseExpression(expression: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < expression.length; i += 1) {
      const char = expression[i];

      if (
        (char === '"' || char === "'") &&
        (i === 0 || expression[i - 1] !== '\\')
      ) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        } else {
          current += char;
        }
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Resolves a value from the template context or returns it as a literal.
   * Handles various data types including numbers, booleans, null, undefined, and nested object paths.
   * Performs automatic type conversion for numeric strings and boolean literals.
   *
   * @param value - String value to resolve (could be literal or context reference)
   * @param context - Template context for variable resolution
   * @returns Resolved value with appropriate type conversion
   *
   * @example
   * ```typescript
   * const context = {
   *   user: { profile: { isActive: true, score: 95 } },
   *   status: 'active',
   *   count: 42
   * };
   *
   * // Numeric literals
   * resolveValue('123', context); // Returns: 123 (number)
   * resolveValue('45.67', context); // Returns: 45.67 (number)
   * resolveValue('-10', context); // Returns: -10 (number)
   *
   * // Boolean literals
   * resolveValue('true', context); // Returns: true (boolean)
   * resolveValue('false', context); // Returns: false (boolean)
   *
   * // Special values
   * resolveValue('null', context); // Returns: null
   * resolveValue('undefined', context); // Returns: undefined
   *
   * // Context variable resolution
   * resolveValue('status', context); // Returns: "active"
   * resolveValue('count', context); // Returns: 42
   *
   * // Nested path resolution
   * resolveValue('user.profile.isActive', context); // Returns: true
   * resolveValue('user.profile.score', context); // Returns: 95
   *
   * // Unresolvable values return as strings
   * resolveValue('nonexistent.path', context); // Returns: "nonexistent.path"
   * resolveValue('literal text', context); // Returns: "literal text"
   * ```
   *
   * @private
   * @see {@link parseAndExecute} for usage in expression evaluation
   */
  // eslint-disable-next-line class-methods-use-this
  private resolveValue(value: string, context: HelperContext): unknown {
    // Check if it's a number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return Number(value);
    }

    // Check if it's a boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;

    // Try to resolve from context
    if (value.includes('.')) {
      const parts = value.split('.');
      let current: unknown = context;

      // eslint-disable-next-line no-restricted-syntax
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return value; // Return as string if can't resolve
        }
      }

      return current;
    }

    // Direct context lookup
    if (value in context) {
      return context[value];
    }

    // Return as string literal
    return value;
  }
}

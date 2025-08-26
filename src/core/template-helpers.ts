/**
 * @fileoverview Template helper functions for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T16:30:00Z
 *
 * Features: Comparison, math, string, and utility helper functions
 * Main APIs: TemplateHelpers class with various helper methods
 * Constraints: Designed for use within template expressions
 * Patterns: Pure functions for template transformations
 */

export type HelperFunction = (...args: unknown[]) => unknown;

export interface HelperContext {
  [key: string]: unknown;
}

export class TemplateHelpers {
  private helpers: Map<string, HelperFunction> = new Map();

  constructor() {
    this.registerDefaultHelpers();
  }

  /**
   * Register default helper functions
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
      Array.isArray(arr) ? [...new Set(arr)] : []
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
   * Register a custom helper function
   */
  register(name: string, fn: HelperFunction): void {
    this.helpers.set(name, fn);
  }

  /**
   * Execute a helper function
   */
  execute(name: string, ...args: unknown[]): unknown {
    const helper = this.helpers.get(name);
    if (!helper) {
      throw new Error(`Helper function '${name}' not found`);
    }
    return helper(...args);
  }

  /**
   * Check if a helper exists
   */
  has(name: string): boolean {
    return this.helpers.has(name);
  }

  /**
   * Get all registered helper names
   */
  getHelperNames(): string[] {
    return Array.from(this.helpers.keys());
  }

  /**
   * Parse and execute a helper expression
   * Format: {{helperName arg1 arg2 ...}}
   */
  parseAndExecute(expression: string, context: HelperContext): unknown {
    const trimmed = expression.trim();
    const parts = this.parseExpression(trimmed);

    if (parts.length === 0) return '';

    const helperName = parts[0];
    if (!this.has(helperName)) {
      // Not a helper, return as-is or resolve from context
      return this.resolveValue(helperName, context);
    }

    // Resolve arguments from context
    const args = parts.slice(1).map(arg => this.resolveValue(arg, context));

    return this.execute(helperName, ...args);
  }

  /**
   * Parse an expression into parts, handling quoted strings
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
   * Resolve a value from context or return as literal
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

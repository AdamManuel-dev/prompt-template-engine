/**
 * @fileoverview Variable transformation system for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T17:00:00Z
 *
 * Features: Pipe-based transformations for template variables
 * Main APIs: TemplateTransforms class
 * Constraints: Chainable transformations
 * Patterns: Unix-style pipes, functional transformations
 */

import { logger } from '../utils/logger';

export type TransformFunction = (value: unknown, ...args: unknown[]) => unknown;

export class TemplateTransforms {
  private transforms: Map<string, TransformFunction> = new Map();

  constructor() {
    this.registerDefaultTransforms();
  }

  /**
   * Register default transformation functions
   */
  private registerDefaultTransforms(): void {
    // String transformations
    this.register('upper', (value: unknown) => String(value).toUpperCase());
    this.register('lower', (value: unknown) => String(value).toLowerCase());
    this.register('capitalize', (value: unknown) => {
      const str = String(value);
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });
    this.register('title', (value: unknown) =>
      String(value)
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    );
    this.register('trim', (value: unknown) => String(value).trim());
    this.register(
      'truncate',
      (value: unknown, length: unknown = 50, suffix: unknown = '...') => {
        const str = String(value);
        const len = Number(length);
        if (str.length <= len) return str;
        return str.substring(0, len) + String(suffix);
      }
    );
    this.register(
      'padStart',
      (value: unknown, length: unknown, char: unknown = ' ') =>
        String(value).padStart(Number(length), String(char))
    );
    this.register(
      'padEnd',
      (value: unknown, length: unknown, char: unknown = ' ') =>
        String(value).padEnd(Number(length), String(char))
    );
    this.register(
      'replace',
      (value: unknown, search: unknown, replace: unknown) =>
        String(value).replace(String(search), String(replace))
    );
    this.register(
      'replaceAll',
      (value: unknown, search: unknown, replace: unknown) =>
        String(value).split(String(search)).join(String(replace))
    );
    this.register('slug', (value: unknown) =>
      String(value)
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    );
    this.register('camelCase', (value: unknown) => {
      const str = String(value);
      return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
          index === 0 ? word.toLowerCase() : word.toUpperCase()
        )
        .replace(/\s+/g, '');
    });
    this.register('snakeCase', (value: unknown) =>
      String(value)
        .replace(/\W+/g, ' ')
        .split(/ |\B(?=[A-Z])/)
        .map(word => word.toLowerCase())
        .join('_')
    );
    this.register('kebabCase', (value: unknown) =>
      String(value)
        .replace(/\W+/g, ' ')
        .split(/ |\B(?=[A-Z])/)
        .map(word => word.toLowerCase())
        .join('-')
    );

    // Number transformations
    this.register('abs', (value: unknown) => Math.abs(Number(value)));
    this.register('ceil', (value: unknown) => Math.ceil(Number(value)));
    this.register('floor', (value: unknown) => Math.floor(Number(value)));
    this.register('round', (value: unknown, precision: unknown = 0) => {
      const factor = 10 ** Number(precision);
      return Math.round(Number(value) * factor) / factor;
    });
    this.register('toFixed', (value: unknown, digits: unknown = 2) =>
      Number(value).toFixed(Number(digits))
    );
    this.register('toPrecision', (value: unknown, precision: unknown = 2) =>
      Number(value).toPrecision(Number(precision))
    );
    this.register('toExponential', (value: unknown, digits?: unknown) =>
      digits !== undefined
        ? Number(value).toExponential(Number(digits))
        : Number(value).toExponential()
    );
    this.register('parseInt', (value: unknown, radix: unknown = 10) =>
      parseInt(String(value), Number(radix))
    );
    this.register('parseFloat', (value: unknown) => parseFloat(String(value)));

    // Array transformations
    this.register('first', (value: unknown, count: unknown = 1) => {
      if (!Array.isArray(value)) return value;
      const n = Number(count);
      return n === 1 ? value[0] : value.slice(0, n);
    });
    this.register('last', (value: unknown, count: unknown = 1) => {
      if (!Array.isArray(value)) return value;
      const n = Number(count);
      return n === 1 ? value[value.length - 1] : value.slice(-n);
    });
    this.register('reverse', (value: unknown) =>
      Array.isArray(value)
        ? [...value].reverse()
        : String(value).split('').reverse().join('')
    );
    this.register('sort', (value: unknown) =>
      Array.isArray(value) ? [...value].sort() : value
    );
    this.register('sortBy', (value: unknown, key: unknown) => {
      if (!Array.isArray(value)) return value;
      return [...value].sort((a, b) => {
        const aVal = a[String(key)];
        const bVal = b[String(key)];
        if (aVal < bVal) return -1;
        if (aVal > bVal) return 1;
        return 0;
      });
    });
    this.register('unique', (value: unknown) =>
      Array.isArray(value) ? Array.from(new Set(value)) : value
    );
    this.register('join', (value: unknown, separator: unknown = ',') =>
      Array.isArray(value) ? value.join(String(separator)) : String(value)
    );
    this.register('slice', (value: unknown, start: unknown, end?: unknown) => {
      if (Array.isArray(value)) {
        return end !== undefined
          ? value.slice(Number(start), Number(end))
          : value.slice(Number(start));
      }
      const str = String(value);
      return end !== undefined
        ? str.slice(Number(start), Number(end))
        : str.slice(Number(start));
    });
    this.register('take', (value: unknown, count: unknown) => {
      if (!Array.isArray(value)) return value;
      return value.slice(0, Number(count));
    });
    this.register('skip', (value: unknown, count: unknown) => {
      if (!Array.isArray(value)) return value;
      return value.slice(Number(count));
    });
    this.register(
      'filter',
      (value: unknown, key: unknown, expected: unknown) => {
        if (!Array.isArray(value)) return value;
        return value.filter(item => item[String(key)] === expected);
      }
    );
    this.register('map', (value: unknown, key: unknown) => {
      if (!Array.isArray(value)) return value;
      return value.map(item => item[String(key)]);
    });

    // Date transformations
    this.register('date', (value: unknown, format?: unknown) => {
      const date = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(date.getTime())) return value;

      if (!format) return date.toISOString();

      switch (format) {
        case 'iso':
          return date.toISOString();
        case 'date':
          return date.toDateString();
        case 'time':
          return date.toTimeString();
        case 'locale':
          return date.toLocaleString();
        case 'localeDate':
          return date.toLocaleDateString();
        case 'localeTime':
          return date.toLocaleTimeString();
        case 'year':
          return date.getFullYear();
        case 'month':
          return date.getMonth() + 1;
        case 'day':
          return date.getDate();
        case 'hour':
          return date.getHours();
        case 'minute':
          return date.getMinutes();
        case 'second':
          return date.getSeconds();
        default:
          return date.toString();
      }
    });
    this.register('timestamp', (value: unknown) => {
      const date = value instanceof Date ? value : new Date(String(value));
      return date.getTime();
    });
    this.register('fromNow', (value: unknown) => {
      const date = value instanceof Date ? value : new Date(String(value));
      const now = new Date();
      const diff = now.getTime() - date.getTime();

      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`;
      if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
      if (minutes > 0)
        return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
      return `${seconds} second${seconds === 1 ? '' : 's'} ago`;
    });

    // Format transformations
    this.register('json', (value: unknown, indent: unknown = 2) =>
      JSON.stringify(value, null, Number(indent))
    );
    this.register('yaml', (value: unknown) => {
      // Simple YAML formatter (not full spec)
      const formatValue = (v: unknown, depth = 0): string => {
        const indent = '  '.repeat(depth);
        if (v === null) return 'null';
        if (v === undefined) return 'undefined';
        if (typeof v === 'boolean' || typeof v === 'number') return String(v);
        if (typeof v === 'string')
          return v.includes('\n')
            ? `|\n${indent}  ${v.replace(/\n/g, `\n${indent}  `)}`
            : v;
        if (Array.isArray(v)) {
          return v
            .map(item => `\n${indent}- ${formatValue(item, depth + 1)}`)
            .join('');
        }
        if (typeof v === 'object') {
          return Object.entries(v)
            .map(
              ([key, val]) =>
                `\n${indent}${key}: ${formatValue(val, depth + 1)}`
            )
            .join('');
        }
        return String(v);
      };
      return formatValue(value).trim();
    });
    this.register('csv', (value: unknown) => {
      if (!Array.isArray(value)) return String(value);
      return value
        .map(row => {
          if (Array.isArray(row)) {
            return row
              .map(cell => `"${String(cell).replace(/"/g, '""')}"`)
              .join(',');
          }
          return String(row);
        })
        .join('\n');
    });
    this.register('urlEncode', (value: unknown) =>
      encodeURIComponent(String(value))
    );
    this.register('urlDecode', (value: unknown) =>
      decodeURIComponent(String(value))
    );
    this.register('base64Encode', (value: unknown) =>
      Buffer.from(String(value)).toString('base64')
    );
    this.register('base64Decode', (value: unknown) =>
      Buffer.from(String(value), 'base64').toString()
    );
    this.register('escape', (value: unknown) => {
      const str = String(value);
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    });
    this.register('unescape', (value: unknown) => {
      const str = String(value);
      return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    });

    // Utility transformations
    this.register('default', (value: unknown, defaultValue: unknown) =>
      value != null && value !== '' ? value : defaultValue
    );
    this.register(
      'ternary',
      (value: unknown, trueValue: unknown, falseValue: unknown) =>
        value ? trueValue : falseValue
    );
    this.register('typeof', (value: unknown) => typeof value);
    this.register('length', (value: unknown) => {
      if (Array.isArray(value)) return value.length;
      if (typeof value === 'string') return value.length;
      if (typeof value === 'object' && value !== null)
        return Object.keys(value).length;
      return 0;
    });
    this.register('keys', (value: unknown) =>
      typeof value === 'object' && value !== null ? Object.keys(value) : []
    );
    this.register('values', (value: unknown) =>
      typeof value === 'object' && value !== null ? Object.values(value) : []
    );
    this.register('entries', (value: unknown) =>
      typeof value === 'object' && value !== null ? Object.entries(value) : []
    );
  }

  /**
   * Register a custom transformation
   */
  register(name: string, fn: TransformFunction): void {
    this.transforms.set(name, fn);
  }

  /**
   * Apply a transformation
   */
  apply(name: string, value: unknown, ...args: unknown[]): unknown {
    const transform = this.transforms.get(name);
    if (!transform) {
      logger.warn(`Transform '${name}' not found`);
      return value;
    }
    return transform(value, ...args);
  }

  /**
   * Check if a transform exists
   */
  has(name: string): boolean {
    return this.transforms.has(name);
  }

  /**
   * Apply a chain of transformations
   * Format: value | transform1 | transform2:arg1,arg2 | transform3
   */
  applyChain(value: unknown, chain: string): unknown {
    const transforms = chain.split('|').map(t => t.trim());

    return transforms.reduce((currentValue, transform) => {
      if (!transform) return currentValue;

      // Parse transform and arguments
      const colonIndex = transform.indexOf(':');
      let transformName: string;
      let args: unknown[] = [];

      if (colonIndex !== -1) {
        transformName = transform.substring(0, colonIndex).trim();
        const argsString = transform.substring(colonIndex + 1);
        args = this.parseArguments(argsString);
      } else {
        transformName = transform;
      }

      return this.apply(transformName, currentValue, ...args);
    }, value);
  }

  /**
   * Parse transform arguments
   */
  private parseArguments(argsString: string): unknown[] {
    const args: unknown[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < argsString.length; i += 1) {
      const char = argsString[i];

      if (
        (char === '"' || char === "'") &&
        (i === 0 || argsString[i - 1] !== '\\')
      ) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          args.push(current);
          current = '';
          quoteChar = '';
        } else {
          current += char;
        }
      } else if (char === ',' && !inQuotes) {
        if (current) {
          args.push(this.parseValue(current.trim()));
          current = '';
        }
      } else if (!(char === '"' || char === "'") || inQuotes) {
        current += char;
      }
    }

    if (current) {
      args.push(this.parseValue(current.trim()));
    }

    return args;
  }

  /**
   * Parse a value from string
   */
  // eslint-disable-next-line class-methods-use-this
  private parseValue(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
    return value;
  }
}

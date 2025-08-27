/**
 * @fileoverview Template content sanitizer with comprehensive XSS protection
 * @lastmodified 2025-08-27T16:15:00Z
 *
 * Features: XSS sanitization, content validation, safe template processing
 * Main APIs: TemplateSanitizer.sanitize(), validateTemplateContent()
 * Constraints: All template content must be sanitized before rendering
 * Patterns: Sanitization pipeline, threat detection, content filtering
 */

import { z } from 'zod';
import { ValidationError } from '../errors';
import { customValidators, SecurityValidationResult } from '../validation/schemas';
import { logger } from '../utils/logger';

/**
 * Sanitization configuration
 */
export interface SanitizationConfig {
  removeScripts: boolean;
  removeEventHandlers: boolean;
  removeDangerousProtocols: boolean;
  removeComments: boolean;
  normalizeWhitespace: boolean;
  maxContentLength: number;
  allowedTags: string[];
  allowedAttributes: string[];
  allowedProtocols: string[];
  enableStrictMode: boolean;
}

/**
 * Default sanitization configuration
 */
export const DEFAULT_SANITIZATION_CONFIG: SanitizationConfig = {
  removeScripts: true,
  removeEventHandlers: true,
  removeDangerousProtocols: true,
  removeComments: true,
  normalizeWhitespace: true,
  maxContentLength: 1000000, // 1MB
  allowedTags: [
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 'u', 'i', 'b', 'br', 'hr', 'pre', 'code',
    'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody'
  ],
  allowedAttributes: [
    'class', 'id', 'style', 'title', 'alt', 'src', 'href', 'target'
  ],
  allowedProtocols: ['http:', 'https:', 'mailto:'],
  enableStrictMode: true,
};

/**
 * Sanitization result
 */
export interface SanitizationResult {
  sanitized: string;
  original: string;
  threatsRemoved: string[];
  warningsGenerated: string[];
  bytesSaved: number;
  isClean: boolean;
}

/**
 * Template content sanitizer
 */
export class TemplateSanitizer {
  private config: SanitizationConfig;

  constructor(config: Partial<SanitizationConfig> = {}) {
    this.config = { ...DEFAULT_SANITIZATION_CONFIG, ...config };
  }

  /**
   * Sanitize template content with comprehensive XSS protection
   */
  sanitize(content: string, options?: Partial<SanitizationConfig>): SanitizationResult {
    const effectiveConfig = { ...this.config, ...options };
    const original = content;
    const threatsRemoved: string[] = [];
    const warningsGenerated: string[] = [];
    let sanitized = content;

    // Check content length
    if (sanitized.length > effectiveConfig.maxContentLength) {
      throw new ValidationError(
        `Content too large: ${sanitized.length} bytes (max ${effectiveConfig.maxContentLength})`
      );
    }

    // Remove script tags and content
    if (effectiveConfig.removeScripts) {
      const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gsi;
      if (scriptPattern.test(sanitized)) {
        threatsRemoved.push('Script tags removed');
        sanitized = sanitized.replace(scriptPattern, '');
      }

      // Remove javascript: protocols
      const jsProtocolPattern = /javascript\s*:/gsi;
      if (jsProtocolPattern.test(sanitized)) {
        threatsRemoved.push('JavaScript protocols removed');
        sanitized = sanitized.replace(jsProtocolPattern, '');
      }

      // Remove vbscript: protocols
      const vbsProtocolPattern = /vbscript\s*:/gsi;
      if (vbsProtocolPattern.test(sanitized)) {
        threatsRemoved.push('VBScript protocols removed');
        sanitized = sanitized.replace(vbsProtocolPattern, '');
      }

      // Remove data: URLs with JavaScript
      const dataJsPattern = /data\s*:[^;]*;[^,]*(?:javascript|script)[^,]*,/gsi;
      if (dataJsPattern.test(sanitized)) {
        threatsRemoved.push('Data URLs with JavaScript removed');
        sanitized = sanitized.replace(dataJsPattern, 'data:text/plain,');
      }
    }

    // Remove event handlers
    if (effectiveConfig.removeEventHandlers) {
      const eventHandlerPattern = /on\w+\s*=\s*["'][^"']*["']/gsi;
      if (eventHandlerPattern.test(sanitized)) {
        threatsRemoved.push('Event handlers removed');
        sanitized = sanitized.replace(eventHandlerPattern, '');
      }

      // Remove event handlers without quotes
      const eventHandlerNoQuotesPattern = /on\w+\s*=\s*[^\s>]+/gsi;
      if (eventHandlerNoQuotesPattern.test(sanitized)) {
        threatsRemoved.push('Unquoted event handlers removed');
        sanitized = sanitized.replace(eventHandlerNoQuotesPattern, '');
      }
    }

    // Remove dangerous protocols
    if (effectiveConfig.removeDangerousProtocols) {
      const dangerousProtocols = ['file:', 'ftp:', 'jar:', 'data:', 'javascript:', 'vbscript:'];
      for (const protocol of dangerousProtocols) {
        const protocolPattern = new RegExp(protocol.replace(':', '\\s*:'), 'gsi');
        if (protocolPattern.test(sanitized)) {
          threatsRemoved.push(`${protocol} protocol removed`);
          sanitized = sanitized.replace(protocolPattern, 'about:');
        }
      }
    }

    // Remove HTML comments (can hide malicious content)
    if (effectiveConfig.removeComments) {
      const commentPattern = /<!--[\s\S]*?-->/g;
      if (commentPattern.test(sanitized)) {
        threatsRemoved.push('HTML comments removed');
        sanitized = sanitized.replace(commentPattern, '');
      }
    }

    // Remove dangerous HTML tags
    const dangerousTags = [
      'iframe', 'object', 'embed', 'applet', 'meta', 'base', 'link',
      'style', 'form', 'input', 'textarea', 'button', 'select'
    ];

    for (const tag of dangerousTags) {
      const tagPattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gsi');
      if (tagPattern.test(sanitized)) {
        threatsRemoved.push(`Dangerous ${tag} tags removed`);
        sanitized = sanitized.replace(tagPattern, '');
      }
    }

    // Strict mode additional checks
    if (effectiveConfig.enableStrictMode) {
      // Remove any remaining HTML if not in allowed tags
      const htmlTagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
      let match;
      const disallowedTags: string[] = [];

      while ((match = htmlTagPattern.exec(sanitized)) !== null) {
        const tagName = match[1].toLowerCase();
        if (!effectiveConfig.allowedTags.includes(tagName)) {
          disallowedTags.push(tagName);
        }
      }

      for (const tag of [...new Set(disallowedTags)]) {
        const tagPattern = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gsi');
        sanitized = sanitized.replace(tagPattern, '');
        warningsGenerated.push(`Disallowed tag '${tag}' removed`);
      }

      // Remove disallowed attributes
      const attributePattern = /(\w+)\s*=\s*["']([^"']*)["']/g;
      sanitized = sanitized.replace(attributePattern, (match, attrName, attrValue) => {
        if (!effectiveConfig.allowedAttributes.includes(attrName.toLowerCase())) {
          warningsGenerated.push(`Disallowed attribute '${attrName}' removed`);
          return '';
        }

        // Check for dangerous values in allowed attributes
        if (attrName.toLowerCase() === 'src' || attrName.toLowerCase() === 'href') {
          const hasValidProtocol = effectiveConfig.allowedProtocols.some(protocol =>
            attrValue.toLowerCase().startsWith(protocol)
          );
          
          if (!hasValidProtocol && attrValue.includes(':')) {
            warningsGenerated.push(`Dangerous protocol in ${attrName} removed`);
            return '';
          }
        }

        return match;
      });
    }

    // Remove potentially dangerous CSS
    const dangerousCssPattern = /(expression|behavior|@import|binding|moz-binding)/gi;
    if (dangerousCssPattern.test(sanitized)) {
      threatsRemoved.push('Dangerous CSS properties removed');
      sanitized = sanitized.replace(dangerousCssPattern, '');
    }

    // Remove CSS url() with dangerous protocols
    const cssUrlPattern = /url\s*\(\s*["']?([^"')]*?)["']?\s*\)/gi;
    sanitized = sanitized.replace(cssUrlPattern, (match, url) => {
      if (url.match(/^(javascript|vbscript|data):/i)) {
        threatsRemoved.push('Dangerous CSS url() removed');
        return 'url(about:blank)';
      }
      return match;
    });

    // Normalize whitespace
    if (effectiveConfig.normalizeWhitespace) {
      // Remove excessive whitespace but preserve intentional formatting
      sanitized = sanitized
        .replace(/\s+/g, ' ') // Multiple spaces to single space
        .replace(/\n\s*\n/g, '\n') // Multiple newlines to single newline
        .trim();
    }

    // Additional security checks
    const additionalThreats = this.detectAdditionalThreats(sanitized);
    if (additionalThreats.length > 0) {
      threatsRemoved.push(...additionalThreats);
      sanitized = this.removeAdditionalThreats(sanitized);
    }

    const bytesSaved = original.length - sanitized.length;
    const isClean = threatsRemoved.length === 0 && warningsGenerated.length === 0;

    return {
      sanitized,
      original,
      threatsRemoved,
      warningsGenerated,
      bytesSaved,
      isClean,
    };
  }

  /**
   * Validate template content before processing
   */
  validateTemplateContent(content: string): SecurityValidationResult {
    const threats: string[] = [];
    let threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Use existing content safety validator
    const contentSafety = customValidators.isContentSafe(content);
    if (!contentSafety.safe) {
      threats.push(...contentSafety.threats);
    }

    // Check for template injection attempts
    const templateInjectionPatterns = [
      /\{\{\s*[^}]*(?:eval|function|constructor|__proto__|prototype)[^}]*\}\}/i,
      /\{\{\s*[^}]*(?:process|require|import|global|window)[^}]*\}\}/i,
      /\{\{\s*[^}]*(?:\[|\]|\(|\)|;|=|\+)[^}]*\}\}/,
    ];

    for (const pattern of templateInjectionPatterns) {
      if (pattern.test(content)) {
        threats.push('Template injection pattern detected');
        threatLevel = 'high';
        break;
      }
    }

    // Check for excessive template complexity
    const templateCount = (content.match(/\{\{/g) || []).length;
    if (templateCount > 100) {
      threats.push(`Excessive template complexity: ${templateCount} template expressions`);
      threatLevel = threatLevel === 'low' ? 'medium' : threatLevel;
    }

    // Check for deeply nested structures
    const maxNesting = this.getMaxNesting(content);
    if (maxNesting > 10) {
      threats.push(`Deeply nested template structure: ${maxNesting} levels`);
      threatLevel = threatLevel === 'low' ? 'medium' : threatLevel;
    }

    // Determine final threat level
    if (threats.length > 5) {
      threatLevel = 'critical';
    } else if (threats.some(t => t.includes('injection') || t.includes('script'))) {
      threatLevel = 'high';
    } else if (threats.length > 2) {
      threatLevel = 'medium';
    }

    return {
      valid: threatLevel !== 'critical',
      errors: threatLevel === 'critical' ? threats : [],
      warnings: threatLevel !== 'critical' ? threats : [],
      threatLevel,
      sanitized: threatLevel !== 'critical' ? this.sanitize(content).sanitized : undefined,
    };
  }

  /**
   * Sanitize template variables
   */
  sanitizeTemplateVariables(variables: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(variables)) {
      // Validate key name
      if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
        logger.warn(`Skipping variable with invalid name: ${key}`);
        continue;
      }

      // Sanitize value based on type
      sanitized[key] = this.sanitizeValue(value);
    }

    return sanitized;
  }

  /**
   * Sanitize individual values
   */
  private sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
      const sanitizationResult = this.sanitize(value, { enableStrictMode: false });
      return sanitizationResult.sanitized;
    }

    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item));
    }

    if (value && typeof value === 'object' && value !== null) {
      const sanitizedObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        if (typeof key === 'string' && key.length < 100) {
          sanitizedObj[key] = this.sanitizeValue(val);
        }
      }
      return sanitizedObj;
    }

    return value;
  }

  /**
   * Detect additional security threats
   */
  private detectAdditionalThreats(content: string): string[] {
    const threats: string[] = [];

    // Check for base64 encoded content that might be malicious
    const base64Pattern = /[a-zA-Z0-9+\/]{40,}={0,2}/g;
    const base64Matches = content.match(base64Pattern);
    if (base64Matches) {
      for (const match of base64Matches) {
        try {
          const decoded = Buffer.from(match, 'base64').toString('utf8');
          if (/<script|javascript:|eval\(/.test(decoded)) {
            threats.push('Base64 encoded malicious content detected');
          }
        } catch {
          // Invalid base64, ignore
        }
      }
    }

    // Check for hex encoded content
    const hexPattern = /\\x[0-9a-fA-F]{2}/g;
    if (hexPattern.test(content)) {
      threats.push('Hex encoded content detected');
    }

    // Check for unicode escapes
    const unicodePattern = /\\u[0-9a-fA-F]{4}/g;
    if (unicodePattern.test(content)) {
      threats.push('Unicode escape sequences detected');
    }

    // Check for potential template injection
    if (/\$\{[^}]*\}/g.test(content)) {
      threats.push('Template literal injection detected');
    }

    return threats;
  }

  /**
   * Remove additional threats
   */
  private removeAdditionalThreats(content: string): string {
    let cleaned = content;

    // Remove base64 encoded content (conservative approach)
    cleaned = cleaned.replace(/[a-zA-Z0-9+\/]{40,}={0,2}/g, '[base64-removed]');

    // Remove hex encoded content
    cleaned = cleaned.replace(/\\x[0-9a-fA-F]{2}/g, '');

    // Remove unicode escapes
    cleaned = cleaned.replace(/\\u[0-9a-fA-F]{4}/g, '');

    // Remove template literals
    cleaned = cleaned.replace(/\$\{[^}]*\}/g, '${...}');

    return cleaned;
  }

  /**
   * Calculate maximum nesting level in content
   */
  private getMaxNesting(content: string): number {
    let maxLevel = 0;
    let currentLevel = 0;

    for (let i = 0; i < content.length - 1; i++) {
      if (content[i] === '{' && content[i + 1] === '{') {
        currentLevel++;
        maxLevel = Math.max(maxLevel, currentLevel);
        i++; // Skip next character
      } else if (content[i] === '}' && content[i + 1] === '}') {
        currentLevel = Math.max(0, currentLevel - 1);
        i++; // Skip next character
      }
    }

    return maxLevel;
  }

  /**
   * Get sanitization statistics
   */
  getStats(): {
    totalSanitizations: number;
    totalThreatsRemoved: number;
    totalBytesSaved: number;
    averageBytesSaved: number;
  } {
    // This would be implemented with persistent storage in a real application
    return {
      totalSanitizations: 0,
      totalThreatsRemoved: 0,
      totalBytesSaved: 0,
      averageBytesSaved: 0,
    };
  }
}

/**
 * Global template sanitizer instance
 */
export const templateSanitizer = new TemplateSanitizer();

/**
 * Utility function for quick template sanitization
 */
export function sanitizeTemplate(
  content: string,
  config?: Partial<SanitizationConfig>
): string {
  return templateSanitizer.sanitize(content, config).sanitized;
}

/**
 * Utility function for template content validation
 */
export function validateTemplate(content: string): SecurityValidationResult {
  return templateSanitizer.validateTemplateContent(content);
}

/**
 * Template sanitization decorator
 */
export function SanitizeTemplateContent(config?: Partial<SanitizationConfig>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (content: string, ...args: any[]) {
      const sanitized = templateSanitizer.sanitize(content, config).sanitized;
      return originalMethod.call(this, sanitized, ...args);
    };

    return descriptor;
  };
}
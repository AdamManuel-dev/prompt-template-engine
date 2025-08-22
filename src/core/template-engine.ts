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
  private variablePattern = /\{\{(\s*[\w.]+\s*)\}\}/g;

  /**
   * Render a template string with variables
   */
  async render(template: string, context: TemplateContext): Promise<string> {
    return template.replace(this.variablePattern, (match, variable) => {
      const key = variable.trim();
      const value = this.resolveVariable(key, context);
      return value !== undefined ? String(value) : match;
    });
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
    return this.variablePattern.test(template);
  }

  /**
   * Extract variable names from a template
   */
  extractVariables(template: string): string[] {
    const variables = new Set<string>();
    let match;

    // Reset regex lastIndex
    this.variablePattern.lastIndex = 0;

    // eslint-disable-next-line no-cond-assign
    while ((match = this.variablePattern.exec(template)) !== null) {
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

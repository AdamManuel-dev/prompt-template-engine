/**
 * @fileoverview Partial template management for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T16:45:00Z
 *
 * Features: Register and render partial templates
 * Main APIs: TemplatePartials class
 * Constraints: Circular dependency detection, depth limits
 * Patterns: Template composition, reusable components
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PartialContext {
  [key: string]: unknown;
}

export class TemplatePartials {
  private partials: Map<string, string> = new Map();

  private partialsDir: string = '';

  private maxDepth = 10;

  private renderStack: Set<string> = new Set();

  /**
   * Set the directory for partial templates
   */
  setPartialsDirectory(dir: string): void {
    this.partialsDir = dir;
  }

  /**
   * Register a partial template
   */
  register(name: string, template: string): void {
    this.partials.set(name, template);
  }

  /**
   * Register a partial from file
   */
  registerFromFile(name: string, filePath: string): void {
    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.partialsDir, filePath);

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Partial file not found: ${absolutePath}`);
      }

      const content = fs.readFileSync(absolutePath, 'utf-8');
      this.register(name, content);
    } catch (error) {
      throw new Error(`Failed to register partial from file: ${error}`);
    }
  }

  /**
   * Load all partials from a directory
   */
  loadFromDirectory(dir?: string): void {
    const targetDir = dir || this.partialsDir;

    if (!targetDir || !fs.existsSync(targetDir)) {
      return;
    }

    try {
      const files = fs.readdirSync(targetDir);

      // eslint-disable-next-line no-restricted-syntax
      for (const file of files) {
        if (
          file.endsWith('.hbs') ||
          file.endsWith('.handlebars') ||
          file.endsWith('.partial')
        ) {
          const name = path.basename(file, path.extname(file));
          const filePath = path.join(targetDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          this.register(name, content);
        }
      }
    } catch (error) {
      console.error(`Failed to load partials from directory: ${error}`);
    }
  }

  /**
   * Get a partial template
   */
  get(name: string): string | undefined {
    return this.partials.get(name);
  }

  /**
   * Check if a partial exists
   */
  has(name: string): boolean {
    return this.partials.has(name);
  }

  /**
   * Get all partial names
   */
  getPartialNames(): string[] {
    return Array.from(this.partials.keys());
  }

  /**
   * Clear all partials
   */
  clear(): void {
    this.partials.clear();
  }

  /**
   * Process partial references in a template
   * Syntax: {{> partialName}}
   * With context: {{> partialName context}}
   */
  processPartials(
    template: string,
    context: PartialContext,
    renderCallback: (template: string, ctx: PartialContext) => string,
    depth = 0
  ): string {
    if (depth > this.maxDepth) {
      throw new Error('Maximum partial nesting depth exceeded');
    }

    // Pattern to match {{> partialName}} or {{> partialName contextVar}}
    const partialPattern = /\{\{>\s*([a-zA-Z][\w]*)\s*([^}]*)\s*\}\}/g;

    return template.replace(
      partialPattern,
      (match, partialName, contextExpression) => {
        // Check for circular dependencies
        if (this.renderStack.has(partialName)) {
          throw new Error(
            `Circular partial dependency detected: ${partialName}`
          );
        }

        const partial = this.get(partialName);
        if (!partial) {
          console.warn(`Partial not found: ${partialName}`);
          return match; // Return original if partial not found
        }

        // Determine the context for the partial
        let partialContext = context;
        if (contextExpression.trim()) {
          const contextVar = contextExpression.trim();
          // Try to resolve the context variable
          if (contextVar in context) {
            const contextValue = context[contextVar];
            if (typeof contextValue === 'object' && contextValue !== null) {
              partialContext = contextValue as PartialContext;
            }
          }
        }

        // Add to render stack to detect circular dependencies
        this.renderStack.add(partialName);

        try {
          // Recursively process the partial
          let processedPartial = this.processPartials(
            partial,
            partialContext,
            renderCallback,
            depth + 1
          );

          // Render the partial with the template engine
          processedPartial = renderCallback(processedPartial, partialContext);

          return processedPartial;
        } finally {
          // Remove from render stack
          this.renderStack.delete(partialName);
        }
      }
    );
  }

  /**
   * Extract partial references from a template
   */
  extractPartialReferences(template: string): string[] {
    const references = new Set<string>();
    const partialPattern = /\{\{>\s*([a-zA-Z][\w]*)\s*[^}]*\s*\}\}/g;

    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = partialPattern.exec(template)) !== null) {
      references.add(match[1]);

      // Recursively extract from the partial itself
      const partial = this.get(match[1]);
      if (partial) {
        const nestedRefs = this.extractPartialReferences(partial);
        nestedRefs.forEach(ref => references.add(ref));
      }
    }

    return Array.from(references);
  }

  /**
   * Validate that all referenced partials exist
   */
  validateReferences(template: string): { valid: boolean; missing: string[] } {
    const references = this.extractPartialReferences(template);
    const missing = references.filter(ref => !this.has(ref));

    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

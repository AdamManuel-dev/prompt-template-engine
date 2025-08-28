/**
 * @fileoverview Partial template management for cursor-prompt-template-engine
 * @lastmodified 2025-08-26T11:27:59Z
 *
 * Features: Register and render partial templates
 * Main APIs: TemplatePartials class
 * Constraints: Circular dependency detection, depth limits
 * Patterns: Template composition, reusable components
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

/**
 * Context object containing variables and data available to partial templates.
 * Used for passing data to partial templates during rendering.
 *
 * @example
 * ```typescript
 * const context: PartialContext = {
 *   user: { name: "Alice", role: "admin" },
 *   settings: { theme: "dark", language: "en" }
 * };
 * ```
 */
export interface PartialContext {
  [key: string]: unknown;
}

/**
 * Template partials manager for handling reusable template components.
 * Supports registration, loading from files/directories, and rendering with context isolation.
 * Includes circular dependency detection and depth limiting for safe recursion.
 *
 * @example
 * ```typescript
 * const partials = new TemplatePartials();
 *
 * // Register a partial template
 * partials.register('userCard', `
 *   <div class="user-card">
 *     <h3>{{name}}</h3>
 *     <span class="role">{{role}}</span>
 *   </div>
 * `);
 *
 * // Load partials from directory
 * partials.setPartialsDirectory('./templates/partials');
 * partials.loadFromDirectory();
 *
 * // Use in templates: {{> userCard user}}
 * ```
 */
export class TemplatePartials {
  private partials: Map<string, string> = new Map();

  private partialsDir: string = '';

  private maxDepth = 10;

  private renderStack: Set<string> = new Set();

  /**
   * Sets the base directory path for loading partial template files.
   * This directory will be used as the root for relative file paths in partial loading operations.
   *
   * @param dir - Absolute or relative path to the partials directory
   *
   * @example
   * ```typescript
   * const partials = new TemplatePartials();
   *
   * // Set absolute path
   * partials.setPartialsDirectory('/app/templates/partials');
   *
   * // Set relative path
   * partials.setPartialsDirectory('./templates/partials');
   *
   * // Load all partials from the directory
   * partials.loadFromDirectory();
   * ```
   *
   * @see {@link loadFromDirectory} for loading partials from the set directory
   * @see {@link registerFromFile} for loading individual partial files
   */
  setPartialsDirectory(dir: string): void {
    this.partialsDir = dir;
  }

  /**
   * Registers a partial template with the specified name.
   * Partial templates can be referenced in other templates using {{> partialName}} syntax.
   *
   * @param name - Unique identifier for the partial template
   * @param template - Template content as a string
   *
   * @example
   * ```typescript
   * // Register a simple partial
   * partials.register('greeting', 'Hello, {{name}}!');
   *
   * // Register a more complex partial
   * partials.register('userProfile', `
   *   <div class="profile">
   *     <img src="{{avatar}}" alt="{{name}}" />
   *     <h2>{{name}}</h2>
   *     <p>{{bio}}</p>
   *     {{#if isVerified}}<span class="verified">✓</span>{{/if}}
   *   </div>
   * `);
   *
   * // Usage in templates:
   * // {{> greeting}} or {{> userProfile user}}
   * ```
   *
   * @see {@link get} for retrieving registered partials
   * @see {@link has} for checking partial existence
   * @see {@link processPartials} for partial rendering
   */
  register(name: string, template: string): void {
    this.partials.set(name, template);
  }

  /**
   * Registers a partial template by loading it from a file.
   * Supports both absolute paths and paths relative to the configured partials directory.
   *
   * @param name - Unique identifier for the partial template
   * @param filePath - Path to the template file (absolute or relative to partials directory)
   *
   * @example
   * ```typescript
   * const partials = new TemplatePartials();
   * partials.setPartialsDirectory('./templates/partials');
   *
   * // Load with absolute path
   * partials.registerFromFile('header', '/app/templates/header.hbs');
   *
   * // Load with relative path (relative to partials directory)
   * partials.registerFromFile('footer', 'footer.hbs');
   * partials.registerFromFile('sidebar', 'components/sidebar.partial');
   *
   * // File content becomes available as {{> header}}, {{> footer}}, etc.
   * ```
   *
   * @throws {Error} When the specified file does not exist
   * @throws {Error} When file reading fails due to permissions or other IO errors
   * @see {@link register} for registering partials directly from strings
   * @see {@link loadFromDirectory} for batch loading from a directory
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
    } catch (error: any) {
      throw new Error(`Failed to register partial from file: ${error}`);
    }
  }

  /**
   * Loads all partial templates from a directory.
   * Automatically discovers and registers files with supported extensions (.hbs, .handlebars, .partial).
   * The partial name is derived from the filename without the extension.
   *
   * @param dir - Optional directory path; if not provided, uses the configured partials directory
   *
   * @example
   * ```typescript
   * const partials = new TemplatePartials();
   *
   * // Load from configured directory
   * partials.setPartialsDirectory('./templates/partials');
   * partials.loadFromDirectory(); // Loads all .hbs, .handlebars, .partial files
   *
   * // Load from specific directory
   * partials.loadFromDirectory('./components');
   *
   * // Directory structure example:
   * // ./templates/partials/
   * //   ├── header.hbs       -> becomes {{> header}}
   * //   ├── footer.hbs       -> becomes {{> footer}}
   * //   ├── userCard.partial -> becomes {{> userCard}}
   * //   └── navigation.handlebars -> becomes {{> navigation}}
   * ```
   *
   * @throws {Error} Logs error if directory reading fails (does not throw)
   * @see {@link setPartialsDirectory} for setting the default partials directory
   * @see {@link registerFromFile} for loading individual files
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
    } catch (error: any) {
      logger.error(`Failed to load partials from directory: ${error}`);
    }
  }

  /**
   * Retrieves a registered partial template by name.
   * Returns the template content as a string if found, undefined otherwise.
   *
   * @param name - Name of the partial template to retrieve
   * @returns Template content string or undefined if not found
   *
   * @example
   * ```typescript
   * partials.register('greeting', 'Hello, {{name}}!');
   *
   * const template = partials.get('greeting');
   * console.log(template); // "Hello, {{name}}!"
   *
   * const missing = partials.get('nonexistent');
   * console.log(missing); // undefined
   *
   * // Check existence before using
   * if (partials.has('greeting')) {
   *   const content = partials.get('greeting');
   *   // Safe to use content here
   * }
   * ```
   *
   * @see {@link has} for checking partial existence
   * @see {@link register} for registering partials
   */
  get(name: string): string | undefined {
    return this.partials.get(name);
  }

  /**
   * Checks whether a partial template with the specified name is registered.
   * Useful for conditional partial usage and validation before rendering.
   *
   * @param name - Name of the partial template to check
   * @returns True if the partial exists, false otherwise
   *
   * @example
   * ```typescript
   * partials.register('header', '<header>...</header>');
   *
   * console.log(partials.has('header')); // true
   * console.log(partials.has('footer')); // false
   *
   * // Conditional rendering
   * if (partials.has('sidebar')) {
   *   // Include sidebar in layout
   * }
   *
   * // Validate template dependencies
   * const requiredPartials = ['header', 'footer', 'navigation'];
   * const missing = requiredPartials.filter(name => !partials.has(name));
   * if (missing.length > 0) {
   *   console.error('Missing required partials:', missing);
   * }
   * ```
   *
   * @see {@link get} for retrieving partial content
   * @see {@link getPartialNames} for listing all available partials
   */
  has(name: string): boolean {
    return this.partials.has(name);
  }

  /**
   * Retrieves the names of all registered partial templates.
   * Useful for listing available partials, validation, and debugging.
   *
   * @returns Array of partial template names
   *
   * @example
   * ```typescript
   * partials.register('header', '<header>...</header>');
   * partials.register('footer', '<footer>...</footer>');
   * partials.register('sidebar', '<aside>...</aside>');
   *
   * const names = partials.getPartialNames();
   * console.log(names); // ['header', 'footer', 'sidebar']
   *
   * // Generate documentation
   * names.forEach(name => {
   *   console.log(`Available partial: {{> ${name}}}`);
   * });
   *
   * // Validate template references
   * const template = '{{> header}} {{> unknown}} {{> footer}}';
   * const referenced = extractPartialReferences(template);
   * const available = partials.getPartialNames();
   * const missing = referenced.filter(ref => !available.includes(ref));
   * ```
   *
   * @see {@link has} for checking individual partial existence
   * @see {@link register} for adding new partials
   */
  getPartialNames(): string[] {
    return Array.from(this.partials.keys());
  }

  /**
   * Removes all registered partial templates from memory.
   * Useful for cleanup, testing, or reloading partials from scratch.
   *
   * @example
   * ```typescript
   * partials.register('header', '<header>...</header>');
   * partials.register('footer', '<footer>...</footer>');
   *
   * console.log(partials.getPartialNames().length); // 2
   *
   * partials.clear();
   *
   * console.log(partials.getPartialNames().length); // 0
   * console.log(partials.has('header')); // false
   *
   * // Common usage in tests
   * beforeEach(() => {
   *   partials.clear();
   *   // Register test-specific partials
   * });
   *
   * // Reload partials from directory
   * partials.clear();
   * partials.loadFromDirectory('./new-partials');
   * ```
   *
   * @see {@link loadFromDirectory} for reloading partials from files
   * @see {@link register} for re-registering partials
   */
  clear(): void {
    this.partials.clear();
  }

  /**
   * Processes partial references in a template using a simplified rendering approach.
   * This method uses an identity function for rendering, returning templates unchanged.
   * For full template processing with variable substitution, use processPartials with a proper render callback.
   *
   * @param template - Template string containing partial references
   * @param context - Context object for partial resolution
   * @returns Template with partials resolved (but not fully rendered)
   *
   * @example
   * ```typescript
   * partials.register('greeting', 'Hello, {{name}}!');
   *
   * const template = '{{> greeting}} Welcome to our site.';
   * const result = partials.process(template, { name: 'Alice' });
   * // Returns: "Hello, {{name}}! Welcome to our site."
   * // Note: Variables like {{name}} are not processed in this simplified version
   * ```
   *
   * @see {@link processPartials} for full template processing with custom render callback
   */
  process(template: string, context: PartialContext): string {
    // Simple render callback that just returns the template
    const renderCallback = (tmpl: string): string => tmpl;
    return this.processPartials(template, context, renderCallback);
  }

  /**
   * Processes partial references in a template with full rendering support.
   * Supports both simple partial inclusion and context-specific rendering.
   * Includes circular dependency detection and depth limiting for safe recursion.
   *
   * Supported syntax:
   * - `{{> partialName}}` - Include partial with current context
   * - `{{> partialName contextVar}}` - Include partial with specified context variable
   *
   * @param template - Template string containing partial references
   * @param context - Context object for variable resolution and partial context
   * @param renderCallback - Function to render templates with context (enables variable substitution)
   * @param depth - Current recursion depth (used internally to prevent infinite recursion)
   * @returns Fully processed template with partials rendered and variables substituted
   *
   * @example
   * ```typescript
   * // Register partials
   * partials.register('userCard', `
   *   <div class="user">
   *     <h3>{{name}}</h3>
   *     <span>{{role}}</span>
   *   </div>
   * `);
   *
   * partials.register('userList', `
   *   {{#each users}}
   *     {{> userCard .}}
   *   {{/each}}
   * `);
   *
   * // Define render callback that processes variables
   * const renderCallback = (tmpl: string, ctx: PartialContext) => {
   *   // This would typically use your template engine
   *   return processTemplate(tmpl, ctx);
   * };
   *
   * // Process template
   * const template = `
   *   <div class="team">
   *     <h2>Team Members</h2>
   *     {{> userList}}
   *   </div>
   * `;
   *
   * const context = {
   *   users: [
   *     { name: "Alice", role: "Developer" },
   *     { name: "Bob", role: "Designer" }
   *   ]
   * };
   *
   * const result = partials.processPartials(template, context, renderCallback);
   * // Returns fully rendered HTML with user data
   * ```
   *
   * @throws {Error} When maximum nesting depth (10 levels) is exceeded
   * @throws {Error} When circular partial dependencies are detected
   * @see {@link process} for simplified processing without variable rendering
   * @see {@link extractPartialReferences} for analyzing partial dependencies
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
          logger.warn(`Partial not found: ${partialName}`);
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
   * Extracts all partial references from a template, including nested references.
   * Recursively analyzes partial templates to find all dependencies in the reference chain.
   * Useful for dependency analysis, validation, and determining load order.
   *
   * @param template - Template string to analyze for partial references
   * @returns Array of unique partial names referenced (directly or indirectly)
   *
   * @example
   * ```typescript
   * // Register nested partials
   * partials.register('header', '{{> navigation}} <h1>{{title}}</h1>');
   * partials.register('navigation', '<nav>{{> menuItems}}</nav>');
   * partials.register('menuItems', '<ul><li>Home</li><li>About</li></ul>');
   *
   * // Analyze dependencies
   * const template = '{{> header}} <main>{{content}}</main>';
   * const references = partials.extractPartialReferences(template);
   *
   * console.log(references);
   * // Output: ['header', 'navigation', 'menuItems']
   * // Note: Includes all nested references, not just direct ones
   *
   * // Validate all dependencies exist
   * const missing = references.filter(ref => !partials.has(ref));
   * if (missing.length > 0) {
   *   console.error('Missing partials:', missing);
   * }
   *
   * // Determine load order for file-based partials
   * const dependencies = partials.extractPartialReferences(mainTemplate);
   * dependencies.forEach(dep => {
   *   if (!partials.has(dep)) {
   *     partials.registerFromFile(dep, `${dep}.hbs`);
   *   }
   * });
   * ```
   *
   * @see {@link validateReferences} for comprehensive dependency validation
   * @see {@link processPartials} for partial processing that uses these references
   */
  extractPartialReferences(template: string): string[] {
    const references = new Set<string>();
    const partialPattern = /\{\{>\s*([a-zA-Z][\w]*)\s*[^}]*\s*\}\}/g;

    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = partialPattern.exec(template)) !== null) {
      const partialName = match[1];
      if (!partialName) {
        continue;
      }
      references.add(partialName);

      // Recursively extract from the partial itself
      const partial = this.get(partialName);
      if (partial) {
        const nestedRefs = this.extractPartialReferences(partial);
        nestedRefs.forEach(ref => references.add(ref));
      }
    }

    return Array.from(references);
  }

  /**
   * Validates that all partial references in a template have corresponding registered partials.
   * Performs comprehensive analysis including nested partial dependencies.
   *
   * @param template - Template string to validate
   * @returns Validation result with status and list of missing partials
   *
   * @example
   * ```typescript
   * // Register some partials
   * partials.register('header', '{{> navigation}} <h1>{{title}}</h1>');
   * partials.register('footer', '<footer>{{year}}</footer>');
   * // Note: 'navigation' partial is referenced but not registered
   *
   * const template = `
   *   {{> header}}
   *   <main>{{content}}</main>
   *   {{> footer}}
   *   {{> sidebar}}
   * `;
   *
   * const validation = partials.validateReferences(template);
   * console.log(validation);
   * // Output: {
   * //   valid: false,
   * //   missing: ['navigation', 'sidebar']
   * // }
   *
   * // Handle validation results
   * if (!validation.valid) {
   *   console.error('Template validation failed!');
   *   console.error('Missing partials:', validation.missing);
   *
   *   // Auto-register missing partials from files
   *   validation.missing.forEach(name => {
   *     try {
   *       partials.registerFromFile(name, `${name}.hbs`);
   *     } catch (error: any) {
   *       console.error(`Could not load partial: ${name}`);
   *     }
   *   });
   * }
   * ```
   *
   * @see {@link extractPartialReferences} for the underlying reference extraction
   * @see {@link has} for checking individual partial existence
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

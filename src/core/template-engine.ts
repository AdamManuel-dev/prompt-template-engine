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
import * as path from 'path';
import { TemplateHelpers } from './template-helpers';
import { TemplatePartials } from './template-partials';
import { TemplateTransforms } from './template-transforms';
import { logger } from '../utils/logger';

export interface TemplateContext {
  [key: string]: unknown;
}

export class TemplateEngine {
  private variablePattern = /\{\{(\s*[@\w.]+\s*)\}\}/g;

  private transformPattern = /\{\{([^|}]+\|[^}]+)\}\}/g;

  private helpers: TemplateHelpers;

  private partials: TemplatePartials;

  private transforms: TemplateTransforms;

  private eachPattern = /\{\{#each\s+([\w.]+)\s*\}\}(.*?)\{\{\/each\}\}/gs;

  private ifPattern = /\{\{#if\s+([\w.@]+)\s*\}\}(.*?)\{\{\/if\}\}/gs;

  private unlessPattern =
    /\{\{#unless\s+([\w.@]+)\s*\}\}(.*?)\{\{\/unless\}\}/gs;

  private includePattern = /\{\{#include\s+["']([^"']+)["']\s*\}\}/g;

  private includedFiles = new Set<string>();

  private maxIncludeDepth = 10;

  constructor() {
    this.helpers = new TemplateHelpers();
    this.partials = new TemplatePartials();
    this.transforms = new TemplateTransforms();
  }

  /**
   * Render a template string with variables
   */
  async render(template: string, context: TemplateContext): Promise<string> {
    // Reset included files tracking for new render
    this.includedFiles.clear();

    // First process includes
    let processed = await this.processIncludes(template, context);

    // Then process conditional blocks (which handle nested #each blocks internally)
    processed = this.processConditionalBlocks(processed, context);

    // Then process any standalone #each blocks not inside conditionals
    processed = this.processEachBlocks(processed, context);

    // Process partials after conditionals and loops to ensure correct context
    processed = this.processPartials(processed, context);

    // Process helper functions
    processed = this.processHelpers(processed, context);

    // Process variable transformations
    processed = this.processTransforms(processed, context);

    // Finally process regular variables
    return this.processVariables(processed, context);
  }

  /**
   * Process variables in a template
   */
  private processVariables(template: string, context: TemplateContext): string {
    return template.replace(this.variablePattern, (match, variable) => {
      const key = variable.trim();
      const value = this.resolveVariable(key, context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Process {{#include}} directives to include external templates
   */
  private async processIncludes(
    template: string,
    context: TemplateContext,
    depth = 0
  ): Promise<string> {
    // Prevent infinite recursion
    if (depth > this.maxIncludeDepth) {
      throw new Error(
        `Maximum include depth (${this.maxIncludeDepth}) exceeded. Check for circular includes.`
      );
    }

    let result = template;
    let match;

    // Reset pattern index
    this.includePattern.lastIndex = 0;

    // Find all include directives
    const includes: Array<{ match: string; path: string }> = [];
    // eslint-disable-next-line no-cond-assign
    while ((match = this.includePattern.exec(template)) !== null) {
      includes.push({ match: match[0], path: match[1] });
    }

    // Process each include
    // eslint-disable-next-line no-await-in-loop
    for (let i = 0; i < includes.length; i += 1) {
      const include = includes[i];
      const absolutePath = this.resolveIncludePath(include.path);

      // Check for circular dependencies
      if (this.includedFiles.has(absolutePath)) {
        throw new Error(
          `Circular dependency detected: ${absolutePath} is already being processed`
        );
      }

      try {
        // Track this file to prevent circular includes
        this.includedFiles.add(absolutePath);

        // Read the included template
        // eslint-disable-next-line no-await-in-loop
        const includedContent = await fs.promises.readFile(
          absolutePath,
          'utf-8'
        );

        // Process includes recursively in the included content
        // eslint-disable-next-line no-await-in-loop
        const processedContent = await this.processIncludes(
          includedContent,
          context,
          depth + 1
        );

        // Replace the include directive with the processed content
        result = result.replace(include.match, processedContent);
      } catch (error) {
        const err = error as { code?: string };
        if (err.code === 'ENOENT') {
          throw new Error(`Include file not found: ${include.path}`);
        }
        throw error;
      } finally {
        // Remove from tracking after processing
        this.includedFiles.delete(absolutePath);
      }
    }

    return result;
  }

  /**
   * Resolve include path relative to current working directory or absolute
   */
  // eslint-disable-next-line class-methods-use-this
  private resolveIncludePath(includePath: string): string {
    // If absolute path, use as-is
    if (path.isAbsolute(includePath)) {
      return includePath;
    }

    // Otherwise resolve relative to current working directory
    return path.resolve(process.cwd(), includePath);
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

      for (let i = 0; i < eachBlocks.length; i += 1) {
        const block = eachBlocks[i];
        const blockResult = this.processSingleEachBlock(block, context, depth);
        result = result.replace(block.fullMatch, blockResult.replacement);
        if (blockResult.hasChanges) {
          changed = true;
        }
      }
    }

    return result;
  }

  /**
   * Process {{#if}} and {{#unless}} blocks for conditional rendering
   */
  // eslint-disable-next-line class-methods-use-this
  public processConditionalBlocks(
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

      // Process #if blocks (only those not inside #each blocks at depth 0)
      const ifBlocks = this.findOutermostIfBlocks(result);
      for (let i = 0; i < ifBlocks.length; i += 1) {
        const block = ifBlocks[i];
        // Skip conditionals inside #each blocks during the top-level pass
        if (depth === 0 && this.isInsideEachBlock(block, result)) {
          // Skip this block
        } else {
          const blockResult = this.processSingleIfBlock(block, context, depth);
          result = result.replace(block.fullMatch, blockResult.replacement);
          if (blockResult.hasChanges) {
            changed = true;
          }
        }
      }

      // Process #unless blocks (only those not inside #each blocks at depth 0)
      const unlessBlocks = this.findOutermostUnlessBlocks(result);
      for (let i = 0; i < unlessBlocks.length; i += 1) {
        const block = unlessBlocks[i];
        // Skip conditionals inside #each blocks during the top-level pass
        if (depth === 0 && this.isInsideEachBlock(block, result)) {
          // Skip this block
        } else {
          const blockResult = this.processSingleUnlessBlock(
            block,
            context,
            depth
          );
          result = result.replace(block.fullMatch, blockResult.replacement);
          if (blockResult.hasChanges) {
            changed = true;
          }
        }
      }
    }

    return result;
  }

  /**
   * Check if a conditional block is inside an #each block
   */
  // eslint-disable-next-line class-methods-use-this
  private isInsideEachBlock(
    block: { fullMatch: string; condition: string; innerTemplate: string },
    template: string
  ): boolean {
    const blockStart = template.indexOf(block.fullMatch);
    if (blockStart === -1) return false;

    // Find all #each blocks in the template
    const eachBlocks = this.findOutermostEachBlocks(template);

    // Check if our conditional block is inside any #each block
    for (let i = 0; i < eachBlocks.length; i += 1) {
      const eachBlock = eachBlocks[i];
      const eachStart = template.indexOf(eachBlock.fullMatch);
      const eachEnd = eachStart + eachBlock.fullMatch.length;

      if (blockStart > eachStart && blockStart < eachEnd) {
        return true;
      }
    }

    return false;
  }

  /**
   * Process a single #if block
   */
  // eslint-disable-next-line class-methods-use-this
  private processSingleIfBlock(
    block: {
      fullMatch: string;
      condition: string;
      innerTemplate: string;
      elseTemplate?: string;
    },
    context: TemplateContext,
    depth: number
  ): { replacement: string; hasChanges: boolean } {
    const conditionValue = this.evaluateCondition(
      block.condition.trim(),
      context
    );
    const isTruthy = this.isTruthy(conditionValue);

    if (isTruthy) {
      // First process any #each blocks in the inner template (which will handle their own conditionals)
      let processedInner = this.processEachBlocks(
        block.innerTemplate,
        context,
        depth + 1
      );

      // Then recursively process remaining conditional blocks
      processedInner = this.processConditionalBlocks(
        processedInner,
        context,
        depth + 1
      );

      return { replacement: processedInner, hasChanges: true };
    }

    // Process else block if it exists
    if (block.elseTemplate) {
      let processedElse = this.processEachBlocks(
        block.elseTemplate,
        context,
        depth + 1
      );

      processedElse = this.processConditionalBlocks(
        processedElse,
        context,
        depth + 1
      );

      return { replacement: processedElse, hasChanges: true };
    }

    return { replacement: '', hasChanges: true };
  }

  /**
   * Process a single #unless block
   */
  // eslint-disable-next-line class-methods-use-this
  private processSingleUnlessBlock(
    block: {
      fullMatch: string;
      condition: string;
      innerTemplate: string;
      elseTemplate?: string;
    },
    context: TemplateContext,
    depth: number
  ): { replacement: string; hasChanges: boolean } {
    const conditionValue = this.evaluateCondition(
      block.condition.trim(),
      context
    );
    const isTruthy = this.isTruthy(conditionValue);

    if (!isTruthy) {
      // First process any #each blocks in the inner template (which will handle their own conditionals)
      let processedInner = this.processEachBlocks(
        block.innerTemplate,
        context,
        depth + 1
      );

      // Then recursively process remaining conditional blocks
      processedInner = this.processConditionalBlocks(
        processedInner,
        context,
        depth + 1
      );

      return { replacement: processedInner, hasChanges: true };
    }

    // Process else block if it exists
    if (block.elseTemplate) {
      let processedElse = this.processEachBlocks(
        block.elseTemplate,
        context,
        depth + 1
      );

      processedElse = this.processConditionalBlocks(
        processedElse,
        context,
        depth + 1
      );

      return { replacement: processedElse, hasChanges: true };
    }

    return { replacement: '', hasChanges: true };
  }

  /**
   * Find only the outermost #if blocks (we'll handle nesting recursively)
   */
  // eslint-disable-next-line class-methods-use-this
  public findOutermostIfBlocks(template: string): Array<{
    fullMatch: string;
    condition: string;
    innerTemplate: string;
    elseTemplate?: string;
  }> {
    return this.findOutermostConditionalBlocks(template, 'if');
  }

  /**
   * Find only the outermost #unless blocks (we'll handle nesting recursively)
   */
  // eslint-disable-next-line class-methods-use-this
  private findOutermostUnlessBlocks(template: string): Array<{
    fullMatch: string;
    condition: string;
    innerTemplate: string;
    elseTemplate?: string;
  }> {
    return this.findOutermostConditionalBlocks(template, 'unless');
  }

  /**
   * Generic method to find outermost conditional blocks
   */
  // eslint-disable-next-line class-methods-use-this
  public findOutermostConditionalBlocks(
    template: string,
    blockType: 'if' | 'unless'
  ): Array<{
    fullMatch: string;
    condition: string;
    innerTemplate: string;
    elseTemplate?: string;
  }> {
    const blocks: Array<{
      fullMatch: string;
      condition: string;
      innerTemplate: string;
      elseTemplate?: string;
    }> = [];
    const openPattern =
      blockType === 'if'
        ? /\{\{#if\s+([^}]+)\s*\}\}/g
        : /\{\{#unless\s+([^}]+)\s*\}\}/g;
    const closeTag = `{{/${blockType}}}`;
    const elseTag = '{{else}}';

    // Reset regex lastIndex
    openPattern.lastIndex = 0;

    let match = openPattern.exec(template);
    while (match !== null) {
      const startPos = match.index;
      const condition = match[1];
      let depth = 1;
      let pos = openPattern.lastIndex;
      let elsePos = -1;

      // Find the matching closing tag and else tag
      while (depth > 0 && pos < template.length) {
        const nextOpen = template.indexOf(`{{#${blockType}`, pos);
        const nextClose = template.indexOf(closeTag, pos);
        const nextElse = template.indexOf(elseTag, pos);

        if (nextClose === -1) break; // No more closing tags

        // Check if we found an else tag at the top level
        if (
          depth === 1 &&
          nextElse !== -1 &&
          nextElse < nextClose &&
          (nextOpen === -1 || nextElse < nextOpen)
        ) {
          elsePos = nextElse;
          pos = nextElse + elseTag.length;
        } else if (nextOpen !== -1 && nextOpen < nextClose) {
          depth += 1;
          pos = nextOpen + blockType.length + 3; // Move past '{{#if' or '{{#unless'
        } else {
          depth -= 1;
          pos = nextClose + closeTag.length;
        }
      }

      if (depth === 0) {
        const endPos = pos;
        const fullMatch = template.substring(startPos, endPos);
        const innerStart = template.indexOf('}}', startPos) + 2;

        let innerTemplate: string;
        let elseTemplate: string | undefined;

        if (elsePos !== -1) {
          // We have an else clause
          innerTemplate = template.substring(innerStart, elsePos);
          const elseStart = elsePos + elseTag.length;
          const innerEnd = template.lastIndexOf(closeTag, endPos);
          elseTemplate = template.substring(elseStart, innerEnd);
        } else {
          // No else clause
          const innerEnd = template.lastIndexOf(closeTag, endPos);
          innerTemplate = template.substring(innerStart, innerEnd);
        }

        blocks.push({
          fullMatch,
          condition,
          innerTemplate,
          elseTemplate,
        });

        // Skip past this block to avoid nested blocks
        openPattern.lastIndex = endPos;
      }

      match = openPattern.exec(template);
    }

    return blocks;
  }

  /**
   * Determine if a value is truthy according to template logic
   */
  // eslint-disable-next-line class-methods-use-this
  public isTruthy(value: unknown): boolean {
    // Handle JavaScript truthiness but with template-specific rules
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      return value.length > 0;
    }
    if (typeof value === 'number') {
      return value !== 0 && !Number.isNaN(value);
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return Boolean(value);
  }

  /**
   * Process a single #each block
   */
  // eslint-disable-next-line class-methods-use-this
  private processSingleEachBlock(
    block: { fullMatch: string; arrayPath: string; innerTemplate: string },
    context: TemplateContext,
    depth: number
  ): { replacement: string; hasChanges: boolean } {
    const arrayValue = this.resolveVariable(block.arrayPath.trim(), context);

    // Handle non-array or undefined values
    if (!Array.isArray(arrayValue)) {
      return { replacement: '', hasChanges: true };
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
      let itemTemplate = this.processEachBlocks(
        block.innerTemplate,
        itemContext,
        depth + 1
      );

      // Then process conditional blocks in this iteration context
      itemTemplate = this.processConditionalBlocks(
        itemTemplate,
        itemContext,
        depth + 1
      );

      // Process partials in this iteration context
      itemTemplate = this.processPartials(itemTemplate, itemContext);

      // Process helpers in this iteration context
      itemTemplate = this.processHelpers(itemTemplate, itemContext);

      // Process transforms in this iteration context
      itemTemplate = this.processTransforms(itemTemplate, itemContext);

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

    return { replacement: processedItems.join(''), hasChanges: true };
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

    // Reset regex lastIndex
    openPattern.lastIndex = 0;

    let match = openPattern.exec(template);
    while (match !== null) {
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
          depth += 1;
          pos = nextOpen + 7; // Move past '{{#each'
        } else {
          depth -= 1;
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

      match = openPattern.exec(template);
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
      this.variablePattern.test(template) ||
      this.eachPattern.test(template) ||
      this.ifPattern.test(template) ||
      this.unlessPattern.test(template) ||
      this.includePattern.test(template)
    );
  }

  /**
   * Process helper functions in the template
   */
  private processHelpers(template: string, context: TemplateContext): string {
    let result = template;
    let iteration = 0;
    const maxIterations = 10; // Prevent infinite loops

    // Process helpers recursively to handle nested calls
    while (iteration < maxIterations) {
      const helperNames = this.helpers.getHelperNames().join('|');
      // Enhanced regex to match both space-separated and function call syntax
      const helperRegex = new RegExp(
        `\\{\\{\\s*(${helperNames})(?:\\s+([^}]+?)|\\(([^}]+)\\))?\\s*\\}\\}`,
        'g'
      );

      let hasChanges = false;
      result = result.replace(
        helperRegex,
        (match, helperName, spaceArgs, parenArgs) => {
          const args = spaceArgs || parenArgs;
          try {
            if (args) {
              let processedArgs: string;

              let argList: unknown[];

              // Check if we have parentheses args (function call syntax)
              if (parenArgs !== undefined) {
                // Function call syntax: helper(args)
                // Check if this is a single nested helper call
                const functionCallMatches = this.findFunctionCallMatches(
                  parenArgs,
                  this.helpers.getHelperNames()
                );

                if (
                  functionCallMatches.length === 1 &&
                  functionCallMatches[0].start === 0 &&
                  functionCallMatches[0].end === parenArgs.length
                ) {
                  // This is a single nested helper call, treat result as single argument
                  processedArgs = this.processEnhancedNestedHelpers(
                    parenArgs,
                    context
                  );
                  argList = [processedArgs];
                } else {
                  // This contains multiple arguments, some may be nested helpers
                  processedArgs = this.processEnhancedNestedHelpers(
                    parenArgs,
                    context
                  );

                  // For processed nested helpers, we need to parse more carefully
                  // because some parts are now literal values, not variable names
                  argList = this.parseProcessedHelperArgs(
                    processedArgs.trim(),
                    parenArgs,
                    context
                  );
                }
              } else if (spaceArgs !== undefined) {
                // Space-separated syntax
                if (spaceArgs.includes('(') && spaceArgs.includes(')')) {
                  // Traditional nested: helper (nested args) or helper arg1 (nested args)
                  processedArgs = this.processEnhancedNestedHelpers(
                    spaceArgs,
                    context
                  );

                  // Check if this is a single nested helper call like "(capitalize name)"
                  const trimmedSpaceArgs = spaceArgs.trim();
                  if (
                    trimmedSpaceArgs.startsWith('(') &&
                    trimmedSpaceArgs.endsWith(')')
                  ) {
                    // This is a single nested expression in parentheses, treat result as single argument
                    argList = [processedArgs];
                  } else {
                    // Multiple arguments with some nested expressions
                    argList = this.parseHelperArgs(
                      processedArgs.trim(),
                      context
                    );
                  }
                } else {
                  // Simple space-separated args
                  processedArgs = spaceArgs;
                  argList = this.parseHelperArgs(processedArgs.trim(), context);
                }
              } else {
                // No arguments case
                argList = [];
              }

              const helperResult = this.helpers.execute(helperName, ...argList);
              hasChanges = true;
              return helperResult !== undefined ? String(helperResult) : match;
            }

            // No arguments case
            const helperResult = this.helpers.execute(helperName);
            hasChanges = true;
            return helperResult !== undefined ? String(helperResult) : match;
          } catch (error) {
            // If helper fails, return original match
            logger.error(`Helper error: ${error}`);
            return match;
          }
        }
      );

      if (!hasChanges) break;
      iteration += 1;
    }

    return result;
  }

  /**
   * Process partial templates
   */
  private processPartials(template: string, context: TemplateContext): string {
    return this.partials.processPartials(
      template,
      context,
      (partialTemplate, partialContext) => {
        // Process the partial template synchronously
        // Note: We can't use async render here, so we do a simplified sync render
        let processed = partialTemplate;

        // Process conditionals
        processed = this.processConditionalBlocks(processed, partialContext);

        // Process each blocks
        processed = this.processEachBlocks(processed, partialContext);

        // Process helpers
        processed = this.processHelpers(processed, partialContext);

        // Process transformations
        processed = this.processTransforms(processed, partialContext);

        // Process variables
        processed = this.processVariables(processed, partialContext);

        return processed;
      }
    );
  }

  /**
   * Register a partial template
   */
  registerPartial(name: string, template: string): void {
    this.partials.register(name, template);
  }

  /**
   * Register a partial from file
   */
  registerPartialFromFile(name: string, filePath: string): void {
    this.partials.registerFromFile(name, filePath);
  }

  /**
   * Set the directory for partial templates
   */
  setPartialsDirectory(dir: string): void {
    this.partials.setPartialsDirectory(dir);
  }

  /**
   * Load all partials from a directory
   */
  loadPartials(dir?: string): void {
    this.partials.loadFromDirectory(dir);
  }

  /**
   * Process variable transformations (pipes)
   */
  private processTransforms(
    template: string,
    context: TemplateContext
  ): string {
    return template.replace(this.transformPattern, (match, expression) => {
      // Split the expression into variable and transforms
      const parts = expression.split('|');
      if (parts.length < 2) return match;

      const variablePart = parts[0].trim();
      const transformChain = parts.slice(1).join('|');

      // Resolve the variable value
      const value = this.resolveVariable(variablePart, context);

      // Apply the transformation chain
      const transformed = this.transforms.applyChain(value, transformChain);

      return transformed !== undefined ? String(transformed) : match;
    });
  }

  /**
   * Register a custom transformation
   */
  registerTransform(
    name: string,
    fn: (value: unknown, ...args: unknown[]) => unknown
  ): void {
    this.transforms.register(name, fn);
  }

  /**
   * Process enhanced nested helper calls that support both traditional and function call syntax
   */
  private processEnhancedNestedHelpers(
    argsString: string,
    context: TemplateContext
  ): string {
    let result = argsString;
    let iteration = 0;
    const maxNestedIterations = 10;

    // Continue processing until no more nested expressions are found
    while (iteration < maxNestedIterations) {
      let hasChanges = false;

      // Pattern 1: Traditional (helperName args) format
      const traditionalPattern = /\(([a-zA-Z]+)(?:\s+([^)]+))?\)/g;
      result = result.replace(
        traditionalPattern,
        (match, helperName, helperArgs) => {
          if (this.helpers.has(helperName)) {
            try {
              // Recursively process nested expressions in args
              const processedArgs = helperArgs
                ? this.processEnhancedNestedHelpers(helperArgs, context)
                : '';
              const args = processedArgs
                ? this.parseHelperArgs(processedArgs, context)
                : [];
              const helperResult = this.helpers.execute(helperName, ...args);
              hasChanges = true;
              return String(helperResult);
            } catch (error) {
              logger.error(`Nested helper error: ${error}`);
              return match;
            }
          }
          return match;
        }
      );

      // Pattern 2: Function call helperName(args) format with proper parentheses balancing
      const helperNames = this.helpers.getHelperNames();
      const functionCallMatches = this.findFunctionCallMatches(
        result,
        helperNames
      );

      // Process matches in reverse order to handle nested calls correctly
      for (let i = functionCallMatches.length - 1; i >= 0; i -= 1) {
        const match = functionCallMatches[i];
        try {
          // Recursively process nested expressions in args
          const processedArgs = match.args
            ? this.processEnhancedNestedHelpers(match.args, context)
            : '';

          let args: unknown[];
          if (processedArgs) {
            // Check if the processed args is actually a single nested helper call result
            const nestedMatches = this.findFunctionCallMatches(
              match.args || '',
              this.helpers.getHelperNames()
            );
            if (
              nestedMatches.length === 1 &&
              nestedMatches[0].start === 0 &&
              nestedMatches[0].end === (match.args || '').length
            ) {
              // This is a single nested helper result, treat as single argument
              args = [processedArgs];
            } else {
              // This contains multiple arguments, parse them
              args = this.parseHelperArgs(processedArgs, context);
            }
          } else {
            args = [];
          }

          const helperResult = this.helpers.execute(match.helperName, ...args);

          // Replace the match in the result
          result =
            result.substring(0, match.start) +
            String(helperResult) +
            result.substring(match.end);
          hasChanges = true;
        } catch (error) {
          logger.error(`Function call helper error: ${error}`);
        }
      }

      if (!hasChanges) break;
      iteration += 1;
    }

    return result;
  }

  /**
   * Find function call matches with proper parentheses balancing
   */
  // eslint-disable-next-line class-methods-use-this
  private findFunctionCallMatches(
    text: string,
    helperNames: string[]
  ): Array<{
    helperName: string;
    args: string;
    start: number;
    end: number;
  }> {
    const matches: Array<{
      helperName: string;
      args: string;
      start: number;
      end: number;
    }> = [];

    for (let i = 0; i < text.length; i += 1) {
      // Check if we're at the start of a helper name
      if (/[a-zA-Z]/.test(text[i])) {
        let j = i;
        while (j < text.length && /[a-zA-Z]/.test(text[j])) j += 1;
        const helperName = text.substring(i, j);

        // Check if this is a valid helper name followed by an opening parenthesis
        if (
          helperNames.includes(helperName) &&
          j < text.length &&
          text[j] === '('
        ) {
          // Find the matching closing parenthesis with proper nesting
          let depth = 1;
          let k = j + 1;
          while (k < text.length && depth > 0) {
            if (text[k] === '(') depth += 1;
            else if (text[k] === ')') depth -= 1;
            k += 1;
          }

          if (depth === 0) {
            const args = text.substring(j + 1, k - 1);
            matches.push({
              helperName,
              args,
              start: i,
              end: k,
            });
            i = k - 1; // Skip past this match
          }
        }
      }
    }

    return matches;
  }

  /**
   * Parse helper arguments from processed string that may contain literal values from nested helpers
   */
  private parseProcessedHelperArgs(
    processedArgsString: string,
    originalArgsString: string,
    context: TemplateContext
  ): unknown[] {
    // Find all function call matches in the original args to determine which parts were processed
    const helperMatches = this.findFunctionCallMatches(
      originalArgsString,
      this.helpers.getHelperNames()
    );

    // If no function calls were found, use regular parsing
    if (helperMatches.length === 0) {
      return this.parseHelperArgs(processedArgsString, context);
    }

    // Parse arguments treating processed function call results as literals
    const args: unknown[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < processedArgsString.length; i += 1) {
      const char = processedArgsString[i];

      if (
        (char === '"' || char === "'") &&
        (i === 0 || processedArgsString[i - 1] !== '\\')
      ) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          // Add the quoted string as-is
          args.push(current);
          current = '';
          quoteChar = '';
        } else {
          current += char;
        }
      } else if ((char === ' ' || char === ',') && !inQuotes) {
        if (current.trim()) {
          // For processed helper results, treat as literal values unless they match original variable patterns
          const trimmedCurrent = current.trim();
          if (
            this.looksLikeProcessedHelperResult(
              trimmedCurrent,
              originalArgsString
            )
          ) {
            args.push(trimmedCurrent);
          } else {
            args.push(this.resolveHelperArg(trimmedCurrent, context));
          }
          current = '';
        }
        // Skip spaces and commas outside quotes
      } else if (!(char === '"' || char === "'") || inQuotes) {
        current += char;
      }
    }

    // Add last argument if any
    if (current.trim()) {
      const trimmedCurrent = current.trim();
      if (
        this.looksLikeProcessedHelperResult(trimmedCurrent, originalArgsString)
      ) {
        args.push(trimmedCurrent);
      } else {
        args.push(this.resolveHelperArg(trimmedCurrent, context));
      }
    }

    return args;
  }

  /**
   * Check if a value looks like it came from processing a helper function
   */
  // eslint-disable-next-line class-methods-use-this
  private looksLikeProcessedHelperResult(
    value: string,
    originalArgs: string
  ): boolean {
    // If the value doesn't appear as a variable name in the original args, it's likely a processed result
    // Check if this value is a standalone word that was likely a variable in the original
    if (/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(value)) {
      // This looks like a variable name - check if it appears in the original args as a variable
      return !originalArgs.includes(value);
    }

    // If it's not a simple variable name pattern, treat it as a literal value
    return true;
  }

  /**
   * Parse helper arguments, resolving variables from context
   */
  private parseHelperArgs(
    argsString: string,
    context: TemplateContext
  ): unknown[] {
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
          // Add the quoted string as-is
          args.push(current);
          current = '';
          quoteChar = '';
        } else {
          current += char;
        }
      } else if ((char === ' ' || char === ',') && !inQuotes) {
        if (current.trim()) {
          // Resolve the argument value
          args.push(this.resolveHelperArg(current.trim(), context));
          current = '';
        }
        // Skip spaces and commas outside quotes
      } else if (!(char === '"' || char === "'") || inQuotes) {
        current += char;
      }
    }

    // Add last argument if any
    if (current.trim()) {
      args.push(this.resolveHelperArg(current.trim(), context));
    }

    return args;
  }

  /**
   * Resolve a helper argument value
   */
  private resolveHelperArg(arg: string, context: TemplateContext): unknown {
    // Check if it's a number
    if (/^-?\d+(\.\d+)?$/.test(arg)) {
      return Number(arg);
    }

    // Check if it's a boolean
    if (arg === 'true') return true;
    if (arg === 'false') return false;
    if (arg === 'null') return null;
    if (arg === 'undefined') return undefined;

    // Try to resolve from context
    return this.resolveVariable(arg, context);
  }

  /**
   * Evaluate a condition that may contain helper functions
   */
  private evaluateCondition(
    condition: string,
    context: TemplateContext
  ): unknown {
    // Check if the condition contains a helper function call
    // Pattern: (helperName arg1 arg2 ...)
    const helperCallPattern = /^\(([a-zA-Z]+)(?:\s+(.+))?\)$/;
    const match = condition.match(helperCallPattern);

    if (match) {
      const helperName = match[1];
      const argsString = match[2] || '';

      if (this.helpers.has(helperName)) {
        try {
          const args = argsString
            ? this.parseHelperArgs(argsString, context)
            : [];
          return this.helpers.execute(helperName, ...args);
        } catch (error) {
          logger.error(`Error evaluating helper condition: ${error}`);
          return false;
        }
      }
    }

    // If not a helper call, resolve as a regular variable
    return this.resolveVariable(condition, context);
  }

  /**
   * Extract variable names from a template
   */
  extractVariables(template: string): string[] {
    const variables = new Set<string>();
    let match;

    // Extract variables from included templates
    this.includePattern.lastIndex = 0;
    // eslint-disable-next-line no-cond-assign
    while ((match = this.includePattern.exec(template)) !== null) {
      const includePath = match[1];
      try {
        const absolutePath = this.resolveIncludePath(includePath);
        // Check if file exists and is readable
        if (fs.existsSync(absolutePath)) {
          const includedContent = fs.readFileSync(absolutePath, 'utf-8');
          // Recursively extract variables from included template
          const includedVars = this.extractVariables(includedContent);
          includedVars.forEach(v => variables.add(v));
        }
      } catch {
        // Silently ignore include errors during variable extraction
        // The actual error will be reported during rendering
      }
    }

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

    // Extract variables from #if blocks
    this.ifPattern.lastIndex = 0;
    // eslint-disable-next-line no-cond-assign
    while ((match = this.ifPattern.exec(template)) !== null) {
      // Add the condition variable
      variables.add(match[1].trim());

      // Extract variables from inner template
      const innerTemplate = match[2];
      const innerVariables = this.extractSimpleVariables(innerTemplate);
      innerVariables.forEach(variable => variables.add(variable));
    }

    // Extract variables from #unless blocks
    this.unlessPattern.lastIndex = 0;
    // eslint-disable-next-line no-cond-assign
    while ((match = this.unlessPattern.exec(template)) !== null) {
      // Add the condition variable
      variables.add(match[1].trim());

      // Extract variables from inner template
      const innerTemplate = match[2];
      const innerVariables = this.extractSimpleVariables(innerTemplate);
      innerVariables.forEach(variable => variables.add(variable));
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

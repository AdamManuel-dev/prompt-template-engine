"use strict";
/**
 * @fileoverview Template engine for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T19:00:00Z
 *
 * Features: Template rendering with variable substitution
 * Main APIs: TemplateEngine.render()
 * Constraints: Supports Handlebars-style variable substitution
 * Patterns: Variable replacement, template parsing
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateEngine = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const template_helpers_1 = require("./template-helpers");
const template_partials_1 = require("./template-partials");
const template_transforms_1 = require("./template-transforms");
class TemplateEngine {
    constructor() {
        this.variablePattern = /\{\{(\s*[@\w.]+\s*)\}\}/g;
        this.transformPattern = /\{\{([^|}]+\|[^}]+)\}\}/g;
        this.eachPattern = /\{\{#each\s+([\w.]+)\s*\}\}(.*?)\{\{\/each\}\}/gs;
        this.ifPattern = /\{\{#if\s+([\w.@]+)\s*\}\}(.*?)\{\{\/if\}\}/gs;
        this.unlessPattern = /\{\{#unless\s+([\w.@]+)\s*\}\}(.*?)\{\{\/unless\}\}/gs;
        this.includePattern = /\{\{#include\s+["']([^"']+)["']\s*\}\}/g;
        this.includedFiles = new Set();
        this.maxIncludeDepth = 10;
        this.helpers = new template_helpers_1.TemplateHelpers();
        this.partials = new template_partials_1.TemplatePartials();
        this.transforms = new template_transforms_1.TemplateTransforms();
    }
    /**
     * Render a template string with variables
     */
    async render(template, context) {
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
    processVariables(template, context) {
        return template.replace(this.variablePattern, (match, variable) => {
            const key = variable.trim();
            const value = this.resolveVariable(key, context);
            return value !== undefined ? String(value) : match;
        });
    }
    /**
     * Process {{#include}} directives to include external templates
     */
    async processIncludes(template, context, depth = 0) {
        // Prevent infinite recursion
        if (depth > this.maxIncludeDepth) {
            throw new Error(`Maximum include depth (${this.maxIncludeDepth}) exceeded. Check for circular includes.`);
        }
        let result = template;
        let match;
        // Reset pattern index
        this.includePattern.lastIndex = 0;
        // Find all include directives
        const includes = [];
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
                throw new Error(`Circular dependency detected: ${absolutePath} is already being processed`);
            }
            try {
                // Track this file to prevent circular includes
                this.includedFiles.add(absolutePath);
                // Read the included template
                // eslint-disable-next-line no-await-in-loop
                const includedContent = await fs.promises.readFile(absolutePath, 'utf-8');
                // Process includes recursively in the included content
                // eslint-disable-next-line no-await-in-loop
                const processedContent = await this.processIncludes(includedContent, context, depth + 1);
                // Replace the include directive with the processed content
                result = result.replace(include.match, processedContent);
            }
            catch (error) {
                const err = error;
                if (err.code === 'ENOENT') {
                    throw new Error(`Include file not found: ${include.path}`);
                }
                throw error;
            }
            finally {
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
    resolveIncludePath(includePath) {
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
    processEachBlocks(template, context, depth = 0) {
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
    processConditionalBlocks(template, context, depth = 0) {
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
                }
                else {
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
                }
                else {
                    const blockResult = this.processSingleUnlessBlock(block, context, depth);
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
    isInsideEachBlock(block, template) {
        const blockStart = template.indexOf(block.fullMatch);
        if (blockStart === -1)
            return false;
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
    processSingleIfBlock(block, context, depth) {
        const conditionValue = this.evaluateCondition(block.condition.trim(), context);
        const isTruthy = this.isTruthy(conditionValue);
        if (isTruthy) {
            // First process any #each blocks in the inner template (which will handle their own conditionals)
            let processedInner = this.processEachBlocks(block.innerTemplate, context, depth + 1);
            // Then recursively process remaining conditional blocks
            processedInner = this.processConditionalBlocks(processedInner, context, depth + 1);
            return { replacement: processedInner, hasChanges: true };
        }
        // Process else block if it exists
        if (block.elseTemplate) {
            let processedElse = this.processEachBlocks(block.elseTemplate, context, depth + 1);
            processedElse = this.processConditionalBlocks(processedElse, context, depth + 1);
            return { replacement: processedElse, hasChanges: true };
        }
        return { replacement: '', hasChanges: true };
    }
    /**
     * Process a single #unless block
     */
    // eslint-disable-next-line class-methods-use-this
    processSingleUnlessBlock(block, context, depth) {
        const conditionValue = this.evaluateCondition(block.condition.trim(), context);
        const isTruthy = this.isTruthy(conditionValue);
        if (!isTruthy) {
            // First process any #each blocks in the inner template (which will handle their own conditionals)
            let processedInner = this.processEachBlocks(block.innerTemplate, context, depth + 1);
            // Then recursively process remaining conditional blocks
            processedInner = this.processConditionalBlocks(processedInner, context, depth + 1);
            return { replacement: processedInner, hasChanges: true };
        }
        // Process else block if it exists
        if (block.elseTemplate) {
            let processedElse = this.processEachBlocks(block.elseTemplate, context, depth + 1);
            processedElse = this.processConditionalBlocks(processedElse, context, depth + 1);
            return { replacement: processedElse, hasChanges: true };
        }
        return { replacement: '', hasChanges: true };
    }
    /**
     * Find only the outermost #if blocks (we'll handle nesting recursively)
     */
    // eslint-disable-next-line class-methods-use-this
    findOutermostIfBlocks(template) {
        return this.findOutermostConditionalBlocks(template, 'if');
    }
    /**
     * Find only the outermost #unless blocks (we'll handle nesting recursively)
     */
    // eslint-disable-next-line class-methods-use-this
    findOutermostUnlessBlocks(template) {
        return this.findOutermostConditionalBlocks(template, 'unless');
    }
    /**
     * Generic method to find outermost conditional blocks
     */
    // eslint-disable-next-line class-methods-use-this
    findOutermostConditionalBlocks(template, blockType) {
        const blocks = [];
        const openPattern = blockType === 'if'
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
                if (nextClose === -1)
                    break; // No more closing tags
                // Check if we found an else tag at the top level
                if (depth === 1 &&
                    nextElse !== -1 &&
                    nextElse < nextClose &&
                    (nextOpen === -1 || nextElse < nextOpen)) {
                    elsePos = nextElse;
                    pos = nextElse + elseTag.length;
                }
                else if (nextOpen !== -1 && nextOpen < nextClose) {
                    depth += 1;
                    pos = nextOpen + blockType.length + 3; // Move past '{{#if' or '{{#unless'
                }
                else {
                    depth -= 1;
                    pos = nextClose + closeTag.length;
                }
            }
            if (depth === 0) {
                const endPos = pos;
                const fullMatch = template.substring(startPos, endPos);
                const innerStart = template.indexOf('}}', startPos) + 2;
                let innerTemplate;
                let elseTemplate;
                if (elsePos !== -1) {
                    // We have an else clause
                    innerTemplate = template.substring(innerStart, elsePos);
                    const elseStart = elsePos + elseTag.length;
                    const innerEnd = template.lastIndexOf(closeTag, endPos);
                    elseTemplate = template.substring(elseStart, innerEnd);
                }
                else {
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
    isTruthy(value) {
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
            return Object.keys(value).length > 0;
        }
        return Boolean(value);
    }
    /**
     * Process a single #each block
     */
    // eslint-disable-next-line class-methods-use-this
    processSingleEachBlock(block, context, depth) {
        const arrayValue = this.resolveVariable(block.arrayPath.trim(), context);
        // Handle non-array or undefined values
        if (!Array.isArray(arrayValue)) {
            return { replacement: '', hasChanges: true };
        }
        // Process each item in the array
        const processedItems = arrayValue.map((item, index) => {
            // Create context for this iteration
            const itemContext = {
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
            let itemTemplate = this.processEachBlocks(block.innerTemplate, itemContext, depth + 1);
            // Then process conditional blocks in this iteration context
            itemTemplate = this.processConditionalBlocks(itemTemplate, itemContext, depth + 1);
            // Process partials in this iteration context
            itemTemplate = this.processPartials(itemTemplate, itemContext);
            // Process helpers in this iteration context
            itemTemplate = this.processHelpers(itemTemplate, itemContext);
            // Process transforms in this iteration context
            itemTemplate = this.processTransforms(itemTemplate, itemContext);
            // Then process regular variables in this iteration
            return itemTemplate.replace(this.variablePattern, (_innerMatch, innerVariable) => {
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
            });
        });
        return { replacement: processedItems.join(''), hasChanges: true };
    }
    /**
     * Find only the outermost #each blocks (we'll handle nesting recursively)
     */
    // eslint-disable-next-line class-methods-use-this
    findOutermostEachBlocks(template) {
        const blocks = [];
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
                if (nextClose === -1)
                    break; // No more closing tags
                if (nextOpen !== -1 && nextOpen < nextClose) {
                    depth += 1;
                    pos = nextOpen + 7; // Move past '{{#each'
                }
                else {
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
    async renderFile(templatePath, context) {
        const template = await fs.promises.readFile(templatePath, 'utf8');
        return this.render(template, context);
    }
    /**
     * Resolve a variable from context (supports dot notation)
     */
    // eslint-disable-next-line class-methods-use-this
    resolveVariable(key, context) {
        const keys = key.split('.');
        let value = context;
        keys.forEach(k => {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            }
            else {
                value = undefined;
            }
        });
        return value;
    }
    /**
     * Check if a string contains template variables
     */
    hasVariables(template) {
        return (this.variablePattern.test(template) ||
            this.eachPattern.test(template) ||
            this.ifPattern.test(template) ||
            this.unlessPattern.test(template) ||
            this.includePattern.test(template));
    }
    /**
     * Process helper functions in the template
     */
    processHelpers(template, context) {
        let result = template;
        let iteration = 0;
        const maxIterations = 10; // Prevent infinite loops
        // Process helpers recursively to handle nested calls
        while (iteration < maxIterations) {
            const helperNames = this.helpers.getHelperNames().join('|');
            const helperRegex = new RegExp(`\\{\\{\\s*(${helperNames})(?:\\s+([^}]+))?\\s*\\}\\}`, 'g');
            let hasChanges = false;
            result = result.replace(helperRegex, (match, helperName, args) => {
                try {
                    // Check if args contain nested helpers by looking for parentheses
                    if (args && args.includes('(') && args.includes(')')) {
                        // Process nested helpers first
                        const processedArgs = this.processNestedHelpers(args, context);
                        const argList = this.parseHelperArgs(processedArgs.trim(), context);
                        const helperResult = this.helpers.execute(helperName, ...argList);
                        hasChanges = true;
                        return helperResult !== undefined ? String(helperResult) : match;
                    }
                    // Parse arguments normally
                    const argList = args
                        ? this.parseHelperArgs(args.trim(), context)
                        : [];
                    const helperResult = this.helpers.execute(helperName, ...argList);
                    hasChanges = true;
                    return helperResult !== undefined ? String(helperResult) : match;
                }
                catch (error) {
                    // If helper fails, return original match
                    console.error(`Helper error: ${error}`);
                    return match;
                }
            });
            if (!hasChanges)
                break;
            iteration += 1;
        }
        return result;
    }
    /**
     * Process partial templates
     */
    processPartials(template, context) {
        return this.partials.processPartials(template, context, (partialTemplate, partialContext) => {
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
        });
    }
    /**
     * Register a partial template
     */
    registerPartial(name, template) {
        this.partials.register(name, template);
    }
    /**
     * Register a partial from file
     */
    registerPartialFromFile(name, filePath) {
        this.partials.registerFromFile(name, filePath);
    }
    /**
     * Set the directory for partial templates
     */
    setPartialsDirectory(dir) {
        this.partials.setPartialsDirectory(dir);
    }
    /**
     * Load all partials from a directory
     */
    loadPartials(dir) {
        this.partials.loadFromDirectory(dir);
    }
    /**
     * Process variable transformations (pipes)
     */
    processTransforms(template, context) {
        return template.replace(this.transformPattern, (match, expression) => {
            // Split the expression into variable and transforms
            const parts = expression.split('|');
            if (parts.length < 2)
                return match;
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
    registerTransform(name, fn) {
        this.transforms.register(name, fn);
    }
    /**
     * Process nested helper calls in arguments
     */
    processNestedHelpers(argsString, context) {
        // Pattern to match (helperName args)
        const nestedHelperPattern = /\(([a-zA-Z]+)(?:\s+([^)]+))?\)/g;
        return argsString.replace(nestedHelperPattern, (match, helperName, helperArgs) => {
            if (this.helpers.has(helperName)) {
                try {
                    const args = helperArgs
                        ? this.parseHelperArgs(helperArgs, context)
                        : [];
                    const result = this.helpers.execute(helperName, ...args);
                    return String(result);
                }
                catch (error) {
                    console.error(`Nested helper error: ${error}`);
                    return match;
                }
            }
            return match;
        });
    }
    /**
     * Parse helper arguments, resolving variables from context
     */
    parseHelperArgs(argsString, context) {
        const args = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';
        for (let i = 0; i < argsString.length; i += 1) {
            const char = argsString[i];
            if ((char === '"' || char === "'") &&
                (i === 0 || argsString[i - 1] !== '\\')) {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = char;
                }
                else if (char === quoteChar) {
                    inQuotes = false;
                    // Add the quoted string as-is
                    args.push(current);
                    current = '';
                    quoteChar = '';
                }
                else {
                    current += char;
                }
            }
            else if (char === ' ' && !inQuotes) {
                if (current) {
                    // Resolve the argument value
                    args.push(this.resolveHelperArg(current, context));
                    current = '';
                }
            }
            else if (!(char === '"' || char === "'") || inQuotes) {
                current += char;
            }
        }
        // Add last argument if any
        if (current) {
            args.push(this.resolveHelperArg(current, context));
        }
        return args;
    }
    /**
     * Resolve a helper argument value
     */
    resolveHelperArg(arg, context) {
        // Check if it's a number
        if (/^-?\d+(\.\d+)?$/.test(arg)) {
            return Number(arg);
        }
        // Check if it's a boolean
        if (arg === 'true')
            return true;
        if (arg === 'false')
            return false;
        if (arg === 'null')
            return null;
        if (arg === 'undefined')
            return undefined;
        // Try to resolve from context
        return this.resolveVariable(arg, context);
    }
    /**
     * Evaluate a condition that may contain helper functions
     */
    evaluateCondition(condition, context) {
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
                }
                catch (error) {
                    console.error(`Error evaluating helper condition: ${error}`);
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
    extractVariables(template) {
        const variables = new Set();
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
            }
            catch {
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
    extractSimpleVariables(template) {
        const variables = new Set();
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
    validateContext(template, context) {
        const required = this.extractVariables(template);
        const missing = [];
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
exports.TemplateEngine = TemplateEngine;

"use strict";
/**
 * @fileoverview Partial template management for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T16:45:00Z
 *
 * Features: Register and render partial templates
 * Main APIs: TemplatePartials class
 * Constraints: Circular dependency detection, depth limits
 * Patterns: Template composition, reusable components
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
exports.TemplatePartials = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class TemplatePartials {
    constructor() {
        this.partials = new Map();
        this.partialsDir = '';
        this.maxDepth = 10;
        this.renderStack = new Set();
    }
    /**
     * Set the directory for partial templates
     */
    setPartialsDirectory(dir) {
        this.partialsDir = dir;
    }
    /**
     * Register a partial template
     */
    register(name, template) {
        this.partials.set(name, template);
    }
    /**
     * Register a partial from file
     */
    registerFromFile(name, filePath) {
        try {
            const absolutePath = path.isAbsolute(filePath)
                ? filePath
                : path.join(this.partialsDir, filePath);
            if (!fs.existsSync(absolutePath)) {
                throw new Error(`Partial file not found: ${absolutePath}`);
            }
            const content = fs.readFileSync(absolutePath, 'utf-8');
            this.register(name, content);
        }
        catch (error) {
            throw new Error(`Failed to register partial from file: ${error}`);
        }
    }
    /**
     * Load all partials from a directory
     */
    loadFromDirectory(dir) {
        const targetDir = dir || this.partialsDir;
        if (!targetDir || !fs.existsSync(targetDir)) {
            return;
        }
        try {
            const files = fs.readdirSync(targetDir);
            // eslint-disable-next-line no-restricted-syntax
            for (const file of files) {
                if (file.endsWith('.hbs') ||
                    file.endsWith('.handlebars') ||
                    file.endsWith('.partial')) {
                    const name = path.basename(file, path.extname(file));
                    const filePath = path.join(targetDir, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    this.register(name, content);
                }
            }
        }
        catch (error) {
            console.error(`Failed to load partials from directory: ${error}`);
        }
    }
    /**
     * Get a partial template
     */
    get(name) {
        return this.partials.get(name);
    }
    /**
     * Check if a partial exists
     */
    has(name) {
        return this.partials.has(name);
    }
    /**
     * Get all partial names
     */
    getPartialNames() {
        return Array.from(this.partials.keys());
    }
    /**
     * Clear all partials
     */
    clear() {
        this.partials.clear();
    }
    /**
     * Process partial references in a template
     * Syntax: {{> partialName}}
     * With context: {{> partialName context}}
     */
    processPartials(template, context, renderCallback, depth = 0) {
        if (depth > this.maxDepth) {
            throw new Error('Maximum partial nesting depth exceeded');
        }
        // Pattern to match {{> partialName}} or {{> partialName contextVar}}
        const partialPattern = /\{\{>\s*([a-zA-Z][\w]*)\s*([^}]*)\s*\}\}/g;
        return template.replace(partialPattern, (match, partialName, contextExpression) => {
            // Check for circular dependencies
            if (this.renderStack.has(partialName)) {
                throw new Error(`Circular partial dependency detected: ${partialName}`);
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
                        partialContext = contextValue;
                    }
                }
            }
            // Add to render stack to detect circular dependencies
            this.renderStack.add(partialName);
            try {
                // Recursively process the partial
                let processedPartial = this.processPartials(partial, partialContext, renderCallback, depth + 1);
                // Render the partial with the template engine
                processedPartial = renderCallback(processedPartial, partialContext);
                return processedPartial;
            }
            finally {
                // Remove from render stack
                this.renderStack.delete(partialName);
            }
        });
    }
    /**
     * Extract partial references from a template
     */
    extractPartialReferences(template) {
        const references = new Set();
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
    validateReferences(template) {
        const references = this.extractPartialReferences(template);
        const missing = references.filter(ref => !this.has(ref));
        return {
            valid: missing.length === 0,
            missing,
        };
    }
}
exports.TemplatePartials = TemplatePartials;

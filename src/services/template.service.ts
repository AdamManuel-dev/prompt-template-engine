/**
 * @fileoverview Template service for business logic abstraction with optimization support
 * @lastmodified 2025-08-26T16:50:00Z
 *
 * Features: Template management, rendering, validation, optimization tracking, A/B testing, version comparison
 * Main APIs: loadTemplate, renderTemplate, validateTemplate, addOptimizationData, compareTemplateVersions
 * Constraints: Abstracts file system operations from commands, maintains backward compatibility
 * Patterns: Service layer pattern, dependency injection ready, optimization-aware template management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import matter from 'gray-matter';
import { TemplateEngine, TemplateContext } from '../core/template-engine';
import {
  FileNotFoundError,
  TemplateProcessingError,
  ValidationError,
} from '../utils/errors';
import { CacheService } from './cache.service';
import type {
  OptimizedTemplate,
  OptimizationHistory,
  OptimizationMetrics,
  TemplateComparison,
} from '../types/optimized-template.types';

export interface TemplateFile {
  path: string;
  name?: string;
  content?: string;
  encoding?: string;
  mode?: string;
  source: string;
  destination: string;
  transform?: boolean;
  condition?: string;
}

export interface TemplateCommand {
  command: string;
  description?: string;
  when?: string;
}

export interface VariableConfig {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'choice';
  default?: unknown;
  required?: boolean;
  description?: string;
  choices?: unknown[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: unknown[];
  };
}

export interface Template {
  name: string;
  version?: string;
  description?: string;
  basePath?: string;
  files?: TemplateFile[];
  variables?: Record<string, VariableConfig>;
  commands?: TemplateCommand[];
  metadata?: {
    author?: string;
    tags?: string[];
    created?: string;
    updated?: string;
    category?: string;
    [key: string]: any;
  };
  // Optimization tracking fields
  isOptimized?: boolean;
  optimizationLevel?: 'none' | 'basic' | 'advanced' | 'aggressive';
  originalTemplateId?: string;
  optimizationHistory?: OptimizationHistory[];
  currentOptimizationMetrics?: OptimizationMetrics;
  // A/B testing support
  abTestVariants?: Array<{
    name: string;
    version: string;
    content: string;
    files?: TemplateFile[];
    metrics?: OptimizationMetrics;
    weight?: number;
  }>;
  activeVariant?: string;
  // Version comparison
  parentVersions?: Array<{
    version: string;
    templateId: string;
    optimizationId?: string;
    relationship: 'original' | 'optimized' | 'variant';
  }>;
}

export interface TemplateServiceOptions {
  templatePaths?: string[];
  cacheEnabled?: boolean;
  validationStrict?: boolean;
}

export class TemplateService {
  private readonly engine: TemplateEngine;

  private readonly options: TemplateServiceOptions;

  private readonly templateCache: CacheService<Template>;

  constructor(options: TemplateServiceOptions = {}) {
    this.engine = new TemplateEngine();
    this.options = {
      templatePaths: options.templatePaths || [
        './templates',
        '.cursor/templates',
      ],
      cacheEnabled: options.cacheEnabled ?? true,
      validationStrict: options.validationStrict ?? false,
    };
    this.templateCache = new CacheService<Template>({
      maxSize: 50,
      maxAge: 1000 * 60 * 30, // 30 minutes TTL for templates
    });
  }

  /**
   * Load a template from file system
   */
  async loadTemplate(templatePath: string): Promise<Template> {
    // Use cache's getOrCompute for automatic caching
    if (this.options.cacheEnabled) {
      return this.templateCache.getOrCompute(templatePath, async () =>
        this.loadTemplateFromDisk(templatePath)
      );
    }

    // Load without caching
    return this.loadTemplateFromDisk(templatePath);
  }

  /**
   * Load template from disk (internal method)
   */
  private async loadTemplateFromDisk(templatePath: string): Promise<Template> {
    // Check if path exists
    try {
      await fs.promises.access(templatePath);
    } catch (_error) {
      throw new FileNotFoundError(
        `Template not found: ${templatePath}`,
        templatePath
      );
    }

    const stats = await fs.promises.stat(templatePath);
    let template: Template;

    if (stats.isDirectory()) {
      // Load from directory structure
      template = await TemplateService.loadTemplateFromDirectory(templatePath);
    } else {
      // Load from single file
      template = await TemplateService.loadTemplateFromFile(templatePath);
    }

    return template;
  }

  /**
   * Load template from a file (JSON, YAML, or Markdown with frontmatter)
   */
  private static async loadTemplateFromFile(
    filePath: string
  ): Promise<Template> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();
      let template: Template;

      if (ext === '.md') {
        // Parse markdown with frontmatter
        const parsed = matter(content);
        const frontmatter = parsed.data;

        template = {
          name: frontmatter.name || path.basename(filePath, ext),
          version: frontmatter.version || '1.0.0',
          description: frontmatter.description,
          files: [
            {
              path: `${frontmatter.name || path.basename(filePath, ext)}.md`,
              source: `${frontmatter.name || path.basename(filePath, ext)}.md`,
              destination: `${frontmatter.name || path.basename(filePath, ext)}.md`,
              content: parsed.content,
              name: frontmatter.name || path.basename(filePath, ext),
            } as any,
          ],
          variables: TemplateService.parseVariables(
            frontmatter.variables || {}
          ),
          commands: frontmatter.commands || [],
          metadata: {
            author: frontmatter.author,
            tags: frontmatter.tags || [],
            category: frontmatter.category,
          },
        };
      } else if (ext === '.yaml' || ext === '.yml') {
        // Check if YAML has frontmatter (starts with ---)
        if (content.trim().startsWith('---')) {
          // Parse YAML with frontmatter (like Markdown)
          const parsed = matter(content);
          const frontmatter = parsed.data;

          template = {
            name: frontmatter.name || path.basename(filePath, ext),
            version: frontmatter.version || '1.0.0',
            description: frontmatter.description,
            files: [
              {
                path: `${frontmatter.name || path.basename(filePath, ext)}.md`,
                source: `${frontmatter.name || path.basename(filePath, ext)}.md`,
                destination: `${frontmatter.name || path.basename(filePath, ext)}.md`,
                content: parsed.content,
                name: frontmatter.name || path.basename(filePath, ext),
              } as any,
            ],
            variables: TemplateService.parseVariables(
              frontmatter.variables || {}
            ),
            commands: frontmatter.commands || [],
            metadata: {
              author: frontmatter.author,
              tags: frontmatter.tags || [],
              category: frontmatter.category,
            },
          };
        } else {
          // Parse pure YAML file
          const parsed = yaml.load(content) as any;
          template = {
            name: parsed.name,
            version: parsed.version || '1.0.0',
            description: parsed.description,
            files: [
              {
                path: `${parsed.name}.md`,
                source: `${parsed.name}.md`,
                destination: `${parsed.name}.md`,
                content: parsed.content || '',
                name: parsed.name,
              } as any,
            ],
            variables: TemplateService.parseVariables(parsed.variables || {}),
            commands: parsed.commands || [],
            metadata: {
              author: parsed.author,
              tags: parsed.tags || [],
            },
          };
        }
      } else {
        // Parse JSON file (existing behavior)
        template = JSON.parse(content) as Template;
      }

      template.basePath = path.dirname(filePath);
      return template;
    } catch (_error) {
      throw new TemplateProcessingError(
        `Failed to load template from file: ${filePath}`,
        filePath,
        undefined,
        undefined,
        { error: (_error as Error).message }
      );
    }
  }

  /**
   * Load template from directory structure
   */
  private static async loadTemplateFromDirectory(
    dirPath: string
  ): Promise<Template> {
    const configPath = path.join(dirPath, 'template.json');

    try {
      await fs.promises.access(configPath);
    } catch (_error) {
      throw new FileNotFoundError(
        `Template configuration not found: ${configPath}`,
        configPath
      );
    }

    const template = await TemplateService.loadTemplateFromFile(configPath);
    template.basePath = dirPath;

    // Load file contents if they reference external files
    template.files = await Promise.all(
      (template.files || []).map(async file => {
        if (!file.content && file.path) {
          const filePath = path.join(dirPath, file.path);
          try {
            await fs.promises.access(filePath);
            const content = await fs.promises.readFile(filePath, 'utf8');
            return { ...file, content };
          } catch (_error) {
            // File doesn't exist, return as is
          }
        }
        return file;
      })
    );

    return template;
  }

  /**
   * Render a template with given variables
   */
  async renderTemplate(
    template: Template,
    variables: Record<string, unknown>
  ): Promise<Template> {
    // Validate variables against template requirements
    const validation = TemplateService.validateVariables(template, variables);
    if (!validation.valid) {
      throw new ValidationError(
        `Invalid template variables: ${validation.errors.join(', ')}`
      );
    }

    // Create context with defaults
    const context = TemplateService.buildContext(template, variables);

    // Render all files
    const renderedFiles = await Promise.all(
      (template.files || []).map(async file => ({
        ...file,
        content: await this.engine.render(file.content!, context),
        path: await this.engine.render(
          file.path || file.name || file.source || 'template.md',
          context
        ),
      }))
    );

    // Render commands
    const renderedCommands = template.commands
      ? await Promise.all(
          template.commands.map(async cmd => ({
            ...cmd,
            command: await this.engine.render(cmd.command, context),
          }))
        )
      : [];

    return {
      ...template,
      files: renderedFiles,
      commands: renderedCommands,
    };
  }

  /**
   * Validate template structure
   */
  static async validateTemplate(template: Template): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!template.name) {
      errors.push('Template name is required');
    }

    if (!template.version) {
      errors.push('Template version is required');
    }

    if (!template.files || template.files.length === 0) {
      warnings.push('Template has no files defined');
    }

    // Validate file structures
    template.files?.forEach((file, index) => {
      if (!file.path && !file.name) {
        errors.push(`File at index ${index} has no path or name`);
      }
      if (!file.content) {
        warnings.push(`File ${file.path || file.name} has no content`);
      }
    });

    // Validate variable definitions
    Object.entries(template.variables || {}).forEach(([key, config]) => {
      if (!config.type) {
        errors.push(`Variable ${key} has no type defined`);
      }
      if (config.required && config.default === undefined) {
        warnings.push(`Required variable ${key} has no default value`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Find template by name in configured paths
   */
  async findTemplate(templateName: string): Promise<string | null> {
    const searchPaths = this.options.templatePaths!;
    const extensions = ['.yaml', '.yml', '.json', '.md'];

    const allCandidates = searchPaths.flatMap(searchPath => [
      // Direct name match
      path.join(searchPath, templateName),
      // With extensions
      ...extensions.map(ext => path.join(searchPath, `${templateName}${ext}`)),
      // Directory with template.json
      path.join(searchPath, templateName, 'template.json'),
    ]);

    // Check each candidate asynchronously
    for (const candidate of allCandidates) {
      try {
        await fs.promises.access(candidate);
        return candidate;
      } catch (_error) {
        // File doesn't exist, continue to next candidate
        continue;
      }
    }
    return null;
  }

  /**
   * List all available templates
   */
  async listTemplates(): Promise<
    Array<{
      name: string;
      path: string;
      description?: string;
      version?: string;
      tags?: string[];
    }>
  > {
    const templates: Array<{
      name: string;
      path: string;
      description?: string;
      version?: string;
      tags?: string[];
    }> = [];

    // Filter search paths asynchronously
    const searchPaths: string[] = [];
    for (const p of this.options.templatePaths!) {
      try {
        await fs.promises.access(p);
        searchPaths.push(p);
      } catch (_error) {
        // Path doesn't exist, skip
      }
    }

    const allTemplates = await Promise.all(
      searchPaths.map(async searchPath => {
        const entries = await fs.promises.readdir(searchPath, {
          withFileTypes: true,
        });

        const pathTemplates = await Promise.all(
          entries.map(async entry => {
            const fullPath = path.join(searchPath, entry.name);

            if (entry.isDirectory()) {
              const configPath = path.join(fullPath, 'template.json');
              try {
                await fs.promises.access(configPath);
                try {
                  const template = await this.loadTemplate(fullPath);
                  return {
                    name: template.name,
                    path: fullPath,
                    description: template.description,
                    version: template.version,
                    tags: template.metadata?.tags,
                  };
                } catch {
                  return null;
                }
              } catch {
                // Config file doesn't exist, skip
                return null;
              }
            } else if (
              entry.name.endsWith('.json') ||
              entry.name.endsWith('.yaml') ||
              entry.name.endsWith('.yml') ||
              entry.name.endsWith('.md')
            ) {
              try {
                const template = await this.loadTemplate(fullPath);
                return {
                  name: template.name,
                  path: fullPath,
                  description: template.description,
                  version: template.version,
                  tags: template.metadata?.tags,
                };
              } catch {
                return null;
              }
            }
            return null;
          })
        );

        return pathTemplates.filter(t => t !== null);
      })
    );

    templates.push(
      ...(allTemplates.flat() as Array<{
        name: string;
        path: string;
        description?: string;
        version?: string;
        tags?: string[];
      }>)
    );

    return templates;
  }

  /**
   * Validate variables against template requirements
   */
  private static validateVariables(
    template: Template,
    variables: Record<string, unknown>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    Object.entries(template.variables || {}).forEach(([key, config]) => {
      const value = variables[key];

      // Check required
      if (config.required && value === undefined) {
        errors.push(`Required variable "${key}" is missing`);
        return;
      }

      // Skip if not provided and not required
      if (value === undefined) {
        return;
      }

      // Type validation
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (config.type === 'choice') {
        // For choice type, validate against choices array
        const validChoices = config.choices || config.validation?.enum || [];
        if (validChoices.length > 0 && !validChoices.includes(value)) {
          errors.push(
            `Variable "${key}" must be one of: ${validChoices.join(', ')}`
          );
        }
      } else if (actualType !== config.type && config.type !== 'array') {
        errors.push(
          `Variable "${key}" should be ${config.type} but got ${actualType}`
        );
      }

      // Pattern validation for strings
      if (
        config.type === 'string' &&
        config.validation?.pattern &&
        typeof value === 'string'
      ) {
        const pattern = new RegExp(config.validation.pattern);
        if (!pattern.test(value)) {
          errors.push(
            `Variable "${key}" does not match pattern ${config.validation.pattern}`
          );
        }
      }

      // Enum validation
      if (config.validation?.enum && !config.validation.enum.includes(value)) {
        errors.push(
          `Variable "${key}" must be one of: ${config.validation.enum.join(', ')}`
        );
      }

      // Numeric range validation
      if (config.type === 'number' && typeof value === 'number') {
        if (
          config.validation?.min !== undefined &&
          value < config.validation.min
        ) {
          errors.push(
            `Variable "${key}" must be at least ${config.validation.min}`
          );
        }
        if (
          config.validation?.max !== undefined &&
          value > config.validation.max
        ) {
          errors.push(
            `Variable "${key}" must be at most ${config.validation.max}`
          );
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build context with defaults and system variables
   */
  private static buildContext(
    template: Template,
    variables: Record<string, unknown>
  ): TemplateContext {
    const context: TemplateContext = {};

    // Add defaults
    Object.entries(template.variables || {}).forEach(([key, config]) => {
      if (config.default !== undefined) {
        context[key] = config.default;
      }
    });

    // Override with provided variables
    Object.assign(context, variables);

    // Add system variables
    context.templateName = template.name;
    context.templateVersion = template.version;
    context.timestamp = new Date().toISOString();

    return context;
  }

  /**
   * Clear template cache
   */
  async clearCache(): Promise<void> {
    await this.templateCache.clear();
  }

  /**
   * Check if template is optimized
   */
  isTemplateOptimized(template: Template): boolean {
    return template.isOptimized === true;
  }

  /**
   * Get optimization metrics for template
   */
  getOptimizationMetrics(template: Template): OptimizationMetrics | null {
    return template.currentOptimizationMetrics || null;
  }

  /**
   * Get optimization history for template
   */
  getOptimizationHistory(template: Template): OptimizationHistory[] {
    return template.optimizationHistory || [];
  }

  /**
   * Add optimization data to template
   */
  async addOptimizationData(
    template: Template,
    optimizationData: {
      metrics: OptimizationMetrics;
      history: OptimizationHistory;
      level?: 'none' | 'basic' | 'advanced' | 'aggressive';
    }
  ): Promise<Template> {
    const updatedTemplate: Template = {
      ...template,
      isOptimized: true,
      optimizationLevel: optimizationData.level || 'basic',
      currentOptimizationMetrics: optimizationData.metrics,
      optimizationHistory: [
        ...(template.optimizationHistory || []),
        optimizationData.history,
      ],
      metadata: {
        ...template.metadata,
        lastOptimized: new Date().toISOString(),
        optimizationVersion: optimizationData.history.version,
      },
    };

    // Clear cache to ensure updated template is loaded fresh
    if (this.options.cacheEnabled) {
      this.templateCache.delete(template.name);
    }

    return updatedTemplate;
  }

  /**
   * Compare two template versions
   */
  async compareTemplateVersions(
    originalTemplate: Template,
    comparisonTemplate: Template
  ): Promise<TemplateComparison> {
    const originalContent = this.getTemplateContent(originalTemplate);
    const comparisonContent = this.getTemplateContent(comparisonTemplate);

    // Calculate basic metrics
    const tokenDiff = comparisonContent.length - originalContent.length;
    const tokenReduction =
      originalContent.length > 0
        ? Math.abs(tokenDiff) / originalContent.length
        : 0;

    const comparison: TemplateComparison = {
      original: originalTemplate as any,
      optimized: {
        ...comparisonTemplate,
        isOptimized: true,
        optimizationMetrics: comparisonTemplate.currentOptimizationMetrics || {
          accuracyImprovement: 0,
          tokenReduction,
          costReduction: 1,
          processingTime: 0,
          apiCallsUsed: 0,
        },
        optimizationHistory: comparisonTemplate.optimizationHistory || [],
        optimizationContext: {
          targetModel: 'unknown',
          task: 'Template comparison',
        },
        optimizationLevel: comparisonTemplate.optimizationLevel || 'basic',
        currentOptimizationMetrics:
          comparisonTemplate.currentOptimizationMetrics || {
            accuracyImprovement: 0,
            tokenReduction,
            costReduction: 1,
            processingTime: 0,
            apiCallsUsed: 0,
          },
      } as OptimizedTemplate,
      comparison: {
        overallImprovement:
          comparisonTemplate.currentOptimizationMetrics?.accuracyImprovement ||
          0,
        metrics: comparisonTemplate.currentOptimizationMetrics || {
          accuracyImprovement: 0,
          tokenReduction,
          costReduction: 1,
          processingTime: 0,
          apiCallsUsed: 0,
        },
        contentDiff: {
          additions: this.findContentDifferences(
            originalContent,
            comparisonContent,
            'additions'
          ),
          deletions: this.findContentDifferences(
            originalContent,
            comparisonContent,
            'deletions'
          ),
          modifications: this.findContentModifications(
            originalContent,
            comparisonContent
          ),
        },
        structuralChanges: {
          variablesAdded: this.getVariableDifferences(
            originalTemplate,
            comparisonTemplate,
            'added'
          ),
          variablesRemoved: this.getVariableDifferences(
            originalTemplate,
            comparisonTemplate,
            'removed'
          ),
          sectionsReorganized: this.detectSectionReorganization(
            originalTemplate,
            comparisonTemplate
          ),
          logicSimplified: this.detectLogicSimplification(
            originalTemplate,
            comparisonTemplate
          ),
        },
        qualityAssessment: {
          clarity: this.assessQualityMetric(
            originalTemplate,
            comparisonTemplate,
            'clarity'
          ),
          conciseness: this.assessQualityMetric(
            originalTemplate,
            comparisonTemplate,
            'conciseness'
          ),
          completeness: this.assessQualityMetric(
            originalTemplate,
            comparisonTemplate,
            'completeness'
          ),
          accuracy: this.assessQualityMetric(
            originalTemplate,
            comparisonTemplate,
            'accuracy'
          ),
        },
      },
      recommendation: this.generateComparisonRecommendation(
        comparisonTemplate.currentOptimizationMetrics
      ),
    };

    return comparison;
  }

  /**
   * Create A/B test variant of template
   */
  async createAbTestVariant(
    template: Template,
    variantName: string,
    variantContent: string,
    variantFiles?: TemplateFile[],
    weight: number = 0.5
  ): Promise<Template> {
    const variant = {
      name: variantName,
      version: `${template.version}-${variantName}`,
      content: variantContent,
      files: variantFiles,
      weight,
    };

    const updatedTemplate: Template = {
      ...template,
      abTestVariants: [...(template.abTestVariants || []), variant],
      metadata: {
        ...template.metadata,
        hasAbTest: true,
        variantCount: (template.abTestVariants?.length || 0) + 1,
      },
    };

    return updatedTemplate;
  }

  /**
   * Get active A/B test variant
   */
  getActiveAbTestVariant(template: Template): any | null {
    if (!template.abTestVariants || template.abTestVariants.length === 0) {
      return null;
    }

    if (template.activeVariant) {
      return (
        template.abTestVariants.find(v => v.name === template.activeVariant) ||
        null
      );
    }

    // Return weighted random variant
    const totalWeight = template.abTestVariants.reduce(
      (sum, v) => sum + (v.weight || 1),
      0
    );
    const random = Math.random() * totalWeight;
    let currentWeight = 0;

    for (const variant of template.abTestVariants) {
      currentWeight += variant.weight || 1;
      if (random <= currentWeight) {
        return variant;
      }
    }

    return template.abTestVariants[0];
  }

  /**
   * Set active A/B test variant
   */
  async setActiveAbTestVariant(
    template: Template,
    variantName: string
  ): Promise<Template> {
    const variant = template.abTestVariants?.find(v => v.name === variantName);
    if (!variant) {
      throw new ValidationError(
        `A/B test variant '${variantName}' not found in template '${template.name}'`
      );
    }

    return {
      ...template,
      activeVariant: variantName,
    };
  }

  /**
   * Generate diff between template versions
   */
  async generateVersionDiff(
    originalTemplate: Template,
    modifiedTemplate: Template
  ): Promise<{
    contentChanges: string[];
    structuralChanges: string[];
    metadataChanges: string[];
  }> {
    const contentChanges = this.compareTemplateContent(
      originalTemplate,
      modifiedTemplate
    );
    const structuralChanges = this.compareTemplateStructure(
      originalTemplate,
      modifiedTemplate
    );
    const metadataChanges = this.compareTemplateMetadata(
      originalTemplate,
      modifiedTemplate
    );

    return {
      contentChanges,
      structuralChanges,
      metadataChanges,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.templateCache.getStats();
  }

  /**
   * Parse variables from various formats
   */
  private static parseVariables(
    variables: any
  ): Record<string, VariableConfig> {
    if (Array.isArray(variables)) {
      // Handle array format from markdown frontmatter
      const result: Record<string, VariableConfig> = {};
      variables.forEach(variable => {
        if (typeof variable === 'string') {
          result[variable] = {
            type: 'string',
            required: false,
          };
        } else if (typeof variable === 'object') {
          Object.entries(variable).forEach(([key, value]) => {
            result[key] = {
              type: 'string',
              description: value as string,
              required: false,
            };
          });
        }
      });
      return result;
    }
    if (typeof variables === 'object' && variables !== null) {
      // Handle object format from YAML/JSON
      return variables as Record<string, VariableConfig>;
    }
    return {};
  }

  // Helper methods for comparison and analysis
  private getTemplateContent(template: Template): string {
    return template.files?.[0]?.content || template.description || '';
  }

  private findContentDifferences(
    original: string,
    comparison: string,
    type: 'additions' | 'deletions'
  ): string[] {
    // Simplified diff implementation - in production, use a proper diff library
    const originalLines = original.split('\n');
    const comparisonLines = comparison.split('\n');

    if (type === 'additions') {
      return comparisonLines.filter(line => !originalLines.includes(line));
    }
    return originalLines.filter(line => !comparisonLines.includes(line));
  }

  private findContentModifications(
    original: string,
    comparison: string
  ): Array<{ original: string; modified: string }> {
    // Simplified modification detection
    const originalLines = original.split('\n');
    const comparisonLines = comparison.split('\n');
    const modifications: Array<{ original: string; modified: string }> = [];

    const maxLines = Math.max(originalLines.length, comparisonLines.length);
    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || '';
      const compLine = comparisonLines[i] || '';

      if (origLine !== compLine && origLine.length > 0 && compLine.length > 0) {
        modifications.push({ original: origLine, modified: compLine });
      }
    }

    return modifications;
  }

  private getVariableDifferences(
    original: Template,
    comparison: Template,
    type: 'added' | 'removed'
  ): string[] {
    const originalVars = Object.keys(original.variables || {});
    const comparisonVars = Object.keys(comparison.variables || {});

    if (type === 'added') {
      return comparisonVars.filter(v => !originalVars.includes(v));
    }
    return originalVars.filter(v => !comparisonVars.includes(v));
  }

  private detectSectionReorganization(
    original: Template,
    comparison: Template
  ): boolean {
    // Simple heuristic: check if file order changed
    const originalFiles = (original.files || []).map(f => f.name || f.path);
    const comparisonFiles = (comparison.files || []).map(f => f.name || f.path);

    return originalFiles.join(',') !== comparisonFiles.join(',');
  }

  private detectLogicSimplification(
    original: Template,
    comparison: Template
  ): boolean {
    const originalContent = this.getTemplateContent(original);
    const comparisonContent = this.getTemplateContent(comparison);

    // Heuristic: fewer conditional statements or loops
    const originalComplexity = (originalContent.match(/{%|{{|}}/g) || [])
      .length;
    const comparisonComplexity = (comparisonContent.match(/{%|{{|}}/g) || [])
      .length;

    return comparisonComplexity < originalComplexity;
  }

  private assessQualityMetric(
    original: Template,
    comparison: Template,
    metric: 'clarity' | 'conciseness' | 'completeness' | 'accuracy'
  ): number {
    const originalContent = this.getTemplateContent(original);
    const comparisonContent = this.getTemplateContent(comparison);

    switch (metric) {
      case 'conciseness':
        return originalContent.length > 0
          ? (originalContent.length - comparisonContent.length) /
              originalContent.length
          : 0;
      case 'completeness':
        return (comparison.variables
          ? Object.keys(comparison.variables).length
          : 0) -
          (original.variables ? Object.keys(original.variables).length : 0) >
          0
          ? 0.1
          : 0;
      case 'clarity':
      case 'accuracy':
      default:
        // Would need more sophisticated analysis - return neutral for now
        return 0;
    }
  }

  private generateComparisonRecommendation(metrics?: OptimizationMetrics): {
    useOptimized: boolean;
    confidence: number;
    reasons: string[];
    warnings?: string[];
  } {
    const reasons: string[] = [];
    const warnings: string[] = [];
    let useOptimized = false;
    let confidence = 0.5;

    if (metrics) {
      if (metrics.accuracyImprovement > 0.1) {
        reasons.push('Significant accuracy improvement detected');
        useOptimized = true;
        confidence += 0.2;
      }

      if (metrics.tokenReduction > 0.2) {
        reasons.push('Substantial token reduction achieved');
        useOptimized = true;
        confidence += 0.15;
      }

      if (metrics.costReduction > 1.5) {
        reasons.push('Cost reduction benefits');
        useOptimized = true;
        confidence += 0.1;
      }

      if (metrics.confidence && metrics.confidence < 0.7) {
        warnings.push(
          'Low optimization confidence - manual review recommended'
        );
        confidence -= 0.2;
      }
    } else {
      warnings.push('No optimization metrics available');
      confidence = 0.3;
    }

    return {
      useOptimized,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasons,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private compareTemplateContent(
    original: Template,
    modified: Template
  ): string[] {
    const changes: string[] = [];
    const originalContent = this.getTemplateContent(original);
    const modifiedContent = this.getTemplateContent(modified);

    if (originalContent !== modifiedContent) {
      changes.push(
        `Content length changed from ${originalContent.length} to ${modifiedContent.length} characters`
      );

      if (originalContent.length > modifiedContent.length) {
        changes.push('Content was shortened');
      } else {
        changes.push('Content was expanded');
      }
    }

    return changes;
  }

  private compareTemplateStructure(
    original: Template,
    modified: Template
  ): string[] {
    const changes: string[] = [];

    const origLen = original.files?.length || 0;
    const modLen = modified.files?.length || 0;
    if (origLen !== modLen) {
      changes.push(
        `File count changed from ${origLen} to ${modLen}`
      );
    }

    const originalVarCount = Object.keys(original.variables || {}).length;
    const modifiedVarCount = Object.keys(modified.variables || {}).length;

    if (originalVarCount !== modifiedVarCount) {
      changes.push(
        `Variable count changed from ${originalVarCount} to ${modifiedVarCount}`
      );
    }

    return changes;
  }

  private compareTemplateMetadata(
    original: Template,
    modified: Template
  ): string[] {
    const changes: string[] = [];

    if (original.version !== modified.version) {
      changes.push(
        `Version changed from ${original.version} to ${modified.version}`
      );
    }

    if (original.description !== modified.description) {
      changes.push('Description was updated');
    }

    return changes;
  }

  /**
   * Resolve template path with extension auto-appending
   */
  async resolveTemplatePath(templatePath: string): Promise<string | null> {
    // If path is absolute, try as-is first
    if (path.isAbsolute(templatePath)) {
      try {
        await fs.promises.access(templatePath);
        return templatePath;
      } catch {
        // If absolute path has no extension, try with extensions
        if (!path.extname(templatePath)) {
          const extensions = ['.yaml', '.yml', '.json', '.md'];
          for (const ext of extensions) {
            const fullPath = templatePath + ext;
            try {
              await fs.promises.access(fullPath);
              return fullPath;
            } catch {
              continue;
            }
          }
        }
      }
    }

    // If relative path but starts with template path pattern, try to resolve relative to cwd
    if (templatePath.startsWith('templates/')) {
      const relativePath = path.resolve(templatePath);
      try {
        await fs.promises.access(relativePath);
        return relativePath;
      } catch {
        // Try with extensions
        if (!path.extname(relativePath)) {
          const extensions = ['.yaml', '.yml', '.json', '.md'];
          for (const ext of extensions) {
            const fullPath = relativePath + ext;
            try {
              await fs.promises.access(fullPath);
              return fullPath;
            } catch {
              continue;
            }
          }
        }
      }
    }

    // If relative path or template name, use findTemplate method
    return this.findTemplate(templatePath);
  }
}

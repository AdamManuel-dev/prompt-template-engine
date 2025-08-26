/**
 * @fileoverview Template service for business logic abstraction
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: Template management, rendering, and validation
 * Main APIs: loadTemplate, renderTemplate, validateTemplate
 * Constraints: Abstracts file system operations from commands
 * Patterns: Service layer pattern, dependency injection ready
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

export interface TemplateFile {
  path: string;
  name?: string;
  content: string;
  encoding?: string;
  mode?: string;
}

export interface TemplateCommand {
  command: string;
  description?: string;
  when?: string;
}

export interface VariableConfig {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default?: unknown;
  required?: boolean;
  description?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: unknown[];
  };
}

export interface Template {
  name: string;
  version: string;
  description?: string;
  basePath?: string;
  files: TemplateFile[];
  variables: Record<string, VariableConfig>;
  commands: TemplateCommand[];
  metadata?: {
    author?: string;
    tags?: string[];
    created?: string;
    updated?: string;
    category?: string;
    [key: string]: any;
  };
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
    } catch (error) {
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
              content: parsed.content,
              name: frontmatter.name || path.basename(filePath, ext),
            },
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
                content: parsed.content,
                name: frontmatter.name || path.basename(filePath, ext),
              },
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
                content: parsed.content || '',
                name: parsed.name,
              },
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
    } catch (error) {
      throw new TemplateProcessingError(
        `Failed to load template from file: ${filePath}`,
        filePath,
        undefined,
        undefined,
        { error: (error as Error).message }
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
    } catch (error) {
      throw new FileNotFoundError(
        `Template configuration not found: ${configPath}`,
        configPath
      );
    }

    const template = await TemplateService.loadTemplateFromFile(configPath);
    template.basePath = dirPath;

    // Load file contents if they reference external files
    template.files = await Promise.all(
      template.files.map(async file => {
        if (!file.content && file.path) {
          const filePath = path.join(dirPath, file.path);
          try {
            await fs.promises.access(filePath);
            const content = await fs.promises.readFile(filePath, 'utf8');
            return { ...file, content };
          } catch (error) {
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
      template.files.map(async file => ({
        ...file,
        content: await this.engine.render(file.content, context),
        path: await this.engine.render(file.path || file.name || '', context),
      }))
    );

    // Render commands
    const renderedCommands = await Promise.all(
      template.commands.map(async cmd => ({
        ...cmd,
        command: await this.engine.render(cmd.command, context),
      }))
    );

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
    template.files.forEach((file, index) => {
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
      } catch (error) {
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
      } catch (error) {
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
      if (actualType !== config.type && config.type !== 'array') {
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

    // If relative path or template name, use findTemplate method
    return this.findTemplate(templatePath);
  }
}

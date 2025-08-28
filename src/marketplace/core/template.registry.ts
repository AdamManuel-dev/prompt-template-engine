/**
 * @fileoverview Template registry for managing installed templates
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Template registration, discovery, dependency management
 * Main APIs: registerTemplate(), unregisterTemplate(), getTemplate(), listTemplates()
 * Constraints: File system permissions, template compatibility
 * Patterns: Registry pattern, template management, dependency resolution
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import {
  TemplateModel,
  TemplateVersion,
  TemplateDependency,
} from '../models/template.model';

export interface RegisteredTemplate {
  id: string;
  name: string;
  version: string;
  currentVersion?: string; // Alias for version
  path: string;
  metadata: TemplateModel;
  versionInfo: TemplateVersion;
  registered: Date;
  active: boolean;
}

export class TemplateRegistry {
  private templates: Map<string, RegisteredTemplate> = new Map();

  private registryPath: string;

  constructor() {
    this.registryPath = path.join(
      process.cwd(),
      '.cursor-prompt',
      'registry.json'
    );
    this.loadRegistry();
  }

  /**
   * Get templates directory path
   */
  getTemplatesPath(): string {
    return path.join(process.cwd(), '.cursor-prompt', 'templates');
  }

  /**
   * Load registry from disk
   */
  private async loadRegistry(): Promise<void> {
    try {
      const registryData = await fs.readFile(this.registryPath, 'utf8');
      const registry = JSON.parse(registryData);

      (registry.templates || []).forEach(
        (template: Record<string, unknown>) => {
          const templateId = template.id as string;
          const registeredDate = template.registered as string;
          this.templates.set(templateId, {
            ...template,
            registered: new Date(registeredDate),
          });
        }
      );

      logger.debug(`Loaded ${this.templates.size} templates from registry`);
    } catch {
      logger.debug('Registry file not found, starting with empty registry');
    }
  }

  /**
   * Save registry to disk
   */
  private async saveRegistry(): Promise<void> {
    const registry = {
      version: '1.0.0',
      updated: new Date().toISOString(),
      templates: Array.from(this.templates.values()),
    };

    const registryDir = path.dirname(this.registryPath);
    await fs.mkdir(registryDir, { recursive: true });
    await fs.writeFile(
      this.registryPath,
      JSON.stringify(registry, null, 2),
      'utf8'
    );
  }

  /**
   * Register a new template
   */
  async registerTemplate(
    template: TemplateModel,
    version: TemplateVersion,
    installPath: string
  ): Promise<void> {
    const registeredTemplate: RegisteredTemplate = {
      id: template.id,
      name: template.name,
      version: version.version,
      path: installPath,
      metadata: template,
      versionInfo: version,
      registered: new Date(),
      active: true,
    };

    this.templates.set(template.id, registeredTemplate);
    await this.saveRegistry();

    logger.info(`Registered template: ${template.name}@${version.version}`);
  }

  /**
   * Unregister a template
   */
  async unregisterTemplate(templateId: string): Promise<void> {
    const template = this.templates.get(templateId);
    if (template) {
      this.templates.delete(templateId);
      await this.saveRegistry();
      logger.info(`Unregistered template: ${template.name}`);
    }
  }

  /**
   * Get registered template by ID
   */
  getTemplate(templateId: string): RegisteredTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Get template by name
   */
  getTemplateByName(name: string): RegisteredTemplate | undefined {
    return Array.from(this.templates.values()).find(t => t.name === name);
  }

  /**
   * List all registered templates
   */
  listTemplates(): RegisteredTemplate[] {
    return Array.from(this.templates.values()).filter(t => t.active);
  }

  /**
   * Search templates by criteria
   */
  searchTemplates(query: {
    name?: string;
    category?: string;
    tag?: string;
    author?: string;
  }): RegisteredTemplate[] {
    const templates = this.listTemplates();

    return templates.filter(template => {
      if (
        query.name &&
        !template.name.toLowerCase().includes(query.name.toLowerCase())
      ) {
        return false;
      }

      if (query.category && template.metadata.category !== query.category) {
        return false;
      }

      if (query.tag && !template.metadata.tags?.includes(query.tag)) {
        return false;
      }

      if (query.author) {
        const authorName =
          typeof template.metadata.author === 'string'
            ? template.metadata.author
            : template.metadata.author?.name;
        if (authorName !== query.author) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Check if template is installed
   */
  isInstalled(templateId: string): boolean {
    const template = this.templates.get(templateId);
    return template?.active === true;
  }

  /**
   * Check if dependency is installed
   */
  async isDependencyInstalled(
    dependency: TemplateDependency
  ): Promise<boolean> {
    switch (dependency.type) {
      case 'template':
        return this.isInstalled(dependency.name);

      case 'plugin':
        return this.isPluginInstalled(dependency.name);

      case 'engine':
        return this.isEngineVersionCompatible(dependency.version);

      default:
        return false;
    }
  }

  /**
   * Check if plugin is installed
   */
  // eslint-disable-next-line class-methods-use-this
  private isPluginInstalled(pluginName: string): boolean {
    // Check if plugin exists in plugin directories
    const pluginDirs = [
      path.join(process.cwd(), '.cursor-prompt', 'plugins', pluginName),
      path.join(
        process.env.HOME || '',
        '.cursor-prompt',
        'plugins',
        pluginName
      ),
    ];

    return pluginDirs.some(dir => {
      try {
        return fs
          .access(dir)
          .then(() => true)
          .catch(() => false);
      } catch {
        return false;
      }
    });
  }

  /**
   * Check if engine version is compatible
   */
  // eslint-disable-next-line class-methods-use-this
  private isEngineVersionCompatible(requiredVersion: string): boolean {
    // Simple version check - in real implementation, use semver
    const currentVersion = process.env.ENGINE_VERSION || '1.0.0';
    return currentVersion >= requiredVersion;
  }

  /**
   * Get template dependencies
   */
  getTemplateDependencies(templateId: string): TemplateDependency[] {
    const template = this.templates.get(templateId);
    return template?.versionInfo.dependencies || [];
  }

  /**
   * Resolve dependency chain for template
   */
  resolveDependencyChain(templateId: string): string[] {
    const visited = new Set<string>();
    const chain: string[] = [];

    const resolve = (id: string): void => {
      if (visited.has(id)) {
        throw new Error(`Circular dependency detected: ${id}`);
      }

      visited.add(id);
      const dependencies = this.getTemplateDependencies(id);

      dependencies
        .filter(dep => dep.type === 'template' && !dep.optional)
        .forEach(dep => {
          resolve(dep.name);
          if (!chain.includes(dep.name)) {
            chain.push(dep.name);
          }
        });

      visited.delete(id);
    };

    resolve(templateId);
    return chain;
  }

  /**
   * Validate template installation
   */
  async validateTemplate(
    templateId: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const template = this.templates.get(templateId);
    const errors: string[] = [];

    if (!template) {
      errors.push(`Template ${templateId} not found in registry`);
      return { valid: false, errors };
    }

    // Check if template files exist
    try {
      await fs.access(template.path);
    } catch {
      errors.push(`Template files not found at ${template.path}`);
    }

    // Check required dependencies sequentially
    const requiredDeps = template.versionInfo.dependencies.filter(
      dep => !dep.optional
    );

    // eslint-disable-next-line no-restricted-syntax
    for (const dependency of requiredDeps) {
      // eslint-disable-next-line no-await-in-loop
      const installed = await this.isDependencyInstalled(dependency);
      if (!installed) {
        errors.push(
          `Missing dependency: ${dependency.name}@${dependency.version}`
        );
      }
    }

    // Check template content validity
    try {
      const templateFile = path.join(template.path, `${template.name}.md`);
      const content = await fs.readFile(templateFile, 'utf8');

      if (content.trim().length === 0) {
        errors.push('Template content is empty');
      }
    } catch {
      errors.push('Template content file not readable');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get template statistics
   */
  getStats(): {
    total: number;
    active: number;
    categories: Record<string, number>;
    authors: Record<string, number>;
  } {
    const templates = Array.from(this.templates.values());
    const active = templates.filter(t => t.active);

    const categories: Record<string, number> = {};
    const authors: Record<string, number> = {};

    active.forEach(template => {
      const { category } = template.metadata;
      categories[category] = (categories[category] || 0) + 1;

      const author =
        typeof template.metadata.author === 'string'
          ? template.metadata.author
          : (template.metadata.author?.name ?? 'Unknown');
      authors[author] = (authors[author] || 0) + 1;
    });

    return {
      total: templates.length,
      active: active.length,
      categories,
      authors,
    };
  }

  /**
   * Cleanup invalid templates
   */
  async cleanup(): Promise<void> {
    const toRemove: string[] = [];

    // Validate templates sequentially to avoid resource conflicts
    // eslint-disable-next-line no-restricted-syntax
    for (const [id, template] of this.templates) {
      // eslint-disable-next-line no-await-in-loop
      const validation = await this.validateTemplate(id);
      if (!validation.valid) {
        logger.warn(
          `Removing invalid template: ${template.name} - ${validation.errors.join(', ')}`
        );
        toRemove.push(id);
      }
    }

    toRemove.forEach(id => {
      this.templates.delete(id);
    });

    if (toRemove.length > 0) {
      await this.saveRegistry();
      logger.info(`Cleaned up ${toRemove.length} invalid templates`);
    }
  }
}

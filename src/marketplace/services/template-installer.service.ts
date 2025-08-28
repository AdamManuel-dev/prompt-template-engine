/**
 * @fileoverview Template installation service
 * @lastmodified 2025-08-22T21:45:00Z
 *
 * Features: Template download, installation, dependency management
 * Main APIs: install(), installWithDependencies(), quickInstall()
 * Constraints: Version compatibility, disk space, permissions
 * Patterns: Service pattern with repository integration
 */

import * as fs from 'fs';
import * as path from 'path';
import { MarketplaceAPI } from '../api/marketplace.api';
import { TemplateRegistry } from '../core/template.registry';
import {
  TemplateModel,
  InstallationResult,
  TemplateDependency,
} from '../models/template.model';
import { MarketplaceTemplate, MarketplaceTemplateVersion } from '../../types';
import { logger } from '../../utils/logger';

export interface InstallOptions {
  version?: string;
  force?: boolean;
  withDependencies?: boolean;
  skipConfirmation?: boolean;
  global?: boolean;
}

export class TemplateInstallerService {
  constructor(
    private api: MarketplaceAPI,
    private registry: TemplateRegistry,
    private installPath: string
  ) {}

  /**
   * Install a template from marketplace
   */
  async install(
    templateId: string,
    options: InstallOptions = {}
  ): Promise<InstallationResult> {
    const startTime = Date.now();

    try {
      // Check if already installed
      if (!options.force) {
        const existing = await this.registry.getTemplate(templateId);
        if (existing) {
          // Convert RegisteredTemplate to MarketplaceTemplate format
          const templateModel = existing.metadata;
          const templateAsMarketplace: MarketplaceTemplate = {
            id: templateModel.id,
            name: templateModel.name,
            description: templateModel.description,
            category: templateModel.category,
            tags: templateModel.tags,
            author: templateModel.author,
            currentVersion: existing.currentVersion || existing.version,
            downloads: templateModel.downloads || 0,
            repository:
              typeof templateModel.repository === 'string'
                ? templateModel.repository
                : templateModel.repository?.type,
            rating:
              typeof templateModel.rating === 'number'
                ? templateModel.rating
                : templateModel.rating.average,
            reviewCount:
              typeof templateModel.rating === 'object'
                ? templateModel.rating.total
                : 0,
            createdAt: templateModel.created.toISOString(),
            updatedAt: templateModel.updated.toISOString(),
            updated: templateModel.updated.toISOString(),
            featured: templateModel.featured,
            verified: templateModel.verified,
            deprecated: templateModel.deprecated,
            versions: templateModel.versions.map(
              v =>
                ({
                  ...v,
                  created: v.created.toISOString(),
                }) as MarketplaceTemplateVersion
            ),
          };
          return {
            success: false,
            template: templateAsMarketplace,
            version: existing.currentVersion || existing.version || 'unknown',
            installPath: this.getTemplatePath(templateId),
            duration: Date.now() - startTime,
            warnings: ['Template already installed. Use --force to reinstall.'],
          };
        }
      }

      // Fetch template metadata
      const template = await this.api.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found in marketplace`);
      }

      // Download and install
      const targetPath = this.getTemplatePath(templateId);
      await this.downloadTemplate(template, targetPath, options.version);

      // Register template
      const version = template.versions.find(
        v => v.version === (options.version || template.currentVersion)
      );
      if (version) {
        await this.registry.registerTemplate(template, version, targetPath);
      }

      // Install dependencies if requested
      if (options.withDependencies && template.dependencies) {
        await this.installDependencies(template.dependencies);
      }

      // Convert TemplateModel to MarketplaceTemplate format
      const templateAsMarketplace: MarketplaceTemplate = {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: template.tags,
        author: template.author,
        currentVersion: template.currentVersion,
        downloads: template.downloads || 0,
        repository:
          typeof template.repository === 'string'
            ? template.repository
            : template.repository?.type,
        rating:
          typeof template.rating === 'number'
            ? template.rating
            : template.rating.average,
        reviewCount:
          typeof template.rating === 'object' ? template.rating.total : 0,
        createdAt: template.created.toISOString(),
        updatedAt: template.updated.toISOString(),
        updated: template.updated.toISOString(),
        featured: template.featured,
        verified: template.verified,
        deprecated: template.deprecated,
        versions: template.versions.map(
          v =>
            ({
              ...v,
              created: v.created.toISOString(),
            }) as MarketplaceTemplateVersion
        ),
      };

      return {
        success: true,
        template: templateAsMarketplace,
        version: options.version || template.currentVersion || 'latest',
        installPath: targetPath,
        duration: Date.now() - startTime,
        warnings: [],
      };
    } catch (error: any) {
      logger.error(
        `Failed to install template ${templateId}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Quick install without prompts
   */
  async quickInstall(templateId: string): Promise<InstallationResult> {
    return this.install(templateId, {
      skipConfirmation: true,
      withDependencies: true,
    });
  }

  /**
   * Install template with all dependencies
   */
  async installWithDependencies(
    templateId: string,
    options: InstallOptions = {}
  ): Promise<InstallationResult> {
    const result = await this.install(templateId, {
      ...options,
      withDependencies: true,
    });

    if (result.success && result.template) {
      const template = await this.api.getTemplate(templateId);
      if (template?.dependencies) {
        await this.installDependencies(template.dependencies);
      }
    }

    return result;
  }

  /**
   * Batch install multiple templates
   */
  async batchInstall(
    templateIds: string[],
    options: InstallOptions & { continueOnError?: boolean } = {}
  ): Promise<InstallationResult[]> {
    const results: InstallationResult[] = [];

    for (const templateId of templateIds) {
      try {
        const result = await this.install(templateId, options);
        results.push(result);
      } catch (error: any) {
        if (!options.continueOnError) {
          throw error;
        }

        // Create a minimal MarketplaceTemplate for failed installations
        const failedTemplate: MarketplaceTemplate = {
          id: templateId,
          name: templateId,
          description: 'Failed installation',
          category: 'other',
          tags: [],
          author: { id: 'unknown', name: 'unknown' },
          currentVersion: '0.0.0',
          versions: [],
          downloads: 0,
          rating: 0,
          reviewCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        results.push({
          success: false,
          template: failedTemplate,
          version: 'unknown',
          installPath: '',
          duration: 0,
          warnings: [
            `Failed: ${error instanceof Error ? error.message : String(error)}`,
          ],
        });
      }
    }

    return results;
  }

  /**
   * Install dependencies
   */
  private async installDependencies(
    dependencies: TemplateDependency[]
  ): Promise<void> {
    for (const dep of dependencies) {
      try {
        if (dep.templateId) {
          await this.install(dep.templateId, {
            version: dep.version,
            skipConfirmation: true,
          });
        } else {
          logger.warn(`Dependency missing templateId: ${dep.name}`);
        }
      } catch (_error) {
        if (dep.required) {
          throw new Error(
            `Required dependency ${dep.templateId} failed to install`
          );
        }
        logger.warn(`Optional dependency ${dep.templateId} failed to install`);
      }
    }
  }

  /**
   * Download template files
   */
  private async downloadTemplate(
    template: TemplateModel,
    targetPath: string,
    version?: string
  ): Promise<void> {
    // Create target directory
    await fs.promises.mkdir(targetPath, { recursive: true });

    // Download template content (simplified - actual implementation would download from CDN/registry)
    const content = await this.api.downloadTemplate(template.id, version);

    // Write template files
    const templateFile = path.join(targetPath, 'template.md');
    await fs.promises.writeFile(templateFile, content);

    // Write metadata
    const metadataFile = path.join(targetPath, 'template.json');
    await fs.promises.writeFile(
      metadataFile,
      JSON.stringify(template, null, 2)
    );
  }

  /**
   * Get template installation path
   */
  private getTemplatePath(templateId: string): string {
    return path.join(this.installPath, 'templates', templateId);
  }
}

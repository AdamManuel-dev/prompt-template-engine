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
          return {
            success: false,
            template: existing as any,
            version: existing.version || 'unknown',
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
      const version = template.versions.find(v => v.version === (options.version || template.currentVersion));
      if (version) {
        await this.registry.registerTemplate(template, version, targetPath);
      }

      // Install dependencies if requested
      if (options.withDependencies && template.dependencies) {
        await this.installDependencies(template.dependencies);
      }

      return {
        success: true,
        template: template as any,
        version: options.version || template.currentVersion || 'latest',
        installPath: targetPath,
        duration: Date.now() - startTime,
        warnings: [],
      };
    } catch (error) {
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
      } catch (error) {
        if (!options.continueOnError) {
          throw error;
        }

        results.push({
          success: false,
          template: { id: templateId } as any,
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
        if (!dep.templateId) {
          logger.warn(`Dependency missing templateId: ${dep.name}`);
          continue;
        }
        await this.install(dep.templateId, {
          version: dep.version,
          skipConfirmation: true,
        });
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

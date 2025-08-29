/**
 * @fileoverview Template update and version management service
 * @lastmodified 2025-08-22T21:45:00Z
 *
 * Features: Check updates, perform updates, version management
 * Main APIs: update(), checkUpdates(), updateAll()
 * Constraints: Backward compatibility, safe updates
 * Patterns: Update service with rollback capability
 */

import * as fs from 'fs';
import * as path from 'path';
import { MarketplaceAPI } from '../api/marketplace.api';
import { TemplateRegistry } from '../core/template.registry';
import { TemplateInstallerService } from './template-installer.service';
import {
  TemplateModel,
  UpdateResult,
  UpdateCheckResult,
} from '../models/template.model';
import { MarketplaceTemplate } from '../../types';
import { logger } from '../../utils/logger';

export interface UpdateOptions {
  force?: boolean;
  backup?: boolean;
  checkOnly?: boolean;
}

export class TemplateUpdaterService {
  constructor(
    private api: MarketplaceAPI,
    private registry: TemplateRegistry,
    private installer: TemplateInstallerService,
    private backupPath: string
  ) {}

  /**
   * Update a specific template
   */
  async update(
    templateId: string,
    options: UpdateOptions = {}
  ): Promise<UpdateResult> {
    try {
      // Get installed template
      const installed = await this.registry.getTemplate(templateId);
      if (!installed) {
        throw new Error(`Template ${templateId} is not installed`);
      }

      // Check for updates
      const latest = await this.api.getTemplate(templateId);
      if (!latest) {
        throw new Error(`Template ${templateId} not found in marketplace`);
      }

      const hasUpdate =
        this.compareVersions(
          installed.version || '0.0.0',
          latest.currentVersion || '0.0.0'
        ) < 0;

      if (!hasUpdate && !options.force) {
        return {
          success: false,
          templateId,
          updated: [],
          failed: [
            {
              templateId,
              error: 'Template is already up to date',
            },
          ],
        };
      }

      if (options.checkOnly) {
        return {
          success: hasUpdate,
          templateId,
          updated: hasUpdate
            ? [
                {
                  templateId,
                  oldVersion: installed.version || '0.0.0',
                  newVersion: latest.currentVersion || '0.0.0',
                },
              ]
            : [],
          failed: [],
        };
      }

      // Backup current version if requested
      if (options.backup) {
        await this.backupTemplate(templateId, installed.metadata);
      }

      // Perform update
      const result = await this.installer.install(templateId, {
        force: true,
        version: latest.currentVersion,
      });

      return {
        success: result.success,
        templateId,
        updated: result.success
          ? [
              {
                templateId,
                oldVersion: installed.version || '0.0.0',
                newVersion: latest.currentVersion || '0.0.0',
              },
            ]
          : [],
        failed: result.success
          ? []
          : [
              {
                templateId,
                error: 'Update failed',
              },
            ],
      };
    } catch (error: unknown) {
      logger.error(
        `Failed to update template ${templateId}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Check for updates for all installed templates
   */
  async checkUpdates(): Promise<UpdateCheckResult[]> {
    const installed = await this.registry.listTemplates();
    const results: UpdateCheckResult[] = [];

    for (const template of installed) {
      try {
        const latest = await this.api.getTemplate(template.id);
        if (!latest) {
          continue;
        }

        const hasUpdate =
          this.compareVersions(
            template.currentVersion || '0.0.0',
            latest.currentVersion || '0.0.0'
          ) < 0;

        results.push({
          hasUpdates: hasUpdate,
          currentVersion: template.currentVersion || '0.0.0',
          latestVersion: latest.currentVersion || '0.0.0',
          templateId: template.id,
          updates: hasUpdate
            ? [
                {
                  templateId: template.id,
                  currentVersion: template.currentVersion || '0.0.0',
                  latestVersion: latest.currentVersion || '0.0.0',
                  template: latest as unknown as MarketplaceTemplate,
                },
              ]
            : [],
        });
      } catch (error: unknown) {
        logger.warn(
          `Failed to check updates for ${template.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return results;
  }

  /**
   * Update all installed templates
   */
  async updateAll(options: UpdateOptions = {}): Promise<UpdateResult[]> {
    const updateChecks = await this.checkUpdates();
    const results: UpdateResult[] = [];

    for (const check of updateChecks) {
      if (check.hasUpdates || options.force) {
        try {
          if (check.templateId) {
            const result = await this.update(check.templateId, options);
            results.push(result);
          } else {
            logger.warn('Update check missing templateId');
          }
        } catch (error: unknown) {
          results.push({
            success: false,
            templateId: check.templateId,
            updated: [],
            failed: [
              {
                templateId: check.templateId || '',
                error: error instanceof Error ? error.message : String(error),
              },
            ],
          });
        }
      }
    }

    return results;
  }

  /**
   * Backup a template before update
   */
  private async backupTemplate(
    templateId: string,
    template: TemplateModel
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.backupPath, templateId, timestamp);

    await fs.promises.mkdir(backupDir, { recursive: true });

    // Copy template files
    const sourcePath = path.join(this.registry.getTemplatesPath(), templateId);
    if (fs.existsSync(sourcePath)) {
      await this.copyDirectory(sourcePath, backupDir);
    }

    // Save metadata
    const metadataPath = path.join(backupDir, 'backup.json');
    await fs.promises.writeFile(
      metadataPath,
      JSON.stringify(
        {
          template,
          backedUpAt: new Date().toISOString(),
          version: template.currentVersion,
        },
        null,
        2
      )
    );

    logger.info(`Backed up template ${templateId} to ${backupDir}`);
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(
    source: string,
    destination: string
  ): Promise<void> {
    await fs.promises.mkdir(destination, { recursive: true });

    const entries = await fs.promises.readdir(source, { withFileTypes: true });

    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        await fs.promises.copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }

    return 0;
  }
}

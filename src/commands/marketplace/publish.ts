/**
 * @fileoverview Template publishing command for marketplace contribution
 * @lastmodified 2025-08-23T02:15:00Z
 *
 * Features: Template publishing, validation, metadata management
 * Main APIs: execute(), validateTemplate(), publishTemplate()
 * Constraints: Authentication required, template validation
 * Patterns: Command pattern, marketplace integration, validation workflow
 */

import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseCommand } from '../../cli/base-command';
import { ICommand } from '../../cli/command-registry';
import { MarketplaceService } from '../../marketplace/core/marketplace.service';
import { AuthorService } from '../../marketplace/core/author.service';
import { TemplateValidator } from '../../core/template-validator';
import { TemplateModel } from '../../marketplace/models/template.model';
import { MarketplaceCommandOptions } from '../../types';
import { logger } from '../../utils/logger';

export interface PublishOptions extends MarketplaceCommandOptions {
  templatePath?: string;
  version?: string;
  category?: string;
  tags?: string;
  description?: string;
  private?: boolean;
  draft?: boolean;
  force?: boolean;
}

export class PublishCommand extends BaseCommand implements ICommand {
  name = 'publish';

  description = 'Publish a template to the marketplace';

  aliases = ['pub'];

  options = [
    {
      flags: '-p, --template-path <path>',
      description: 'Path to template directory or file',
    },
    {
      flags: '-v, --version <version>',
      description: 'Template version (e.g., 1.0.0)',
    },
    {
      flags: '-c, --category <category>',
      description: 'Template category',
    },
    {
      flags: '-t, --tags <tags>',
      description: 'Comma-separated tags',
    },
    {
      flags: '-d, --description <description>',
      description: 'Template description',
    },
    {
      flags: '--private',
      description: 'Publish as private template',
    },
    {
      flags: '--draft',
      description: 'Publish as draft (not publicly visible)',
    },
    {
      flags: '-f, --force',
      description: 'Force publish even with warnings',
    },
  ];

  async execute(
    templateIdentifier: string,
    options: PublishOptions
  ): Promise<void> {
    try {
      logger.info(chalk.cyan('📦 Publishing template to marketplace...'));

      // Determine template path
      const templatePath = options.templatePath || templateIdentifier || '.';

      // Validate template exists
      await this.validateTemplatePath(templatePath);

      // Load and validate template
      const template = await this.loadTemplate(templatePath);
      await this.validateTemplate(template, options.force);

      // Enhance template with publishing metadata
      const enhancedTemplate = await this.enhanceTemplateForPublishing(
        template,
        options
      );

      // Get marketplace service
      const marketplaceService = await MarketplaceService.getInstance();

      // Publish template
      const result = await marketplaceService.publishTemplate(
        enhancedTemplate,
        {
          version: options.version,
          isDraft: options.draft,
          isPrivate: options.private,
        }
      );

      // Display success message
      logger.info(chalk.green('✅ Template published successfully!'));
      logger.info(`Template ID: ${chalk.cyan(result.templateId)}`);
      logger.info(`Version: ${chalk.cyan(result.version)}`);
      logger.info(
        `Status: ${chalk.cyan(options.draft ? 'Draft' : 'Published')}`
      );

      if (result.url) {
        logger.info(`View at: ${chalk.blue(result.url)}`);
      }
    } catch (error) {
      logger.error(chalk.red('❌ Failed to publish template'));
      if (error instanceof Error) {
        logger.error(chalk.red(error.message));
      }
      throw error;
    }
  }

  private async validateTemplatePath(templatePath: string): Promise<void> {
    try {
      const stats = await fs.stat(templatePath);
      if (!stats.isDirectory() && !stats.isFile()) {
        throw new Error(
          `Template path must be a file or directory: ${templatePath}`
        );
      }
    } catch {
      throw new Error(`Template not found: ${templatePath}`);
    }
  }

  private async loadTemplate(templatePath: string): Promise<any> {
    try {
      const stats = await fs.stat(templatePath);

      if (stats.isDirectory()) {
        // Look for template.json or template.yaml in directory
        const jsonPath = path.join(templatePath, 'template.json');
        const yamlPath = path.join(templatePath, 'template.yaml');
        const ymlPath = path.join(templatePath, 'template.yml');

        let templateFile: string | null = null;
        if (await this.fileExists(jsonPath)) {
          templateFile = jsonPath;
        } else if (await this.fileExists(yamlPath)) {
          templateFile = yamlPath;
        } else if (await this.fileExists(ymlPath)) {
          templateFile = ymlPath;
        }

        if (!templateFile) {
          throw new Error(
            'No template.json, template.yaml, or template.yml found in directory'
          );
        }

        return this.parseTemplateFile(templateFile);
      }
      // Load single file
      return this.parseTemplateFile(templatePath);
    } catch (error) {
      throw new Error(
        `Failed to load template: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async parseTemplateFile(filePath: string): Promise<any> {
    const content = await fs.readFile(filePath, 'utf-8');

    if (filePath.endsWith('.json')) {
      return JSON.parse(content);
    }

    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
      const yaml = require('js-yaml');
      return yaml.load(content);
    }

    throw new Error(`Unsupported template format: ${path.extname(filePath)}`);
  }

  private async validateTemplate(
    template: any,
    force?: boolean
  ): Promise<void> {
    const validator = new TemplateValidator();
    const result = await validator.validate(template);

    if (!result.valid) {
      logger.error(chalk.red('❌ Template validation failed:'));
      result.errors.forEach(error => {
        logger.error(chalk.red(`  - ${error}`));
      });

      if (!force) {
        throw new Error(
          'Template validation failed. Use --force to publish anyway.'
        );
      }

      logger.warn(
        chalk.yellow('⚠️  Publishing with validation errors (--force used)')
      );
    }

    if (result.warnings && result.warnings.length > 0) {
      logger.warn(chalk.yellow('⚠️  Template validation warnings:'));
      result.warnings.forEach(warning => {
        logger.warn(chalk.yellow(`  - ${warning}`));
      });
    }
  }

  private async enhanceTemplateForPublishing(
    template: any,
    options: PublishOptions
  ): Promise<TemplateModel> {
    const currentUser = await this.getCurrentUser();

    // Create enhanced template model
    const enhanced: Partial<TemplateModel> = {
      ...template,
      author: {
        id: currentUser.id,
        name: currentUser.username,
      },
      category: options.category || template.category,
      tags: options.tags
        ? options.tags.split(',').map(tag => tag.trim())
        : template.tags || [],
      description: options.description || template.description,
      currentVersion: options.version || '1.0.0',
      versions: [
        {
          version: options.version || '1.0.0',
          description: options.description || template.description || '',
          content: template.content || template,
          dependencies: template.dependencies || [],
          variables: template.variables || [],
          hooks: template.hooks || [],
          publishedAt: new Date(),
          changelog: 'Initial release',
        },
      ],
      created: new Date(),
      updated: new Date(),
      featured: false,
      verified: false,
      deprecated: false,
      rating: 0,
      stats: {
        downloads: 0,
        likes: 0,
        views: 0,
      },
      metadata: {
        isPrivate: options.private || false,
        isDraft: options.draft || false,
      },
    };

    return enhanced as TemplateModel;
  }

  private async getCurrentUser(): Promise<{ id: string; username: string }> {
    // In a real implementation, this would get the authenticated user
    const userId = process.env.USER_ID || process.env.USER || 'anonymous-user';

    try {
      const authorService = AuthorService.getInstance();
      const profile = await authorService.getProfile(userId);
      return {
        id: profile.id,
        username: profile.username,
      };
    } catch {
      // Fallback for unauthenticated users
      return {
        id: userId,
        username: userId,
      };
    }
  }
}

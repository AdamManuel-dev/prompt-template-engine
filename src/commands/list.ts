/**
 * @fileoverview List command for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T10:54:00Z
 *
 * Features: Template discovery and listing with metadata
 * Main APIs: listCommand() - discovers and displays available templates
 * Constraints: Requires readable template directories
 * Patterns: File system traversal, template parsing, formatted output
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { TemplateEngineError } from '../utils/errors';
import { loadConfig, Config } from '../utils/config';

export interface ListOptions {
  all?: boolean;
  format?: 'table' | 'json' | 'yaml';
  category?: string;
  search?: string;
  details?: boolean;
}

export interface TemplateInfo {
  name: string;
  path: string;
  category: string;
  description?: string;
  variables: string[];
  size: number;
  lastModified: Date;
  metadata: Record<string, unknown>;
}

/**
 * Format file size in human-readable format
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

/**
 * Extract template variables from content
 */
function extractVariables(content: string): string[] {
  const variablePattern = /\{\{(\w+)(?:\|[^}]+)?\}\}/g;
  const variables = new Set<string>();

  let match = variablePattern.exec(content);
  while (match !== null) {
    if (match[1]) {
      variables.add(match[1]);
    }
    match = variablePattern.exec(content);
  }

  return Array.from(variables).sort();
}

/**
 * Extract metadata from template content
 */
function extractMetadata(content: string): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  // Look for frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    try {
      const frontmatterLines = frontmatterMatch[1]?.split('\n') ?? [];
      frontmatterLines.forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          metadata[key.trim()] = valueParts.join(':').trim();
        }
      });
    } catch {
      // Ignore frontmatter parsing errors
    }
  }

  return metadata;
}

/**
 * Extract description from content (first non-empty line or heading)
 */
function extractDescription(content: string): string | undefined {
  const lines = content.split('\n');

  const nonEmptyLine = lines.find(line => {
    const trimmed = line.trim();

    // Skip frontmatter
    if (trimmed === '---') return false;

    // Skip empty lines
    if (!trimmed) return false;

    // Use heading as description
    if (trimmed.startsWith('#')) {
      return true;
    }

    // Use first non-empty line
    return trimmed.length > 0;
  });

  if (nonEmptyLine) {
    const trimmed = nonEmptyLine.trim();
    if (trimmed.startsWith('#')) {
      return trimmed.replace(/^#+\s*/, '');
    }
    return trimmed.length > 100 ? `${trimmed.substring(0, 97)}...` : trimmed;
  }

  return undefined;
}

/**
 * Analyze a template file to extract information
 */
async function analyzeTemplate(
  filePath: string,
  basePath: string
): Promise<TemplateInfo> {
  const stats = await fs.stat(filePath);
  const content = await fs.readFile(filePath, 'utf-8');

  // Extract relative path and name
  const relativePath = path.relative(basePath, filePath);
  const name = path.basename(filePath, path.extname(filePath));

  // Determine category from directory structure
  const pathParts = relativePath.split(path.sep);
  const category = pathParts.length > 1 ? pathParts[0] || 'general' : 'general';

  // Extract variables
  const variables = extractVariables(content);

  // Extract metadata
  const metadata = extractMetadata(content);

  // Get description from metadata or first line
  const description =
    (typeof metadata.description === 'string'
      ? metadata.description
      : undefined) || extractDescription(content);

  return {
    name,
    path: filePath,
    category,
    description: description || 'No description available',
    variables,
    size: stats.size,
    lastModified: stats.mtime,
    metadata,
  };
}

/**
 * Discover templates in configured directories
 */
async function discoverTemplates(
  config: Config,
  options: ListOptions
): Promise<TemplateInfo[]> {
  const templates: TemplateInfo[] = [];

  // Get search paths
  const searchPaths = [
    ...config.templatePaths,
    path.join(process.cwd(), 'templates'),
    path.join(process.cwd(), '.cursor-prompt', 'templates'),
  ];

  logger.debug(`Searching in ${searchPaths.length} directories...`);

  const searchResults = await Promise.allSettled(
    searchPaths.map(async searchPath => {
      try {
        await fs.access(searchPath);
        logger.debug(`Scanning: ${searchPath}`);

        // Find template files
        const pattern = path.join(searchPath, '**', '*.{md,txt,template}');
        const files = await glob(pattern, { nodir: true });

        const templateResults = await Promise.allSettled(
          files.map(async file => {
            try {
              const templateInfo = await analyzeTemplate(file, searchPath);

              // Skip hidden templates unless --all is specified
              if (!options.all && templateInfo.name.startsWith('.')) {
                return null;
              }

              return templateInfo;
            } catch (templateError) {
              logger.debug(
                `Failed to analyze template ${file}: ${templateError}`
              );
              return null;
            }
          })
        );

        return templateResults
          .filter(
            result => result.status === 'fulfilled' && result.value !== null
          )
          .map(
            result => (result as PromiseFulfilledResult<TemplateInfo>).value
          );
      } catch {
        logger.debug(`Skipping inaccessible directory: ${searchPath}`);
        return [];
      }
    })
  );

  // Flatten results
  searchResults.forEach(result => {
    if (result.status === 'fulfilled') {
      templates.push(...result.value);
    }
  });

  // Sort templates by category, then by name
  templates.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  return templates;
}

/**
 * Filter templates based on options
 */
function filterTemplates(
  templates: TemplateInfo[],
  options: ListOptions
): TemplateInfo[] {
  let filtered = templates;

  // Filter by category
  if (options.category) {
    filtered = filtered.filter(t =>
      t.category.toLowerCase().includes(options.category!.toLowerCase())
    );
  }

  // Filter by search term
  if (options.search) {
    const searchTerm = options.search.toLowerCase();
    filtered = filtered.filter(
      t =>
        t.name.toLowerCase().includes(searchTerm) ||
        t.description?.toLowerCase().includes(searchTerm) ||
        t.category.toLowerCase().includes(searchTerm)
    );
  }

  return filtered;
}

/**
 * Display templates in table format
 */
async function displayTableFormat(
  templates: TemplateInfo[],
  options: ListOptions
): Promise<void> {
  logger.info('');

  // Group by category
  const grouped = templates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category]?.push(template);
      return acc;
    },
    {} as Record<string, TemplateInfo[]>
  );

  Object.entries(grouped).forEach(([category, categoryTemplates]) => {
    // Category header
    logger.info(chalk.cyan(`📁 ${category.toUpperCase()}`));
    logger.info(chalk.gray('─'.repeat(60)));

    categoryTemplates.forEach(template => {
      // Template name
      logger.info(chalk.green(`  ${template.name}`));

      // Description
      if (template.description) {
        logger.info(chalk.gray(`    ${template.description}`));
      }

      // Details if requested
      if (options.details) {
        logger.info(chalk.gray(`    Path: ${template.path}`));
        logger.info(chalk.gray(`    Size: ${formatSize(template.size)}`));
        logger.info(
          chalk.gray(
            `    Modified: ${template.lastModified.toLocaleDateString()}`
          )
        );

        if (template.variables.length > 0) {
          logger.info(
            chalk.gray(`    Variables: ${template.variables.join(', ')}`)
          );
        }

        if (Object.keys(template.metadata).length > 0) {
          const metadataStr = Object.entries(template.metadata)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          logger.info(chalk.gray(`    Metadata: ${metadataStr}`));
        }
      } else {
        // Compact format
        const details = [];
        if (template.variables.length > 0) {
          details.push(`${template.variables.length} variables`);
        }
        details.push(formatSize(template.size));

        if (details.length > 0) {
          logger.info(chalk.gray(`    (${details.join(', ')})`));
        }
      }

      logger.info('');
    });
  });
}

/**
 * Display templates in the specified format
 */
async function displayTemplates(
  templates: TemplateInfo[],
  options: ListOptions
): Promise<void> {
  switch (options.format) {
    case 'json':
      logger.info(JSON.stringify(templates, null, 2));
      break;

    case 'yaml':
      // Simple YAML-like output
      templates.forEach(template => {
        logger.info(`- name: ${template.name}`);
        logger.info(`  category: ${template.category}`);
        logger.info(`  path: ${template.path}`);
        if (template.description) {
          logger.info(`  description: ${template.description}`);
        }
        logger.info(`  variables: [${template.variables.join(', ')}]`);
        logger.info(`  lastModified: ${template.lastModified.toISOString()}`);
        logger.info('');
      });
      break;

    case 'table':
    default:
      await displayTableFormat(templates, options);
      break;
  }
}

/**
 * List available templates
 */
export async function listCommand(options: ListOptions): Promise<void> {
  try {
    logger.info('📋 Discovering available templates...');

    // Load configuration
    const config = await loadConfig();

    // Discover templates
    const templates = await discoverTemplates(config, options);

    // Filter templates if needed
    const filteredTemplates = filterTemplates(templates, options);

    if (filteredTemplates.length === 0) {
      logger.warn('⚠️  No templates found matching the criteria');
      return;
    }

    // Display templates
    await displayTemplates(filteredTemplates, options);

    logger.success(`✅ Found ${filteredTemplates.length} template(s)`);
  } catch (error: any) {
    if (error instanceof TemplateEngineError) {
      logger.error(`❌ List failed: ${error.message}`);
      throw error;
    } else {
      logger.error(`❌ Unexpected error during list: ${error}`);
      throw new TemplateEngineError(
        `List command failed: ${error}`,
        undefined,
        'LIST_ERROR'
      );
    }
  }
}

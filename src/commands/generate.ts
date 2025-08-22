/**
 * @fileoverview Generate command for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T10:54:00Z
 *
 * Features: Template processing and prompt generation
 * Main APIs: generateCommand() - processes templates with variables
 * Constraints: Requires template files and valid configuration
 * Patterns: Template parsing, variable substitution, output formatting
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import clipboardy from 'clipboardy';
import { logger } from '../utils/logger';
import { TemplateEngineError, FileNotFoundError } from '../utils/errors';
import { loadConfig, Config } from '../utils/config';

export interface GenerateOptions {
  template: string;
  variables?: Record<string, string>;
  output?: string;
  clipboard?: boolean;
  preview?: boolean;
  format?: 'markdown' | 'plain' | 'json';
}

export interface TemplateVariable {
  name: string;
  description?: string;
  required: boolean;
  defaultValue?: string;
}

export interface ProcessedTemplate {
  content: string;
  variables: TemplateVariable[];
  metadata: Record<string, unknown>;
}

/**
 * Find template file by name or path
 */
async function findTemplate(
  templateName: string,
  config: Config
): Promise<string> {
  logger.debug(`Looking for template: ${templateName}`);

  // If it's already a full path, use it directly
  if (path.isAbsolute(templateName)) {
    try {
      await fs.access(templateName);
      return templateName;
    } catch {
      throw new FileNotFoundError(
        `Template file not found: ${templateName}`,
        'TEMPLATE_NOT_FOUND'
      );
    }
  }

  // Search in configured template directories
  const searchPaths = [
    ...config.templatePaths,
    path.join(process.cwd(), 'templates'),
    path.join(process.cwd(), '.cursor-prompt', 'templates'),
  ];

  // Use Promise.all with map to avoid for...of loop and await-in-loop
  const searchResults = await Promise.all(
    searchPaths.map(async searchPath => {
      logger.debug(`Searching in: ${searchPath}`);

      try {
        // Try exact match first
        const exactPath = path.join(searchPath, templateName);
        await fs.access(exactPath);
        return exactPath;
      } catch {
        // Continue searching
      }

      try {
        // Try with .md extension
        const mdPath = path.join(searchPath, `${templateName}.md`);
        await fs.access(mdPath);
        return mdPath;
      } catch {
        // Continue searching
      }

      // Try glob pattern search
      try {
        const pattern = path.join(searchPath, '**', `*${templateName}*`);
        const matches = await glob(pattern, { nodir: true });

        if (matches.length > 0) {
          if (matches.length > 1) {
            logger.warn(`⚠️  Multiple templates found for "${templateName}":`);
            matches.forEach(match => logger.info(`  - ${match}`));
            logger.info(`Using: ${matches[0]}`);
          }
          return matches[0];
        }
      } catch (error) {
        logger.debug(`Glob search failed in ${searchPath}: ${error}`);
      }

      return null;
    })
  );

  // Find the first successful result
  const foundTemplate = searchResults.find(result => result !== null);
  if (foundTemplate) {
    return foundTemplate;
  }

  throw new FileNotFoundError(
    `Template "${templateName}" not found in any of the search paths: ${searchPaths.join(', ')}`,
    'TEMPLATE_NOT_FOUND'
  );
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
      // Simple YAML-like parsing for basic metadata
      const frontmatterLines = frontmatterMatch[1].split('\n');
      frontmatterLines.forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          metadata[key.trim()] = valueParts.join(':').trim();
        }
      });
    } catch (error) {
      logger.debug(`Failed to parse frontmatter: ${error}`);
    }
  }

  return metadata;
}

/**
 * Process template content with variable substitution
 */
async function processTemplate(
  content: string,
  variables: Record<string, string>
): Promise<ProcessedTemplate> {
  logger.debug('Processing template with variables...');

  // Extract template variables
  const variablePattern = /\{\{(\w+)(?:\|([^}]+))?\}\}/g;
  const foundVariables: TemplateVariable[] = [];
  const variableMatches = content.matchAll(variablePattern);

  Array.from(variableMatches).forEach(match => {
    const [, name, description] = match;
    if (!foundVariables.some(v => v.name === name)) {
      foundVariables.push({
        name,
        description,
        required: true,
        defaultValue: undefined,
      });
    }
  });

  logger.debug(`Found ${foundVariables.length} template variables`);

  // Check for missing required variables
  const missingVariables = foundVariables
    .filter(v => v.required && !(v.name in variables))
    .map(v => v.name);

  if (missingVariables.length > 0) {
    throw new TemplateEngineError(
      `Missing required variables: ${missingVariables.join(', ')}`,
      undefined,
      'MISSING_VARIABLES'
    );
  }

  // Substitute variables
  let processedContent = content;

  foundVariables.forEach(variable => {
    const value = variables[variable.name] || variable.defaultValue || '';
    const pattern = new RegExp(
      `\\{\\{${variable.name}(?:\\|[^}]+)?\\}\\}`,
      'g'
    );
    processedContent = processedContent.replace(pattern, value);
  });

  // Extract metadata from template
  const metadata = extractMetadata(content);

  return {
    content: processedContent,
    variables: foundVariables,
    metadata,
  };
}

/**
 * Preview template without generating final output
 */
async function previewTemplate(
  processed: ProcessedTemplate,
  options: GenerateOptions
): Promise<void> {
  logger.info('🔍 Template Preview:');
  logger.info('═'.repeat(50));

  if (Object.keys(processed.metadata).length > 0) {
    logger.info('📋 Metadata:');
    Object.entries(processed.metadata).forEach(([key, value]) => {
      logger.info(`  ${key}: ${value}`);
    });
    logger.info('');
  }

  logger.info('📝 Variables:');
  processed.variables.forEach(variable => {
    const status = options.variables?.[variable.name] ? '✅' : '❌';
    const value = options.variables?.[variable.name] || '<not provided>';
    logger.info(`  ${status} ${variable.name}: ${value}`);
    if (variable.description) {
      logger.info(`      Description: ${variable.description}`);
    }
  });

  logger.info('');
  logger.info('📄 Content Preview (first 500 chars):');
  logger.info('─'.repeat(50));
  const preview = processed.content.substring(0, 500);
  logger.info(preview);
  if (processed.content.length > 500) {
    logger.info(`... (${processed.content.length - 500} more characters)`);
  }
}

/**
 * Format output according to specified format
 */
function formatOutput(processed: ProcessedTemplate, format: string): string {
  switch (format) {
    case 'plain':
      return processed.content;

    case 'json':
      return JSON.stringify(
        {
          content: processed.content,
          variables: processed.variables,
          metadata: processed.metadata,
        },
        null,
        2
      );

    case 'markdown':
    default:
      return processed.content;
  }
}

/**
 * Handle output to various destinations
 */
async function handleOutput(
  output: string,
  options: GenerateOptions
): Promise<void> {
  // Write to file if specified
  if (options.output) {
    await fs.writeFile(options.output, output);
    logger.success(`📁 Output written to: ${options.output}`);
  }

  // Copy to clipboard if requested
  if (options.clipboard) {
    try {
      await clipboardy.write(output);
      logger.success('📋 Output copied to clipboard');
    } catch (error) {
      logger.warn(`⚠️  Failed to copy to clipboard: ${error}`);
    }
  }

  // Print to console if no other output specified
  if (!options.output && !options.clipboard) {
    logger.info(`\n${'═'.repeat(50)}`);
    logger.info('Generated Prompt:');
    logger.info('═'.repeat(50));
    logger.info(output);
    logger.info(`${'═'.repeat(50)}\n`);
  }
}

/**
 * Generate a prompt from a template
 */
export async function generateCommand(options: GenerateOptions): Promise<void> {
  try {
    logger.info(`📝 Generating prompt from template: ${options.template}`);

    // Load configuration
    const config = await loadConfig();

    // Find and load template
    const templatePath = await findTemplate(options.template, config);
    const templateContent = await fs.readFile(templatePath, 'utf-8');

    // Process template
    const processed = await processTemplate(
      templateContent,
      options.variables || {}
    );

    // Handle preview mode
    if (options.preview) {
      await previewTemplate(processed, options);
      return;
    }

    // Format output
    const output = formatOutput(processed, options.format || 'markdown');

    // Handle output destinations
    await handleOutput(output, options);

    logger.success('✅ Template generated successfully');
  } catch (error) {
    if (error instanceof TemplateEngineError) {
      logger.error(`❌ Generation failed: ${error.message}`);
      throw error;
    } else {
      logger.error(`❌ Unexpected error during generation: ${error}`);
      throw new TemplateEngineError(
        `Generate command failed: ${error}`,
        undefined,
        'GENERATE_ERROR'
      );
    }
  }
}

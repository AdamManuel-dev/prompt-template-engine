/**
 * @fileoverview Enhanced generate command with context gathering
 * @lastmodified 2025-08-22T15:00:00Z
 *
 * Features: Template processing with automatic context gathering
 * Main APIs: generateEnhancedCommand() - processes templates with context
 * Constraints: Requires template files and valid configuration
 * Patterns: Template parsing, context injection, variable substitution
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import clipboardy from 'clipboardy';
import { logger } from '../utils/logger';
import { TemplateEngineError, FileNotFoundError } from '../utils/errors';
import { loadConfig, Config } from '../utils/config';
import { TemplateEngine } from '../core/template-engine';
import {
  ContextAggregator,
  ContextOptions,
} from '../services/context-aggregator';
import { gitService } from '../services/git-service';

export interface GenerateEnhancedOptions {
  template: string;
  variables?: Record<string, string>;
  output?: string;
  clipboard?: boolean;
  preview?: boolean;
  format?: 'markdown' | 'plain' | 'json';
  // Context options
  includeGit?: boolean;
  includeFiles?: boolean;
  includeSystem?: boolean;
  filePatterns?: string[];
  contextFiles?: string[];
  maxContextSize?: number;
}

interface TemplateMetadata {
  name?: string;
  description?: string;
  context?: {
    git?: boolean;
    files?: string[];
    patterns?: string[];
    system?: boolean;
  };
  variables?: Record<
    string,
    {
      description?: string;
      default?: string;
      required?: boolean;
    }
  >;
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

  // Search for template
  const searchResults = await Promise.all(
    searchPaths.map(async searchPath => {
      logger.debug(`Searching in: ${searchPath}`);

      // Try exact match
      const exactPath = path.join(searchPath, templateName);
      try {
        await fs.access(exactPath);
        return exactPath;
      } catch {
        // Continue
      }

      // Try with extensions
      const extensions = ['.md', '.template', '.txt'];
      // eslint-disable-next-line no-restricted-syntax
      for (const ext of extensions) {
        const extPath = path.join(searchPath, `${templateName}${ext}`);
        try {
          // eslint-disable-next-line no-await-in-loop
          await fs.access(extPath);
          return extPath;
        } catch {
          // Continue
        }
      }

      // Try glob pattern
      try {
        const pattern = path.join(searchPath, '**', `*${templateName}*`);
        const matches = await glob(pattern, { nodir: true });
        if (matches.length > 0) {
          return matches[0];
        }
      } catch {
        // Continue
      }

      return null;
    })
  );

  const foundTemplate = searchResults.find(result => result !== null);
  if (foundTemplate) {
    return foundTemplate;
  }

  throw new FileNotFoundError(
    `Template "${templateName}" not found`,
    'TEMPLATE_NOT_FOUND'
  );
}

/**
 * Parse template metadata from frontmatter
 */
function parseTemplateMetadata(content: string): TemplateMetadata {
  const metadata: TemplateMetadata = {};

  // Check for YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return metadata;
  }

  try {
    // Simple YAML parsing
    const lines = frontmatterMatch[1].split('\n');
    let currentSection: string | null = null;
    const currentIndent = 0;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const indent = line.length - line.trimStart().length;

      // Parse key-value pairs
      if (trimmed.includes(':')) {
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim();

        if (indent === 0) {
          // Top-level key
          currentSection = key.trim();
          if (value && value !== '') {
            const section = currentSection as keyof TemplateMetadata;
            if (section === 'name' || section === 'description') {
              metadata[section] = value;
            }
          }
        } else if (currentSection === 'context' && indent > currentIndent) {
          // Context section
          if (!metadata.context) metadata.context = {};
          const contextKey = key.trim();

          if (contextKey === 'git') {
            metadata.context.git = value === 'true';
          } else if (contextKey === 'system') {
            metadata.context.system = value === 'true';
          } else if (contextKey === 'files' || contextKey === 'patterns') {
            const items = value
              .split(',')
              .map(s => s.trim())
              .filter(Boolean);
            metadata.context[contextKey as 'files' | 'patterns'] = items;
          }
        }
      }
    });
  } catch (error) {
    logger.debug(`Failed to parse template metadata: ${error}`);
  }

  return metadata;
}

/**
 * Gather context based on template requirements
 */
async function gatherTemplateContext(
  metadata: TemplateMetadata,
  options: GenerateEnhancedOptions
): Promise<Record<string, unknown>> {
  const contextAggregator = new ContextAggregator();

  // Merge template requirements with user options
  const contextOptions: ContextOptions = {
    includeGit: options.includeGit ?? metadata.context?.git ?? true,
    includeFiles: !!(
      options.includeFiles ??
      (metadata.context?.files || metadata.context?.patterns)
    ),
    includeSystem: options.includeSystem ?? metadata.context?.system ?? true,
    filePatterns: [
      ...(options.filePatterns || []),
      ...(metadata.context?.patterns || []),
    ],
    maxTotalSize: options.maxContextSize || 500 * 1024,
  };

  // Add specific files if requested
  const specificFiles = [
    ...(options.contextFiles || []),
    ...(metadata.context?.files || []),
  ];

  if (specificFiles.length > 0) {
    contextOptions.filePatterns = [
      ...(contextOptions.filePatterns || []),
      ...specificFiles,
    ];
  }

  logger.debug(
    `Gathering context with options: ${JSON.stringify(contextOptions)}`
  );

  const aggregatedContext =
    await contextAggregator.gatherContext(contextOptions);

  // Convert to template-friendly format
  const context: Record<string, unknown> = {
    system: aggregatedContext.system,
  };

  if (aggregatedContext.git?.isGitRepo) {
    context.git = {
      branch: aggregatedContext.git.branch,
      isClean: aggregatedContext.git.status?.isClean,
      files: {
        staged: aggregatedContext.git.status?.staged || [],
        modified: aggregatedContext.git.status?.modified || [],
        untracked: aggregatedContext.git.status?.untracked || [],
      },
      lastCommit: aggregatedContext.git.lastCommit,
    };
  }

  if (aggregatedContext.project) {
    context.project = {
      totalFiles: aggregatedContext.project.totalFiles,
      totalSize: aggregatedContext.project.totalSize,
      mainLanguage:
        aggregatedContext.project.filesByExtension.size > 0
          ? Array.from(
              aggregatedContext.project.filesByExtension.entries()
            ).sort((a, b) => b[1] - a[1])[0][0]
          : 'unknown',
    };
  }

  if (aggregatedContext.files && aggregatedContext.files.size > 0) {
    const filesObj: Record<string, string> = {};
    aggregatedContext.files.forEach((content, filePath) => {
      const relativePath = path.relative(process.cwd(), filePath);
      filesObj[relativePath] = content.content;
    });
    context.files = filesObj;
  }

  // Add context summary
  context.contextSummary =
    ContextAggregator.getContextSummary(aggregatedContext);

  return context;
}

/**
 * Process template with context and variables
 */
async function processTemplateWithContext(
  templatePath: string,
  variables: Record<string, string>,
  context: Record<string, unknown>
): Promise<string> {
  const engine = new TemplateEngine();
  const templateContent = await fs.readFile(templatePath, 'utf-8');

  // Remove frontmatter if present
  const contentWithoutFrontmatter = templateContent.replace(
    /^---\n[\s\S]*?\n---\n/,
    ''
  );

  // Merge variables with context
  const fullContext = {
    ...context,
    ...variables,
    // Add helper variables
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
  };

  // Process template
  const processed = await engine.render(contentWithoutFrontmatter, fullContext);

  return processed;
}

/**
 * Enhanced generate command with context gathering
 */
export async function generateEnhancedCommand(
  options: GenerateEnhancedOptions
): Promise<void> {
  try {
    logger.info(
      `🚀 Generating enhanced prompt from template: ${options.template}`
    );

    // Load configuration
    const config = await loadConfig();

    // Find template
    const templatePath = await findTemplate(options.template, config);
    logger.success(`✅ Found template: ${templatePath}`);

    // Read and parse template
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const metadata = parseTemplateMetadata(templateContent);

    // Gather context
    logger.info('📊 Gathering context...');
    const context = await gatherTemplateContext(metadata, options);

    // Check if we're in a git repo
    const isGitRepo = await gitService.isGitRepo();
    if (isGitRepo) {
      const gitSummary = await gitService.getSummary();
      logger.debug(`Git context: ${gitSummary}`);
    }

    // Process template
    logger.info('🔄 Processing template...');
    const processed = await processTemplateWithContext(
      templatePath,
      options.variables || {},
      context
    );

    // Handle preview mode
    if (options.preview) {
      logger.info('\n📋 Template Preview:');
      logger.info('═'.repeat(50));
      logger.info(`Context Summary: ${context.contextSummary}`);
      logger.info(
        `Variables: ${Object.keys(options.variables || {}).join(', ')}`
      );
      logger.info('─'.repeat(50));
      logger.info(processed.substring(0, 500));
      if (processed.length > 500) {
        logger.info(`... (${processed.length - 500} more characters)`);
      }
      return;
    }

    // Format output
    let output = processed;
    if (options.format === 'json') {
      output = JSON.stringify(
        {
          content: processed,
          metadata,
          context: context.contextSummary,
        },
        null,
        2
      );
    }

    // Handle output destinations
    if (options.output) {
      await fs.writeFile(options.output, output);
      logger.success(`📁 Output written to: ${options.output}`);
    }

    if (options.clipboard) {
      try {
        await clipboardy.write(output);
        logger.success('📋 Output copied to clipboard');
      } catch (error) {
        logger.warn(`⚠️  Failed to copy to clipboard: ${error}`);
        logger.info('Output:');
        logger.info(output);
      }
    }

    if (!options.output && !options.clipboard) {
      logger.info('\n═'.repeat(50));
      logger.info('Generated Prompt:');
      logger.info('═'.repeat(50));
      logger.info(output);
      logger.info('═'.repeat(50));
    }

    logger.success('✨ Template generated successfully with context!');
  } catch (error) {
    if (error instanceof TemplateEngineError) {
      logger.error(`❌ Generation failed: ${error.message}`);
      throw error;
    } else {
      logger.error(`❌ Unexpected error: ${error}`);
      throw new TemplateEngineError(
        `Enhanced generate command failed: ${error}`,
        undefined,
        'GENERATE_ENHANCED_ERROR'
      );
    }
  }
}

// Also export a wrapper for the standard generate command
export { generateCommand } from './generate';

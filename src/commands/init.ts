/**
 * @fileoverview Initialize command for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T10:54:00Z
 *
 * Features: Project initialization with template scaffolding
 * Main APIs: initCommand() - creates project structure and config
 * Constraints: Requires write access to target directory
 * Patterns: Interactive prompts, file system operations, error handling
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { TemplateEngineError, ConfigError } from '../utils/errors';
import { createDefaultConfig, writeConfig } from '../utils/config';

export interface InitOptions {
  name?: string;
  template?: string;
  force?: boolean;
  directory?: string;
}

/**
 * Validate target directory and handle conflicts
 */
async function validateDirectory(
  targetDir: string,
  force?: boolean
): Promise<void> {
  try {
    await fs.access(targetDir);

    // Directory exists, check if it's empty
    const files = await fs.readdir(targetDir);
    const hasConfigFile = files.some(file => file.startsWith('.cursor-prompt'));

    if (hasConfigFile && !force) {
      throw new ConfigError(
        'Directory already contains cursor-prompt configuration. Use --force to override.',
        undefined,
        'CONFIG_EXISTS'
      );
    }

    if (files.length > 0 && !force) {
      logger.warn(`⚠️  Directory is not empty: ${targetDir}`);
      logger.info('Use --force to initialize anyway');
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'ENOENT') {
      // Directory doesn't exist, create it
      await fs.mkdir(targetDir, { recursive: true });
      logger.debug(`Created directory: ${targetDir}`);
    } else if (error instanceof ConfigError) {
      throw error;
    } else {
      throw new TemplateEngineError(
        `Failed to validate directory: ${(error as Error).message}`,
        undefined,
        'DIRECTORY_ERROR'
      );
    }
  }
}

/**
 * Create the basic project structure
 */
async function createProjectStructure(
  targetDir: string,
  projectName: string
): Promise<void> {
  const directories = [
    'templates',
    'templates/bugs',
    'templates/features',
    'templates/refactor',
    'templates/docs',
    '.cursor-prompt',
    '.cursor-prompt/cache',
  ];

  logger.debug('Creating project directories...');

  await Promise.all(
    directories.map(async dir => {
      const fullPath = path.join(targetDir, dir);
      await fs.mkdir(fullPath, { recursive: true });
      logger.debug(`Created directory: ${dir}`);
    })
  );

  // Create README.md
  const readmeContent = `# ${projectName}

Cursor Prompt Templates for enhanced development workflow.

## Usage

- \`cursor-prompt list\` - List available templates
- \`cursor-prompt generate <template>\` - Generate prompt from template
- \`cursor-prompt init\` - Initialize new template project

## Templates

This project includes templates for:
- Bug fixes
- Feature development
- Refactoring
- Documentation

## Configuration

See \`.cursor-prompt.config.json\` for configuration options.
`;

  await fs.writeFile(path.join(targetDir, 'README.md'), readmeContent);
  logger.debug('Created README.md');
}

/**
 * Get default bug fix template content
 */
async function getDefaultBugTemplate(): Promise<string> {
  return `# Bug Fix Template

## Problem Description
{{problem_description}}

## Expected Behavior
{{expected_behavior}}

## Current Behavior
{{current_behavior}}

## Steps to Reproduce
{{steps_to_reproduce}}

## Root Cause Analysis
{{root_cause}}

## Proposed Solution
{{proposed_solution}}

## Files to Modify
{{files_to_modify}}

## Testing Strategy
{{testing_strategy}}

## Additional Context
{{additional_context}}
`;
}

/**
 * Get default feature template content
 */
async function getDefaultFeatureTemplate(): Promise<string> {
  return `# Feature Development Template

## Feature Overview
{{feature_overview}}

## Requirements
{{requirements}}

## User Stories
{{user_stories}}

## Technical Approach
{{technical_approach}}

## Implementation Plan
{{implementation_plan}}

## Files to Create/Modify
{{files_to_modify}}

## Dependencies
{{dependencies}}

## Testing Plan
{{testing_plan}}

## Acceptance Criteria
{{acceptance_criteria}}

## Additional Notes
{{additional_notes}}
`;
}

/**
 * Get default refactor template content
 */
async function getDefaultRefactorTemplate(): Promise<string> {
  return `# Refactor Template

## Refactoring Goal
{{refactoring_goal}}

## Current State
{{current_state}}

## Target State
{{target_state}}

## Motivation
{{motivation}}

## Approach
{{approach}}

## Files Affected
{{files_affected}}

## Breaking Changes
{{breaking_changes}}

## Migration Guide
{{migration_guide}}

## Testing Strategy
{{testing_strategy}}

## Performance Impact
{{performance_impact}}

## Additional Context
{{additional_context}}
`;
}

/**
 * Create initial template files based on template type
 */
async function createInitialTemplates(
  targetDir: string,
  templateType: string
): Promise<void> {
  logger.debug(`Creating initial templates for type: ${templateType}`);

  const templatesDir = path.join(targetDir, 'templates');

  // Create default templates regardless of type
  const defaultTemplates = [
    {
      name: 'bug-fix.md',
      path: path.join(templatesDir, 'bugs', 'bug-fix.md'),
      content: await getDefaultBugTemplate(),
    },
    {
      name: 'feature.md',
      path: path.join(templatesDir, 'features', 'feature.md'),
      content: await getDefaultFeatureTemplate(),
    },
    {
      name: 'refactor.md',
      path: path.join(templatesDir, 'refactor', 'refactor.md'),
      content: await getDefaultRefactorTemplate(),
    },
  ];

  await Promise.all(
    defaultTemplates.map(async template => {
      await fs.writeFile(template.path, template.content);
      logger.debug(`Created template: ${template.name}`);
    })
  );

  logger.success(`✅ Created ${defaultTemplates.length} initial templates`);
}

/**
 * Initialize a new cursor-prompt-template-engine project
 */
export async function initCommand(options: InitOptions): Promise<void> {
  try {
    const targetDir = options.directory || process.cwd();
    const projectName = options.name || path.basename(targetDir);
    logger.info(`🚀 Initializing cursor-prompt project: ${projectName}`);
    logger.info(`📂 Target directory: ${targetDir}`);

    // Validate and prepare directory
    await validateDirectory(targetDir, options.force);

    // Create project structure
    await createProjectStructure(targetDir, projectName);

    // Create configuration file
    const config = createDefaultConfig();
    await writeConfig(targetDir, config);

    // Create initial templates
    await createInitialTemplates(targetDir, options.template || 'default');

    logger.success('✅ Project initialized successfully!');
    logger.info('');
    logger.info('Next steps:');
    logger.info('  1. Review templates in ./templates/');
    logger.info('  2. Customize .cursor-prompt.config.json');
    logger.info('  3. Generate your first prompt:');
    logger.info('     cursor-prompt generate bug-fix');
  } catch (error: any) {
    if (error instanceof TemplateEngineError || error instanceof ConfigError) {
      logger.error(`❌ Initialization failed: ${error.message}`);
      throw error;
    } else {
      logger.error(`❌ Unexpected error during initialization: ${error}`);
      throw new TemplateEngineError(
        `Init command failed: ${error}`,
        undefined,
        'INIT_ERROR'
      );
    }
  }
}

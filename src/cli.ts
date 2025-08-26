#!/usr/bin/env node
/**
 * @fileoverview CLI entry point for Cursor Prompt Template Engine
 * @lastmodified 2025-08-23T16:10:00Z
 *
 * Features: CLI commands for template management and prompt generation
 * Main APIs: program commands for generate, list, sync, publish
 * Constraints: Node.js CLI environment, commander.js framework
 * Patterns: Command pattern, async operations, error handling
 */

import { program } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs'; // Keep sync for package.json at startup
import { join } from 'path';
import { TemplateService } from './services/template.service';
// import { TemplateEngine } from './core/template-engine'; // Using service's renderTemplate instead
import { CursorIntegration } from './integrations/cursor';
import { logger } from './utils/logger';
// import type { Template } from './types'; // Currently unused

// PromptWizard CLI Commands
import OptimizeCommand from './cli/commands/optimize';
import CompareCommand from './cli/commands/compare';
import ScoreCommand from './cli/commands/score';
import OptimizationWizardCommand from './cli/commands/wizard';

// Read package.json for version
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

// Configure the CLI program
program
  .name('cursor-prompt')
  .description(
    'CLI tool for intelligent template-based prompt generation in Cursor IDE'
  )
  .version(packageJson.version);

// Generate command
program
  .command('generate <template>')
  .alias('g')
  .description('Generate a prompt from a template')
  .option('-v, --variables <json>', 'Variables as JSON string')
  .option('-f, --file <path>', 'Variables from JSON file')
  .option('-o, --output <path>', 'Output to file instead of stdout')
  .option('-c, --copy', 'Copy to clipboard')
  .action(async (templateName, options) => {
    try {
      const service = new TemplateService();

      // Parse variables
      let variables = {};
      if (options.variables) {
        variables = JSON.parse(options.variables);
      } else if (options.file) {
        const { readFile } = await import('fs/promises');
        const content = await readFile(options.file, 'utf-8');
        variables = JSON.parse(content);
      }

      // Load and render template
      const templatePath = await service.findTemplate(templateName);
      if (!templatePath) {
        throw new Error(`Template not found: ${templateName}`);
      }
      const template = await service.loadTemplate(templatePath);
      const renderedTemplate = await service.renderTemplate(
        template,
        variables
      );
      // For CLI output, combine all file contents
      const content =
        renderedTemplate.files?.map(f => f.content).join('\n') || '';

      // Output result
      if (options.output) {
        const { writeFile } = await import('fs/promises');
        await writeFile(options.output, content);
        console.log(
          chalk.green(`✅ Generated prompt saved to: ${options.output}`)
        );
      } else if (options.copy) {
        const clipboardy = await import('clipboardy');
        await clipboardy.default.write(content);
        console.log(chalk.green('✅ Generated prompt copied to clipboard'));
      } else {
        console.log(content);
      }
    } catch (error) {
      logger.error('Failed to generate prompt');
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// List command
program
  .command('list')
  .alias('ls')
  .description('List available templates')
  .option('-d, --detailed', 'Show detailed information')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .action(async options => {
    try {
      const service = new TemplateService();
      const templates = await service.listTemplates();

      if (templates.length === 0) {
        console.log(chalk.yellow('No templates found'));
        return;
      }

      // Filter by tags if specified
      let filtered = templates;
      if (options.tags) {
        const tags = options.tags.split(',').map((t: string) => t.trim());
        filtered = templates.filter(
          (t: any) => t.tags && tags.some((tag: string) => t.tags.includes(tag))
        );
      }

      // Display templates
      if (options.detailed) {
        filtered.forEach((template: any) => {
          console.log(chalk.cyan(`\n📝 ${template.name}`));
          console.log(
            `   ${chalk.gray(template.description || 'No description')}`
          );
          if (template.version) {
            console.log(`   ${chalk.gray(`Version: ${template.version}`)}`);
          }
          if (template.tags?.length > 0) {
            console.log(
              `   ${chalk.gray(`Tags: ${template.tags.join(', ')}`)}`
            );
          }
        });
      } else {
        console.log(chalk.cyan('\nAvailable Templates:'));
        filtered.forEach((template: any) => {
          console.log(
            `  • ${template.name} ${chalk.gray(template.description ? `- ${template.description}` : '')}`
          );
        });
      }

      console.log(chalk.gray(`\nTotal: ${filtered.length} template(s)`));
    } catch (error) {
      logger.error('Failed to list templates');
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Sync command
program
  .command('sync')
  .description('Sync templates to Cursor rules')
  .option('-d, --dir <path>', 'Output directory for rules', '.cursor/rules')
  .option('--legacy', 'Also generate legacy .cursorrules file')
  .action(async options => {
    try {
      const integration = CursorIntegration.getInstance({
        rulesOutputDir: options.dir,
        legacySupport: options.legacy,
        autoSync: false, // Disable auto-sync for one-time sync command
      });

      await integration.initialize();
      console.log(
        chalk.green(`✅ Successfully synced templates to Cursor rules`)
      );

      // Dispose the integration to clean up resources
      integration.dispose();
    } catch (error) {
      logger.error('Failed to sync templates');
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize Cursor Prompt in current project')
  .option('--force', 'Overwrite existing configuration')
  .action(async options => {
    try {
      const { access, mkdir, writeFile } = await import('fs/promises');
      const { join: pathJoin } = await import('path');

      // Create directories
      const dirs = ['.cursor', '.cursor/rules', 'templates'];
      for (const dir of dirs) {
        try {
          await access(dir);
        } catch {
          await mkdir(dir, { recursive: true });
          console.log(chalk.green(`✅ Created directory: ${dir}`));
        }
      }

      // Create default configuration
      const configPath = '.cursorprompt.json';
      let shouldCreateConfig = options.force;
      if (!shouldCreateConfig) {
        try {
          await access(configPath);
        } catch {
          shouldCreateConfig = true;
        }
      }

      if (shouldCreateConfig) {
        const defaultConfig = {
          version: '1.0.0',
          templates: {
            paths: ['./templates'],
            watch: true,
          },
          cursor: {
            autoSync: true,
            rulesDir: '.cursor/rules',
            legacySupport: true,
          },
        };

        await writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log(chalk.green(`✅ Created configuration: ${configPath}`));
      }

      // Create example template
      const exampleTemplatePath = pathJoin('templates', 'example.yaml');
      let shouldCreateExample = false;
      try {
        await access(exampleTemplatePath);
      } catch {
        shouldCreateExample = true;
      }

      if (shouldCreateExample) {
        const exampleTemplate = `name: example
description: Example template for Cursor Prompt
version: 1.0.0
tags:
  - example
  - starter

variables:
  task:
    type: string
    description: The task to complete
    required: true
  
  language:
    type: choice
    choices: [TypeScript, JavaScript, Python, Go]
    default: TypeScript

content: |
  # Task: {{task}}
  
  Please help me complete this task using {{language}}.
  
  ## Requirements
  - Follow best practices for {{language}}
  - Include error handling
  - Add appropriate comments
  - Write clean, maintainable code
  
  ## Context
  @file:src/**/*.ts
`;

        await writeFile(exampleTemplatePath, exampleTemplate);
        console.log(
          chalk.green(`✅ Created example template: ${exampleTemplatePath}`)
        );
      }

      console.log(chalk.cyan('\n🎉 Cursor Prompt initialized successfully!'));
      console.log(chalk.gray('\nNext steps:'));
      console.log(
        chalk.gray('  1. Add your templates to the templates/ directory')
      );
      console.log(
        chalk.gray('  2. Run "cursor-prompt list" to see available templates')
      );
      console.log(
        chalk.gray('  3. Run "cursor-prompt sync" to sync with Cursor rules')
      );
      console.log(
        chalk.gray(
          '  4. Run "cursor-prompt generate <template>" to generate prompts'
        )
      );
    } catch (error) {
      logger.error('Failed to initialize');
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate <template>')
  .description('Validate a template file')
  .action(async templatePath => {
    try {
      const service = new TemplateService();

      // Resolve template path if needed
      const resolvedPath = await service.resolveTemplatePath(templatePath);
      if (!resolvedPath) {
        throw new Error(`Template file not found: ${templatePath}`);
      }

      const template = await service.loadTemplate(resolvedPath);
      const validationResult = await TemplateService.validateTemplate(template);

      if (validationResult.valid) {
        console.log(chalk.green(`✅ Template is valid: ${resolvedPath}`));
        if (validationResult.warnings.length > 0) {
          console.log(chalk.yellow('\nWarnings:'));
          validationResult.warnings.forEach((warning: string) => {
            console.log(chalk.yellow(`   ⚠ ${warning}`));
          });
        }
      } else {
        console.log(
          chalk.red(`❌ Template validation failed: ${resolvedPath}`)
        );
        validationResult.errors.forEach((error: string) => {
          console.log(chalk.red(`   • ${error}`));
        });
        if (validationResult.warnings.length > 0) {
          console.log(chalk.yellow('\nWarnings:'));
          validationResult.warnings.forEach((warning: string) => {
            console.log(chalk.yellow(`   ⚠ ${warning}`));
          });
        }
        process.exit(1);
      }
    } catch (error) {
      logger.error('Failed to validate template');
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// Watch command
program
  .command('watch')
  .description('Watch templates and auto-sync to Cursor rules')
  .option('-d, --dir <path>', 'Template directory to watch', './templates')
  .action(async options => {
    try {
      console.log(chalk.cyan(`👀 Watching templates in: ${options.dir}`));
      console.log(chalk.gray('Press Ctrl+C to stop watching'));

      const integration = CursorIntegration.getInstance({
        autoSync: true,
        syncInterval: 5000,
      });

      await integration.initialize();

      // The initialize() method already does an initial sync
      // Print confirmation for user feedback
      console.log(chalk.green('✅ Initial sync completed'));

      // Keep the process running
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n👋 Stopping watch mode...'));
        integration.dispose();
        process.exit(0);
      });

      // Prevent the process from exiting
      setInterval(() => {}, 1000);
    } catch (error) {
      logger.error('Failed to start watch mode');
      console.error(chalk.red(`❌ Error: ${error}`));
      process.exit(1);
    }
  });

// PromptWizard Optimization Commands
// Optimize command
program
  .command('prompt:optimize')
  .aliases(['optimize', 'opt'])
  .description('Optimize prompts using Microsoft PromptWizard')
  .option('-t, --template <name>', 'Template name or path to optimize')
  .option('--task <description>', 'Task description for optimization')
  .option('-m, --model <model>', 'Target model for optimization', 'gpt-4')
  .option('-i, --iterations <number>', 'Number of refinement iterations', '3')
  .option(
    '-e, --examples <number>',
    'Number of few-shot examples to generate',
    '5'
  )
  .option('--reasoning', 'Generate reasoning steps in optimized prompt', true)
  .option('--batch', 'Batch optimize multiple templates')
  .option('-o, --output <path>', 'Output path for optimized template(s)')
  .option('--skip-cache', 'Skip cache and force fresh optimization')
  .option(
    '--priority <level>',
    'Optimization priority (low, normal, high, critical)',
    'normal'
  )
  .action(async options => {
    try {
      const command = new OptimizeCommand();
      await command.action([], options);
    } catch (error) {
      logger.error(
        `Optimize command failed: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Compare command
program
  .command('prompt:compare')
  .aliases(['compare', 'diff'])
  .description('Compare original and optimized prompts with detailed metrics')
  .option('-o, --original <prompt>', 'Original prompt text or template name')
  .option('-p, --optimized <prompt>', 'Optimized prompt text or template name')
  .option(
    '--task <description>',
    'Task description for context-aware comparison'
  )
  .option(
    '-f, --format <type>',
    'Output format (table, json, markdown)',
    'table'
  )
  .option('--output <path>', 'Save comparison report to file')
  .option('--detailed', 'Show detailed analysis and recommendations')
  .option('--show-diff', 'Show line-by-line diff of prompts', true)
  .action(async options => {
    try {
      const command = new CompareCommand();
      await command.action([], options);
    } catch (error) {
      logger.error(
        `Compare command failed: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Score command
program
  .command('prompt:score')
  .aliases(['score', 'rate'])
  .description('Score prompt quality and get improvement suggestions')
  .option('-p, --prompt <text>', 'Prompt text to score')
  .option('-t, --template <name>', 'Template name to score')
  .option('--task <description>', 'Task description for context-aware scoring')
  .option(
    '-f, --format <type>',
    'Output format (table, json, markdown, badge)',
    'table'
  )
  .option('--output <path>', 'Save scoring report to file')
  .option(
    '--threshold <number>',
    'Quality threshold (0-100) for pass/fail reporting',
    '70'
  )
  .option('--detailed', 'Show detailed breakdown and suggestions', true)
  .option('--batch', 'Score all templates in batch')
  .action(async options => {
    try {
      const command = new ScoreCommand();
      await command.action([], options);
    } catch (error) {
      logger.error(
        `Score command failed: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Wizard command
program
  .command('prompt:wizard')
  .aliases(['wizard', 'guide'])
  .description(
    'Interactive optimization wizard with guided step-by-step refinement'
  )
  .option('-t, --template <name>', 'Start with specific template')
  .option('--skip-intro', 'Skip introductory explanation')
  .option(
    '-m, --mode <type>',
    'Wizard mode (beginner, advanced, expert)',
    'beginner'
  )
  .action(async options => {
    try {
      const command = new OptimizationWizardCommand();
      await command.action([], options);
    } catch (error) {
      logger.error(
        `Wizard command failed: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

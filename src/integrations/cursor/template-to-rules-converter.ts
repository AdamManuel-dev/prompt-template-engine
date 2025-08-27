/**
 * @fileoverview Template to Cursor Rules Converter
 * @lastmodified 2025-08-23T14:00:00Z
 *
 * Features: Convert templates to .cursor/rules/*.mdc format
 * Main APIs: TemplateToRulesConverter class
 * Constraints: Support both legacy and new formats
 * Patterns: Builder pattern for rule construction
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import matter from 'gray-matter';
import { Template, CursorRule, RuleFrontmatter } from '../../types';
import { logger } from '../../utils/logger';

export interface ConversionOptions {
  outputDir?: string;
  legacySupport?: boolean;
  autoAttach?: boolean;
  nestingDepth?: number;
}

export class TemplateToRulesConverter {
  private readonly defaultOptions: ConversionOptions = {
    outputDir: '.cursor/rules',
    legacySupport: true,
    autoAttach: true,
    nestingDepth: 3,
  };

  constructor(private options: ConversionOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Convert a template to Cursor rule format
   */
  async convertTemplate(template: Template): Promise<CursorRule> {
    const frontmatter = this.generateFrontmatter(template);
    const content = await this.generateContent(template);
    const references = this.extractReferences(template);

    return {
      name: template.name,
      filename: `${template.name}.mdc`,
      frontmatter,
      content,
      references,
    };
  }

  /**
   * Generate MDC frontmatter from template
   */
  private generateFrontmatter(template: Template): RuleFrontmatter {
    const frontmatter: RuleFrontmatter = {
      description: template.description || `Template: ${template.name}`,
    };

    // Add glob patterns if template has file patterns
    if (template.filePatterns && template.filePatterns.length > 0) {
      frontmatter.globs = this.normalizeGlobPatterns(template.filePatterns);
    }

    // Determine if rule should always apply
    if (template.priority === 'high' || template.alwaysApply) {
      frontmatter.alwaysApply = true;
    }

    // Add metadata
    if (template.tags) {
      frontmatter.tags = template.tags;
    }

    frontmatter.author = 'cursor-prompt-template-engine';
    frontmatter.version = template.version || '1.0.0';
    frontmatter.generated = new Date().toISOString();

    return frontmatter;
  }

  /**
   * Generate rule content from template
   */
  private async generateContent(template: Template): Promise<string> {
    const sections: string[] = [];

    // Add main description
    sections.push(`# ${template.name}`);
    if (template.description) {
      sections.push(`\n${template.description}\n`);
    }

    // Add context references section
    if (template.contextFiles || template.references) {
      sections.push('## Context References');
      const refs = [
        ...(template.contextFiles || []),
        ...(template.references || []),
      ];
      refs.forEach(ref => {
        sections.push(`- @${this.normalizeReference(ref)}`);
      });
      sections.push('');
    }

    // Add variables section
    if (template.variables && Object.keys(template.variables).length > 0) {
      sections.push('## Template Variables');
      Object.entries(template.variables).forEach(([key, config]) => {
        const description =
          typeof config === 'object' && config !== null
            ? (config as any).description
            : '';
        const defaultValue =
          typeof config === 'object' && config !== null
            ? (config as any).default
            : config;
        sections.push(`- **${key}**: ${description || 'No description'}`);
        if (defaultValue !== undefined) {
          sections.push(`  - Default: \`${defaultValue}\``);
        }
      });
      sections.push('');
    }

    // Add template content
    if (template.content) {
      sections.push('## Template Content');
      sections.push('```markdown');
      sections.push(template.content);
      sections.push('```');
      sections.push('');
    }

    // Add commands section
    if (template.commands && Object.keys(template.commands).length > 0) {
      sections.push('## Available Commands');
      Object.entries(template.commands).forEach(([cmd, desc]) => {
        sections.push(`- \`${cmd}\`: ${desc}`);
      });
      sections.push('');
    }

    // Add requirements/guidelines
    if (template.requirements) {
      sections.push('## Requirements');
      template.requirements.forEach(req => {
        sections.push(`- ${req}`);
      });
      sections.push('');
    }

    // Add examples if available
    if (template.examples) {
      sections.push('## Examples');
      template.examples.forEach((example, index) => {
        sections.push(`### Example ${index + 1}`);
        sections.push('```');
        sections.push(example);
        sections.push('```');
        sections.push('');
      });
    }

    return sections.join('\n');
  }

  /**
   * Extract file references from template
   */
  private extractReferences(template: Template): string[] {
    const references: Set<string> = new Set();

    // Extract from context files
    if (template.contextFiles) {
      template.contextFiles.forEach(file => {
        references.add(this.normalizeReference(file));
      });
    }

    // Extract from content using regex
    if (template.content) {
      const refPattern = /@([^\s]+\.(ts|tsx|js|jsx|md|json|yaml|yml))/g;
      let match = refPattern.exec(template.content);
      while (match !== null) {
        references.add(match[1]);
        match = refPattern.exec(template.content);
      }
    }

    // Extract from variables that might be file paths
    if (template.variables) {
      Object.values(template.variables).forEach(value => {
        if (typeof value === 'string' && value.includes('/')) {
          references.add(this.normalizeReference(value));
        }
      });
    }

    return Array.from(references);
  }

  /**
   * Write rule to file system
   */
  async writeRule(rule: CursorRule, outputPath?: string): Promise<string> {
    const dir = outputPath || path.join(process.cwd(), this.options.outputDir!);
    await fs.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, rule.filename);
    const content = this.formatMDCFile(rule);

    await fs.writeFile(filePath, content, 'utf-8');
    logger.info(`Rule written to: ${filePath}`);

    // Also create legacy .cursorrules if enabled
    if (this.options.legacySupport) {
      await this.writeLegacyRule(rule);
    }

    return filePath;
  }

  /**
   * Format rule as MDC file content
   */
  private formatMDCFile(rule: CursorRule): string {
    const frontmatterStr = yaml.dump(rule.frontmatter, {
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false,
    });

    return `---\n${frontmatterStr}---\n\n${rule.content}`;
  }

  /**
   * Write legacy .cursorrules file
   */
  private async writeLegacyRule(rule: CursorRule): Promise<void> {
    const legacyPath = path.join(process.cwd(), '.cursorrules');

    try {
      let existingContent = '';
      try {
        existingContent = await fs.readFile(legacyPath, 'utf-8');
      } catch {
        // File doesn't exist, that's okay
      }

      const separator = '\n\n# ---\n\n';
      const newContent = existingContent
        ? `${existingContent}${separator}${rule.content}`
        : rule.content;

      await fs.writeFile(legacyPath, newContent, 'utf-8');
      logger.info('Updated .cursorrules (legacy)');
    } catch (error) {
      logger.warn(`Failed to write legacy .cursorrules: ${error}`);
    }
  }

  /**
   * Convert all templates in a directory
   */
  async convertDirectory(templateDir: string): Promise<CursorRule[]> {
    const rules: CursorRule[] = [];

    try {
      // Check if directory exists
      try {
        await fs.access(templateDir);
      } catch {
        logger.warn(`Template directory does not exist: ${templateDir}`);
        return rules; // Return empty array instead of throwing
      }

      const files = await fs.readdir(templateDir);
      const templateFiles = files.filter(
        f => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')
      );

      for (const file of templateFiles) {
        const filePath = path.join(templateDir, file);
        const template = await this.loadTemplate(filePath);
        const rule = await this.convertTemplate(template);
        rules.push(rule);
      }

      logger.info(`Converted ${rules.length} templates to rules`);
    } catch (error) {
      logger.error(`Failed to convert directory: ${error}`);
      throw error;
    }

    return rules;
  }

  /**
   * Load template from file
   */
  private async loadTemplate(filePath: string): Promise<Template> {
    const content = await fs.readFile(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    let template: Template;

    if (ext === '.yaml' || ext === '.yml') {
      template = yaml.load(content) as Template;
    } else if (ext === '.json') {
      template = JSON.parse(content);
    } else {
      // Assume markdown with frontmatter
      const parsed = matter(content);
      template = {
        ...parsed.data,
        content: parsed.content,
      } as Template;
    }

    // Ensure template has a name
    if (!template.name) {
      template.name = path.basename(filePath, ext);
    }

    return template;
  }

  /**
   * Normalize glob patterns for Cursor
   */
  private normalizeGlobPatterns(patterns: string[]): string[] {
    return patterns.map(pattern => {
      // Convert common patterns to Cursor-compatible globs
      if (pattern.startsWith('./')) {
        return pattern.substring(2);
      }
      if (!pattern.startsWith('*') && !pattern.startsWith('/')) {
        return `**/${pattern}`;
      }
      return pattern;
    });
  }

  /**
   * Normalize file reference for @file syntax
   */
  private normalizeReference(ref: string): string {
    // Remove leading ./ or /
    let normalized = ref.replace(/^\.\//, '').replace(/^\//, '');

    // Ensure proper path separators
    normalized = normalized.replace(/\\/g, '/');

    // Remove @ if already present
    if (normalized.startsWith('@')) {
      normalized = normalized.substring(1);
    }

    return normalized;
  }

  /**
   * Validate converted rule
   */
  validateRule(rule: CursorRule): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!rule.name) {
      errors.push('Rule name is required');
    }
    if (!rule.content) {
      errors.push('Rule content is required');
    }
    if (!rule.frontmatter) {
      errors.push('Rule frontmatter is required');
    }

    // Validate frontmatter
    if (rule.frontmatter) {
      if (!rule.frontmatter.description) {
        errors.push('Rule description is required in frontmatter');
      }
      if (rule.frontmatter.globs) {
        rule.frontmatter.globs.forEach((glob, i) => {
          if (typeof glob !== 'string') {
            errors.push(`Invalid glob pattern at index ${i}`);
          }
        });
      }
    }

    // Validate references
    if (rule.references) {
      rule.references.forEach((ref, i) => {
        if (!ref || typeof ref !== 'string') {
          errors.push(`Invalid reference at index ${i}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate nested rules for project structure
   */
  async generateNestedRules(
    template: Template,
    projectStructure: Map<string, string[]>
  ): Promise<Map<string, CursorRule>> {
    const nestedRules = new Map<string, CursorRule>();

    for (const [dir, files] of projectStructure) {
      if (this.shouldCreateNestedRule(dir, files, template)) {
        const nestedTemplate = this.createNestedTemplate(template, dir, files);
        const rule = await this.convertTemplate(nestedTemplate);

        // Adjust output path for nested structure
        rule.filename = path.join(dir, rule.filename);
        nestedRules.set(dir, rule);
      }
    }

    return nestedRules;
  }

  /**
   * Determine if nested rule should be created
   */
  private shouldCreateNestedRule(
    dir: string,
    files: string[],
    template: Template
  ): boolean {
    // Check nesting depth
    const depth = dir.split('/').length;
    if (depth > this.options.nestingDepth!) {
      return false;
    }

    // Check if directory matches template patterns
    if (template.filePatterns) {
      return template.filePatterns.some(pattern =>
        dir.includes(pattern.replace('**/', '').replace('/*', ''))
      );
    }

    // Check file count threshold
    return files.length >= 3;
  }

  /**
   * Create nested template variant
   */
  private createNestedTemplate(
    baseTemplate: Template,
    dir: string,
    files: string[]
  ): Template {
    return {
      ...baseTemplate,
      name: `${baseTemplate.name}-${path.basename(dir)}`,
      description: `${baseTemplate.description} (${dir})`,
      filePatterns: files.map(f => path.join(dir, f)),
      contextFiles: files.slice(0, 5), // Include first 5 files as context
    };
  }
}

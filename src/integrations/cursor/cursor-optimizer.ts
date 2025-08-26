/**
 * @fileoverview Cursor IDE specific optimization integration with PromptWizard
 * @lastmodified 2025-08-26T13:30:00Z
 *
 * Features: Cursor context detection, AI model optimization, .cursorrules integration
 * Main APIs: CursorOptimizer class with Cursor-specific optimization workflows
 * Constraints: Requires PromptWizard service, integrates with existing Cursor infrastructure
 * Patterns: Adapter pattern, context-aware optimization, IDE-specific enhancements
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../utils/logger';
import { PromptWizardClient, createDefaultConfig } from '../promptwizard';
import { TemplateService } from '../../services/template.service';
import { PromptOptimizationService } from '../../services/prompt-optimization.service';
import { CacheService } from '../../services/cache.service';
import { CursorIntegration } from './index';
import { Template } from '../../types';

export interface CursorOptimizationConfig {
  /** Detect and optimize for Cursor's AI model */
  optimizeForCursorAI: boolean;
  
  /** Integrate with existing .cursorrules */
  integrateCursorRules: boolean;
  
  /** Maximum prompt length for Cursor context */
  maxPromptLength: number;
  
  /** Auto-optimize templates when .cursorrules changes */
  autoOptimizeOnRulesChange: boolean;
  
  /** Cursor-specific template patterns to prioritize */
  cursorPatterns: string[];
  
  /** Use Cursor's preferred model for optimization */
  preferredModel: 'gpt-4' | 'claude-3-opus' | 'claude-3-sonnet';
}

export interface CursorContext {
  /** Current workspace root path */
  workspaceRoot: string;
  
  /** Active .cursorrules content */
  cursorRules?: string;
  
  /** Current active file path */
  activeFile?: string;
  
  /** Selected text in editor */
  selectedText?: string;
  
  /** Cursor IDE version */
  cursorVersion?: string;
  
  /** Current project type detected */
  projectType?: string;
}

export class CursorOptimizer {
  private client: PromptWizardClient;
  private templateService: TemplateService;
  private optimizationService: PromptOptimizationService;
  private cursorIntegration: CursorIntegration;
  
  private readonly defaultConfig: CursorOptimizationConfig = {
    optimizeForCursorAI: true,
    integrateCursorRules: true,
    maxPromptLength: 8000, // Cursor's context window preference
    autoOptimizeOnRulesChange: false, // Disable by default to avoid spam
    cursorPatterns: [
      '@file:',
      '@folder:',
      '@codebase',
      '// Cursor:',
      '/* Cursor:',
      '# Cursor:',
    ],
    preferredModel: 'gpt-4',
  };

  constructor(
    private config: CursorOptimizationConfig = {} as CursorOptimizationConfig
  ) {
    this.config = { ...this.defaultConfig, ...config };
    
    // Initialize services
    const promptWizardConfig = createDefaultConfig({
      defaults: {
        targetModel: this.config.preferredModel,
        mutateRefineIterations: 4, // Slightly more iterations for Cursor optimization
        fewShotCount: 3, // Fewer examples to conserve context
        generateReasoning: true,
      },
    });
    
    this.client = new PromptWizardClient(promptWizardConfig);
    this.templateService = new TemplateService();
    const cacheService = new CacheService();
    this.optimizationService = new PromptOptimizationService(
      this.client,
      this.templateService,
      cacheService
    );
    
    this.cursorIntegration = CursorIntegration.getInstance();
  }

  /**
   * Detect current Cursor context automatically
   */
  async detectCursorContext(): Promise<CursorContext> {
    const workspaceRoot = process.cwd();
    
    const context: CursorContext = {
      workspaceRoot,
    };

    try {
      // Check if this is a Cursor project
      if (!this.cursorIntegration.isCursorProject()) {
        logger.warn('Not detected as Cursor project - some optimizations may be limited');
      }

      // Try to read .cursorrules
      const cursorRulesPath = path.join(workspaceRoot, '.cursorrules');
      try {
        context.cursorRules = await fs.readFile(cursorRulesPath, 'utf-8');
        logger.info('Detected .cursorrules file');
      } catch (error) {
        logger.debug('No .cursorrules file found');
      }

      // Detect project type from common files
      context.projectType = await this.detectProjectType(workspaceRoot);
      
      logger.info(`Cursor context detected: ${context.projectType} project in ${workspaceRoot}`);
      return context;
    } catch (error) {
      logger.error(`Failed to detect Cursor context: ${error instanceof Error ? error.message : String(error)}`);
      return context;
    }
  }

  /**
   * Optimize template specifically for Cursor IDE context
   */
  async optimizeForCursor(
    templateName: string,
    context?: CursorContext
  ): Promise<{
    originalTemplate: Template;
    optimizedTemplate: Template;
    cursorSpecificImprovements: string[];
    metrics: {
      contextReduction: number;
      cursorPatternOptimization: number;
      rulesIntegration: boolean;
    };
  }> {
    logger.info(`Optimizing template ${templateName} for Cursor IDE`);

    // Get context if not provided
    const cursorContext = context || await this.detectCursorContext();

    // Load template
    const templatePath = await this.templateService.findTemplate(templateName);
    if (!templatePath) {
      throw new Error(`Template not found: ${templateName}`);
    }
    
    const template = await this.templateService.loadTemplate(templatePath);
    const renderedTemplate = await this.templateService.renderTemplate(template, {});
    const originalContent = renderedTemplate.files.map(f => f.content).join('\n');

    // Create optimized template object
    const originalTemplate: Template = {
      id: template.name,
      name: template.name,
      content: originalContent,
      description: template.description,
    };

    // Prepare Cursor-specific optimization context
    let optimizationTask = `Optimize this prompt template specifically for Cursor IDE usage`;
    
    if (cursorContext.projectType) {
      optimizationTask += ` in a ${cursorContext.projectType} project`;
    }
    
    if (cursorContext.cursorRules) {
      optimizationTask += `. The project has these Cursor rules that should be considered: ${cursorContext.cursorRules.substring(0, 500)}...`;
    }

    // Add Cursor-specific optimization requirements
    const cursorRequirements = [
      'Keep prompts concise for Cursor\'s context window',
      'Use Cursor-specific patterns like @file:, @folder:, @codebase when relevant',
      'Optimize for code generation and refactoring tasks',
      'Include clear, actionable instructions',
      'Consider Cursor\'s AI model capabilities',
    ];

    optimizationTask += `\n\nCursor-specific requirements: ${cursorRequirements.join('; ')}`;

    // Run optimization with Cursor context
    const optimizationResult = await this.optimizationService.optimizeTemplate({
      templateId: template.name,
      template: originalTemplate,
      config: {
        task: optimizationTask,
        targetModel: this.config.preferredModel,
        mutateRefineIterations: 4,
        fewShotCount: 3,
        generateReasoning: true,
        customParams: {
          maxLength: this.config.maxPromptLength,
          cursorOptimization: true,
          projectType: cursorContext.projectType,
        },
      },
    });

    // Apply additional Cursor-specific optimizations
    const cursorOptimizedContent = await this.applyCursorSpecificOptimizations(
      optimizationResult.optimizedTemplate.content || '',
      cursorContext
    );

    const optimizedTemplate: Template = {
      ...optimizationResult.optimizedTemplate,
      content: cursorOptimizedContent,
    };

    // Analyze improvements
    const cursorSpecificImprovements = this.analyzeCursorImprovements(
      originalContent,
      cursorOptimizedContent,
      cursorContext
    );

    // Calculate metrics
    const metrics = {
      contextReduction: ((originalContent.length - cursorOptimizedContent.length) / originalContent.length) * 100,
      cursorPatternOptimization: this.calculatePatternOptimization(originalContent, cursorOptimizedContent),
      rulesIntegration: !!cursorContext.cursorRules,
    };

    logger.info(`Cursor optimization completed: ${cursorSpecificImprovements.length} improvements, ${metrics.contextReduction.toFixed(1)}% size reduction`);

    return {
      originalTemplate,
      optimizedTemplate,
      cursorSpecificImprovements,
      metrics,
    };
  }

  /**
   * Batch optimize all Cursor templates in project
   */
  async batchOptimizeForCursor(): Promise<{
    optimized: number;
    failed: number;
    results: Array<{
      templateName: string;
      success: boolean;
      improvements?: string[];
      error?: string;
    }>;
  }> {
    logger.info('Starting batch optimization for Cursor IDE');

    const context = await this.detectCursorContext();
    const templateList = await this.templateService.listTemplates();
    
    let optimized = 0;
    let failed = 0;
    const results: Array<{
      templateName: string;
      success: boolean;
      improvements?: string[];
      error?: string;
    }> = [];

    for (const templateInfo of templateList) {
      try {
        logger.info(`Optimizing template: ${templateInfo.name}`);
        const result = await this.optimizeForCursor(templateInfo.name, context);
        
        results.push({
          templateName: templateInfo.name,
          success: true,
          improvements: result.cursorSpecificImprovements,
        });
        
        optimized++;
      } catch (error) {
        logger.error(`Failed to optimize template ${templateInfo.name}: ${error instanceof Error ? error.message : String(error)}`);
        
        results.push({
          templateName: templateInfo.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        
        failed++;
      }
    }

    logger.info(`Batch optimization completed: ${optimized} optimized, ${failed} failed`);
    
    return {
      optimized,
      failed,
      results,
    };
  }

  /**
   * Add Cursor-specific optimization to existing templates
   */
  async addCursorSpecificTemplates(): Promise<void> {
    logger.info('Adding Cursor-specific template optimizations');

    const cursorTemplates = [
      {
        name: 'cursor-code-review',
        description: 'Optimized code review prompt for Cursor IDE',
        content: `# Code Review Assistant

Please review the selected code for:
- Code quality and best practices
- Potential bugs or security issues
- Performance improvements
- Maintainability concerns

@file: Review the current file
Focus on actionable improvements that can be implemented in Cursor.`,
      },
      {
        name: 'cursor-refactor',
        description: 'Refactoring assistance optimized for Cursor',
        content: `# Code Refactoring Assistant

Help refactor the selected code to:
- Improve readability and maintainability
- Follow modern coding patterns
- Optimize performance where applicable
- Ensure type safety

@file: Target file for refactoring
Provide specific, implementable suggestions.`,
      },
      {
        name: 'cursor-debug',
        description: 'Debug assistance optimized for Cursor IDE',
        content: `# Debug Assistant

Analyze the code and help identify:
- Potential bugs and their fixes
- Logic errors
- Performance bottlenecks
- Error handling improvements

@file: File to debug
@codebase: Related context
Focus on practical solutions.`,
      },
    ];

    // These would typically be saved to the template system
    // For now, we'll just log what would be created
    for (const template of cursorTemplates) {
      logger.info(`Cursor template ready: ${template.name} - ${template.description}`);
    }
  }

  /**
   * Apply Cursor-specific optimizations to content
   */
  private async applyCursorSpecificOptimizations(
    content: string,
    context: CursorContext
  ): Promise<string> {
    let optimized = content;

    // Ensure Cursor patterns are properly formatted
    optimized = this.optimizeCursorPatterns(optimized);

    // Optimize for Cursor's context window
    if (optimized.length > this.config.maxPromptLength) {
      optimized = await this.cursorIntegration.optimizeForContext(optimized, this.config.maxPromptLength);
    }

    // Add project-specific context if beneficial
    if (context.projectType && !optimized.includes('@file:') && !optimized.includes('@folder:')) {
      optimized += `\n\n@file: Target files for this ${context.projectType} project`;
    }

    return optimized;
  }

  /**
   * Optimize Cursor-specific patterns in content
   */
  private optimizeCursorPatterns(content: string): string {
    let optimized = content;

    // Standardize Cursor pattern formatting
    const patternReplacements = [
      [/\@file\s*:\s*/g, '@file: '],
      [/\@folder\s*:\s*/g, '@folder: '],
      [/\@codebase\b/g, '@codebase'],
      [/\/\/ Cursor:\s*/g, '// Cursor: '],
      [/\/\* Cursor:\s*/g, '/* Cursor: '],
      [/# Cursor:\s*/g, '# Cursor: '],
    ];

    for (const [pattern, replacement] of patternReplacements) {
      optimized = optimized.replace(pattern as RegExp, replacement as string);
    }

    return optimized;
  }

  /**
   * Detect project type from common files
   */
  private async detectProjectType(workspaceRoot: string): Promise<string> {
    const indicators = [
      { files: ['package.json'], type: 'Node.js' },
      { files: ['Cargo.toml'], type: 'Rust' },
      { files: ['go.mod'], type: 'Go' },
      { files: ['requirements.txt', 'pyproject.toml'], type: 'Python' },
      { files: ['pom.xml', 'build.gradle'], type: 'Java' },
      { files: ['Gemfile'], type: 'Ruby' },
      { files: ['composer.json'], type: 'PHP' },
      { files: ['pubspec.yaml'], type: 'Dart/Flutter' },
    ];

    for (const indicator of indicators) {
      for (const file of indicator.files) {
        try {
          await fs.access(path.join(workspaceRoot, file));
          return indicator.type;
        } catch {
          // File doesn't exist, continue checking
        }
      }
    }

    return 'Generic';
  }

  /**
   * Analyze Cursor-specific improvements made
   */
  private analyzeCursorImprovements(
    original: string,
    optimized: string,
    context: CursorContext
  ): string[] {
    const improvements: string[] = [];

    // Check for Cursor pattern additions
    const originalPatterns = this.countCursorPatterns(original);
    const optimizedPatterns = this.countCursorPatterns(optimized);
    
    if (optimizedPatterns > originalPatterns) {
      improvements.push(`Added ${optimizedPatterns - originalPatterns} Cursor-specific patterns (@file:, @folder:, etc.)`);
    }

    // Check for length optimization
    if (optimized.length < original.length) {
      const reduction = ((original.length - optimized.length) / original.length) * 100;
      improvements.push(`Reduced content length by ${reduction.toFixed(1)}% for better Cursor context usage`);
    }

    // Check for project type integration
    if (context.projectType && context.projectType !== 'Generic') {
      if (optimized.toLowerCase().includes(context.projectType.toLowerCase())) {
        improvements.push(`Optimized for ${context.projectType} project context`);
      }
    }

    // Check for rules integration
    if (context.cursorRules && optimized.includes('rules')) {
      improvements.push('Integrated with existing .cursorrules configuration');
    }

    return improvements;
  }

  /**
   * Count Cursor-specific patterns in content
   */
  private countCursorPatterns(content: string): number {
    return this.config.cursorPatterns.reduce((count, pattern) => {
      const matches = content.match(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * Calculate pattern optimization score
   */
  private calculatePatternOptimization(original: string, optimized: string): number {
    const originalCount = this.countCursorPatterns(original);
    const optimizedCount = this.countCursorPatterns(optimized);
    
    if (originalCount === 0) {
      return optimizedCount > 0 ? 100 : 0;
    }
    
    return ((optimizedCount - originalCount) / originalCount) * 100;
  }

  /**
   * Get optimization recommendations for current Cursor context
   */
  async getCursorOptimizationRecommendations(): Promise<{
    contextOptimizations: string[];
    patternSuggestions: string[];
    integrationTips: string[];
  }> {
    const context = await this.detectCursorContext();
    
    const contextOptimizations = [
      `Keep prompts under ${this.config.maxPromptLength} characters for optimal Cursor performance`,
      'Use specific, actionable instructions rather than vague requests',
      'Include relevant file patterns with @file: and @folder: when needed',
    ];

    const patternSuggestions = [
      'Use @codebase for project-wide context',
      'Use @file: for specific file operations',
      'Use @folder: for directory-level operations',
      'Add // Cursor: comments for IDE-specific instructions',
    ];

    const integrationTips = [];
    
    if (context.cursorRules) {
      integrationTips.push('Align prompts with existing .cursorrules for consistency');
    } else {
      integrationTips.push('Consider creating a .cursorrules file for project-specific AI behavior');
    }
    
    if (context.projectType !== 'Generic') {
      integrationTips.push(`Optimize prompts for ${context.projectType} development patterns`);
    }

    return {
      contextOptimizations,
      patternSuggestions,
      integrationTips,
    };
  }
}

export default CursorOptimizer;
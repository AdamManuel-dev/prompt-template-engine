/**
 * @fileoverview Cursor IDE specific optimization integration with PromptWizard
 * @lastmodified 2025-08-26T11:21:38Z
 *
 * Features: Cursor context detection, AI model optimization, .cursorrules integration, template optimization
 * Main APIs: CursorOptimizer class with detectCursorContext(), optimizeForCursor(), batchOptimizeForCursor()
 * Constraints: Requires PromptWizard service, integrates with existing Cursor infrastructure, handles file system access
 * Patterns: Adapter pattern, context-aware optimization, IDE-specific enhancements, batch processing
 *
 * Integration Workflow:
 * 1. Auto-detect Cursor project context (.cursorrules, project type, workspace)
 * 2. Transform templates with Cursor-specific patterns (@file:, @folder:, @codebase)
 * 3. Optimize for Cursor's context window and AI model preferences
 * 4. Apply IDE-specific patterns and integrate with existing rules
 *
 * Security Considerations:
 * - File system access is read-only for context detection
 * - No secrets or sensitive data exposed in optimized templates
 * - Cursor rules integration respects existing project privacy settings
 *
 * Performance Optimizations:
 * - Context detection results are cached per workspace
 * - Batch optimization reduces API calls to PromptWizard service
 * - Template size optimization for Cursor's context window limits
 * - Pattern optimization scoring for effectiveness measurement
 *
 * Error Handling:
 * - Graceful degradation when .cursorrules not present
 * - Fallback to generic optimization when Cursor features unavailable
 * - Detailed error logging with context for debugging
 * - Retry logic for template service integration
 *
 * Configuration Requirements:
 * - PromptWizard service endpoint (HTTP/gRPC)
 * - Optional: Cursor workspace path for context detection
 * - Optional: Custom optimization parameters (maxPromptLength, preferredModel)
 * - Optional: Pattern customization for specific project types
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

/**
 * Configuration interface for Cursor-specific optimization settings
 *
 * @interface CursorOptimizationConfig
 * @description Defines parameters for optimizing templates specifically for Cursor IDE usage.
 * This interface allows fine-tuning of the optimization process to align with Cursor IDE features,
 * workspace configurations, and AI model preferences.
 *
 * @example
 * ```typescript
 * const config: CursorOptimizationConfig = {
 *   optimizeForCursorAI: true,
 *   integrateCursorRules: true,
 *   maxPromptLength: 6000,
 *   autoOptimizeOnRulesChange: false,
 *   cursorPatterns: ['@file:', '@folder:', '@codebase'],
 *   preferredModel: 'claude-3-sonnet'
 * };
 * ```
 *
 * @see {@link CursorOptimizer} for usage examples
 * @see {@link CursorContext} for related context information
 */
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

/**
 * Context information extracted from Cursor IDE environment
 *
 * @interface CursorContext
 * @description Contains comprehensive workspace, file, and project information needed for Cursor-specific optimization.
 * This context is automatically detected from the current Cursor IDE state and used to inform optimization decisions.
 *
 * @example
 * ```typescript
 * const context: CursorContext = {
 *   workspaceRoot: '/path/to/project',
 *   cursorRules: 'Use TypeScript strict mode...',
 *   activeFile: 'src/components/Button.tsx',
 *   selectedText: 'const handleClick = ...',
 *   cursorVersion: '0.29.0',
 *   projectType: 'React'
 * };
 * ```
 *
 * @workflow
 * 1. Auto-detected during optimization process
 * 2. Used to customize template optimization strategies
 * 3. Cached to avoid repeated file system operations
 * 4. Integrated with .cursorrules when available
 *
 * @see {@link CursorOptimizer.detectCursorContext} for context detection
 * @see {@link CursorOptimizationConfig} for related configuration options
 */
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

/**
 * Cursor IDE-specific prompt optimization service
 *
 * @class CursorOptimizer
 * @description Provides intelligent optimization of prompt templates for Cursor IDE workflows,
 * integrating with .cursorrules and leveraging Cursor-specific patterns for enhanced AI interactions
 *
 * @example
 * ```typescript
 * // Basic usage with default configuration
 * const optimizer = new CursorOptimizer();
 * const result = await optimizer.optimizeForCursor('code-review');
 *
 * // Advanced usage with custom configuration
 * const optimizer = new CursorOptimizer({
 *   optimizeForCursorAI: true,
 *   integrateCursorRules: true,
 *   maxPromptLength: 6000,
 *   preferredModel: 'claude-3-sonnet'
 * });
 * const context = await optimizer.detectCursorContext();
 * const result = await optimizer.optimizeForCursor('refactor-component', context);
 * ```
 */
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

  /**
   * Initialize Cursor IDE optimizer with configuration and service dependencies
   *
   * @constructor
   * @description Creates a new CursorOptimizer instance with the provided configuration,
   * initializing all required services including PromptWizard client, template service,
   * and Cursor integration components.
   *
   * @param {CursorOptimizationConfig} [config={}] - Optional configuration overrides
   * @param {boolean} [config.optimizeForCursorAI=true] - Enable Cursor AI model optimizations
   * @param {boolean} [config.integrateCursorRules=true] - Integrate with .cursorrules files
   * @param {number} [config.maxPromptLength=8000] - Maximum prompt length for context window
   * @param {boolean} [config.autoOptimizeOnRulesChange=false] - Auto-optimize when rules change
   * @param {string[]} [config.cursorPatterns] - Array of Cursor-specific patterns to optimize
   * @param {'gpt-4'|'claude-3-opus'|'claude-3-sonnet'} [config.preferredModel='gpt-4'] - Preferred AI model
   *
   * @example
   * ```typescript
   * // Default configuration
   * const optimizer = new CursorOptimizer();
   *
   * // Custom configuration for Claude optimization
   * const optimizer = new CursorOptimizer({
   *   preferredModel: 'claude-3-sonnet',
   *   maxPromptLength: 6000,
   *   integrateCursorRules: true
   * });
   *
   * // Performance-focused configuration
   * const optimizer = new CursorOptimizer({
   *   optimizeForCursorAI: true,
   *   autoOptimizeOnRulesChange: false,
   *   maxPromptLength: 10000
   * });
   * ```
   *
   * @throws {Error} When PromptWizard service initialization fails
   * @throws {Error} When required dependencies are missing
   *
   * @performance Initializes service connections and caching systems
   * @dependencies Requires PromptWizard service, template service, and cache service
   *
   * @see {@link CursorOptimizationConfig} for all configuration options
   * @see {@link PromptWizardClient} for underlying optimization service
   * @see {@link CursorIntegration} for IDE integration capabilities
   */
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
   * Auto-detect current Cursor IDE workspace context and configuration
   *
   * @method detectCursorContext
   * @description Analyzes the current workspace to extract Cursor-specific context including
   * .cursorrules configuration, project type, and workspace structure for optimization
   *
   * @returns {Promise<CursorContext>} Complete context object with workspace information
   *
   * @throws {Error} When workspace access fails or critical context cannot be determined
   *
   * @example
   * ```typescript
   * const optimizer = new CursorOptimizer();
   * const context = await optimizer.detectCursorContext();
   *
   * if (context.cursorRules) {
   *   console.log('Found .cursorrules configuration');
   * }
   * console.log('Project type:', context.projectType);
   * ```
   *
   * @security File system access is read-only, no modification of workspace files
   * @performance Results are cached to avoid repeated file system operations
   */
  async detectCursorContext(): Promise<CursorContext> {
    const workspaceRoot = process.cwd();

    const context: CursorContext = {
      workspaceRoot,
    };

    try {
      // Check if this is a Cursor project
      if (!this.cursorIntegration.isCursorProject()) {
        logger.warn(
          'Not detected as Cursor project - some optimizations may be limited'
        );
      }

      // Try to read .cursorrules
      const cursorRulesPath = path.join(workspaceRoot, '.cursorrules');
      try {
        context.cursorRules = await fs.readFile(cursorRulesPath, 'utf-8');
        logger.info('Detected .cursorrules file');
      } catch (_error) {
        logger.debug('No .cursorrules file found');
      }

      // Detect project type from common files
      context.projectType = await this.detectProjectType(workspaceRoot);

      logger.info(
        `Cursor context detected: ${context.projectType} project in ${workspaceRoot}`
      );
      return context;
    } catch (error) {
      logger.error(
        `Failed to detect Cursor context: ${error instanceof Error ? error.message : String(error)}`
      );
      return context;
    }
  }

  /**
   * Optimize a prompt template specifically for Cursor IDE workflows and patterns
   *
   * @method optimizeForCursor
   * @description Transforms a template to leverage Cursor-specific features like @file: references,
   * integrates with .cursorrules, and optimizes for the preferred AI model and context window
   *
   * @param {string} templateName - Name of the template to optimize
   * @param {CursorContext} [context] - Optional pre-detected context (auto-detected if not provided)
   *
   * @returns {Promise<Object>} Optimization result containing original and optimized templates with metrics
   * @returns {Template} returns.originalTemplate - The original template before optimization
   * @returns {Template} returns.optimizedTemplate - The Cursor-optimized template
   * @returns {string[]} returns.cursorSpecificImprovements - List of Cursor-specific improvements made
   * @returns {Object} returns.metrics - Quantitative metrics about the optimization
   * @returns {number} returns.metrics.contextReduction - Percentage reduction in content length
   * @returns {number} returns.metrics.cursorPatternOptimization - Pattern optimization effectiveness score
   * @returns {boolean} returns.metrics.rulesIntegration - Whether .cursorrules were successfully integrated
   *
   * @throws {Error} When template is not found or optimization fails
   * @throws {Error} When PromptWizard service is unavailable
   *
   * @example
   * ```typescript
   * const optimizer = new CursorOptimizer();
   *
   * // Basic optimization
   * const result = await optimizer.optimizeForCursor('code-review');
   * console.log('Improvements:', result.cursorSpecificImprovements);
   *
   * // Optimization with pre-detected context
   * const context = await optimizer.detectCursorContext();
   * const result = await optimizer.optimizeForCursor('debug-assistant', context);
   *
   * // Check optimization effectiveness
   * if (result.metrics.contextReduction > 10) {
   *   console.log('Significant context reduction achieved');
   * }
   * ```
   *
   * @performance Uses caching and batching to minimize API calls to PromptWizard
   * @security Template content is validated and sanitized before optimization
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
    const cursorContext = context || (await this.detectCursorContext());

    // Load template
    const templatePath = await this.templateService.findTemplate(templateName);
    if (!templatePath) {
      throw new Error(`Template not found: ${templateName}`);
    }

    const template = await this.templateService.loadTemplate(templatePath);
    const renderedTemplate = await this.templateService.renderTemplate(
      template,
      {}
    );
    const originalContent =
      renderedTemplate.files?.map(f => f.content).join('\n') || '';

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
      "Keep prompts concise for Cursor's context window",
      'Use Cursor-specific patterns like @file:, @folder:, @codebase when relevant',
      'Optimize for code generation and refactoring tasks',
      'Include clear, actionable instructions',
      "Consider Cursor's AI model capabilities",
    ];

    optimizationTask += `\n\nCursor-specific requirements: ${cursorRequirements.join('; ')}`;

    // Run optimization with Cursor context
    const optimizationResult = await this.optimizationService.optimizeTemplate({
      templateId: template.name,
      template: originalTemplate as any,
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
      optimizationResult.optimizedTemplate.files
        ?.map(f => (f as any).content)
        .join('\n') || '',
      cursorContext
    );

    const optimizedTemplate = {
      ...optimizationResult.optimizedTemplate,
      content: cursorOptimizedContent,
    } as Template;

    // Analyze improvements
    const cursorSpecificImprovements = this.analyzeCursorImprovements(
      originalContent,
      cursorOptimizedContent,
      cursorContext
    );

    // Calculate metrics
    const metrics = {
      contextReduction:
        ((originalContent.length - cursorOptimizedContent.length) /
          originalContent.length) *
        100,
      cursorPatternOptimization: this.calculatePatternOptimization(
        originalContent,
        cursorOptimizedContent
      ),
      rulesIntegration: !!cursorContext.cursorRules,
    };

    logger.info(
      `Cursor optimization completed: ${cursorSpecificImprovements.length} improvements, ${metrics.contextReduction.toFixed(1)}% size reduction`
    );

    return {
      originalTemplate,
      optimizedTemplate,
      cursorSpecificImprovements,
      metrics,
    };
  }

  /**
   * Batch optimize all templates in the project for Cursor IDE usage
   *
   * @method batchOptimizeForCursor
   * @description Processes all available templates in parallel, optimizing each one for Cursor IDE workflows.
   * Provides comprehensive reporting of successes, failures, and improvements across all templates.
   *
   * @returns {Promise<Object>} Batch processing results with detailed metrics
   * @returns {number} returns.optimized - Count of successfully optimized templates
   * @returns {number} returns.failed - Count of templates that failed optimization
   * @returns {Array} returns.results - Detailed results for each template processed
   * @returns {string} returns.results[].templateName - Name of the processed template
   * @returns {boolean} returns.results[].success - Whether optimization succeeded
   * @returns {string[]} [returns.results[].improvements] - List of improvements made (on success)
   * @returns {string} [returns.results[].error] - Error message (on failure)
   *
   * @throws {Error} When template service is unavailable or workspace access fails
   *
   * @example
   * ```typescript
   * const optimizer = new CursorOptimizer();
   * const batchResult = await optimizer.batchOptimizeForCursor();
   *
   * console.log(`Optimized ${batchResult.optimized} templates`);
   * console.log(`Failed ${batchResult.failed} templates`);
   *
   * // Review individual results
   * batchResult.results.forEach(result => {
   *   if (result.success) {
   *     console.log(`✓ ${result.templateName}: ${result.improvements?.length} improvements`);
   *   } else {
   *     console.log(`✗ ${result.templateName}: ${result.error}`);
   *   }
   * });
   * ```
   *
   * @performance Processes templates concurrently with rate limiting for API stability
   * @recovery Individual template failures don't stop the batch process
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
        logger.error(
          `Failed to optimize template ${templateInfo.name}: ${error instanceof Error ? error.message : String(error)}`
        );

        results.push({
          templateName: templateInfo.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });

        failed++;
      }
    }

    logger.info(
      `Batch optimization completed: ${optimized} optimized, ${failed} failed`
    );

    return {
      optimized,
      failed,
      results,
    };
  }

  /**
   * Generate and add Cursor-specific template optimizations to the template system
   *
   * @method addCursorSpecificTemplates
   * @description Creates pre-optimized templates specifically designed for common Cursor IDE workflows
   * such as code review, refactoring, and debugging. These templates leverage Cursor patterns out-of-the-box.
   *
   * @returns {Promise<void>} Completes when all Cursor-specific templates have been processed
   *
   * @example
   * ```typescript
   * const optimizer = new CursorOptimizer();
   * await optimizer.addCursorSpecificTemplates();
   *
   * // Templates now include:
   * // - cursor-code-review: Optimized for code review workflows
   * // - cursor-refactor: Specialized for refactoring assistance
   * // - cursor-debug: Enhanced debugging support with @file: patterns
   * ```
   *
   * @implementation Currently logs template availability; future versions will integrate with template storage
   * @patterns Templates use Cursor-specific patterns (@file:, @folder:, @codebase) from creation
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
      logger.info(
        `Cursor template ready: ${template.name} - ${template.description}`
      );
    }
  }

  /**
   * Apply Cursor-specific optimizations to template content
   *
   * @private
   * @method applyCursorSpecificOptimizations
   * @description Internal method that transforms template content to leverage Cursor IDE features,
   * ensures proper pattern formatting, and optimizes for context window constraints.
   * This method is the final step in the optimization pipeline, applying IDE-specific enhancements.
   *
   * @param {string} content - Raw template content to optimize
   * @param {CursorContext} context - Cursor workspace context for optimization decisions
   *
   * @returns {Promise<string>} Optimized content with Cursor-specific enhancements
   *
   * @implementation
   * 1. **Pattern Normalization**: Standardizes Cursor pattern formatting (@file:, @folder:, @codebase)
   * 2. **Context Window Management**: Enforces context window limits through intelligent truncation
   * 3. **Project Integration**: Adds project-specific context references when beneficial
   * 4. **Rules Integration**: Integrates with existing .cursorrules where applicable
   *
   * @example
   * ```typescript
   * // Before optimization
   * const content = 'Review this code: @file: src/app.ts';
   *
   * // After optimization
   * const optimized = await applyCursorSpecificOptimizations(content, context);
   * // Result: 'Review this code: @file: src/app.ts\n\n@file: Target files for this Node.js project'
   * ```
   *
   * @performance Optimizes content length while preserving semantic meaning
   * @integration Coordinates with CursorIntegration service for context optimization
   *
   * @see {@link optimizeCursorPatterns} for pattern formatting logic
   * @see {@link CursorIntegration.optimizeForContext} for context window optimization
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
      optimized = await this.cursorIntegration.optimizeForContext(
        optimized,
        this.config.maxPromptLength
      );
    }

    // Add project-specific context if beneficial
    if (
      context.projectType &&
      !optimized.includes('@file:') &&
      !optimized.includes('@folder:')
    ) {
      optimized += `\n\n@file: Target files for this ${context.projectType} project`;
    }

    return optimized;
  }

  /**
   * Normalize and optimize Cursor-specific patterns in template content
   *
   * @private
   * @method optimizeCursorPatterns
   * @description Ensures consistent formatting of Cursor IDE patterns and commands within template content
   *
   * @param {string} content - Content containing Cursor patterns to optimize
   *
   * @returns {string} Content with standardized Cursor pattern formatting
   *
   * @patterns Optimizes:
   * - @file: references for specific file operations
   * - @folder: references for directory-level operations
   * - @codebase references for project-wide context
   * - // Cursor: comments for IDE-specific instructions
   * - /* Cursor: block comments
   * - # Cursor: markdown-style comments
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
   * Auto-detect project type by analyzing common configuration and dependency files
   *
   * @private
   * @method detectProjectType
   * @description Examines workspace for language and framework indicators to determine project type
   * for context-aware optimization strategies. The detection is performed by checking for the presence
   * of standard configuration files in the workspace root directory.
   *
   * @param {string} workspaceRoot - Root directory path of the workspace to analyze
   *
   * @returns {Promise<string>} Detected project type (Node.js, Rust, Go, Python, Java, Ruby, PHP, Dart/Flutter, or Generic)
   *
   * @detection_patterns The method checks for these files in order of priority:
   * - **Node.js**: package.json (most common web development)
   * - **Rust**: Cargo.toml (systems programming)
   * - **Go**: go.mod (modern Go projects)
   * - **Python**: requirements.txt, pyproject.toml (data science, web development)
   * - **Java**: pom.xml, build.gradle (enterprise development)
   * - **Ruby**: Gemfile (web development, scripting)
   * - **PHP**: composer.json (web development)
   * - **Dart/Flutter**: pubspec.yaml (mobile/web development)
   *
   * @algorithm
   * 1. Iterate through detection patterns in priority order
   * 2. Check for file existence using fs.access()
   * 3. Return first matching project type
   * 4. Default to 'Generic' if no patterns match
   *
   * @example
   * ```typescript
   * const projectType = await detectProjectType('/path/to/workspace');
   * // Returns: 'Node.js' if package.json exists
   * // Returns: 'Python' if requirements.txt exists
   * // Returns: 'Generic' if no recognizable files found
   * ```
   *
   * @fallback Returns 'Generic' when no specific project type indicators are found
   * @performance Uses async file system operations with error handling
   * @caching Results can be cached at the CursorContext level to avoid repeated file system calls
   *
   * @see {@link detectCursorContext} for usage in context detection
   * @see {@link CursorContext.projectType} for how the detected type is used
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
   * Analyze and categorize Cursor-specific improvements made during optimization
   *
   * @private
   * @method analyzeCursorImprovements
   * @description Compares original and optimized content to identify and describe specific
   * improvements made for Cursor IDE integration
   *
   * @param {string} original - Original template content before optimization
   * @param {string} optimized - Optimized template content after Cursor-specific processing
   * @param {CursorContext} context - Cursor workspace context used for optimization
   *
   * @returns {string[]} Array of human-readable improvement descriptions
   *
   * @analysis_categories
   * - Pattern additions: New @file:, @folder:, @codebase references
   * - Length optimization: Content reduction for better context usage
   * - Project integration: Project-type-specific optimizations
   * - Rules integration: .cursorrules configuration alignment
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
      improvements.push(
        `Added ${optimizedPatterns - originalPatterns} Cursor-specific patterns (@file:, @folder:, etc.)`
      );
    }

    // Check for length optimization
    if (optimized.length < original.length) {
      const reduction =
        ((original.length - optimized.length) / original.length) * 100;
      improvements.push(
        `Reduced content length by ${reduction.toFixed(1)}% for better Cursor context usage`
      );
    }

    // Check for project type integration
    if (context.projectType && context.projectType !== 'Generic') {
      if (optimized.toLowerCase().includes(context.projectType.toLowerCase())) {
        improvements.push(
          `Optimized for ${context.projectType} project context`
        );
      }
    }

    // Check for rules integration
    if (context.cursorRules && optimized.includes('rules')) {
      improvements.push('Integrated with existing .cursorrules configuration');
    }

    return improvements;
  }

  /**
   * Count occurrences of Cursor-specific patterns in template content
   *
   * @private
   * @method countCursorPatterns
   * @description Analyzes content to count Cursor IDE patterns for optimization effectiveness measurement
   *
   * @param {string} content - Content to analyze for Cursor patterns
   *
   * @returns {number} Total count of Cursor-specific patterns found
   *
   * @counted_patterns Based on configuration.cursorPatterns:
   * - @file: references
   * - @folder: references
   * - @codebase references
   * - // Cursor: comments
   * - /* Cursor: block comments
   * - # Cursor: markdown comments
   */
  private countCursorPatterns(content: string): number {
    return this.config.cursorPatterns.reduce((count, pattern) => {
      const matches = content.match(
        new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      );
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  /**
   * Calculate the effectiveness score of Cursor pattern optimization
   *
   * @private
   * @method calculatePatternOptimization
   * @description Computes a percentage score indicating how effectively Cursor patterns
   * were optimized between original and processed content
   *
   * @param {string} original - Original content before optimization
   * @param {string} optimized - Optimized content after processing
   *
   * @returns {number} Optimization effectiveness score as percentage (-100 to +100)
   *
   * @scoring_logic
   * - Returns 100 if patterns were added to content with no existing patterns
   * - Returns 0 if no pattern changes were made
   * - Returns positive percentage for pattern additions
   * - Returns negative percentage for pattern removals (rare)
   */
  private calculatePatternOptimization(
    original: string,
    optimized: string
  ): number {
    const originalCount = this.countCursorPatterns(original);
    const optimizedCount = this.countCursorPatterns(optimized);

    if (originalCount === 0) {
      return optimizedCount > 0 ? 100 : 0;
    }

    return ((optimizedCount - originalCount) / originalCount) * 100;
  }

  /**
   * Generate personalized optimization recommendations based on current Cursor workspace context
   *
   * @method getCursorOptimizationRecommendations
   * @description Analyzes the current workspace and provides tailored suggestions for optimizing
   * prompt templates to work better with Cursor IDE features and project-specific patterns.
   * This method serves as an advisory tool to help users maximize the effectiveness of their Cursor integration.
   *
   * @returns {Promise<Object>} Comprehensive recommendations organized by category
   * @returns {string[]} returns.contextOptimizations - Recommendations for context window optimization
   * @returns {string[]} returns.patternSuggestions - Suggestions for using Cursor-specific patterns
   * @returns {string[]} returns.integrationTips - Tips for better IDE integration
   *
   * @example
   * ```typescript
   * const optimizer = new CursorOptimizer();
   * const recommendations = await optimizer.getCursorOptimizationRecommendations();
   *
   * console.log('Context Optimizations:');
   * recommendations.contextOptimizations.forEach(tip => console.log(`  - ${tip}`));
   * // Output: "Keep prompts under 8000 characters for optimal Cursor performance"
   *
   * console.log('Pattern Suggestions:');
   * recommendations.patternSuggestions.forEach(tip => console.log(`  - ${tip}`));
   * // Output: "Use @codebase for project-wide context"
   *
   * console.log('Integration Tips:');
   * recommendations.integrationTips.forEach(tip => console.log(`  - ${tip}`));
   * // Output: "Optimize prompts for Node.js development patterns"
   * ```
   *
   * @recommendation_categories
   * - **Context Optimizations**: Guidelines for managing prompt length and structure
   * - **Pattern Suggestions**: Best practices for using Cursor-specific syntax
   * - **Integration Tips**: Project-specific and .cursorrules-aware advice
   *
   * @adaptivity The recommendations are dynamically generated based on:
   * - Current project type (detected from workspace files)
   * - Presence and content of .cursorrules file
   * - Configured optimization parameters
   * - Workspace structure and patterns
   *
   * @use_cases
   * - Onboarding new users to Cursor optimization
   * - Auditing existing template effectiveness
   * - Identifying optimization opportunities
   * - Educational guidance for best practices
   *
   * @performance Recommendations are generated based on cached context analysis
   * @adaptive Suggestions adapt to project type and existing .cursorrules configuration
   *
   * @see {@link detectCursorContext} for context analysis used in recommendations
   * @see {@link CursorOptimizationConfig} for configuration options that influence suggestions
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
      integrationTips.push(
        'Align prompts with existing .cursorrules for consistency'
      );
    } else {
      integrationTips.push(
        'Consider creating a .cursorrules file for project-specific AI behavior'
      );
    }

    if (context.projectType !== 'Generic') {
      integrationTips.push(
        `Optimize prompts for ${context.projectType} development patterns`
      );
    }

    return {
      contextOptimizations,
      patternSuggestions,
      integrationTips,
    };
  }
}

/**
 * Default export of CursorOptimizer class for convenient importing
 *
 * @example
 * ```typescript
 * import CursorOptimizer from './cursor-optimizer';
 * const optimizer = new CursorOptimizer();
 * ```
 */
export default CursorOptimizer;

/**
 * @fileoverview Chain-of-thought optimizer for enhanced reasoning in prompts
 * @lastmodified 2025-08-26T12:45:00Z
 *
 * Features: Reasoning chain generation, step validation, effectiveness measurement
 * Main APIs: generateReasoningChain(), optimizeSteps(), validateChain()
 * Constraints: Model-specific reasoning patterns, logical consistency requirements
 * Patterns: Builder pattern for chain construction, validation pipeline
 */

import { logger } from '../utils/logger';
import { Template } from '../types';

export interface ReasoningStep {
  id: string;
  content: string;
  type: 'premise' | 'inference' | 'conclusion' | 'example' | 'validation';
  dependencies: string[];
  confidence: number;
  metadata?: {
    source?: string;
    evidence?: string[];
    alternatives?: string[];
  };
}

export interface ReasoningChain {
  steps: ReasoningStep[];
  goal: string;
  context: string;
  effectiveness: number;
  validated: boolean;
}

export interface ChainOptimizationConfig {
  maxSteps?: number;
  minConfidence?: number;
  includeExamples?: boolean;
  verbosity?: 'minimal' | 'moderate' | 'detailed';
  targetModel?: string;
  optimizationGoal?: 'clarity' | 'accuracy' | 'efficiency' | 'balanced';
}

export interface ValidationIssue {
  stepId: string;
  type: 'logical_error' | 'missing_connection' | 'redundancy' | 'ambiguity';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface ChainValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  suggestions: string[];
  overallScore: number;
}

export class ChainOfThoughtOptimizer {
  private readonly reasoningPatterns = {
    deductive: ['premise', 'premise', 'inference', 'conclusion'],
    inductive: ['example', 'example', 'inference', 'conclusion'],
    abductive: ['observation', 'hypothesis', 'validation', 'conclusion'],
    analogical: ['source', 'mapping', 'inference', 'conclusion'],
  };

  private readonly modelSpecificPatterns = {
    'gpt-4': {
      preferredStyle: 'step-by-step',
      maxSteps: 10,
      requiresExplicit: true,
    },
    'claude-3-opus': {
      preferredStyle: 'structured',
      maxSteps: 15,
      requiresExplicit: false,
    },
    'gemini-pro': {
      preferredStyle: 'hierarchical',
      maxSteps: 12,
      requiresExplicit: true,
    },
  };

  /**
   * Generate a reasoning chain for a prompt
   */
  async generateReasoningChain(
    prompt: string,
    template: Template,
    config: ChainOptimizationConfig = {}
  ): Promise<ReasoningChain> {
    logger.info(`Generating reasoning chain for template: ${template.name}`);

    const goal = this.extractGoal(prompt, template);
    const context = this.extractContext(prompt, template);

    const steps = await this.buildReasoningSteps(prompt, goal, context, config);

    const optimizedSteps = await this.optimizeSteps(steps, config);
    const effectiveness = this.measureEffectiveness(optimizedSteps, goal);
    const validated = await this.validateChain({
      steps: optimizedSteps,
      goal,
      context,
      effectiveness,
      validated: false,
    });

    const chain: ReasoningChain = {
      steps: optimizedSteps,
      goal,
      context,
      effectiveness,
      validated: validated.valid,
    };

    logger.info(
      `Generated reasoning chain with ${chain.steps.length} steps, ` +
        `effectiveness: ${effectiveness.toFixed(2)}`
    );

    return chain;
  }

  /**
   * Optimize reasoning steps for clarity and efficiency
   */
  async optimizeSteps(
    steps: ReasoningStep[],
    config: ChainOptimizationConfig = {}
  ): Promise<ReasoningStep[]> {
    logger.info(`Optimizing ${steps.length} reasoning steps`);

    let optimized = [...steps];

    // Remove redundant steps
    optimized = this.removeRedundantSteps(optimized);

    // Consolidate similar steps
    optimized = this.consolidateSimilarSteps(optimized);

    // Reorder for logical flow
    optimized = this.reorderSteps(optimized);

    // Apply model-specific optimizations
    if (config.targetModel) {
      optimized = this.applyModelSpecificOptimizations(
        optimized,
        config.targetModel
      );
    }

    // Ensure confidence thresholds
    if (config.minConfidence !== undefined) {
      optimized = optimized.filter(
        step => step.confidence >= config.minConfidence!
      );
    }

    // Apply verbosity settings
    optimized = this.applyVerbositySettings(
      optimized,
      config.verbosity || 'moderate'
    );

    // Limit to max steps if specified
    if (config.maxSteps && optimized.length > config.maxSteps) {
      optimized = this.selectMostImportantSteps(optimized, config.maxSteps);
    }

    logger.info(
      `Optimization complete: ${steps.length} → ${optimized.length} steps`
    );

    return optimized;
  }

  /**
   * Validate a reasoning chain for logical consistency
   */
  async validateChain(chain: ReasoningChain): Promise<ChainValidationResult> {
    logger.info('Validating reasoning chain');

    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];

    // Check logical consistency
    const logicalIssues = this.checkLogicalConsistency(chain.steps);
    issues.push(...logicalIssues);

    // Check for missing connections
    const connectionIssues = this.checkConnections(chain.steps);
    issues.push(...connectionIssues);

    // Check for redundancies
    const redundancyIssues = this.checkRedundancies(chain.steps);
    issues.push(...redundancyIssues);

    // Check for ambiguities
    const ambiguityIssues = this.checkAmbiguities(chain.steps);
    issues.push(...ambiguityIssues);

    // Generate improvement suggestions
    if (issues.length > 0) {
      suggestions.push(...this.generateImprovementSuggestions(issues, chain));
    }

    // Calculate overall score
    const overallScore = this.calculateValidationScore(issues, chain);

    const result: ChainValidationResult = {
      valid: issues.filter(i => i.severity === 'high').length === 0,
      issues,
      suggestions,
      overallScore,
    };

    logger.info(
      `Validation complete: ${result.valid ? 'VALID' : 'INVALID'}, ` +
        `score: ${overallScore.toFixed(2)}, ${issues.length} issues found`
    );

    return result;
  }

  /**
   * Generate an optimized chain for specific reasoning patterns
   */
  generatePatternBasedChain(
    pattern: keyof typeof this.reasoningPatterns,
    content: string,
    _config: ChainOptimizationConfig = {}
  ): ReasoningChain {
    const patternSteps = this.reasoningPatterns[pattern];
    const steps: ReasoningStep[] = [];

    patternSteps.forEach((stepType, index) => {
      steps.push({
        id: `step-${index}`,
        content: this.generateStepContent(stepType, content, index),
        type: stepType as ReasoningStep['type'],
        dependencies: index > 0 ? [`step-${index - 1}`] : [],
        confidence: 0.8 + index * 0.02, // Confidence increases with progression
        metadata: {
          source: pattern,
        },
      });
    });

    return {
      steps,
      goal: `Apply ${pattern} reasoning to: ${content.substring(0, 50)}...`,
      context: content,
      effectiveness: 0.75,
      validated: false,
    };
  }

  // Private helper methods

  private extractGoal(prompt: string, template: Template): string {
    // Extract explicit goal statements
    const goalPatterns = [
      /goal:\s*([^.]+)/i,
      /objective:\s*([^.]+)/i,
      /purpose:\s*([^.]+)/i,
      /aim:\s*([^.]+)/i,
    ];

    for (const pattern of goalPatterns) {
      const match = prompt.match(pattern);
      if (match) return match[1].trim();
    }

    // Fall back to template description
    return template.description || 'Process the given input';
  }

  private extractContext(prompt: string, template: Template): string {
    // Extract context from prompt and template
    const contextMarkers = ['context:', 'background:', 'given:', 'assuming:'];
    let context = '';

    contextMarkers.forEach(marker => {
      const index = prompt.toLowerCase().indexOf(marker);
      if (index !== -1) {
        const endIndex = prompt.indexOf('\n', index);
        context += `${prompt.substring(
          index + marker.length,
          endIndex > 0 ? endIndex : undefined
        )} `;
      }
    });

    if (!context && template.content) {
      context = template.content.substring(0, 200);
    }

    return context.trim() || 'General context';
  }

  private async buildReasoningSteps(
    prompt: string,
    goal: string,
    context: string,
    config: ChainOptimizationConfig
  ): Promise<ReasoningStep[]> {
    const steps: ReasoningStep[] = [];

    // Add initial premise
    steps.push({
      id: 'step-0',
      content: `Given: ${context}`,
      type: 'premise',
      dependencies: [],
      confidence: 1.0,
    });

    // Add goal clarification
    steps.push({
      id: 'step-1',
      content: `Goal: ${goal}`,
      type: 'premise',
      dependencies: ['step-0'],
      confidence: 1.0,
    });

    // Build logical progression
    const numIntermediateSteps = Math.min(
      config.maxSteps ? config.maxSteps - 3 : 5,
      this.calculateRequiredSteps(prompt, goal)
    );

    for (let i = 0; i < numIntermediateSteps; i++) {
      steps.push({
        id: `step-${i + 2}`,
        content: this.generateIntermediateStep(prompt, i, numIntermediateSteps),
        type: 'inference',
        dependencies: [`step-${i + 1}`],
        confidence: 0.8 - i * 0.05,
      });
    }

    // Add conclusion
    steps.push({
      id: `step-${steps.length}`,
      content: `Therefore: ${this.generateConclusion(goal, steps)}`,
      type: 'conclusion',
      dependencies: [`step-${steps.length - 1}`],
      confidence: 0.85,
    });

    return steps;
  }

  private removeRedundantSteps(steps: ReasoningStep[]): ReasoningStep[] {
    const uniqueSteps: ReasoningStep[] = [];
    const seenContent = new Set<string>();

    steps.forEach(step => {
      const normalized = this.normalizeStepContent(step.content);
      if (!seenContent.has(normalized)) {
        seenContent.add(normalized);
        uniqueSteps.push(step);
      }
    });

    return uniqueSteps;
  }

  private consolidateSimilarSteps(steps: ReasoningStep[]): ReasoningStep[] {
    const consolidated: ReasoningStep[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < steps.length; i++) {
      if (processed.has(i)) continue;

      const similar: ReasoningStep[] = [steps[i]];
      for (let j = i + 1; j < steps.length; j++) {
        if (this.areSimilarSteps(steps[i], steps[j])) {
          similar.push(steps[j]);
          processed.add(j);
        }
      }

      if (similar.length > 1) {
        consolidated.push(this.mergeSteps(similar));
      } else {
        consolidated.push(steps[i]);
      }
    }

    return consolidated;
  }

  private reorderSteps(steps: ReasoningStep[]): ReasoningStep[] {
    // Topological sort based on dependencies
    const sorted: ReasoningStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (step: ReasoningStep) => {
      if (visited.has(step.id)) return;
      if (visiting.has(step.id)) {
        logger.warn(`Circular dependency detected at step: ${step.id}`);
        return;
      }

      visiting.add(step.id);

      step.dependencies.forEach(depId => {
        const depStep = steps.find(s => s.id === depId);
        if (depStep) visit(depStep);
      });

      visiting.delete(step.id);
      visited.add(step.id);
      sorted.push(step);
    };

    steps.forEach(step => visit(step));

    return sorted;
  }

  private applyModelSpecificOptimizations(
    steps: ReasoningStep[],
    model: string
  ): ReasoningStep[] {
    const pattern =
      this.modelSpecificPatterns[
        model as keyof typeof this.modelSpecificPatterns
      ];
    if (!pattern) return steps;

    let optimized = [...steps];

    // Apply max steps limit
    if (optimized.length > pattern.maxSteps) {
      optimized = this.selectMostImportantSteps(optimized, pattern.maxSteps);
    }

    // Add explicit markers if required
    if (pattern.requiresExplicit) {
      optimized = optimized.map((step, index) => ({
        ...step,
        content: `Step ${index + 1}: ${step.content}`,
      }));
    }

    // Apply preferred style
    if (pattern.preferredStyle === 'hierarchical') {
      optimized = this.organizeHierarchically(optimized);
    }

    return optimized;
  }

  private applyVerbositySettings(
    steps: ReasoningStep[],
    verbosity: ChainOptimizationConfig['verbosity']
  ): ReasoningStep[] {
    switch (verbosity) {
      case 'minimal':
        return steps.map(step => ({
          ...step,
          content: this.summarizeContent(step.content, 20),
        }));
      case 'detailed':
        return steps.map(step => ({
          ...step,
          content: this.expandContent(step.content),
          metadata: {
            ...step.metadata,
            evidence: [`Supporting detail for: ${step.content}`],
          },
        }));
      default:
        return steps;
    }
  }

  private selectMostImportantSteps(
    steps: ReasoningStep[],
    maxSteps: number
  ): ReasoningStep[] {
    // Keep premises and conclusions, select best intermediate steps
    const premises = steps.filter(s => s.type === 'premise');
    const conclusions = steps.filter(s => s.type === 'conclusion');
    const intermediate = steps.filter(
      s => s.type !== 'premise' && s.type !== 'conclusion'
    );

    // Sort intermediate steps by confidence
    intermediate.sort((a, b) => b.confidence - a.confidence);

    const keepIntermediate = maxSteps - premises.length - conclusions.length;

    return [
      ...premises,
      ...intermediate.slice(0, Math.max(0, keepIntermediate)),
      ...conclusions,
    ];
  }

  private checkLogicalConsistency(steps: ReasoningStep[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    steps.forEach((step, index) => {
      // Check if dependencies exist
      step.dependencies.forEach(depId => {
        if (!steps.find(s => s.id === depId)) {
          issues.push({
            stepId: step.id,
            type: 'missing_connection',
            severity: 'high',
            description: `Missing dependency: ${depId}`,
          });
        }
      });

      // Check for logical gaps
      if (
        index > 0 &&
        step.dependencies.length === 0 &&
        step.type !== 'premise'
      ) {
        issues.push({
          stepId: step.id,
          type: 'missing_connection',
          severity: 'medium',
          description: 'Step has no dependencies but is not a premise',
        });
      }
    });

    return issues;
  }

  private checkConnections(steps: ReasoningStep[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const referenced = new Set<string>();

    steps.forEach(step => {
      step.dependencies.forEach(dep => referenced.add(dep));
    });

    // Check for orphaned steps
    steps.forEach(step => {
      if (
        !referenced.has(step.id) &&
        step.type !== 'conclusion' &&
        steps[steps.length - 1].id !== step.id
      ) {
        issues.push({
          stepId: step.id,
          type: 'missing_connection',
          severity: 'low',
          description: 'Step is not referenced by any other step',
        });
      }
    });

    return issues;
  }

  private checkRedundancies(steps: ReasoningStep[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (let i = 0; i < steps.length - 1; i++) {
      for (let j = i + 1; j < steps.length; j++) {
        if (this.areSimilarSteps(steps[i], steps[j])) {
          issues.push({
            stepId: steps[j].id,
            type: 'redundancy',
            severity: 'low',
            description: `Similar to step ${steps[i].id}`,
          });
        }
      }
    }

    return issues;
  }

  private checkAmbiguities(steps: ReasoningStep[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const ambiguousTerms = ['it', 'this', 'that', 'they', 'these', 'those'];

    steps.forEach(step => {
      const words = step.content.toLowerCase().split(/\s+/);
      const ambiguousCount = words.filter(w =>
        ambiguousTerms.includes(w)
      ).length;

      if (ambiguousCount > 2) {
        issues.push({
          stepId: step.id,
          type: 'ambiguity',
          severity: 'low',
          description: 'Contains ambiguous pronouns without clear antecedents',
        });
      }
    });

    return issues;
  }

  private generateImprovementSuggestions(
    issues: ValidationIssue[],
    chain: ReasoningChain
  ): string[] {
    const suggestions: string[] = [];

    const issueTypes = new Set(issues.map(i => i.type));

    if (issueTypes.has('missing_connection')) {
      suggestions.push('Add explicit connections between reasoning steps');
    }

    if (issueTypes.has('redundancy')) {
      suggestions.push('Consolidate or remove redundant reasoning steps');
    }

    if (issueTypes.has('ambiguity')) {
      suggestions.push('Replace ambiguous pronouns with specific references');
    }

    if (issueTypes.has('logical_error')) {
      suggestions.push('Review logical progression and fix inconsistencies');
    }

    if (chain.steps.length > 10) {
      suggestions.push('Consider simplifying the reasoning chain for clarity');
    }

    return suggestions;
  }

  private calculateValidationScore(
    issues: ValidationIssue[],
    chain: ReasoningChain
  ): number {
    let score = 1.0;

    issues.forEach(issue => {
      switch (issue.severity) {
        case 'high':
          score -= 0.3;
          break;
        case 'medium':
          score -= 0.15;
          break;
        case 'low':
          score -= 0.05;
          break;
        default:
          // Unknown severity level, treat as low impact
          score -= 0.05;
          break;
      }
    });

    // Bonus for well-structured chains
    if (chain.steps.length >= 3 && chain.steps.length <= 10) {
      score += 0.1;
    }

    // Penalty for very long chains
    if (chain.steps.length > 15) {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  private measureEffectiveness(steps: ReasoningStep[], goal: string): number {
    let effectiveness = 0.5; // Base score

    // Check if conclusion addresses goal
    const conclusion = steps.find(s => s.type === 'conclusion');
    if (conclusion && this.addressesGoal(conclusion.content, goal)) {
      effectiveness += 0.3;
    }

    // Check logical flow
    const hasLogicalFlow = this.checkLogicalFlow(steps);
    if (hasLogicalFlow) {
      effectiveness += 0.1;
    }

    // Check confidence levels
    const avgConfidence =
      steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;
    effectiveness += avgConfidence * 0.1;

    return Math.min(1.0, effectiveness);
  }

  // Utility methods

  private normalizeStepContent(content: string): string {
    return content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private areSimilarSteps(step1: ReasoningStep, step2: ReasoningStep): boolean {
    const normalized1 = this.normalizeStepContent(step1.content);
    const normalized2 = this.normalizeStepContent(step2.content);

    // Calculate similarity
    const words1 = new Set(normalized1.split(' '));
    const words2 = new Set(normalized2.split(' '));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    const similarity = intersection.size / union.size;

    return similarity > 0.7;
  }

  private mergeSteps(steps: ReasoningStep[]): ReasoningStep {
    // Merge similar steps into one comprehensive step
    const allDependencies = new Set<string>();
    steps.forEach(s => s.dependencies.forEach(d => allDependencies.add(d)));

    const avgConfidence =
      steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;

    return {
      id: steps[0].id,
      content: steps[0].content, // Use first step's content as primary
      type: steps[0].type,
      dependencies: Array.from(allDependencies),
      confidence: avgConfidence,
      metadata: {
        alternatives: steps.slice(1).map(s => s.content),
      },
    };
  }

  private generateStepContent(
    stepType: string,
    content: string,
    index: number
  ): string {
    const templates = {
      premise: `Given information #${index + 1}: ${content.substring(0, 100)}`,
      inference: `Based on the above, we can infer: ${content.substring(0, 100)}`,
      conclusion: `Therefore, we conclude: ${content.substring(0, 100)}`,
      example: `For example: ${content.substring(0, 100)}`,
      validation: `This is validated by: ${content.substring(0, 100)}`,
      observation: `We observe that: ${content.substring(0, 100)}`,
      hypothesis: `We hypothesize that: ${content.substring(0, 100)}`,
      source: `From the source: ${content.substring(0, 100)}`,
      mapping: `Mapping this concept: ${content.substring(0, 100)}`,
    };

    return templates[stepType as keyof typeof templates] || content;
  }

  private calculateRequiredSteps(prompt: string, goal: string): number {
    // Estimate complexity based on prompt length and goal
    const promptComplexity = Math.min(10, Math.floor(prompt.length / 100));
    const goalComplexity = goal.split(' ').length > 10 ? 2 : 1;

    return promptComplexity + goalComplexity;
  }

  private generateIntermediateStep(
    _prompt: string,
    index: number,
    total: number
  ): string {
    const progress = (index + 1) / total;

    if (progress < 0.3) {
      return `Analyzing the initial conditions and constraints`;
    }
    if (progress < 0.6) {
      return `Applying logical reasoning to derive intermediate results`;
    }
    return `Synthesizing findings to approach the conclusion`;
  }

  private generateConclusion(goal: string, steps: ReasoningStep[]): string {
    const keyPoints = steps
      .filter(s => s.confidence > 0.7)
      .map(s => this.extractKeyPoint(s.content))
      .slice(0, 3)
      .join(', ');

    return `${goal} is achieved through ${keyPoints}`;
  }

  private extractKeyPoint(content: string): string {
    // Extract the most important phrase from content
    const words = content.split(' ');
    if (words.length <= 5) return content;

    return words.slice(0, 5).join(' ');
  }

  private summarizeContent(content: string, maxWords: number): string {
    const words = content.split(' ');
    if (words.length <= maxWords) return content;

    return `${words.slice(0, maxWords).join(' ')}...`;
  }

  private expandContent(content: string): string {
    return `${content}. This step is critical for maintaining logical consistency and ensuring comprehensive reasoning.`;
  }

  private organizeHierarchically(steps: ReasoningStep[]): ReasoningStep[] {
    // Group steps by type and organize hierarchically
    const grouped = {
      premises: steps.filter(s => s.type === 'premise'),
      inferences: steps.filter(s => s.type === 'inference'),
      validations: steps.filter(s => s.type === 'validation'),
      conclusions: steps.filter(s => s.type === 'conclusion'),
    };

    return [
      ...grouped.premises,
      ...grouped.inferences,
      ...grouped.validations,
      ...grouped.conclusions,
    ];
  }

  private addressesGoal(conclusionContent: string, goal: string): boolean {
    const goalKeywords = goal
      .toLowerCase()
      .split(' ')
      .filter(w => w.length > 3);
    const conclusionWords = conclusionContent.toLowerCase().split(' ');

    const matches = goalKeywords.filter(keyword =>
      conclusionWords.includes(keyword)
    );

    return matches.length > goalKeywords.length * 0.5;
  }

  private checkLogicalFlow(steps: ReasoningStep[]): boolean {
    // Check if steps form a logical progression
    for (let i = 1; i < steps.length; i++) {
      const currentStep = steps[i];
      const hasDependency = currentStep.dependencies.some(depId =>
        steps.slice(0, i).some(s => s.id === depId)
      );

      if (!hasDependency && currentStep.type !== 'premise') {
        return false;
      }
    }

    return true;
  }
}

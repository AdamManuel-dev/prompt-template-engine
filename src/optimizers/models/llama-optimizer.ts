/**
 * @fileoverview Llama and open-source model optimization strategies
 * @lastmodified 2025-08-26T14:30:00Z
 *
 * Features: Open-source model optimization, fine-tuning support, efficiency patterns
 * Main APIs: LlamaOptimizer class with open-source model optimization strategies
 * Constraints: Optimized for varying context windows and model capabilities
 * Patterns: Strategy pattern, model-agnostic optimization, efficiency-focused tuning
 */

import { logger } from '../../utils/logger';

export interface LlamaOptimizationConfig {
  maxTokens: number;
  model:
    | 'llama-2-7b'
    | 'llama-2-13b'
    | 'llama-2-70b'
    | 'codellama'
    | 'mistral'
    | 'custom';
  enableInstructionTuning: boolean;
  optimizeForEfficiency: boolean;
  enableFewShotPrompting: boolean;
  customModelConfig?: {
    contextWindow: number;
    instructionFormat?: string;
    stopTokens?: string[];
  };
}

export interface LlamaOptimizationResult {
  optimizedPrompt: string;
  techniquesApplied: string[];
  estimatedTokens: number;
  improvements: {
    efficiencyScore: number;
    clarityScore: number;
    instructionScore: number;
    compatibilityScore: number;
  };
  llamaEnhancements: {
    instructionFormatOptimized: boolean;
    fewShotExamplesAdded: boolean;
    efficiencyImproved: boolean;
    modelSpecificTuning: boolean;
  };
}

export class LlamaOptimizer {
  private readonly defaultConfig: LlamaOptimizationConfig = {
    maxTokens: 4096, // Conservative default for smaller models
    model: 'llama-2-7b',
    enableInstructionTuning: true,
    optimizeForEfficiency: true,
    enableFewShotPrompting: true,
  };

  constructor(
    private config: LlamaOptimizationConfig = {} as LlamaOptimizationConfig
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  async optimizeForLlama(
    prompt: string,
    task: string,
    context?: {
      examples?: Array<{ input: string; output: string }>;
      domain?: string;
      complexity?: 'simple' | 'medium' | 'complex';
    }
  ): Promise<LlamaOptimizationResult> {
    logger.info(`Optimizing prompt for ${this.config.model} capabilities`);

    let optimizedPrompt = prompt;
    const techniquesApplied: string[] = [];
    const llamaEnhancements = {
      instructionFormatOptimized: false,
      fewShotExamplesAdded: false,
      efficiencyImproved: false,
      modelSpecificTuning: false,
    };

    // Apply instruction format optimization
    if (this.config.enableInstructionTuning) {
      const instructionResult = this.optimizeInstructionFormat(
        optimizedPrompt,
        task
      );
      optimizedPrompt = instructionResult.prompt;
      if (instructionResult.applied) {
        techniquesApplied.push('Instruction format optimization');
        llamaEnhancements.instructionFormatOptimized = true;
      }
    }

    // Add few-shot examples if available
    if (this.config.enableFewShotPrompting && context?.examples) {
      const fewShotResult = this.addFewShotExamples(
        optimizedPrompt,
        context.examples
      );
      optimizedPrompt = fewShotResult.prompt;
      if (fewShotResult.applied) {
        techniquesApplied.push('Few-shot example integration');
        llamaEnhancements.fewShotExamplesAdded = true;
      }
    }

    // Apply efficiency optimizations
    if (this.config.optimizeForEfficiency) {
      const efficiencyResult = this.optimizeForEfficiency(optimizedPrompt);
      optimizedPrompt = efficiencyResult.prompt;
      if (efficiencyResult.applied) {
        techniquesApplied.push('Efficiency optimization');
        llamaEnhancements.efficiencyImproved = true;
      }
    }

    // Apply model-specific tuning
    const tuningResult = this.applyModelSpecificTuning(optimizedPrompt);
    optimizedPrompt = tuningResult.prompt;
    if (tuningResult.applied) {
      techniquesApplied.push('Model-specific tuning');
      llamaEnhancements.modelSpecificTuning = true;
    }

    // Apply general open-source patterns
    optimizedPrompt = this.applyOpenSourcePatterns(optimizedPrompt);
    techniquesApplied.push('Open-source model patterns');

    const improvements = this.calculateImprovements(
      prompt,
      optimizedPrompt,
      context
    );

    return {
      optimizedPrompt,
      techniquesApplied,
      estimatedTokens: this.estimateTokens(optimizedPrompt),
      improvements,
      llamaEnhancements,
    };
  }

  private optimizeInstructionFormat(
    prompt: string,
    task: string
  ): { prompt: string; applied: boolean } {
    // Check if instruction format already present
    if (this.hasInstructionFormat(prompt)) {
      return { prompt, applied: false };
    }

    let formatted = '';

    // Llama/Alpaca instruction format
    if (this.config.model.includes('llama') || this.config.model === 'custom') {
      formatted = '### Instruction:\n';
      formatted += `${prompt}\n\n`;
      formatted += '### Response:\n';
    } else if (this.config.model.includes('mistral')) {
      formatted = `[INST] ${prompt} [/INST]`;
    } else {
      // Generic instruction format
      formatted = `Instructions: ${prompt}\n\nResponse:`;
    }

    return { prompt: formatted, applied: true };
  }

  private addFewShotExamples(
    prompt: string,
    examples: Array<{ input: string; output: string }>
  ): { prompt: string; applied: boolean } {
    if (examples.length === 0) {
      return { prompt, applied: false };
    }

    // Limit examples to avoid token overflow
    const maxExamples = Math.min(examples.length, 3);
    const selectedExamples = examples.slice(0, maxExamples);

    let fewShotPrompt = prompt;

    // Add examples before the main instruction
    if (this.hasInstructionFormat(prompt)) {
      // Insert examples before the main instruction
      const instructionIndex = prompt.indexOf('### Instruction:');
      if (instructionIndex !== -1) {
        let exampleSection = '### Examples:\n';
        selectedExamples.forEach((example, index) => {
          exampleSection += `Example ${index + 1}:\n`;
          exampleSection += `Input: ${example.input}\n`;
          exampleSection += `Output: ${example.output}\n\n`;
        });

        fewShotPrompt =
          prompt.slice(0, instructionIndex) +
          exampleSection +
          prompt.slice(instructionIndex);
      }
    } else {
      // Add examples at the beginning
      let exampleSection = 'Here are some examples:\n\n';
      selectedExamples.forEach((example, index) => {
        exampleSection += `Example ${index + 1}:\n`;
        exampleSection += `Input: ${example.input}\n`;
        exampleSection += `Output: ${example.output}\n\n`;
      });

      fewShotPrompt = exampleSection + prompt;
    }

    return { prompt: fewShotPrompt, applied: true };
  }

  private optimizeForEfficiency(prompt: string): {
    prompt: string;
    applied: boolean;
  } {
    let optimized = prompt;
    let applied = false;

    // Remove verbose language that doesn't add value
    const redundancies = [
      [/please note that/gi, ''],
      [/it is important to/gi, ''],
      [/you should understand that/gi, ''],
      [/keep in mind that/gi, ''],
      [/as you can see/gi, ''],
    ];

    for (const [pattern, replacement] of redundancies) {
      const original = optimized;
      optimized = optimized.replace(pattern as RegExp, replacement as string);
      if (optimized !== original) applied = true;
    }

    // Simplify complex phrases
    const simplifications = [
      [/in order to accomplish/gi, 'to'],
      [/for the purpose of/gi, 'to'],
      [/with the intention of/gi, 'to'],
      [/due to the fact that/gi, 'because'],
    ];

    for (const [pattern, replacement] of simplifications) {
      const original = optimized;
      optimized = optimized.replace(pattern as RegExp, replacement as string);
      if (optimized !== original) applied = true;
    }

    // Clean up extra whitespace
    const original = optimized;
    optimized = optimized.replace(/\s+/g, ' ').trim();
    if (optimized !== original) applied = true;

    return { prompt: optimized, applied };
  }

  private applyModelSpecificTuning(prompt: string): {
    prompt: string;
    applied: boolean;
  } {
    let tuned = prompt;
    let applied = false;

    // Model-specific optimizations
    switch (this.config.model) {
      case 'codellama':
        if (
          prompt.toLowerCase().includes('code') ||
          prompt.toLowerCase().includes('programming')
        ) {
          tuned += '\n\nProvide complete, working code with comments.';
          applied = true;
        }
        break;

      case 'llama-2-70b':
        // Leverage larger model's reasoning capabilities
        if (!prompt.includes('step-by-step') && !prompt.includes('reasoning')) {
          tuned += '\n\nExplain your reasoning step-by-step.';
          applied = true;
        }
        break;

      case 'mistral':
        // Mistral works well with direct, concise instructions
        tuned = tuned.replace(/could you please/gi, '');
        tuned = tuned.replace(/if possible/gi, '');
        applied = true;
        break;

      case 'custom':
        if (this.config.customModelConfig?.instructionFormat) {
          // Apply custom instruction format if specified
          tuned = this.config.customModelConfig.instructionFormat.replace(
            '{prompt}',
            tuned
          );
          applied = true;
        }
        break;
    }

    return { prompt: tuned, applied };
  }

  private applyOpenSourcePatterns(prompt: string): string {
    let patterned = prompt;

    // Open-source models often work better with explicit instructions
    patterned = patterned.replace(/maybe/gi, '');
    patterned = patterned.replace(/perhaps/gi, '');
    patterned = patterned.replace(/if you can/gi, '');

    // Add explicit output formatting if not present
    if (!patterned.includes('format') && !patterned.includes('structure')) {
      patterned += '\n\nProvide a clear, well-structured response.';
    }

    return patterned;
  }

  private hasInstructionFormat(prompt: string): boolean {
    const instructionPatterns = [
      /### Instruction:/i,
      /### Response:/i,
      /\[INST\]/i,
      /\[\/INST\]/i,
      /Instructions:/i,
      /Response:/i,
    ];

    return instructionPatterns.some(pattern => pattern.test(prompt));
  }

  private estimateTokens(text: string): number {
    // Open-source tokenization approximation (varies by model)
    return Math.ceil(text.length / 3.5);
  }

  private calculateImprovements(
    original: string,
    optimized: string,
    context?: any
  ) {
    const efficiencyScore = this.calculateEfficiencyScore(optimized);
    const clarityScore = this.calculateClarityScore(optimized);
    const instructionScore = this.calculateInstructionScore(optimized);
    const compatibilityScore = this.calculateCompatibilityScore(optimized);

    return {
      efficiencyScore: Math.min(100, efficiencyScore),
      clarityScore: Math.min(100, clarityScore),
      instructionScore: Math.min(100, instructionScore),
      compatibilityScore: Math.min(100, compatibilityScore),
    };
  }

  private calculateEfficiencyScore(text: string): number {
    let score = 60;

    // Award for conciseness
    if (text.length < 300) score += 20;
    else if (text.length < 600) score += 10;

    // Award for direct language
    if (!text.includes('perhaps') && !text.includes('maybe')) score += 15;

    return score;
  }

  private calculateClarityScore(text: string): number {
    let score = 60;

    if (text.includes('clear')) score += 10;
    if (text.includes('specific')) score += 10;
    if (text.includes(':')) score += 5;
    if (text.includes('\n')) score += 5;

    return score;
  }

  private calculateInstructionScore(text: string): number {
    let score = 50;

    if (this.hasInstructionFormat(text)) score += 20;
    if (text.includes('Example')) score += 15;
    if (text.includes('step-by-step')) score += 10;
    if (text.includes('Response:')) score += 5;

    return score;
  }

  private calculateCompatibilityScore(text: string): number {
    let score = 70;

    // Award for open-source model compatibility
    if (text.includes('### Instruction:')) score += 15;
    if (text.includes('[INST]')) score += 15;
    if (!text.includes('maybe') && !text.includes('perhaps')) score += 10;

    return score;
  }

  getLlamaRecommendations(): {
    bestPractices: string[];
    modelSpecific: Record<string, string[]>;
    efficiencyTips: string[];
  } {
    return {
      bestPractices: [
        'Use clear instruction formats (### Instruction: / ### Response:)',
        'Provide few-shot examples for complex tasks',
        'Be explicit and direct in instructions',
        'Structure prompts with clear sections',
        'Test with different context lengths',
      ],
      modelSpecific: {
        'llama-2-7b': [
          'Keep prompts concise due to smaller context window',
          'Use simple, direct language',
          'Provide clear examples for better performance',
        ],
        'llama-2-70b': [
          'Leverage reasoning capabilities with step-by-step requests',
          'Can handle more complex, multi-part instructions',
          'Benefits from detailed context and examples',
        ],
        codellama: [
          'Specify programming language clearly',
          'Request complete, working code examples',
          'Include relevant context about code requirements',
        ],
        mistral: [
          'Use [INST] instruction format for best results',
          'Keep instructions clear and concise',
          'Works well with direct, imperative statements',
        ],
      },
      efficiencyTips: [
        'Remove unnecessary filler words and phrases',
        'Use direct imperative statements',
        'Limit few-shot examples to 3 or fewer',
        'Structure content with clear delimiters',
        'Test token usage with your specific model',
      ],
    };
  }
}

export default LlamaOptimizer;

/**
 * @fileoverview Synthetic example generator for improving template robustness
 * @lastmodified 2025-08-26T12:15:00Z
 *
 * Features: Diverse example generation, edge case coverage, validation
 * Main APIs: generateExamples(), generateEdgeCases(), validateExamples()
 * Constraints: Requires template context, language models for generation
 * Patterns: Factory pattern, template method pattern, validation pipeline
 */

import { logger } from '../utils/logger';
import { Template } from '../types';

export interface ExampleGenerationConfig {
  count: number;
  includeEdgeCases: boolean;
  diversityLevel: 'low' | 'medium' | 'high';
  targetDomain?: string;
  constraints?: {
    maxLength?: number;
    minLength?: number;
    requiredElements?: string[];
    forbiddenElements?: string[];
  };
}

export interface GeneratedExample {
  input: string;
  expectedOutput?: string;
  category: 'normal' | 'edge_case' | 'adversarial' | 'boundary';
  confidence: number;
  metadata: {
    generationMethod: string;
    diversity: number;
    complexity: number;
    coverage: string[];
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

export class ExampleGenerator {
  private readonly diversityStrategies = {
    low: 0.3,
    medium: 0.6,
    high: 0.9,
  };

  private readonly edgeCasePatterns = [
    { name: 'empty_input', pattern: () => '' },
    { name: 'minimal_input', pattern: () => this.generateMinimalInput() },
    { name: 'maximum_length', pattern: () => this.generateMaxLengthInput() },
    { name: 'special_characters', pattern: () => this.generateSpecialChars() },
    { name: 'unicode_characters', pattern: () => this.generateUnicode() },
    { name: 'repeated_patterns', pattern: () => this.generateRepeated() },
    { name: 'nested_structures', pattern: () => this.generateNested() },
    { name: 'mixed_formats', pattern: () => this.generateMixedFormat() },
  ];

  /**
   * Generate synthetic examples for a template
   */
  async generateExamples(
    template: Template,
    config: ExampleGenerationConfig
  ): Promise<GeneratedExample[]> {
    logger.info(`Generating ${config.count} examples for template: ${template.name}`);

    const examples: GeneratedExample[] = [];
    const diversityThreshold = this.diversityStrategies[config.diversityLevel];

    const normalCount = Math.floor(config.count * (1 - diversityThreshold));
    const edgeCaseCount = config.includeEdgeCases 
      ? Math.floor(config.count * diversityThreshold * 0.5)
      : 0;
    const adversarialCount = Math.floor(config.count * diversityThreshold * 0.3);
    const boundaryCount = config.count - normalCount - edgeCaseCount - adversarialCount;

    examples.push(...await this.generateNormalExamples(template, normalCount, config));
    
    if (config.includeEdgeCases) {
      examples.push(...await this.generateEdgeCases(template, edgeCaseCount, config));
    }
    
    examples.push(...await this.generateAdversarialExamples(template, adversarialCount, config));
    examples.push(...await this.generateBoundaryExamples(template, boundaryCount, config));

    const validatedExamples = await this.validateAndFilter(examples, template);

    logger.info(`Generated ${validatedExamples.length} valid examples`);
    return validatedExamples;
  }

  /**
   * Generate normal examples based on template patterns
   */
  private async generateNormalExamples(
    template: Template,
    count: number,
    config: ExampleGenerationConfig
  ): Promise<GeneratedExample[]> {
    const examples: GeneratedExample[] = [];
    
    for (let i = 0; i < count; i++) {
      const input = this.generateTemplateBasedInput(template, config);
      const example: GeneratedExample = {
        input,
        category: 'normal',
        confidence: 0.9,
        metadata: {
          generationMethod: 'template_based',
          diversity: this.calculateDiversity(input, examples.map(e => e.input)),
          complexity: this.calculateComplexity(input),
          coverage: this.analyzeCoverage(input, template),
        },
      };
      
      if (template.variables) {
        example.expectedOutput = this.generateExpectedOutput(template, input);
      }
      
      examples.push(example);
    }
    
    return examples;
  }

  /**
   * Generate edge case examples
   */
  async generateEdgeCases(
    template: Template,
    count: number,
    _config: ExampleGenerationConfig
  ): Promise<GeneratedExample[]> {
    const examples: GeneratedExample[] = [];
    const patternsPerExample = Math.max(1, Math.floor(this.edgeCasePatterns.length / count));
    
    for (let i = 0; i < count; i++) {
      const patternIndex = i % this.edgeCasePatterns.length;
      const pattern = this.edgeCasePatterns[patternIndex];
      const input = pattern.pattern();
      
      examples.push({
        input,
        category: 'edge_case',
        confidence: 0.8,
        metadata: {
          generationMethod: `edge_case_${pattern.name}`,
          diversity: 1.0,
          complexity: this.calculateComplexity(input),
          coverage: [pattern.name],
        },
      });
    }
    
    return examples;
  }

  /**
   * Generate adversarial examples to test robustness
   */
  private async generateAdversarialExamples(
    template: Template,
    count: number,
    config: ExampleGenerationConfig
  ): Promise<GeneratedExample[]> {
    const examples: GeneratedExample[] = [];
    
    for (let i = 0; i < count; i++) {
      const input = this.generateAdversarialInput(template, config);
      examples.push({
        input,
        category: 'adversarial',
        confidence: 0.6,
        metadata: {
          generationMethod: 'adversarial',
          diversity: 0.9,
          complexity: this.calculateComplexity(input),
          coverage: ['adversarial_testing'],
        },
      });
    }
    
    return examples;
  }

  /**
   * Generate boundary condition examples
   */
  private async generateBoundaryExamples(
    template: Template,
    count: number,
    config: ExampleGenerationConfig
  ): Promise<GeneratedExample[]> {
    const examples: GeneratedExample[] = [];
    
    for (let i = 0; i < count; i++) {
      const input = this.generateBoundaryInput(template, config);
      examples.push({
        input,
        category: 'boundary',
        confidence: 0.7,
        metadata: {
          generationMethod: 'boundary',
          diversity: 0.7,
          complexity: this.calculateComplexity(input),
          coverage: ['boundary_testing'],
        },
      });
    }
    
    return examples;
  }

  /**
   * Validate generated examples
   */
  async validateExamples(
    examples: GeneratedExample[],
    template: Template
  ): Promise<ValidationResult[]> {
    return examples.map(example => this.validateExample(example, template));
  }

  /**
   * Validate a single example
   */
  private validateExample(
    example: GeneratedExample,
    template: Template
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let score = 1.0;

    if (!example.input) {
      errors.push('Example has no input');
      score = 0;
    }

    if (example.input.length === 0 && example.category !== 'edge_case') {
      warnings.push('Empty input for non-edge-case example');
      score *= 0.5;
    }

    if (example.confidence < 0.5) {
      warnings.push('Low confidence example');
      score *= 0.7;
    }

    const requiredVars = Object.entries(template.variables || {})
      .filter(([, config]) => config.required)
      .map(([key]) => key);

    const missingVars = requiredVars.filter(
      varName => !example.input.includes(`{{${varName}}}`)
    );

    if (missingVars.length > 0 && example.category === 'normal') {
      warnings.push(`Missing required variables: ${missingVars.join(', ')}`);
      score *= 0.8;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score,
    };
  }

  /**
   * Validate and filter examples
   */
  private async validateAndFilter(
    examples: GeneratedExample[],
    template: Template
  ): Promise<GeneratedExample[]> {
    const validationResults = await this.validateExamples(examples, template);
    
    return examples.filter((example, index) => {
      const validation = validationResults[index];
      if (!validation.valid) {
        logger.warn(`Filtering out invalid example: ${validation.errors.join(', ')}`);
        return false;
      }
      if (validation.score < 0.3) {
        logger.warn(`Filtering out low-score example: ${validation.score}`);
        return false;
      }
      return true;
    });
  }

  // Helper methods for generation

  private generateTemplateBasedInput(
    template: Template,
    config: ExampleGenerationConfig
  ): string {
    const variables = template.variables || {};
    let input = template.content || '';

    Object.entries(variables).forEach(([key, varConfig]) => {
      const value = this.generateValueForType(varConfig.type, config);
      input = input.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    return input;
  }

  private generateValueForType(
    type: string,
    config: ExampleGenerationConfig
  ): string {
    switch (type) {
      case 'string':
        return this.generateString(config.constraints?.minLength || 10, 
                                   config.constraints?.maxLength || 100);
      case 'number':
        return Math.floor(Math.random() * 1000).toString();
      case 'boolean':
        return Math.random() > 0.5 ? 'true' : 'false';
      case 'array':
        return JSON.stringify(this.generateArray());
      case 'object':
        return JSON.stringify(this.generateObject());
      default:
        return 'example_value';
    }
  }

  private generateString(minLength: number, maxLength: number): string {
    const length = Math.floor(Math.random() * (maxLength - minLength)) + minLength;
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateArray(): unknown[] {
    const length = Math.floor(Math.random() * 5) + 1;
    return Array(length).fill(0).map(() => this.generateString(5, 15));
  }

  private generateObject(): Record<string, unknown> {
    return {
      key1: this.generateString(5, 20),
      key2: Math.floor(Math.random() * 100),
      key3: Math.random() > 0.5,
    };
  }

  private generateMinimalInput(): string {
    return 'a';
  }

  private generateMaxLengthInput(): string {
    return this.generateString(10000, 10000);
  }

  private generateSpecialChars(): string {
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/\\`~"\' ';
    let result = '';
    for (let i = 0; i < 50; i++) {
      result += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
    }
    return result;
  }

  private generateUnicode(): string {
    const unicodeRanges = [
      [0x0041, 0x005A], // Latin uppercase
      [0x0061, 0x007A], // Latin lowercase
      [0x4E00, 0x4E20], // CJK
      [0x0600, 0x0620], // Arabic
      [0x0400, 0x0420], // Cyrillic
    ];
    
    let result = '';
    for (let i = 0; i < 20; i++) {
      const range = unicodeRanges[Math.floor(Math.random() * unicodeRanges.length)];
      const codePoint = Math.floor(Math.random() * (range[1] - range[0])) + range[0];
      result += String.fromCodePoint(codePoint);
    }
    return result;
  }

  private generateRepeated(): string {
    const pattern = this.generateString(5, 10);
    return pattern.repeat(Math.floor(Math.random() * 10) + 2);
  }

  private generateNested(): string {
    const depth = Math.floor(Math.random() * 5) + 1;
    let result = '';
    for (let i = 0; i < depth; i++) {
      result = `{${result}}`;
    }
    return result;
  }

  private generateMixedFormat(): string {
    const formats = [
      () => JSON.stringify({ data: this.generateString(10, 20) }),
      () => `<xml>${this.generateString(10, 20)}</xml>`,
      () => `key: ${this.generateString(10, 20)}`,
      () => `${this.generateString(5, 10)}|${this.generateString(5, 10)}`,
    ];
    
    return formats[Math.floor(Math.random() * formats.length)]();
  }

  private generateAdversarialInput(
    _template: Template,
    _config: ExampleGenerationConfig
  ): string {
    const adversarialPatterns = [
      'DROP TABLE users;',
      '<script>alert("XSS")</script>',
      '${__import__("os").system("ls")}',
      '../../etc/passwd',
      '\x00\x01\x02\x03',
      'A'.repeat(100000),
    ];
    
    return adversarialPatterns[Math.floor(Math.random() * adversarialPatterns.length)];
  }

  private generateBoundaryInput(
    template: Template,
    config: ExampleGenerationConfig
  ): string {
    const maxLength = config.constraints?.maxLength || 1000;
    const minLength = config.constraints?.minLength || 1;
    
    const boundaries = [
      this.generateString(minLength, minLength),
      this.generateString(maxLength, maxLength),
      this.generateString(maxLength - 1, maxLength - 1),
      this.generateString(minLength + 1, minLength + 1),
    ];
    
    return boundaries[Math.floor(Math.random() * boundaries.length)];
  }

  private generateExpectedOutput(template: Template, input: string): string {
    return `Processed: ${template.name} with input length ${input.length}`;
  }

  private calculateDiversity(input: string, existingInputs: string[]): number {
    if (existingInputs.length === 0) return 1.0;
    
    const similarities = existingInputs.map(existing => 
      this.calculateSimilarity(input, existing)
    );
    
    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    return 1.0 - avgSimilarity;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculateComplexity(input: string): number {
    const factors = {
      length: Math.min(input.length / 1000, 1.0),
      uniqueChars: new Set(input).size / input.length,
      specialChars: (input.match(/[^a-zA-Z0-9\s]/g) || []).length / input.length,
      nesting: (input.match(/[{}\[\]()]/g) || []).length / 10,
    };
    
    return Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length;
  }

  private analyzeCoverage(input: string, template: Template): string[] {
    const coverage: string[] = [];
    
    const variables = Object.keys(template.variables || {});
    variables.forEach(varName => {
      if (input.includes(`{{${varName}}}`)) {
        coverage.push(`var:${varName}`);
      }
    });
    
    if (input.length < 10) coverage.push('short_input');
    if (input.length > 1000) coverage.push('long_input');
    if (/[^a-zA-Z0-9\s]/.test(input)) coverage.push('special_chars');
    if (/\d/.test(input)) coverage.push('numeric');
    
    return coverage;
  }
}
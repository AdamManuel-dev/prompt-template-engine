/**
 * @fileoverview Validation pipeline for chaining validators
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: Chain of responsibility pattern for validation
 * Main APIs: ValidationPipeline, Validator, ValidationResult
 * Constraints: Async validation support, composable validators
 * Patterns: Chain of responsibility, pipeline pattern
 */

export interface ValidationContext {
  data: unknown;
  path?: string;
  parent?: unknown;
  root?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ValidationError {
  path: string;
  message: string;
  code?: string;
  context?: Record<string, unknown>;
}

export interface ValidationWarning {
  path: string;
  message: string;
  code?: string;
  context?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  data?: unknown; // Transformed data after validation
}

export interface Validator {
  name: string;
  validate(context: ValidationContext): Promise<ValidationResult>;
}

// BaseValidator moved to separate file for max-classes-per-file rule

export interface PreProcessor {
  name: string;
  process(data: unknown): Promise<unknown>;
}

export interface PostProcessor {
  name: string;
  process(result: ValidationResult): Promise<ValidationResult>;
}

export interface PipelineOptions {
  stopOnFirstError?: boolean;
  collectAllErrors?: boolean;
  enableWarnings?: boolean;
  maxErrors?: number;
}

export class ValidationPipeline {
  private validators: Validator[] = [];

  private preProcessors: PreProcessor[] = [];

  private postProcessors: PostProcessor[] = [];

  private options: PipelineOptions;

  constructor(options: PipelineOptions = {}) {
    this.options = {
      stopOnFirstError: false,
      collectAllErrors: true,
      enableWarnings: true,
      maxErrors: 100,
      ...options,
    };
  }

  /**
   * Add a validator to the pipeline
   */
  addValidator(validator: Validator): ValidationPipeline {
    this.validators.push(validator);
    return this;
  }

  /**
   * Add multiple validators
   */
  addValidators(...validators: Validator[]): ValidationPipeline {
    this.validators.push(...validators);
    return this;
  }

  /**
   * Add a pre-processor
   */
  addPreProcessor(processor: PreProcessor): ValidationPipeline {
    this.preProcessors.push(processor);
    return this;
  }

  /**
   * Add a post-processor
   */
  addPostProcessor(processor: PostProcessor): ValidationPipeline {
    this.postProcessors.push(processor);
    return this;
  }

  /**
   * Execute the validation pipeline
   */
  async validate(data: unknown): Promise<ValidationResult> {
    // Run pre-processors
    let processedData = data;
    const preProcessResults = await Promise.all(
      this.preProcessors.map(async processor => {
        try {
          return await processor.process(processedData);
        } catch {
          return processedData;
        }
      })
    );

    // Use last pre-processor result as input
    if (preProcessResults.length > 0) {
      processedData = preProcessResults[preProcessResults.length - 1];
    }

    // Create validation context
    const context: ValidationContext = {
      data: processedData,
      root: processedData,
      metadata: {},
    };

    // Run validators
    const allErrors: ValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];
    let transformedData = processedData;

    const validatorPromises = this.validators.map(validator =>
      validator.validate({ ...context, data: transformedData })
    );

    const results = await Promise.all(validatorPromises);

    results.forEach(result => {
      allErrors.push(...result.errors);

      if (this.options.enableWarnings) {
        allWarnings.push(...result.warnings);
      }

      // Use transformed data from validator if provided
      if (result.data !== undefined) {
        transformedData = result.data;
      }

      // Check if we should stop
      if (this.options.stopOnFirstError && result.errors.length > 0) {
        return;
      }

      // Check max errors limit
      if (
        this.options.maxErrors &&
        allErrors.length >= this.options.maxErrors
      ) {
        allErrors.push({
          path: '',
          message: `Validation stopped: maximum error limit (${this.options.maxErrors}) reached`,
          code: 'MAX_ERRORS_REACHED',
        });
      }
    });

    // Create result
    let result: ValidationResult = {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      data: transformedData,
    };

    // Run post-processors
    const postProcessorPromises = this.postProcessors.map(processor =>
      processor.process(result)
    );

    const postResults = await Promise.all(postProcessorPromises);

    // Use last post-processor result
    if (postResults.length > 0) {
      const lastResult = postResults[postResults.length - 1];
      if (lastResult) {
        result = lastResult;
      }
    }

    return result;
  }

  /**
   * Create a new pipeline with the same configuration
   */
  clone(): ValidationPipeline {
    const pipeline = new ValidationPipeline(this.options);
    pipeline.validators = [...this.validators];
    pipeline.preProcessors = [...this.preProcessors];
    pipeline.postProcessors = [...this.postProcessors];
    return pipeline;
  }

  /**
   * Clear all validators and processors
   */
  clear(): void {
    this.validators = [];
    this.preProcessors = [];
    this.postProcessors = [];
  }

  /**
   * Get pipeline configuration
   */
  getConfig(): {
    validators: string[];
    preProcessors: string[];
    postProcessors: string[];
    options: PipelineOptions;
  } {
    return {
      validators: this.validators.map(v => v.name),
      preProcessors: this.preProcessors.map(p => p.name),
      postProcessors: this.postProcessors.map(p => p.name),
      options: { ...this.options },
    };
  }
}

/**
 * @fileoverview Service layer exports
 * @lastmodified 2025-08-22T12:00:00Z
 *
 * Features: Centralized service exports
 * Main APIs: TemplateService, ConfigService
 * Constraints: Service layer abstraction
 * Patterns: Barrel export pattern
 */

export { TemplateService } from './template.service';
export type {
  Template,
  TemplateFile,
  TemplateCommand,
  VariableConfig,
  TemplateServiceOptions,
} from './template.service';

export { ConfigService } from './config.service';
export type { ConfigOptions, ConfigServiceOptions } from './config.service';

export { PromptOptimizationService } from './prompt-optimization.service';
export type {
  OptimizationOptions,
  OptimizationRequest,
  OptimizationResult,
  BatchOptimizationRequest,
  BatchOptimizationResult,
} from './prompt-optimization.service';

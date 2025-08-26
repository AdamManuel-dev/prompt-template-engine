/**
 * @fileoverview PromptWizard integration module exports
 * @lastmodified 2025-08-26T12:15:00Z
 *
 * Features: Centralized exports for PromptWizard integration
 * Main APIs: PromptWizardClient, ConfigMapper, types
 * Constraints: Barrel export pattern for clean imports
 * Patterns: Module organization, type re-exports
 */

// Core client and service
export { PromptWizardClient, createDefaultConfig } from './client';

// Configuration mapping
export { ConfigMapper } from './config-mapper';
export type { TemplateConfig } from './config-mapper';

// Type definitions
export type {
  OptimizationConfig,
  OptimizedResult,
  QualityScore,
  PromptComparison,
  Example,
  OptimizationJob,
  PromptWizardService,
  PromptWizardConfig,
  ServiceResponse,
  OptimizationEvent,
  OptimizationEventHandler,
} from './types';

// Re-export for convenience
export type { PromptWizardClient as Client } from './client';
export type { ConfigMapper as Mapper } from './config-mapper';

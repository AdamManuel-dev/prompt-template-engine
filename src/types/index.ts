/**
 * @fileoverview Type definitions for cursor-prompt-template-engine
 * @lastmodified 2025-08-22T10:30:00Z
 *
 * Features: Core type definitions for CLI and template system
 * Main Types: TemplateConfig, CLIOptions, TemplateMetadata
 * Constraints: Strict TypeScript typing, no any types
 * Patterns: Interface-based design with clear separation of concerns
 */

/**
 * Types of templates supported
 */
export type TemplateType =
  | 'basic'
  | 'advanced'
  | 'component'
  | 'project'
  | 'snippet';

/**
 * Template file definition
 */
export interface TemplateFile {
  source: string;
  destination: string;
  transform?: boolean;
  condition?: string;
  permissions?: string;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  type: 'string' | 'number' | 'boolean' | 'choice';
  description: string;
  default?: unknown;
  required?: boolean;
  choices?: string[];
  validation?: string;
}

/**
 * Template lifecycle hooks
 */
export interface TemplateHooks {
  preApply?: string[];
  postApply?: string[];
  preValidate?: string[];
  postValidate?: string[];
}

/**
 * Output format options
 */
export type OutputFormat = 'table' | 'json' | 'yaml' | 'plain';

/**
 * Configuration for a prompt template
 */
export interface TemplateConfig {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags?: string[];
  type: TemplateType;
  files: TemplateFile[];
  variables?: Record<string, TemplateVariable>;
  hooks?: TemplateHooks;
  dependencies?: string[];
}

/**
 * CLI command options
 */
export interface CLIOptions {
  debug?: boolean;
  config?: string;
  dryRun?: boolean;
  force?: boolean;
  preview?: boolean;
  strict?: boolean;
  global?: boolean;
  all?: boolean;
  format?: OutputFormat;
}

/**
 * Template metadata for listing and discovery
 */
export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags: string[];
  type: TemplateType;
  path: string;
  lastModified: Date;
  size: number;
}

/**
 * Application configuration
 */
export interface AppConfig {
  templatesDir: string;
  globalTemplatesDir?: string;
  defaultTemplate: string;
  outputFormat: OutputFormat;
  enableDebug: boolean;
  validateOnApply: boolean;
  backupBeforeApply: boolean;
}

/**
 * Template application result
 */
export interface ApplyResult {
  success: boolean;
  filesCreated: string[];
  filesModified: string[];
  filesSkipped: string[];
  errors: string[];
  warnings: string[];
}

/**
 * Validation error
 */
export interface ValidationError {
  code: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  code: string;
  message: string;
  file?: string;
  suggestion?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Template processing options
 */
export interface ProcessingOptions {
  variables?: Record<string, string>;
  preview?: boolean;
  validate?: boolean;
  stripComments?: boolean;
  preserveWhitespace?: boolean;
}

/**
 * Template discovery options
 */
export interface DiscoveryOptions {
  searchPaths?: string[];
  includeHidden?: boolean;
  recursive?: boolean;
  fileExtensions?: string[];
  categories?: string[];
}

/**
 * Command execution context
 */
export interface CommandContext {
  workingDirectory: string;
  configPath?: string;
  debug: boolean;
  dryRun: boolean;
  interactive: boolean;
}

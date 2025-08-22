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

/**
 * Marketplace command options
 */
export interface MarketplaceCommandOptions {
  debug?: boolean;
  format?: OutputFormat;
  all?: boolean;
  global?: boolean;
  force?: boolean;
  preview?: boolean;
  interactive?: boolean;
  version?: string;
  rating?: number;
  comment?: string;
  anonymous?: boolean;
  detailed?: boolean;
  stats?: boolean;
  category?: string;
  tag?: string;
  author?: string;
  sort?: string;
  limit?: number;
  popular?: boolean;
  trending?: boolean;
  recent?: boolean;
  // Author command specific options
  profile?: string;
  templates?: string;
  follow?: string;
  activity?: string;
  search?: string;
  featured?: boolean;
  badges?: string;
  followers?: string;
  following?: string;
  verified?: boolean;
  // Batch install options
  dryRun?: boolean;
  maxConcurrent?: number;
  file?: string;
}

/**
 * Template dependency
 */
export interface TemplateDependency {
  name: string;
  version: string;
  optional?: boolean;
  description?: string;
  type?: string;
}

/**
 * Marketplace template version
 */
export interface MarketplaceTemplateVersion {
  version: string;
  deprecated?: boolean;
  releaseDate?: string;
  changelog?: string;
  dependencies?: TemplateDependency[];
  downloadUrl?: string;
  size?: number;
  checksum?: string;
  created?: string;
  downloads?: number;
}

/**
 * Marketplace author
 */
export interface MarketplaceAuthor {
  id: string;
  name: string;
  email?: string;
  url?: string;
  avatar?: string;
  bio?: string;
  verified?: boolean;
}

/**
 * Marketplace template
 */
export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: MarketplaceAuthor;
  currentVersion: string;
  versions: MarketplaceTemplateVersion[];
  downloads: number;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  repository?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
  featured?: boolean;
  verified?: boolean;
  displayName?: string;
  stats?: {
    downloads?: number;
    views?: number;
    forks?: number;
    stars?: number;
  };
  updated?: string; // Legacy alias for updatedAt
}

/**
 * Search query for templates
 */
export interface TemplateSearchQuery {
  query?: string;
  category?: string;
  tags?: string[];
  author?: string;
  sort?: 'relevance' | 'downloads' | 'rating' | 'recent' | 'name';
  limit?: number;
  offset?: number;
}

/**
 * Category facet
 */
export interface CategoryFacet {
  name: string;
  count: number;
}

/**
 * Tag facet
 */
export interface TagFacet {
  name: string;
  count: number;
}

/**
 * Author facet
 */
export interface AuthorFacet {
  name: string;
  count: number;
}

/**
 * Search facets for filtering
 */
export interface SearchFacets {
  categories: CategoryFacet[];
  tags: TagFacet[];
  authors: AuthorFacet[];
}

/**
 * Template search result
 */
export interface TemplateSearchResult {
  templates: MarketplaceTemplate[];
  total: number;
  facets?: SearchFacets;
  suggestions?: string[];
}

/**
 * Template installation result
 */
export interface InstallationResult {
  success: boolean;
  template: MarketplaceTemplate;
  version: string;
  installPath: string;
  duration: number;
  warnings?: string[];
  errors?: string[];
}

/**
 * Git repository info
 */
export interface RepositoryInfo {
  name: string;
  path: string;
  url?: string;
}

/**
 * Git branch info
 */
export interface BranchInfo {
  current: string;
  all: string[];
  tracking?: string;
  ahead?: number;
  behind?: number;
}

/**
 * Git status info
 */
export interface StatusInfo {
  modified: string[];
  added: string[];
  deleted: string[];
  renamed: string[];
  copied: string[];
  untracked: string[];
  staged: string[];
  conflicted: string[];
}

/**
 * Git commit info
 */
export interface CommitInfo {
  hash: string;
  date: string;
  message: string;
  author: string;
  refs?: string;
}

/**
 * Git remote info
 */
export interface RemoteInfo {
  name: string;
  url: string;
}

/**
 * Git repository stats
 */
export interface RepoStats {
  totalCommits: number;
  contributors: number;
  branches: number;
  tags: number;
}

/**
 * Git diff info
 */
export interface DiffInfo {
  files: number;
  insertions: number;
  deletions: number;
}

/**
 * Git context information
 */
export interface GitContext {
  repository?: RepositoryInfo;
  branch?: BranchInfo;
  status?: StatusInfo;
  commits?: CommitInfo[];
  remotes?: RemoteInfo[];
  stats?: RepoStats;
  diff?: DiffInfo;
}

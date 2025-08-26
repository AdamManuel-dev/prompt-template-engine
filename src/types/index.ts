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
  path: string;
  source: string;
  destination: string;
  transform?: boolean;
  condition?: string;
  content?: string;
  name?: string;
  encoding?: string;
  mode?: string;
  permissions?: string;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  type: 'string' | 'number' | 'boolean' | 'choice';
  description: string;
  default?: unknown;
  defaultValue?: unknown;
  required?: boolean;
  choices?: string[];
  validation?: string;
}

/**
 * Template command definition
 */
export interface TemplateCommand {
  command: string;
  description?: string;
  when?: string;
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
  rating?: string;
  comment?: string;
  anonymous?: boolean;
  detailed?: boolean;
  stats?: string;
  category?: string;
  tag?: string;
  author?: string;
  sort?: string;
  limit?: string;
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
  continueOnError?: boolean;
  // Info command specific options
  dependencies?: boolean;
  examples?: boolean;
  versions?: boolean;
  // Install wizard specific options
  quickMode?: boolean;
  // Install command specific options
  skipDeps?: boolean;
  autoUpdate?: boolean;
  // List command specific options
  checkUpdates?: boolean;
  outdated?: boolean;
  // Quick install specific options
  showProgress?: boolean;
  noConfirm?: boolean;
  useLatest?: boolean;
  autoDeps?: boolean;
  enableUpdates?: boolean;
  // Rate command specific options
  showReviews?: boolean;
  delete?: boolean;
  title?: string;
  // Search command specific options
  page?: string;
  order?: 'asc' | 'desc';
  query?: string;
  // Update command specific options
  checkOnly?: boolean;
  major?: boolean;
  includePrerelease?: boolean;
  // Version command specific options
  compare?: string;
  analyze?: boolean;
  list?: string;
  latest?: string;
  compatibility?: boolean;
}

/**
 * Template dependency
 */
export interface TemplateDependency {
  name: string;
  version: string;
  type: 'plugin' | 'template' | 'engine';
  optional: boolean;
  description?: string;
  templateId?: string;
  required?: boolean;
}

/**
 * Marketplace template version
 */
export interface MarketplaceTemplateVersion {
  version: string;
  description?: string;
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
  rating:
    | number
    | {
        average: number;
        total: number;
        distribution?: {
          1: number;
          2: number;
          3: number;
          4: number;
          5: number;
        };
      };
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  repository?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
  featured?: boolean;
  verified?: boolean;
  deprecated?: boolean;
  displayName?: string;
  stats?: {
    downloads?: number;
    views?: number;
    forks?: number;
    stars?: number;
  };
  updated?: string; // Legacy alias for updatedAt
  registered?: string; // Installation date
  path?: string; // Installation path
  versionInfo?: {
    dependencies: TemplateDependency[];
    size?: number;
    checksum?: string;
  };
  metadata?: {
    readme?: string;
    license?: string;
    keywords?: string[];
    framework?: string;
    language?: string;
    minEngineVersion?: string;
    maxEngineVersion?: string;
    platform?: string[];
    screenshots?: string[];
    documentation?: string;
    repository?: {
      url?: string;
      type?: string;
      branch?: string;
    };
  };
}

/**
 * Search query for templates
 */
export interface TemplateSearchQuery {
  query?: string;
  category?: string;
  tags?: string[];
  author?: string;
  sort?:
    | 'relevance'
    | 'downloads'
    | 'rating'
    | 'recent'
    | 'name'
    | 'updated'
    | 'popularity'
    | 'trending';
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
  page: number;
  limit: number;
  hasMore: boolean;
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
  autoUpdate?: boolean;
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

/**
 * Template processing context
 */
export interface TemplateContext {
  variables: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  environment?: Record<string, unknown>;
  options?: ProcessingOptions;
  // Loop context properties
  _index?: number;
  _total?: number;
  _key?: string | number;
  _first?: boolean;
  _last?: boolean;
  _odd?: boolean;
  _even?: boolean;
  // Current item in loop
  item?: unknown;
}

/**
 * Update check result
 */
export interface UpdateCheckResult {
  hasUpdates: boolean;
  currentVersion: string;
  latestVersion: string;
  templateId?: string;
  hasUpdate?: boolean; // Alias for hasUpdates for backward compatibility
  updates: Array<{
    templateId: string;
    currentVersion: string;
    latestVersion: string;
    template: MarketplaceTemplate;
  }>;
}

/**
 * Update result
 */
export interface UpdateResult {
  success: boolean;
  templateId?: string;
  updated: Array<{
    templateId: string;
    oldVersion: string;
    newVersion: string;
  }>;
  failed: Array<{
    templateId: string;
    error: string;
  }>;
}

/**
 * Rating result
 */
export interface RatingResult {
  success: boolean;
  rating: number;
  comment?: string;
  templateId: string;
  userId: string;
}

/**
 * User preferences for marketplace
 */
export interface UserPreferences {
  autoUpdate: boolean;
  checkInterval: number;
  includePrerelease: boolean;
  trustedAuthors: string[];
  blockedAuthors: string[];
  preferredCategories: string[];
  installPath?: string;
  notifications: {
    newVersions: boolean;
    newFromAuthors: boolean;
    featuredTemplates: boolean;
    securityUpdates: boolean;
    weeklyDigest: boolean;
  };
}

/**
 * Installation manifest
 */
export interface InstallationManifest {
  templates: Array<{
    templateId: string;
    version: string;
    installPath: string;
    installed: Date;
    lastUsed?: Date;
    autoUpdate: boolean;
    customizations?: Record<string, unknown>;
  }>;
  lastSync: Date;
  marketplaceUrl: string;
  preferences: UserPreferences;
}

/**
 * Marketplace install command options
 */
export interface MarketplaceInstallOptions extends MarketplaceCommandOptions {
  skipDeps?: boolean;
  autoUpdate?: boolean;
}

/**
 * Marketplace list command options
 */
export interface MarketplaceListOptions extends MarketplaceCommandOptions {
  checkUpdates?: boolean;
  outdated?: boolean;
}

/**
 * Marketplace update command options
 */
export interface MarketplaceUpdateOptions extends MarketplaceCommandOptions {
  checkOnly?: boolean;
  major?: boolean;
  includePrerelease?: boolean;
}

/**
 * Marketplace info command options
 */
export interface MarketplaceInfoOptions extends MarketplaceCommandOptions {
  dependencies?: boolean;
  examples?: boolean;
  versions?: boolean;
}

/**
 * Marketplace rate command options
 */
export interface MarketplaceRateOptions extends MarketplaceCommandOptions {
  showReviews?: boolean;
  delete?: boolean;
  title?: string;
}

/**
 * Template definition with all properties
 */
export interface Template {
  id?: string;
  name: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
  content?: string;
  basePath?: string;
  variables?: Record<string, unknown>;
  commands?: Record<string, string> | TemplateCommand[];
  requirements?: string[];
  examples?: string[];
  reasoning?: string;
  filePatterns?: string[];
  contextFiles?: string[];
  references?: string[];
  priority?: 'low' | 'medium' | 'high';
  alwaysApply?: boolean;
  category?: string;
  language?: string;
  domain?: string;
  useCase?: string;
  path?: string;
  files?:
    | Array<{
        source: string;
        destination: string;
        transform?: boolean;
        condition?: string;
      }>
    | TemplateFile[];
  metadata?: {
    author?: string;
    tags?: string[];
    created?: string;
    updated?: string;
    category?: string;
    [key: string]: any;
  };
  // Optimization tracking fields
  isOptimized?: boolean;
  optimizationLevel?: 'none' | 'basic' | 'advanced' | 'aggressive';
  originalTemplateId?: string;
  // A/B testing support
  abTestVariants?: Array<{
    name: string;
    version: string;
    content: string;
    files?: TemplateFile[];
    weight?: number;
  }>;
  activeVariant?: string;
  // Version comparison
  parentVersions?: Array<{
    version: string;
    templateId: string;
    optimizationId?: string;
    relationship: 'original' | 'optimized' | 'variant';
  }>;
}

/**
 * Rule frontmatter for MDC format
 */
export interface RuleFrontmatter {
  description: string;
  globs?: string[];
  alwaysApply?: boolean;
  tags?: string[];
  author?: string;
  version?: string;
  generated?: string;
}

/**
 * Cursor Rule definition for .cursor/rules/*.mdc format
 */
export interface CursorRule {
  name: string;
  filename: string;
  frontmatter: RuleFrontmatter;
  content: string;
  references?: string[];
}

/**
 * Plugin API interface
 */
export interface PluginAPI {
  getVersion: () => string;
  getConfig: (key?: string) => unknown;
  setConfig: (key: string, value: unknown) => void;
  registerCommand: (name: string, handler: unknown) => void;
  getCommand: (name: string) => unknown;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  emit: (event: string, data: unknown) => void;
  storage: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  fs: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
    glob: (pattern: string) => Promise<string[]>;
  };
  exec: (command: string) => Promise<{ stdout: string; stderr: string }>;
  log: (level: string, message: string, ...args: unknown[]) => void;
  sendMessage: (plugin: string, data: unknown) => void;
  onMessage: (callback: (message: unknown) => void) => void;
  // eslint-disable-next-line no-use-before-define
  getPlugin: (name: string) => IPlugin | null;
}

/**
 * Plugin system interfaces
 */
export interface IPlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  permissions?: string[];
  priority?: number;
  defaultConfig?: Record<string, unknown>;
  configSchema?: Record<string, unknown>;
  init: (api: PluginAPI, config?: unknown) => Promise<boolean> | boolean;
  activate?: () => Promise<void> | void;
  deactivate?: () => Promise<void> | void;
  dispose?: () => Promise<void> | void;
  execute?: (args: unknown) => Promise<unknown> | unknown;
  hooks?: Record<string, (context: unknown) => Promise<unknown> | unknown>;
}

/**
 * Plugin metadata
 */
export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  dependencies?: string[];
}

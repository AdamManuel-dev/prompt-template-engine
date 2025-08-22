/**
 * @fileoverview Template marketplace model definitions
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Template metadata, ratings, versions, marketplace data
 * Main APIs: TemplateModel, TemplateVersion, TemplateRating interfaces
 * Constraints: Version management, rating validation, metadata schema
 * Patterns: Model definitions, data validation, versioning
 */

export interface TemplateModel {
  id: string;
  name: string;
  displayName: string;
  description: string;
  longDescription?: string;
  category: TemplateCategory;
  tags: string[];
  author: AuthorInfo;
  versions: TemplateVersion[];
  currentVersion: string;
  rating: TemplateRating;
  stats: TemplateStats;
  metadata: TemplateMetadata;
  created: Date;
  updated: Date;
  featured: boolean;
  verified: boolean;
  deprecated: boolean;
}

export interface TemplateVersion {
  version: string;
  description: string;
  content: string;
  dependencies: TemplateDependency[];
  variables: TemplateVariable[];
  examples: TemplateExample[];
  changelog?: string;
  compatibility: string[];
  size: number;
  created: Date;
  downloads: number;
  deprecated: boolean;
}

export interface AuthorInfo {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  website?: string;
  github?: string;
  verified: boolean;
  reputation: number;
  totalTemplates: number;
  totalDownloads: number;
}

export interface TemplateRating {
  average: number;
  total: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  reviews: TemplateReview[];
}

export interface TemplateReview {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  title?: string;
  comment?: string;
  version: string;
  helpful: number;
  flagged: boolean;
  created: Date;
  updated?: Date;
}

export interface TemplateStats {
  downloads: number;
  weeklyDownloads: number;
  monthlyDownloads: number;
  forks: number;
  favorites: number;
  issues: number;
  lastDownload: Date;
  trending: boolean;
  popularityScore: number;
}

export interface TemplateMetadata {
  readme?: string;
  license: string;
  keywords: string[];
  framework?: string;
  language?: string;
  minEngineVersion: string;
  maxEngineVersion?: string;
  platform: string[];
  screenshots?: string[];
  documentation?: string;
  repository?: RepositoryInfo;
}

export interface RepositoryInfo {
  type: 'git' | 'github' | 'gitlab' | 'bitbucket';
  url: string;
  branch?: string;
  directory?: string;
}

export interface TemplateDependency {
  name: string;
  version: string;
  type: 'plugin' | 'template' | 'engine';
  optional: boolean;
  description?: string;
}

export interface TemplateVariable {
  name: string;
  type: VariableType;
  description: string;
  required: boolean;
  defaultValue?: string;
  validation?: VariableValidation;
  examples?: string[];
}

export interface TemplateExample {
  name: string;
  description: string;
  variables: Record<string, string>;
  expectedOutput?: string;
}

export interface VariableValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  allowedValues?: string[];
  format?: 'email' | 'url' | 'date' | 'uuid';
}

export type TemplateCategory =
  | 'development'
  | 'documentation'
  | 'git'
  | 'testing'
  | 'deployment'
  | 'productivity'
  | 'education'
  | 'other';

export type VariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'date'
  | 'file'
  | 'choice';

// Search and filter interfaces
export interface TemplateSearchQuery {
  query?: string;
  category?: TemplateCategory;
  tags?: string[];
  author?: string;
  minRating?: number;
  sortBy?: TemplateSortOption;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  featured?: boolean;
  verified?: boolean;
  trending?: boolean;
}

export interface TemplateSearchResult {
  templates: TemplateModel[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  facets: SearchFacets;
}

export interface SearchFacets {
  categories: Array<{ category: TemplateCategory; count: number }>;
  tags: Array<{ tag: string; count: number }>;
  authors: Array<{ author: string; count: number }>;
  ratings: Array<{ rating: number; count: number }>;
}

export type TemplateSortOption =
  | 'relevance'
  | 'downloads'
  | 'rating'
  | 'created'
  | 'updated'
  | 'name'
  | 'popularity';

// Installation and management interfaces
export interface TemplateInstallation {
  templateId: string;
  version: string;
  installPath: string;
  installed: Date;
  lastUsed?: Date;
  autoUpdate: boolean;
  customizations?: Record<string, unknown>;
}

export interface TemplateManifest {
  templates: TemplateInstallation[];
  lastSync: Date;
  marketplaceUrl: string;
  preferences: MarketplacePreferences;
}

export interface MarketplacePreferences {
  autoUpdate: boolean;
  checkInterval: number;
  includePrerelease: boolean;
  trustedAuthors: string[];
  blockedAuthors: string[];
  preferredCategories: TemplateCategory[];
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  newVersions: boolean;
  newFromAuthors: boolean;
  featuredTemplates: boolean;
  securityUpdates: boolean;
  weeklyDigest: boolean;
}

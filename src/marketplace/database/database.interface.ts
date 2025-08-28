/**
 * @fileoverview Database interface for marketplace data persistence
 * @lastmodified 2025-08-23T05:30:00Z
 *
 * Features: Abstract database operations for marketplace data
 * Main APIs: Database operations for templates, authors, ratings
 * Constraints: Support multiple database backends (file, SQLite, PostgreSQL)
 * Patterns: Repository pattern, async operations, transaction support
 */

import { MarketplaceAuthor } from '../../types';
import {
  TemplateModel,
  TemplateReview,
  TemplateManifest,
  TemplateSearchQuery,
} from '../models/template.model';

// Re-export commonly used types for convenience
export {
  TemplateModel,
  TemplateSearchQuery,
  TemplateReview,
  MarketplaceAuthor,
};

// Type aliases for backwards compatibility
export type AuthorModel = MarketplaceAuthor;
export type ReviewModel = TemplateReview;

/**
 * Database query filters
 */
export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'nin';
  value: any;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  sort?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
}

export interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}

/**
 * Template repository interface
 */
export interface ITemplateRepository {
  // Template CRUD operations
  create(template: TemplateModel): Promise<TemplateModel>;
  findById(id: string): Promise<TemplateModel | null>;
  findMany(options?: QueryOptions): Promise<TemplateModel[]>;
  update(id: string, template: Partial<TemplateModel>): Promise<TemplateModel>;
  delete(id: string): Promise<void>;

  // Template-specific operations
  search(query: string, options?: QueryOptions): Promise<TemplateModel[]>;
  findByAuthor(
    authorId: string,
    options?: QueryOptions
  ): Promise<TemplateModel[]>;
  findByCategory(
    category: string,
    options?: QueryOptions
  ): Promise<TemplateModel[]>;
  findByTags(tags: string[], options?: QueryOptions): Promise<TemplateModel[]>;
  getPopular(limit?: number): Promise<TemplateModel[]>;
  getTrending(limit?: number): Promise<TemplateModel[]>;
  getRecent(limit?: number): Promise<TemplateModel[]>;

  // Version management
  createVersion(templateId: string, version: any): Promise<void>;
  getVersions(templateId: string): Promise<any[]>;
  getLatestVersion(templateId: string): Promise<any | null>;
}

/**
 * Author repository interface
 */
export interface IAuthorRepository {
  create(author: MarketplaceAuthor): Promise<MarketplaceAuthor>;
  findById(id: string): Promise<MarketplaceAuthor | null>;
  findByEmail(email: string): Promise<MarketplaceAuthor | null>;
  findMany(options?: QueryOptions): Promise<MarketplaceAuthor[]>;
  update(
    id: string,
    author: Partial<MarketplaceAuthor>
  ): Promise<MarketplaceAuthor>;
  delete(id: string): Promise<void>;

  // Author statistics
  getTemplateCount(authorId: string): Promise<number>;
  getDownloadCount(authorId: string): Promise<number>;
  getRating(authorId: string): Promise<number>;
}

/**
 * Review repository interface
 */
export interface IReviewRepository {
  create(review: TemplateReview): Promise<TemplateReview>;
  findById(id: string): Promise<TemplateReview | null>;
  findByTemplate(
    templateId: string,
    options?: QueryOptions
  ): Promise<TemplateReview[]>;
  findByAuthor(
    authorId: string,
    options?: QueryOptions
  ): Promise<TemplateReview[]>;
  update(id: string, review: Partial<TemplateReview>): Promise<TemplateReview>;
  delete(id: string): Promise<void>;

  // Review statistics
  getAverageRating(templateId: string): Promise<number>;
  getRatingDistribution(templateId: string): Promise<Record<number, number>>;
  getReviewCount(templateId: string): Promise<number>;
}

/**
 * Installation repository interface
 */
export interface IInstallationRepository {
  create(installation: any): Promise<any>;
  findById(id: string): Promise<any | null>;
  findByUser(userId: string, options?: QueryOptions): Promise<any[]>;
  findByTemplate(templateId: string, options?: QueryOptions): Promise<any[]>;
  update(id: string, installation: Partial<any>): Promise<any>;
  delete(id: string): Promise<void>;

  // Installation statistics
  getInstallCount(templateId: string): Promise<number>;
  getInstallHistory(
    templateId: string,
    days?: number
  ): Promise<Array<{ date: Date; count: number }>>;
}

/**
 * Main database interface
 */
export interface IMarketplaceDatabase extends DatabaseConnection {
  // Repository access
  templates: ITemplateRepository;
  authors: IAuthorRepository;
  reviews: IReviewRepository;
  installations: IInstallationRepository;

  // Transaction support
  transaction<T>(fn: (db: IMarketplaceDatabase) => Promise<T>): Promise<T>;

  // Cache operations
  clearCache(): Promise<void>;

  // Manifest operations (for backward compatibility)
  getManifest(): Promise<TemplateManifest | null>;
  saveManifest(manifest: TemplateManifest): Promise<void>;

  // Database operations
  migrate(): Promise<void>;
  backup(): Promise<string>;
  restore(backupPath: string): Promise<void>;
  getStats(): Promise<{
    templateCount: number;
    authorCount: number;
    reviewCount: number;
    installationCount: number;
  }>;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  type: 'file' | 'sqlite' | 'postgresql' | 'mysql';
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;

  // File-based options
  dataDir?: string;

  // Performance options
  maxConnections?: number;
  connectionTimeout?: number;
  queryTimeout?: number;

  // Cache options
  enableCache?: boolean;
  cacheSize?: number;
  cacheTtl?: number;
}

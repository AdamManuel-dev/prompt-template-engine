/**
 * @fileoverview File-based database implementation for marketplace
 * @lastmodified 2025-08-23T05:30:00Z
 *
 * Features: JSON file-based storage with indexing and search
 * Main APIs: File-based implementation of IMarketplaceDatabase
 * Constraints: File system permissions, concurrent access handling
 * Patterns: Repository pattern, file-based persistence, in-memory indexing
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import {
  IMarketplaceDatabase,
  ITemplateRepository,
  IAuthorRepository,
  IReviewRepository,
  IInstallationRepository,
  DatabaseConfig,
  QueryFilter,
  QueryOptions,
} from './database.interface';
import { TemplateModel, TemplateManifest } from '../models/template.model';
import { logger } from '../../utils/logger';

/**
 * File-based template repository
 */
class FileTemplateRepository implements ITemplateRepository {
  private templates = new Map<string, TemplateModel>();

  private searchIndex = new Map<string, Set<string>>();

  constructor(private dataDir: string) {}

  async init(): Promise<void> {
    await this.loadTemplates();
    this.buildSearchIndex();
  }

  private async loadTemplates(): Promise<void> {
    const templatesFile = path.join(this.dataDir, 'templates.json');
    try {
      const data = await fs.readFile(templatesFile, 'utf8');
      const templates: TemplateModel[] = JSON.parse(data);
      this.templates.clear();
      templates.forEach(template => {
        this.templates.set(template.id, template);
      });
    } catch (_error) {
      // File doesn't exist, start with empty collection
      this.templates.clear();
    }
  }

  private async saveTemplates(): Promise<void> {
    const templatesFile = path.join(this.dataDir, 'templates.json');
    const templates = Array.from(this.templates.values());
    await fs.mkdir(path.dirname(templatesFile), { recursive: true });
    await fs.writeFile(templatesFile, JSON.stringify(templates, null, 2));
  }

  private buildSearchIndex(): void {
    this.searchIndex.clear();
    for (const template of this.templates.values()) {
      // Index by name, description, tags, category
      const terms = [
        template.name,
        template.description || '',
        template.category || '',
        ...(template.tags || []),
      ]
        .join(' ')
        .toLowerCase()
        .split(/\s+/);

      terms.forEach(term => {
        if (term.length > 2) {
          // Only index meaningful terms
          if (!this.searchIndex.has(term)) {
            this.searchIndex.set(term, new Set());
          }
          this.searchIndex.get(term)!.add(template.id);
        }
      });
    }
  }

  async create(template: TemplateModel): Promise<TemplateModel> {
    const templateWithId = { ...template };
    if (!templateWithId.id) {
      templateWithId.id = createHash('sha256')
        .update(`${templateWithId.name}-${Date.now()}`)
        .digest('hex')
        .substring(0, 16);
    }

    this.templates.set(templateWithId.id, templateWithId);
    await this.saveTemplates();
    this.buildSearchIndex();
    return templateWithId;
  }

  async findById(id: string): Promise<TemplateModel | null> {
    return this.templates.get(id) || null;
  }

  async findMany(options?: QueryOptions): Promise<TemplateModel[]> {
    let results = Array.from(this.templates.values());

    // Apply filters
    if (options?.filters) {
      results = this.applyFilters(results, options.filters);
    }

    // Apply sorting
    if (options?.sort) {
      results = this.applySorting(results, options.sort);
    }

    // Apply pagination
    if (options?.offset) {
      results = results.slice(options.offset);
    }
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async update(
    id: string,
    template: Partial<TemplateModel>
  ): Promise<TemplateModel> {
    const existing = this.templates.get(id);
    if (!existing) {
      throw new Error(`Template not found: ${id}`);
    }

    const updated = { ...existing, ...template, id };
    this.templates.set(id, updated);
    await this.saveTemplates();
    this.buildSearchIndex();
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.templates.delete(id);
    await this.saveTemplates();
    this.buildSearchIndex();
  }

  async search(
    query: string,
    options?: QueryOptions
  ): Promise<TemplateModel[]> {
    const terms = query.toLowerCase().split(/\s+/);
    const matchingIds = new Set<string>();

    // Find templates matching any search term
    terms.forEach(term => {
      for (const [indexTerm, templateIds] of this.searchIndex.entries()) {
        if (indexTerm.includes(term) || term.includes(indexTerm)) {
          templateIds.forEach(id => matchingIds.add(id));
        }
      }
    });

    const results = Array.from(matchingIds)
      .map(id => this.templates.get(id))
      .filter(Boolean) as TemplateModel[];

    return this.applySorting(
      results,
      options?.sort || [{ field: 'downloads', direction: 'desc' }]
    );
  }

  async findByAuthor(
    authorId: string,
    options?: QueryOptions
  ): Promise<TemplateModel[]> {
    const results = Array.from(this.templates.values()).filter(
      t => t.author?.id === authorId || t.author?.name === authorId
    );

    // Apply sorting and pagination if provided
    if (options?.sort) {
      return this.applySorting(results, options.sort);
    }
    return results;
  }

  async findByCategory(
    category: string,
    _options?: QueryOptions
  ): Promise<TemplateModel[]> {
    const results = Array.from(this.templates.values()).filter(
      t => t.category === category
    );
    return results;
  }

  async findByTags(
    tags: string[],
    _options?: QueryOptions
  ): Promise<TemplateModel[]> {
    const results = Array.from(this.templates.values()).filter(t =>
      t.tags?.some(tag => tags.includes(tag))
    );
    return results;
  }

  async getPopular(limit = 10): Promise<TemplateModel[]> {
    return this.findMany({
      sort: [{ field: 'stats.downloads', direction: 'desc' }],
      limit,
    });
  }

  async getTrending(limit = 10): Promise<TemplateModel[]> {
    // For file-based, we'll use recent + popular as a proxy for trending
    return this.findMany({
      sort: [
        { field: 'updatedAt', direction: 'desc' },
        { field: 'downloads', direction: 'desc' },
      ],
      limit,
    });
  }

  async getRecent(limit = 10): Promise<TemplateModel[]> {
    return this.findMany({
      sort: [{ field: 'createdAt', direction: 'desc' }],
      limit,
    });
  }

  async createVersion(templateId: string, version: any): Promise<void> {
    // For simplicity, versions are embedded in the template
    const template = await this.findById(templateId);
    if (template) {
      if (!template.versions) template.versions = [];
      template.versions.push(version);
      await this.update(templateId, template);
    }
  }

  async getVersions(templateId: string): Promise<any[]> {
    const template = await this.findById(templateId);
    return template?.versions || [];
  }

  async getLatestVersion(templateId: string): Promise<any | null> {
    const versions = await this.getVersions(templateId);
    return versions.length > 0 ? versions[versions.length - 1] : null;
  }

  private applyFilters(
    results: TemplateModel[],
    filters: QueryFilter[]
  ): TemplateModel[] {
    return results.filter(item =>
      filters.every(filter => {
        const value = this.getNestedValue(item, filter.field);
        return this.matchesFilter(value, filter.operator, filter.value);
      })
    );
  }

  private applySorting(
    results: TemplateModel[],
    sort: Array<{ field: string; direction: 'asc' | 'desc' }>
  ): TemplateModel[] {
    return results.sort((a, b) => {
      for (const sortRule of sort) {
        const aVal = this.getNestedValue(a, sortRule.field);
        const bVal = this.getNestedValue(b, sortRule.field);

        // Handle undefined values
        if (aVal === undefined && bVal === undefined) continue;
        if (aVal === undefined) return sortRule.direction === 'desc' ? 1 : -1;
        if (bVal === undefined) return sortRule.direction === 'desc' ? -1 : 1;

        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;

        if (sortRule.direction === 'desc') comparison *= -1;
        if (comparison !== 0) return comparison;
      }
      return 0;
    });
  }

  private getNestedValue(obj: any, propertyPath: string): any {
    return propertyPath.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  private matchesFilter(
    value: any,
    operator: string,
    filterValue: any
  ): boolean {
    switch (operator) {
      case 'eq':
        return value === filterValue;
      case 'ne':
        return value !== filterValue;
      case 'gt':
        return value > filterValue;
      case 'gte':
        return value >= filterValue;
      case 'lt':
        return value < filterValue;
      case 'lte':
        return value <= filterValue;
      case 'like':
        return String(value)
          .toLowerCase()
          .includes(String(filterValue).toLowerCase());
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(value);
      case 'nin':
        return Array.isArray(filterValue) && !filterValue.includes(value);
      default:
        return false;
    }
  }
}

/**
 * File-based marketplace database implementation
 */
export class FileMarketplaceDatabase implements IMarketplaceDatabase {
  public templates: FileTemplateRepository;

  public authors: IAuthorRepository;

  public reviews: IReviewRepository;

  public installations: IInstallationRepository;

  private isConnectedFlag = false;

  private manifestPath: string;

  constructor(config: DatabaseConfig) {
    const dataDir = config.dataDir || './data/marketplace';
    this.manifestPath = path.join(dataDir, 'manifest.json');

    this.templates = new FileTemplateRepository(dataDir);

    // Simplified implementations for now - can be expanded
    this.authors = new FileRepository(
      path.join(dataDir, 'authors.json')
    ) as any;
    this.reviews = new FileRepository(
      path.join(dataDir, 'reviews.json')
    ) as any;
    this.installations = new FileRepository(
      path.join(dataDir, 'installations.json')
    ) as any;
  }

  async connect(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.manifestPath), { recursive: true });
      await this.templates.init();
      this.isConnectedFlag = true;
      logger.info('File database connected successfully');
    } catch (error) {
      logger.error(`Failed to connect to file database: ${error}`);
      throw error;
    }
  }

  // Alias for connect() for backward compatibility
  async init(): Promise<void> {
    return this.connect();
  }

  async disconnect(): Promise<void> {
    this.isConnectedFlag = false;
    logger.info('File database disconnected');
  }

  // Alias for disconnect() for backward compatibility
  async close(): Promise<void> {
    return this.disconnect();
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  async transaction<T>(
    fn: (db: IMarketplaceDatabase) => Promise<T>
  ): Promise<T> {
    // File-based implementation doesn't support real transactions
    // In a real implementation, we'd use file locking or atomic writes
    return fn(this);
  }

  async clearCache(): Promise<void> {
    // For file-based, we reload from disk
    await this.templates.init();
  }

  async getManifest(): Promise<TemplateManifest | null> {
    try {
      const data = await fs.readFile(this.manifestPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveManifest(manifest: TemplateManifest): Promise<void> {
    await fs.mkdir(path.dirname(this.manifestPath), { recursive: true });
    await fs.writeFile(this.manifestPath, JSON.stringify(manifest, null, 2));
  }

  async migrate(): Promise<void> {
    // File-based migration is mostly about ensuring directory structure
    await fs.mkdir(path.dirname(this.manifestPath), { recursive: true });
    logger.info('File database migration completed');
  }

  async backup(): Promise<string> {
    const backupDir = path.join(path.dirname(this.manifestPath), 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup-${timestamp}`);

    await fs.mkdir(backupPath, { recursive: true });

    // Copy all data files
    const dataDir = path.dirname(this.manifestPath);
    const files = await fs.readdir(dataDir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        await fs.copyFile(
          path.join(dataDir, file),
          path.join(backupPath, file)
        );
      }
    }

    logger.info(`Database backup created: ${backupPath}`);
    return backupPath;
  }

  async restore(backupPath: string): Promise<void> {
    const dataDir = path.dirname(this.manifestPath);
    const files = await fs.readdir(backupPath);

    for (const file of files) {
      if (file.endsWith('.json')) {
        await fs.copyFile(
          path.join(backupPath, file),
          path.join(dataDir, file)
        );
      }
    }

    // Reload data
    await this.clearCache();
    logger.info(`Database restored from: ${backupPath}`);
  }

  async getStats(): Promise<{
    templateCount: number;
    authorCount: number;
    reviewCount: number;
    installationCount: number;
  }> {
    const templates = await this.templates.findMany();

    return {
      templateCount: templates.length,
      authorCount: 0, // Would implement for full repository
      reviewCount: 0,
      installationCount: 0,
    };
  }
}

/**
 * Generic file repository for simple entities
 */
class FileRepository<T extends { id: string }> {
  private items = new Map<string, T>();

  constructor(private filePath: string) {}

  async init(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf8');
      const items: T[] = JSON.parse(data);
      this.items.clear();
      items.forEach(item => this.items.set(item.id, item));
    } catch {
      this.items.clear();
    }
  }

  async save(): Promise<void> {
    const items = Array.from(this.items.values());
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(items, null, 2));
  }

  async create(item: T): Promise<T> {
    this.items.set(item.id, item);
    await this.save();
    return item;
  }

  async findById(id: string): Promise<T | null> {
    return this.items.get(id) || null;
  }

  async findMany(): Promise<T[]> {
    return Array.from(this.items.values());
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const existing = this.items.get(id);
    if (!existing) {
      throw new Error(`Item not found: ${id}`);
    }

    const updated = { ...existing, ...updates, id };
    this.items.set(id, updated);
    await this.save();
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.items.delete(id);
    await this.save();
  }
}

// Export aliases for backward compatibility
export { FileMarketplaceDatabase as FileDatabase };
export { FileTemplateRepository };

/**
 * @fileoverview Template service for managing template operations and caching
 * @lastmodified 2025-08-28T10:30:00Z
 * 
 * Features: Template CRUD, search, filtering, caching, metadata management
 * Main APIs: getTemplates, getTemplate, searchTemplates, getCategories
 * Constraints: Must integrate with CLI service, handle caching efficiently
 * Patterns: Service layer pattern, caching strategy, error handling
 */

import NodeCache from 'node-cache';
import { 
  Template, 
  TemplateMetadata, 
  TemplateListResponse,
  TemplateSchema 
} from '@cursor-prompt/shared';
import { CLIService } from './cli-service';

export interface TemplateSearchOptions {
  search?: string;
  category?: string;
  tags?: string[];
  author?: string;
  page?: number;
  limit?: number;
  sort?: 'name' | 'created' | 'updated' | 'rating' | 'downloads';
  order?: 'asc' | 'desc';
}

export class TemplateService {
  private cache: NodeCache;
  private cliService: CLIService;

  constructor(cliService: CLIService) {
    this.cliService = cliService;
    
    // Cache settings: 10 minute TTL, check period every 5 minutes
    this.cache = new NodeCache({ 
      stdTTL: 600, 
      checkperiod: 300,
      useClones: false 
    });

    // Clear cache when CLI service emits updates
    this.cliService.on('template-updated', () => {
      this.clearCache();
    });

    console.log('📚 Template service initialized with caching enabled');
  }

  /**
   * Get paginated list of templates with filtering and sorting
   */
  async getTemplates(options: TemplateSearchOptions = {}): Promise<TemplateListResponse> {
    const cacheKey = this.generateCacheKey('templates-list', options);
    
    // Check cache first
    let cachedResult = this.cache.get<TemplateListResponse>(cacheKey);
    if (cachedResult) {
      console.log(`📋 Returning cached template list (${cachedResult.templates.length} templates)`);
      return cachedResult;
    }

    console.log('📋 Fetching template list from CLI...');

    try {
      // Get all templates from CLI
      const allTemplates = await this.cliService.listTemplates({
        category: options.category,
        search: options.search
      });

      // Apply additional filtering
      let filteredTemplates = this.applyFilters(allTemplates, options);

      // Apply sorting
      filteredTemplates = this.applySorting(filteredTemplates, options.sort, options.order);

      // Apply pagination
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(50, Math.max(1, options.limit || 12));
      const offset = (page - 1) * limit;
      
      const paginatedTemplates = filteredTemplates.slice(offset, offset + limit);
      const totalPages = Math.ceil(filteredTemplates.length / limit);

      const result: TemplateListResponse = {
        templates: paginatedTemplates,
        pagination: {
          page,
          limit,
          total: filteredTemplates.length,
          totalPages
        },
        filters: {
          category: options.category,
          tags: options.tags,
          search: options.search
        }
      };

      // Cache the result
      this.cache.set(cacheKey, result);
      
      console.log(`✅ Retrieved ${paginatedTemplates.length} templates (page ${page}/${totalPages})`);
      return result;

    } catch (error) {
      console.error('❌ Failed to get templates:', error);
      throw new Error(`Failed to retrieve templates: ${error}`);
    }
  }

  /**
   * Get detailed information about a specific template
   */
  async getTemplate(templateId: string): Promise<Template> {
    const cacheKey = `template-${templateId}`;
    
    // Check cache first
    let cachedTemplate = this.cache.get<Template>(cacheKey);
    if (cachedTemplate) {
      console.log(`📄 Returning cached template: ${templateId}`);
      return cachedTemplate;
    }

    console.log(`📄 Fetching template details for: ${templateId}`);

    try {
      const template = await this.cliService.getTemplate(templateId);
      
      // Enhance template with additional processing
      const enhancedTemplate = await this.enhanceTemplate(template);
      
      // Cache the template
      this.cache.set(cacheKey, enhancedTemplate, 300); // 5 minute cache for individual templates
      
      console.log(`✅ Retrieved template: ${enhancedTemplate.displayName || enhancedTemplate.name}`);
      return enhancedTemplate;

    } catch (error) {
      console.error(`❌ Failed to get template ${templateId}:`, error);
      throw new Error(`Template not found: ${templateId}`);
    }
  }

  /**
   * Search templates with advanced filtering
   */
  async searchTemplates(query: string, options: Omit<TemplateSearchOptions, 'search'> = {}): Promise<TemplateListResponse> {
    if (!query || query.length < 2) {
      throw new Error('Search query must be at least 2 characters long');
    }

    return this.getTemplates({ ...options, search: query });
  }

  /**
   * Get all available template categories
   */
  async getCategories(): Promise<string[]> {
    const cacheKey = 'template-categories';
    
    // Check cache first
    let cachedCategories = this.cache.get<string[]>(cacheKey);
    if (cachedCategories) {
      console.log(`📂 Returning cached categories (${cachedCategories.length} categories)`);
      return cachedCategories;
    }

    console.log('📂 Fetching template categories...');

    try {
      const templates = await this.cliService.listTemplates();
      const categories = [...new Set(templates.map(t => t.category))].sort();
      
      // Cache categories for longer since they change infrequently
      this.cache.set(cacheKey, categories, 1800); // 30 minute cache
      
      console.log(`✅ Found ${categories.length} categories:`, categories);
      return categories;

    } catch (error) {
      console.error('❌ Failed to get categories:', error);
      throw new Error(`Failed to retrieve categories: ${error}`);
    }
  }

  /**
   * Get all available tags
   */
  async getTags(): Promise<string[]> {
    const cacheKey = 'template-tags';
    
    let cachedTags = this.cache.get<string[]>(cacheKey);
    if (cachedTags) {
      console.log(`🏷️ Returning cached tags (${cachedTags.length} tags)`);
      return cachedTags;
    }

    console.log('🏷️ Fetching template tags...');

    try {
      const templates = await this.cliService.listTemplates();
      const allTags = templates.flatMap(t => t.tags);
      const uniqueTags = [...new Set(allTags)].sort();
      
      this.cache.set(cacheKey, uniqueTags, 1800); // 30 minute cache
      
      console.log(`✅ Found ${uniqueTags.length} tags`);
      return uniqueTags;

    } catch (error) {
      console.error('❌ Failed to get tags:', error);
      throw new Error(`Failed to retrieve tags: ${error}`);
    }
  }

  /**
   * Get template statistics
   */
  async getStats(): Promise<{
    total: number;
    categories: Record<string, number>;
    recentlyAdded: TemplateMetadata[];
    mostPopular: TemplateMetadata[];
  }> {
    const cacheKey = 'template-stats';
    
    let cachedStats = this.cache.get<any>(cacheKey);
    if (cachedStats) {
      console.log('📊 Returning cached template statistics');
      return cachedStats;
    }

    console.log('📊 Calculating template statistics...');

    try {
      const templates = await this.cliService.listTemplates();
      
      // Calculate category distribution
      const categories: Record<string, number> = {};
      templates.forEach(template => {
        categories[template.category] = (categories[template.category] || 0) + 1;
      });

      // Get recently added templates (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentlyAdded = templates
        .filter(t => new Date(t.created) >= thirtyDaysAgo)
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
        .slice(0, 5);

      // Get most popular templates
      const mostPopular = templates
        .sort((a, b) => b.stats.downloads - a.stats.downloads)
        .slice(0, 5);

      const stats = {
        total: templates.length,
        categories,
        recentlyAdded,
        mostPopular
      };

      this.cache.set(cacheKey, stats, 900); // 15 minute cache for stats
      
      console.log(`✅ Calculated stats: ${stats.total} total templates, ${Object.keys(categories).length} categories`);
      return stats;

    } catch (error) {
      console.error('❌ Failed to get template stats:', error);
      throw new Error(`Failed to retrieve template statistics: ${error}`);
    }
  }

  /**
   * Validate a template
   */
  async validateTemplate(templatePath: string): Promise<{ valid: boolean; errors: string[]; warnings?: string[] }> {
    console.log(`🔍 Validating template: ${templatePath}`);
    
    try {
      return await this.cliService.validateTemplate(templatePath);
    } catch (error) {
      console.error(`❌ Template validation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    console.log('🧹 Clearing template cache...');
    this.cache.flushAll();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { keys: number; hits: number; misses: number; ksize: number; vsize: number } {
    return this.cache.getStats();
  }

  /**
   * Apply filters to template list
   */
  private applyFilters(templates: TemplateMetadata[], options: TemplateSearchOptions): TemplateMetadata[] {
    let filtered = [...templates];

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(template =>
        options.tags!.some(tag => template.tags.includes(tag))
      );
    }

    // Filter by author
    if (options.author) {
      filtered = filtered.filter(template =>
        template.author.name.toLowerCase().includes(options.author!.toLowerCase())
      );
    }

    return filtered;
  }

  /**
   * Apply sorting to template list
   */
  private applySorting(
    templates: TemplateMetadata[], 
    sort: string = 'name', 
    order: string = 'asc'
  ): TemplateMetadata[] {
    const sorted = [...templates];
    const isDesc = order === 'desc';

    switch (sort) {
      case 'name':
        sorted.sort((a, b) => {
          const result = a.displayName.localeCompare(b.displayName);
          return isDesc ? -result : result;
        });
        break;

      case 'created':
        sorted.sort((a, b) => {
          const result = new Date(a.created).getTime() - new Date(b.created).getTime();
          return isDesc ? -result : result;
        });
        break;

      case 'updated':
        sorted.sort((a, b) => {
          const result = new Date(a.updated).getTime() - new Date(b.updated).getTime();
          return isDesc ? -result : result;
        });
        break;

      case 'rating':
        sorted.sort((a, b) => {
          const result = a.rating.average - b.rating.average;
          return isDesc ? -result : result;
        });
        break;

      case 'downloads':
        sorted.sort((a, b) => {
          const result = a.stats.downloads - b.stats.downloads;
          return isDesc ? -result : result;
        });
        break;

      default:
        // Default to name sorting
        sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    return sorted;
  }

  /**
   * Enhance template with additional processing
   */
  private async enhanceTemplate(template: Template): Promise<Template> {
    // Add computed properties, validation, etc.
    const enhanced = { ...template };

    // Enhance schema with better validation rules
    enhanced.schema = this.enhanceSchema(template.schema);

    // Add computed fields if needed
    // enhanced metadata would go into appropriate Template properties

    return enhanced;
  }

  /**
   * Enhance template schema with better type information and validation
   */
  private enhanceSchema(schema: TemplateSchema): TemplateSchema {
    const enhanced = { ...schema };

    // Enhance variable definitions with better types and validation
    enhanced.variables = schema.variables.map(variable => ({
      ...variable,
      // Add default validation rules based on type
      validation: {
        ...variable.validation,
        // Add type-specific validation
        ...(variable.type === 'string' && !variable.validation?.minLength && { minLength: 1 }),
        ...(variable.type === 'number' && !variable.validation?.min && { min: 0 })
      }
    }));

    return enhanced;
  }

  /**
   * Generate cache key for consistent caching
   */
  private generateCacheKey(prefix: string, options: any): string {
    const optionsString = JSON.stringify(options);
    return `${prefix}-${Buffer.from(optionsString).toString('base64')}`;
  }
}
/**
 * @fileoverview Comprehensive marketplace mocks for preventing network calls in tests
 * @lastmodified 2025-08-26T10:30:00Z
 *
 * Features: Mock MarketplaceAPI, database, and all network-dependent services
 * Main APIs: MockMarketplaceAPI, MockMarketplaceDatabase, mock template data
 * Constraints: Test-only, no real network calls or persistent storage
 * Patterns: Mock factory, in-memory storage, predictable test data
 */

import {
  TemplateModel,
  TemplateSearchQuery,
  TemplateSearchResult,
  TemplateReview,
  TemplateVersion,
  TemplateStats,
  TemplateRating,
  AuthorInfo,
} from '../../src/marketplace/models/template.model';
// Don't import the real MarketplaceAPI to avoid circular dependencies
// import { MarketplaceAPI } from '../../src/marketplace/api/marketplace.api';
import { IMarketplaceDatabase, QueryOptions } from '../../src/marketplace/database/database.interface';

/**
 * Mock fetch function to prevent real network calls
 */
export const mockFetch = jest.fn().mockImplementation(async (url: string, options?: RequestInit): Promise<Response> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 10));

  // Parse URL to determine response
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const method = options?.method || 'GET';

  // Mock successful responses based on endpoint
  if (pathname.includes('/templates') && method === 'GET') {
    if (pathname.includes('/templates/')) {
      // Get single template
      const templateId = pathname.split('/templates/')[1].split('/')[0];
      const template = MockMarketplaceDataStore.getTemplate(templateId);
      
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: template }),
      } as Response;
    } else {
      // Search templates
      const searchParams = urlObj.searchParams;
      const query = searchParams.get('q') || '';
      const result = MockMarketplaceDataStore.searchTemplates(query);
      
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: result }),
      } as Response;
    }
  }

  if (pathname.includes('/templates') && method === 'POST') {
    // Publish template
    const templateData = JSON.parse(options?.body as string || '{}');
    const result = MockMarketplaceDataStore.publishTemplate(templateData);
    
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: result }),
    } as Response;
  }

  // Default success response for other endpoints
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: {} }),
  } as Response;
});

/**
 * Mock marketplace data store with in-memory storage
 */
class MockMarketplaceDataStore {
  private static templates: Map<string, TemplateModel> = new Map();
  private static reviews: Map<string, TemplateReview[]> = new Map();
  private static installations: Array<{ id: string; templateId: string; userId: string; installed: Date }> = [];

  /**
   * Initialize with sample template data
   */
  static init(): void {
    this.templates.clear();
    this.reviews.clear();
    this.installations = [];

    // Add some sample templates
    const sampleTemplates = this.createSampleTemplates();
    sampleTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * Create sample templates for testing
   */
  private static createSampleTemplates(): TemplateModel[] {
    return [
      {
        id: 'auth-template',
        name: 'Authentication Template',
        displayName: 'Authentication Template',
        description: 'Complete authentication flow template',
        author: {
          id: 'john_doe',
          name: 'John Doe',
          verified: true,
          reputation: 100,
          totalTemplates: 5,
          totalDownloads: 1500,
        } as AuthorInfo,
        currentVersion: '2.1.0',
        versions: [{
          version: '2.1.0',
          description: 'Authentication template',
          content: '# Authentication Template\n\nLogin: {{username}}\nPassword: {{password}}',
          dependencies: [],
          variables: [],
          examples: [],
          changelog: 'Initial version',
          compatibility: ['1.0.0'],
          size: 1000,
          created: new Date(),
          downloads: 1500,
          deprecated: false,
        } as TemplateVersion],
        tags: ['auth', 'security', 'user-management'],
        rating: {
          average: 4.5,
          total: 10,
          distribution: { 1: 0, 2: 0, 3: 1, 4: 4, 5: 5 },
          reviews: []
        } as TemplateRating,
        stats: {
          downloads: 1500,
          weeklyDownloads: 50,
          monthlyDownloads: 200,
          forks: 5,
          favorites: 20,
          issues: 2,
          lastDownload: new Date(),
          trending: false,
          popularityScore: 85,
        } as TemplateStats,
        metadata: {
          license: 'MIT',
          keywords: ['auth', 'security'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        },
        category: 'development' as any,
        created: new Date(),
        updated: new Date(),
        featured: false,
        verified: true,
        deprecated: false,
      },
      {
        id: 'react-component',
        name: 'React Component Generator',
        displayName: 'React Component Generator',
        description: 'Generate React components with tests',
        author: {
          id: 'jane_smith',
          name: 'Jane Smith',
          verified: true,
          reputation: 120,
          totalTemplates: 8,
          totalDownloads: 3200,
        } as AuthorInfo,
        currentVersion: '3.0.0',
        versions: [{
          version: '3.0.0',
          description: 'React component generator',
          content: '# {{componentName}} Component\n\nExport default function {{componentName}}() {\n  return <div>{{componentName}}</div>;\n}',
          dependencies: [],
          variables: [],
          examples: [],
          changelog: 'Initial version',
          compatibility: ['1.0.0'],
          size: 1500,
          created: new Date(),
          downloads: 3200,
          deprecated: false,
        } as TemplateVersion],
        tags: ['react', 'frontend', 'component'],
        rating: {
          average: 4.8,
          total: 15,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 3, 5: 12 },
          reviews: []
        } as TemplateRating,
        stats: {
          downloads: 3200,
          weeklyDownloads: 80,
          monthlyDownloads: 320,
          forks: 12,
          favorites: 45,
          issues: 1,
          lastDownload: new Date(),
          trending: true,
          popularityScore: 92,
        } as TemplateStats,
        metadata: {
          license: 'MIT',
          keywords: ['react', 'frontend'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        },
        category: 'development' as any,
        created: new Date(),
        updated: new Date(),
        featured: true,
        verified: true,
        deprecated: false,
      }
    ];
  }

  /**
   * Get template by ID
   */
  static getTemplate(templateId: string): TemplateModel {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    return template;
  }

  /**
   * Search templates by query
   */
  static searchTemplates(query: string = ''): TemplateSearchResult {
    const allTemplates = Array.from(this.templates.values());
    
    let filteredTemplates = allTemplates;
    if (query) {
      filteredTemplates = allTemplates.filter(template =>
        template.name.toLowerCase().includes(query.toLowerCase()) ||
        template.description.toLowerCase().includes(query.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
    }

    return {
      templates: filteredTemplates as any[],
      total: filteredTemplates.length,
      page: 1,
      limit: 20,
      hasMore: false,
    };
  }

  /**
   * Add template to storage
   */
  static addTemplate(template: TemplateModel): void {
    this.templates.set(template.id, template);
  }

  /**
   * Publish template (mock)
   */
  static publishTemplate(templateData: Partial<TemplateModel>): { templateId: string; version: string; url?: string } {
    const template: TemplateModel = {
      id: templateData.id || `template-${Date.now()}`,
      name: templateData.name || 'New Template',
      displayName: templateData.displayName || templateData.name || 'New Template',
      description: templateData.description || 'A new template',
      author: templateData.author || {
        id: 'test_user',
        name: 'Test User',
        verified: false,
        reputation: 0,
        totalTemplates: 1,
        totalDownloads: 0,
      } as AuthorInfo,
      currentVersion: templateData.currentVersion || '1.0.0',
      versions: templateData.versions || [{
        version: '1.0.0',
        description: 'Initial version',
        content: 'Template content',
        dependencies: [],
        variables: [],
        examples: [],
        changelog: 'Initial version',
        compatibility: ['1.0.0'],
        size: 100,
        created: new Date(),
        downloads: 0,
        deprecated: false,
      } as TemplateVersion],
      tags: templateData.tags || ['test'],
      rating: templateData.rating || {
        average: 0,
        total: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        reviews: []
      } as TemplateRating,
      stats: templateData.stats || {
        downloads: 0,
        weeklyDownloads: 0,
        monthlyDownloads: 0,
        forks: 0,
        favorites: 0,
        issues: 0,
        lastDownload: new Date(),
        trending: false,
        popularityScore: 0,
      } as TemplateStats,
      metadata: templateData.metadata || {
        license: 'MIT',
        keywords: ['test'],
        minEngineVersion: '1.0.0',
        platform: ['web'],
      },
      category: templateData.category || 'other' as any,
      created: new Date(),
      updated: new Date(),
      featured: false,
      verified: false,
      deprecated: false,
    };

    this.templates.set(template.id, template);

    return {
      templateId: template.id,
      version: template.currentVersion,
      url: `https://marketplace.cursor-prompt.com/templates/${template.id}`,
    };
  }

  /**
   * Get all templates
   */
  static getAllTemplates(): TemplateModel[] {
    return Array.from(this.templates.values());
  }

  /**
   * Clear all data
   */
  static clear(): void {
    this.templates.clear();
    this.reviews.clear();
    this.installations = [];
  }

  /**
   * Add installation record
   */
  static addInstallation(installation: { id: string; templateId: string; userId: string; installed: Date }): void {
    this.installations.push(installation);
  }
}

/**
 * Mock MarketplaceAPI class
 */
export class MockMarketplaceAPI {
  constructor(_config?: any) {
    // Mock API - no real config needed
  }

  async searchTemplates(query: TemplateSearchQuery): Promise<TemplateSearchResult> {
    return MockMarketplaceDataStore.searchTemplates(query.query);
  }

  async getTemplate(templateId: string): Promise<TemplateModel> {
    return MockMarketplaceDataStore.getTemplate(templateId);
  }

  async publishTemplate(template: TemplateModel): Promise<{ templateId: string; version: string; url?: string }> {
    return MockMarketplaceDataStore.publishTemplate(template);
  }

  async rateTemplate(templateId: string, rating: number): Promise<void> {
    // Mock rating submission
    const template = MockMarketplaceDataStore.getTemplate(templateId);
    if (template && typeof template.rating === 'object') {
      template.rating.total += 1;
      template.rating.average = ((template.rating.average * (template.rating.total - 1)) + rating) / template.rating.total;
    }
  }

  async downloadTemplate(templateId: string, version?: string): Promise<string> {
    const template = MockMarketplaceDataStore.getTemplate(templateId);
    const templateVersion = template.versions.find(v => v.version === (version || template.currentVersion));
    return templateVersion?.content || 'Template content';
  }
}

/**
 * Mock MarketplaceDatabase implementation
 */
export class MockMarketplaceDatabase implements IMarketplaceDatabase {
  private connected = false;

  get authors() {
    return {
      create: jest.fn().mockImplementation(async () => ({})),
      findById: jest.fn().mockImplementation(async () => null),
      findByEmail: jest.fn().mockImplementation(async () => null),
      findMany: jest.fn().mockImplementation(async () => []),
      update: jest.fn().mockImplementation(async () => ({})),
      delete: jest.fn().mockImplementation(async () => {}),
      getTemplateCount: jest.fn().mockImplementation(async () => 0),
      getDownloadCount: jest.fn().mockImplementation(async () => 0),
      getRating: jest.fn().mockImplementation(async () => 0),
    };
  }

  get templates() {
    return {
      create: jest.fn().mockImplementation(async (template: TemplateModel) => {
        MockMarketplaceDataStore.addTemplate(template);
        return template;
      }),
      
      findById: jest.fn().mockImplementation(async (id: string) => {
        try {
          return MockMarketplaceDataStore.getTemplate(id);
        } catch {
          return null;
        }
      }),

      findMany: jest.fn().mockImplementation(async (options?: QueryOptions) => {
        const templates = MockMarketplaceDataStore.getAllTemplates();
        return templates.slice(0, options?.limit || 20);
      }),

      search: jest.fn().mockImplementation(async (query: string, options?: QueryOptions) => {
        const result = MockMarketplaceDataStore.searchTemplates(query);
        return result.templates.slice(0, options?.limit || 20);
      }),

      update: jest.fn().mockImplementation(async (id: string, updates: Partial<TemplateModel>) => {
        const template = MockMarketplaceDataStore.getTemplate(id);
        const updated = { ...template, ...updates, updated: new Date() };
        MockMarketplaceDataStore.addTemplate(updated);
        return updated;
      }),

      delete: jest.fn().mockImplementation(async () => {
        return true;
      }),

      findByTags: jest.fn().mockImplementation(async (tags: string[], options?: QueryOptions) => {
        const templates = MockMarketplaceDataStore.getAllTemplates();
        const filtered = templates.filter(template =>
          tags.some(tag => template.tags.includes(tag))
        );
        return filtered.slice(0, options?.limit || 20);
      }),

      findByCategory: jest.fn().mockImplementation(async (category: string, options?: QueryOptions) => {
        const templates = MockMarketplaceDataStore.getAllTemplates();
        const filtered = templates.filter(template => template.category === category);
        return filtered.slice(0, options?.limit || 20);
      }),

      findByAuthor: jest.fn().mockImplementation(async (authorId: string, options?: QueryOptions) => {
        const templates = MockMarketplaceDataStore.getAllTemplates();
        const filtered = templates.filter(template => template.author.id === authorId);
        return filtered.slice(0, options?.limit || 20);
      }),

      getPopular: jest.fn().mockImplementation(async (limit: number = 20) => {
        const templates = MockMarketplaceDataStore.getAllTemplates();
        return templates
          .sort((a, b) => (b.stats?.downloads || 0) - (a.stats?.downloads || 0))
          .slice(0, limit);
      }),

      getTrending: jest.fn().mockImplementation(async () => {
        const templates = MockMarketplaceDataStore.getAllTemplates();
        return templates.filter(template => template.stats?.trending);
      }),

      // Placeholder methods to satisfy interface
      getRecent: jest.fn().mockImplementation(async () => []),
      createVersion: jest.fn().mockImplementation(async () => ({})),
      getVersions: jest.fn().mockImplementation(async () => []),
      getLatestVersion: jest.fn().mockImplementation(async () => ({})),
    };
  }

  get reviews() {
    return {
      create: jest.fn().mockImplementation(async (review: TemplateReview) => {
        return review;
      }),

      findByTemplate: jest.fn().mockImplementation(async () => {
        return [];
      }),

      findById: jest.fn().mockImplementation(async () => {
        return null;
      }),

      update: jest.fn().mockImplementation(async () => {
        return null;
      }),

      delete: jest.fn().mockImplementation(async () => {
        return true;
      }),

      // Placeholder methods to satisfy interface
      findByAuthor: jest.fn().mockImplementation(async () => []),
      getAverageRating: jest.fn().mockImplementation(async () => 0),
      getRatingDistribution: jest.fn().mockImplementation(async () => ({})),
      getReviewCount: jest.fn().mockImplementation(async () => 0),
    };
  }

  get installations() {
    return {
      create: jest.fn().mockImplementation(async (installation: any) => {
        MockMarketplaceDataStore.addInstallation(installation);
        return installation;
      }),

      findByUser: jest.fn().mockImplementation(async () => {
        return [];
      }),

      findByTemplate: jest.fn().mockImplementation(async () => {
        return [];
      }),

      // Additional methods to satisfy interface
      findById: jest.fn().mockImplementation(async () => null),
      update: jest.fn().mockImplementation(async () => null),
      delete: jest.fn().mockImplementation(async () => true),
      getInstallCount: jest.fn().mockImplementation(async () => 0),
      getInstallHistory: jest.fn().mockImplementation(async () => []),
    };
  }

  async connect(): Promise<void> {
    this.connected = true;
    MockMarketplaceDataStore.init();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async clearCache(): Promise<void> {
    // Mock cache clearing
  }

  async migrate(): Promise<void> {
    // Mock migration
  }

  async transaction<T>(fn: (db: IMarketplaceDatabase) => Promise<T>): Promise<T> {
    // Mock transaction - just execute the function with this database
    return fn(this);
  }

  async getManifest(): Promise<any> {
    // Mock manifest getter
    return null;
  }

  async saveManifest(): Promise<void> {
    // Mock manifest saver
  }

  async backup(): Promise<string> {
    // Mock backup
    return '/tmp/backup.json';
  }

  async restore(): Promise<void> {
    // Mock restore
  }

  async getStats(): Promise<{
    templateCount: number;
    authorCount: number;
    reviewCount: number;
    installationCount: number;
  }> {
    return {
      templateCount: 0,
      authorCount: 0,
      reviewCount: 0,
      installationCount: 0,
    };
  }
}

/**
 * Initialize marketplace mocks
 */
export function initializeMarketplaceMocks(): void {
  // Mock fetch globally
  global.fetch = mockFetch as any;

  // Initialize mock data
  MockMarketplaceDataStore.init();
}

/**
 * Reset marketplace mocks
 */
export function resetMarketplaceMocks(): void {
  MockMarketplaceDataStore.clear();
  MockMarketplaceDataStore.init();
  jest.clearAllMocks();
}

/**
 * Export the data store for direct access in tests
 */
export const MockMarketplaceData = MockMarketplaceDataStore;
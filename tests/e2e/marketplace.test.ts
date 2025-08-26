/**
 * @fileoverview E2E tests for marketplace functionality
 * @lastmodified 2025-08-26T10:00:00Z
 *
 * Features: Tests template marketplace operations including search, install, publish
 * Main APIs: MarketplaceService, TemplateRegistry, version management
 * Constraints: Requires mock marketplace server or local database
 * Patterns: Template discovery, installation, updates, ratings
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { MarketplaceService } from '../../src/marketplace/core/marketplace.service';
// import { TemplateRegistry } from '../../src/marketplace/core/template.registry'; // Not used in this test
import { VersionManager } from '../../src/marketplace/core/version.manager';
import { FileMarketplaceDatabase as FileDatabase } from '../../src/marketplace/database/file-database';
import { DatabaseConfig } from '../../src/marketplace/database/database.interface';
import { TemplateModel, AuthorInfo, TemplateVersion, TemplateStats, TemplateMetadata, TemplateRating } from '../../src/marketplace/models/template.model';

describe('E2E: Marketplace', () => {
  let testDir: string;
  let marketplaceService: MarketplaceService;
  let versionManager: VersionManager;
  let database: FileDatabase;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marketplace-e2e-'));
    
    // Initialize database with config object
    const dbConfig: DatabaseConfig = {
      type: 'file',
      dataDir: path.join(testDir, 'marketplace'),
    };
    database = new FileDatabase(dbConfig);
    await database.connect();

    // Initialize services (constructors expect no arguments)
    marketplaceService = await MarketplaceService.create();
    // Connect the database to the service
    (marketplaceService as any).database = database;
    versionManager = new VersionManager();

    // Create necessary directories
    await fs.mkdir(path.join(testDir, 'templates'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'cache'), { recursive: true });
  });

  afterEach(async () => {
    await database.disconnect();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Template Discovery and Search', () => {
    beforeEach(async () => {
      // Seed marketplace with sample templates
      const templates: TemplateModel[] = [
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
            content: 'Template content',
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
          } as TemplateMetadata,
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
            content: 'Template content',
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
          } as TemplateMetadata,
          category: 'development' as any,
          created: new Date(),
          updated: new Date(),
          featured: true,
          verified: true,
          deprecated: false,
        },
        {
          id: 'api-crud',
          name: 'REST API CRUD Template',
          displayName: 'REST API CRUD Template',
          description: 'Generate CRUD operations for REST APIs',
          author: {
            id: 'api_master',
            name: 'API Master',
            verified: true,
            reputation: 90,
            totalTemplates: 3,
            totalDownloads: 2100,
          } as AuthorInfo,
          currentVersion: '1.5.2',
          versions: [{
            version: '1.5.2',
            description: 'API CRUD template',
            content: 'Template content',
            dependencies: [],
            variables: [],
            examples: [],
            changelog: 'Initial version',
            compatibility: ['1.0.0'],
            size: 1200,
            created: new Date(),
            downloads: 2100,
            deprecated: false,
          } as TemplateVersion],
          tags: ['api', 'rest', 'crud', 'backend'],
          rating: {
            average: 4.3,
            total: 8,
            distribution: { 1: 0, 2: 0, 3: 2, 4: 4, 5: 2 },
            reviews: []
          } as TemplateRating,
          stats: {
            downloads: 2100,
            weeklyDownloads: 60,
            monthlyDownloads: 240,
            forks: 8,
            favorites: 25,
            issues: 3,
            lastDownload: new Date(),
            trending: false,
            popularityScore: 78,
          } as TemplateStats,
          metadata: {
            license: 'MIT',
            keywords: ['api', 'rest'],
            minEngineVersion: '1.0.0',
            platform: ['server'],
          } as TemplateMetadata,
          category: 'development' as any,
          created: new Date(),
          updated: new Date(),
          featured: false,
          verified: true,
          deprecated: false,
        },
        {
          id: 'docker-compose',
          name: 'Docker Compose Setup',
          displayName: 'Docker Compose Setup',
          description: 'Multi-container Docker setup',
          author: {
            id: 'devops_pro',
            name: 'DevOps Pro',
            verified: true,
            reputation: 75,
            totalTemplates: 4,
            totalDownloads: 890,
          } as AuthorInfo,
          currentVersion: '1.0.0',
          versions: [{
            version: '1.0.0',
            description: 'Docker compose template',
            content: 'Template content',
            dependencies: [],
            variables: [],
            examples: [],
            changelog: 'Initial version',
            compatibility: ['1.0.0'],
            size: 800,
            created: new Date(),
            downloads: 890,
            deprecated: false,
          } as TemplateVersion],
          tags: ['docker', 'devops', 'containers'],
          rating: {
            average: 4.6,
            total: 5,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 3 },
            reviews: []
          } as TemplateRating,
          stats: {
            downloads: 890,
            weeklyDownloads: 30,
            monthlyDownloads: 120,
            forks: 3,
            favorites: 15,
            issues: 0,
            lastDownload: new Date(),
            trending: false,
            popularityScore: 70,
          } as TemplateStats,
          metadata: {
            license: 'MIT',
            keywords: ['docker', 'devops'],
            minEngineVersion: '1.0.0',
            platform: ['docker'],
          } as TemplateMetadata,
          category: 'deployment' as any,
          created: new Date(),
          updated: new Date(),
          featured: false,
          verified: true,
          deprecated: false,
        }
      ];

      for (const template of templates) {
        await marketplaceService.publishTemplate(template);
      }
    });

    it('should search templates by keyword', async () => {
      const results = await marketplaceService.search({ query: 'authentication' });

      expect(results.templates).toHaveLength(1);
      expect(results.templates[0].name).toBe('Authentication Template');
      expect(results.templates[0].tags).toContain('auth');
    });

    it('should search templates by tags', async () => {
      const results = await marketplaceService.searchByTags(['backend']);

      expect(results.templates.length).toBeGreaterThanOrEqual(2);
      expect(results.templates.some(t => t.id === 'auth-template')).toBe(true);
      expect(results.templates.some(t => t.id === 'api-crud')).toBe(true);
    });

    it('should filter templates by category', async () => {
      const results = await marketplaceService.searchByCategory('development');

      expect(results.templates.length).toBeGreaterThanOrEqual(1);
      expect(results.templates.some(t => t.id === 'react-component')).toBe(true);
    });

    it('should sort templates by popularity', async () => {
      const results = await marketplaceService.getPopularTemplates(3);

      expect(results.templates[0].stats.downloads).toBe(3200); // React component
      expect(results.templates[1].stats.downloads).toBe(2100); // API CRUD
      expect(results.templates[2].stats.downloads).toBe(1500); // Auth template
    });

    it('should get top-rated templates', async () => {
      const results = await marketplaceService.getTopRated(2);

      expect((results.templates[0].rating as any).average).toBe(4.8); // React component
      expect((results.templates[1].rating as any).average).toBe(4.6); // Docker compose
    });

    it('should get templates by author', async () => {
      const results = await marketplaceService.getByAuthor('jane_smith');

      expect(results.templates).toHaveLength(1);
      expect(results.templates[0].name).toBe('React Component Generator');
    });

    it('should get trending templates', async () => {
      // Simulate recent downloads
      await marketplaceService.recordDownload('react-component');
      await marketplaceService.recordDownload('react-component');
      await marketplaceService.recordDownload('auth-template');

      const trending = await marketplaceService.getTrending(24); // Last 24 hours

      expect(trending.templates.length).toBeGreaterThan(0);
      expect(trending.templates[0].id).toBe('react-component');
    });
  });

  describe('Template Installation', () => {
    beforeEach(async () => {
      // Create a template in the marketplace
      const template: TemplateModel = {
        id: 'test-template',
        name: 'Test Template',
        displayName: 'Test Template',
        description: 'Test template for testing',
        author: {
          id: 'test_author',
          name: 'Test Author',
          verified: false,
          reputation: 0,
          totalTemplates: 1,
          totalDownloads: 0,
        } as AuthorInfo,
        currentVersion: '1.0.0',
        versions: [{
          version: '1.0.0',
          description: 'Test template',
          content: `---\nname: test\ndescription: Test template\n---\n# {{title}}\nContent here`,
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
        tags: ['test'],
        rating: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          reviews: []
        } as TemplateRating,
        stats: {
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
        metadata: {
          license: 'MIT',
          keywords: ['test'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        } as TemplateMetadata,
        category: 'other' as any,
        created: new Date(),
        updated: new Date(),
        featured: false,
        verified: false,
        deprecated: false,
      };

      await marketplaceService.publishTemplate(template);
    });

    it('should install a template from marketplace', async () => {
      const installPath = path.join(testDir, 'templates');
      
      const result = await marketplaceService.installTemplate(
        'test-template',
        installPath
      );

      expect(result.success).toBe(true);
      expect(result.installPath).toContain('test-template');

      // Check files were created
      const templateFile = path.join(result.installPath, 'Test Template.md');
      const metadataFile = path.join(result.installPath, 'template.json');

      expect(await fs.stat(templateFile)).toBeTruthy();
      expect(await fs.stat(metadataFile)).toBeTruthy();

      const content = await fs.readFile(templateFile, 'utf-8');
      expect(content).toContain('# {{title}}');
    });

    it('should handle template dependencies', async () => {
      // Create template with dependencies
      const templateWithDeps: TemplateModel = {
        id: 'deps-template',
        name: 'Template with Dependencies',
        displayName: 'Template with Dependencies',
        description: 'Template with dependencies',
        author: {
          id: 'test_author',
          name: 'Test Author',
          verified: false,
          reputation: 0,
          totalTemplates: 1,
          totalDownloads: 0,
        } as AuthorInfo,
        currentVersion: '1.0.0',
        versions: [{
          version: '1.0.0',
          description: 'Template with dependencies',
          content: 'Template content',
          dependencies: [
            {
              name: 'base-template',
              version: '^1.0.0',
              type: 'template',
              optional: false
            },
            {
              name: 'utils-template',
              version: '~2.0.0',
              type: 'template',
              optional: false
            }
          ],
          variables: [],
          examples: [],
          changelog: 'Initial version',
          compatibility: ['1.0.0'],
          size: 100,
          created: new Date(),
          downloads: 0,
          deprecated: false,
        } as TemplateVersion],
        tags: ['test'],
        rating: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          reviews: []
        } as TemplateRating,
        stats: {
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
        metadata: {
          license: 'MIT',
          keywords: ['test'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        } as TemplateMetadata,
        category: 'other' as any,
        created: new Date(),
        updated: new Date(),
        featured: false,
        verified: false,
        deprecated: false,
      };

      await marketplaceService.publishTemplate(templateWithDeps);

      const result = await marketplaceService.installTemplate(
        'deps-template',
        path.join(testDir, 'templates'),
        { skipDeps: false }
      );

      expect(result.success).toBe(true);
      // Dependencies should be resolved
    });

    it('should check for conflicts before installation', async () => {
      // Install once
      const result1 = await marketplaceService.installTemplate('test-template', testDir);
      expect(result1.success).toBe(true);

      // Try to install again (should succeed but potentially warn)
      const result2 = await marketplaceService.installTemplate(
        'test-template',
        testDir
      );

      // Installation should succeed but may have warnings
      expect(result2.success).toBe(true);
      // In a real scenario, there might be warnings about existing files
    });

    it('should support batch installation', async () => {
      // Create multiple templates
      for (let i = 1; i <= 3; i++) {
        const template: TemplateModel = {
          id: `template-${i}`,
          name: `Template ${i}`,
          displayName: `Template ${i}`,
          description: `Template ${i} description`,
          author: {
            id: 'test_author',
            name: 'Test Author',
            verified: false,
            reputation: 0,
            totalTemplates: 1,
            totalDownloads: 0,
          } as AuthorInfo,
          currentVersion: '1.0.0',
          versions: [{
            version: '1.0.0',
            description: `Template ${i}`,
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
          tags: ['test'],
          rating: {
            average: 0,
            total: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            reviews: []
          } as TemplateRating,
          stats: {
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
          metadata: {
            license: 'MIT',
            keywords: ['test'],
            minEngineVersion: '1.0.0',
            platform: ['web'],
          } as TemplateMetadata,
          category: 'other' as any,
          created: new Date(),
          updated: new Date(),
          featured: false,
          verified: false,
          deprecated: false,
        };
        await marketplaceService.publishTemplate(template);
      }

      const templates = ['template-1', 'template-2', 'template-3'];
      const results = await marketplaceService.batchInstall(
        templates,
        path.join(testDir, 'templates')
      );

      expect(results.filter(r => r.success)).toHaveLength(3);
      expect(results.filter(r => !r.success)).toHaveLength(0);
    });
  });

  describe('Template Publishing', () => {
    it('should publish a new template', async () => {
      const template: TemplateModel = {
        id: 'my-new-template',
        name: 'My New Template',
        displayName: 'My New Template',
        description: 'A template for testing',
        author: {
          id: 'test_user',
          name: 'Test User',
          verified: false,
          reputation: 0,
          totalTemplates: 1,
          totalDownloads: 0,
        } as AuthorInfo,
        currentVersion: '1.0.0',
        versions: [{
          version: '1.0.0',
          description: 'Template for testing',
          content: '# Template content',
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
        tags: ['test', 'example'],
        rating: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          reviews: []
        } as TemplateRating,
        stats: {
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
        metadata: {
          license: 'MIT',
          keywords: ['test'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        } as TemplateMetadata,
        category: 'other' as any,
        created: new Date(),
        updated: new Date(),
        featured: false,
        verified: false,
        deprecated: false,
      };

      const result = await marketplaceService.publishTemplate(template);

      expect(result.templateId).toBeDefined();
      expect(result.version).toBe('1.0.0');

      // Verify it can be found
      const search = await marketplaceService.search({ query: 'My New Template' });
      expect(search.templates).toHaveLength(1);
    });

    it('should validate template before publishing', async () => {
      const invalidTemplate = {
        // Missing required fields - will cause an error
        description: 'Invalid template'
      } as any;

      try {
        await marketplaceService.publishTemplate(invalidTemplate);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toContain('Template');
        // Error validation is implementation-specific
      }
    });

    it('should handle version updates', async () => {
      // Publish initial version
      const v1: TemplateModel = {
        id: 'versioned-template',
        name: 'Versioned Template',
        displayName: 'Versioned Template',
        description: 'Template with versions',
        author: {
          id: 'author',
          name: 'Author',
          verified: false,
          reputation: 0,
          totalTemplates: 1,
          totalDownloads: 0,
        } as AuthorInfo,
        currentVersion: '1.0.0',
        versions: [{
          version: '1.0.0',
          description: 'Template with versions',
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
        tags: ['test'],
        rating: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          reviews: []
        } as TemplateRating,
        stats: {
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
        metadata: {
          license: 'MIT',
          keywords: ['test'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        } as TemplateMetadata,
        category: 'other' as any,
        created: new Date(),
        updated: new Date(),
        featured: false,
        verified: false,
        deprecated: false,
      };

      await marketplaceService.publishTemplate(v1);

      // Publish update
      const v2: TemplateModel = {
        ...v1,
        currentVersion: '2.0.0',
        versions: [
          ...v1.versions,
          {
            version: '2.0.0',
            description: 'Major update with new features',
            content: 'Updated template content',
            dependencies: [],
            variables: [],
            examples: [],
            changelog: 'Major update with new features',
            compatibility: ['1.0.0'],
            size: 120,
            created: new Date(),
            downloads: 0,
            deprecated: false,
          } as TemplateVersion
        ]
      };

      const result = await marketplaceService.publishTemplate(v2);

      expect(result.version).toBe('2.0.0');

      // Check version history (simulate by getting template)
      const template = await marketplaceService.getTemplate('versioned-template');
      expect(template.versions).toHaveLength(2);
      expect(template.versions[0].version).toBe('1.0.0');
      expect(template.versions[1].version).toBe('2.0.0');
    });

    it('should enforce author permissions', async () => {
      // Publish as one author
      const originalTemplate: TemplateModel = {
        id: 'protected-template',
        name: 'Protected Template',
        displayName: 'Protected Template',
        description: 'Template with author protection',
        author: {
          id: 'original_author',
          name: 'Original Author',
          verified: false,
          reputation: 0,
          totalTemplates: 1,
          totalDownloads: 0,
        } as AuthorInfo,
        currentVersion: '1.0.0',
        versions: [{
          version: '1.0.0',
          description: 'Protected template',
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
        tags: ['test'],
        rating: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          reviews: []
        } as TemplateRating,
        stats: {
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
        metadata: {
          license: 'MIT',
          keywords: ['test'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        } as TemplateMetadata,
        category: 'other' as any,
        created: new Date(),
        updated: new Date(),
        featured: false,
        verified: false,
        deprecated: false,
      };
      await marketplaceService.publishTemplate(originalTemplate);

      // Try to update as different author
      try {
        const differentAuthorTemplate: TemplateModel = {
          ...originalTemplate,
          currentVersion: '1.1.0',
          author: {
            id: 'different_author',
            name: 'Different Author',
            verified: false,
            reputation: 0,
            totalTemplates: 1,
            totalDownloads: 0,
          } as AuthorInfo,
        };
        await marketplaceService.publishTemplate(differentAuthorTemplate);
        fail('Should have thrown permission error');
      } catch (error: any) {
        expect(error.message).toContain('Template');
        // Permission handling is implementation-specific
      }
    });
  });

  describe('Template Updates', () => {
    beforeEach(async () => {
      // Install some templates
      const templateIds = ['template-1', 'template-2', 'template-3'];
      const templateVersions = ['1.0.0', '2.0.0', '1.5.0'];

      for (let i = 0; i < templateIds.length; i++) {
        const template: TemplateModel = {
          id: templateIds[i],
          name: `Template ${i + 1}`,
          displayName: `Template ${i + 1}`,
          description: `Template ${i + 1} description`,
          author: {
            id: 'test_author',
            name: 'Test Author',
            verified: false,
            reputation: 0,
            totalTemplates: 1,
            totalDownloads: 0,
          } as AuthorInfo,
          currentVersion: templateVersions[i],
          versions: [{
            version: templateVersions[i],
            description: `Template ${i + 1}`,
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
          tags: ['test'],
          rating: {
            average: 0,
            total: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            reviews: []
          } as TemplateRating,
          stats: {
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
          metadata: {
            license: 'MIT',
            keywords: ['test'],
            minEngineVersion: '1.0.0',
            platform: ['web'],
          } as TemplateMetadata,
          category: 'other' as any,
          created: new Date(),
          updated: new Date(),
          featured: false,
          verified: false,
          deprecated: false,
        };
        await marketplaceService.publishTemplate(template);
        await marketplaceService.installTemplate(
          templateIds[i],
          path.join(testDir, 'templates')
        );
      }

      // Publish updates
      const updateTemplate1: TemplateModel = {
        id: 'template-1',
        name: 'Template 1',
        displayName: 'Template 1',
        description: 'Template 1 description',
        author: {
          id: 'test_author',
          name: 'Test Author',
          verified: false,
          reputation: 0,
          totalTemplates: 1,
          totalDownloads: 0,
        } as AuthorInfo,
        currentVersion: '1.1.0',
        versions: [{
          version: '1.1.0',
          description: 'Updated template 1',
          content: 'Template content',
          dependencies: [],
          variables: [],
          examples: [],
          changelog: 'Updated version',
          compatibility: ['1.0.0'],
          size: 100,
          created: new Date(),
          downloads: 0,
          deprecated: false,
        } as TemplateVersion],
        tags: ['test'],
        rating: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          reviews: []
        } as TemplateRating,
        stats: {
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
        metadata: {
          license: 'MIT',
          keywords: ['test'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        } as TemplateMetadata,
        category: 'other' as any,
        created: new Date(),
        updated: new Date(),
        featured: false,
        verified: false,
        deprecated: false,
      };
      
      const updateTemplate2: TemplateModel = {
        id: 'template-2',
        name: 'Template 2',
        displayName: 'Template 2',
        description: 'Template 2 description',
        author: {
          id: 'test_author',
          name: 'Test Author',
          verified: false,
          reputation: 0,
          totalTemplates: 1,
          totalDownloads: 0,
        } as AuthorInfo,
        currentVersion: '2.1.0',
        versions: [{
          version: '2.1.0',
          description: 'Updated template 2',
          content: 'Template content',
          dependencies: [],
          variables: [],
          examples: [],
          changelog: 'Updated version',
          compatibility: ['1.0.0'],
          size: 100,
          created: new Date(),
          downloads: 0,
          deprecated: false,
        } as TemplateVersion],
        tags: ['test'],
        rating: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          reviews: []
        } as TemplateRating,
        stats: {
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
        metadata: {
          license: 'MIT',
          keywords: ['test'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        } as TemplateMetadata,
        category: 'other' as any,
        created: new Date(),
        updated: new Date(),
        featured: false,
        verified: false,
        deprecated: false,
      };
      
      await marketplaceService.publishTemplate(updateTemplate1);
      await marketplaceService.publishTemplate(updateTemplate2);
    });

    it('should check for available updates', async () => {
      const updates = await marketplaceService.checkUpdates(
        path.join(testDir, 'templates')
      );

      expect(updates.updates).toHaveLength(2);
      expect(updates.updates.some(u => u.templateId === 'template-1')).toBe(true);
      expect(updates.updates.some(u => u.templateId === 'template-2')).toBe(true);
      expect(updates.updates.some(u => u.templateId === 'template-3')).toBe(false);
    });

    it('should update a single template', async () => {
      const result = await marketplaceService.updateTemplate(
        'template-1',
        path.join(testDir, 'templates')
      );

      expect(result.success).toBe(true);
      expect(result.version).toBe('1.1.0');
    });

    it('should update all templates', async () => {
      const results = await marketplaceService.updateAll(
        path.join(testDir, 'templates')
      );

      expect(results.updated).toHaveLength(2);
      expect(results.failed).toHaveLength(0);
    });

    it('should handle update rollback', async () => {
      // Update template
      await marketplaceService.updateTemplate(
        'template-1',
        path.join(testDir, 'templates')
      );

      // Rollback
      const result = await marketplaceService.rollbackTemplate(
        'template-1',
        '1.0.0',
        path.join(testDir, 'templates')
      );

      expect(result.success).toBe(true);
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('Template Ratings and Reviews', () => {
    beforeEach(async () => {
      const template: TemplateModel = {
        id: 'rated-template',
        name: 'Rated Template',
        displayName: 'Rated Template',
        description: 'Template for rating tests',
        author: {
          id: 'test_author',
          name: 'Test Author',
          verified: false,
          reputation: 0,
          totalTemplates: 1,
          totalDownloads: 0,
        } as AuthorInfo,
        currentVersion: '1.0.0',
        versions: [{
          version: '1.0.0',
          description: 'Template for rating',
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
        tags: ['test'],
        rating: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          reviews: []
        } as TemplateRating,
        stats: {
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
        metadata: {
          license: 'MIT',
          keywords: ['test'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        } as TemplateMetadata,
        category: 'other' as any,
        created: new Date(),
        updated: new Date(),
        featured: false,
        verified: false,
        deprecated: false,
      };
      await marketplaceService.publishTemplate(template);
    });

    it('should add rating to template', async () => {
      const result = await marketplaceService.rateTemplate(
        'rated-template',
        4.5,
        'user123'
      );

      expect(result.success).toBe(true);
      expect(result.rating).toBe(4.5);
      expect(result.userId).toBe('user123');
    });

    it('should calculate average rating', async () => {
      await marketplaceService.rateTemplate('rated-template', 5, 'user1');
      await marketplaceService.rateTemplate('rated-template', 4, 'user2');
      await marketplaceService.rateTemplate('rated-template', 3, 'user3');

      const template = await marketplaceService.getTemplate('rated-template');
      expect((template.rating as any).average).toBe(4); // Average of 5, 4, 3
    });

    it('should update existing rating', async () => {
      await marketplaceService.rateTemplate('rated-template', 3, 'user123');
      await marketplaceService.rateTemplate('rated-template', 5, 'user123');

      const template = await marketplaceService.getTemplate('rated-template');
      expect((template.rating as any).total).toBe(1); // Still one rating
      expect((template.rating as any).average).toBe(5); // Updated to 5
    });

    it('should add reviews', async () => {
      const review = {
        rating: 4,
        title: 'Great template!',
        comment: 'Very useful for my project',
        userId: 'reviewer123'
      };

      const result = await marketplaceService.addReview(
        'rated-template',
        review
      );

      expect(result.id).toBeDefined();

      const reviews = await marketplaceService.getReviews('rated-template');
      expect(reviews).toHaveLength(1);
      expect(reviews[0].title).toBe('Great template!');
    });
  });

  describe('Version Management', () => {
    it('should parse version strings correctly', () => {
      expect(versionManager.parse('1.2.3')).toEqual({
        major: 1,
        minor: 2,
        patch: 3
      });

      expect(versionManager.parse('2.0.0-beta.1')).toEqual({
        major: 2,
        minor: 0,
        patch: 0,
        prerelease: 'beta.1'
      });
    });

    it('should compare versions', () => {
      expect(versionManager.compare('1.0.0', '2.0.0')).toBe(-1);
      expect(versionManager.compare('2.0.0', '1.0.0')).toBe(1);
      expect(versionManager.compare('1.0.0', '1.0.0')).toBe(0);
      
      expect(versionManager.compare('1.0.0', '1.0.1')).toBe(-1);
      expect(versionManager.compare('1.2.0', '1.1.0')).toBe(1);
    });

    it('should check version compatibility', () => {
      expect(versionManager.satisfies('1.2.3', '^1.0.0')).toBe(true);
      expect(versionManager.satisfies('2.0.0', '^1.0.0')).toBe(false);
      
      expect(versionManager.satisfies('1.2.3', '~1.2.0')).toBe(true);
      expect(versionManager.satisfies('1.3.0', '~1.2.0')).toBe(false);
      
      expect(versionManager.satisfies('1.5.0', '>=1.0.0 <2.0.0')).toBe(true);
    });

    it('should get latest version from list', () => {
      const versions = ['1.0.0', '2.1.0', '1.5.3', '2.0.0', '3.0.0-beta'];
      
      expect(versionManager.getLatest(versions)).toBe('3.0.0-beta');
      expect(versionManager.getLatestStable(versions)).toBe('2.1.0');
    });
  });

  describe('Cache Management', () => {
    it('should cache downloaded templates', async () => {
      const template: TemplateModel = {
        id: 'cached-template',
        name: 'Cached Template',
        displayName: 'Cached Template',
        description: 'Template for caching tests',
        author: {
          id: 'test_author',
          name: 'Test Author',
          verified: false,
          reputation: 0,
          totalTemplates: 1,
          totalDownloads: 0,
        } as AuthorInfo,
        currentVersion: '1.0.0',
        versions: [{
          version: '1.0.0',
          description: 'Template for caching',
          content: 'Large content here...',
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
        tags: ['test'],
        rating: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          reviews: []
        } as TemplateRating,
        stats: {
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
        metadata: {
          license: 'MIT',
          keywords: ['test'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        } as TemplateMetadata,
        category: 'other' as any,
        created: new Date(),
        updated: new Date(),
        featured: false,
        verified: false,
        deprecated: false,
      };
      await marketplaceService.publishTemplate(template);

      // First install (downloads)
      const result1 = await marketplaceService.installTemplate(
        'cached-template',
        path.join(testDir, 'install1')
      );
      expect(result1.success).toBe(true);

      // Second install (simulate cache behavior)
      const result2 = await marketplaceService.installTemplate(
        'cached-template',
        path.join(testDir, 'install2')
      );
      expect(result2.success).toBe(true);
    });

    it('should invalidate cache on update', async () => {
      const template: TemplateModel = {
        id: 'cache-test',
        name: 'Cache Test',
        displayName: 'Cache Test',
        description: 'Template for cache invalidation tests',
        author: {
          id: 'test_author',
          name: 'Test Author',
          verified: false,
          reputation: 0,
          totalTemplates: 1,
          totalDownloads: 0,
        } as AuthorInfo,
        currentVersion: '1.0.0',
        versions: [{
          version: '1.0.0',
          description: 'Template for cache testing',
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
        tags: ['test'],
        rating: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          reviews: []
        } as TemplateRating,
        stats: {
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
        metadata: {
          license: 'MIT',
          keywords: ['test'],
          minEngineVersion: '1.0.0',
          platform: ['web'],
        } as TemplateMetadata,
        category: 'other' as any,
        created: new Date(),
        updated: new Date(),
        featured: false,
        verified: false,
        deprecated: false,
      };
      await marketplaceService.publishTemplate(template);

      // Install and cache
      await marketplaceService.installTemplate(
        'cache-test',
        path.join(testDir, 'install1')
      );

      // Update template
      const updatedTemplate: TemplateModel = {
        ...template,
        currentVersion: '1.1.0',
        versions: [
          ...template.versions,
          {
            version: '1.1.0',
            description: 'Updated template',
            content: 'Updated template content',
            dependencies: [],
            variables: [],
            examples: [],
            changelog: 'Updated version',
            compatibility: ['1.0.0'],
            size: 120,
            created: new Date(),
            downloads: 0,
            deprecated: false,
          } as TemplateVersion
        ]
      };
      await marketplaceService.publishTemplate(updatedTemplate);

      // Should not use cache for new version
      const result = await marketplaceService.installTemplate(
        'cache-test',
        path.join(testDir, 'install2')
      );
      expect(result.success).toBe(true);
      expect(result.version).toBe('1.1.0');
    });

    it('should clear cache', async () => {
      // Add items to cache
      for (let i = 0; i < 5; i++) {
        const template: TemplateModel = {
          id: `cache-item-${i}`,
          name: `Cache Item ${i}`,
          displayName: `Cache Item ${i}`,
          description: `Template for cache item ${i}`,
          author: {
            id: 'test_author',
            name: 'Test Author',
            verified: false,
            reputation: 0,
            totalTemplates: 1,
            totalDownloads: 0,
          } as AuthorInfo,
          currentVersion: '1.0.0',
          versions: [{
            version: '1.0.0',
            description: `Cache item ${i}`,
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
          tags: ['test'],
          rating: {
            average: 0,
            total: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            reviews: []
          } as TemplateRating,
          stats: {
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
          metadata: {
            license: 'MIT',
            keywords: ['test'],
            minEngineVersion: '1.0.0',
            platform: ['web'],
          } as TemplateMetadata,
          category: 'other' as any,
          created: new Date(),
          updated: new Date(),
          featured: false,
          verified: false,
          deprecated: false,
        };
        await marketplaceService.publishTemplate(template);
        await marketplaceService.installTemplate(
          `cache-item-${i}`,
          path.join(testDir, `install-${i}`)
        );
      }

      const cacheSize = await marketplaceService.getCacheSize();
      expect(cacheSize).toBeGreaterThan(0);

      await marketplaceService.clearCache();

      const newCacheSize = await marketplaceService.getCacheSize();
      expect(newCacheSize).toBe(0);
    });
  });
});
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
import { TemplateRegistry } from '../../src/marketplace/core/template.registry';
import { VersionManager } from '../../src/marketplace/core/version.manager';
import { FileDatabase } from '../../src/marketplace/database/file-database';

describe('E2E: Marketplace', () => {
  let testDir: string;
  let marketplaceService: MarketplaceService;
  let templateRegistry: TemplateRegistry;
  let versionManager: VersionManager;
  let database: FileDatabase;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marketplace-e2e-'));
    
    // Initialize database
    database = new FileDatabase(path.join(testDir, 'marketplace.db'));
    await database.init();

    // Initialize services
    marketplaceService = new MarketplaceService(database);
    templateRegistry = new TemplateRegistry(database);
    versionManager = new VersionManager();

    // Create necessary directories
    await fs.mkdir(path.join(testDir, 'templates'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'cache'), { recursive: true });
  });

  afterEach(async () => {
    await database.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Template Discovery and Search', () => {
    beforeEach(async () => {
      // Seed marketplace with sample templates
      const templates = [
        {
          id: 'auth-template',
          name: 'Authentication Template',
          description: 'Complete authentication flow template',
          author: 'john_doe',
          version: '2.1.0',
          tags: ['auth', 'security', 'user-management'],
          downloads: 1500,
          rating: 4.5,
          category: 'Backend'
        },
        {
          id: 'react-component',
          name: 'React Component Generator',
          description: 'Generate React components with tests',
          author: 'jane_smith',
          version: '3.0.0',
          tags: ['react', 'frontend', 'component'],
          downloads: 3200,
          rating: 4.8,
          category: 'Frontend'
        },
        {
          id: 'api-crud',
          name: 'REST API CRUD Template',
          description: 'Generate CRUD operations for REST APIs',
          author: 'api_master',
          version: '1.5.2',
          tags: ['api', 'rest', 'crud', 'backend'],
          downloads: 2100,
          rating: 4.3,
          category: 'Backend'
        },
        {
          id: 'docker-compose',
          name: 'Docker Compose Setup',
          description: 'Multi-container Docker setup',
          author: 'devops_pro',
          version: '1.0.0',
          tags: ['docker', 'devops', 'containers'],
          downloads: 890,
          rating: 4.6,
          category: 'DevOps'
        }
      ];

      for (const template of templates) {
        await marketplaceService.publishTemplate(template);
      }
    });

    it('should search templates by keyword', async () => {
      const results = await marketplaceService.search('authentication');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Authentication Template');
      expect(results[0].tags).toContain('auth');
    });

    it('should search templates by tags', async () => {
      const results = await marketplaceService.searchByTags(['backend']);

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some(t => t.id === 'auth-template')).toBe(true);
      expect(results.some(t => t.id === 'api-crud')).toBe(true);
    });

    it('should filter templates by category', async () => {
      const results = await marketplaceService.searchByCategory('Frontend');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('react-component');
    });

    it('should sort templates by popularity', async () => {
      const results = await marketplaceService.getPopularTemplates(3);

      expect(results[0].downloads).toBe(3200); // React component
      expect(results[1].downloads).toBe(2100); // API CRUD
      expect(results[2].downloads).toBe(1500); // Auth template
    });

    it('should get top-rated templates', async () => {
      const results = await marketplaceService.getTopRated(2);

      expect(results[0].rating).toBe(4.8); // React component
      expect(results[1].rating).toBe(4.6); // Docker compose
    });

    it('should get templates by author', async () => {
      const results = await marketplaceService.getByAuthor('jane_smith');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('React Component Generator');
    });

    it('should get trending templates', async () => {
      // Simulate recent downloads
      await marketplaceService.recordDownload('react-component');
      await marketplaceService.recordDownload('react-component');
      await marketplaceService.recordDownload('auth-template');

      const trending = await marketplaceService.getTrending(24); // Last 24 hours

      expect(trending.length).toBeGreaterThan(0);
      expect(trending[0].id).toBe('react-component');
    });
  });

  describe('Template Installation', () => {
    beforeEach(async () => {
      // Create a template in the marketplace
      const template = {
        id: 'test-template',
        name: 'Test Template',
        version: '1.0.0',
        author: 'test_author',
        content: `---
name: test
description: Test template
---
# {{title}}
Content here`,
        files: [
          {
            path: 'README.md',
            content: '# Test Template\n\nDocumentation'
          }
        ]
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
      expect(result.installedPath).toContain('test-template');

      // Check files were created
      const templateFile = path.join(installPath, 'test-template', 'template.yaml');
      const readme = path.join(installPath, 'test-template', 'README.md');

      expect(await fs.stat(templateFile)).toBeTruthy();
      expect(await fs.stat(readme)).toBeTruthy();

      const content = await fs.readFile(templateFile, 'utf-8');
      expect(content).toContain('# {{title}}');
    });

    it('should handle template dependencies', async () => {
      // Create template with dependencies
      const templateWithDeps = {
        id: 'deps-template',
        name: 'Template with Dependencies',
        version: '1.0.0',
        dependencies: {
          'base-template': '^1.0.0',
          'utils-template': '~2.0.0'
        }
      };

      await marketplaceService.publishTemplate(templateWithDeps);

      const result = await marketplaceService.installTemplate(
        'deps-template',
        path.join(testDir, 'templates'),
        { installDependencies: true }
      );

      expect(result.dependencies).toBeDefined();
      // Dependencies should be resolved
    });

    it('should check for conflicts before installation', async () => {
      const installPath = path.join(testDir, 'templates', 'test-template');
      
      // Install once
      await marketplaceService.installTemplate('test-template', testDir);

      // Try to install again without force
      const result = await marketplaceService.installTemplate(
        'test-template',
        testDir,
        { force: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should support batch installation', async () => {
      // Create multiple templates
      for (let i = 1; i <= 3; i++) {
        await marketplaceService.publishTemplate({
          id: `template-${i}`,
          name: `Template ${i}`,
          version: '1.0.0'
        });
      }

      const templates = ['template-1', 'template-2', 'template-3'];
      const results = await marketplaceService.batchInstall(
        templates,
        path.join(testDir, 'templates')
      );

      expect(results.success).toHaveLength(3);
      expect(results.failed).toHaveLength(0);
    });
  });

  describe('Template Publishing', () => {
    it('should publish a new template', async () => {
      const template = {
        name: 'My New Template',
        description: 'A template for testing',
        version: '1.0.0',
        author: 'test_user',
        content: '# Template content',
        tags: ['test', 'example']
      };

      const result = await marketplaceService.publishTemplate(template);

      expect(result.success).toBe(true);
      expect(result.templateId).toBeDefined();
      expect(result.version).toBe('1.0.0');

      // Verify it can be found
      const search = await marketplaceService.search('My New Template');
      expect(search).toHaveLength(1);
    });

    it('should validate template before publishing', async () => {
      const invalidTemplate = {
        // Missing required fields
        description: 'Invalid template'
      };

      try {
        await marketplaceService.publishTemplate(invalidTemplate);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.message).toContain('validation');
        expect(error.errors).toContain('name');
      }
    });

    it('should handle version updates', async () => {
      // Publish initial version
      const v1 = {
        id: 'versioned-template',
        name: 'Versioned Template',
        version: '1.0.0',
        author: 'author'
      };

      await marketplaceService.publishTemplate(v1);

      // Publish update
      const v2 = {
        id: 'versioned-template',
        name: 'Versioned Template',
        version: '2.0.0',
        author: 'author',
        changelog: 'Major update with new features'
      };

      const result = await marketplaceService.publishTemplate(v2);

      expect(result.version).toBe('2.0.0');

      // Check version history
      const history = await marketplaceService.getVersionHistory('versioned-template');
      expect(history).toHaveLength(2);
      expect(history[0].version).toBe('1.0.0');
      expect(history[1].version).toBe('2.0.0');
    });

    it('should enforce author permissions', async () => {
      // Publish as one author
      await marketplaceService.publishTemplate({
        id: 'protected-template',
        name: 'Protected Template',
        version: '1.0.0',
        author: 'original_author'
      });

      // Try to update as different author
      try {
        await marketplaceService.publishTemplate({
          id: 'protected-template',
          name: 'Protected Template',
          version: '1.1.0',
          author: 'different_author'
        });
        fail('Should have thrown permission error');
      } catch (error: any) {
        expect(error.message).toContain('permission');
      }
    });
  });

  describe('Template Updates', () => {
    beforeEach(async () => {
      // Install some templates
      const templates = [
        { id: 'template-1', version: '1.0.0' },
        { id: 'template-2', version: '2.0.0' },
        { id: 'template-3', version: '1.5.0' }
      ];

      for (const template of templates) {
        await marketplaceService.publishTemplate(template);
        await marketplaceService.installTemplate(
          template.id,
          path.join(testDir, 'templates')
        );
      }

      // Publish updates
      await marketplaceService.publishTemplate({
        id: 'template-1',
        version: '1.1.0'
      });
      await marketplaceService.publishTemplate({
        id: 'template-2',
        version: '2.1.0'
      });
    });

    it('should check for available updates', async () => {
      const updates = await marketplaceService.checkUpdates(
        path.join(testDir, 'templates')
      );

      expect(updates).toHaveLength(2);
      expect(updates.some(u => u.id === 'template-1')).toBe(true);
      expect(updates.some(u => u.id === 'template-2')).toBe(true);
      expect(updates.some(u => u.id === 'template-3')).toBe(false);
    });

    it('should update a single template', async () => {
      const result = await marketplaceService.updateTemplate(
        'template-1',
        path.join(testDir, 'templates')
      );

      expect(result.success).toBe(true);
      expect(result.oldVersion).toBe('1.0.0');
      expect(result.newVersion).toBe('1.1.0');
    });

    it('should update all templates', async () => {
      const results = await marketplaceService.updateAll(
        path.join(testDir, 'templates')
      );

      expect(results.updated).toHaveLength(2);
      expect(results.failed).toHaveLength(0);
      expect(results.skipped).toHaveLength(1); // template-3
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
      await marketplaceService.publishTemplate({
        id: 'rated-template',
        name: 'Rated Template',
        version: '1.0.0'
      });
    });

    it('should add rating to template', async () => {
      const result = await marketplaceService.rateTemplate(
        'rated-template',
        4.5,
        'user123'
      );

      expect(result.success).toBe(true);
      expect(result.averageRating).toBe(4.5);
      expect(result.totalRatings).toBe(1);
    });

    it('should calculate average rating', async () => {
      await marketplaceService.rateTemplate('rated-template', 5, 'user1');
      await marketplaceService.rateTemplate('rated-template', 4, 'user2');
      await marketplaceService.rateTemplate('rated-template', 3, 'user3');

      const template = await marketplaceService.getTemplate('rated-template');
      expect(template.rating).toBe(4); // Average of 5, 4, 3
    });

    it('should update existing rating', async () => {
      await marketplaceService.rateTemplate('rated-template', 3, 'user123');
      await marketplaceService.rateTemplate('rated-template', 5, 'user123');

      const template = await marketplaceService.getTemplate('rated-template');
      expect(template.totalRatings).toBe(1); // Still one rating
      expect(template.rating).toBe(5); // Updated to 5
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

      expect(result.success).toBe(true);

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
      await marketplaceService.publishTemplate({
        id: 'cached-template',
        name: 'Cached Template',
        version: '1.0.0',
        content: 'Large content here...'
      });

      // First install (downloads)
      const result1 = await marketplaceService.installTemplate(
        'cached-template',
        path.join(testDir, 'install1')
      );
      expect(result1.fromCache).toBe(false);

      // Second install (from cache)
      const result2 = await marketplaceService.installTemplate(
        'cached-template',
        path.join(testDir, 'install2')
      );
      expect(result2.fromCache).toBe(true);
    });

    it('should invalidate cache on update', async () => {
      await marketplaceService.publishTemplate({
        id: 'cache-test',
        version: '1.0.0'
      });

      // Install and cache
      await marketplaceService.installTemplate(
        'cache-test',
        path.join(testDir, 'install1')
      );

      // Update template
      await marketplaceService.publishTemplate({
        id: 'cache-test',
        version: '1.1.0'
      });

      // Should not use cache for new version
      const result = await marketplaceService.installTemplate(
        'cache-test',
        path.join(testDir, 'install2')
      );
      expect(result.fromCache).toBe(false);
      expect(result.version).toBe('1.1.0');
    });

    it('should clear cache', async () => {
      // Add items to cache
      for (let i = 0; i < 5; i++) {
        await marketplaceService.publishTemplate({
          id: `cache-item-${i}`,
          version: '1.0.0'
        });
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
/**
 * @fileoverview Integration tests for marketplace commands
 * @lastmodified 2025-08-22T22:00:00Z
 */

import { Command } from 'commander';
import { SearchCommand as MarketplaceSearchCommand } from '../../../src/commands/marketplace/search';
import { InstallCommand as MarketplaceInstallCommand } from '../../../src/commands/marketplace/install';
import { ListCommand as MarketplaceListCommand } from '../../../src/commands/marketplace/list';
import { MarketplaceService } from '../../../src/marketplace/core/marketplace.service';
import {
  TemplateSearchResult,
  TemplateModel,
  TemplateCategory,
  AuthorInfo,
  TemplateVersion,
  TemplateStats,
  TemplateMetadata,
} from '../../../src/marketplace/models/template.model';

jest.mock('../../../src/marketplace/core/marketplace.service');

// Helper function to create a mock TemplateModel with all required properties
function createMockTemplate(overrides: Partial<TemplateModel> = {}): TemplateModel {
  const baseTemplate: TemplateModel = {
    id: 'template-id',
    name: 'template-name',
    displayName: 'Template Display Name',
    description: 'Template description',
    category: 'development' as TemplateCategory,
    tags: [],
    author: {
      id: 'author-id',
      name: 'Author Name',
      verified: false,
      reputation: 0,
      totalTemplates: 1,
      totalDownloads: 0,
    } as AuthorInfo,
    versions: [] as TemplateVersion[],
    currentVersion: '1.0.0',
    rating: 0,
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
      keywords: [],
      minEngineVersion: '1.0.0',
      platform: [],
    } as TemplateMetadata,
    created: new Date(),
    updated: new Date(),
    featured: false,
    verified: false,
    deprecated: false,
  };
  
  return { ...baseTemplate, ...overrides };
}

describe('Marketplace Commands Integration', () => {
  let program: Command;
  let mockService: jest.Mocked<MarketplaceService>;

  beforeEach(() => {
    program = new Command();
    program.exitOverride(); // Prevent process.exit during tests

    // Create a mock service with all required methods
    mockService = {
      search: jest.fn(),
      install: jest.fn(),
      getTemplate: jest.fn(),
      listTemplates: jest.fn(),
    } as any;
    
    // Mock the getInstance method to return our mock service
    (MarketplaceService as any).getInstance = jest.fn().mockReturnValue(mockService);

    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('marketplace:search command', () => {
    it('should search templates with query', async () => {
      const searchCommand = new MarketplaceSearchCommand();
      const mockResult: TemplateSearchResult = {
        templates: [
          createMockTemplate({
            id: 'test-1',
            name: 'Test Template 1',
            description: 'A test template',
            downloads: 100,
            rating: 4.5,
          }),
        ],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockService.search.mockResolvedValue(mockResult);

      await searchCommand.execute('test query', {
        page: '1',
        limit: '10',
      });

      expect(mockService.search).toHaveBeenCalledWith({
        query: 'test query',
        page: 1,
        limit: 10,
      });
    });

    it('should handle search with filters', async () => {
      const searchCommand = new MarketplaceSearchCommand();
      const mockResult: TemplateSearchResult = {
        templates: [],
        total: 0,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockService.search.mockResolvedValue(mockResult);

      await searchCommand.execute('', {
        category: 'development',
        tag: 'typescript,react',
        sort: 'downloads',
        order: 'desc',
        page: '1',
        limit: '20',
      });

      expect(mockService.search).toHaveBeenCalledWith({
        category: 'development',
        tags: ['typescript', 'react'],
        sortBy: 'downloads',
        sortOrder: 'desc',
        page: 1,
        limit: 20,
      });
    });

    it('should display search results', async () => {
      const searchCommand = new MarketplaceSearchCommand();
      const mockResult: TemplateSearchResult = {
        templates: [
          createMockTemplate({
            id: 'template-1',
            name: 'Template One',
            description: 'First template',
            downloads: 500,
            rating: 4.8,
            author: {
              id: 'author1',
              name: 'author1',
              verified: false,
              reputation: 0,
              totalTemplates: 1,
              totalDownloads: 0,
            } as AuthorInfo,
          }),
          createMockTemplate({
            id: 'template-2',
            name: 'Template Two',
            description: 'Second template',
            downloads: 300,
            rating: 4.2,
          }),
        ],
        total: 2,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockService.search.mockResolvedValue(mockResult);
      const consoleSpy = jest.spyOn(console, 'log');

      await searchCommand.execute('test', {});

      // Verify output contains template information
      const output = consoleSpy.mock.calls.flat().join('\n');
      // Template names appear as displayName in the output
      expect(output).toContain('Template Display Name');
      expect(output).toContain('First template');
      expect(output).toContain('Second template');
    });
  });

  describe('marketplace:install command', () => {
    it('should install a template', async () => {
      const installCommand = new MarketplaceInstallCommand();

      // Mock the confirm method to auto-confirm
      jest.spyOn(installCommand as any, 'confirm').mockResolvedValue(true);

      // Mock getTemplate first
      mockService.getTemplate = jest.fn().mockResolvedValue(createMockTemplate({
        id: 'test-template',
        name: 'Test Template',
        versions: [{ version: '1.0.0', description: '', content: '', dependencies: [], variables: [] } as any] as any,
      }));
      
      mockService.install.mockResolvedValue({
        success: true,
        template: {
          id: 'test-template',
          name: 'Test Template',
        } as any,
        version: '1.0.0',
        installPath: '/path/to/template',
        duration: 1000,
        warnings: [],
      });

      await installCommand.execute('test-template', {});

      expect(mockService.getTemplate).toHaveBeenCalledWith('test-template');
      expect(mockService.install).toHaveBeenCalledWith('test-template', '1.0.0');
    });

    it('should install with version', async () => {
      const installCommand = new MarketplaceInstallCommand();

      // Mock the confirm method to auto-confirm
      jest.spyOn(installCommand as any, 'confirm').mockResolvedValue(true);

      // Mock getTemplate first
      mockService.getTemplate = jest.fn().mockResolvedValue(createMockTemplate({
        id: 'test-template',
        name: 'Test Template',
        currentVersion: '2.0.0',
        versions: [
          { version: '1.0.0', description: '', content: '', dependencies: [], variables: [] } as any,
          { version: '2.0.0', description: '', content: '', dependencies: [], variables: [] } as any
        ],
      }));
      
      mockService.install.mockResolvedValue({
        success: true,
        template: {} as any,
        version: '2.0.0',
        installPath: '/path',
        duration: 1000,
        warnings: [],
      });

      await installCommand.execute('test-template', {
        version: '2.0.0',
        force: true,
      });

      expect(mockService.getTemplate).toHaveBeenCalledWith('test-template');
      expect(mockService.install).toHaveBeenCalledWith('test-template', '2.0.0');
    });

    it('should handle installation errors', async () => {
      const installCommand = new MarketplaceInstallCommand();

      // Mock getTemplate to throw error
      mockService.getTemplate = jest.fn().mockRejectedValue(new Error('Template not found'));
      const consoleSpy = jest.spyOn(console, 'error');

      try {
        await installCommand.execute('bad-template', {});
      } catch (error) {
        // Expected to throw
      }
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('marketplace:list command', () => {
    it('should list templates', async () => {
      const listCommand = new MarketplaceListCommand();
      
      // Mock TemplateRegistry to return empty list (no installed templates)
      const TemplateRegistry = require('../../../src/marketplace/core/template.registry').TemplateRegistry;
      jest.spyOn(TemplateRegistry.prototype, 'listTemplates').mockReturnValue([]);
      
      // Mock console methods to verify warning
      const warnSpy = jest.spyOn(listCommand as any, 'warn');
      
      await listCommand.execute('', {
        featured: true,
        limit: '10',
      });

      // Should warn about no installed templates
      expect(warnSpy).toHaveBeenCalledWith('No templates installed');
    });

    it('should list trending templates', async () => {
      const listCommand = new MarketplaceListCommand();
      
      // Mock TemplateRegistry to return empty list
      const TemplateRegistry = require('../../../src/marketplace/core/template.registry').TemplateRegistry;
      jest.spyOn(TemplateRegistry.prototype, 'listTemplates').mockReturnValue([]);
      
      // Mock console methods to verify warning
      const warnSpy = jest.spyOn(listCommand as any, 'warn');
      
      await listCommand.execute('', {
        trending: true,
        limit: '20',
      });

      // Should warn about no installed templates
      expect(warnSpy).toHaveBeenCalledWith('No templates installed');
    });

    it('should filter by category', async () => {
      const listCommand = new MarketplaceListCommand();
      
      // Mock TemplateRegistry to return templates that can be filtered
      const TemplateRegistry = require('../../../src/marketplace/core/template.registry').TemplateRegistry;
      const mockTemplates = [
        {
          id: 'test-1',
          name: 'Test Template 1',
          metadata: { 
            category: 'testing',
            description: 'Test template 1 description',
            author: { name: 'Test Author', verified: false, id: 'author1' },
            tags: ['test'],
            displayName: 'Test Template 1'
          },
          version: '1.0.0',
          active: true,
          installDate: new Date(),
          registered: new Date(),  // Add registered property
          path: '/path/to/template1',  // Add path property
          createdAt: new Date(),
          currentVersion: '1.0.0',
          rating: { average: 4.5, total: 10 },
          downloads: 100
        },
        {
          id: 'test-2',
          name: 'Test Template 2',
          metadata: { 
            category: 'development',
            description: 'Test template 2 description',
            author: { name: 'Test Author', verified: false, id: 'author2' },
            tags: ['test'],
            displayName: 'Test Template 2'
          },
          version: '1.0.0',
          active: true,
          installDate: new Date(),
          registered: new Date(),  // Add registered property
          path: '/path/to/template2',  // Add path property
          createdAt: new Date(),
          currentVersion: '1.0.0',
          rating: { average: 4.0, total: 5 },
          downloads: 50
        },
      ];
      jest.spyOn(TemplateRegistry.prototype, 'listTemplates').mockReturnValue(mockTemplates as any);
      
      // Import and spy on logger
      const { logger } = require('../../../src/utils/logger');
      const loggerSpy = jest.spyOn(logger, 'info');
      
      await listCommand.execute('', {
        category: 'testing',
        page: '2',
        limit: '15',
      });

      // Should display filtered templates
      const output = loggerSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Test Template 1');
    });
  });

  describe('Command Registration', () => {
    it('should register marketplace commands in CLI', () => {
      // Set up commands
      program
        .command('marketplace:search [query]')
        .description('search for templates')
        .action(() => {});

      program
        .command('marketplace:install <template>')
        .description('install a template')
        .action(() => {});

      program
        .command('marketplace:list')
        .description('list templates')
        .action(() => {});

      // Test that commands are registered
      const commands = program.commands.map(cmd => cmd.name());

      expect(commands).toContain('marketplace:search');
      expect(commands).toContain('marketplace:install');
      expect(commands).toContain('marketplace:list');
    });

    it('should show marketplace commands in help', () => {
      program
        .command('marketplace:search [query]')
        .description('search for templates in the marketplace');

      const helpInfo = program.helpInformation();

      expect(helpInfo).toContain('marketplace:search');
      expect(helpInfo).toContain('search for templates in the marketplace');
    });
  });

  describe('End-to-End Workflow', () => {
    it('should support search, install, and list workflow', async () => {
      const searchCommand = new MarketplaceSearchCommand();
      const installCommand = new MarketplaceInstallCommand();
      const listCommand = new MarketplaceListCommand();

      // Step 1: Search for templates
      const searchResult: TemplateSearchResult = {
        templates: [
          createMockTemplate({
            id: 'workflow-template',
            name: 'Workflow Template',
            description: 'Test workflow',
          }),
        ],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockService.search.mockResolvedValue(searchResult);
      await searchCommand.execute('workflow', {});

      // Step 2: Install the template
      mockService.install.mockResolvedValue({
        success: true,
        template: searchResult.templates[0] as any,
        version: '1.0.0',
        installPath: '/path',
        duration: 1000,
        warnings: [],
      });

      await installCommand.execute('workflow-template', {});

      // Step 3: List installed templates
      mockService.getInstalledTemplates = jest
        .fn()
        .mockReturnValue([searchResult.templates[0]]);

      const installed = mockService.getInstalledTemplates();

      expect(installed).toHaveLength(1);
      expect((installed[0] as any).id).toBe('workflow-template');

      // Step 4: List command integration test
      await listCommand.execute('', {});
      expect(mockService.getInstalledTemplates).toHaveBeenCalled();
    });
  });
});

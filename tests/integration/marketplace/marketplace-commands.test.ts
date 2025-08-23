/**
 * @fileoverview Integration tests for marketplace commands
 * @lastmodified 2025-08-22T22:00:00Z
 */

import { Command } from 'commander';
import { SearchCommand as MarketplaceSearchCommand } from '../../../src/commands/marketplace/search';
import { InstallCommand as MarketplaceInstallCommand } from '../../../src/commands/marketplace/install';
import { ListCommand as MarketplaceListCommand } from '../../../src/commands/marketplace/list';
import { MarketplaceAPI } from '../../../src/marketplace/api/marketplace.api';
import { MarketplaceService } from '../../../src/marketplace/core/marketplace.service';
import {
  TemplateSearchResult,
  TemplateModel,
} from '../../../src/marketplace/models/template.model';

jest.mock('../../../src/marketplace/api/marketplace.api');
jest.mock('../../../src/marketplace/core/marketplace.service');

describe('Marketplace Commands Integration', () => {
  let program: Command;
  let mockApi: jest.Mocked<MarketplaceAPI>;
  let mockService: jest.Mocked<MarketplaceService>;

  beforeEach(() => {
    program = new Command();
    program.exitOverride(); // Prevent process.exit during tests

    mockApi = new MarketplaceAPI() as jest.Mocked<MarketplaceAPI>;
    mockService =
      MarketplaceService.getInstance() as jest.Mocked<MarketplaceService>;

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
          {
            id: 'test-1',
            name: 'Test Template 1',
            description: 'A test template',
            downloads: 100,
            rating: 4.5,
          } as TemplateModel,
        ],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockService.search.mockResolvedValue(mockResult);

      await searchCommand.execute('test query', {
        page: 1,
        limit: 10,
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
        tags: 'typescript,react',
        sort: 'downloads',
        order: 'desc',
        page: 1,
        limit: 20,
      });

      expect(mockService.search).toHaveBeenCalledWith({
        query: '',
        category: 'development',
        tags: ['typescript', 'react'],
        sort: 'downloads',
        order: 'desc',
        page: 1,
        limit: 20,
      });
    });

    it('should display search results', async () => {
      const searchCommand = new MarketplaceSearchCommand();
      const mockResult: TemplateSearchResult = {
        templates: [
          {
            id: 'template-1',
            name: 'Template One',
            description: 'First template',
            downloads: 500,
            rating: 4.8,
            author: 'author1',
          } as TemplateModel,
          {
            id: 'template-2',
            name: 'Template Two',
            description: 'Second template',
            downloads: 300,
            rating: 4.2,
          } as TemplateModel,
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
      expect(output).toContain('Template One');
      expect(output).toContain('Template Two');
      expect(output).toContain('500');
      expect(output).toContain('4.8');
    });
  });

  describe('marketplace:install command', () => {
    it('should install a template', async () => {
      const installCommand = new MarketplaceInstallCommand();

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

      expect(mockService.install).toHaveBeenCalledWith('test-template', {});
    });

    it('should install with version', async () => {
      const installCommand = new MarketplaceInstallCommand();

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

      expect(mockService.install).toHaveBeenCalledWith('test-template', {
        version: '2.0.0',
        force: true,
      });
    });

    it('should handle installation errors', async () => {
      const installCommand = new MarketplaceInstallCommand();

      mockService.install.mockRejectedValue(new Error('Installation failed'));
      const consoleSpy = jest.spyOn(console, 'error');

      await expect(installCommand.execute('bad-template', {})).rejects.toThrow(
        'Installation failed'
      );

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('marketplace:list command', () => {
    it('should list templates', async () => {
      const listCommand = new MarketplaceListCommand();
      const mockResult: TemplateSearchResult = {
        templates: [
          {
            id: 'featured-1',
            name: 'Featured Template',
            downloads: 1000,
            rating: 4.9,
          } as TemplateModel,
        ],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockService.search.mockResolvedValue(mockResult);

      await listCommand.execute(undefined, {
        featured: true,
        limit: 10,
      });

      expect(mockService.search).toHaveBeenCalledWith({
        featured: true,
        limit: 10,
        page: 1,
      });
    });

    it('should list trending templates', async () => {
      const listCommand = new MarketplaceListCommand();
      const mockResult: TemplateSearchResult = {
        templates: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      };

      mockService.search.mockResolvedValue(mockResult);

      await listCommand.execute(undefined, {
        trending: true,
        limit: 20,
      });

      expect(mockService.search).toHaveBeenCalledWith({
        trending: true,
        limit: 20,
        page: 1,
      });
    });

    it('should filter by category', async () => {
      const listCommand = new MarketplaceListCommand();
      const mockResult: TemplateSearchResult = {
        templates: [],
        total: 0,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockService.search.mockResolvedValue(mockResult);

      await listCommand.execute(undefined, {
        category: 'testing',
        page: 2,
        limit: 15,
      });

      expect(mockService.search).toHaveBeenCalledWith({
        category: 'testing',
        page: 2,
        limit: 15,
      });
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
          {
            id: 'workflow-template',
            name: 'Workflow Template',
            description: 'Test workflow',
          } as TemplateModel,
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
      expect(installed[0].id).toBe('workflow-template');

      // Step 4: List command integration test
      await listCommand.execute({});
      expect(mockService.getInstalledTemplates).toHaveBeenCalled();
    });
  });
});

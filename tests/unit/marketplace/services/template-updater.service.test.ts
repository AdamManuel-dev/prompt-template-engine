/**
 * @fileoverview Tests for template updater service
 * @lastmodified 2025-08-22T22:00:00Z
 */

import { TemplateUpdaterService } from '../../../../src/marketplace/services/template-updater.service';
import { MarketplaceAPI } from '../../../../src/marketplace/api/marketplace.api';
import { TemplateRegistry } from '../../../../src/marketplace/core/template.registry';
import { TemplateInstallerService } from '../../../../src/marketplace/services/template-installer.service';
import {
  TemplateModel,
  TemplateCategory,
  AuthorInfo,
  TemplateVersion,
  TemplateStats,
  TemplateMetadata,
} from '../../../../src/marketplace/models/template.model';
import * as fs from 'fs';

jest.mock('../../../../src/marketplace/api/marketplace.api');
jest.mock('../../../../src/marketplace/core/template.registry');
jest.mock('../../../../src/marketplace/services/template-installer.service');
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    copyFile: jest.fn(),
  },
}));

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

describe('TemplateUpdaterService', () => {
  let service: TemplateUpdaterService;
  let mockApi: jest.Mocked<MarketplaceAPI>;
  let mockRegistry: jest.Mocked<TemplateRegistry>;
  let mockInstaller: jest.Mocked<TemplateInstallerService>;
  const backupPath = '/test/backup/path';

  beforeEach(() => {
    mockApi = new MarketplaceAPI() as jest.Mocked<MarketplaceAPI>;
    mockRegistry = new TemplateRegistry() as jest.Mocked<TemplateRegistry>;
    
    // Mock the methods we use
    mockRegistry.getTemplate = jest.fn();
    mockRegistry.listTemplates = jest.fn();
    (mockApi as any).getTemplate = jest.fn();
    
    mockInstaller = new TemplateInstallerService(
      mockApi,
      mockRegistry,
      '/test/path'
    ) as jest.Mocked<TemplateInstallerService>;

    service = new TemplateUpdaterService(
      mockApi,
      mockRegistry,
      mockInstaller,
      backupPath
    );

    jest.clearAllMocks();
  });

  describe('update', () => {
    const installedTemplate = createMockTemplate({
      id: 'test-template',
      name: 'Test Template',
      currentVersion: '1.0.0',
    });

    const latestTemplate = createMockTemplate({
      id: 'test-template',
      name: 'Test Template',
      currentVersion: '2.0.0',
    });

    it('should update template when new version available', async () => {
      (mockRegistry.getTemplate as jest.Mock).mockResolvedValue({
        id: installedTemplate.id,
        name: installedTemplate.name,
        version: '1.0.0',
        path: '/test/path',
        metadata: installedTemplate,
        versionInfo: { version: '1.0.0' } as any,
        registered: new Date(),
        active: true,
      });
      (mockApi as any).getTemplate = jest.fn().mockResolvedValue(latestTemplate);
      mockInstaller.install.mockResolvedValue({
        success: true,
        template: latestTemplate as any,
        version: '2.0.0',
        installPath: '/test/path',
        duration: 100,
        warnings: [],
      });

      const result = await service.update('test-template');

      expect(result.success).toBe(true);
      expect(result.updated).toEqual([{
        templateId: 'test-template',
        oldVersion: '1.0.0',
        newVersion: '2.0.0'
      }]);
      expect(mockInstaller.install).toHaveBeenCalledWith('test-template', {
        force: true,
        version: '2.0.0',
      });
    });

    it('should skip update when already up to date', async () => {
      (mockRegistry.getTemplate as jest.Mock).mockResolvedValue({
        id: latestTemplate.id,
        name: latestTemplate.name,
        version: '2.0.0',
        path: '/test/path',
        metadata: latestTemplate,
        versionInfo: { version: '2.0.0' } as any,
        registered: new Date(),
        active: true,
      });
      (mockApi as any).getTemplate = jest.fn().mockResolvedValue(latestTemplate);

      const result = await service.update('test-template');

      expect(result.success).toBe(false);
      expect(result.updated).toEqual([]);
      expect(mockInstaller.install).not.toHaveBeenCalled();
    });

    it('should force update when force option is true', async () => {
      (mockRegistry.getTemplate as jest.Mock).mockResolvedValue({
        id: latestTemplate.id,
        name: latestTemplate.name,
        version: '2.0.0',
        path: '/test/path',
        metadata: latestTemplate,
        versionInfo: { version: '2.0.0' } as any,
        registered: new Date(),
        active: true,
      });
      (mockApi as any).getTemplate = jest.fn().mockResolvedValue(latestTemplate);
      mockInstaller.install.mockResolvedValue({
        success: true,
        template: latestTemplate as any,
        version: '2.0.0',
        installPath: '/test/path',
        duration: 100,
        warnings: [],
      });

      const result = await service.update('test-template', { force: true });

      expect(result.success).toBe(true);
      expect(mockInstaller.install).toHaveBeenCalled();
    });

    it('should only check for updates when checkOnly is true', async () => {
      (mockRegistry.getTemplate as jest.Mock).mockResolvedValue({
        id: installedTemplate.id,
        name: installedTemplate.name,
        version: '1.0.0',
        path: '/test/path',
        metadata: installedTemplate,
        versionInfo: { version: '1.0.0' } as any,
        registered: new Date(),
        active: true,
      });
      (mockApi as any).getTemplate = jest.fn().mockResolvedValue(latestTemplate);

      const result = await service.update('test-template', { checkOnly: true });

      expect(result.success).toBe(true);
      expect(result.updated).toHaveLength(1); // checkOnly returns what would be updated
      expect(result.updated[0]).toEqual({
        templateId: 'test-template',
        oldVersion: '1.0.0',
        newVersion: '2.0.0'
      });
      expect(mockInstaller.install).not.toHaveBeenCalled();
    });

    it('should backup template when backup option is true', async () => {
      (mockRegistry.getTemplate as jest.Mock).mockResolvedValue({
        id: installedTemplate.id,
        name: installedTemplate.name,
        version: '1.0.0',
        path: '/test/path',
        metadata: installedTemplate,
        versionInfo: { version: '1.0.0' } as any,
        registered: new Date(),
        active: true,
      });
      (mockApi as any).getTemplate = jest.fn().mockResolvedValue(latestTemplate);
      (mockRegistry as any).getTemplatesPath = jest.fn().mockReturnValue('/templates');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.promises.readdir as jest.Mock).mockResolvedValue([]);
      mockInstaller.install.mockResolvedValue({
        success: true,
        template: latestTemplate as any,
        version: '2.0.0',
        installPath: '/test/path',
        duration: 100,
        warnings: [],
      });

      await service.update('test-template', { backup: true });

      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it('should handle update errors', async () => {
      (mockRegistry.getTemplate as jest.Mock).mockResolvedValue(undefined);

      await expect(service.update('test-template')).rejects.toThrow(
        'Template test-template is not installed'
      );
    });
  });

  describe('checkUpdates', () => {
    it('should check updates for all installed templates', async () => {
      const installed = [
        {
          id: 'template-1',
          name: 'Template 1',
          version: '1.0.0',
          currentVersion: '1.0.0',
          path: '/test/path/template-1',
          metadata: createMockTemplate({ id: 'template-1', currentVersion: '1.0.0' }),
          versionInfo: { version: '1.0.0' } as any,
          registered: new Date(),
          active: true,
        },
        {
          id: 'template-2',
          name: 'Template 2',
          version: '1.5.0',
          currentVersion: '1.5.0',
          path: '/test/path/template-2',
          metadata: createMockTemplate({ id: 'template-2', currentVersion: '1.5.0' }),
          versionInfo: { version: '1.5.0' } as any,
          registered: new Date(),
          active: true,
        },
      ];

      (mockRegistry.listTemplates as jest.Mock).mockResolvedValue(installed);
      (mockApi as any).getTemplate = jest.fn()
        .mockResolvedValueOnce(createMockTemplate({
          id: 'template-1',
          currentVersion: '2.0.0',
        }))
        .mockResolvedValueOnce(createMockTemplate({
          id: 'template-2',
          currentVersion: '1.5.0',
        }));

      const results = await service.checkUpdates();

      expect(results).toHaveLength(2);
      expect(results[0].hasUpdates).toBe(true);
      expect(results[0].currentVersion).toBe('1.0.0');
      expect(results[0].latestVersion).toBe('2.0.0');
      expect(results[1].hasUpdates).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const installed: TemplateModel[] = [
        createMockTemplate({ id: 'template-1', currentVersion: '1.0.0' }),
        createMockTemplate({ id: 'template-2', currentVersion: '1.5.0' }),
      ];

      (mockRegistry.listTemplates as jest.Mock).mockResolvedValue(installed);
      (mockApi as any).getTemplate = jest.fn()
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce(createMockTemplate({
          id: 'template-2',
          currentVersion: '2.0.0',
        }));

      const results = await service.checkUpdates();

      expect(results).toHaveLength(1);
      expect(results[0].templateId).toBe('template-2');
    });
  });

  describe('updateAll', () => {
    it('should update all templates with available updates', async () => {
      const installed: TemplateModel[] = [
        createMockTemplate({ id: 'template-1', currentVersion: '1.0.0' }),
        createMockTemplate({ id: 'template-2', currentVersion: '1.5.0' }),
      ];

      (mockRegistry.listTemplates as jest.Mock).mockResolvedValue(installed);
      (mockRegistry.getTemplate as jest.Mock)
        .mockResolvedValueOnce({
          id: installed[0].id,
          name: installed[0].name,
          version: '1.0.0',
          path: '/test/path',
          metadata: installed[0],
          versionInfo: { version: '1.0.0' } as any,
          registered: new Date(),
          active: true,
        })
        .mockResolvedValueOnce({
          id: installed[1].id,
          name: installed[1].name,
          version: '1.5.0',
          path: '/test/path',
          metadata: installed[1],
          versionInfo: { version: '1.5.0' } as any,
          registered: new Date(),
          active: true,
        });

      (mockApi as any).getTemplate = jest.fn()
        .mockResolvedValueOnce(createMockTemplate({
          id: 'template-1',
          currentVersion: '2.0.0',
        }))
        .mockResolvedValueOnce(createMockTemplate({
          id: 'template-2',
          currentVersion: '1.5.0',
        }))
        .mockResolvedValueOnce(createMockTemplate({
          id: 'template-1',
          currentVersion: '2.0.0',
        }));

      mockInstaller.install.mockResolvedValue({
        success: true,
        template: {} as any,
        version: '2.0.0',
        installPath: '/test',
        duration: 100,
        warnings: [],
      });

      const results = await service.updateAll();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].templateId).toBe('template-1');
    });

    it('should handle update failures', async () => {
      const installed: TemplateModel[] = [
        createMockTemplate({ id: 'template-1', currentVersion: '1.0.0' }),
      ];

      (mockRegistry.listTemplates as jest.Mock).mockResolvedValue(installed);
      (mockRegistry.getTemplate as jest.Mock).mockResolvedValue({
        id: installed[0].id,
        name: installed[0].name,
        version: '1.0.0',
        path: '/test/path',
        metadata: installed[0],
        versionInfo: { version: '1.0.0' } as any,
        registered: new Date(),
        active: true,
      });
      (mockApi as any).getTemplate = jest.fn().mockResolvedValue(createMockTemplate({
        id: 'template-1',
        currentVersion: '2.0.0',
      }));

      mockInstaller.install.mockRejectedValue(new Error('Install failed'));

      const results = await service.updateAll();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].failed).toHaveLength(1);
    });
  });

  describe('version comparison', () => {
    it('should correctly compare semantic versions', async () => {
      const testCases = [
        { v1: '1.0.0', v2: '2.0.0', expected: true },
        { v1: '1.0.0', v2: '1.0.0', expected: false },
        { v1: '2.0.0', v2: '1.0.0', expected: false },
        { v1: '1.0.0', v2: '1.0.1', expected: true },
        { v1: '1.0.0', v2: '1.1.0', expected: true },
        { v1: '1.2.3', v2: '1.2.4', expected: true },
      ];

      for (const testCase of testCases) {
        (mockRegistry.getTemplate as jest.Mock).mockResolvedValue({
          id: 'test',
          name: 'test',
          version: testCase.v1,
          path: '/test/path',
          metadata: createMockTemplate({ id: 'test', currentVersion: testCase.v1 }),
          versionInfo: { version: testCase.v1 } as any,
          registered: new Date(),
          active: true,
        });

        (mockApi as any).getTemplate = jest.fn().mockResolvedValue(createMockTemplate({
          id: 'test',
          currentVersion: testCase.v2,
        }));

        const result = await service.update('test', { checkOnly: true });

        if (testCase.expected) {
          expect(result.success).toBe(true);
        } else {
          expect(result.updated).toEqual([]);
        }
      }
    });
  });
});

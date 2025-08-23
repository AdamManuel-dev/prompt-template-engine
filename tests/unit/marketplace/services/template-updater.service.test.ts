/**
 * @fileoverview Tests for template updater service
 * @lastmodified 2025-08-22T22:00:00Z
 */

import { TemplateUpdaterService } from '../../../../src/marketplace/services/template-updater.service';
import { MarketplaceAPI } from '../../../../src/marketplace/api/marketplace.api';
import { TemplateRegistry } from '../../../../src/marketplace/registry/template-registry';
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
jest.mock('../../../../src/marketplace/registry/template-registry');
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
      mockRegistry.get.mockResolvedValue(installedTemplate);
      mockApi.get.mockResolvedValue(latestTemplate);
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
      expect(result.fromVersion).toBe('1.0.0');
      expect(result.toVersion).toBe('2.0.0');
      expect(result.message).toBe('Update successful');
      expect(mockInstaller.install).toHaveBeenCalledWith('test-template', {
        force: true,
        version: '2.0.0',
      });
    });

    it('should skip update when already up to date', async () => {
      mockRegistry.get.mockResolvedValue(latestTemplate);
      mockApi.get.mockResolvedValue(latestTemplate);

      const result = await service.update('test-template');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Template is already up to date');
      expect(mockInstaller.install).not.toHaveBeenCalled();
    });

    it('should force update when force option is true', async () => {
      mockRegistry.get.mockResolvedValue(latestTemplate);
      mockApi.get.mockResolvedValue(latestTemplate);
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
      mockRegistry.get.mockResolvedValue(installedTemplate);
      mockApi.get.mockResolvedValue(latestTemplate);

      const result = await service.update('test-template', { checkOnly: true });

      expect(result.success).toBe(true);
      expect(result.updated).toHaveLength(0); // checkOnly doesn't perform update
      expect(mockInstaller.install).not.toHaveBeenCalled();
    });

    it('should backup template when backup option is true', async () => {
      mockRegistry.get.mockResolvedValue(installedTemplate);
      mockApi.get.mockResolvedValue(latestTemplate);
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
      mockRegistry.get.mockResolvedValue(null);

      await expect(service.update('test-template')).rejects.toThrow(
        'Template test-template is not installed'
      );
    });
  });

  describe('checkUpdates', () => {
    it('should check updates for all installed templates', async () => {
      const installed: TemplateModel[] = [
        createMockTemplate({ id: 'template-1', currentVersion: '1.0.0' }),
        createMockTemplate({ id: 'template-2', currentVersion: '1.5.0' }),
      ];

      mockRegistry.listTemplates.mockResolvedValue(installed);
      mockApi.get
        .mockResolvedValueOnce({
          id: 'template-1',
          version: '2.0.0',
        } as TemplateModel)
        .mockResolvedValueOnce({
          id: 'template-2',
          version: '1.5.0',
        } as TemplateModel);

      const results = await service.checkUpdates();

      expect(results).toHaveLength(2);
      expect(results[0].hasUpdate).toBe(true);
      expect(results[0].currentVersion).toBe('1.0.0');
      expect(results[0].latestVersion).toBe('2.0.0');
      expect(results[1].hasUpdate).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      const installed: TemplateModel[] = [
        createMockTemplate({ id: 'template-1', currentVersion: '1.0.0' }),
        createMockTemplate({ id: 'template-2', currentVersion: '1.5.0' }),
      ];

      mockRegistry.listTemplates.mockResolvedValue(installed);
      mockApi.get
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          id: 'template-2',
          version: '2.0.0',
        } as TemplateModel);

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

      mockRegistry.listTemplates.mockResolvedValue(installed);
      mockRegistry.get
        .mockResolvedValueOnce(installed[0])
        .mockResolvedValueOnce(installed[1]);

      mockApi.get
        .mockResolvedValueOnce({
          id: 'template-1',
          version: '2.0.0',
        } as TemplateModel)
        .mockResolvedValueOnce({
          id: 'template-2',
          version: '1.5.0',
        } as TemplateModel)
        .mockResolvedValueOnce({
          id: 'template-1',
          version: '2.0.0',
        } as TemplateModel);

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

      mockRegistry.listTemplates.mockResolvedValue(installed);
      mockRegistry.get.mockResolvedValue(installed[0]);
      mockApi.get.mockResolvedValue({
        id: 'template-1',
        version: '2.0.0',
      } as TemplateModel);

      mockInstaller.install.mockRejectedValue(new Error('Install failed'));

      const results = await service.updateAll();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].message).toContain('Update failed');
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
        mockRegistry.get.mockResolvedValue({
          id: 'test',
          version: testCase.v1,
        } as TemplateModel);

        mockApi.get.mockResolvedValue({
          id: 'test',
          version: testCase.v2,
        } as TemplateModel);

        const result = await service.update('test', { checkOnly: true });

        if (testCase.expected) {
          expect(result.message).toBe('Update available');
        } else {
          expect(result.message).toBe('Template is already up to date');
        }
      }
    });
  });
});

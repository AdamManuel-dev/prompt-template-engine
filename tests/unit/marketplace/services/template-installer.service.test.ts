/**
 * @fileoverview Tests for template installer service
 * @lastmodified 2025-08-22T22:00:00Z
 */

import { TemplateInstallerService } from '../../../../src/marketplace/services/template-installer.service';
import { MarketplaceAPI } from '../../../../src/marketplace/api/marketplace.api';
import { TemplateRegistry } from '../../../../src/marketplace/registry/template-registry';
import {
  TemplateModel,
  InstallationResult,
  TemplateDependency,
} from '../../../../src/marketplace/models/template.model';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../../../../src/marketplace/api/marketplace.api');
jest.mock('../../../../src/marketplace/registry/template-registry');
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
  },
}));

describe('TemplateInstallerService', () => {
  let service: TemplateInstallerService;
  let mockApi: jest.Mocked<MarketplaceAPI>;
  let mockRegistry: jest.Mocked<TemplateRegistry>;
  const installPath = '/test/install/path';

  beforeEach(() => {
    mockApi = new MarketplaceAPI() as jest.Mocked<MarketplaceAPI>;
    mockRegistry = new TemplateRegistry(
      installPath
    ) as jest.Mocked<TemplateRegistry>;
    service = new TemplateInstallerService(mockApi, mockRegistry, installPath);
    jest.clearAllMocks();
  });

  describe('install', () => {
    const mockTemplate: TemplateModel = {
      id: 'test-template',
      name: 'Test Template',
      description: 'Test description',
      version: '1.0.0',
      currentVersion: '1.0.0',
    } as TemplateModel;

    it('should install a new template', async () => {
      mockRegistry.getTemplate.mockResolvedValue(null);
      mockApi.getTemplate.mockResolvedValue(mockTemplate);
      mockApi.downloadTemplate = jest
        .fn()
        .mockResolvedValue('template content');
      mockRegistry.registerTemplate.mockResolvedValue(undefined);

      const result = await service.install('test-template');

      expect(result.success).toBe(true);
      expect(result.template.id).toBe('test-template');
      expect(result.version).toBe('1.0.0');
      expect(mockRegistry.registerTemplate).toHaveBeenCalled();
      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(2); // content + metadata
    });

    it('should skip installation if already installed without force', async () => {
      mockRegistry.getTemplate.mockResolvedValue(mockTemplate);

      const result = await service.install('test-template');

      expect(result.success).toBe(false);
      expect(result.warnings).toContain(
        'Template already installed. Use --force to reinstall.'
      );
      expect(mockApi.getTemplate).not.toHaveBeenCalled();
    });

    it('should force reinstall with force option', async () => {
      mockRegistry.getTemplate.mockResolvedValue(mockTemplate);
      mockApi.getTemplate.mockResolvedValue(mockTemplate);
      mockApi.downloadTemplate = jest
        .fn()
        .mockResolvedValue('template content');

      const result = await service.install('test-template', { force: true });

      expect(result.success).toBe(true);
      expect(mockApi.getTemplate).toHaveBeenCalled();
    });

    it('should install dependencies when requested', async () => {
      const templateWithDeps: TemplateModel = {
        ...mockTemplate,
        dependencies: [
          { templateId: 'dep-1', version: '1.0.0', required: true },
          { templateId: 'dep-2', version: '2.0.0', required: false },
        ],
      };

      mockRegistry.getTemplate.mockResolvedValue(null);
      mockApi.getTemplate.mockResolvedValue(templateWithDeps);
      mockApi.downloadTemplate = jest
        .fn()
        .mockResolvedValue('template content');

      // Mock dependency installations
      const installSpy = jest.spyOn(service, 'install');

      await service.install('test-template', { withDependencies: true });

      // Should attempt to install each dependency
      expect(installSpy).toHaveBeenCalledWith(
        'dep-1',
        expect.objectContaining({
          version: '1.0.0',
          skipConfirmation: true,
        })
      );
      expect(installSpy).toHaveBeenCalledWith(
        'dep-2',
        expect.objectContaining({
          version: '2.0.0',
          skipConfirmation: true,
        })
      );
    });

    it('should handle installation errors', async () => {
      mockRegistry.getTemplate.mockResolvedValue(null);
      mockApi.getTemplate.mockRejectedValue(new Error('API error'));

      await expect(service.install('test-template')).rejects.toThrow(
        'API error'
      );
    });
  });

  describe('quickInstall', () => {
    it('should install with default options', async () => {
      const mockTemplate: TemplateModel = {
        id: 'quick-template',
        name: 'Quick Template',
      } as TemplateModel;

      mockRegistry.getTemplate.mockResolvedValue(null);
      mockApi.getTemplate.mockResolvedValue(mockTemplate);
      mockApi.downloadTemplate = jest.fn().mockResolvedValue('content');

      const installSpy = jest.spyOn(service, 'install');

      await service.quickInstall('quick-template');

      expect(installSpy).toHaveBeenCalledWith('quick-template', {
        skipConfirmation: true,
        withDependencies: true,
      });
    });
  });

  describe('batchInstall', () => {
    it('should install multiple templates', async () => {
      const templates = ['template-1', 'template-2', 'template-3'];

      mockRegistry.getTemplate.mockResolvedValue(null);
      mockApi.getTemplate.mockImplementation(
        async id =>
          ({
            id,
            name: `Template ${id}`,
          }) as TemplateModel
      );
      mockApi.downloadTemplate = jest.fn().mockResolvedValue('content');

      const results = await service.batchInstall(templates);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should continue on error when specified', async () => {
      const templates = ['good-1', 'bad-template', 'good-2'];

      mockRegistry.getTemplate.mockResolvedValue(null);
      mockApi.getTemplate.mockImplementation(async id => {
        if (id === 'bad-template') {
          throw new Error('Template not found');
        }
        return { id, name: `Template ${id}` } as TemplateModel;
      });
      mockApi.downloadTemplate = jest.fn().mockResolvedValue('content');

      const results = await service.batchInstall(templates, {
        continueOnError: true,
      });

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].warnings[0]).toContain('Failed');
      expect(results[2].success).toBe(true);
    });

    it('should stop on error by default', async () => {
      const templates = ['good-1', 'bad-template', 'good-2'];

      mockRegistry.getTemplate.mockResolvedValue(null);
      mockApi.getTemplate.mockImplementation(async id => {
        if (id === 'bad-template') {
          throw new Error('Template not found');
        }
        return { id, name: `Template ${id}` } as TemplateModel;
      });

      await expect(service.batchInstall(templates)).rejects.toThrow(
        'Template not found'
      );
    });
  });

  describe('installWithDependencies', () => {
    it('should install template and all dependencies', async () => {
      const templateWithDeps: TemplateModel = {
        id: 'main-template',
        name: 'Main Template',
        dependencies: [
          { templateId: 'dep-1', version: '1.0.0', required: true },
        ],
      } as TemplateModel;

      mockRegistry.getTemplate.mockResolvedValue(null);
      mockApi.getTemplate.mockResolvedValue(templateWithDeps);
      mockApi.downloadTemplate = jest.fn().mockResolvedValue('content');

      const installSpy = jest.spyOn(service, 'install');

      await service.installWithDependencies('main-template');

      expect(installSpy).toHaveBeenCalledWith(
        'main-template',
        expect.objectContaining({ withDependencies: true })
      );
    });
  });
});

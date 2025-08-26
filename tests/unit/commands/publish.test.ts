/**
 * @fileoverview Unit tests for template publishing command
 * @lastmodified 2025-08-23T02:54:00Z
 *
 * Features: Publishing workflow, validation, marketplace integration
 * Main APIs: PublishCommand tests
 * Constraints: Test authentication, validation, error handling
 * Patterns: BDD testing, mock marketplace service
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PublishCommand } from '../../../src/commands/marketplace/publish';
import { MarketplaceService } from '../../../src/marketplace/core/marketplace.service';
import { AuthorService } from '../../../src/marketplace/core/author.service';
import { TemplateValidator } from '../../../src/core/template-validator';
import { TemplateModel } from '../../../src/marketplace/models/template.model';

jest.mock('fs/promises');
jest.mock('../../../src/marketplace/core/marketplace.service');
jest.mock('../../../src/marketplace/core/author.service');
jest.mock('../../../src/core/template-validator');
jest.mock('../../../src/utils/logger');

describe('PublishCommand', () => {
  let publishCommand: PublishCommand;
  let mockMarketplaceService: jest.Mocked<MarketplaceService>;
  let mockAuthorService: jest.Mocked<AuthorService>;
  let mockTemplateValidator: jest.Mocked<TemplateValidator>;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    publishCommand = new PublishCommand();
    
    mockMarketplaceService = {
      publishTemplate: jest.fn(),
      updateTemplate: jest.fn(),
      validateTemplate: jest.fn(),
      getTemplate: jest.fn(),
      authenticate: jest.fn(),
      isAuthenticated: jest.fn(),
    } as any;
    
    mockAuthorService = {
      getCurrentAuthor: jest.fn(),
      validateAuthorPermissions: jest.fn(),
      getAuthorTemplates: jest.fn(),
    } as any;
    
    mockTemplateValidator = {
      validate: jest.fn(),
      validateStructure: jest.fn(),
      validateMetadata: jest.fn(),
    } as any;

    MarketplaceService.getInstance = jest.fn().mockReturnValue(mockMarketplaceService);
    AuthorService.getInstance = jest.fn().mockReturnValue(mockAuthorService);
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    const validTemplate = {
      name: 'test-template',
      version: '1.0.0',
      description: 'Test template for publishing',
      author: 'test-author',
      tags: ['test', 'template'],
      category: 'utilities',
      files: [],
      variables: {},
      commands: {},
    };

    it('should publish a valid template successfully', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validTemplate));
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockAuthorService.getCurrentAuthor.mockResolvedValue({
        id: 'author-123',
        username: 'test-author',
        email: 'test@example.com',
      });
      mockMarketplaceService.publishTemplate.mockResolvedValue({
        id: 'template-123',
        ...validTemplate,
        publishedAt: new Date(),
      });

      await publishCommand.execute('test-template', {});

      expect(mockMarketplaceService.publishTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-template',
          version: '1.0.0',
        })
      );
    });

    it('should validate template before publishing', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validTemplate));
      mockTemplateValidator.validate.mockResolvedValue({
        valid: false,
        errors: ['Missing required field: license'],
      });

      await expect(
        publishCommand.execute('test-template', {})
      ).rejects.toThrow('Template validation failed');

      expect(mockMarketplaceService.publishTemplate).not.toHaveBeenCalled();
    });

    it('should require authentication before publishing', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validTemplate));
      mockMarketplaceService.isAuthenticated.mockResolvedValue(false);

      await expect(
        publishCommand.execute('test-template', {})
      ).rejects.toThrow('Authentication required');

      expect(mockMarketplaceService.publishTemplate).not.toHaveBeenCalled();
    });

    it('should handle version conflicts', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validTemplate));
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockMarketplaceService.getTemplate.mockResolvedValue({
        ...validTemplate,
        version: '1.0.0',
      });

      await expect(
        publishCommand.execute('test-template', {})
      ).rejects.toThrow('Version 1.0.0 already exists');
    });

    it('should allow force publishing with --force flag', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validTemplate));
      mockTemplateValidator.validate.mockResolvedValue({
        valid: true,
        warnings: ['Large file size detected'],
      });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockMarketplaceService.publishTemplate.mockResolvedValue({
        id: 'template-123',
        ...validTemplate,
      });

      await publishCommand.execute('test-template', { force: true });

      expect(mockMarketplaceService.publishTemplate).toHaveBeenCalled();
    });

    it('should publish as draft when --draft flag is set', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validTemplate));
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockMarketplaceService.publishTemplate.mockResolvedValue({
        id: 'template-123',
        ...validTemplate,
        draft: true,
      });

      await publishCommand.execute('test-template', { draft: true });

      expect(mockMarketplaceService.publishTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: true,
        })
      );
    });

    it('should publish as private when --private flag is set', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validTemplate));
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockMarketplaceService.publishTemplate.mockResolvedValue({
        id: 'template-123',
        ...validTemplate,
        private: true,
      });

      await publishCommand.execute('test-template', { private: true });

      expect(mockMarketplaceService.publishTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          private: true,
        })
      );
    });

    it('should handle custom version with --version flag', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validTemplate));
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockMarketplaceService.publishTemplate.mockResolvedValue({
        id: 'template-123',
        ...validTemplate,
        version: '2.0.0',
      });

      await publishCommand.execute('test-template', { version: '2.0.0' });

      expect(mockMarketplaceService.publishTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '2.0.0',
        })
      );
    });

    it('should validate semantic version format', async () => {
      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validTemplate));

      await expect(
        publishCommand.execute('test-template', { version: 'invalid-version' })
      ).rejects.toThrow('Invalid version format');
    });

    it('should handle template with dependencies', async () => {
      const templateWithDeps = {
        ...validTemplate,
        dependencies: {
          'other-template': '^1.0.0',
          'base-template': '~2.0.0',
        },
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(templateWithDeps));
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockMarketplaceService.validateDependencies = jest.fn().mockResolvedValue(true);
      mockMarketplaceService.publishTemplate.mockResolvedValue({
        id: 'template-123',
        ...templateWithDeps,
      });

      await publishCommand.execute('test-template', {});

      expect(mockMarketplaceService.validateDependencies).toHaveBeenCalledWith(
        templateWithDeps.dependencies
      );
    });
  });

  describe('template validation', () => {
    it('should validate required fields', async () => {
      const incompleteTemplate = {
        name: 'test-template',
        // missing version and description
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(incompleteTemplate));

      await expect(
        publishCommand.execute('test-template', {})
      ).rejects.toThrow('Missing required fields');
    });

    it('should validate template structure', async () => {
      const malformedTemplate = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Test',
        files: 'should-be-array', // Invalid structure
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(malformedTemplate));

      await expect(
        publishCommand.execute('test-template', {})
      ).rejects.toThrow('Invalid template structure');
    });

    it('should validate file paths exist', async () => {
      const templateWithFiles = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Test',
        files: ['./src/template.ts', './README.md'],
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(templateWithFiles));
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(
        publishCommand.execute('test-template', {})
      ).rejects.toThrow('Template file not found');
    });

    it('should check for sensitive information', async () => {
      const templateWithSecrets = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Test',
        variables: {
          api_key: {
            default: 'sk-1234567890abcdef', // Looks like a secret
          },
        },
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(templateWithSecrets));

      await expect(
        publishCommand.execute('test-template', {})
      ).rejects.toThrow('Potential secrets detected');
    });

    it('should validate license information', async () => {
      const templateWithoutLicense = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Test',
        // missing license
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(templateWithoutLicense));

      await expect(
        publishCommand.execute('test-template', { force: false })
      ).rejects.toThrow('License information required');
    });
  });

  describe('marketplace integration', () => {
    it('should handle network errors gracefully', async () => {
      const validTemplate = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Test',
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validTemplate));
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockMarketplaceService.publishTemplate.mockRejectedValue(
        new Error('Network error')
      );

      await expect(
        publishCommand.execute('test-template', {})
      ).rejects.toThrow('Failed to publish template: Network error');
    });

    it('should handle rate limiting', async () => {
      const validTemplate = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Test',
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(validTemplate));
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockMarketplaceService.publishTemplate.mockRejectedValue(
        new Error('Rate limit exceeded')
      );

      await expect(
        publishCommand.execute('test-template', {})
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should update existing template when author owns it', async () => {
      const existingTemplate = {
        id: 'template-123',
        name: 'test-template',
        version: '1.0.0',
        author: 'test-author',
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingTemplate));
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockAuthorService.getCurrentAuthor.mockResolvedValue({
        username: 'test-author',
      });
      mockMarketplaceService.getTemplate.mockResolvedValue(existingTemplate);
      mockMarketplaceService.updateTemplate.mockResolvedValue({
        ...existingTemplate,
        version: '1.1.0',
      });

      await publishCommand.execute('test-template', { version: '1.1.0' });

      expect(mockMarketplaceService.updateTemplate).toHaveBeenCalled();
      expect(mockMarketplaceService.publishTemplate).not.toHaveBeenCalled();
    });

    it('should not allow updating template owned by another author', async () => {
      const existingTemplate = {
        id: 'template-123',
        name: 'test-template',
        version: '1.0.0',
        author: 'other-author',
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(existingTemplate));
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockAuthorService.getCurrentAuthor.mockResolvedValue({
        username: 'test-author',
      });
      mockMarketplaceService.getTemplate.mockResolvedValue(existingTemplate);

      await expect(
        publishCommand.execute('test-template', { version: '1.1.0' })
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('file handling', () => {
    it('should bundle template files correctly', async () => {
      const template = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Test',
        files: ['template.json', 'README.md', 'src/**/*.ts'],
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(template));
      mockFs.readdir.mockResolvedValue(['file1.ts', 'file2.ts'] as any);
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);

      await publishCommand.execute('test-template', {});

      expect(mockFs.readdir).toHaveBeenCalled();
    });

    it('should exclude ignored files', async () => {
      const template = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Test',
        files: ['**/*'],
        ignore: ['node_modules', '*.test.ts', '.git'],
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(template));
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);

      await publishCommand.execute('test-template', {});

      // Verify ignored patterns are applied
      expect(mockMarketplaceService.publishTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.not.arrayContaining(['node_modules', '.git']),
        })
      );
    });

    it('should validate file size limits', async () => {
      const template = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Test',
        files: ['large-file.zip'],
      };

      mockFs.stat
        .mockResolvedValueOnce({ isDirectory: () => true } as any)
        .mockResolvedValueOnce({ size: 100 * 1024 * 1024 } as any); // 100MB

      mockFs.readFile.mockResolvedValue(JSON.stringify(template));

      await expect(
        publishCommand.execute('test-template', {})
      ).rejects.toThrow('File size exceeds limit');
    });
  });

  describe('metadata enhancement', () => {
    it('should add publishing metadata', async () => {
      const template = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Test',
      };

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile.mockResolvedValue(JSON.stringify(template));
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);
      mockAuthorService.getCurrentAuthor.mockResolvedValue({
        id: 'author-123',
        username: 'test-author',
      });

      await publishCommand.execute('test-template', {
        category: 'utilities',
        tags: 'cli,tool',
      });

      expect(mockMarketplaceService.publishTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'utilities',
          tags: ['cli', 'tool'],
          author: expect.objectContaining({
            id: 'author-123',
            username: 'test-author',
          }),
          publishedAt: expect.any(Date),
        })
      );
    });

    it('should generate README preview', async () => {
      const template = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Test',
      };
      const readmeContent = '# Test Template\n\nThis is a test template.';

      mockFs.stat.mockResolvedValue({ isDirectory: () => true } as any);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(template))
        .mockResolvedValueOnce(readmeContent);
      mockTemplateValidator.validate.mockResolvedValue({ valid: true, errors: [] });
      mockMarketplaceService.isAuthenticated.mockResolvedValue(true);

      await publishCommand.execute('test-template', {});

      expect(mockMarketplaceService.publishTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          readme: readmeContent,
        })
      );
    });
  });
});
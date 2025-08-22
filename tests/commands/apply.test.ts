/**
 * @fileoverview Tests for apply command functionality
 * @lastmodified 2025-08-22T15:30:00Z
 *
 * Features: Tests template application with various scenarios
 * Main APIs: applyCommand function with options
 * Constraints: Requires valid templates and file system operations
 * Patterns: Command testing with mocked dependencies
 */

import * as fs from 'fs';
import * as path from 'path';
import { applyCommand, ApplyOptions } from '../../src/commands/apply';
import { TemplateEngine } from '../../src/core/template-engine';
import { TemplateValidator } from '../../src/core/template-validator';
import { loadConfig } from '../../src/utils/config';
import { logger } from '../../src/utils/logger';

// Mock all dependencies
jest.mock('fs');
jest.mock('path');
jest.mock('../../src/core/template-engine');
jest.mock('../../src/core/template-validator');
jest.mock('../../src/utils/config');
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    blue: jest.fn((str: string) => str),
    red: jest.fn((str: string) => str),
    green: jest.fn((str: string) => str),
    yellow: jest.fn((str: string) => str),
    cyan: jest.fn((str: string) => str),
    gray: jest.fn((str: string) => str),
  },
}));

// Type the mocked modules
const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;
const mockLoadConfig = loadConfig as jest.MockedFunction<typeof loadConfig>;
const MockTemplateEngine = TemplateEngine as jest.MockedClass<typeof TemplateEngine>;
const MockTemplateValidator = TemplateValidator as jest.MockedClass<typeof TemplateValidator>;

describe('Apply Command', () => {
  let mockTemplateEngine: jest.Mocked<TemplateEngine>;
  let mockTemplateValidator: jest.Mocked<TemplateValidator>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods since logger uses console under the hood
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    
    // Mock logger methods as well for direct testing
    jest.spyOn(logger, 'info').mockImplementation();
    jest.spyOn(logger, 'error').mockImplementation();
    jest.spyOn(logger, 'warn').mockImplementation();
    jest.spyOn(logger, 'success').mockImplementation();
    jest.spyOn(logger, 'debug').mockImplementation();
    
    // Setup default mocks
    mockTemplateEngine = {
      render: jest.fn(),
    } as any;
    mockTemplateValidator = {
      validate: jest.fn(),
    } as any;

    MockTemplateEngine.mockImplementation(() => mockTemplateEngine);
    MockTemplateValidator.mockImplementation(() => mockTemplateValidator);

    // Default config mock
    mockLoadConfig.mockResolvedValue({
      templatePaths: ['/mock/templates'],
      projectName: 'test-project',
      outputPath: './output',
      defaultTemplate: 'default',
      variables: {},
      formats: { default: 'markdown', supported: ['markdown', 'json'] },
      features: { clipboard: true, preview: true, validation: true, autoBackup: false },
      metadata: { version: '1.0.0', created: '2025-01-01', lastModified: '2025-01-01' }
    });

    // Default validation success
    mockTemplateValidator.validate.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: []
    });

    // Mock path methods
    mockPath.join.mockImplementation((...args: string[]) => args.join('/'));
    mockPath.resolve.mockImplementation((p: string) => `/resolved/${p}`);
    mockPath.dirname.mockImplementation((p: string) => p.split('/').slice(0, -1).join('/') || '/');
    mockPath.basename.mockImplementation((p: string) => {
      if (p === '/mock/cwd') return 'test-project';
      return p.split('/').pop() || p;
    });
    mockPath.extname.mockImplementation((p: string) => {
      const parts = p.split('.');
      return parts.length > 1 ? `.${parts.pop()}` : '';
    });

    // Mock process.cwd()
    jest.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');

    // Mock Date
    const mockDate = new Date('2025-08-22T15:30:00Z');
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);
    (global.Date as any).prototype.toISOString = () => '2025-08-22T15:30:00.000Z';
    (global.Date as any).prototype.getFullYear = () => 2025;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('applyCommand', () => {
    it('should successfully apply a template', async () => {
      const templateName = 'test-template';
      const mockTemplate = {
        name: 'Test Template',
        description: 'A test template',
        version: '1.0.0',
        files: [
          {
            path: 'test-file.md',
            content: 'Test content'
          }
        ]
      };

      // Mock file system operations
      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/test-template.json') return true;
        if (path === '/resolved/test-file.md') return false;
        if (path === '/resolved') return false;
        return false;
      });
      
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
      mockFs.writeFileSync.mockImplementation();
      mockFs.mkdirSync.mockImplementation();

      await applyCommand(templateName);

      // Test core functionality
      expect(mockFs.writeFileSync).toHaveBeenCalledWith('/resolved/test-file.md', 'Test content', 'utf8');
      expect(logger.info).toHaveBeenCalled(); // Called at least once
      expect(logger.success).toHaveBeenCalled(); // Called at least once
    });

    it('should throw error when template is not found', async () => {
      const templateName = 'nonexistent-template';

      mockFs.existsSync.mockReturnValue(false);

      await expect(applyCommand(templateName)).rejects.toThrow("Template 'nonexistent-template' not found");
      
      expect(logger.error).toHaveBeenCalled(); // Should log error
    });

    it('should throw error when template validation fails', async () => {
      const templateName = 'invalid-template';
      const mockTemplate = { name: 'Invalid Template' };

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/invalid-template.json') return true;
        return false;
      });
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));

      mockTemplateValidator.validate.mockResolvedValue({
        valid: false,
        errors: ['Missing required field: version', 'Invalid file structure'],
        warnings: []
      });

      await expect(applyCommand(templateName)).rejects.toThrow('Invalid template');

      expect(logger.error).toHaveBeenCalled(); // Should log validation errors
    });

    it('should run in preview mode without modifying files', async () => {
      const templateName = 'preview-template';
      const mockTemplate = {
        name: 'Preview Template',
        description: 'A template for preview',
        version: '1.0.0',
        files: [
          {
            path: 'preview-file.md',
            content: 'Preview content'
          }
        ],
        variables: {
          testVar: {
            type: 'string',
            default: 'default-value'
          }
        }
      };
      
      const options: ApplyOptions = { preview: true };

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/preview-template.json') return true;
        if (path === 'preview-file.md') return false;
        return false;
      });
      
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));

      await applyCommand(templateName, options);

      expect(logger.info).toHaveBeenCalled(); // Should log preview information
      expect(mockFs.writeFileSync).not.toHaveBeenCalled(); // Should not write files in preview mode
    });

    it('should handle force overwrite mode', async () => {
      const templateName = 'overwrite-template';
      const mockTemplate = {
        name: 'Overwrite Template',
        files: [
          {
            path: 'existing-file.md',
            content: 'New content'
          }
        ]
      };
      
      const options: ApplyOptions = { force: true };

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/overwrite-template.json') return true;
        if (path === '/resolved/existing-file.md') return true; // File exists
        return false;
      });
      
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
      mockFs.writeFileSync.mockImplementation();

      await applyCommand(templateName, options);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith('/resolved/existing-file.md', 'New content', 'utf8');
      expect(logger.info).toHaveBeenCalled(); // Should log file update
    });

    it('should skip existing files when force is false', async () => {
      const templateName = 'skip-template';
      const mockTemplate = {
        name: 'Skip Template',
        files: [
          {
            path: 'existing-file.md',
            content: 'New content'
          }
        ]
      };

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/skip-template.json') return true;
        if (path === '/resolved/existing-file.md') return true; // File exists
        return false;
      });
      
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));

      await applyCommand(templateName, {});

      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled(); // Should warn about skipped file
    });

    it('should handle variable substitution', async () => {
      const templateName = 'variable-template';
      const mockTemplate = {
        name: 'Variable Template',
        files: [
          {
            path: 'variable-file.md',
            template: 'Hello {{name}}!'
          }
        ]
      };
      
      const options: ApplyOptions = {
        variables: { name: 'World' }
      };

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/variable-template.json') return true;
        if (path === '/resolved/variable-file.md') return false;
        if (path === '/resolved') return false;
        return false;
      });
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
      mockFs.writeFileSync.mockImplementation();

      mockTemplateEngine.render.mockResolvedValue('Hello World!');

      await applyCommand(templateName, options);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith(
        'Hello {{name}}!',
        expect.objectContaining({ name: 'World' })
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        '/resolved/variable-file.md',
        'Hello World!',
        'utf8'
      );
    });

    it('should handle template from directory', async () => {
      const templateName = 'dir-template';
      const mockTemplate = {
        name: 'Directory Template',
        files: [{ path: 'dir-file.md', content: 'Directory content' }]
      };

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/dir-template/template.json') return true;
        return false;
      });
      
      mockFs.statSync.mockReturnValue({ isDirectory: () => true } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
      mockFs.writeFileSync.mockImplementation();

      await applyCommand(templateName);

      expect(mockFs.readFileSync).toHaveBeenCalledWith('/mock/templates/dir-template/template.json', 'utf8');
      expect(mockFs.writeFileSync).toHaveBeenCalledWith('/resolved/dir-file.md', 'Directory content', 'utf8');
    });

    it('should handle YAML template rejection', async () => {
      const templateName = 'yaml-template';

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/yaml-template.yaml') return true;
        return false;
      });
      
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue('name: YAML Template');

      await expect(applyCommand(templateName)).rejects.toThrow('YAML templates not yet supported');
    });

    it('should handle unsupported template format', async () => {
      const templateName = 'unsupported-template.xml';

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/unsupported-template.xml') return true;
        return false;
      });
      
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue('<template></template>');

      await expect(applyCommand(templateName)).rejects.toThrow('Unsupported template format: .xml');
    });

    it('should create directories when they do not exist', async () => {
      const templateName = 'nested-template';
      const mockTemplate = {
        name: 'Nested Template',
        files: [
          {
            path: 'nested/deep/file.md',
            content: 'Nested content'
          }
        ]
      };

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/nested-template.json') return true;
        if (path === '/resolved/nested/deep') return false; // Directory doesn't exist
        return false;
      });
      
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
      mockFs.writeFileSync.mockImplementation();
      mockFs.mkdirSync.mockImplementation();

      await applyCommand(templateName);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith('/resolved/nested/deep', { recursive: true });
      expect(mockFs.writeFileSync).toHaveBeenCalledWith('/resolved/nested/deep/file.md', 'Nested content', 'utf8');
    });

    it('should handle file processing errors gracefully', async () => {
      const templateName = 'error-template';
      const mockTemplate = {
        name: 'Error Template',
        files: [
          {
            path: 'good-file.md',
            content: 'Good content'
          },
          {
            path: 'bad-file.md',
            content: 'Bad content'
          }
        ]
      };

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/error-template.json') return true;
        if (path === '/resolved/good-file.md') return false;
        if (path === '/resolved/bad-file.md') return false;
        if (path === '/resolved') return false;
        return false;
      });
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
      mockFs.mkdirSync.mockImplementation();
      
      mockFs.writeFileSync.mockImplementation((path: any) => {
        if (path === '/resolved/bad-file.md') {
          throw new Error('Permission denied');
        }
      });

      await expect(applyCommand(templateName)).rejects.toThrow('Template application failed');

      expect(logger.info).toHaveBeenCalled(); // Should log successful file creation
      expect(logger.error).toHaveBeenCalled(); // Should log errors
    });

    it('should include default variables in context', async () => {
      const templateName = 'default-vars-template';
      const mockTemplate = {
        name: 'Default Variables Template',
        files: [
          {
            path: 'vars-file.md',
            template: 'Project: {{projectName}}, Year: {{year}}'
          }
        ]
      };

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/default-vars-template.json') return true;
        if (path === '/resolved/vars-file.md') return false;
        if (path === '/resolved') return false;
        return false;
      });
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
      mockFs.writeFileSync.mockImplementation();

      mockTemplateEngine.render.mockResolvedValue('Project: test-project, Year: 2025');

      await applyCommand(templateName);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith(
        'Project: {{projectName}}, Year: {{year}}',
        expect.objectContaining({
          projectName: 'test-project',
          projectPath: '/mock/cwd',
          timestamp: '2025-08-22T15:30:00.000Z',
          year: 2025
        })
      );
    });

    it('should show preview for variables with defaults', async () => {
      const templateName = 'preview-vars-template';
      const mockTemplate = {
        name: 'Preview Variables Template',
        description: 'Template with variables',
        version: '2.0.0',
        variables: {
          username: {
            type: 'string',
            default: 'admin',
            description: 'The username'
          },
          port: {
            type: 'number',
            default: 3000
          }
        },
        files: [
          {
            path: 'config.json',
            template: '{"username": "{{username}}", "port": {{port}}}'
          }
        ],
        commands: [
          {
            command: 'npm install',
            description: 'Install dependencies'
          }
        ]
      };
      
      const options: ApplyOptions = { 
        preview: true,
        variables: { username: 'custom-user' }
      };

      mockFs.existsSync.mockImplementation((path: any) => {
        if (path === '/mock/templates/preview-vars-template.json') return true;
        if (path === 'config.json') return false;
        return false;
      });
      
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));

      await applyCommand(templateName, options);

      expect(logger.info).toHaveBeenCalled(); // Should log preview information
      expect(mockFs.writeFileSync).not.toHaveBeenCalled(); // Should not write files in preview mode
    });

    it('should handle multiple template directories', async () => {
      const templateName = 'multi-dir-template';
      const mockTemplate = {
        name: 'Multi Directory Template',
        files: [{ path: 'multi-file.md', content: 'Multi content' }]
      };

      // Mock config with multiple template paths
      mockLoadConfig.mockResolvedValue({
        templatePaths: ['/mock/templates1', '/mock/templates2', '/mock/templates3'],
        projectName: 'test-project',
        outputPath: './output',
        defaultTemplate: 'default',
        variables: {},
        formats: { default: 'markdown', supported: ['markdown', 'json'] },
        features: { clipboard: true, preview: true, validation: true, autoBackup: false },
        metadata: { version: '1.0.0', created: '2025-01-01', lastModified: '2025-01-01' }
      });

      mockFs.existsSync.mockImplementation((path: any) => {
        // Template found in second directory
        if (path === '/mock/templates2/multi-dir-template.json') return true;
        return false;
      });
      
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockTemplate));
      mockFs.writeFileSync.mockImplementation();

      await applyCommand(templateName);

      expect(mockFs.readFileSync).toHaveBeenCalledWith('/mock/templates2/multi-dir-template.json', 'utf8');
      expect(mockFs.writeFileSync).toHaveBeenCalledWith('/resolved/multi-file.md', 'Multi content', 'utf8');
    });

    it('should handle JSON parsing errors', async () => {
      const templateName = 'invalid-json-template';

      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ isDirectory: () => false } as any);
      mockFs.readFileSync.mockReturnValue('{ invalid json }');

      await expect(applyCommand(templateName)).rejects.toThrow();
    });
  });
});
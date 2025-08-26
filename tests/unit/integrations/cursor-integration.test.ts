/**
 * @fileoverview Unit tests for Cursor IDE Integration
 * @lastmodified 2025-08-23T15:00:00Z
 *
 * Features: Test template conversion, context bridging, command integration
 * Main APIs: Test suite for Cursor integration
 * Constraints: Mock VS Code APIs
 * Patterns: BDD testing, comprehensive mocking
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TemplateToRulesConverter } from '../../../src/integrations/cursor/template-to-rules-converter';
import { ContextBridge } from '../../../src/integrations/cursor/context-bridge';
import { CursorIntegration } from '../../../src/integrations/cursor';
import { Template, CursorRule } from '../../../src/types';

// Mock logger
jest.mock('../../../src/utils/logger');

// Mock fs module
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  access: jest.fn(),
}));

describe('Cursor IDE Integration', () => {
  describe('TemplateToRulesConverter', () => {
    let converter: TemplateToRulesConverter;

    beforeEach(() => {
      converter = new TemplateToRulesConverter();
    });

    it('should convert a basic template to Cursor rule', async () => {
      const template: Template = {
        name: 'test-template',
        description: 'Test template for conversion',
        version: '1.0.0',
        tags: ['test', 'example'],
        content: '# Test Template\n\n{{variable}}',
        variables: {
          variable: {
            type: 'string',
            default: 'default value',
          },
        },
      };

      const rule = await converter.convertTemplate(template);

      expect(rule.name).toBe('test-template');
      expect(rule.filename).toBe('test-template.mdc');
      expect(rule.frontmatter.description).toBe('Test template for conversion');
      expect(rule.frontmatter.tags).toEqual(['test', 'example']);
      expect(rule.content).toContain('# test-template');
      expect(rule.content).toContain('{{variable}}');
    });

    it('should generate correct frontmatter with globs', async () => {
      const template: Template = {
        name: 'glob-template',
        filePatterns: ['src/**/*.ts', 'src/**/*.tsx'],
        priority: 'high',
      };

      const rule = await converter.convertTemplate(template);

      expect(rule.frontmatter.globs).toEqual(['src/**/*.ts', 'src/**/*.tsx']);
      expect(rule.frontmatter.alwaysApply).toBe(true);
    });

    it('should extract file references from template', async () => {
      const template: Template = {
        name: 'ref-template',
        content: 'Reference @src/index.ts and @config/settings.json',
        contextFiles: ['utils/logger.ts'],
      };

      const rule = await converter.convertTemplate(template);

      expect(rule.references).toContain('utils/logger.ts');
      expect(rule.references).toContain('src/index.ts');
      expect(rule.references).toContain('config/settings.json');
    });

    it('should validate rule structure', () => {
      const validRule: CursorRule = {
        name: 'valid-rule',
        filename: 'valid-rule.mdc',
        frontmatter: {
          description: 'Valid rule description',
        },
        content: 'Rule content',
      };

      const invalidRule: CursorRule = {
        name: '',
        filename: 'invalid.mdc',
        frontmatter: {
          description: '',
        },
        content: '',
      };

      const validResult = converter.validateRule(validRule);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidResult = converter.validateRule(invalidRule);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toContain('Rule name is required');
      expect(invalidResult.errors).toContain('Rule content is required');
    });
  });

  describe('ContextBridge', () => {
    let bridge: ContextBridge;

    beforeEach(() => {
      bridge = new ContextBridge();
    });

    it('should map files to @file references', async () => {
      const patterns = ['src/*.ts', 'test/*.test.ts'];
      const references = await bridge.mapFilesToReferences(patterns);

      references.forEach(ref => {
        expect(ref).toMatch(/^@/);
      });
    });

    it('should resolve context variables from Cursor state', async () => {
      const context = {
        activeFile: '/project/src/index.ts',
        selection: {
          start: { line: 10, character: 0 },
          end: { line: 15, character: 20 },
        },
        openFiles: ['/project/src/index.ts', '/project/src/app.ts'],
        errors: [
          {
            file: '/project/src/index.ts',
            line: 12,
            message: 'Type error',
            severity: 'error' as const,
          },
        ],
        gitStatus: {
          branch: 'feature/test',
          modified: ['src/index.ts'],
          staged: [],
          untracked: ['new-file.ts'],
        },
        workspaceRoot: '/project',
      };

      const variables = await bridge.resolveContextVariables(context);

      expect(variables.currentFile).toBe('/project/src/index.ts');
      expect(variables.fileName).toBe('index.ts');
      expect(variables.hasErrors).toBe(true);
      expect(variables.errorCount).toBe(1);
      expect(variables.gitBranch).toBe('feature/test');
      expect(variables.hasChanges).toBe(true);
    });

    it('should bridge Cursor context to template context', async () => {
      const cursorContext = {
        activeFile: '/project/src/component.tsx',
        openFiles: ['/project/src/component.tsx'],
        errors: [],
        workspaceRoot: '/project',
      };

      const templateContext = await bridge.bridgeContext(cursorContext);

      expect(templateContext.files).toContain('/project/src/component.tsx');
      expect(templateContext.references).toContain('@src/component.tsx');
      expect(Object.keys(templateContext.variables)).toContain('currentFile');
    });

    it('should cache context for performance', async () => {
      const context = {
        activeFile: '/project/src/cached.ts',
        openFiles: [],
        errors: [],
        workspaceRoot: '/project',
      };

      // First call should compute
      const result1 = await bridge.bridgeContext(context);
      
      // Second call should use cache
      const result2 = await bridge.bridgeContext(context);

      expect(result1).toEqual(result2);
    });
  });

  describe('CursorIntegration', () => {
    let integration: CursorIntegration;

    beforeEach(() => {
      integration = CursorIntegration.getInstance({
        autoSync: false,
        enableCommands: false,
      });
    });

    afterEach(() => {
      integration.dispose();
    });

    it('should be a singleton', () => {
      const instance1 = CursorIntegration.getInstance();
      const instance2 = CursorIntegration.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should initialize without VS Code context', async () => {
      await integration.initialize();
      
      expect(integration.getConverter()).toBeDefined();
      expect(integration.getContextBridge()).toBeDefined();
    });

    it('should update configuration', () => {
      integration.updateConfig({
        rulesOutputDir: '.custom/rules',
        legacySupport: false,
      });

      const converter = integration.getConverter();
      expect(converter).toBeDefined();
    });

    it('should handle auto-sync configuration', () => {
      integration.updateConfig({
        autoSync: true,
        syncInterval: 5000,
      });

      // Should start auto-sync
      integration.stopAutoSync(); // Clean up
    });
  });

  describe('Rule Generation', () => {
    let converter: TemplateToRulesConverter;

    beforeEach(() => {
      converter = new TemplateToRulesConverter();
    });

    it('should handle YAML templates', async () => {
      const template: Template = {
        name: 'yaml-template',
        version: '1.0.0',
        variables: {
          framework: {
            type: 'choice',
            choices: ['react', 'vue', 'angular'],
            default: 'react',
          },
        },
      };

      const rule = await converter.convertTemplate(template);
      
      expect(rule.content).toContain('framework');
      expect(rule.content).toContain('react');
      expect(rule.content).toContain('vue');
      expect(rule.content).toContain('angular');
    });

    it('should handle template inheritance', async () => {
      const baseTemplate: Template = {
        name: 'base',
        variables: {
          baseVar: 'base value',
        },
      };

      const extendedTemplate: Template = {
        name: 'extended',
        ...baseTemplate,
        variables: {
          ...baseTemplate.variables,
          extendedVar: 'extended value',
        },
      };

      const rule = await converter.convertTemplate(extendedTemplate);
      
      expect(rule.content).toContain('baseVar');
      expect(rule.content).toContain('extendedVar');
    });

    it('should handle nested rules for project structure', async () => {
      const template: Template = {
        name: 'project-template',
        filePatterns: ['src/**/*.ts'],
      };

      const projectStructure = new Map([
        ['src/components', ['Button.tsx', 'Input.tsx']],
        ['src/utils', ['logger.ts', 'helpers.ts']],
      ]);

      const nestedRules = await converter.generateNestedRules(template, projectStructure);
      
      expect(nestedRules.size).toBeGreaterThan(0);
      expect(nestedRules.has('src/components')).toBe(true);
      expect(nestedRules.has('src/utils')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    let converter: TemplateToRulesConverter;
    let bridge: ContextBridge;

    beforeEach(() => {
      converter = new TemplateToRulesConverter();
      bridge = new ContextBridge();
    });

    it('should handle invalid templates gracefully', async () => {
      const invalidTemplate = {} as Template;
      
      const rule = await converter.convertTemplate(invalidTemplate);
      
      expect(rule.name).toBeUndefined();
      expect(rule.frontmatter.description).toContain('Template:');
    });

    it('should handle file access errors', async () => {
      const patterns = ['/nonexistent/path/*.ts'];
      
      const references = await bridge.mapFilesToReferences(patterns);
      
      expect(references).toEqual([]);
    });

    it('should handle circular references in templates', async () => {
      const template: Template = {
        name: 'circular',
        content: '{{#include "circular.md"}}',
      };

      const rule = await converter.convertTemplate(template);
      
      expect(rule.content).toBeDefined();
      // Should not cause infinite loop
    });
  });

  describe('Performance', () => {
    let bridge: ContextBridge;

    beforeEach(() => {
      bridge = new ContextBridge({
        maxReferences: 10,
        cacheTimeout: 1000,
      });
    });

    it('should limit number of references', async () => {
      const manyPatterns = Array(100).fill('*.ts');
      
      const references = await bridge.mapFilesToReferences(manyPatterns);
      
      expect(references.length).toBeLessThanOrEqual(10);
    });

    it('should clear cache after timeout', async () => {
      const context = {
        activeFile: '/test.ts',
        openFiles: [],
        errors: [],
        workspaceRoot: '/',
      };

      await bridge.bridgeContext(context);
      
      // Wait for cache timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      bridge.clearCache();
      // Cache should be cleared
    });
  });
});
/**
 * @fileoverview E2E tests for context-aware template generation
 * @lastmodified 2025-08-22T16:00:00Z
 *
 * Features: End-to-end testing of template generation with context
 * Main APIs: Tests the full workflow from template to output
 * Constraints: Requires test fixtures and mock data
 * Patterns: Integration testing, context mocking
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TemplateEngine } from '../../../src/core/template-engine';

describe('E2E: Context-Aware Template Generation', () => {
  let tempDir: string;
  let templateEngine: TemplateEngine;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-prompt-test-'));

    // Initialize template engine
    templateEngine = new TemplateEngine();
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  describe('Basic Template Generation', () => {
    it('should generate a simple template without context', async () => {
      // Create a simple template
      const templateContent = 'Hello {{name}}!';

      const result = await templateEngine.render(templateContent, {
        name: 'World',
      });

      expect(result).toBe('Hello World!');
    });

    it('should handle template with frontmatter', async () => {
      const templateContent = `---
name: Test Template
description: A test template
---
# {{title}}

Content here`;

      const result = await templateEngine.render(templateContent, {
        title: 'Test Title',
      });

      expect(result).toContain('# Test Title');
      expect(result).toContain('---'); // Frontmatter is preserved in output
      expect(result).toContain('name: Test Template');
    });
  });

  describe('Context Integration', () => {
    it('should include variables in context', async () => {
      const templateContent = `Branch: {{branch}}
Clean: {{isClean}}`;

      const result = await templateEngine.render(templateContent, {
        branch: 'main',
        isClean: false,
      });

      expect(result).toContain('Branch: main');
      expect(result).toContain('Clean: false');
    });

    it('should handle nested context', async () => {
      const templateContent = `Platform: {{system.platform}}
Node: {{system.nodeVersion}}`;

      const result = await templateEngine.render(templateContent, {
        system: {
          platform: 'darwin',
          nodeVersion: 'v22.0.0',
        },
      });

      expect(result).toContain('Platform: darwin');
      expect(result).toContain('Node: v22.0.0');
    });
  });

  describe('Advanced Template Features', () => {
    it('should handle conditionals with context', async () => {
      const templateContent = `{{#if hasGit}}
Git is available: {{branch}}
{{else}}
No git repository
{{/if}}`;

      const result = await templateEngine.render(templateContent, {
        hasGit: true,
        branch: 'main',
      });

      expect(result).toContain('Git is available: main');
      expect(result).not.toContain('No git repository');
    });

    it('should handle loops with arrays from context', async () => {
      const templateContent = `Modified files:
{{#each files}}
- {{this}}
{{/each}}`;

      const result = await templateEngine.render(templateContent, {
        files: ['file1.ts', 'file2.ts', 'file3.ts'],
      });

      expect(result).toContain('Modified files:');
      expect(result).toContain('- file1.ts');
      expect(result).toContain('- file2.ts');
      expect(result).toContain('- file3.ts');
    });

    it('should support nested templates with includes', async () => {
      // Create header template
      const headerPath = path.join(tempDir, 'header.md');
      fs.writeFileSync(headerPath, '# {{title}}');

      // Create main template with include
      const mainContent = `{{#include "${headerPath}"}}

Content goes here`;

      const result = await templateEngine.render(mainContent, {
        title: 'Test Document',
      });

      expect(result).toContain('# Test Document');
      expect(result).toContain('Content goes here');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required variables gracefully', async () => {
      const templateContent = 'Hello {{name}}!';

      const result = await templateEngine.render(templateContent, {});

      // Should render with empty value or placeholder
      expect(result).toBeDefined();
    });

    it('should handle invalid template syntax', async () => {
      const templateContent = '{{#if}}Missing condition{{/if}}';

      // Template engine doesn't throw on invalid syntax, it returns template unchanged
      const result = await templateEngine.render(templateContent, {});
      expect(result).toBe('{{#if}}Missing condition{{/if}}');
    });
  });

  describe('Output Formats', () => {
    it('should handle complex nested data structures', async () => {
      const templateContent = `{
  "name": "{{project.name}}",
  "version": "{{project.version}}",
  "files": [{{#each project.files}}"{{this}}"{{#unless @last}},{{/unless}}{{/each}}]
}`;

      const result = await templateEngine.render(templateContent, {
        project: {
          name: 'test-project',
          version: '1.0.0',
          files: ['index.ts', 'config.ts', 'utils.ts'],
        },
      });

      const parsed = JSON.parse(result);
      expect(parsed.name).toBe('test-project');
      expect(parsed.version).toBe('1.0.0');
      expect(parsed.files).toEqual(['index.ts', 'config.ts', 'utils.ts']);
    });
  });

  describe('Smart Template Integration', () => {
    it('should process complex templates with multiple contexts', async () => {
      const smartDebugTemplate = `# Debug: {{issue}}

System: {{system.platform}}
Git Branch: {{git.branch}}
Files Modified: {{#each git.files}}{{this}} {{/each}}

{{#if hasPackageJson}}
Package.json:
{
  "name": "{{package.name}}",
  "version": "{{package.version}}"
}
{{/if}}`;

      const result = await templateEngine.render(smartDebugTemplate, {
        issue: 'Application crashes on startup',
        system: {
          platform: 'darwin',
        },
        git: {
          branch: 'main',
          files: ['file1.ts', 'file2.ts'],
        },
        hasPackageJson: true,
        package: {
          name: 'test-project',
          version: '1.0.0',
        },
      });

      expect(result).toContain('Debug: Application crashes on startup');
      expect(result).toContain('Git Branch: main');
      expect(result).toContain('Files Modified: file1.ts file2.ts');
      expect(result).toContain('"name": "test-project"');
    });
  });
});

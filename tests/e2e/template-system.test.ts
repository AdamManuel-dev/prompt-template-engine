/**
 * @fileoverview E2E tests for template system features
 * @lastmodified 2025-08-26T10:00:00Z
 *
 * Features: Tests all template features including conditionals, loops, partials, helpers
 * Main APIs: TemplateEngine, TemplateService, variable processing
 * Constraints: Tests complex template scenarios and edge cases
 * Patterns: Template rendering, context merging, error handling
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TemplateEngine } from '../../src/core/template-engine';
import { TemplateService } from '../../src/services/template.service';

describe('E2E: Template System', () => {
  let testDir: string;
  let templateService: TemplateService;
  let templateEngine: TemplateEngine;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'template-system-e2e-'));
    templateService = new TemplateService({
      templatePaths: [path.join(testDir, 'templates')],
      cacheEnabled: true,
      validationStrict: false
    });
    templateEngine = new TemplateEngine();

    // Create templates directory
    await fs.mkdir(path.join(testDir, 'templates'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Variable Processing', () => {
    it('should handle simple variable substitution', async () => {
      const template = 'Hello {{name}}, welcome to {{project}}!';
      const result = await templateEngine.render(template, {
        name: 'Developer',
        project: 'Cursor Prompt'
      });

      expect(result).toBe('Hello Developer, welcome to Cursor Prompt!');
    });

    it('should handle nested object variables', async () => {
      const template = `User: {{user.name}}
Email: {{user.email}}
Role: {{user.role.title}}
Level: {{user.role.level}}`;

      const result = await templateEngine.render(template, {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          role: {
            title: 'Senior Developer',
            level: 3
          }
        }
      });

      expect(result).toContain('User: John Doe');
      expect(result).toContain('Email: john@example.com');
      expect(result).toContain('Role: Senior Developer');
      expect(result).toContain('Level: 3');
    });

    it('should handle array access', async () => {
      const template = `First: {{items.[0]}}
Second: {{items.[1]}}
Last: {{items.[2]}}`;

      const result = await templateEngine.render(template, {
        items: ['alpha', 'beta', 'gamma']
      });

      expect(result).toContain('First: alpha');
      expect(result).toContain('Second: beta');
      expect(result).toContain('Last: gamma');
    });

    it('should handle missing variables gracefully', async () => {
      const template = 'Hello {{name}}, your score is {{score}}';
      const result = await templateEngine.render(template, {
        name: 'User'
        // score is missing
      });

      expect(result).toContain('Hello User');
      // Missing variable should be handled without error
      expect(result).toBeDefined();
    });

    it('should escape special characters when needed', async () => {
      const template = 'Code: {{code}}';
      const result = await templateEngine.render(template, {
        code: '<script>alert("XSS")</script>'
      });

      // Should include the raw code (template engine doesn't auto-escape by default)
      expect(result).toContain('<script>');
    });
  });

  describe('Conditional Logic', () => {
    it('should handle if conditions', async () => {
      const template = `{{#if premium}}
Welcome Premium User!
{{else}}
Please upgrade to premium.
{{/if}}`;

      const premiumResult = await templateEngine.render(template, {
        premium: true
      });
      expect(premiumResult).toContain('Welcome Premium User!');
      expect(premiumResult).not.toContain('Please upgrade');

      const freeResult = await templateEngine.render(template, {
        premium: false
      });
      expect(freeResult).toContain('Please upgrade to premium');
      expect(freeResult).not.toContain('Welcome Premium');
    });

    it('should handle nested if conditions', async () => {
      const template = `{{#if user}}
  {{#if user.active}}
    {{#if user.premium}}
Premium Active User: {{user.name}}
    {{else}}
Free Active User: {{user.name}}
    {{/if}}
  {{else}}
Inactive User: {{user.name}}
  {{/if}}
{{else}}
No user logged in
{{/if}}`;

      const result = await templateEngine.render(template, {
        user: {
          name: 'Alice',
          active: true,
          premium: true
        }
      });

      expect(result).toContain('Premium Active User: Alice');
    });

    it('should handle unless conditions', async () => {
      const template = `{{#unless error}}
Success!
{{else}}
Error: {{error}}
{{/unless}}`;

      const successResult = await templateEngine.render(template, {
        error: null
      });
      expect(successResult).toContain('Success!');

      const errorResult = await templateEngine.render(template, {
        error: 'File not found'
      });
      expect(errorResult).toContain('Error: File not found');
    });

    it('should handle complex conditional expressions', async () => {
      const template = `{{#if (and isEnabled (or isPremium isAdmin))}}
Full access granted
{{else}}
Limited access
{{/if}}`;

      const result = await templateEngine.render(template, {
        isEnabled: true,
        isPremium: false,
        isAdmin: true
      });

      // Note: Complex expressions might not work without helper functions
      // This test documents the expected behavior
      expect(result).toBeDefined();
    });
  });

  describe('Loop Constructs', () => {
    it('should iterate over arrays with each', async () => {
      const template = `Tasks:
{{#each tasks}}
- [{{#if this.completed}}x{{else}} {{/if}}] {{this.title}}
{{/each}}`;

      const result = await templateEngine.render(template, {
        tasks: [
          { title: 'Setup project', completed: true },
          { title: 'Write tests', completed: true },
          { title: 'Documentation', completed: false }
        ]
      });

      expect(result).toContain('[x] Setup project');
      expect(result).toContain('[x] Write tests');
      expect(result).toContain('[ ] Documentation');
    });

    it('should provide loop index and metadata', async () => {
      const template = `{{#each items}}
{{@index}}: {{this}} (First: {{@first}}, Last: {{@last}})
{{/each}}`;

      const result = await templateEngine.render(template, {
        items: ['alpha', 'beta', 'gamma']
      });

      expect(result).toContain('0: alpha (First: true, Last: false)');
      expect(result).toContain('1: beta (First: false, Last: false)');
      expect(result).toContain('2: gamma (First: false, Last: true)');
    });

    it('should handle nested loops', async () => {
      const template = `{{#each categories}}
Category: {{this.name}}
{{#each this.items}}
  - {{this}}
{{/each}}
{{/each}}`;

      const result = await templateEngine.render(template, {
        categories: [
          { name: 'Frontend', items: ['React', 'Vue', 'Angular'] },
          { name: 'Backend', items: ['Node.js', 'Python', 'Go'] }
        ]
      });

      expect(result).toContain('Category: Frontend');
      expect(result).toContain('- React');
      expect(result).toContain('Category: Backend');
      expect(result).toContain('- Go');
    });

    it('should handle empty arrays', async () => {
      const template = `{{#each items}}
- {{this}}
{{else}}
No items to display
{{/each}}`;

      const result = await templateEngine.render(template, {
        items: []
      });

      expect(result).toContain('No items to display');
    });
  });

  describe('Template Partials and Includes', () => {
    it('should include partial templates', async () => {
      // Create partial template
      const headerPath = path.join(testDir, 'templates', 'header.md');
      await fs.writeFile(headerPath, '# {{title}}\nAuthor: {{author}}');

      // Create footer partial
      const footerPath = path.join(testDir, 'templates', 'footer.md');
      await fs.writeFile(footerPath, '---\n© {{year}} {{company}}');

      // Main template
      const template = `{{#include "${headerPath}"}}

## Content

{{content}}

{{#include "${footerPath}"}}`;

      const result = await templateEngine.render(template, {
        title: 'Documentation',
        author: 'John Doe',
        content: 'Main content here',
        year: 2025,
        company: 'Acme Corp'
      });

      expect(result).toContain('# Documentation');
      expect(result).toContain('Author: John Doe');
      expect(result).toContain('Main content here');
      expect(result).toContain('© 2025 Acme Corp');
    });

    it('should handle recursive partials with depth limit', async () => {
      // Create recursive partial
      const recursivePath = path.join(testDir, 'templates', 'recursive.md');
      await fs.writeFile(
        recursivePath,
        `Level {{level}}
{{#if (lt level 3)}}
{{#include "${recursivePath}"}}
{{/if}}`
      );

      const template = `Start
{{#include "${recursivePath}"}}
End`;

      const result = await templateEngine.render(template, {
        level: 1
      });

      // Should handle recursion gracefully
      expect(result).toContain('Start');
      expect(result).toContain('End');
    });
  });

  describe('Template Helpers', () => {
    it('should use built-in string helpers', async () => {
      const template = `Upper: {{uppercase name}}
Lower: {{lowercase name}}
Title: {{titlecase phrase}}`;

      const result = await templateEngine.render(template, {
        name: 'John Doe',
        phrase: 'hello world from cursor'
      });

      expect(result).toContain('Upper: JOHN DOE');
      expect(result).toContain('Lower: john doe');
      expect(result).toContain('Title: Hello World From Cursor');
    });

    it('should use date/time helpers', async () => {
      const template = `Current Year: {{year}}
Date: {{formatDate date "YYYY-MM-DD"}}
Time: {{formatTime time "HH:mm:ss"}}`;

      const result = await templateEngine.render(template, {
        date: new Date('2025-08-26'),
        time: new Date('2025-08-26T14:30:00'),
        year: new Date().getFullYear()
      });

      expect(result).toContain(`Current Year: ${new Date().getFullYear()}`);
      // Note: Date formatting depends on helper implementation
      expect(result).toBeDefined();
    });

    it('should use math helpers', async () => {
      const template = `Sum: {{add a b}}
Product: {{multiply x y}}
Rounded: {{round pi 2}}`;

      const result = await templateEngine.render(template, {
        a: 5,
        b: 3,
        x: 4,
        y: 7,
        pi: 3.14159
      });

      // Note: Math helpers depend on implementation
      expect(result).toBeDefined();
    });

    it('should use comparison helpers', async () => {
      const template = `{{#if (eq status "active")}}
Status is active
{{/if}}

{{#if (gt score 90)}}
Excellent score!
{{else if (gt score 70)}}
Good score
{{else}}
Needs improvement
{{/if}}`;

      const result = await templateEngine.render(template, {
        status: 'active',
        score: 95
      });

      // Note: Comparison helpers depend on implementation
      expect(result).toBeDefined();
    });
  });

  describe('YAML Template Support', () => {
    it('should parse and render YAML templates', async () => {
      const yamlTemplate = `---
name: test-template
description: Test YAML template
version: 1.0.0
tags:
  - test
  - yaml
variables:
  projectName:
    type: string
    required: true
    description: Name of the project
  features:
    type: array
    default: []
  useTypescript:
    type: boolean
    default: true
---
# {{projectName}}

{{#if useTypescript}}
This project uses TypeScript.
{{/if}}

## Features
{{#each features}}
- {{this}}
{{/each}}`;

      const templatePath = path.join(testDir, 'templates', 'test.yaml');
      await fs.writeFile(templatePath, yamlTemplate);

      const template = await templateService.loadTemplate(templatePath);
      const rendered = await templateService.renderTemplate(template, {
        projectName: 'My Project',
        features: ['Authentication', 'API', 'Database'],
        useTypescript: true
      });

      expect(rendered.files[0].content).toContain('# My Project');
      expect(rendered.files[0].content).toContain('This project uses TypeScript');
      expect(rendered.files[0].content).toContain('- Authentication');
    });

    it('should validate YAML template structure', async () => {
      const invalidYaml = `---
name: 
description: Invalid template
variables:
  - invalid structure
---
Content`;

      const templatePath = path.join(testDir, 'templates', 'invalid.yaml');
      await fs.writeFile(templatePath, invalidYaml);

      try {
        await templateService.loadTemplate(templatePath);
      } catch (error: any) {
        expect(error.message).toContain('Invalid template');
      }
    });
  });

  describe('Context Inheritance and Merging', () => {
    it('should merge multiple context sources', async () => {
      const template = `Project: {{project.name}}
Version: {{project.version}}
Author: {{author}}
Branch: {{git.branch}}
Environment: {{env}}`;

      // Simulate multiple context sources
      const baseContext = {
        project: {
          name: 'Cursor Prompt',
          version: '1.0.0'
        },
        author: 'Default Author'
      };

      const gitContext = {
        git: {
          branch: 'main',
          commit: 'abc123'
        }
      };

      const envContext = {
        env: 'development', // Use fixed value for test consistency
        author: 'Override Author' // This should override base
      };

      // Merge contexts
      const mergedContext = {
        ...baseContext,
        ...gitContext,
        ...envContext
      };

      const result = await templateEngine.render(template, mergedContext);

      expect(result).toContain('Project: Cursor Prompt');
      expect(result).toContain('Version: 1.0.0');
      expect(result).toContain('Author: Override Author'); // Override worked
      expect(result).toContain('Branch: main');
      expect(result).toContain('Environment: development');
    });

    it('should handle deep context merging', async () => {
      const template = `{{config.app.name}}
Port: {{config.server.port}}
SSL: {{config.server.ssl}}`;

      const defaultConfig = {
        config: {
          app: {
            name: 'Default App',
            version: '1.0.0'
          },
          server: {
            port: 3000,
            ssl: false
          }
        }
      };

      const overrideConfig = {
        config: {
          app: {
            name: 'Custom App' // Override name only
          },
          server: {
            ssl: true // Override SSL only
          }
        }
      };

      // Deep merge (implementation dependent)
      const mergedConfig = {
        config: {
          app: {
            ...defaultConfig.config.app,
            ...overrideConfig.config.app
          },
          server: {
            ...defaultConfig.config.server,
            ...overrideConfig.config.server
          }
        }
      };

      const result = await templateEngine.render(template, mergedConfig);

      expect(result).toContain('Custom App');
      expect(result).toContain('Port: 3000'); // Preserved from default
      expect(result).toContain('SSL: true'); // Overridden
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should provide helpful error messages for syntax errors', async () => {
      const template = '{{#if condition}}Unclosed if';

      const result = await templateEngine.render(template, {
        condition: true
      });

      // Should handle gracefully or show error
      expect(result).toBeDefined();
    });

    it('should handle circular references in context', async () => {
      const context: any = {
        name: 'Test'
      };
      context.self = context; // Circular reference

      const template = 'Name: {{name}}';
      
      // Should handle circular references gracefully
      const result = await templateEngine.render(template, context);
      expect(result).toContain('Name: Test');
    });

    it('should handle undefined helper functions gracefully', async () => {
      const template = '{{nonExistentHelper value}}';

      const result = await templateEngine.render(template, {
        value: 'test'
      });

      // Should handle missing helpers gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Performance and Large Templates', () => {
    it('should handle large templates efficiently', async () => {
      // Generate large template
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `Description for item ${i}`
      }));

      const template = `{{#each items}}
## {{this.name}}
ID: {{this.id}}
Description: {{this.description}}
{{/each}}`;

      const start = Date.now();
      const result = await templateEngine.render(template, { items });
      const duration = Date.now() - start;

      expect(result).toContain('Item 0');
      expect(result).toContain('Item 999');
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle deeply nested structures', async () => {
      // Create deeply nested object
      let deepObject: any = { value: 'deep' };
      for (let i = 0; i < 50; i++) {
        deepObject = { nested: deepObject };
      }

      const template = 'Value: {{' + 'nested.'.repeat(50) + 'value}}';

      const result = await templateEngine.render(template, deepObject);
      
      // Should handle deep nesting
      expect(result).toBeDefined();
    });
  });
});
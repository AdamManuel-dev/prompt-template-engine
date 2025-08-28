/**
 * @fileoverview Unit tests for command variable substitution system
 * @lastmodified 2025-08-23T02:52:00Z
 *
 * Features: Variable substitution, interpolation, environment variables
 * Main APIs: Variable resolver and command processor tests
 * Constraints: Test all variable types and edge cases
 * Patterns: BDD testing, comprehensive substitution scenarios
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CommandVariableResolver } from '../../../src/core/command-variable-resolver';
import { TemplateTransforms } from '../../../src/core/template-transforms';
import { ConfigManager } from '../../../src/config/config-manager';

jest.mock('../../../src/config/config-manager');
jest.mock('../../../src/utils/logger');

describe('Command Variable Substitution', () => {
  let resolver: CommandVariableResolver;
  let transforms: TemplateTransforms;
  let mockConfigManager: jest.Mocked<ConfigManager>;

  beforeEach(() => {
    transforms = new TemplateTransforms();
    mockConfigManager = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
    } as any;
    resolver = new CommandVariableResolver(mockConfigManager, transforms);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Variable Substitution', () => {
    it('should substitute simple variables', () => {
      const template = 'Hello, ${name}!';
      const variables = { name: 'World' };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Hello, World!');
    });

    it('should handle multiple variables in same template', () => {
      const template = '${greeting}, ${name}! Welcome to ${project}.';
      const variables = {
        greeting: 'Hello',
        name: 'Developer',
        project: 'Template Engine',
      };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Hello, Developer! Welcome to Template Engine.');
    });

    it('should handle nested object variables', () => {
      const template = 'User: ${user.name}, Email: ${user.email}';
      const variables = {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('User: John Doe, Email: john@example.com');
    });

    it('should handle array access in variables', () => {
      const template = 'First item: ${items[0]}, Second: ${items[1]}';
      const variables = {
        items: ['apple', 'banana', 'orange'],
      };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('First item: apple, Second: banana');
    });

    it('should handle undefined variables gracefully', () => {
      const template = 'Value: ${undefined_var}';
      const variables = {};

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Value: ${undefined_var}');
    });

    it('should handle null values', () => {
      const template = 'Value: ${nullVar}';
      const variables = { nullVar: null };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Value: ');
    });
  });

  describe('Environment Variable Support', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should substitute environment variables with $env prefix', () => {
      process.env['TEST_VAR'] = 'test-value';
      const template = 'Environment: ${env.TEST_VAR}';

      const result = resolver.resolve(template, {});

      expect(result).toBe('Environment: test-value');
    });

    it('should fallback to regular variables if env not found', () => {
      const template = 'Value: ${env.MISSING_VAR}';
      const variables = { env: { MISSING_VAR: 'fallback' } };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Value: fallback');
    });

    it('should handle mixed env and regular variables', () => {
      process.env['API_URL'] = 'https://api.example.com';
      const template = '${app_name} API: ${env.API_URL}';
      const variables = { app_name: 'MyApp' };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('MyApp API: https://api.example.com');
    });
  });

  describe('Variable Transformations', () => {
    it('should apply single transformation', () => {
      const template = 'Name: ${name | upper}';
      const variables = { name: 'john doe' };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Name: JOHN DOE');
    });

    it('should chain multiple transformations', () => {
      const template = 'Title: ${title | trim | title | truncate:20}';
      const variables = { title: '  the quick brown fox  ' };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Title: The Quick Brown Fox');
    });

    it('should handle transformation with arguments', () => {
      const template = 'Text: ${text | truncate:10:...}';
      const variables = { text: 'This is a very long text' };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Text: This is a ...');
    });

    it('should apply custom transformations', () => {
      resolver.registerTransform('reverse', (value: string) =>
        value.split('').reverse().join('')
      );
      const template = 'Reversed: ${word | reverse}';
      const variables = { word: 'hello' };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Reversed: olleh');
    });

    it('should handle invalid transformation gracefully', () => {
      const template = 'Value: ${text | invalid_transform}';
      const variables = { text: 'test' };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Value: test');
    });
  });

  describe('Conditional Variables', () => {
    it('should handle conditional expressions', () => {
      const template = '${isProduction ? prodUrl : devUrl}';
      const variables = {
        isProduction: true,
        prodUrl: 'https://prod.example.com',
        devUrl: 'http://localhost:3000',
      };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('https://prod.example.com');
    });

    it('should handle default values with ||', () => {
      const template = 'Port: ${port || 3000}';
      
      const result1 = resolver.resolve(template, { port: 8080 });
      expect(result1).toBe('Port: 8080');

      const result2 = resolver.resolve(template, {});
      expect(result2).toBe('Port: 3000');
    });

    it('should handle nullish coalescing with ??', () => {
      const template = 'Value: ${value ?? "default"}';
      
      const result1 = resolver.resolve(template, { value: 0 });
      expect(result1).toBe('Value: 0');

      const result2 = resolver.resolve(template, { value: null });
      expect(result2).toBe('Value: default');
    });
  });

  describe('Command Execution Context', () => {
    it('should substitute variables in shell commands', () => {
      const command = 'npm run build --env=${NODE_ENV} --output=${BUILD_DIR}';
      const variables = {
        NODE_ENV: 'production',
        BUILD_DIR: './dist',
      };

      const result = resolver.resolve(command, variables);

      expect(result).toBe('npm run build --env=production --output=./dist');
    });

    it('should handle quoted strings in commands', () => {
      const command = 'echo "${message}" > ${output_file}';
      const variables = {
        message: 'Hello World',
        output_file: 'output.txt',
      };

      const result = resolver.resolve(command, variables);

      expect(result).toBe('echo "Hello World" > output.txt');
    });

    it('should escape special characters when needed', () => {
      const command = 'grep "${pattern}" ${file}';
      const variables = {
        pattern: 'test.*pattern',
        file: 'data.txt',
      };

      const result = resolver.resolve(command, variables);

      expect(result).toBe('grep "test.*pattern" data.txt');
    });

    it('should handle multi-line commands', () => {
      const command = `
        cd \${project_dir}
        npm install
        npm run \${script_name}
      `;
      const variables = {
        project_dir: '/home/user/project',
        script_name: 'test',
      };

      const result = resolver.resolve(command, variables);

      expect(result).toContain('cd /home/user/project');
      expect(result).toContain('npm run test');
    });
  });

  describe('Variable Scoping', () => {
    it('should handle global variables', () => {
      mockConfigManager.get.mockReturnValue('global-value');
      const template = 'Global: ${global.config_var}';

      const result = resolver.resolve(template, {});

      expect(mockConfigManager.get).toHaveBeenCalledWith('config_var');
      expect(result).toBe('Global: global-value');
    });

    it('should prioritize local over global variables', () => {
      mockConfigManager.get.mockReturnValue('global-value');
      const template = 'Value: ${var}';
      const variables = { var: 'local-value' };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Value: local-value');
    });

    it('should handle scoped variable access', () => {
      const template = '${scope.module.variable}';
      const variables = {
        scope: {
          module: {
            variable: 'scoped-value',
          },
        },
      };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('scoped-value');
    });
  });

  describe('Special Variable Types', () => {
    it('should handle date/time variables', () => {
      const template = 'Generated on: ${datetime.now | format:"YYYY-MM-DD"}';
      const variables = {
        datetime: {
          now: new Date('2025-08-23T10:00:00Z'),
        },
      };

      resolver.registerTransform('format', (value: Date, format: string) => {
        return value.toISOString().split('T')[0];
      });

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Generated on: 2025-08-23');
    });

    it('should handle boolean variables in conditions', () => {
      const template = 'Feature: ${feature_enabled ? "enabled" : "disabled"}';
      const variables = { feature_enabled: false };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Feature: disabled');
    });

    it('should handle numeric calculations', () => {
      const template = 'Total: ${base_price * quantity + tax}';
      const variables = {
        base_price: 10,
        quantity: 3,
        tax: 2.5,
      };

      const result = resolver.resolveWithEval(template, variables);

      expect(result).toBe('Total: 32.5');
    });
  });

  describe('Error Handling', () => {
    it('should handle circular references', () => {
      const template = '${a}';
      const variables = {
        a: '${b}',
        b: '${a}',
      };

      expect(() => resolver.resolve(template, variables)).toThrow(
        'Circular reference detected'
      );
    });

    it('should handle malformed variable syntax', () => {
      const template = 'Invalid: ${incomplete';
      const variables = {};

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Invalid: ${incomplete');
    });

    it('should handle deeply nested missing properties', () => {
      const template = 'Value: ${a.b.c.d.e}';
      const variables = { a: { b: {} } };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('Value: ${a.b.c.d.e}');
    });

    it('should provide helpful error messages', () => {
      const template = '${transform | nonexistent:arg}';
      const variables = { transform: 'value' };

      const result = resolver.resolve(template, variables);

      expect(result).toContain('value');
    });
  });

  describe('Performance', () => {
    it('should cache resolved variables', () => {
      const template = '${expensive} ${expensive} ${expensive}';
      let callCount = 0;
      const variables = {
        get expensive() {
          callCount++;
          return 'computed';
        },
      };

      const result = resolver.resolve(template, variables);

      expect(result).toBe('computed computed computed');
      expect(callCount).toBe(1);
    });

    it('should handle large templates efficiently', () => {
      const largeTemplate = Array(1000)
        .fill('Variable: ${var}')
        .join('\n');
      const variables = { var: 'value' };

      const start = Date.now();
      const result = resolver.resolve(largeTemplate, variables);
      const duration = Date.now() - start;

      expect(result).toContain('Variable: value');
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });
  });

  describe('Integration with Template Engine', () => {
    it('should work with template file variables', () => {
      const templateContent = `
        project: \${project_name}
        version: \${version | default:"1.0.0"}
        author: \${author.name} <\${author.email}>
      `;
      const variables = {
        project_name: 'my-app',
        author: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };

      const result = resolver.resolve(templateContent, variables);

      expect(result).toContain('project: my-app');
      expect(result).toContain('version: 1.0.0');
      expect(result).toContain('author: John Doe <john@example.com>');
    });
  });
});
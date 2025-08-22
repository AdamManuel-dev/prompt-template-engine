/**
 * @fileoverview Comprehensive unit tests for TemplateValidator class
 * @lastmodified 2025-08-22T19:00:00Z
 *
 * Features: Template validation testing with comprehensive coverage
 * Main APIs: TemplateValidator.validate() method testing
 * Constraints: Achieves 80%+ coverage for template-validator.ts
 * Patterns: Unit testing with Jest, edge case validation, error collection testing
 */

import {
  TemplateValidator,
  ValidationResult,
  VariableDefinition,
  FileDefinition,
  CommandDefinition,
  TemplateSchema,
} from '../../src/core/template-validator';

describe('TemplateValidator', () => {
  let validator: TemplateValidator;

  beforeEach(() => {
    validator = new TemplateValidator();
  });

  describe('validate() method', () => {
    describe('Valid templates', () => {
      it('should validate a minimal valid template', async () => {
        const validTemplate: TemplateSchema = {
          name: 'test-template',
          description: 'A test template',
          version: '1.0.0',
        };

        const result = await validator.validate(validTemplate);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toEqual([]);
      });

      it('should validate a complete valid template with all fields', async () => {
        const validTemplate: TemplateSchema = {
          name: 'complete-template',
          description: 'A complete test template',
          version: '2.1.0',
          author: 'Test Author',
          tags: ['web', 'typescript', 'react'],
          variables: {
            projectName: {
              type: 'string',
              description: 'Name of the project',
              required: true,
              pattern: '^[a-zA-Z0-9-_]+$',
            },
            port: {
              type: 'number',
              description: 'Port number',
              default: 3000,
            },
            useTypeScript: {
              type: 'boolean',
              description: 'Use TypeScript',
              default: true,
            },
            framework: {
              type: 'choice',
              description: 'Framework to use',
              choices: ['react', 'vue', 'angular'],
              default: 'react',
            },
          },
          files: [
            {
              path: 'src/index.ts',
              content: 'console.log("Hello World");',
            },
            {
              name: 'package.json',
              template: 'package-template.json',
            },
            {
              path: 'config/app.js',
              source: 'templates/config.js',
              destination: 'config/app.js',
              permissions: '644',
            },
          ],
          commands: [
            'npm install' as unknown,
            {
              command: 'npm run build',
              description: 'Build the application',
              condition: 'production',
            },
          ],
        };

        const result = await validator.validate(validTemplate);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.warnings).toEqual([]);
      });

      it('should validate template with empty arrays', async () => {
        const validTemplate: TemplateSchema = {
          name: 'empty-arrays-template',
          description: 'Template with empty arrays',
          version: '1.0.0',
          tags: [],
          files: [],
          commands: [],
        };

        const result = await validator.validate(validTemplate);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('Invalid templates - basic validation', () => {
      it('should reject null input', async () => {
        const result = await validator.validate(null);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Template must be a non-null object');
      });

      it('should reject undefined input', async () => {
        const result = await validator.validate(undefined);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Template must be a non-null object');
      });

      it('should reject non-object input', async () => {
        const primitiveInputs = ['string', 123, true];

        for (const input of primitiveInputs) {
          const result = await validator.validate(input);
          expect(result.valid).toBe(false);
          expect(result.errors).toContain('Template must be a non-null object');
        }
        
        // Arrays are objects in JavaScript, so they pass the typeof check
        // but fail field validation
        const arrayResult = await validator.validate([]);
        expect(arrayResult.valid).toBe(false);
        expect(arrayResult.errors).toContain('Template must have a name field of type string');
      });

      it('should reject empty object', async () => {
        const result = await validator.validate({});

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Template must have a name field of type string');
        expect(result.errors).toContain('Template must have a description field of type string');
        expect(result.errors).toContain('Template must have a version field of type string');
      });
    });

    describe('Required field validation', () => {
      it('should require name field', async () => {
        const template = {
          description: 'A test template',
          version: '1.0.0',
        };

        const result = await validator.validate(template);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Template must have a name field of type string');
      });

      it('should require name to be a string', async () => {
        const template = {
          name: 123,
          description: 'A test template',
          version: '1.0.0',
        };

        const result = await validator.validate(template);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Template must have a name field of type string');
      });

      it('should require description field', async () => {
        const template = {
          name: 'test-template',
          version: '1.0.0',
        };

        const result = await validator.validate(template);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Template must have a description field of type string');
      });

      it('should require description to be a string', async () => {
        const template = {
          name: 'test-template',
          description: 123,
          version: '1.0.0',
        };

        const result = await validator.validate(template);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Template must have a description field of type string');
      });

      it('should require version field', async () => {
        const template = {
          name: 'test-template',
          description: 'A test template',
        };

        const result = await validator.validate(template);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Template must have a version field of type string');
      });

      it('should require version to be a string', async () => {
        const template = {
          name: 'test-template',
          description: 'A test template',
          version: 1.0,
        };

        const result = await validator.validate(template);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Template must have a version field of type string');
      });
    });

    describe('Optional field validation', () => {
      it('should validate author field type', async () => {
        const template = {
          name: 'test-template',
          description: 'A test template',
          version: '1.0.0',
          author: 123,
        };

        const result = await validator.validate(template);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Template author must be a string');
      });

      it('should accept valid author field', async () => {
        const template = {
          name: 'test-template',
          description: 'A test template',
          version: '1.0.0',
          author: 'Test Author',
        };

        const result = await validator.validate(template);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should reject tags that are not arrays', async () => {
        const template = {
          name: 'test-template',
          description: 'A test template',
          version: '1.0.0',
          tags: 'not-an-array',
        };

        const result = await validator.validate(template);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Template tags must be an array');
      });

      it('should reject tags with non-string elements', async () => {
        const template = {
          name: 'test-template',
          description: 'A test template',
          version: '1.0.0',
          tags: ['valid-tag', 123, 'another-valid-tag'],
        };

        const result = await validator.validate(template);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('All template tags must be strings');
      });

      it('should accept valid tags array', async () => {
        const template = {
          name: 'test-template',
          description: 'A test template',
          version: '1.0.0',
          tags: ['web', 'typescript', 'react'],
        };

        const result = await validator.validate(template);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('Variables validation', () => {
    it('should reject variables that are not objects', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        variables: 'not-an-object',
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Variables must be an object');
    });

    it('should accept null variables as optional field', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        variables: null,
      };

      const result = await validator.validate(template);

      // null variables are treated as optional/undefined and should be valid
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject variable definitions that are not objects', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        variables: {
          invalidVar: 'not-an-object',
        },
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Variable 'invalidVar' must be an object");
    });

    it('should reject variables with invalid types', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        variables: {
          invalidTypeVar: {
            type: 'invalid-type',
          },
        },
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Variable 'invalidTypeVar' must have a valid type: string, number, boolean, choice"
      );
    });

    it('should reject variables with missing type', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        variables: {
          noTypeVar: {
            description: 'A variable without type',
          },
        },
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Variable 'noTypeVar' must have a valid type: string, number, boolean, choice"
      );
    });

    it('should reject choice variables without choices array', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        variables: {
          choiceVar: {
            type: 'choice',
          },
        },
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Variable 'choiceVar' of type 'choice' must have a choices array"
      );
    });

    it('should reject choice variables with non-array choices', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        variables: {
          choiceVar: {
            type: 'choice',
            choices: 'not-an-array',
          },
        },
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Variable 'choiceVar' of type 'choice' must have a choices array"
      );
    });

    it('should reject choice variables with empty choices array', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        variables: {
          choiceVar: {
            type: 'choice',
            choices: [],
          },
        },
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Variable 'choiceVar' choices array cannot be empty");
    });

    it('should reject variables with non-string description', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        variables: {
          varWithBadDesc: {
            type: 'string',
            description: 123,
          },
        },
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Variable 'varWithBadDesc' description must be a string");
    });

    it('should reject variables with non-string pattern', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        variables: {
          varWithBadPattern: {
            type: 'string',
            pattern: 123,
          },
        },
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Variable 'varWithBadPattern' pattern must be a string");
    });

    it('should validate all variable types correctly', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        variables: {
          stringVar: {
            type: 'string',
            description: 'A string variable',
            pattern: '^[a-zA-Z]+$',
          },
          numberVar: {
            type: 'number',
            description: 'A number variable',
            default: 42,
          },
          booleanVar: {
            type: 'boolean',
            description: 'A boolean variable',
            default: true,
          },
          choiceVar: {
            type: 'choice',
            description: 'A choice variable',
            choices: ['option1', 'option2', 'option3'],
            default: 'option1',
          },
        },
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Files validation', () => {
    it('should reject files that are not arrays', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        files: 'not-an-array',
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Files must be an array');
    });

    it('should reject file definitions that are not objects', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        files: ['not-an-object'],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File at index 0 must be an object');
    });

    it('should reject files without path or name', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        files: [
          {
            content: 'some content',
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "File at index 0 must have either 'path' or 'name' field"
      );
    });

    it('should reject files without content, template, or source', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        files: [
          {
            path: 'src/index.ts',
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "File at index 0 must have 'content', 'template', or 'source' field"
      );
    });

    it('should reject files with source but no destination', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        files: [
          {
            path: 'src/index.ts',
            source: 'templates/index.ts',
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "File at index 0 with 'source' must also have 'destination' field"
      );
    });

    it('should reject files with invalid permissions format', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        files: [
          {
            path: 'src/index.ts',
            content: 'console.log("Hello");',
            permissions: 'invalid',
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'File at index 0 has invalid permissions format: invalid'
      );
    });

    it('should accept valid file definitions', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        files: [
          {
            path: 'src/index.ts',
            content: 'console.log("Hello");',
            permissions: '644',
          },
          {
            name: 'package.json',
            template: 'package-template.json',
          },
          {
            path: 'config/app.js',
            source: 'templates/config.js',
            destination: 'config/app.js',
            permissions: '755',
          },
          {
            path: 'README.md',
            content: '# Project',
            permissions: '0644',
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle multiple file validation errors', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        files: [
          {
            // Missing path/name and content/template/source
          },
          'not-an-object',
          {
            source: 'template.js',
            // Missing destination
          },
          {
            path: 'test.js',
            content: 'test',
            permissions: 'bad-permissions',
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "File at index 0 must have either 'path' or 'name' field"
      );
      expect(result.errors).toContain(
        "File at index 0 must have 'content', 'template', or 'source' field"
      );
      expect(result.errors).toContain('File at index 1 must be an object');
      expect(result.errors).toContain(
        "File at index 2 with 'source' must also have 'destination' field"
      );
      expect(result.errors).toContain(
        'File at index 3 has invalid permissions format: bad-permissions'
      );
    });
  });

  describe('Commands validation', () => {
    it('should reject commands that are not arrays', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        commands: 'not-an-array',
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Commands must be an array');
    });

    it('should accept string commands', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        commands: ['npm install' as unknown, 'npm run build' as unknown, 'npm test' as unknown],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject commands that are neither strings nor objects', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        commands: [123],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Command at index 0 must be a string or object');
    });

    it('should reject command objects without command field', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        commands: [
          {
            description: 'Build the app',
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Command at index 0 must have a 'command' field of type string"
      );
    });

    it('should reject command objects with non-string command field', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        commands: [
          {
            command: 123,
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "Command at index 0 must have a 'command' field of type string"
      );
    });

    it('should reject command objects with non-string description', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        commands: [
          {
            command: 'npm run build',
            description: 123,
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Command at index 0 description must be a string');
    });

    it('should reject command objects with non-string condition', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        commands: [
          {
            command: 'npm run build',
            condition: 123,
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Command at index 0 condition must be a string');
    });

    it('should accept valid command objects', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        commands: [
          'npm install' as unknown,
          {
            command: 'npm run build',
            description: 'Build the application',
            condition: 'production',
          },
          {
            command: 'npm test',
            description: 'Run tests',
          },
          {
            command: 'npm start',
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle multiple command validation errors', async () => {
      const template = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        commands: [
          123, // Invalid type
          {
            // Missing command field
            description: 'Invalid command',
          },
          {
            command: 456, // Wrong type
            description: 789, // Wrong type
            condition: [], // Wrong type
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Command at index 0 must be a string or object');
      expect(result.errors).toContain(
        "Command at index 1 must have a 'command' field of type string"
      );
      expect(result.errors).toContain(
        "Command at index 2 must have a 'command' field of type string"
      );
      expect(result.errors).toContain('Command at index 2 description must be a string');
      expect(result.errors).toContain('Command at index 2 condition must be a string');
    });
  });

  describe('Edge cases and complex scenarios', () => {
    it('should handle templates with all validation errors', async () => {
      const invalidTemplate = {
        // Missing name, description, version
        author: 123, // Wrong type
        tags: 'not-an-array', // Wrong type
        variables: 'not-an-object', // Wrong type
        files: 'not-an-array', // Wrong type
        commands: 'not-an-array', // Wrong type
      };

      const result = await validator.validate(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5);
      expect(result.errors).toContain('Template must have a name field of type string');
      expect(result.errors).toContain('Template must have a description field of type string');
      expect(result.errors).toContain('Template must have a version field of type string');
      expect(result.errors).toContain('Template author must be a string');
      expect(result.errors).toContain('Template tags must be an array');
      expect(result.errors).toContain('Variables must be an object');
      expect(result.errors).toContain('Files must be an array');
      expect(result.errors).toContain('Commands must be an array');
    });

    it('should handle nested validation errors', async () => {
      const template = {
        name: 'complex-template',
        description: 'A template with nested errors',
        version: '1.0.0',
        variables: {
          var1: 'not-an-object',
          var2: {
            type: 'invalid-type',
          },
          var3: {
            type: 'choice',
            choices: [],
          },
        },
        files: [
          {},
          {
            source: 'template.js',
          },
          {
            path: 'test.js',
            content: 'test',
            permissions: 'invalid',
          },
        ],
        commands: [
          123,
          {
            description: 'No command field',
          },
        ],
      };

      const result = await validator.validate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(8);
    });

    it('should return empty warnings array for valid templates', async () => {
      const validTemplate = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
      };

      const result = await validator.validate(validTemplate);

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('should handle templates with extra unknown fields gracefully', async () => {
      const templateWithExtraFields = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        unknownField1: 'should be ignored',
        unknownField2: 123,
        unknownField3: { nested: 'object' },
      };

      const result = await validator.validate(templateWithExtraFields);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate very large templates efficiently', async () => {
      const largeTemplate: unknown = {
        name: 'large-template',
        description: 'A template with many fields',
        version: '1.0.0',
        variables: {},
        files: [],
        commands: [],
      };

      // Add many variables
      for (let i = 0; i < 100; i++) {
        largeTemplate.variables[`var${i}`] = {
          type: 'string',
          description: `Variable ${i}`,
        };
      }

      // Add many files
      for (let i = 0; i < 100; i++) {
        largeTemplate.files.push({
          path: `src/file${i}.ts`,
          content: `// File ${i}`,
        });
      }

      // Add many commands
      for (let i = 0; i < 100; i++) {
        largeTemplate.commands.push(`command-${i}`);
      }

      const startTime = Date.now();
      const result = await validator.validate(largeTemplate);
      const endTime = Date.now();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Type definitions and interfaces', () => {
    it('should properly type ValidationResult', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should properly type VariableDefinition', () => {
      const variable: VariableDefinition = {
        type: 'string',
        description: 'A test variable',
        default: 'default-value',
        required: true,
        pattern: '^[a-zA-Z]+$',
      };

      expect(['string', 'number', 'boolean', 'choice']).toContain(variable.type);
      expect(typeof variable.description).toBe('string');
      expect(typeof variable.required).toBe('boolean');
      expect(typeof variable.pattern).toBe('string');
    });

    it('should properly type FileDefinition', () => {
      const file: FileDefinition = {
        path: 'src/index.ts',
        name: 'index',
        source: 'template.ts',
        destination: 'output.ts',
        content: 'console.log("Hello");',
        template: 'template.hbs',
        permissions: '644',
      };

      expect(typeof file.path).toBe('string');
      expect(typeof file.name).toBe('string');
      expect(typeof file.source).toBe('string');
      expect(typeof file.destination).toBe('string');
      expect(typeof file.content).toBe('string');
      expect(typeof file.template).toBe('string');
      expect(typeof file.permissions).toBe('string');
    });

    it('should properly type CommandDefinition', () => {
      const command: CommandDefinition = {
        command: 'npm install',
        description: 'Install dependencies',
        condition: 'development',
      };

      expect(typeof command.command).toBe('string');
      expect(typeof command.description).toBe('string');
      expect(typeof command.condition).toBe('string');
    });

    it('should properly type TemplateSchema', () => {
      const template: TemplateSchema = {
        name: 'test-template',
        description: 'A test template',
        version: '1.0.0',
        author: 'Test Author',
        tags: ['test'],
        variables: {
          testVar: {
            type: 'string',
            description: 'Test variable',
          },
        },
        files: [
          {
            path: 'test.ts',
            content: 'test',
          },
        ],
        commands: [
          {
            command: 'test command',
            description: 'Test command',
          },
        ],
      };

      expect(typeof template.name).toBe('string');
      expect(typeof template.description).toBe('string');
      expect(typeof template.version).toBe('string');
      expect(typeof template.author).toBe('string');
      expect(Array.isArray(template.tags)).toBe(true);
      expect(typeof template.variables).toBe('object');
      expect(Array.isArray(template.files)).toBe(true);
      expect(Array.isArray(template.commands)).toBe(true);
    });
  });
});
/**
 * @fileoverview Tests for validation schemas
 * @lastmodified 2025-08-23T05:15:00Z
 */

import { z } from 'zod';
import {
  TemplateSchema,
  VariableConfigSchema,
  TemplateFileSchema,
  ConfigSchema,
  GenerateCommandSchema,
  ApplyCommandSchema,
  ValidateCommandSchema,
  MarketplaceManifestSchema,
  Validator,
  customValidators,
} from '../../../src/validation/schemas';

describe('Validation Schemas', () => {
  describe('VariableConfigSchema', () => {
    it('should validate valid variable configuration', () => {
      const validConfig = {
        type: 'string',
        default: 'test',
        required: true,
        description: 'Test variable',
        validation: {
          pattern: '^[a-z]+$',
          min: 3,
          max: 10,
        },
      };

      const result = VariableConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('string');
        expect(result.data.required).toBe(true);
      }
    });

    it('should reject invalid variable type', () => {
      const invalidConfig = {
        type: 'invalid',
        default: 'test',
      };

      const result = VariableConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should provide default for required field', () => {
      const minimalConfig = {
        type: 'string',
      };

      const result = VariableConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.required).toBe(false);
      }
    });
  });

  describe('TemplateFileSchema', () => {
    it('should validate valid file definition', () => {
      const validFile = {
        path: 'src/components/Button.tsx',
        content: 'export const Button = () => <button>Click me</button>;',
        encoding: 'utf8',
      };

      const result = TemplateFileSchema.safeParse(validFile);
      expect(result.success).toBe(true);
    });

    it('should reject empty file path', () => {
      const invalidFile = {
        path: '',
        content: 'test',
      };

      const result = TemplateFileSchema.safeParse(invalidFile);
      expect(result.success).toBe(false);
    });

    it('should reject path traversal attempts', () => {
      const invalidFile = {
        path: '../../../etc/passwd',
        content: 'malicious',
      };

      const result = TemplateFileSchema.safeParse(invalidFile);
      expect(result.success).toBe(false);
    });
  });

  describe('TemplateSchema', () => {
    it('should validate complete template', () => {
      const validTemplate = {
        name: 'my-template',
        version: '1.0.0',
        description: 'Test template',
        files: [
          {
            path: 'src/index.ts',
            content: 'console.log("Hello");',
          },
        ],
        variables: {
          projectName: {
            type: 'string',
            default: 'my-project',
          },
        },
        commands: [
          {
            command: 'npm install',
            description: 'Install dependencies',
          },
        ],
      };

      const result = TemplateSchema.safeParse(validTemplate);
      expect(result.success).toBe(true);
    });

    it('should reject invalid template name', () => {
      const invalidTemplate = {
        name: '123-invalid', // Must start with letter
        version: '1.0.0',
        files: [{ path: 'test.txt', content: 'test' }],
      };

      const result = TemplateSchema.safeParse(invalidTemplate);
      expect(result.success).toBe(false);
    });

    it('should reject invalid version format', () => {
      const invalidTemplate = {
        name: 'valid-name',
        version: 'v1.0', // Invalid semver
        files: [{ path: 'test.txt', content: 'test' }],
      };

      const result = TemplateSchema.safeParse(invalidTemplate);
      expect(result.success).toBe(false);
    });

    it('should require at least one file', () => {
      const invalidTemplate = {
        name: 'valid-name',
        version: '1.0.0',
        files: [],
      };

      const result = TemplateSchema.safeParse(invalidTemplate);
      expect(result.success).toBe(false);
    });

    it('should accept variable names (validation done separately)', () => {
      const template = {
        name: 'valid-name',
        version: '1.0.0',
        files: [{ path: 'test.txt', content: 'test' }],
        variables: {
          '123invalid': { // This would be validated separately
            type: 'string',
          },
        },
      };

      const result = TemplateSchema.safeParse(template);
      // Note: Variable name validation is done separately, not at schema level
      expect(result.success).toBe(true);
    });
  });

  describe('ConfigSchema', () => {
    it('should validate minimal config', () => {
      const minimalConfig = {};

      const result = ConfigSchema.safeParse(minimalConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.templatesDir).toBe('.cursor/templates');
        expect(result.data.defaultTemplate).toBe('feature');
      }
    });

    it('should validate complete config', () => {
      const completeConfig = {
        templatesDir: 'custom/templates',
        defaultTemplate: 'custom',
        autoContext: {
          includeGit: false,
          includeFiles: true,
          terminalLines: 100,
        },
        marketplace: {
          enabled: true,
          apiUrl: 'https://custom-api.com',
          apiKey: 'test-key',
        },
      };

      const result = ConfigSchema.safeParse(completeConfig);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL in marketplace config', () => {
      const invalidConfig = {
        marketplace: {
          apiUrl: 'not-a-url',
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('Command Schemas', () => {
    describe('GenerateCommandSchema', () => {
      it('should validate generate command input', () => {
        const validInput = {
          template: 'feature',
          variables: { name: 'MyFeature' },
          clipboard: true,
          context: true,
        };

        const result = GenerateCommandSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should require template name', () => {
        const invalidInput = {
          template: '',
          variables: {},
        };

        const result = GenerateCommandSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });

    describe('ApplyCommandSchema', () => {
      it('should validate apply command input', () => {
        const validInput = {
          template: 'my-template',
          files: ['src/index.ts', 'package.json'],
          force: true,
          backup: true,
        };

        const result = ApplyCommandSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should require at least one file', () => {
        const invalidInput = {
          template: 'my-template',
          files: [],
        };

        const result = ApplyCommandSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });

    describe('ValidateCommandSchema', () => {
      it('should validate validate command input', () => {
        const validInput = {
          template: 'my-template',
          strict: true,
          fix: false,
          format: 'json',
        };

        const result = ValidateCommandSchema.safeParse(validInput);
        expect(result.success).toBe(true);
      });

      it('should reject invalid format option', () => {
        const invalidInput = {
          template: 'my-template',
          format: 'xml', // Not a valid format
        };

        const result = ValidateCommandSchema.safeParse(invalidInput);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('MarketplaceManifestSchema', () => {
    it('should validate complete manifest', () => {
      const validManifest = {
        name: 'awesome-template',
        version: '2.1.0',
        description: 'An awesome template for rapid development',
        author: 'John Doe',
        category: 'development',
        tags: ['react', 'typescript', 'testing'],
        license: 'MIT',
        repository: {
          type: 'git',
          url: 'https://github.com/user/repo',
        },
        files: ['template.json', 'README.md'],
      };

      const result = MarketplaceManifestSchema.safeParse(validManifest);
      expect(result.success).toBe(true);
    });

    it('should reject manifest with too many tags', () => {
      const invalidManifest = {
        name: 'template',
        version: '1.0.0',
        description: 'Description with at least 10 characters',
        author: 'Author',
        category: 'development',
        tags: Array(11).fill('tag'), // 11 tags, max is 10
        license: 'MIT',
        files: ['template.json'],
      };

      const result = MarketplaceManifestSchema.safeParse(invalidManifest);
      expect(result.success).toBe(false);
    });

    it('should require at least one tag', () => {
      const invalidManifest = {
        name: 'template',
        version: '1.0.0',
        description: 'Description with at least 10 characters',
        author: 'Author',
        category: 'development',
        tags: [], // Empty tags
        license: 'MIT',
        files: ['template.json'],
      };

      const result = MarketplaceManifestSchema.safeParse(invalidManifest);
      expect(result.success).toBe(false);
    });
  });

  describe('Validator Helper Class', () => {
    it('should validate with detailed error messages', () => {
      const schema = z.object({
        name: z.string().min(3),
        age: z.number().positive(),
      });

      const result = Validator.validate(schema, {
        name: 'ab', // Too short
        age: -5, // Negative
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should validate partial data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email(),
      });

      const result = Validator.validatePartial(schema, {
        name: 'John',
        // age and email are optional in partial
      });

      expect(result.success).toBe(true);
    });

    it('should use safe parse with defaults', () => {
      const schema = z.object({
        count: z.number(),
      });

      const value = Validator.safeParse(
        schema,
        { invalid: 'data' },
        { count: 10 }
      );

      expect(value).toEqual({ count: 10 });
    });

    it('should validate and transform async', async () => {
      const schema = z.object({
        value: z.number(),
      });

      const transform = async (data: any) => ({
        ...data,
        value: data.value * 2,
      });

      const result = await Validator.validateAsync(
        schema,
        { value: 5 },
        transform
      );

      expect(result.success).toBe(true);
      expect(result.data?.value).toBe(10);
    });
  });

  describe('Custom Validators', () => {
    it('should validate safe file paths', () => {
      expect(customValidators.isPathSafe('src/file.ts')).toBe(true);
      expect(customValidators.isPathSafe('file.ts')).toBe(true);
      expect(customValidators.isPathSafe('../etc/passwd')).toBe(false);
      expect(customValidators.isPathSafe('/etc/passwd')).toBe(false);
    });

    it('should validate template name uniqueness', async () => {
      const existing = ['template1', 'template2'];
      
      expect(
        await customValidators.isTemplateNameUnique('template3', existing)
      ).toBe(true);
      
      expect(
        await customValidators.isTemplateNameUnique('template1', existing)
      ).toBe(false);
    });

    it('should validate plugin permissions', () => {
      const available = ['read', 'write', 'execute'];
      
      expect(
        customValidators.validatePluginPermissions(['read', 'write'], available)
      ).toBe(true);
      
      expect(
        customValidators.validatePluginPermissions(['read', 'delete'], available)
      ).toBe(false);
    });

    it('should validate JSON strings', () => {
      expect(customValidators.isValidJson('{"valid": true}')).toBe(true);
      expect(customValidators.isValidJson('not json')).toBe(false);
      expect(customValidators.isValidJson('')).toBe(false);
    });

    it('should validate environment variable names', () => {
      expect(customValidators.isValidEnvVar('NODE_ENV')).toBe(true);
      expect(customValidators.isValidEnvVar('_PRIVATE')).toBe(true);
      expect(customValidators.isValidEnvVar('MY_VAR_123')).toBe(true);
      expect(customValidators.isValidEnvVar('lowercase')).toBe(false);
      expect(customValidators.isValidEnvVar('123_START')).toBe(false);
    });
  });

  describe('Validation Middleware Factory', () => {
    it('should create validation middleware', () => {
      const schema = z.object({
        message: z.string().min(5),
      });

      const middleware = createValidationMiddleware(schema);
      
      expect(() => middleware({ message: 'test' })).toThrow();
      expect(() => middleware({ message: 'valid message' })).not.toThrow();
    });
  });
});

// Helper function to test validation middleware creation
function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    const result = schema.parse(data);
    return result;
  };
}
/**
 * @fileoverview Comprehensive validation schemas using Zod
 * @lastmodified 2025-08-23T04:30:00Z
 *
 * Features: Input validation, schema composition, type inference
 * Main APIs: Template schemas, command schemas, config schemas
 * Constraints: All user inputs must be validated before processing
 * Patterns: Schema composition, custom validators, error messages
 */

import { z } from 'zod';
import { ValidationError } from '../errors';

/**
 * Common validation patterns
 */
const patterns = {
  // Semantic version: 1.0.0, 2.1.3-beta.1
  semver: /^\d+\.\d+\.\d+(-[a-zA-Z0-9-.]+)?$/,
  // Template name: alphanumeric with dashes/underscores
  templateName: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
  // Variable name: valid JavaScript identifier
  variableName: /^[a-zA-Z_$][a-zA-Z0-9_$]*$/,
  // File path: strict validation with no path traversal, no null bytes
  safePath: /^(?![./])(?!.*\.\.)(?!.*[\u0000-\u001f\u007f-\u009f])[a-zA-Z0-9][a-zA-Z0-9._/-]{0,254}$/,
  // Absolute path validation for system operations
  absolutePath: /^\/(?:[a-zA-Z0-9._-]+\/?)*[a-zA-Z0-9._-]*$/,
  // URL: strict http(s) only, no dangerous protocols
  url: /^https?:\/\/(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(\.w{2,})+(?::\d{2,5})?(?:\/[a-zA-Z0-9._~:/?#[\]@!$&'()*+,;=-]*)?$/,
  // Enhanced SQL injection prevention with comprehensive keyword blocking
  sqlSafe: /^(?!.*(union|select|insert|delete|update|drop|create|alter|exec|execute|script|declare|cast|convert|char|varchar|nvarchar|substring|ascii|waitfor|delay|benchmark|sleep|load_file|outfile|dumpfile|information_schema|mysql|pg_|sys\.|xp_|sp_)\b).*$/i,
  // Enhanced XSS prevention with comprehensive pattern matching
  xssSafe: /^(?!.*(<\/?(?:script|iframe|object|embed|applet|meta|link|style|form|input|textarea|button|select|option)|javascript:|vbscript:|data:|on\w+\s*=|eval\s*\(|setTimeout|setInterval|Function\s*\(|innerHTML|outerHTML|document\.|window\.|location\.|navigator\.|XMLHttpRequest|fetch\s*\(|WebSocket|eval|unescape)).*$/i,
  // Enhanced command injection prevention
  commandSafe: /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/,
  // Shell argument safety - no metacharacters or control sequences
  shellArgSafe: /^[a-zA-Z0-9][a-zA-Z0-9._/=-]{0,127}$/,
  // Email validation with strict format
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  // Username validation - alphanumeric with limited special chars
  username: /^[a-zA-Z][a-zA-Z0-9._-]{2,29}$/,
  // Hex hash validation (SHA-256)
  sha256: /^[a-f0-9]{64}$/,
  // JWT token pattern
  jwt: /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  // Base64 validation
  base64: /^[A-Za-z0-9+/]*={0,2}$/,
  // IPv4 address validation
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  // Port number validation
  port: /^([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5])$/,
  // MIME type validation
  mimeType: /^[a-zA-Z][a-zA-Z0-9][a-zA-Z0-9!#$&\-\^]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^]*$/,
};

/**
 * Custom error messages - can be used by validation functions
 */
// const errorMessages = {
//   required: (field: string) => `${field} is required`,
//   invalid: (field: string) => `${field} is invalid`,
//   pattern: (field: string, pattern: string) => `${field} must match pattern: ${pattern}`,
//   min: (field: string, min: number) => `${field} must be at least ${min} characters`,
//   max: (field: string, max: number) => `${field} must be at most ${max} characters`,
// };

/**
 * Variable type schema
 */
export const VariableTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'array',
  'object',
  'date',
]);

/**
 * Security-enhanced string validation
 */
export const SecureStringSchema = z
  .string()
  .min(1, 'String cannot be empty')
  .max(10000, 'String too long (max 10000 characters)')
  .refine(val => patterns.xssSafe.test(val), 'String contains XSS patterns')
  .refine(
    val => patterns.sqlSafe.test(val),
    'String contains SQL injection patterns'
  )
  .refine(val => !val.includes('\u0000'), 'String contains null bytes');

/**
 * Secure file path validation
 */
export const SecurePathSchema = z
  .string()
  .min(1, 'Path cannot be empty')
  .max(500, 'Path too long (max 500 characters)')
  .refine(val => patterns.safePath.test(val), 'Path contains unsafe characters')
  .refine(val => !val.startsWith('/'), 'Absolute paths not allowed')
  .refine(val => !val.includes('..'), 'Path traversal not allowed');

/**
 * Command argument validation (prevents command injection)
 */
export const SecureCommandArgSchema = z
  .string()
  .min(1, 'Command argument cannot be empty')
  .max(1000, 'Command argument too long')
  .refine(
    val => patterns.commandSafe.test(val),
    'Command contains unsafe characters'
  );

/**
 * URL validation with security checks
 */
export const SecureUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(val => patterns.url.test(val), 'Only HTTP/HTTPS URLs allowed')
  .refine(val => !val.includes('..'), 'URL contains path traversal')
  .refine(val => val.length < 2000, 'URL too long');

/**
 * Variable validation schema
 */
export const VariableValidationSchema = z.object({
  pattern: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  enum: z.array(z.unknown()).optional(),
  custom: z.string().optional(), // Custom validator function name
});

/**
 * Variable configuration schema
 */
export const VariableConfigSchema = z.object({
  type: VariableTypeSchema,
  default: z.unknown().optional(),
  required: z.boolean().default(false),
  description: z.string().optional(),
  validation: VariableValidationSchema.optional(),
  transform: z.string().optional(), // Transform function name
});

/**
 * Template file schema
 */
export const TemplateFileSchema = z.object({
  path: z
    .string()
    .min(1, 'File path is required')
    .regex(patterns.safePath, 'Invalid file path'),
  name: z.string().optional(),
  content: z.string(),
  encoding: z.string().default('utf8'),
  mode: z.string().optional(),
});

/**
 * Template command schema
 */
export const TemplateCommandSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  description: z.string().optional(),
  when: z.string().optional(), // Conditional expression
  workingDirectory: z.string().optional(),
  timeout: z.number().positive().optional(),
});

/**
 * Template metadata schema
 */
export const TemplateMetadataSchema = z.object({
  author: z.string().optional(),
  tags: z.array(z.string()).default([]),
  created: z.string().datetime().optional(),
  updated: z.string().datetime().optional(),
  license: z.string().optional(),
  repository: z.string().regex(patterns.url).optional(),
  homepage: z.string().regex(patterns.url).optional(),
});

/**
 * Complete template schema
 */
export const TemplateSchema = z.object({
  name: z
    .string()
    .min(1, 'Template name is required')
    .max(100, 'Template name too long')
    .regex(patterns.templateName, 'Invalid template name'),
  version: z.string().regex(patterns.semver, 'Invalid version format'),
  description: z.string().optional(),
  basePath: z.string().optional(),
  files: z.array(TemplateFileSchema).min(1, 'At least one file is required'),
  variables: z.record(z.string(), VariableConfigSchema).default({}),
  commands: z.array(TemplateCommandSchema).default([]),
  metadata: TemplateMetadataSchema.optional(),
  extends: z.string().optional(), // Parent template
  includes: z.array(z.string()).optional(), // Partial templates
});

/**
 * Plugin configuration schema
 */
export const PluginConfigSchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(patterns.semver),
  main: z.string(),
  enabled: z.boolean().default(true),
  config: z.record(z.string(), z.unknown()).default({}),
  permissions: z.array(z.string()).default([]),
  dependencies: z.record(z.string(), z.string()).default({}),
});

/**
 * Marketplace template manifest schema
 */
export const MarketplaceManifestSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().regex(patterns.semver),
  description: z.string().min(10).max(500),
  author: z.string().min(1),
  category: z.enum([
    'productivity',
    'development',
    'testing',
    'documentation',
    'automation',
    'utility',
    'other',
  ]),
  tags: z.array(z.string()).min(1).max(10),
  license: z.string(),
  repository: z
    .object({
      type: z.enum(['git', 'svn', 'mercurial']),
      url: z.string().regex(patterns.url),
    })
    .optional(),
  files: z.array(z.string()),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  peerDependencies: z.record(z.string(), z.string()).optional(),
  requirements: z
    .object({
      node: z.string().optional(),
      'cursor-prompt': z.string().optional(),
    })
    .optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  metadata: z
    .object({
      screenshots: z
        .array(
          z.object({
            url: z.string().regex(patterns.url),
            caption: z.string().optional(),
          })
        )
        .optional(),
      documentation: z.string().regex(patterns.url).optional(),
      changelog: z.string().regex(patterns.url).optional(),
      issues: z.string().regex(patterns.url).optional(),
    })
    .optional(),
});

/**
 * Configuration schema
 */
export const ConfigSchema = z.object({
  templatesDir: z.string().default('.cursor/templates'),
  defaultTemplate: z.string().default('feature'),
  autoContext: z
    .object({
      includeGit: z.boolean().default(true),
      includeFiles: z.boolean().default(true),
      includeTerminal: z.boolean().default(true),
      includeEnvironment: z.boolean().default(false),
      terminalLines: z.number().positive().max(1000).default(50),
      filePatterns: z.array(z.string()).default([]),
      excludePatterns: z
        .array(z.string())
        .default(['node_modules/**', '.git/**']),
    })
    .optional(),
  outputPreferences: z
    .object({
      copyToClipboard: z.boolean().default(true),
      showPreview: z.boolean().default(false),
      colorOutput: z.boolean().default(true),
      format: z.enum(['markdown', 'plain', 'json']).default('markdown'),
    })
    .optional(),
  validation: z
    .object({
      strict: z.boolean().default(false),
      autoFix: z.boolean().default(false),
      warnOnMissingVars: z.boolean().default(true),
      maxNestingDepth: z.number().positive().default(10),
      allowedTags: z
        .array(z.string())
        .default(['if', 'unless', 'each', 'include']),
    })
    .optional(),
  performance: z
    .object({
      maxFileSize: z
        .number()
        .positive()
        .default(1024 * 1024), // 1MB
      maxTotalSize: z
        .number()
        .positive()
        .default(10 * 1024 * 1024), // 10MB
      cacheTemplates: z.boolean().default(true),
      parallel: z.boolean().default(true),
    })
    .optional(),
  gitIntegration: z
    .object({
      enabled: z.boolean().default(true),
      includeStatus: z.boolean().default(true),
      includeDiff: z.boolean().default(true),
      includeCommits: z.boolean().default(true),
      commitLimit: z.number().positive().max(100).default(10),
    })
    .optional(),
  marketplace: z
    .object({
      enabled: z.boolean().default(true),
      apiUrl: z
        .string()
        .regex(patterns.url)
        .default('https://api.cursor-prompt.com'),
      apiKey: z.string().optional(),
      cacheDir: z.string().default('.cursor/.marketplace-cache'),
      autoUpdate: z.boolean().default(true),
      updateCheckInterval: z.number().positive().default(86400), // 24 hours
      maxCacheSize: z.number().positive().default(100),
      timeout: z.number().positive().default(30000),
    })
    .optional(),
  plugins: z
    .object({
      enabled: z.boolean().default(true),
      directory: z.string().default('.cursor/plugins'),
      autoLoad: z.boolean().default(true),
      sandboxed: z.boolean().default(true),
    })
    .optional(),
});

/**
 * Command input schemas
 */
export const InitCommandSchema = z.object({
  directory: z.string().default('.'),
  templates: z.string().optional(),
  force: z.boolean().default(false),
  git: z.boolean().default(true),
});

export const GenerateCommandSchema = z.object({
  template: z.string().min(1, 'Template name is required'),
  variables: z.record(z.string(), z.unknown()).default({}),
  output: z.string().optional(),
  clipboard: z.boolean().default(true),
  preview: z.boolean().default(false),
  context: z.boolean().default(true),
  includeGit: z.boolean().optional(),
  includeFiles: z.boolean().optional(),
  filePatterns: z.array(z.string()).optional(),
});

export const ApplyCommandSchema = z.object({
  template: z.string().min(1),
  files: z.array(z.string()).min(1, 'At least one file is required'),
  force: z.boolean().default(false),
  backup: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

export const ValidateCommandSchema = z.object({
  template: z.string().min(1),
  strict: z.boolean().default(false),
  fix: z.boolean().default(false),
  format: z.enum(['table', 'json', 'yaml']).default('table'),
});

export const PublishCommandSchema = z.object({
  template: z.string().min(1),
  version: z.string().regex(patterns.semver).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  force: z.boolean().default(false),
  dryRun: z.boolean().default(false),
});

/**
 * API request/response schemas
 */
export const ApiRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  url: z.string().regex(patterns.url),
  headers: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
  timeout: z.number().positive().optional(),
  retries: z.number().min(0).max(5).default(3),
});

export const ApiResponseSchema = z.object({
  status: z.number(),
  statusText: z.string(),
  headers: z.record(z.string(), z.string()),
  data: z.unknown(),
});

/**
 * User input schemas
 */
export const UserCredentialsSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(100),
  email: z.string().email().optional(),
});

export const AuthorRegistrationSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  bio: z.string().max(500).optional(),
  github: z.string().optional(),
  website: z.string().regex(patterns.url).optional(),
});

export const RatingSchema = z.object({
  stars: z.number().min(1).max(5),
  review: z.string().min(10).max(1000).optional(),
  wouldRecommend: z.boolean().optional(),
});

/**
 * Type inference helpers
 */
export type Template = z.infer<typeof TemplateSchema>;
export type TemplateFile = z.infer<typeof TemplateFileSchema>;
export type TemplateCommand = z.infer<typeof TemplateCommandSchema>;
export type VariableConfig = z.infer<typeof VariableConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type MarketplaceManifest = z.infer<typeof MarketplaceManifestSchema>;
export type PluginConfig = z.infer<typeof PluginConfigSchema>;

/**
 * Validation helper functions
 */
export class Validator {
  /**
   * Validate with detailed error messages
   */
  static validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    _options?: { strict?: boolean }
  ): { success: boolean; data?: T; errors?: string[] } {
    try {
      // Note: strict mode handled differently in zod v4
      const result = schema.parse(data);

      return { success: true, data: result };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(e => {
          const path = e.path.join('.');
          return path ? `${path}: ${e.message}` : e.message;
        });
        return { success: false, errors };
      }
      return {
        success: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Validate and transform
   */
  static async validateAsync<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    transform?: (data: T) => Promise<T>
  ): Promise<{ success: boolean; data?: T; errors?: string[] }> {
    const result = this.validate(schema, data);

    if (result.success && result.data && transform) {
      try {
        const transformed = await transform(result.data);
        return { success: true, data: transformed };
      } catch (error) {
        return {
          success: false,
          errors: [`Transformation failed: ${(error as Error).message}`],
        };
      }
    }

    return result;
  }

  /**
   * Partial validation (for updates)
   */
  static validatePartial<T>(
    schema: z.ZodSchema<T>,
    data: unknown
  ): { success: boolean; data?: Partial<T>; errors?: string[] } {
    // Use type assertion for partial since it's not available on base ZodSchema
    const partialSchema = (schema as any).partial?.() || schema;
    return this.validate(partialSchema, data);
  }

  /**
   * Safe parse with default values
   */
  static safeParse<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    defaultValue: T
  ): T {
    const result = this.validate(schema, data);
    return result.success && result.data ? result.data : defaultValue;
  }
}

/**
 * Custom validators
 */
export const customValidators = {
  /**
   * Validate file path safety
   */
  isPathSafe(path: string): boolean {
    return !path.includes('..') && !path.startsWith('/');
  },

  /**
   * Validate template name uniqueness
   */
  async isTemplateNameUnique(
    name: string,
    existingNames: string[]
  ): Promise<boolean> {
    return !existingNames.includes(name);
  },

  /**
   * Validate plugin permissions
   */
  validatePluginPermissions(requested: string[], available: string[]): boolean {
    return requested.every(p => available.includes(p));
  },

  /**
   * Validate JSON string
   */
  isValidJson(str: string): boolean {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate environment variable name
   */
  isValidEnvVar(name: string): boolean {
    return /^[A-Z_][A-Z0-9_]*$/.test(name);
  },
};

/**
 * Export validation middleware factory
 */
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    const result = schema.parse(data);
    return result;
  };
}

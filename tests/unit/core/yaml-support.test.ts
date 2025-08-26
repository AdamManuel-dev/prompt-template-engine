/**
 * @fileoverview Unit tests for YAML configuration support
 * @lastmodified 2025-08-23T02:50:00Z
 *
 * Features: YAML parsing, validation, schema checking
 * Main APIs: YamlConfigParser tests
 * Constraints: Test coverage for all YAML features
 * Patterns: BDD testing, comprehensive edge cases
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { YamlConfigParser } from '../../../src/core/yaml-config-parser';
import { TemplateConfig } from '../../../src/types';

jest.mock('fs/promises');
jest.mock('../../../src/utils/logger');

describe('YAML Configuration Support', () => {
  let parser: YamlConfigParser;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    parser = new YamlConfigParser();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('YamlConfigParser', () => {
    describe('parseYamlConfig', () => {
      it('should parse valid YAML configuration file', async () => {
        const yamlContent = `
name: test-template
version: 1.0.0
description: Test template for YAML parsing
author: Test Author
variables:
  project_name:
    type: string
    default: my-project
    description: Project name
  framework:
    type: choice
    choices:
      - react
      - vue
      - angular
    default: react
  use_typescript:
    type: boolean
    default: true
commands:
  build: npm run build
  test: npm test
  dev: npm run dev
dependencies:
  - react: "^18.0.0"
  - typescript: "^5.0.0"
`;
        mockFs.readFile.mockResolvedValue(yamlContent);

        const config = await parser.parseYamlConfig('template.yaml');

        expect(config).toEqual({
          name: 'test-template',
          version: '1.0.0',
          description: 'Test template for YAML parsing',
          author: 'Test Author',
          variables: {
            project_name: {
              type: 'string',
              default: 'my-project',
              description: 'Project name',
            },
            framework: {
              type: 'choice',
              choices: ['react', 'vue', 'angular'],
              default: 'react',
            },
            use_typescript: {
              type: 'boolean',
              default: true,
            },
          },
          commands: {
            build: 'npm run build',
            test: 'npm test',
            dev: 'npm run dev',
          },
          dependencies: [
            { react: '^18.0.0' },
            { typescript: '^5.0.0' },
          ],
        });
      });

      it('should handle YAML with template inheritance', async () => {
        const baseYaml = `
name: base-template
version: 1.0.0
variables:
  base_var:
    type: string
    default: base-value
commands:
  test: npm test
`;
        const extendedYaml = `
extends: ./base-template.yaml
name: extended-template
version: 1.1.0
variables:
  extended_var:
    type: string
    default: extended-value
commands:
  build: npm run build
`;
        mockFs.readFile
          .mockResolvedValueOnce(extendedYaml)
          .mockResolvedValueOnce(baseYaml);

        const config = await parser.parseYamlConfig('extended.yaml');

        expect(config.name).toBe('extended-template');
        expect(config.version).toBe('1.1.0');
        expect(config.variables).toHaveProperty('base_var');
        expect(config.variables).toHaveProperty('extended_var');
        expect(config.commands).toHaveProperty('test');
        expect(config.commands).toHaveProperty('build');
      });

      it('should validate required fields', async () => {
        const invalidYaml = `
description: Missing name and version
`;
        mockFs.readFile.mockResolvedValue(invalidYaml);

        await expect(parser.parseYamlConfig('invalid.yaml')).rejects.toThrow(
          'Invalid YAML configuration: missing required fields'
        );
      });

      it('should handle YAML with environment-specific configurations', async () => {
        const yamlContent = `
name: env-template
version: 1.0.0
environments:
  development:
    variables:
      api_url:
        default: http://localhost:3000
    commands:
      dev: npm run dev
  production:
    variables:
      api_url:
        default: https://api.example.com
    commands:
      build: npm run build:prod
`;
        mockFs.readFile.mockResolvedValue(yamlContent);

        const config = await parser.parseYamlConfig('env-template.yaml', {
          environment: 'production',
        });

        expect(config.variables?.api_url?.default).toBe('https://api.example.com');
        expect(config.commands?.build).toBe('npm run build:prod');
      });

      it('should support YAML anchors and aliases', async () => {
        const yamlContent = `
name: anchor-template
version: 1.0.0
defaults: &defaults
  timeout: 5000
  retries: 3
services:
  api:
    <<: *defaults
    port: 3000
  worker:
    <<: *defaults
    port: 4000
`;
        mockFs.readFile.mockResolvedValue(yamlContent);

        const config = await parser.parseYamlConfig('anchor-template.yaml');

        expect(config.services?.api?.timeout).toBe(5000);
        expect(config.services?.api?.retries).toBe(3);
        expect(config.services?.worker?.timeout).toBe(5000);
        expect(config.services?.worker?.retries).toBe(3);
      });

      it('should handle multiline strings correctly', async () => {
        const yamlContent = `
name: multiline-template
version: 1.0.0
description: |
  This is a multiline
  description that spans
  multiple lines
scripts:
  setup: |
    npm install
    npm run build
    npm test
`;
        mockFs.readFile.mockResolvedValue(yamlContent);

        const config = await parser.parseYamlConfig('multiline.yaml');

        expect(config.description).toContain('This is a multiline');
        expect(config.description).toContain('multiple lines');
        expect(config.scripts?.setup).toContain('npm install');
        expect(config.scripts?.setup).toContain('npm test');
      });

      it('should validate variable types', async () => {
        const yamlContent = `
name: typed-template
version: 1.0.0
variables:
  port:
    type: number
    default: "not-a-number"
`;
        mockFs.readFile.mockResolvedValue(yamlContent);

        await expect(parser.parseYamlConfig('typed.yaml')).rejects.toThrow(
          'Variable "port" default value does not match type "number"'
        );
      });

      it('should handle conditional includes', async () => {
        const yamlContent = `
name: conditional-template
version: 1.0.0
includes:
  - condition: \${USE_DOCKER}
    path: ./docker-config.yaml
  - condition: \${USE_K8S}
    path: ./k8s-config.yaml
`;
        mockFs.readFile.mockResolvedValue(yamlContent);

        const config = await parser.parseYamlConfig('conditional.yaml', {
          variables: { USE_DOCKER: true, USE_K8S: false },
        });

        expect(mockFs.readFile).toHaveBeenCalledWith(
          expect.stringContaining('docker-config.yaml'),
          'utf-8'
        );
      });

      it('should merge arrays correctly in inheritance', async () => {
        const baseYaml = `
name: base
version: 1.0.0
tags: [base, template]
`;
        const extendedYaml = `
extends: ./base.yaml
tags: [extended, custom]
`;
        mockFs.readFile
          .mockResolvedValueOnce(extendedYaml)
          .mockResolvedValueOnce(baseYaml);

        const config = await parser.parseYamlConfig('extended.yaml', {
          mergeStrategy: 'combine',
        });

        expect(config.tags).toEqual(['base', 'template', 'extended', 'custom']);
      });

      it('should support custom YAML tags', async () => {
        const yamlContent = `
name: custom-tags
version: 1.0.0
variables:
  timestamp: !timestamp
  uuid: !uuid
  env_var: !env HOME
`;
        mockFs.readFile.mockResolvedValue(yamlContent);

        const config = await parser.parseYamlConfig('custom-tags.yaml');

        expect(config.variables?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}/);
        expect(config.variables?.uuid).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        );
        expect(config.variables?.env_var).toBeTruthy();
      });
    });

    describe('validateYamlSchema', () => {
      it('should validate against JSON schema', async () => {
        const schema = {
          type: 'object',
          required: ['name', 'version'],
          properties: {
            name: { type: 'string' },
            version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
          },
        };

        const validConfig = {
          name: 'test',
          version: '1.0.0',
        };

        const invalidConfig = {
          name: 'test',
          version: 'invalid-version',
        };

        expect(parser.validateSchema(validConfig, schema)).toBe(true);
        expect(() => parser.validateSchema(invalidConfig, schema)).toThrow(
          'Invalid version format'
        );
      });
    });

    describe('convertYamlToJson', () => {
      it('should convert YAML to JSON format', async () => {
        const yamlContent = `
name: convert-test
version: 1.0.0
nested:
  level1:
    level2: value
`;
        mockFs.readFile.mockResolvedValue(yamlContent);

        const json = await parser.convertToJson('template.yaml');

        expect(json).toEqual({
          name: 'convert-test',
          version: '1.0.0',
          nested: {
            level1: {
              level2: 'value',
            },
          },
        });
      });
    });

    describe('error handling', () => {
      it('should handle malformed YAML gracefully', async () => {
        const malformedYaml = `
name: test
  invalid indentation here
version: 1.0.0
`;
        mockFs.readFile.mockResolvedValue(malformedYaml);

        await expect(parser.parseYamlConfig('malformed.yaml')).rejects.toThrow(
          'Failed to parse YAML'
        );
      });

      it('should handle file not found errors', async () => {
        mockFs.readFile.mockRejectedValue(new Error('ENOENT: file not found'));

        await expect(parser.parseYamlConfig('nonexistent.yaml')).rejects.toThrow(
          'file not found'
        );
      });

      it('should handle circular references', async () => {
        const circularYaml = `
extends: ./circular.yaml
name: circular
`;
        mockFs.readFile.mockResolvedValue(circularYaml);

        await expect(parser.parseYamlConfig('circular.yaml')).rejects.toThrow(
          'Circular reference detected'
        );
      });
    });
  });
});
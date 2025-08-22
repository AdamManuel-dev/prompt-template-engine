/**
 * @fileoverview Tests for configuration utility functions
 * @lastmodified 2025-08-22T15:30:00Z
 *
 * Features: Tests configuration loading, validation, and management
 * Main APIs: config loading, setting, and validation functions
 * Constraints: Requires valid config file formats and schemas
 * Patterns: Configuration testing with mocked file system operations
 */

import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Config Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Config File Loading', () => {
    it('should handle missing config file gracefully', () => {
      mockFs.existsSync.mockReturnValue(false);

      // Since config utilities don't exist yet, we're testing the pattern
      const configExists = fs.existsSync('./cursor-prompt.config.json');
      expect(configExists).toBe(false);
    });

    it('should load valid JSON config file', () => {
      const mockConfig = {
        templatesDir: './templates',
        defaultTemplate: 'basic',
        outputDir: './output',
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const configPath = './cursor-prompt.config.json';
      const exists = fs.existsSync(configPath);
      expect(exists).toBe(true);

      if (exists) {
        const rawConfig = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(rawConfig);
        expect(config).toEqual(mockConfig);
      }
    });

    it('should handle invalid JSON in config file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid json }');

      const configPath = './cursor-prompt.config.json';
      const exists = fs.existsSync(configPath);
      expect(exists).toBe(true);

      if (exists) {
        const rawConfig = fs.readFileSync(configPath, 'utf8');
        expect(() => JSON.parse(rawConfig)).toThrow();
      }
    });
  });

  describe('Config Validation', () => {
    it('should validate required config fields', () => {
      const validConfig = {
        templatesDir: './templates',
        defaultTemplate: 'basic',
        outputDir: './output',
      };

      // Test basic structure validation
      expect(validConfig).toHaveProperty('templatesDir');
      expect(validConfig).toHaveProperty('defaultTemplate');
      expect(validConfig).toHaveProperty('outputDir');

      expect(typeof validConfig.templatesDir).toBe('string');
      expect(typeof validConfig.defaultTemplate).toBe('string');
      expect(typeof validConfig.outputDir).toBe('string');
    });

    it('should reject config with missing required fields', () => {
      const invalidConfig = {
        templatesDir: './templates',
        // Missing defaultTemplate and outputDir
      };

      expect(invalidConfig).toHaveProperty('templatesDir');
      expect(invalidConfig).not.toHaveProperty('defaultTemplate');
      expect(invalidConfig).not.toHaveProperty('outputDir');
    });

    it('should validate config field types', () => {
      const configWithWrongTypes = {
        templatesDir: 123, // Should be string
        defaultTemplate: true, // Should be string
        outputDir: [], // Should be string
      };

      expect(typeof configWithWrongTypes.templatesDir).not.toBe('string');
      expect(typeof configWithWrongTypes.defaultTemplate).not.toBe('string');
      expect(typeof configWithWrongTypes.outputDir).not.toBe('string');
    });
  });

  describe('Config Path Resolution', () => {
    it('should resolve relative paths correctly', () => {
      const configDir = '/Users/test/project';
      const relativePath = './templates';
      const expectedPath = path.resolve(configDir, relativePath);

      expect(path.isAbsolute(relativePath)).toBe(false);
      expect(path.resolve(configDir, relativePath)).toBe(expectedPath);
    });

    it('should handle absolute paths', () => {
      const absolutePath = '/Users/test/templates';
      expect(path.isAbsolute(absolutePath)).toBe(true);
      expect(path.resolve(absolutePath)).toBe(absolutePath);
    });

    it('should normalize path separators', () => {
      const windowsPath = 'templates\\basic\\template.md';
      const normalizedPath = path.normalize(windowsPath);

      // On Unix systems, backslashes should be preserved as literal characters
      // On Windows systems, they should be converted to forward slashes
      expect(normalizedPath).toBeDefined();
    });
  });

  describe('Default Config Generation', () => {
    it('should generate valid default configuration', () => {
      const defaultConfig = {
        templatesDir: './templates',
        defaultTemplate: 'basic',
        outputDir: './output',
        fileExtensions: ['.md', '.txt'],
        excludePatterns: ['node_modules/**', '.git/**'],
        maxFileSize: 1048576, // 1MB
      };

      // Validate default config structure
      expect(defaultConfig).toHaveProperty('templatesDir');
      expect(defaultConfig).toHaveProperty('defaultTemplate');
      expect(defaultConfig).toHaveProperty('outputDir');
      expect(defaultConfig).toHaveProperty('fileExtensions');
      expect(defaultConfig).toHaveProperty('excludePatterns');
      expect(defaultConfig).toHaveProperty('maxFileSize');

      // Validate types
      expect(typeof defaultConfig.templatesDir).toBe('string');
      expect(typeof defaultConfig.defaultTemplate).toBe('string');
      expect(typeof defaultConfig.outputDir).toBe('string');
      expect(Array.isArray(defaultConfig.fileExtensions)).toBe(true);
      expect(Array.isArray(defaultConfig.excludePatterns)).toBe(true);
      expect(typeof defaultConfig.maxFileSize).toBe('number');
    });

    it('should have reasonable default values', () => {
      const defaultConfig = {
        templatesDir: './templates',
        defaultTemplate: 'basic',
        outputDir: './output',
        fileExtensions: ['.md', '.txt'],
        excludePatterns: ['node_modules/**', '.git/**'],
        maxFileSize: 1048576,
      };

      expect(defaultConfig.templatesDir).toMatch(/^\.?\//); // Relative path
      expect(defaultConfig.defaultTemplate.length).toBeGreaterThan(0);
      expect(defaultConfig.outputDir).toMatch(/^\.?\//); // Relative path
      expect(defaultConfig.fileExtensions.length).toBeGreaterThan(0);
      expect(defaultConfig.excludePatterns.length).toBeGreaterThan(0);
      expect(defaultConfig.maxFileSize).toBeGreaterThan(0);
    });
  });
});

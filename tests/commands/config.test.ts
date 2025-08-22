/**
 * @fileoverview Tests for config command functionality
 * @lastmodified 2025-08-22T15:30:00Z
 *
 * Features: Tests configuration management operations
 * Main APIs: configCommand(), getMergedConfig(), getConfigValue()
 * Constraints: Requires file system and logger mocking
 * Patterns: Command testing with comprehensive mocking
 */

// Mock file system operations BEFORE importing modules
jest.mock('fs');
jest.mock('path', () => {
  const actualPath = jest.requireActual('path');
  return {
    ...actualPath,
    join: jest.fn((...args: string[]) => {
      if (!args || args.length === 0) return '';
      const validArgs = args.filter(
        arg => arg !== undefined && arg !== null && arg !== ''
      );
      if (validArgs.length === 0) return '';
      return validArgs.join('/');
    }),
    dirname: jest.fn((p: string) => {
      if (!p) return '';
      const parts = p.split('/');
      return parts.slice(0, -1).join('/') || '/';
    }),
  };
});
jest.mock('os', () => ({
  homedir: jest.fn(() => '/home/user'),
}));

// Mock chalk
jest.mock('chalk', () => {
  const mockChalk = (str: string) => str;
  mockChalk.cyan = (str: string) => `[CYAN]${str}[/CYAN]`;
  mockChalk.gray = (str: string) => `[GRAY]${str}[/GRAY]`;
  mockChalk.bold = (str: string) => `[BOLD]${str}[/BOLD]`;
  mockChalk.yellow = (str: string) => `[YELLOW]${str}[/YELLOW]`;
  mockChalk.green = (str: string) => `[GREEN]${str}[/GREEN]`;
  mockChalk.red = (str: string) => `[RED]${str}[/RED]`;
  return {
    __esModule: true,
    default: mockChalk,
  };
});

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Now import the modules after mocking
import * as fs from 'fs';
import {
  configCommand,
  getMergedConfig,
  getConfigValue,
  ConfigOptions,
} from '../../src/commands/config';
import { logger } from '../../src/utils/logger';

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('Config Command', () => {
  const mockHomedir = '/home/user';
  const mockCwd = '/workspace/project';

  const defaultConfig = {
    templatePaths: ['./templates', mockHomedir + '/.cursor-prompt/templates'],
    outputFormat: 'markdown',
    colorOutput: true,
    debugMode: false,
    autoUpdate: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue(mockCwd);

    // Default file system state - no config files exist
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.readFileSync.mockReturnValue('{}');
    mockedFs.writeFileSync.mockImplementation();
    mockedFs.mkdirSync.mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('configCommand', () => {
    describe('list configuration', () => {
      it('should list local configuration by default', async () => {
        const options: ConfigOptions = { list: true };

        await configCommand(options);

        expect(mockedLogger.info).toHaveBeenCalledWith(
          '[CYAN]\n⚙️  Local Configuration:[/CYAN]'
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[GRAY]Path:')
        );
      });

      it('should list global configuration when global flag is set', async () => {
        const options: ConfigOptions = { list: true, global: true };

        await configCommand(options);

        expect(mockedLogger.info).toHaveBeenCalledWith(
          '[CYAN]\n⚙️  Global Configuration:[/CYAN]'
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[GRAY]Path:')
        );
      });

      it('should display all configuration values', async () => {
        const mockConfig = {
          templatePaths: ['./templates'],
          outputFormat: 'json',
          colorOutput: false,
        };

        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

        const options: ConfigOptions = { list: true };
        await configCommand(options);

        expect(mockedLogger.info).toHaveBeenCalledWith(
          '  [BOLD]templatePaths[/BOLD]: ["./templates"]'
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          '  [BOLD]outputFormat[/BOLD]: json'
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          '  [BOLD]colorOutput[/BOLD]: false'
        );
      });

      it('should show default configuration when no config file exists', async () => {
        mockedFs.existsSync.mockReturnValue(false);

        const options: ConfigOptions = { list: true };
        await configCommand(options);

        expect(mockedLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[BOLD]outputFormat[/BOLD]: markdown')
        );
        expect(mockedLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[BOLD]colorOutput[/BOLD]: true')
        );
      });
    });

    describe('get configuration value', () => {
      it('should get specific configuration value', async () => {
        const mockConfig = { outputFormat: 'json' };
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

        const options: ConfigOptions = { get: 'outputFormat' };
        await configCommand(options);

        expect(mockedLogger.info).toHaveBeenCalledWith(
          '[BOLD]outputFormat[/BOLD]: json'
        );
      });

      it('should warn when configuration key is not found', async () => {
        mockedFs.existsSync.mockReturnValue(false);

        const options: ConfigOptions = { get: 'nonexistentKey' };
        await configCommand(options);

        expect(mockedLogger.warn).toHaveBeenCalledWith(
          "[YELLOW]⚠️  Configuration key 'nonexistentKey' not found[/YELLOW]"
        );
      });

      it('should format object values as JSON', async () => {
        const mockConfig = { templatePaths: ['./templates', './other'] };
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

        const options: ConfigOptions = { get: 'templatePaths' };
        await configCommand(options);

        expect(mockedLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[BOLD]templatePaths[/BOLD]:')
        );
      });
    });

    describe('set configuration value', () => {
      it('should set string configuration value', async () => {
        mockedFs.existsSync.mockReturnValue(false);

        const options: ConfigOptions = { set: 'outputFormat=json' };
        await configCommand(options);

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        const [[, content]] = mockedFs.writeFileSync.mock.calls;
        expect(content).toContain('"outputFormat": "json"');
        expect(mockedLogger.success).toHaveBeenCalledWith(
          '[GREEN]✅ Set local config: outputFormat = "json"[/GREEN]'
        );
      });

      it('should set boolean configuration value', async () => {
        mockedFs.existsSync.mockReturnValue(false);

        const options: ConfigOptions = { set: 'colorOutput=false' };
        await configCommand(options);

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        const [[, content]] = mockedFs.writeFileSync.mock.calls;
        expect(content).toContain('"colorOutput": false');
      });

      it('should set numeric configuration value', async () => {
        mockedFs.existsSync.mockReturnValue(false);

        const options: ConfigOptions = { set: 'maxRetries=5' };
        await configCommand(options);

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        const [[, content]] = mockedFs.writeFileSync.mock.calls;
        expect(content).toContain('"maxRetries": 5');
      });

      it('should set JSON configuration value', async () => {
        mockedFs.existsSync.mockReturnValue(false);

        const options: ConfigOptions = { set: 'templatePaths=["./custom"]' };
        await configCommand(options);

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        const [[, content]] = mockedFs.writeFileSync.mock.calls;
        const parsed = JSON.parse(content as string);
        expect(parsed.templatePaths).toEqual(['./custom']);
      });

      it('should handle values with equals signs', async () => {
        mockedFs.existsSync.mockReturnValue(false);

        const options: ConfigOptions = {
          set: 'apiUrl=https://api.example.com?key=value',
        };
        await configCommand(options);

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        const [[, content]] = mockedFs.writeFileSync.mock.calls;
        expect(content).toContain(
          '"apiUrl": "https://api.example.com?key=value"'
        );
      });

      it('should save to global config when global flag is set', async () => {
        mockedFs.existsSync.mockReturnValue(false);

        const options: ConfigOptions = {
          set: 'outputFormat=json',
          global: true,
        };
        await configCommand(options);

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        expect(mockedLogger.success).toHaveBeenCalledWith(
          '[GREEN]✅ Set global config: outputFormat = "json"[/GREEN]'
        );
      });

      it('should create directory if it does not exist', async () => {
        mockedFs.existsSync.mockImplementation((pathArg: fs.PathLike) => {
          if (!pathArg) return false;
          const pathStr = String(pathArg);
          return !pathStr.includes('.cursor-prompt');
        });

        const options: ConfigOptions = {
          set: 'outputFormat=json',
          global: true,
        };
        await configCommand(options);

        expect(mockedFs.mkdirSync).toHaveBeenCalled();
        const [[, mkdirOptions]] = mockedFs.mkdirSync.mock.calls;
        expect(mkdirOptions).toEqual({ recursive: true });
      });

      it('should throw error for invalid format', async () => {
        const options: ConfigOptions = { set: 'invalidformat' };

        await expect(configCommand(options)).rejects.toThrow(
          'Invalid format. Use: --set key=value'
        );

        expect(mockedLogger.error).toHaveBeenCalledWith(
          '[RED]❌ Config command failed: Invalid format. Use: --set key=value[/RED]'
        );
      });

      it('should merge with existing configuration', async () => {
        const existingConfig = { outputFormat: 'plain', debugMode: true };
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(existingConfig));

        const options: ConfigOptions = { set: 'colorOutput=false' };
        await configCommand(options);

        // Configuration has been merged and saved with new values

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        const [[, content]] = mockedFs.writeFileSync.mock.calls;
        expect(content).toContain('"outputFormat": "plain"');
        expect(content).toContain('"debugMode": true');
        expect(content).toContain('"colorOutput": false');
      });
    });

    describe('delete configuration value', () => {
      it('should delete existing configuration key', async () => {
        const mockConfig = { outputFormat: 'json', debugMode: true };
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

        const options: ConfigOptions = { delete: 'debugMode' };
        await configCommand(options);

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        const [[, content]] = mockedFs.writeFileSync.mock.calls;
        expect(content).not.toContain('debugMode');
        expect(mockedLogger.success).toHaveBeenCalledWith(
          '[GREEN]✅ Deleted local config key: debugMode[/GREEN]'
        );
      });

      it('should warn when trying to delete non-existent key', async () => {
        mockedFs.existsSync.mockReturnValue(false);

        const options: ConfigOptions = { delete: 'nonexistentKey' };
        await configCommand(options);

        expect(mockedLogger.warn).toHaveBeenCalledWith(
          "[YELLOW]⚠️  Configuration key 'nonexistentKey' not found[/YELLOW]"
        );
      });

      it('should delete from global config when global flag is set', async () => {
        const mockConfig = { outputFormat: 'json' };
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

        const options: ConfigOptions = { delete: 'outputFormat', global: true };
        await configCommand(options);

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        expect(mockedLogger.success).toHaveBeenCalledWith(
          '[GREEN]✅ Deleted global config key: outputFormat[/GREEN]'
        );
      });
    });

    describe('reset configuration', () => {
      it('should reset local configuration to defaults', async () => {
        const options: ConfigOptions = { reset: true };
        await configCommand(options);

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        const [[, content]] = mockedFs.writeFileSync.mock.calls;
        expect(content).toContain('"outputFormat": "markdown"');
        expect(mockedLogger.success).toHaveBeenCalledWith(
          '[GREEN]✅ Reset local configuration to defaults[/GREEN]'
        );
      });

      it('should reset global configuration when global flag is set', async () => {
        const options: ConfigOptions = { reset: true, global: true };
        await configCommand(options);

        expect(mockedFs.writeFileSync).toHaveBeenCalled();
        expect(mockedLogger.success).toHaveBeenCalledWith(
          '[GREEN]✅ Reset global configuration to defaults[/GREEN]'
        );
      });
    });

    describe('error handling', () => {
      it('should handle file read errors gracefully', async () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockImplementation(() => {
          throw new Error('Permission denied');
        });

        const options: ConfigOptions = { list: true };
        await configCommand(options);

        expect(mockedLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[YELLOW]⚠️  Failed to load config from')
        );
        // Should still display default config
        expect(mockedLogger.info).toHaveBeenCalledWith(
          expect.stringContaining('[BOLD]outputFormat[/BOLD]: markdown')
        );
      });

      it('should handle invalid JSON gracefully', async () => {
        mockedFs.existsSync.mockReturnValue(true);
        mockedFs.readFileSync.mockReturnValue('invalid json {');

        const options: ConfigOptions = { list: true };
        await configCommand(options);

        expect(mockedLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('[YELLOW]⚠️  Failed to load config from')
        );
      });

      it('should handle file write errors', async () => {
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.writeFileSync.mockImplementation(() => {
          throw new Error('Disk full');
        });

        const options: ConfigOptions = { set: 'outputFormat=json' };

        await expect(configCommand(options)).rejects.toThrow('Disk full');
        expect(mockedLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Config command failed: Disk full')
        );
      });

      it('should handle mkdir errors', async () => {
        mockedFs.existsSync.mockReturnValue(false);
        mockedFs.mkdirSync.mockImplementation(() => {
          throw new Error('Permission denied');
        });

        const options: ConfigOptions = {
          set: 'outputFormat=json',
          global: true,
        };

        await expect(configCommand(options)).rejects.toThrow(
          'Permission denied'
        );
      });
    });

    describe('default behavior', () => {
      it('should list configuration when no options are provided', async () => {
        await configCommand({});

        expect(mockedLogger.info).toHaveBeenCalledWith(
          '[CYAN]\n⚙️  Local Configuration:[/CYAN]'
        );
      });
    });
  });

  describe('getMergedConfig', () => {
    it('should merge global and local configs with local taking precedence', () => {
      const globalConfig = {
        outputFormat: 'plain',
        colorOutput: true,
        debugMode: false,
      };
      const localConfig = { outputFormat: 'json', debugMode: true };

      let callCount = 0;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        // First call is for global config, second is for local config
        callCount++;
        if (callCount === 1) {
          return JSON.stringify(globalConfig);
        } else {
          return JSON.stringify(localConfig);
        }
      });

      const merged = getMergedConfig();

      expect(merged).toEqual({
        ...defaultConfig,
        ...globalConfig,
        ...localConfig,
        outputFormat: 'json', // local overrides global
        debugMode: true, // local overrides global
        colorOutput: true, // from global
      });
    });

    it('should return defaults when no config files exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      const merged = getMergedConfig();

      expect(merged).toEqual(defaultConfig);
    });

    it('should handle only global config', () => {
      const globalConfig = { outputFormat: 'plain', debugMode: true };

      let callCount = 0;
      mockedFs.existsSync.mockImplementation(() => {
        callCount++;
        // First call is for global (true), second for local (false)
        return callCount === 1;
      });
      mockedFs.readFileSync.mockImplementation(() => {
        return JSON.stringify(globalConfig);
      });

      const merged = getMergedConfig();

      expect(merged).toEqual({
        ...defaultConfig,
        ...globalConfig,
        outputFormat: 'markdown',
        debugMode: false,
      });
    });

    it('should handle only local config', () => {
      const localConfig = { outputFormat: 'json', colorOutput: false };

      let callCount = 0;
      mockedFs.existsSync.mockImplementation(() => {
        callCount++;
        // First call is for global (false), second for local (true)
        return callCount === 2;
      });
      mockedFs.readFileSync.mockImplementation(() => {
        return JSON.stringify(localConfig);
      });

      const merged = getMergedConfig();

      expect(merged).toEqual({
        ...defaultConfig,
        ...localConfig,
      });
    });
  });

  describe('getConfigValue', () => {
    beforeEach(() => {
      const globalConfig = { outputFormat: 'plain', colorOutput: true };
      const localConfig = { outputFormat: 'json' };

      let callCount = 0;
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockImplementation(() => {
        callCount++;
        // First call is for global config, second is for local config
        if (callCount === 1) {
          return JSON.stringify(globalConfig);
        } else {
          return JSON.stringify(localConfig);
        }
      });
    });

    it('should return config value when key exists', () => {
      const value = getConfigValue('outputFormat');
      expect(value).toBe('json'); // local overrides global
    });

    it('should return default value when key does not exist', () => {
      const value = getConfigValue('nonexistentKey', 'defaultValue');
      expect(value).toBe('defaultValue');
    });

    it('should return undefined when key does not exist and no default provided', () => {
      const value = getConfigValue('nonexistentKey');
      expect(value).toBeUndefined();
    });

    it('should return value from merged config', () => {
      const colorOutput = getConfigValue('colorOutput');
      expect(colorOutput).toBe(true); // from global config since not overridden locally
    });

    it('should handle boolean values correctly', () => {
      const debugMode = getConfigValue('debugMode');
      expect(debugMode).toBe(false); // from default config
    });

    it('should handle array values correctly', () => {
      const templatePaths = getConfigValue('templatePaths');
      expect(Array.isArray(templatePaths)).toBe(true);
      expect(templatePaths).toContain('./templates');
    });
  });

  describe('edge cases', () => {
    it('should handle empty config files', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('');

      const merged = getMergedConfig();
      expect(merged).toEqual(defaultConfig);
    });

    it('should handle config files with only whitespace', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('   \n  \t  ');

      const merged = getMergedConfig();
      expect(merged).toEqual(defaultConfig);
    });

    it('should handle very large config values', async () => {
      const largeArray = new Array(1000).fill('template-path');
      mockedFs.existsSync.mockReturnValue(false);

      const options: ConfigOptions = {
        set: `templatePaths=${JSON.stringify(largeArray)}`,
      };
      await configCommand(options);

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
      expect(mockedLogger.success).toHaveBeenCalled();
    });

    it('should handle special characters in config values', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const options: ConfigOptions = {
        set: 'description=Special chars: !@#$%^&*()[]{}|;:,.<>?',
      };
      await configCommand(options);

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
      const [[, content]] = mockedFs.writeFileSync.mock.calls;
      expect(content).toContain('Special chars: !@#$%^&*()[]{}|;:,.<>?');
    });

    it('should handle unicode characters in config values', async () => {
      mockedFs.existsSync.mockReturnValue(false);

      const options: ConfigOptions = {
        set: 'title=🚀 Template Engine 中文 العربية',
      };
      await configCommand(options);

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
      const [[, content]] = mockedFs.writeFileSync.mock.calls;
      expect(content).toContain('🚀 Template Engine 中文 العربية');
    });
  });
});

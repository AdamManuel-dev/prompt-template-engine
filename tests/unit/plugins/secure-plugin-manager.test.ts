/**
 * @fileoverview Comprehensive tests for secure plugin manager
 * @lastmodified 2025-08-23T05:30:00Z
 * 
 * Features: Tests for plugin loading, validation, and lifecycle management
 * Main APIs: SecurePluginManager class, security policy enforcement
 * Constraints: File system access, plugin validation, sandbox integration
 * Patterns: Unit testing, async testing, file system mocking
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { SecurePluginManager, DEFAULT_SECURITY_POLICY } from '../../../src/plugins/secure-plugin-manager';
import { PluginSandbox } from '../../../src/plugins/sandbox/plugin-sandbox';

// Mock file system operations
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock plugin sandbox
jest.mock('../../../src/plugins/sandbox/plugin-sandbox');
const MockPluginSandbox = PluginSandbox as jest.MockedClass<typeof PluginSandbox>;

describe('SecurePluginManager', () => {
  let pluginManager: SecurePluginManager;
  let mockSandbox: jest.Mocked<PluginSandbox>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSandbox = {
      executePlugin: jest.fn().mockResolvedValue({
        success: true,
        result: 'Plugin executed successfully',
        stats: { executionTime: 100, memoryUsed: 10, cpuUsage: 5 }
      }),
      cleanup: jest.fn().mockResolvedValue(undefined)
    } as any;

    MockPluginSandbox.mockImplementation(() => mockSandbox);

    pluginManager = new SecurePluginManager('./test-plugins');
  });

  afterEach(async () => {
    await pluginManager.cleanup();
  });

  describe('Plugin Loading', () => {
    const mockPluginCode = `
      module.exports = {
        name: 'test-plugin',
        version: '1.0.0',
        description: 'Test plugin',
        author: 'test-author',
        init: () => true,
        execute: () => 'Hello World'
      };
    `;

    beforeEach(() => {
      mockFs.readFile.mockResolvedValue(mockPluginCode);
    });

    it('should load a valid plugin', async () => {
      await pluginManager.loadPlugin('./test-plugins/test-plugin.js');

      expect(mockFs.readFile).toHaveBeenCalledWith('./test-plugins/test-plugin.js', 'utf8');
      expect(pluginManager.listPlugins()).toHaveLength(1);
      
      const pluginInfo = pluginManager.getPluginInfo('test-plugin');
      expect(pluginInfo).not.toBeNull();
      expect(pluginInfo!.name).toBe('test-plugin');
      expect(pluginInfo!.version).toBe('1.0.0');
    });

    it('should reject plugins outside allowed directory', async () => {
      await expect(
        pluginManager.loadPlugin('../../malicious-plugin.js')
      ).rejects.toThrow('Plugin path outside allowed directory');

      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('should validate plugin code size', async () => {
      const largePluginCode = 'x'.repeat(2 * 1024 * 1024); // 2MB
      mockFs.readFile.mockResolvedValue(largePluginCode);

      await expect(
        pluginManager.loadPlugin('./test-plugins/large-plugin.js')
      ).rejects.toThrow('Plugin code too large');
    });

    it('should detect eval usage when disabled', async () => {
      const maliciousCode = `
        module.exports = {
          name: 'malicious',
          execute: () => eval('console.log("hacked")')
        };
      `;
      mockFs.readFile.mockResolvedValue(maliciousCode);

      await expect(
        pluginManager.loadPlugin('./test-plugins/malicious.js')
      ).rejects.toThrow('Plugin contains eval() or Function constructor');
    });

    it('should detect dynamic imports when disabled', async () => {
      const maliciousCode = `
        module.exports = {
          name: 'malicious',
          execute: async () => {
            const module = await import('fs');
            return module;
          }
        };
      `;
      mockFs.readFile.mockResolvedValue(maliciousCode);

      await expect(
        pluginManager.loadPlugin('./test-plugins/malicious.js')
      ).rejects.toThrow('Plugin contains dynamic imports or require calls');
    });

    it('should detect dangerous patterns', async () => {
      const dangerousCode = `
        const { exec } = require('child_process');
        module.exports = {
          name: 'dangerous',
          execute: () => exec('rm -rf /')
        };
      `;
      mockFs.readFile.mockResolvedValue(dangerousCode);

      await expect(
        pluginManager.loadPlugin('./test-plugins/dangerous.js')
      ).rejects.toThrow('Plugin contains dangerous pattern');
    });

    it('should enforce author whitelist', async () => {
      const securityPolicy = {
        ...DEFAULT_SECURITY_POLICY,
        allowedAuthors: ['trusted-author']
      };

      const manager = new SecurePluginManager('./test-plugins', securityPolicy);
      
      await expect(
        manager.loadPlugin('./test-plugins/test-plugin.js')
      ).rejects.toThrow('Plugin author not in allowed list');

      await manager.cleanup();
    });

    it('should enforce plugin blacklist', async () => {
      const securityPolicy = {
        ...DEFAULT_SECURITY_POLICY,
        blacklistedPlugins: ['test-plugin']
      };

      const manager = new SecurePluginManager('./test-plugins', securityPolicy);
      
      await expect(
        manager.loadPlugin('./test-plugins/test-plugin.js')
      ).rejects.toThrow('Plugin is blacklisted');

      await manager.cleanup();
    });
  });

  describe('Plugin Execution', () => {
    beforeEach(async () => {
      const mockPluginCode = `
        module.exports = {
          name: 'test-plugin',
          version: '1.0.0',
          description: 'Test plugin',
          author: 'test-author',
          init: () => true,
          execute: () => 'Hello World'
        };
      `;
      mockFs.readFile.mockResolvedValue(mockPluginCode);
      await pluginManager.loadPlugin('./test-plugins/test-plugin.js');
    });

    it('should execute plugin successfully', async () => {
      const result = await pluginManager.executePlugin('test-plugin', 'execute');

      expect(result.success).toBe(true);
      expect(result.result).toBe('Plugin executed successfully');
      expect(mockSandbox.executePlugin).toHaveBeenCalled();
    });

    it('should handle plugin execution failure', async () => {
      mockSandbox.executePlugin.mockResolvedValue({
        success: false,
        error: 'Plugin execution failed',
        stats: { executionTime: 50, memoryUsed: 5, cpuUsage: 2 }
      });

      const result = await pluginManager.executePlugin('test-plugin', 'execute');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Plugin execution failed');
    });

    it('should return error for non-existent plugin', async () => {
      const result = await pluginManager.executePlugin('non-existent', 'execute');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Plugin not found: non-existent');
    });

    it('should track execution statistics', async () => {
      await pluginManager.executePlugin('test-plugin', 'execute');

      const pluginInfo = pluginManager.getPluginInfo('test-plugin');
      expect(pluginInfo!.executionCount).toBe(1);
      expect(pluginInfo!.lastExecuted).toBeInstanceOf(Date);
    });

    it('should track execution errors', async () => {
      mockSandbox.executePlugin.mockResolvedValue({
        success: false,
        error: 'Execution error',
        stats: { executionTime: 10, memoryUsed: 1, cpuUsage: 1 }
      });

      await pluginManager.executePlugin('test-plugin', 'execute');

      const pluginInfo = pluginManager.getPluginInfo('test-plugin');
      expect(pluginInfo!.errors).toHaveLength(1);
      expect(pluginInfo!.errors[0]).toContain('Execution error');
    });

    it('should limit error history to 10 entries', async () => {
      mockSandbox.executePlugin.mockResolvedValue({
        success: false,
        error: 'Repeated error',
        stats: { executionTime: 10, memoryUsed: 1, cpuUsage: 1 }
      });

      // Generate 15 errors
      for (let i = 0; i < 15; i++) {
        await pluginManager.executePlugin('test-plugin', 'execute');
      }

      const pluginInfo = pluginManager.getPluginInfo('test-plugin');
      expect(pluginInfo!.errors).toHaveLength(10);
    });
  });

  describe('Plugin Lifecycle', () => {
    beforeEach(async () => {
      const mockPluginCode = `
        module.exports = {
          name: 'lifecycle-plugin',
          version: '1.0.0',
          init: () => true,
          activate: () => true,
          deactivate: () => true,
          dispose: () => undefined
        };
      `;
      mockFs.readFile.mockResolvedValue(mockPluginCode);
      await pluginManager.loadPlugin('./test-plugins/lifecycle-plugin.js');
    });

    it('should initialize plugins', async () => {
      await pluginManager.initializePlugins();

      expect(mockSandbox.executePlugin).toHaveBeenCalledWith(
        expect.any(Object),
        'init',
        []
      );
      expect(pluginManager.getActivePlugins()).toContain('lifecycle-plugin');
    });

    it('should activate plugin', async () => {
      const result = await pluginManager.activatePlugin('lifecycle-plugin');

      expect(result).toBe(true);
      expect(pluginManager.getActivePlugins()).toContain('lifecycle-plugin');
    });

    it('should deactivate plugin', async () => {
      await pluginManager.activatePlugin('lifecycle-plugin');
      const result = await pluginManager.deactivatePlugin('lifecycle-plugin');

      expect(result).toBe(true);
      expect(pluginManager.getActivePlugins()).not.toContain('lifecycle-plugin');
    });

    it('should unload plugin', async () => {
      const result = await pluginManager.unloadPlugin('lifecycle-plugin');

      expect(result).toBe(true);
      expect(pluginManager.listPlugins()).toHaveLength(0);
      expect(pluginManager.getPluginInfo('lifecycle-plugin')).toBeNull();
    });

    it('should handle activation failure', async () => {
      mockSandbox.executePlugin.mockResolvedValue({
        success: false,
        error: 'Activation failed',
        stats: { executionTime: 10, memoryUsed: 1, cpuUsage: 1 }
      });

      const result = await pluginManager.activatePlugin('lifecycle-plugin');

      expect(result).toBe(false);
      expect(pluginManager.getActivePlugins()).not.toContain('lifecycle-plugin');
    });
  });

  describe('Plugin Directory Loading', () => {
    it('should load all plugins from directory', async () => {
      mockFs.readdir.mockResolvedValue([
        'plugin1.js',
        'plugin2.ts',
        'readme.txt',
        'plugin3.js'
      ] as any);

      const plugin1Code = 'module.exports = { name: "plugin1", version: "1.0.0" };';
      const plugin2Code = 'export default { name: "plugin2", version: "1.0.0" };';
      const plugin3Code = 'module.exports = { name: "plugin3", version: "1.0.0" };';

      mockFs.readFile
        .mockResolvedValueOnce(plugin1Code)
        .mockResolvedValueOnce(plugin2Code)
        .mockResolvedValueOnce(plugin3Code);

      await pluginManager.loadPluginsFromDirectory();

      expect(mockFs.readFile).toHaveBeenCalledTimes(3);
      expect(pluginManager.listPlugins()).toHaveLength(3);
    });

    it('should continue loading other plugins if one fails', async () => {
      mockFs.readdir.mockResolvedValue([
        'good-plugin.js',
        'bad-plugin.js'
      ] as any);

      const goodPluginCode = 'module.exports = { name: "good", version: "1.0.0" };';
      const badPluginCode = 'x'.repeat(2 * 1024 * 1024); // Too large

      mockFs.readFile
        .mockResolvedValueOnce(goodPluginCode)
        .mockResolvedValueOnce(badPluginCode);

      await pluginManager.loadPluginsFromDirectory();

      expect(pluginManager.listPlugins()).toHaveLength(1);
      expect(pluginManager.getPluginInfo('good')).not.toBeNull();
    });

    it('should handle directory read errors', async () => {
      mockFs.readdir.mockRejectedValue(new Error('Directory not found'));

      await pluginManager.loadPluginsFromDirectory();

      expect(pluginManager.listPlugins()).toHaveLength(0);
    });
  });

  describe('Security Policy', () => {
    it('should use default security policy', () => {
      const manager = new SecurePluginManager();
      
      // We can't directly test the private policy, but we can test its effects
      expect(manager).toBeInstanceOf(SecurePluginManager);
    });

    it('should accept custom security policy', () => {
      const customPolicy = {
        ...DEFAULT_SECURITY_POLICY,
        maxCodeSize: 512 * 1024,
        allowedAuthors: ['trusted-dev']
      };

      const manager = new SecurePluginManager('./plugins', customPolicy);
      expect(manager).toBeInstanceOf(SecurePluginManager);
    });
  });

  describe('Plugin Information', () => {
    beforeEach(async () => {
      const mockPluginCode = `
        module.exports = {
          name: 'info-plugin',
          version: '2.1.0',
          description: 'Plugin for testing info',
          author: 'info-author'
        };
      `;
      mockFs.readFile.mockResolvedValue(mockPluginCode);
      await pluginManager.loadPlugin('./test-plugins/info-plugin.js');
    });

    it('should return plugin information', () => {
      const info = pluginManager.getPluginInfo('info-plugin');

      expect(info).not.toBeNull();
      expect(info!.name).toBe('info-plugin');
      expect(info!.version).toBe('2.1.0');
      expect(info!.author).toBe('info-author');
      expect(info!.loadedAt).toBeInstanceOf(Date);
      expect(info!.executionCount).toBe(0);
      expect(info!.errors).toEqual([]);
    });

    it('should return null for non-existent plugin', () => {
      const info = pluginManager.getPluginInfo('non-existent');
      expect(info).toBeNull();
    });

    it('should list all plugins', () => {
      const plugins = pluginManager.listPlugins();

      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('info-plugin');
    });

    it('should return active plugins list', async () => {
      await pluginManager.activatePlugin('info-plugin');
      const activePlugins = pluginManager.getActivePlugins();

      expect(activePlugins).toContain('info-plugin');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all resources', async () => {
      await pluginManager.cleanup();

      expect(mockSandbox.cleanup).toHaveBeenCalled();
    });

    it('should deactivate all plugins during cleanup', async () => {
      const mockPluginCode = `
        module.exports = {
          name: 'cleanup-plugin',
          version: '1.0.0',
          deactivate: () => true
        };
      `;
      mockFs.readFile.mockResolvedValue(mockPluginCode);
      await pluginManager.loadPlugin('./test-plugins/cleanup-plugin.js');
      await pluginManager.activatePlugin('cleanup-plugin');

      await pluginManager.cleanup();

      expect(mockSandbox.executePlugin).toHaveBeenCalledWith(
        expect.any(Object),
        'deactivate',
        []
      );
    });
  });
});

describe('Default Security Policy', () => {
  it('should have secure defaults', () => {
    expect(DEFAULT_SECURITY_POLICY.requireSignature).toBe(false);
    expect(DEFAULT_SECURITY_POLICY.allowedAuthors).toEqual([]);
    expect(DEFAULT_SECURITY_POLICY.blacklistedPlugins).toEqual([]);
    expect(DEFAULT_SECURITY_POLICY.disallowEval).toBe(true);
    expect(DEFAULT_SECURITY_POLICY.disallowDynamicImports).toBe(true);
    expect(DEFAULT_SECURITY_POLICY.maxCodeSize).toBe(1024 * 1024);
    
    expect(DEFAULT_SECURITY_POLICY.sandbox.maxMemoryMB).toBe(50);
    expect(DEFAULT_SECURITY_POLICY.sandbox.maxExecutionTimeMs).toBe(10000);
    expect(DEFAULT_SECURITY_POLICY.sandbox.allowNetworkAccess).toBe(false);
    expect(DEFAULT_SECURITY_POLICY.sandbox.allowedAPIs).toContain('log');
  });
});
/**
 * @fileoverview Unit tests for enhanced plugin system architecture
 * @lastmodified 2025-08-23T02:56:00Z
 *
 * Features: Plugin loading, lifecycle, hooks, API, sandboxing
 * Main APIs: PluginManager, PluginAPI, Plugin lifecycle tests
 * Constraints: Test security, isolation, performance
 * Patterns: BDD testing, plugin mocking, lifecycle validation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EnhancedPluginManager } from '../../../src/cli/enhanced-plugin-manager';
import { PluginAPI } from '../../../src/cli/plugin-api';
import { IPlugin, PluginMetadata, PluginHook } from '../../../src/types';
import { EventEmitter } from 'events';

jest.mock('fs/promises');
jest.mock('../../../src/utils/logger');

describe('Plugin System Architecture', () => {
  let pluginManager: EnhancedPluginManager;
  let pluginApi: PluginAPI;
  let mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    pluginManager = new EnhancedPluginManager();
    pluginApi = new PluginAPI();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    pluginManager.unloadAll();
  });

  describe('Plugin Loading', () => {
    it('should load a valid plugin from file', async () => {
      const pluginCode = `
        module.exports = {
          name: 'test-plugin',
          version: '1.0.0',
          init: function(api) {
            this.api = api;
            return true;
          },
          execute: function(context) {
            return { success: true };
          }
        };
      `;

      mockFs.readFile.mockResolvedValue(pluginCode);
      mockFs.stat.mockResolvedValue({ isFile: () => true } as any);

      const plugin = await pluginManager.loadPlugin('test-plugin.js');

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('test-plugin');
      expect(plugin.version).toBe('1.0.0');
    });

    it('should load plugins from directory', async () => {
      mockFs.readdir.mockResolvedValue(['plugin1.js', 'plugin2.js', 'not-a-plugin.txt'] as any);
      mockFs.stat.mockResolvedValue({ isFile: () => true } as any);
      
      const plugin1 = `
        module.exports = {
          name: 'plugin1',
          version: '1.0.0',
          init: () => true
        };
      `;
      
      const plugin2 = `
        module.exports = {
          name: 'plugin2',
          version: '2.0.0',
          init: () => true
        };
      `;

      mockFs.readFile
        .mockResolvedValueOnce(plugin1)
        .mockResolvedValueOnce(plugin2);

      const plugins = await pluginManager.loadPluginsFromDirectory('./plugins');

      expect(plugins).toHaveLength(2);
      expect(plugins[0].name).toBe('plugin1');
      expect(plugins[1].name).toBe('plugin2');
    });

    it('should validate plugin metadata', async () => {
      const invalidPlugin = `
        module.exports = {
          // Missing required fields
          execute: function() {}
        };
      `;

      mockFs.readFile.mockResolvedValue(invalidPlugin);

      await expect(pluginManager.loadPlugin('invalid.js')).rejects.toThrow(
        'Invalid plugin metadata'
      );
    });

    it('should handle plugin dependencies', async () => {
      const pluginWithDeps = `
        module.exports = {
          name: 'dependent-plugin',
          version: '1.0.0',
          dependencies: ['base-plugin@^1.0.0'],
          init: function(api) {
            const basePlugin = api.getPlugin('base-plugin');
            return basePlugin !== null;
          }
        };
      `;

      mockFs.readFile.mockResolvedValue(pluginWithDeps);

      // Load base plugin first
      await pluginManager.loadPlugin('base-plugin.js');
      const plugin = await pluginManager.loadPlugin('dependent.js');

      expect(plugin).toBeDefined();
    });

    it('should sandbox plugin execution', async () => {
      const maliciousPlugin = `
        module.exports = {
          name: 'malicious',
          version: '1.0.0',
          init: function() {
            process.exit(1); // Should be prevented
            return true;
          }
        };
      `;

      mockFs.readFile.mockResolvedValue(maliciousPlugin);

      const plugin = await pluginManager.loadPlugin('malicious.js', {
        sandbox: true,
      });

      expect(plugin).toBeDefined();
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('Plugin Lifecycle', () => {
    const createMockPlugin = (name: string): IPlugin => ({
      name,
      version: '1.0.0',
      init: jest.fn().mockResolvedValue(true),
      activate: jest.fn().mockResolvedValue(true),
      deactivate: jest.fn().mockResolvedValue(true),
      dispose: jest.fn().mockResolvedValue(true),
      execute: jest.fn(),
    });

    it('should call lifecycle methods in correct order', async () => {
      const plugin = createMockPlugin('lifecycle-test');
      
      await pluginManager.registerPlugin(plugin);
      expect(plugin.init).toHaveBeenCalledWith(expect.any(PluginAPI));

      await pluginManager.activatePlugin('lifecycle-test');
      expect(plugin.activate).toHaveBeenCalled();

      await pluginManager.deactivatePlugin('lifecycle-test');
      expect(plugin.deactivate).toHaveBeenCalled();

      await pluginManager.unloadPlugin('lifecycle-test');
      expect(plugin.dispose).toHaveBeenCalled();
    });

    it('should handle plugin activation errors', async () => {
      const plugin = createMockPlugin('error-plugin');
      plugin.activate = jest.fn().mockRejectedValue(new Error('Activation failed'));

      await pluginManager.registerPlugin(plugin);

      await expect(
        pluginManager.activatePlugin('error-plugin')
      ).rejects.toThrow('Activation failed');

      expect(pluginManager.isActive('error-plugin')).toBe(false);
    });

    it('should prevent double activation', async () => {
      const plugin = createMockPlugin('single-activation');
      
      await pluginManager.registerPlugin(plugin);
      await pluginManager.activatePlugin('single-activation');
      await pluginManager.activatePlugin('single-activation');

      expect(plugin.activate).toHaveBeenCalledTimes(1);
    });

    it('should handle plugin hot reload', async () => {
      const plugin = createMockPlugin('hot-reload');
      const updatedPlugin = createMockPlugin('hot-reload');
      updatedPlugin.version = '2.0.0';

      await pluginManager.registerPlugin(plugin);
      await pluginManager.activatePlugin('hot-reload');

      await pluginManager.reloadPlugin('hot-reload', updatedPlugin);

      expect(plugin.deactivate).toHaveBeenCalled();
      expect(plugin.dispose).toHaveBeenCalled();
      expect(updatedPlugin.init).toHaveBeenCalled();
      expect(updatedPlugin.activate).toHaveBeenCalled();
    });
  });

  describe('Plugin Hooks', () => {
    it('should register and trigger hooks', async () => {
      const hookCallback = jest.fn();
      const plugin: IPlugin = {
        name: 'hook-plugin',
        version: '1.0.0',
        hooks: {
          'before-command': hookCallback,
        },
        init: jest.fn().mockResolvedValue(true),
      };

      await pluginManager.registerPlugin(plugin);
      await pluginManager.triggerHook('before-command', { command: 'test' });

      expect(hookCallback).toHaveBeenCalledWith({ command: 'test' });
    });

    it('should execute hooks in priority order', async () => {
      const execOrder: string[] = [];
      
      const highPriorityPlugin: IPlugin = {
        name: 'high-priority',
        version: '1.0.0',
        priority: 10,
        hooks: {
          'test-hook': () => execOrder.push('high'),
        },
        init: jest.fn().mockResolvedValue(true),
      };

      const lowPriorityPlugin: IPlugin = {
        name: 'low-priority',
        version: '1.0.0',
        priority: 1,
        hooks: {
          'test-hook': () => execOrder.push('low'),
        },
        init: jest.fn().mockResolvedValue(true),
      };

      await pluginManager.registerPlugin(lowPriorityPlugin);
      await pluginManager.registerPlugin(highPriorityPlugin);
      await pluginManager.triggerHook('test-hook', {});

      expect(execOrder).toEqual(['high', 'low']);
    });

    it('should allow hooks to modify context', async () => {
      const plugin: IPlugin = {
        name: 'modifier-plugin',
        version: '1.0.0',
        hooks: {
          'before-template': (context: any) => {
            context.modified = true;
            return context;
          },
        },
        init: jest.fn().mockResolvedValue(true),
      };

      await pluginManager.registerPlugin(plugin);
      const result = await pluginManager.triggerHook('before-template', {
        template: 'test',
      });

      expect(result).toEqual({
        template: 'test',
        modified: true,
      });
    });

    it('should handle async hooks', async () => {
      const plugin: IPlugin = {
        name: 'async-plugin',
        version: '1.0.0',
        hooks: {
          'async-hook': async (context: any) => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return { ...context, processed: true };
          },
        },
        init: jest.fn().mockResolvedValue(true),
      };

      await pluginManager.registerPlugin(plugin);
      const result = await pluginManager.triggerHook('async-hook', {});

      expect(result).toEqual({ processed: true });
    });

    it('should stop hook chain on error by default', async () => {
      const plugin1: IPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        hooks: {
          'error-hook': () => {
            throw new Error('Hook error');
          },
        },
        init: jest.fn().mockResolvedValue(true),
      };

      const plugin2: IPlugin = {
        name: 'after-error',
        version: '1.0.0',
        hooks: {
          'error-hook': jest.fn(),
        },
        init: jest.fn().mockResolvedValue(true),
      };

      await pluginManager.registerPlugin(plugin1);
      await pluginManager.registerPlugin(plugin2);

      await expect(
        pluginManager.triggerHook('error-hook', {})
      ).rejects.toThrow('Hook error');

      expect(plugin2.hooks!['error-hook']).not.toHaveBeenCalled();
    });
  });

  describe('Plugin API', () => {
    it('should provide access to core functionality', () => {
      const api = new PluginAPI();

      expect(api.getVersion()).toBeDefined();
      expect(api.getConfig).toBeDefined();
      expect(api.setConfig).toBeDefined();
      expect(api.registerCommand).toBeDefined();
      expect(api.emit).toBeDefined();
    });

    it('should allow plugins to register commands', async () => {
      const plugin: IPlugin = {
        name: 'command-plugin',
        version: '1.0.0',
        init: function(api: PluginAPI) {
          api.registerCommand('plugin-command', {
            execute: () => console.log('Plugin command executed'),
            description: 'A command from plugin',
          });
          return true;
        },
      };

      await pluginManager.registerPlugin(plugin);

      const command = pluginApi.getCommand('plugin-command');
      expect(command).toBeDefined();
      expect(command.description).toBe('A command from plugin');
    });

    it('should provide inter-plugin communication', async () => {
      const receivedMessages: any[] = [];

      const senderPlugin: IPlugin = {
        name: 'sender',
        version: '1.0.0',
        init: function(api: PluginAPI) {
          api.sendMessage('receiver', { data: 'test' });
          return true;
        },
      };

      const receiverPlugin: IPlugin = {
        name: 'receiver',
        version: '1.0.0',
        init: function(api: PluginAPI) {
          api.onMessage((message: any) => {
            receivedMessages.push(message);
          });
          return true;
        },
      };

      await pluginManager.registerPlugin(receiverPlugin);
      await pluginManager.registerPlugin(senderPlugin);

      expect(receivedMessages).toContainEqual({
        from: 'sender',
        data: 'test',
      });
    });

    it('should provide storage API for plugins', async () => {
      const plugin: IPlugin = {
        name: 'storage-plugin',
        version: '1.0.0',
        init: async function(api: PluginAPI) {
          await api.storage.set('key', 'value');
          const value = await api.storage.get('key');
          expect(value).toBe('value');
          return true;
        },
      };

      await pluginManager.registerPlugin(plugin);
    });

    it('should provide file system access with restrictions', async () => {
      const plugin: IPlugin = {
        name: 'fs-plugin',
        version: '1.0.0',
        init: async function(api: PluginAPI) {
          // Should only access allowed directories
          await expect(
            api.fs.readFile('/etc/passwd')
          ).rejects.toThrow('Access denied');

          // Should allow plugin directory access
          await api.fs.readFile('./plugin-data/config.json');
          return true;
        },
      };

      mockFs.readFile.mockImplementation((path: any) => {
        if (path.includes('/etc/')) {
          throw new Error('Access denied');
        }
        return Promise.resolve('{}');
      });

      await pluginManager.registerPlugin(plugin);
    });
  });

  describe('Plugin Security', () => {
    it('should validate plugin permissions', async () => {
      const plugin: IPlugin = {
        name: 'restricted-plugin',
        version: '1.0.0',
        permissions: ['fs:read', 'network:http'],
        init: function(api: PluginAPI) {
          // Should not be able to write files without permission
          expect(() => api.fs.writeFile).toThrow();
          return true;
        },
      };

      await pluginManager.registerPlugin(plugin);
    });

    it('should isolate plugin contexts', async () => {
      let plugin1Data: any;
      let plugin2Data: any;

      const plugin1: IPlugin = {
        name: 'plugin1',
        version: '1.0.0',
        init: function(api: PluginAPI) {
          api.setContext('shared', 'plugin1-value');
          plugin1Data = api.getContext('shared');
          return true;
        },
      };

      const plugin2: IPlugin = {
        name: 'plugin2',
        version: '1.0.0',
        init: function(api: PluginAPI) {
          plugin2Data = api.getContext('shared');
          return true;
        },
      };

      await pluginManager.registerPlugin(plugin1);
      await pluginManager.registerPlugin(plugin2);

      expect(plugin1Data).toBe('plugin1-value');
      expect(plugin2Data).toBeUndefined();
    });

    it('should prevent prototype pollution', async () => {
      const maliciousPlugin: IPlugin = {
        name: 'malicious',
        version: '1.0.0',
        init: function() {
          // Attempt prototype pollution
          const obj: any = {};
          obj.__proto__.polluted = 'hacked';
          return true;
        },
      };

      await pluginManager.registerPlugin(maliciousPlugin);

      const testObj: any = {};
      expect(testObj.polluted).toBeUndefined();
    });

    it('should limit resource usage', async () => {
      const resourceHog: IPlugin = {
        name: 'resource-hog',
        version: '1.0.0',
        init: function() {
          // Try to consume excessive memory
          const arrays = [];
          for (let i = 0; i < 1000000; i++) {
            arrays.push(new Array(1000000));
          }
          return true;
        },
      };

      await expect(
        pluginManager.registerPlugin(resourceHog, {
          memoryLimit: 50 * 1024 * 1024, // 50MB limit
        })
      ).rejects.toThrow('Memory limit exceeded');
    });
  });

  describe('Plugin Events', () => {
    it('should emit plugin lifecycle events', async () => {
      const events: string[] = [];
      
      pluginManager.on('plugin:loaded', (name) => events.push(`loaded:${name}`));
      pluginManager.on('plugin:activated', (name) => events.push(`activated:${name}`));
      pluginManager.on('plugin:deactivated', (name) => events.push(`deactivated:${name}`));
      pluginManager.on('plugin:unloaded', (name) => events.push(`unloaded:${name}`));

      const plugin = {
        name: 'event-test',
        version: '1.0.0',
        init: jest.fn().mockResolvedValue(true),
        activate: jest.fn().mockResolvedValue(true),
        deactivate: jest.fn().mockResolvedValue(true),
        dispose: jest.fn().mockResolvedValue(true),
      };

      await pluginManager.registerPlugin(plugin);
      await pluginManager.activatePlugin('event-test');
      await pluginManager.deactivatePlugin('event-test');
      await pluginManager.unloadPlugin('event-test');

      expect(events).toEqual([
        'loaded:event-test',
        'activated:event-test',
        'deactivated:event-test',
        'unloaded:event-test',
      ]);
    });

    it('should handle plugin error events', async () => {
      const errors: any[] = [];
      pluginManager.on('plugin:error', (error) => errors.push(error));

      const errorPlugin: IPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        init: function() {
          throw new Error('Init failed');
        },
      };

      try {
        await pluginManager.registerPlugin(errorPlugin);
      } catch (e) {
        // Expected
      }

      expect(errors).toHaveLength(1);
      expect(errors[0].plugin).toBe('error-plugin');
      expect(errors[0].error.message).toBe('Init failed');
    });
  });

  describe('Plugin Discovery', () => {
    it('should auto-discover plugins in configured paths', async () => {
      pluginManager.setPluginPaths([
        './plugins',
        './node_modules/@company/plugins',
      ]);

      mockFs.readdir
        .mockResolvedValueOnce(['plugin1.js', 'plugin2.js'] as any)
        .mockResolvedValueOnce(['plugin3.js'] as any);

      const discovered = await pluginManager.discoverPlugins();

      expect(discovered).toHaveLength(3);
    });

    it('should filter plugins by pattern', async () => {
      mockFs.readdir.mockResolvedValue([
        'my-plugin.js',
        'other-plugin.js',
        'not-a-plugin.txt',
        'plugin.config.js',
      ] as any);

      const discovered = await pluginManager.discoverPlugins({
        pattern: /^.+-plugin\.js$/,
      });

      expect(discovered).toHaveLength(2);
      expect(discovered).toContain('my-plugin.js');
      expect(discovered).toContain('other-plugin.js');
    });
  });

  describe('Plugin Configuration', () => {
    it('should load plugin configuration', async () => {
      const plugin: IPlugin = {
        name: 'configurable',
        version: '1.0.0',
        defaultConfig: {
          option1: 'default1',
          option2: 'default2',
        },
        init: function(api: PluginAPI, config: any) {
          expect(config.option1).toBe('custom1');
          expect(config.option2).toBe('default2');
          return true;
        },
      };

      await pluginManager.registerPlugin(plugin, {
        config: {
          option1: 'custom1',
        },
      });
    });

    it('should validate plugin configuration schema', async () => {
      const plugin: IPlugin = {
        name: 'schema-plugin',
        version: '1.0.0',
        configSchema: {
          type: 'object',
          required: ['requiredOption'],
          properties: {
            requiredOption: { type: 'string' },
          },
        },
        init: jest.fn().mockResolvedValue(true),
      };

      await expect(
        pluginManager.registerPlugin(plugin, {
          config: { wrongOption: 'value' },
        })
      ).rejects.toThrow('Invalid plugin configuration');
    });
  });
});
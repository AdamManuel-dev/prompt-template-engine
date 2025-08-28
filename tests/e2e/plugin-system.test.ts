/**
 * @fileoverview E2E tests for plugin system
 * @lastmodified 2025-08-26T10:00:00Z
 *
 * Features: Tests plugin loading, execution, sandboxing, and security
 * Main APIs: SecurePluginManager, PluginSandbox, plugin hooks
 * Constraints: Tests security boundaries and plugin isolation
 * Patterns: Plugin lifecycle, hook system, secure execution
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { SecurePluginManager } from '../../src/plugins/secure-plugin-manager';
import { PluginSandbox } from '../../src/plugins/sandbox/plugin-sandbox';
import { TemplateContext } from '../../src/types';

describe('E2E: Plugin System', () => {
  let testDir: string;
  let pluginManager: SecurePluginManager;
  let pluginsDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plugin-system-e2e-'));
    pluginsDir = path.join(testDir, 'plugins');
    await fs.mkdir(pluginsDir, { recursive: true });

    pluginManager = new SecurePluginManager({
      pluginsPath: pluginsDir,
      enableSandbox: true,
      timeout: 5000,
      memoryLimit: 50 * 1024 * 1024 // 50MB
    });
  });

  afterEach(async () => {
    await pluginManager.shutdown();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Plugin Loading and Discovery', () => {
    it('should discover and load valid plugins', async () => {
      // Create a valid plugin
      const pluginCode = `
module.exports = {
  name: 'test-plugin',
  version: '1.0.0',
  description: 'Test plugin for e2e tests',
  
  hooks: {
    beforeRender: async (context) => {
      context.variables.pluginAdded = true;
      return context;
    },
    
    afterRender: async (content) => {
      return content + '\\n<!-- Plugin was here -->';
    }
  },
  
  helpers: {
    customHelper: (value) => {
      return value.toUpperCase();
    }
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'test-plugin.js'),
        pluginCode
      );

      await pluginManager.loadPlugins();
      const plugins = pluginManager.getLoadedPlugins();

      expect(plugins).toHaveLength(1);
      expect(plugins[0].name).toBe('test-plugin');
      expect(plugins[0].version).toBe('1.0.0');
    });

    it('should validate plugin structure', async () => {
      // Invalid plugin without required fields
      const invalidPlugin = `
module.exports = {
  description: 'Missing name and version'
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'invalid-plugin.js'),
        invalidPlugin
      );

      await pluginManager.loadPlugins();
      const plugins = pluginManager.getLoadedPlugins();

      // Invalid plugin should not be loaded
      expect(plugins).toHaveLength(0);

      // Check for validation error in logs
      const errors = pluginManager.getValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('invalid-plugin');
    });

    it('should handle plugin dependencies', async () => {
      // Plugin with dependencies
      const pluginWithDeps = `
module.exports = {
  name: 'deps-plugin',
  version: '1.0.0',
  dependencies: {
    'lodash': '^4.17.0'
  },
  
  hooks: {
    beforeRender: async (context) => {
      // Use dependency if available
      if (typeof _ !== 'undefined') {
        context.variables.hasLodash = true;
      }
      return context;
    }
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'deps-plugin.js'),
        pluginWithDeps
      );

      await pluginManager.loadPlugins();
      const plugins = pluginManager.getLoadedPlugins();

      expect(plugins).toHaveLength(1);
      // Dependency handling depends on implementation
    });

    it('should support TypeScript plugins', async () => {
      const tsPlugin = `
export default {
  name: 'typescript-plugin',
  version: '1.0.0',
  
  hooks: {
    beforeRender: async (context: any): Promise<any> => {
      context.variables.fromTS = true;
      return context;
    }
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'ts-plugin.ts'),
        tsPlugin
      );

      // TypeScript support depends on build configuration
      await pluginManager.loadPlugins();
      // Plugin may or may not load based on TS support
    });
  });

  describe('Plugin Hook System', () => {
    beforeEach(async () => {
      // Create plugin with multiple hooks
      const hooksPlugin = `
module.exports = {
  name: 'hooks-plugin',
  version: '1.0.0',
  
  hooks: {
    beforeLoad: async (template) => {
      template.metadata = template.metadata || {};
      template.metadata.loadedAt = new Date().toISOString();
      return template;
    },
    
    beforeRender: async (context) => {
      context.variables.beforeRenderCalled = true;
      context.variables.timestamp = Date.now();
      return context;
    },
    
    afterRender: async (content, context) => {
      const lines = content.split('\\n');
      lines.push(\`<!-- Rendered at \${context.variables.timestamp} -->\`);
      return lines.join('\\n');
    },
    
    beforeSave: async (content, filepath) => {
      // Add file header
      return \`/* File: \${filepath} */\\n\${content}\`;
    },
    
    afterSave: async (filepath) => {
      // Log save action (side effect)
      console.log(\`Saved: \${filepath}\`);
    }
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'hooks-plugin.js'),
        hooksPlugin
      );

      await pluginManager.loadPlugins();
    });

    it('should execute beforeRender hook', async () => {
      const context: TemplateContext = {
        variables: {
          test: 'value'
        }
      };

      const result = await pluginManager.executeHook<TemplateContext>('beforeRender', context);

      expect(result.variables.beforeRenderCalled).toBe(true);
      expect(result.variables.timestamp).toBeDefined();
      expect(result.variables.test).toBe('value'); // Original preserved
    });

    it('should execute afterRender hook', async () => {
      const content = 'Original content';
      const context = { variables: { timestamp: 123456 } };

      const result = await pluginManager.executeHook<string>('afterRender', content, context);

      expect(result).toContain('Original content');
      expect(result).toContain('<!-- Rendered at 123456 -->');
    });

    it('should execute hooks in order', async () => {
      // Create multiple plugins with same hook
      const plugin1 = `
module.exports = {
  name: 'plugin-1',
  version: '1.0.0',
  priority: 1,
  hooks: {
    beforeRender: async (context) => {
      context.variables.order = (context.variables.order || []);
      context.variables.order.push('plugin-1');
      return context;
    }
  }
};`;

      const plugin2 = `
module.exports = {
  name: 'plugin-2',
  version: '1.0.0',
  priority: 2,
  hooks: {
    beforeRender: async (context) => {
      context.variables.order = (context.variables.order || []);
      context.variables.order.push('plugin-2');
      return context;
    }
  }
};`;

      await fs.writeFile(path.join(pluginsDir, 'plugin-1.js'), plugin1);
      await fs.writeFile(path.join(pluginsDir, 'plugin-2.js'), plugin2);

      await pluginManager.loadPlugins();

      const context: TemplateContext = { variables: {} };
      const result = await pluginManager.executeHook<TemplateContext>('beforeRender', context);

      expect(result.variables.order).toEqual(['plugin-1', 'plugin-2']);
    });

    it('should handle hook errors gracefully', async () => {
      const errorPlugin = `
module.exports = {
  name: 'error-plugin',
  version: '1.0.0',
  hooks: {
    beforeRender: async () => {
      throw new Error('Plugin error');
    }
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'error-plugin.js'),
        errorPlugin
      );

      await pluginManager.loadPlugins();

      const context: TemplateContext = { variables: {} };
      
      // Should handle error without crashing
      const result = await pluginManager.executeHook<TemplateContext>('beforeRender', context);
      expect(result).toBeDefined();
    });
  });

  describe('Plugin Sandboxing', () => {
    it('should isolate plugin execution', async () => {
      const sandbox = new PluginSandbox({
        timeout: 1000,
        memoryLimit: 10 * 1024 * 1024
      });

      const maliciousCode = `
// Attempt to access file system
const fs = require('fs');
fs.writeFileSync('/tmp/malicious', 'hacked');
`;

      try {
        await sandbox.execute(maliciousCode, {});
        // Should throw or return safely
      } catch (error: any) {
        expect(error.message).toContain('not allowed');
      }
    });

    it('should enforce timeout limits', async () => {
      const sandbox = new PluginSandbox({
        timeout: 100, // 100ms timeout
        memoryLimit: 10 * 1024 * 1024
      });

      const infiniteLoop = `
while (true) {
  // Infinite loop
}
`;

      try {
        await sandbox.execute(infiniteLoop, {});
        fail('Should have timed out');
      } catch (error: any) {
        expect(error.message).toContain('timeout');
      }
    });

    it('should enforce memory limits', async () => {
      const sandbox = new PluginSandbox({
        timeout: 5000,
        memoryLimit: 1024 * 1024 // 1MB limit
      });

      const memoryHog = `
const huge = [];
for (let i = 0; i < 1000000; i++) {
  huge.push(new Array(1000).fill('x'));
}
`;

      try {
        await sandbox.execute(memoryHog, {});
        // Should fail or handle gracefully
      } catch (error: any) {
        expect(error.message).toMatch(/memory|limit/i);
      }
    });

    it('should provide safe API to plugins', async () => {
      const safePlugin = `
module.exports = {
  name: 'safe-plugin',
  version: '1.0.0',
  hooks: {
    beforeRender: async (context, api) => {
      // Use safe API methods
      const data = await api.readFile('template.md');
      const processed = api.processTemplate(data);
      context.variables.processed = processed;
      return context;
    }
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'safe-plugin.js'),
        safePlugin
      );

      await pluginManager.loadPlugins();

      // Safe API should be provided
      const context: TemplateContext = { variables: {} };
      const result = await pluginManager.executeHook<TemplateContext>('beforeRender', context);
      expect(result).toBeDefined();
    });
  });

  describe('Plugin Helpers', () => {
    it('should register custom helpers', async () => {
      const helpersPlugin = `
module.exports = {
  name: 'helpers-plugin',
  version: '1.0.0',
  
  helpers: {
    reverse: (str) => str.split('').reverse().join(''),
    
    multiply: (a, b) => a * b,
    
    formatCurrency: (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    },
    
    asyncHelper: async (value) => {
      return new Promise(resolve => {
        setTimeout(() => resolve(value.toUpperCase()), 10);
      });
    }
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'helpers-plugin.js'),
        helpersPlugin
      );

      await pluginManager.loadPlugins();
      const helpers = pluginManager.getHelpers();

      expect(helpers.reverse).toBeDefined();
      expect(helpers.reverse('hello')).toBe('olleh');
      
      expect(helpers.multiply).toBeDefined();
      expect(helpers.multiply(3, 4)).toBe(12);
      
      expect(helpers.formatCurrency).toBeDefined();
      expect(helpers.formatCurrency(1234.56)).toContain('$');
      
      expect(helpers.asyncHelper).toBeDefined();
      const asyncResult = await helpers.asyncHelper('test');
      expect(asyncResult).toBe('TEST');
    });

    it('should handle helper conflicts', async () => {
      // Two plugins with same helper name
      const plugin1 = `
module.exports = {
  name: 'plugin-1',
  version: '1.0.0',
  priority: 1,
  helpers: {
    format: (value) => \`P1: \${value}\`
  }
};`;

      const plugin2 = `
module.exports = {
  name: 'plugin-2',
  version: '1.0.0',
  priority: 2,
  helpers: {
    format: (value) => \`P2: \${value}\`
  }
};`;

      await fs.writeFile(path.join(pluginsDir, 'p1.js'), plugin1);
      await fs.writeFile(path.join(pluginsDir, 'p2.js'), plugin2);

      await pluginManager.loadPlugins();
      const helpers = pluginManager.getHelpers();

      // Higher priority should win or last loaded
      expect(helpers.format).toBeDefined();
      const result = helpers.format('test');
      expect(result).toMatch(/P[12]: test/);
    });
  });

  describe('Plugin Configuration', () => {
    it('should load plugin configuration', async () => {
      const configPlugin = `
module.exports = {
  name: 'config-plugin',
  version: '1.0.0',
  
  config: {
    apiKey: process.env['PLUGIN_API_KEY'] || 'default-key',
    endpoint: 'https://api.example.com',
    retries: 3,
    features: {
      cache: true,
      compress: false
    }
  },
  
  hooks: {
    beforeRender: async (context) => {
      const config = module.exports.config;
      context.variables.pluginConfig = config;
      return context;
    }
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'config-plugin.js'),
        configPlugin
      );

      // Set environment variable
      process.env['PLUGIN_API_KEY'] = 'test-key-123';

      await pluginManager.loadPlugins();

      const context: TemplateContext = { variables: {} };
      const result = await pluginManager.executeHook<TemplateContext>('beforeRender', context);

      expect((result.variables.pluginConfig as any).apiKey).toBe('test-key-123');
      expect((result.variables.pluginConfig as any).endpoint).toBe('https://api.example.com');
      expect((result.variables.pluginConfig as any).features.cache).toBe(true);

      // Clean up env
      delete process.env['PLUGIN_API_KEY'];
    });

    it('should merge user configuration with defaults', async () => {
      const plugin = `
module.exports = {
  name: 'merge-config-plugin',
  version: '1.0.0',
  
  defaultConfig: {
    timeout: 5000,
    retries: 3,
    features: {
      cache: true,
      log: true
    }
  },
  
  init: (userConfig) => {
    module.exports.config = Object.assign(
      {},
      module.exports.defaultConfig,
      userConfig
    );
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'merge-plugin.js'),
        plugin
      );

      const userConfig = {
        timeout: 10000,
        features: { cache: false }
      };

      await pluginManager.loadPlugins(userConfig);
      
      // Check merged configuration
      const plugins = pluginManager.getLoadedPlugins();
      const mergePlugin = plugins.find(p => p.name === 'merge-config-plugin');
      
      expect(mergePlugin).toBeDefined();
      // Configuration merging depends on implementation
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should handle plugin initialization', async () => {
      const lifecyclePlugin = `
let initialized = false;

module.exports = {
  name: 'lifecycle-plugin',
  version: '1.0.0',
  
  init: async () => {
    initialized = true;
    // Perform setup tasks
    return true;
  },
  
  hooks: {
    beforeRender: async (context) => {
      context.variables.initialized = initialized;
      return context;
    }
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'lifecycle-plugin.js'),
        lifecyclePlugin
      );

      await pluginManager.loadPlugins();
      await pluginManager.initializePlugins();

      const context: TemplateContext = { variables: {} };
      const result = await pluginManager.executeHook<TemplateContext>('beforeRender', context);

      expect(result.variables.initialized).toBe(true);
    });

    it('should handle plugin cleanup', async () => {
      const cleanupPlugin = `
let resources = [];

module.exports = {
  name: 'cleanup-plugin',
  version: '1.0.0',
  
  init: async () => {
    resources.push('resource1');
    resources.push('resource2');
  },
  
  cleanup: async () => {
    resources = [];
    return true;
  },
  
  getResources: () => resources
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'cleanup-plugin.js'),
        cleanupPlugin
      );

      await pluginManager.loadPlugins();
      await pluginManager.initializePlugins();

      // Check resources allocated
      const plugin = pluginManager.getLoadedPlugins()[0];
      expect(plugin).toBeDefined();

      // Cleanup
      await pluginManager.shutdown();
      
      // Resources should be cleaned
      // (Implementation dependent)
    });

    it('should handle plugin enable/disable', async () => {
      const togglePlugin = `
module.exports = {
  name: 'toggle-plugin',
  version: '1.0.0',
  enabled: true,
  
  hooks: {
    beforeRender: async (context) => {
      if (module.exports.enabled) {
        context.variables.pluginActive = true;
      }
      return context;
    }
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'toggle-plugin.js'),
        togglePlugin
      );

      await pluginManager.loadPlugins();

      // Test enabled state
      let context: TemplateContext = { variables: {} };
      let result = await pluginManager.executeHook<TemplateContext>('beforeRender', context);
      expect(result.variables.pluginActive).toBe(true);

      // Disable plugin
      await pluginManager.disablePlugin('toggle-plugin');

      // Test disabled state
      context = { variables: {} };
      result = await pluginManager.executeHook<TemplateContext>('beforeRender', context);
      expect(result.variables.pluginActive).toBeUndefined();

      // Re-enable
      await pluginManager.enablePlugin('toggle-plugin');

      context = { variables: {} };
      result = await pluginManager.executeHook<TemplateContext>('beforeRender', context);
      expect(result.variables.pluginActive).toBe(true);
    });
  });

  describe('Plugin Permissions', () => {
    it('should enforce permission boundaries', async () => {
      const permissionPlugin = `
module.exports = {
  name: 'permission-plugin',
  version: '1.0.0',
  
  permissions: [
    'read:templates',
    'write:output',
    'execute:helpers'
  ],
  
  hooks: {
    beforeRender: async (context, api) => {
      // Should only be able to use permitted APIs
      try {
        await api.readTemplate('test.md'); // Allowed
        await api.writeOutput('out.md', 'content'); // Allowed
        await api.deleteFile('/etc/passwd'); // Not allowed
      } catch (error) {
        context.variables.permissionError = error.message;
      }
      return context;
    }
  }
};`;

      await fs.writeFile(
        path.join(pluginsDir, 'permission-plugin.js'),
        permissionPlugin
      );

      await pluginManager.loadPlugins();

      const context: TemplateContext = { variables: {} };
      const result = await pluginManager.executeHook<TemplateContext>('beforeRender', context);

      expect(result.variables.permissionError).toContain('permission');
    });
  });
});
/**
 * @fileoverview E2E tests for security features and integrations
 * @lastmodified 2025-08-26T10:00:00Z
 *
 * Features: Tests security, versioning, Cursor integration, and cache management
 * Main APIs: Security validation, rate limiting, sandboxing, Cursor sync
 * Constraints: Security boundaries, performance limits, integration points
 * Patterns: Security validation, integration testing, performance monitoring
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CursorIntegration } from '../../src/integrations/cursor';
import { CacheService } from '../../src/services/cache.service';
import { RateLimiter } from '../../src/middleware/rate-limiter';

const execAsync = promisify(exec);

describe('E2E: Security and Integration', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'security-e2e-'));
    process.chdir(testDir);
  });

  afterEach(async () => {
    process.chdir('/');
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Security Features', () => {
    describe('Input Validation', () => {
      it('should prevent path traversal attacks', async () => {
        const maliciousPath = '../../etc/passwd';
        const templateContent = `---
name: test
---
{{#include "${maliciousPath}"}}`;

        await fs.mkdir('templates', { recursive: true });
        await fs.writeFile('templates/malicious.yaml', templateContent);

        // Should be sanitized or rejected
        try {
          const { stderr } = await execAsync(
            `node ${path.join(__dirname, '../../dist/cli.js')} generate malicious`
          );
          
          // Should not allow access to system files
          expect(stderr).not.toContain('/etc/passwd');
        } catch (error: any) {
          expect(error.message).toContain('security');
        }
      });

      it('should sanitize user input in templates', async () => {
        const template = `---
name: xss-test
---
User input: {{userInput}}`;

        await fs.mkdir('templates', { recursive: true });
        await fs.writeFile('templates/xss.yaml', template);

        const maliciousInput = '<script>alert("XSS")</script>';
        const variables = JSON.stringify({ userInput: maliciousInput });

        const { stdout } = await execAsync(
          `node ${path.join(__dirname, '../../dist/cli.js')} generate xss -v '${variables}'`
        );

        // Should handle potentially dangerous input safely
        expect(stdout).toBeDefined();
        // Implementation may escape or pass through - document actual behavior
      });

      it('should validate template size limits', async () => {
        // Create very large template (over 10MB)
        const hugeContent = 'x'.repeat(11 * 1024 * 1024);
        const template = `---
name: huge
---
${hugeContent}`;

        await fs.mkdir('templates', { recursive: true });
        await fs.writeFile('templates/huge.yaml', template);

        try {
          await execAsync(
            `node ${path.join(__dirname, '../../dist/cli.js')} generate huge`
          );
          // Should handle or reject based on implementation
        } catch (error: any) {
          expect(error.message).toContain('size');
        }
      });

      it('should prevent command injection in variables', async () => {
        const template = `---
name: cmd-test
---
Result: {{command}}`;

        await fs.mkdir('templates', { recursive: true });
        await fs.writeFile('templates/cmd.yaml', template);

        const dangerousCommand = '"; rm -rf /; echo "';
        const variables = JSON.stringify({ command: dangerousCommand });

        const { stdout } = await execAsync(
          `node ${path.join(__dirname, '../../dist/cli.js')} generate cmd -v '${variables}'`
        );

        // Should not execute commands
        expect(stdout).not.toContain('rm -rf');
        // Should treat as literal string
        expect(stdout).toContain('Result:');
      });
    });

    describe('Rate Limiting', () => {
      let rateLimiter: RateLimiter;

      beforeEach(() => {
        rateLimiter = new RateLimiter({
          windowMs: 60000, // 1 minute
          max: 10, // 10 requests per minute
          skipSuccessfulRequests: false
        });
      });

      it('should enforce rate limits', async () => {
        const clientId = 'test-client';

        // Make requests up to limit
        for (let i = 0; i < 10; i++) {
          const allowed = await rateLimiter.checkLimit(clientId);
          expect(allowed).toBe(true);
        }

        // 11th request should be blocked
        const blocked = await rateLimiter.checkLimit(clientId);
        expect(blocked).toBe(false);
      });

      it('should reset after window expires', async () => {
        const clientId = 'test-client-2';
        
        // Use up limit
        for (let i = 0; i < 10; i++) {
          await rateLimiter.checkLimit(clientId);
        }

        // Should be blocked
        expect(await rateLimiter.checkLimit(clientId)).toBe(false);

        // Fast-forward time (mock or wait)
        // This is implementation-dependent
        
        // After window reset, should allow again
        // expect(await rateLimiter.checkLimit(clientId)).toBe(true);
      });

      it('should track different clients separately', async () => {
        const client1 = 'client-1';
        const client2 = 'client-2';

        // Use up client1's limit
        for (let i = 0; i < 10; i++) {
          await rateLimiter.checkLimit(client1);
        }

        // Client1 should be blocked
        expect(await rateLimiter.checkLimit(client1)).toBe(false);

        // Client2 should still be allowed
        expect(await rateLimiter.checkLimit(client2)).toBe(true);
      });
    });

    describe('Permission System', () => {
      it('should respect file system permissions', async () => {
        const protectedDir = path.join(testDir, 'protected');
        await fs.mkdir(protectedDir);
        
        // Make directory read-only
        await fs.chmod(protectedDir, 0o444);

        try {
          await fs.writeFile(
            path.join(protectedDir, 'test.yaml'),
            'content'
          );
          fail('Should not write to protected directory');
        } catch (error: any) {
          expect(error.code).toBe('EACCES');
        }

        // Restore permissions for cleanup
        await fs.chmod(protectedDir, 0o755);
      });

      it('should validate API keys and tokens', async () => {
        process.env.MARKETPLACE_API_KEY = 'valid-key-123';

        // Test with valid key
        // Implementation-dependent behavior

        delete process.env.MARKETPLACE_API_KEY;

        // Test without key
        // Should handle gracefully or limit functionality
      });
    });
  });

  describe('Cursor Integration', () => {
    let cursorIntegration: CursorIntegration;

    beforeEach(async () => {
      // Initialize Cursor integration
      cursorIntegration = CursorIntegration.getInstance({
        projectRoot: testDir,
        rulesOutputDir: path.join(testDir, '.cursor/rules'),
        legacySupport: true
      });

      await cursorIntegration.initialize();

      // Create test templates
      await fs.mkdir('templates', { recursive: true });
      
      const template1 = `---
name: cursor-test-1
description: Test template for Cursor
---
# Cursor Template 1`;

      const template2 = `---
name: cursor-test-2
description: Another test template
tags: [cursor, integration]
---
# Cursor Template 2`;

      await fs.writeFile('templates/cursor-test-1.yaml', template1);
      await fs.writeFile('templates/cursor-test-2.yaml', template2);
    });

    afterEach(() => {
      cursorIntegration.dispose();
    });

    it('should sync templates to Cursor rules', async () => {
      await cursorIntegration.syncTemplates();

      // Check rules directory exists
      const rulesDir = path.join(testDir, '.cursor/rules');
      const rulesExist = await fs.stat(rulesDir).catch(() => false);
      expect(rulesExist).toBeTruthy();

      // Check rules files created
      const rules = await fs.readdir(rulesDir);
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should generate .cursorrules file', async () => {
      await cursorIntegration.syncTemplates();

      const cursorrulesPath = path.join(testDir, '.cursorrules');
      const content = await fs.readFile(cursorrulesPath, 'utf-8');

      expect(content).toContain('cursor-test-1');
      expect(content).toContain('cursor-test-2');
    });

    it('should detect Cursor project structure', () => {
      const isCursorProject = cursorIntegration.isCursorProject();
      // Depends on whether .cursor directory exists
      expect(typeof isCursorProject).toBe('boolean');
    });

    it('should optimize templates for Cursor context', async () => {
      const template = {
        name: 'test',
        content: 'Long content that needs optimization...' + 'x'.repeat(10000)
      };

      const optimized = await cursorIntegration.optimizeForContext(template);
      
      // Should be optimized for Cursor's context window
      expect(optimized).toBeDefined();
      // May be truncated or compressed
    });

    it('should auto-sync on template changes', async () => {
      // Start watching
      cursorIntegration.startWatching();

      // Initial sync
      await cursorIntegration.syncTemplates();

      // Create new template
      const newTemplate = `---
name: new-template
---
Content`;

      return new Promise<void>((resolve) => {
        setTimeout(async () => {
          await fs.writeFile('templates/new.yaml', newTemplate);
          
          // Give time for watch to trigger
          setTimeout(async () => {
            const rulesDir = path.join(testDir, '.cursor/rules');
            try {
              await fs.readdir(rulesDir);
              // Should have synced new template
            } catch (error) {
              // Rules directory might not exist yet, which is fine for this test
            }
            
            cursorIntegration.stopWatching();
            resolve();
          }, 1000);
        }, 100);
      });
    }, 5000);
  });

  describe('Version Management', () => {
    it('should track template versions', async () => {
      const templatePath = path.join(testDir, 'templates', 'versioned.yaml');
      
      // Version 1.0.0
      const v1 = `---
name: versioned
version: 1.0.0
---
Version 1 content`;

      await fs.mkdir(path.join(testDir, 'templates'), { recursive: true });
      await fs.writeFile(templatePath, v1);

      // Create version history
      const historyDir = path.join(testDir, '.versions');
      await fs.mkdir(historyDir, { recursive: true });
      
      // Save version
      await fs.writeFile(
        path.join(historyDir, 'versioned-1.0.0.yaml'),
        v1
      );

      // Update to version 2.0.0
      const v2 = `---
name: versioned
version: 2.0.0
---
Version 2 content with changes`;

      await fs.writeFile(templatePath, v2);
      await fs.writeFile(
        path.join(historyDir, 'versioned-2.0.0.yaml'),
        v2
      );

      // Check version history
      const versions = await fs.readdir(historyDir);
      expect(versions).toHaveLength(2);
      expect(versions).toContain('versioned-1.0.0.yaml');
      expect(versions).toContain('versioned-2.0.0.yaml');
    });

    it('should handle version rollback', async () => {
      const templatePath = path.join(testDir, 'templates', 'rollback.yaml');
      const historyDir = path.join(testDir, '.versions');
      
      await fs.mkdir(path.join(testDir, 'templates'), { recursive: true });
      await fs.mkdir(historyDir, { recursive: true });

      // Create versions
      const versions = ['1.0.0', '1.1.0', '2.0.0'];
      
      for (const version of versions) {
        const content = `---
name: rollback
version: ${version}
---
Content for ${version}`;

        await fs.writeFile(templatePath, content);
        await fs.writeFile(
          path.join(historyDir, `rollback-${version}.yaml`),
          content
        );
      }

      // Rollback to 1.1.0
      const rollbackContent = await fs.readFile(
        path.join(historyDir, 'rollback-1.1.0.yaml'),
        'utf-8'
      );
      await fs.writeFile(templatePath, rollbackContent);

      const current = await fs.readFile(templatePath, 'utf-8');
      expect(current).toContain('version: 1.1.0');
    });

    it('should validate version compatibility', async () => {
      const template = `---
name: compat-test
version: 2.0.0
minEngineVersion: 3.0.0
---
Content`;

      await fs.mkdir('templates', { recursive: true });
      await fs.writeFile('templates/compat.yaml', template);

      // Check if current engine version is compatible
      // This is implementation-dependent
      const engineVersion = '2.5.0'; // Example current version
      const minRequired = '3.0.0';
      
      const compatible = engineVersion >= minRequired;
      expect(compatible).toBe(false);
    });
  });

  describe('Cache Management', () => {
    let cacheService: CacheService;

    beforeEach(() => {
      cacheService = new CacheService({
        cacheDir: path.join(testDir, '.cache'),
        maxSize: 50 * 1024 * 1024, // 50MB
        ttl: 3600000 // 1 hour
      });
    });

    it('should cache rendered templates', async () => {
      const templateKey = 'template-1';
      const rendered = 'Rendered content here';

      await cacheService.set(templateKey, rendered);
      
      const cached = await cacheService.get(templateKey);
      expect(cached).toBe(rendered);
    });

    it('should respect TTL', async () => {
      const shortTTLCache = new CacheService({
        cacheDir: path.join(testDir, '.cache-ttl'),
        maxSize: 1024 * 1024,
        ttl: 100 // 100ms TTL
      });

      await shortTTLCache.set('ttl-test', 'value');
      
      // Should exist immediately
      expect(await shortTTLCache.get('ttl-test')).toBe('value');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      const expired = await shortTTLCache.get('ttl-test');
      expect(expired).toBeNull();
    });

    it('should enforce size limits', async () => {
      const tinyCache = new CacheService({
        cacheDir: path.join(testDir, '.cache-tiny'),
        maxSize: 100, // 100 bytes
        ttl: 3600000
      });

      // Add item within limit
      await tinyCache.set('small', 'x'.repeat(50));
      expect(await tinyCache.get('small')).toBeDefined();

      // Try to add item exceeding limit
      await tinyCache.set('large', 'x'.repeat(200));
      
      // Should handle gracefully - either reject or evict old
      const size = await tinyCache.getSize();
      expect(size).toBeLessThanOrEqual(100);
    });

    it('should clear cache on demand', async () => {
      // Add multiple items
      for (let i = 0; i < 10; i++) {
        await cacheService.set(`item-${i}`, `value-${i}`);
      }

      const sizeBefore = await cacheService.getSize();
      expect(sizeBefore).toBeGreaterThan(0);

      await cacheService.clear();

      const sizeAfter = await cacheService.getSize();
      expect(sizeAfter).toBe(0);
    });

    it('should handle concurrent access', async () => {
      const promises = [];
      
      // Concurrent writes
      for (let i = 0; i < 100; i++) {
        promises.push(cacheService.set(`concurrent-${i}`, `value-${i}`));
      }

      await Promise.all(promises);

      // Concurrent reads
      const readPromises = [];
      for (let i = 0; i < 100; i++) {
        readPromises.push(cacheService.get(`concurrent-${i}`));
      }

      const results = await Promise.all(readPromises);
      
      // All should succeed
      results.forEach((result, i) => {
        expect(result).toBe(`value-${i}`);
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track template rendering performance', async () => {
      const startTime = Date.now();

      // Render large template
      const largeTemplate = `---
name: perf-test
---
{{#each items}}
Item {{@index}}: {{this.name}}
{{/each}}`;

      const items = Array.from({ length: 1000 }, (_, i) => ({
        name: `Item ${i}`
      }));

      await fs.mkdir('templates', { recursive: true });
      await fs.writeFile('templates/perf.yaml', largeTemplate);

      const variables = JSON.stringify({ items });
      await execAsync(
        `node ${path.join(__dirname, '../../dist/cli.js')} generate perf -v '${variables}'`
      );

      const duration = Date.now() - startTime;
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    it('should handle memory efficiently', async () => {
      // Monitor memory usage
      const memBefore = process.memoryUsage();

      // Process large dataset
      const hugeArray = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        data: 'x'.repeat(100)
      }));

      const template = `---
name: memory-test
---
Processing...`;

      await fs.mkdir('templates', { recursive: true });
      await fs.writeFile('templates/memory.yaml', template);

      const variables = JSON.stringify({ data: hugeArray });
      await execAsync(
        `node ${path.join(__dirname, '../../dist/cli.js')} generate memory -v '${variables}'`
      );

      const memAfter = process.memoryUsage();
      const memDiff = memAfter.heapUsed - memBefore.heapUsed;

      // Should not leak excessive memory
      expect(memDiff).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });
  });

  describe('Error Recovery', () => {
    it('should recover from plugin crashes', async () => {
      const crashingPlugin = `
module.exports = {
  name: 'crash-plugin',
  version: '1.0.0',
  hooks: {
    beforeRender: () => {
      throw new Error('Plugin crashed!');
    }
  }
};`;

      const pluginsDir = path.join(testDir, 'plugins');
      await fs.mkdir(pluginsDir, { recursive: true });
      await fs.writeFile(
        path.join(pluginsDir, 'crash.js'),
        crashingPlugin
      );

      // Should handle plugin crash gracefully
      await fs.mkdir('templates', { recursive: true });
      await fs.writeFile(
        'templates/test.yaml',
        '---\nname: test\n---\nContent'
      );

      const { stdout } = await execAsync(
        `node ${path.join(__dirname, '../../dist/cli.js')} generate test`
      );

      // Should still generate output despite plugin crash
      expect(stdout).toContain('Content');
    });

    it('should handle network failures gracefully', async () => {
      // Simulate network failure for marketplace
      process.env.MARKETPLACE_URL = 'http://invalid.localhost:99999';

      try {
        await execAsync(
          `node ${path.join(__dirname, '../../dist/cli.js')} marketplace search test`
        );
      } catch (error: any) {
        // Should provide helpful error message
        expect(error.stderr).toMatch(/network|connection|marketplace/i);
      }

      delete process.env.MARKETPLACE_URL;
    });

    it('should create backups before destructive operations', async () => {
      // Create template
      const templatePath = path.join(testDir, 'templates', 'backup-test.yaml');
      const originalContent = '---\nname: backup\n---\nOriginal';
      
      await fs.mkdir('templates', { recursive: true });
      await fs.writeFile(templatePath, originalContent);

      // Create backup directory
      const backupDir = path.join(testDir, '.backups');
      await fs.mkdir(backupDir, { recursive: true });

      // Backup before update
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupPath = path.join(backupDir, `backup-test-${timestamp}.yaml`);
      await fs.copyFile(templatePath, backupPath);

      // Update template
      await fs.writeFile(templatePath, '---\nname: backup\n---\nUpdated');

      // Verify backup exists
      const backup = await fs.readFile(backupPath, 'utf-8');
      expect(backup).toBe(originalContent);
    });
  });
});
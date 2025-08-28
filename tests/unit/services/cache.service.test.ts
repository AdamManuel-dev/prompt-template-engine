/**
 * @fileoverview Comprehensive tests for CacheService
 * @lastmodified 2025-08-23T03:35:00Z
 */

import { CacheService, CacheManager, templateCache, apiCache, fileCache } from '../../../src/services/cache.service';

describe('CacheService', () => {
  let cache: CacheService;

  beforeEach(() => {
    cache = new CacheService({
      maxSize: 10,
      maxAge: 1000, // 1 second TTL for testing
    });
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Basic Operations', () => {
    it('should set and get values', async () => {
      await cache.set('key1', { data: 'value1' });
      const value = await cache.get('key1');
      expect(value).toBe({ data: 'value1' });
    });

    it('should return undefined for non-existent keys', async () => {
      const value = await cache.get('nonexistent');
      expect(value).toBeUndefined();
    });

    it('should delete values', async () => {
      await cache.set('key1', { data: 'value1' });
      const deleted = await cache.delete('key1');
      expect(deleted).toBe(true);
      const value = await cache.get('key1');
      expect(value).toBeUndefined();
    });

    it('should check if key exists', async () => {
      await cache.set('key1', { data: 'value1' });
      expect(await cache.has('key1')).toBe(true);
      expect(await cache.has('key2')).toBe(false);
    });

    it('should clear all values', async () => {
      await cache.set('key1', { data: 'value1' });
      await cache.set('key2', { data: 'value2' });
      await cache.clear();
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key2')).toBeUndefined();
      expect(cache.size).toBe(0);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire values after TTL', async () => {
      await cache.set('key1', { data: 'value1' }, 100); // 100ms TTL
      expect(await cache.get('key1')).toBe({ data: 'value1' });
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(await cache.get('key1')).toBeUndefined();
    });

    it('should use default TTL when not specified', async () => {
      await cache.set('key1', { data: 'value1' }); // Uses 1 second default
      expect(await cache.get('key1')).toBe({ data: 'value1' });
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      expect(await cache.get('key1')).toBeUndefined();
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used items when max size reached', async () => {
      // Fill cache to max size (10)
      for (let i = 1; i <= 10; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }
      expect(cache.size).toBe(10);

      // Add one more - should evict key1
      await cache.set('key11', { data: 'value11' });
      expect(cache.size).toBe(10);
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key11')).toBe({ data: 'value11' });
    });

    it('should update LRU order on get', async () => {
      // Fill cache to max size
      for (let i = 1; i <= 10; i++) {
        await cache.set(`key${i}`, `value${i}`);
      }

      // Access key1 to make it recently used
      await cache.get('key1');

      // Add new item - should evict key2, not key1
      await cache.set('key11', { data: 'value11' });
      expect(await cache.get('key1')).toBe({ data: 'value1' });
      expect(await cache.get('key2')).toBeUndefined();
    });
  });

  describe('getOrCompute', () => {
    it('should return cached value if exists', async () => {
      await cache.set('key1', 'cached');
      const computeFn = jest.fn(async () => 'computed');
      
      const value = await cache.getOrCompute('key1', computeFn);
      expect(value).toBe('cached');
      expect(computeFn).not.toHaveBeenCalled();
    });

    it('should compute and cache value if not exists', async () => {
      const computeFn = jest.fn(async () => 'computed');
      
      const value = await cache.getOrCompute('key1', computeFn);
      expect(value).toBe('computed');
      expect(computeFn).toHaveBeenCalledTimes(1);
      
      // Should be cached now
      const cachedValue = await cache.get('key1');
      expect(cachedValue).toBe('computed');
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', async () => {
      await cache.set('key1', { data: 'value1' });
      
      await cache.get('key1'); // Hit
      await cache.get('key2'); // Miss
      await cache.get('key1'); // Hit
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.67); // 2/3 ≈ 0.67
    });

    it('should track sets, deletes, and clears', async () => {
      await cache.set('key1', { data: 'value1' });
      await cache.set('key2', { data: 'value2' });
      await cache.delete('key1');
      await cache.clear();
      
      const stats = cache.getStats();
      expect(stats.sets).toBe(2);
      expect(stats.deletes).toBe(1);
      expect(stats.clears).toBe(1);
    });

    it('should reset statistics', async () => {
      await cache.set('key1', { data: 'value1' });
      await cache.get('key1');
      
      cache.resetStats();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
    });
  });

  describe('Key Generation', () => {
    it('should generate consistent keys', () => {
      const key1 = CacheService.generateKey('template', 'name', { id: 1 });
      const key2 = CacheService.generateKey('template', 'name', { id: 1 });
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const key1 = CacheService.generateKey('template', 'name1');
      const key2 = CacheService.generateKey('template', 'name2');
      expect(key1).not.toBe(key2);
    });

    it('should handle complex objects', () => {
      const key = CacheService.generateKey({
        template: 'test',
        variables: { a: 1, b: 2 },
        nested: { deep: { value: true } }
      });
      expect(key).toBeTruthy();
      expect(key.length).toBe(64); // SHA256 hex length
    });
  });

  describe('Cache Manager', () => {
    beforeEach(() => {
      // Clear any existing caches before each test
      CacheManager.clearAll();
    });

    afterEach(() => {
      CacheManager.clearAll();
    });

    it('should create and retrieve named caches', () => {
      const cache1 = CacheManager.getCache('test1');
      const cache2 = CacheManager.getCache('test2');
      const cache1Again = CacheManager.getCache('test1');
      
      expect(cache1).toBe(cache1Again);
      expect(cache1).not.toBe(cache2);
    });

    it('should clear all caches', async () => {
      const cache1 = CacheManager.getCache('test1');
      const cache2 = CacheManager.getCache('test2');
      
      await cache1.set('key', 'value');
      await cache2.set('key', 'value');
      
      CacheManager.clearAll();
      
      expect(await cache1.get('key')).toBeUndefined();
      expect(await cache2.get('key')).toBeUndefined();
    });

    it('should get global statistics', async () => {
      const cache1 = CacheManager.getCache('test1');
      const cache2 = CacheManager.getCache('test2');
      
      await cache1.set('key', 'value');
      await cache1.get('key');
      await cache2.get('missing');
      
      const globalStats = CacheManager.getGlobalStats();
      expect(globalStats.test1.hits).toBe(1);
      expect(globalStats.test2.misses).toBe(1);
    });
  });

  describe('Pre-configured Caches', () => {
    it('should have template cache configured', async () => {
      expect(templateCache).toBeDefined();
      await templateCache.set('template1', { content: 'template data' });
      expect(await templateCache.get('template1')).toEqual({ content: 'template data' });
    });

    it('should have API cache configured', async () => {
      expect(apiCache).toBeDefined();
      await apiCache.set('api1', { data: 'response' });
      expect(await apiCache.get('api1')).toEqual({ data: 'response' });
    });

    it('should have file cache configured', async () => {
      expect(fileCache).toBeDefined();
      await fileCache.set('file1', 'file content');
      expect(await fileCache.get('file1')).toBe('file content');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values', async () => {
      await cache.set('null', null as any);
      await cache.set('undefined', undefined as any);
      
      expect(await cache.get('null')).toBeNull();
      expect(await cache.get('undefined')).toBeUndefined();
    });

    it('should handle empty strings', async () => {
      await cache.set('empty', '');
      expect(await cache.get('empty')).toBe('');
    });

    it('should handle complex objects', async () => {
      const complex = {
        nested: { deep: { value: [1, 2, 3] } },
        fn: () => 'function',
        date: new Date(),
      };
      
      await cache.set('complex', JSON.stringify(complex));
      const retrieved = JSON.parse(await cache.get('complex') || '{}');
      expect(retrieved.nested.deep.value).toEqual([1, 2, 3]);
    });
  });
});
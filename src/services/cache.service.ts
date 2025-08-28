/**
 * @fileoverview LRU Cache service for template caching and performance optimization
 * @lastmodified 2025-08-25T21:44:14-05:00
 *
 * Features: LRU caching with TTL, size limits, and performance metrics
 * Main APIs: get(), set(), clear(), getStats()
 * Constraints: Configurable max size and TTL, memory-based storage
 * Patterns: Singleton pattern, async operations, metric tracking
 */

import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';

export interface CacheOptions {
  maxSize?: number; // Maximum number of items
  maxAge?: number; // TTL in milliseconds
  ttl?: number; // Alias for maxAge (backward compatibility)
  sizeCalculation?: (value: any, key: string) => number;
  updateAgeOnGet?: boolean;
  cacheDir?: string; // Directory for persistent cache storage
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  clears: number;
  hitRate: number;
  size: number;
  maxSize: number;
}

export class CacheService<T extends object = Record<string, unknown>> {
  private cache: LRUCache<string, T>;

  private stats: Omit<CacheStats, 'hitRate' | 'size' | 'maxSize'>;

  private cacheDir?: string;

  private readonly defaultOptions: CacheOptions = {
    maxSize: 100,
    maxAge: 1000 * 60 * 60, // 1 hour default TTL
    updateAgeOnGet: true,
  };

  constructor(options?: CacheOptions) {
    const finalOptions = { ...this.defaultOptions, ...options };

    // Handle ttl option alias (backward compatibility)
    if (options?.ttl !== undefined) {
      finalOptions.maxAge = options.ttl;
    }

    // Store cacheDir option (Required by TODO)
    this.cacheDir = finalOptions.cacheDir;

    const cacheConfig: any = {
      max: finalOptions.maxSize!,
      ttl: finalOptions.maxAge!,
      updateAgeOnGet: finalOptions.updateAgeOnGet,
    };

    // Only add sizeCalculation if provided
    if (finalOptions.sizeCalculation) {
      cacheConfig.sizeCalculation = finalOptions.sizeCalculation;
      cacheConfig.maxSize = Number.MAX_SAFE_INTEGER; // Required when using sizeCalculation
    }

    this.cache = new LRUCache<string, T>(cacheConfig);

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0,
    };
  }

  /**
   * Get a value from the cache
   */
  async get(key: string): Promise<T | undefined> {
    const value = this.cache.get(key);

    if (value !== undefined) {
      this.stats.hits += 1;
    } else {
      this.stats.misses += 1;
    }

    return value;
  }

  /**
   * Get a value or compute it if not in cache
   */
  async getOrCompute(key: string, computeFn: () => Promise<T>): Promise<T> {
    const cached = await this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await computeFn();
    await this.set(key, value);
    return value;
  }

  /**
   * Set a value in the cache
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    const options = ttl ? { ttl } : undefined;
    this.cache.set(key, value, options);
    this.stats.sets += 1;
  }

  /**
   * Delete a value from the cache
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes += 1;
    }
    return deleted;
  }

  /**
   * Check if a key exists in the cache
   */
  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * Clear the entire cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.clears += 1;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;

    return {
      ...this.stats,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
      maxSize: this.cache.max,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0,
    };
  }

  /**
   * Generate a cache key from multiple parts
   */
  static generateKey(...parts: any[]): string {
    const combined = parts
      .map(p => (typeof p === 'object' ? JSON.stringify(p) : String(p)))
      .join(':');

    return createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Get all keys in the cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Calculate total cache size in bytes
   * Required by TODO: Calculate total cache size in bytes
   */
  async getSize(): Promise<number> {
    let totalSize = 0;

    // Calculate in-memory cache size
    for (const [key, value] of this.cache.entries()) {
      const keySize = Buffer.byteLength(key, 'utf8');
      const valueSize = Buffer.byteLength(JSON.stringify(value), 'utf8');
      totalSize += keySize + valueSize;
    }

    // If cacheDir is specified, add file system cache size
    if (this.cacheDir) {
      try {
        const fs = await import('fs');
        const path = await import('path');

        if (fs.existsSync(this.cacheDir)) {
          const files = fs.readdirSync(this.cacheDir, { withFileTypes: true });

          for (const file of files) {
            if (file.isFile()) {
              const filePath = path.join(this.cacheDir, file.name);
              const stats = fs.statSync(filePath);
              totalSize += stats.size;
            }
          }
        }
      } catch (_error) {
        // Silently ignore filesystem errors - return in-memory size only
      }
    }

    return totalSize;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
}

// Singleton instances for common use cases
export class CacheManager {
  private static instances = new Map<string, CacheService>();

  static getCache(name: string, options?: CacheOptions): CacheService {
    if (!this.instances.has(name)) {
      this.instances.set(name, new CacheService(options));
    }
    return this.instances.get(name)!;
  }

  static clearAll(): void {
    for (const cache of this.instances.values()) {
      cache.clear();
    }
    // Also clear the instances map to reset state completely
    this.instances.clear();
  }

  static getGlobalStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, cache] of this.instances.entries()) {
      stats[name] = cache.getStats();
    }
    return stats;
  }
}

// Export pre-configured caches for specific use cases
export const templateCache = new CacheService<any>({
  maxSize: 50,
  maxAge: 1000 * 60 * 30, // 30 minutes for templates
});

export const apiCache = new CacheService<any>({
  maxSize: 200,
  maxAge: 1000 * 60 * 5, // 5 minutes for API responses
});

export const fileCache = new CacheService<any>({
  maxSize: 100,
  maxAge: 1000 * 60 * 60, // 1 hour for file contents
});

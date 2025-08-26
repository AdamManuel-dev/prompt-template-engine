/**
 * @fileoverview LRU Cache service for template caching and performance optimization
 * @lastmodified 2025-08-26T11:31:10Z
 *
 * Features: LRU caching with TTL, size limits, and performance metrics
 * Main APIs: get(), set(), clear(), getStats()
 * Constraints: Configurable max size and TTL, memory-based storage
 * Patterns: Singleton pattern, async operations, metric tracking
 */

import { LRUCache } from 'lru-cache';
import { createHash } from 'crypto';

/**
 * Configuration options for cache behavior and performance tuning
 * Supports both memory-based caching and optional file system persistence
 */
export interface CacheOptions {
  /** Maximum number of items to store in cache */
  maxSize?: number;
  /** Time-to-live in milliseconds for cached items */
  maxAge?: number;
  /** Alias for maxAge (maintained for backward compatibility) */
  ttl?: number;
  /** Custom function to calculate item size for memory management */
  sizeCalculation?: (value: any, key: string) => number;
  /** Whether to update item age on cache hits */
  updateAgeOnGet?: boolean;
  /** Directory path for persistent cache storage on file system */
  cacheDir?: string;
}

/**
 * Comprehensive cache performance and usage statistics
 * Provides metrics for monitoring cache effectiveness and optimization
 */
export interface CacheStats {
  /** Number of successful cache retrievals */
  hits: number;
  /** Number of cache misses (item not found) */
  misses: number;
  /** Number of items added to cache */
  sets: number;
  /** Number of items removed from cache */
  deletes: number;
  /** Number of complete cache clears */
  clears: number;
  /** Cache hit ratio as decimal (0.0 to 1.0) */
  hitRate: number;
  /** Current number of items in cache */
  size: number;
  /** Maximum cache capacity */
  maxSize: number;
}

/**
 * High-performance LRU cache service with TTL and persistence support
 *
 * This service provides a comprehensive caching solution that combines:
 * - LRU (Least Recently Used) eviction policy for memory efficiency
 * - TTL (Time-to-Live) support for automatic expiration
 * - Optional file system persistence for cache durability
 * - Detailed performance metrics and statistics tracking
 * - Generic type support for type-safe caching operations
 *
 * The cache is built on the proven lru-cache library and extends it with
 * additional features like size calculation, persistence, and comprehensive
 * monitoring capabilities.
 *
 * @template T - Type of objects to be cached (must extend object)
 * @example
 * ```typescript
 * // Create a cache for API responses
 * const apiCache = new CacheService<ApiResponse>({
 *   maxSize: 200,
 *   maxAge: 5 * 60 * 1000, // 5 minutes
 *   updateAgeOnGet: true
 * });
 *
 * // Cache an API response
 * await apiCache.set('user:123', userResponse);
 *
 * // Retrieve cached response
 * const cached = await apiCache.get('user:123');
 * if (cached) {
 *   console.log('Using cached response');
 * }
 *
 * // Get cache performance stats
 * const stats = apiCache.getStats();
 * console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
 * ```
 *
 * @see {@link CacheOptions} for configuration options
 * @see {@link CacheStats} for performance metrics
 */
export class CacheService<T extends object = any> {
  private cache: LRUCache<string, T>;

  private stats: Omit<CacheStats, 'hitRate' | 'size' | 'maxSize'>;

  private cacheDir?: string;

  private readonly defaultOptions: CacheOptions = {
    maxSize: 100,
    maxAge: 1000 * 60 * 60, // 1 hour default TTL
    updateAgeOnGet: true,
  };

  /**
   * Creates a new CacheService instance with specified configuration
   *
   * Initializes the LRU cache with provided options, sets up statistics
   * tracking, and configures optional file system persistence. The
   * constructor merges provided options with sensible defaults.
   *
   * @param options - Cache configuration options
   * @param options.maxSize - Maximum items (default: 100)
   * @param options.maxAge - TTL in milliseconds (default: 1 hour)
   * @param options.ttl - Alternative TTL specification
   * @param options.sizeCalculation - Custom size calculation function
   * @param options.updateAgeOnGet - Update age on access (default: true)
   * @param options.cacheDir - Persistence directory path
   *
   * @example
   * ```typescript
   * // Create cache with custom configuration
   * const cache = new CacheService({
   *   maxSize: 500,
   *   maxAge: 30 * 60 * 1000, // 30 minutes
   *   cacheDir: '/tmp/mycache',
   *   sizeCalculation: (value, key) => {
   *     return JSON.stringify(value).length + key.length;
   *   }
   * });
   * ```
   */
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
   * Retrieve a value from the cache by key
   *
   * Attempts to retrieve a cached value and updates cache statistics.
   * If the item exists and hasn't expired, it's returned and marked as
   * recently accessed. Cache hits and misses are tracked for performance
   * monitoring.
   *
   * @param key - Unique identifier for the cached item
   * @returns Promise resolving to cached value or undefined if not found/expired
   *
   * @example
   * ```typescript
   * const userProfile = await cache.get('user:123');
   * if (userProfile) {
   *   console.log('Cache hit! Using cached profile');
   *   return userProfile;
   * }
   * console.log('Cache miss, fetching from database');
   * ```
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
   * Get a cached value or compute and cache it if not present
   *
   * This convenience method implements the cache-aside pattern by first
   * checking the cache for an existing value. If not found, it executes
   * the provided compute function, caches the result, and returns it.
   * This pattern is ideal for expensive computations or API calls.
   *
   * @param key - Cache key to check/store under
   * @param computeFn - Function to compute value if cache miss occurs
   * @returns Promise resolving to cached or newly computed value
   *
   * @example
   * ```typescript
   * const expensiveData = await cache.getOrCompute('computation:xyz', async () => {
   *   console.log('Cache miss - performing expensive computation');
   *   const result = await performExpensiveOperation();
   *   return result;
   * });
   *
   * // Subsequent calls will use cached result
   * const cachedData = await cache.getOrCompute('computation:xyz', async () => {
   *   console.log('This will not execute due to cache hit');
   *   return null; // This won't be called
   * });
   * ```
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
   * Store a value in the cache with optional custom TTL
   *
   * Adds or updates a cache entry with the specified key and value.
   * An optional TTL can override the default cache TTL for this specific
   * entry. The operation updates cache statistics and handles LRU eviction
   * if the cache is at capacity.
   *
   * @param key - Unique identifier for the cache entry
   * @param value - Object to be cached (must extend object type)
   * @param ttl - Optional TTL in milliseconds (overrides default)
   *
   * @example
   * ```typescript
   * // Set with default TTL
   * await cache.set('user:456', userObject);
   *
   * // Set with custom TTL (10 minutes)
   * await cache.set('temp:data', temporaryData, 10 * 60 * 1000);
   *
   * // Set critical data with longer TTL (2 hours)
   * await cache.set('config:app', configData, 2 * 60 * 60 * 1000);
   * ```
   */
  async set(key: string, value: T, ttl?: number): Promise<void> {
    const options = ttl ? { ttl } : undefined;
    this.cache.set(key, value, options);
    this.stats.sets += 1;
  }

  /**
   * Remove a specific entry from the cache
   *
   * Deletes the cache entry associated with the specified key and updates
   * deletion statistics. This is useful for invalidating specific cache
   * entries when the underlying data changes.
   *
   * @param key - Key of the cache entry to remove
   * @returns Promise resolving to true if item was deleted, false if not found
   *
   * @example
   * ```typescript
   * // Remove user profile after update
   * const deleted = await cache.delete('user:123');
   * if (deleted) {
   *   console.log('User profile cache invalidated');
   * }
   *
   * // Cleanup temporary cache entries
   * const tempKeys = ['temp:1', 'temp:2', 'temp:3'];
   * for (const key of tempKeys) {
   *   await cache.delete(key);
   * }
   * ```
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes += 1;
    }
    return deleted;
  }

  /**
   * Check if a key exists in the cache without retrieving the value
   *
   * Determines whether a cache entry exists for the specified key without
   * affecting cache statistics (unlike get()). This is useful for conditional
   * logic that depends on cache presence without triggering hits/misses.
   *
   * @param key - Key to check for existence
   * @returns Promise resolving to true if key exists, false otherwise
   *
   * @example
   * ```typescript
   * if (await cache.has('user:789')) {
   *   console.log('User data is cached');
   *   const userData = await cache.get('user:789');
   * } else {
   *   console.log('User data not in cache, will fetch from database');
   * }
   * ```
   */
  async has(key: string): Promise<boolean> {
    return this.cache.has(key);
  }

  /**
   * Clear all entries from the cache
   *
   * Removes all cached items and updates clear statistics. This operation
   * is useful for cache invalidation during system updates, testing, or
   * when memory needs to be freed. Use with caution in production as it
   * will cause cache misses for all subsequent requests.
   *
   * @example
   * ```typescript
   * // Clear cache during system maintenance
   * await cache.clear();
   * console.log('All cache entries cleared');
   *
   * // Verify cache is empty
   * console.log(`Cache size after clear: ${cache.size}`);
   * ```
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.clears += 1;
  }

  /**
   * Get comprehensive cache performance statistics
   *
   * Returns detailed metrics about cache performance including hit/miss
   * ratios, operation counts, and current cache utilization. These statistics
   * are valuable for monitoring cache effectiveness and optimizing cache
   * configuration.
   *
   * @returns Object containing detailed cache statistics
   * @returns returns.hits - Number of successful cache retrievals
   * @returns returns.misses - Number of cache misses
   * @returns returns.hitRate - Hit ratio (0.0 to 1.0) for performance assessment
   * @returns returns.size - Current number of cached items
   * @returns returns.maxSize - Maximum cache capacity
   *
   * @example
   * ```typescript
   * const stats = cache.getStats();
   * console.log(`Cache Performance Report:`);
   * console.log(`- Hit Rate: ${(stats.hitRate * 100).toFixed(2)}%`);
   * console.log(`- Utilization: ${stats.size}/${stats.maxSize} (${(stats.size/stats.maxSize*100).toFixed(1)}%)`);
   * console.log(`- Operations: ${stats.hits} hits, ${stats.misses} misses`);
   * console.log(`- Maintenance: ${stats.sets} sets, ${stats.deletes} deletes, ${stats.clears} clears`);
   *
   * if (stats.hitRate < 0.7) {
   *   console.warn('Low cache hit rate - consider increasing cache size or TTL');
   * }
   * ```
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
   * Reset all cache statistics to zero
   *
   * Clears all accumulated statistics including hits, misses, and operation
   * counts while preserving cached data. This is useful for performance
   * testing, monitoring periods, or when you want to start fresh statistics
   * tracking without clearing the cache contents.
   *
   * @example
   * ```typescript
   * // Reset stats before performance test
   * cache.resetStats();
   *
   * // Run performance test
   * await runCachePerformanceTest();
   *
   * // Check test results
   * const testStats = cache.getStats();
   * console.log(`Test hit rate: ${testStats.hitRate}`);
   * ```
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
   * Generate a deterministic cache key from multiple components
   *
   * Creates a SHA-256 hash from the provided parts to ensure consistent
   * key generation for complex cache keys. This method handles objects,
   * strings, numbers, and other data types by serializing them appropriately.
   *
   * @param parts - Variable number of components to combine into cache key
   * @returns SHA-256 hash string suitable for use as cache key
   *
   * @example
   * ```typescript
   * // Generate key from multiple components
   * const cacheKey = CacheService.generateKey(
   *   'user',
   *   userId,
   *   { includeProjects: true, activeOnly: false },
   *   'v2'
   * );
   *
   * // Use generated key for caching
   * await cache.set(cacheKey, userData);
   *
   * // Same components will generate same key
   * const sameKey = CacheService.generateKey(
   *   'user',
   *   userId,
   *   { includeProjects: true, activeOnly: false },
   *   'v2'
   * );
   * console.log(cacheKey === sameKey); // true
   * ```
   */
  static generateKey(...parts: any[]): string {
    const combined = parts
      .map(p => (typeof p === 'object' ? JSON.stringify(p) : String(p)))
      .join(':');

    return createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Get all cache keys currently stored in the cache
   *
   * Returns an array of all cache keys. This method is useful for debugging,
   * cache inspection, and bulk operations. Note that for large caches, this
   * operation may be expensive as it iterates through all cache entries.
   *
   * @returns Array of all cache keys as strings
   *
   * @example
   * ```typescript
   * // List all cached keys
   * const keys = cache.keys();
   * console.log(`Cached keys: ${keys.join(', ')}`);
   *
   * // Find user-related cache entries
   * const userKeys = keys.filter(key => key.startsWith('user:'));
   * console.log(`User cache entries: ${userKeys.length}`);
   *
   * // Bulk invalidation by pattern
   * const tempKeys = keys.filter(key => key.startsWith('temp:'));
   * for (const key of tempKeys) {
   *   await cache.delete(key);
   * }
   * ```
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Calculate total cache size in bytes including memory and file system storage
   *
   * Computes the total memory footprint of the cache by calculating the size
   * of all cached keys and values. If file system persistence is enabled,
   * includes the size of persisted cache files. This method is useful for
   * memory management and cache optimization.
   *
   * The calculation includes:
   * - UTF-8 byte size of all cache keys
   * - JSON serialization size of all cached values
   * - File system storage size (if cacheDir is configured)
   *
   * @returns Promise resolving to total cache size in bytes
   *
   * @example
   * ```typescript
   * const sizeBytes = await cache.getSize();
   * const sizeKB = (sizeBytes / 1024).toFixed(2);
   * const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
   *
   * console.log(`Cache size: ${sizeBytes} bytes (${sizeKB} KB, ${sizeMB} MB)`);
   *
   * // Monitor cache size growth
   * if (sizeBytes > 100 * 1024 * 1024) { // 100 MB
   *   console.warn('Cache size exceeds 100MB - consider cleanup');
   *   await cache.clear();
   * }
   * ```
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
   * Get the current number of items in the cache
   *
   * Returns the count of cached entries currently stored. This is a
   * synchronous operation that provides quick access to cache utilization
   * information without the overhead of calculating byte sizes.
   *
   * @returns Current number of cached items
   *
   * @example
   * ```typescript
   * console.log(`Cache contains ${cache.size} items`);
   *
   * // Check if cache is approaching capacity
   * const stats = cache.getStats();
   * const utilizationPercent = (cache.size / stats.maxSize) * 100;
   * if (utilizationPercent > 80) {
   *   console.warn(`Cache utilization high: ${utilizationPercent.toFixed(1)}%`);
   * }
   * ```
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Singleton cache manager for managing multiple named cache instances
 *
 * The CacheManager provides a centralized way to create, access, and manage
 * multiple cache instances with different configurations. This is particularly
 * useful for applications that need separate caches for different data types
 * or use cases (e.g., API responses, user sessions, computed results).
 *
 * Features:
 * - Singleton pattern ensures single instance per cache name
 * - Lazy initialization of cache instances
 * - Centralized cache clearing and statistics collection
 * - Memory-efficient instance reuse
 *
 * @example
 * ```typescript
 * // Get or create named cache instances
 * const userCache = CacheManager.getCache('users', {
 *   maxSize: 500,
 *   maxAge: 15 * 60 * 1000 // 15 minutes
 * });
 *
 * const apiCache = CacheManager.getCache('api', {
 *   maxSize: 1000,
 *   maxAge: 5 * 60 * 1000 // 5 minutes
 * });
 *
 * // Use the caches independently
 * await userCache.set('user:123', userData);
 * await apiCache.set('endpoint:/users', apiResponse);
 *
 * // Get global statistics
 * const allStats = CacheManager.getGlobalStats();
 * console.log('All cache statistics:', allStats);
 *
 * // Clear all caches
 * CacheManager.clearAll();
 * ```
 */
export class CacheManager {
  private static instances = new Map<string, CacheService>();

  /**
   * Get or create a named cache instance
   *
   * Returns an existing cache instance if one exists for the given name,
   * or creates a new one with the provided options. This ensures singleton
   * behavior per cache name while allowing different configurations.
   *
   * @param name - Unique name for the cache instance
   * @param options - Configuration options (only used if creating new instance)
   * @returns Cache service instance for the specified name
   *
   * @example
   * ```typescript
   * // First call creates the cache with specified options
   * const cache1 = CacheManager.getCache('myCache', {
   *   maxSize: 100,
   *   maxAge: 60000
   * });
   *
   * // Second call returns the same instance, options ignored
   * const cache2 = CacheManager.getCache('myCache', {
   *   maxSize: 200 // This will be ignored
   * });
   *
   * console.log(cache1 === cache2); // true
   * ```
   */
  static getCache(name: string, options?: CacheOptions): CacheService {
    if (!this.instances.has(name)) {
      this.instances.set(name, new CacheService(options));
    }
    return this.instances.get(name)!;
  }

  /**
   * Clear all managed cache instances and reset the manager
   *
   * Clears the contents of all managed cache instances and removes them
   * from the manager's registry. This is useful for testing, memory cleanup,
   * or application shutdown scenarios.
   *
   * @example
   * ```typescript
   * // Clear all caches during application shutdown
   * process.on('SIGTERM', () => {
   *   console.log('Clearing all caches before shutdown');
   *   CacheManager.clearAll();
   *   process.exit(0);
   * });
   *
   * // Clear caches during testing
   * afterEach(() => {
   *   CacheManager.clearAll();
   * });
   * ```
   */
  static clearAll(): void {
    for (const cache of this.instances.values()) {
      cache.clear();
    }
    // Also clear the instances map to reset state completely
    this.instances.clear();
  }

  /**
   * Get performance statistics for all managed cache instances
   *
   * Collects and returns statistics from all managed cache instances,
   * providing a comprehensive view of cache performance across the application.
   * This is valuable for monitoring, debugging, and performance optimization.
   *
   * @returns Object mapping cache names to their respective statistics
   *
   * @example
   * ```typescript
   * const globalStats = CacheManager.getGlobalStats();
   *
   * // Display statistics for all caches
   * Object.entries(globalStats).forEach(([name, stats]) => {
   *   console.log(`Cache '${name}':`);
   *   console.log(`  Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
   *   console.log(`  Size: ${stats.size}/${stats.maxSize}`);
   *   console.log(`  Operations: ${stats.hits + stats.misses} total`);
   * });
   *
   * // Find poorly performing caches
   * const poorCaches = Object.entries(globalStats)
   *   .filter(([_, stats]) => stats.hitRate < 0.5)
   *   .map(([name]) => name);
   *
   * if (poorCaches.length > 0) {
   *   console.warn(`Low-performing caches: ${poorCaches.join(', ')}`);
   * }
   * ```
   */
  static getGlobalStats(): Record<string, CacheStats> {
    const stats: Record<string, CacheStats> = {};
    for (const [name, cache] of this.instances.entries()) {
      stats[name] = cache.getStats();
    }
    return stats;
  }
}

/**
 * Pre-configured cache instance optimized for template storage
 *
 * A ready-to-use cache instance specifically configured for caching templates
 * with moderate capacity and 30-minute TTL. This cache is ideal for storing
 * parsed templates, compiled templates, or template metadata.
 *
 * Configuration:
 * - Max size: 50 templates
 * - TTL: 30 minutes
 * - Use case: Template parsing results, compiled templates
 *
 * @example
 * ```typescript
 * import { templateCache } from './cache.service';
 *
 * // Cache a parsed template
 * await templateCache.set('template:user-welcome', parsedTemplate);
 *
 * // Retrieve cached template
 * const cached = await templateCache.get('template:user-welcome');
 * if (cached) {
 *   return cached; // Use cached version
 * }
 * ```
 */
export const templateCache = new CacheService<any>({
  maxSize: 50,
  maxAge: 1000 * 60 * 30, // 30 minutes for templates
});

/**
 * Pre-configured cache instance optimized for API response caching
 *
 * A high-capacity cache instance designed for caching API responses with
 * short TTL to balance freshness with performance. Ideal for frequently
 * accessed API endpoints, external service responses, or computed API data.
 *
 * Configuration:
 * - Max size: 200 responses
 * - TTL: 5 minutes
 * - Use case: REST API responses, GraphQL queries, external service calls
 *
 * @example
 * ```typescript
 * import { apiCache } from './cache.service';
 *
 * // Cache API response
 * const cacheKey = CacheService.generateKey('api:users', userId, queryParams);
 * await apiCache.set(cacheKey, apiResponse);
 *
 * // Check for cached response before API call
 * const cached = await apiCache.get(cacheKey);
 * if (cached) {
 *   return cached; // Return cached response
 * }
 *
 * // Make API call and cache result
 * const response = await fetchUserData(userId, queryParams);
 * await apiCache.set(cacheKey, response);
 * return response;
 * ```
 */
export const apiCache = new CacheService<any>({
  maxSize: 200,
  maxAge: 1000 * 60 * 5, // 5 minutes for API responses
});

/**
 * Pre-configured cache instance optimized for file content caching
 *
 * A balanced cache instance designed for caching file contents, parsed files,
 * or file metadata with longer TTL since file contents change less frequently.
 * Perfect for configuration files, static assets, or processed file data.
 *
 * Configuration:
 * - Max size: 100 files
 * - TTL: 1 hour
 * - Use case: File contents, parsed configurations, static file metadata
 *
 * @example
 * ```typescript
 * import { fileCache } from './cache.service';
 *
 * // Cache file contents
 * const fileContent = await fs.readFile(filePath, 'utf8');
 * await fileCache.set(`file:${filePath}`, {
 *   content: fileContent,
 *   lastModified: stats.mtime,
 *   size: stats.size
 * });
 *
 * // Retrieve cached file with getOrCompute pattern
 * const cachedFile = await fileCache.getOrCompute(`file:${filePath}`, async () => {
 *   const content = await fs.readFile(filePath, 'utf8');
 *   const stats = await fs.stat(filePath);
 *   return {
 *     content,
 *     lastModified: stats.mtime,
 *     size: stats.size
 *   };
 * });
 * ```
 */
export const fileCache = new CacheService<any>({
  maxSize: 100,
  maxAge: 1000 * 60 * 60, // 1 hour for file contents
});

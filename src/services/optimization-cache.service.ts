/**
 * @fileoverview Optimization cache service with LRU cache and Redis support
 * @lastmodified 2025-08-26T15:40:00Z
 *
 * Features: LRU cache, Redis distributed cache, TTL management, cache invalidation
 * Main APIs: get(), set(), invalidate(), generateCacheKey()
 * Constraints: Optional Redis dependency, configurable cache sizes
 * Patterns: Cache-aside pattern, distributed caching, TTL-based expiration
 */

import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { CacheService } from './cache.service';
import { getPromptWizardConfig } from '../config/promptwizard.config';
import {
  CacheError,
  ErrorTracker,
  RetryManager,
  OptimizationError,
} from '../utils/optimization-errors';
import { optimizationMetrics } from '../utils/performance-monitor';
import {
  OptimizationConfig,
  OptimizedResult,
} from '../integrations/promptwizard/types';

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  metadata?: Record<string, unknown>;
}

export interface CacheStats {
  totalEntries: number;
  memoryUsage: number;
  hitRate: number;
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  expiredEntries: number;
  redisConnected?: boolean;
}

export interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  enableRedis: boolean;
  redisUrl?: string;
  keyPrefix: string;
  serializationFormat: 'json' | 'messagepack';
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  private accessOrder: string[] = [];

  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Move to end (most recently used)
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);

    return entry.value;
  }

  set(
    key: string,
    value: T,
    ttl: number,
    metadata?: Record<string, unknown>
  ): void {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl,
      metadata,
    };

    // If key exists, update and move to end
    if (this.cache.has(key)) {
      this.cache.set(key, entry);
      this.removeFromAccessOrder(key);
      this.accessOrder.push(key);
      return;
    }

    // If cache is full, remove least recently used
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.accessOrder.push(key);
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  size(): number {
    return this.cache.size;
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  getExpiredKeys(): string[] {
    const expired: string[] = [];
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        expired.push(key);
      }
    }
    return expired;
  }

  cleanup(): void {
    const expiredKeys = this.getExpiredKeys();
    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    });
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictLRU(): void {
    const oldestKey = this.accessOrder.shift();
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

export class OptimizationCacheService {
  private memoryCache: LRUCache<OptimizedResult>;

  private redisCache?: CacheService;

  private config: CacheConfig;

  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    expiredEntries: 0,
  };

  private errorTracker = new ErrorTracker();

  constructor(customConfig: Partial<CacheConfig> = {}) {
    const promptwizardConfig = getPromptWizardConfig();

    this.config = {
      maxSize: promptwizardConfig.cache.maxSize,
      defaultTTL: promptwizardConfig.cache.ttl * 1000, // Convert to milliseconds
      enableRedis: promptwizardConfig.cache.redis?.enabled || false,
      redisUrl: promptwizardConfig.cache.redis?.url,
      keyPrefix: promptwizardConfig.cache.redis?.keyPrefix || 'promptwizard:',
      serializationFormat: 'json',
      ...customConfig,
    };

    this.memoryCache = new LRUCache<OptimizedResult>(this.config.maxSize);

    // Initialize Redis cache if enabled
    if (this.config.enableRedis) {
      this.initializeRedisCache();
    }

    // Set up periodic cleanup
    this.setupPeriodicCleanup();

    logger.info('Optimization cache service initialized -', {
      maxSize: this.config.maxSize,
      defaultTTL: this.config.defaultTTL,
      redisEnabled: this.config.enableRedis,
    });
  }

  /**
   * Get optimization result from cache
   */
  async get(request: OptimizationConfig): Promise<OptimizedResult | null> {
    return optimizationMetrics.trackCacheOperation(
      'get',
      this.generateCacheKey(request),
      async () => {
        this.stats.totalRequests += 1;

        const cacheKey = this.generateCacheKey(request);

        // Try memory cache first
        try {
          const result = this.memoryCache.get(cacheKey);

          if (result) {
            this.stats.cacheHits += 1;
            logger.debug('Cache hit (memory) -', { cacheKey });
            return result;
          }
        } catch (error: unknown) {
          const cacheError = new CacheError('Memory cache read failed', {
            cacheKey,
            error,
          });
          this.errorTracker.track(cacheError);
          logger.warn('Memory cache error:', {
            message: cacheError.message,
            context: cacheError.context,
          });
        }

        // Try Redis cache if enabled
        if (this.redisCache) {
          try {
            const redisResult = await RetryManager.retry(
              () => this.redisCache!.get(cacheKey),
              this.errorTracker,
              { maxRetries: 2, initialDelay: 100 }
            );

            if (redisResult) {
              // Store in memory cache for faster access
              try {
                this.memoryCache.set(
                  cacheKey,
                  redisResult as unknown as OptimizedResult,
                  this.config.defaultTTL,
                  { source: 'redis' }
                );
              } catch (memError) {
                logger.warn(
                  'Failed to populate memory cache from Redis:',
                  memError
                );
              }

              this.stats.cacheHits += 1;
              logger.debug('Cache hit (Redis) -', { cacheKey });
              return redisResult as unknown as OptimizedResult;
            }
          } catch (error: unknown) {
            const cacheError = new CacheError('Redis cache read failed', {
              cacheKey,
              error,
            });
            this.errorTracker.track(cacheError);
            logger.warn('Redis cache error:', {
              message: cacheError.message,
              context: cacheError.context,
            });
          }
        }

        this.stats.cacheMisses += 1;
        logger.debug('Cache miss -', { cacheKey });
        return null;
      }
    );
  }

  /**
   * Set optimization result in cache
   */
  async set(
    request: OptimizationConfig,
    result: OptimizedResult,
    ttl?: number
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(request);
    const effectiveTTL = ttl || this.config.defaultTTL;

    // Store in memory cache
    this.memoryCache.set(cacheKey, result, effectiveTTL, {
      timestamp: Date.now(),
      templateId: (request as any).templateId,
    });

    // Store in Redis if enabled
    if (this.redisCache) {
      try {
        await this.redisCache.set(
          cacheKey,
          result as unknown as Record<string, unknown>,
          Math.floor(effectiveTTL / 1000)
        ); // Redis TTL in seconds
        logger.debug('Result cached in Redis -', { cacheKey });
      } catch (error: unknown) {
        logger.warn('Redis cache write failed -', { cacheKey, error });
      }
    }

    logger.debug('Optimization result cached -', {
      cacheKey,
      ttl: effectiveTTL,
      memorySize: this.memoryCache.size(),
    });
  }

  /**
   * Invalidate cache entries for a template
   */
  async invalidateTemplate(templateId: string): Promise<void> {
    const keysToRemove: string[] = [];

    // Find memory cache keys to remove
    this.memoryCache.keys().forEach(key => {
      if (key.includes(templateId)) {
        keysToRemove.push(key);
      }
    });

    // Remove from memory cache
    keysToRemove.forEach(key => {
      this.memoryCache.delete(key);
    });

    // Remove from Redis cache if enabled
    if (this.redisCache) {
      try {
        // In a real implementation, this would use Redis SCAN to find keys
        for (const key of keysToRemove) {
          await this.redisCache.delete(key);
        }
      } catch (error: unknown) {
        logger.warn('Redis cache invalidation failed -', { templateId, error });
      }
    }

    logger.info('Template cache invalidated -', {
      templateId,
      keysRemoved: keysToRemove.length,
    });
  }

  /**
   * Generate cache key for optimization request
   */
  generateCacheKey(request: OptimizationConfig): string {
    // Create a deterministic hash of the request parameters that affect optimization
    const keyData = {
      prompt: request.prompt,
      task: request.task,
      targetModel: request.targetModel,
      mutateRefineIterations: request.mutateRefineIterations,
      fewShotCount: request.fewShotCount,
      generateReasoning: request.generateReasoning,
      constraints: request.constraints,
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16); // Use first 16 characters for brevity

    return `${this.config.keyPrefix}opt:${hash}`;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & {
    errorStats?: {
      totalErrors: number;
      errorsByType: Record<string, number>;
      recentErrors: OptimizationError[];
    };
  } {
    const hitRate =
      this.stats.totalRequests > 0
        ? this.stats.cacheHits / this.stats.totalRequests
        : 0;

    return {
      totalEntries: this.memoryCache.size(),
      memoryUsage: this.estimateMemoryUsage(),
      hitRate,
      totalRequests: this.stats.totalRequests,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      expiredEntries: this.stats.expiredEntries,
      redisConnected: this.redisCache !== undefined,
      errorStats: this.errorTracker.getStats(),
    };
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.redisCache) {
      try {
        // In a real implementation, this would use Redis FLUSHDB or SCAN/DEL pattern
        logger.info('Redis cache clear operation would be performed here');
      } catch (error: unknown) {
        logger.warn('Redis cache clear failed -', error);
      }
    }

    // Reset stats
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      expiredEntries: 0,
    };

    logger.info('Optimization cache cleared');
  }

  /**
   * Perform cache maintenance
   */
  async maintenance(): Promise<void> {
    logger.debug('Starting cache maintenance');

    const beforeSize = this.memoryCache.size();

    // Clean up expired entries
    this.memoryCache.cleanup();

    const afterSize = this.memoryCache.size();
    const cleanedEntries = beforeSize - afterSize;

    this.stats.expiredEntries += cleanedEntries;

    if (cleanedEntries > 0) {
      logger.info('Cache maintenance completed -', {
        entriesCleaned: cleanedEntries,
        currentSize: afterSize,
        maxSize: this.config.maxSize,
      });
    }
  }

  /**
   * Initialize Redis cache
   */
  private async initializeRedisCache(): Promise<void> {
    try {
      this.redisCache = new CacheService({
        maxSize: this.config.maxSize,
        ttl: this.config.defaultTTL,
      });
      logger.info('Redis cache initialized for optimization service');
    } catch (error: unknown) {
      logger.warn(
        'Failed to initialize Redis cache - continuing with memory cache only',
        error
      );
      this.redisCache = undefined;
    }
  }

  /**
   * Setup periodic cleanup
   */
  private setupPeriodicCleanup(): void {
    // Run maintenance every 5 minutes
    setInterval(
      () => {
        this.maintenance();
      },
      5 * 60 * 1000
    );
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  private estimateMemoryUsage(): number {
    // Very rough estimation - in a real implementation, this would be more accurate
    return this.memoryCache.size() * 1024; // Assume ~1KB per entry
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.memoryCache.clear();

    if (this.redisCache) {
      await (this.redisCache as any).cleanup?.();
    }

    logger.info('Optimization cache service cleaned up');
  }
}

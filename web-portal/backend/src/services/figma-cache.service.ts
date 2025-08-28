/**
 * @fileoverview Figma API response caching service with TTL and LRU eviction
 * @lastmodified 2025-08-28T10:30:00Z
 * 
 * Features: LRU cache, TTL expiration, memory usage limits, statistics tracking
 * Main APIs: get, set, delete, clear, getStats, cleanup
 * Constraints: Memory limits, TTL enforcement, thread-safe operations
 * Patterns: Map-based LRU, periodic cleanup, structured logging
 */

import { 
  FigmaCacheEntry, 
  FigmaCacheStats,
  FigmaCacheError 
} from '@cursor-prompt/shared';

interface CacheConfig {
  maxSize: number;
  defaultTtl: number;
  cleanupInterval: number;
  maxMemoryMB: number;
}

export class FigmaCacheService {
  private cache = new Map<string, FigmaCacheEntry<any>>();
  private accessOrder: string[] = [];
  private stats: FigmaCacheStats = {
    hits: 0,
    misses: 0,
    size: 0,
    maxSize: 0,
    evictions: 0
  };
  
  private config: CacheConfig = {
    maxSize: 1000,
    defaultTtl: 30 * 60 * 1000, // 30 minutes
    cleanupInterval: 5 * 60 * 1000, // 5 minutes
    maxMemoryMB: 100
  };

  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(customConfig?: Partial<CacheConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
    
    this.stats.maxSize = this.config.maxSize;
    this.startCleanupTimer();
  }

  /**
   * Get item from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.misses++;
      this.updateSize();
      return null;
    }

    // Update access order (move to end for LRU)
    this.updateAccessOrder(key);
    this.stats.hits++;
    
    return entry.data as T;
  }

  /**
   * Set item in cache
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const actualTtl = ttl || this.config.defaultTtl;
    const now = Date.now();
    
    const entry: FigmaCacheEntry<T> = {
      key,
      data,
      createdAt: now,
      expiresAt: now + actualTtl,
      ttl: actualTtl
    };

    // Check memory usage before adding
    const dataSize = this.estimateSize(data);
    if (this.shouldEvict(dataSize)) {
      await this.evictLRU();
    }

    // Set the entry
    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    this.updateSize();

    console.log(`📝 Cached Figma data for key: ${key} (TTL: ${actualTtl}ms)`);
  }

  /**
   * Delete specific key from cache
   */
  async delete(key: string): Promise<boolean> {
    const existed = this.cache.has(key);
    
    if (existed) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.updateSize();
      console.log(`🗑️ Deleted cached Figma data for key: ${key}`);
    }

    return existed;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder.length = 0;
    this.updateSize();
    
    console.log(`🧹 Cleared Figma cache (${size} entries)`);
  }

  /**
   * Clear cache entries for specific file
   */
  async clearFile(fileId: string): Promise<number> {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(fileId)
    );
    
    for (const key of keysToDelete) {
      await this.delete(key);
    }
    
    console.log(`🧹 Cleared ${keysToDelete.length} cache entries for file: ${fileId}`);
    return keysToDelete.length;
  }

  /**
   * Get cache statistics
   */
  getStats(): FigmaCacheStats {
    return { ...this.stats };
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.updateSize();
      return false;
    }
    
    return true;
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    // Filter out expired keys
    const now = Date.now();
    const validKeys: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt > now) {
        validKeys.push(key);
      }
    }
    
    return validKeys;
  }

  /**
   * Get cache entry with metadata
   */
  getEntry<T>(key: string): FigmaCacheEntry<T> | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.updateSize();
      return null;
    }
    
    return entry as FigmaCacheEntry<T>;
  }

  /**
   * Refresh TTL for existing entry
   */
  async refresh(key: string, ttl?: number): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const actualTtl = ttl || this.config.defaultTtl;
    const now = Date.now();
    
    entry.expiresAt = now + actualTtl;
    entry.ttl = actualTtl;
    
    this.updateAccessOrder(key);
    
    console.log(`🔄 Refreshed cache TTL for key: ${key} (TTL: ${actualTtl}ms)`);
    return true;
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer
   */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.updateSize();
      console.log(`🕘 Cleaned up ${expiredCount} expired cache entries`);
    }
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    // Remove from current position
    this.removeFromAccessOrder(key);
    
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Remove key from access order
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Check if we should evict entries
   */
  private shouldEvict(newDataSize: number): boolean {
    // Check size limit
    if (this.cache.size >= this.config.maxSize) {
      return true;
    }
    
    // Check memory limit (rough estimate)
    const currentMemoryMB = this.estimateMemoryUsage();
    if (currentMemoryMB + (newDataSize / (1024 * 1024)) > this.config.maxMemoryMB) {
      return true;
    }
    
    return false;
  }

  /**
   * Evict least recently used entries
   */
  private async evictLRU(): Promise<void> {
    while (this.cache.size >= this.config.maxSize && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder[0];
      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.accessOrder.shift();
        this.stats.evictions++;
      }
    }
    
    this.updateSize();
  }

  /**
   * Update cache size statistics
   */
  private updateSize(): void {
    this.stats.size = this.cache.size;
  }

  /**
   * Estimate data size in bytes (rough approximation)
   */
  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // Rough estimate for UTF-16
    } catch {
      return 1000; // Default estimate for non-serializable data
    }
  }

  /**
   * Estimate current memory usage in MB
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      totalSize += this.estimateSize(entry);
    }
    
    return totalSize / (1024 * 1024);
  }

  /**
   * Generate cache key for Figma operations
   */
  static generateKey(operation: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((sorted, key) => {
        sorted[key] = params[key];
        return sorted;
      }, {} as Record<string, any>);
    
    return `figma:${operation}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get cache key for file info
   */
  static fileInfoKey(fileId: string): string {
    return `figma:file:${fileId}`;
  }

  /**
   * Get cache key for design tokens
   */
  static tokensKey(fileId: string): string {
    return `figma:tokens:${fileId}`;
  }

  /**
   * Get cache key for preview
   */
  static previewKey(fileId: string, nodeId?: string, options?: any): string {
    const params = { fileId, nodeId, ...options };
    return FigmaCacheService.generateKey('preview', params);
  }
}

// Singleton instance
export const figmaCacheService = new FigmaCacheService();
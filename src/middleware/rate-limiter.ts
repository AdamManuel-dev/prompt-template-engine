/**
 * @fileoverview Rate limiting middleware for API calls and service operations
 * @lastmodified 2025-08-23T05:30:00Z
 *
 * Features: Flexible rate limiting with multiple algorithms and storage backends
 * Main APIs: RateLimiter class, withRateLimit decorator, rate limiting middleware
 * Constraints: Configurable limits, multiple algorithms, persistent storage
 * Patterns: Middleware pattern, decorator pattern, sliding window, token bucket
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

/**
 * Rate limiting algorithms
 */
export type RateLimitAlgorithm =
  | 'sliding-window'
  | 'token-bucket'
  | 'fixed-window'
  | 'leaky-bucket';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  // Basic configuration
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  algorithm: RateLimitAlgorithm;

  // Advanced configuration
  keyGenerator?: (identifier: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;

  // Behavior on limit exceeded
  delayAfterHit?: number; // Delay in ms after hit
  blockAfterHit?: boolean; // Block further requests

  // Custom messages
  message?: string;

  // Storage backend
  store?: IRateLimitStore;

  // Whitelist/blacklist
  whitelist?: string[];
  blacklist?: string[];
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  error?: string;
}

/**
 * Rate limit storage interface
 */
export interface IRateLimitStore {
  get(key: string): Promise<RateLimitData | null>;
  set(key: string, data: RateLimitData): Promise<void>;
  increment(key: string, ttl: number): Promise<number>;
  reset(key: string): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * Rate limit data structure
 */
export interface RateLimitData {
  count: number;
  resetTime: number;
  firstHit: number;

  // Token bucket specific
  tokens?: number;
  lastRefill?: number;

  // Sliding window specific
  hits?: Array<{ timestamp: number; count: number }>;
}

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  algorithm: 'sliding-window',
  keyGenerator: (id: string) => id,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  delayAfterHit: 0,
  blockAfterHit: true,
  message: 'Rate limit exceeded',
};

/**
 * In-memory rate limit store
 */
export class MemoryRateLimitStore implements IRateLimitStore {
  private store = new Map<string, RateLimitData>();

  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs = 60000) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  async get(key: string): Promise<RateLimitData | null> {
    const data = this.store.get(key);
    if (!data) return null;

    // Check if expired
    if (Date.now() > data.resetTime) {
      this.store.delete(key);
      return null;
    }

    return data;
  }

  async set(key: string, data: RateLimitData): Promise<void> {
    this.store.set(key, data);
  }

  async increment(key: string, ttl: number): Promise<number> {
    const existing = await this.get(key);
    const now = Date.now();

    if (!existing) {
      const data: RateLimitData = {
        count: 1,
        resetTime: now + ttl,
        firstHit: now,
      };
      await this.set(key, data);
      return 1;
    }

    existing.count++;
    await this.set(key, existing);
    return existing.count;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [key, data] of this.store.entries()) {
      if (now > data.resetTime) {
        this.store.delete(key);
      }
    }
  }

  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

/**
 * Main rate limiter class
 */
export class RateLimiter extends EventEmitter {
  private config: Required<RateLimitConfig>;

  private store: IRateLimitStore;

  constructor(config: Partial<RateLimitConfig> = {}) {
    super();

    this.config = {
      ...DEFAULT_RATE_LIMIT_CONFIG,
      ...config,
      store: config.store || new MemoryRateLimitStore(),
      keyGenerator:
        config.keyGenerator || DEFAULT_RATE_LIMIT_CONFIG.keyGenerator!,
      message: config.message || DEFAULT_RATE_LIMIT_CONFIG.message!,
    } as Required<RateLimitConfig>;

    this.store = this.config.store;
  }

  /**
   * Check if request is allowed and update counters
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    try {
      const key = this.config.keyGenerator(identifier);

      // Check whitelist
      if (this.config.whitelist?.includes(identifier)) {
        return {
          allowed: true,
          remaining: this.config.maxRequests,
          resetTime: Date.now() + this.config.windowMs,
        };
      }

      // Check blacklist
      if (this.config.blacklist?.includes(identifier)) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + this.config.windowMs,
          error: 'Identifier is blacklisted',
        };
      }

      switch (this.config.algorithm) {
        case 'sliding-window':
          return this.slidingWindowCheck(key);
        case 'token-bucket':
          return this.tokenBucketCheck(key);
        case 'fixed-window':
          return this.fixedWindowCheck(key);
        case 'leaky-bucket':
          return this.leakyBucketCheck(key);
        default:
          throw new Error(`Unknown algorithm: ${this.config.algorithm}`);
      }
    } catch (error: any) {
      logger.error(`Rate limit check failed: ${error.message}`);
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + this.config.windowMs,
        error: error.message,
      };
    }
  }

  /**
   * Sliding window rate limiting
   */
  private async slidingWindowCheck(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let data = await this.store.get(key);
    if (!data) {
      data = {
        count: 0,
        resetTime: now + this.config.windowMs,
        firstHit: now,
        hits: [],
      };
    }

    // Remove old hits outside the window
    if (data.hits) {
      data.hits = data.hits.filter(hit => hit.timestamp > windowStart);
    }

    // Calculate current count
    const currentCount =
      data.hits?.reduce((sum, hit) => sum + hit.count, 0) || 0;

    if (currentCount >= this.config.maxRequests) {
      const oldestHit = data.hits?.[0];
      const resetTime = oldestHit
        ? oldestHit.timestamp + this.config.windowMs
        : now + this.config.windowMs;

      this.emit('limitExceeded', {
        key,
        identifier: key,
        currentCount,
        limit: this.config.maxRequests,
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.max(0, resetTime - now),
      };
    }

    // Add current hit
    if (!data.hits) data.hits = [];
    data.hits.push({ timestamp: now, count: 1 });
    data.count = currentCount + 1;

    await this.store.set(key, data);

    return {
      allowed: true,
      remaining: Math.max(0, this.config.maxRequests - (currentCount + 1)),
      resetTime: now + this.config.windowMs,
    };
  }

  /**
   * Token bucket rate limiting
   */
  private async tokenBucketCheck(key: string): Promise<RateLimitResult> {
    const now = Date.now();

    let data = await this.store.get(key);
    if (!data) {
      data = {
        count: 0,
        resetTime: now + this.config.windowMs,
        firstHit: now,
        tokens: this.config.maxRequests,
        lastRefill: now,
      };
    }

    // Refill tokens based on time passed
    const timePassed = now - (data.lastRefill || now);
    const refillRate = this.config.maxRequests / this.config.windowMs; // tokens per ms
    const tokensToAdd = Math.floor(timePassed * refillRate);

    data.tokens = Math.min(
      this.config.maxRequests,
      (data.tokens || 0) + tokensToAdd
    );
    data.lastRefill = now;

    if ((data.tokens || 0) < 1) {
      const timeToNextToken = 1 / refillRate;

      this.emit('limitExceeded', {
        key,
        identifier: key,
        tokens: data.tokens,
        limit: this.config.maxRequests,
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: now + timeToNextToken,
        retryAfter: timeToNextToken,
      };
    }

    // Consume one token
    data.tokens = (data.tokens || 0) - 1;
    data.count++;

    await this.store.set(key, data);

    return {
      allowed: true,
      remaining: data.tokens,
      resetTime: now + this.config.windowMs,
    };
  }

  /**
   * Fixed window rate limiting
   */
  private async fixedWindowCheck(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart =
      Math.floor(now / this.config.windowMs) * this.config.windowMs;

    let data = await this.store.get(key);
    if (!data || data.firstHit < windowStart) {
      data = {
        count: 0,
        resetTime: windowStart + this.config.windowMs,
        firstHit: now,
      };
    }

    if (data.count >= this.config.maxRequests) {
      this.emit('limitExceeded', {
        key,
        identifier: key,
        currentCount: data.count,
        limit: this.config.maxRequests,
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: data.resetTime,
        retryAfter: data.resetTime - now,
      };
    }

    data.count++;
    await this.store.set(key, data);

    return {
      allowed: true,
      remaining: this.config.maxRequests - data.count,
      resetTime: data.resetTime,
    };
  }

  /**
   * Leaky bucket rate limiting
   */
  private async leakyBucketCheck(key: string): Promise<RateLimitResult> {
    const now = Date.now();

    let data = await this.store.get(key);
    if (!data) {
      data = {
        count: 1,
        resetTime: now + this.config.windowMs,
        firstHit: now,
      };
    } else {
      // Leak tokens based on time
      const timePassed = now - data.firstHit;
      const leakRate = this.config.maxRequests / this.config.windowMs; // requests per ms
      const leaked = Math.floor(timePassed * leakRate);

      data.count = Math.max(0, data.count - leaked);
      data.firstHit = now;
    }

    if (data.count >= this.config.maxRequests) {
      const drainTime =
        (data.count - this.config.maxRequests + 1) /
        (this.config.maxRequests / this.config.windowMs);

      this.emit('limitExceeded', {
        key,
        identifier: key,
        currentCount: data.count,
        limit: this.config.maxRequests,
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: now + drainTime,
        retryAfter: drainTime,
      };
    }

    data.count++;
    await this.store.set(key, data);

    return {
      allowed: true,
      remaining: this.config.maxRequests - data.count,
      resetTime: data.resetTime,
    };
  }

  /**
   * Reset rate limit for identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = this.config.keyGenerator(identifier);
    await this.store.reset(key);
    this.emit('limitReset', { identifier, key });
  }

  /**
   * Get current status for identifier
   */
  async getStatus(identifier: string): Promise<RateLimitData | null> {
    const key = this.config.keyGenerator(identifier);
    return this.store.get(key);
  }

  /**
   * Cleanup expired entries
   */
  async cleanup(): Promise<void> {
    await this.store.cleanup();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.store instanceof MemoryRateLimitStore) {
      this.store.dispose();
    }
  }
}

/**
 * Rate limiting decorator
 */
export function withRateLimit(config: Partial<RateLimitConfig> = {}) {
  const limiter = new RateLimiter(config);

  return function (
    _target: any,
    _propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Use 'this' context or first argument as identifier
      const identifier =
        this?.constructor?.name || args[0]?.toString() || 'anonymous';

      const result = await limiter.checkLimit(identifier);

      if (!result.allowed) {
        const error = new Error(config.message || 'Rate limit exceeded');
        (error as any).rateLimitInfo = result;
        throw error;
      }

      // Apply delay if configured
      if (config.delayAfterHit && config.delayAfterHit > 0) {
        await new Promise(resolve => setTimeout(resolve, config.delayAfterHit));
      }

      return method.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Create rate limiter middleware for different contexts
 */
export function createRateLimitMiddleware(
  config: Partial<RateLimitConfig> = {}
) {
  const limiter = new RateLimiter(config);

  return async (
    identifier: string,
    operation: () => Promise<any>
  ): Promise<any> => {
    const result = await limiter.checkLimit(identifier);

    if (!result.allowed) {
      const error = new Error(config.message || 'Rate limit exceeded');
      (error as any).rateLimitInfo = result;
      throw error;
    }

    // Apply delay if configured
    if (config.delayAfterHit && config.delayAfterHit > 0) {
      await new Promise(resolve => setTimeout(resolve, config.delayAfterHit));
    }

    return operation();
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  // Strict rate limiting for sensitive operations
  strict: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    algorithm: 'sliding-window',
    blockAfterHit: true,
  }),

  // Moderate rate limiting for general APIs
  moderate: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    algorithm: 'token-bucket',
    delayAfterHit: 100, // 100ms delay after each request
  }),

  // Lenient rate limiting for bulk operations
  lenient: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000, // 1000 requests per minute
    algorithm: 'fixed-window',
    skipSuccessfulRequests: true, // Only count failed requests
  }),

  // Burst-friendly rate limiting
  burst: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 200, // 200 requests per 15 minutes
    algorithm: 'leaky-bucket',
  }),
};

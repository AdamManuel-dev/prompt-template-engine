/**
 * @fileoverview Comprehensive tests for rate limiting middleware
 * @lastmodified 2025-08-23T05:30:00Z
 * 
 * Features: Tests for all rate limiting algorithms and storage backends
 * Main APIs: RateLimiter class, decorators, middleware functions
 * Constraints: Test timeout and memory management
 * Patterns: Unit testing, async testing, timer mocking
 */

import { 
  RateLimiter, 
  MemoryRateLimitStore, 
  withRateLimit, 
  createRateLimitMiddleware,
  rateLimiters,
  DEFAULT_RATE_LIMIT_CONFIG
} from '../../../src/middleware/rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      windowMs: 1000, // 1 second for faster tests
      maxRequests: 3,
      algorithm: 'sliding-window'
    });
  });

  afterEach(async () => {
    await rateLimiter.cleanup();
    rateLimiter.dispose();
  });

  describe('Sliding Window Algorithm', () => {
    it('should allow requests within limit', async () => {
      const result1 = await rateLimiter.checkLimit('user1');
      const result2 = await rateLimiter.checkLimit('user1');
      const result3 = await rateLimiter.checkLimit('user1');

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);
      
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);
      
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it('should block requests exceeding limit', async () => {
      // Use up the limit
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');

      // This should be blocked
      const result = await rateLimiter.checkLimit('user1');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should reset after window expires', async () => {
      // Use up the limit
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be allowed again
      const result = await rateLimiter.checkLimit('user1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should handle multiple users independently', async () => {
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');

      // user1 should be blocked
      const result1 = await rateLimiter.checkLimit('user1');
      expect(result1.allowed).toBe(false);

      // user2 should be allowed
      const result2 = await rateLimiter.checkLimit('user2');
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(2);
    });
  });

  describe('Token Bucket Algorithm', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        algorithm: 'token-bucket'
      });
    });

    it('should allow burst requests initially', async () => {
      const result1 = await rateLimiter.checkLimit('user1');
      const result2 = await rateLimiter.checkLimit('user1');
      const result3 = await rateLimiter.checkLimit('user1');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);
    });

    it('should refill tokens over time', async () => {
      // Use up all tokens
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');

      // Should be blocked
      const blocked = await rateLimiter.checkLimit('user1');
      expect(blocked.allowed).toBe(false);

      // Wait for token refill
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should have some tokens available
      const refilled = await rateLimiter.checkLimit('user1');
      expect(refilled.allowed).toBe(true);
    });
  });

  describe('Fixed Window Algorithm', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        algorithm: 'fixed-window'
      });
    });

    it('should reset at fixed intervals', async () => {
      const startTime = Date.now();
      
      // Use up the limit
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');

      // Should be blocked
      const blocked = await rateLimiter.checkLimit('user1');
      expect(blocked.allowed).toBe(false);

      // Wait for next window
      const waitTime = 1000 - (Date.now() % 1000) + 100; // Wait to next second + buffer
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Should be allowed in new window
      const newWindow = await rateLimiter.checkLimit('user1');
      expect(newWindow.allowed).toBe(true);
    });
  });

  describe('Leaky Bucket Algorithm', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        algorithm: 'leaky-bucket'
      });
    });

    it('should leak requests over time', async () => {
      // Fill the bucket
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');
      await rateLimiter.checkLimit('user1');

      // Should be blocked
      const blocked = await rateLimiter.checkLimit('user1');
      expect(blocked.allowed).toBe(false);

      // Wait for leak
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should have capacity again
      const leaked = await rateLimiter.checkLimit('user1');
      expect(leaked.allowed).toBe(true);
    });
  });

  describe('Whitelist/Blacklist', () => {
    beforeEach(() => {
      rateLimiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 1,
        algorithm: 'fixed-window',
        whitelist: ['admin'],
        blacklist: ['banned']
      });
    });

    it('should allow whitelisted users unlimited access', async () => {
      const result1 = await rateLimiter.checkLimit('admin');
      const result2 = await rateLimiter.checkLimit('admin');
      const result3 = await rateLimiter.checkLimit('admin');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);
    });

    it('should block blacklisted users immediately', async () => {
      const result = await rateLimiter.checkLimit('banned');
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Identifier is blacklisted');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors gracefully', async () => {
      const mockStore = {
        get: jest.fn().mockRejectedValue(new Error('Storage error')),
        set: jest.fn(),
        increment: jest.fn(),
        reset: jest.fn(),
        cleanup: jest.fn()
      };

      const limiter = new RateLimiter({
        windowMs: 1000,
        maxRequests: 3,
        algorithm: 'sliding-window',
        store: mockStore
      });

      const result = await limiter.checkLimit('user1');
      expect(result.allowed).toBe(false);
      expect(result.error).toBe('Storage error');
    });
  });
});

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
  });

  afterEach(() => {
    store.dispose();
  });

  it('should store and retrieve data', async () => {
    const data = {
      count: 1,
      resetTime: Date.now() + 1000,
      firstHit: Date.now()
    };

    await store.set('key1', data);
    const retrieved = await store.get('key1');

    expect(retrieved).toEqual(data);
  });

  it('should return null for non-existent keys', async () => {
    const result = await store.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should increment counters', async () => {
    const count1 = await store.increment('key1', 1000);
    const count2 = await store.increment('key1', 1000);

    expect(count1).toBe(1);
    expect(count2).toBe(2);
  });

  it('should cleanup expired entries', async () => {
    const expiredData = {
      count: 1,
      resetTime: Date.now() - 1000, // Already expired
      firstHit: Date.now() - 1000
    };

    await store.set('expired', expiredData);
    await store.cleanup();

    const result = await store.get('expired');
    expect(result).toBeNull();
  });

  it('should reset specific keys', async () => {
    const data = {
      count: 5,
      resetTime: Date.now() + 1000,
      firstHit: Date.now()
    };

    await store.set('key1', data);
    await store.reset('key1');

    const result = await store.get('key1');
    expect(result).toBeNull();
  });
});

describe('Rate Limit Decorator', () => {
  class TestClass {
    callCount = 0;

    @withRateLimit({
      windowMs: 1000,
      maxRequests: 2,
      algorithm: 'fixed-window'
    })
    async testMethod(input: string): Promise<string> {
      this.callCount++;
      return `processed: ${input}`;
    }
  }

  let testInstance: TestClass;

  beforeEach(() => {
    testInstance = new TestClass();
  });

  it('should allow calls within rate limit', async () => {
    const result1 = await testInstance.testMethod('test1');
    const result2 = await testInstance.testMethod('test2');

    expect(result1).toBe('processed: test1');
    expect(result2).toBe('processed: test2');
    expect(testInstance.callCount).toBe(2);
  });

  it('should throw error when rate limit exceeded', async () => {
    await testInstance.testMethod('test1');
    await testInstance.testMethod('test2');

    await expect(testInstance.testMethod('test3')).rejects.toThrow('Rate limit exceeded');
    expect(testInstance.callCount).toBe(2);
  });
});

describe('Rate Limit Middleware', () => {
  let middleware: (identifier: string, operation: () => Promise<any>) => Promise<any>;

  beforeEach(() => {
    middleware = createRateLimitMiddleware({
      windowMs: 1000,
      maxRequests: 2,
      algorithm: 'sliding-window'
    });
  });

  it('should allow operations within rate limit', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    const result1 = await middleware('user1', operation);
    const result2 = await middleware('user1', operation);

    expect(result1).toBe('success');
    expect(result2).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('should block operations exceeding rate limit', async () => {
    const operation = jest.fn().mockResolvedValue('success');

    await middleware('user1', operation);
    await middleware('user1', operation);

    await expect(middleware('user1', operation)).rejects.toThrow('Rate limit exceeded');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe('Pre-configured Rate Limiters', () => {
  afterAll(async () => {
    // Cleanup all pre-configured limiters
    await Promise.all([
      rateLimiters.strict.cleanup(),
      rateLimiters.moderate.cleanup(),
      rateLimiters.lenient.cleanup(),
      rateLimiters.burst.cleanup()
    ]);
    
    rateLimiters.strict.dispose();
    rateLimiters.moderate.dispose();
    rateLimiters.lenient.dispose();
    rateLimiters.burst.dispose();
  });

  it('should have different configurations', () => {
    expect(rateLimiters.strict).toBeInstanceOf(RateLimiter);
    expect(rateLimiters.moderate).toBeInstanceOf(RateLimiter);
    expect(rateLimiters.lenient).toBeInstanceOf(RateLimiter);
    expect(rateLimiters.burst).toBeInstanceOf(RateLimiter);
  });

  it('should enforce strict limits', async () => {
    // Strict limiter should have lower limits
    const results = [];
    for (let i = 0; i < 15; i++) {
      const result = await rateLimiters.strict.checkLimit('test-user');
      results.push(result.allowed);
    }

    const allowedCount = results.filter(allowed => allowed).length;
    expect(allowedCount).toBeLessThanOrEqual(10); // Should hit limit quickly
  });
});

describe('Default Configuration', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_RATE_LIMIT_CONFIG.windowMs).toBe(60 * 1000);
    expect(DEFAULT_RATE_LIMIT_CONFIG.maxRequests).toBe(100);
    expect(DEFAULT_RATE_LIMIT_CONFIG.algorithm).toBe('sliding-window');
    expect(DEFAULT_RATE_LIMIT_CONFIG.skipSuccessfulRequests).toBe(false);
    expect(DEFAULT_RATE_LIMIT_CONFIG.skipFailedRequests).toBe(false);
  });
});
/**
 * @fileoverview Comprehensive security middleware with helmet, CORS, rate limiting
 * @lastmodified 2025-01-08T21:00:00Z
 * 
 * Features: Security headers, CORS, rate limiting, input validation, request sanitization
 * Main APIs: setupSecurity(), rateLimitByIP(), validateInput()
 * Constraints: Configurable rate limits, secure defaults, production-ready
 * Patterns: Express middleware stack, environment-based configuration
 */

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction, Express } from 'express';
import { body, query, param, validationResult, ValidationChain } from 'express-validator';
import { RateLimitBucket } from '../utils/crypto.utils';

// Environment-based configuration
const isDevelopment = process.env['NODE_ENV'] === 'development';
const isProduction = process.env['NODE_ENV'] === 'production';

/**
 * Setup comprehensive security middleware stack
 */
export function setupSecurity(app: Express): void {
  // Security headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: isDevelopment 
          ? ["'self'", "'unsafe-eval'", "'unsafe-inline'"] 
          : ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: isProduction ? {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    } : false,
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // CORS configuration
  app.use(cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:5174', // Frontend dev server
        'http://localhost:3000', // Alternative frontend port
        'http://127.0.0.1:5174',
        'http://127.0.0.1:3000',
      ];

      // Allow additional origins from environment
      if (process.env['CORS_ORIGINS']) {
        allowedOrigins.push(...process.env['CORS_ORIGINS'].split(','));
      }

      // Allow no origin for development (Postman, etc.)
      if (isDevelopment && !origin) {
        return callback(null, true);
      }

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Request-ID',
    ],
    exposedHeaders: ['X-Request-ID', 'X-Rate-Limit-Remaining'],
    maxAge: 86400, // 24 hours
  }));

  // Trust proxy headers (for accurate IP detection behind reverse proxy)
  if (process.env['TRUST_PROXY'] === 'true') {
    app.set('trust proxy', true);
  }
}

/**
 * Global rate limiting by IP address
 */
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 200, // requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later',
  },
  keyGenerator: (req: Request): string => {
    // Use forwarded IP if behind proxy, otherwise connection IP
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  skip: (req: Request): boolean => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  },
});

/**
 * Stricter rate limiting for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 100 : 10, // Very restrictive for auth
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts, please try again later',
  },
  skipSuccessfulRequests: true, // Don't count successful auth attempts
});

/**
 * Rate limiting for expensive operations
 */
export const expensiveOperationLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: isDevelopment ? 50 : 5, // Very restrictive
  message: {
    error: 'OPERATION_RATE_LIMIT_EXCEEDED',
    message: 'Too many expensive operations, please try again later',
  },
});

/**
 * Advanced rate limiting with user-specific buckets
 */
const userBuckets = new Map<string, RateLimitBucket>();

export function createUserRateLimit(options: {
  capacity: number;
  refillRate: number;
  identifier?: (req: Request) => string;
}) {
  const { capacity, refillRate, identifier } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = identifier ? identifier(req) : (req.user?.id || req.ip || 'unknown');
    
    let bucket = userBuckets.get(userId);
    if (!bucket) {
      bucket = new RateLimitBucket(capacity, refillRate);
      userBuckets.set(userId, bucket);
    }

    if (!bucket.consume(1)) {
      res.status(429).json({
        error: 'USER_RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded for this user',
      });
      return;
    }

    next();
  };
}

/**
 * Input validation middleware
 */
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: errors.array().map(error => ({
          field: error.type === 'field' ? error.path : 'unknown',
          message: error.msg,
          value: error.type === 'field' ? error.value : undefined,
        })),
      });
      return;
    }

    next();
  };
}

/**
 * Common validation rules
 */
export const validationRules = {
  email: () => body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address is required'),

  password: () => body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be 8-128 characters long'),

  username: () => body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-30 characters, alphanumeric with - or _ only'),

  id: (field = 'id') => param(field)
    .isUUID()
    .withMessage(`${field} must be a valid UUID`),

  pagination: () => [
    query('page')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Page must be between 1 and 1000'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],

  search: () => query('search')
    .optional()
    .isLength({ min: 1, max: 255 })
    .trim()
    .escape()
    .withMessage('Search query must be 1-255 characters'),
};

/**
 * Request sanitization middleware
 */
export function sanitizeRequest(req: Request, res: Response, next: NextFunction): void {
  // Remove null bytes from strings to prevent injection
  const sanitizeObject = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      return obj.replace(/\0/g, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  // Sanitize request body, query, and params
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
}

/**
 * Request size limiting middleware
 */
export function limitRequestSize(maxSize: number = 10 * 1024 * 1024) { // 10MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    
    if (contentLength > maxSize) {
      res.status(413).json({
        error: 'PAYLOAD_TOO_LARGE',
        message: `Request size exceeds limit of ${maxSize} bytes`,
      });
      return;
    }

    next();
  };
}

/**
 * IP allowlist/denylist middleware
 */
export function createIPFilter(options: {
  allow?: string[];
  deny?: string[];
}) {
  const { allow, deny } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    // Check denylist first
    if (deny && deny.includes(clientIP)) {
      res.status(403).json({
        error: 'IP_BLOCKED',
        message: 'Access denied from this IP address',
      });
      return;
    }

    // Check allowlist if specified
    if (allow && allow.length > 0 && !allow.includes(clientIP)) {
      res.status(403).json({
        error: 'IP_NOT_ALLOWED',
        message: 'Access denied from this IP address',
      });
      return;
    }

    next();
  };
}

/**
 * Security event logging middleware
 */
export function logSecurityEvent(eventType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const event = {
      type: eventType,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      userId: req.user?.id,
    };

    // Log to console in development, would send to logging service in production
    console.log('Security Event:', event);

    next();
  };
}

/**
 * Honeypot middleware for detecting bots
 */
export function honeypot(req: Request, res: Response, next: NextFunction): void {
  // Check for common bot patterns
  const userAgent = req.get('User-Agent')?.toLowerCase() || '';
  const suspiciousUAs = ['bot', 'crawler', 'spider', 'scraper'];
  
  if (suspiciousUAs.some(ua => userAgent.includes(ua))) {
    // Log suspicious activity
    console.log('Suspicious bot detected:', {
      ip: req.ip,
      userAgent,
      path: req.path,
    });
    
    // Return fake error to confuse bots
    if (Math.random() < 0.1) { // 10% chance to return error
      res.status(429).json({ error: 'Rate limited' });
      return;
    }
  }

  next();
}
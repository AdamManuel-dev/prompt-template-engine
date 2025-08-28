/**
 * @fileoverview Comprehensive API validation middleware with security enforcement
 * @lastmodified 2025-08-27T16:00:00Z
 *
 * Features: Request/response validation, SQL injection prevention, rate limiting
 * Main APIs: validateApiRequest(), validateApiResponse(), securityMiddleware()
 * Constraints: All API endpoints must use validation middleware
 * Patterns: Middleware pattern, security-first validation, threat detection
 */

import { z } from 'zod';
import {
  EnhancedValidator,
  SecurityValidationResult,
  ValidationContext,
  SecureStringSchema,
} from '../validation/schemas';
import { securityService } from './security.middleware';
import { logger } from '../utils/logger';

/**
 * API validation configuration
 */
export interface ApiValidationConfig {
  maxRequestSize: number;
  maxResponseSize: number;
  enableSqlInjectionProtection: boolean;
  enableXssProtection: boolean;
  enablePathTraversalProtection: boolean;
  enableRateLimiting: boolean;
  rateLimitWindow: number;
  rateLimitMaxRequests: number;
  logSecurityEvents: boolean;
  blockSuspiciousRequests: boolean;
  securityLevel: 'strict' | 'moderate' | 'permissive';
}

/**
 * Default API validation configuration
 */
export const DEFAULT_API_CONFIG: ApiValidationConfig = {
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  maxResponseSize: 50 * 1024 * 1024, // 50MB
  enableSqlInjectionProtection: true,
  enableXssProtection: true,
  enablePathTraversalProtection: true,
  enableRateLimiting: true,
  rateLimitWindow: 60000, // 1 minute
  rateLimitMaxRequests: 100,
  logSecurityEvents: true,
  blockSuspiciousRequests: true,
  securityLevel: 'strict',
};

/**
 * Request validation schema with comprehensive security checks
 */
export const ApiRequestValidationSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']),
  url: z
    .string()
    .min(1, 'URL cannot be empty')
    .max(2048, 'URL too long')
    .refine(val => !val.includes('..'), 'URL contains path traversal')
    .refine(val => !/[<>"'&]/.test(val), 'URL contains dangerous characters'),
  headers: z
    .record(
      z
        .string()
        .max(100, 'Header name too long')
        .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid header name'),
      SecureStringSchema.max(4000, 'Header value too long')
    )
    .refine(headers => Object.keys(headers).length <= 100, {
      message: 'Too many headers',
    })
    .optional(),
  query: z
    .record(
      z.string().max(100, 'Query parameter name too long'),
      z.union([
        SecureStringSchema.max(1000, 'Query parameter too long'),
        z
          .array(SecureStringSchema.max(100))
          .max(50, 'Too many query array values'),
      ])
    )
    .refine(query => Object.keys(query).length <= 50, {
      message: 'Too many query parameters',
    })
    .optional(),
  params: z
    .record(
      z.string().max(100, 'Path parameter name too long'),
      SecureStringSchema.max(255, 'Path parameter too long')
    )
    .refine(params => Object.keys(params).length <= 20, {
      message: 'Too many path parameters',
    })
    .optional(),
  body: z.unknown().optional(),
  clientIp: z
    .string()
    .regex(
      /^(?:\d{1,3}\.){3}\d{1,3}$|^(?:[a-f0-9]*:+)+[a-f0-9]*$/,
      'Invalid IP address format'
    )
    .optional(),
  userAgent: SecureStringSchema.max(500, 'User agent too long').optional(),
  contentType: z
    .string()
    .max(100, 'Content type too long')
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^]*(?:;.*)?$/
    )
    .optional(),
});

/**
 * Response validation schema
 */
export const ApiResponseValidationSchema = z.object({
  status: z
    .number()
    .min(100, 'Invalid HTTP status code')
    .max(599, 'Invalid HTTP status code'),
  headers: z.record(z.string().max(100), z.string().max(4000)).optional(),
  body: z.unknown().optional(),
  contentType: z.string().max(100).optional(),
});

/**
 * Security event tracking
 */
interface SecurityEvent {
  timestamp: Date;
  type:
    | 'sql_injection'
    | 'xss_attempt'
    | 'path_traversal'
    | 'rate_limit'
    | 'suspicious_content';
  severity: 'low' | 'medium' | 'high' | 'critical';
  clientIp?: string;
  userAgent?: string;
  details: string;
  blocked: boolean;
}

/**
 * API validation middleware class
 */
export class ApiValidationMiddleware {
  private config: ApiValidationConfig;

  private rateLimiter = securityService.createRateLimiter(60000, 100);

  private securityEvents: SecurityEvent[] = [];

  constructor(config: Partial<ApiValidationConfig> = {}) {
    this.config = { ...DEFAULT_API_CONFIG, ...config };
  }

  /**
   * Main middleware function for API validation
   */
  validate() {
    return async (req: any, res: any, next: any) => {
      try {
        const context: ValidationContext = {
          clientId: req.ip || 'unknown',
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          timestamp: new Date(),
          requestId: req.id || `req_${Date.now()}`,
          source: req.originalUrl || req.url || 'unknown',
        };

        // Rate limiting check
        if (this.config.enableRateLimiting) {
          const rateLimitResult = this.rateLimiter.isAllowed(
            context.clientId || 'unknown'
          );
          if (!rateLimitResult.allowed) {
            this.logSecurityEvent({
              type: 'rate_limit',
              severity: 'medium',
              clientIp: context.ipAddress,
              userAgent: context.userAgent,
              details: `Rate limit exceeded: ${rateLimitResult.retryAfter}s retry`,
              blocked: true,
            });

            return res.status(429).json({
              error: 'Rate limit exceeded',
              retryAfter: rateLimitResult.retryAfter,
            });
          }
        }

        // Validate request structure
        const requestValidation = await this.validateRequest(req);
        if (!requestValidation.isValid) {
          if (requestValidation.threatLevel === 'danger') {
            this.logSecurityEvent({
              type: 'suspicious_content',
              severity: 'high',
              clientIp: context.ipAddress,
              userAgent: context.userAgent,
              details: `Request validation failed: ${requestValidation.errors.join(', ')}`,
              blocked: true,
            });

            return res.status(400).json({
              error: 'Request validation failed',
              details:
                this.config.securityLevel === 'strict'
                  ? 'Security violation detected'
                  : requestValidation.errors,
            });
          }
        }

        // Validate request body if present
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyValidation = await this.validateRequestBody(req.body);
          if (
            !bodyValidation.isValid &&
            bodyValidation.threatLevel === 'danger'
          ) {
            this.logSecurityEvent({
              type: 'suspicious_content',
              severity: 'high',
              clientIp: context.ipAddress,
              userAgent: context.userAgent,
              details: `Request body validation failed: ${bodyValidation.errors.join(', ')}`,
              blocked: true,
            });

            return res.status(400).json({
              error: 'Request body validation failed',
              details:
                this.config.securityLevel === 'strict'
                  ? 'Invalid request data'
                  : bodyValidation.errors,
            });
          }

          // Sanitize request body
          if (bodyValidation.sanitized) {
            req.body = bodyValidation.sanitized;
          }
        }

        // SQL injection protection
        if (this.config.enableSqlInjectionProtection) {
          const sqlThreat = this.checkSqlInjection(req);
          if (sqlThreat) {
            this.logSecurityEvent({
              type: 'sql_injection',
              severity: 'high',
              clientIp: context.ipAddress,
              userAgent: context.userAgent,
              details: sqlThreat,
              blocked: true,
            });

            return res.status(403).json({
              error: 'Forbidden: SQL injection attempt detected',
            });
          }
        }

        // XSS protection
        if (this.config.enableXssProtection) {
          const xssThreat = this.checkXssAttempt(req);
          if (xssThreat) {
            this.logSecurityEvent({
              type: 'xss_attempt',
              severity: 'high',
              clientIp: context.ipAddress,
              userAgent: context.userAgent,
              details: xssThreat,
              blocked: true,
            });

            return res.status(403).json({
              error: 'Forbidden: XSS attempt detected',
            });
          }
        }

        // Path traversal protection
        if (this.config.enablePathTraversalProtection) {
          const pathThreat = this.checkPathTraversal(req);
          if (pathThreat) {
            this.logSecurityEvent({
              type: 'path_traversal',
              severity: 'high',
              clientIp: context.ipAddress,
              userAgent: context.userAgent,
              details: pathThreat,
              blocked: true,
            });

            return res.status(403).json({
              error: 'Forbidden: Path traversal attempt detected',
            });
          }
        }

        // Add validation context to request
        req.isValidationContext = context;
        req.securityHeaders = securityService.getSecureHeaders({
          enableCSP: true,
          enableHSTS: true,
        });

        next();
      } catch (error: any) {
        logger.error('API validation middleware error:', error);
        res.status(500).json({
          error: 'Internal validation error',
        });
      }
    };
  }

  /**
   * Validate API request structure
   */
  private async validateRequest(req: any): Promise<SecurityValidationResult> {
    const requestData = {
      method: req.method,
      url: req.originalUrl || req.url,
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body,
      clientIp: req.ip,
      userAgent: req.headers['user-agent'],
      contentType: req.headers['content-type'],
    };

    return EnhancedValidator.validate(ApiRequestValidationSchema, requestData);
  }

  /**
   * Validate request body with deep security scanning
   */
  private async validateRequestBody(
    body: any
  ): Promise<SecurityValidationResult> {
    // Check request body size
    const bodySize = JSON.stringify(body).length;
    if (bodySize > this.config.maxRequestSize) {
      return {
        isValid: false,
        errors: [
          `Request body too large: ${bodySize} bytes (max ${this.config.maxRequestSize})`,
        ],
        warnings: [],
        threatLevel: 'warning',
        securityLevel: 'warning',
        threats: [`Request body too large: ${bodySize} bytes`],
      };
    }

    // Perform deep security scan
    return EnhancedValidator.validate(z.unknown(), body);
  }

  /**
   * Check for SQL injection patterns
   */
  private checkSqlInjection(req: any): string | null {
    const checkValue = (value: any, path: string = ''): string | null => {
      if (typeof value === 'string') {
        const sqlPatterns = [
          /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\s)/i,
          /(--|\/\*|\*\/)/,
          /(\b(or|and)\s+['"]\d+['"]\s*=\s*['"]\d+['"])/i,
          /('.*'.*=.*'.*')/,
          /(;.*--)/,
          /(\b(cast|convert|char|varchar|nvarchar)\s*\()/i,
          /(\b(waitfor|delay|benchmark|sleep)\s*\()/i,
          /(\b(load_file|outfile|dumpfile)\s*\()/i,
        ];

        for (const pattern of sqlPatterns) {
          if (pattern.test(value)) {
            return `SQL injection pattern detected at ${path}: ${pattern.source}`;
          }
        }
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const result = checkValue(value[i], `${path}[${i}]`);
          if (result) return result;
        }
      } else if (value && typeof value === 'object') {
        for (const [key, val] of Object.entries(value)) {
          const result = checkValue(val, path ? `${path}.${key}` : key);
          if (result) return result;
        }
      }
      return null;
    };

    return (
      checkValue(req.query) || checkValue(req.params) || checkValue(req.body)
    );
  }

  /**
   * Check for XSS attack patterns
   */
  private checkXssAttempt(req: any): string | null {
    const checkValue = (value: any, path: string = ''): string | null => {
      if (typeof value === 'string') {
        const xssPatterns = [
          /<script[^>]*>.*?<\/script>/gis,
          /on\w+\s*=\s*["'][^"']*["']/gi,
          /(javascript|vbscript|data):\s*[^;\s]*/gi,
          /<iframe[^>]*>.*?<\/iframe>/gis,
          /<object[^>]*>.*?<\/object>/gis,
          /<embed[^>]*>/gi,
          /eval\s*\(/gi,
          /setTimeout\s*\(/gi,
          /setInterval\s*\(/gi,
          /Function\s*\(/gi,
        ];

        for (const pattern of xssPatterns) {
          if (pattern.test(value)) {
            return `XSS pattern detected at ${path}: ${pattern.source}`;
          }
        }
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const result = checkValue(value[i], `${path}[${i}]`);
          if (result) return result;
        }
      } else if (value && typeof value === 'object') {
        for (const [key, val] of Object.entries(value)) {
          const result = checkValue(val, path ? `${path}.${key}` : key);
          if (result) return result;
        }
      }
      return null;
    };

    return (
      checkValue(req.query) || checkValue(req.params) || checkValue(req.body)
    );
  }

  /**
   * Check for path traversal attempts
   */
  private checkPathTraversal(req: any): string | null {
    const checkValue = (value: any, path: string = ''): string | null => {
      if (typeof value === 'string') {
        const pathTraversalPatterns = [
          /\\.\\.[/\\\\]/,
          /[/\\\\]\\.\\.[/\\\\]/,
          /^\\.\\$/,
          /^\\.\\.[/\\\\]/,
          /[/\\\\]\\.\\$/,
          /~[/\\\\]/,
          /(\.){3,}/,
        ];

        for (const pattern of pathTraversalPatterns) {
          if (pattern.test(value)) {
            return `Path traversal pattern detected at ${path}: ${pattern.source}`;
          }
        }
      } else if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const result = checkValue(value[i], `${path}[${i}]`);
          if (result) return result;
        }
      } else if (value && typeof value === 'object') {
        for (const [key, val] of Object.entries(value)) {
          const result = checkValue(val, path ? `${path}.${key}` : key);
          if (result) return result;
        }
      }
      return null;
    };

    return (
      checkValue(req.query) ||
      checkValue(req.params) ||
      checkValue(req.body) ||
      (req.originalUrl && checkValue(req.originalUrl, 'url'))
    );
  }

  /**
   * Log security events
   */
  private logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.securityEvents.push(securityEvent);

    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    if (this.config.logSecurityEvents) {
      logger.warn('Security event detected:', securityEvent);
    }
  }

  /**
   * Get security event statistics
   */
  getSecurityStats(): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    recentEvents: SecurityEvent[];
  } {
    const eventsByType: Record<string, number> = {};
    const eventsBySeverity: Record<string, number> = {};

    for (const event of this.securityEvents) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      eventsBySeverity[event.severity] =
        (eventsBySeverity[event.severity] || 0) + 1;
    }

    return {
      totalEvents: this.securityEvents.length,
      eventsByType,
      eventsBySeverity,
      recentEvents: this.securityEvents.slice(-50), // Last 50 events
    };
  }

  /**
   * Clear security events history
   */
  clearSecurityEvents(): void {
    this.securityEvents = [];
  }
}

/**
 * Global API validation middleware instance
 */
export const apiValidationMiddleware = new ApiValidationMiddleware();

/**
 * Express middleware factory for easy integration
 */
export function createApiValidationMiddleware(
  config?: Partial<ApiValidationConfig>
) {
  const middleware = new ApiValidationMiddleware(config);
  return middleware.validate();
}

/**
 * Validation decorator for controller methods
 */
export function ValidateApiEndpoint(schema: z.ZodSchema<any>) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const [req, res] = args;

      try {
        const validationResult = EnhancedValidator.validate(schema, {
          query: req.query,
          params: req.params,
          body: req.body,
        });

        if (!validationResult.isValid) {
          return res.status(400).json({
            error: 'Validation failed',
            details: validationResult.errors,
          });
        }

        // Replace request data with sanitized version
        if (validationResult.sanitized) {
          const sanitized = validationResult.sanitized as any;
          req.query = sanitized.query || req.query;
          req.params = sanitized.params || req.params;
          req.body = sanitized.body || req.body;
        }

        return originalMethod.apply(this, args);
      } catch (error: any) {
        logger.error('Validation decorator error:', error);
        return res.status(500).json({
          error: 'Internal validation error',
        });
      }
    };

    return descriptor;
  };
}

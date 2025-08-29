/**
 * @fileoverview Comprehensive security headers middleware for enterprise-grade protection
 * @lastmodified 2025-08-27T16:45:00Z
 *
 * Features: OWASP-compliant headers, CSP with nonces, HSTS, security policies, threat protection
 * Main APIs: securityHeadersMiddleware(), generateCSPNonce(), setSecurityHeaders()
 * Constraints: Compatible with Express.js, requires proper configuration
 * Patterns: Middleware pattern, security-first design, configurable policies
 */

import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface SecurityHeadersConfig {
  // Content Security Policy
  csp?: {
    enabled: boolean;
    reportOnly?: boolean;
    directives?: CSPDirectives;
    nonce?: boolean;
    reportUri?: string;
  };

  // HTTP Strict Transport Security
  hsts?: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };

  // Cross-Origin policies
  crossOrigin?: {
    embedderPolicy: 'unsafe-none' | 'require-corp';
    openerPolicy: 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin';
    resourcePolicy: 'cross-origin' | 'same-site' | 'same-origin';
  };

  // Feature/Permissions Policy
  permissionsPolicy?: {
    [feature: string]: string[];
  };

  // Additional security headers
  additionalHeaders?: {
    [header: string]: string;
  };

  // Environment-specific overrides
  development?: Partial<SecurityHeadersConfig>;
  production?: Partial<SecurityHeadersConfig>;
}

export interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'child-src'?: string[];
  'worker-src'?: string[];
  'frame-src'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'base-uri'?: string[];
  'manifest-src'?: string[];
  'prefetch-src'?: string[];
  'navigate-to'?: string[];
  'report-uri'?: string[];
  'report-to'?: string[];
  'require-trusted-types-for'?: string[];
  'trusted-types'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
}

export interface SecurityContext {
  nonce?: string;
  requestId?: string;
  userAgent?: string;
  origin?: string;
  referer?: string;
}

/**
 * Enterprise security headers middleware service
 */
export class SecurityHeadersMiddleware {
  private readonly config: SecurityHeadersConfig;

  private readonly nonceCache = new Map<
    string,
    { nonce: string; expires: Date }
  >();

  constructor(config: SecurityHeadersConfig = {}) {
    this.config = this.mergeWithDefaults(config);
    this.setupNonceCleanup();
    logger.info('Security headers middleware initialized');
  }

  /**
   * Express middleware for setting security headers
   */
  middleware() {
    return (req: any, res: any, next: unknown) => {
      try {
        const context = this.extractSecurityContext(req);
        const headers = this.generateSecurityHeaders(context);

        // Set all security headers
        Object.entries(headers).forEach(([name, value]) => {
          if (value) {
            res.setHeader(name, value);
          }
        });

        // Store nonce in request for use in templates
        if (context.nonce) {
          req.cspNonce = context.nonce;
        }

        next();
      } catch (error: unknown) {
        logger.error('Security headers middleware error', error as Error);
        // Continue processing even if security headers fail
        next();
      }
    };
  }

  /**
   * Generate all security headers
   */
  generateSecurityHeaders(
    context: SecurityContext = {}
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    // Content Security Policy
    if (this.config.csp?.enabled) {
      const cspHeader = this.config.csp.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';

      headers[cspHeader] = this.buildCSP(context);
    }

    // HTTP Strict Transport Security
    if (this.config.hsts?.enabled) {
      headers['Strict-Transport-Security'] = this.buildHSTS();
    }

    // X-Frame-Options (fallback for older browsers)
    headers['X-Frame-Options'] = 'DENY';

    // X-Content-Type-Options
    headers['X-Content-Type-Options'] = 'nosniff';

    // X-XSS-Protection (for older browsers)
    headers['X-XSS-Protection'] = '1; mode=block';

    // Referrer Policy
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

    // Cross-Origin Policies
    if (this.config.crossOrigin) {
      headers['Cross-Origin-Embedder-Policy'] =
        this.config.crossOrigin.embedderPolicy;
      headers['Cross-Origin-Opener-Policy'] =
        this.config.crossOrigin.openerPolicy;
      headers['Cross-Origin-Resource-Policy'] =
        this.config.crossOrigin.resourcePolicy;
    }

    // Permissions Policy
    if (this.config.permissionsPolicy) {
      headers['Permissions-Policy'] = this.buildPermissionsPolicy();
    }

    // Additional custom headers
    if (this.config.additionalHeaders) {
      Object.assign(headers, this.config.additionalHeaders);
    }

    // Security-related headers for API protection
    headers['X-Permitted-Cross-Domain-Policies'] = 'none';
    headers['X-Download-Options'] = 'noopen';
    headers['X-DNS-Prefetch-Control'] = 'off';
    headers['Expect-CT'] = 'max-age=86400, enforce';

    return headers;
  }

  /**
   * Generate CSP nonce for inline scripts/styles
   */
  generateCSPNonce(requestId?: string): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    if (requestId) {
      this.nonceCache.set(requestId, { nonce, expires });
    }

    return nonce;
  }

  /**
   * Build Content Security Policy header
   */
  private buildCSP(context: SecurityContext): string {
    const directives = { ...this.getDefaultCSPDirectives() };

    // Merge with custom directives
    if (this.config.csp?.directives) {
      Object.assign(directives, this.config.csp.directives);
    }

    // Add nonce if enabled
    if (this.config.csp?.nonce && context.nonce) {
      const nonceValue = `'nonce-${context.nonce}'`;

      if (directives['script-src']) {
        directives['script-src'] = [...directives['script-src'], nonceValue];
      }

      if (directives['style-src']) {
        directives['style-src'] = [...directives['style-src'], nonceValue];
      }
    }

    // Build CSP string
    const cspParts: string[] = [];

    Object.entries(directives).forEach(([directive, sources]) => {
      if (typeof sources === 'boolean') {
        if (sources) {
          cspParts.push(directive);
        }
      } else if (Array.isArray(sources) && sources.length > 0) {
        cspParts.push(`${directive} ${sources.join(' ')}`);
      }
    });

    // Add report URI if configured
    if (this.config.csp?.reportUri) {
      cspParts.push(`report-uri ${this.config.csp.reportUri}`);
    }

    return cspParts.join('; ');
  }

  /**
   * Build HSTS header
   */
  private buildHSTS(): string {
    if (!this.config.hsts) return '';

    const parts = [`max-age=${this.config.hsts.maxAge}`];

    if (this.config.hsts.includeSubDomains) {
      parts.push('includeSubDomains');
    }

    if (this.config.hsts.preload) {
      parts.push('preload');
    }

    return parts.join('; ');
  }

  /**
   * Build Permissions Policy header
   */
  private buildPermissionsPolicy(): string {
    if (!this.config.permissionsPolicy) return '';

    const policies: string[] = [];

    Object.entries(this.config.permissionsPolicy).forEach(
      ([feature, allowlist]) => {
        if (allowlist.length === 0) {
          policies.push(`${feature}=()`);
        } else {
          const origins = allowlist
            .map(origin => (origin === '*' ? '*' : `"${origin}"`))
            .join(' ');
          policies.push(`${feature}=(${origins})`);
        }
      }
    );

    return policies.join(', ');
  }

  /**
   * Get default CSP directives
   */
  private getDefaultCSPDirectives(): CSPDirectives {
    return {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'strict-dynamic'",
        // Remove unsafe-inline and unsafe-eval for maximum security
      ],
      'style-src': [
        "'self'",
        'https://fonts.googleapis.com',
        // Only allow specific trusted sources
      ],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': [
        "'self'",
        'https://api.promptwizard.com',
        'wss://api.promptwizard.com',
      ],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'child-src': ["'none'"],
      'worker-src': ["'self'"],
      'frame-src': ["'none'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'manifest-src': ["'self'"],
      'upgrade-insecure-requests': true,
      'block-all-mixed-content': true,
      'require-trusted-types-for': ["'script'"],
      'trusted-types': ['default'],
    };
  }

  /**
   * Extract security context from request
   */
  private extractSecurityContext(req: unknown): SecurityContext {
    const context: SecurityContext = {};

    // Generate nonce if CSP nonce is enabled
    if (this.config.csp?.nonce) {
      context.nonce = this.generateCSPNonce(req.id || req.requestId);
    }

    // Extract request metadata
    context.requestId = req.id || req.requestId;
    context.userAgent = req.get('User-Agent');
    context.origin = req.get('Origin');
    context.referer = req.get('Referer');

    return context;
  }

  /**
   * Merge configuration with secure defaults
   */
  private mergeWithDefaults(
    config: SecurityHeadersConfig
  ): SecurityHeadersConfig {
    const environment = NODE_ENV.$2 || 'development';

    const defaults: SecurityHeadersConfig = {
      csp: {
        enabled: true,
        reportOnly: environment === 'development',
        nonce: true,
        reportUri: CSP_REPORT_URI.$2 || '/api/csp-report',
      },
      hsts: {
        enabled: environment === 'production',
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      crossOrigin: {
        embedderPolicy: 'require-corp',
        openerPolicy: 'same-origin',
        resourcePolicy: 'same-origin',
      },
      permissionsPolicy: {
        geolocation: [],
        microphone: [],
        camera: [],
        payment: [],
        usb: [],
        magnetometer: [],
        accelerometer: [],
        gyroscope: [],
        'picture-in-picture': [],
        fullscreen: ['self'],
        'display-capture': [],
      },
    };

    // Deep merge configuration
    const merged = this.deepMerge(defaults, config);

    // Apply environment-specific overrides
    if (environment === 'development' && merged.development) {
      return this.deepMerge(merged, merged.development);
    }
    if (environment === 'production' && merged.production) {
      return this.deepMerge(merged, merged.production);
    }

    return merged;
  }

  /**
   * Deep merge configuration objects
   */
  private deepMerge(target: any, source: unknown): unknown {
    const result = { ...target };

    Object.keys(source).forEach(key => {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  }

  /**
   * Setup nonce cache cleanup
   */
  private setupNonceCleanup(): void {
    // Clean expired nonces every 10 minutes
    setInterval(
      () => {
        const now = new Date();
        for (const [requestId, { expires }] of this.nonceCache.entries()) {
          if (expires < now) {
            this.nonceCache.delete(requestId);
          }
        }
      },
      10 * 60 * 1000
    );
  }

  /**
   * Get security headers statistics
   */
  getStats() {
    return {
      config: {
        cspEnabled: this.config.csp?.enabled,
        hstsEnabled: this.config.hsts?.enabled,
        nonceEnabled: this.config.csp?.nonce,
        reportOnly: this.config.csp?.reportOnly,
      },
      runtime: {
        activenonces: this.nonceCache.size,
        environment: NODE_ENV.$2 || 'development',
      },
      headers: Object.keys(this.generateSecurityHeaders()).length,
    };
  }
}

/**
 * CSP report endpoint handler
 */
export function cspReportHandler() {
  return (req: any, res: unknown) => {
    try {
      const report = req.body;
      logger.warn('CSP Violation Report', {
        report,
        userAgent: req.get('User-Agent'),
        origin: req.get('Origin'),
        timestamp: new Date().toISOString(),
      });

      res.status(204).send();
    } catch (error: unknown) {
      logger.error('CSP report handler error', error as Error);
      res.status(400).json({ error: 'Invalid report format' });
    }
  };
}

/**
 * Security headers testing utility
 */
export function testSecurityHeaders(_url: string): Promise<{
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  headers: Record<string, string>;
  missing: string[];
  issues: string[];
}> {
  return new Promise(resolve => {
    // This is a simplified implementation
    // In a real scenario, you'd make an HTTP request and analyze headers

    const mockHeaders: Record<string, string> = {
      'Content-Security-Policy': "default-src 'self'",
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
    };

    const requiredHeaders = [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'X-XSS-Protection',
      'Referrer-Policy',
    ];

    const missing = requiredHeaders.filter(header => !mockHeaders[header]);
    const grade = missing.length === 0 ? 'A+' : missing.length <= 2 ? 'A' : 'B';

    resolve({
      grade,
      headers: mockHeaders,
      missing,
      issues: [],
    });
  });
}

/**
 * Global security headers middleware instance
 */
export const securityHeadersMiddleware = new SecurityHeadersMiddleware();

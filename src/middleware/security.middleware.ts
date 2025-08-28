/**
 * @fileoverview Security middleware for data protection and secure headers
 * @lastmodified 2025-08-27T15:45:00Z
 *
 * Features: Encryption at rest, secure headers, CSP, secrets management
 * Main APIs: encryptData(), decryptData(), setSecureHeaders(), createCSP()
 * Constraints: Requires ENCRYPTION_KEY environment variable
 * Patterns: Middleware pattern, encryption, security headers, CSP directives
 */

import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface SecurityConfig {
  encryptionKey?: string;
  algorithm?: string;
  keyDerivationIterations?: number;
  enableCSP?: boolean;
  cspDirectives?: Record<string, string[]>;
  enableHSTS?: boolean;
  hstsMaxAge?: number;
}

export interface EncryptedData {
  data: string;
  iv: string;
  authTag: string;
  salt: string;
}

/**
 * Security service for data protection and secure headers
 */
export class SecurityService {
  private encryptionKey: Buffer;

  private algorithm: string;

  private keyDerivationIterations: number;

  constructor(config: SecurityConfig = {}) {
    this.algorithm = config.algorithm || 'aes-256-gcm';
    this.keyDerivationIterations = config.keyDerivationIterations || 100000;

    const keyString =
      config.encryptionKey ||
      process.env.ENCRYPTION_KEY ||
      'default-dev-key-not-secure';
    this.encryptionKey = crypto.scryptSync(keyString, 'salt', 32);

    if (keyString === 'default-dev-key-not-secure') {
      logger.warn('Using default encryption key - not secure for production');
    }
  }

  /**
   * Encrypt sensitive data for storage using AEAD (Authenticated Encryption with Associated Data)
   */
  encryptData(plaintext: string): EncryptedData {
    try {
      const iv = crypto.randomBytes(16); // 128-bit IV for AES-GCM
      const salt = crypto.randomBytes(32); // 256-bit salt
      const key = crypto.scryptSync(this.encryptionKey, salt, 32);

      // Use createCipherGCM instead of deprecated createCipher
      const cipher = crypto.createCipherGCM(this.algorithm, key, iv);
      cipher.setAAD(Buffer.from('encrypted-data'));

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return {
        data: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        salt: salt.toString('hex'),
      };
    } catch (error) {
      logger.error('Encryption failed', error as Error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt stored sensitive data using AEAD (Authenticated Encryption with Associated Data)
   */
  decryptData(encryptedData: EncryptedData): string {
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      const key = crypto.scryptSync(this.encryptionKey, salt, 32);

      // Use createDecipherGCM instead of deprecated createDecipher
      const decipher = crypto.createDecipherGCM(this.algorithm, key, iv);
      decipher.setAAD(Buffer.from('encrypted-data'));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', error as Error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash password with salt
   */
  hashPassword(
    password: string,
    salt?: string
  ): { hash: string; salt: string } {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(32);
    const hash = crypto.pbkdf2Sync(
      password,
      saltBuffer,
      this.keyDerivationIterations,
      64,
      'sha512'
    );

    return {
      hash: hash.toString('hex'),
      salt: saltBuffer.toString('hex'),
    };
  }

  /**
   * Verify password against hash
   */
  verifyPassword(password: string, storedHash: string, salt: string): boolean {
    const { hash } = this.hashPassword(password, salt);
    return crypto.timingSafeEqual(
      Buffer.from(storedHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  /**
   * Set secure HTTP headers
   */
  getSecureHeaders(
    config: {
      enableHSTS?: boolean;
      hstsMaxAge?: number;
      enableCSP?: boolean;
      cspDirectives?: Record<string, string[]>;
      enableXFrameOptions?: boolean;
      enableXContentTypeOptions?: boolean;
      enableReferrerPolicy?: boolean;
    } = {}
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    // Strict Transport Security
    if (config.enableHSTS !== false) {
      const maxAge = config.hstsMaxAge || 31536000; // 1 year
      headers['Strict-Transport-Security'] =
        `max-age=${maxAge}; includeSubDomains; preload`;
    }

    // Content Security Policy
    if (config.enableCSP !== false) {
      const csp = this.buildCSP(config.cspDirectives);
      headers['Content-Security-Policy'] = csp;
    }

    // X-Frame-Options
    if (config.enableXFrameOptions !== false) {
      headers['X-Frame-Options'] = 'DENY';
    }

    // X-Content-Type-Options
    if (config.enableXContentTypeOptions !== false) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    // X-XSS-Protection
    headers['X-XSS-Protection'] = '1; mode=block';

    // Referrer Policy
    if (config.enableReferrerPolicy !== false) {
      headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
    }

    // Permissions Policy (formerly Feature Policy)
    headers['Permissions-Policy'] = [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'fullscreen=(self)',
      'payment=()',
    ].join(', ');

    return headers;
  }

  /**
   * Build Content Security Policy header value with strict security
   */
  private buildCSP(customDirectives?: Record<string, string[]>): string {
    // Generate a nonce for inline scripts (should be passed from request context)
    const nonce = crypto.randomBytes(16).toString('base64');

    const defaultDirectives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        // Remove unsafe-inline and unsafe-eval for security
      ],
      'style-src': [
        "'self'",
        `'nonce-${nonce}'`,
        'https://fonts.googleapis.com',
        // Only allow hashed styles, no unsafe-inline
      ],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'blob:', 'https:'],
      'connect-src': [
        "'self'",
        'https://api.promptwizard.com',
        'wss://api.promptwizard.com',
      ],
      'frame-src': ["'none'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'worker-src': ["'self'"],
      'manifest-src': ["'self'"],
      'media-src': ["'self'"],
      'child-src': ["'none'"],
      'upgrade-insecure-requests': [],
      'block-all-mixed-content': [],
      'trusted-types': ['default'],
      'require-trusted-types-for': ["'script'"],
    };

    const directives = { ...defaultDirectives, ...customDirectives };

    return Object.entries(directives)
      .map(([directive, sources]) =>
        sources.length > 0 ? `${directive} ${sources.join(' ')}` : directive
      )
      .join('; ');
  }

  /**
   * Sanitize file upload
   */
  sanitizeFileUpload(
    filename: string,
    content: Buffer,
    allowedTypes: string[]
  ): {
    safe: boolean;
    sanitizedFilename?: string;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check filename
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      issues.push('Filename contains path traversal characters');
    }

    if (filename.length > 255) {
      issues.push('Filename too long');
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      issues.push('Filename contains unsafe characters');
    }

    // Check file extension
    const extension = filename.split('.').pop()?.toLowerCase();
    if (!extension || !allowedTypes.includes(extension)) {
      issues.push(`File type .${extension} not allowed`);
    }

    // Check for embedded executable content
    const contentStr = content.toString(
      'utf8',
      0,
      Math.min(content.length, 1024)
    );
    if (/<%|<script|javascript:|data:/i.test(contentStr)) {
      issues.push('File contains potentially executable content');
    }

    // Check file size (example: 10MB limit)
    if (content.length > 10 * 1024 * 1024) {
      issues.push('File too large (max 10MB)');
    }

    // Sanitize filename
    const sanitizedFilename = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 255);

    return {
      safe: issues.length === 0,
      sanitizedFilename,
      issues,
    };
  }

  /**
   * Rate limiting with sliding window
   */
  createRateLimiter(windowMs: number, maxRequests: number) {
    const requests = new Map<string, number[]>();

    return {
      isAllowed: (
        identifier: string
      ): { allowed: boolean; retryAfter?: number } => {
        const now = Date.now();
        const userRequests = requests.get(identifier) || [];

        // Remove expired requests
        const validRequests = userRequests.filter(
          time => now - time < windowMs
        );

        if (validRequests.length >= maxRequests) {
          const oldestRequest = Math.min(...validRequests);
          const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
          return { allowed: false, retryAfter };
        }

        validRequests.push(now);
        requests.set(identifier, validRequests);

        return { allowed: true };
      },

      reset: (identifier: string): void => {
        requests.delete(identifier);
      },

      getStats: () => ({
        totalClients: requests.size,
        requests: Array.from(requests.entries()).map(([id, times]) => ({
          identifier: id,
          requestCount: times.length,
          lastRequest: Math.max(...times),
        })),
      }),
    };
  }

  /**
   * Input sanitization for different contexts
   */
  sanitizeInput(
    input: string,
    context: 'html' | 'sql' | 'javascript' | 'shell'
  ): string {
    switch (context) {
      case 'html':
        return input
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;');

      case 'sql':
        return input.replace(/'/g, "''").replace(/"/g, '""');

      case 'javascript':
        return input
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');

      case 'shell':
        return input.replace(/[;&|`$(){}[\]<>]/g, '\\$&');

      default:
        return input;
    }
  }

  /**
   * Generate integrity hash for files
   */
  generateIntegrityHash(content: string | Buffer): string {
    const hash = crypto.createHash('sha384');
    hash.update(content);
    return `sha384-${hash.digest('base64')}`;
  }

  /**
   * Verify file integrity
   */
  verifyIntegrity(content: string | Buffer, expectedHash: string): boolean {
    const actualHash = this.generateIntegrityHash(content);
    return crypto.timingSafeEqual(
      Buffer.from(actualHash),
      Buffer.from(expectedHash)
    );
  }
}

/**
 * Global security service instance
 */
export const securityService = new SecurityService();

/**
 * Middleware to set secure headers
 */
export function setSecureHeaders(config?: {
  enableHSTS?: boolean;
  hstsMaxAge?: number;
  enableCSP?: boolean;
  cspDirectives?: Record<string, string[]>;
}) {
  const headers = securityService.getSecureHeaders(config);

  return (request: { headers?: Record<string, string> }) => ({
    ...request,
    securityHeaders: headers,
  });
}

/**
 * Middleware for file upload security
 */
export function secureFileUpload(
  allowedTypes: string[],
  maxSizeBytes: number = 10 * 1024 * 1024
) {
  return (request: {
    filename?: string;
    fileContent?: Buffer;
    uploadSafe?: boolean;
    uploadIssues?: string[];
  }) => {
    if (!request.filename || !request.fileContent) {
      return request;
    }

    const result = securityService.sanitizeFileUpload(
      request.filename,
      request.fileContent,
      allowedTypes
    );

    return {
      ...request,
      filename: result.sanitizedFilename || request.filename,
      uploadSafe: result.safe,
      uploadIssues: result.issues,
    };
  };
}

/**
 * Secrets management utilities
 */
export class SecretsManager {
  private secrets = new Map<string, EncryptedData>();

  /**
   * Store encrypted secret
   */
  setSecret(key: string, value: string): void {
    const encrypted = securityService.encryptData(value);
    this.secrets.set(key, encrypted);
    logger.info(`Secret stored: ${key}`);
  }

  /**
   * Retrieve decrypted secret
   */
  getSecret(key: string): string | null {
    const encrypted = this.secrets.get(key);
    if (!encrypted) {
      return null;
    }

    try {
      return securityService.decryptData(encrypted);
    } catch (error) {
      logger.error(`Failed to decrypt secret: ${key}`, error as Error);
      return null;
    }
  }

  /**
   * Remove secret
   */
  deleteSecret(key: string): boolean {
    const existed = this.secrets.has(key);
    this.secrets.delete(key);
    if (existed) {
      logger.info(`Secret deleted: ${key}`);
    }
    return existed;
  }

  /**
   * List available secret keys (not values)
   */
  listSecrets(): string[] {
    return Array.from(this.secrets.keys());
  }

  /**
   * Rotate secret with new value
   */
  rotateSecret(key: string, newValue: string): boolean {
    if (!this.secrets.has(key)) {
      return false;
    }

    this.setSecret(key, newValue);
    logger.info(`Secret rotated: ${key}`);
    return true;
  }
}

/**
 * Global secrets manager instance
 */
export const secretsManager = new SecretsManager();

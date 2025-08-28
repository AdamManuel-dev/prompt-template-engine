/**
 * @fileoverview Cryptographic utilities for password hashing and security
 * @lastmodified 2025-01-08T21:00:00Z
 * 
 * Features: Password hashing, verification, token generation, encryption
 * Main APIs: hashPassword(), verifyPassword(), generateSecureToken()
 * Constraints: bcrypt rounds=12, secure random generation
 * Patterns: All async operations, timing-safe comparisons
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Configuration
const BCRYPT_ROUNDS = 12; // High security level
const TOKEN_LENGTH = 32; // 256-bit tokens

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error('Password is required');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    // Log error but don't expose details
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Generate cryptographically secure random token
 */
export function generateSecureToken(length: number = TOKEN_LENGTH): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate email verification token
 */
export function generateEmailVerificationToken(): string {
  return generateSecureToken(32); // 64 character hex string
}

/**
 * Generate password reset token with expiry
 */
export function generatePasswordResetToken(): { token: string; expiresAt: Date } {
  return {
    token: generateSecureToken(32),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
  };
}

/**
 * Generate 2FA secret for TOTP
 */
export function generate2FASecret(): string {
  // Generate 32 character base32 encoded secret
  const buffer = crypto.randomBytes(20);
  return buffer.toString('base32');
}

/**
 * Hash data for secure comparison (e.g., for session tokens)
 */
export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Create HMAC for data integrity
 */
export function createHMAC(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Verify HMAC
 */
export function verifyHMAC(data: string, signature: string, secret: string): boolean {
  const expectedSignature = createHMAC(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

/**
 * Encrypt sensitive data (for OAuth tokens, etc.)
 */
export function encryptData(text: string, key?: string): string {
  const encryptionKey = key || process.env['ENCRYPTION_KEY'] || 'default-key-change-in-production';
  
  if (encryptionKey.length < 32) {
    throw new Error('Encryption key must be at least 32 characters');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-cbc', encryptionKey);
  cipher.setAutoPadding(true);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data
 */
export function decryptData(encryptedText: string, key?: string): string {
  const encryptionKey = key || process.env['ENCRYPTION_KEY'] || 'default-key-change-in-production';
  
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = parts[1];
  
  const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
  suggestions: string[];
} {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const metRequirements = Object.values(requirements).filter(Boolean).length;
  const score = Math.min(metRequirements * 20, 100);

  const suggestions: string[] = [];
  if (!requirements.length) suggestions.push('Use at least 8 characters');
  if (!requirements.uppercase) suggestions.push('Add uppercase letters');
  if (!requirements.lowercase) suggestions.push('Add lowercase letters');
  if (!requirements.number) suggestions.push('Add numbers');
  if (!requirements.special) suggestions.push('Add special characters');

  return {
    isValid: metRequirements >= 4, // Require at least 4/5 criteria
    score,
    requirements,
    suggestions,
  };
}

/**
 * Generate device fingerprint from request
 */
export function generateDeviceFingerprint(userAgent: string, ip: string): string {
  const data = `${userAgent}:${ip}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

/**
 * Rate limiting token bucket for user actions
 */
export class RateLimitBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;

  constructor(capacity: number = 10, refillRate: number = 1) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}
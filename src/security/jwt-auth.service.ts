/**
 * @fileoverview JWT-based authentication service with role claims and security controls
 * @lastmodified 2025-08-27T16:00:00Z
 *
 * Features: JWT creation/verification, role claims, token refresh, security controls
 * Main APIs: generateToken(), verifyToken(), refreshToken(), revokeToken()
 * Constraints: Requires JWT_SECRET environment variable, implements security best practices
 * Patterns: JWT authentication, role-based claims, token lifecycle management
 */

import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface JWTPayload {
  sub: string; // User ID
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;
  aud: string;
  iss: string;
  jti: string; // JWT ID for tracking
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface TokenVerificationResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
  expired?: boolean;
  revoked?: boolean;
}

export interface JWTAuthConfig {
  jwtSecret: string;
  accessTokenExpiry: string | number;
  refreshTokenExpiry: string | number;
  issuer: string;
  audience: string;
  algorithm: jwt.Algorithm;
  enableTokenRevocation: boolean;
  maxTokensPerUser: number;
}

/**
 * JWT Authentication Service with comprehensive security features
 */
export class JWTAuthService {
  private config: JWTAuthConfig;
  private revokedTokens = new Set<string>(); // In production, use Redis
  private activeTokens = new Map<string, Set<string>>(); // userId -> Set of JTIs
  private refreshTokens = new Map<string, {
    userId: string;
    jti: string;
    createdAt: Date;
    expiresAt: Date;
    deviceFingerprint?: string;
  }>();

  constructor(config: Partial<JWTAuthConfig> = {}) {
    this.config = {
      jwtSecret: config.jwtSecret || process.env.JWT_SECRET || this.generateSecureSecret(),
      accessTokenExpiry: config.accessTokenExpiry || '15m',
      refreshTokenExpiry: config.refreshTokenExpiry || '7d',
      issuer: config.issuer || 'cursor-prompt-template-engine',
      audience: config.audience || 'cursor-prompt-users',
      algorithm: config.algorithm || 'HS256',
      enableTokenRevocation: config.enableTokenRevocation ?? true,
      maxTokensPerUser: config.maxTokensPerUser || 5,
    };

    if (!process.env.JWT_SECRET && !config.jwtSecret) {
      logger.warn('No JWT secret provided, using generated secret (not suitable for production)');
    }

    // Cleanup expired tokens periodically
    setInterval(() => this.cleanupExpiredTokens(), 60000); // Every minute
  }

  /**
   * Generate JWT token pair with role claims
   */
  async generateTokenPair(
    user: {
      id: string;
      username: string;
      email: string;
      roles: string[];
      permissions: string[];
    },
    sessionId: string,
    deviceFingerprint?: string
  ): Promise<TokenPair> {
    try {
      // Limit active tokens per user
      await this.enforceTokenLimit(user.id);

      const jti = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      // Access token payload
      const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
        sub: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        permissions: user.permissions,
        sessionId,
        aud: this.config.audience,
        iss: this.config.issuer,
        jti,
      };

      // Generate access token
      const accessToken = jwt.sign(payload, this.config.jwtSecret, {
        expiresIn: this.config.accessTokenExpiry,
        algorithm: this.config.algorithm,
      });

      // Generate refresh token
      const refreshJti = crypto.randomUUID();
      const refreshToken = jwt.sign(
        {
          sub: user.id,
          type: 'refresh',
          jti: refreshJti,
          sessionId,
        },
        this.config.jwtSecret,
        {
          expiresIn: this.config.refreshTokenExpiry,
          algorithm: this.config.algorithm,
        }
      );

      // Store refresh token metadata
      const refreshExpiry = new Date();
      if (typeof this.config.refreshTokenExpiry === 'string') {
        refreshExpiry.setTime(refreshExpiry.getTime() + this.parseTimeToMs(this.config.refreshTokenExpiry));
      } else {
        refreshExpiry.setTime(refreshExpiry.getTime() + this.config.refreshTokenExpiry);
      }

      this.refreshTokens.set(refreshJti, {
        userId: user.id,
        jti: refreshJti,
        createdAt: new Date(),
        expiresAt: refreshExpiry,
        deviceFingerprint,
      });

      // Track active token
      if (!this.activeTokens.has(user.id)) {
        this.activeTokens.set(user.id, new Set());
      }
      this.activeTokens.get(user.id)!.add(jti);

      // Calculate expiry time
      const accessTokenDecoded = jwt.decode(accessToken) as jwt.JwtPayload;
      const expiresIn = accessTokenDecoded.exp! - now;

      logger.info(`JWT token pair generated for user ${user.id}`, {
        userId: user.id,
        sessionId,
        jti,
        expiresIn,
      });

      return {
        accessToken,
        refreshToken,
        expiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      logger.error('Failed to generate JWT token pair', error as Error);
      throw new Error('Token generation failed');
    }
  }

  /**
   * Verify JWT token with comprehensive validation
   */
  async verifyToken(token: string): Promise<TokenVerificationResult> {
    try {
      // Check if token is revoked (if revocation is enabled)
      if (this.config.enableTokenRevocation) {
        const decoded = jwt.decode(token) as jwt.JwtPayload;
        if (decoded?.jti && this.revokedTokens.has(decoded.jti)) {
          return {
            valid: false,
            revoked: true,
            error: 'Token has been revoked',
          };
        }
      }

      // Verify token signature and claims
      const payload = jwt.verify(token, this.config.jwtSecret, {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: this.config.audience,
      }) as JWTPayload;

      // Additional security validations
      if (!payload.sub || !payload.jti || !payload.sessionId) {
        return {
          valid: false,
          error: 'Token missing required claims',
        };
      }

      // Check if token is in active tokens list
      if (this.config.enableTokenRevocation) {
        const userTokens = this.activeTokens.get(payload.sub);
        if (!userTokens || !userTokens.has(payload.jti)) {
          return {
            valid: false,
            error: 'Token not in active tokens list',
          };
        }
      }

      logger.debug('JWT token verified successfully', {
        userId: payload.sub,
        sessionId: payload.sessionId,
        jti: payload.jti,
      });

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          expired: true,
          error: 'Token has expired',
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: `Invalid token: ${error.message}`,
        };
      }

      logger.error('Token verification failed', error as Error);
      return {
        valid: false,
        error: 'Token verification failed',
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    deviceFingerprint?: string
  ): Promise<TokenPair | null> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.config.jwtSecret, {
        algorithms: [this.config.algorithm],
      }) as jwt.JwtPayload & { type: string; sessionId: string };

      if (payload.type !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }

      // Check refresh token metadata
      const refreshData = this.refreshTokens.get(payload.jti!);
      if (!refreshData) {
        throw new Error('Refresh token not found');
      }

      if (refreshData.expiresAt < new Date()) {
        this.refreshTokens.delete(payload.jti!);
        throw new Error('Refresh token expired');
      }

      // Validate device fingerprint if provided
      if (deviceFingerprint && refreshData.deviceFingerprint) {
        if (refreshData.deviceFingerprint !== deviceFingerprint) {
          logger.warn('Device fingerprint mismatch during token refresh', {
            userId: payload.sub,
            expected: refreshData.deviceFingerprint,
            provided: deviceFingerprint,
          });
          throw new Error('Device fingerprint mismatch');
        }
      }

      // Get user data (in production, fetch from database)
      const userData = await this.getUserData(payload.sub!);
      if (!userData) {
        throw new Error('User not found');
      }

      // Revoke old refresh token
      this.refreshTokens.delete(payload.jti!);

      // Generate new token pair
      const newTokenPair = await this.generateTokenPair(
        userData,
        payload.sessionId,
        deviceFingerprint
      );

      logger.info('Access token refreshed successfully', {
        userId: payload.sub,
        sessionId: payload.sessionId,
      });

      return newTokenPair;
    } catch (error) {
      logger.error('Token refresh failed', error as Error);
      return null;
    }
  }

  /**
   * Revoke token(s) for security purposes
   */
  async revokeToken(
    token: string,
    reason: 'logout' | 'security' | 'admin' | 'expired' = 'logout'
  ): Promise<boolean> {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      if (!decoded?.jti) {
        return false;
      }

      // Add to revoked tokens list
      this.revokedTokens.add(decoded.jti);

      // Remove from active tokens
      if (decoded.sub) {
        const userTokens = this.activeTokens.get(decoded.sub);
        if (userTokens) {
          userTokens.delete(decoded.jti);
          if (userTokens.size === 0) {
            this.activeTokens.delete(decoded.sub);
          }
        }
      }

      logger.info('Token revoked', {
        jti: decoded.jti,
        userId: decoded.sub,
        reason,
      });

      return true;
    } catch (error) {
      logger.error('Token revocation failed', error as Error);
      return false;
    }
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllUserTokens(
    userId: string,
    reason: 'security' | 'admin' | 'user-request' = 'security'
  ): Promise<number> {
    let revokedCount = 0;

    // Revoke access tokens
    const userTokens = this.activeTokens.get(userId);
    if (userTokens) {
      for (const jti of userTokens) {
        this.revokedTokens.add(jti);
        revokedCount++;
      }
      this.activeTokens.delete(userId);
    }

    // Revoke refresh tokens
    for (const [jti, refreshData] of this.refreshTokens) {
      if (refreshData.userId === userId) {
        this.refreshTokens.delete(jti);
        revokedCount++;
      }
    }

    logger.info(`All tokens revoked for user`, {
      userId,
      count: revokedCount,
      reason,
    });

    return revokedCount;
  }

  /**
   * Get user's active tokens information
   */
  getUserActiveTokens(userId: string): {
    accessTokens: number;
    refreshTokens: number;
    totalTokens: number;
  } {
    const accessTokens = this.activeTokens.get(userId)?.size || 0;
    const refreshTokens = Array.from(this.refreshTokens.values())
      .filter(token => token.userId === userId).length;

    return {
      accessTokens,
      refreshTokens,
      totalTokens: accessTokens + refreshTokens,
    };
  }

  /**
   * Extract role claims from token
   */
  extractRoleClaims(token: string): {
    roles: string[];
    permissions: string[];
  } | null {
    try {
      const payload = jwt.decode(token) as JWTPayload;
      return {
        roles: payload.roles || [],
        permissions: payload.permissions || [],
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Private helper methods
   */
  private async enforceTokenLimit(userId: string): Promise<void> {
    const userTokens = this.activeTokens.get(userId);
    if (userTokens && userTokens.size >= this.config.maxTokensPerUser) {
      // Remove oldest token (implement LRU if needed)
      const oldestToken = Array.from(userTokens)[0];
      this.revokedTokens.add(oldestToken);
      userTokens.delete(oldestToken);
      
      logger.info('Token limit enforced, oldest token revoked', {
        userId,
        revokedToken: oldestToken,
        limit: this.config.maxTokensPerUser,
      });
    }
  }

  private generateSecureSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private parseTimeToMs(timeStr: string): number {
    const units: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    const match = timeStr.match(/^(\d+)([a-z]+)$/);
    if (!match) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    if (!units[unit]) {
      throw new Error(`Unknown time unit: ${unit}`);
    }

    return value * units[unit];
  }

  private async getUserData(userId: string): Promise<{
    id: string;
    username: string;
    email: string;
    roles: string[];
    permissions: string[];
  } | null> {
    // In production, fetch from database
    // This is a mock implementation
    return {
      id: userId,
      username: 'user',
      email: 'user@example.com',
      roles: ['user'],
      permissions: ['templates:read'],
    };
  }

  private cleanupExpiredTokens(): void {
    // Clean up expired refresh tokens
    const now = new Date();
    for (const [jti, tokenData] of this.refreshTokens) {
      if (tokenData.expiresAt < now) {
        this.refreshTokens.delete(jti);
      }
    }

    // Clean up old revoked tokens (keep for 24 hours)
    // In production, this should be handled by the storage layer
    if (this.revokedTokens.size > 10000) {
      // Simple cleanup: clear all if too many
      this.revokedTokens.clear();
      logger.warn('Revoked tokens cache cleared due to size limit');
    }
  }

  /**
   * Get service statistics
   */
  getServiceStats(): {
    activeUsers: number;
    totalActiveTokens: number;
    totalRefreshTokens: number;
    revokedTokens: number;
  } {
    return {
      activeUsers: this.activeTokens.size,
      totalActiveTokens: Array.from(this.activeTokens.values())
        .reduce((sum, tokens) => sum + tokens.size, 0),
      totalRefreshTokens: this.refreshTokens.size,
      revokedTokens: this.revokedTokens.size,
    };
  }
}

/**
 * Global JWT authentication service instance
 */
export const jwtAuthService = new JWTAuthService();

/**
 * JWT middleware for token validation
 */
export function createJWTMiddleware() {
  return async (request: {
    headers?: Record<string, string>;
    user?: any;
    tokenInfo?: TokenVerificationResult;
  }) => {
    const authHeader = request.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const verification = await jwtAuthService.verifyToken(token);

    if (!verification.valid) {
      throw new Error(verification.error || 'Token verification failed');
    }

    return {
      ...request,
      user: verification.payload,
      tokenInfo: verification,
    };
  };
}
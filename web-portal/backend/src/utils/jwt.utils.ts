/**
 * @fileoverview JWT utilities for token generation, validation, and management
 * @lastmodified 2025-01-08T21:00:00Z
 * 
 * Features: JWT creation/verification, token blacklisting, refresh tokens
 * Main APIs: generateTokens(), verifyToken(), revokeToken(), refreshTokens()
 * Constraints: Requires JWT_SECRET, 24h access + 7d refresh token expiry
 * Patterns: All throw AuthError, includes JTI for token tracking
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../db/prisma-client';

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
  jti: string; // JWT ID for token tracking
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface RefreshTokenPayload {
  userId: string;
  jti: string;
  type: 'refresh';
}

// Token configuration
const ACCESS_TOKEN_EXPIRY = '24h'; // 24 hours
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.warn('JWT secrets not configured properly. Using default values for development.');
}

/**
 * Generate access and refresh token pair
 */
export async function generateTokens(user: {
  id: string;
  email: string;
  username: string;
  role: string;
}): Promise<TokenPair> {
  const jti = crypto.randomUUID();
  const now = new Date();
  const accessExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  const refreshExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Access token payload
  const accessPayload: TokenPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    jti,
  };

  // Refresh token payload (minimal data)
  const refreshPayload: RefreshTokenPayload = {
    userId: user.id,
    jti,
    type: 'refresh',
  };

  // Generate tokens
  const accessToken = jwt.sign(accessPayload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'cursor-prompt-portal',
    audience: 'cursor-prompt-users',
  });

  const refreshToken = jwt.sign(refreshPayload, REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'cursor-prompt-portal',
    audience: 'cursor-prompt-users',
  });

  // Store session in database
  const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
  
  await prisma.session.create({
    data: {
      userId: user.id,
      jti,
      tokenHash,
      refreshToken,
      expiresAt: accessExpiresAt,
      refreshExpiresAt,
      isActive: true,
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: 24 * 60 * 60, // 24 hours in seconds
    refreshExpiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
  };
}

/**
 * Verify access token and return payload
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: 'cursor-prompt-portal',
      audience: 'cursor-prompt-users',
    }) as TokenPayload;

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('TOKEN_EXPIRED');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('TOKEN_INVALID');
    }
    throw new Error('TOKEN_VERIFICATION_FAILED');
  }
}

/**
 * Verify refresh token and return payload
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const payload = jwt.verify(token, REFRESH_SECRET, {
      issuer: 'cursor-prompt-portal',
      audience: 'cursor-prompt-users',
    }) as RefreshTokenPayload;

    if (payload.type !== 'refresh') {
      throw new Error('INVALID_TOKEN_TYPE');
    }

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('REFRESH_TOKEN_EXPIRED');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('REFRESH_TOKEN_INVALID');
    }
    throw new Error('REFRESH_TOKEN_VERIFICATION_FAILED');
  }
}

/**
 * Check if token is revoked by checking session status
 */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { jti },
    select: { isActive: true, revokedAt: true },
  });

  return !session || !session.isActive || session.revokedAt !== null;
}

/**
 * Revoke token by JTI
 */
export async function revokeToken(jti: string, reason: string = 'logout'): Promise<void> {
  await prisma.session.updateMany({
    where: { jti, isActive: true },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });
}

/**
 * Revoke all sessions for a user
 */
export async function revokeAllUserTokens(userId: string, reason: string = 'security'): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, isActive: true },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedReason: reason,
    },
  });
}

/**
 * Refresh token pair using refresh token
 */
export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  // Verify refresh token
  const refreshPayload = verifyRefreshToken(refreshToken);
  
  // Check if session exists and is active
  const session = await prisma.session.findFirst({
    where: {
      jti: refreshPayload.jti,
      refreshToken,
      isActive: true,
      refreshExpiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!session) {
    throw new Error('REFRESH_TOKEN_INVALID_OR_EXPIRED');
  }

  // Revoke old session
  await revokeToken(session.jti, 'refresh');

  // Generate new token pair
  return generateTokens({
    id: session.user.id,
    email: session.user.email,
    username: session.user.username,
    role: session.user.role,
  });
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { refreshExpiresAt: { lt: new Date() } },
      ],
      isActive: true,
    },
    data: {
      isActive: false,
      revokedAt: new Date(),
      revokedReason: 'expired',
    },
  });

  return result.count;
}

/**
 * Get user sessions with basic info
 */
export async function getUserSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, isActive: true },
    select: {
      id: true,
      jti: true,
      ipAddress: true,
      userAgent: true,
      deviceFingerprint: true,
      createdAt: true,
      lastAccessedAt: true,
      expiresAt: true,
    },
    orderBy: { lastAccessedAt: 'desc' },
  });
}

/**
 * Update session last accessed time
 */
export async function updateSessionAccess(jti: string, ipAddress?: string): Promise<void> {
  await prisma.session.updateMany({
    where: { jti, isActive: true },
    data: {
      lastAccessedAt: new Date(),
      ...(ipAddress && { ipAddress }),
    },
  });
}
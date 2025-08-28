/**
 * @fileoverview Authentication middleware for JWT validation and user context
 * @lastmodified 2025-01-08T21:00:00Z
 * 
 * Features: JWT validation, token revocation checking, user context injection
 * Main APIs: authenticateToken, optionalAuth, requireAuth
 * Constraints: Validates JTI against database, updates session access time
 * Patterns: Express middleware pattern, proper error handling
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, isTokenRevoked, updateSessionAccess } from '../utils/jwt.utils';
import { prisma } from '../db/prisma-client';
import { UserRole } from '../generated/prisma';

// Define JWT user interface
export interface JWTUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  jti: string;
}

// Extend Express Request type to include JWT user
declare module 'express-serve-static-core' {
  interface Request {
    jwtUser?: JWTUser;
  }
}

export interface AuthenticatedRequest extends Request {
  jwtUser: JWTUser;
}

/**
 * Extract token from Authorization header
 */
function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Main authentication middleware
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({
        error: 'ACCESS_TOKEN_REQUIRED',
        message: 'Access token is required',
      });
      return;
    }

    // Verify JWT token
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'TOKEN_INVALID';
      
      if (errorMessage === 'TOKEN_EXPIRED') {
        res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Access token has expired',
        });
      } else {
        res.status(401).json({
          error: 'TOKEN_INVALID',
          message: 'Invalid access token',
        });
      }
      return;
    }

    // Check if token is revoked
    const revoked = await isTokenRevoked(payload.jti);
    if (revoked) {
      res.status(401).json({
        error: 'TOKEN_REVOKED',
        message: 'Access token has been revoked',
      });
      return;
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        emailVerified: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        error: 'USER_INACTIVE',
        message: 'User account is inactive or does not exist',
      });
      return;
    }

    // Update session access time (async, don't wait)
    const ipAddress = req.ip || req.connection.remoteAddress || undefined;
    updateSessionAccess(payload.jti, ipAddress).catch(error => {
      console.error('Failed to update session access:', error);
    });

    // Attach JWT user to request
    req.jwtUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      jti: payload.jti,
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Internal authentication error',
    });
  }
}

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractTokenFromHeader(req.headers.authorization);
  
  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    
    // Check if token is revoked
    const revoked = await isTokenRevoked(payload.jti);
    if (revoked) {
      next();
      return;
    }

    // Verify user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
      },
    });

    if (user && user.isActive) {
      req.jwtUser = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        jti: payload.jti,
      };

      // Update session access time
      const ipAddress = req.ip || req.connection.remoteAddress || undefined;
      updateSessionAccess(payload.jti, ipAddress).catch(error => {
        console.error('Failed to update session access:', error);
      });
    }
  } catch (error) {
    // Silently ignore authentication errors in optional auth
    console.error('Optional auth error:', error);
  }

  next();
}

/**
 * Require authentication - alias for authenticateToken for clarity
 */
export const requireAuth = authenticateToken;

/**
 * Require email verification
 */
export async function requireEmailVerification(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required',
    });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { emailVerified: true },
  });

  if (!user?.emailVerified) {
    res.status(403).json({
      error: 'EMAIL_NOT_VERIFIED',
      message: 'Email verification required',
    });
    return;
  }

  next();
}

/**
 * Rate limiting middleware per user
 */
export function rateLimitPerUser(options: {
  maxRequests: number;
  windowMs: number;
  message?: string;
}) {
  const { maxRequests, windowMs, message } = options;
  const userRequests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next();
      return;
    }

    const userId = req.user.id;
    const now = Date.now();
    const userRecord = userRequests.get(userId);

    if (!userRecord || now > userRecord.resetTime) {
      userRequests.set(userId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (userRecord.count >= maxRequests) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: message || 'Too many requests, please try again later',
        retryAfter: Math.ceil((userRecord.resetTime - now) / 1000),
      });
      return;
    }

    userRecord.count++;
    next();
  };
}

/**
 * Role-based access control middleware
 */
export function requireRole(roles: UserRole | UserRole[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Insufficient permissions for this action',
        required: allowedRoles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
}

/**
 * Check minimum role level
 */
export function requireMinRole(minRole: UserRole) {
  const roleHierarchy: Record<UserRole, number> = {
    VIEWER: 1,
    USER: 2,
    CONTRIBUTOR: 3,
    DESIGNER: 4,
    DEVELOPER: 5,
    ADMIN: 6,
    SUPER_ADMIN: 7,
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
      return;
    }

    const userLevel = roleHierarchy[req.user.role];
    const requiredLevel = roleHierarchy[minRole];

    if (userLevel < requiredLevel) {
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Insufficient permissions for this action',
        required: minRole,
        current: req.user.role,
      });
      return;
    }

    next();
  };
}

/**
 * Admin only middleware
 */
export const requireAdmin = requireRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]);

/**
 * Super admin only middleware
 */
export const requireSuperAdmin = requireRole(UserRole.SUPER_ADMIN);

/**
 * Developer or higher middleware
 */
export const requireDeveloper = requireMinRole(UserRole.DEVELOPER);

/**
 * Self or admin access middleware - user can access their own resources or admin can access any
 */
export function requireSelfOrAdmin(getUserId: (req: Request) => string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required',
      });
      return;
    }

    const targetUserId = getUserId(req);
    const isAdmin = [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(req.user.role);
    const isSelf = req.user.id === targetUserId;

    if (!isSelf && !isAdmin) {
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: 'Can only access your own resources',
      });
      return;
    }

    next();
  };
}
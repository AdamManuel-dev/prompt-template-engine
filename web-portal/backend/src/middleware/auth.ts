/**
 * @fileoverview Authentication middleware for API routes
 * @lastmodified 2025-08-28T11:00:00Z
 * 
 * Features: API key validation, JWT token verification, user session management
 * Main APIs: validateApiKey, verifyToken, requireAuth
 * Constraints: Must handle different auth methods, provide user context
 * Patterns: Express middleware, authentication strategies, error handling
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@cursor-prompt/shared';

// Extended Request interface to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        name?: string;
        role: 'user' | 'admin';
        permissions: string[];
      };
      apiKey?: string;
    }
  }
}

/**
 * Validate API key for development/demo purposes
 * In production, this should integrate with proper authentication service
 */
export function validateApiKey(req: Request, res: Response, next: NextFunction): void {
  // Skip auth in development for now - in production this should be required
  if (process.env.NODE_ENV === 'development') {
    // Mock user for development
    req.user = {
      id: 'dev-user',
      email: 'developer@example.com',
      name: 'Development User',
      role: 'admin',
      permissions: ['template:read', 'template:execute', 'execution:read', 'execution:cancel']
    };
    return next();
  }

  // Check for API key in header
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'API key required'
      }
    } as ApiResponse);
    return;
  }

  // Validate API key (in production, this would check against a database)
  const validApiKeys = (process.env.VALID_API_KEYS || '').split(',').map(k => k.trim());
  
  if (!validApiKeys.includes(apiKey)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid API key'
      }
    } as ApiResponse);
    return;
  }

  // Set API key and mock user
  req.apiKey = apiKey;
  req.user = {
    id: `api-user-${apiKey.slice(-8)}`,
    role: 'user',
    permissions: ['template:read', 'template:execute', 'execution:read']
  };

  next();
}

/**
 * Verify JWT token (for future implementation)
 */
export function verifyToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization token required'
      }
    } as ApiResponse);
    return;
  }

  try {
    // In production, verify JWT token here
    // const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    // req.user = decoded as UserInfo;
    
    // Mock implementation for now
    req.user = {
      id: 'jwt-user',
      email: 'user@example.com',
      name: 'JWT User',
      role: 'user',
      permissions: ['template:read', 'template:execute', 'execution:read']
    };
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid or expired token'
      }
    } as ApiResponse);
    return;
  }
}

/**
 * Require specific permission
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      } as ApiResponse);
      return;
    }

    if (!req.user.permissions.includes(permission) && req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Permission '${permission}' required`
        }
      } as ApiResponse);
      return;
    }

    next();
  };
}

/**
 * Require admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    } as ApiResponse);
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required'
      }
    } as ApiResponse);
    return;
  }

  next();
}

/**
 * Optional authentication - set user if token provided, but don't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (apiKey || token) {
    // If credentials provided, validate them
    if (apiKey) {
      validateApiKey(req, res, next);
    } else if (token) {
      verifyToken(req, res, next);
    }
  } else {
    // No credentials provided, continue as anonymous
    next();
  }
}
/**
 * @fileoverview Authentication routes with JWT and security
 * @lastmodified 2025-01-08T21:30:00Z
 * 
 * Features: Register, login, logout, token refresh, password reset, email verification
 * Main APIs: POST /register, POST /login, POST /refresh, POST /reset-password
 * Constraints: JWT tokens, rate limiting, input validation, RBAC
 * Patterns: Express router, proper error handling, security middleware
 */

import { Router, Request, Response, NextFunction } from 'express';
import { ApiResponse, UserSession } from '@cursor-prompt/shared';
import { AuthService, AuthError } from '../services/auth.service';
import { requireAuth, optionalAuth, requireEmailVerification } from '../middleware/auth.middleware';
import { authRateLimit, validate, validationRules, logSecurityEvent } from '../middleware/security.middleware';
import { body } from 'express-validator';

const router = Router();
const authService = new AuthService();

// Error handling wrapper
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error handler for auth routes
const handleAuthError = (error: any, res: Response) => {
  if (error instanceof AuthError) {
    return res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message
      }
    } as ApiResponse);
  }

  console.error('Auth route error:', error);
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    }
  } as ApiResponse);
};

/**
 * POST /api/auth/register
 * User registration
 */
router.post(
  '/register',
  authRateLimit,
  logSecurityEvent('registration_attempt'),
  validate([
    validationRules.email(),
    validationRules.username(),
    validationRules.password(),
    body('firstName').optional().isString().trim().isLength({ max: 50 }),
    body('lastName').optional().isString().trim().isLength({ max: 50 }),
    body('displayName').optional().isString().trim().isLength({ max: 100 }),
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const result = await authService.register(req.body);
      
      res.status(201).json({
        success: true,
        data: {
          user: result.user,
          requiresEmailVerification: result.requiresEmailVerification
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      handleAuthError(error, res);
    }
  })
);

/**
 * POST /api/auth/login
 * User login with JWT tokens
 */
router.post(
  '/login',
  authRateLimit,
  logSecurityEvent('login_attempt'),
  validate([
    validationRules.email(),
    validationRules.password(),
    body('rememberMe').optional().isBoolean(),
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { email, password, rememberMe } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      const result = await authService.login({
        email,
        password,
        rememberMe,
        ipAddress,
        userAgent,
      });

      // Convert to expected response format
      const userSession: UserSession = {
        id: result.user.id,
        email: result.user.email,
        name: result.user.displayName || result.user.username,
        avatar: result.user.avatar,
        role: result.user.role.toLowerCase(),
        preferences: result.user.preferences || {
          theme: 'light',
          language: 'en',
          favoriteTemplates: [],
          recentTemplates: []
        },
        permissions: [] // Will be populated by permissions system
      };

      res.json({
        success: true,
        data: {
          user: userSession,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      handleAuthError(error, res);
    }
  })
);

/**
 * POST /api/auth/refresh
 * Refresh JWT tokens
 */
router.post(
  '/refresh',
  validate([
    body('refreshToken').isString().notEmpty().withMessage('Refresh token is required')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshTokens(refreshToken);

      res.json({
        success: true,
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      handleAuthError(error, res);
    }
  })
);

/**
 * POST /api/auth/logout
 * Logout user and revoke tokens
 */
router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const jti = req.user?.jti;
      await authService.logout(req.user!.id, jti);

      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      handleAuthError(error, res);
    }
  })
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const profile = await authService.getProfile(req.user!.id);

      const userSession: UserSession = {
        id: profile.id,
        email: profile.email,
        name: profile.displayName || profile.username,
        avatar: profile.avatarUrl,
        role: profile.role.toLowerCase(),
        preferences: profile.preferences || {
          theme: 'light',
          language: 'en',
          favoriteTemplates: [],
          recentTemplates: []
        },
        permissions: [] // Populated by permissions system
      };

      res.json({
        success: true,
        data: userSession,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      handleAuthError(error, res);
    }
  })
);

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put(
  '/profile',
  requireAuth,
  validate([
    body('displayName').optional().isString().trim().isLength({ max: 100 }),
    body('firstName').optional().isString().trim().isLength({ max: 50 }),
    body('lastName').optional().isString().trim().isLength({ max: 50 }),
    body('avatarUrl').optional().isURL(),
    body('preferences').optional().isObject(),
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const profile = await authService.updateProfile(req.user!.id, req.body);

      res.json({
        success: true,
        data: profile,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      handleAuthError(error, res);
    }
  })
);

/**
 * POST /api/auth/request-password-reset
 * Request password reset email
 */
router.post(
  '/request-password-reset',
  authRateLimit,
  validate([validationRules.email()]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await authService.requestPasswordReset(req.body);

      // Always return success to prevent email enumeration
      res.json({
        success: true,
        data: { message: 'Password reset instructions sent to email if account exists' },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      handleAuthError(error, res);
    }
  })
);

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post(
  '/reset-password',
  authRateLimit,
  validate([
    body('token').isString().notEmpty().withMessage('Reset token is required'),
    validationRules.password(),
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await authService.confirmPasswordReset(req.body);

      res.json({
        success: true,
        data: { message: 'Password reset successfully' },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      handleAuthError(error, res);
    }
  })
);

/**
 * POST /api/auth/change-password
 * Change password (authenticated)
 */
router.post(
  '/change-password',
  requireAuth,
  validate([
    body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
    validationRules.password().withMessage('New password must meet requirements'),
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await authService.changePassword({
        userId: req.user!.id,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.password,
      });

      res.json({
        success: true,
        data: { message: 'Password changed successfully' },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      handleAuthError(error, res);
    }
  })
);

/**
 * POST /api/auth/verify-email
 * Verify email address
 */
router.post(
  '/verify-email',
  validate([
    body('token').isString().notEmpty().withMessage('Verification token is required')
  ]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await authService.verifyEmail(req.body.token);

      res.json({
        success: true,
        data: { message: 'Email verified successfully' },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      handleAuthError(error, res);
    }
  })
);

/**
 * POST /api/auth/resend-verification
 * Resend email verification
 */
router.post(
  '/resend-verification',
  authRateLimit,
  validate([validationRules.email()]),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await authService.sendEmailVerification(req.body);

      res.json({
        success: true,
        data: { message: 'Verification email sent if account exists' },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);
    } catch (error) {
      handleAuthError(error, res);
    }
  })
);

export default router;
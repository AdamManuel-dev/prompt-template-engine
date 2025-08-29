/**
 * @fileoverview User management routes with database integration
 * @lastmodified 2025-01-08T21:15:00Z
 *
 * Features: User CRUD, preferences, favorites, execution history with database persistence
 * Main APIs: GET/PUT /profile, GET/PUT /preferences, GET/POST /favorites, GET /history, GET /analytics
 * Constraints: User-scoped data access, input validation, database transactions
 * Patterns: Express router, database services, error handling, authentication
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import {
  ApiResponse,
  ExecutionHistory,
  UserSession,
} from '@cursor-prompt/shared';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware';
import { userService } from '../services/user.service';
import { favoritesService } from '../services/favorites.service';
import { executionHistoryService } from '../services/execution-history.service';
import { testConnection } from '../db/prisma-client';

const router = Router();

/**
 * GET /api/user/profile
 * Get current user profile
 */
router.get(
  '/profile',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const user = await userService.getUserById(req.jwtUser.id, true);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        } as ApiResponse);
      }

      // Remove sensitive fields
      const { ...safeUser } = user;

      res.json({
        success: true,
        data: safeUser,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put(
  '/profile',
  [
    requireAuth,
    body('displayName')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Display name must be 1-100 characters'),
    body('avatarUrl')
      .optional()
      .isURL()
      .withMessage('Avatar URL must be valid URL'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid profile data',
            details: errors.array(),
          },
        } as ApiResponse);
      }

      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const updatedUser = await userService.updateUser(req.jwtUser.id, {
        displayName: req.body.displayName,
        avatarUrl: req.body.avatarUrl,
      });

      res.json({
        success: true,
        data: updatedUser,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: error.message,
          },
        } as ApiResponse);
      }
      next(error);
    }
  }
);

/**
 * GET /api/user/preferences
 * Get user preferences
 */
router.get(
  '/preferences',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const user = await userService.getUserById(req.jwtUser.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        } as ApiResponse);
      }

      const preferences = user.preferences || {
        theme: 'light',
        language: 'en',
        favoriteTemplates: [],
        recentTemplates: [],
      };

      res.json({
        success: true,
        data: preferences,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/user/preferences
 * Update user preferences
 */
router.put(
  '/preferences',
  [
    requireAuth,
    body('theme')
      .optional()
      .isIn(['light', 'dark'])
      .withMessage('Theme must be light or dark'),
    body('language')
      .optional()
      .isString()
      .isLength({ min: 2, max: 5 })
      .withMessage('Invalid language code'),
    body('favoriteTemplates')
      .optional()
      .isArray()
      .withMessage('Favorite templates must be an array'),
    body('recentTemplates')
      .optional()
      .isArray()
      .withMessage('Recent templates must be an array'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid preferences data',
            details: errors.array(),
          },
        } as ApiResponse);
      }

      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const updatedUser = await userService.updateUserPreferences(
        req.jwtUser.id,
        req.body
      );

      res.json({
        success: true,
        data: updatedUser.preferences,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: error.message,
          },
        } as ApiResponse);
      }
      next(error);
    }
  }
);

/**
 * GET /api/user/favorites
 * Get user's favorite templates
 */
router.get(
  '/favorites',
  [
    requireAuth,
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: errors.array(),
          },
        } as ApiResponse);
      }

      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20;

      const result = await favoritesService.getUserFavorites(req.jwtUser.id, {
        page,
        limit,
      });

      res.json({
        success: true,
        data: {
          favorites: result.favorites,
          pagination: {
            currentPage: result.currentPage,
            totalPages: result.totalPages,
            totalCount: result.totalCount,
            hasNextPage: result.currentPage < result.totalPages,
            hasPreviousPage: result.currentPage > 1,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/user/favorites/:templateId
 * Add template to favorites
 */
router.post(
  '/favorites/:templateId',
  [
    requireAuth,
    param('templateId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Template ID is required'),
    body('templateName')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Template name is required'),
    body('templatePath')
      .optional()
      .isString()
      .withMessage('Template path must be a string'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid favorite data',
            details: errors.array(),
          },
        } as ApiResponse);
      }

      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const { templateId } = req.params;
      const { templateName, templatePath } = req.body;

      const favorite = await favoritesService.addFavorite({
        userId: req.jwtUser.id,
        templateId,
        templateName,
        templatePath,
      });

      res.json({
        success: true,
        data: favorite,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/user/favorites/:templateId
 * Remove template from favorites
 */
router.delete(
  '/favorites/:templateId',
  [
    requireAuth,
    param('templateId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Template ID is required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid template ID',
            details: errors.array(),
          },
        } as ApiResponse);
      }

      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const { templateId } = req.params;
      const removed = await favoritesService.removeFavorite(
        req.jwtUser.id,
        templateId
      );

      if (!removed) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'FAVORITE_NOT_FOUND',
            message: 'Favorite not found',
          },
        } as ApiResponse);
      }

      res.json({
        success: true,
        data: {
          templateId,
          removed: true,
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/user/history
 * Get user's execution history
 */
router.get(
  '/history',
  [
    requireAuth,
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50'),
    query('templateId')
      .optional()
      .isString()
      .withMessage('Template ID must be a string'),
    query('status')
      .optional()
      .isIn([
        'PENDING',
        'RUNNING',
        'COMPLETED',
        'FAILED',
        'CANCELLED',
        'TIMEOUT',
      ])
      .withMessage('Invalid status'),
    query('dateFrom')
      .optional()
      .isISO8601()
      .withMessage('Date from must be ISO8601 format'),
    query('dateTo')
      .optional()
      .isISO8601()
      .withMessage('Date to must be ISO8601 format'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: errors.array(),
          },
        } as ApiResponse);
      }

      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const filters = {
        userId: req.jwtUser.id,
        templateId: req.query.templateId as string,
        status: req.query.status as any,
        dateFrom: req.query.dateFrom
          ? new Date(req.query.dateFrom as string)
          : undefined,
        dateTo: req.query.dateTo
          ? new Date(req.query.dateTo as string)
          : undefined,
      };

      const pagination = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };

      const historyResult = await executionHistoryService.getExecutionHistory(
        filters,
        pagination
      );

      // Convert execution results to history format
      const executionHistory: ExecutionHistory[] = historyResult.executions.map(
        execution => ({
          id: execution.id,
          templateId: execution.templateId,
          templateName: execution.templateName,
          variables: execution.parameters as any,
          result: execution.result
            ? (execution.result as any)
            : execution.error
              ? { error: execution.error }
              : {},
          createdAt: execution.createdAt.toISOString(),
          duration: execution.duration || 0,
          status: execution.status === 'COMPLETED' ? 'success' : 'error',
        })
      );

      res.json({
        success: true,
        data: {
          history: executionHistory,
          pagination: {
            currentPage: historyResult.currentPage,
            totalPages: historyResult.totalPages,
            totalCount: historyResult.totalCount,
            hasNextPage: historyResult.currentPage < historyResult.totalPages,
            hasPreviousPage: historyResult.currentPage > 1,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/user/analytics
 * Get user's execution analytics
 */
router.get(
  '/analytics',
  [
    requireAuth,
    query('days')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('Days must be between 1 and 365'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            details: errors.array(),
          },
        } as ApiResponse);
      }

      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      const analytics = await executionHistoryService.getAnalytics(
        {
          userId: req.jwtUser.id,
          dateFrom,
        },
        true
      );

      res.json({
        success: true,
        data: analytics,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/user/stats
 * Get user statistics
 */
router.get(
  '/stats',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const stats = await userService.getUserStats(req.jwtUser.id);

      res.json({
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: error.message,
          },
        } as ApiResponse);
      }
      next(error);
    }
  }
);

/**
 * PUT /api/user/favorites/:templateId/toggle
 * Toggle favorite status
 */
router.put(
  '/favorites/:templateId/toggle',
  [
    requireAuth,
    param('templateId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Template ID is required'),
    body('templateName')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Template name is required'),
    body('templatePath')
      .optional()
      .isString()
      .withMessage('Template path must be a string'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid favorite data',
            details: errors.array(),
          },
        } as ApiResponse);
      }

      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const { templateId } = req.params;
      const { templateName, templatePath } = req.body;

      const result = await favoritesService.toggleFavorite({
        userId: req.jwtUser.id,
        templateId,
        templateName,
        templatePath,
      });

      res.json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/user/check-favorite/:templateId
 * Check if template is favorited
 */
router.get(
  '/check-favorite/:templateId',
  [
    requireAuth,
    param('templateId')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Template ID is required'),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid template ID',
            details: errors.array(),
          },
        } as ApiResponse);
      }

      if (!req.jwtUser) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        } as ApiResponse);
      }

      const { templateId } = req.params;
      const isFavorite = await favoritesService.isFavorite(
        req.jwtUser.id,
        templateId
      );

      res.json({
        success: true,
        data: {
          templateId,
          isFavorite,
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/user/db-status
 * Check database connection status
 */
router.get(
  '/db-status',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isConnected = await testConnection();

      res.json({
        success: true,
        data: {
          database: {
            connected: isConnected,
            timestamp: new Date().toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
);

export default router;

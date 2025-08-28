/**
 * @fileoverview Template routes for REST API
 * @lastmodified 2025-08-28T10:45:00Z
 * 
 * Features: Template CRUD operations, search, filtering, validation
 * Main APIs: GET /templates, GET /templates/:id, GET /templates/search
 * Constraints: Must validate input, handle pagination, provide proper error responses
 * Patterns: Express router, middleware validation, error handling
 */

import { Router, Request, Response, NextFunction } from 'express';
import { param, query, validationResult } from 'express-validator';
import { TemplateService } from '../services/template-service';
import { ApiResponse } from '@cursor-prompt/shared';

const router = Router();

/**
 * GET /api/templates
 * Get paginated list of templates with filtering and sorting
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('search').optional().isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
    query('category').optional().isString().trim(),
    query('tags').optional().isString(),
    query('author').optional().isString().trim(),
    query('sort').optional().isIn(['name', 'created', 'updated', 'rating', 'downloads']).withMessage('Invalid sort field'),
    query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc')
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
            details: errors.array()
          }
        } as ApiResponse);
      }

      const templateService: TemplateService = req.app.locals.services.template;
      
      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 12,
        search: req.query.search as string,
        category: req.query.category as string,
        tags: req.query.tags ? (req.query.tags as string).split(',').map(t => t.trim()) : undefined,
        author: req.query.author as string,
        sort: req.query.sort as 'name' | 'created' | 'updated' | 'rating' | 'downloads' || 'name',
        order: req.query.order as 'asc' | 'desc' || 'asc'
      };

      const result = await templateService.getTemplates(options);

      res.json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/templates/search
 * Search templates with query
 */
router.get(
  '/search',
  [
    query('q').isLength({ min: 2 }).withMessage('Search query must be at least 2 characters'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('category').optional().isString().trim(),
    query('tags').optional().isString()
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid search parameters',
            details: errors.array()
          }
        } as ApiResponse);
      }

      const templateService: TemplateService = req.app.locals.services.template;
      
      const query = req.query.q as string;
      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 12,
        category: req.query.category as string,
        tags: req.query.tags ? (req.query.tags as string).split(',').map(t => t.trim()) : undefined
      };

      const result = await templateService.searchTemplates(query, options);

      res.json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/templates/:id
 * Get detailed information about a specific template
 */
router.get(
  '/:id',
  [
    param('id').isString().isLength({ min: 1 }).withMessage('Template ID is required')
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
            details: errors.array()
          }
        } as ApiResponse);
      }

      const templateService: TemplateService = req.app.locals.services.template;
      const templateId = req.params.id;

      const template = await templateService.getTemplate(templateId);

      res.json({
        success: true,
        data: template,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse);

    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: `Template '${req.params.id}' not found`
          }
        } as ApiResponse);
      }
      next(error);
    }
  }
);

/**
 * GET /api/templates/categories
 * Get all available template categories
 */
router.get('/meta/categories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templateService: TemplateService = req.app.locals.services.template;
    const categories = await templateService.getCategories();

    res.json({
      success: true,
      data: categories,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    } as ApiResponse);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/tags
 * Get all available template tags
 */
router.get('/meta/tags', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templateService: TemplateService = req.app.locals.services.template;
    const tags = await templateService.getTags();

    res.json({
      success: true,
      data: tags,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    } as ApiResponse);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/templates/stats
 * Get template statistics
 */
router.get('/meta/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templateService: TemplateService = req.app.locals.services.template;
    const stats = await templateService.getStats();

    res.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    } as ApiResponse);

  } catch (error) {
    next(error);
  }
});

export default router;
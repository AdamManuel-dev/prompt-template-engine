/**
 * @fileoverview Figma integration routes for design token extraction and MCP integration
 * @lastmodified 2025-08-28T10:30:00Z
 * 
 * Features: Figma MCP proxy, URL validation, design tokens, caching, rate limiting
 * Main APIs: POST /validate-url, GET /file/:fileId, GET /file/:fileId/tokens, GET /preview
 * Constraints: Figma API rate limits, MCP server availability, caching TTL
 * Patterns: MCP proxy integration, caching layer, error handling with retry
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { 
  ApiResponse
} from '@cursor-prompt/shared';
import { 
  FigmaUrlInfo, 
  FigmaFileInfo, 
  DesignToken, 
  FigmaPreview,
  FigmaApiError 
} from '@cursor-prompt/shared';
import { figmaMCPProxy } from '../services/figma-mcp-proxy';
import { figmaCacheService, FigmaCacheService } from '../services/figma-cache.service';

const router = Router();

/**
 * POST /api/figma/validate-url
 * Validate Figma URL and extract basic information
 */
router.post(
  '/validate-url',
  [
    body('url').isURL().withMessage('Valid Figma URL required')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: errors.array()
          }
        } as ApiResponse);
      }

      const { url } = req.body;

      // Validate URL using MCP proxy
      const urlInfo: FigmaUrlInfo = await figmaMCPProxy.validateUrl(url);

      res.json({
        success: true,
        data: urlInfo,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }
      } as ApiResponse<FigmaUrlInfo>);

    } catch (error: any) {
      if (error instanceof FigmaApiError) {
        return res.status(error.status).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        } as ApiResponse);
      }
      next(error);
    }
  }
);

/**
 * GET /api/figma/file/:fileId
 * Get Figma file information with caching
 */
router.get(
  '/file/:fileId',
  [
    param('fileId').isAlphanumeric().isLength({ min: 22, max: 22 }).withMessage('Invalid Figma file ID'),
    query('refresh').optional().isBoolean().withMessage('Refresh must be boolean')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: errors.array()
          }
        } as ApiResponse);
      }

      const { fileId } = req.params;
      const forceRefresh = req.query.refresh === 'true';
      const cacheKey = FigmaCacheService.fileInfoKey(fileId);

      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedFileInfo = await figmaCacheService.get<FigmaFileInfo>(cacheKey);
        if (cachedFileInfo) {
          return res.json({
            success: true,
            data: cachedFileInfo,
            meta: {
              timestamp: new Date().toISOString(),
              version: '1.0.0',
              cached: true
            }
          } as ApiResponse<FigmaFileInfo>);
        }
      }

      // Get file info from MCP server
      const fileInfo = await figmaMCPProxy.getFileInfo(fileId, forceRefresh);
      
      // Cache the result
      await figmaCacheService.set(cacheKey, fileInfo, 30 * 60 * 1000); // 30 minutes

      // Get rate limit info
      const rateLimitInfo = await figmaMCPProxy.getRateLimitInfo();

      res.set({
        'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
        'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
        'X-RateLimit-Reset': rateLimitInfo.reset.toString()
      });

      res.json({
        success: true,
        data: fileInfo,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          cached: false
        }
      } as ApiResponse<FigmaFileInfo>);

    } catch (error: any) {
      if (error instanceof FigmaApiError) {
        return res.status(error.status).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        } as ApiResponse);
      }
      next(error);
    }
  }
);

/**
 * GET /api/figma/file/:fileId/tokens
 * Extract design tokens from Figma file with caching
 */
router.get(
  '/file/:fileId/tokens',
  [
    param('fileId').isAlphanumeric().isLength({ min: 22, max: 22 }).withMessage('Invalid Figma file ID'),
    query('refresh').optional().isBoolean().withMessage('Refresh must be boolean'),
    query('includeColors').optional().isBoolean().withMessage('Include colors must be boolean'),
    query('includeTypography').optional().isBoolean().withMessage('Include typography must be boolean'),
    query('includeSpacing').optional().isBoolean().withMessage('Include spacing must be boolean'),
    query('includeShadows').optional().isBoolean().withMessage('Include shadows must be boolean')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: errors.array()
          }
        } as ApiResponse);
      }

      const { fileId } = req.params;
      const forceRefresh = req.query.refresh === 'true';
      const options = {
        includeColors: req.query.includeColors !== 'false',
        includeTypography: req.query.includeTypography !== 'false',
        includeSpacing: req.query.includeSpacing !== 'false',
        includeShadows: req.query.includeShadows !== 'false'
      };
      const cacheKey = FigmaCacheService.tokensKey(fileId);

      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedTokens = await figmaCacheService.get<DesignToken[]>(cacheKey);
        if (cachedTokens) {
          return res.json({
            success: true,
            data: cachedTokens,
            meta: {
              timestamp: new Date().toISOString(),
              version: '1.0.0',
              cached: true
            }
          } as ApiResponse<DesignToken[]>);
        }
      }

      console.log(`🎨 Extracting design tokens from Figma file: ${fileId}`);
      
      // Extract tokens using MCP server
      const tokens = await figmaMCPProxy.extractDesignTokens(fileId, options);
      
      // Cache the result
      await figmaCacheService.set(cacheKey, tokens, 30 * 60 * 1000); // 30 minutes

      // Get rate limit info
      const rateLimitInfo = await figmaMCPProxy.getRateLimitInfo();

      res.set({
        'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
        'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
        'X-RateLimit-Reset': rateLimitInfo.reset.toString()
      });

      res.json({
        success: true,
        data: tokens,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          cached: false
        }
      } as ApiResponse<DesignToken[]>);

    } catch (error: any) {
      if (error instanceof FigmaApiError) {
        const status = error.status === 429 ? 429 : 500;
        return res.status(status).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        } as ApiResponse);
      }
      next(error);
    }
  }
);

/**
 * GET /api/figma/file/:fileId/preview
 * Get preview image for Figma file or node
 */
router.get(
  '/file/:fileId/preview',
  [
    param('fileId').isAlphanumeric().isLength({ min: 22, max: 22 }).withMessage('Invalid Figma file ID'),
    query('scale').optional().isFloat({ min: 0.5, max: 4 }).withMessage('Scale must be between 0.5 and 4'),
    query('format').optional().isIn(['png', 'jpg', 'svg']).withMessage('Format must be png, jpg, or svg')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: errors.array()
          }
        } as ApiResponse);
      }

      const { fileId } = req.params;
      const options = {
        scale: parseFloat(req.query.scale as string) || 2,
        format: (req.query.format as 'png' | 'jpg' | 'svg') || 'png',
        useFrameBounds: req.query.useFrameBounds === 'true'
      };
      const cacheKey = FigmaCacheService.previewKey(fileId, undefined, options);

      // Try cache first
      const cachedPreview = await figmaCacheService.get<FigmaPreview>(cacheKey);
      if (cachedPreview && cachedPreview.expiresAt > Date.now()) {
        return res.json({
          success: true,
          data: cachedPreview,
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            cached: true
          }
        } as ApiResponse<FigmaPreview>);
      }

      console.log(`📸 Getting preview for Figma file: ${fileId}`);
      
      // Get preview using MCP server
      const preview = await figmaMCPProxy.getNodePreview(fileId, undefined, options);
      
      // Cache the result
      await figmaCacheService.set(cacheKey, preview, 60 * 60 * 1000); // 1 hour

      // Get rate limit info
      const rateLimitInfo = await figmaMCPProxy.getRateLimitInfo();

      res.set({
        'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
        'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
        'X-RateLimit-Reset': rateLimitInfo.reset.toString()
      });

      res.json({
        success: true,
        data: preview,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          cached: false
        }
      } as ApiResponse<FigmaPreview>);

    } catch (error: any) {
      if (error instanceof FigmaApiError) {
        const status = error.status === 429 ? 429 : 500;
        return res.status(status).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        } as ApiResponse);
      }
      next(error);
    }
  }
);

/**
 * GET /api/figma/file/:fileId/node/:nodeId/preview
 * Get preview image for specific Figma node
 */
router.get(
  '/file/:fileId/node/:nodeId/preview',
  [
    param('fileId').isAlphanumeric().isLength({ min: 22, max: 22 }).withMessage('Invalid Figma file ID'),
    param('nodeId').notEmpty().withMessage('Node ID is required'),
    query('scale').optional().isFloat({ min: 0.5, max: 4 }).withMessage('Scale must be between 0.5 and 4'),
    query('format').optional().isIn(['png', 'jpg', 'svg']).withMessage('Format must be png, jpg, or svg')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: errors.array()
          }
        } as ApiResponse);
      }

      const { fileId, nodeId } = req.params;
      const options = {
        scale: parseFloat(req.query.scale as string) || 2,
        format: (req.query.format as 'png' | 'jpg' | 'svg') || 'png',
        useFrameBounds: req.query.useFrameBounds === 'true'
      };
      const cacheKey = FigmaCacheService.previewKey(fileId, nodeId, options);

      // Try cache first
      const cachedPreview = await figmaCacheService.get<FigmaPreview>(cacheKey);
      if (cachedPreview && cachedPreview.expiresAt > Date.now()) {
        return res.json({
          success: true,
          data: cachedPreview,
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            cached: true
          }
        } as ApiResponse<FigmaPreview>);
      }

      console.log(`📸 Getting preview for Figma node: ${fileId}/${nodeId}`);
      
      // Get preview using MCP server
      const preview = await figmaMCPProxy.getNodePreview(fileId, nodeId, options);
      
      // Cache the result
      await figmaCacheService.set(cacheKey, preview, 60 * 60 * 1000); // 1 hour

      // Get rate limit info
      const rateLimitInfo = await figmaMCPProxy.getRateLimitInfo();

      res.set({
        'X-RateLimit-Limit': rateLimitInfo.limit.toString(),
        'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
        'X-RateLimit-Reset': rateLimitInfo.reset.toString()
      });

      res.json({
        success: true,
        data: preview,
        meta: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          cached: false
        }
      } as ApiResponse<FigmaPreview>);

    } catch (error: any) {
      if (error instanceof FigmaApiError) {
        const status = error.status === 429 ? 429 : 500;
        return res.status(status).json({
          success: false,
          error: {
            code: error.code,
            message: error.message
          }
        } as ApiResponse);
      }
      next(error);
    }
  }
);

/**
 * DELETE /api/figma/cache/clear
 * Clear all Figma cache entries
 */
router.delete('/cache/clear', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await figmaCacheService.clear();

    res.json({
      success: true,
      data: { 
        message: 'All Figma cache entries cleared'
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    } as ApiResponse);

  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/figma/cache/clear/:fileId
 * Clear cached data for specific Figma file
 */
router.delete('/cache/clear/:fileId', [
  param('fileId').isAlphanumeric().isLength({ min: 22, max: 22 }).withMessage('Invalid Figma file ID')
], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: errors.array()
        }
      } as ApiResponse);
    }

    const { fileId } = req.params;
    const clearedCount = await figmaCacheService.clearFile(fileId);

    res.json({
      success: true,
      data: { 
        message: `Cache cleared for file ${fileId}`,
        fileId,
        clearedEntries: clearedCount
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    } as ApiResponse);

  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/figma/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = figmaCacheService.getStats();

    res.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    } as ApiResponse);

  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/figma/status
 * Check Figma MCP server and API status
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check MCP server health
    const mcpHealthy = await figmaMCPProxy.healthCheck();
    
    // Get rate limit info
    const rateLimitInfo = await figmaMCPProxy.getRateLimitInfo();
    
    // Get cache stats
    const cacheStats = figmaCacheService.getStats();

    const status = {
      mcpServerAvailable: mcpHealthy,
      rateLimit: rateLimitInfo,
      cache: cacheStats,
      lastCheck: new Date().toISOString(),
      version: 'v1'
    };

    res.json({
      success: true,
      data: status,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    } as ApiResponse);

  } catch (error: any) {
    next(error);
  }
});

// Initialize MCP proxy on startup
figmaMCPProxy.initialize().catch((error) => {
  console.error('Failed to initialize Figma MCP proxy:', error);
});

export default router;
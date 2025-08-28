/**
 * @fileoverview Execution routes for template execution and progress tracking
 * @lastmodified 2025-08-28T10:45:00Z
 * 
 * Features: Template execution, progress tracking, execution history, cancellation
 * Main APIs: POST /executions, GET /executions/:id, GET /executions/:id/progress
 * Constraints: Must validate execution requests, handle real-time progress, manage concurrent executions
 * Patterns: Express router, SSE for progress updates, validation middleware
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ExecutionService } from '../services/execution-service';
import { WebSocketService } from '../services/websocket-service';
import { ApiResponse, ExecutionRequest, ProgressUpdate } from '@cursor-prompt/shared';
import { validateTemplateVariables } from '@cursor-prompt/shared';

const router = Router();

/**
 * POST /api/executions
 * Execute a template with variables
 */
router.post(
  '/',
  [
    body('templateId').isString().isLength({ min: 1 }).withMessage('Template ID is required'),
    body('variables').isObject().withMessage('Variables must be an object'),
    body('options').optional().isObject().withMessage('Options must be an object'),
    body('options.format').optional().isIn(['markdown', 'plain', 'json']).withMessage('Invalid format'),
    body('options.includeGit').optional().isBoolean().withMessage('includeGit must be boolean'),
    body('options.includeFiles').optional().isBoolean().withMessage('includeFiles must be boolean'),
    body('options.filePatterns').optional().isArray().withMessage('filePatterns must be an array'),
    body('options.contextFiles').optional().isArray().withMessage('contextFiles must be an array')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid execution request',
            details: errors.array()
          }
        } as ApiResponse);
      }

      const executionService: ExecutionService = req.app.locals.services.execution;
      const websocketService: WebSocketService = req.app.locals.services.websocket;
      
      const executionRequest: ExecutionRequest = req.body;

      // Start execution asynchronously
      const execution = await executionService.startExecution(executionRequest, {
        onProgress: (progress: ProgressUpdate) => {
          // Broadcast progress to all connected clients
          websocketService.broadcast('execution-progress', progress);
        }
      });

      res.status(202).json({
        success: true,
        data: execution,
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
            message: error.message
          }
        } as ApiResponse);
      }
      
      if (error instanceof Error && error.message.includes('validation')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message
          }
        } as ApiResponse);
      }

      next(error);
    }
  }
);

/**
 * GET /api/executions/:id
 * Get execution status and result
 */
router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid execution ID format')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid execution ID',
            details: errors.array()
          }
        } as ApiResponse);
      }

      const executionService: ExecutionService = req.app.locals.services.execution;
      const executionId = req.params.id;

      const execution = await executionService.getExecution(executionId);

      if (!execution) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'EXECUTION_NOT_FOUND',
            message: `Execution '${executionId}' not found`
          }
        } as ApiResponse);
      }

      res.json({
        success: true,
        data: execution,
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
 * GET /api/executions/:id/progress
 * Get execution progress via Server-Sent Events
 */
router.get(
  '/:id/progress',
  [
    param('id').isUUID().withMessage('Invalid execution ID format')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid execution ID',
            details: errors.array()
          }
        } as ApiResponse);
      }

      const executionService: ExecutionService = req.app.locals.services.execution;
      const executionId = req.params.id;

      // Check if execution exists
      const execution = await executionService.getExecution(executionId);
      if (!execution) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'EXECUTION_NOT_FOUND',
            message: `Execution '${executionId}' not found`
          }
        } as ApiResponse);
      }

      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send current status immediately
      const progressData = JSON.stringify({
        executionId,
        stage: execution.status === 'completed' ? 'completed' : 
               execution.status === 'failed' ? 'error' : 'processing',
        message: execution.status === 'completed' ? 'Execution completed' :
                execution.status === 'failed' ? `Execution failed: ${execution.error}` :
                'Execution in progress...',
        progress: execution.status === 'completed' ? 100 : 
                 execution.status === 'failed' ? 0 : 50,
        timestamp: new Date().toISOString()
      });
      
      res.write(`data: ${progressData}\n\n`);

      // If execution is already finished, close the connection
      if (execution.status === 'completed' || execution.status === 'failed') {
        res.write('event: close\ndata: {}\n\n');
        res.end();
        return;
      }

      // Set up progress listener
      const progressListener = (progress: ProgressUpdate) => {
        if (progress.executionId === executionId) {
          const data = JSON.stringify(progress);
          res.write(`data: ${data}\n\n`);
          
          // Close connection when execution is complete
          if (progress.stage === 'completed' || progress.stage === 'error') {
            setTimeout(() => {
              res.write('event: close\ndata: {}\n\n');
              res.end();
            }, 1000);
          }
        }
      };

      executionService.on('progress', progressListener);

      // Clean up on client disconnect
      req.on('close', () => {
        executionService.removeListener('progress', progressListener);
        res.end();
      });

      // Send heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        if (!res.headersSent) {
          res.write(': heartbeat\n\n');
        } else {
          clearInterval(heartbeat);
        }
      }, 30000);

      req.on('close', () => {
        clearInterval(heartbeat);
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/executions/:id
 * Cancel a running execution
 */
router.delete(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid execution ID format')
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid execution ID',
            details: errors.array()
          }
        } as ApiResponse);
      }

      const executionService: ExecutionService = req.app.locals.services.execution;
      const executionId = req.params.id;

      const cancelled = await executionService.cancelExecution(executionId);

      if (!cancelled) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'EXECUTION_NOT_FOUND',
            message: `Execution '${executionId}' not found or already completed`
          }
        } as ApiResponse);
      }

      res.json({
        success: true,
        data: { cancelled: true },
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
 * GET /api/executions
 * Get execution history with pagination
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('status').optional().isIn(['pending', 'running', 'completed', 'failed']).withMessage('Invalid status'),
    query('templateId').optional().isString().withMessage('Template ID must be a string')
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

      const executionService: ExecutionService = req.app.locals.services.execution;
      
      const options = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        status: req.query.status as string,
        templateId: req.query.templateId as string
      };

      const history = await executionService.getExecutionHistory(options);

      res.json({
        success: true,
        data: history,
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

export default router;
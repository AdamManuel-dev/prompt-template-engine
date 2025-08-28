/**
 * @fileoverview Health check routes for system monitoring
 * @lastmodified 2025-08-28T11:00:00Z
 * 
 * Features: Health status, system metrics, service availability checks
 * Main APIs: GET /health, GET /health/detailed, GET /health/metrics
 * Constraints: Should be fast, provide clear status indicators
 * Patterns: Express router, health check patterns, monitoring
 */

import { Router, Request, Response } from 'express';
import { ApiResponse, SystemHealth } from '@cursor-prompt/shared';
import { CLIService } from '../services/cli-service';
import { TemplateService } from '../services/template-service';
import { ExecutionService } from '../services/execution-service';
import { WebSocketService } from '../services/websocket-service';
import { apiUsageTracker } from '../middleware/request-logger';
import { healthCheckLogger } from '../middleware/request-logger';

const router = Router();

// Use minimal logging for health checks
router.use(healthCheckLogger);

/**
 * GET /api/health
 * Basic health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Basic health check - just verify server is responding
    const health: SystemHealth = {
      status: 'healthy',
      services: {
        api: 'up',
        cli: 'up', // We'll assume CLI is up for basic check
        figma: 'up', // Figma integration not implemented yet
        database: 'up' // No database yet, using in-memory storage
      },
      metrics: {
        uptime: process.uptime(),
        responseTime: Date.now() - startTime,
        activeExecutions: 0, // Will be set below
        errorRate: 0
      },
      lastCheck: new Date().toISOString()
    };

    // Get active executions if service is available
    try {
      const executionService: ExecutionService = req.app.locals.services?.execution;
      if (executionService) {
        health.metrics.activeExecutions = executionService.getActiveExecutions().length;
      }
    } catch (error) {
      // Service not available - don't fail health check
    }

    res.status(200).json({
      success: true,
      data: health,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    } as ApiResponse);

  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Health check failed'
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    } as ApiResponse);
  }
});

/**
 * GET /api/health/detailed
 * Detailed health check with service-specific tests
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: Record<string, { status: 'up' | 'down'; error?: string; responseTime?: number }> = {};

  // Check CLI service
  try {
    const cliCheckStart = Date.now();
    const cliService: CLIService = req.app.locals.services?.cli;
    
    if (cliService) {
      // Test CLI by checking if we can get active executions
      const activeExecutions = cliService.getActiveExecutions();
      checks.cli = { 
        status: 'up',
        responseTime: Date.now() - cliCheckStart
      };
    } else {
      checks.cli = { status: 'down', error: 'CLI service not initialized' };
    }
  } catch (error) {
    checks.cli = { 
      status: 'down', 
      error: error instanceof Error ? error.message : 'Unknown CLI error' 
    };
  }

  // Check template service
  try {
    const templateCheckStart = Date.now();
    const templateService: TemplateService = req.app.locals.services?.template;
    
    if (templateService) {
      // Test template service by checking cache stats
      const stats = templateService.getCacheStats();
      checks.template = { 
        status: 'up',
        responseTime: Date.now() - templateCheckStart
      };
    } else {
      checks.template = { status: 'down', error: 'Template service not initialized' };
    }
  } catch (error) {
    checks.template = { 
      status: 'down', 
      error: error instanceof Error ? error.message : 'Unknown template service error' 
    };
  }

  // Check execution service
  try {
    const executionCheckStart = Date.now();
    const executionService: ExecutionService = req.app.locals.services?.execution;
    
    if (executionService) {
      const stats = executionService.getExecutionStats();
      checks.execution = { 
        status: 'up',
        responseTime: Date.now() - executionCheckStart
      };
    } else {
      checks.execution = { status: 'down', error: 'Execution service not initialized' };
    }
  } catch (error) {
    checks.execution = { 
      status: 'down', 
      error: error instanceof Error ? error.message : 'Unknown execution service error' 
    };
  }

  // Check WebSocket service
  try {
    const wsCheckStart = Date.now();
    const websocketService: WebSocketService = req.app.locals.services?.websocket;
    
    if (websocketService) {
      const wsStats = websocketService.getStats();
      checks.websocket = { 
        status: 'up',
        responseTime: Date.now() - wsCheckStart
      };
    } else {
      checks.websocket = { status: 'down', error: 'WebSocket service not initialized' };
    }
  } catch (error) {
    checks.websocket = { 
      status: 'down', 
      error: error instanceof Error ? error.message : 'Unknown WebSocket service error' 
    };
  }

  // Determine overall status
  const hasFailures = Object.values(checks).some(check => check.status === 'down');
  const overallStatus = hasFailures ? 'degraded' : 'healthy';

  const detailedHealth = {
    status: overallStatus,
    services: {
      api: 'up',
      cli: checks.cli?.status || 'down',
      figma: 'up', // Not implemented yet
      database: 'up' // In-memory storage
    },
    metrics: {
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      activeExecutions: 0,
      errorRate: 0
    },
    lastCheck: new Date().toISOString(),
    serviceDetails: checks
  };

  // Get execution stats if available
  try {
    const executionService: ExecutionService = req.app.locals.services?.execution;
    if (executionService) {
      const execStats = executionService.getExecutionStats();
      detailedHealth.metrics.activeExecutions = execStats.active;
    }
  } catch (error) {
    // Ignore error
  }

  const statusCode = overallStatus === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    success: overallStatus === 'healthy',
    data: detailedHealth,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  } as ApiResponse);
});

/**
 * GET /api/health/metrics
 * System metrics and performance data
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = {
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        version: process.version,
        pid: process.pid
      },
      api: {
        usage: apiUsageTracker.getStats(),
        topEndpoints: apiUsageTracker.getTopEndpoints(5),
        slowestEndpoints: apiUsageTracker.getSlowestEndpoints(5)
      },
      services: {} as Record<string, any>
    };

    // Get service-specific metrics
    try {
      const executionService: ExecutionService = req.app.locals.services?.execution;
      if (executionService) {
        metrics.services.execution = executionService.getExecutionStats();
      }
    } catch (error) {
      // Ignore service errors
    }

    try {
      const templateService: TemplateService = req.app.locals.services?.template;
      if (templateService) {
        metrics.services.template = {
          cache: templateService.getCacheStats()
        };
      }
    } catch (error) {
      // Ignore service errors
    }

    try {
      const websocketService: WebSocketService = req.app.locals.services?.websocket;
      if (websocketService) {
        metrics.services.websocket = websocketService.getStats();
      }
    } catch (error) {
      // Ignore service errors
    }

    res.json({
      success: true,
      data: metrics,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    } as ApiResponse);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'METRICS_ERROR',
        message: 'Failed to retrieve system metrics'
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    } as ApiResponse);
  }
});

/**
 * GET /api/health/version
 * Application version and build info
 */
router.get('/version', (req: Request, res: Response) => {
  const packageJson = require('../../../package.json');
  
  res.json({
    success: true,
    data: {
      name: packageJson.name || 'Cursor Prompt Web Portal API',
      version: packageJson.version || '1.0.0',
      description: packageJson.description || 'API for non-developer template engine access',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      buildTime: new Date().toISOString(), // In production, this would be build time
      uptime: process.uptime()
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  } as ApiResponse);
});

export default router;
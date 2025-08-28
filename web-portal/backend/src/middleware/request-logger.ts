/**
 * @fileoverview Request logging middleware for API monitoring
 * @lastmodified 2025-08-28T11:00:00Z
 * 
 * Features: Request/response logging, performance tracking, user activity logging
 * Main APIs: requestLogger middleware
 * Constraints: Must not log sensitive data, provide structured logging
 * Patterns: Express middleware, structured logging, performance monitoring
 */

import { Request, Response, NextFunction } from 'express';
import chalk from 'chalk';

export interface RequestLog {
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
  ip: string;
  userId?: string;
  timestamp: string;
  contentLength?: number;
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Extract request information
  const requestInfo = {
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    timestamp,
    contentLength: req.headers['content-length'] ? parseInt(req.headers['content-length'], 10) : undefined
  };

  // Log request start (only in development or for important endpoints)
  if (process.env.NODE_ENV === 'development' || req.originalUrl?.startsWith('/api/executions')) {
    console.log(chalk.blue(`📥 ${requestInfo.method} ${requestInfo.url} - ${requestInfo.ip}`));
  }

  // Override res.json to capture response
  const originalJson = res.json;
  res.json = function(body: any) {
    // Restore original method
    res.json = originalJson;
    
    // Log response
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    const logData: RequestLog = {
      ...requestInfo,
      statusCode,
      responseTime,
      userId: req.user?.id
    };

    // Log based on status code
    if (statusCode >= 500) {
      console.error(chalk.red(`❌ ${logData.method} ${logData.url} - ${statusCode} - ${responseTime}ms`));
    } else if (statusCode >= 400) {
      console.warn(chalk.yellow(`⚠️  ${logData.method} ${logData.url} - ${statusCode} - ${responseTime}ms`));
    } else if (process.env.NODE_ENV === 'development' || logData.url.startsWith('/api/executions')) {
      console.log(chalk.green(`✅ ${logData.method} ${logData.url} - ${statusCode} - ${responseTime}ms`));
    }

    // Log slow requests
    if (responseTime > 2000) {
      console.warn(chalk.magenta(`🐌 Slow request: ${logData.method} ${logData.url} - ${responseTime}ms`));
    }

    // Log structured data in production
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({
        type: 'request',
        ...logData,
        // Don't log response body in production for security
        responseSize: JSON.stringify(body).length
      }));
    }

    // Call original json method
    return originalJson.call(this, body);
  };

  // Handle connection close (client disconnect)
  req.on('close', () => {
    if (!res.headersSent) {
      const responseTime = Date.now() - startTime;
      console.log(chalk.yellow(`🔌 Client disconnected: ${requestInfo.method} ${requestInfo.url} - ${responseTime}ms`));
    }
  });

  next();
}

/**
 * Health check logging (minimal logging for health endpoints)
 */
export function healthCheckLogger(req: Request, res: Response, next: NextFunction): void {
  // Only log failed health checks
  const originalJson = res.json;
  res.json = function(body: any) {
    res.json = originalJson;
    
    if (res.statusCode !== 200) {
      console.warn(chalk.yellow(`🏥 Health check failed: ${res.statusCode}`));
    }
    
    return originalJson.call(this, body);
  };

  next();
}

/**
 * API usage statistics tracking
 */
export class ApiUsageTracker {
  private stats = new Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    errors: number;
    lastUsed: Date;
  }>();

  track(endpoint: string, responseTime: number, statusCode: number): void {
    const key = endpoint;
    const existing = this.stats.get(key) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      errors: 0,
      lastUsed: new Date()
    };

    existing.count++;
    existing.totalTime += responseTime;
    existing.avgTime = existing.totalTime / existing.count;
    existing.lastUsed = new Date();
    
    if (statusCode >= 400) {
      existing.errors++;
    }

    this.stats.set(key, existing);
  }

  getStats(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [endpoint, stats] of this.stats) {
      result[endpoint] = {
        ...stats,
        errorRate: stats.count > 0 ? (stats.errors / stats.count) * 100 : 0
      };
    }
    return result;
  }

  getTopEndpoints(limit: number = 10): Array<{ endpoint: string; count: number; avgTime: number }> {
    return Array.from(this.stats.entries())
      .map(([endpoint, stats]) => ({ endpoint, count: stats.count, avgTime: stats.avgTime }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getSlowestEndpoints(limit: number = 10): Array<{ endpoint: string; avgTime: number; count: number }> {
    return Array.from(this.stats.entries())
      .map(([endpoint, stats]) => ({ endpoint, avgTime: stats.avgTime, count: stats.count }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, limit);
  }

  reset(): void {
    this.stats.clear();
    console.log(chalk.blue('📊 API usage statistics reset'));
  }
}

// Global usage tracker instance
export const apiUsageTracker = new ApiUsageTracker();

/**
 * Usage tracking middleware
 */
export function usageTracker(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  const originalJson = res.json;
  res.json = function(body: any) {
    res.json = originalJson;
    
    const responseTime = Date.now() - startTime;
    const endpoint = `${req.method} ${req.route?.path || req.originalUrl}`;
    
    apiUsageTracker.track(endpoint, responseTime, res.statusCode);
    
    return originalJson.call(this, body);
  };

  next();
}
/**
 * @fileoverview Global error handling middleware
 * @lastmodified 2025-08-28T11:00:00Z
 * 
 * Features: Centralized error handling, error logging, user-friendly error responses
 * Main APIs: errorHandler middleware
 * Constraints: Must handle all error types, provide consistent response format
 * Patterns: Express error middleware, error classification, logging
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@cursor-prompt/shared';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Global error handling middleware
 */
export function errorHandler(
  error: AppError, 
  req: Request, 
  res: Response, 
  next: NextFunction
): void {
  // Log error details
  console.error('🚨 API Error:', {
    method: req.method,
    url: req.originalUrl,
    error: error.message,
    stack: process.env['NODE_ENV'] === 'development' ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });

  // Determine error status code
  let statusCode = error.statusCode || 500;
  let errorCode = error.code || 'INTERNAL_SERVER_ERROR';
  let message = error.message || 'An unexpected error occurred';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_FORMAT';
    message = 'Invalid data format';
  } else if (error.name === 'MongoError' && error.message.includes('duplicate key')) {
    statusCode = 409;
    errorCode = 'DUPLICATE_ENTRY';
    message = 'Resource already exists';
  } else if (error.message?.includes('not found')) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
  } else if (error.message?.includes('unauthorized') || error.message?.includes('authentication')) {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
  } else if (error.message?.includes('forbidden') || error.message?.includes('permission')) {
    statusCode = 403;
    errorCode = 'FORBIDDEN';
  } else if (error.message?.includes('rate limit')) {
    statusCode = 429;
    errorCode = 'RATE_LIMIT_EXCEEDED';
  } else if (error.message?.includes('timeout')) {
    statusCode = 408;
    errorCode = 'REQUEST_TIMEOUT';
  }

  // Don't expose internal errors in production
  if (statusCode === 500 && process.env['NODE_ENV'] === 'production') {
    message = 'Internal server error';
  }

  // Create error response
  const errorResponse: ApiResponse = {
    success: false,
    error: {
      code: errorCode,
      message,
      ...(process.env['NODE_ENV'] === 'development' && { 
        stack: error.stack,
        details: {
          originalMessage: error.message,
          name: error.name
        }
      })
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  };

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * Handle 404 errors for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  } as ApiResponse);
}

/**
 * Async error wrapper to catch promise rejections
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create operational error
 */
export function createError(message: string, statusCode: number = 500, code?: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = true;
  return error;
}

/**
 * Validation error handler
 */
export function handleValidationError(errors: any[]): AppError {
  const message = errors.map(err => err.message || err.msg).join(', ');
  return createError(message, 400, 'VALIDATION_ERROR');
}
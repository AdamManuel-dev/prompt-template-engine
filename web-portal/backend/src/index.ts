/**
 * @fileoverview Express.js server entry point with comprehensive security
 * @lastmodified 2025-01-08T21:50:00Z
 * 
 * Features: JWT authentication, RBAC, security middleware, real-time updates
 * Main APIs: Template management, execution, Figma integration, user management
 * Constraints: Production-ready security, rate limiting, input validation
 * Patterns: Security-first middleware stack, JWT authentication, audit logging
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import passport from 'passport';

// Import routes
import templateRoutes from './routes/templates';
import executionRoutes from './routes/executions';
import figmaRoutes from './routes/figma';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import healthRoutes from './routes/health';

// Import middleware
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { setupSecurity, globalRateLimit, sanitizeRequest, limitRequestSize } from './middleware/security.middleware';
import { requireAuth, optionalAuth } from './middleware/auth.middleware';

// Import services
import { CLIService } from './services/cli-service';
import { TemplateService } from './services/template-service';
import { ExecutionService } from './services/execution-service';
import { WebSocketService } from './services/websocket-service';
import { OAuthService } from './services/oauth.service';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Configuration
const PORT = process.env['PORT'] || 3001;
const NODE_ENV = process.env['NODE_ENV'] || 'development';
const CLI_PATH = process.env['CLI_PATH'] || path.resolve('../dist/cli.js');

// Initialize services
const cliService = new CLIService(CLI_PATH);
const templateService = new TemplateService(cliService);
const executionService = new ExecutionService(cliService);
const websocketService = new WebSocketService(wss);
const oauthService = new OAuthService();

// Setup OAuth strategies
oauthService.setupPassportStrategies();

// Security middleware stack (order is important)
setupSecurity(app);
app.use(globalRateLimit);
app.use(sanitizeRequest);
app.use(limitRequestSize(10 * 1024 * 1024)); // 10MB limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());
app.use(requestLogger);

// Make services available to routes
app.locals.services = {
  cli: cliService,
  template: templateService,
  execution: executionService,
  websocket: websocketService,
  oauth: oauthService
};

// Health check endpoint (no auth required)
app.use('/api/health', healthRoutes);

// API routes with JWT authentication
app.use('/api/auth', authRoutes);
app.use('/api/templates', requireAuth, templateRoutes);
app.use('/api/executions', requireAuth, executionRoutes);
app.use('/api/figma', requireAuth, figmaRoutes);
app.use('/api/user', requireAuth, userRoutes);

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'Cursor Prompt Web Portal API',
    version: '1.0.0',
    description: 'REST API for non-developer template engine access',
    endpoints: {
      templates: '/api/templates',
      executions: '/api/executions',
      figma: '/api/figma',
      auth: '/api/auth',
      user: '/api/user',
      health: '/api/health'
    },
    websocket: {
      url: `ws://localhost:${PORT}/ws`,
      events: ['execution-progress', 'execution-complete', 'execution-error', 'system-notification']
    }
  });
});

// Serve static files in production
if (NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`
    }
  });
});

// WebSocket connection handling
websocketService.initialize();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  
  // Close WebSocket server
  websocketService.close();
  
  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  
  // Close WebSocket server  
  websocketService.close();
  
  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Environment: ${NODE_ENV}`);
  console.log(`🛠️  CLI Path: ${CLI_PATH}`);
  console.log(`🔗 WebSocket server ready`);
  
  if (NODE_ENV === 'development') {
    console.log(`🌐 API Documentation: http://localhost:${PORT}/api`);
    console.log(`💻 Frontend: http://localhost:3000`);
  }
});

export default app;
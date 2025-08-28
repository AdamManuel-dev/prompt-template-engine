/**
 * @fileoverview Shared constants for the web portal
 * @lastmodified 2025-08-28T10:00:00Z
 *
 * Features: API endpoints, configuration values, error codes
 * Main APIs: API_ENDPOINTS, ERROR_CODES, UI_CONSTANTS
 * Constraints: Must align with backend implementation
 * Patterns: Centralized constants for maintainability
 */

export const API_ENDPOINTS = {
  // Template endpoints
  TEMPLATES: '/api/templates',
  TEMPLATE_BY_ID: (id: string) => `/api/templates/${id}`,
  TEMPLATE_EXECUTE: '/api/templates/execute',
  TEMPLATE_SEARCH: '/api/templates/search',

  // Execution endpoints
  EXECUTIONS: '/api/executions',
  EXECUTION_BY_ID: (id: string) => `/api/executions/${id}`,
  EXECUTION_PROGRESS: (id: string) => `/api/executions/${id}/progress`,
  EXECUTION_HISTORY: '/api/executions/history',

  // Figma integration
  FIGMA_EXTRACT: '/api/figma/extract',
  FIGMA_VALIDATE: '/api/figma/validate',
  FIGMA_TOKENS: '/api/figma/tokens',

  // User management
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_ME: '/api/auth/me',
  USER_PREFERENCES: '/api/user/preferences',
  USER_HISTORY: '/api/user/history',
  USER_FAVORITES: '/api/user/favorites',

  // System
  HEALTH: '/api/health',
  VERSION: '/api/version',
  METRICS: '/api/metrics',
} as const;

export const ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  REQUIRED_FIELD: 'REQUIRED_FIELD',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Template errors
  TEMPLATE_NOT_FOUND: 'TEMPLATE_NOT_FOUND',
  TEMPLATE_LOAD_ERROR: 'TEMPLATE_LOAD_ERROR',
  TEMPLATE_EXECUTION_ERROR: 'TEMPLATE_EXECUTION_ERROR',

  // System errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Integration errors
  FIGMA_API_ERROR: 'FIGMA_API_ERROR',
  FIGMA_ACCESS_DENIED: 'FIGMA_ACCESS_DENIED',
  CLI_EXECUTION_ERROR: 'CLI_EXECUTION_ERROR',
} as const;

export const UI_CONSTANTS = {
  // Pagination
  DEFAULT_PAGE_SIZE: 12,
  MAX_PAGE_SIZE: 50,

  // Search
  MIN_SEARCH_QUERY_LENGTH: 2,
  SEARCH_DEBOUNCE_MS: 300,

  // Execution
  MAX_EXECUTION_TIME_MS: 300000, // 5 minutes
  PROGRESS_POLL_INTERVAL_MS: 1000,

  // File uploads
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_FILE_TYPES: ['application/json', 'text/plain', 'text/markdown'],

  // UI feedback
  TOAST_DURATION_MS: 5000,
  TOOLTIP_DELAY_MS: 500,

  // Form validation
  MIN_PASSWORD_LENGTH: 8,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_TEMPLATE_NAME_LENGTH: 100,
} as const;

export const TEMPLATE_CATEGORIES = [
  'Development',
  'Documentation',
  'Testing',
  'Analysis',
  'Review',
  'Planning',
  'Other',
] as const;

export const TEMPLATE_FORMATS = ['markdown', 'plain', 'json'] as const;

export const USER_ROLES = ['user', 'admin'] as const;

export const EXECUTION_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
] as const;

export const FIGMA_NODE_TYPES = [
  'FRAME',
  'GROUP',
  'TEXT',
  'RECTANGLE',
  'ELLIPSE',
  'COMPONENT',
  'INSTANCE',
] as const;

export const SSE_EVENTS = {
  EXECUTION_PROGRESS: 'execution-progress',
  EXECUTION_COMPLETE: 'execution-complete',
  EXECUTION_ERROR: 'execution-error',
  SYSTEM_NOTIFICATION: 'system-notification',
} as const;

export const LOCAL_STORAGE_KEYS = {
  USER_PREFERENCES: 'cursor-prompt-preferences',
  RECENT_TEMPLATES: 'cursor-prompt-recent-templates',
  FORM_DATA: 'cursor-prompt-form-data',
  AUTH_TOKEN: 'cursor-prompt-auth-token',
} as const;

export const THEME_CONFIG = {
  LIGHT: {
    primary: '#2563eb',
    secondary: '#64748b',
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    background: '#ffffff',
    surface: '#f8fafc',
  },
  DARK: {
    primary: '#3b82f6',
    secondary: '#94a3b8',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    background: '#0f172a',
    surface: '#1e293b',
  },
} as const;

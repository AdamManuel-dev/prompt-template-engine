/**
 * @fileoverview Shared API types for cursor-prompt web portal
 * @lastmodified 2025-08-28T10:00:00Z
 *
 * Features: API request/response types, template schemas, execution interfaces
 * Main APIs: Template, ExecutionRequest, TemplateResponse types
 * Constraints: Must match CLI template engine structure
 * Patterns: Type-safe API contracts, comprehensive template modeling
 */

export interface TemplateMetadata {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  author: {
    name: string;
    verified: boolean;
  };
  version: string;
  created: string;
  updated: string;
  rating: {
    average: number;
    total: number;
  };
  stats: {
    downloads: number;
    favorites: number;
  };
}

export interface TemplateVariable {
  name: string;
  displayName?: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required: boolean;
  defaultValue?: unknown;
  options?: string[]; // For select/enum types
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

export interface TemplateSchema {
  variables: TemplateVariable[];
  examples: Array<{
    name: string;
    description: string;
    variables: Record<string, unknown>;
  }>;
  dependencies?: string[];
}

export interface Template {
  // Flattened template interface for frontend compatibility
  id: string;
  name: string;
  displayName?: string;
  description: string;
  category: string;
  tags: string[];
  author?: {
    name: string;
    verified: boolean;
  };
  version?: string;
  createdAt: string;
  updatedAt: string;
  rating?: {
    average: number;
    total: number;
  };
  stats?: {
    downloads: number;
    favorites: number;
  };

  // Template content and schema
  content: string;
  schema: TemplateSchema;
}

export interface DetailedTemplate extends Template {
  metadata: TemplateMetadata;
}

export interface ExecutionRequest {
  templateId: string;
  variables: Record<string, unknown>;
  options?: {
    format?: 'markdown' | 'plain' | 'json';
    includeGit?: boolean;
    includeFiles?: boolean;
    filePatterns?: string[];
    contextFiles?: string[];
  };
}

export interface ExecutionResult {
  id: string;
  templateId: string;
  content: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  metadata?: {
    executionTime: number;
    contentLength: number;
    variablesUsed: Record<string, unknown>;
  };
  createdAt: string;
  completedAt?: string;
}

export interface ProgressUpdate {
  executionId: string;
  stage: 'initializing' | 'processing' | 'rendering' | 'completed' | 'error';
  message: string;
  progress: number; // 0-100
  timestamp: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    version: string;
  };
}

export interface TemplateListResponse {
  templates: TemplateMetadata[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters?: {
    category?: string;
    tags?: string[];
    search?: string;
  };
}

export interface FigmaIntegration {
  url: string;
  nodeId?: string;
  accessToken?: string;
  extractedTokens?: {
    colors: Record<string, string>;
    typography: Record<string, unknown>;
    spacing: Record<string, number>;
    components: Array<{
      name: string;
      properties: Record<string, unknown>;
    }>;
  };
  screenshots?: Array<{
    nodeId: string;
    url: string;
    width: number;
    height: number;
  }>;
}

export interface UserSession {
  id: string;
  email?: string;
  username?: string;
  name?: string;
  avatar?: string;
  role: 'user' | 'admin';
  preferences: {
    theme: 'light' | 'dark';
    language: string;
    favoriteTemplates: string[];
    recentTemplates: string[];
  };
  permissions: string[];
}

export interface ExecutionHistory {
  id: string;
  templateId: string;
  templateName: string;
  variables: Record<string, unknown>;
  result: ExecutionResult;
  createdAt: string;
  duration: number;
  status: 'success' | 'error';
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    api: 'up' | 'down';
    cli: 'up' | 'down';
    figma: 'up' | 'down';
    database: 'up' | 'down';
  };
  metrics: {
    uptime: number;
    responseTime: number;
    activeExecutions: number;
    errorRate: number;
  };
  lastCheck: string;
}

// Additional types for API client compatibility
export interface TemplateSearchQuery {
  query?: string;
  category?: string;
  tags?: string[];
  author?: string;
  sortBy?: 'name' | 'created' | 'updated' | 'rating' | 'downloads';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TemplateSearchResult {
  templates: TemplateMetadata[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    categories: string[];
    tags: string[];
    authors: string[];
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, 'up' | 'down'>;
  uptime: number;
  version: string;
}

export interface FigmaImportRequest {
  fileUrl: string;
  nodeId?: string;
  accessToken?: string;
  extractComponents?: boolean;
  extractTokens?: boolean;
  includeScreenshots?: boolean;
}

export interface FigmaImportResult {
  success: boolean;
  templateId?: string;
  components: Array<{
    name: string;
    type: string;
    properties: Record<string, unknown>;
  }>;
  designTokens: {
    colors: Record<string, string>;
    typography: Record<string, unknown>;
    spacing: Record<string, number>;
  };
  screenshots: Array<{
    nodeId: string;
    url: string;
    width: number;
    height: number;
  }>;
}

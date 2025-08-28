/**
 * @fileoverview Figma integration types for MCP server proxy and UI components
 * @lastmodified 2025-08-28T10:30:00Z
 * 
 * Features: Figma URL validation, design tokens, MCP proxy types, caching
 * Main APIs: FigmaFileInfo, DesignToken, FigmaPreview, MCPResponse
 * Constraints: Figma API rate limits (30req/min), token validation required
 * Patterns: All responses include error states, caching with TTL
 */

// Figma File Information
export interface FigmaFileInfo {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  lastModified: string;
  version: string;
  document?: FigmaDocument;
}

export interface FigmaDocument {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  children?: FigmaNode[];
  fills?: FigmaFill[];
  strokes?: FigmaStroke[];
  effects?: FigmaEffect[];
  characters?: string;
  style?: FigmaTextStyle;
}

// Design Tokens
export interface DesignToken {
  id: string;
  name: string;
  type: 'color' | 'typography' | 'spacing' | 'shadow' | 'border';
  value: string | number | object;
  category: string;
  description?: string;
  figmaNodeId?: string;
}

export interface ColorToken extends DesignToken {
  type: 'color';
  value: string; // hex, rgb, hsl format
  opacity?: number;
}

export interface TypographyToken extends DesignToken {
  type: 'typography';
  value: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeight: number;
    letterSpacing?: number;
  };
}

export interface SpacingToken extends DesignToken {
  type: 'spacing';
  value: number; // pixels
}

// Figma API Types
export interface FigmaFill {
  type: string;
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  gradientStops?: FigmaGradientStop[];
}

export interface FigmaStroke {
  type: string;
  color: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  weight: number;
}

export interface FigmaEffect {
  type: string;
  color?: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  offset?: {
    x: number;
    y: number;
  };
  radius?: number;
  spread?: number;
}

export interface FigmaGradientStop {
  position: number;
  color: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
}

export interface FigmaTextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing?: number;
  textAlignHorizontal?: string;
  textAlignVertical?: string;
}

// MCP Server Integration
export interface MCPRequest {
  method: string;
  params?: Record<string, any>;
  id?: string | number;
}

export interface MCPResponse<T = any> {
  result?: T;
  error?: MCPError;
  id?: string | number;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// Figma URL and Validation
export interface FigmaUrlInfo {
  isValid: boolean;
  fileId: string | null;
  nodeId: string | null;
  originalUrl: string;
  cleanUrl: string | null;
  error?: string;
}

export interface FigmaApiResponse<T> {
  data?: T;
  error?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  cached?: boolean;
  cacheExpiry?: number;
}

// Preview and Screenshots
export interface FigmaPreview {
  fileId: string;
  nodeId?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  scale: number;
  format: 'png' | 'jpg' | 'svg';
  cached: boolean;
  expiresAt: number;
}

// Caching
export interface FigmaCacheEntry<T> {
  key: string;
  data: T;
  createdAt: number;
  expiresAt: number;
  ttl: number;
}

export interface FigmaCacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  evictions: number;
}

// Rate Limiting
export interface RateLimit {
  remaining: number;
  reset: number;
  limit: number;
  retryAfter?: number;
}

export interface RateLimitError extends Error {
  rateLimitInfo: RateLimit;
  retryAfter: number;
}

// Template Integration
export interface FigmaTemplateParameter {
  key: string;
  value: string | number;
  source: 'design-token' | 'node-property' | 'manual';
  figmaNodeId?: string;
  tokenId?: string;
}

export interface FigmaIntegrationConfig {
  fileId: string;
  accessToken?: string;
  autoExtractTokens: boolean;
  cacheEnabled: boolean;
  cacheTtl: number;
  rateLimitStrategy: 'queue' | 'retry' | 'fail';
  maxRetries: number;
}

// Component States
export interface FigmaComponentState {
  loading: boolean;
  error: string | null;
  fileInfo: FigmaFileInfo | null;
  designTokens: DesignToken[];
  preview: FigmaPreview | null;
  rateLimitInfo: RateLimit | null;
}

// API Endpoints
export interface FigmaEndpoints {
  validateUrl: '/api/figma/validate-url';
  getFileInfo: '/api/figma/file/:fileId';
  getDesignTokens: '/api/figma/file/:fileId/tokens';
  getPreview: '/api/figma/file/:fileId/preview';
  getNodePreview: '/api/figma/file/:fileId/node/:nodeId/preview';
  clearCache: '/api/figma/cache/clear';
  getCacheStats: '/api/figma/cache/stats';
}

// Error Types
export class FigmaApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public rateLimitInfo?: RateLimit
  ) {
    super(message);
    this.name = 'FigmaApiError';
  }
}

export class FigmaUrlValidationError extends Error {
  constructor(message: string, public url: string) {
    super(message);
    this.name = 'FigmaUrlValidationError';
  }
}

export class FigmaCacheError extends Error {
  constructor(message: string, public key: string) {
    super(message);
    this.name = 'FigmaCacheError';
  }
}
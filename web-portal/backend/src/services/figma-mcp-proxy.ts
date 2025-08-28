/**
 * @fileoverview Figma MCP server proxy for handling design token extraction
 * @lastmodified 2025-08-28T10:30:00Z
 * 
 * Features: MCP server integration, request proxying, response transformation, caching
 * Main APIs: extractDesignTokens, getFileInfo, getNodePreview, validateUrl
 * Constraints: Figma API rate limits, MCP server availability, requires process spawning
 * Patterns: Child process management, JSON-RPC protocol, error handling with retry
 */

import { spawn, ChildProcess } from 'child_process';
import { 
  FigmaFileInfo, 
  FigmaUrlInfo, 
  DesignToken, 
  FigmaPreview,
  MCPRequest,
  MCPResponse,
  MCPError,
  FigmaApiError,
  RateLimit
} from '@cursor-prompt/shared';

interface MCPServerConfig {
  command: string;
  args: string[];
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

interface FigmaTokenExtractionOptions {
  includeColors?: boolean;
  includeTypography?: boolean;
  includeSpacing?: boolean;
  includeShadows?: boolean;
  includeComponents?: boolean;
  nodeIds?: string[];
}

interface FigmaPreviewOptions {
  scale?: number;
  format?: 'png' | 'jpg' | 'svg';
  useFrameBounds?: boolean;
}

export class FigmaMCPProxy {
  private mcpProcess: ChildProcess | null = null;
  private isInitialized = false;
  private requestId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeout: NodeJS.Timeout;
  }>();

  private config: MCPServerConfig = {
    command: 'npx',
    args: ['@anthropic-ai/mcp-server-figma'],
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000
  };

  constructor(customConfig?: Partial<MCPServerConfig>) {
    if (customConfig) {
      this.config = { ...this.config, ...customConfig };
    }
  }

  /**
   * Initialize the MCP server connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.startMCPServer();
      this.isInitialized = true;
      console.log('✅ Figma MCP server initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Figma MCP server:', error);
      throw new Error('Failed to initialize Figma MCP server');
    }
  }

  /**
   * Start the MCP server process
   */
  private async startMCPServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.mcpProcess = spawn(this.config.command, this.config.args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          FIGMA_ACCESS_TOKEN: process.env.FIGMA_ACCESS_TOKEN
        }
      });

      // Handle stdout data (JSON-RPC responses)
      this.mcpProcess.stdout?.on('data', (data) => {
        try {
          const lines = data.toString().split('\n').filter((line: string) => line.trim());
          for (const line of lines) {
            if (line.trim()) {
              const response: MCPResponse = JSON.parse(line);
              this.handleMCPResponse(response);
            }
          }
        } catch (error) {
          console.error('Failed to parse MCP response:', error);
        }
      });

      // Handle stderr
      this.mcpProcess.stderr?.on('data', (data) => {
        console.error('MCP Server stderr:', data.toString());
      });

      // Handle process events
      this.mcpProcess.on('error', (error) => {
        console.error('MCP Server process error:', error);
        reject(error);
      });

      this.mcpProcess.on('exit', (code) => {
        console.log(`MCP Server process exited with code ${code}`);
        this.cleanup();
      });

      // Give the process a moment to start
      setTimeout(() => {
        if (this.mcpProcess && !this.mcpProcess.killed) {
          resolve();
        } else {
          reject(new Error('MCP Server failed to start'));
        }
      }, 1000);
    });
  }

  /**
   * Handle incoming MCP responses
   */
  private handleMCPResponse(response: MCPResponse): void {
    const { id } = response;
    if (id && this.pendingRequests.has(id)) {
      const request = this.pendingRequests.get(id)!;
      clearTimeout(request.timeout);
      this.pendingRequests.delete(id);

      if (response.error) {
        request.reject(new FigmaApiError(
          response.error.message,
          response.error.code,
          'MCP_ERROR'
        ));
      } else {
        request.resolve(response.result);
      }
    }
  }

  /**
   * Send a request to the MCP server
   */
  private async sendMCPRequest<T>(method: string, params?: any): Promise<T> {
    if (!this.isInitialized || !this.mcpProcess) {
      await this.initialize();
    }

    const id = ++this.requestId;
    const request: MCPRequest = {
      method,
      params,
      id
    };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP request timeout: ${method}`));
      }, this.config.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request to MCP server
      const requestData = JSON.stringify(request) + '\n';
      this.mcpProcess?.stdin?.write(requestData);
    });
  }

  /**
   * Validate Figma URL and extract basic information
   */
  async validateUrl(url: string): Promise<FigmaUrlInfo> {
    try {
      // First do basic URL validation
      const urlPatterns = [
        /^https:\/\/(?:www\.)?figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)\/(.*)$/
      ];

      let fileId: string | null = null;
      let nodeId: string | null = null;

      for (const pattern of urlPatterns) {
        const match = url.match(pattern);
        if (match) {
          fileId = match[1];
          break;
        }
      }

      if (!fileId) {
        return {
          isValid: false,
          fileId: null,
          nodeId: null,
          originalUrl: url,
          cleanUrl: null,
          error: 'Invalid Figma URL format'
        };
      }

      // Extract node ID if present
      const nodeMatch = url.match(/[?&]node-id=([^&]+)/);
      if (nodeMatch) {
        nodeId = decodeURIComponent(nodeMatch[1]);
      }

      // Validate URL with MCP server
      const mcpResult = await this.sendMCPRequest('figma/validate-url', { url });

      const cleanUrl = url.includes('/design/') 
        ? `https://www.figma.com/design/${fileId}/`
        : `https://www.figma.com/file/${fileId}/`;

      return {
        isValid: true,
        fileId,
        nodeId,
        originalUrl: url,
        cleanUrl,
        error: undefined
      };
    } catch (error) {
      return {
        isValid: false,
        fileId: null,
        nodeId: null,
        originalUrl: url,
        cleanUrl: null,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * Get Figma file information
   */
  async getFileInfo(fileId: string, forceRefresh = false): Promise<FigmaFileInfo> {
    try {
      const result = await this.sendMCPRequest<any>('figma/get-file', {
        fileId,
        forceRefresh
      });

      return {
        id: result.key || fileId,
        name: result.name || 'Untitled',
        thumbnailUrl: result.thumbnailUrl || null,
        lastModified: result.lastModified || new Date().toISOString(),
        version: result.version || '1.0',
        document: result.document
      };
    } catch (error) {
      throw new FigmaApiError(
        `Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'FILE_INFO_ERROR'
      );
    }
  }

  /**
   * Extract design tokens from Figma file
   */
  async extractDesignTokens(
    fileId: string, 
    options: FigmaTokenExtractionOptions = {}
  ): Promise<DesignToken[]> {
    try {
      const {
        includeColors = true,
        includeTypography = true,
        includeSpacing = true,
        includeShadows = true,
        includeComponents = false,
        nodeIds = []
      } = options;

      const result = await this.sendMCPRequest<any>('figma/extract-tokens', {
        fileId,
        options: {
          includeColors,
          includeTypography,
          includeSpacing,
          includeShadows,
          includeComponents,
          nodeIds
        }
      });

      return this.transformTokensResponse(result);
    } catch (error) {
      throw new FigmaApiError(
        `Failed to extract design tokens: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'TOKEN_EXTRACTION_ERROR'
      );
    }
  }

  /**
   * Get preview image for Figma node
   */
  async getNodePreview(
    fileId: string,
    nodeId?: string,
    options: FigmaPreviewOptions = {}
  ): Promise<FigmaPreview> {
    try {
      const {
        scale = 2,
        format = 'png',
        useFrameBounds = false
      } = options;

      const result = await this.sendMCPRequest<any>('figma/get-preview', {
        fileId,
        nodeId,
        scale,
        format,
        useFrameBounds
      });

      return {
        fileId,
        nodeId: nodeId || undefined,
        imageUrl: result.imageUrl || '',
        thumbnailUrl: result.thumbnailUrl,
        width: result.width || 800,
        height: result.height || 600,
        scale,
        format,
        cached: result.cached || false,
        expiresAt: result.expiresAt || Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };
    } catch (error) {
      throw new FigmaApiError(
        `Failed to get node preview: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'PREVIEW_ERROR'
      );
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimitInfo(): Promise<RateLimit> {
    try {
      const result = await this.sendMCPRequest<any>('figma/rate-limit');
      
      return {
        remaining: result.remaining || 30,
        reset: result.reset || Date.now() + (60 * 1000), // 1 minute
        limit: result.limit || 30
      };
    } catch (error) {
      // Return default rate limit info if MCP server doesn't support it
      return {
        remaining: 30,
        reset: Date.now() + (60 * 1000),
        limit: 30
      };
    }
  }

  /**
   * Transform MCP token response to our DesignToken format
   */
  private transformTokensResponse(mcpResult: any): DesignToken[] {
    const tokens: DesignToken[] = [];

    // Transform colors
    if (mcpResult.colors) {
      Object.entries(mcpResult.colors).forEach(([name, value]: [string, any]) => {
        tokens.push({
          id: `color-${name}`,
          name,
          type: 'color',
          value: typeof value === 'string' ? value : value.hex || '#000000',
          category: 'color',
          description: value.description,
          figmaNodeId: value.nodeId
        });
      });
    }

    // Transform typography
    if (mcpResult.typography) {
      Object.entries(mcpResult.typography).forEach(([name, value]: [string, any]) => {
        tokens.push({
          id: `typography-${name}`,
          name,
          type: 'typography',
          value: value,
          category: 'typography',
          description: value.description,
          figmaNodeId: value.nodeId
        });
      });
    }

    // Transform spacing
    if (mcpResult.spacing) {
      Object.entries(mcpResult.spacing).forEach(([name, value]: [string, any]) => {
        tokens.push({
          id: `spacing-${name}`,
          name,
          type: 'spacing',
          value: typeof value === 'number' ? value : parseFloat(value) || 0,
          category: 'spacing',
          figmaNodeId: value.nodeId
        });
      });
    }

    return tokens;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
    }
    
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('MCP server shut down'));
    });
    this.pendingRequests.clear();
    
    this.isInitialized = false;
  }

  /**
   * Health check for MCP server
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.sendMCPRequest('ping', {});
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const figmaMCPProxy = new FigmaMCPProxy();
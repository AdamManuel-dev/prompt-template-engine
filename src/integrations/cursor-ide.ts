/**
 * @fileoverview Cursor IDE integration for template synchronization
 * @lastmodified 2025-08-22T20:30:00Z
 *
 * Features: Template sync, prompt injection, IDE communication
 * Main APIs: CursorIntegration.sync(), inject(), connect()
 * Constraints: Requires Cursor IDE with extension API enabled
 * Patterns: WebSocket communication, event-driven architecture
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { WebSocket } from 'ws';
// Remove invalid import - NodeJS namespace is global
import { logger } from '../utils/logger';
import { ConfigManager } from '../config/config-manager';
import { TemplateEngine } from '../core/template-engine';

// Type declarations
// eslint-disable-next-line import/no-extraneous-dependencies

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Timeout {}
  }
}

export interface CursorTemplate {
  id: string;
  name: string;
  content: string;
  variables?: Record<string, string>;
  metadata?: {
    author?: string;
    version?: string;
    description?: string;
    tags?: string[];
  };
}

export interface CursorConnection {
  connected: boolean;
  endpoint: string;
  version?: string;
}

export interface CursorMessage {
  type: 'sync' | 'inject' | 'update' | 'delete' | 'request' | 'response';
  action: string;
  payload: unknown;
  id?: string;
  timestamp: number;
}

// Interface declaration to resolve no-use-before-define
interface ICursorIntegration {
  sync(): Promise<void>;
  inject(templateId: string, variables?: Record<string, string>): Promise<void>;
  updateTemplate(template: CursorTemplate): Promise<void>;
  getTemplates(): CursorTemplate[];
  isConnected(): boolean;
}

export class CursorIntegration
  extends EventEmitter
  implements ICursorIntegration
{
  private static instance: ICursorIntegration;

  private config: ConfigManager;

  private connection: CursorConnection;

  private templates: Map<string, CursorTemplate> = new Map();

  private syncInterval?: ReturnType<typeof setTimeout>;

  private websocket?: WebSocket;

  private messageQueue: CursorMessage[] = [];

  private templateEngine: TemplateEngine;

  private constructor() {
    super();
    this.config = ConfigManager.getInstance();
    this.templateEngine = new TemplateEngine();
    this.connection = {
      connected: false,
      endpoint: this.config.get('cursor.apiEndpoint', 'http://localhost:3000'),
    };
    this.initialize();
  }

  static getInstance(): CursorIntegration {
    if (!CursorIntegration.instance) {
      CursorIntegration.instance = new CursorIntegration();
    }
    return CursorIntegration.instance as CursorIntegration;
  }

  /**
   * Initialize Cursor integration
   */
  private async initialize(): Promise<void> {
    if (!this.config.get('cursor.integration', true)) {
      logger.info('Cursor IDE integration is disabled');
      return;
    }

    await this.loadLocalTemplates();

    if (this.config.get('cursor.autoSync', false)) {
      await this.startAutoSync();
    }

    this.setupEventListeners();
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.on('connected', () => {
      logger.info('Connected to Cursor IDE');
      this.processMessageQueue();
    });

    this.on('disconnected', () => {
      logger.warn('Disconnected from Cursor IDE');
    });

    this.on('template:updated', (template: CursorTemplate) => {
      logger.debug(`Template updated: ${template.name}`);
    });

    this.on('template:deleted', (templateId: string) => {
      logger.debug(`Template deleted: ${templateId}`);
    });
  }

  /**
   * Connect to Cursor IDE
   */
  async connect(): Promise<boolean> {
    if (this.connection.connected) {
      return true;
    }

    try {
      // Try HTTP first for compatibility
      const response = await this.httpRequest('/api/status');

      // Type guard for response structure
      const apiResponse = response as { status?: string; version?: string };
      if (apiResponse.status === 'ok') {
        this.connection.connected = true;
        this.connection.version = apiResponse.version;
        this.emit('connected');

        // Try to upgrade to WebSocket
        await this.connectWebSocket();

        return true;
      }
    } catch (error: any) {
      logger.error(`Failed to connect to Cursor IDE:${String(error)}`);
    }

    return false;
  }

  /**
   * Connect WebSocket for real-time communication
   */
  private async connectWebSocket(): Promise<void> {
    try {
      const ws = await import('ws');
      const wsEndpoint = `${this.connection.endpoint.replace('http', 'ws')}/ws`;

      const websocket = new ws.WebSocket(wsEndpoint) as WebSocket;
      this.websocket = websocket;

      websocket.on('open', () => {
        logger.debug('WebSocket connection established');
        this.sendMessage({
          type: 'sync',
          action: 'init',
          payload: { version: '1.0.0' },
          timestamp: Date.now(),
        });
      });

      websocket.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as CursorMessage;
          this.handleMessage(message);
        } catch (error: any) {
          logger.error(`Failed to parse WebSocket message:${String(error)}`);
        }
      });

      websocket.on('close', () => {
        logger.debug('WebSocket connection closed');
        this.websocket = undefined;
      });

      websocket.on('error', (error: Error) => {
        logger.error(`WebSocket error:${String(error)}`);
      });
    } catch {
      logger.debug('WebSocket not available, falling back to HTTP');
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: CursorMessage): void {
    logger.debug(`Received message: ${JSON.stringify(message)}`);

    switch (message.type) {
      case 'sync':
        this.handleSyncMessage(message);
        break;
      case 'request':
        this.handleRequestMessage(message);
        break;
      case 'update':
        this.handleUpdateMessage(message);
        break;
      case 'delete':
        this.handleDeleteMessage(message);
        break;
      default:
        logger.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle sync message
   */
  private handleSyncMessage(message: CursorMessage): void {
    if (message.action === 'templates') {
      const templates = message.payload as CursorTemplate[];
      this.syncTemplates(templates);
    }
  }

  /**
   * Handle request message
   */
  private handleRequestMessage(message: CursorMessage): void {
    if (message.action === 'template') {
      const templateId = message.payload as string;
      const template = this.templates.get(templateId);

      if (template) {
        this.sendMessage({
          type: 'response',
          action: 'template',
          payload: template,
          id: message.id,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Handle update message
   */
  private handleUpdateMessage(message: CursorMessage): void {
    const template = message.payload as CursorTemplate;
    this.templates.set(template.id, template);
    this.emit('template:updated', template);
  }

  /**
   * Handle delete message
   */
  private handleDeleteMessage(message: CursorMessage): void {
    const templateId = message.payload as string;
    this.templates.delete(templateId);
    this.emit('template:deleted', templateId);
  }

  /**
   * Send message via WebSocket or queue it
   */
  private sendMessage(message: CursorMessage): void {
    if (this.websocket && this.websocket.readyState === 1) {
      this.websocket.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (
      this.messageQueue.length > 0 &&
      this.websocket &&
      this.websocket.readyState === 1
    ) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  /**
   * Make HTTP request to Cursor API
   */
  private async httpRequest(
    endpoint: string,
    body?: unknown,
    method = 'GET'
  ): Promise<unknown> {
    const url = `${this.connection.endpoint}${endpoint}`;

    try {
      const https = await import('https');
      const http = await import('http');
      const protocol = url.startsWith('https') ? https : http;

      return new Promise((resolve, reject) => {
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
        };

        const req = protocol.request(url, options, res => {
          let data = '';

          res.on('data', chunk => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          });
        });

        req.on('error', reject);

        if (body) {
          req.write(JSON.stringify(body));
        }

        req.end();
      });
    } catch (error: any) {
      logger.error(`HTTP request failed:${String(error)}`);
      throw error;
    }
  }

  /**
   * Load templates from local filesystem
   */
  private async loadLocalTemplates(): Promise<void> {
    const templatesDir = this.config.get('templates.directory', './templates');

    if (!fs.existsSync(templatesDir)) {
      logger.debug(`Templates directory not found: ${templatesDir}`);
      return;
    }

    const files = fs.readdirSync(templatesDir);
    const extension = this.config.get('templates.extension', '.prompt');

    files.forEach(file => {
      if (file.endsWith(extension)) {
        const filePath = path.join(templatesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const id = path.basename(file, extension);

        const template: CursorTemplate = {
          id,
          name: id,
          content,
          metadata: this.extractMetadata(content),
        };

        this.templates.set(id, template);
      }
    });

    logger.info(`Loaded ${this.templates.size} local templates`);
  }

  /**
   * Extract metadata from template content
   */
  // eslint-disable-next-line class-methods-use-this
  private extractMetadata(content: string): CursorTemplate['metadata'] {
    const metadata: CursorTemplate['metadata'] = {};

    // Try to extract YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      try {
        // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
        const yaml = require('js-yaml');
        const parsed = yaml.load(frontmatterMatch[1]);

        if (parsed && typeof parsed === 'object') {
          metadata.author = parsed.author;
          metadata.version = parsed.version;
          metadata.description = parsed.description;
          metadata.tags = parsed.tags;
        }
      } catch (error: any) {
        logger.debug(`Failed to parse frontmatter: ${String(error)}`);
      }
    }

    return metadata;
  }

  /**
   * Sync templates with Cursor IDE
   */
  async sync(): Promise<void> {
    if (!this.connection.connected) {
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Failed to connect to Cursor IDE');
      }
    }

    // Send all local templates
    const templates = Array.from(this.templates.values());

    this.sendMessage({
      type: 'sync',
      action: 'templates',
      payload: templates,
      timestamp: Date.now(),
    });

    logger.info(`Synced ${templates.length} templates with Cursor IDE`);
  }

  /**
   * Sync templates from Cursor IDE
   */
  private syncTemplates(remoteTemplates: CursorTemplate[]): void {
    remoteTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });

    this.emit('templates:synced', remoteTemplates);
    logger.info(`Received ${remoteTemplates.length} templates from Cursor IDE`);
  }

  /**
   * Start automatic synchronization
   */
  private async startAutoSync(): Promise<void> {
    const interval = this.config.get('cursor.syncInterval', 30000);

    this.syncInterval = setInterval(async () => {
      try {
        await this.sync();
      } catch (error: any) {
        logger.error(`Auto-sync failed:${String(error)}`);
      }
    }, interval);

    // Initial sync
    await this.sync();
  }

  /**
   * Stop automatic synchronization
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  /**
   * Inject template into Cursor
   */
  async inject(
    templateId: string,
    variables?: Record<string, string>
  ): Promise<void> {
    const template = this.templates.get(templateId);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Render template with variables
    const rendered = await this.templateEngine.render(
      template.content,
      variables || {}
    );

    // Send to Cursor
    this.sendMessage({
      type: 'inject',
      action: 'prompt',
      payload: {
        templateId,
        content: rendered,
        variables,
      },
      timestamp: Date.now(),
    });

    logger.info(`Injected template ${templateId} into Cursor`);
  }

  /**
   * Update template in Cursor
   */
  async updateTemplate(template: CursorTemplate): Promise<void> {
    this.templates.set(template.id, template);

    this.sendMessage({
      type: 'update',
      action: 'template',
      payload: template,
      timestamp: Date.now(),
    });

    logger.info(`Updated template ${template.id} in Cursor`);
  }

  /**
   * Delete template from Cursor
   */
  async deleteTemplate(templateId: string): Promise<void> {
    this.templates.delete(templateId);

    this.sendMessage({
      type: 'delete',
      action: 'template',
      payload: templateId,
      timestamp: Date.now(),
    });

    logger.info(`Deleted template ${templateId} from Cursor`);
  }

  /**
   * Get all templates
   */
  getTemplates(): CursorTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): CursorTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Disconnect from Cursor IDE
   */
  disconnect(): void {
    this.stopAutoSync();

    if (this.websocket) {
      this.websocket.close();
      this.websocket = undefined;
    }

    this.connection.connected = false;
    this.emit('disconnected');
  }

  /**
   * Check if connected to Cursor
   */
  isConnected(): boolean {
    return this.connection.connected;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): CursorConnection {
    return { ...this.connection };
  }
}

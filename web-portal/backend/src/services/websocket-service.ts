/**
 * @fileoverview WebSocket service for real-time communication with clients
 * @lastmodified 2025-08-28T11:00:00Z
 * 
 * Features: Real-time progress updates, execution notifications, client management
 * Main APIs: broadcast, sendToClient, initialize, close
 * Constraints: Must handle client disconnections, message queuing, connection management
 * Patterns: WebSocket server management, event broadcasting, client tracking
 */

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';
import { ProgressUpdate, ExecutionResult } from '@cursor-prompt/shared';

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  lastSeen: Date;
  subscriptions: Set<string>;
}

export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: string;
  clientId?: string;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients = new Map<string, WebSocketClient>();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue = new Map<string, WebSocketMessage[]>();
  private maxQueueSize = 100;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    console.log('🔗 WebSocket service created');
  }

  /**
   * Initialize WebSocket server with connection handling
   */
  initialize(): void {
    console.log(chalk.blue('🔗 Initializing WebSocket service...'));

    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = uuidv4();
      const client: WebSocketClient = {
        id: clientId,
        ws,
        isAlive: true,
        lastSeen: new Date(),
        subscriptions: new Set()
      };

      this.clients.set(clientId, client);
      
      console.log(chalk.green(`👋 Client connected: ${clientId} (${this.clients.size} total clients)`));

      // Send welcome message
      this.sendToClient(clientId, 'connection', {
        clientId,
        message: 'Connected to Cursor Prompt Web Portal',
        serverTime: new Date().toISOString()
      });

      // Handle incoming messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error(chalk.red(`❌ Invalid message from client ${clientId}:`, error));
          this.sendToClient(clientId, 'error', {
            message: 'Invalid message format',
            error: 'Message must be valid JSON'
          });
        }
      });

      // Handle pong responses for heartbeat
      ws.on('pong', () => {
        client.isAlive = true;
        client.lastSeen = new Date();
      });

      // Handle client disconnection
      ws.on('close', (code: number, reason: Buffer) => {
        console.log(chalk.yellow(`👋 Client disconnected: ${clientId} (code: ${code}, reason: ${reason.toString()})`));
        this.clients.delete(clientId);
        this.messageQueue.delete(clientId);
      });

      // Handle WebSocket errors
      ws.on('error', (error: Error) => {
        console.error(chalk.red(`❌ WebSocket error for client ${clientId}:`, error));
        this.clients.delete(clientId);
        this.messageQueue.delete(clientId);
      });

      // Process any queued messages for this client
      this.processQueuedMessages(clientId);
    });

    // Start heartbeat to detect disconnected clients
    this.startHeartbeat();

    console.log(chalk.green('✅ WebSocket service initialized'));
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(type: string, data: unknown): void {
    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    let sentCount = 0;
    let queuedCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(chalk.red(`❌ Error sending to client ${clientId}:`, error));
          this.queueMessage(clientId, message);
          queuedCount++;
        }
      } else {
        this.queueMessage(clientId, message);
        queuedCount++;
      }
    }

    if (sentCount > 0 || queuedCount > 0) {
      console.log(chalk.blue(`📡 Broadcast '${type}' sent to ${sentCount} clients, queued for ${queuedCount} clients`));
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: string, type: string, data: unknown): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(chalk.yellow(`⚠️ Client ${clientId} not found`));
      return false;
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString(),
      clientId
    };

    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
        console.log(chalk.blue(`📤 Sent '${type}' to client ${clientId}`));
        return true;
      } catch (error) {
        console.error(chalk.red(`❌ Error sending to client ${clientId}:`, error));
        this.queueMessage(clientId, message);
        return false;
      }
    } else {
      this.queueMessage(clientId, message);
      return false;
    }
  }

  /**
   * Send message to subscribed clients
   */
  sendToSubscribers(subscription: string, type: string, data: unknown): void {
    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    let sentCount = 0;
    
    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(subscription)) {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(JSON.stringify(message));
            sentCount++;
          } catch (error) {
            console.error(chalk.red(`❌ Error sending to subscriber ${clientId}:`, error));
            this.queueMessage(clientId, message);
          }
        } else {
          this.queueMessage(clientId, message);
        }
      }
    }

    if (sentCount > 0) {
      console.log(chalk.blue(`📡 Sent '${type}' to ${sentCount} subscribers of '${subscription}'`));
    }
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get active clients (responded to recent heartbeat)
   */
  getActiveClientCount(): number {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return Array.from(this.clients.values()).filter(
      client => client.lastSeen > fiveMinutesAgo
    ).length;
  }

  /**
   * Get WebSocket service statistics
   */
  getStats(): {
    totalClients: number;
    activeClients: number;
    queuedMessages: number;
    uptime: number;
  } {
    const queuedMessages = Array.from(this.messageQueue.values())
      .reduce((total, queue) => total + queue.length, 0);

    return {
      totalClients: this.clients.size,
      activeClients: this.getActiveClientCount(),
      queuedMessages,
      uptime: process.uptime()
    };
  }

  /**
   * Close WebSocket service
   */
  close(): void {
    console.log(chalk.yellow('🔌 Closing WebSocket service...'));

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      try {
        client.ws.close(1000, 'Server shutdown');
      } catch (error) {
        console.error(chalk.red(`❌ Error closing client ${clientId}:`, error));
      }
    }

    // Close WebSocket server
    this.wss.close(() => {
      console.log(chalk.green('✅ WebSocket service closed'));
    });

    this.clients.clear();
    this.messageQueue.clear();
  }

  /**
   * Handle incoming messages from clients
   */
  private handleClientMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastSeen = new Date();

    console.log(chalk.blue(`📥 Message from client ${clientId}: ${message.type}`));

    switch (message.type) {
      case 'ping':
        this.sendToClient(clientId, 'pong', { timestamp: new Date().toISOString() });
        break;

      case 'subscribe':
        if (message.subscription && typeof message.subscription === 'string') {
          client.subscriptions.add(message.subscription);
          this.sendToClient(clientId, 'subscription-confirmed', { 
            subscription: message.subscription 
          });
          console.log(chalk.green(`✅ Client ${clientId} subscribed to '${message.subscription}'`));
        }
        break;

      case 'unsubscribe':
        if (message.subscription && typeof message.subscription === 'string') {
          client.subscriptions.delete(message.subscription);
          this.sendToClient(clientId, 'subscription-cancelled', { 
            subscription: message.subscription 
          });
          console.log(chalk.yellow(`📡 Client ${clientId} unsubscribed from '${message.subscription}'`));
        }
        break;

      case 'get-subscriptions':
        this.sendToClient(clientId, 'subscriptions', {
          subscriptions: Array.from(client.subscriptions)
        });
        break;

      default:
        console.warn(chalk.yellow(`⚠️ Unknown message type from client ${clientId}: ${message.type}`));
        this.sendToClient(clientId, 'error', {
          message: 'Unknown message type',
          receivedType: message.type
        });
    }
  }

  /**
   * Queue message for client when not connected
   */
  private queueMessage(clientId: string, message: WebSocketMessage): void {
    if (!this.messageQueue.has(clientId)) {
      this.messageQueue.set(clientId, []);
    }

    const queue = this.messageQueue.get(clientId)!;
    
    // Add message to queue
    queue.push(message);

    // Maintain queue size limit
    if (queue.length > this.maxQueueSize) {
      queue.shift(); // Remove oldest message
    }

    console.log(chalk.blue(`📥 Queued message '${message.type}' for client ${clientId} (${queue.length} in queue)`));
  }

  /**
   * Process queued messages for a client
   */
  private processQueuedMessages(clientId: string): void {
    const queue = this.messageQueue.get(clientId);
    if (!queue || queue.length === 0) return;

    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    console.log(chalk.blue(`📤 Processing ${queue.length} queued messages for client ${clientId}`));

    let processedCount = 0;
    const messages = [...queue]; // Copy to avoid modification during iteration
    
    for (const message of messages) {
      try {
        client.ws.send(JSON.stringify(message));
        processedCount++;
      } catch (error) {
        console.error(chalk.red(`❌ Error sending queued message to client ${clientId}:`, error));
        break; // Stop processing if sending fails
      }
    }

    // Remove processed messages from queue
    if (processedCount > 0) {
      queue.splice(0, processedCount);
      console.log(chalk.green(`✅ Sent ${processedCount} queued messages to client ${clientId}`));
    }

    // Clean up empty queue
    if (queue.length === 0) {
      this.messageQueue.delete(clientId);
    }
  }

  /**
   * Start heartbeat to detect disconnected clients
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const deadClients: string[] = [];

      for (const [clientId, client] of this.clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          if (!client.isAlive) {
            // Client didn't respond to previous ping
            deadClients.push(clientId);
            client.ws.terminate();
          } else {
            // Send ping and mark as not alive until pong received
            client.isAlive = false;
            client.ws.ping();
          }
        } else {
          // Connection is not open
          deadClients.push(clientId);
        }
      }

      // Clean up dead clients
      deadClients.forEach(clientId => {
        this.clients.delete(clientId);
        this.messageQueue.delete(clientId);
      });

      if (deadClients.length > 0) {
        console.log(chalk.yellow(`🧹 Cleaned up ${deadClients.length} dead client connections`));
      }

    }, 30000); // Heartbeat every 30 seconds

    console.log(chalk.green('💓 WebSocket heartbeat started (30s interval)'));
  }
}
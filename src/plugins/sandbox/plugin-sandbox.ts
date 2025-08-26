/**
 * @fileoverview Secure plugin sandbox using worker threads
 * @lastmodified 2025-08-23T05:30:00Z
 *
 * Features: Secure plugin execution with resource limits and timeouts
 * Main APIs: PluginSandbox class for isolated plugin execution
 * Constraints: Uses worker_threads for isolation, resource limitations
 * Patterns: Sandbox pattern, worker threads, message passing, timeout handling
 */

import { Worker } from 'worker_threads';
import * as path from 'path';
import * as fs from 'fs/promises';
import { IPlugin } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Plugin sandbox configuration
 */
export interface SandboxConfig {
  // Resource limits
  maxMemoryMB: number;
  maxExecutionTimeMs: number;
  maxCpuUsagePercent: number;
  timeout?: number; // Alias for maxExecutionTimeMs
  memoryLimit?: number; // Alias for maxMemoryMB

  // File system access
  allowedReadPaths: string[];
  allowedWritePaths: string[];

  // Network access
  allowNetworkAccess: boolean;
  allowedHosts?: string[];

  // API permissions
  allowedAPIs: string[];
}

/**
 * Partial sandbox config for creating instances with minimal config
 */
export type PartialSandboxConfig = Partial<SandboxConfig> & {
  timeout?: number;
  memoryLimit?: number;
};

/**
 * Default sandbox configuration
 */
export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  maxMemoryMB: 50,
  maxExecutionTimeMs: 10000, // 10 seconds
  maxCpuUsagePercent: 80,
  allowedReadPaths: ['./plugins'],
  allowedWritePaths: ['./plugins/data'],
  allowNetworkAccess: false,
  allowedAPIs: ['log', 'storage', 'fs'],
};

/**
 * Plugin execution result
 */
export interface PluginExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  stats: {
    executionTime: number;
    memoryUsed: number;
    cpuUsage: number;
  };
}

/**
 * Message types for worker communication
 */
export interface WorkerMessage {
  type: 'execute' | 'api-call' | 'terminate' | 'result' | 'error' | 'log';
  id: string;
  data?: unknown;
}

/**
 * Secure plugin sandbox using worker threads
 */
export class PluginSandbox {
  private workers = new Map<string, Worker>();

  private config: SandboxConfig;
  // Message handlers would be used for complex async operations

  constructor(config: PartialSandboxConfig = DEFAULT_SANDBOX_CONFIG) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_SANDBOX_CONFIG,
      ...config,
    };

    // Handle aliases
    if (config.timeout && !this.config.maxExecutionTimeMs) {
      this.config.maxExecutionTimeMs = config.timeout;
    }
    if (config.memoryLimit && !this.config.maxMemoryMB) {
      this.config.maxMemoryMB = Math.round(config.memoryLimit / (1024 * 1024));
    }
  }

  /**
   * Execute a plugin in a secure sandbox
   */
  async executePlugin(
    plugin: IPlugin,
    method: string,
    args: unknown[] = [],
    customConfig?: Partial<SandboxConfig>
  ): Promise<PluginExecutionResult> {
    const executionId = this.generateExecutionId();
    const finalConfig = { ...this.config, ...customConfig };

    return new Promise((resolve, reject) => {
      try {
        const startTime = Date.now();
        const worker = this.createSecureWorker(
          executionId,
          plugin,
          method,
          args,
          finalConfig
        );

        // Set up timeout
        const timeout = setTimeout(() => {
          this.terminateWorker(executionId);
          resolve({
            success: false,
            error: 'Plugin execution timed out',
            stats: {
              executionTime: Date.now() - startTime,
              memoryUsed: 0,
              cpuUsage: 0,
            },
          });
        }, finalConfig.maxExecutionTimeMs);

        // Handle worker messages
        worker.on('message', (message: WorkerMessage) => {
          if (message.id !== executionId) return;

          clearTimeout(timeout);

          if (message.type === 'result') {
            const executionTime = Date.now() - startTime;
            resolve({
              success: true,
              result: message.data,
              stats: {
                executionTime,
                memoryUsed: 0, // Would need additional monitoring
                cpuUsage: 0,
              },
            });
          } else if (message.type === 'error') {
            resolve({
              success: false,
              error: message.data as string,
              stats: {
                executionTime: Date.now() - startTime,
                memoryUsed: 0,
                cpuUsage: 0,
              },
            });
          } else if (message.type === 'api-call') {
            // Handle API calls from the plugin
            this.handleAPICall(worker, message);
          }
        });

        worker.on('error', error => {
          clearTimeout(timeout);
          this.terminateWorker(executionId);
          resolve({
            success: false,
            error: error.message,
            stats: {
              executionTime: Date.now() - startTime,
              memoryUsed: 0,
              cpuUsage: 0,
            },
          });
        });

        worker.on('exit', code => {
          clearTimeout(timeout);
          this.workers.delete(executionId);
          if (code !== 0) {
            resolve({
              success: false,
              error: `Worker exited with code ${code}`,
              stats: {
                executionTime: Date.now() - startTime,
                memoryUsed: 0,
                cpuUsage: 0,
              },
            });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create a secure worker for plugin execution
   */
  private createSecureWorker(
    executionId: string,
    plugin: IPlugin,
    method: string,
    args: unknown[],
    config: SandboxConfig
  ): Worker {
    const workerScript = path.join(__dirname, 'plugin-worker.js');

    const worker = new Worker(workerScript, {
      workerData: {
        executionId,
        plugin: this.serializePlugin(plugin),
        method,
        args,
        config,
      },
      resourceLimits: {
        maxOldGenerationSizeMb: config.maxMemoryMB,
        maxYoungGenerationSizeMb: Math.floor(config.maxMemoryMB / 4),
        codeRangeSizeMb: Math.floor(config.maxMemoryMB / 8),
      },
    });

    this.workers.set(executionId, worker);
    return worker;
  }

  /**
   * Handle API calls from plugins
   */
  private async handleAPICall(
    worker: Worker,
    message: WorkerMessage
  ): Promise<void> {
    const apiCall = message.data as { method: string; args: unknown[] };

    try {
      let result: unknown;

      switch (apiCall.method) {
        case 'log':
          logger.info(`[Plugin] ${apiCall.args[0]}`);
          result = undefined;
          break;

        case 'storage.get':
          result = await this.handleStorageGet(apiCall.args[0] as string);
          break;

        case 'storage.set':
          result = await this.handleStorageSet(
            apiCall.args[0] as string,
            apiCall.args[1]
          );
          break;

        case 'fs.readFile':
          result = await this.handleFileRead(apiCall.args[0] as string);
          break;

        case 'fs.writeFile':
          result = await this.handleFileWrite(
            apiCall.args[0] as string,
            apiCall.args[1] as string
          );
          break;

        default:
          throw new Error(`Unauthorized API call: ${apiCall.method}`);
      }

      worker.postMessage({
        type: 'result',
        id: message.id,
        data: result,
      });
    } catch (error: any) {
      worker.postMessage({
        type: 'error',
        id: message.id,
        data: error.message,
      });
    }
  }

  /**
   * Handle storage operations with sandboxing
   */
  private async handleStorageGet(key: string): Promise<unknown> {
    try {
      const dataFile = path.join('./plugins/data', `${key}.json`);
      const data = await fs.readFile(dataFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async handleStorageSet(key: string, value: unknown): Promise<void> {
    const dataDir = './plugins/data';
    const dataFile = path.join(dataDir, `${key}.json`);

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(dataFile, JSON.stringify(value, null, 2));
  }

  /**
   * Handle file operations with path validation
   */
  private async handleFileRead(filePath: string): Promise<string> {
    const normalizedPath = path.normalize(filePath);

    // Check if path is allowed
    const isAllowed = this.config.allowedReadPaths.some(allowedPath =>
      normalizedPath.startsWith(path.normalize(allowedPath))
    );

    if (!isAllowed) {
      throw new Error(`Access denied: ${filePath}`);
    }

    return fs.readFile(normalizedPath, 'utf8');
  }

  private async handleFileWrite(
    filePath: string,
    content: string
  ): Promise<void> {
    const normalizedPath = path.normalize(filePath);

    // Check if path is allowed for writing
    const isAllowed = this.config.allowedWritePaths.some(allowedPath =>
      normalizedPath.startsWith(path.normalize(allowedPath))
    );

    if (!isAllowed) {
      throw new Error(`Write access denied: ${filePath}`);
    }

    await fs.mkdir(path.dirname(normalizedPath), { recursive: true });
    await fs.writeFile(normalizedPath, content);
  }

  /**
   * Terminate a worker
   */
  private async terminateWorker(executionId: string): Promise<void> {
    const worker = this.workers.get(executionId);
    if (worker) {
      await worker.terminate();
      this.workers.delete(executionId);
    }
  }

  /**
   * Terminate all workers
   */
  async cleanup(): Promise<void> {
    const terminations = Array.from(this.workers.keys()).map(id =>
      this.terminateWorker(id)
    );
    await Promise.all(terminations);
  }

  /**
   * Serialize plugin for worker transfer
   */
  private serializePlugin(plugin: IPlugin): string {
    return JSON.stringify({
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      dependencies: plugin.dependencies,
      permissions: plugin.permissions,
      priority: plugin.priority,
      defaultConfig: plugin.defaultConfig,
      // Convert functions to strings
      init: plugin.init.toString(),
      activate: plugin.activate?.toString(),
      deactivate: plugin.deactivate?.toString(),
      dispose: plugin.dispose?.toString(),
      execute: plugin.execute?.toString(),
      hooks: plugin.hooks
        ? Object.fromEntries(
            Object.entries(plugin.hooks).map(([key, fn]) => [
              key,
              fn.toString(),
            ])
          )
        : undefined,
    });
  }

  /**
   * Execute code directly in sandbox (simplified for testing)
   */
  async execute(code: string, context: unknown): Promise<unknown> {
    try {
      // Simplified code execution for testing - in production this would use workers
      const result = new Function(
        'context',
        `
        'use strict';
        ${code}
      `
      )(context);
      return result;
    } catch (error: any) {
      throw new Error(`Sandbox execution failed: ${error.message}`);
    }
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `plugin-exec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

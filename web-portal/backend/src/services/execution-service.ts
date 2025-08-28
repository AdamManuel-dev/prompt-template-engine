/**
 * @fileoverview Execution service for managing template execution lifecycle
 * @lastmodified 2025-08-28T11:00:00Z
 * 
 * Features: Execution management, progress tracking, history, concurrent execution handling
 * Main APIs: startExecution, getExecution, cancelExecution, getExecutionHistory
 * Constraints: Must handle concurrent executions, provide real-time progress, manage execution state
 * Patterns: Event emitter pattern, in-memory execution tracking, async execution management
 */

import { EventEmitter } from 'events';
import NodeCache from 'node-cache';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

import { 
  ExecutionRequest, 
  ExecutionResult, 
  ProgressUpdate,
  Template,
  validateTemplateVariables
} from '@cursor-prompt/shared';
import { CLIService, CLIExecutionOptions } from './cli-service';
import { TemplateService } from './template-service';

export interface ExecutionOptions extends CLIExecutionOptions {
  onProgress?: (progress: ProgressUpdate) => void;
}

export interface ExecutionHistoryOptions {
  page?: number;
  limit?: number;
  status?: string;
  templateId?: string;
  userId?: string;
}

export interface ExecutionHistoryResult {
  executions: ExecutionResult[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ExecutionService extends EventEmitter {
  private cliService: CLIService;
  private templateService: TemplateService;
  private executionCache: NodeCache;
  private executionHistory: ExecutionResult[] = [];
  private activeExecutions = new Map<string, ExecutionResult>();
  private maxHistorySize = 1000;

  constructor(cliService: CLIService, templateService?: TemplateService) {
    super();
    this.cliService = cliService;
    this.templateService = templateService || new TemplateService(cliService);
    
    // Cache for execution results (1 hour TTL)
    this.executionCache = new NodeCache({ 
      stdTTL: 3600, 
      checkperiod: 600,
      useClones: false 
    });

    // Listen to CLI service progress events
    this.cliService.on('progress', (progress: ProgressUpdate) => {
      this.emit('progress', progress);
    });

    console.log('⚙️ Execution service initialized');
  }

  /**
   * Start a new template execution
   */
  async startExecution(
    request: ExecutionRequest, 
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const executionId = uuidv4();
    
    console.log(chalk.blue(`🚀 Starting execution ${executionId} for template ${request.templateId}`));

    // Validate the request
    await this.validateExecutionRequest(request);

    // Create initial execution result
    const execution: ExecutionResult = {
      id: executionId,
      templateId: request.templateId,
      content: '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Store in active executions
    this.activeExecutions.set(executionId, execution);
    this.executionCache.set(executionId, execution);

    // Start execution asynchronously
    this.executeAsync(execution, request, options);

    return execution;
  }

  /**
   * Get execution status and result
   */
  async getExecution(executionId: string): Promise<ExecutionResult | null> {
    // Check active executions first
    const activeExecution = this.activeExecutions.get(executionId);
    if (activeExecution) {
      return activeExecution;
    }

    // Check cache
    const cachedExecution = this.executionCache.get<ExecutionResult>(executionId);
    if (cachedExecution) {
      return cachedExecution;
    }

    // Check history
    const historicalExecution = this.executionHistory.find(e => e.id === executionId);
    if (historicalExecution) {
      return historicalExecution;
    }

    return null;
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    console.log(chalk.yellow(`⏹️ Cancelling execution: ${executionId}`));

    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    // Only cancel if still running
    if (execution.status === 'pending' || execution.status === 'running') {
      // Try to cancel CLI execution
      const cancelled = await this.cliService.cancelExecution(executionId);
      
      // Update execution status
      execution.status = 'failed';
      execution.error = 'Execution cancelled by user';
      execution.completedAt = new Date().toISOString();
      
      // Move to history
      this.moveToHistory(execution);
      
      // Emit progress update
      this.emit('progress', {
        executionId,
        stage: 'error',
        message: 'Execution cancelled',
        progress: 0,
        timestamp: new Date().toISOString()
      } as ProgressUpdate);

      console.log(chalk.yellow(`✅ Execution ${executionId} cancelled`));
      return true;
    }

    return false;
  }

  /**
   * Get execution history with pagination and filtering
   */
  async getExecutionHistory(options: ExecutionHistoryOptions = {}): Promise<ExecutionHistoryResult> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 20));
    
    let filteredExecutions = [...this.executionHistory];

    // Apply filters
    if (options.status) {
      filteredExecutions = filteredExecutions.filter(e => e.status === options.status);
    }

    if (options.templateId) {
      filteredExecutions = filteredExecutions.filter(e => e.templateId === options.templateId);
    }

    // Sort by creation date (newest first)
    filteredExecutions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedExecutions = filteredExecutions.slice(offset, offset + limit);
    const totalPages = Math.ceil(filteredExecutions.length / limit);

    console.log(`📚 Retrieved ${paginatedExecutions.length} executions from history (page ${page}/${totalPages})`);

    return {
      executions: paginatedExecutions,
      pagination: {
        page,
        limit,
        total: filteredExecutions.length,
        totalPages
      }
    };
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): ExecutionResult[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): {
    active: number;
    total: number;
    completed: number;
    failed: number;
    averageExecutionTime: number;
  } {
    const active = this.activeExecutions.size;
    const total = this.executionHistory.length + active;
    const completed = this.executionHistory.filter(e => e.status === 'completed').length;
    const failed = this.executionHistory.filter(e => e.status === 'failed').length;
    
    const completedExecutions = this.executionHistory.filter(e => 
      e.status === 'completed' && e.metadata?.executionTime
    );
    
    const averageExecutionTime = completedExecutions.length > 0 
      ? completedExecutions.reduce((sum, e) => sum + (e.metadata?.executionTime || 0), 0) / completedExecutions.length
      : 0;

    return {
      active,
      total,
      completed,
      failed,
      averageExecutionTime
    };
  }

  /**
   * Clear execution history
   */
  clearHistory(): void {
    console.log('🧹 Clearing execution history...');
    this.executionHistory = [];
    this.executionCache.flushAll();
  }

  /**
   * Validate execution request
   */
  private async validateExecutionRequest(request: ExecutionRequest): Promise<void> {
    // Validate template exists
    try {
      const template = await this.templateService.getTemplate(request.templateId);
      
      // Validate variables against template schema
      const validation = validateTemplateVariables(request.variables, template.schema.variables);
      
      if (!validation.valid) {
        const errorMessages = validation.errors.map(e => e.message).join(', ');
        throw new Error(`Template variable validation failed: ${errorMessages}`);
      }

      if (validation.warnings && validation.warnings.length > 0) {
        console.log(chalk.yellow('⚠️ Template variable warnings:'), validation.warnings.map(w => w.message));
      }

    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new Error(`Template not found: ${request.templateId}`);
      }
      throw error;
    }
  }

  /**
   * Execute template asynchronously
   */
  private async executeAsync(
    execution: ExecutionResult, 
    request: ExecutionRequest, 
    options: ExecutionOptions
  ): Promise<void> {
    try {
      // Update status to running
      execution.status = 'running';
      this.activeExecutions.set(execution.id, execution);
      this.executionCache.set(execution.id, execution);

      // Execute via CLI service
      const result = await this.cliService.executeTemplate(request, {
        ...options,
        onProgress: (progress: ProgressUpdate) => {
          // Emit progress to listeners
          this.emit('progress', progress);
          
          // Call user-provided progress callback
          if (options.onProgress) {
            options.onProgress(progress);
          }
        }
      });

      // Update execution with results
      Object.assign(execution, result);
      
      // Move to history
      this.moveToHistory(execution);

      // Emit completion event
      this.emit('execution-complete', execution);

      console.log(chalk.green(`✅ Execution ${execution.id} completed successfully`));

    } catch (error) {
      console.error(chalk.red(`❌ Execution ${execution.id} failed:`, error));

      // Update execution with error
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = new Date().toISOString();

      // Move to history
      this.moveToHistory(execution);

      // Emit error event
      this.emit('execution-error', execution);
    }
  }

  /**
   * Move execution from active to history
   */
  private moveToHistory(execution: ExecutionResult): void {
    // Remove from active executions
    this.activeExecutions.delete(execution.id);

    // Add to history
    this.executionHistory.unshift(execution);

    // Maintain history size limit
    if (this.executionHistory.length > this.maxHistorySize) {
      const removed = this.executionHistory.splice(this.maxHistorySize);
      // Remove old executions from cache as well
      removed.forEach(e => this.executionCache.del(e.id));
    }

    // Update cache
    this.executionCache.set(execution.id, execution);
  }
}
/**
 * @fileoverview CLI integration service for spawning and managing CLI processes
 * @lastmodified 2025-08-28T10:30:00Z
 * 
 * Features: CLI process spawning, output parsing, error handling, process management
 * Main APIs: executeTemplate, listTemplates, validateTemplate, getTemplateInfo
 * Constraints: Must handle CLI timeouts, concurrent executions, error parsing  
 * Patterns: Child process management, stream handling, promise-based API
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

import { 
  ExecutionRequest, 
  ExecutionResult, 
  Template, 
  TemplateMetadata,
  ProgressUpdate 
} from '@cursor-prompt/shared';

export interface CLIExecutionOptions {
  timeout?: number;
  workingDirectory?: string;
  environment?: Record<string, string>;
  onProgress?: (progress: ProgressUpdate) => void;
}

export interface CLICommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error?: Error;
  executionTime: number;
}

export class CLIService extends EventEmitter {
  private cliPath: string;
  private activeProcesses = new Map<string, ChildProcess>();
  private processTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(cliPath: string) {
    super();
    this.cliPath = cliPath;
    this.validateCLIPath();
  }

  private async validateCLIPath(): Promise<void> {
    try {
      await fs.access(this.cliPath);
      console.log(chalk.green(`✅ CLI found at: ${this.cliPath}`));
    } catch (error) {
      console.error(chalk.red(`❌ CLI not found at: ${this.cliPath}`));
      throw new Error(`CLI executable not found at ${this.cliPath}`);
    }
  }

  /**
   * Execute a template with variables using the CLI
   */
  async executeTemplate(
    request: ExecutionRequest,
    options: CLIExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const startTime = Date.now();
    
    console.log(chalk.blue(`🚀 Starting execution ${executionId} for template ${request.templateId}`));

    const result: ExecutionResult = {
      id: executionId,
      templateId: request.templateId,
      content: '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      // Emit initial progress
      this.emitProgress(executionId, 'initializing', 'Starting template execution...', 0, options.onProgress);

      // Build CLI arguments
      const args = this.buildExecuteArgs(request);
      
      // Execute CLI command
      this.emitProgress(executionId, 'processing', 'Running CLI command...', 25, options.onProgress);
      
      const cliResult = await this.runCLICommand(args, {
        ...options,
        onProgress: (message, progress) => {
          this.emitProgress(executionId, 'processing', message, 25 + (progress * 0.5), options.onProgress);
        }
      } as CLIExecutionOptions & { onProgress: (message: string, progress: number) => void });

      if (!cliResult.success) {
        throw new Error(`CLI execution failed: ${cliResult.stderr || cliResult.error?.message}`);
      }

      // Parse CLI output
      this.emitProgress(executionId, 'rendering', 'Processing output...', 75, options.onProgress);
      
      const content = this.parseCLIOutput(cliResult.stdout, request.options?.format || 'markdown');
      
      // Complete execution
      this.emitProgress(executionId, 'completed', 'Template execution completed', 100, options.onProgress);

      result.content = content;
      result.status = 'completed';
      result.completedAt = new Date().toISOString();
      result.metadata = {
        executionTime: Date.now() - startTime,
        contentLength: content.length,
        variablesUsed: request.variables
      };

      console.log(chalk.green(`✅ Execution ${executionId} completed in ${result.metadata.executionTime}ms`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Execution ${executionId} failed:`, error));
      
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      result.completedAt = new Date().toISOString();
      result.metadata = {
        executionTime: Date.now() - startTime,
        contentLength: 0,
        variablesUsed: request.variables
      };

      this.emitProgress(executionId, 'error', `Execution failed: ${result.error}`, 0, options.onProgress);
    }

    return result;
  }

  /**
   * List all available templates using CLI
   */
  async listTemplates(options: { category?: string; search?: string } = {}): Promise<TemplateMetadata[]> {
    console.log(chalk.blue('📋 Listing templates...'));

    const args = ['list', '--format', 'json'];
    
    if (options.category) {
      args.push('--category', options.category);
    }
    
    if (options.search) {
      args.push('--search', options.search);
    }

    const result = await this.runCLICommand(args);
    
    if (!result.success) {
      throw new Error(`Failed to list templates: ${result.stderr}`);
    }

    try {
      const templates = this.parseCLITemplateList(result.stdout);
      console.log(chalk.green(`✅ Found ${templates.length} templates`));
      return templates;
    } catch (error) {
      console.error(chalk.red('❌ Failed to parse template list:', error));
      throw new Error(`Failed to parse template list: ${error}`);
    }
  }

  /**
   * Get detailed information about a specific template
   */
  async getTemplate(templateId: string): Promise<Template> {
    console.log(chalk.blue(`📄 Getting template info for: ${templateId}`));

    // First get template metadata
    const listResult = await this.runCLICommand(['list', '--format', 'json', '--search', templateId]);
    
    if (!listResult.success) {
      throw new Error(`Failed to get template info: ${listResult.stderr}`);
    }

    const templates = this.parseCLITemplateList(listResult.stdout);
    const templateMetadata = templates.find(t => t.id === templateId || t.name === templateId);
    
    if (!templateMetadata) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Get template content and schema by running validate with detailed output
    const validateResult = await this.runCLICommand([
      'validate', 
      templateId, 
      '--format', 
      'json', 
      '--detailed'
    ]);

    let schema = { variables: [], examples: [] };
    let content = '';

    if (validateResult.success) {
      try {
        const validationData = JSON.parse(validateResult.stdout);
        schema = validationData.schema || schema;
        content = validationData.content || '';
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Could not parse validation output: ${error}`));
      }
    }

    console.log(chalk.green(`✅ Retrieved template: ${templateMetadata.name}`));

    return {
      id: templateMetadata.id,
      name: templateMetadata.name,
      displayName: templateMetadata.displayName,
      description: templateMetadata.description,
      category: templateMetadata.category,
      tags: templateMetadata.tags,
      author: templateMetadata.author,
      version: templateMetadata.version,
      createdAt: templateMetadata.created,
      updatedAt: templateMetadata.updated,
      rating: templateMetadata.rating,
      stats: templateMetadata.stats,
      content,
      schema
    };
  }

  /**
   * Validate a template using CLI
   */
  async validateTemplate(templatePath: string): Promise<{ valid: boolean; errors: string[]; warnings?: string[] }> {
    console.log(chalk.blue(`🔍 Validating template: ${templatePath}`));

    const result = await this.runCLICommand([
      'validate',
      templatePath,
      '--format',
      'json',
      '--detailed'
    ]);

    if (!result.success) {
      return {
        valid: false,
        errors: [result.stderr || 'Validation failed']
      };
    }

    try {
      const validation = JSON.parse(result.stdout);
      console.log(chalk.green(`✅ Template validation complete`));
      return validation;
    } catch (error) {
      return {
        valid: false,
        errors: [`Failed to parse validation result: ${error}`]
      };
    }
  }

  /**
   * Cancel a running execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const process = this.activeProcesses.get(executionId);
    const timeout = this.processTimeouts.get(executionId);

    if (timeout) {
      clearTimeout(timeout);
      this.processTimeouts.delete(executionId);
    }

    if (process && !process.killed) {
      console.log(chalk.yellow(`⏹️ Cancelling execution: ${executionId}`));
      process.kill('SIGTERM');
      this.activeProcesses.delete(executionId);
      return true;
    }

    return false;
  }

  /**
   * Get status of all active executions
   */
  getActiveExecutions(): string[] {
    return Array.from(this.activeProcesses.keys());
  }

  /**
   * Build CLI arguments for template execution
   */
  private buildExecuteArgs(request: ExecutionRequest): string[] {
    const args = ['generate', request.templateId];

    // Add variables as JSON string
    if (Object.keys(request.variables).length > 0) {
      args.push('--variables', JSON.stringify(request.variables));
    }

    // Add format option
    if (request.options?.format) {
      args.push('--format', request.options.format);
    }

    // Add context options
    if (request.options?.includeGit) {
      args.push('--include-git');
    }

    if (request.options?.includeFiles) {
      args.push('--include-files');
    }

    if (request.options?.filePatterns?.length) {
      args.push('--file-patterns', request.options.filePatterns.join(','));
    }

    if (request.options?.contextFiles?.length) {
      args.push('--context-files', request.options.contextFiles.join(','));
    }

    return args;
  }

  /**
   * Run a CLI command with proper error handling and process management
   */
  private runCLICommand(
    args: string[], 
    options: CLIExecutionOptions & { onProgress?: (message: string, progress: number) => void } = {}
  ): Promise<CLICommandResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const executionId = uuidv4();

      console.log(chalk.gray(`🔧 Running CLI: ${this.cliPath} ${args.join(' ')}`));

      const child = spawn('node', [this.cliPath, ...args], {
        cwd: options.workingDirectory || process.cwd(),
        env: {
          ...process.env,
          ...options.environment
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.activeProcesses.set(executionId, child);

      let stdout = '';
      let stderr = '';
      let resolved = false;

      const cleanup = () => {
        if (this.processTimeouts.has(executionId)) {
          clearTimeout(this.processTimeouts.get(executionId)!);
          this.processTimeouts.delete(executionId);
        }
        this.activeProcesses.delete(executionId);
      };

      const resolveOnce = (result: CLICommandResult) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      // Set up timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          child.kill('SIGTERM');
          resolveOnce({
            success: false,
            stdout,
            stderr,
            exitCode: null,
            error: new Error('CLI command timed out'),
            executionTime: Date.now() - startTime
          });
        }
      }, options.timeout || 300000); // 5 minute default timeout

      this.processTimeouts.set(executionId, timeout);

      // Handle stdout
      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Try to extract progress information
        if (options.onProgress) {
          this.extractProgressFromOutput(chunk, options.onProgress);
        }
      });

      // Handle stderr
      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process exit
      child.on('close', (code: number | null) => {
        resolveOnce({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code,
          executionTime: Date.now() - startTime
        });
      });

      // Handle process errors
      child.on('error', (error: Error) => {
        resolveOnce({
          success: false,
          stdout,
          stderr,
          exitCode: null,
          error,
          executionTime: Date.now() - startTime
        });
      });
    });
  }

  /**
   * Parse CLI output based on format
   */
  private parseCLIOutput(output: string, format: string): string {
    // Remove CLI formatting and extract content
    let content = output;

    // Remove common CLI output patterns
    content = content.replace(/^═+$/gm, '');
    content = content.replace(/^Generated Prompt:$/gm, '');
    content = content.replace(/^═+$/gm, '');
    
    // Clean up extra whitespace
    content = content.trim();

    // For JSON format, try to extract just the content
    if (format === 'json') {
      try {
        const parsed = JSON.parse(content);
        return parsed.content || content;
      } catch {
        // If parsing fails, return as-is
        return content;
      }
    }

    return content;
  }

  /**
   * Parse CLI template list output
   */
  private parseCLITemplateList(output: string): TemplateMetadata[] {
    try {
      // The CLI should output JSON format
      const parsed = JSON.parse(output);
      
      if (Array.isArray(parsed)) {
        return parsed.map(this.normalizeTemplateMetadata);
      }
      
      if (parsed.templates && Array.isArray(parsed.templates)) {
        return parsed.templates.map(this.normalizeTemplateMetadata);
      }

      throw new Error('Unexpected CLI output format');
    } catch (error) {
      console.error(chalk.red('Failed to parse CLI template list:', error));
      throw error;
    }
  }

  /**
   * Normalize template metadata from CLI output to our interface
   */
  private normalizeTemplateMetadata(cliTemplate: any): TemplateMetadata {
    return {
      id: cliTemplate.id || cliTemplate.name || 'unknown',
      name: cliTemplate.name || 'Unknown',
      displayName: cliTemplate.displayName || cliTemplate.name || 'Unknown',
      description: cliTemplate.description || '',
      category: cliTemplate.category || 'Other',
      tags: Array.isArray(cliTemplate.tags) ? cliTemplate.tags : [],
      author: {
        name: cliTemplate.author?.name || 'Unknown',
        verified: cliTemplate.author?.verified || false
      },
      version: cliTemplate.version || cliTemplate.currentVersion || '1.0.0',
      created: cliTemplate.created || new Date().toISOString(),
      updated: cliTemplate.updated || new Date().toISOString(),
      rating: {
        average: cliTemplate.rating?.average || 0,
        total: cliTemplate.rating?.total || 0
      },
      stats: {
        downloads: cliTemplate.stats?.downloads || 0,
        favorites: cliTemplate.stats?.favorites || 0
      }
    };
  }

  /**
   * Extract progress information from CLI output
   */
  private extractProgressFromOutput(output: string, onProgress: (message: string, progress: number) => void): void {
    // Look for progress indicators in the output
    const progressPatterns = [
      /Processing.*?(\d+)%/i,
      /Loading.*?(\d+)%/i,
      /Generating.*?(\d+)%/i,
      /(\d+)%.*?complete/i
    ];

    for (const pattern of progressPatterns) {
      const match = output.match(pattern);
      if (match && match[1]) {
        const progress = parseInt(match[1], 10);
        onProgress(`Processing: ${progress}%`, progress);
        return;
      }
    }

    // Look for stage indicators
    const stagePatterns = [
      { pattern: /loading.*?template/i, message: 'Loading template...', progress: 10 },
      { pattern: /processing.*?variables/i, message: 'Processing variables...', progress: 30 },
      { pattern: /rendering.*?content/i, message: 'Rendering content...', progress: 60 },
      { pattern: /applying.*?transforms/i, message: 'Applying transforms...', progress: 80 }
    ];

    for (const stage of stagePatterns) {
      if (stage.pattern.test(output)) {
        onProgress(stage.message, stage.progress);
        return;
      }
    }
  }

  /**
   * Emit progress update with proper error handling
   */
  private emitProgress(
    executionId: string,
    stage: ProgressUpdate['stage'],
    message: string,
    progress: number,
    callback?: (progress: ProgressUpdate) => void
  ): void {
    const progressUpdate: ProgressUpdate = {
      executionId,
      stage,
      message,
      progress: Math.min(100, Math.max(0, progress)),
      timestamp: new Date().toISOString()
    };

    try {
      this.emit('progress', progressUpdate);
      if (callback) {
        callback(progressUpdate);
      }
    } catch (error) {
      console.error(chalk.red('Error emitting progress:'), error);
    }
  }
}
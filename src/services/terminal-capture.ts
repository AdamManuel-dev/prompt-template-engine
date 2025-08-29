/**
 * @fileoverview Terminal output capture service for command execution context
 * @lastmodified 2025-08-22T15:10:00Z
 *
 * Features: Captures terminal output, command history, error streams
 * Main APIs: captureCommand(), getLastOutput(), getHistory()
 * Constraints: Memory-aware with size limits, async execution
 * Patterns: Command execution with output capture, history management
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  timestamp: Date;
  cwd: string;
}

export interface TerminalHistory {
  commands: CommandResult[];
  maxSize: number;
  totalCommands: number;
}

export interface CaptureOptions {
  timeout?: number;
  maxBuffer?: number;
  cwd?: string;
  env?: typeof process.env;
  shell?: string;
  encoding?:
    | 'ascii'
    | 'utf8'
    | 'utf-8'
    | 'utf16le'
    | 'ucs2'
    | 'ucs-2'
    | 'base64'
    | 'base64url'
    | 'latin1'
    | 'binary'
    | 'hex';
}

const DEFAULT_CAPTURE_OPTIONS: CaptureOptions = {
  timeout: 30000, // 30 seconds
  maxBuffer: 1024 * 1024, // 1MB
  encoding: 'utf8',
};

export class TerminalCaptureService {
  private history: CommandResult[] = [];

  private maxHistorySize: number = 50;

  private maxOutputSize: number = 100 * 1024; // 100KB per output

  private shellHistoryFile: string | null = null;

  constructor(options: { maxHistory?: number; maxOutputSize?: number } = {}) {
    this.maxHistorySize = options.maxHistory || 50;
    this.maxOutputSize = options.maxOutputSize || 100 * 1024;
    this.detectShellHistoryFile();
  }

  /**
   * Detect shell history file location
   */
  private detectShellHistoryFile(): void {
    const homeDir = os.homedir();
    const shell = process.env.SHELL || '';

    if (shell.includes('zsh')) {
      this.shellHistoryFile = path.join(homeDir, '.zsh_history');
    } else if (shell.includes('bash')) {
      this.shellHistoryFile = path.join(homeDir, '.bash_history');
    } else if (shell.includes('fish')) {
      this.shellHistoryFile = path.join(
        homeDir,
        '.local',
        'share',
        'fish',
        'fish_history'
      );
    }

    // Verify the file exists
    if (this.shellHistoryFile && !fs.existsSync(this.shellHistoryFile)) {
      this.shellHistoryFile = null;
    }
  }

  /**
   * Capture command output
   */
  async captureCommand(
    command: string,
    options: CaptureOptions = {}
  ): Promise<CommandResult> {
    const opts = { ...DEFAULT_CAPTURE_OPTIONS, ...options };
    const startTime = Date.now();

    const result: CommandResult = {
      command,
      stdout: '',
      stderr: '',
      exitCode: 0,
      duration: 0,
      timestamp: new Date(),
      cwd: opts.cwd || process.cwd(),
    };

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: opts.timeout,
        maxBuffer: opts.maxBuffer,
        cwd: opts.cwd,
        env: opts.env,
        shell: opts.shell,
        encoding: opts.encoding,
      });

      result.stdout = this.truncateOutput(stdout || '');
      result.stderr = this.truncateOutput(stderr || '');
      result.exitCode = 0;
    } catch (error: unknown) {
      const err = error as {
        stdout?: string;
        stderr?: string;
        message?: string;
        code?: number;
      };
      result.stdout = this.truncateOutput(err.stdout || '');
      result.stderr = this.truncateOutput(err.stderr || err.message || '');
      result.exitCode = err.code || 1;
    }

    result.duration = Date.now() - startTime;
    this.addToHistory(result);

    return result;
  }

  /**
   * Capture streaming command output
   */
  async captureStreamingCommand(
    command: string,
    args: string[] = [],
    options: CaptureOptions = {}
  ): Promise<CommandResult> {
    const opts = { ...DEFAULT_CAPTURE_OPTIONS, ...options };
    const startTime = Date.now();

    return new Promise(resolve => {
      const result: CommandResult = {
        command: `${command} ${args.join(' ')}`,
        stdout: '',
        stderr: '',
        exitCode: 0,
        duration: 0,
        timestamp: new Date(),
        cwd: opts.cwd || process.cwd(),
      };

      const child = spawn(command, args, {
        cwd: opts.cwd,
        env: opts.env,
        shell: opts.shell,
        timeout: opts.timeout,
      });

      let stdoutBuffer = '';
      let stderrBuffer = '';

      child.stdout?.on('data', data => {
        const chunk = data.toString();
        stdoutBuffer += chunk;

        // Truncate if getting too large
        if (stdoutBuffer.length > this.maxOutputSize) {
          stdoutBuffer = stdoutBuffer.slice(-this.maxOutputSize);
        }
      });

      child.stderr?.on('data', data => {
        const chunk = data.toString();
        stderrBuffer += chunk;

        if (stderrBuffer.length > this.maxOutputSize) {
          stderrBuffer = stderrBuffer.slice(-this.maxOutputSize);
        }
      });

      child.on('close', code => {
        result.stdout = this.truncateOutput(stdoutBuffer);
        result.stderr = this.truncateOutput(stderrBuffer);
        result.exitCode = code || 0;
        result.duration = Date.now() - startTime;

        this.addToHistory(result);
        resolve(result);
      });

      child.on('error', error => {
        result.stderr = error.message;
        result.exitCode = 1;
        result.duration = Date.now() - startTime;

        this.addToHistory(result);
        resolve(result);
      });
    });
  }

  /**
   * Get shell command history
   */
  async getShellHistory(limit: number = 20): Promise<string[]> {
    if (!this.shellHistoryFile) {
      return [];
    }

    try {
      const content = await fs.promises.readFile(this.shellHistoryFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      // Handle different history formats
      const commands: string[] = [];

      lines.forEach(line => {
        // Zsh history format: ": timestamp:duration;command"
        if (line.startsWith(': ')) {
          const match = line.match(/^: \d+:\d+;(.*)$/);
          if (match && match[1]) {
            commands.push(match[1]);
          }
        } else {
          // Bash and other formats
          commands.push(line);
        }
      });

      return commands.slice(-limit);
    } catch {
      return [];
    }
  }

  /**
   * Capture the output of the last terminal command
   */
  async captureLastTerminalOutput(): Promise<string | null> {
    // This is platform-specific and requires terminal integration
    // For now, return the last captured command from our history
    if (this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      if (last) {
        return last.stdout || last.stderr || null;
      }
    }
    return null;
  }

  /**
   * Add command result to history
   */
  private addToHistory(result: CommandResult): void {
    this.history.push(result);

    // Maintain max history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Truncate output to max size
   */
  private truncateOutput(output: string): string {
    if (output.length <= this.maxOutputSize) {
      return output;
    }

    const truncated = output.slice(0, this.maxOutputSize);
    return `${truncated}\n... (truncated - ${output.length - this.maxOutputSize} bytes omitted)`;
  }

  /**
   * Get the last command result
   */
  getLastCommand(): CommandResult | null {
    return this.history.length > 0
      ? this.history[this.history.length - 1] || null
      : null;
  }

  /**
   * Get command history
   */
  getHistory(limit?: number): CommandResult[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Get history summary
   */
  getHistorySummary(): TerminalHistory {
    return {
      commands: this.history,
      maxSize: this.maxHistorySize,
      totalCommands: this.history.length,
    };
  }

  /**
   * Search history for commands
   */
  searchHistory(pattern: string | RegExp): CommandResult[] {
    const regex =
      typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

    return this.history.filter(
      cmd =>
        regex.test(cmd.command) ||
        regex.test(cmd.stdout) ||
        regex.test(cmd.stderr)
    );
  }

  /**
   * Get failed commands
   */
  getFailedCommands(): CommandResult[] {
    return this.history.filter(cmd => cmd.exitCode !== 0);
  }

  /**
   * Get commands by working directory
   */
  getCommandsByCwd(cwd: string): CommandResult[] {
    return this.history.filter(cmd => cmd.cwd === cwd);
  }

  /**
   * Export history to file
   */
  async exportHistory(
    filePath: string,
    format: 'json' | 'text' = 'json'
  ): Promise<void> {
    if (format === 'json') {
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(this.history, null, 2),
        'utf8'
      );
    } else {
      const text = this.history
        .map(cmd => {
          const lines = [
            `Command: ${cmd.command}`,
            `Date: ${cmd.timestamp.toISOString()}`,
            `Exit Code: ${cmd.exitCode}`,
            `Duration: ${cmd.duration}ms`,
          ];

          if (cmd.stdout) {
            lines.push(`Output:\n${cmd.stdout}`);
          }

          if (cmd.stderr) {
            lines.push(`Error:\n${cmd.stderr}`);
          }

          return lines.join('\n');
        })
        .join(`\n${'='.repeat(50)}\n`);

      await fs.promises.writeFile(filePath, text, 'utf8');
    }
  }

  /**
   * Import history from file
   */
  async importHistory(filePath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const imported = JSON.parse(content) as CommandResult[];

      // Convert date strings back to Date objects
      imported.forEach(cmd => {
        // eslint-disable-next-line no-param-reassign
        cmd.timestamp = new Date(cmd.timestamp);
      });

      this.history = [...this.history, ...imported].slice(-this.maxHistorySize);
    } catch (error: unknown) {
      throw new Error(`Failed to import history: ${error}`);
    }
  }

  /**
   * Get formatted output for context
   */
  getContextOutput(): string {
    if (this.history.length === 0) {
      return 'No terminal history available';
    }

    const recent = this.history.slice(-3);
    const lines: string[] = [];

    recent.forEach((cmd, index) => {
      lines.push(`[${index + 1}] ${cmd.command}`);
      if (cmd.exitCode !== 0) {
        lines.push(`    Exit: ${cmd.exitCode}`);
      }
      if (cmd.stdout) {
        const preview = cmd.stdout.split('\n').slice(0, 3).join('\n    ');
        lines.push(`    Output: ${preview}`);
      }
    });

    return lines.join('\n');
  }
}

// Export singleton instance
export const terminalCapture = new TerminalCaptureService();

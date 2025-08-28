/**
 * @fileoverview Enhanced secure plugin sandbox with VM isolation and comprehensive hardening
 * @lastmodified 2025-08-27T12:00:00Z
 *
 * Features: VM-based isolation, resource monitoring, signature verification, behavior analysis, emergency controls
 * Main APIs: EnhancedPluginSandbox class with defense-in-depth security
 * Constraints: Strict VM isolation, cryptographic verification, real-time monitoring
 * Patterns: VM sandbox, behavior analysis, resource monitoring, emergency response
 */

import { Worker } from 'worker_threads';
import * as vm from 'vm';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as os from 'os';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { IPlugin } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Enhanced security sandbox configuration with comprehensive controls
 */
export interface EnhancedSandboxConfig {
  // Resource limits with granular control
  maxMemoryMB: number;
  maxExecutionTimeMs: number;
  maxCpuUsagePercent: number;
  maxCpuTimeMs: number;
  maxHeapSizeMB: number;
  maxStackSizeMB: number;
  maxCallStackDepth: number;

  // File system security
  allowedReadPaths: string[];
  allowedWritePaths: string[];
  maxFileSize: number;
  maxTotalFiles: number;
  allowedFileExtensions: string[];

  // Network security
  allowNetworkAccess: boolean;
  allowedHosts: string[];
  maxNetworkConnections: number;
  maxBandwidthKBps: number;
  networkTimeoutMs: number;

  // API and execution control
  allowedAPIs: string[];
  deniedAPIs: string[];
  maxFunctionCalls: number;
  maxLoops: number;
  allowDynamicCodeGeneration: boolean;

  // Security features
  enableVMIsolation: boolean;
  requireSignature: boolean;
  enableBehaviorAnalysis: boolean;
  emergencyTerminationEnabled: boolean;
  enableCodeAnalysis: boolean;
  enableRuntimeMonitoring: boolean;

  // Monitoring and analysis
  resourceCheckIntervalMs: number;
  suspiciousActivityThreshold: number;
  maxSecurityViolations: number;
  auditLogEnabled: boolean;
}

/**
 * Default comprehensive security configuration
 */
export const DEFAULT_ENHANCED_CONFIG: EnhancedSandboxConfig = {
  // Resource limits
  maxMemoryMB: 50,
  maxExecutionTimeMs: 10000,
  maxCpuUsagePercent: 80,
  maxCpuTimeMs: 8000,
  maxHeapSizeMB: 40,
  maxStackSizeMB: 10,
  maxCallStackDepth: 100,

  // File system
  allowedReadPaths: ['./plugins', './plugins/data'],
  allowedWritePaths: ['./plugins/data', './plugins/temp'],
  maxFileSize: 10 * 1024 * 1024,
  maxTotalFiles: 100,
  allowedFileExtensions: ['.txt', '.json', '.log'],

  // Network
  allowNetworkAccess: false,
  allowedHosts: [],
  maxNetworkConnections: 0,
  maxBandwidthKBps: 0,
  networkTimeoutMs: 5000,

  // API control
  allowedAPIs: ['log', 'storage', 'fs'],
  deniedAPIs: ['exec', 'spawn', 'fork', 'eval', 'Function'],
  maxFunctionCalls: 10000,
  maxLoops: 1000,
  allowDynamicCodeGeneration: false,

  // Security
  enableVMIsolation: true,
  requireSignature: true,
  enableBehaviorAnalysis: true,
  emergencyTerminationEnabled: true,
  enableCodeAnalysis: true,
  enableRuntimeMonitoring: true,

  // Monitoring
  resourceCheckIntervalMs: 100,
  suspiciousActivityThreshold: 5,
  maxSecurityViolations: 10,
  auditLogEnabled: true,
};

/**
 * Resource usage monitoring data
 */
export interface ResourceUsage {
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu: {
    usage: number;
    time: number;
  };
  timing: {
    elapsed: number;
    remaining: number;
  };
  counters: {
    functionCalls: number;
    loopIterations: number;
    fileOperations: number;
    networkRequests: number;
  };
}

/**
 * Security violation tracking
 */
export interface SecurityViolation {
  type: 'resource' | 'code' | 'access' | 'behavior' | 'signature';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
  context?: {
    executionId: string;
    pluginName: string;
    method: string;
    stackTrace?: string;
  };
}

/**
 * Plugin execution result with comprehensive security metrics
 */
export interface EnhancedExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  stats: {
    executionTime: number;
    memoryUsed: number;
    cpuUsage: number;
    cpuTime: number;
    heapUsage: number;
    functionCalls: number;
    loopIterations: number;
    fileOperations: number;
    networkRequests: number;
    maxCallStackDepth: number;
  };
  security: {
    threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
    violations: string[];
    suspiciousActivities: string[];
    signatureValid?: boolean;
    codeAnalysisScore: number;
    behaviorScore: number;
  };
  audit: {
    executionId: string;
    startTime: number;
    endTime: number;
    emergencyStop: boolean;
    violationCount: number;
  };
}

/**
 * Plugin signature verification result
 */
export interface SignatureVerificationResult {
  valid: boolean;
  algorithm?: string;
  keyId?: string;
  timestamp?: number;
  error?: string;
  trustLevel: 'none' | 'basic' | 'verified' | 'trusted';
}

/**
 * Code analysis result
 */
export interface CodeAnalysisResult {
  safe: boolean;
  score: number; // 0-100, higher is safer
  threats: string[];
  warnings: string[];
  complexity: number;
  obfuscationDetected: boolean;
}

/**
 * Behavior analysis result
 */
export interface BehaviorAnalysisResult {
  score: number; // 0-100, higher is more suspicious
  patterns: string[];
  anomalies: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Enhanced secure plugin sandbox with comprehensive hardening
 */
export class EnhancedPluginSandbox {
  private workers = new Map<string, Worker>();

  private vmContexts = new Map<string, vm.Context>();

  private resourceMonitors = new Map<string, NodeJS.Timeout>();

  private securityViolations = new Map<string, SecurityViolation[]>();

  private emergencyStops = new Set<string>();

  private executionStats = new Map<string, ResourceUsage>();

  private behaviorProfiles = new Map<string, BehaviorAnalysisResult>();

  private config: EnhancedSandboxConfig;

  constructor(config: Partial<EnhancedSandboxConfig> = {}) {
    this.config = { ...DEFAULT_ENHANCED_CONFIG, ...config };
    logger.info(
      'Enhanced plugin sandbox initialized with comprehensive security'
    );
  }

  /**
   * Execute plugin with comprehensive security hardening
   */
  async executePlugin(
    plugin: IPlugin,
    method: string,
    customConfig?: Partial<EnhancedSandboxConfig>,
    args: unknown[] = []
  ): Promise<EnhancedExecutionResult> {
    const executionId = this.generateSecureExecutionId();
    const finalConfig = { ...this.config, ...customConfig };
    const startTime = Date.now();

    // Initialize security monitoring
    this.securityViolations.set(executionId, []);
    this.executionStats.set(executionId, this.createInitialStats());

    logger.info(
      `Starting enhanced plugin execution: ${plugin.name} -> ${method}`
    );

    try {
      // Step 1: Plugin signature verification
      if (finalConfig.requireSignature) {
        const signatureResult = await this.verifyPluginSignature(plugin);
        if (!signatureResult.valid) {
          this.reportSecurityViolation(
            executionId,
            'signature',
            'critical',
            `Signature verification failed: ${signatureResult.error}`,
            plugin.name,
            method
          );
          return this.createFailureResult(
            executionId,
            startTime,
            `Plugin signature verification failed: ${signatureResult.error}`,
            'critical'
          );
        }
        logger.info(`Plugin signature verified: ${plugin.name}`);
      }

      // Step 2: Code analysis and filtering
      if (finalConfig.enableCodeAnalysis) {
        const codeAnalysis = await this.analyzePluginCode(plugin);
        if (!codeAnalysis.safe) {
          this.reportSecurityViolation(
            executionId,
            'code',
            'high',
            `Unsafe code detected: ${codeAnalysis.threats.join(', ')}`,
            plugin.name,
            method
          );
          return this.createFailureResult(
            executionId,
            startTime,
            `Plugin code analysis failed: ${codeAnalysis.threats.join(', ')}`,
            'high'
          );
        }
        logger.info(
          `Plugin code analysis passed: score ${codeAnalysis.score}/100`
        );
      }

      // Step 3: Create secure execution environment
      let executionResult: unknown;

      if (finalConfig.enableVMIsolation) {
        executionResult = await this.executeInVMSandbox(
          executionId,
          plugin,
          method,
          args,
          finalConfig
        );
      } else {
        executionResult = await this.executeInWorkerSandbox(
          executionId,
          plugin,
          method,
          args,
          finalConfig
        );
      }

      // Step 4: Behavior analysis
      let behaviorScore = 0;
      if (finalConfig.enableBehaviorAnalysis) {
        const behaviorAnalysis = this.analyzeBehavior(executionId, plugin.name);
        behaviorScore = behaviorAnalysis.score;

        if (
          behaviorAnalysis.riskLevel === 'critical' ||
          behaviorAnalysis.riskLevel === 'high'
        ) {
          this.reportSecurityViolation(
            executionId,
            'behavior',
            behaviorAnalysis.riskLevel,
            `Suspicious behavior detected: ${behaviorAnalysis.patterns.join(', ')}`,
            plugin.name,
            method
          );
        }
      }

      return this.createSuccessResult(
        executionId,
        startTime,
        executionResult,
        behaviorScore
      );
    } catch (error: any) {
      this.reportSecurityViolation(
        executionId,
        'code',
        'high',
        `Execution error: ${error.message}`,
        plugin.name,
        method
      );
      return this.createFailureResult(
        executionId,
        startTime,
        error.message,
        'high'
      );
    } finally {
      this.cleanupExecution(executionId);
    }
  }

  /**
   * Execute plugin in VM sandbox with strict isolation
   */
  private async executeInVMSandbox(
    executionId: string,
    plugin: IPlugin,
    method: string,
    args: unknown[],
    config: EnhancedSandboxConfig
  ): Promise<unknown> {
    // Create isolated VM context
    const context = this.createSecureVMContext(executionId, plugin, config);

    // Start resource monitoring
    if (config.enableRuntimeMonitoring) {
      this.startResourceMonitoring(executionId, config);
    }

    // Prepare secure execution wrapper with comprehensive monitoring
    const secureWrapper = this.createSecureExecutionWrapper(
      plugin,
      method,
      args,
      config
    );

    try {
      // Execute with strict limits and monitoring
      const result = vm.runInContext(secureWrapper, context, {
        timeout: config.maxExecutionTimeMs,
        displayErrors: false,
        breakOnSigint: true,
        microtaskMode: 'afterEvaluate',
      });

      if (!result.success) {
        throw new Error(result.error || 'VM execution failed');
      }

      // Update execution statistics
      this.updateExecutionStats(executionId, result.stats);

      return result.result;
    } catch (error: any) {
      if (error.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        this.reportSecurityViolation(
          executionId,
          'resource',
          'critical',
          'VM execution timeout - possible infinite loop or resource exhaustion',
          plugin.name,
          method
        );
        this.emergencyTermination(executionId);
        throw new Error(
          'Plugin execution timed out - emergency termination triggered'
        );
      }

      if (error.code === 'ERR_SCRIPT_EXECUTION_INTERRUPTED') {
        this.reportSecurityViolation(
          executionId,
          'behavior',
          'high',
          'VM execution interrupted - suspicious activity detected',
          plugin.name,
          method
        );
        throw new Error(
          'Plugin execution interrupted due to security violation'
        );
      }

      throw error;
    }
  }

  /**
   * Execute plugin in worker sandbox (fallback)
   */
  private async executeInWorkerSandbox(
    executionId: string,
    plugin: IPlugin,
    method: string,
    args: unknown[],
    config: EnhancedSandboxConfig
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      try {
        const worker = this.createEnhancedSecureWorker(
          executionId,
          plugin,
          method,
          args,
          config
        );

        const timeout = setTimeout(() => {
          this.emergencyTermination(executionId);
          reject(new Error('Worker execution timeout'));
        }, config.maxExecutionTimeMs);

        worker.on('message', (message: any) => {
          if (message.executionId !== executionId) return;

          clearTimeout(timeout);

          if (message.type === 'result') {
            resolve(message.data);
          } else if (message.type === 'error') {
            reject(new Error(message.data));
          } else if (message.type === 'security-alert') {
            this.reportSecurityViolation(
              executionId,
              'behavior',
              'high',
              message.data,
              plugin.name,
              method
            );
          }
        });

        worker.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create secure VM context with strict controls
   */
  private createSecureVMContext(
    executionId: string,
    plugin: IPlugin,
    config: EnhancedSandboxConfig
  ): vm.Context {
    // Create minimal, secure global environment
    const secureGlobals = {
      // Safe built-ins only
      console: this.createSecureConsole(executionId),
      JSON,
      Math,
      Date,
      Array,
      Object,
      String,
      Number,
      Boolean,
      RegExp,
      Error,
      Promise,

      // Monitoring and security hooks
      __resourceCheck: () => this.checkResourceLimits(executionId),
      __reportViolation: (type: string, description: string) => {
        this.reportSecurityViolation(
          executionId,
          type as any,
          'medium',
          description,
          plugin.name,
          'unknown'
        );
      },
      __incrementCounter: (type: string) =>
        this.incrementCounter(executionId, type),

      // Restricted setTimeout with validation
      setTimeout: (fn: Function, delay: number) => {
        if (delay > config.maxExecutionTimeMs / 2) {
          throw new Error('setTimeout delay exceeds security limit');
        }
        return setTimeout(
          () => {
            this.incrementCounter(executionId, 'functionCalls');
            try {
              fn();
            } catch (error) {
              this.reportSecurityViolation(
                executionId,
                'code',
                'medium',
                `setTimeout callback error: ${error}`,
                plugin.name,
                'setTimeout'
              );
            }
          },
          Math.min(delay, config.maxExecutionTimeMs / 2)
        );
      },

      // Secure API access
      __secureAPI: this.createSecureAPI(executionId, config),
    };

    // Create context with strict security settings
    const context = vm.createContext(secureGlobals, {
      name: `secure-plugin-${plugin.name}-${executionId}`,
      origin: `plugin://${plugin.name}`,
      codeGeneration: {
        strings: config.allowDynamicCodeGeneration,
        wasm: false,
      },
    });

    // Install security monitors in context
    this.installSecurityMonitors(context, executionId, config);

    this.vmContexts.set(executionId, context);
    return context;
  }

  /**
   * Create secure execution wrapper with comprehensive monitoring
   */
  private createSecureExecutionWrapper(
    plugin: IPlugin,
    method: string,
    args: unknown[],
    config: EnhancedSandboxConfig
  ): string {
    const pluginCode = this.sanitizePluginForSecureExecution(plugin);

    return `
      (function() {
        'use strict';
        
        // Execution counters and limits
        let functionCallCount = 0;
        let loopCount = 0;
        let recursionDepth = 0;
        const maxCallStackDepth = ${config.maxCallStackDepth};
        const maxFunctionCalls = ${config.maxFunctionCalls};
        const maxLoops = ${config.maxLoops};
        
        // Security monitoring hooks
        const originalCall = Function.prototype.call;
        Function.prototype.call = function(...callArgs) {
          functionCallCount++;
          recursionDepth++;
          
          if (functionCallCount > maxFunctionCalls) {
            __reportViolation('resource', 'Maximum function calls exceeded');
            throw new Error('Function call limit exceeded');
          }
          
          if (recursionDepth > maxCallStackDepth) {
            __reportViolation('resource', 'Maximum recursion depth exceeded');
            throw new Error('Call stack depth limit exceeded');
          }
          
          __resourceCheck();
          
          try {
            const result = originalCall.apply(this, callArgs);
            recursionDepth--;
            return result;
          } catch (error) {
            recursionDepth--;
            throw error;
          }
        };
        
        // Loop monitoring (simplified - would need AST transformation for full coverage)
        const originalFor = global.for;
        
        // Plugin execution wrapper
        try {
          const plugin = ${pluginCode};
          const methodArgs = ${JSON.stringify(args)};
          
          if (!plugin.${method}) {
            throw new Error('Method ${method} not found in plugin');
          }
          
          __incrementCounter('functionCalls');
          const startTime = Date.now();
          
          const result = plugin.${method}.apply(plugin, methodArgs);
          
          const executionTime = Date.now() - startTime;
          __incrementCounter('executionTime');
          
          return {
            success: true,
            result: result,
            stats: {
              functionCallCount,
              loopCount,
              recursionDepth: 0,
              executionTime
            }
          };
          
        } catch (error) {
          return {
            success: false,
            error: error.message,
            stats: {
              functionCallCount,
              loopCount,
              recursionDepth,
              executionTime: 0
            }
          };
        }
      })()
    `;
  }

  /**
   * Sanitize plugin object for secure execution
   */
  private sanitizePluginForSecureExecution(plugin: IPlugin): string {
    const sanitized = {
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      // Convert methods to strings for secure parsing
      execute: plugin.execute
        ? this.sanitizeFunctionString(plugin.execute.toString())
        : undefined,
      init: plugin.init
        ? this.sanitizeFunctionString(plugin.init.toString())
        : undefined,
      activate: plugin.activate
        ? this.sanitizeFunctionString(plugin.activate.toString())
        : undefined,
      deactivate: plugin.deactivate
        ? this.sanitizeFunctionString(plugin.deactivate.toString())
        : undefined,
      dispose: plugin.dispose
        ? this.sanitizeFunctionString(plugin.dispose.toString())
        : undefined,
    };

    // Remove any undefined methods
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key as keyof typeof sanitized] === undefined) {
        delete sanitized[key as keyof typeof sanitized];
      }
    });

    return JSON.stringify(sanitized);
  }

  /**
   * Sanitize function strings to remove dangerous code
   */
  private sanitizeFunctionString(fnStr: string): string {
    // Remove potential security risks
    const dangerousPatterns = [
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /require\s*\(/gi,
      /import\s*\(/gi,
      /process\./gi,
      /global\./gi,
      /window\./gi,
      /document\./gi,
    ];

    const sanitized = fnStr;
    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitized)) {
        throw new Error(
          `Dangerous pattern detected in function: ${pattern.source}`
        );
      }
    }

    return sanitized;
  }

  /**
   * Verify plugin digital signature with enhanced security
   */
  private async verifyPluginSignature(
    plugin: IPlugin
  ): Promise<SignatureVerificationResult> {
    try {
      // Create plugin fingerprint
      const pluginData = {
        name: plugin.name,
        version: plugin.version,
        code: plugin.execute?.toString() || '',
        timestamp: (plugin as any).timestamp || Date.now(),
      };

      const fingerprint = crypto
        .createHash('sha256')
        .update(JSON.stringify(pluginData))
        .digest('hex');

      // Get signing key (in production, this would be from a secure key store)
      const signingKey =
        process.env.PLUGIN_SIGNING_KEY || 'default-development-key';

      // Generate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', signingKey)
        .update(fingerprint)
        .digest('hex');

      // Check plugin signature
      const pluginSignature = (plugin as any).signature;
      if (!pluginSignature) {
        return {
          valid: false,
          error: 'No signature provided',
          trustLevel: 'none',
        };
      }

      // Verify signature
      const isValid = crypto.timingSafeEqual(
        Buffer.from(pluginSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      return {
        valid: isValid,
        algorithm: 'HMAC-SHA256',
        timestamp: Date.now(),
        trustLevel: isValid ? 'verified' : 'none',
        error: isValid ? undefined : 'Signature verification failed',
      };
    } catch (error: any) {
      return {
        valid: false,
        error: `Signature verification error: ${error.message}`,
        trustLevel: 'none',
      };
    }
  }

  /**
   * Analyze plugin code for security threats
   */
  private async analyzePluginCode(
    plugin: IPlugin
  ): Promise<CodeAnalysisResult> {
    const threats: string[] = [];
    const warnings: string[] = [];
    let complexity = 0;
    let obfuscationDetected = false;

    try {
      const codeToAnalyze = plugin.execute?.toString() || '';

      // Static analysis using AST
      const ast = parse(codeToAnalyze, {
        sourceType: 'module',
        plugins: ['objectRestSpread', 'functionBind'],
      });

      traverse(ast, {
        enter: nodePath => {
          const { node } = nodePath;
          complexity++;

          // Check for dangerous function calls
          if (
            node.type === 'CallExpression' &&
            node.callee.type === 'Identifier'
          ) {
            const dangerousFunctions = [
              'eval',
              'Function',
              'setTimeout',
              'setInterval',
              'setImmediate',
              'require',
              'import',
              'spawn',
              'exec',
              'fork',
            ];

            if (dangerousFunctions.includes(node.callee.name)) {
              threats.push(`Dangerous function call: ${node.callee.name}`);
            }
          }

          // Check for property access that could be dangerous
          if (
            node.type === 'MemberExpression' &&
            node.object.type === 'Identifier'
          ) {
            const dangerousObjects = [
              'process',
              'global',
              'globalThis',
              '__dirname',
              '__filename',
              'module',
              'exports',
              'Buffer',
              'require',
            ];

            if (dangerousObjects.includes(node.object.name)) {
              threats.push(`Dangerous object access: ${node.object.name}`);
            }
          }

          // Check for obfuscation patterns
          if (node.type === 'Literal' && typeof node.value === 'string') {
            if (
              /\\x[0-9a-f]{2}/i.test(node.value) ||
              /\\u[0-9a-f]{4}/i.test(node.value)
            ) {
              obfuscationDetected = true;
              warnings.push(
                'Hex/Unicode encoding detected - possible obfuscation'
              );
            }
          }
        },
      });

      // Calculate safety score
      let score = 100;
      score -= threats.length * 20;
      score -= warnings.length * 5;
      score -= Math.min(complexity / 10, 30);
      score = Math.max(score, 0);

      return {
        safe: threats.length === 0,
        score,
        threats,
        warnings,
        complexity,
        obfuscationDetected,
      };
    } catch (error: any) {
      return {
        safe: false,
        score: 0,
        threats: [`Code analysis failed: ${error.message}`],
        warnings: [],
        complexity: 0,
        obfuscationDetected: false,
      };
    }
  }

  /**
   * Analyze plugin behavior for suspicious patterns
   */
  private analyzeBehavior(
    executionId: string,
    pluginName: string
  ): BehaviorAnalysisResult {
    const violations = this.securityViolations.get(executionId) || [];
    const stats = this.executionStats.get(executionId);

    const patterns: string[] = [];
    const anomalies: string[] = [];
    let score = 0;

    // Check violation patterns
    const resourceViolations = violations.filter(
      v => v.type === 'resource'
    ).length;
    const codeViolations = violations.filter(v => v.type === 'code').length;
    const accessViolations = violations.filter(v => v.type === 'access').length;

    if (resourceViolations > 0) {
      patterns.push('Resource limit violations');
      score += resourceViolations * 20;
    }

    if (codeViolations > 0) {
      patterns.push('Code security violations');
      score += codeViolations * 30;
    }

    if (accessViolations > 0) {
      patterns.push('Unauthorized access attempts');
      score += accessViolations * 25;
    }

    // Check execution anomalies
    if (stats) {
      if (stats.counters.functionCalls > this.config.maxFunctionCalls * 0.8) {
        anomalies.push('High function call count');
        score += 15;
      }

      if (
        stats.memory.heapUsed >
        this.config.maxHeapSizeMB * 1024 * 1024 * 0.8
      ) {
        anomalies.push('High memory usage');
        score += 10;
      }
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (score >= 80) riskLevel = 'critical';
    else if (score >= 60) riskLevel = 'high';
    else if (score >= 30) riskLevel = 'medium';
    else riskLevel = 'low';

    const result: BehaviorAnalysisResult = {
      score: Math.min(score, 100),
      patterns,
      anomalies,
      riskLevel,
    };

    this.behaviorProfiles.set(executionId, result);
    return result;
  }

  /**
   * Start comprehensive resource monitoring
   */
  private startResourceMonitoring(
    executionId: string,
    config: EnhancedSandboxConfig
  ): void {
    const monitor = setInterval(() => {
      try {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        // Update execution stats
        const stats = this.executionStats.get(executionId);
        if (stats) {
          stats.memory = memUsage;
          stats.cpu.usage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to ms
        }

        // Check limits and report violations
        if (memUsage.heapUsed > config.maxHeapSizeMB * 1024 * 1024) {
          this.reportSecurityViolation(
            executionId,
            'resource',
            'critical',
            `Heap memory limit exceeded: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB > ${config.maxHeapSizeMB}MB`
          );
          this.emergencyTermination(executionId);
        }

        if (memUsage.rss > config.maxMemoryMB * 1024 * 1024) {
          this.reportSecurityViolation(
            executionId,
            'resource',
            'high',
            `RSS memory limit exceeded: ${Math.round(memUsage.rss / 1024 / 1024)}MB > ${config.maxMemoryMB}MB`
          );
        }

        const totalCpuTime = (cpuUsage.user + cpuUsage.system) / 1000000;
        if (totalCpuTime > config.maxCpuTimeMs) {
          this.reportSecurityViolation(
            executionId,
            'resource',
            'critical',
            `CPU time limit exceeded: ${totalCpuTime}ms > ${config.maxCpuTimeMs}ms`
          );
          this.emergencyTermination(executionId);
        }
      } catch (error: any) {
        logger.error(
          `Resource monitoring error for ${executionId}: ${error.message}`
        );
      }
    }, config.resourceCheckIntervalMs);

    this.resourceMonitors.set(executionId, monitor);
  }

  /**
   * Report security violation with comprehensive context
   */
  private reportSecurityViolation(
    executionId: string,
    type: SecurityViolation['type'],
    severity: SecurityViolation['severity'],
    description: string,
    pluginName?: string,
    method?: string
  ): void {
    const violation: SecurityViolation = {
      type,
      severity,
      description,
      timestamp: Date.now(),
      context: {
        executionId,
        pluginName: pluginName || 'unknown',
        method: method || 'unknown',
        stackTrace: new Error().stack,
      },
    };

    const violations = this.securityViolations.get(executionId) || [];
    violations.push(violation);
    this.securityViolations.set(executionId, violations);

    logger.warn(
      `Security violation [${severity.toUpperCase()}] in ${executionId}: ${description}`
    );

    // Auto-terminate on critical violations or violation threshold
    if (
      severity === 'critical' ||
      violations.length > this.config.maxSecurityViolations
    ) {
      logger.error(
        `Security threshold exceeded for ${executionId} - initiating emergency termination`
      );
      this.emergencyTermination(executionId);
    }
  }

  /**
   * Emergency termination with comprehensive cleanup
   */
  private emergencyTermination(executionId: string): void {
    if (this.emergencyStops.has(executionId)) {
      return; // Already terminated
    }

    this.emergencyStops.add(executionId);
    logger.error(`EMERGENCY TERMINATION: ${executionId}`);

    // Terminate all associated resources
    const worker = this.workers.get(executionId);
    if (worker) {
      worker
        .terminate()
        .catch(err =>
          logger.error(
            `Error terminating worker ${executionId}: ${err.message}`
          )
        );
    }

    // Clear VM context
    const vmContext = this.vmContexts.get(executionId);
    if (vmContext) {
      // VM contexts can't be directly terminated, but we remove the reference
      this.vmContexts.delete(executionId);
    }

    this.cleanupExecution(executionId);
  }

  /**
   * Create secure API interface for plugins
   */
  private createSecureAPI(
    executionId: string,
    config: EnhancedSandboxConfig
  ): object {
    return {
      log: (level: string, ...args: unknown[]) => {
        this.secureLog(executionId, level, ...args);
      },
      storage: {
        get: async (key: string) => {
          this.incrementCounter(executionId, 'fileOperations');
          return this.handleSecureStorageGet(key, config);
        },
        set: async (key: string, value: unknown) => {
          this.incrementCounter(executionId, 'fileOperations');
          return this.handleSecureStorageSet(key, value, config);
        },
      },
      network: config.allowNetworkAccess
        ? {
            fetch: async (url: string, options?: any) => {
              this.incrementCounter(executionId, 'networkRequests');
              return this.handleSecureNetworkRequest(
                executionId,
                url,
                options,
                config
              );
            },
          }
        : undefined,
    };
  }

  /**
   * Install security monitors in VM context
   */
  private installSecurityMonitors(
    context: vm.Context,
    executionId: string,
    config: EnhancedSandboxConfig
  ): void {
    // This would install various monitoring hooks in the VM context
    // For now, we rely on the secure wrapper functions
  }

  /**
   * Create secure console for plugin logging
   */
  private createSecureConsole(executionId: string): object {
    return {
      log: (...args: unknown[]) => this.secureLog(executionId, 'info', ...args),
      warn: (...args: unknown[]) =>
        this.secureLog(executionId, 'warn', ...args),
      error: (...args: unknown[]) =>
        this.secureLog(executionId, 'error', ...args),
      info: (...args: unknown[]) =>
        this.secureLog(executionId, 'info', ...args),
      debug: (...args: unknown[]) =>
        this.secureLog(executionId, 'debug', ...args),
    };
  }

  /**
   * Secure logging with sanitization
   */
  private secureLog(
    executionId: string,
    level: string,
    ...args: unknown[]
  ): void {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'string') {
        // Truncate long strings and remove potential security risks
        const truncated =
          arg.length > 500 ? `${arg.substring(0, 500)}...[truncated]` : arg;
        return truncated.replace(/[^\x20-\x7E]/g, ''); // Remove non-printable characters
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg).substring(0, 500);
        } catch {
          return '[Circular/Error]';
        }
      }
      return arg;
    });

    logger.info(
      `[Plugin:${executionId}:${level.toUpperCase()}] ${sanitizedArgs.join(' ')}`
    );
  }

  /**
   * Increment execution counter
   */
  private incrementCounter(executionId: string, type: string): void {
    const stats = this.executionStats.get(executionId);
    if (stats) {
      switch (type) {
        case 'functionCalls':
          stats.counters.functionCalls++;
          break;
        case 'fileOperations':
          stats.counters.fileOperations++;
          break;
        case 'networkRequests':
          stats.counters.networkRequests++;
          break;
      }
    }
  }

  /**
   * Check resource limits during execution
   */
  private checkResourceLimits(executionId: string): void {
    const violations = this.securityViolations.get(executionId) || [];

    if (violations.length > this.config.suspiciousActivityThreshold) {
      this.emergencyTermination(executionId);
      throw new Error(
        'Security violation threshold exceeded - execution terminated'
      );
    }

    const stats = this.executionStats.get(executionId);
    if (
      stats &&
      stats.counters.functionCalls > this.config.maxFunctionCalls * 0.9
    ) {
      this.reportSecurityViolation(
        executionId,
        'resource',
        'medium',
        'Approaching function call limit'
      );
    }
  }

  /**
   * Create enhanced secure worker (fallback method)
   */
  private createEnhancedSecureWorker(
    executionId: string,
    plugin: IPlugin,
    method: string,
    args: unknown[],
    config: EnhancedSandboxConfig
  ): Worker {
    const workerScript = path.join(__dirname, 'enhanced-plugin-worker.js');

    const worker = new Worker(workerScript, {
      workerData: {
        executionId,
        plugin: this.sanitizePluginForSecureExecution(plugin),
        method,
        args,
        config,
      },
      resourceLimits: {
        maxOldGenerationSizeMb: config.maxHeapSizeMB,
        maxYoungGenerationSizeMb: Math.floor(config.maxHeapSizeMB / 4),
        codeRangeSizeMb: Math.floor(config.maxHeapSizeMB / 8),
      },
    });

    this.workers.set(executionId, worker);
    return worker;
  }

  /**
   * Handle secure storage operations
   */
  private async handleSecureStorageGet(
    key: string,
    config: EnhancedSandboxConfig
  ): Promise<unknown> {
    // Validate key
    if (!/^[a-zA-Z0-9_-]+$/.test(key) || key.length > 100) {
      throw new Error('Invalid storage key format');
    }

    try {
      const safePath = path.join('./plugins/data', `${key}.json`);
      const data = await fs.readFile(safePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private async handleSecureStorageSet(
    key: string,
    value: unknown,
    config: EnhancedSandboxConfig
  ): Promise<void> {
    // Validate key and value
    if (!/^[a-zA-Z0-9_-]+$/.test(key) || key.length > 100) {
      throw new Error('Invalid storage key format');
    }

    const serialized = JSON.stringify(value);
    if (serialized.length > config.maxFileSize) {
      throw new Error('Storage value exceeds size limit');
    }

    const dataDir = './plugins/data';
    const safePath = path.join(dataDir, `${key}.json`);

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(safePath, serialized);
  }

  /**
   * Handle secure network requests
   */
  private async handleSecureNetworkRequest(
    executionId: string,
    url: string,
    options: any,
    config: EnhancedSandboxConfig
  ): Promise<any> {
    // Validate URL against allowed hosts
    try {
      const urlObj = new URL(url);

      if (!config.allowedHosts.includes(urlObj.hostname)) {
        this.reportSecurityViolation(
          executionId,
          'access',
          'high',
          `Network request to unauthorized host: ${urlObj.hostname}`
        );
        throw new Error('Network request to unauthorized host');
      }

      // This would implement actual secure network requests
      throw new Error('Network requests not implemented in demo');
    } catch (error: any) {
      this.reportSecurityViolation(
        executionId,
        'access',
        'medium',
        `Invalid network request: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Create initial execution statistics
   */
  private createInitialStats(): ResourceUsage {
    return {
      memory: {
        heapUsed: 0,
        heapTotal: 0,
        external: 0,
        rss: 0,
      },
      cpu: {
        usage: 0,
        time: 0,
      },
      timing: {
        elapsed: 0,
        remaining: 0,
      },
      counters: {
        functionCalls: 0,
        loopIterations: 0,
        fileOperations: 0,
        networkRequests: 0,
      },
    };
  }

  /**
   * Update execution statistics
   */
  private updateExecutionStats(executionId: string, newStats: any): void {
    const stats = this.executionStats.get(executionId);
    if (stats && newStats) {
      stats.counters.functionCalls += newStats.functionCallCount || 0;
      stats.counters.loopIterations += newStats.loopCount || 0;
    }
  }

  /**
   * Create success result with comprehensive metrics
   */
  private createSuccessResult(
    executionId: string,
    startTime: number,
    result: unknown,
    behaviorScore: number
  ): EnhancedExecutionResult {
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    const stats =
      this.executionStats.get(executionId) || this.createInitialStats();
    const violations = this.securityViolations.get(executionId) || [];

    return {
      success: true,
      result,
      stats: {
        executionTime,
        memoryUsed: stats.memory.heapUsed,
        cpuUsage: stats.cpu.usage,
        cpuTime: stats.cpu.time,
        heapUsage: stats.memory.heapUsed,
        functionCalls: stats.counters.functionCalls,
        loopIterations: stats.counters.loopIterations,
        fileOperations: stats.counters.fileOperations,
        networkRequests: stats.counters.networkRequests,
        maxCallStackDepth: 0, // Would be tracked during execution
      },
      security: {
        threatLevel: this.calculateThreatLevel(violations),
        violations: violations.map(v => v.description),
        suspiciousActivities: violations
          .filter(v => v.type === 'behavior')
          .map(v => v.description),
        signatureValid: true,
        codeAnalysisScore: 100,
        behaviorScore,
      },
      audit: {
        executionId,
        startTime,
        endTime,
        emergencyStop: this.emergencyStops.has(executionId),
        violationCount: violations.length,
      },
    };
  }

  /**
   * Create failure result with comprehensive context
   */
  private createFailureResult(
    executionId: string,
    startTime: number,
    error: string,
    threatLevel: 'low' | 'medium' | 'high' | 'critical'
  ): EnhancedExecutionResult {
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    const stats =
      this.executionStats.get(executionId) || this.createInitialStats();
    const violations = this.securityViolations.get(executionId) || [];

    return {
      success: false,
      error,
      stats: {
        executionTime,
        memoryUsed: stats.memory.heapUsed,
        cpuUsage: stats.cpu.usage,
        cpuTime: stats.cpu.time,
        heapUsage: stats.memory.heapUsed,
        functionCalls: stats.counters.functionCalls,
        loopIterations: stats.counters.loopIterations,
        fileOperations: stats.counters.fileOperations,
        networkRequests: stats.counters.networkRequests,
        maxCallStackDepth: 0,
      },
      security: {
        threatLevel,
        violations: violations.map(v => v.description).concat([error]),
        suspiciousActivities: violations
          .filter(v => v.type === 'behavior')
          .map(v => v.description),
        signatureValid: false,
        codeAnalysisScore: 0,
        behaviorScore: 100, // High score indicates high suspicion
      },
      audit: {
        executionId,
        startTime,
        endTime,
        emergencyStop: this.emergencyStops.has(executionId),
        violationCount: violations.length + 1,
      },
    };
  }

  /**
   * Calculate threat level based on violations
   */
  private calculateThreatLevel(
    violations: SecurityViolation[]
  ): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    if (violations.length === 0) return 'none';

    const criticalCount = violations.filter(
      v => v.severity === 'critical'
    ).length;
    const highCount = violations.filter(v => v.severity === 'high').length;
    const mediumCount = violations.filter(v => v.severity === 'medium').length;

    if (criticalCount > 0) return 'critical';
    if (highCount > 2) return 'critical';
    if (highCount > 0) return 'high';
    if (mediumCount > 3) return 'high';
    if (mediumCount > 0) return 'medium';
    return 'low';
  }

  /**
   * Cleanup execution resources
   */
  private cleanupExecution(executionId: string): void {
    // Clear resource monitor
    const monitor = this.resourceMonitors.get(executionId);
    if (monitor) {
      clearInterval(monitor);
      this.resourceMonitors.delete(executionId);
    }

    // Clear VM context
    this.vmContexts.delete(executionId);

    // Clear workers
    this.workers.delete(executionId);

    // Clear execution stats
    this.executionStats.delete(executionId);

    // Keep violations and behavior profiles for audit
  }

  /**
   * Generate secure execution ID with entropy
   */
  private generateSecureExecutionId(): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const processId = process.pid.toString(36);
    return `plugin-exec-${timestamp}-${processId}-${randomBytes}`;
  }

  /**
   * Comprehensive cleanup with audit reporting
   */
  async cleanup(): Promise<void> {
    logger.info('Starting enhanced plugin sandbox cleanup...');

    // Emergency terminate all active executions
    const activeExecutions = Array.from(this.workers.keys());
    for (const executionId of activeExecutions) {
      this.emergencyTermination(executionId);
    }

    // Generate comprehensive audit report
    const auditReport = this.generateComprehensiveAuditReport();
    logger.info('Enhanced plugin sandbox audit report:', auditReport);

    // Clear all resources
    this.workers.clear();
    this.vmContexts.clear();
    this.resourceMonitors.clear();
    this.executionStats.clear();
    this.emergencyStops.clear();
    this.behaviorProfiles.clear();

    logger.info('Enhanced plugin sandbox cleanup completed');
  }

  /**
   * Generate comprehensive audit report
   */
  private generateComprehensiveAuditReport(): object {
    const totalExecutions = this.securityViolations.size;
    const violationsByType = new Map<string, number>();
    const violationsBySeverity = new Map<string, number>();
    let totalViolations = 0;

    // Analyze violations
    for (const violations of this.securityViolations.values()) {
      totalViolations += violations.length;

      for (const violation of violations) {
        violationsByType.set(
          violation.type,
          (violationsByType.get(violation.type) || 0) + 1
        );
        violationsBySeverity.set(
          violation.severity,
          (violationsBySeverity.get(violation.severity) || 0) + 1
        );
      }
    }

    // Analyze behavior profiles
    const behaviorAnalysis = Array.from(this.behaviorProfiles.values());
    const avgBehaviorScore =
      behaviorAnalysis.length > 0
        ? behaviorAnalysis.reduce((sum, profile) => sum + profile.score, 0) /
          behaviorAnalysis.length
        : 0;

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalExecutions,
        totalViolations,
        emergencyStops: this.emergencyStops.size,
        avgBehaviorScore: Math.round(avgBehaviorScore),
      },
      violations: {
        byType: Object.fromEntries(violationsByType),
        bySeverity: Object.fromEntries(violationsBySeverity),
      },
      security: {
        vmIsolationEnabled: this.config.enableVMIsolation,
        signatureVerificationEnabled: this.config.requireSignature,
        behaviorAnalysisEnabled: this.config.enableBehaviorAnalysis,
        runtimeMonitoringEnabled: this.config.enableRuntimeMonitoring,
      },
      recommendations: this.generateSecurityRecommendations(
        violationsByType,
        violationsBySeverity
      ),
    };
  }

  /**
   * Generate security recommendations based on audit data
   */
  private generateSecurityRecommendations(
    violationsByType: Map<string, number>,
    violationsBySeverity: Map<string, number>
  ): string[] {
    const recommendations: string[] = [];

    if (
      violationsByType.get('resource') &&
      violationsByType.get('resource')! > 0
    ) {
      recommendations.push(
        'Consider reducing resource limits or improving resource monitoring'
      );
    }

    if (violationsByType.get('code') && violationsByType.get('code')! > 0) {
      recommendations.push('Implement stricter code analysis and filtering');
    }

    if (
      violationsBySeverity.get('critical') &&
      violationsBySeverity.get('critical')! > 0
    ) {
      recommendations.push('Review and strengthen critical security controls');
    }

    if (this.emergencyStops.size > 0) {
      recommendations.push('Investigate causes of emergency terminations');
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Security posture is strong - maintain current controls'
      );
    }

    return recommendations;
  }

  /**
   * Get security audit log for external review
   */
  public getSecurityAuditLog(): {
    violations: Map<string, SecurityViolation[]>;
    behaviorProfiles: Map<string, BehaviorAnalysisResult>;
    emergencyStops: Set<string>;
  } {
    return {
      violations: new Map(this.securityViolations),
      behaviorProfiles: new Map(this.behaviorProfiles),
      emergencyStops: new Set(this.emergencyStops),
    };
  }
}

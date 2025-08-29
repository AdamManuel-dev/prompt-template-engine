/**
 * @fileoverview Advanced code analysis and filtering engine for plugin security
 * @lastmodified 2025-08-27T12:45:00Z
 *
 * Features: Static analysis, dynamic pattern detection, obfuscation detection, security scoring
 * Main APIs: CodeAnalyzer class for comprehensive code security analysis
 * Constraints: AST-based analysis, pattern matching, heuristic detection
 * Patterns: Static analysis, visitor pattern, security rule engine, threat classification
 */

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { IPlugin } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Security threat classification
 */
export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Code analysis threat
 */
export interface SecurityThreat {
  type:
    | 'dangerous-function'
    | 'global-access'
    | 'eval-usage'
    | 'network-access'
    | 'file-access'
    | 'process-access'
    | 'obfuscation'
    | 'complexity'
    | 'injection';
  severity: ThreatLevel;
  description: string;
  line?: number;
  column?: number;
  code?: string;
  suggestion?: string;
  evidence?: string[];
}

/**
 * Code complexity metrics
 */
export interface ComplexityMetrics {
  cyclomatic: number;
  cognitive: number;
  nestingDepth: number;
  functionCount: number;
  variableCount: number;
  lineCount: number;
  branchCount: number;
  loopCount: number;
}

/**
 * Obfuscation analysis result
 */
export interface ObfuscationAnalysis {
  detected: boolean;
  confidence: number; // 0-100
  patterns: string[];
  evidence: {
    minifiedVariables: number;
    hexStrings: number;
    unicodeEscapes: number;
    evalUsage: number;
    dynamicPropertyAccess: number;
  };
}

/**
 * Code analysis result
 */
export interface CodeAnalysisResult {
  safe: boolean;
  score: number; // 0-100, higher is safer
  threatLevel: ThreatLevel;
  threats: SecurityThreat[];
  warnings: string[];
  complexity: ComplexityMetrics;
  obfuscation: ObfuscationAnalysis;
  metadata: {
    pluginName: string;
    analysisTime: number;
    rulesApplied: number;
    bytesAnalyzed: number;
  };
}

/**
 * Analysis configuration
 */
export interface AnalysisConfig {
  // Threat detection
  enableDangerousFunctionDetection: boolean;
  enableGlobalAccessDetection: boolean;
  enableEvalDetection: boolean;
  enableObfuscationDetection: boolean;

  // Complexity analysis
  maxCyclomaticComplexity: number;
  maxCognitiveComplexity: number;
  maxNestingDepth: number;
  maxFunctionCount: number;

  // File size limits
  maxCodeSize: number;
  maxLineCount: number;

  // Security rules
  strictMode: boolean;
  allowUnsafePatterns: boolean;
  customRules: SecurityRule[];

  // Performance
  analysisTimeoutMs: number;
  enableCaching: boolean;
}

/**
 * Custom security rule
 */
export interface SecurityRule {
  id: string;
  name: string;
  description: string;
  severity: ThreatLevel;
  pattern: RegExp | ((node: t.Node, path: unknown) => boolean);
  message: string;
  suggestion?: string;
}

/**
 * Default analysis configuration
 */
export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  // Threat detection
  enableDangerousFunctionDetection: true,
  enableGlobalAccessDetection: true,
  enableEvalDetection: true,
  enableObfuscationDetection: true,

  // Complexity limits
  maxCyclomaticComplexity: 20,
  maxCognitiveComplexity: 30,
  maxNestingDepth: 6,
  maxFunctionCount: 50,

  // Size limits
  maxCodeSize: 1024 * 1024, // 1MB
  maxLineCount: 10000,

  // Security
  strictMode: true,
  allowUnsafePatterns: false,
  customRules: [],

  // Performance
  analysisTimeoutMs: 30000,
  enableCaching: true,
};

/**
 * Advanced code analysis and filtering engine
 */
export class CodeAnalyzer {
  private config: AnalysisConfig;

  private analysisCache = new Map<string, CodeAnalysisResult>();

  private securityRules: SecurityRule[];

  constructor(config: Partial<AnalysisConfig> = {}) {
    this.config = { ...DEFAULT_ANALYSIS_CONFIG, ...config };
    this.securityRules = this.initializeSecurityRules();
    logger.info('Advanced code analyzer initialized');
  }

  /**
   * Analyze plugin code for security threats
   */
  async analyzePlugin(plugin: IPlugin): Promise<CodeAnalysisResult> {
    const startTime = Date.now();

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(plugin);
      if (this.config.enableCaching && this.analysisCache.has(cacheKey)) {
        logger.debug(`Using cached analysis for plugin ${plugin.name}`);
        return this.analysisCache.get(cacheKey)!;
      }

      logger.info(`Starting code analysis for plugin: ${plugin.name}`);

      // Extract code to analyze
      const codeToAnalyze = this.extractPluginCode(plugin);

      // Basic validation
      const basicValidation = this.validateCodeBasics(codeToAnalyze);
      if (!basicValidation.valid) {
        const result: CodeAnalysisResult = {
          safe: false,
          score: 0,
          threatLevel: 'critical',
          threats: [
            {
              type: 'eval-usage',
              severity: 'critical',
              description: basicValidation.error!,
            },
          ],
          warnings: [],
          complexity: this.createEmptyComplexityMetrics(),
          obfuscation: this.createEmptyObfuscationAnalysis(),
          metadata: {
            pluginName: plugin.name,
            analysisTime: Date.now() - startTime,
            rulesApplied: 0,
            bytesAnalyzed: codeToAnalyze.length,
          },
        };
        return result;
      }

      // Parse code into AST with timeout
      const ast = await this.parseCodeWithTimeout(codeToAnalyze);

      // Perform comprehensive analysis
      const threats = await this.detectThreats(ast, codeToAnalyze);
      const complexity = this.calculateComplexityMetrics(ast, codeToAnalyze);
      const obfuscation = this.analyzeObfuscation(ast, codeToAnalyze);
      const warnings = this.generateWarnings(complexity, obfuscation);

      // Calculate overall safety score
      const score = this.calculateSafetyScore(threats, complexity, obfuscation);
      const threatLevel = this.determineThreatLevel(threats, score);

      const result: CodeAnalysisResult = {
        safe: threatLevel === 'none' || threatLevel === 'low',
        score,
        threatLevel,
        threats,
        warnings,
        complexity,
        obfuscation,
        metadata: {
          pluginName: plugin.name,
          analysisTime: Date.now() - startTime,
          rulesApplied: this.securityRules.length,
          bytesAnalyzed: codeToAnalyze.length,
        },
      };

      // Cache result
      if (this.config.enableCaching) {
        this.analysisCache.set(cacheKey, result);
      }

      logger.info(
        `Code analysis completed for ${plugin.name}: ${result.safe ? 'SAFE' : 'UNSAFE'} (score: ${result.score}/100, threats: ${result.threats.length})`
      );
      return result;
    } catch (error: unknown) {
      logger.error(`Code analysis error for ${plugin.name}: ${error.message}`);

      return {
        safe: false,
        score: 0,
        threatLevel: 'critical',
        threats: [
          {
            type: 'eval-usage',
            severity: 'critical',
            description: `Analysis error: ${error.message}`,
          },
        ],
        warnings: [`Analysis failed: ${error.message}`],
        complexity: this.createEmptyComplexityMetrics(),
        obfuscation: this.createEmptyObfuscationAnalysis(),
        metadata: {
          pluginName: plugin.name,
          analysisTime: Date.now() - startTime,
          rulesApplied: 0,
          bytesAnalyzed: 0,
        },
      };
    }
  }

  /**
   * Extract code from plugin for analysis
   */
  private extractPluginCode(plugin: IPlugin): string {
    const codeParts: string[] = [];

    if (plugin.execute) codeParts.push(plugin.execute.toString());
    if (plugin.init) codeParts.push(plugin.init.toString());
    if (plugin.activate) codeParts.push(plugin.activate.toString());
    if (plugin.deactivate) codeParts.push(plugin.deactivate.toString());
    if (plugin.dispose) codeParts.push(plugin.dispose.toString());

    // Include hooks if available
    if (plugin.hooks && typeof plugin.hooks === 'object') {
      for (const [hookName, hookFn] of Object.entries(plugin.hooks)) {
        if (typeof hookFn === 'function') {
          codeParts.push(`// Hook: ${hookName}\n${hookFn.toString()}`);
        }
      }
    }

    return codeParts.join('\n\n');
  }

  /**
   * Validate basic code properties
   */
  private validateCodeBasics(code: string): { valid: boolean; error?: string } {
    // Check size limits
    if (code.length > this.config.maxCodeSize) {
      return {
        valid: false,
        error: `Code size exceeds limit: ${code.length} > ${this.config.maxCodeSize} bytes`,
      };
    }

    // Check line count
    const lineCount = code.split('\n').length;
    if (lineCount > this.config.maxLineCount) {
      return {
        valid: false,
        error: `Line count exceeds limit: ${lineCount} > ${this.config.maxLineCount}`,
      };
    }

    // Basic security checks
    if (this.config.enableEvalDetection) {
      const evalPattern = /\beval\s*\(/gi;
      const functionPattern = /new\s+Function\s*\(/gi;

      if (evalPattern.test(code)) {
        return {
          valid: false,
          error: 'Code contains eval() usage - strictly forbidden',
        };
      }

      if (functionPattern.test(code)) {
        return {
          valid: false,
          error: 'Code contains Function constructor - strictly forbidden',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Parse code with timeout protection
   */
  private async parseCodeWithTimeout(code: string): Promise<t.File> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Code parsing timeout'));
      }, this.config.analysisTimeoutMs);

      try {
        const ast = parse(code, {
          sourceType: 'module',
          plugins: [
            'objectRestSpread',
            'functionBind',
            'exportDefaultFrom',
            'decorators-legacy',
            'asyncGenerators',
            'optionalChaining',
            'nullishCoalescingOperator',
          ],
          allowImportExportEverywhere: true,
          allowAwaitOutsideFunction: true,
          allowReturnOutsideFunction: true,
          allowUndeclaredExports: true,
        });

        clearTimeout(timeout);
        resolve(ast);
      } catch (error: unknown) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Detect security threats in AST
   */
  private async detectThreats(
    ast: t.File,
    code: string
  ): Promise<SecurityThreat[]> {
    const threats: SecurityThreat[] = [];

    try {
      traverse(ast, {
        enter: path => {
          const { node } = path;

          // Apply built-in security rules
          if (this.config.enableDangerousFunctionDetection) {
            this.detectDangerousFunctions(node, path, threats);
          }

          if (this.config.enableGlobalAccessDetection) {
            this.detectGlobalAccess(node, path, threats);
          }

          this.detectNetworkAccess(node, path, threats);
          this.detectFileAccess(node, path, threats);
          this.detectProcessAccess(node, path, threats);
          this.detectInjectionPatterns(node, path, threats);

          // Apply custom rules
          this.applyCustomRules(node, path, threats);
        },
      });

      // Detect regex-based patterns
      this.detectRegexPatterns(code, threats);
    } catch (error: unknown) {
      threats.push({
        type: 'eval-usage',
        severity: 'high',
        description: `AST traversal error: ${error.message}`,
      });
    }

    return threats;
  }

  /**
   * Detect dangerous function calls
   */
  private detectDangerousFunctions(
    node: t.Node,
    _path: any,
    threats: SecurityThreat[]
  ): void {
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
      const dangerousFunctions = [
        {
          name: 'eval',
          severity: 'critical' as ThreatLevel,
          message: 'eval() allows arbitrary code execution',
        },
        {
          name: 'Function',
          severity: 'critical' as ThreatLevel,
          message: 'Function constructor allows code generation',
        },
        {
          name: 'setTimeout',
          severity: 'high' as ThreatLevel,
          message: 'setTimeout with string argument allows code execution',
        },
        {
          name: 'setInterval',
          severity: 'high' as ThreatLevel,
          message: 'setInterval with string argument allows code execution',
        },
        {
          name: 'setImmediate',
          severity: 'medium' as ThreatLevel,
          message: 'setImmediate can be used for timing attacks',
        },
        {
          name: 'execSync',
          severity: 'critical' as ThreatLevel,
          message: 'execSync allows command execution',
        },
        {
          name: 'spawn',
          severity: 'critical' as ThreatLevel,
          message: 'spawn allows process creation',
        },
        {
          name: 'fork',
          severity: 'critical' as ThreatLevel,
          message: 'fork allows process forking',
        },
        {
          name: 'exec',
          severity: 'critical' as ThreatLevel,
          message: 'exec allows command execution',
        },
      ];

      const found = dangerousFunctions.find(
        fn => node.callee.type === 'Identifier' && fn.name === node.callee.name
      );
      if (found) {
        threats.push({
          type: 'dangerous-function',
          severity: found.severity,
          description: `Dangerous function call: ${found.name} - ${found.message}`,
          line: node.loc?.start.line,
          column: node.loc?.start.column,
          suggestion: `Remove ${found.name} call or use safer alternatives`,
        });
      }
    }
  }

  /**
   * Detect global object access
   */
  private detectGlobalAccess(
    node: t.Node,
    _path: any,
    threats: SecurityThreat[]
  ): void {
    if (node.type === 'MemberExpression' && node.object.type === 'Identifier') {
      const dangerousGlobals = [
        {
          name: 'process',
          severity: 'critical' as ThreatLevel,
          message: 'Access to process object',
        },
        {
          name: 'global',
          severity: 'high' as ThreatLevel,
          message: 'Access to global object',
        },
        {
          name: 'globalThis',
          severity: 'high' as ThreatLevel,
          message: 'Access to globalThis object',
        },
        {
          name: '__dirname',
          severity: 'medium' as ThreatLevel,
          message: 'Access to __dirname',
        },
        {
          name: '__filename',
          severity: 'medium' as ThreatLevel,
          message: 'Access to __filename',
        },
        {
          name: 'module',
          severity: 'high' as ThreatLevel,
          message: 'Access to module object',
        },
        {
          name: 'exports',
          severity: 'medium' as ThreatLevel,
          message: 'Access to exports object',
        },
        {
          name: 'Buffer',
          severity: 'medium' as ThreatLevel,
          message: 'Access to Buffer constructor',
        },
      ];

      const found = dangerousGlobals.find(
        glob =>
          node.object.type === 'Identifier' && glob.name === node.object.name
      );
      if (found) {
        threats.push({
          type: 'global-access',
          severity: found.severity,
          description: `Global object access: ${found.name} - ${found.message}`,
          line: node.loc?.start.line,
          column: node.loc?.start.column,
          suggestion: 'Avoid accessing global objects directly',
        });
      }
    }
  }

  /**
   * Detect network access patterns
   */
  private detectNetworkAccess(
    node: t.Node,
    _path: any,
    threats: SecurityThreat[]
  ): void {
    const networkPatterns = [
      { pattern: 'fetch', severity: 'medium' as ThreatLevel },
      { pattern: 'XMLHttpRequest', severity: 'medium' as ThreatLevel },
      { pattern: 'WebSocket', severity: 'high' as ThreatLevel },
      { pattern: 'request', severity: 'medium' as ThreatLevel },
      { pattern: 'axios', severity: 'medium' as ThreatLevel },
    ];

    if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
      const found = networkPatterns.find(
        p => p.pattern === (node.callee as any).name
      );
      if (found) {
        threats.push({
          type: 'network-access',
          severity: found.severity,
          description: `Network access detected: ${found.pattern}`,
          line: node.loc?.start.line,
          column: node.loc?.start.column,
          suggestion: 'Network access should be explicitly approved',
        });
      }
    }
  }

  /**
   * Detect file access patterns
   */
  private detectFileAccess(
    node: t.Node,
    _path: any,
    threats: SecurityThreat[]
  ): void {
    if (
      node.type === 'MemberExpression' &&
      node.object.type === 'Identifier' &&
      node.object.name === 'fs'
    ) {
      threats.push({
        type: 'file-access',
        severity: 'high',
        description: 'File system access detected',
        line: node.loc?.start.line,
        column: node.loc?.start.column,
        suggestion: 'File access should be sandboxed and limited',
      });
    }
  }

  /**
   * Detect process access patterns
   */
  private detectProcessAccess(
    node: t.Node,
    _path: any,
    threats: SecurityThreat[]
  ): void {
    if (
      node.type === 'MemberExpression' &&
      node.object.type === 'Identifier' &&
      node.object.name === 'process'
    ) {
      const property =
        node.property.type === 'Identifier' ? node.property.name : 'unknown';
      const dangerousProps = ['exit', 'kill', 'abort', 'env', 'argv', 'cwd'];
      const severity = dangerousProps.includes(property) ? 'critical' : 'high';

      threats.push({
        type: 'process-access',
        severity: severity as ThreatLevel,
        description: `Process object property access: ${property}`,
        line: node.loc?.start.line,
        column: node.loc?.start.column,
        suggestion: 'Process access should be strictly controlled',
      });
    }
  }

  /**
   * Detect injection attack patterns
   */
  private detectInjectionPatterns(
    node: t.Node,
    _path: any,
    threats: SecurityThreat[]
  ): void {
    if (node.type === 'TemplateLiteral') {
      // Check for potential SQL injection in template literals
      const quasi = node.quasis.map(q => q.value.raw).join('');
      const sqlKeywords =
        /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b/gi;

      if (sqlKeywords.test(quasi)) {
        threats.push({
          type: 'injection',
          severity: 'high',
          description: 'Potential SQL injection pattern in template literal',
          line: node.loc?.start.line,
          column: node.loc?.start.column,
          suggestion: 'Use parameterized queries to prevent SQL injection',
        });
      }
    }
  }

  /**
   * Apply custom security rules
   */
  private applyCustomRules(
    node: t.Node,
    _path: any,
    threats: SecurityThreat[]
  ): void {
    for (const rule of this.securityRules) {
      try {
        let matches = false;

        if (rule.pattern instanceof RegExp) {
          // For regex patterns, check the node's source code
          const code = (_path as any).getSource?.() || '';
          matches = rule.pattern.test(code);
        } else if (typeof rule.pattern === 'function') {
          matches = rule.pattern(node, _path as any);
        }

        if (matches) {
          threats.push({
            type: 'eval-usage', // Generic type for custom rules
            severity: rule.severity,
            description: `${rule.name}: ${rule.message}`,
            line: node.loc?.start.line,
            column: node.loc?.start.column,
            suggestion: rule.suggestion,
          });
        }
      } catch (error: unknown) {
        logger.warn(`Error applying custom rule ${rule.id}: ${error.message}`);
      }
    }
  }

  /**
   * Detect regex-based patterns in code
   */
  private detectRegexPatterns(code: string, threats: SecurityThreat[]): void {
    const patterns = [
      {
        regex: /document\./gi,
        type: 'global-access' as const,
        severity: 'medium' as ThreatLevel,
        description:
          'DOM access detected - not available in Node.js environment',
      },
      {
        regex: /window\./gi,
        type: 'global-access' as const,
        severity: 'medium' as ThreatLevel,
        description:
          'Window object access - not available in Node.js environment',
      },
      {
        regex: /navigator\./gi,
        type: 'global-access' as const,
        severity: 'low' as ThreatLevel,
        description: 'Navigator object access detected',
      },
      {
        regex: /location\./gi,
        type: 'global-access' as const,
        severity: 'medium' as ThreatLevel,
        description: 'Location object access detected',
      },
    ];

    for (const pattern of patterns) {
      const matches = code.match(pattern.regex);
      if (matches) {
        threats.push({
          type: pattern.type,
          severity: pattern.severity,
          description: pattern.description,
          evidence: matches.slice(0, 5), // Limit evidence
        });
      }
    }
  }

  /**
   * Calculate code complexity metrics
   */
  private calculateComplexityMetrics(
    ast: t.File,
    code: string
  ): ComplexityMetrics {
    let cyclomaticComplexity = 1; // Start with 1
    let cognitiveComplexity = 0;
    let maxNestingDepth = 0;
    let currentNestingDepth = 0;
    let functionCount = 0;
    let variableCount = 0;
    let branchCount = 0;
    let loopCount = 0;

    traverse(ast, {
      enter: path => {
        const { node } = path;

        // Count functions
        if (t.isFunction(node)) {
          functionCount++;
          currentNestingDepth++;
          maxNestingDepth = Math.max(maxNestingDepth, currentNestingDepth);
        }

        // Count variables
        if (t.isVariableDeclarator(node)) {
          variableCount++;
        }

        // Count complexity-contributing structures
        if (t.isIfStatement(node) || t.isConditionalExpression(node)) {
          cyclomaticComplexity++;
          cognitiveComplexity++;
          branchCount++;
          currentNestingDepth++;
          maxNestingDepth = Math.max(maxNestingDepth, currentNestingDepth);
        }

        if (t.isLoop(node)) {
          cyclomaticComplexity++;
          cognitiveComplexity += 1 + currentNestingDepth; // Nesting penalty
          loopCount++;
          currentNestingDepth++;
          maxNestingDepth = Math.max(maxNestingDepth, currentNestingDepth);
        }

        if (t.isSwitchStatement(node)) {
          cyclomaticComplexity += node.cases.length;
          cognitiveComplexity++;
          branchCount += node.cases.length;
        }

        if (t.isTryStatement(node)) {
          cyclomaticComplexity++;
          cognitiveComplexity++;
        }
      },

      exit: path => {
        const { node } = path;

        if (
          t.isFunction(node) ||
          t.isIfStatement(node) ||
          t.isConditionalExpression(node) ||
          t.isLoop(node)
        ) {
          currentNestingDepth--;
        }
      },
    });

    const lineCount = code.split('\n').length;

    return {
      cyclomatic: cyclomaticComplexity,
      cognitive: cognitiveComplexity,
      nestingDepth: maxNestingDepth,
      functionCount,
      variableCount,
      lineCount,
      branchCount,
      loopCount,
    };
  }

  /**
   * Analyze code for obfuscation patterns
   */
  private analyzeObfuscation(ast: t.File, code: string): ObfuscationAnalysis {
    let minifiedVariables = 0;
    let hexStrings = 0;
    let unicodeEscapes = 0;
    let evalUsage = 0;
    let dynamicPropertyAccess = 0;
    const patterns: string[] = [];

    // Count short variable names (potential minification)
    const shortVarNames = code.match(/\b[a-zA-Z_$][a-zA-Z0-9_$]{0,2}\b/g) || [];
    minifiedVariables = shortVarNames.length;

    // Count hex strings
    const hexMatches = code.match(/\\x[0-9a-fA-F]{2}/g) || [];
    hexStrings = hexMatches.length;

    // Count unicode escapes
    const unicodeMatches = code.match(/\\u[0-9a-fA-F]{4}/g) || [];
    unicodeEscapes = unicodeMatches.length;

    // Check for eval usage
    const evalMatches = code.match(/\beval\s*\(/g) || [];
    evalUsage = evalMatches.length;

    // AST-based analysis
    traverse(ast, {
      enter: path => {
        const { node } = path;

        // Dynamic property access (obj['prop'] instead of obj.prop)
        if (
          t.isMemberExpression(node) &&
          node.computed &&
          t.isStringLiteral(node.property)
        ) {
          dynamicPropertyAccess++;
        }
      },
    });

    // Analyze patterns
    if (minifiedVariables > code.length / 50) {
      patterns.push('High ratio of short variable names');
    }

    if (hexStrings > 10) {
      patterns.push('Excessive hex-encoded strings');
    }

    if (unicodeEscapes > 5) {
      patterns.push('Unicode escape sequences detected');
    }

    if (evalUsage > 0) {
      patterns.push('Dynamic code execution detected');
    }

    if (dynamicPropertyAccess > 20) {
      patterns.push('Excessive dynamic property access');
    }

    // Calculate confidence score
    let confidence = 0;
    if (patterns.length > 0) confidence += patterns.length * 20;
    if (minifiedVariables > 100) confidence += 30;
    if (hexStrings > 20) confidence += 25;
    if (unicodeEscapes > 10) confidence += 20;
    confidence = Math.min(confidence, 100);

    return {
      detected: patterns.length > 0,
      confidence,
      patterns,
      evidence: {
        minifiedVariables,
        hexStrings,
        unicodeEscapes,
        evalUsage,
        dynamicPropertyAccess,
      },
    };
  }

  /**
   * Generate warnings based on analysis
   */
  private generateWarnings(
    complexity: ComplexityMetrics,
    obfuscation: ObfuscationAnalysis
  ): string[] {
    const warnings: string[] = [];

    if (complexity.cyclomatic > this.config.maxCyclomaticComplexity) {
      warnings.push(
        `High cyclomatic complexity: ${complexity.cyclomatic} > ${this.config.maxCyclomaticComplexity}`
      );
    }

    if (complexity.cognitive > this.config.maxCognitiveComplexity) {
      warnings.push(
        `High cognitive complexity: ${complexity.cognitive} > ${this.config.maxCognitiveComplexity}`
      );
    }

    if (complexity.nestingDepth > this.config.maxNestingDepth) {
      warnings.push(
        `Deep nesting detected: ${complexity.nestingDepth} > ${this.config.maxNestingDepth}`
      );
    }

    if (complexity.functionCount > this.config.maxFunctionCount) {
      warnings.push(
        `Many functions detected: ${complexity.functionCount} > ${this.config.maxFunctionCount}`
      );
    }

    if (obfuscation.detected) {
      warnings.push(
        `Possible obfuscation detected (${obfuscation.confidence}% confidence)`
      );
    }

    return warnings;
  }

  /**
   * Calculate overall safety score
   */
  private calculateSafetyScore(
    threats: SecurityThreat[],
    complexity: ComplexityMetrics,
    obfuscation: ObfuscationAnalysis
  ): number {
    let score = 100;

    // Deduct points for threats
    for (const threat of threats) {
      switch (threat.severity) {
        case 'critical':
          score -= 30;
          break;
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    // Deduct points for complexity
    if (complexity.cyclomatic > this.config.maxCyclomaticComplexity) {
      score -= 15;
    }
    if (complexity.cognitive > this.config.maxCognitiveComplexity) {
      score -= 10;
    }
    if (complexity.nestingDepth > this.config.maxNestingDepth) {
      score -= 10;
    }

    // Deduct points for obfuscation
    if (obfuscation.detected) {
      score -= obfuscation.confidence * 0.3; // 0-30 points
    }

    return Math.max(score, 0);
  }

  /**
   * Determine overall threat level
   */
  private determineThreatLevel(
    threats: SecurityThreat[],
    score: number
  ): ThreatLevel {
    const criticalThreats = threats.filter(
      t => t.severity === 'critical'
    ).length;
    const highThreats = threats.filter(t => t.severity === 'high').length;
    const mediumThreats = threats.filter(t => t.severity === 'medium').length;

    if (criticalThreats > 0 || score < 30) {
      return 'critical';
    }
    if (highThreats > 2 || score < 50) {
      return 'high';
    }
    if (highThreats > 0 || mediumThreats > 3 || score < 70) {
      return 'medium';
    }
    if (mediumThreats > 0 || score < 90) {
      return 'low';
    }
    return 'none';
  }

  /**
   * Initialize built-in security rules
   */
  private initializeSecurityRules(): SecurityRule[] {
    const rules: SecurityRule[] = [
      {
        id: 'no-prototype-pollution',
        name: 'Prototype Pollution Prevention',
        description: 'Detects potential prototype pollution patterns',
        severity: 'high',
        pattern: /(__proto__|constructor\.prototype|Object\.prototype)/gi,
        message: 'Potential prototype pollution detected',
        suggestion: 'Avoid modifying object prototypes',
      },
      {
        id: 'no-unsafe-regex',
        name: 'Unsafe Regular Expression',
        description: 'Detects potentially unsafe regex patterns',
        severity: 'medium',
        pattern: /(.*\*.*\*|.*\+.*\+|.*\{.*,.*\}.*\{.*,.*\})/,
        message: 'Potentially unsafe regex pattern that could cause ReDoS',
        suggestion: 'Review regex for exponential time complexity',
      },
      {
        id: 'no-hardcoded-secrets',
        name: 'Hardcoded Secrets Detection',
        description: 'Detects potential hardcoded secrets',
        severity: 'high',
        pattern: /(password|secret|key|token)\s*[:=]\s*['"][^'"]{8,}/gi,
        message: 'Potential hardcoded secret detected',
        suggestion: 'Use environment variables or secure vaults for secrets',
      },
    ];

    return [...rules, ...this.config.customRules];
  }

  /**
   * Generate cache key for analysis result
   */
  private generateCacheKey(plugin: IPlugin): string {
    const pluginData = {
      name: plugin.name,
      version: plugin.version,
      execute: plugin.execute?.toString() || '',
      init: plugin.init?.toString() || '',
    };

    const content = JSON.stringify(pluginData);
    return require('crypto').createHash('sha256').update(content).digest('hex');
  }

  /**
   * Create empty complexity metrics
   */
  private createEmptyComplexityMetrics(): ComplexityMetrics {
    return {
      cyclomatic: 0,
      cognitive: 0,
      nestingDepth: 0,
      functionCount: 0,
      variableCount: 0,
      lineCount: 0,
      branchCount: 0,
      loopCount: 0,
    };
  }

  /**
   * Create empty obfuscation analysis
   */
  private createEmptyObfuscationAnalysis(): ObfuscationAnalysis {
    return {
      detected: false,
      confidence: 0,
      patterns: [],
      evidence: {
        minifiedVariables: 0,
        hexStrings: 0,
        unicodeEscapes: 0,
        evalUsage: 0,
        dynamicPropertyAccess: 0,
      },
    };
  }

  /**
   * Add custom security rule
   */
  addCustomRule(rule: SecurityRule): void {
    this.securityRules.push(rule);
    logger.info(`Added custom security rule: ${rule.name}`);
  }

  /**
   * Remove custom security rule
   */
  removeCustomRule(ruleId: string): boolean {
    const initialLength = this.securityRules.length;
    this.securityRules = this.securityRules.filter(rule => rule.id !== ruleId);

    if (this.securityRules.length < initialLength) {
      logger.info(`Removed custom security rule: ${ruleId}`);
      return true;
    }
    return false;
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    logger.info('Code analysis cache cleared');
  }

  /**
   * Get analysis statistics
   */
  getStats(): object {
    return {
      cacheSize: this.analysisCache.size,
      securityRules: this.securityRules.length,
      config: this.config,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.analysisCache.clear();
    logger.info('Code analyzer cleanup completed');
  }
}

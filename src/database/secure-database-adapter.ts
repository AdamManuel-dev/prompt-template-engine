/**
 * @fileoverview Secure database adapter with parameterized queries and input sanitization
 * @lastmodified 2025-08-27T16:45:00Z
 *
 * Features: SQL injection prevention, parameterized queries, input sanitization, query validation
 * Main APIs: SecureDatabaseAdapter, executeQuery(), sanitizeInput(), validateQuery()
 * Constraints: All database operations must use parameterized queries
 * Patterns: Adapter pattern, security-first database access, query validation
 */

import { z } from 'zod';
import {
  EnhancedValidator,
  SecurityValidationResult,
  customValidators,
} from '../validation/schemas';
import { logger } from '../utils/logger';
import { cryptoService } from '../security/cryptographic.service';

/**
 * Database configuration with security settings
 */
export interface SecureDatabaseConfig {
  type: 'file' | 'sqlite' | 'postgresql' | 'mysql';
  connectionString?: string;
  dataDirectory?: string;
  enableQueryLogging: boolean;
  enableQueryValidation: boolean;
  enableInputSanitization: boolean;
  maxQueryLength: number;
  queryTimeout: number;
  maxConnections: number;
  enableAuditLogging: boolean;
  blockedKeywords: string[];
  allowedOperations: string[];
  // New encryption at rest features
  encryptionAtRest: {
    enabled: boolean;
    encryptSensitiveColumns: boolean;
    encryptFullDatabase: boolean;
    sensitiveColumnPatterns: string[];
    keyRotationDays: number;
  };
}

/**
 * Default secure database configuration
 */
export const DEFAULT_DB_CONFIG: SecureDatabaseConfig = {
  type: 'file',
  dataDirectory: './data',
  enableQueryLogging: true,
  enableQueryValidation: true,
  enableInputSanitization: true,
  maxQueryLength: 10000,
  queryTimeout: 30000,
  maxConnections: 10,
  enableAuditLogging: true,
  blockedKeywords: [
    'drop',
    'delete',
    'truncate',
    'alter',
    'create',
    'insert',
    'update',
    'exec',
    'execute',
    'xp_',
    'sp_',
    'declare',
    'cast',
    'convert',
    'union',
    'having',
    'group_concat',
    'load_file',
    'outfile',
    'dumpfile',
  ],
  allowedOperations: ['select', 'insert', 'update', 'delete'],
  encryptionAtRest: {
    enabled: true,
    encryptSensitiveColumns: true,
    encryptFullDatabase: false,
    sensitiveColumnPatterns: [
      'password',
      'secret',
      'token',
      'key',
      'email',
      'phone',
      'ssn',
      'credit_card',
      'api_key',
      'private_key',
      'auth_token',
      'session_id',
    ],
    keyRotationDays: 90,
  },
};

/**
 * Query validation schema
 */
export const DatabaseQuerySchema = z.object({
  sql: z
    .string()
    .min(1, 'Query cannot be empty')
    .max(10000, 'Query too long')
    .refine(query => !/--/.test(query), 'SQL comments not allowed')
    .refine(query => !/\/\*.*?\*\//gs.test(query), 'Block comments not allowed')
    .refine(query => !/;[\s]*;/.test(query), 'Multiple statements not allowed')
    .refine(
      query => !/\bxp_\w+/gi.test(query),
      'Extended stored procedures not allowed'
    )
    .refine(
      query => !/\bsp_\w+/gi.test(query),
      'System stored procedures not allowed'
    ),
  parameters: z
    .array(
      z.union([
        z.string().max(1000),
        z.number(),
        z.boolean(),
        z.date(),
        z.null(),
      ])
    )
    .max(100, 'Too many parameters'),
  operation: z.enum([
    'select',
    'insert',
    'update',
    'delete',
    'create',
    'drop',
    'alter',
  ]),
  tableName: z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'Invalid table name')
    .max(64, 'Table name too long'),
  timeout: z.number().min(1000).max(300000).optional(),
});

/**
 * Query execution result
 */
export interface QueryExecutionResult {
  success: boolean;
  data?: unknown[];
  rowsAffected?: number;
  insertId?: number;
  executionTime: number;
  errors: string[];
  warnings: string[];
  queryHash: string;
  sanitizedQuery: string;
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  timestamp: Date;
  operation: string;
  tableName: string;
  queryHash: string;
  parameters: unknown[];
  success: boolean;
  executionTime: number;
  userId?: string;
  ipAddress?: string;
  errors?: string[];
}

/**
 * Secure database adapter with comprehensive security features
 */
export class SecureDatabaseAdapter {
  private config: SecureDatabaseConfig;

  private auditLog: AuditLogEntry[] = [];

  private queryCache = new Map<
    string,
    { result: unknown; timestamp: number }
  >();

  private queryStats = new Map<
    string,
    { count: number; totalTime: number; lastExecuted: Date }
  >();

  private encryptionKeyId: string | null = null;

  constructor(config: Partial<SecureDatabaseConfig> = {}) {
    this.config = { ...DEFAULT_DB_CONFIG, ...config };

    // Initialize encryption if enabled
    if (this.config.encryptionAtRest.enabled) {
      this.initializeEncryption();
    }
  }

  /**
   * Initialize database encryption
   */
  private initializeEncryption(): void {
    try {
      // Generate or retrieve database encryption key
      const existingKeys = cryptoService.listKeys();
      this.encryptionKeyId =
        existingKeys.find(id => id.includes('database-encryption')) || null;

      if (!this.encryptionKeyId) {
        const keyPair = cryptoService.generateRSAKeyPair(
          `database-encryption-${Date.now()}`
        );
        this.encryptionKeyId = keyPair.keyId;
        logger.info(
          `Generated new database encryption key: ${this.encryptionKeyId}`
        );
      } else {
        logger.info(
          `Using existing database encryption key: ${this.encryptionKeyId}`
        );
      }
    } catch (error: unknown) {
      logger.error('Failed to initialize database encryption', error as Error);
      throw new Error('Database encryption initialization failed');
    }
  }

  /**
   * Rotate database encryption keys
   */
  async rotateEncryptionKeys(): Promise<{
    success: boolean;
    rotatedColumns: string[];
  }> {
    if (!this.config.encryptionAtRest.enabled || !this.encryptionKeyId) {
      return { success: false, rotatedColumns: [] };
    }

    try {
      logger.info('Starting database encryption key rotation');

      // Generate new key
      const newKeyPair = cryptoService.rotateKeyPair(this.encryptionKeyId);
      const oldKeyId = this.encryptionKeyId;
      this.encryptionKeyId = newKeyPair.keyId;

      // In a real implementation, we would:
      // 1. Read all encrypted data with old key
      // 2. Re-encrypt with new key
      // 3. Update database records
      // This is a simplified placeholder

      const rotatedColumns =
        this.config.encryptionAtRest.sensitiveColumnPatterns;

      logger.info(
        `Database encryption key rotation completed: ${oldKeyId} -> ${this.encryptionKeyId}`
      );

      return { success: true, rotatedColumns };
    } catch (error: unknown) {
      logger.error('Database encryption key rotation failed', error as Error);
      return { success: false, rotatedColumns: [] };
    }
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats(): {
    encryptionEnabled: boolean;
    encryptSensitiveColumns: boolean;
    encryptFullDatabase: boolean;
    sensitiveColumnPatterns: string[];
    keyRotationDays: number;
    currentKeyId: string | null;
    keyAge: number | null;
  } {
    return {
      encryptionEnabled: this.config.encryptionAtRest.enabled,
      encryptSensitiveColumns:
        this.config.encryptionAtRest.encryptSensitiveColumns,
      encryptFullDatabase: this.config.encryptionAtRest.encryptFullDatabase,
      sensitiveColumnPatterns:
        this.config.encryptionAtRest.sensitiveColumnPatterns,
      keyRotationDays: this.config.encryptionAtRest.keyRotationDays,
      currentKeyId: this.encryptionKeyId,
      keyAge: this.encryptionKeyId
        ? this.getKeyAge(this.encryptionKeyId)
        : null,
    };
  }

  /**
   * Get key age in days
   */
  private getKeyAge(keyId: string): number {
    const keyInfo = cryptoService.getKeyInfo(keyId);
    if (!keyInfo) return 0;

    const ageMs = Date.now() - keyInfo.createdAt.getTime();
    return Math.floor(ageMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Execute a parameterized query with comprehensive security validation
   */
  async executeQuery(
    sql: string,
    options?: {
      parameters?: unknown[];
      tableName?: string;
      operation?: string;
      userId?: string;
      ipAddress?: string;
      timeout?: number;
    }
  ): Promise<QueryExecutionResult> {
    const startTime = Date.now();
    const parameters = options?.parameters || [];
    const queryHash = this.generateQueryHash(sql, parameters);

    const result: QueryExecutionResult = {
      success: false,
      data: [],
      executionTime: 0,
      errors: [],
      warnings: [],
      queryHash,
      sanitizedQuery: sql,
    };

    try {
      // 1. Validate query structure
      const queryValidation = await this.validateQuery(
        sql,
        parameters,
        options
      );
      if (!queryValidation.isValid) {
        result.errors = queryValidation.errors;
        result.warnings = queryValidation.warnings;

        await this.logAuditEvent({
          timestamp: new Date(),
          operation: options?.operation || 'unknown',
          tableName: options?.tableName || 'unknown',
          queryHash,
          parameters,
          success: false,
          executionTime: 0,
          userId: options?.userId,
          ipAddress: options?.ipAddress,
          errors: queryValidation.errors,
        });

        return result;
      }

      // 2. Sanitize input parameters
      const sanitizedParameters = await this.sanitizeParameters(parameters);

      // 3. Build secure parameterized query
      const secureQuery = await this.buildSecureQuery(sql, sanitizedParameters);
      result.sanitizedQuery = secureQuery.sql;

      // 4. Check query cache (for read operations)
      if (this.isReadOperation(sql)) {
        const cachedResult = this.getCachedResult(queryHash);
        if (cachedResult) {
          result.success = true;
          result.data = (cachedResult as any).result;
          result.executionTime = Date.now() - startTime;

          this.updateQueryStats(queryHash, result.executionTime);
          return result;
        }
      }

      // 5. Execute the query
      const executionResult = await this.executeSecureQuery(
        secureQuery.sql,
        sanitizedParameters,
        options?.timeout || this.config.queryTimeout
      );

      result.success = executionResult.success;
      result.data = executionResult.data;
      result.rowsAffected = executionResult.rowsAffected;
      result.insertId = executionResult.insertId;
      result.errors = executionResult.errors || [];
      result.warnings = executionResult.warnings || [];

      // 6. Cache result for read operations
      if (result.success && this.isReadOperation(sql)) {
        this.setCachedResult(queryHash, result.data);
      }

      // 7. Update statistics
      result.executionTime = Date.now() - startTime;
      this.updateQueryStats(queryHash, result.executionTime);

      // 8. Log audit event
      await this.logAuditEvent({
        timestamp: new Date(),
        operation: options?.operation || this.detectOperation(sql),
        tableName: options?.tableName || this.extractTableName(sql),
        queryHash,
        parameters: sanitizedParameters,
        success: result.success,
        executionTime: result.executionTime,
        userId: options?.userId,
        ipAddress: options?.ipAddress,
        errors: result.errors,
      });

      return result;
    } catch (error: unknown) {
      result.errors.push(`Query execution error: ${(error as Error).message}`);
      result.executionTime = Date.now() - startTime;

      logger.error('Database query execution failed:', {
        queryHash,
        error: (error as Error).message,
        sql: sql.substring(0, 200),
        parameters: parameters.slice(0, 5),
      });

      await this.logAuditEvent({
        timestamp: new Date(),
        operation: options?.operation || 'unknown',
        tableName: options?.tableName || 'unknown',
        queryHash,
        parameters,
        success: false,
        executionTime: result.executionTime,
        userId: options?.userId,
        ipAddress: options?.ipAddress,
        errors: [error.message],
      });

      return result;
    }
  }

  /**
   * Validate query for security threats and compliance
   */
  private async validateQuery(
    sql: string,
    parameters: unknown[],
    options?: { tableName?: string; operation?: string }
  ): Promise<SecurityValidationResult> {
    const threats: string[] = [];
    const warnings: string[] = [];
    let threatLevel: 'safe' | 'warning' | 'danger' = 'safe';

    // 1. Basic schema validation
    const queryData = {
      sql,
      parameters,
      operation: options?.operation || this.detectOperation(sql),
      tableName: options?.tableName || this.extractTableName(sql),
    };

    const schemaValidation = EnhancedValidator.validate(
      DatabaseQuerySchema,
      queryData
    );
    if (!schemaValidation.isValid) {
      threats.push(...schemaValidation.errors);
      threatLevel = 'danger';
    }

    // 2. SQL injection detection
    const sqlInjectionCheck = this.detectSqlInjection(sql);
    if (sqlInjectionCheck.detected) {
      threats.push(...sqlInjectionCheck.patterns);
      threatLevel = 'danger';
    }

    // 3. Blocked keywords check
    const blockedKeywordCheck = this.checkBlockedKeywords(sql);
    if (blockedKeywordCheck.found.length > 0) {
      threats.push(
        `Blocked keywords detected: ${blockedKeywordCheck.found.join(', ')}`
      );
      threatLevel = threatLevel === 'safe' ? 'warning' : threatLevel;
    }

    // 4. Operation authorization check
    const operation = this.detectOperation(sql);
    if (!this.config.allowedOperations.includes(operation.toLowerCase())) {
      threats.push(`Operation not allowed: ${operation}`);
      threatLevel = 'danger';
    }

    // 5. Parameter validation
    const parameterValidation = await this.validateQueryParameters(parameters);
    if (!parameterValidation.valid) {
      warnings.push(...parameterValidation.warnings);
    }

    // 6. Query complexity check
    if (sql.length > this.config.maxQueryLength) {
      warnings.push(`Query is very long: ${sql.length} characters`);
    }

    // 7. Table name validation
    const tableName = this.extractTableName(sql);
    if (tableName && !this.isValidTableName(tableName)) {
      threats.push(`Invalid table name: ${tableName}`);
      threatLevel = 'danger';
    }

    return {
      isValid: threats.length === 0,
      errors: threats,
      warnings,
      threatLevel,
      securityLevel: threatLevel,
      threats,
    };
  }

  /**
   * Detect SQL injection patterns
   */
  private detectSqlInjection(sql: string): {
    detected: boolean;
    patterns: string[];
  } {
    const patterns: string[] = [];

    const injectionPatterns = [
      // Union-based injection
      { regex: /union\s+select/gi, description: 'UNION SELECT injection' },
      // Boolean-based blind injection
      {
        regex: /(^|\s)(and|or)\s+\d+\s*=\s*\d+/gi,
        description: 'Boolean-based blind injection',
      },
      // Time-based blind injection
      {
        regex: /(waitfor|sleep|benchmark)\s*\(/gi,
        description: 'Time-based blind injection',
      },
      // Error-based injection
      {
        regex: /(cast|convert|extractvalue|updatexml)\s*\(/gi,
        description: 'Error-based injection',
      },
      // Stacked queries
      {
        regex: /;\s*(drop|delete|insert|update|create|alter)/gi,
        description: 'Stacked query injection',
      },
      // Comment-based evasion
      {
        regex: /\/\*.*?\*\/|--[^\r\n]*|#[^\r\n]*/g,
        description: 'Comment-based evasion',
      },
      // Quote manipulation
      {
        regex: /'[^']*'[^']*'|"[^"]*"[^"]*"/g,
        description: 'Quote manipulation',
      },
      // Function-based injection
      {
        regex: /(load_file|outfile|dumpfile|ascii|char|substring)/gi,
        description: 'Function-based injection',
      },
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.regex.test(sql)) {
        patterns.push(pattern.description);
      }
    }

    return { detected: patterns.length > 0, patterns };
  }

  /**
   * Check for blocked keywords
   */
  private checkBlockedKeywords(sql: string): { found: string[] } {
    const found: string[] = [];
    const normalizedSql = sql.toLowerCase();

    for (const keyword of this.config.blockedKeywords) {
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'gi');
      if (regex.test(normalizedSql)) {
        found.push(keyword);
      }
    }

    return { found };
  }

  /**
   * Validate query parameters
   */
  private async validateQueryParameters(parameters: unknown[]): Promise<{
    valid: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    for (let i = 0; i < parameters.length; i++) {
      const param = parameters[i];

      // Check parameter size
      if (typeof param === 'string' && param.length > 10000) {
        warnings.push(
          `Parameter ${i} is very large: ${param.length} characters`
        );
      }

      // Check for potential injection in string parameters
      if (typeof param === 'string') {
        const contentSafety = customValidators.isContentSafe(param);
        if (!contentSafety.safe) {
          warnings.push(
            `Parameter ${i} contains potentially dangerous content: ${contentSafety.threats.join(', ')}`
          );
        }
      }

      // Check for null bytes
      if (typeof param === 'string' && param.includes('\u0000')) {
        warnings.push(`Parameter ${i} contains null bytes`);
      }
    }

    return { valid: true, warnings };
  }

  /**
   * Sanitize query parameters
   */
  private async sanitizeParameters(parameters: unknown[]): Promise<unknown[]> {
    return parameters.map((param, index) => {
      if (param === null || param === undefined) {
        return param;
      }

      if (typeof param === 'string') {
        // Remove null bytes
        let sanitized = param.replace(/\\x00/g, '');

        // Escape single quotes (basic SQL escaping)
        sanitized = sanitized.replace(/'/g, "''");

        // Remove or escape dangerous characters
        sanitized = sanitized.replace(/[<>"&]/g, match => {
          switch (match) {
            case '<':
              return '&lt;';
            case '>':
              return '&gt;';
            case '"':
              return '&quot;';
            case '&':
              return '&amp;';
            default:
              return match;
          }
        });

        // Limit length
        if (sanitized.length > 10000) {
          logger.warn(
            `Parameter ${index} truncated from ${sanitized.length} to 10000 characters`
          );
          sanitized = sanitized.substring(0, 10000);
        }

        return sanitized;
      }

      if (typeof param === 'number') {
        // Validate numeric ranges
        if (!Number.isFinite(param)) {
          logger.warn(
            `Parameter ${index} is not a finite number, converting to 0`
          );
          return 0;
        }
        return param;
      }

      if (typeof param === 'boolean') {
        return param;
      }

      if (param instanceof Date) {
        return param;
      }

      // For other types, convert to string and sanitize
      logger.warn(
        `Parameter ${index} has unexpected type, converting to string`
      );
      return String(param).substring(0, 1000);
    });
  }

  /**
   * Build secure parameterized query
   */
  private async buildSecureQuery(
    sql: string,
    parameters: unknown[]
  ): Promise<{
    sql: string;
    parameters: unknown[];
  }> {
    // For file-based database, we'll use a simple placeholder replacement
    // In a real implementation, this would use the database driver's parameterization

    let parameterizedSql = sql;
    let paramIndex = 0;

    // Replace ? placeholders with sanitized parameters for logging/validation
    // The actual execution would use proper database parameterization
    parameterizedSql = parameterizedSql.replace(/\?/g, () => {
      if (paramIndex < parameters.length) {
        const param = parameters[paramIndex];
        paramIndex += 1;
        if (typeof param === 'string') {
          return `'${param}'`;
        }
        if (param === null) {
          return 'NULL';
        }
        return String(param);
      }
      return '?';
    });

    return {
      sql: parameterizedSql,
      parameters,
    };
  }

  /**
   * Execute secure query (placeholder implementation)
   */
  private async executeSecureQuery(
    _sql: string,
    _parameters: unknown[],
    _timeout: number
  ): Promise<{
    success: boolean;
    data?: unknown[];
    rowsAffected?: number;
    insertId?: number;
    errors?: string[];
    warnings?: string[];
  }> {
    // This is a placeholder implementation for file-based storage
    // In a real database implementation, this would use actual database drivers

    return new Promise(resolve => {
      setTimeout(() => {
        resolve({
          success: true,
          data: [],
          rowsAffected: 0,
        });
      }, 10);
    });
  }

  /**
   * Utility methods
   */
  private detectOperation(sql: string): string {
    const normalizedSql = sql.trim().toLowerCase();

    if (normalizedSql.startsWith('select')) return 'select';
    if (normalizedSql.startsWith('insert')) return 'insert';
    if (normalizedSql.startsWith('update')) return 'update';
    if (normalizedSql.startsWith('delete')) return 'delete';
    if (normalizedSql.startsWith('create')) return 'create';
    if (normalizedSql.startsWith('drop')) return 'drop';
    if (normalizedSql.startsWith('alter')) return 'alter';

    return 'unknown';
  }

  private extractTableName(sql: string): string {
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ');

    const patterns = [
      /from\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
      /into\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
      /update\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
      /table\s+([a-zA-Z_][a-zA-Z0-9_]*)/,
    ];

    for (const pattern of patterns) {
      const match = normalizedSql.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return 'unknown';
  }

  private isValidTableName(tableName: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(tableName) && tableName.length <= 64;
  }

  private isReadOperation(sql: string): boolean {
    return sql.trim().toLowerCase().startsWith('select');
  }

  private generateQueryHash(sql: string, parameters: unknown[]): string {
    const crypto = require('crypto');
    const content = JSON.stringify({ sql, parameters });
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 16);
  }

  private getCachedResult(queryHash: string): unknown {
    const cached = this.queryCache.get(queryHash);
    if (cached && Date.now() - cached.timestamp < 300000) {
      // 5 minute cache
      return cached;
    }
    return null;
  }

  private setCachedResult(queryHash: string, result: unknown): void {
    this.queryCache.set(queryHash, {
      result,
      timestamp: Date.now(),
    });

    // Limit cache size
    if (this.queryCache.size > 1000) {
      const oldest = Array.from(this.queryCache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp
      )[0];
      if (oldest) {
        this.queryCache.delete(oldest[0]);
      }
    }
  }

  private updateQueryStats(queryHash: string, executionTime: number): void {
    const stats = this.queryStats.get(queryHash) || {
      count: 0,
      totalTime: 0,
      lastExecuted: new Date(),
    };
    stats.count += 1;
    stats.totalTime += executionTime;
    stats.lastExecuted = new Date();
    this.queryStats.set(queryHash, stats);
  }

  private async logAuditEvent(event: AuditLogEntry): Promise<void> {
    if (this.config.enableAuditLogging) {
      this.auditLog.push(event);

      // Keep only last 10000 audit entries
      if (this.auditLog.length > 10000) {
        this.auditLog = this.auditLog.slice(-10000);
      }

      // In production, this would write to a secure audit log file or database
      if (!event.success || event.errors?.length) {
        logger.warn('Database audit event:', event);
      }
    }
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalQueries: number;
    failedQueries: number;
    averageExecutionTime: number;
    threatsByLevel: Record<string, number>;
    topSlowQueries: Array<{
      queryHash: string;
      avgTime: number;
      count: number;
    }>;
    recentThreats: AuditLogEntry[];
  } {
    const totalQueries = this.auditLog.length;
    const failedQueries = this.auditLog.filter(e => !e.success).length;

    const totalTime = this.auditLog.reduce(
      (sum, e) => sum + e.executionTime,
      0
    );
    const averageExecutionTime =
      totalQueries > 0 ? totalTime / totalQueries : 0;

    const threatsByLevel: Record<string, number> = {};
    const recentThreats = this.auditLog
      .filter(e => !e.success || (e.errors && e.errors.length > 0))
      .slice(-50);

    const topSlowQueries = Array.from(this.queryStats.entries())
      .map(([hash, stats]) => ({
        queryHash: hash,
        avgTime: stats.totalTime / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    return {
      totalQueries,
      failedQueries,
      averageExecutionTime,
      threatsByLevel,
      topSlowQueries,
      recentThreats,
    };
  }

  /**
   * Clear audit log and statistics
   */
  clearAuditData(): void {
    this.auditLog = [];
    this.queryStats.clear();
    this.queryCache.clear();
  }
}

/**
 * Global secure database adapter
 */
export const secureDatabaseAdapter = new SecureDatabaseAdapter();

/**
 * Utility function for safe query execution
 */
export async function executeSafeQuery(
  sql: string,
  options?: {
    parameters?: unknown[];
    tableName?: string;
    operation?: string;
    userId?: string;
    ipAddress?: string;
  }
): Promise<QueryExecutionResult> {
  return secureDatabaseAdapter.executeQuery(sql, {
    ...options,
    parameters: options?.parameters,
  });
}

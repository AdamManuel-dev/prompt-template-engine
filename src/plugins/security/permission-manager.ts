/**
 * @fileoverview Comprehensive plugin permission management system
 * @lastmodified 2025-08-27T13:15:00Z
 *
 * Features: Fine-grained permissions, role-based access, dynamic enforcement, audit logging
 * Main APIs: PermissionManager class for comprehensive access control
 * Constraints: Role-based access control, principle of least privilege, audit compliance
 * Patterns: RBAC, ACL, capability-based security, policy enforcement point
 */

import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { IPlugin } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Permission types for fine-grained access control
 */
export type PermissionType = 
  // System permissions
  | 'system.execute'
  | 'system.init'
  | 'system.config.read'
  | 'system.config.write'
  
  // File system permissions
  | 'fs.read'
  | 'fs.write'
  | 'fs.delete'
  | 'fs.create'
  | 'fs.list'
  
  // Network permissions
  | 'network.connect'
  | 'network.listen'
  | 'network.dns'
  | 'network.http'
  | 'network.https'
  
  // Process permissions
  | 'process.spawn'
  | 'process.exec'
  | 'process.signal'
  | 'process.info'
  
  // Security permissions
  | 'security.crypto'
  | 'security.random'
  | 'security.hash'
  
  // Storage permissions
  | 'storage.read'
  | 'storage.write'
  | 'storage.delete'
  
  // API permissions
  | 'api.call'
  | 'api.register'
  | 'api.unregister'
  
  // Inter-plugin permissions
  | 'plugin.message.send'
  | 'plugin.message.receive'
  | 'plugin.invoke'
  | 'plugin.list'
  
  // Administrative permissions
  | 'admin.user.manage'
  | 'admin.plugin.manage'
  | 'admin.system.manage'
  | 'admin.security.manage';

/**
 * Resource scope for permission targeting
 */
export interface ResourceScope {
  type: 'global' | 'path' | 'domain' | 'plugin' | 'user';
  value?: string; // Specific resource identifier
  pattern?: string; // Pattern matching for resources
}

/**
 * Individual permission definition
 */
export interface Permission {
  id: string;
  type: PermissionType;
  scope: ResourceScope;
  granted: boolean;
  conditions?: PermissionCondition[];
  expiry?: Date;
  metadata?: {
    reason?: string;
    grantedBy?: string;
    grantedAt?: Date;
    lastUsed?: Date;
    useCount?: number;
  };
}

/**
 * Permission condition for dynamic access control
 */
export interface PermissionCondition {
  type: 'time' | 'usage' | 'context' | 'custom';
  operator: '==' | '!=' | '<' | '>' | '<=' | '>=' | 'in' | 'not-in' | 'matches';
  field: string;
  value: unknown;
  description?: string;
}

/**
 * Security role definition
 */
export interface SecurityRole {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  inherit?: string[]; // Role inheritance
  restrictions?: {
    maxExecutionTime?: number;
    maxMemoryUsage?: number;
    maxNetworkRequests?: number;
    allowedHosts?: string[];
    deniedPaths?: string[];
  };
  metadata?: {
    createdAt: Date;
    createdBy: string;
    updatedAt?: Date;
    version: number;
  };
}

/**
 * Plugin security context
 */
export interface PluginSecurityContext {
  pluginId: string;
  pluginName: string;
  version: string;
  author?: string;
  roles: string[];
  permissions: Map<string, Permission>;
  trustLevel: 'untrusted' | 'basic' | 'verified' | 'trusted' | 'system';
  sandboxLevel: 'none' | 'basic' | 'strict' | 'maximum';
  executionContext?: {
    executionId: string;
    startTime: Date;
    userId?: string;
    sessionId?: string;
  };
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  granted: boolean;
  permission?: Permission;
  reason: string;
  conditions?: PermissionCondition[];
  fallbackAllowed?: boolean;
  auditInfo: {
    timestamp: Date;
    executionId?: string;
    resourceAccessed?: string;
    decision: 'allow' | 'deny' | 'defer';
  };
}

/**
 * Permission audit event
 */
export interface PermissionAuditEvent {
  id: string;
  timestamp: Date;
  eventType: 'check' | 'grant' | 'revoke' | 'escalate' | 'violation';
  pluginId: string;
  pluginName: string;
  permissionType: PermissionType;
  resource?: string;
  result: 'allowed' | 'denied' | 'error';
  reason: string;
  context?: {
    executionId?: string;
    userId?: string;
    sessionId?: string;
    stackTrace?: string;
  };
  riskScore?: number;
}

/**
 * Permission management configuration
 */
export interface PermissionConfig {
  // Default settings
  defaultTrustLevel: PluginSecurityContext['trustLevel'];
  defaultSandboxLevel: PluginSecurityContext['sandboxLevel'];
  strictMode: boolean;
  
  // Policy enforcement
  denyByDefault: boolean;
  requireExplicitGrant: boolean;
  enableRoleInheritance: boolean;
  
  // Auditing
  enableAuditLogging: boolean;
  auditLogRetention: number; // days
  detailedAuditLog: boolean;
  
  // Dynamic permissions
  enableDynamicPermissions: boolean;
  enableConditionalPermissions: boolean;
  permissionCacheTTL: number; // seconds
  
  // Security features
  enablePermissionEscalation: boolean;
  maxPermissionEscalations: number;
  escalationCooldown: number; // seconds
  enablePermissionRevocation: boolean;
}

/**
 * Default permission configuration
 */
export const DEFAULT_PERMISSION_CONFIG: PermissionConfig = {
  // Default settings
  defaultTrustLevel: 'untrusted',
  defaultSandboxLevel: 'strict',
  strictMode: true,
  
  // Policy enforcement
  denyByDefault: true,
  requireExplicitGrant: true,
  enableRoleInheritance: true,
  
  // Auditing
  enableAuditLogging: true,
  auditLogRetention: 90, // 90 days
  detailedAuditLog: true,
  
  // Dynamic permissions
  enableDynamicPermissions: true,
  enableConditionalPermissions: true,
  permissionCacheTTL: 300, // 5 minutes
  
  // Security features
  enablePermissionEscalation: false,
  maxPermissionEscalations: 3,
  escalationCooldown: 3600, // 1 hour
  enablePermissionRevocation: true,
};

/**
 * Comprehensive plugin permission management system
 */
export class PermissionManager extends EventEmitter {
  private config: PermissionConfig;
  private roles = new Map<string, SecurityRole>();
  private contexts = new Map<string, PluginSecurityContext>();
  private auditLog: PermissionAuditEvent[] = [];
  private permissionCache = new Map<string, { result: PermissionCheckResult; expiry: number }>();
  private escalationHistory = new Map<string, { count: number; lastEscalation: Date }>();

  constructor(config: Partial<PermissionConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PERMISSION_CONFIG, ...config };
    
    this.initializeDefaultRoles();
    logger.info('Plugin permission manager initialized');
  }

  /**
   * Create security context for a plugin
   */
  async createPluginContext(plugin: IPlugin, options: {
    trustLevel?: PluginSecurityContext['trustLevel'];
    roles?: string[];
    executionId?: string;
    userId?: string;
  } = {}): Promise<PluginSecurityContext> {
    const pluginId = `${plugin.name}@${plugin.version}`;
    
    const context: PluginSecurityContext = {
      pluginId,
      pluginName: plugin.name,
      version: plugin.version,
      author: plugin.author,
      roles: options.roles || ['plugin-basic'],
      permissions: new Map(),
      trustLevel: options.trustLevel || this.config.defaultTrustLevel,
      sandboxLevel: this.determineSandboxLevel(options.trustLevel || this.config.defaultTrustLevel),
      executionContext: options.executionId ? {
        executionId: options.executionId,
        startTime: new Date(),
        userId: options.userId,
        sessionId: crypto.randomUUID(),
      } : undefined,
    };

    // Load permissions from assigned roles
    await this.loadContextPermissions(context);
    
    // Store context
    this.contexts.set(pluginId, context);
    
    logger.info(`Created security context for ${plugin.name} with trust level: ${context.trustLevel}`);
    return context;
  }

  /**
   * Check if a plugin has permission for a specific action
   */
  async checkPermission(
    pluginId: string,
    permissionType: PermissionType,
    resource?: string,
    additionalContext?: Record<string, unknown>
  ): Promise<PermissionCheckResult> {
    const auditInfo = {
      timestamp: new Date(),
      executionId: this.contexts.get(pluginId)?.executionContext?.executionId,
      resourceAccessed: resource,
      decision: 'deny' as const,
    };

    try {
      // Get plugin context
      const context = this.contexts.get(pluginId);
      if (!context) {
        const result = this.createDeniedResult('Plugin context not found', auditInfo);
        await this.auditPermissionCheck(pluginId, 'unknown', permissionType, resource, result);
        return result;
      }

      // Check cache first
      const cacheKey = `${pluginId}:${permissionType}:${resource || 'global'}`;
      const cached = this.permissionCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        return cached.result;
      }

      // Find matching permission
      const permission = this.findMatchingPermission(context, permissionType, resource);
      if (!permission) {
        const result = this.config.denyByDefault 
          ? this.createDeniedResult('Permission not explicitly granted', auditInfo)
          : this.createAllowedResult('Default allow policy', auditInfo, undefined);
        
        await this.auditPermissionCheck(pluginId, context.pluginName, permissionType, resource, result);
        this.cachePermissionResult(cacheKey, result);
        return result;
      }

      // Check if permission is granted
      if (!permission.granted) {
        const result = this.createDeniedResult('Permission explicitly denied', auditInfo);
        await this.auditPermissionCheck(pluginId, context.pluginName, permissionType, resource, result);
        this.cachePermissionResult(cacheKey, result);
        return result;
      }

      // Check expiry
      if (permission.expiry && permission.expiry < new Date()) {
        const result = this.createDeniedResult('Permission expired', auditInfo);
        await this.auditPermissionCheck(pluginId, context.pluginName, permissionType, resource, result);
        this.cachePermissionResult(cacheKey, result);
        return result;
      }

      // Check conditions
      if (permission.conditions && permission.conditions.length > 0) {
        const conditionResult = await this.evaluateConditions(
          permission.conditions,
          context,
          additionalContext
        );
        
        if (!conditionResult.passed) {
          const result = this.createDeniedResult(
            `Condition not met: ${conditionResult.reason}`,
            auditInfo
          );
          await this.auditPermissionCheck(pluginId, context.pluginName, permissionType, resource, result);
          this.cachePermissionResult(cacheKey, result);
          return result;
        }
      }

      // Update usage statistics
      this.updatePermissionUsage(permission);

      // Permission granted
      auditInfo.decision = 'allow';
      const result = this.createAllowedResult('Permission granted', auditInfo, permission);
      
      await this.auditPermissionCheck(pluginId, context.pluginName, permissionType, resource, result);
      this.cachePermissionResult(cacheKey, result);
      
      return result;

    } catch (error: any) {
      logger.error(`Permission check error for ${pluginId}: ${error.message}`);
      const result = this.createDeniedResult(`Check error: ${error.message}`, auditInfo);
      await this.auditPermissionCheck(pluginId, 'unknown', permissionType, resource, result);
      return result;
    }
  }

  /**
   * Grant permission to a plugin
   */
  async grantPermission(
    pluginId: string,
    permissionType: PermissionType,
    scope: ResourceScope,
    options: {
      conditions?: PermissionCondition[];
      expiry?: Date;
      reason?: string;
      grantedBy?: string;
    } = {}
  ): Promise<boolean> {
    try {
      const context = this.contexts.get(pluginId);
      if (!context) {
        logger.error(`Cannot grant permission: Plugin context not found for ${pluginId}`);
        return false;
      }

      const permission: Permission = {
        id: crypto.randomUUID(),
        type: permissionType,
        scope,
        granted: true,
        conditions: options.conditions,
        expiry: options.expiry,
        metadata: {
          reason: options.reason || 'Programmatically granted',
          grantedBy: options.grantedBy || 'system',
          grantedAt: new Date(),
          useCount: 0,
        },
      };

      // Add to context
      context.permissions.set(permission.id, permission);

      // Clear permission cache for this plugin
      this.clearCacheForPlugin(pluginId);

      // Audit the grant
      await this.auditPermissionEvent('grant', {
        pluginId,
        pluginName: context.pluginName,
        permissionType,
        result: 'allowed',
        reason: options.reason || 'Permission granted',
        context: context.executionContext,
      });

      logger.info(`Granted ${permissionType} permission to ${context.pluginName}`);
      return true;

    } catch (error: any) {
      logger.error(`Failed to grant permission to ${pluginId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Revoke permission from a plugin
   */
  async revokePermission(
    pluginId: string,
    permissionId: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const context = this.contexts.get(pluginId);
      if (!context) {
        logger.error(`Cannot revoke permission: Plugin context not found for ${pluginId}`);
        return false;
      }

      const permission = context.permissions.get(permissionId);
      if (!permission) {
        logger.error(`Cannot revoke permission: Permission ${permissionId} not found`);
        return false;
      }

      // Remove permission
      context.permissions.delete(permissionId);

      // Clear permission cache
      this.clearCacheForPlugin(pluginId);

      // Audit the revocation
      await this.auditPermissionEvent('revoke', {
        pluginId,
        pluginName: context.pluginName,
        permissionType: permission.type,
        result: 'denied',
        reason: reason || 'Permission revoked',
        context: context.executionContext,
      });

      logger.info(`Revoked ${permission.type} permission from ${context.pluginName}`);
      return true;

    } catch (error: any) {
      logger.error(`Failed to revoke permission from ${pluginId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Request permission escalation
   */
  async requestPermissionEscalation(
    pluginId: string,
    targetTrustLevel: PluginSecurityContext['trustLevel'],
    justification: string
  ): Promise<boolean> {
    if (!this.config.enablePermissionEscalation) {
      logger.warn(`Permission escalation denied: Feature disabled for ${pluginId}`);
      return false;
    }

    try {
      const context = this.contexts.get(pluginId);
      if (!context) {
        logger.error(`Cannot escalate: Plugin context not found for ${pluginId}`);
        return false;
      }

      // Check escalation history
      const history = this.escalationHistory.get(pluginId) || { count: 0, lastEscalation: new Date(0) };
      const cooldownExpired = Date.now() - history.lastEscalation.getTime() > this.config.escalationCooldown * 1000;

      if (history.count >= this.config.maxPermissionEscalations && !cooldownExpired) {
        logger.warn(`Permission escalation denied: Max escalations reached for ${pluginId}`);
        return false;
      }

      // Evaluate escalation request
      const approved = await this.evaluateEscalationRequest(context, targetTrustLevel, justification);
      if (!approved) {
        logger.warn(`Permission escalation denied: Request not approved for ${pluginId}`);
        return false;
      }

      // Update trust level
      const previousTrustLevel = context.trustLevel;
      context.trustLevel = targetTrustLevel;
      context.sandboxLevel = this.determineSandboxLevel(targetTrustLevel);

      // Update escalation history
      this.escalationHistory.set(pluginId, {
        count: cooldownExpired ? 1 : history.count + 1,
        lastEscalation: new Date(),
      });

      // Reload permissions
      await this.loadContextPermissions(context);

      // Clear cache
      this.clearCacheForPlugin(pluginId);

      // Audit the escalation
      await this.auditPermissionEvent('escalate', {
        pluginId,
        pluginName: context.pluginName,
        permissionType: 'admin.security.manage', // Generic for escalation
        result: 'allowed',
        reason: `Trust level escalated from ${previousTrustLevel} to ${targetTrustLevel}: ${justification}`,
        context: context.executionContext,
        riskScore: this.calculateEscalationRisk(previousTrustLevel, targetTrustLevel),
      });

      logger.warn(`Permission escalation approved for ${context.pluginName}: ${previousTrustLevel} -> ${targetTrustLevel}`);
      return true;

    } catch (error: any) {
      logger.error(`Permission escalation error for ${pluginId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get all permissions for a plugin
   */
  getPluginPermissions(pluginId: string): Permission[] {
    const context = this.contexts.get(pluginId);
    return context ? Array.from(context.permissions.values()) : [];
  }

  /**
   * Get plugin security context
   */
  getPluginContext(pluginId: string): PluginSecurityContext | null {
    return this.contexts.get(pluginId) || null;
  }

  /**
   * Create or update a security role
   */
  async createRole(role: SecurityRole): Promise<void> {
    // Validate role
    this.validateRole(role);

    // Store role
    this.roles.set(role.id, role);

    // Update all contexts using this role
    for (const context of this.contexts.values()) {
      if (context.roles.includes(role.id)) {
        await this.loadContextPermissions(context);
        this.clearCacheForPlugin(context.pluginId);
      }
    }

    logger.info(`Security role created/updated: ${role.name}`);
  }

  /**
   * Get all security roles
   */
  getRoles(): SecurityRole[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get permission audit log
   */
  getAuditLog(limit?: number): PermissionAuditEvent[] {
    const log = this.auditLog.slice().reverse(); // Most recent first
    return limit ? log.slice(0, limit) : log;
  }

  /**
   * Find matching permission in context
   */
  private findMatchingPermission(
    context: PluginSecurityContext,
    permissionType: PermissionType,
    resource?: string
  ): Permission | null {
    for (const permission of context.permissions.values()) {
      if (permission.type !== permissionType) continue;
      
      if (this.scopeMatches(permission.scope, resource)) {
        return permission;
      }
    }
    return null;
  }

  /**
   * Check if resource scope matches
   */
  private scopeMatches(scope: ResourceScope, resource?: string): boolean {
    switch (scope.type) {
      case 'global':
        return true;
      
      case 'path':
        if (!resource || !scope.value) return false;
        if (scope.pattern) {
          const regex = new RegExp(scope.pattern);
          return regex.test(resource);
        }
        return resource.startsWith(scope.value);
      
      case 'domain':
        if (!resource || !scope.value) return false;
        try {
          const url = new URL(resource);
          return url.hostname === scope.value || url.hostname.endsWith(`.${scope.value}`);
        } catch {
          return resource.includes(scope.value);
        }
      
      case 'plugin':
        return resource === scope.value;
      
      case 'user':
        return resource === scope.value;
      
      default:
        return false;
    }
  }

  /**
   * Load permissions for a security context from roles
   */
  private async loadContextPermissions(context: PluginSecurityContext): Promise<void> {
    context.permissions.clear();

    const processedRoles = new Set<string>();
    const rolesToProcess = [...context.roles];

    while (rolesToProcess.length > 0) {
      const roleId = rolesToProcess.shift()!;
      
      if (processedRoles.has(roleId)) continue;
      processedRoles.add(roleId);

      const role = this.roles.get(roleId);
      if (!role) continue;

      // Add role permissions
      for (const permission of role.permissions) {
        context.permissions.set(permission.id, { ...permission });
      }

      // Add inherited roles
      if (this.config.enableRoleInheritance && role.inherit) {
        rolesToProcess.push(...role.inherit);
      }
    }
  }

  /**
   * Evaluate permission conditions
   */
  private async evaluateConditions(
    conditions: PermissionCondition[],
    context: PluginSecurityContext,
    additionalContext?: Record<string, unknown>
  ): Promise<{ passed: boolean; reason?: string }> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, context, additionalContext);
      if (!result.passed) {
        return result;
      }
    }
    return { passed: true };
  }

  /**
   * Evaluate single permission condition
   */
  private async evaluateCondition(
    condition: PermissionCondition,
    context: PluginSecurityContext,
    additionalContext?: Record<string, unknown>
  ): Promise<{ passed: boolean; reason?: string }> {
    let fieldValue: unknown;

    // Get field value based on condition type
    switch (condition.type) {
      case 'time':
        if (condition.field === 'hour') {
          fieldValue = new Date().getHours();
        } else if (condition.field === 'day') {
          fieldValue = new Date().getDay();
        } else if (condition.field === 'timestamp') {
          fieldValue = Date.now();
        }
        break;
      
      case 'usage':
        if (condition.field === 'count' && context.executionContext) {
          fieldValue = await this.getExecutionUsageCount(context.executionContext.executionId);
        }
        break;
      
      case 'context':
        if (condition.field === 'trustLevel') {
          fieldValue = context.trustLevel;
        } else if (condition.field === 'author') {
          fieldValue = context.author;
        } else if (additionalContext && condition.field in additionalContext) {
          fieldValue = additionalContext[condition.field];
        }
        break;
      
      case 'custom':
        // Custom condition evaluation would be implemented here
        break;
    }

    // Evaluate condition
    const passed = this.evaluateOperator(fieldValue, condition.operator, condition.value);
    
    return {
      passed,
      reason: passed ? undefined : `Condition failed: ${condition.field} ${condition.operator} ${condition.value}`,
    };
  }

  /**
   * Evaluate operator condition
   */
  private evaluateOperator(fieldValue: unknown, operator: PermissionCondition['operator'], conditionValue: unknown): boolean {
    switch (operator) {
      case '==':
        return fieldValue === conditionValue;
      case '!=':
        return fieldValue !== conditionValue;
      case '<':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue < conditionValue;
      case '>':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue > conditionValue;
      case '<=':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue <= conditionValue;
      case '>=':
        return typeof fieldValue === 'number' && typeof conditionValue === 'number' && fieldValue >= conditionValue;
      case 'in':
        return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      case 'not-in':
        return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
      case 'matches':
        return typeof fieldValue === 'string' && typeof conditionValue === 'string' && 
               new RegExp(conditionValue).test(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Update permission usage statistics
   */
  private updatePermissionUsage(permission: Permission): void {
    if (permission.metadata) {
      permission.metadata.lastUsed = new Date();
      permission.metadata.useCount = (permission.metadata.useCount || 0) + 1;
    }
  }

  /**
   * Create allowed permission result
   */
  private createAllowedResult(
    reason: string,
    auditInfo: PermissionCheckResult['auditInfo'],
    permission?: Permission
  ): PermissionCheckResult {
    auditInfo.decision = 'allow';
    return {
      granted: true,
      permission,
      reason,
      auditInfo,
    };
  }

  /**
   * Create denied permission result
   */
  private createDeniedResult(
    reason: string,
    auditInfo: PermissionCheckResult['auditInfo']
  ): PermissionCheckResult {
    auditInfo.decision = 'deny';
    return {
      granted: false,
      reason,
      auditInfo,
    };
  }

  /**
   * Cache permission check result
   */
  private cachePermissionResult(key: string, result: PermissionCheckResult): void {
    const expiry = Date.now() + (this.config.permissionCacheTTL * 1000);
    this.permissionCache.set(key, { result, expiry });
  }

  /**
   * Clear permission cache for a plugin
   */
  private clearCacheForPlugin(pluginId: string): void {
    const keysToDelete = Array.from(this.permissionCache.keys())
      .filter(key => key.startsWith(pluginId + ':'));
    
    for (const key of keysToDelete) {
      this.permissionCache.delete(key);
    }
  }

  /**
   * Audit permission check
   */
  private async auditPermissionCheck(
    pluginId: string,
    pluginName: string,
    permissionType: PermissionType,
    resource: string | undefined,
    result: PermissionCheckResult
  ): Promise<void> {
    if (!this.config.enableAuditLogging) return;

    const event: PermissionAuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      eventType: 'check',
      pluginId,
      pluginName,
      permissionType,
      resource,
      result: result.granted ? 'allowed' : 'denied',
      reason: result.reason,
      context: {
        executionId: result.auditInfo.executionId,
      },
    };

    this.auditLog.push(event);
    this.trimAuditLog();

    // Emit audit event
    this.emit('permissionAudit', event);
  }

  /**
   * Audit permission event
   */
  private async auditPermissionEvent(
    eventType: PermissionAuditEvent['eventType'],
    details: Partial<PermissionAuditEvent>
  ): Promise<void> {
    if (!this.config.enableAuditLogging) return;

    const event: PermissionAuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      eventType,
      ...details,
    } as PermissionAuditEvent;

    this.auditLog.push(event);
    this.trimAuditLog();

    // Emit audit event
    this.emit('permissionAudit', event);
  }

  /**
   * Trim audit log to retention limit
   */
  private trimAuditLog(): void {
    const retentionMs = this.config.auditLogRetention * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;
    
    this.auditLog = this.auditLog.filter(event => event.timestamp.getTime() > cutoff);
  }

  /**
   * Get execution usage count (placeholder implementation)
   */
  private async getExecutionUsageCount(executionId: string): Promise<number> {
    // This would integrate with the resource monitor
    return 0;
  }

  /**
   * Determine sandbox level based on trust level
   */
  private determineSandboxLevel(trustLevel: PluginSecurityContext['trustLevel']): PluginSecurityContext['sandboxLevel'] {
    switch (trustLevel) {
      case 'system':
        return 'none';
      case 'trusted':
        return 'basic';
      case 'verified':
        return 'basic';
      case 'basic':
        return 'strict';
      case 'untrusted':
      default:
        return 'maximum';
    }
  }

  /**
   * Evaluate permission escalation request
   */
  private async evaluateEscalationRequest(
    context: PluginSecurityContext,
    targetTrustLevel: PluginSecurityContext['trustLevel'],
    justification: string
  ): Promise<boolean> {
    // This would implement business logic for escalation approval
    // For now, allow escalation only for verified plugins
    return context.trustLevel === 'verified' && targetTrustLevel === 'trusted';
  }

  /**
   * Calculate escalation risk score
   */
  private calculateEscalationRisk(
    fromLevel: PluginSecurityContext['trustLevel'],
    toLevel: PluginSecurityContext['trustLevel']
  ): number {
    const levelValues = { untrusted: 0, basic: 25, verified: 50, trusted: 75, system: 100 };
    const fromValue = levelValues[fromLevel];
    const toValue = levelValues[toLevel];
    
    return Math.max(0, toValue - fromValue);
  }

  /**
   * Validate security role
   */
  private validateRole(role: SecurityRole): void {
    if (!role.id || !role.name) {
      throw new Error('Role must have id and name');
    }

    for (const permission of role.permissions) {
      if (!permission.id || !permission.type) {
        throw new Error('Role permissions must have id and type');
      }
    }
  }

  /**
   * Initialize default security roles
   */
  private initializeDefaultRoles(): void {
    const defaultRoles: SecurityRole[] = [
      {
        id: 'plugin-minimal',
        name: 'Minimal Plugin Role',
        description: 'Minimal permissions for basic plugin functionality',
        permissions: [
          {
            id: 'basic-execute',
            type: 'system.execute',
            scope: { type: 'global' },
            granted: true,
          },
          {
            id: 'basic-storage-read',
            type: 'storage.read',
            scope: { type: 'plugin', value: 'self' },
            granted: true,
          },
        ],
        metadata: {
          createdAt: new Date(),
          createdBy: 'system',
          version: 1,
        },
      },
      
      {
        id: 'plugin-basic',
        name: 'Basic Plugin Role',
        description: 'Standard permissions for typical plugins',
        permissions: [
          {
            id: 'basic-system',
            type: 'system.execute',
            scope: { type: 'global' },
            granted: true,
          },
          {
            id: 'basic-init',
            type: 'system.init',
            scope: { type: 'global' },
            granted: true,
          },
          {
            id: 'basic-storage',
            type: 'storage.read',
            scope: { type: 'plugin', value: 'self' },
            granted: true,
          },
          {
            id: 'basic-storage-write',
            type: 'storage.write',
            scope: { type: 'plugin', value: 'self' },
            granted: true,
          },
          {
            id: 'basic-fs-read',
            type: 'fs.read',
            scope: { type: 'path', pattern: '^./plugins/[^/]+/data/.*' },
            granted: true,
          },
        ],
        inherit: ['plugin-minimal'],
        metadata: {
          createdAt: new Date(),
          createdBy: 'system',
          version: 1,
        },
      },
      
      {
        id: 'plugin-advanced',
        name: 'Advanced Plugin Role',
        description: 'Extended permissions for advanced plugins',
        permissions: [
          {
            id: 'advanced-network',
            type: 'network.http',
            scope: { type: 'global' },
            granted: true,
            conditions: [
              {
                type: 'usage',
                operator: '<',
                field: 'count',
                value: 100,
                description: 'Limit to 100 network requests',
              },
            ],
          },
          {
            id: 'advanced-fs-write',
            type: 'fs.write',
            scope: { type: 'path', pattern: '^./plugins/[^/]+/data/.*' },
            granted: true,
          },
          {
            id: 'advanced-api-call',
            type: 'api.call',
            scope: { type: 'global' },
            granted: true,
          },
        ],
        inherit: ['plugin-basic'],
        metadata: {
          createdAt: new Date(),
          createdBy: 'system',
          version: 1,
        },
      },
      
      {
        id: 'plugin-trusted',
        name: 'Trusted Plugin Role',
        description: 'High-privilege permissions for trusted plugins',
        permissions: [
          {
            id: 'trusted-admin',
            type: 'admin.plugin.manage',
            scope: { type: 'plugin', value: 'self' },
            granted: true,
          },
          {
            id: 'trusted-process-info',
            type: 'process.info',
            scope: { type: 'global' },
            granted: true,
          },
          {
            id: 'trusted-crypto',
            type: 'security.crypto',
            scope: { type: 'global' },
            granted: true,
          },
        ],
        inherit: ['plugin-advanced'],
        restrictions: {
          maxExecutionTime: 30000,
          maxMemoryUsage: 100 * 1024 * 1024, // 100MB
          maxNetworkRequests: 1000,
        },
        metadata: {
          createdAt: new Date(),
          createdBy: 'system',
          version: 1,
        },
      },
    ];

    for (const role of defaultRoles) {
      this.roles.set(role.id, role);
    }

    logger.info(`Initialized ${defaultRoles.length} default security roles`);
  }

  /**
   * Get permission management statistics
   */
  getStats(): object {
    return {
      totalContexts: this.contexts.size,
      totalRoles: this.roles.size,
      auditLogSize: this.auditLog.length,
      cacheSize: this.permissionCache.size,
      escalationHistory: this.escalationHistory.size,
      config: this.config,
    };
  }

  /**
   * Cleanup and dispose resources
   */
  cleanup(): void {
    this.contexts.clear();
    this.permissionCache.clear();
    this.escalationHistory.clear();
    // Keep roles and audit log for persistence

    logger.info('Permission manager cleanup completed');
  }
}
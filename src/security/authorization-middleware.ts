/**
 * @fileoverview Advanced authorization middleware with resource-level access control
 * @lastmodified 2025-08-27T16:45:00Z
 *
 * Features: Resource-level permissions, policy evaluation, context-aware authorization
 * Main APIs: authorize(), requirePermission(), requireRole(), checkResourceAccess()
 * Constraints: Integrates with RBAC system, supports policy conditions, audit logging
 * Patterns: Authorization middleware, policy evaluation, resource protection, audit trails
 */

import { logger } from '../utils/logger';
import { rbacManager } from './rbac-manager.service';
import { sessionManager } from './session-manager.service';
import { jwtAuthService } from './jwt-auth.service';
import type { 
  AccessContext, 
  PermissionEvaluationResult,
  PolicyCondition 
} from './rbac-manager.service';

export interface AuthorizationRequest {
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
  method?: string;
  path?: string;
  user?: {
    id: string;
    username: string;
    email: string;
    roles: string[];
    permissions: string[];
    sessionId: string;
  };
  sessionInfo?: {
    sessionId: string;
    deviceId: string;
    ipAddress: string;
    userAgent: string;
  };
  resourceId?: string;
  resourceType?: string;
  metadata?: Record<string, any>;
}

export interface AuthorizationResult {
  authorized: boolean;
  user?: AuthorizationRequest['user'];
  session?: any;
  permissions: string[];
  evaluationResult?: PermissionEvaluationResult;
  error?: string;
  auditInfo?: {
    timestamp: Date;
    resource: string;
    action: string;
    granted: boolean;
    reason: string;
  };
}

export interface AuthorizationConfig {
  enableAuditLogging: boolean;
  enableSessionValidation: boolean;
  enableResourceLevelChecks: boolean;
  enablePolicyEvaluation: boolean;
  requireAuthentication: boolean;
  defaultDenyPolicy: boolean;
  rateLimitChecks: boolean;
}

/**
 * Authorization Middleware Service
 */
export class AuthorizationMiddleware {
  private config: AuthorizationConfig;
  private auditLog: Array<{
    timestamp: Date;
    userId: string;
    resource: string;
    action: string;
    granted: boolean;
    reason: string;
    context: any;
  }> = [];

  constructor(config: Partial<AuthorizationConfig> = {}) {
    this.config = {
      enableAuditLogging: true,
      enableSessionValidation: true,
      enableResourceLevelChecks: true,
      enablePolicyEvaluation: true,
      requireAuthentication: true,
      defaultDenyPolicy: true,
      rateLimitChecks: true,
      ...config,
    };
  }

  /**
   * Main authorization middleware
   */
  async authorize(
    permission: string,
    resourceType?: string,
    options: {
      allowOwnership?: boolean;
      requireAll?: boolean;
      conditions?: PolicyCondition[];
    } = {}
  ) {
    return async (request: AuthorizationRequest): Promise<AuthorizationResult> => {
      try {
        const startTime = Date.now();
        
        // Extract authentication information
        const authResult = await this.extractAuthInfo(request);
        if (!authResult.authorized) {
          return authResult;
        }

        const { user, session } = authResult;

        // Parse permission
        const [resource, action] = permission.split(':');
        if (!resource || !action) {
          return this.createFailureResult('Invalid permission format', resource, action);
        }

        // Create access context
        const context: AccessContext = {
          userId: user!.id,
          resource,
          action,
          resourceId: request.resourceId,
          timestamp: new Date(),
          metadata: {
            ...request.metadata,
            resourceType,
            method: request.method,
            path: request.path,
            sessionId: user!.sessionId,
          },
          clientInfo: request.sessionInfo ? {
            ipAddress: request.sessionInfo.ipAddress,
            userAgent: request.sessionInfo.userAgent,
          } : undefined,
        };

        // Check resource-level permissions
        if (this.config.enableResourceLevelChecks && resourceType && request.resourceId) {
          const resourceAccessResult = await this.checkResourceAccess(
            user!.id,
            resourceType,
            request.resourceId,
            action,
            options
          );

          if (!resourceAccessResult.authorized) {
            await this.logAuthorization(user!.id, resource, action, false, resourceAccessResult.error || 'Resource access denied', context);
            return resourceAccessResult;
          }
        }

        // Evaluate permission with RBAC
        const evaluationResult = await rbacManager.checkPermission(
          user!.id,
          resource,
          action,
          context
        );

        // Check additional conditions
        if (options.conditions && evaluationResult.granted) {
          for (const condition of options.conditions) {
            if (!this.evaluateCondition(condition, context, request)) {
              evaluationResult.granted = false;
              evaluationResult.reason = `Condition failed: ${condition.description || condition.field}`;
              break;
            }
          }
        }

        // Log authorization decision
        if (this.config.enableAuditLogging) {
          await this.logAuthorization(
            user!.id,
            resource,
            action,
            evaluationResult.granted,
            evaluationResult.reason,
            context
          );
        }

        const result: AuthorizationResult = {
          authorized: evaluationResult.granted,
          user,
          session,
          permissions: user!.permissions,
          evaluationResult,
          auditInfo: {
            timestamp: new Date(),
            resource,
            action,
            granted: evaluationResult.granted,
            reason: evaluationResult.reason,
          },
        };

        if (!evaluationResult.granted) {
          result.error = evaluationResult.reason;
        }

        logger.debug('Authorization completed', {
          userId: user!.id,
          permission,
          granted: evaluationResult.granted,
          evaluationTime: Date.now() - startTime,
        });

        return result;
      } catch (error) {
        logger.error('Authorization failed', error as Error);
        return this.createFailureResult('Authorization system error');
      }
    };
  }

  /**
   * Require specific permission
   */
  requirePermission(permission: string, resourceType?: string, options?: {
    allowOwnership?: boolean;
    conditions?: PolicyCondition[];
  }) {
    return this.authorize(permission, resourceType, options);
  }

  /**
   * Require specific role
   */
  requireRole(roleName: string) {
    return async (request: AuthorizationRequest): Promise<AuthorizationResult> => {
      const authResult = await this.extractAuthInfo(request);
      if (!authResult.authorized) {
        return authResult;
      }

      const { user } = authResult;
      const hasRole = user!.roles.includes(roleName);

      if (this.config.enableAuditLogging) {
        await this.logAuthorization(
          user!.id,
          'role',
          'check',
          hasRole,
          hasRole ? `Role ${roleName} granted` : `Role ${roleName} denied`,
          { userId: user!.id, resource: 'role', action: 'check', timestamp: new Date() }
        );
      }

      return {
        ...authResult,
        authorized: hasRole,
        error: hasRole ? undefined : `Role ${roleName} required`,
      };
    };
  }

  /**
   * Require any of the specified roles
   */
  requireAnyRole(roles: string[]) {
    return async (request: AuthorizationRequest): Promise<AuthorizationResult> => {
      const authResult = await this.extractAuthInfo(request);
      if (!authResult.authorized) {
        return authResult;
      }

      const { user } = authResult;
      const hasAnyRole = roles.some(role => user!.roles.includes(role));

      return {
        ...authResult,
        authorized: hasAnyRole,
        error: hasAnyRole ? undefined : `One of roles [${roles.join(', ')}] required`,
      };
    };
  }

  /**
   * Check ownership-based access
   */
  requireOwnership(resourceIdField: string = 'id') {
    return async (request: AuthorizationRequest): Promise<AuthorizationResult> => {
      const authResult = await this.extractAuthInfo(request);
      if (!authResult.authorized) {
        return authResult;
      }

      const { user } = authResult;
      const resourceId = request.params?.[resourceIdField] || request.resourceId;

      if (!resourceId) {
        return this.createFailureResult('Resource ID not found');
      }

      // Get resource ownership (this would typically involve a database lookup)
      const isOwner = await this.checkResourceOwnership(user!.id, resourceId);

      return {
        ...authResult,
        authorized: isOwner,
        error: isOwner ? undefined : 'Resource access denied: ownership required',
      };
    };
  }

  /**
   * Combined authentication and authorization
   */
  protect(
    permission?: string,
    options: {
      resourceType?: string;
      requireOwnership?: boolean;
      allowRoles?: string[];
      conditions?: PolicyCondition[];
    } = {}
  ) {
    return async (request: AuthorizationRequest): Promise<AuthorizationResult> => {
      // First check authentication
      const authResult = await this.extractAuthInfo(request);
      if (!authResult.authorized) {
        return authResult;
      }

      // Check roles if specified
      if (options.allowRoles && options.allowRoles.length > 0) {
        const roleCheck = await this.requireAnyRole(options.allowRoles)(request);
        if (!roleCheck.authorized) {
          return roleCheck;
        }
      }

      // Check ownership if required
      if (options.requireOwnership) {
        const ownershipCheck = await this.requireOwnership()(request);
        if (!ownershipCheck.authorized) {
          return ownershipCheck;
        }
      }

      // Check permission if specified
      if (permission) {
        const permissionCheck = await this.requirePermission(
          permission,
          options.resourceType,
          { conditions: options.conditions }
        )(request);
        
        return permissionCheck;
      }

      return authResult;
    };
  }

  /**
   * Private helper methods
   */
  private async extractAuthInfo(request: AuthorizationRequest): Promise<AuthorizationResult> {
    try {
      // Check if authentication is required
      if (!this.config.requireAuthentication) {
        return {
          authorized: true,
          permissions: [],
        };
      }

      // Extract JWT token
      const authHeader = request.headers?.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return this.createFailureResult('Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);

      // Verify JWT token
      const tokenResult = await jwtAuthService.verifyToken(token);
      if (!tokenResult.valid || !tokenResult.payload) {
        return this.createFailureResult(tokenResult.error || 'Invalid token');
      }

      const user = {
        id: tokenResult.payload.sub,
        username: tokenResult.payload.username,
        email: tokenResult.payload.email,
        roles: tokenResult.payload.roles,
        permissions: tokenResult.payload.permissions,
        sessionId: tokenResult.payload.sessionId,
      };

      // Validate session if enabled
      let session;
      if (this.config.enableSessionValidation) {
        const sessionValidation = await sessionManager.validateSession(
          tokenResult.payload.sessionId,
          request.sessionInfo ? {
            ipAddress: request.sessionInfo.ipAddress,
            userAgent: request.sessionInfo.userAgent,
          } : undefined
        );

        if (!sessionValidation.valid) {
          return this.createFailureResult(sessionValidation.error || 'Invalid session');
        }

        session = sessionValidation.session;

        // Check for security issues
        if (sessionValidation.securityIssues && sessionValidation.securityIssues.length > 0) {
          logger.warn('Session security issues detected', {
            userId: user.id,
            sessionId: tokenResult.payload.sessionId,
            issues: sessionValidation.securityIssues,
          });

          if (sessionValidation.requiresAction === 'security_check') {
            return this.createFailureResult('Security verification required');
          }
        }
      }

      return {
        authorized: true,
        user,
        session,
        permissions: user.permissions,
      };
    } catch (error) {
      logger.error('Authentication extraction failed', error as Error);
      return this.createFailureResult('Authentication failed');
    }
  }

  private async checkResourceAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    options: {
      allowOwnership?: boolean;
    } = {}
  ): Promise<AuthorizationResult> {
    try {
      // Check if user has global permission for resource type
      const hasGlobalPermission = await rbacManager.hasPermission(
        userId,
        `${resourceType}:${action}`
      );

      if (hasGlobalPermission) {
        return { authorized: true, permissions: [] };
      }

      // Check ownership if allowed
      if (options.allowOwnership) {
        const isOwner = await this.checkResourceOwnership(userId, resourceId);
        if (isOwner) {
          const hasOwnerPermission = await rbacManager.hasPermission(
            userId,
            `${resourceType}:${action}:own`
          );
          
          if (hasOwnerPermission) {
            return { authorized: true, permissions: [] };
          }
        }
      }

      return this.createFailureResult('Insufficient permissions for resource');
    } catch (error) {
      logger.error('Resource access check failed', error as Error);
      return this.createFailureResult('Resource access check error');
    }
  }

  private async checkResourceOwnership(userId: string, resourceId: string): Promise<boolean> {
    // This would typically involve database lookups
    // For now, return a mock implementation
    logger.debug('Checking resource ownership', { userId, resourceId });
    return false; // Mock: always deny ownership for security
  }

  private evaluateCondition(
    condition: PolicyCondition,
    context: AccessContext,
    request: AuthorizationRequest
  ): boolean {
    try {
      let fieldValue: any;

      // Get field value from context or request
      switch (condition.type) {
        case 'time':
          fieldValue = new Date().getHours();
          break;
        case 'location':
          fieldValue = context.clientInfo?.location?.country;
          break;
        case 'resource':
          fieldValue = context.resourceId;
          break;
        case 'custom':
          fieldValue = this.getCustomFieldValue(condition.field, context, request);
          break;
        default:
          return false;
      }

      // Evaluate condition
      switch (condition.operator) {
        case 'eq':
          return fieldValue === condition.value;
        case 'ne':
          return fieldValue !== condition.value;
        case 'lt':
          return fieldValue < condition.value;
        case 'le':
          return fieldValue <= condition.value;
        case 'gt':
          return fieldValue > condition.value;
        case 'ge':
          return fieldValue >= condition.value;
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        case 'nin':
          return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'regex':
          return new RegExp(condition.value).test(String(fieldValue));
        default:
          return false;
      }
    } catch (error) {
      logger.error('Condition evaluation failed', error as Error);
      return false;
    }
  }

  private getCustomFieldValue(field: string, context: AccessContext, request: AuthorizationRequest): any {
    // Extract field value from nested objects
    const sources = [context, request, request.body, request.query, request.params];
    
    for (const source of sources) {
      if (source && typeof source === 'object') {
        const value = this.getNestedValue(source, field);
        if (value !== undefined) {
          return value;
        }
      }
    }
    
    return undefined;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  private async logAuthorization(
    userId: string,
    resource: string,
    action: string,
    granted: boolean,
    reason: string,
    context: any
  ): Promise<void> {
    const entry = {
      timestamp: new Date(),
      userId,
      resource,
      action,
      granted,
      reason,
      context,
    };

    this.auditLog.push(entry);

    // Limit audit log size
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }

    logger.info('Authorization decision logged', {
      userId,
      resource,
      action,
      granted,
      reason,
    });
  }

  private createFailureResult(
    error: string,
    resource?: string,
    action?: string
  ): AuthorizationResult {
    return {
      authorized: false,
      permissions: [],
      error,
      auditInfo: resource && action ? {
        timestamp: new Date(),
        resource,
        action,
        granted: false,
        reason: error,
      } : undefined,
    };
  }

  /**
   * Get authorization statistics
   */
  getStats(): {
    totalChecks: number;
    successfulChecks: number;
    failedChecks: number;
    averageResponseTime: number;
    topResources: Array<{ resource: string; count: number }>;
    topUsers: Array<{ userId: string; count: number }>;
  } {
    const totalChecks = this.auditLog.length;
    const successfulChecks = this.auditLog.filter(entry => entry.granted).length;
    const failedChecks = totalChecks - successfulChecks;

    // Calculate top resources
    const resourceCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};

    for (const entry of this.auditLog) {
      resourceCounts[entry.resource] = (resourceCounts[entry.resource] || 0) + 1;
      userCounts[entry.userId] = (userCounts[entry.userId] || 0) + 1;
    }

    const topResources = Object.entries(resourceCounts)
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topUsers = Object.entries(userCounts)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalChecks,
      successfulChecks,
      failedChecks,
      averageResponseTime: 0, // Would need to track timing
      topResources,
      topUsers,
    };
  }

  /**
   * Get audit log entries
   */
  getAuditLog(
    options: {
      userId?: string;
      resource?: string;
      action?: string;
      granted?: boolean;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    let filtered = [...this.auditLog];

    if (options.userId) {
      filtered = filtered.filter(entry => entry.userId === options.userId);
    }

    if (options.resource) {
      filtered = filtered.filter(entry => entry.resource === options.resource);
    }

    if (options.action) {
      filtered = filtered.filter(entry => entry.action === options.action);
    }

    if (options.granted !== undefined) {
      filtered = filtered.filter(entry => entry.granted === options.granted);
    }

    if (options.startDate) {
      filtered = filtered.filter(entry => entry.timestamp >= options.startDate!);
    }

    if (options.endDate) {
      filtered = filtered.filter(entry => entry.timestamp <= options.endDate!);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }
}

/**
 * Global authorization middleware instance
 */
export const authorizationMiddleware = new AuthorizationMiddleware();

/**
 * Convenience functions for common authorization patterns
 */
export const requireAuth = () => authorizationMiddleware.protect();
export const requirePermission = (permission: string, resourceType?: string) =>
  authorizationMiddleware.requirePermission(permission, resourceType);
export const requireRole = (role: string) => authorizationMiddleware.requireRole(role);
export const requireAnyRole = (roles: string[]) => authorizationMiddleware.requireAnyRole(roles);
export const requireOwnership = (resourceIdField?: string) => 
  authorizationMiddleware.requireOwnership(resourceIdField);

/**
 * Advanced protection with multiple requirements
 */
export const protect = (options: {
  permission?: string;
  resourceType?: string;
  requireOwnership?: boolean;
  allowRoles?: string[];
  conditions?: PolicyCondition[];
} = {}) => authorizationMiddleware.protect(options.permission, options);
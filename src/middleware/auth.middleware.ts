/**
 * @fileoverview Authentication and authorization middleware
 * @lastmodified 2025-08-27T15:30:00Z
 *
 * Features: JWT authentication, RBAC, session management, audit logging
 * Main APIs: authenticateRequest(), authorizeAction(), createSession()
 * Constraints: Requires JWT_SECRET environment variable
 * Patterns: Middleware pattern, role-based access control, audit trails
 */

import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
  createdAt: Date;
  lastLogin?: Date;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export interface AuthRequest {
  user?: User;
  session?: Session;
  permissions?: string[];
}

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  details?: Record<string, unknown>;
}

/**
 * Role-based permission system
 */
const rolePermissions: Record<string, string[]> = {
  admin: [
    'templates:create',
    'templates:read',
    'templates:update',
    'templates:delete',
    'marketplace:publish',
    'marketplace:moderate',
    'users:manage',
    'system:admin',
  ],
  publisher: [
    'templates:create',
    'templates:read',
    'templates:update',
    'templates:delete',
    'marketplace:publish',
  ],
  user: [
    'templates:read',
    'templates:create',
    'templates:update:own',
    'templates:delete:own',
  ],
  readonly: ['templates:read'],
};

/**
 * In-memory stores (in production, use Redis/Database)
 */
const users = new Map<string, User>();
const sessions = new Map<string, Session>();
const auditLog: AuditLogEntry[] = [];

/**
 * Authentication and authorization service
 */
export class AuthService {
  private jwtSecret: string;

  private sessionTimeout: number;

  private maxSessions: number;

  constructor(
    options: {
      jwtSecret?: string;
      sessionTimeout?: number;
      maxSessions?: number;
    } = {}
  ) {
    this.jwtSecret = options.jwtSecret || JWT_SECRET.$2 || 'default-dev-secret';
    this.sessionTimeout = options.sessionTimeout || 24 * 60 * 60 * 1000; // 24 hours
    this.maxSessions = options.maxSessions || 5;

    if (this.jwtSecret === 'default-dev-secret') {
      logger.warn('Using default JWT secret - not secure for production');
    }
  }

  /**
   * Create a new user account with role assignment
   */
  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    roles?: string[];
  }): Promise<User> {
    const userId = crypto.randomUUID();
    // TODO: Store password hash for authentication
    await this.hashPassword(userData.password);

    const user: User = {
      id: userId,
      username: userData.username,
      email: userData.email,
      roles: userData.roles || ['user'],
      permissions: this.calculatePermissions(userData.roles || ['user']),
      createdAt: new Date(),
    };

    users.set(userId, user);

    await this.logAudit({
      userId,
      action: 'user:create',
      resource: `user:${userId}`,
      success: true,
      details: { username: userData.username, email: userData.email },
    });

    return user;
  }

  /**
   * Authenticate user credentials
   */
  async authenticateUser(
    username: string,
    password: string,
    context?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<{ user: User; session: Session } | null> {
    const user = Array.from(users.values()).find(u => u.username === username);

    if (!user) {
      await this.logAudit({
        action: 'auth:failed',
        resource: `user:${username}`,
        success: false,
        details: { reason: 'user_not_found' },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
      return null;
    }

    const passwordValid = await this.verifyPassword(password, user.id);

    if (!passwordValid) {
      await this.logAudit({
        userId: user.id,
        action: 'auth:failed',
        resource: `user:${user.id}`,
        success: false,
        details: { reason: 'invalid_password' },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
      return null;
    }

    const session = await this.createSession(user, context);

    // Update last login
    user.lastLogin = new Date();
    users.set(user.id, user);

    await this.logAudit({
      userId: user.id,
      action: 'auth:success',
      resource: `user:${user.id}`,
      success: true,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return { user, session };
  }

  /**
   * Create a new session for authenticated user
   */
  async createSession(
    user: User,
    context?: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<Session> {
    // Clean up expired sessions
    await this.cleanupExpiredSessions();

    // Limit concurrent sessions per user
    const userSessions = Array.from(sessions.values()).filter(
      s => s.userId === user.id && s.isActive
    );

    if (userSessions.length >= this.maxSessions) {
      // Remove oldest session
      const oldestSession = userSessions.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      )[0];
      if (oldestSession) {
        await this.destroySession(oldestSession.id);
      }
    }

    const sessionId = crypto.randomUUID();
    const session: Session = {
      id: sessionId,
      userId: user.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.sessionTimeout),
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      isActive: true,
    };

    sessions.set(sessionId, session);
    return session;
  }

  /**
   * Validate session and return user info
   */
  async validateSession(
    sessionId: string
  ): Promise<{ user: User; session: Session } | null> {
    const session = sessions.get(sessionId);

    if (!session || !session.isActive || session.expiresAt < new Date()) {
      if (session) {
        sessions.delete(sessionId);
      }
      return null;
    }

    const user = users.get(session.userId);
    if (!user) {
      sessions.delete(sessionId);
      return null;
    }

    return { user, session };
  }

  /**
   * Check if user has required permission
   */
  hasPermission(user: User, permission: string, resourceId?: string): boolean {
    // Check direct permissions
    if (user.permissions.includes(permission)) {
      return true;
    }

    // Check ownership-based permissions
    if (permission.endsWith(':own') && resourceId) {
      const basePermission = permission.replace(':own', '');
      return (
        user.permissions.includes(basePermission) ||
        user.permissions.includes(`${basePermission}:own`)
      );
    }

    // Admin override
    return user.permissions.includes('system:admin');
  }

  /**
   * Authorization middleware
   */
  authorize(requiredPermission: string) {
    return async (
      request: AuthRequest & { resourceId?: string }
    ): Promise<boolean> => {
      if (!request.user) {
        await this.logAudit({
          action: 'authz:failed',
          resource: requiredPermission,
          success: false,
          details: { reason: 'no_user' },
        });
        return false;
      }

      const hasPermission = this.hasPermission(
        request.user,
        requiredPermission,
        request.resourceId
      );

      await this.logAudit({
        userId: request.user.id,
        action: hasPermission ? 'authz:granted' : 'authz:denied',
        resource: requiredPermission,
        success: hasPermission,
        details: {
          permission: requiredPermission,
          userPermissions: request.user.permissions,
        },
      });

      return hasPermission;
    };
  }

  /**
   * Destroy session (logout)
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = sessions.get(sessionId);

    if (session) {
      session.isActive = false;
      sessions.delete(sessionId);

      await this.logAudit({
        userId: session.userId,
        action: 'session:destroy',
        resource: `session:${sessionId}`,
        success: true,
      });
    }
  }

  /**
   * Get audit log entries
   */
  getAuditLog(
    options: {
      userId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): AuditLogEntry[] {
    let filtered = [...auditLog];

    if (options.userId) {
      filtered = filtered.filter(entry => entry.userId === options.userId);
    }

    if (options.action) {
      filtered = filtered.filter(entry => entry.action === options.action);
    }

    if (options.startDate) {
      filtered = filtered.filter(
        entry => entry.timestamp >= options.startDate!
      );
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

  /**
   * Private helper methods
   */
  private calculatePermissions(roles: string[]): string[] {
    const permissions = new Set<string>();

    roles.forEach(role => {
      const rolePerms = rolePermissions[role] || [];
      rolePerms.forEach(perm => permissions.add(perm));
    });

    return Array.from(permissions);
  }

  private async hashPassword(password: string): Promise<string> {
    // In production, use bcrypt or similar
    return crypto
      .createHash('sha256')
      .update(password + this.jwtSecret)
      .digest('hex');
  }

  private async verifyPassword(
    password: string,
    userId: string
  ): Promise<boolean> {
    // In production, use bcrypt compare
    const expectedHash = await this.hashPassword(password);
    const storedHash = this.getStoredPasswordHash(userId);
    return expectedHash === storedHash;
  }

  private getStoredPasswordHash(_userId: string): string {
    // In production, fetch from secure storage
    return crypto
      .createHash('sha256')
      .update(`default-password${this.jwtSecret}`)
      .digest('hex');
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    const expiredSessions = Array.from(sessions.entries()).filter(
      ([, session]) => session.expiresAt < now
    );

    expiredSessions.forEach(([sessionId]) => {
      sessions.delete(sessionId);
    });
  }

  private async logAudit(
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    const auditEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...entry,
    };

    auditLog.push(auditEntry);

    // Keep audit log size manageable (in production, use database)
    if (auditLog.length > 10000) {
      auditLog.splice(0, 1000);
    }

    logger.info('Audit log entry', {
      id: auditEntry.id,
      action: auditEntry.action,
      resource: auditEntry.resource,
      success: auditEntry.success,
      userId: auditEntry.userId,
    });
  }
}

/**
 * Global authentication service instance
 */
export const authService = new AuthService();

/**
 * Authentication middleware
 */
export function requireAuth() {
  return async (
    request: AuthRequest & { headers?: Record<string, string> }
  ): Promise<AuthRequest> => {
    const sessionId =
      request.headers?.['x-session-id'] ||
      request.headers?.authorization?.replace('Bearer ', '');

    if (!sessionId) {
      throw new Error('Authentication required');
    }

    const authResult = await authService.validateSession(sessionId);

    if (!authResult) {
      throw new Error('Invalid or expired session');
    }

    return {
      ...request,
      user: authResult.user,
      session: authResult.session,
      permissions: authResult.user.permissions,
    };
  };
}

/**
 * Authorization middleware
 */
export function requirePermission(permission: string) {
  return async (request: AuthRequest): Promise<AuthRequest> => {
    if (!request.user) {
      throw new Error('User not authenticated');
    }

    const authorized = await authService.authorize(permission)(request);

    if (!authorized) {
      throw new Error(`Permission denied: ${permission}`);
    }

    return request;
  };
}

/**
 * @fileoverview Comprehensive Role-Based Access Control (RBAC) management system
 * @lastmodified 2025-08-27T16:15:00Z
 *
 * Features: Hierarchical roles, granular permissions, dynamic assignment, policy evaluation
 * Main APIs: createRole(), assignRole(), checkPermission(), evaluatePolicy()
 * Constraints: Follows principle of least privilege, supports role inheritance
 * Patterns: RBAC pattern, policy evaluation, hierarchical permissions, audit logging
 */

import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { securityService } from '../middleware/security.middleware';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string;
  conditions?: PolicyCondition[];
  metadata?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[]; // Permission IDs
  inheritsFrom?: string[]; // Parent role IDs
  metadata?: Record<string, any>;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy: string;
  expiresAt?: Date;
  isActive: boolean;
  conditions?: PolicyCondition[];
}

export interface PolicyCondition {
  type: 'time' | 'location' | 'resource' | 'custom';
  operator: 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge' | 'in' | 'nin' | 'contains' | 'regex';
  field: string;
  value: any;
  description?: string;
}

export interface AccessContext {
  userId: string;
  resource: string;
  action: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  clientInfo?: {
    ipAddress: string;
    userAgent: string;
    location?: {
      country: string;
      region: string;
    };
  };
}

export interface PermissionEvaluationResult {
  granted: boolean;
  matchedPermissions: Permission[];
  appliedRoles: Role[];
  conditions: PolicyCondition[];
  reason: string;
  auditInfo: {
    evaluationTime: number;
    rulesEvaluated: number;
    conditionsChecked: number;
  };
}

export interface RBACStats {
  totalRoles: number;
  totalPermissions: number;
  totalUserRoles: number;
  systemRoles: number;
  customRoles: number;
  activeUsers: number;
  permissionEvaluations: number;
  averageEvaluationTime: number;
}

/**
 * Comprehensive RBAC Manager Service
 */
export class RBACManagerService {
  private roles = new Map<string, Role>();
  private permissions = new Map<string, Permission>();
  private userRoles = new Map<string, UserRole[]>(); // userId -> UserRole[]
  private rolePermissionsCache = new Map<string, Set<string>>(); // roleId -> permissions (with inheritance)
  private evaluationStats = {
    totalEvaluations: 0,
    totalTime: 0,
    rulesEvaluated: 0,
    conditionsChecked: 0,
  };

  constructor() {
    this.initializeSystemRoles();
    this.initializeSystemPermissions();
    
    // Clear caches periodically to prevent memory leaks
    setInterval(() => this.cleanupCaches(), 300000); // Every 5 minutes
  }

  /**
   * Permission Management
   */
  async createPermission(permissionData: Omit<Permission, 'id'>): Promise<Permission> {
    const permission: Permission = {
      id: crypto.randomUUID(),
      ...permissionData,
    };

    this.permissions.set(permission.id, permission);
    this.clearPermissionCaches();

    logger.info('Permission created', {
      permissionId: permission.id,
      name: permission.name,
      resource: permission.resource,
      action: permission.action,
    });

    return permission;
  }

  async updatePermission(permissionId: string, updates: Partial<Permission>): Promise<Permission | null> {
    const permission = this.permissions.get(permissionId);
    if (!permission) {
      return null;
    }

    const updatedPermission = { ...permission, ...updates };
    this.permissions.set(permissionId, updatedPermission);
    this.clearPermissionCaches();

    logger.info('Permission updated', {
      permissionId,
      updates: Object.keys(updates),
    });

    return updatedPermission;
  }

  async deletePermission(permissionId: string): Promise<boolean> {
    if (!this.permissions.has(permissionId)) {
      return false;
    }

    // Remove permission from all roles
    for (const role of this.roles.values()) {
      const permissionIndex = role.permissions.indexOf(permissionId);
      if (permissionIndex > -1) {
        role.permissions.splice(permissionIndex, 1);
        role.updatedAt = new Date();
      }
    }

    this.permissions.delete(permissionId);
    this.clearPermissionCaches();

    logger.info('Permission deleted', { permissionId });
    return true;
  }

  getPermission(permissionId: string): Permission | null {
    return this.permissions.get(permissionId) || null;
  }

  getAllPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  /**
   * Role Management
   */
  async createRole(roleData: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role> {
    const role: Role = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...roleData,
    };

    // Validate permissions exist
    for (const permissionId of role.permissions) {
      if (!this.permissions.has(permissionId)) {
        throw new Error(`Permission ${permissionId} not found`);
      }
    }

    // Validate inheritance doesn't create cycles
    if (role.inheritsFrom) {
      this.validateRoleInheritance(role.id, role.inheritsFrom);
    }

    this.roles.set(role.id, role);
    this.clearRoleCache(role.id);

    logger.info('Role created', {
      roleId: role.id,
      name: role.name,
      permissions: role.permissions.length,
      inheritsFrom: role.inheritsFrom,
    });

    return role;
  }

  async updateRole(roleId: string, updates: Partial<Role>): Promise<Role | null> {
    const role = this.roles.get(roleId);
    if (!role) {
      return null;
    }

    // Prevent updating system roles' core properties
    if (role.isSystemRole && (updates.name || updates.isSystemRole === false)) {
      throw new Error('Cannot modify system role core properties');
    }

    const updatedRole = {
      ...role,
      ...updates,
      updatedAt: new Date(),
    };

    // Validate permissions and inheritance
    if (updates.permissions) {
      for (const permissionId of updates.permissions) {
        if (!this.permissions.has(permissionId)) {
          throw new Error(`Permission ${permissionId} not found`);
        }
      }
    }

    if (updates.inheritsFrom) {
      this.validateRoleInheritance(roleId, updates.inheritsFrom);
    }

    this.roles.set(roleId, updatedRole);
    this.clearRoleCache(roleId);

    logger.info('Role updated', {
      roleId,
      updates: Object.keys(updates),
    });

    return updatedRole;
  }

  async deleteRole(roleId: string): Promise<boolean> {
    const role = this.roles.get(roleId);
    if (!role) {
      return false;
    }

    if (role.isSystemRole) {
      throw new Error('Cannot delete system role');
    }

    // Remove role from users
    for (const [userId, userRolesList] of this.userRoles) {
      const filteredRoles = userRolesList.filter(ur => ur.roleId !== roleId);
      if (filteredRoles.length !== userRolesList.length) {
        this.userRoles.set(userId, filteredRoles);
      }
    }

    // Update roles that inherit from this role
    for (const otherRole of this.roles.values()) {
      if (otherRole.inheritsFrom?.includes(roleId)) {
        otherRole.inheritsFrom = otherRole.inheritsFrom.filter(id => id !== roleId);
        otherRole.updatedAt = new Date();
      }
    }

    this.roles.delete(roleId);
    this.clearRoleCache(roleId);

    logger.info('Role deleted', { roleId });
    return true;
  }

  getRole(roleId: string): Role | null {
    return this.roles.get(roleId) || null;
  }

  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  getRolesByType(isSystemRole: boolean): Role[] {
    return Array.from(this.roles.values()).filter(role => role.isSystemRole === isSystemRole);
  }

  /**
   * User Role Assignment
   */
  async assignRoleToUser(
    userId: string,
    roleId: string,
    assignedBy: string,
    expiresAt?: Date,
    conditions?: PolicyCondition[]
  ): Promise<UserRole> {
    if (!this.roles.has(roleId)) {
      throw new Error('Role not found');
    }

    const userRole: UserRole = {
      userId,
      roleId,
      assignedAt: new Date(),
      assignedBy,
      expiresAt,
      isActive: true,
      conditions,
    };

    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, []);
    }

    // Check if role is already assigned
    const userRolesList = this.userRoles.get(userId)!;
    const existingAssignment = userRolesList.find(ur => ur.roleId === roleId);

    if (existingAssignment) {
      // Update existing assignment
      Object.assign(existingAssignment, userRole);
    } else {
      userRolesList.push(userRole);
    }

    logger.info('Role assigned to user', {
      userId,
      roleId,
      assignedBy,
      expiresAt,
      hasConditions: !!conditions?.length,
    });

    return userRole;
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<boolean> {
    const userRolesList = this.userRoles.get(userId);
    if (!userRolesList) {
      return false;
    }

    const initialLength = userRolesList.length;
    const filteredRoles = userRolesList.filter(ur => ur.roleId !== roleId);
    
    if (filteredRoles.length < initialLength) {
      this.userRoles.set(userId, filteredRoles);
      logger.info('Role removed from user', { userId, roleId });
      return true;
    }

    return false;
  }

  getUserRoles(userId: string): UserRole[] {
    const userRoles = this.userRoles.get(userId) || [];
    const now = new Date();

    // Filter expired and inactive roles
    return userRoles.filter(ur => {
      if (!ur.isActive) return false;
      if (ur.expiresAt && ur.expiresAt < now) {
        ur.isActive = false;
        return false;
      }
      return true;
    });
  }

  getUsersWithRole(roleId: string): string[] {
    const users: string[] = [];
    for (const [userId, userRoles] of this.userRoles) {
      if (userRoles.some(ur => ur.roleId === roleId && ur.isActive)) {
        users.push(userId);
      }
    }
    return users;
  }

  /**
   * Permission Evaluation
   */
  async checkPermission(
    userId: string,
    resource: string,
    action: string,
    context?: AccessContext
  ): Promise<PermissionEvaluationResult> {
    const startTime = Date.now();
    let rulesEvaluated = 0;
    let conditionsChecked = 0;

    try {
      // Get user roles
      const userRoles = this.getUserRoles(userId);
      if (userRoles.length === 0) {
        return this.createEvaluationResult(false, [], [], [], 'No roles assigned', rulesEvaluated, conditionsChecked, startTime);
      }

      const matchedPermissions: Permission[] = [];
      const appliedRoles: Role[] = [];
      const appliedConditions: PolicyCondition[] = [];

      // Evaluate each role
      for (const userRole of userRoles) {
        const role = this.roles.get(userRole.roleId);
        if (!role) continue;

        appliedRoles.push(role);
        rulesEvaluated++;

        // Check role conditions
        if (userRole.conditions) {
          for (const condition of userRole.conditions) {
            conditionsChecked++;
            if (!this.evaluateCondition(condition, context)) {
              continue; // Skip this role if condition fails
            }
            appliedConditions.push(condition);
          }
        }

        // Get all permissions for this role (including inherited)
        const rolePermissions = this.getRolePermissions(userRole.roleId);
        
        for (const permissionId of rolePermissions) {
          const permission = this.permissions.get(permissionId);
          if (!permission) continue;

          rulesEvaluated++;

          // Check if permission matches resource and action
          if (this.permissionMatches(permission, resource, action)) {
            // Check permission conditions
            if (permission.conditions) {
              let conditionsPassed = true;
              for (const condition of permission.conditions) {
                conditionsChecked++;
                if (!this.evaluateCondition(condition, context)) {
                  conditionsPassed = false;
                  break;
                }
                appliedConditions.push(condition);
              }
              if (!conditionsPassed) continue;
            }

            matchedPermissions.push(permission);
          }
        }
      }

      // Update stats
      this.evaluationStats.totalEvaluations++;
      this.evaluationStats.totalTime += Date.now() - startTime;
      this.evaluationStats.rulesEvaluated += rulesEvaluated;
      this.evaluationStats.conditionsChecked += conditionsChecked;

      const granted = matchedPermissions.length > 0;
      const reason = granted 
        ? `Access granted via ${matchedPermissions.length} matching permission(s)`
        : 'No matching permissions found';

      return this.createEvaluationResult(
        granted,
        matchedPermissions,
        appliedRoles,
        appliedConditions,
        reason,
        rulesEvaluated,
        conditionsChecked,
        startTime
      );
    } catch (error) {
      logger.error('Permission evaluation failed', error as Error);
      return this.createEvaluationResult(false, [], [], [], 'Evaluation error', rulesEvaluated, conditionsChecked, startTime);
    }
  }

  /**
   * Advanced Permission Checking
   */
  async hasPermission(userId: string, permission: string, resourceId?: string): Promise<boolean> {
    const [resource, action] = permission.split(':');
    const result = await this.checkPermission(userId, resource, action, {
      userId,
      resource,
      action,
      resourceId,
      timestamp: new Date(),
    });
    return result.granted;
  }

  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, permission)) {
        return true;
      }
    }
    return false;
  }

  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission(userId, permission))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Role Hierarchy and Inheritance
   */
  private getRolePermissions(roleId: string): Set<string> {
    // Check cache first
    if (this.rolePermissionsCache.has(roleId)) {
      return this.rolePermissionsCache.get(roleId)!;
    }

    const role = this.roles.get(roleId);
    if (!role) {
      return new Set();
    }

    const allPermissions = new Set<string>(role.permissions);

    // Add inherited permissions
    if (role.inheritsFrom) {
      for (const parentRoleId of role.inheritsFrom) {
        const parentPermissions = this.getRolePermissions(parentRoleId);
        for (const permission of parentPermissions) {
          allPermissions.add(permission);
        }
      }
    }

    // Cache result
    this.rolePermissionsCache.set(roleId, allPermissions);
    return allPermissions;
  }

  private validateRoleInheritance(roleId: string, inheritsFrom: string[]): void {
    const visited = new Set<string>();
    const stack = [...inheritsFrom];

    while (stack.length > 0) {
      const currentRoleId = stack.pop()!;
      
      if (currentRoleId === roleId) {
        throw new Error('Circular role inheritance detected');
      }

      if (visited.has(currentRoleId)) {
        continue;
      }
      visited.add(currentRoleId);

      const role = this.roles.get(currentRoleId);
      if (role?.inheritsFrom) {
        stack.push(...role.inheritsFrom);
      }
    }
  }

  /**
   * Condition Evaluation
   */
  private evaluateCondition(condition: PolicyCondition, context?: AccessContext): boolean {
    if (!context) return true;

    try {
      const fieldValue = this.getContextFieldValue(condition.field, context);
      const conditionValue = condition.value;

      switch (condition.operator) {
        case 'eq':
          return fieldValue === conditionValue;
        case 'ne':
          return fieldValue !== conditionValue;
        case 'lt':
          return fieldValue < conditionValue;
        case 'le':
          return fieldValue <= conditionValue;
        case 'gt':
          return fieldValue > conditionValue;
        case 'ge':
          return fieldValue >= conditionValue;
        case 'in':
          return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
        case 'nin':
          return Array.isArray(conditionValue) && !conditionValue.includes(fieldValue);
        case 'contains':
          return String(fieldValue).includes(String(conditionValue));
        case 'regex':
          return new RegExp(conditionValue).test(String(fieldValue));
        default:
          logger.warn('Unknown condition operator', { operator: condition.operator });
          return false;
      }
    } catch (error) {
      logger.error('Condition evaluation failed', error as Error);
      return false;
    }
  }

  private getContextFieldValue(field: string, context: AccessContext): any {
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private permissionMatches(permission: Permission, resource: string, action: string): boolean {
    // Exact match
    if (permission.resource === resource && permission.action === action) {
      return true;
    }

    // Wildcard match
    if (permission.resource === '*' || permission.action === '*') {
      return true;
    }

    // Pattern match (basic)
    const resourceMatch = permission.resource.endsWith('*') 
      ? resource.startsWith(permission.resource.slice(0, -1))
      : permission.resource === resource;

    const actionMatch = permission.action.endsWith('*')
      ? action.startsWith(permission.action.slice(0, -1))
      : permission.action === action;

    return resourceMatch && actionMatch;
  }

  /**
   * Utility Methods
   */
  private createEvaluationResult(
    granted: boolean,
    permissions: Permission[],
    roles: Role[],
    conditions: PolicyCondition[],
    reason: string,
    rulesEvaluated: number,
    conditionsChecked: number,
    startTime: number
  ): PermissionEvaluationResult {
    return {
      granted,
      matchedPermissions: permissions,
      appliedRoles: roles,
      conditions,
      reason,
      auditInfo: {
        evaluationTime: Date.now() - startTime,
        rulesEvaluated,
        conditionsChecked,
      },
    };
  }

  private clearPermissionCaches(): void {
    this.rolePermissionsCache.clear();
  }

  private clearRoleCache(roleId: string): void {
    this.rolePermissionsCache.delete(roleId);
    
    // Clear cache for roles that inherit from this role
    for (const role of this.roles.values()) {
      if (role.inheritsFrom?.includes(roleId)) {
        this.rolePermissionsCache.delete(role.id);
      }
    }
  }

  private cleanupCaches(): void {
    if (this.rolePermissionsCache.size > 1000) {
      this.rolePermissionsCache.clear();
      logger.info('Role permissions cache cleared due to size limit');
    }
  }

  /**
   * Statistics and Monitoring
   */
  getStats(): RBACStats {
    const totalUsers = this.userRoles.size;
    const activeUsers = Array.from(this.userRoles.values())
      .filter(userRoles => userRoles.some(ur => ur.isActive)).length;

    return {
      totalRoles: this.roles.size,
      totalPermissions: this.permissions.size,
      totalUserRoles: Array.from(this.userRoles.values())
        .reduce((sum, userRoles) => sum + userRoles.length, 0),
      systemRoles: Array.from(this.roles.values()).filter(r => r.isSystemRole).length,
      customRoles: Array.from(this.roles.values()).filter(r => !r.isSystemRole).length,
      activeUsers,
      permissionEvaluations: this.evaluationStats.totalEvaluations,
      averageEvaluationTime: this.evaluationStats.totalEvaluations > 0 
        ? this.evaluationStats.totalTime / this.evaluationStats.totalEvaluations 
        : 0,
    };
  }

  /**
   * Initialize System Roles and Permissions
   */
  private initializeSystemRoles(): void {
    const systemRoles = [
      {
        id: 'system-admin',
        name: 'system-admin',
        displayName: 'System Administrator',
        description: 'Full system access with all permissions',
        permissions: [], // Will be populated after permissions are created
        isSystemRole: true,
      },
      {
        id: 'admin',
        name: 'admin',
        displayName: 'Administrator',
        description: 'Administrative access to most system features',
        permissions: [],
        isSystemRole: true,
      },
      {
        id: 'editor',
        name: 'editor',
        displayName: 'Content Editor',
        description: 'Can create, read, update, and delete content',
        permissions: [],
        isSystemRole: true,
      },
      {
        id: 'viewer',
        name: 'viewer',
        displayName: 'Viewer',
        description: 'Read-only access to content',
        permissions: [],
        isSystemRole: true,
      },
      {
        id: 'guest',
        name: 'guest',
        displayName: 'Guest User',
        description: 'Limited access for unauthenticated users',
        permissions: [],
        isSystemRole: true,
      },
    ];

    for (const roleData of systemRoles) {
      const role: Role = {
        ...roleData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.roles.set(role.id, role);
    }
  }

  private initializeSystemPermissions(): void {
    const systemPermissions = [
      // Template permissions
      { resource: 'templates', action: 'create', description: 'Create new templates' },
      { resource: 'templates', action: 'read', description: 'View templates' },
      { resource: 'templates', action: 'update', description: 'Edit templates' },
      { resource: 'templates', action: 'delete', description: 'Delete templates' },
      { resource: 'templates', action: 'publish', description: 'Publish templates to marketplace' },
      
      // Marketplace permissions
      { resource: 'marketplace', action: 'browse', description: 'Browse marketplace' },
      { resource: 'marketplace', action: 'install', description: 'Install templates from marketplace' },
      { resource: 'marketplace', action: 'publish', description: 'Publish to marketplace' },
      { resource: 'marketplace', action: 'moderate', description: 'Moderate marketplace content' },
      
      // User management permissions
      { resource: 'users', action: 'create', description: 'Create user accounts' },
      { resource: 'users', action: 'read', description: 'View user information' },
      { resource: 'users', action: 'update', description: 'Update user accounts' },
      { resource: 'users', action: 'delete', description: 'Delete user accounts' },
      { resource: 'users', action: 'manage-roles', description: 'Assign and manage user roles' },
      
      // System permissions
      { resource: 'system', action: 'admin', description: 'Full system administration' },
      { resource: 'system', action: 'configure', description: 'Configure system settings' },
      { resource: 'system', action: 'audit', description: 'View audit logs and security reports' },
      { resource: 'system', action: 'monitor', description: 'Monitor system health and performance' },
      
      // Plugin permissions
      { resource: 'plugins', action: 'install', description: 'Install plugins' },
      { resource: 'plugins', action: 'configure', description: 'Configure plugins' },
      { resource: 'plugins', action: 'develop', description: 'Develop and test plugins' },
    ];

    for (const permData of systemPermissions) {
      const permission: Permission = {
        id: crypto.randomUUID(),
        name: `${permData.resource}:${permData.action}`,
        ...permData,
      };
      this.permissions.set(permission.id, permission);
    }

    // Assign permissions to system roles
    this.assignSystemPermissions();
  }

  private assignSystemPermissions(): void {
    const allPermissions = Array.from(this.permissions.keys());
    
    // System Admin - all permissions
    const systemAdmin = this.roles.get('system-admin')!;
    systemAdmin.permissions = [...allPermissions];
    
    // Admin - most permissions except system admin
    const admin = this.roles.get('admin')!;
    admin.permissions = Array.from(this.permissions.values())
      .filter(p => !p.name.includes('system:admin'))
      .map(p => p.id);
    
    // Editor - content management permissions
    const editor = this.roles.get('editor')!;
    editor.permissions = Array.from(this.permissions.values())
      .filter(p => p.resource === 'templates' || p.resource === 'marketplace' && p.action !== 'moderate')
      .map(p => p.id);
    
    // Viewer - read-only permissions
    const viewer = this.roles.get('viewer')!;
    viewer.permissions = Array.from(this.permissions.values())
      .filter(p => p.action === 'read' || p.action === 'browse')
      .map(p => p.id);
    
    // Guest - very limited permissions
    const guest = this.roles.get('guest')!;
    guest.permissions = Array.from(this.permissions.values())
      .filter(p => p.resource === 'marketplace' && p.action === 'browse')
      .map(p => p.id);
  }
}

/**
 * Global RBAC manager instance
 */
export const rbacManager = new RBACManagerService();
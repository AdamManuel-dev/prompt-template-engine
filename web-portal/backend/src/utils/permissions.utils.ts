/**
 * @fileoverview Role-based access control permissions and utilities
 * @lastmodified 2025-01-08T21:00:00Z
 * 
 * Features: Permission definitions, role hierarchies, resource access control
 * Main APIs: hasPermission(), checkResourceAccess(), getRolePermissions()
 * Constraints: Hierarchical role system, resource-based permissions
 * Patterns: Enum-based permissions, bitwise operations for efficiency
 */

import { UserRole } from '../generated/prisma';

// Define all possible permissions in the system
export enum Permission {
  // User management
  USER_READ = 'user:read',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_MANAGE_ROLES = 'user:manage_roles',

  // Template management
  TEMPLATE_READ = 'template:read',
  TEMPLATE_CREATE = 'template:create',
  TEMPLATE_UPDATE = 'template:update',
  TEMPLATE_DELETE = 'template:delete',
  TEMPLATE_PUBLISH = 'template:publish',
  TEMPLATE_EXECUTE = 'template:execute',
  TEMPLATE_MODERATE = 'template:moderate',

  // Figma integration
  FIGMA_READ = 'figma:read',
  FIGMA_CONNECT = 'figma:connect',
  FIGMA_IMPORT = 'figma:import',
  FIGMA_EXPORT = 'figma:export',

  // System administration
  SYSTEM_ADMIN = 'system:admin',
  SYSTEM_SETTINGS = 'system:settings',
  SYSTEM_LOGS = 'system:logs',
  SYSTEM_METRICS = 'system:metrics',

  // Audit and security
  AUDIT_READ = 'audit:read',
  AUDIT_EXPORT = 'audit:export',
  SECURITY_ADMIN = 'security:admin',

  // API and integration
  API_ADMIN = 'api:admin',
  WEBHOOK_ADMIN = 'webhook:admin',
  INTEGRATION_ADMIN = 'integration:admin',
}

// Role hierarchy levels (higher number = more permissions)
const ROLE_HIERARCHY: Record<UserRole, number> = {
  VIEWER: 1,
  USER: 2,
  CONTRIBUTOR: 3,
  DESIGNER: 4,
  DEVELOPER: 5,
  ADMIN: 6,
  SUPER_ADMIN: 7,
};

// Define permissions for each role
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  VIEWER: [
    Permission.TEMPLATE_READ,
    Permission.FIGMA_READ,
  ],

  USER: [
    Permission.TEMPLATE_READ,
    Permission.TEMPLATE_EXECUTE,
    Permission.FIGMA_READ,
    Permission.USER_READ, // Can read own profile
  ],

  CONTRIBUTOR: [
    Permission.TEMPLATE_READ,
    Permission.TEMPLATE_CREATE,
    Permission.TEMPLATE_UPDATE, // Own templates only
    Permission.TEMPLATE_EXECUTE,
    Permission.FIGMA_READ,
    Permission.FIGMA_CONNECT,
    Permission.USER_READ,
    Permission.USER_UPDATE, // Own profile only
  ],

  DESIGNER: [
    Permission.TEMPLATE_READ,
    Permission.TEMPLATE_CREATE,
    Permission.TEMPLATE_UPDATE,
    Permission.TEMPLATE_EXECUTE,
    Permission.FIGMA_READ,
    Permission.FIGMA_CONNECT,
    Permission.FIGMA_IMPORT,
    Permission.FIGMA_EXPORT,
    Permission.USER_READ,
    Permission.USER_UPDATE,
  ],

  DEVELOPER: [
    Permission.TEMPLATE_READ,
    Permission.TEMPLATE_CREATE,
    Permission.TEMPLATE_UPDATE,
    Permission.TEMPLATE_DELETE, // Own templates
    Permission.TEMPLATE_EXECUTE,
    Permission.TEMPLATE_PUBLISH,
    Permission.FIGMA_READ,
    Permission.FIGMA_CONNECT,
    Permission.FIGMA_IMPORT,
    Permission.FIGMA_EXPORT,
    Permission.USER_READ,
    Permission.USER_UPDATE,
    Permission.API_ADMIN,
  ],

  ADMIN: [
    Permission.USER_READ,
    Permission.USER_CREATE,
    Permission.USER_UPDATE,
    Permission.USER_DELETE,
    Permission.USER_MANAGE_ROLES, // Limited role management
    Permission.TEMPLATE_READ,
    Permission.TEMPLATE_CREATE,
    Permission.TEMPLATE_UPDATE,
    Permission.TEMPLATE_DELETE,
    Permission.TEMPLATE_EXECUTE,
    Permission.TEMPLATE_PUBLISH,
    Permission.TEMPLATE_MODERATE,
    Permission.FIGMA_READ,
    Permission.FIGMA_CONNECT,
    Permission.FIGMA_IMPORT,
    Permission.FIGMA_EXPORT,
    Permission.SYSTEM_SETTINGS,
    Permission.SYSTEM_LOGS,
    Permission.SYSTEM_METRICS,
    Permission.AUDIT_READ,
    Permission.API_ADMIN,
    Permission.WEBHOOK_ADMIN,
    Permission.INTEGRATION_ADMIN,
  ],

  SUPER_ADMIN: [
    // Super admin has all permissions
    ...Object.values(Permission),
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[role] || [];
  return rolePermissions.includes(permission);
}

/**
 * Check if user role meets minimum role requirement
 */
export function hasMinimumRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if user can access a resource
 */
export function canAccessResource(
  userRole: UserRole,
  userId: string,
  resource: {
    ownerId?: string;
    isPublic?: boolean;
    requiredPermission: Permission;
  }
): boolean {
  const { ownerId, isPublic = false, requiredPermission } = resource;

  // Check if user has the required permission
  if (!hasPermission(userRole, requiredPermission)) {
    return false;
  }

  // Public resources are accessible if user has permission
  if (isPublic) {
    return true;
  }

  // User can access their own resources
  if (ownerId && userId === ownerId) {
    return true;
  }

  // Admin and super admin can access any resource
  if (hasMinimumRole(userRole, UserRole.ADMIN)) {
    return true;
  }

  return false;
}

/**
 * Check if user can manage another user
 */
export function canManageUser(
  managerRole: UserRole,
  targetRole: UserRole
): boolean {
  // Super admin can manage anyone
  if (managerRole === UserRole.SUPER_ADMIN) {
    return true;
  }

  // Admin can manage users below admin level
  if (managerRole === UserRole.ADMIN) {
    return ROLE_HIERARCHY[targetRole] < ROLE_HIERARCHY[UserRole.ADMIN];
  }

  return false;
}

/**
 * Check if user can assign a role to another user
 */
export function canAssignRole(
  assignerRole: UserRole,
  targetRole: UserRole
): boolean {
  // Super admin can assign any role
  if (assignerRole === UserRole.SUPER_ADMIN) {
    return true;
  }

  // Admin can assign roles below admin level
  if (assignerRole === UserRole.ADMIN) {
    return ROLE_HIERARCHY[targetRole] < ROLE_HIERARCHY[UserRole.ADMIN];
  }

  return false;
}

/**
 * Get roles that can be assigned by the given role
 */
export function getAssignableRoles(assignerRole: UserRole): UserRole[] {
  if (assignerRole === UserRole.SUPER_ADMIN) {
    return Object.values(UserRole);
  }

  if (assignerRole === UserRole.ADMIN) {
    return Object.values(UserRole).filter(
      role => ROLE_HIERARCHY[role] < ROLE_HIERARCHY[UserRole.ADMIN]
    );
  }

  return [];
}

/**
 * Template-specific permission checks
 */
export class TemplatePermissions {
  /**
   * Check if user can read a template
   */
  static canRead(userRole: UserRole, userId: string, template: {
    ownerId?: string;
    isPublic?: boolean;
  }): boolean {
    return canAccessResource(userRole, userId, {
      ownerId: template.ownerId,
      isPublic: template.isPublic,
      requiredPermission: Permission.TEMPLATE_READ,
    });
  }

  /**
   * Check if user can create templates
   */
  static canCreate(userRole: UserRole): boolean {
    return hasPermission(userRole, Permission.TEMPLATE_CREATE);
  }

  /**
   * Check if user can update a template
   */
  static canUpdate(userRole: UserRole, userId: string, template: {
    ownerId?: string;
  }): boolean {
    return canAccessResource(userRole, userId, {
      ownerId: template.ownerId,
      requiredPermission: Permission.TEMPLATE_UPDATE,
    });
  }

  /**
   * Check if user can delete a template
   */
  static canDelete(userRole: UserRole, userId: string, template: {
    ownerId?: string;
  }): boolean {
    return canAccessResource(userRole, userId, {
      ownerId: template.ownerId,
      requiredPermission: Permission.TEMPLATE_DELETE,
    });
  }

  /**
   * Check if user can publish a template
   */
  static canPublish(userRole: UserRole, userId: string, template: {
    ownerId?: string;
  }): boolean {
    return canAccessResource(userRole, userId, {
      ownerId: template.ownerId,
      requiredPermission: Permission.TEMPLATE_PUBLISH,
    });
  }

  /**
   * Check if user can execute a template
   */
  static canExecute(userRole: UserRole, userId: string, template: {
    ownerId?: string;
    isPublic?: boolean;
  }): boolean {
    return canAccessResource(userRole, userId, {
      ownerId: template.ownerId,
      isPublic: template.isPublic,
      requiredPermission: Permission.TEMPLATE_EXECUTE,
    });
  }
}

/**
 * User management permission checks
 */
export class UserPermissions {
  /**
   * Check if user can read user profiles
   */
  static canRead(userRole: UserRole, userId: string, targetUserId: string): boolean {
    // Users can read their own profile
    if (userId === targetUserId) {
      return true;
    }

    // Check if user has general user read permission
    return hasPermission(userRole, Permission.USER_READ);
  }

  /**
   * Check if user can update user profiles
   */
  static canUpdate(userRole: UserRole, userId: string, targetUserId: string): boolean {
    // Users can update their own profile
    if (userId === targetUserId) {
      return hasPermission(userRole, Permission.USER_UPDATE);
    }

    // Check if user can manage others
    return hasPermission(userRole, Permission.USER_UPDATE) && 
           hasMinimumRole(userRole, UserRole.ADMIN);
  }

  /**
   * Check if user can delete user accounts
   */
  static canDelete(userRole: UserRole, targetRole: UserRole): boolean {
    return hasPermission(userRole, Permission.USER_DELETE) &&
           canManageUser(userRole, targetRole);
  }

  /**
   * Check if user can create new users
   */
  static canCreate(userRole: UserRole): boolean {
    return hasPermission(userRole, Permission.USER_CREATE);
  }
}

/**
 * System administration permission checks
 */
export class SystemPermissions {
  /**
   * Check if user can access system settings
   */
  static canAccessSettings(userRole: UserRole): boolean {
    return hasPermission(userRole, Permission.SYSTEM_SETTINGS);
  }

  /**
   * Check if user can view audit logs
   */
  static canViewLogs(userRole: UserRole): boolean {
    return hasPermission(userRole, Permission.AUDIT_READ);
  }

  /**
   * Check if user can access system metrics
   */
  static canViewMetrics(userRole: UserRole): boolean {
    return hasPermission(userRole, Permission.SYSTEM_METRICS);
  }

  /**
   * Check if user has full system admin access
   */
  static isSystemAdmin(userRole: UserRole): boolean {
    return hasPermission(userRole, Permission.SYSTEM_ADMIN);
  }
}
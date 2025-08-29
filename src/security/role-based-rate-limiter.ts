/**
 * @fileoverview Role-based rate limiting with dynamic adjustment and security controls
 * @lastmodified 2025-08-27T17:00:00Z
 *
 * Features: Role-based limits, dynamic adjustment, burst handling, security monitoring
 * Main APIs: RoleBasedRateLimiter, checkRateLimit(), adjustLimits(), monitorAbuse()
 * Constraints: Integrates with RBAC system, enforces per-user and per-role limits
 * Patterns: Rate limiting, role-based policies, abuse detection, adaptive limits
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import {
  RateLimiter,
  RateLimitConfig,
  RateLimitResult,
} from '../middleware/rate-limiter';

export interface RoleBasedRateLimitConfig {
  // Role-based limits (role -> config)
  roleLimits: Record<string, RateLimitConfig>;

  // Global fallback limits
  defaultLimits: RateLimitConfig;

  // Emergency limits for security incidents
  emergencyLimits: RateLimitConfig;

  // Per-user limits (overrides role limits)
  userLimits?: Record<string, RateLimitConfig>;

  // Dynamic adjustment settings
  enableDynamicAdjustment: boolean;
  adjustmentFactor: number; // Multiplier for dynamic changes
  adjustmentWindow: number; // Time window for adjustment decisions

  // Abuse detection
  enableAbuseDetection: boolean;
  abuseThreshold: number; // Number of limit violations before abuse detection
  abuseTimeWindow: number; // Time window for abuse detection
  abusePenaltyMultiplier: number; // Penalty factor for abusers

  // Emergency controls
  enableEmergencyMode: boolean;
  emergencyThreshold: number; // System-wide rate before emergency mode
  emergencyDuration: number; // How long emergency mode lasts

  // Monitoring
  enableRealTimeMonitoring: boolean;
  monitoringInterval: number;
  alertThresholds: {
    warningPercent: number; // % of limit before warning
    criticalPercent: number; // % of limit before critical alert
  };
}

export interface RateLimitContext {
  userId: string;
  userRoles: string[];
  resource: string;
  action: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  clientInfo: {
    ipAddress: string;
    userAgent: string;
  };
  metadata?: Record<string, any>;
}

export interface RoleBasedRateLimitResult extends RateLimitResult {
  appliedConfig: RateLimitConfig;
  appliedRole?: string;
  dynamicAdjustment?: {
    originalLimit: number;
    adjustedLimit: number;
    reason: string;
  };
  securityFlags: {
    suspiciousActivity: boolean;
    abuseDetected: boolean;
    emergencyMode: boolean;
  };
}

export interface AbuseRecord {
  userId: string;
  violations: number;
  firstViolation: Date;
  lastViolation: Date;
  penaltyLevel: number;
  ipAddresses: Set<string>;
  resources: Set<string>;
}

/**
 * Role-Based Rate Limiter with Security Features
 */
export class RoleBasedRateLimiter extends EventEmitter {
  private config: RoleBasedRateLimitConfig;

  private rateLimiters = new Map<string, RateLimiter>(); // key -> RateLimiter

  private abuseRecords = new Map<string, AbuseRecord>();

  private emergencyModeActive = false;

  private emergencyModeEnd?: Date;

  private monitoringTimer?: ReturnType<typeof setInterval>;

  // Statistics
  private stats = {
    totalRequests: 0,
    blockedRequests: 0,
    emergencyBlocks: 0,
    abuseDetections: 0,
    dynamicAdjustments: 0,
  };

  constructor(config: Partial<RoleBasedRateLimitConfig> = {}) {
    super();

    this.config = {
      roleLimits: {
        'system-admin': {
          windowMs: 60 * 1000,
          maxRequests: 10000, // Very high limit for system admin
          algorithm: 'token-bucket',
        },
        admin: {
          windowMs: 60 * 1000,
          maxRequests: 5000,
          algorithm: 'token-bucket',
        },
        editor: {
          windowMs: 60 * 1000,
          maxRequests: 1000,
          algorithm: 'sliding-window',
        },
        viewer: {
          windowMs: 60 * 1000,
          maxRequests: 500,
          algorithm: 'sliding-window',
        },
        guest: {
          windowMs: 60 * 1000,
          maxRequests: 100,
          algorithm: 'fixed-window',
        },
      },
      defaultLimits: {
        windowMs: 60 * 1000,
        maxRequests: 100,
        algorithm: 'sliding-window',
      },
      emergencyLimits: {
        windowMs: 60 * 1000,
        maxRequests: 10, // Very restrictive during emergency
        algorithm: 'leaky-bucket',
      },
      enableDynamicAdjustment: true,
      adjustmentFactor: 0.5,
      adjustmentWindow: 300000, // 5 minutes
      enableAbuseDetection: true,
      abuseThreshold: 10,
      abuseTimeWindow: 600000, // 10 minutes
      abusePenaltyMultiplier: 0.1,
      enableEmergencyMode: true,
      emergencyThreshold: 10000, // requests per minute system-wide
      emergencyDuration: 300000, // 5 minutes
      enableRealTimeMonitoring: true,
      monitoringInterval: 30000, // 30 seconds
      alertThresholds: {
        warningPercent: 80,
        criticalPercent: 95,
      },
      ...config,
    };

    if (this.config.enableRealTimeMonitoring) {
      this.startMonitoring();
    }

    // Cleanup abuse records periodically
    setInterval(() => this.cleanupAbuseRecords(), 3600000); // Every hour
  }

  /**
   * Check rate limit with role-based and dynamic adjustments
   */
  async checkRateLimit(
    context: RateLimitContext
  ): Promise<RoleBasedRateLimitResult> {
    try {
      this.stats.totalRequests++;

      // Check emergency mode first
      if (this.emergencyModeActive) {
        if (this.emergencyModeEnd && new Date() > this.emergencyModeEnd) {
          this.emergencyModeActive = false;
          this.emergencyModeEnd = undefined;
          this.emit('emergencyModeDeactivated');
          logger.info('Emergency mode deactivated');
        } else {
          return this.handleEmergencyMode(context);
        }
      }

      // Check for abuse
      if (this.config.enableAbuseDetection) {
        const abuseCheck = this.checkAbuse(
          context.userId,
          context.clientInfo.ipAddress,
          context.resource
        );
        if (abuseCheck.isAbusive) {
          this.stats.blockedRequests++;
          return this.createAbuseResult(context, abuseCheck.penaltyLevel);
        }
      }

      // Determine effective rate limit configuration
      const effectiveConfig = await this.getEffectiveConfig(context);

      // Get or create rate limiter for this configuration
      const rateLimiterKey = this.getRateLimiterKey(context, effectiveConfig);
      let rateLimiter = this.rateLimiters.get(rateLimiterKey);

      if (!rateLimiter) {
        rateLimiter = new RateLimiter(effectiveConfig);
        this.rateLimiters.set(rateLimiterKey, rateLimiter);
      }

      // Check rate limit
      const identifier = this.createIdentifier(context);
      const result = await rateLimiter.checkLimit(identifier);

      // Handle rate limit violation
      if (!result.allowed) {
        this.stats.blockedRequests++;
        this.handleRateLimitViolation(context, result);
      }

      // Create role-based result
      const roleBasedResult: RoleBasedRateLimitResult = {
        ...result,
        appliedConfig: effectiveConfig,
        appliedRole: this.getAppliedRole(context.userRoles),
        securityFlags: {
          suspiciousActivity: false,
          abuseDetected: false,
          emergencyMode: this.emergencyModeActive,
        },
      };

      // Apply dynamic adjustments if enabled
      if (this.config.enableDynamicAdjustment && !result.allowed) {
        const adjustment = await this.considerDynamicAdjustment(
          context,
          result
        );
        if (adjustment) {
          roleBasedResult.dynamicAdjustment = adjustment;
          this.stats.dynamicAdjustments++;
        }
      }

      this.emit('rateLimitCheck', {
        userId: context.userId,
        resource: context.resource,
        allowed: result.allowed,
        remaining: result.remaining,
      });

      return roleBasedResult;
    } catch (error: unknown) {
      logger.error('Rate limit check failed', error as Error);

      // Fail securely - deny the request
      this.stats.blockedRequests++;
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + this.config.defaultLimits.windowMs,
        error: 'Rate limit check failed',
        appliedConfig: this.config.defaultLimits,
        securityFlags: {
          suspiciousActivity: false,
          abuseDetected: false,
          emergencyMode: false,
        },
      };
    }
  }

  /**
   * Manually adjust rate limits for a user or role
   */
  async adjustUserLimit(
    userId: string,
    adjustment: Partial<RateLimitConfig>,
    duration?: number
  ): Promise<void> {
    if (!this.config.userLimits) {
      this.config.userLimits = {};
    }

    // Get current user limits or default
    const currentLimits =
      this.config.userLimits[userId] || this.config.defaultLimits;
    this.config.userLimits[userId] = { ...currentLimits, ...adjustment };

    logger.info('User rate limit adjusted', {
      userId,
      adjustment,
      duration,
    });

    // Remove adjustment after duration
    if (duration) {
      setTimeout(() => {
        if (this.config.userLimits && this.config.userLimits[userId]) {
          delete this.config.userLimits[userId];
          logger.info('User rate limit adjustment expired', { userId });
        }
      }, duration);
    }

    this.emit('limitAdjusted', { userId, adjustment });
  }

  /**
   * Enable emergency mode system-wide
   */
  async enableEmergencyMode(duration?: number): Promise<void> {
    this.emergencyModeActive = true;
    this.emergencyModeEnd = duration
      ? new Date(Date.now() + duration)
      : undefined;

    logger.warn('Emergency mode activated', {
      duration: duration ? `${duration}ms` : 'indefinite',
      emergencyLimits: this.config.emergencyLimits,
    });

    this.emit('emergencyModeActivated', { duration });

    if (duration) {
      setTimeout(() => {
        this.emergencyModeActive = false;
        this.emergencyModeEnd = undefined;
        this.emit('emergencyModeDeactivated');
        logger.info('Emergency mode deactivated automatically');
      }, duration);
    }
  }

  /**
   * Disable emergency mode
   */
  async disableEmergencyMode(): Promise<void> {
    this.emergencyModeActive = false;
    this.emergencyModeEnd = undefined;

    logger.info('Emergency mode manually deactivated');
    this.emit('emergencyModeDeactivated');
  }

  /**
   * Get rate limiting statistics
   */
  getStats(): typeof this.stats & {
    activeRateLimiters: number;
    activeAbuseRecords: number;
    emergencyModeActive: boolean;
    configuredRoles: string[];
  } {
    return {
      ...this.stats,
      activeRateLimiters: this.rateLimiters.size,
      activeAbuseRecords: this.abuseRecords.size,
      emergencyModeActive: this.emergencyModeActive,
      configuredRoles: Object.keys(this.config.roleLimits),
    };
  }

  /**
   * Get abuse records for monitoring
   */
  getAbuseRecords(): AbuseRecord[] {
    return Array.from(this.abuseRecords.values()).map(record => ({
      ...record,
      ipAddresses: Array.from(record.ipAddresses),
      resources: Array.from(record.resources),
    })) as any;
  }

  /**
   * Private helper methods
   */
  private async getEffectiveConfig(
    context: RateLimitContext
  ): Promise<RateLimitConfig> {
    // Check user-specific limits first
    const userLimit = this.config.userLimits?.[context.userId];
    if (userLimit) {
      return userLimit;
    }

    // Find highest priority role and use its limits
    const appliedRole = this.getAppliedRole(context.userRoles);
    if (appliedRole && this.config.roleLimits[appliedRole]) {
      return this.config.roleLimits[appliedRole];
    }

    // Fall back to default limits
    return this.config.defaultLimits;
  }

  private getAppliedRole(userRoles: string[]): string | undefined {
    // Priority order for roles (highest to lowest)
    const rolePriority = ['system-admin', 'admin', 'editor', 'viewer', 'guest'];

    for (const role of rolePriority) {
      if (userRoles.includes(role)) {
        return role;
      }
    }

    return undefined;
  }

  private getRateLimiterKey(
    context: RateLimitContext,
    config: RateLimitConfig
  ): string {
    return `${config.algorithm}_${config.windowMs}_${config.maxRequests}_${context.resource}`;
  }

  private createIdentifier(context: RateLimitContext): string {
    // Create hierarchical identifier: user -> IP -> resource
    return `user:${context.userId}:ip:${context.clientInfo.ipAddress}:resource:${context.resource}`;
  }

  private checkAbuse(
    userId: string,
    _ipAddress: string,
    _resource: string
  ): {
    isAbusive: boolean;
    penaltyLevel: number;
  } {
    const abuseRecord = this.abuseRecords.get(userId);
    if (!abuseRecord) {
      return { isAbusive: false, penaltyLevel: 0 };
    }

    const now = new Date();
    const timeWindow = now.getTime() - this.config.abuseTimeWindow;

    // Check if violations are within the time window
    if (abuseRecord.lastViolation.getTime() < timeWindow) {
      // Reset abuse record if outside time window
      this.abuseRecords.delete(userId);
      return { isAbusive: false, penaltyLevel: 0 };
    }

    // Check abuse threshold
    const isAbusive = abuseRecord.violations >= this.config.abuseThreshold;
    return {
      isAbusive,
      penaltyLevel: abuseRecord.penaltyLevel,
    };
  }

  private handleRateLimitViolation(
    context: RateLimitContext,
    _result: RateLimitResult
  ): void {
    // Record abuse
    let abuseRecord = this.abuseRecords.get(context.userId);
    if (!abuseRecord) {
      abuseRecord = {
        userId: context.userId,
        violations: 0,
        firstViolation: new Date(),
        lastViolation: new Date(),
        penaltyLevel: 1,
        ipAddresses: new Set(),
        resources: new Set(),
      };
      this.abuseRecords.set(context.userId, abuseRecord);
    }

    abuseRecord.violations++;
    abuseRecord.lastViolation = new Date();
    abuseRecord.ipAddresses.add(context.clientInfo.ipAddress);
    abuseRecord.resources.add(context.resource);

    // Increase penalty level
    if (abuseRecord.violations % this.config.abuseThreshold === 0) {
      abuseRecord.penaltyLevel++;
      this.stats.abuseDetections++;

      this.emit('abuseDetected', {
        userId: context.userId,
        violations: abuseRecord.violations,
        penaltyLevel: abuseRecord.penaltyLevel,
      });

      logger.warn('Abuse detected', {
        userId: context.userId,
        violations: abuseRecord.violations,
        penaltyLevel: abuseRecord.penaltyLevel,
        ipAddress: context.clientInfo.ipAddress,
        resource: context.resource,
      });
    }

    // Check for emergency mode activation
    if (
      this.config.enableEmergencyMode &&
      this.stats.totalRequests > this.config.emergencyThreshold
    ) {
      this.enableEmergencyMode(this.config.emergencyDuration);
    }
  }

  private async considerDynamicAdjustment(
    context: RateLimitContext,
    _result: RateLimitResult
  ): Promise<RoleBasedRateLimitResult['dynamicAdjustment']> {
    // Simple dynamic adjustment logic
    if (context.priority === 'critical' || context.priority === 'high') {
      const originalLimit =
        this.config.roleLimits[
          this.getAppliedRole(context.userRoles) || 'guest'
        ]?.maxRequests || 100;
      const adjustedLimit = Math.floor(
        originalLimit * (1 + this.config.adjustmentFactor)
      );

      return {
        originalLimit,
        adjustedLimit,
        reason: `Priority ${context.priority} request adjustment`,
      };
    }

    return undefined;
  }

  private handleEmergencyMode(
    _context: RateLimitContext
  ): RoleBasedRateLimitResult {
    this.stats.emergencyBlocks++;

    return {
      allowed: false,
      remaining: 0,
      resetTime:
        this.emergencyModeEnd?.getTime() ||
        Date.now() + this.config.emergencyDuration,
      retryAfter: this.emergencyModeEnd
        ? Math.max(0, this.emergencyModeEnd.getTime() - Date.now())
        : this.config.emergencyDuration,
      error: 'System in emergency mode - rate limiting enforced',
      appliedConfig: this.config.emergencyLimits,
      securityFlags: {
        suspiciousActivity: false,
        abuseDetected: false,
        emergencyMode: true,
      },
    };
  }

  private createAbuseResult(
    _context: RateLimitContext,
    penaltyLevel: number
  ): RoleBasedRateLimitResult {
    const penalizedLimit = Math.max(
      1,
      Math.floor(
        this.config.defaultLimits.maxRequests *
          this.config.abusePenaltyMultiplier ** penaltyLevel
      )
    );

    return {
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + this.config.abuseTimeWindow,
      retryAfter: this.config.abuseTimeWindow,
      error: `Rate limit violation - penalty level ${penaltyLevel}`,
      appliedConfig: {
        ...this.config.defaultLimits,
        maxRequests: penalizedLimit,
      },
      securityFlags: {
        suspiciousActivity: true,
        abuseDetected: true,
        emergencyMode: false,
      },
    };
  }

  private cleanupAbuseRecords(): void {
    const now = Date.now();
    const cutoff = now - this.config.abuseTimeWindow * 2; // Keep records for 2x the abuse window

    for (const [userId, record] of this.abuseRecords) {
      if (record.lastViolation.getTime() < cutoff) {
        this.abuseRecords.delete(userId);
      }
    }
  }

  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.performMonitoringChecks();
    }, this.config.monitoringInterval);
  }

  private performMonitoringChecks(): void {
    const stats = this.getStats();

    // Calculate rate percentages
    const totalRate =
      this.stats.totalRequests / (this.config.monitoringInterval / 1000); // per second
    const blockRate =
      (this.stats.blockedRequests / this.stats.totalRequests) * 100;

    // Emit monitoring events
    this.emit('monitoring', {
      stats,
      rates: {
        total: totalRate,
        blocked: blockRate,
      },
    });

    // Check alert thresholds
    if (blockRate > this.config.alertThresholds.criticalPercent) {
      this.emit('criticalAlert', { blockRate, stats });
    } else if (blockRate > this.config.alertThresholds.warningPercent) {
      this.emit('warningAlert', { blockRate, stats });
    }

    // Reset interval stats
    this.stats.totalRequests = 0;
    this.stats.blockedRequests = 0;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    for (const rateLimiter of this.rateLimiters.values()) {
      rateLimiter.dispose();
    }

    this.rateLimiters.clear();
    this.abuseRecords.clear();
  }
}

/**
 * Global role-based rate limiter instance
 */
export const roleBasedRateLimiter = new RoleBasedRateLimiter();

/**
 * Middleware function for role-based rate limiting
 */
export function createRoleBasedRateLimitMiddleware(
  resource: string,
  action: string = 'access',
  priority: RateLimitContext['priority'] = 'medium'
) {
  return async (request: {
    user?: { id: string; roles: string[] };
    headers?: Record<string, string>;
    ip?: string;
    metadata?: Record<string, any>;
  }) => {
    if (!request.user) {
      throw new Error('User information required for rate limiting');
    }

    const context: RateLimitContext = {
      userId: request.user.id,
      userRoles: request.user.roles,
      resource,
      action,
      priority,
      clientInfo: {
        ipAddress: request.ip || 'unknown',
        userAgent: request.headers?.['user-agent'] || 'unknown',
      },
      metadata: request.metadata,
    };

    const result = await roleBasedRateLimiter.checkRateLimit(context);

    if (!result.allowed) {
      const error = new Error(result.error || 'Rate limit exceeded');
      (error as any).rateLimitInfo = result;
      throw error;
    }

    return request;
  };
}

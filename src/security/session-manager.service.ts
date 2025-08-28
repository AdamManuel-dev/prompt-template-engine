/**
 * @fileoverview Advanced session management with security controls and multi-device tracking
 * @lastmodified 2025-08-27T16:30:00Z
 *
 * Features: Session lifecycle, multi-device tracking, security controls, idle detection
 * Main APIs: createSession(), validateSession(), terminateSession(), trackActivity()
 * Constraints: Enforces session limits, idle timeouts, concurrent session policies
 * Patterns: Session management, security monitoring, device fingerprinting, audit logging
 */

import * as crypto from 'crypto';
import { logger } from '../utils/logger';

export interface SessionData {
  sessionId: string;
  userId: string;
  deviceId: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  location?: {
    country: string;
    region: string;
    city: string;
    coordinates?: [number, number];
  };
  createdAt: Date;
  lastAccessAt: Date;
  expiresAt: Date;
  isActive: boolean;
  metadata: Record<string, any>;
  securityFlags: {
    suspiciousActivity: boolean;
    ipChanged: boolean;
    deviceChanged: boolean;
    concurrentSessionWarning: boolean;
  };
}

export interface SessionActivity {
  sessionId: string;
  timestamp: Date;
  activity:
    | 'login'
    | 'access'
    | 'api_call'
    | 'permission_check'
    | 'logout'
    | 'timeout';
  details: {
    resource?: string;
    action?: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    metadata?: Record<string, any>;
  };
}

export interface DeviceInfo {
  deviceId: string;
  fingerprint: string;
  name?: string;
  type: 'desktop' | 'mobile' | 'tablet' | 'other';
  browser: string;
  os: string;
  firstSeen: Date;
  lastSeen: Date;
  trusted: boolean;
  riskScore: number; // 0-100, higher = more risky
}

export interface SessionConfig {
  maxSessionsPerUser: number;
  sessionTimeout: number; // in milliseconds
  idleTimeout: number; // in milliseconds
  maxSessionDuration: number; // in milliseconds
  enableDeviceTracking: boolean;
  enableLocationTracking: boolean;
  requireDeviceApproval: boolean;
  enableConcurrentSessionLimits: boolean;
  enableAnomalyDetection: boolean;
  securityCheckInterval: number; // in milliseconds
}

export interface SessionValidationResult {
  valid: boolean;
  session?: SessionData;
  error?: string;
  securityIssues?: string[];
  requiresAction?: 'reauthentication' | 'device_approval' | 'security_check';
}

/**
 * Advanced Session Manager Service
 */
export class SessionManagerService {
  private sessions = new Map<string, SessionData>();

  private userSessions = new Map<string, Set<string>>(); // userId -> sessionIds

  private deviceRegistry = new Map<string, DeviceInfo>();

  private sessionActivities: SessionActivity[] = [];

  private config: SessionConfig;

  private securityCheckTimer!: ReturnType<typeof setInterval>;

  private cleanupTimer!: ReturnType<typeof setInterval>;

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = {
      maxSessionsPerUser: 5,
      sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
      idleTimeout: 30 * 60 * 1000, // 30 minutes
      maxSessionDuration: 7 * 24 * 60 * 60 * 1000, // 7 days
      enableDeviceTracking: true,
      enableLocationTracking: true,
      requireDeviceApproval: false,
      enableConcurrentSessionLimits: true,
      enableAnomalyDetection: true,
      securityCheckInterval: 60 * 1000, // 1 minute
      ...config,
    };

    this.startBackgroundTasks();
  }

  /**
   * Create new session with comprehensive security checks
   */
  async createSession(
    userId: string,
    clientInfo: {
      ipAddress: string;
      userAgent: string;
      deviceFingerprint?: string;
      location?: {
        country: string;
        region: string;
        city: string;
        coordinates?: [number, number];
      };
    }
  ): Promise<SessionData> {
    try {
      // Generate secure session ID
      const sessionId = this.generateSecureSessionId();

      // Generate or validate device fingerprint
      const deviceFingerprint =
        clientInfo.deviceFingerprint ||
        this.generateDeviceFingerprint(clientInfo);
      const deviceId = crypto
        .createHash('sha256')
        .update(deviceFingerprint)
        .digest('hex');

      // Check concurrent session limits
      if (this.config.enableConcurrentSessionLimits) {
        await this.enforceConcurrentSessionLimits(userId);
      }

      // Register or update device
      let deviceInfo = this.deviceRegistry.get(deviceId);
      if (!deviceInfo) {
        deviceInfo = await this.registerNewDevice(
          deviceId,
          deviceFingerprint,
          clientInfo
        );
      } else {
        deviceInfo.lastSeen = new Date();
        this.updateDeviceRiskScore(deviceInfo, clientInfo);
      }

      const now = new Date();
      const sessionData: SessionData = {
        sessionId,
        userId,
        deviceId,
        deviceFingerprint,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        location: clientInfo.location,
        createdAt: now,
        lastAccessAt: now,
        expiresAt: new Date(now.getTime() + this.config.sessionTimeout),
        isActive: true,
        metadata: {},
        securityFlags: {
          suspiciousActivity: false,
          ipChanged: false,
          deviceChanged: false,
          concurrentSessionWarning: false,
        },
      };

      // Perform security checks
      await this.performSecurityChecks(sessionData, deviceInfo);

      // Store session
      this.sessions.set(sessionId, sessionData);

      // Track user sessions
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId)!.add(sessionId);

      // Log activity
      await this.logActivity(sessionId, 'login', {
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
        success: true,
        metadata: { deviceId, newDevice: !this.deviceRegistry.has(deviceId) },
      });

      logger.info('Session created successfully', {
        sessionId,
        userId,
        deviceId,
        ipAddress: clientInfo.ipAddress,
        location: clientInfo.location?.country,
      });

      return sessionData;
    } catch (error: any) {
      logger.error('Session creation failed', error as Error);
      throw new Error('Session creation failed');
    }
  }

  /**
   * Validate session with comprehensive security checks
   */
  async validateSession(
    sessionId: string,
    clientInfo?: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<SessionValidationResult> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return { valid: false, error: 'Session not found' };
      }

      if (!session.isActive) {
        return { valid: false, error: 'Session is inactive' };
      }

      const now = new Date();

      // Check expiration
      if (session.expiresAt < now) {
        await this.terminateSession(sessionId, 'expired');
        return { valid: false, error: 'Session expired' };
      }

      // Check idle timeout
      const idleTime = now.getTime() - session.lastAccessAt.getTime();
      if (idleTime > this.config.idleTimeout) {
        await this.terminateSession(sessionId, 'idle_timeout');
        return { valid: false, error: 'Session idle timeout' };
      }

      // Check maximum session duration
      const sessionDuration = now.getTime() - session.createdAt.getTime();
      if (sessionDuration > this.config.maxSessionDuration) {
        await this.terminateSession(sessionId, 'max_duration_exceeded');
        return { valid: false, error: 'Maximum session duration exceeded' };
      }

      const securityIssues: string[] = [];

      // Security checks if client info provided
      if (clientInfo) {
        // Check IP address change
        if (session.ipAddress !== clientInfo.ipAddress) {
          session.securityFlags.ipChanged = true;
          securityIssues.push('IP address changed');
          logger.warn('IP address change detected', {
            sessionId,
            oldIp: session.ipAddress,
            newIp: clientInfo.ipAddress,
          });
        }

        // Check user agent change
        if (session.userAgent !== clientInfo.userAgent) {
          session.securityFlags.deviceChanged = true;
          securityIssues.push('Device signature changed');
        }

        // Update session info
        session.ipAddress = clientInfo.ipAddress;
        session.userAgent = clientInfo.userAgent;
      }

      // Check for suspicious activity
      if (this.config.enableAnomalyDetection) {
        const anomalies = await this.detectAnomalies(session);
        if (anomalies.length > 0) {
          session.securityFlags.suspiciousActivity = true;
          securityIssues.push(...anomalies);
        }
      }

      // Update last access time
      session.lastAccessAt = now;

      // Extend session if less than 10% time remaining
      const timeRemaining = session.expiresAt.getTime() - now.getTime();
      const timePercentage = timeRemaining / this.config.sessionTimeout;
      if (timePercentage < 0.1) {
        session.expiresAt = new Date(
          now.getTime() + this.config.sessionTimeout
        );
      }

      // Log activity
      if (clientInfo) {
        await this.logActivity(sessionId, 'access', {
          ipAddress: clientInfo.ipAddress,
          userAgent: clientInfo.userAgent,
          success: true,
          metadata: { securityIssues: securityIssues.length },
        });
      }

      // Determine if action is required
      let requiresAction: SessionValidationResult['requiresAction'];
      if (securityIssues.length > 0) {
        if (session.securityFlags.suspiciousActivity) {
          requiresAction = 'security_check';
        } else if (
          session.securityFlags.deviceChanged ||
          session.securityFlags.ipChanged
        ) {
          requiresAction = 'reauthentication';
        }
      }

      return {
        valid: true,
        session,
        securityIssues: securityIssues.length > 0 ? securityIssues : undefined,
        requiresAction,
      };
    } catch (error: any) {
      logger.error('Session validation failed', error as Error);
      return { valid: false, error: 'Session validation failed' };
    }
  }

  /**
   * Terminate session with audit logging
   */
  async terminateSession(
    sessionId: string,
    reason:
      | 'logout'
      | 'expired'
      | 'idle_timeout'
      | 'security'
      | 'admin'
      | 'max_duration_exceeded' = 'logout'
  ): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return false;
      }

      // Mark as inactive
      session.isActive = false;

      // Remove from user sessions
      const userSessions = this.userSessions.get(session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          this.userSessions.delete(session.userId);
        }
      }

      // Log activity
      await this.logActivity(sessionId, 'logout', {
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        success: true,
        metadata: { reason },
      });

      // Remove from active sessions
      this.sessions.delete(sessionId);

      logger.info('Session terminated', {
        sessionId,
        userId: session.userId,
        reason,
        duration: Date.now() - session.createdAt.getTime(),
      });

      return true;
    } catch (error: any) {
      logger.error('Session termination failed', error as Error);
      return false;
    }
  }

  /**
   * Terminate all sessions for a user
   */
  async terminateAllUserSessions(
    userId: string,
    reason: 'security' | 'admin' | 'user_request' = 'security',
    excludeSessionId?: string
  ): Promise<number> {
    const userSessions = this.userSessions.get(userId);
    if (!userSessions) {
      return 0;
    }

    let terminatedCount = 0;
    const sessionIds = Array.from(userSessions);

    for (const sessionId of sessionIds) {
      if (sessionId !== excludeSessionId) {
        const success = await this.terminateSession(
          sessionId,
          reason as
            | 'admin'
            | 'security'
            | 'expired'
            | 'logout'
            | 'idle_timeout'
            | 'max_duration_exceeded'
        );
        if (success) {
          terminatedCount++;
        }
      }
    }

    logger.info('All user sessions terminated', {
      userId,
      count: terminatedCount,
      reason,
    });

    return terminatedCount;
  }

  /**
   * Get user's active sessions
   */
  getUserSessions(userId: string): SessionData[] {
    const userSessionIds = this.userSessions.get(userId);
    if (!userSessionIds) {
      return [];
    }

    return Array.from(userSessionIds)
      .map(sessionId => this.sessions.get(sessionId))
      .filter(
        (session): session is SessionData =>
          session !== undefined && session.isActive
      );
  }

  /**
   * Get session activity history
   */
  getSessionActivity(sessionId: string, limit: number = 50): SessionActivity[] {
    return this.sessionActivities
      .filter(activity => activity.sessionId === sessionId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get user's device information
   */
  getUserDevices(userId: string): DeviceInfo[] {
    const userSessions = this.getUserSessions(userId);
    const deviceIds = new Set(userSessions.map(session => session.deviceId));

    return Array.from(deviceIds)
      .map(deviceId => this.deviceRegistry.get(deviceId))
      .filter((device): device is DeviceInfo => device !== undefined);
  }

  /**
   * Trust/untrust a device
   */
  async setDeviceTrust(deviceId: string, trusted: boolean): Promise<boolean> {
    const device = this.deviceRegistry.get(deviceId);
    if (!device) {
      return false;
    }

    device.trusted = trusted;
    if (trusted) {
      device.riskScore = Math.max(0, device.riskScore - 20);
    }

    logger.info('Device trust updated', { deviceId, trusted });
    return true;
  }

  /**
   * Private helper methods
   */
  private generateSecureSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateDeviceFingerprint(clientInfo: {
    userAgent: string;
    ipAddress: string;
  }): string {
    const data = `${clientInfo.userAgent}|${clientInfo.ipAddress}|${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async registerNewDevice(
    deviceId: string,
    fingerprint: string,
    clientInfo: any
  ): Promise<DeviceInfo> {
    const deviceInfo: DeviceInfo = {
      deviceId,
      fingerprint,
      type: this.detectDeviceType(clientInfo.userAgent),
      browser: this.extractBrowser(clientInfo.userAgent),
      os: this.extractOS(clientInfo.userAgent),
      firstSeen: new Date(),
      lastSeen: new Date(),
      trusted: !this.config.requireDeviceApproval,
      riskScore: this.calculateInitialRiskScore(clientInfo),
    };

    this.deviceRegistry.set(deviceId, deviceInfo);

    logger.info('New device registered', {
      deviceId,
      type: deviceInfo.type,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      riskScore: deviceInfo.riskScore,
    });

    return deviceInfo;
  }

  private updateDeviceRiskScore(device: DeviceInfo, _clientInfo: any): void {
    // Decrease risk score for consistent usage
    const daysSinceFirstSeen =
      (Date.now() - device.firstSeen.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceFirstSeen > 7) {
      device.riskScore = Math.max(0, device.riskScore - 1);
    }
  }

  private async enforceConcurrentSessionLimits(userId: string): Promise<void> {
    const userSessions = this.userSessions.get(userId);
    if (!userSessions || userSessions.size < this.config.maxSessionsPerUser) {
      return;
    }

    // Find oldest session to terminate
    const sessions = Array.from(userSessions)
      .map(sessionId => this.sessions.get(sessionId))
      .filter((session): session is SessionData => session !== undefined)
      .sort((a, b) => a.lastAccessAt.getTime() - b.lastAccessAt.getTime());

    if (sessions.length > 0 && sessions[0]) {
      await this.terminateSession(sessions[0].sessionId, 'security');
      logger.info('Session terminated due to concurrent session limit', {
        userId,
        terminatedSessionId: sessions[0].sessionId,
        limit: this.config.maxSessionsPerUser,
      });
    }
  }

  private async performSecurityChecks(
    session: SessionData,
    device: DeviceInfo
  ): Promise<void> {
    // Check device risk score
    if (device.riskScore > 70) {
      session.securityFlags.suspiciousActivity = true;
    }

    // Check for new device
    if (!device.trusted && this.config.requireDeviceApproval) {
      logger.warn('Untrusted device attempting login', {
        sessionId: session.sessionId,
        deviceId: session.deviceId,
        userId: session.userId,
      });
    }

    // Check concurrent sessions
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions && userSessions.size > 1) {
      session.securityFlags.concurrentSessionWarning = true;
    }
  }

  private async detectAnomalies(session: SessionData): Promise<string[]> {
    const anomalies: string[] = [];

    // Check for rapid location changes (if location tracking enabled)
    if (this.config.enableLocationTracking && session.location) {
      // Add more sophisticated anomaly detection here
    }

    // Check for unusual access patterns
    const recentAccess = this.sessionActivities.filter(
      a =>
        a.sessionId === session.sessionId &&
        a.timestamp.getTime() > Date.now() - 60 * 60 * 1000 // Last hour
    );

    if (recentAccess.length > 100) {
      anomalies.push('Unusually high activity rate');
    }

    return anomalies;
  }

  private async logActivity(
    sessionId: string,
    activity: SessionActivity['activity'],
    details: SessionActivity['details']
  ): Promise<void> {
    const activityLog: SessionActivity = {
      sessionId,
      timestamp: new Date(),
      activity,
      details,
    };

    this.sessionActivities.push(activityLog);

    // Limit activity log size
    if (this.sessionActivities.length > 10000) {
      this.sessionActivities = this.sessionActivities.slice(-5000);
    }
  }

  private detectDeviceType(userAgent: string): DeviceInfo['type'] {
    if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
      return /iPad/.test(userAgent) ? 'tablet' : 'mobile';
    }
    return 'desktop';
  }

  private extractBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  private extractOS(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac OS')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }

  private calculateInitialRiskScore(clientInfo: any): number {
    let riskScore = 0;

    // New device gets some risk
    riskScore += 20;

    // Add risk based on location (if available)
    if (clientInfo.location) {
      // Add location-based risk assessment here
    }

    return Math.min(100, riskScore);
  }

  private startBackgroundTasks(): void {
    // Security checks
    this.securityCheckTimer = setInterval(() => {
      this.performBackgroundSecurityChecks();
    }, this.config.securityCheckInterval);

    // Cleanup expired sessions
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 1000); // Every minute
  }

  private performBackgroundSecurityChecks(): void {
    // Check all active sessions for security issues
    for (const session of this.sessions.values()) {
      if (!session.isActive) continue;

      // Check for expired sessions
      if (session.expiresAt < new Date()) {
        this.terminateSession(session.sessionId, 'expired');
        continue;
      }

      // Check idle timeout
      const idleTime = Date.now() - session.lastAccessAt.getTime();
      if (idleTime > this.config.idleTimeout) {
        this.terminateSession(session.sessionId, 'idle_timeout');
        continue;
      }

      // Additional security checks can be added here
    }
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      if (!session.isActive || session.expiresAt < now) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.terminateSession(sessionId, 'expired');
    }

    if (expiredSessions.length > 0) {
      logger.info('Cleaned up expired sessions', {
        count: expiredSessions.length,
      });
    }
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activeSessions: number;
    totalUsers: number;
    totalDevices: number;
    trustedDevices: number;
    suspiciousSessions: number;
    averageSessionDuration: number;
  } {
    const activeSessions = this.sessions.size;
    const totalUsers = this.userSessions.size;
    const totalDevices = this.deviceRegistry.size;
    const trustedDevices = Array.from(this.deviceRegistry.values()).filter(
      device => device.trusted
    ).length;

    const suspiciousSessions = Array.from(this.sessions.values()).filter(
      session => session.securityFlags.suspiciousActivity
    ).length;

    const sessionDurations = Array.from(this.sessions.values()).map(
      session => Date.now() - session.createdAt.getTime()
    );
    const averageSessionDuration =
      sessionDurations.length > 0
        ? sessionDurations.reduce((sum, duration) => sum + duration, 0) /
          sessionDurations.length
        : 0;

    return {
      activeSessions,
      totalUsers,
      totalDevices,
      trustedDevices,
      suspiciousSessions,
      averageSessionDuration,
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.securityCheckTimer) {
      clearInterval(this.securityCheckTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }
}

/**
 * Global session manager instance
 */
export const sessionManager = new SessionManagerService();

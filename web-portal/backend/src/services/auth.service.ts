/**
 * @fileoverview Authentication service with comprehensive user management
 * @lastmodified 2025-01-08T21:00:00Z
 * 
 * Features: Registration, login, password reset, email verification, account lockout
 * Main APIs: register(), login(), refreshTokens(), resetPassword(), verifyEmail()
 * Constraints: Account lockout after 5 failed attempts, password strength validation
 * Patterns: Rate limiting, audit logging, secure token generation
 */

import { prisma } from '../db/prisma-client';
import { hashPassword, verifyPassword, generateEmailVerificationToken, generatePasswordResetToken, validatePasswordStrength, generateDeviceFingerprint } from '../utils/crypto.utils';
import { generateTokens, TokenPair, refreshTokens as jwtRefreshTokens, revokeAllUserTokens } from '../utils/jwt.utils';
import { UserRole } from '../generated/prisma';

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResponse extends TokenPair {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string | null;
    role: UserRole;
    emailVerified: boolean;
    avatar: string | null;
    preferences: any;
  };
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
}

export interface EmailVerificationRequest {
  email: string;
}

export interface ChangePasswordRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

// Configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const PASSWORD_RESET_EXPIRY = 60 * 60 * 1000; // 1 hour

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  /**
   * Register new user account
   */
  async register(data: RegisterRequest): Promise<{ user: any; requiresEmailVerification: boolean }> {
    const { email, username, password, firstName, lastName, displayName } = data;

    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new AuthError('Invalid email format', 'INVALID_EMAIL');
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new AuthError(
        `Password does not meet requirements: ${passwordValidation.suggestions.join(', ')}`,
        'WEAK_PASSWORD'
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        throw new AuthError('Email already registered', 'EMAIL_EXISTS', 409);
      } else {
        throw new AuthError('Username already taken', 'USERNAME_EXISTS', 409);
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Generate email verification token
    const emailVerificationToken = generateEmailVerificationToken();

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        passwordHash,
        firstName,
        lastName,
        displayName: displayName || `${firstName || ''} ${lastName || ''}`.trim() || username,
        role: UserRole.USER,
        emailVerificationToken,
        emailVerified: false, // Require email verification
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Log registration
    await this.logAuditEvent(user.id, 'user_registered', { email: user.email });

    return {
      user,
      requiresEmailVerification: true,
    };
  }

  /**
   * Login user with email and password
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const { email, password, ipAddress, userAgent } = data;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        displayName: true,
        role: true,
        emailVerified: true,
        isActive: true,
        failedLoginAttempts: true,
        accountLockedUntil: true,
        avatarUrl: true,
        preferences: true,
      },
    });

    if (!user) {
      // Log failed login attempt
      await this.logAuditEvent(null, 'login_failed', { 
        email: email.toLowerCase(), 
        reason: 'user_not_found',
        ipAddress 
      });
      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const lockoutRemaining = Math.ceil((user.accountLockedUntil.getTime() - Date.now()) / 60000);
      throw new AuthError(
        `Account locked. Try again in ${lockoutRemaining} minutes.`,
        'ACCOUNT_LOCKED',
        423
      );
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AuthError('Account is deactivated', 'ACCOUNT_DEACTIVATED', 403);
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash || '');
    
    if (!isPasswordValid) {
      // Increment failed login attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      
      const updateData: any = {
        failedLoginAttempts: failedAttempts,
      };

      // Lock account if max attempts reached
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        updateData.accountLockedUntil = new Date(Date.now() + LOCKOUT_DURATION);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      // Log failed login attempt
      await this.logAuditEvent(user.id, 'login_failed', { 
        email: user.email, 
        reason: 'invalid_password',
        failedAttempts,
        ipAddress 
      });

      throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS', 401);
    }

    // Reset failed login attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        accountLockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Generate tokens
    const tokens = await generateTokens({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    // Update session with IP and user agent
    if (ipAddress || userAgent) {
      const deviceFingerprint = userAgent && ipAddress 
        ? generateDeviceFingerprint(userAgent, ipAddress) 
        : undefined;

      await prisma.session.updateMany({
        where: { userId: user.id, refreshToken: tokens.refreshToken },
        data: {
          ipAddress,
          userAgent,
          deviceFingerprint,
        },
      });
    }

    // Log successful login
    await this.logAuditEvent(user.id, 'user_login', { 
      email: user.email,
      ipAddress,
      userAgent: userAgent?.substring(0, 255) // Limit length
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        emailVerified: user.emailVerified,
        avatar: user.avatarUrl,
        preferences: user.preferences,
      },
    };
  }

  /**
   * Refresh authentication tokens
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      return await jwtRefreshTokens(refreshToken);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
    }
  }

  /**
   * Logout user by revoking tokens
   */
  async logout(userId: string, jti?: string): Promise<void> {
    if (jti) {
      // Revoke specific session
      await prisma.session.updateMany({
        where: { userId, jti, isActive: true },
        data: {
          isActive: false,
          revokedAt: new Date(),
          revokedReason: 'logout',
        },
      });
    } else {
      // Revoke all sessions
      await revokeAllUserTokens(userId, 'logout');
    }

    // Log logout
    await this.logAuditEvent(userId, 'user_logout', { jti });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    const { email } = data;
    
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, isActive: true },
    });

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      return;
    }

    // Generate reset token
    const { token, expiresAt } = generatePasswordResetToken();

    // Store reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
      },
    });

    // Log password reset request
    await this.logAuditEvent(user.id, 'password_reset_requested', { email: user.email });

    // TODO: Send password reset email
    console.log(`Password reset token for ${email}: ${token}`);
  }

  /**
   * Confirm password reset with new password
   */
  async confirmPasswordReset(data: PasswordResetConfirm): Promise<void> {
    const { token, password } = data;

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new AuthError(
        `Password does not meet requirements: ${passwordValidation.suggestions.join(', ')}`,
        'WEAK_PASSWORD'
      );
    }

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
        isActive: true,
      },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new AuthError('Invalid or expired reset token', 'INVALID_RESET_TOKEN', 400);
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      },
    });

    // Revoke all existing sessions
    await revokeAllUserTokens(user.id, 'password_reset');

    // Log password reset
    await this.logAuditEvent(user.id, 'password_reset_confirmed', { email: user.email });
  }

  /**
   * Change user password (authenticated)
   */
  async changePassword(data: ChangePasswordRequest): Promise<void> {
    const { userId, currentPassword, newPassword } = data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
    }

    // Verify current password
    if (user.passwordHash && !await verifyPassword(currentPassword, user.passwordHash)) {
      throw new AuthError('Current password is incorrect', 'INVALID_CURRENT_PASSWORD', 400);
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new AuthError(
        `Password does not meet requirements: ${passwordValidation.suggestions.join(', ')}`,
        'WEAK_PASSWORD'
      );
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Log password change
    await this.logAuditEvent(userId, 'password_changed', { email: user.email });
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(data: EmailVerificationRequest): Promise<void> {
    const { email } = data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, emailVerified: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return; // Don't reveal if email exists
    }

    if (user.emailVerified) {
      throw new AuthError('Email already verified', 'EMAIL_ALREADY_VERIFIED', 400);
    }

    // Generate new verification token
    const emailVerificationToken = generateEmailVerificationToken();

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationToken },
    });

    // TODO: Send verification email
    console.log(`Email verification token for ${email}: ${emailVerificationToken}`);

    // Log verification email sent
    await this.logAuditEvent(user.id, 'email_verification_sent', { email: user.email });
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { emailVerificationToken: token },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      throw new AuthError('Invalid verification token', 'INVALID_VERIFICATION_TOKEN', 400);
    }

    if (user.emailVerified) {
      throw new AuthError('Email already verified', 'EMAIL_ALREADY_VERIFIED', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
      },
    });

    // Log email verification
    await this.logAuditEvent(user.id, 'email_verified', { email: user.email });
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        emailVerified: true,
        preferences: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    preferences?: any;
  }) {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        emailVerified: true,
        preferences: true,
      },
    });

    // Log profile update
    await this.logAuditEvent(userId, 'profile_updated', { fields: Object.keys(data) });

    return user;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Log audit event
   */
  private async logAuditEvent(
    userId: string | null,
    action: string,
    details?: any
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          details,
          success: true,
        },
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
}
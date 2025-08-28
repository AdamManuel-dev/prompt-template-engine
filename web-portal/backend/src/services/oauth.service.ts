/**
 * @fileoverview OAuth service for SSO integration (Google, GitHub, Microsoft)
 * @lastmodified 2025-01-08T21:40:00Z
 * 
 * Features: OAuth provider management, token handling, account linking
 * Main APIs: initializeProvider(), handleCallback(), linkAccount()
 * Constraints: Encrypted token storage, provider-specific configurations
 * Patterns: Strategy pattern for providers, secure token handling
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { prisma } from '../db/prisma-client';
import { encryptData, decryptData, generateSecureToken } from '../utils/crypto.utils';
import { generateTokens } from '../utils/jwt.utils';
import { AuthService, AuthError } from './auth.service';
import { UserRole } from '../generated/prisma';

export interface OAuthProvider {
  id: string;
  name: string;
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  callbackUrl: string;
}

export interface OAuthProfile {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  username?: string;
  provider: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpires?: Date;
}

export interface OAuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  isNew: boolean;
}

const authService = new AuthService();

export class OAuthService {
  private providers: Map<string, OAuthProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize OAuth providers from environment configuration
   */
  private initializeProviders(): void {
    // Google OAuth configuration
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.providers.set('google', {
        id: 'google',
        name: 'Google',
        enabled: true,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        scopes: ['profile', 'email'],
        callbackUrl: process.env.GOOGLE_CALLBACK_URL || '/api/auth/oauth/google/callback',
      });
    }

    // GitHub OAuth configuration
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      this.providers.set('github', {
        id: 'github',
        name: 'GitHub',
        enabled: true,
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        scopes: ['user:email'],
        callbackUrl: process.env.GITHUB_CALLBACK_URL || '/api/auth/oauth/github/callback',
      });
    }

    // Microsoft OAuth configuration
    if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
      this.providers.set('microsoft', {
        id: 'microsoft',
        name: 'Microsoft',
        enabled: true,
        clientId: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        scopes: ['profile', 'email'],
        callbackUrl: process.env.MICROSOFT_CALLBACK_URL || '/api/auth/oauth/microsoft/callback',
      });
    }

    console.log(`Initialized ${this.providers.size} OAuth providers:`, Array.from(this.providers.keys()));
  }

  /**
   * Setup Passport strategies for enabled providers
   */
  setupPassportStrategies(): void {
    // Google Strategy
    const googleProvider = this.providers.get('google');
    if (googleProvider?.enabled) {
      passport.use(new GoogleStrategy({
        clientID: googleProvider.clientId,
        clientSecret: googleProvider.clientSecret,
        callbackURL: googleProvider.callbackUrl,
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          const oauthProfile: OAuthProfile = {
            id: profile.id,
            email: profile.emails?.[0]?.value || '',
            name: profile.displayName || '',
            firstName: profile.name?.givenName,
            lastName: profile.name?.familyName,
            avatar: profile.photos?.[0]?.value,
            provider: 'google',
            accessToken,
            refreshToken,
          };

          const user = await this.handleOAuthProfile(oauthProfile);
          done(null, user);
        } catch (error) {
          done(error, undefined);
        }
      }));
    }

    // GitHub Strategy
    const githubProvider = this.providers.get('github');
    if (githubProvider?.enabled) {
      passport.use(new GitHubStrategy({
        clientID: githubProvider.clientId,
        clientSecret: githubProvider.clientSecret,
        callbackURL: githubProvider.callbackUrl,
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          const oauthProfile: OAuthProfile = {
            id: profile.id,
            email: profile.emails?.[0]?.value || '',
            name: profile.displayName || profile.username || '',
            username: profile.username,
            avatar: profile.photos?.[0]?.value,
            provider: 'github',
            accessToken,
            refreshToken,
          };

          const user = await this.handleOAuthProfile(oauthProfile);
          done(null, user);
        } catch (error) {
          done(error, undefined);
        }
      }));
    }

    // Passport serialization
    passport.serializeUser((user: any, done) => {
      done(null, { id: user.id, provider: user.provider });
    });

    passport.deserializeUser(async (data: any, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: data.id },
          include: { oauthProviders: true },
        });
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  }

  /**
   * Handle OAuth profile and create/link user account
   */
  private async handleOAuthProfile(profile: OAuthProfile): Promise<OAuthUser> {
    if (!profile.email) {
      throw new AuthError('Email is required from OAuth provider', 'OAUTH_EMAIL_REQUIRED');
    }

    // Check if user already exists by email
    let user = await prisma.user.findUnique({
      where: { email: profile.email.toLowerCase() },
      include: { oauthProviders: true },
    });

    let isNew = false;

    if (!user) {
      // Create new user
      const username = await this.generateUniqueUsername(profile);
      user = await prisma.user.create({
        data: {
          email: profile.email.toLowerCase(),
          username,
          displayName: profile.name,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatar,
          emailVerified: true, // OAuth emails are pre-verified
          role: UserRole.USER,
        },
        include: { oauthProviders: true },
      });
      isNew = true;
    }

    // Check if OAuth provider is already linked
    const existingProvider = user.oauthProviders.find(p => p.provider === profile.provider);

    if (!existingProvider) {
      // Link OAuth provider to existing user
      await this.linkOAuthProvider(user.id, profile);
    } else {
      // Update existing OAuth provider tokens
      await this.updateOAuthProvider(existingProvider.id, profile);
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role,
      isNew,
    };
  }

  /**
   * Link OAuth provider to existing user
   */
  private async linkOAuthProvider(userId: string, profile: OAuthProfile): Promise<void> {
    const encryptedAccessToken = profile.accessToken ? encryptData(profile.accessToken) : null;
    const encryptedRefreshToken = profile.refreshToken ? encryptData(profile.refreshToken) : null;

    await prisma.oAuthProvider.create({
      data: {
        userId,
        provider: profile.provider,
        providerId: profile.id,
        providerEmail: profile.email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: profile.tokenExpires,
      },
    });

    // Log account linking
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'oauth_account_linked',
        details: { provider: profile.provider, providerId: profile.id },
        success: true,
      },
    });
  }

  /**
   * Update existing OAuth provider tokens
   */
  private async updateOAuthProvider(providerId: string, profile: OAuthProfile): Promise<void> {
    const encryptedAccessToken = profile.accessToken ? encryptData(profile.accessToken) : null;
    const encryptedRefreshToken = profile.refreshToken ? encryptData(profile.refreshToken) : null;

    await prisma.oAuthProvider.update({
      where: { id: providerId },
      data: {
        providerEmail: profile.email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: profile.tokenExpires,
      },
    });
  }

  /**
   * Generate unique username from OAuth profile
   */
  private async generateUniqueUsername(profile: OAuthProfile): Promise<string> {
    let baseUsername = profile.username || 
                      profile.email?.split('@')[0] || 
                      profile.name?.toLowerCase().replace(/\s+/g, '') || 
                      'user';
    
    // Sanitize username
    baseUsername = baseUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '').substring(0, 20);
    
    let username = baseUsername;
    let counter = 1;

    // Ensure username is unique
    while (await this.isUsernameTaken(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }

  /**
   * Check if username is already taken
   */
  private async isUsernameTaken(username: string): Promise<boolean> {
    const existingUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    return !!existingUser;
  }

  /**
   * Get OAuth providers for a user
   */
  async getUserOAuthProviders(userId: string) {
    const providers = await prisma.oAuthProvider.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        providerId: true,
        providerEmail: true,
        createdAt: true,
      },
    });

    return providers;
  }

  /**
   * Unlink OAuth provider from user
   */
  async unlinkOAuthProvider(userId: string, provider: string): Promise<void> {
    // Check if user has password or other OAuth providers
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { oauthProviders: true },
    });

    if (!user) {
      throw new AuthError('User not found', 'USER_NOT_FOUND', 404);
    }

    const hasPassword = !!user.passwordHash;
    const otherProviders = user.oauthProviders.filter(p => p.provider !== provider);

    if (!hasPassword && otherProviders.length === 0) {
      throw new AuthError('Cannot unlink last authentication method', 'LAST_AUTH_METHOD', 400);
    }

    // Unlink the provider
    await prisma.oAuthProvider.deleteMany({
      where: { userId, provider },
    });

    // Log unlinking
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'oauth_account_unlinked',
        details: { provider },
        success: true,
      },
    });
  }

  /**
   * Get available OAuth providers
   */
  getAvailableProviders(): Array<{ id: string; name: string; enabled: boolean }> {
    return Array.from(this.providers.values()).map(provider => ({
      id: provider.id,
      name: provider.name,
      enabled: provider.enabled,
    }));
  }

  /**
   * Get decrypted access token for a user's OAuth provider
   */
  async getOAuthAccessToken(userId: string, provider: string): Promise<string | null> {
    const oauthProvider = await prisma.oAuthProvider.findFirst({
      where: { userId, provider },
      select: { accessToken: true },
    });

    if (!oauthProvider?.accessToken) {
      return null;
    }

    try {
      return decryptData(oauthProvider.accessToken);
    } catch (error) {
      console.error('Failed to decrypt OAuth access token:', error);
      return null;
    }
  }

  /**
   * Exchange OAuth code for tokens (for manual OAuth flow)
   */
  async exchangeCodeForTokens(provider: string, code: string, redirectUri: string): Promise<any> {
    // This would implement the OAuth code exchange flow
    // For now, we'll rely on Passport strategies
    throw new Error('Manual OAuth code exchange not implemented. Use Passport strategies.');
  }

  /**
   * Refresh OAuth access token
   */
  async refreshOAuthToken(userId: string, provider: string): Promise<string | null> {
    const oauthProvider = await prisma.oAuthProvider.findFirst({
      where: { userId, provider },
      select: { id: true, refreshToken: true },
    });

    if (!oauthProvider?.refreshToken) {
      return null;
    }

    try {
      const refreshToken = decryptData(oauthProvider.refreshToken);
      
      // This would implement provider-specific token refresh
      // Each provider has different token refresh endpoints
      console.log(`Refreshing ${provider} token for user ${userId}`);
      
      // TODO: Implement provider-specific token refresh logic
      return null;
    } catch (error) {
      console.error('Failed to refresh OAuth token:', error);
      return null;
    }
  }

  /**
   * Generate JWT tokens for OAuth user
   */
  async generateJWTForOAuthUser(oauthUser: OAuthUser) {
    return generateTokens({
      id: oauthUser.id,
      email: oauthUser.email,
      username: oauthUser.username,
      role: oauthUser.role,
    });
  }
}
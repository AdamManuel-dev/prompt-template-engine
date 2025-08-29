/**
 * @fileoverview Mock auth service for Jest tests
 * @lastmodified 2025-08-29T10:30:00Z
 */

class AuthService {
  async registerUser(userData) {
    return {
      id: 'test-user-id',
      email: userData.email,
      username: userData.username,
      role: 'USER',
      isEmailVerified: false
    };
  }

  async authenticateUser(email, password) {
    if (email === 'test@example.com' && password === 'password') {
      return {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          username: 'testuser',
          role: 'USER'
        },
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresIn: 86400,
          refreshExpiresIn: 604800
        }
      };
    }
    throw new Error('Invalid credentials');
  }

  async refreshTokens(refreshToken) {
    if (refreshToken === 'valid-refresh-token') {
      return {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 86400,
        refreshExpiresIn: 604800
      };
    }
    throw new Error('Invalid refresh token');
  }

  async revokeAllUserTokens(userId) {
    return { success: true };
  }

  async requestPasswordReset(email) {
    return { success: true, message: 'Password reset email sent' };
  }

  async resetPassword(token, newPassword) {
    return { success: true, message: 'Password reset successfully' };
  }
}

class AuthError extends Error {
  constructor(message, code = 'AUTH_ERROR') {
    super(message);
    this.code = code;
  }
}

module.exports = { AuthService, AuthError };

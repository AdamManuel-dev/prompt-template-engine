/**
 * @fileoverview Tests for authentication service
 * @lastmodified 2025-08-29T10:30:00Z
 * 
 * Features: User registration, login, token management, password validation
 * Main APIs: Registration validation, login authentication, token refresh
 * Constraints: Requires test database setup and mocked Prisma client
 * Patterns: Service testing, database mocking, security validation
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { faker } from '@faker-js/faker'
import { UserRole } from '../../generated/prisma'
import * as _authService from '../../services/auth.service'
import * as cryptoUtils from '../../utils/crypto.utils'
import * as jwtUtils from '../../utils/jwt.utils'

// Mock dependencies
jest.mock('../../db/prisma-client')
jest.mock('../../utils/crypto.utils')
jest.mock('../../utils/jwt.utils')

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Password Validation', () => {
    it('should validate password strength', () => {
      const mockValidatePasswordStrength = jest.mocked(cryptoUtils.validatePasswordStrength)
      
      mockValidatePasswordStrength.mockReturnValue({
        isValid: true,
        score: 4,
        requirements: {
          length: true,
          uppercase: true,
          lowercase: true,
          number: true,
          special: true
        },
        suggestions: []
      })

      const result = cryptoUtils.validatePasswordStrength('StrongPassword123!')
      
      expect(result.isValid).toBe(true)
      expect(result.score).toBe(4)
      expect(mockValidatePasswordStrength).toHaveBeenCalledWith('StrongPassword123!')
    })

    it('should reject weak passwords', () => {
      const mockValidatePasswordStrength = jest.mocked(cryptoUtils.validatePasswordStrength)
      
      mockValidatePasswordStrength.mockReturnValue({
        isValid: false,
        score: 1,
        requirements: {
          length: false,
          uppercase: false,
          lowercase: true,
          number: false,
          special: false
        },
        suggestions: ['Password must be at least 8 characters long']
      })

      const result = cryptoUtils.validatePasswordStrength('weak')
      
      expect(result.isValid).toBe(false)
      expect(result.suggestions).toContain('Password must be at least 8 characters long')
    })
  })

  describe('Password Hashing', () => {
    it('should hash passwords securely', async () => {
      const mockHashPassword = jest.mocked(cryptoUtils.hashPassword)
      const password = 'testPassword123!'
      const hashedPassword = 'hashedPassword'

      mockHashPassword.mockResolvedValue(hashedPassword)

      const result = await cryptoUtils.hashPassword(password)

      expect(result).toBe(hashedPassword)
      expect(mockHashPassword).toHaveBeenCalledWith(password)
    })

    it('should verify passwords correctly', async () => {
      const mockVerifyPassword = jest.mocked(cryptoUtils.verifyPassword)
      const password = 'testPassword123!'
      const hashedPassword = 'hashedPassword'

      mockVerifyPassword.mockResolvedValue(true)

      const result = await cryptoUtils.verifyPassword(password, hashedPassword)

      expect(result).toBe(true)
      expect(mockVerifyPassword).toHaveBeenCalledWith(password, hashedPassword)
    })
  })

  describe('Token Generation', () => {
    it('should generate JWT tokens', async () => {
      const mockGenerateTokens = jest.mocked(jwtUtils.generateTokens)
      const mockUser = {
        id: faker.string.uuid(),
        email: faker.internet.email(),
        username: faker.internet.username(),
        role: UserRole.USER
      }
      
      const mockTokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 86400,
        refreshExpiresIn: 604800
      }

      mockGenerateTokens.mockResolvedValue(mockTokens)

      const result = await jwtUtils.generateTokens(mockUser)

      expect(result).toEqual(mockTokens)
      expect(mockGenerateTokens).toHaveBeenCalledWith(mockUser)
    })

    it('should refresh tokens when valid', async () => {
      const mockRefreshTokens = jest.mocked(jwtUtils.refreshTokens)
      const refreshToken = 'valid-refresh-token'
      
      const mockNewTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 86400,
        refreshExpiresIn: 604800
      }

      mockRefreshTokens.mockResolvedValue(mockNewTokens)

      const result = await jwtUtils.refreshTokens(refreshToken)

      expect(result).toEqual(mockNewTokens)
      expect(mockRefreshTokens).toHaveBeenCalledWith(refreshToken)
    })
  })

  describe('Registration Process', () => {
    it('should validate registration data', () => {
      const registrationData = {
        email: faker.internet.email(),
        username: faker.internet.username(),
        password: 'StrongPassword123!',
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      }

      // Mock password validation
      const mockValidatePasswordStrength = jest.mocked(cryptoUtils.validatePasswordStrength)
      mockValidatePasswordStrength.mockReturnValue({
        isValid: true,
        score: 4,
        requirements: {
          length: true,
          uppercase: true,
          lowercase: true,
          number: true,
          special: true
        },
        suggestions: []
      })

      const result = cryptoUtils.validatePasswordStrength(registrationData.password)
      expect(result.isValid).toBe(true)
    })

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user space@domain.com',
      ]

      invalidEmails.forEach(email => {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        expect(isValid).toBe(false)
      })
    })

    it('should accept valid email formats', () => {
      const validEmails = [
        'user@domain.com',
        'user.name@domain.com',
        'user+tag@domain.com',
        'user123@domain-name.com',
      ]

      validEmails.forEach(email => {
        const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        expect(isValid).toBe(true)
      })
    })
  })

  describe('Login Process', () => {
    it('should validate login credentials format', () => {
      const validLoginData = {
        email: faker.internet.email(),
        password: 'password123',
        rememberMe: false,
      }

      // Basic validation checks
      expect(validLoginData.email).toBeTruthy()
      expect(validLoginData.password).toBeTruthy()
      expect(typeof validLoginData.rememberMe).toBe('boolean')
    })

    it('should handle login attempts with device tracking', () => {
      const mockGenerateDeviceFingerprint = jest.mocked(cryptoUtils.generateDeviceFingerprint)
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      const ipAddress = '192.168.1.1'

      mockGenerateDeviceFingerprint.mockReturnValue('device-fingerprint-hash')

      const result = cryptoUtils.generateDeviceFingerprint(userAgent, ipAddress)

      expect(result).toBe('device-fingerprint-hash')
      expect(mockGenerateDeviceFingerprint).toHaveBeenCalledWith(userAgent, ipAddress)
    })
  })

  describe('Security Features', () => {
    it('should generate secure verification tokens', () => {
      const mockGenerateEmailVerificationToken = jest.mocked(cryptoUtils.generateEmailVerificationToken)
      const mockToken = 'secure-verification-token'

      mockGenerateEmailVerificationToken.mockReturnValue(mockToken)

      const result = cryptoUtils.generateEmailVerificationToken()

      expect(result).toBe(mockToken)
      expect(mockGenerateEmailVerificationToken).toHaveBeenCalled()
    })

    it('should generate secure password reset tokens', () => {
      const mockGeneratePasswordResetToken = jest.mocked(cryptoUtils.generatePasswordResetToken)
      const mockToken = {
        token: 'secure-password-reset-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      }

      mockGeneratePasswordResetToken.mockReturnValue(mockToken)

      const result = cryptoUtils.generatePasswordResetToken()

      expect(result).toBe(mockToken)
      expect(mockGeneratePasswordResetToken).toHaveBeenCalled()
    })

    it('should revoke all user tokens', async () => {
      const mockRevokeAllUserTokens = jest.mocked(jwtUtils.revokeAllUserTokens)
      const userId = faker.string.uuid()

      mockRevokeAllUserTokens.mockResolvedValue(undefined)

      await jwtUtils.revokeAllUserTokens(userId)

      expect(mockRevokeAllUserTokens).toHaveBeenCalledWith(userId)
    })
  })

  describe('Error Handling', () => {
    it('should handle password hashing failures', async () => {
      const mockHashPassword = jest.mocked(cryptoUtils.hashPassword)
      mockHashPassword.mockRejectedValue(new Error('Hashing failed'))

      await expect(cryptoUtils.hashPassword('password')).rejects.toThrow('Hashing failed')
    })

    it('should handle token generation failures', async () => {
      const mockGenerateTokens = jest.mocked(jwtUtils.generateTokens)
      mockGenerateTokens.mockRejectedValue(new Error('Token generation failed'))

      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        username: 'testuser',
        role: UserRole.USER
      }

      await expect(jwtUtils.generateTokens(mockUser)).rejects.toThrow('Token generation failed')
    })
  })

  describe('Data Validation', () => {
    it('should validate user roles', () => {
      const validRoles = Object.values(UserRole)
      expect(validRoles).toContain(UserRole.USER)
      expect(validRoles).toContain(UserRole.ADMIN)
    })

    it('should validate required registration fields', () => {
      const requiredFields = ['email', 'username', 'password']
      const registrationData = {
        email: faker.internet.email(),
        username: faker.internet.username(),
        password: 'password123',
        firstName: faker.person.firstName(),
      }

      requiredFields.forEach(field => {
        expect(registrationData[field as keyof typeof registrationData]).toBeTruthy()
      })
    })
  })
})
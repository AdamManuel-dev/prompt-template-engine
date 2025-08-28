/**
 * @fileoverview User service for CRUD operations and profile management
 * @lastmodified 2025-01-08T20:30:00Z
 *
 * Features: User CRUD operations, profile management, preferences, authentication support
 * Main APIs: createUser(), getUserById(), updateUser(), deleteUser(), getUserByEmail()
 * Constraints: Unique email/username validation, profile validation, soft deletes
 * Patterns: Service layer pattern, error handling, input validation
 */

import {
  User,
  Prisma,
} from '../generated/prisma';
import { getPrismaClient } from '../db/prisma-client';

const prisma = getPrismaClient();

export interface CreateUserRequest {
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  preferences?: Record<string, any>;
}

export interface UpdateUserRequest {
  displayName?: string;
  avatarUrl?: string;
  preferences?: Record<string, any>;
  isActive?: boolean;
  lastLoginAt?: Date;
  emailVerified?: boolean;
}

export interface UserFilters {
  isActive?: boolean;
  emailVerified?: boolean;
  search?: string; // Search in username, email, or displayName
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'username' | 'email' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedUsers {
  users: User[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * User Service class for all user-related operations
 */
export class UserService {
  /**
   * Create a new user
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      // Check if email or username already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: userData.email.toLowerCase() },
            { username: userData.username.toLowerCase() },
          ],
        },
      });

      if (existingUser) {
        if (existingUser.email === userData.email.toLowerCase()) {
          throw new Error('User with this email already exists');
        }
        if (existingUser.username === userData.username.toLowerCase()) {
          throw new Error('User with this username already exists');
        }
      }

      const user = await prisma.user.create({
        data: {
          email: userData.email.toLowerCase(),
          username: userData.username.toLowerCase(),
          displayName: userData.displayName,
          avatarUrl: userData.avatarUrl,
          preferences: userData.preferences || {},
        },
      });

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error('User with this email or username already exists');
        }
      }
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(
    id: string,
    includeRelations = false
  ): Promise<User | null> {
    const include = includeRelations
      ? {
          executions: {
            orderBy: { createdAt: 'desc' as const },
            take: 10,
          },
          favorites: {
            orderBy: { createdAt: 'desc' as const },
          },
          ratings: {
            orderBy: { createdAt: 'desc' as const },
          },
        }
      : undefined;

    return await prisma.user.findUnique({
      where: { id },
      include,
    });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(
    email: string,
    includeRelations = false
  ): Promise<User | null> {
    const include = includeRelations
      ? {
          executions: {
            orderBy: { createdAt: 'desc' as const },
            take: 10,
          },
          favorites: true,
          ratings: true,
        }
      : undefined;

    return await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include,
    });
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });
  }

  /**
   * Update user profile
   */
  async updateUser(id: string, updateData: UpdateUserRequest): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
      });

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('User not found');
        }
      }
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    id: string,
    preferences: Record<string, any>
  ): Promise<User> {
    const existingUser = await this.getUserById(id);
    if (!existingUser) {
      throw new Error('User not found');
    }

    const mergedPreferences = {
      ...((existingUser.preferences as Record<string, any>) || {}),
      ...preferences,
    };

    return await this.updateUser(id, { preferences: mergedPreferences });
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<User> {
    return await this.updateUser(id, { lastLoginAt: new Date() });
  }

  /**
   * Soft delete user (set isActive to false)
   */
  async deleteUser(id: string): Promise<User> {
    return await this.updateUser(id, { isActive: false });
  }

  /**
   * Hard delete user and all related data
   */
  async hardDeleteUser(id: string): Promise<void> {
    try {
      await prisma.user.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('User not found');
        }
      }
      throw error;
    }
  }

  /**
   * Get paginated list of users with filters
   */
  async getUsers(
    filters: UserFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedUsers> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = pagination;

    const offset = (page - 1) * limit;

    // Build where clause based on filters
    const where: Prisma.UserWhereInput = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.emailVerified !== undefined) {
      where.emailVerified = filters.emailVerified;
    }

    if (filters.search) {
      where.OR = [
        { username: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { displayName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Execute queries in parallel
    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: offset,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      users,
      totalCount,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Get user statistics
   */
  async getUserStats(id: string): Promise<{
    totalExecutions: number;
    totalFavorites: number;
    totalRatings: number;
    avgRating: number;
    memberSince: Date;
  }> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            executions: true,
            favorites: true,
            ratings: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Calculate average rating given by user
    const avgRatingResult = await prisma.rating.aggregate({
      where: { userId: id },
      _avg: { rating: true },
    });

    return {
      totalExecutions: user._count.executions,
      totalFavorites: user._count.favorites,
      totalRatings: user._count.ratings,
      avgRating: avgRatingResult._avg.rating || 0,
      memberSince: user.createdAt,
    };
  }

  /**
   * Verify user email
   */
  async verifyEmail(id: string): Promise<User> {
    return await this.updateUser(id, { emailVerified: true });
  }

  /**
   * Check if email is available
   */
  async isEmailAvailable(
    email: string,
    excludeUserId?: string
  ): Promise<boolean> {
    const where: Prisma.UserWhereInput = {
      email: email.toLowerCase(),
    };

    if (excludeUserId) {
      where.NOT = { id: excludeUserId };
    }

    const existingUser = await prisma.user.findFirst({ where });
    return !existingUser;
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(
    username: string,
    excludeUserId?: string
  ): Promise<boolean> {
    const where: Prisma.UserWhereInput = {
      username: username.toLowerCase(),
    };

    if (excludeUserId) {
      where.NOT = { id: excludeUserId };
    }

    const existingUser = await prisma.user.findFirst({ where });
    return !existingUser;
  }
}

// Export singleton instance
export const userService = new UserService();

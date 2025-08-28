/**
 * @fileoverview Favorites service for managing user favorite templates
 * @lastmodified 2025-01-08T21:00:00Z
 *
 * Features: Add/remove favorites, get user favorites, check favorite status
 * Main APIs: addFavorite(), removeFavorite(), getUserFavorites(), isFavorite()
 * Constraints: Unique user-template pairs, proper validation
 * Patterns: Service layer pattern, validation, error handling
 */

import {
  Favorite,
  Prisma,
} from '../generated/prisma';
import { getPrismaClient } from '../db/prisma-client';

const prisma = getPrismaClient();

export interface AddFavoriteRequest {
  userId: string;
  templateId: string;
  templateName: string;
  templatePath?: string;
}

/**
 * Favorites Service class for managing user favorite templates
 */
export class FavoritesService {
  /**
   * Add template to user favorites
   */
  async addFavorite(favoriteData: AddFavoriteRequest): Promise<Favorite> {
    try {
      // Check if already favorited
      const existing = await prisma.favorite.findUnique({
        where: {
          userId_templateId: {
            userId: favoriteData.userId,
            templateId: favoriteData.templateId,
          },
        },
      });

      if (existing) {
        return existing; // Already favorited, return existing
      }

      const favorite = await prisma.favorite.create({
        data: favoriteData,
      });

      return favorite;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          // Unique constraint violation - already favorited
          const existing = await prisma.favorite.findUnique({
            where: {
              userId_templateId: {
                userId: favoriteData.userId,
                templateId: favoriteData.templateId,
              },
            },
          });
          if (existing) return existing;
        }
      }
      throw error;
    }
  }

  /**
   * Remove template from user favorites
   */
  async removeFavorite(userId: string, templateId: string): Promise<boolean> {
    try {
      await prisma.favorite.delete({
        where: {
          userId_templateId: {
            userId,
            templateId,
          },
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          // Record not found
          return false;
        }
      }
      throw error;
    }
  }

  /**
   * Check if template is favorited by user
   */
  async isFavorite(userId: string, templateId: string): Promise<boolean> {
    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_templateId: {
          userId,
          templateId,
        },
      },
    });

    return !!favorite;
  }

  /**
   * Get all favorites for a user
   */
  async getUserFavorites(
    userId: string,
    pagination: { page?: number; limit?: number } = {}
  ): Promise<{
    favorites: Favorite[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    const [favorites, totalCount] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.favorite.count({
        where: { userId },
      }),
    ]);

    return {
      favorites,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  /**
   * Get most favorited templates
   */
  async getMostFavorited(limit = 10): Promise<
    Array<{
      templateId: string;
      templateName: string;
      favoriteCount: number;
    }>
  > {
    const results = await prisma.favorite.groupBy({
      by: ['templateId', 'templateName'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    return results.map(result => ({
      templateId: result.templateId,
      templateName: result.templateName,
      favoriteCount: result._count.id,
    }));
  }

  /**
   * Get favorite statistics for a template
   */
  async getTemplateStats(templateId: string): Promise<{
    favoriteCount: number;
    recentFavorites: Array<{
      userId: string;
      username?: string;
      createdAt: Date;
    }>;
  }> {
    const [favoriteCount, recentFavorites] = await Promise.all([
      prisma.favorite.count({
        where: { templateId },
      }),
      prisma.favorite.findMany({
        where: { templateId },
        include: {
          user: {
            select: { username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      favoriteCount,
      recentFavorites: recentFavorites.map(fav => ({
        userId: fav.userId,
        username: fav.user.username,
        createdAt: fav.createdAt,
      })),
    };
  }

  /**
   * Toggle favorite status (add if not exists, remove if exists)
   */
  async toggleFavorite(favoriteData: AddFavoriteRequest): Promise<{
    isFavorite: boolean;
    favorite?: Favorite;
  }> {
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_templateId: {
          userId: favoriteData.userId,
          templateId: favoriteData.templateId,
        },
      },
    });

    if (existing) {
      // Remove favorite
      await this.removeFavorite(favoriteData.userId, favoriteData.templateId);
      return { isFavorite: false };
    }
    // Add favorite
    const favorite = await this.addFavorite(favoriteData);
    return { isFavorite: true, favorite };
  }

  /**
   * Remove all favorites for a user (cleanup)
   */
  async removeAllUserFavorites(userId: string): Promise<number> {
    const result = await prisma.favorite.deleteMany({
      where: { userId },
    });

    return result.count;
  }

  /**
   * Remove all favorites for a template (cleanup)
   */
  async removeAllTemplateFavorites(templateId: string): Promise<number> {
    const result = await prisma.favorite.deleteMany({
      where: { templateId },
    });

    return result.count;
  }
}

// Export singleton instance
export const favoritesService = new FavoritesService();

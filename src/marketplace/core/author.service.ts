/**
 * @fileoverview Author profile management service
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: Profile management, verification, reputation, social integration
 * Main APIs: getProfile(), updateProfile(), followAuthor(), getActivity()
 * Constraints: Profile validation, rate limiting, privacy controls
 * Patterns: Service layer, profile management, reputation system
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import {
  AuthorProfile,
  AuthorSearchQuery,
  AuthorSearchResult,
  AuthorActivity,
  AuthorStats,
  AuthorBadge,
  AuthorAnalytics,
  AuthorContribution,
  AuthorReputationLog,
} from '../models/author.model';
import { MarketplaceAPI } from '../api/marketplace.api';

export class AuthorService extends EventEmitter {
  private static instance: AuthorService;

  private api: MarketplaceAPI;

  private cache: Map<string, { data: unknown; expires: number }> = new Map();

  private followingCache: Map<string, Set<string>> = new Map();

  constructor() {
    super();
    this.api = new MarketplaceAPI();
  }

  static getInstance(): AuthorService {
    if (!AuthorService.instance) {
      AuthorService.instance = new AuthorService();
    }
    return AuthorService.instance;
  }

  /**
   * Get author profile by ID or username
   */
  async getProfile(identifier: string): Promise<AuthorProfile> {
    const cacheKey = `profile:${identifier}`;
    const cached = this.getFromCache<AuthorProfile>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const profile = await this.api.getAuthorProfile(identifier);
      this.setCache(cacheKey, profile, 10 * 60 * 1000); // 10 minutes

      this.emit('profile:fetched', { identifier, profile });
      return profile;
    } catch (error) {
      logger.error(`Failed to fetch author profile ${identifier}: ${error}`);
      this.emit('profile:error', { identifier, error });
      throw error;
    }
  }

  /**
   * Search authors by criteria
   */
  async searchAuthors(query: AuthorSearchQuery): Promise<AuthorSearchResult> {
    const cacheKey = `search:${JSON.stringify(query)}`;
    const cached = this.getFromCache<AuthorSearchResult>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const result = await this.api.searchAuthors(query);
      this.setCache(cacheKey, result, 5 * 60 * 1000); // 5 minutes

      this.emit('search:completed', { query, result });
      return result;
    } catch (error) {
      logger.error(`Author search failed: ${error}`);
      this.emit('search:error', { query, error });
      throw error;
    }
  }

  /**
   * Get author's templates
   */
  async getAuthorTemplates(
    authorId: string,
    options: {
      page?: number;
      limit?: number;
      status?: 'published' | 'draft' | 'all';
      category?: string;
    } = {}
  ): Promise<any> {
    const cacheKey = `templates:${authorId}:${JSON.stringify(options)}`;
    const cached = this.getFromCache<any>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const templates = await this.api.getAuthorTemplates(authorId, options);
      this.setCache(cacheKey, templates, 5 * 60 * 1000); // 5 minutes

      this.emit('templates:fetched', { authorId, templates });
      return templates;
    } catch (error) {
      logger.error(
        `Failed to fetch templates for author ${authorId}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Get author activity feed
   */
  async getAuthorActivity(
    authorId: string,
    options: {
      page?: number;
      limit?: number;
      type?: string;
      visibility?: 'public' | 'followers' | 'all';
    } = {}
  ): Promise<AuthorActivity[]> {
    const cacheKey = `activity:${authorId}:${JSON.stringify(options)}`;
    const cached = this.getFromCache<AuthorActivity[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const activities = await this.api.getAuthorActivity(authorId, options);
      this.setCache(cacheKey, activities, 2 * 60 * 1000); // 2 minutes

      this.emit('activity:fetched', { authorId, activities });
      return activities;
    } catch (error) {
      logger.error(`Failed to fetch activity for author ${authorId}: ${error}`);
      throw error;
    }
  }

  /**
   * Follow/unfollow author
   */
  async toggleFollow(
    followerId: string,
    authorId: string
  ): Promise<{ following: boolean }> {
    try {
      const result = await this.api.toggleAuthorFollow(followerId, authorId);

      // Update local cache
      if (!this.followingCache.has(followerId)) {
        this.followingCache.set(followerId, new Set());
      }

      const following = this.followingCache.get(followerId)!;
      if (result.following) {
        following.add(authorId);
      } else {
        following.delete(authorId);
      }

      // Invalidate relevant caches
      this.invalidateCache(`profile:${authorId}`);
      this.invalidateCache(`profile:${followerId}`);

      this.emit('follow:toggled', {
        followerId,
        authorId,
        following: result.following,
      });

      return result;
    } catch (error) {
      logger.error(
        `Failed to toggle follow ${followerId} -> ${authorId}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Check if user is following author
   */
  async isFollowing(followerId: string, authorId: string): Promise<boolean> {
    try {
      // Check cache first
      const following = this.followingCache.get(followerId);
      if (following) {
        return following.has(authorId);
      }

      // Fetch from API
      const result = await this.api.isFollowingAuthor(followerId, authorId);

      // Update cache
      if (!this.followingCache.has(followerId)) {
        this.followingCache.set(followerId, new Set());
      }

      if (result.following) {
        this.followingCache.get(followerId)!.add(authorId);
      }

      return result.following;
    } catch (error) {
      logger.error(
        `Failed to check follow status ${followerId} -> ${authorId}: ${error}`
      );
      return false;
    }
  }

  /**
   * Get author statistics
   */
  async getAuthorStats(authorId: string): Promise<AuthorStats> {
    const cacheKey = `stats:${authorId}`;
    const cached = this.getFromCache<AuthorStats>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const stats = await this.api.getAuthorStats(authorId);
      this.setCache(cacheKey, stats, 15 * 60 * 1000); // 15 minutes

      return stats;
    } catch (error) {
      logger.error(`Failed to fetch stats for author ${authorId}: ${error}`);
      throw error;
    }
  }

  /**
   * Get author analytics (for own profile)
   */
  async getAuthorAnalytics(
    authorId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<AuthorAnalytics> {
    try {
      const analytics = await this.api.getAuthorAnalytics(authorId, period);

      this.emit('analytics:fetched', { authorId, period, analytics });
      return analytics;
    } catch (error) {
      logger.error(
        `Failed to fetch analytics for author ${authorId}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Get featured authors
   */
  async getFeaturedAuthors(limit: number = 10): Promise<AuthorProfile[]> {
    const cacheKey = `featured:${limit}`;
    const cached = this.getFromCache<AuthorProfile[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const authors = await this.api.getFeaturedAuthors(limit);
      this.setCache(cacheKey, authors, 30 * 60 * 1000); // 30 minutes

      return authors;
    } catch (error) {
      logger.error(`Failed to fetch featured authors: ${error}`);
      throw error;
    }
  }

  /**
   * Get trending authors
   */
  async getTrendingAuthors(
    period: 'day' | 'week' | 'month' = 'week',
    limit: number = 10
  ): Promise<AuthorProfile[]> {
    const cacheKey = `trending:${period}:${limit}`;
    const cached = this.getFromCache<AuthorProfile[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const authors = await this.api.getTrendingAuthors(period, limit);
      this.setCache(cacheKey, authors, 15 * 60 * 1000); // 15 minutes

      return authors;
    } catch (error) {
      logger.error(`Failed to fetch trending authors: ${error}`);
      throw error;
    }
  }

  /**
   * Get author badges
   */
  async getAuthorBadges(authorId: string): Promise<AuthorBadge[]> {
    const cacheKey = `badges:${authorId}`;
    const cached = this.getFromCache<AuthorBadge[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const badges = await this.api.getAuthorBadges(authorId);
      this.setCache(cacheKey, badges, 60 * 60 * 1000); // 1 hour

      return badges;
    } catch (error) {
      logger.error(`Failed to fetch badges for author ${authorId}: ${error}`);
      throw error;
    }
  }

  /**
   * Get author contributions
   */
  async getAuthorContributions(
    authorId: string,
    options: {
      type?: string;
      approved?: boolean;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<AuthorContribution[]> {
    try {
      const contributions = await this.api.getAuthorContributions(
        authorId,
        options
      );

      return contributions;
    } catch (error) {
      logger.error(
        `Failed to fetch contributions for author ${authorId}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Get author reputation history
   */
  async getReputationHistory(
    authorId: string,
    options: {
      period?: 'week' | 'month' | 'year';
      limit?: number;
    } = {}
  ): Promise<AuthorReputationLog[]> {
    try {
      const history = await this.api.getAuthorReputationHistory(
        authorId,
        options
      );

      return history;
    } catch (error) {
      logger.error(
        `Failed to fetch reputation history for author ${authorId}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Get author followers
   */
  async getFollowers(
    authorId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ followers: AuthorProfile[]; total: number }> {
    const cacheKey = `followers:${authorId}:${page}:${limit}`;
    const cached = this.getFromCache<{
      followers: AuthorProfile[];
      total: number;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const result = await this.api.getAuthorFollowers(authorId, page, limit);
      this.setCache(cacheKey, result, 10 * 60 * 1000); // 10 minutes

      return result;
    } catch (error) {
      logger.error(
        `Failed to fetch followers for author ${authorId}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Get who author is following
   */
  async getFollowing(
    authorId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ following: AuthorProfile[]; total: number }> {
    const cacheKey = `following:${authorId}:${page}:${limit}`;
    const cached = this.getFromCache<{
      following: AuthorProfile[];
      total: number;
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const result = await this.api.getAuthorFollowing(authorId, page, limit);
      this.setCache(cacheKey, result, 10 * 60 * 1000); // 10 minutes

      return result;
    } catch (error) {
      logger.error(
        `Failed to fetch following for author ${authorId}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Calculate reputation score for author
   */
  calculateReputation(stats: AuthorStats): number {
    const weights = {
      templates: 5,
      downloads: 0.1,
      rating: 20,
      reviews: 2,
      followers: 1,
    };

    let score = 0;
    score += stats.publishedTemplates * weights.templates;
    score += stats.totalDownloads * weights.downloads;
    score += stats.averageRating * weights.rating;
    score += stats.totalReviews * weights.reviews;
    score += stats.followers * weights.followers;

    // Bonus for consistency
    const daysSinceJoined = Math.floor(
      (Date.now() - new Date(stats.joinedDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    if (daysSinceJoined > 0) {
      const templatesPerDay = stats.publishedTemplates / daysSinceJoined;
      score += templatesPerDay * 100; // Bonus for active authors
    }

    return Math.round(Math.max(0, score));
  }

  /**
   * Format author profile for display
   */
  formatAuthorProfile(author: AuthorProfile): {
    displayName: string;
    username: string;
    reputation: number;
    badges: string[];
    verified: boolean;
    summary: string;
  } {
    const topBadges = author.verification.badges
      .slice(0, 3)
      .map(badge => badge.name);

    const summary = `${author.stats.totalTemplates} templates • ${this.formatNumber(author.stats.totalDownloads)} downloads`;

    return {
      displayName: author.displayName,
      username: author.username,
      reputation: author.stats.reputation,
      badges: topBadges,
      verified: author.verification.verified,
      summary,
    };
  }

  /**
   * Cache management
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: unknown, ttl: number): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttl,
    });
  }

  private invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }
}

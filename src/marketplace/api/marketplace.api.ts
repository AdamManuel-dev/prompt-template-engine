/**
 * @fileoverview Marketplace API client for remote template operations
 * @lastmodified 2025-08-22T20:00:00Z
 *
 * Features: HTTP client, authentication, rate limiting, error handling
 * Main APIs: searchTemplates(), getTemplate(), rateTemplate(), uploadTemplate()
 * Constraints: Network connectivity, API rate limits, authentication
 * Patterns: HTTP client, API abstraction, retry logic, caching
 */

import { logger } from '../../utils/logger';
import {
  TemplateModel,
  TemplateSearchQuery,
  TemplateSearchResult,
  TemplateReview,
  AuthorInfo,
} from '../models/template.model';
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
import { TemplateSearchResult as TypedTemplateSearchResult } from '../../types';

export interface MarketplaceConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  rateLimitDelay: number;
}

export interface APIResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export class MarketplaceAPI {
  private config: MarketplaceConfig;

  private requestCount = 0;

  private lastRequest = 0;

  private authToken?: string;

  constructor(config?: Partial<MarketplaceConfig>) {
    this.config = {
      baseUrl:
        process.env.MARKETPLACE_URL ||
        'https://marketplace.cursor-prompt.com/api',
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      rateLimitDelay: 100,
      ...config,
    };

    this.authToken = process.env.MARKETPLACE_API_KEY || config?.apiKey;
  }

  /**
   * Search templates in marketplace
   */
  async searchTemplates(
    query: TemplateSearchQuery
  ): Promise<TemplateSearchResult> {
    const params = new URLSearchParams();

    if (query.query) params.append('q', query.query);
    if (query.category) params.append('category', query.category);
    if (query.tags) params.append('tags', query.tags.join(','));
    if (query.author) params.append('author', query.author);
    if (query.minRating) params.append('minRating', query.minRating.toString());
    if (query.sortBy) params.append('sortBy', query.sortBy);
    if (query.sortOrder) params.append('sortOrder', query.sortOrder);
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());
    if (query.featured) params.append('featured', 'true');
    if (query.verified) params.append('verified', 'true');
    if (query.trending) params.append('trending', 'true');

    const response = await this.request<TemplateSearchResult>(
      'GET',
      `/templates?${params}`
    );
    return response.data;
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<TemplateModel> {
    const response = await this.request<TemplateModel>(
      'GET',
      `/templates/${templateId}`
    );
    return response.data;
  }

  /**
   * Get template versions
   */
  async getTemplateVersions(templateId: string): Promise<string[]> {
    const response = await this.request<string[]>(
      'GET',
      `/templates/${templateId}/versions`
    );
    return response.data;
  }

  /**
   * Download template content
   */
  async downloadTemplate(
    templateId: string,
    version?: string
  ): Promise<string> {
    const url = version
      ? `/templates/${templateId}/download/${version}`
      : `/templates/${templateId}/download`;

    const response = await this.request<{ content: string }>('GET', url);
    return response.data.content;
  }

  /**
   * Rate template
   */
  async rateTemplate(
    templateId: string,
    rating: number,
    review?: Partial<TemplateReview>
  ): Promise<void> {
    const payload = {
      rating,
      ...review,
    };

    await this.request('POST', `/templates/${templateId}/ratings`, payload);
  }

  /**
   * Get template ratings
   */
  async getTemplateRatings(
    templateId: string,
    page = 1,
    limit = 10
  ): Promise<TemplateReview[]> {
    const response = await this.request<TemplateReview[]>(
      'GET',
      `/templates/${templateId}/ratings?page=${page}&limit=${limit}`
    );
    return response.data;
  }

  /**
   * Upload new template
   */
  async uploadTemplate(
    template: Partial<TemplateModel>
  ): Promise<TemplateModel> {
    const response = await this.request<TemplateModel>(
      'POST',
      '/templates',
      template
    );
    return response.data;
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<TemplateModel>
  ): Promise<TemplateModel> {
    const response = await this.request<TemplateModel>(
      'PUT',
      `/templates/${templateId}`,
      updates
    );
    return response.data;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    await this.request('DELETE', `/templates/${templateId}`);
  }

  /**
   * Get author information
   */
  async getAuthor(authorId: string): Promise<AuthorInfo> {
    const response = await this.request<AuthorInfo>(
      'GET',
      `/authors/${authorId}`
    );
    return response.data;
  }

  /**
   * Get author templates (updated with options)
   */
  async getAuthorTemplates(
    authorId: string,
    options: Record<string, unknown> = {}
  ): Promise<TypedTemplateSearchResult> {
    const response = await this.request<TypedTemplateSearchResult>(
      'GET',
      `/authors/${authorId}/templates`,
      options
    );
    return response.data;
  }

  /**
   * Get featured templates
   */
  async getFeaturedTemplates(limit = 10): Promise<TemplateModel[]> {
    const response = await this.request<TemplateModel[]>(
      'GET',
      `/featured?limit=${limit}`
    );
    return response.data;
  }

  /**
   * Get trending templates
   */
  async getTrendingTemplates(
    period = '7d',
    limit = 10
  ): Promise<TemplateModel[]> {
    const response = await this.request<TemplateModel[]>(
      'GET',
      `/trending?period=${period}&limit=${limit}`
    );
    return response.data;
  }

  /**
   * Get template categories
   */
  async getCategories(): Promise<
    Array<{ name: string; count: number; description: string }>
  > {
    const response = await this.request<
      Array<{ name: string; count: number; description: string }>
    >('GET', '/categories');
    return response.data;
  }

  /**
   * Report template
   */
  async reportTemplate(
    templateId: string,
    reason: string,
    details?: string
  ): Promise<void> {
    const payload = {
      reason,
      details,
    };

    await this.request('POST', `/templates/${templateId}/report`, payload);
  }

  /**
   * Follow author
   */
  async followAuthor(authorId: string): Promise<void> {
    await this.request('POST', `/authors/${authorId}/follow`);
  }

  /**
   * Unfollow author
   */
  async unfollowAuthor(authorId: string): Promise<void> {
    await this.request('DELETE', `/authors/${authorId}/follow`);
  }

  /**
   * Get user's followed authors
   */
  async getFollowedAuthors(): Promise<AuthorInfo[]> {
    const response = await this.request<AuthorInfo[]>('GET', '/user/following');
    return response.data;
  }

  /**
   * Get user's favorite templates
   */
  async getFavoriteTemplates(): Promise<TemplateModel[]> {
    const response = await this.request<TemplateModel[]>(
      'GET',
      '/user/favorites'
    );
    return response.data;
  }

  /**
   * Add template to favorites
   */
  async addToFavorites(templateId: string): Promise<void> {
    await this.request('POST', `/templates/${templateId}/favorite`);
  }

  /**
   * Remove template from favorites
   */
  async removeFromFavorites(templateId: string): Promise<void> {
    await this.request('DELETE', `/templates/${templateId}/favorite`);
  }

  /**
   * Make HTTP request with error handling and retries
   */
  private async request<T>(
    method: string,
    endpoint: string,
    data?: unknown
  ): Promise<APIResponse<T>> {
    await this.rateLimitDelay();

    let lastError: Error | null = null;

    // Retry logic requires sequential execution with await
    // eslint-disable-next-line no-await-in-loop
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await this.makeRequest<T>(method, endpoint, data);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === this.config.retryAttempts) {
          break;
        }

        // Don't retry on client errors (4xx)
        if (error instanceof Error && error.message.includes('4')) {
          break;
        }

        logger.warn(
          `API request failed (attempt ${attempt}/${this.config.retryAttempts}): ${error}`
        );
        // eslint-disable-next-line no-await-in-loop
        await this.delay(this.config.retryDelay * attempt);
      }
    }

    throw lastError || new Error('API request failed');
  }

  /**
   * Make actual HTTP request
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: unknown
  ): Promise<APIResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'cursor-prompt-template-engine/1.0.0',
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const responseData = (await response.json()) as APIResponse<T>;

    if (!responseData.success) {
      throw new Error(responseData.message || 'API request failed');
    }

    return responseData;
  }

  /**
   * Rate limiting delay
   */
  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;

    if (timeSinceLastRequest < this.config.rateLimitDelay) {
      await this.delay(this.config.rateLimitDelay - timeSinceLastRequest);
    }

    this.lastRequest = Date.now();
    this.requestCount += 1;
  }

  /**
   * Simple delay utility
   */
  // eslint-disable-next-line class-methods-use-this
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.authToken = undefined;
  }

  /**
   * Get request statistics
   */
  getStats(): { requestCount: number; lastRequest: number } {
    return {
      requestCount: this.requestCount,
      lastRequest: this.lastRequest,
    };
  }

  // Author profile methods (placeholder implementations)

  async getAuthorProfile(identifier: string): Promise<AuthorProfile> {
    const response = await this.request<AuthorProfile>(
      'GET',
      `/authors/${identifier}`
    );
    return response.data;
  }

  async searchAuthors(query: AuthorSearchQuery): Promise<AuthorSearchResult> {
    const response = await this.request<AuthorSearchResult>(
      'GET',
      '/authors/search',
      query
    );
    return response.data;
  }

  async getAuthorActivity(
    authorId: string,
    options: Record<string, unknown>
  ): Promise<AuthorActivity[]> {
    const response = await this.request<AuthorActivity[]>(
      'GET',
      `/authors/${authorId}/activity`,
      options
    );
    return response.data;
  }

  async toggleAuthorFollow(
    followerId: string,
    authorId: string
  ): Promise<{ following: boolean }> {
    const response = await this.request<{ following: boolean }>(
      'POST',
      `/authors/${authorId}/follow`,
      { followerId }
    );
    return response.data;
  }

  async isFollowingAuthor(
    followerId: string,
    authorId: string
  ): Promise<{ following: boolean }> {
    const response = await this.request<{ following: boolean }>(
      'GET',
      `/authors/${authorId}/follow-status`,
      { followerId }
    );
    return response.data;
  }

  async getAuthorStats(authorId: string): Promise<AuthorStats> {
    const response = await this.request<AuthorStats>(
      'GET',
      `/authors/${authorId}/stats`
    );
    return response.data;
  }

  async getAuthorAnalytics(
    authorId: string,
    period: string
  ): Promise<AuthorAnalytics> {
    const response = await this.request<AuthorAnalytics>(
      'GET',
      `/authors/${authorId}/analytics`,
      { period }
    );
    return response.data;
  }

  async getFeaturedAuthors(limit: number): Promise<AuthorProfile[]> {
    const response = await this.request<AuthorProfile[]>(
      'GET',
      '/authors/featured',
      { limit }
    );
    return response.data;
  }

  async getTrendingAuthors(
    period: string,
    limit: number
  ): Promise<AuthorProfile[]> {
    const response = await this.request<AuthorProfile[]>(
      'GET',
      '/authors/trending',
      { period, limit }
    );
    return response.data;
  }

  async getAuthorBadges(authorId: string): Promise<AuthorBadge[]> {
    const response = await this.request<AuthorBadge[]>(
      'GET',
      `/authors/${authorId}/badges`
    );
    return response.data;
  }

  async getAuthorContributions(
    authorId: string,
    options: Record<string, unknown>
  ): Promise<AuthorContribution[]> {
    const response = await this.request<AuthorContribution[]>(
      'GET',
      `/authors/${authorId}/contributions`,
      options
    );
    return response.data;
  }

  async getAuthorReputationHistory(
    authorId: string,
    options: Record<string, unknown>
  ): Promise<AuthorReputationLog[]> {
    const response = await this.request<AuthorReputationLog[]>(
      'GET',
      `/authors/${authorId}/reputation`,
      options
    );
    return response.data;
  }

  async getAuthorFollowers(
    authorId: string,
    page: number,
    limit: number
  ): Promise<{ followers: AuthorProfile[]; total: number }> {
    const response = await this.request<{
      followers: AuthorProfile[];
      total: number;
    }>('GET', `/authors/${authorId}/followers`, { page, limit });
    return response.data;
  }

  async getAuthorFollowing(
    authorId: string,
    page: number,
    limit: number
  ): Promise<{ following: AuthorProfile[]; total: number }> {
    const response = await this.request<{
      following: AuthorProfile[];
      total: number;
    }>('GET', `/authors/${authorId}/following`, { page, limit });
    return response.data;
  }
}

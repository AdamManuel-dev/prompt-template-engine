/**
 * @fileoverview Tests for template search service
 * @lastmodified 2025-08-22T22:00:00Z
 */

import { TemplateSearchService } from '../../../../src/marketplace/services/template-search.service';
import { MarketplaceAPI } from '../../../../src/marketplace/api/marketplace.api';
import {
  TemplateSearchQuery,
  TemplateSearchResult,
  TemplateModel,
} from '../../../../src/marketplace/models/template.model';

jest.mock('../../../../src/marketplace/api/marketplace.api');

describe('TemplateSearchService', () => {
  let service: TemplateSearchService;
  let mockApi: jest.Mocked<MarketplaceAPI>;

  beforeEach(() => {
    mockApi = new MarketplaceAPI() as jest.Mocked<MarketplaceAPI>;
    service = new TemplateSearchService(mockApi);
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should search templates with query', async () => {
      const query: TemplateSearchQuery = {
        query: 'test',
        category: 'development',
        page: 1,
        limit: 10,
      };

      const mockResult: TemplateSearchResult = {
        templates: [
          {
            id: 'test-template',
            name: 'Test Template',
            description: 'A test template',
            category: 'development',
          } as TemplateModel,
        ],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockApi.searchTemplates.mockResolvedValue(mockResult);

      const result = await service.search(query);

      expect(mockApi.searchTemplates).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });

    it('should cache search results', async () => {
      const query: TemplateSearchQuery = {
        query: 'cached',
        page: 1,
        limit: 10,
      };

      const mockResult: TemplateSearchResult = {
        templates: [],
        total: 0,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockApi.searchTemplates.mockResolvedValue(mockResult);

      // First call
      await service.search(query);
      // Second call (should use cache)
      await service.search(query);

      // API should only be called once due to caching
      expect(mockApi.searchTemplates).toHaveBeenCalledTimes(1);
    });

    it('should handle search errors', async () => {
      const query: TemplateSearchQuery = { query: 'error' };
      const error = new Error('Search failed');

      mockApi.searchTemplates.mockRejectedValue(error);

      await expect(service.search(query)).rejects.toThrow('Search failed');
    });
  });

  describe('getTemplate', () => {
    it('should get template by ID', async () => {
      const templateId = 'test-id';
      const mockTemplate: TemplateModel = {
        id: templateId,
        name: 'Test Template',
        description: 'Test description',
      } as TemplateModel;

      mockApi.getTemplate.mockResolvedValue(mockTemplate);

      const result = await service.getTemplate(templateId);

      expect(mockApi.getTemplate).toHaveBeenCalledWith(templateId);
      expect(result).toEqual(mockTemplate);
    });

    it('should handle get template errors', async () => {
      const templateId = 'error-id';
      const error = new Error('Template not found');

      mockApi.getTemplate.mockRejectedValue(error);

      await expect(service.getTemplate(templateId)).rejects.toThrow(
        'Template not found'
      );
    });
  });

  describe('getFeatured', () => {
    it('should get featured templates', async () => {
      const mockResult: TemplateSearchResult = {
        templates: [
          { id: 'featured-1', name: 'Featured 1' } as TemplateModel,
          { id: 'featured-2', name: 'Featured 2' } as TemplateModel,
        ],
        total: 2,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockApi.searchTemplates.mockResolvedValue(mockResult);

      const result = await service.getFeatured(10);

      expect(mockApi.searchTemplates).toHaveBeenCalledWith({
        featured: true,
        limit: 10,
        sortBy: 'downloads',
        sortOrder: 'desc',
      });
      expect(result).toEqual(mockResult.templates);
    });
  });

  describe('getTrending', () => {
    it('should get trending templates', async () => {
      const mockResult: TemplateSearchResult = {
        templates: [{ id: 'trending-1', name: 'Trending 1' } as TemplateModel],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockApi.searchTemplates.mockResolvedValue(mockResult);

      const result = await service.getTrending(10);

      expect(mockApi.searchTemplates).toHaveBeenCalledWith({
        trending: true,
        limit: 10,
        sortBy: 'popularity',
        sortOrder: 'desc',
      });
      expect(result).toEqual(mockResult.templates);
    });
  });

  describe('getByCategory', () => {
    it('should get templates by category', async () => {
      const mockResult: TemplateSearchResult = {
        templates: [{ id: 'dev-1', category: 'development' } as TemplateModel],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      };

      mockApi.searchTemplates.mockResolvedValue(mockResult);

      const result = await service.getByCategory('development', {
        page: 1,
        limit: 20,
      });

      expect(mockApi.searchTemplates).toHaveBeenCalledWith({
        category: 'development',
        page: 1,
        limit: 20,
        sortBy: 'relevance',
        sortOrder: 'desc',
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getRecommendations', () => {
    it('should get recommendations based on preferences', async () => {
      const preferences = {
        categories: ['development' as any],
        tags: ['typescript', 'react'],
        excludeInstalled: ['installed-1'],
      };

      const mockResult1: TemplateSearchResult = {
        templates: [{ id: 'rec-1', name: 'Recommendation 1' } as TemplateModel],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      const mockResult2: TemplateSearchResult = {
        templates: [
          { id: 'rec-2', name: 'Recommendation 2' } as TemplateModel,
          { id: 'installed-1', name: 'Already Installed' } as TemplateModel,
        ],
        total: 2,
        page: 1,
        limit: 5,
        hasMore: false,
      };

      mockApi.searchTemplates
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      const result = await service.getRecommendations(preferences, 10);

      expect(mockApi.searchTemplates).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('rec-1');
      expect(result[1].id).toBe('rec-2');
      // Should exclude already installed template
      expect(result.find(t => t.id === 'installed-1')).toBeUndefined();
    });
  });

  describe('clearCache', () => {
    it('should clear search cache', async () => {
      const query: TemplateSearchQuery = { query: 'test' };
      const mockResult: TemplateSearchResult = {
        templates: [],
        total: 0,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      mockApi.searchTemplates.mockResolvedValue(mockResult);

      // First call
      await service.search(query);

      // Clear cache
      service.clearCache();

      // Second call (should not use cache)
      await service.search(query);

      // API should be called twice
      expect(mockApi.searchTemplates).toHaveBeenCalledTimes(2);
    });
  });
});

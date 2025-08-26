/**
 * @fileoverview Tests for file-based database implementation
 * @lastmodified 2025-08-23T05:30:00Z
 * 
 * Features: Tests for file-based storage with search capabilities
 * Main APIs: FileTemplateRepository, FileDatabase class
 * Constraints: File system operations, search indexing, data persistence
 * Patterns: Repository pattern testing, async testing, file system mocking
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { FileDatabase, FileTemplateRepository } from '../../../../src/marketplace/database/file-database';
import { TemplateModel, TemplateSearchQuery, AuthorModel, ReviewModel } from '../../../../src/marketplace/database/database.interface';

// Mock file system operations
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FileTemplateRepository', () => {
  let repository: FileTemplateRepository;
  let mockTemplate: TemplateModel;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    repository = new FileTemplateRepository('./test-data/templates');
    
    mockTemplate = {
      id: 'test-template-1',
      name: 'Test Template',
      slug: 'test-template',
      description: 'A test template for unit testing',
      category: 'Testing',
      tags: ['test', 'unit-test'],
      authorId: 'author-1',
      version: '1.0.0',
      downloads: 100,
      rating: 4.5,
      reviewCount: 10,
      featured: false,
      isPublic: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      files: [
        {
          path: 'template.md',
          content: '# Test Template\nThis is a test.',
          type: 'template'
        }
      ],
      config: {
        variables: [
          { name: 'title', type: 'string', required: true }
        ]
      },
      dependencies: []
    };

    // Mock successful file operations
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockTemplate));
    mockFs.access.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
  });

  describe('Template Creation', () => {
    it('should create a new template', async () => {
      const result = await repository.create(mockTemplate);

      expect(result).toEqual(mockTemplate);
      expect(mockFs.mkdir).toHaveBeenCalledWith('./test-data/templates', { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join('./test-data/templates', 'test-template-1.json'),
        JSON.stringify(mockTemplate, null, 2)
      );
    });

    it('should handle creation errors', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(repository.create(mockTemplate)).rejects.toThrow('Write failed');
    });
  });

  describe('Template Retrieval', () => {
    it('should find template by ID', async () => {
      const result = await repository.findById('test-template-1');

      expect(result).toEqual(mockTemplate);
      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join('./test-data/templates', 'test-template-1.json'),
        'utf8'
      );
    });

    it('should return null for non-existent template', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should find template by slug', async () => {
      // Mock readdir to return template files
      mockFs.readdir.mockResolvedValue(['test-template-1.json', 'other-template.json'] as any);
      
      // Mock first file read for slug match
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(mockTemplate));

      const result = await repository.findBySlug('test-template');

      expect(result).toEqual(mockTemplate);
    });

    it('should return null for non-existent slug', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const result = await repository.findBySlug('non-existent-slug');

      expect(result).toBeNull();
    });
  });

  describe('Template Updates', () => {
    beforeEach(() => {
      // Template exists
      mockFs.access.mockResolvedValue(undefined);
    });

    it('should update existing template', async () => {
      const updatedTemplate = { ...mockTemplate, name: 'Updated Template' };

      const result = await repository.update('test-template-1', updatedTemplate);

      expect(result).toEqual(updatedTemplate);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join('./test-data/templates', 'test-template-1.json'),
        JSON.stringify(updatedTemplate, null, 2)
      );
    });

    it('should return null for non-existent template', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await repository.update('non-existent', mockTemplate);

      expect(result).toBeNull();
    });
  });

  describe('Template Deletion', () => {
    it('should delete existing template', async () => {
      mockFs.access.mockResolvedValue(undefined);

      const result = await repository.delete('test-template-1');

      expect(result).toBe(true);
      expect(mockFs.unlink).toHaveBeenCalledWith(
        path.join('./test-data/templates', 'test-template-1.json')
      );
    });

    it('should return false for non-existent template', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('Search Functionality', () => {
    const mockTemplates = [
      {
        ...mockTemplate,
        id: 'template-1',
        name: 'React Component',
        category: 'React',
        tags: ['react', 'component'],
        rating: 4.5
      },
      {
        ...mockTemplate,
        id: 'template-2',
        name: 'Vue Component',
        category: 'Vue',
        tags: ['vue', 'component'],
        rating: 4.0
      },
      {
        ...mockTemplate,
        id: 'template-3',
        name: 'Angular Service',
        category: 'Angular',
        tags: ['angular', 'service'],
        rating: 3.5
      }
    ];

    beforeEach(() => {
      mockFs.readdir.mockResolvedValue(['template-1.json', 'template-2.json', 'template-3.json'] as any);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockTemplates[0]))
        .mockResolvedValueOnce(JSON.stringify(mockTemplates[1]))
        .mockResolvedValueOnce(JSON.stringify(mockTemplates[2]));
    });

    it('should search templates by query', async () => {
      const query: TemplateSearchQuery = {
        q: 'component',
        category: undefined,
        tags: undefined,
        minRating: undefined,
        sortBy: 'name',
        sortOrder: 'asc',
        page: 1,
        limit: 10
      };

      const result = await repository.search(query);

      expect(result.items).toHaveLength(2);
      expect(result.items.map(t => t.name)).toEqual(['React Component', 'Vue Component']);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by category', async () => {
      const query: TemplateSearchQuery = {
        q: undefined,
        category: 'React',
        tags: undefined,
        minRating: undefined,
        sortBy: 'name',
        sortOrder: 'asc',
        page: 1,
        limit: 10
      };

      const result = await repository.search(query);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('React Component');
    });

    it('should filter by tags', async () => {
      const query: TemplateSearchQuery = {
        q: undefined,
        category: undefined,
        tags: ['component'],
        minRating: undefined,
        sortBy: 'name',
        sortOrder: 'asc',
        page: 1,
        limit: 10
      };

      const result = await repository.search(query);

      expect(result.items).toHaveLength(2);
      expect(result.items.every(t => t.tags.includes('component'))).toBe(true);
    });

    it('should filter by minimum rating', async () => {
      const query: TemplateSearchQuery = {
        q: undefined,
        category: undefined,
        tags: undefined,
        minRating: 4.0,
        sortBy: 'rating',
        sortOrder: 'desc',
        page: 1,
        limit: 10
      };

      const result = await repository.search(query);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].rating).toBe(4.5);
      expect(result.items[1].rating).toBe(4.0);
    });

    it('should sort by rating descending', async () => {
      const query: TemplateSearchQuery = {
        q: undefined,
        category: undefined,
        tags: undefined,
        minRating: undefined,
        sortBy: 'rating',
        sortOrder: 'desc',
        page: 1,
        limit: 10
      };

      const result = await repository.search(query);

      expect(result.items).toHaveLength(3);
      expect(result.items[0].rating).toBe(4.5);
      expect(result.items[1].rating).toBe(4.0);
      expect(result.items[2].rating).toBe(3.5);
    });

    it('should handle pagination', async () => {
      const query: TemplateSearchQuery = {
        q: undefined,
        category: undefined,
        tags: undefined,
        minRating: undefined,
        sortBy: 'name',
        sortOrder: 'asc',
        page: 2,
        limit: 2
      };

      const result = await repository.search(query);

      expect(result.items).toHaveLength(1);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(result.total).toBe(3);
    });

    it('should return empty results for no matches', async () => {
      const query: TemplateSearchQuery = {
        q: 'nonexistent',
        category: undefined,
        tags: undefined,
        minRating: undefined,
        sortBy: 'name',
        sortOrder: 'asc',
        page: 1,
        limit: 10
      };

      const result = await repository.search(query);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('Template Listing', () => {
    const mockTemplates = [
      { ...mockTemplate, id: 'template-1', name: 'Template 1' },
      { ...mockTemplate, id: 'template-2', name: 'Template 2' },
      { ...mockTemplate, id: 'template-3', name: 'Template 3' }
    ];

    beforeEach(() => {
      mockFs.readdir.mockResolvedValue(['template-1.json', 'template-2.json', 'template-3.json'] as any);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(mockTemplates[0]))
        .mockResolvedValueOnce(JSON.stringify(mockTemplates[1]))
        .mockResolvedValueOnce(JSON.stringify(mockTemplates[2]));
    });

    it('should find templates by author ID', async () => {
      const result = await repository.findByAuthorId('author-1');

      expect(result).toHaveLength(3);
      expect(result.every(t => t.authorId === 'author-1')).toBe(true);
    });

    it('should find featured templates', async () => {
      const featuredTemplates = mockTemplates.map(t => ({ ...t, featured: true }));
      mockFs.readFile
        .mockReset()
        .mockResolvedValueOnce(JSON.stringify(featuredTemplates[0]))
        .mockResolvedValueOnce(JSON.stringify(featuredTemplates[1]))
        .mockResolvedValueOnce(JSON.stringify(featuredTemplates[2]));

      const result = await repository.findFeatured();

      expect(result).toHaveLength(3);
      expect(result.every(t => t.featured)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle directory creation errors', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(repository.create(mockTemplate)).rejects.toThrow('Permission denied');
    });

    it('should handle file read errors during search', async () => {
      mockFs.readdir.mockResolvedValue(['template-1.json'] as any);
      mockFs.readFile.mockRejectedValue(new Error('Read error'));

      const query: TemplateSearchQuery = {
        q: undefined,
        category: undefined,
        tags: undefined,
        minRating: undefined,
        sortBy: 'name',
        sortOrder: 'asc',
        page: 1,
        limit: 10
      };

      const result = await repository.search(query);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});

describe('FileDatabase', () => {
  let database: FileDatabase;

  beforeEach(() => {
    database = new FileDatabase('./test-data');
  });

  it('should provide template repository', () => {
    expect(database.templates).toBeInstanceOf(FileTemplateRepository);
  });

  it('should connect successfully', async () => {
    await expect(database.connect()).resolves.toBeUndefined();
  });

  it('should disconnect successfully', async () => {
    await expect(database.disconnect()).resolves.toBeUndefined();
  });

  it('should provide health check', async () => {
    const health = await database.health();

    expect(health.status).toBe('healthy');
    expect(health.details.type).toBe('file');
    expect(health.details.dataPath).toBe('./test-data');
  });

  describe('Transaction Support', () => {
    it('should execute transaction successfully', async () => {
      const result = await database.transaction(async (repos) => {
        expect(repos.templates).toBeInstanceOf(FileTemplateRepository);
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should handle transaction errors', async () => {
      await expect(
        database.transaction(async () => {
          throw new Error('Transaction failed');
        })
      ).rejects.toThrow('Transaction failed');
    });
  });

  describe('Migration Support', () => {
    it('should run migrations', async () => {
      const migrations = [
        {
          version: '001',
          description: 'Initial schema',
          up: jest.fn().mockResolvedValue(undefined),
          down: jest.fn().mockResolvedValue(undefined)
        }
      ];

      await database.migrate(migrations);

      expect(migrations[0].up).toHaveBeenCalled();
    });

    it('should handle migration errors', async () => {
      const migrations = [
        {
          version: '001',
          description: 'Failing migration',
          up: jest.fn().mockRejectedValue(new Error('Migration failed')),
          down: jest.fn().mockResolvedValue(undefined)
        }
      ];

      await expect(database.migrate(migrations)).rejects.toThrow('Migration failed');
    });
  });
});
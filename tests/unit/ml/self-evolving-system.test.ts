/**
 * @fileoverview Tests for self-evolving template system
 * @lastmodified 2025-08-26T13:00:00Z
 */

import { SelfEvolvingSystem, PerformanceMetric, EvolutionTrigger } from '../../../src/ml/self-evolving-system';
import { PromptOptimizationService } from '../../../src/services/prompt-optimization.service';
import { TemplateService } from '../../../src/services/template.service';
import { CacheService } from '../../../src/services/cache.service';
import { ConfigManager } from '../../../src/config/config-manager';
import { logger } from '../../../src/utils/logger';

jest.mock('../../../src/utils/logger');
jest.mock('../../../src/config/config-manager');

describe('SelfEvolvingSystem', () => {
  let system: SelfEvolvingSystem;
  let mockOptimizationService: jest.Mocked<PromptOptimizationService>;
  let mockTemplateService: jest.Mocked<TemplateService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock services
    mockOptimizationService = {
      optimizeTemplate: jest.fn(),
      batchOptimize: jest.fn(),
      getOptimizationStatus: jest.fn(),
      sendFeedback: jest.fn(),
      clearCache: jest.fn(),
      getCacheStats: jest.fn(),
    } as any;

    mockTemplateService = {
      loadTemplate: jest.fn(),
      renderTemplate: jest.fn(),
      findTemplate: jest.fn(),
      listTemplates: jest.fn(),
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      has: jest.fn(),
    } as any;

    // Mock ConfigManager
    (ConfigManager.getInstance as jest.Mock).mockReturnValue({
      get: jest.fn().mockImplementation((key: string, defaultValue: any) => {
        const config: Record<string, any> = {
          'promptwizard.evolution.minAccuracy': 0.8,
          'promptwizard.evolution.maxTokenUsage': 1000,
          'promptwizard.evolution.minSuccessRate': 0.9,
          'promptwizard.evolution.maxErrorRate': 0.1,
          'promptwizard.evolution.scheduleEnabled': false,
          'promptwizard.evolution.intervalMs': 86400000,
        };
        return config[key] ?? defaultValue;
      }),
    });

    system = new SelfEvolvingSystem(
      mockOptimizationService,
      mockTemplateService,
      mockCacheService
    );
  });

  describe('trackPerformance', () => {
    it('should track performance metrics', async () => {
      const metric: Omit<PerformanceMetric, 'templateId' | 'timestamp'> = {
        version: '1.0.0',
        metrics: {
          executionTime: 100,
          tokenUsage: 500,
          accuracy: 0.85,
          userSatisfaction: 4.5,
          errorRate: 0.05,
          successRate: 0.95,
        },
      };

      mockCacheService.get.mockResolvedValue([]);

      await system.trackPerformance('template-1', metric);

      expect(mockCacheService.get).toHaveBeenCalledWith('metrics:template-1');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'metrics:template-1',
        expect.arrayContaining([
          expect.objectContaining({
            templateId: 'template-1',
            version: '1.0.0',
            metrics: metric.metrics,
          }),
        ])
      );
    });

    it('should trigger evolution when performance degrades', async () => {
      const poorMetrics: PerformanceMetric[] = Array(20).fill(null).map(() => ({
        templateId: 'template-1',
        version: '1.0.0',
        timestamp: new Date(),
        metrics: {
          executionTime: 500,
          tokenUsage: 2000,
          accuracy: 0.6,
          userSatisfaction: 2,
          errorRate: 0.3,
          successRate: 0.7,
        },
      }));

      mockCacheService.get.mockResolvedValue(poorMetrics);
      const triggerEvolutionSpy = jest.spyOn(system, 'triggerEvolution').mockResolvedValue({
        templateId: 'template-1',
        previousVersion: '1.0.0',
        newVersion: '1.0.1',
        improvements: {
          tokenReduction: 30,
          accuracyGain: 20,
          performanceGain: 25,
        },
        evolutionTime: 1000,
        success: true,
      });

      await system.trackPerformance('template-1', {
        version: '1.0.0',
        metrics: {
          executionTime: 500,
          tokenUsage: 2000,
          accuracy: 0.6,
          userSatisfaction: 2,
          errorRate: 0.3,
          successRate: 0.7,
        },
      });

      expect(triggerEvolutionSpy).toHaveBeenCalledWith('template-1', 'threshold');
    });

    it('should limit stored metrics to 100 entries', async () => {
      const existingMetrics = Array(105).fill(null).map(() => ({
        templateId: 'template-1',
        version: '1.0.0',
        timestamp: new Date(),
        metrics: {
          executionTime: 100,
          tokenUsage: 500,
          accuracy: 0.85,
          userSatisfaction: 4.5,
          errorRate: 0.05,
          successRate: 0.95,
        },
      }));

      mockCacheService.get.mockResolvedValue(existingMetrics);

      await system.trackPerformance('template-1', {
        version: '1.0.0',
        metrics: {
          executionTime: 100,
          tokenUsage: 500,
          accuracy: 0.85,
          userSatisfaction: 4.5,
          errorRate: 0.05,
          successRate: 0.95,
        },
      });

      const setCalls = mockCacheService.set.mock.calls;
      const savedMetrics = setCalls[0][1] as PerformanceMetric[];
      expect(savedMetrics.length).toBe(100);
    });
  });

  describe('triggerEvolution', () => {
    it('should successfully trigger template evolution', async () => {
      const mockTemplate = {
        name: 'test-template',
        version: '1.0.0',
        files: [{
          path: 'test.md',
          content: 'Original content',
        }],
        variables: {},
        commands: [],
      };

      const mockOptimizationResult = {
        requestId: 'req-1',
        templateId: 'template-1',
        originalTemplate: { name: 'test-template', content: 'Original content' },
        optimizedTemplate: { name: 'test-template', content: 'Optimized content' },
        metrics: {
          tokenReduction: 30,
          accuracyImprovement: 15,
          optimizationTime: 1000,
          apiCalls: 10,
        },
        qualityScore: {
          overall: 85,
          metrics: {
            clarity: 85,
            taskAlignment: 90,
            tokenEfficiency: 80,
          },
          suggestions: [],
          confidence: 0.9,
        },
        comparison: { 
          improvements: { 
            tokenReduction: 30, 
            qualityImprovement: 15,
            costSavings: 25,
          },
        },
        timestamp: new Date(),
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockCacheService.get.mockResolvedValue([]);
      mockOptimizationService.optimizeTemplate.mockResolvedValue(mockOptimizationResult);

      const result = await system.triggerEvolution('template-1', 'manual');

      expect(result.success).toBe(true);
      expect(result.templateId).toBe('template-1');
      expect(result.improvements.tokenReduction).toBe(30);
      expect(mockOptimizationService.optimizeTemplate).toHaveBeenCalled();
    });

    it('should handle evolution failure gracefully', async () => {
      mockTemplateService.loadTemplate.mockRejectedValue(new Error('Template not found'));

      const result = await system.triggerEvolution('template-1', 'manual');

      expect(result.success).toBe(false);
      expect(result.newVersion).toBe('');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should emit events during evolution process', async () => {
      const mockTemplate = {
        name: 'test-template',
        version: '1.0.0',
        files: [{ path: 'test.md', content: 'Original content' }],
        variables: {},
        commands: [],
      };

      mockTemplateService.loadTemplate.mockResolvedValue(mockTemplate);
      mockCacheService.get.mockResolvedValue([]);
      mockOptimizationService.optimizeTemplate.mockResolvedValue({
        requestId: 'req-1',
        templateId: 'template-1',
        originalTemplate: { name: 'test-template', content: 'Original' },
        optimizedTemplate: { name: 'test-template', content: 'Optimized' },
        metrics: {
          tokenReduction: 20,
          accuracyImprovement: 10,
          optimizationTime: 500,
          apiCalls: 5,
        },
        qualityScore: {
          overall: 80,
          metrics: {
            clarity: 80,
            taskAlignment: 85,
            tokenEfficiency: 75,
          },
          suggestions: [],
          confidence: 0.85,
        },
        comparison: { 
          improvements: { 
            tokenReduction: 20, 
            qualityImprovement: 10,
            costSavings: 15,
          },
        },
        timestamp: new Date(),
      });

      const startedSpy = jest.fn();
      const completedSpy = jest.fn();
      
      system.on('evolution:started', startedSpy);
      system.on('evolution:completed', completedSpy);

      await system.triggerEvolution('template-1', 'schedule');

      expect(startedSpy).toHaveBeenCalledWith({
        templateId: 'template-1',
        triggerType: 'schedule',
      });
      expect(completedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 'template-1',
          success: true,
        })
      );
    });
  });

  describe('rollbackVersion', () => {
    it('should rollback to previous version', async () => {
      const versions = [
        {
          version: '1.0.0',
          template: { name: 'test', content: 'v1' },
          performance: [],
          createdAt: new Date('2024-01-01'),
          reason: 'Initial',
        },
        {
          version: '1.0.1',
          template: { name: 'test', content: 'v2' },
          performance: [],
          createdAt: new Date('2024-01-02'),
          reason: 'Evolution',
        },
      ];

      // Manually set version history
      (system as any).versionHistory.set('template-1', versions);

      await system.rollbackVersion('template-1');

      expect(mockCacheService.delete).toHaveBeenCalledWith('metrics:template-1');
    });

    it('should rollback to specific version', async () => {
      const versions = [
        {
          version: '1.0.0',
          template: { name: 'test', content: 'v1' },
          performance: [],
          createdAt: new Date('2024-01-01'),
          reason: 'Initial',
        },
        {
          version: '1.0.1',
          template: { name: 'test', content: 'v2' },
          performance: [],
          createdAt: new Date('2024-01-02'),
          reason: 'Evolution 1',
        },
        {
          version: '1.0.2',
          template: { name: 'test', content: 'v3' },
          performance: [],
          createdAt: new Date('2024-01-03'),
          reason: 'Evolution 2',
        },
      ];

      (system as any).versionHistory.set('template-1', versions);

      await system.rollbackVersion('template-1', '1.0.0');

      expect(mockCacheService.delete).toHaveBeenCalledWith('metrics:template-1');
    });

    it('should throw error when no version history exists', async () => {
      await expect(system.rollbackVersion('template-1')).rejects.toThrow(
        'No version history for template: template-1'
      );
    });

    it('should throw error when target version not found', async () => {
      const versions = [
        {
          version: '1.0.0',
          template: { name: 'test', content: 'v1' },
          performance: [],
          createdAt: new Date('2024-01-01'),
          reason: 'Initial',
        },
      ];

      (system as any).versionHistory.set('template-1', versions);

      await expect(system.rollbackVersion('template-1', '2.0.0')).rejects.toThrow(
        'Version 2.0.0 not found for template: template-1'
      );
    });
  });

  describe('getVersionHistory', () => {
    it('should return version history for template', () => {
      const versions = [
        {
          version: '1.0.0',
          template: { name: 'test', content: 'v1' },
          performance: [],
          createdAt: new Date('2024-01-01'),
          reason: 'Initial',
        },
      ];

      (system as any).versionHistory.set('template-1', versions);

      const history = system.getVersionHistory('template-1');
      expect(history).toEqual(versions);
    });

    it('should return empty array when no history exists', () => {
      const history = system.getVersionHistory('template-1');
      expect(history).toEqual([]);
    });
  });

  describe('addEvolutionTrigger', () => {
    it('should add evolution trigger for template', () => {
      const trigger: EvolutionTrigger = {
        type: 'threshold',
        condition: {
          metric: 'accuracy',
          threshold: 0.7,
        },
      };

      system.addEvolutionTrigger('template-1', trigger);

      const triggers = (system as any).evolutionTriggers.get('template-1');
      expect(triggers).toContain(trigger);
    });

    it('should add multiple triggers for same template', () => {
      const trigger1: EvolutionTrigger = {
        type: 'threshold',
        condition: { metric: 'accuracy', threshold: 0.7 },
      };
      const trigger2: EvolutionTrigger = {
        type: 'schedule',
        condition: { schedule: '0 0 * * *' },
      };

      system.addEvolutionTrigger('template-1', trigger1);
      system.addEvolutionTrigger('template-1', trigger2);

      const triggers = (system as any).evolutionTriggers.get('template-1');
      expect(triggers).toHaveLength(2);
      expect(triggers).toContain(trigger1);
      expect(triggers).toContain(trigger2);
    });
  });

  describe('removeEvolutionTriggers', () => {
    it('should remove all triggers for template', () => {
      const trigger: EvolutionTrigger = {
        type: 'threshold',
        condition: { metric: 'accuracy', threshold: 0.7 },
      };

      system.addEvolutionTrigger('template-1', trigger);
      system.removeEvolutionTriggers('template-1');

      const triggers = (system as any).evolutionTriggers.get('template-1');
      expect(triggers).toBeUndefined();
    });
  });

  describe('EventEmitter inheritance', () => {
    it('should emit and handle events', (done) => {
      system.on('test-event', (data) => {
        expect(data.message).toBe('test');
        done();
      });

      system.emit('test-event', { message: 'test' });
    });
  });
});
/**
 * @fileoverview Self-evolving template system with continuous learning capabilities
 * @lastmodified 2025-08-26T12:00:00Z
 *
 * Features: Performance tracking, automatic re-optimization, version management
 * Main APIs: trackPerformance(), triggerEvolution(), rollbackVersion()
 * Constraints: Requires PromptWizard service, Redis for metrics storage
 * Patterns: Observer pattern, event-driven architecture, continuous feedback loop
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { PromptOptimizationService } from '../services/prompt-optimization.service';
import { TemplateService, Template } from '../services/template.service';
import { CacheService } from '../services/cache.service';
import { ConfigManager } from '../config/config-manager';

export interface PerformanceMetric {
  templateId: string;
  version: string;
  timestamp: Date;
  metrics: {
    executionTime: number;
    tokenUsage: number;
    accuracy?: number;
    userSatisfaction?: number;
    errorRate: number;
    successRate: number;
  };
  feedback?: {
    rating: number;
    comments?: string;
  };
}

export interface EvolutionTrigger {
  type: 'threshold' | 'schedule' | 'manual' | 'feedback';
  condition: {
    metric?: string;
    threshold?: number;
    schedule?: string;
    feedbackThreshold?: number;
  };
}

export interface EvolutionResult {
  templateId: string;
  previousVersion: string;
  newVersion: string;
  improvements: {
    tokenReduction: number;
    accuracyGain: number;
    performanceGain: number;
  };
  evolutionTime: number;
  success: boolean;
}

export interface TemplateVersion {
  version: string;
  template: Template;
  performance: PerformanceMetric[];
  createdAt: Date;
  reason: string;
}

export class SelfEvolvingSystem extends EventEmitter {
  private optimizationService: PromptOptimizationService;

  private templateService: TemplateService;

  private metricsCache: CacheService<PerformanceMetric[]>;

  private versionHistory: Map<string, TemplateVersion[]>;

  private evolutionTriggers: Map<string, EvolutionTrigger[]>;

  private performanceThresholds: {
    minAccuracy: number;
    maxTokenUsage: number;
    minSuccessRate: number;
    maxErrorRate: number;
  };

  constructor(
    optimizationService: PromptOptimizationService,
    templateService: TemplateService,
    cacheService: CacheService
  ) {
    super();
    this.optimizationService = optimizationService;
    this.templateService = templateService;
    this.metricsCache = cacheService;
    this.versionHistory = new Map();
    this.evolutionTriggers = new Map();

    const config = ConfigManager.getInstance();
    this.performanceThresholds = {
      minAccuracy: config.get('promptwizard.evolution.minAccuracy', 0.8),
      maxTokenUsage: config.get('promptwizard.evolution.maxTokenUsage', 1000),
      minSuccessRate: config.get('promptwizard.evolution.minSuccessRate', 0.9),
      maxErrorRate: config.get('promptwizard.evolution.maxErrorRate', 0.1),
    };

    this.initializeScheduledEvolutions();
  }

  /**
   * Track template performance metrics
   */
  async trackPerformance(
    templateId: string,
    metric: Omit<PerformanceMetric, 'templateId' | 'timestamp'>
  ): Promise<void> {
    const performanceMetric: PerformanceMetric = {
      templateId,
      timestamp: new Date(),
      ...metric,
    };

    logger.info(`Tracking performance for template: ${templateId}`);

    const cacheKey = `metrics:${templateId}`;
    const existingMetrics = await this.metricsCache.get(cacheKey) || [];
    existingMetrics.push(performanceMetric);

    const maxMetrics = 100;
    if (existingMetrics.length > maxMetrics) {
      existingMetrics.splice(0, existingMetrics.length - maxMetrics);
    }

    await this.metricsCache.set(cacheKey, existingMetrics);

    await this.evaluatePerformance(templateId, existingMetrics);

    this.emit('performance:tracked', performanceMetric);
  }

  /**
   * Evaluate template performance and trigger evolution if needed
   */
  private async evaluatePerformance(
    templateId: string,
    metrics: PerformanceMetric[]
  ): Promise<void> {
    if (metrics.length < 10) {
      return;
    }

    const recentMetrics = metrics.slice(-20);
    const avgMetrics = this.calculateAverageMetrics(recentMetrics);

    const needsEvolution = 
      avgMetrics.accuracy < this.performanceThresholds.minAccuracy ||
      avgMetrics.tokenUsage > this.performanceThresholds.maxTokenUsage ||
      avgMetrics.successRate < this.performanceThresholds.minSuccessRate ||
      avgMetrics.errorRate > this.performanceThresholds.maxErrorRate;

    if (needsEvolution) {
      logger.info(
        `Template ${templateId} needs evolution based on performance`
      );
      await this.triggerEvolution(templateId, 'threshold');
    }
  }

  /**
   * Calculate average metrics from performance data
   */
  private calculateAverageMetrics(metrics: PerformanceMetric[]): {
    accuracy: number;
    tokenUsage: number;
    successRate: number;
    errorRate: number;
    executionTime: number;
  } {
    const sum = metrics.reduce(
      (acc, m) => ({
        accuracy: acc.accuracy + (m.metrics.accuracy || 0),
        tokenUsage: acc.tokenUsage + m.metrics.tokenUsage,
        successRate: acc.successRate + m.metrics.successRate,
        errorRate: acc.errorRate + m.metrics.errorRate,
        executionTime: acc.executionTime + m.metrics.executionTime,
      }),
      { accuracy: 0, tokenUsage: 0, successRate: 0, errorRate: 0, executionTime: 0 }
    );

    const count = metrics.length;
    return {
      accuracy: sum.accuracy / count,
      tokenUsage: sum.tokenUsage / count,
      successRate: sum.successRate / count,
      errorRate: sum.errorRate / count,
      executionTime: sum.executionTime / count,
    };
  }

  /**
   * Trigger template evolution
   */
  async triggerEvolution(
    templateId: string,
    triggerType: EvolutionTrigger['type']
  ): Promise<EvolutionResult> {
    logger.info(`Triggering evolution for template: ${templateId} (${triggerType})`);
    this.emit('evolution:started', { templateId, triggerType });

    const startTime = Date.now();

    try {
      const template = await this.templateService.loadTemplate(templateId);
      
      const currentVersion = this.getCurrentVersion(templateId);
      const newVersion = this.generateVersion();

      const metrics = await this.metricsCache.get(`metrics:${templateId}`) || [];
      const examples = this.generateExamplesFromMetrics(metrics);

      const optimizationResult = await this.optimizationService.optimizeTemplate({
        templateId,
        template,
        config: {
          mutateRefineIterations: 5,
          fewShotCount: examples.length,
          generateReasoning: true,
          examples,
        },
        options: {
          skipCache: true,
          priority: 'high',
        },
      });

      this.saveVersion(templateId, {
        version: newVersion,
        template: optimizationResult.optimizedTemplate,
        performance: [],
        createdAt: new Date(),
        reason: `Evolution triggered by ${triggerType}`,
      });

      const evolutionResult: EvolutionResult = {
        templateId,
        previousVersion: currentVersion,
        newVersion,
        improvements: {
          tokenReduction: optimizationResult.metrics.tokenReduction,
          accuracyGain: optimizationResult.metrics.accuracyImprovement,
          performanceGain: this.calculatePerformanceGain(metrics),
        },
        evolutionTime: Date.now() - startTime,
        success: true,
      };

      logger.info(`Evolution completed for template: ${templateId}`);
      this.emit('evolution:completed', evolutionResult);

      return evolutionResult;
    } catch (error) {
      logger.error(`Evolution failed for template: ${templateId}`, error);
      this.emit('evolution:failed', { templateId, error });

      return {
        templateId,
        previousVersion: this.getCurrentVersion(templateId),
        newVersion: '',
        improvements: {
          tokenReduction: 0,
          accuracyGain: 0,
          performanceGain: 0,
        },
        evolutionTime: Date.now() - startTime,
        success: false,
      };
    }
  }

  /**
   * Generate examples from performance metrics
   */
  private generateExamplesFromMetrics(metrics: PerformanceMetric[]): string[] {
    const successfulExecutions = metrics
      .filter(m => m.metrics.successRate > 0.8)
      .slice(-10);

    return successfulExecutions.map(m => {
      return `Version: ${m.version}, Tokens: ${m.metrics.tokenUsage}, Success: ${m.metrics.successRate}`;
    });
  }

  /**
   * Calculate performance gain from metrics
   */
  private calculatePerformanceGain(metrics: PerformanceMetric[]): number {
    if (metrics.length < 2) return 0;

    const oldMetrics = metrics.slice(0, Math.floor(metrics.length / 2));
    const newMetrics = metrics.slice(Math.floor(metrics.length / 2));

    const oldAvg = this.calculateAverageMetrics(oldMetrics);
    const newAvg = this.calculateAverageMetrics(newMetrics);

    const executionTimeGain = (oldAvg.executionTime - newAvg.executionTime) / oldAvg.executionTime;
    const tokenGain = (oldAvg.tokenUsage - newAvg.tokenUsage) / oldAvg.tokenUsage;
    const accuracyGain = (newAvg.accuracy - oldAvg.accuracy) / oldAvg.accuracy;

    return (executionTimeGain + tokenGain + accuracyGain) / 3;
  }

  /**
   * Rollback template to a previous version
   */
  async rollbackVersion(
    templateId: string,
    targetVersion?: string
  ): Promise<void> {
    const versions = this.versionHistory.get(templateId);
    if (!versions || versions.length === 0) {
      throw new Error(`No version history for template: ${templateId}`);
    }

    let targetVersionObj: TemplateVersion | undefined;

    if (targetVersion) {
      targetVersionObj = versions.find(v => v.version === targetVersion);
    } else {
      targetVersionObj = versions[versions.length - 2];
    }

    if (!targetVersionObj) {
      throw new Error(`Version ${targetVersion} not found for template: ${templateId}`);
    }

    logger.info(`Rolling back template ${templateId} to version ${targetVersionObj.version}`);

    await this.metricsCache.delete(`metrics:${templateId}`);

    this.emit('version:rollback', {
      templateId,
      fromVersion: this.getCurrentVersion(templateId),
      toVersion: targetVersionObj.version,
    });
  }

  /**
   * Get version history for a template
   */
  getVersionHistory(templateId: string): TemplateVersion[] {
    return this.versionHistory.get(templateId) || [];
  }

  /**
   * Get current version of a template
   */
  private getCurrentVersion(templateId: string): string {
    const versions = this.versionHistory.get(templateId);
    if (!versions || versions.length === 0) {
      return '1.0.0';
    }
    return versions[versions.length - 1].version;
  }

  /**
   * Generate a new version number
   */
  private generateVersion(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7);
    return `${timestamp}-${random}`;
  }

  /**
   * Save a template version
   */
  private saveVersion(templateId: string, version: TemplateVersion): void {
    if (!this.versionHistory.has(templateId)) {
      this.versionHistory.set(templateId, []);
    }

    const versions = this.versionHistory.get(templateId)!;
    versions.push(version);

    const maxVersions = 10;
    if (versions.length > maxVersions) {
      versions.shift();
    }
  }

  /**
   * Initialize scheduled evolutions
   */
  private initializeScheduledEvolutions(): void {
    const config = ConfigManager.getInstance();
    const scheduleEnabled = config.get('promptwizard.evolution.scheduleEnabled', false);

    if (scheduleEnabled) {
      const intervalMs = config.get('promptwizard.evolution.intervalMs', 86400000);
      
      setInterval(async () => {
        logger.info('Running scheduled evolution check');
        
        for (const [templateId] of this.versionHistory) {
          const metrics = await this.metricsCache.get(`metrics:${templateId}`) || [];
          if (metrics.length > 50) {
            await this.triggerEvolution(templateId, 'schedule');
          }
        }
      }, intervalMs);
    }
  }

  /**
   * Add evolution trigger for a template
   */
  addEvolutionTrigger(templateId: string, trigger: EvolutionTrigger): void {
    if (!this.evolutionTriggers.has(templateId)) {
      this.evolutionTriggers.set(templateId, []);
    }
    
    this.evolutionTriggers.get(templateId)!.push(trigger);
    logger.info(`Added evolution trigger for template: ${templateId}`);
  }

  /**
   * Remove evolution triggers for a template
   */
  removeEvolutionTriggers(templateId: string): void {
    this.evolutionTriggers.delete(templateId);
    logger.info(`Removed evolution triggers for template: ${templateId}`);
  }
}
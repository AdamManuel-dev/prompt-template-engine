/**
 * @fileoverview Optimization analytics tracking system for PromptWizard integration
 * @lastmodified 2025-08-26T16:00:00Z
 *
 * Features: Track optimization usage, measure success rates, monitor API usage, generate reports
 * Main APIs: trackOptimization(), generateReport(), getMetrics(), exportAnalytics()
 * Constraints: Configurable storage backends, privacy-compliant data collection
 * Patterns: Observer pattern for tracking, aggregation pattern for metrics, strategy pattern for storage
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ConfigManager } from '../config/config-manager';
import {
  OptimizationRequest,
  OptimizationResponse,
  OptimizationMetrics,
} from '../integrations/promptwizard/types';

export interface OptimizationEvent {
  id: string;
  timestamp: Date;
  type:
    | 'optimization_started'
    | 'optimization_completed'
    | 'optimization_failed'
    | 'optimization_cached';
  userId?: string;
  sessionId: string;
  request: Partial<OptimizationRequest>;
  response?: Partial<OptimizationResponse>;
  metrics?: OptimizationMetrics;
  duration?: number;
  error?: string;
  metadata?: {
    source?: 'cli' | 'api' | 'auto-optimize' | 'websocket';
    version?: string;
    clientType?: string;
    [key: string]: any;
  };
}

export interface UsageMetrics {
  totalOptimizations: number;
  successfulOptimizations: number;
  failedOptimizations: number;
  cachedOptimizations: number;
  averageProcessingTime: number;
  totalTokensSaved: number;
  totalCostSaved: number;
  averageConfidenceScore: number;
  mostUsedModels: { model: string; count: number }[];
  optimizationsByTimeRange: { [timeRange: string]: number };
  errorTypes: { [errorType: string]: number };
}

export interface UserAnalytics {
  userId: string;
  totalOptimizations: number;
  successRate: number;
  averageConfidence: number;
  favoriteModels: string[];
  lastActivity: Date;
  totalTokensSaved: number;
  totalCostSaved: number;
}

export interface SystemAnalytics {
  uptime: number;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  activeUsers: number;
  peakConcurrency: number;
  resourceUsage: {
    memory: number;
    cpu: number;
  };
}

export interface AnalyticsReport {
  generated: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  usage: UsageMetrics;
  users: UserAnalytics[];
  system: SystemAnalytics;
  trends: {
    optimizationsOverTime: { date: string; count: number }[];
    successRateOverTime: { date: string; rate: number }[];
    popularModels: { model: string; count: number; percentage: number }[];
  };
  recommendations: string[];
}

export interface AnalyticsConfig {
  enabled: boolean;
  backend: 'memory' | 'redis' | 'file';
  retentionDays: number;
  aggregationInterval: number;
  exportInterval: number;
  reportInterval: number;
  filePath?: string;
  redisUrl?: string;
  anonymizeData: boolean;
  includeUserIds: boolean;
}

/**
 * Storage backend interface
 */
interface AnalyticsStorage {
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  storeEvent(event: OptimizationEvent): Promise<void>;
  getEvents(filters?: any): Promise<OptimizationEvent[]>;
  aggregateMetrics(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<UsageMetrics>;
  purgeOldData(retentionDays: number): Promise<void>;
}

/**
 * Memory storage backend
 */
class MemoryStorage implements AnalyticsStorage {
  private events: OptimizationEvent[] = [];

  async initialize(): Promise<void> {
    this.events = [];
  }

  async cleanup(): Promise<void> {
    this.events = [];
  }

  async storeEvent(event: OptimizationEvent): Promise<void> {
    this.events.push({ ...event });
  }

  async getEvents(filters?: any): Promise<OptimizationEvent[]> {
    let filtered = [...this.events];

    if (filters) {
      if (filters.start && filters.end) {
        filtered = filtered.filter(
          e => e.timestamp >= filters.start && e.timestamp <= filters.end
        );
      }
      if (filters.type) {
        filtered = filtered.filter(e => e.type === filters.type);
      }
      if (filters.userId) {
        filtered = filtered.filter(e => e.userId === filters.userId);
      }
    }

    return filtered;
  }

  async aggregateMetrics(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<UsageMetrics> {
    const events = await this.getEvents(timeRange);
    return this.calculateMetrics(events);
  }

  async purgeOldData(retentionDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.events = this.events.filter(e => e.timestamp >= cutoffDate);
  }

  private calculateMetrics(events: OptimizationEvent[]): UsageMetrics {
    const totalOptimizations = events.length;
    const successfulOptimizations = events.filter(
      e => e.type === 'optimization_completed'
    ).length;
    const failedOptimizations = events.filter(
      e => e.type === 'optimization_failed'
    ).length;
    const cachedOptimizations = events.filter(
      e => e.type === 'optimization_cached'
    ).length;

    const durations = events
      .filter(e => e.duration && e.duration > 0)
      .map(e => e.duration!);
    const averageProcessingTime =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

    const metrics = events.filter(e => e.metrics).map(e => e.metrics!);

    const totalTokensSaved = metrics.reduce(
      (sum, m) => sum + (m.tokenReduction || 0),
      0
    );
    const totalCostSaved = metrics.reduce(
      (sum, m) => sum + (m.costReduction || 0),
      0
    );

    const confidenceScores = events
      .filter(e => e.response?.confidence)
      .map(e => e.response!.confidence!);
    const averageConfidenceScore =
      confidenceScores.length > 0
        ? confidenceScores.reduce((sum, c) => sum + c, 0) /
          confidenceScores.length
        : 0;

    // Model usage
    const modelCounts: { [model: string]: number } = {};
    events.forEach(e => {
      if (e.request.targetModel) {
        modelCounts[e.request.targetModel] =
          (modelCounts[e.request.targetModel] || 0) + 1;
      }
    });

    const mostUsedModels = Object.entries(modelCounts)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Time-based aggregation
    const optimizationsByTimeRange: { [timeRange: string]: number } = {};
    events.forEach(e => {
      const hour = new Date(e.timestamp).getHours();
      const timeRange = `${hour}:00-${hour + 1}:00`;
      optimizationsByTimeRange[timeRange] =
        (optimizationsByTimeRange[timeRange] || 0) + 1;
    });

    // Error types
    const errorTypes: { [errorType: string]: number } = {};
    events
      .filter(e => e.type === 'optimization_failed' && e.error)
      .forEach(e => {
        const errorType = this.categorizeError(e.error!);
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      });

    return {
      totalOptimizations,
      successfulOptimizations,
      failedOptimizations,
      cachedOptimizations,
      averageProcessingTime,
      totalTokensSaved,
      totalCostSaved,
      averageConfidenceScore,
      mostUsedModels,
      optimizationsByTimeRange,
      errorTypes,
    };
  }

  private categorizeError(error: string): string {
    if (error.includes('timeout')) return 'timeout';
    if (error.includes('rate limit')) return 'rate_limit';
    if (error.includes('authentication')) return 'authentication';
    if (error.includes('quota')) return 'quota_exceeded';
    if (error.includes('network')) return 'network';
    return 'unknown';
  }
}

/**
 * File storage backend
 */
class FileStorage implements AnalyticsStorage {
  private filePath: string;

  private events: OptimizationEvent[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Load existing events
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const lines = data
          .trim()
          .split('\n')
          .filter(line => line.trim());

        this.events = lines.map(line => {
          const event = JSON.parse(line);
          event.timestamp = new Date(event.timestamp);
          return event;
        });
      }
    } catch (error) {
      logger.error('Failed to initialize file storage', error as Error);
    }
  }

  async cleanup(): Promise<void> {
    // Save any pending events
    await this.flush();
  }

  async storeEvent(event: OptimizationEvent): Promise<void> {
    this.events.push({ ...event });

    // Append to file
    const line = `${JSON.stringify(event)}\n`;
    fs.appendFileSync(this.filePath, line, 'utf-8');
  }

  async getEvents(filters?: any): Promise<OptimizationEvent[]> {
    let filtered = [...this.events];

    if (filters) {
      if (filters.start && filters.end) {
        filtered = filtered.filter(
          e => e.timestamp >= filters.start && e.timestamp <= filters.end
        );
      }
      if (filters.type) {
        filtered = filtered.filter(e => e.type === filters.type);
      }
      if (filters.userId) {
        filtered = filtered.filter(e => e.userId === filters.userId);
      }
    }

    return filtered;
  }

  async aggregateMetrics(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<UsageMetrics> {
    const events = await this.getEvents(timeRange);
    const memoryStorage = new MemoryStorage();
    return (memoryStorage as any).calculateMetrics(events);
  }

  async purgeOldData(retentionDays: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.events = this.events.filter(e => e.timestamp >= cutoffDate);

    // Rewrite file
    await this.flush();
  }

  private async flush(): Promise<void> {
    const content = `${this.events.map(event => JSON.stringify(event)).join('\n')}\n`;
    fs.writeFileSync(this.filePath, content, 'utf-8');
  }
}

/**
 * Main analytics tracking system
 */
export class OptimizationTracker extends EventEmitter {
  private config: AnalyticsConfig;

  private storage: AnalyticsStorage;

  private isInitialized: boolean = false;

  private sessionId: string;

  private reportTimer: ReturnType<typeof setTimeout> | null = null;

  private purgeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.config = this.loadConfig();
    this.storage = this.createStorage();
  }

  /**
   * Load configuration
   */
  private loadConfig(): AnalyticsConfig {
    const configManager = ConfigManager.getInstance();

    return {
      enabled: configManager.get<boolean>(
        'promptwizard.analytics.enabled',
        true
      ),
      backend: configManager.get<'memory' | 'redis' | 'file'>(
        'promptwizard.analytics.backend',
        'memory'
      ),
      retentionDays: configManager.get<number>(
        'promptwizard.analytics.retentionDays',
        30
      ),
      aggregationInterval: configManager.get<number>(
        'promptwizard.analytics.aggregationInterval',
        3600
      ), // 1 hour
      exportInterval: configManager.get<number>(
        'promptwizard.analytics.exportInterval',
        86400
      ), // 1 day
      reportInterval: configManager.get<number>(
        'promptwizard.analytics.reportInterval',
        3600
      ), // 1 hour
      filePath: configManager.get<string>(
        'promptwizard.analytics.filePath',
        './data/analytics/optimization-events.log'
      ),
      redisUrl: configManager.get<string>(
        'promptwizard.analytics.redisUrl',
        'redis://localhost:6379'
      ),
      anonymizeData: configManager.get<boolean>(
        'promptwizard.analytics.anonymizeData',
        true
      ),
      includeUserIds: configManager.get<boolean>(
        'promptwizard.analytics.includeUserIds',
        false
      ),
    };
  }

  /**
   * Create storage backend
   */
  private createStorage(): AnalyticsStorage {
    switch (this.config.backend) {
      case 'file':
        return new FileStorage(this.config.filePath!);
      case 'redis':
        // TODO: Implement Redis storage
        logger.warn(
          'Redis storage not yet implemented, falling back to memory'
        );
        return new MemoryStorage();
      case 'memory':
      default:
        return new MemoryStorage();
    }
  }

  /**
   * Initialize the tracker
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Analytics tracking disabled');
      return;
    }

    try {
      await this.storage.initialize();

      // Start periodic tasks
      this.startPeriodicTasks();

      this.isInitialized = true;
      logger.info('Optimization tracker initialized', {
        backend: this.config.backend,
        sessionId: this.sessionId,
      });

      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize optimization tracker', error as Error);
      throw error;
    }
  }

  /**
   * Cleanup the tracker
   */
  async cleanup(): Promise<void> {
    this.stopPeriodicTasks();

    if (this.storage) {
      await this.storage.cleanup();
    }

    this.isInitialized = false;
    logger.info('Optimization tracker cleaned up');

    this.emit('cleanup');
  }

  /**
   * Track optimization start
   */
  trackOptimizationStart(
    request: OptimizationRequest,
    userId?: string,
    metadata?: any
  ): string {
    if (!this.config.enabled || !this.isInitialized) return '';

    const eventId = `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const event: OptimizationEvent = {
      id: eventId,
      timestamp: new Date(),
      type: 'optimization_started',
      userId: this.config.includeUserIds ? userId : undefined,
      sessionId: this.sessionId,
      request: this.sanitizeRequest(request),
      metadata: {
        source: 'cli',
        version: process.env.npm_package_version,
        ...metadata,
      },
    };

    this.storeEvent(event);
    return eventId;
  }

  /**
   * Track optimization completion
   */
  trackOptimizationComplete(
    eventId: string,
    request: OptimizationRequest,
    response: OptimizationResponse,
    duration: number,
    userId?: string
  ): void {
    if (!this.config.enabled || !this.isInitialized) return;

    const event: OptimizationEvent = {
      id: eventId,
      timestamp: new Date(),
      type: 'optimization_completed',
      userId: this.config.includeUserIds ? userId : undefined,
      sessionId: this.sessionId,
      request: this.sanitizeRequest(request),
      response: this.sanitizeResponse(response),
      metrics: response.metrics,
      duration,
    };

    this.storeEvent(event);
    this.emit('optimizationComplete', event);
  }

  /**
   * Track optimization failure
   */
  trackOptimizationFailure(
    eventId: string,
    request: OptimizationRequest,
    error: Error,
    duration: number,
    userId?: string
  ): void {
    if (!this.config.enabled || !this.isInitialized) return;

    const event: OptimizationEvent = {
      id: eventId,
      timestamp: new Date(),
      type: 'optimization_failed',
      userId: this.config.includeUserIds ? userId : undefined,
      sessionId: this.sessionId,
      request: this.sanitizeRequest(request),
      error: error.message,
      duration,
    };

    this.storeEvent(event);
    this.emit('optimizationFailed', event);
  }

  /**
   * Track cached optimization result
   */
  trackOptimizationCached(
    eventId: string,
    request: OptimizationRequest,
    response: OptimizationResponse,
    userId?: string
  ): void {
    if (!this.config.enabled || !this.isInitialized) return;

    const event: OptimizationEvent = {
      id: eventId,
      timestamp: new Date(),
      type: 'optimization_cached',
      userId: this.config.includeUserIds ? userId : undefined,
      sessionId: this.sessionId,
      request: this.sanitizeRequest(request),
      response: this.sanitizeResponse(response),
      metrics: response.metrics,
      duration: 0, // Cached requests are instantaneous
    };

    this.storeEvent(event);
    this.emit('optimizationCached', event);
  }

  /**
   * Get usage metrics
   */
  async getMetrics(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<UsageMetrics> {
    if (!this.isInitialized) {
      throw new Error('Tracker not initialized');
    }

    return this.storage.aggregateMetrics(timeRange);
  }

  /**
   * Generate analytics report
   */
  async generateReport(timeRange?: {
    start: Date;
    end: Date;
  }): Promise<AnalyticsReport> {
    if (!this.isInitialized) {
      throw new Error('Tracker not initialized');
    }

    const defaultTimeRange = {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      end: new Date(),
    };

    const reportTimeRange = timeRange || defaultTimeRange;
    const usage = await this.getMetrics(reportTimeRange);
    const events = await this.storage.getEvents(reportTimeRange);

    // Generate user analytics
    const userMap = new Map<string, any>();
    events.forEach(event => {
      if (!event.userId) return;

      if (!userMap.has(event.userId)) {
        userMap.set(event.userId, {
          userId: event.userId,
          totalOptimizations: 0,
          successful: 0,
          totalTokensSaved: 0,
          totalCostSaved: 0,
          confidenceScores: [],
          models: [],
          lastActivity: event.timestamp,
        });
      }

      const userData = userMap.get(event.userId);
      userData.totalOptimizations += 1;

      if (event.type === 'optimization_completed') {
        userData.successful += 1;
        if (event.metrics) {
          userData.totalTokensSaved += event.metrics.tokenReduction || 0;
          userData.totalCostSaved += event.metrics.costReduction || 0;
        }
        if (event.response?.confidence) {
          userData.confidenceScores.push(event.response.confidence);
        }
      }

      if (event.request.targetModel) {
        userData.models.push(event.request.targetModel);
      }

      if (event.timestamp > userData.lastActivity) {
        userData.lastActivity = event.timestamp;
      }
    });

    const users: UserAnalytics[] = Array.from(userMap.values()).map(
      userData => ({
        userId: userData.userId,
        totalOptimizations: userData.totalOptimizations,
        successRate: userData.successful / userData.totalOptimizations,
        averageConfidence:
          userData.confidenceScores.length > 0
            ? userData.confidenceScores.reduce(
                (sum: number, c: number) => sum + c,
                0
              ) / userData.confidenceScores.length
            : 0,
        favoriteModels: this.getMostFrequent(userData.models),
        lastActivity: userData.lastActivity,
        totalTokensSaved: userData.totalTokensSaved,
        totalCostSaved: userData.totalCostSaved,
      })
    );

    // Generate system analytics
    const system: SystemAnalytics = {
      uptime: process.uptime(),
      totalRequests: usage.totalOptimizations,
      averageResponseTime: usage.averageProcessingTime,
      errorRate: usage.failedOptimizations / usage.totalOptimizations,
      cacheHitRate: usage.cachedOptimizations / usage.totalOptimizations,
      activeUsers: new Set(events.map(e => e.userId).filter(Boolean)).size,
      peakConcurrency: 0, // TODO: Implement
      resourceUsage: {
        memory: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        cpu: 0, // TODO: Implement CPU usage tracking
      },
    };

    // Generate trends
    const trends = {
      optimizationsOverTime: this.generateTimeSeries(events, reportTimeRange),
      successRateOverTime: this.generateSuccessRateSeries(
        events,
        reportTimeRange
      ),
      popularModels: usage.mostUsedModels.map(m => ({
        model: m.model,
        count: m.count,
        percentage: (m.count / usage.totalOptimizations) * 100,
      })),
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations(usage, system);

    const report: AnalyticsReport = {
      generated: new Date(),
      timeRange: reportTimeRange,
      usage,
      users,
      system,
      trends,
      recommendations,
    };

    this.emit('reportGenerated', report);
    return report;
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    filePath?: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const events = await this.storage.getEvents();
    const metrics = await this.getMetrics();

    const data = {
      metadata: {
        exported: new Date().toISOString(),
        totalEvents: events.length,
        sessionId: this.sessionId,
      },
      metrics,
      events: events.map(e => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
    };

    const defaultFilePath = path.join(
      process.cwd(),
      `optimization-analytics-${Date.now()}.${format}`
    );
    const outputPath = filePath || defaultFilePath;

    if (format === 'json') {
      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    } else if (format === 'csv') {
      // TODO: Implement CSV export
      throw new Error('CSV export not yet implemented');
    }

    logger.info('Analytics exported', {
      path: outputPath,
      format,
      events: events.length,
    });
    return outputPath;
  }

  /**
   * Start periodic tasks
   */
  private startPeriodicTasks(): void {
    // Periodic reporting
    if (this.config.reportInterval > 0) {
      this.reportTimer = setInterval(async () => {
        try {
          const report = await this.generateReport();
          this.emit('periodicReport', report);
        } catch (error) {
          logger.error('Failed to generate periodic report', error as Error);
        }
      }, this.config.reportInterval * 1000);
    }

    // Periodic data purging
    if (this.config.retentionDays > 0) {
      this.purgeTimer = setInterval(
        async () => {
          try {
            await this.storage.purgeOldData(this.config.retentionDays);
            logger.info('Old analytics data purged', {
              retentionDays: this.config.retentionDays,
            });
          } catch (error) {
            logger.error('Failed to purge old data', error as Error);
          }
        },
        24 * 60 * 60 * 1000
      ); // Daily
    }
  }

  /**
   * Stop periodic tasks
   */
  private stopPeriodicTasks(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }

    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
      this.purgeTimer = null;
    }
  }

  /**
   * Store event in storage backend
   */
  private async storeEvent(event: OptimizationEvent): Promise<void> {
    try {
      await this.storage.storeEvent(event);
    } catch (error) {
      logger.error('Failed to store analytics event', error as Error);
    }
  }

  /**
   * Sanitize request for privacy
   */
  private sanitizeRequest(
    request: OptimizationRequest
  ): Partial<OptimizationRequest> {
    const sanitized: Partial<OptimizationRequest> = {
      targetModel: request.targetModel,
      mutateRefineIterations: request.mutateRefineIterations,
      fewShotCount: request.fewShotCount,
      generateReasoning: request.generateReasoning,
    };

    if (!this.config.anonymizeData) {
      sanitized.task = request.task;
      sanitized.prompt = request.prompt
        ? `[${request.prompt.length} chars]`
        : undefined;
    }

    return sanitized;
  }

  /**
   * Sanitize response for privacy
   */
  private sanitizeResponse(
    response: OptimizationResponse
  ): Partial<OptimizationResponse> {
    const sanitized: Partial<OptimizationResponse> = {
      status: response.status,
      metrics: response.metrics,
      confidence: response.confidence,
    };

    if (!this.config.anonymizeData) {
      sanitized.originalPrompt = response.originalPrompt
        ? `[${response.originalPrompt.length} chars]`
        : undefined;
      sanitized.optimizedPrompt = response.optimizedPrompt
        ? `[${response.optimizedPrompt.length} chars]`
        : undefined;
    }

    return sanitized;
  }

  /**
   * Get most frequent items from array
   */
  private getMostFrequent<T>(items: T[]): T[] {
    const counts = new Map<T, number>();
    items.forEach(item => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([item]) => item);
  }

  /**
   * Generate time series data
   */
  private generateTimeSeries(
    events: OptimizationEvent[],
    timeRange: { start: Date; end: Date }
  ): { date: string; count: number }[] {
    const series: { date: string; count: number }[] = [];
    const msPerDay = 24 * 60 * 60 * 1000;

    for (
      let date = new Date(timeRange.start);
      date <= timeRange.end;
      date = new Date(date.getTime() + msPerDay)
    ) {
      const dayStart = new Date(date);
      const dayEnd = new Date(date.getTime() + msPerDay);

      const count = events.filter(
        e => e.timestamp >= dayStart && e.timestamp < dayEnd
      ).length;

      series.push({
        date: date.toISOString().split('T')[0],
        count,
      });
    }

    return series;
  }

  /**
   * Generate success rate time series
   */
  private generateSuccessRateSeries(
    events: OptimizationEvent[],
    timeRange: { start: Date; end: Date }
  ): { date: string; rate: number }[] {
    const series: { date: string; rate: number }[] = [];
    const msPerDay = 24 * 60 * 60 * 1000;

    for (
      let date = new Date(timeRange.start);
      date <= timeRange.end;
      date = new Date(date.getTime() + msPerDay)
    ) {
      const dayStart = new Date(date);
      const dayEnd = new Date(date.getTime() + msPerDay);

      const dayEvents = events.filter(
        e => e.timestamp >= dayStart && e.timestamp < dayEnd
      );
      const successful = dayEvents.filter(
        e => e.type === 'optimization_completed'
      ).length;
      const rate = dayEvents.length > 0 ? successful / dayEvents.length : 0;

      series.push({
        date: date.toISOString().split('T')[0],
        rate: Math.round(rate * 100) / 100,
      });
    }

    return series;
  }

  /**
   * Generate recommendations based on analytics
   */
  private generateRecommendations(
    usage: UsageMetrics,
    system: SystemAnalytics
  ): string[] {
    const recommendations: string[] = [];

    if (system.errorRate > 0.1) {
      recommendations.push(
        'High error rate detected. Consider reviewing API connectivity and rate limits.'
      );
    }

    if (system.cacheHitRate < 0.3) {
      recommendations.push(
        'Low cache hit rate. Consider increasing cache TTL or reviewing caching strategy.'
      );
    }

    if (usage.averageProcessingTime > 30000) {
      recommendations.push(
        'High average processing time. Consider optimizing requests or using faster models.'
      );
    }

    if (usage.mostUsedModels.length === 1) {
      recommendations.push(
        'Consider experimenting with different models for better results.'
      );
    }

    if (usage.averageConfidenceScore < 0.7) {
      recommendations.push(
        'Low average confidence scores. Consider refining prompts or adjusting optimization parameters.'
      );
    }

    return recommendations;
  }
}

/**
 * Global optimization tracker instance
 */
export const optimizationTracker = new OptimizationTracker();

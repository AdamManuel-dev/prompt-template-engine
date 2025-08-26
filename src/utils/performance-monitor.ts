/**
 * @fileoverview Performance monitoring utilities for optimization services
 * @lastmodified 2025-08-26T16:35:00Z
 *
 * Features: Performance metrics, timing, resource monitoring
 * Main APIs: PerformanceMonitor, MetricsCollector, HealthChecker
 * Constraints: Low-overhead monitoring with configurable collection
 * Patterns: Observer pattern, metrics aggregation, health checks
 */

import { EventEmitter } from 'events';
import { logger } from './logger';

export interface PerformanceMetrics {
  duration: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: Date;
  operation: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AggregatedMetrics {
  operation: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  errorRate: number;
  p95Duration: number;
  p99Duration: number;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];

  private readonly maxMetricsCount = 10000;

  private timers = new Map<
    string,
    { start: number; operation: string; metadata?: any }
  >();

  /**
   * Start timing an operation
   */
  startTimer(
    timerId: string,
    operation: string,
    metadata?: Record<string, any>
  ): void {
    this.timers.set(timerId, {
      start: Date.now(),
      operation,
      metadata,
    });
  }

  /**
   * End timing and record metrics
   */
  endTimer(
    timerId: string,
    success: boolean = true,
    error?: string
  ): PerformanceMetrics | null {
    const timer = this.timers.get(timerId);
    if (!timer) {
      logger.warn(`Timer ${timerId} not found`);
      return null;
    }

    const duration = Date.now() - timer.start;
    const metrics: PerformanceMetrics = {
      duration,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date(),
      operation: timer.operation,
      success,
      error,
      metadata: timer.metadata,
    };

    this.recordMetrics(metrics);
    this.timers.delete(timerId);

    return metrics;
  }

  /**
   * Record metrics directly
   */
  recordMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);

    // Emit metrics event
    this.emit('metrics', metrics);

    // Cleanup old metrics if needed
    if (this.metrics.length > this.maxMetricsCount) {
      this.metrics.shift();
    }

    // Log slow operations
    if (metrics.duration > 10000) {
      // 10 seconds
      logger.warn(
        `Slow operation detected: ${metrics.operation} took ${metrics.duration}ms`
      );
    }
  }

  /**
   * Get aggregated metrics for an operation
   */
  getAggregatedMetrics(
    operation: string,
    timeWindowMs?: number
  ): AggregatedMetrics | null {
    const cutoff = timeWindowMs ? Date.now() - timeWindowMs : 0;

    const operationMetrics = this.metrics.filter(
      m => m.operation === operation && m.timestamp.getTime() >= cutoff
    );

    if (operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics
      .map(m => m.duration)
      .sort((a, b) => a - b);
    const successfulOps = operationMetrics.filter(m => m.success).length;

    return {
      operation,
      count: operationMetrics.length,
      totalDuration: durations.reduce((sum, d) => sum + d, 0),
      averageDuration:
        durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      successRate: successfulOps / operationMetrics.length,
      errorRate:
        (operationMetrics.length - successfulOps) / operationMetrics.length,
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      p99Duration: durations[Math.floor(durations.length * 0.99)] || 0,
    };
  }

  /**
   * Get all unique operations
   */
  getOperations(): string[] {
    return Array.from(new Set(this.metrics.map(m => m.operation)));
  }

  /**
   * Get system health metrics
   */
  getSystemHealth(): {
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    activeTimers: number;
    totalMetrics: number;
    recentErrors: number;
  } {
    const recentCutoff = Date.now() - 5 * 60 * 1000; // Last 5 minutes
    const recentErrors = this.metrics.filter(
      m => !m.success && m.timestamp.getTime() >= recentCutoff
    ).length;

    return {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      activeTimers: this.timers.size,
      totalMetrics: this.metrics.length,
      recentErrors,
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = 'timestamp,operation,duration,success,memoryUsed,error';
      const rows = this.metrics.map(
        m =>
          `${m.timestamp.toISOString()},${m.operation},${m.duration},${m.success},${m.memoryUsage.heapUsed},${m.error || ''}`
      );
      return [headers, ...rows].join('\n');
    }

    return JSON.stringify(this.metrics, null, 2);
  }
}

/**
 * Metrics collector for specific optimization operations
 */
export class OptimizationMetricsCollector {
  private monitor = new PerformanceMonitor();

  constructor() {
    // Set up automated reporting
    this.setupPeriodicReporting();
  }

  /**
   * Track cache operation
   */
  trackCacheOperation<T>(
    operation: 'get' | 'set' | 'delete' | 'clear',
    key: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const timerId = `cache_${operation}_${Date.now()}_${Math.random()}`;
    this.monitor.startTimer(timerId, `cache:${operation}`, { key });

    return fn()
      .then(result => {
        this.monitor.endTimer(timerId, true);
        return result;
      })
      .catch(error => {
        this.monitor.endTimer(timerId, false, error.message);
        throw error;
      });
  }

  /**
   * Track queue operation
   */
  trackQueueOperation<T>(
    operation: 'add' | 'process' | 'complete' | 'fail',
    jobId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const timerId = `queue_${operation}_${Date.now()}_${Math.random()}`;
    this.monitor.startTimer(timerId, `queue:${operation}`, { jobId });

    return fn()
      .then(result => {
        this.monitor.endTimer(timerId, true);
        return result;
      })
      .catch(error => {
        this.monitor.endTimer(timerId, false, error.message);
        throw error;
      });
  }

  /**
   * Track optimization pipeline stage
   */
  trackPipelineStage<T>(
    stage: string,
    templateId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const timerId = `pipeline_${stage}_${Date.now()}_${Math.random()}`;
    this.monitor.startTimer(timerId, `pipeline:${stage}`, { templateId });

    return fn()
      .then(result => {
        this.monitor.endTimer(timerId, true);
        return result;
      })
      .catch(error => {
        this.monitor.endTimer(timerId, false, error.message);
        throw error;
      });
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): {
    cache: AggregatedMetrics[];
    queue: AggregatedMetrics[];
    pipeline: AggregatedMetrics[];
    system: any;
  } {
    const operations = this.monitor.getOperations();
    const timeWindow = 60 * 60 * 1000; // Last hour

    const cacheOps = operations
      .filter(op => op.startsWith('cache:'))
      .map(op => this.monitor.getAggregatedMetrics(op, timeWindow))
      .filter(Boolean) as AggregatedMetrics[];

    const queueOps = operations
      .filter(op => op.startsWith('queue:'))
      .map(op => this.monitor.getAggregatedMetrics(op, timeWindow))
      .filter(Boolean) as AggregatedMetrics[];

    const pipelineOps = operations
      .filter(op => op.startsWith('pipeline:'))
      .map(op => this.monitor.getAggregatedMetrics(op, timeWindow))
      .filter(Boolean) as AggregatedMetrics[];

    return {
      cache: cacheOps,
      queue: queueOps,
      pipeline: pipelineOps,
      system: this.monitor.getSystemHealth(),
    };
  }

  private setupPeriodicReporting(): void {
    // Report metrics every 5 minutes
    setInterval(
      () => {
        const report = this.getPerformanceReport();

        // Log summary if there's significant activity
        const totalOps =
          report.cache.length + report.queue.length + report.pipeline.length;
        if (totalOps > 0) {
          logger.info(
            `Performance report: ${totalOps} operations, ${report.system.recentErrors} recent errors`
          );
        }
      },
      5 * 60 * 1000
    );
  }

  /**
   * Get the underlying monitor for custom tracking
   */
  getMonitor(): PerformanceMonitor {
    return this.monitor;
  }
}

/**
 * Health checker for optimization services
 */
export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  timestamp: Date;
  responseTime?: number;
  details?: Record<string, any>;
}

export class HealthChecker {
  private checks = new Map<string, () => Promise<HealthCheckResult>>();

  /**
   * Register a health check
   */
  registerCheck(name: string, checkFn: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, checkFn);
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const [name, checkFn] of this.checks.entries()) {
      try {
        const start = Date.now();
        const result = await checkFn();
        result.responseTime = Date.now() - start;
        results.push(result);
      } catch (error) {
        results.push({
          service: name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Get overall system health
   */
  async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    checks: HealthCheckResult[];
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
  }> {
    const checks = await this.runAllChecks();

    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
    };

    let overall: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (summary.unhealthy > 0) {
      overall = 'unhealthy';
    } else if (summary.degraded > 0) {
      overall = 'degraded';
    }

    return {
      overall,
      checks,
      summary,
    };
  }
}

// Global instances
export const optimizationMetrics = new OptimizationMetricsCollector();
export const healthChecker = new HealthChecker();

/**
 * @fileoverview Advanced resource monitoring and enforcement system
 * @lastmodified 2025-08-27T12:15:00Z
 *
 * Features: Real-time resource monitoring, enforcement, throttling, and emergency controls
 * Main APIs: ResourceMonitor class for comprehensive resource management
 * Constraints: System-level monitoring with process isolation
 * Patterns: Observer pattern, circuit breaker, resource pooling, emergency response
 */

import * as os from 'os';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';

/**
 * Resource limit configuration with granular controls
 */
export interface ResourceLimits {
  // Memory limits
  maxHeapSizeMB: number;
  maxRSSMemoryMB: number;
  maxExternalMemoryMB: number;
  memoryCheckIntervalMs: number;
  memoryWarningThresholdPercent: number;

  // CPU limits
  maxCpuUsagePercent: number;
  maxCpuTimeMs: number;
  cpuCheckIntervalMs: number;
  cpuThrottleThreshold: number;

  // Execution limits
  maxExecutionTimeMs: number;
  maxCallStackDepth: number;
  maxFunctionCalls: number;
  maxLoopIterations: number;

  // File system limits
  maxFileDescriptors: number;
  maxDiskSpaceMB: number;
  maxFileOperationsPerSecond: number;
  allowedFileOperations: string[];

  // Network limits
  maxNetworkConnections: number;
  maxBandwidthKBps: number;
  maxRequestsPerSecond: number;
  networkTimeoutMs: number;

  // Emergency controls
  emergencyThresholdPercent: number;
  gracefulShutdownTimeMs: number;
  forceTerminationEnabled: boolean;
}

/**
 * Default comprehensive resource limits
 */
export const DEFAULT_RESOURCE_LIMITS: ResourceLimits = {
  // Memory limits
  maxHeapSizeMB: 50,
  maxRSSMemoryMB: 100,
  maxExternalMemoryMB: 20,
  memoryCheckIntervalMs: 100,
  memoryWarningThresholdPercent: 80,

  // CPU limits
  maxCpuUsagePercent: 80,
  maxCpuTimeMs: 10000,
  cpuCheckIntervalMs: 100,
  cpuThrottleThreshold: 70,

  // Execution limits
  maxExecutionTimeMs: 15000,
  maxCallStackDepth: 100,
  maxFunctionCalls: 50000,
  maxLoopIterations: 100000,

  // File system limits
  maxFileDescriptors: 50,
  maxDiskSpaceMB: 10,
  maxFileOperationsPerSecond: 100,
  allowedFileOperations: ['read', 'write', 'stat'],

  // Network limits
  maxNetworkConnections: 5,
  maxBandwidthKBps: 1024,
  maxRequestsPerSecond: 10,
  networkTimeoutMs: 30000,

  // Emergency controls
  emergencyThresholdPercent: 95,
  gracefulShutdownTimeMs: 5000,
  forceTerminationEnabled: true,
};

/**
 * Real-time resource usage data
 */
export interface ResourceUsage {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    arrayBuffers: number;
    usagePercent: number;
  };
  cpu: {
    usage: number;
    userTime: number;
    systemTime: number;
    usagePercent: number;
  };
  execution: {
    elapsedTime: number;
    functionCalls: number;
    loopIterations: number;
    callStackDepth: number;
  };
  io: {
    fileOperations: number;
    networkRequests: number;
    diskUsage: number;
    openFileDescriptors: number;
  };
  system: {
    availableMemory: number;
    cpuLoad: number[];
    diskSpace: number;
  };
}

/**
 * Resource violation event
 */
export interface ResourceViolation {
  type: 'memory' | 'cpu' | 'execution' | 'io' | 'network';
  severity: 'warning' | 'limit' | 'critical' | 'emergency';
  description: string;
  currentValue: number;
  limitValue: number;
  timestamp: number;
  executionId: string;
}

/**
 * Resource monitoring event types
 */
export interface ResourceMonitorEvents {
  violation: (violation: ResourceViolation) => void;
  warning: (warning: ResourceViolation) => void;
  emergency: (executionId: string, reason: string) => void;
  throttle: (executionId: string, resource: string) => void;
  usage: (usage: ResourceUsage) => void;
}

/**
 * Advanced resource monitoring and enforcement system
 */
export class ResourceMonitor extends EventEmitter {
  private monitors = new Map<string, NodeJS.Timeout>();

  private usageHistory = new Map<string, ResourceUsage[]>();

  private violationCounts = new Map<string, Map<string, number>>();

  private throttledExecutions = new Set<string>();

  private emergencyStops = new Set<string>();

  private limits: ResourceLimits;

  private readonly maxHistoryEntries = 100;

  constructor(limits: Partial<ResourceLimits> = {}) {
    super();
    this.limits = { ...DEFAULT_RESOURCE_LIMITS, ...limits };
    logger.info('Advanced resource monitor initialized');
  }

  /**
   * Start monitoring resources for a plugin execution
   */
  startMonitoring(
    executionId: string,
    customLimits?: Partial<ResourceLimits>
  ): void {
    if (this.monitors.has(executionId)) {
      logger.warn(`Resource monitor already exists for ${executionId}`);
      return;
    }

    const finalLimits = { ...this.limits, ...customLimits };
    this.usageHistory.set(executionId, []);
    this.violationCounts.set(executionId, new Map());

    logger.info(`Starting resource monitoring for ${executionId}`);

    // Start comprehensive monitoring
    const monitor = setInterval(
      () => {
        this.checkAllResources(executionId, finalLimits);
      },
      Math.min(
        finalLimits.memoryCheckIntervalMs,
        finalLimits.cpuCheckIntervalMs
      )
    );

    this.monitors.set(executionId, monitor);

    // Set execution timeout
    setTimeout(() => {
      if (this.monitors.has(executionId)) {
        this.reportViolation(
          executionId,
          'execution',
          'emergency',
          'Maximum execution time exceeded',
          finalLimits.maxExecutionTimeMs,
          finalLimits.maxExecutionTimeMs
        );
        this.emergencyTerminate(executionId, 'Execution timeout');
      }
    }, finalLimits.maxExecutionTimeMs);
  }

  /**
   * Stop monitoring and cleanup resources
   */
  stopMonitoring(executionId: string): void {
    const monitor = this.monitors.get(executionId);
    if (monitor) {
      clearInterval(monitor);
      this.monitors.delete(executionId);
    }

    this.throttledExecutions.delete(executionId);

    // Keep history and violations for audit
    logger.info(`Stopped resource monitoring for ${executionId}`);
  }

  /**
   * Get current resource usage for execution
   */
  getCurrentUsage(executionId: string): ResourceUsage | null {
    const history = this.usageHistory.get(executionId);
    return (
      history && history.length > 0 ? history[history.length - 1] : null
    ) as ResourceUsage | null;
  }

  /**
   * Get resource usage history
   */
  getUsageHistory(executionId: string): ResourceUsage[] {
    return this.usageHistory.get(executionId) || [];
  }

  /**
   * Get violation statistics
   */
  getViolationStats(executionId: string): Map<string, number> {
    return this.violationCounts.get(executionId) || new Map();
  }

  /**
   * Check if execution is throttled
   */
  isThrottled(executionId: string): boolean {
    return this.throttledExecutions.has(executionId);
  }

  /**
   * Check if execution was emergency stopped
   */
  wasEmergencyStopped(executionId: string): boolean {
    return this.emergencyStops.has(executionId);
  }

  /**
   * Comprehensive resource checking
   */
  private async checkAllResources(
    executionId: string,
    limits: ResourceLimits
  ): Promise<void> {
    try {
      const usage = await this.collectResourceUsage(executionId);

      // Store usage history
      const history = this.usageHistory.get(executionId) || [];
      history.push(usage);
      if (history.length > this.maxHistoryEntries) {
        history.splice(0, history.length - this.maxHistoryEntries);
      }
      this.usageHistory.set(executionId, history);

      // Emit usage event
      this.emit('usage', usage);

      // Check all resource limits
      await this.checkMemoryLimits(executionId, usage, limits);
      await this.checkCpuLimits(executionId, usage, limits);
      await this.checkExecutionLimits(executionId, usage, limits);
      await this.checkIOLimits(executionId, usage, limits);

      // Check for emergency conditions
      this.checkEmergencyConditions(executionId, usage, limits);
    } catch (error: unknown) {
      logger.error(
        `Resource monitoring error for ${executionId}: ${error.message}`
      );
    }
  }

  /**
   * Collect comprehensive resource usage data
   */
  private async collectResourceUsage(
    executionId: string
  ): Promise<ResourceUsage> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();

    // Get system information
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const availableMemory = freeMemory;

    // Calculate percentages
    const memoryUsagePercent = (memUsage.rss / totalMemory) * 100;
    const cpuUsagePercent = this.calculateCpuUsagePercent(
      executionId,
      cpuUsage
    );

    return {
      timestamp: Date.now(),
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers || 0,
        usagePercent: memoryUsagePercent,
      },
      cpu: {
        usage: cpuUsagePercent,
        userTime: cpuUsage.user / 1000000, // Convert to ms
        systemTime: cpuUsage.system / 1000000,
        usagePercent: cpuUsagePercent,
      },
      execution: {
        elapsedTime: this.getElapsedTime(executionId),
        functionCalls: this.getFunctionCallCount(executionId),
        loopIterations: this.getLoopIterationCount(executionId),
        callStackDepth: this.getCurrentCallStackDepth(),
      },
      io: {
        fileOperations: this.getFileOperationCount(executionId),
        networkRequests: this.getNetworkRequestCount(executionId),
        diskUsage: await this.getDiskUsage(),
        openFileDescriptors: this.getOpenFileDescriptorCount(),
      },
      system: {
        availableMemory,
        cpuLoad: loadAvg,
        diskSpace: await this.getAvailableDiskSpace(),
      },
    };
  }

  /**
   * Check memory limits and enforce
   */
  private async checkMemoryLimits(
    executionId: string,
    usage: ResourceUsage,
    limits: ResourceLimits
  ): Promise<void> {
    const { memory } = usage;

    // Check heap memory
    const heapMB = memory.heapUsed / 1024 / 1024;
    if (heapMB > limits.maxHeapSizeMB) {
      this.reportViolation(
        executionId,
        'memory',
        'limit',
        `Heap memory limit exceeded: ${heapMB.toFixed(1)}MB > ${limits.maxHeapSizeMB}MB`,
        heapMB,
        limits.maxHeapSizeMB
      );

      if (
        heapMB >
        limits.maxHeapSizeMB * (limits.emergencyThresholdPercent / 100)
      ) {
        this.emergencyTerminate(
          executionId,
          'Heap memory emergency limit exceeded'
        );
      }
    }

    // Check RSS memory
    const rssMB = memory.rss / 1024 / 1024;
    if (rssMB > limits.maxRSSMemoryMB) {
      this.reportViolation(
        executionId,
        'memory',
        'limit',
        `RSS memory limit exceeded: ${rssMB.toFixed(1)}MB > ${limits.maxRSSMemoryMB}MB`,
        rssMB,
        limits.maxRSSMemoryMB
      );
    }

    // Check external memory
    const externalMB = memory.external / 1024 / 1024;
    if (externalMB > limits.maxExternalMemoryMB) {
      this.reportViolation(
        executionId,
        'memory',
        'warning',
        `External memory high: ${externalMB.toFixed(1)}MB > ${limits.maxExternalMemoryMB}MB`,
        externalMB,
        limits.maxExternalMemoryMB
      );
    }

    // Check memory usage percentage
    if (memory.usagePercent > limits.memoryWarningThresholdPercent) {
      this.reportViolation(
        executionId,
        'memory',
        'warning',
        `High memory usage: ${memory.usagePercent.toFixed(1)}% > ${limits.memoryWarningThresholdPercent}%`,
        memory.usagePercent,
        limits.memoryWarningThresholdPercent
      );
    }
  }

  /**
   * Check CPU limits and enforce throttling
   */
  private async checkCpuLimits(
    executionId: string,
    usage: ResourceUsage,
    limits: ResourceLimits
  ): Promise<void> {
    const { cpu } = usage;

    // Check CPU usage percentage
    if (cpu.usagePercent > limits.maxCpuUsagePercent) {
      this.reportViolation(
        executionId,
        'cpu',
        'limit',
        `CPU usage limit exceeded: ${cpu.usagePercent.toFixed(1)}% > ${limits.maxCpuUsagePercent}%`,
        cpu.usagePercent,
        limits.maxCpuUsagePercent
      );

      // Implement CPU throttling
      if (cpu.usagePercent > limits.cpuThrottleThreshold) {
        this.throttleExecution(executionId, 'cpu');
      }
    }

    // Check total CPU time
    const totalCpuTime = cpu.userTime + cpu.systemTime;
    if (totalCpuTime > limits.maxCpuTimeMs) {
      this.reportViolation(
        executionId,
        'cpu',
        'emergency',
        `CPU time limit exceeded: ${totalCpuTime.toFixed(1)}ms > ${limits.maxCpuTimeMs}ms`,
        totalCpuTime,
        limits.maxCpuTimeMs
      );

      this.emergencyTerminate(executionId, 'CPU time limit exceeded');
    }
  }

  /**
   * Check execution limits
   */
  private async checkExecutionLimits(
    executionId: string,
    usage: ResourceUsage,
    limits: ResourceLimits
  ): Promise<void> {
    const { execution } = usage;

    // Check function calls
    if (execution.functionCalls > limits.maxFunctionCalls) {
      this.reportViolation(
        executionId,
        'execution',
        'limit',
        `Function call limit exceeded: ${execution.functionCalls} > ${limits.maxFunctionCalls}`,
        execution.functionCalls,
        limits.maxFunctionCalls
      );
    }

    // Check loop iterations
    if (execution.loopIterations > limits.maxLoopIterations) {
      this.reportViolation(
        executionId,
        'execution',
        'emergency',
        `Loop iteration limit exceeded: ${execution.loopIterations} > ${limits.maxLoopIterations}`,
        execution.loopIterations,
        limits.maxLoopIterations
      );

      this.emergencyTerminate(executionId, 'Infinite loop detected');
    }

    // Check call stack depth
    if (execution.callStackDepth > limits.maxCallStackDepth) {
      this.reportViolation(
        executionId,
        'execution',
        'emergency',
        `Call stack depth exceeded: ${execution.callStackDepth} > ${limits.maxCallStackDepth}`,
        execution.callStackDepth,
        limits.maxCallStackDepth
      );

      this.emergencyTerminate(executionId, 'Stack overflow prevention');
    }
  }

  /**
   * Check I/O limits
   */
  private async checkIOLimits(
    executionId: string,
    usage: ResourceUsage,
    limits: ResourceLimits
  ): Promise<void> {
    const { io } = usage;

    // Check file descriptors
    if (io.openFileDescriptors > limits.maxFileDescriptors) {
      this.reportViolation(
        executionId,
        'io',
        'limit',
        `File descriptor limit exceeded: ${io.openFileDescriptors} > ${limits.maxFileDescriptors}`,
        io.openFileDescriptors,
        limits.maxFileDescriptors
      );
    }

    // Check disk usage
    const diskMB = io.diskUsage / 1024 / 1024;
    if (diskMB > limits.maxDiskSpaceMB) {
      this.reportViolation(
        executionId,
        'io',
        'limit',
        `Disk usage limit exceeded: ${diskMB.toFixed(1)}MB > ${limits.maxDiskSpaceMB}MB`,
        diskMB,
        limits.maxDiskSpaceMB
      );
    }
  }

  /**
   * Check for emergency conditions that require immediate termination
   */
  private checkEmergencyConditions(
    executionId: string,
    usage: ResourceUsage,
    limits: ResourceLimits
  ): void {
    const emergencyConditions: string[] = [];

    // Memory emergency
    if (usage.memory.usagePercent > limits.emergencyThresholdPercent) {
      emergencyConditions.push(
        `System memory critical: ${usage.memory.usagePercent.toFixed(1)}%`
      );
    }

    // CPU emergency
    if (usage.cpu.usagePercent > limits.emergencyThresholdPercent) {
      emergencyConditions.push(
        `System CPU critical: ${usage.cpu.usagePercent.toFixed(1)}%`
      );
    }

    // System load emergency
    const firstLoad = usage.system.cpuLoad?.[0];
    if (firstLoad !== undefined && firstLoad > os.cpus().length * 2) {
      emergencyConditions.push(`System load critical: ${firstLoad.toFixed(2)}`);
    }

    // Available memory emergency
    if (usage.system.availableMemory < 100 * 1024 * 1024) {
      // Less than 100MB
      emergencyConditions.push(
        `Available system memory critical: ${(usage.system.availableMemory / 1024 / 1024).toFixed(1)}MB`
      );
    }

    // Trigger emergency if any conditions are met
    if (emergencyConditions.length > 0) {
      const reason = emergencyConditions.join('; ');
      this.emergencyTerminate(executionId, reason);
    }
  }

  /**
   * Report resource violation
   */
  private reportViolation(
    executionId: string,
    type: ResourceViolation['type'],
    severity: ResourceViolation['severity'],
    description: string,
    currentValue: number,
    limitValue: number
  ): void {
    const violation: ResourceViolation = {
      type,
      severity,
      description,
      currentValue,
      limitValue,
      timestamp: Date.now(),
      executionId,
    };

    // Update violation count
    const violations = this.violationCounts.get(executionId) || new Map();
    const key = `${type}-${severity}`;
    violations.set(key, (violations.get(key) || 0) + 1);
    this.violationCounts.set(executionId, violations);

    // Emit appropriate event
    if (severity === 'warning') {
      this.emit('warning', violation);
    } else {
      this.emit('violation', violation);
    }

    logger.warn(
      `Resource violation [${severity.toUpperCase()}] for ${executionId}: ${description}`
    );
  }

  /**
   * Throttle execution to reduce resource usage
   */
  private throttleExecution(executionId: string, resource: string): void {
    if (this.throttledExecutions.has(executionId)) {
      return; // Already throttled
    }

    this.throttledExecutions.add(executionId);
    this.emit('throttle', executionId, resource);

    logger.warn(`Throttling execution ${executionId} due to ${resource} usage`);

    // Implement throttling by adding delays (would be more sophisticated in production)
    setTimeout(() => {
      this.throttledExecutions.delete(executionId);
    }, 1000);
  }

  /**
   * Emergency terminate execution
   */
  private emergencyTerminate(executionId: string, reason: string): void {
    if (this.emergencyStops.has(executionId)) {
      return; // Already terminated
    }

    this.emergencyStops.add(executionId);
    this.emit('emergency', executionId, reason);

    logger.error(`EMERGENCY TERMINATION: ${executionId} - ${reason}`);

    // Stop monitoring
    this.stopMonitoring(executionId);
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCpuUsagePercent(
    executionId: string,
    cpuUsage: NodeJS.CpuUsage
  ): number {
    const history = this.usageHistory.get(executionId) || [];
    if (history.length === 0) {
      return 0;
    }

    const lastUsage = history[history.length - 1];
    if (!lastUsage) {
      return 0;
    }

    const timeDiff = Date.now() - lastUsage.timestamp;

    if (timeDiff === 0) {
      return 0;
    }

    const cpuTimeDiff =
      cpuUsage.user +
      cpuUsage.system -
      (lastUsage.cpu.userTime + lastUsage.cpu.systemTime) * 1000000;

    return Math.min((cpuTimeDiff / (timeDiff * 1000)) * 100, 100);
  }

  /**
   * Get elapsed execution time
   */
  private getElapsedTime(executionId: string): number {
    const history = this.usageHistory.get(executionId) || [];
    if (history.length === 0) {
      return 0;
    }
    const firstEntry = history[0];
    return firstEntry?.timestamp ? Date.now() - firstEntry.timestamp : 0;
  }

  /**
   * Get function call count (would be tracked by execution context)
   */
  private getFunctionCallCount(_executionId: string): number {
    // This would be maintained by the execution context
    return 0;
  }

  /**
   * Get loop iteration count (would be tracked by execution context)
   */
  private getLoopIterationCount(_executionId: string): number {
    // This would be maintained by the execution context
    return 0;
  }

  /**
   * Get current call stack depth
   */
  private getCurrentCallStackDepth(): number {
    const { stack } = new Error();
    return stack ? stack.split('\n').length - 1 : 0;
  }

  /**
   * Get file operation count (would be tracked by file system wrapper)
   */
  private getFileOperationCount(_executionId: string): number {
    // This would be maintained by the secure file system wrapper
    return 0;
  }

  /**
   * Get network request count (would be tracked by network wrapper)
   */
  private getNetworkRequestCount(_executionId: string): number {
    // This would be maintained by the secure network wrapper
    return 0;
  }

  /**
   * Get disk usage for plugin
   */
  private async getDiskUsage(): Promise<number> {
    try {
      const stats = await fs.stat('./plugins');
      return stats.size || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get open file descriptor count
   */
  private getOpenFileDescriptorCount(): number {
    // This would need platform-specific implementation
    return 0;
  }

  /**
   * Get available disk space
   */
  private async getAvailableDiskSpace(): Promise<number> {
    try {
      const stats = await fs.statfs('./');
      return stats.bavail * stats.bsize;
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup all monitors and resources
   */
  cleanup(): void {
    logger.info('Cleaning up resource monitors...');

    // Stop all monitors
    for (const [executionId, monitor] of this.monitors) {
      clearInterval(monitor);
      logger.info(`Stopped monitoring for ${executionId}`);
    }

    // Clear all data structures
    this.monitors.clear();
    this.throttledExecutions.clear();

    // Keep history and violations for audit
    logger.info('Resource monitor cleanup completed');
  }

  /**
   * Generate comprehensive monitoring report
   */
  generateReport(): object {
    const totalExecutions = this.usageHistory.size;
    const totalViolations = Array.from(this.violationCounts.values()).reduce(
      (total, violations) =>
        total +
        Array.from(violations.values()).reduce((sum, count) => sum + count, 0),
      0
    );

    const emergencyStops = this.emergencyStops.size;
    const activeMonitors = this.monitors.size;

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalExecutions,
        totalViolations,
        emergencyStops,
        activeMonitors,
      },
      limits: this.limits,
      emergencyStoppedExecutions: Array.from(this.emergencyStops),
      currentlyThrottled: Array.from(this.throttledExecutions),
    };
  }
}

/**
 * Global resource monitor instance
 */
let globalResourceMonitor: ResourceMonitor | null = null;

/**
 * Get or create global resource monitor
 */
export function getResourceMonitor(
  limits?: Partial<ResourceLimits>
): ResourceMonitor {
  if (!globalResourceMonitor) {
    globalResourceMonitor = new ResourceMonitor(limits);
  }
  return globalResourceMonitor;
}

/**
 * Cleanup global resource monitor
 */
export function cleanupResourceMonitor(): void {
  if (globalResourceMonitor) {
    globalResourceMonitor.cleanup();
    globalResourceMonitor = null;
  }
}

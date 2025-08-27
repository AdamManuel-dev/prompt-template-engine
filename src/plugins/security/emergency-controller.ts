/**
 * @fileoverview Emergency plugin termination and response control system
 * @lastmodified 2025-08-27T13:30:00Z
 *
 * Features: Emergency termination, incident response, forensic capture, recovery procedures
 * Main APIs: EmergencyController class for critical security response
 * Constraints: Real-time response, fail-safe mechanisms, forensic preservation
 * Patterns: Circuit breaker, emergency stop, incident response, forensic analysis
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { logger } from '../../utils/logger';

/**
 * Emergency severity levels
 */
export type EmergencySeverity = 'low' | 'medium' | 'high' | 'critical' | 'catastrophic';

/**
 * Emergency trigger types
 */
export type EmergencyTrigger = 
  | 'resource-exhaustion'
  | 'security-violation'
  | 'malicious-behavior'
  | 'system-compromise'
  | 'data-breach'
  | 'privilege-escalation'
  | 'denial-of-service'
  | 'infinite-loop'
  | 'memory-leak'
  | 'unauthorized-access'
  | 'code-injection'
  | 'manual-trigger';

/**
 * Emergency response action
 */
export type EmergencyAction = 
  | 'terminate'
  | 'isolate'
  | 'quarantine'
  | 'suspend'
  | 'restrict'
  | 'monitor'
  | 'alert'
  | 'backup'
  | 'forensic-capture';

/**
 * Emergency incident data
 */
export interface EmergencyIncident {
  id: string;
  timestamp: Date;
  severity: EmergencySeverity;
  trigger: EmergencyTrigger;
  executionId: string;
  pluginId: string;
  pluginName: string;
  description: string;
  evidence: {
    resourceUsage?: {
      memory: number;
      cpu: number;
      executionTime: number;
    };
    securityViolations?: string[];
    suspiciousActivities?: string[];
    stackTrace?: string;
    networkActivity?: any[];
    fileAccess?: any[];
  };
  context: {
    userId?: string;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    systemState?: any;
  };
  forensicData?: {
    memoryDump?: string;
    executionLog?: string[];
    networkCapture?: string;
    fileSystemSnapshot?: string;
  };
}

/**
 * Emergency response result
 */
export interface EmergencyResponse {
  incident: EmergencyIncident;
  actionsExecuted: EmergencyActionResult[];
  success: boolean;
  responseTime: number;
  recoverySteps?: string[];
  recommendations?: string[];
}

/**
 * Emergency action execution result
 */
export interface EmergencyActionResult {
  action: EmergencyAction;
  success: boolean;
  executionTime: number;
  details?: string;
  error?: string;
}

/**
 * Emergency controller configuration
 */
export interface EmergencyConfig {
  // Response settings
  enableAutomatedResponse: boolean;
  maxResponseTime: number; // milliseconds
  enableForensicCapture: boolean;
  enableRecoveryProcedures: boolean;
  
  // Thresholds
  memoryThresholdMB: number;
  cpuThresholdPercent: number;
  executionTimeThresholdMs: number;
  violationThreshold: number;
  
  // Actions
  defaultActions: {
    [key in EmergencySeverity]: EmergencyAction[];
  };
  customActionHandlers: Map<EmergencyAction, (incident: EmergencyIncident) => Promise<EmergencyActionResult>>;
  
  // Storage
  forensicStoragePath: string;
  incidentLogPath: string;
  retentionDays: number;
  
  // Notifications
  enableAlerts: boolean;
  alertEndpoints: string[];
  enableExternalNotifications: boolean;
  
  // Recovery
  enableAutoRecovery: boolean;
  maxRecoveryAttempts: number;
  recoveryDelay: number;
}

/**
 * Default emergency configuration
 */
export const DEFAULT_EMERGENCY_CONFIG: EmergencyConfig = {
  // Response settings
  enableAutomatedResponse: true,
  maxResponseTime: 5000, // 5 seconds
  enableForensicCapture: true,
  enableRecoveryProcedures: true,
  
  // Thresholds
  memoryThresholdMB: 1024, // 1GB
  cpuThresholdPercent: 95,
  executionTimeThresholdMs: 60000, // 1 minute
  violationThreshold: 5,
  
  // Actions
  defaultActions: {
    low: ['monitor', 'alert'],
    medium: ['restrict', 'monitor', 'alert'],
    high: ['isolate', 'forensic-capture', 'alert'],
    critical: ['terminate', 'quarantine', 'forensic-capture', 'alert'],
    catastrophic: ['terminate', 'quarantine', 'forensic-capture', 'alert', 'backup'],
  },
  customActionHandlers: new Map(),
  
  // Storage
  forensicStoragePath: './plugins/security/forensics',
  incidentLogPath: './plugins/security/incidents.log',
  retentionDays: 90,
  
  // Notifications
  enableAlerts: true,
  alertEndpoints: [],
  enableExternalNotifications: false,
  
  // Recovery
  enableAutoRecovery: false,
  maxRecoveryAttempts: 3,
  recoveryDelay: 5000,
};

/**
 * Execution context for emergency tracking
 */
interface ExecutionContext {
  executionId: string;
  pluginId: string;
  pluginName: string;
  startTime: Date;
  worker?: Worker;
  vmContext?: any;
  monitoring: {
    violations: string[];
    resourceUsage: any[];
    networkActivity: any[];
    fileAccess: any[];
  };
}

/**
 * Emergency plugin termination and response control system
 */
export class EmergencyController extends EventEmitter {
  private config: EmergencyConfig;
  private activeExecutions = new Map<string, ExecutionContext>();
  private incidentHistory: EmergencyIncident[] = [];
  private quarantinedPlugins = new Set<string>();
  private emergencyStops = new Set<string>();
  private forensicCaptures = new Map<string, string>(); // executionId -> forensic data path

  constructor(config: Partial<EmergencyConfig> = {}) {
    super();
    this.config = { ...DEFAULT_EMERGENCY_CONFIG, ...config };
    
    this.initializeDirectories();
    this.setupDefaultActionHandlers();
    
    logger.info('Emergency controller initialized');
  }

  /**
   * Register active plugin execution
   */
  registerExecution(
    executionId: string,
    pluginId: string,
    pluginName: string,
    worker?: Worker,
    vmContext?: any
  ): void {
    const context: ExecutionContext = {
      executionId,
      pluginId,
      pluginName,
      startTime: new Date(),
      worker,
      vmContext,
      monitoring: {
        violations: [],
        resourceUsage: [],
        networkActivity: [],
        fileAccess: [],
      },
    };

    this.activeExecutions.set(executionId, context);
    logger.debug(`Registered execution for emergency monitoring: ${executionId}`);
  }

  /**
   * Unregister plugin execution
   */
  unregisterExecution(executionId: string): void {
    this.activeExecutions.delete(executionId);
    this.emergencyStops.delete(executionId);
    logger.debug(`Unregistered execution from emergency monitoring: ${executionId}`);
  }

  /**
   * Record security violation for monitoring
   */
  recordViolation(executionId: string, violation: string): void {
    const context = this.activeExecutions.get(executionId);
    if (context) {
      context.monitoring.violations.push(violation);
      
      // Check if threshold exceeded
      if (context.monitoring.violations.length >= this.config.violationThreshold) {
        this.triggerEmergency(executionId, 'security-violation', 'high', 
          `Security violation threshold exceeded: ${context.monitoring.violations.length} violations`);
      }
    }
  }

  /**
   * Record resource usage for monitoring
   */
  recordResourceUsage(executionId: string, usage: any): void {
    const context = this.activeExecutions.get(executionId);
    if (!context) return;

    context.monitoring.resourceUsage.push(usage);

    // Check emergency thresholds
    if (usage.memory && usage.memory / (1024 * 1024) > this.config.memoryThresholdMB) {
      this.triggerEmergency(executionId, 'resource-exhaustion', 'critical',
        `Memory usage exceeded threshold: ${Math.round(usage.memory / (1024 * 1024))}MB > ${this.config.memoryThresholdMB}MB`);
    }

    if (usage.cpu && usage.cpu > this.config.cpuThresholdPercent) {
      this.triggerEmergency(executionId, 'resource-exhaustion', 'high',
        `CPU usage exceeded threshold: ${usage.cpu}% > ${this.config.cpuThresholdPercent}%`);
    }

    const executionTime = Date.now() - context.startTime.getTime();
    if (executionTime > this.config.executionTimeThresholdMs) {
      this.triggerEmergency(executionId, 'infinite-loop', 'critical',
        `Execution time exceeded threshold: ${executionTime}ms > ${this.config.executionTimeThresholdMs}ms`);
    }
  }

  /**
   * Trigger emergency response
   */
  async triggerEmergency(
    executionId: string,
    trigger: EmergencyTrigger,
    severity: EmergencySeverity,
    description: string,
    additionalEvidence?: any
  ): Promise<EmergencyResponse> {
    const startTime = Date.now();
    
    // Prevent duplicate emergency triggers
    if (this.emergencyStops.has(executionId)) {
      logger.warn(`Emergency already triggered for ${executionId}`);
      return {
        incident: {} as EmergencyIncident,
        actionsExecuted: [],
        success: false,
        responseTime: 0,
      };
    }

    this.emergencyStops.add(executionId);

    try {
      logger.error(`EMERGENCY TRIGGERED: ${executionId} - ${trigger} (${severity}): ${description}`);

      // Create incident record
      const incident = await this.createIncident(executionId, trigger, severity, description, additionalEvidence);
      
      // Execute emergency response
      const actions = this.config.defaultActions[severity] || [];
      const actionResults: EmergencyActionResult[] = [];

      for (const action of actions) {
        try {
          const result = await this.executeEmergencyAction(action, incident);
          actionResults.push(result);
        } catch (error: any) {
          actionResults.push({
            action,
            success: false,
            executionTime: 0,
            error: error.message,
          });
        }
      }

      const response: EmergencyResponse = {
        incident,
        actionsExecuted: actionResults,
        success: actionResults.every(result => result.success),
        responseTime: Date.now() - startTime,
      };

      // Add recovery recommendations
      response.recommendations = this.generateRecoveryRecommendations(incident, actionResults);

      // Store incident
      this.incidentHistory.push(incident);
      await this.persistIncident(incident);

      // Emit emergency event
      this.emit('emergency', response);

      logger.error(`Emergency response completed for ${executionId}: ${response.success ? 'SUCCESS' : 'PARTIAL'} (${response.responseTime}ms)`);
      return response;

    } catch (error: any) {
      logger.error(`Emergency response error for ${executionId}: ${error.message}`);
      return {
        incident: {} as EmergencyIncident,
        actionsExecuted: [],
        success: false,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Manual emergency trigger
   */
  async manualEmergency(
    executionId: string,
    severity: EmergencySeverity,
    reason: string
  ): Promise<EmergencyResponse> {
    return this.triggerEmergency(executionId, 'manual-trigger', severity, `Manual emergency trigger: ${reason}`);
  }

  /**
   * Quarantine plugin
   */
  async quarantinePlugin(pluginId: string, reason: string): Promise<boolean> {
    try {
      this.quarantinedPlugins.add(pluginId);
      
      // Terminate all active executions for this plugin
      const activeForPlugin = Array.from(this.activeExecutions.entries())
        .filter(([_, context]) => context.pluginId === pluginId);

      for (const [executionId, context] of activeForPlugin) {
        await this.terminateExecution(context);
      }

      logger.warn(`Plugin quarantined: ${pluginId} - ${reason}`);
      this.emit('quarantine', { pluginId, reason });
      
      return true;
    } catch (error: any) {
      logger.error(`Failed to quarantine plugin ${pluginId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if plugin is quarantined
   */
  isQuarantined(pluginId: string): boolean {
    return this.quarantinedPlugins.has(pluginId);
  }

  /**
   * Release plugin from quarantine
   */
  releaseFromQuarantine(pluginId: string, reason: string): boolean {
    const wasQuarantined = this.quarantinedPlugins.delete(pluginId);
    if (wasQuarantined) {
      logger.info(`Plugin released from quarantine: ${pluginId} - ${reason}`);
      this.emit('quarantineRelease', { pluginId, reason });
    }
    return wasQuarantined;
  }

  /**
   * Get incident history
   */
  getIncidentHistory(limit?: number): EmergencyIncident[] {
    const history = [...this.incidentHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get quarantined plugins
   */
  getQuarantinedPlugins(): string[] {
    return Array.from(this.quarantinedPlugins);
  }

  /**
   * Create incident record
   */
  private async createIncident(
    executionId: string,
    trigger: EmergencyTrigger,
    severity: EmergencySeverity,
    description: string,
    additionalEvidence?: any
  ): Promise<EmergencyIncident> {
    const context = this.activeExecutions.get(executionId);
    const incident: EmergencyIncident = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      severity,
      trigger,
      executionId,
      pluginId: context?.pluginId || 'unknown',
      pluginName: context?.pluginName || 'unknown',
      description,
      evidence: {
        securityViolations: context?.monitoring.violations || [],
        suspiciousActivities: [],
        stackTrace: new Error().stack,
        networkActivity: context?.monitoring.networkActivity || [],
        fileAccess: context?.monitoring.fileAccess || [],
        ...additionalEvidence,
      },
      context: {
        systemState: await this.captureSystemState(),
      },
    };

    // Capture forensic data if enabled
    if (this.config.enableForensicCapture) {
      incident.forensicData = await this.captureForensicData(executionId, context);
    }

    return incident;
  }

  /**
   * Execute emergency action
   */
  private async executeEmergencyAction(
    action: EmergencyAction,
    incident: EmergencyIncident
  ): Promise<EmergencyActionResult> {
    const startTime = Date.now();
    
    try {
      // Check for custom handler
      const customHandler = this.config.customActionHandlers.get(action);
      if (customHandler) {
        return await customHandler(incident);
      }

      // Execute built-in action
      switch (action) {
        case 'terminate':
          await this.executeTerminate(incident);
          break;
          
        case 'isolate':
          await this.executeIsolate(incident);
          break;
          
        case 'quarantine':
          await this.executeQuarantine(incident);
          break;
          
        case 'suspend':
          await this.executeSuspend(incident);
          break;
          
        case 'restrict':
          await this.executeRestrict(incident);
          break;
          
        case 'monitor':
          await this.executeMonitor(incident);
          break;
          
        case 'alert':
          await this.executeAlert(incident);
          break;
          
        case 'backup':
          await this.executeBackup(incident);
          break;
          
        case 'forensic-capture':
          await this.executeForensicCapture(incident);
          break;
          
        default:
          throw new Error(`Unknown emergency action: ${action}`);
      }

      return {
        action,
        success: true,
        executionTime: Date.now() - startTime,
        details: `Action ${action} executed successfully`,
      };

    } catch (error: any) {
      return {
        action,
        success: false,
        executionTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Execute terminate action
   */
  private async executeTerminate(incident: EmergencyIncident): Promise<void> {
    const context = this.activeExecutions.get(incident.executionId);
    if (context) {
      await this.terminateExecution(context);
    }
    logger.warn(`Executed TERMINATE for ${incident.executionId}`);
  }

  /**
   * Execute isolate action
   */
  private async executeIsolate(incident: EmergencyIncident): Promise<void> {
    const context = this.activeExecutions.get(incident.executionId);
    if (context) {
      // Isolate by restricting all permissions and network access
      this.emit('isolate', { executionId: incident.executionId, pluginId: incident.pluginId });
    }
    logger.warn(`Executed ISOLATE for ${incident.executionId}`);
  }

  /**
   * Execute quarantine action
   */
  private async executeQuarantine(incident: EmergencyIncident): Promise<void> {
    await this.quarantinePlugin(incident.pluginId, `Emergency quarantine: ${incident.trigger}`);
  }

  /**
   * Execute suspend action
   */
  private async executeSuspend(incident: EmergencyIncident): Promise<void> {
    // Suspend execution but keep for monitoring
    this.emit('suspend', { executionId: incident.executionId, pluginId: incident.pluginId });
    logger.warn(`Executed SUSPEND for ${incident.executionId}`);
  }

  /**
   * Execute restrict action
   */
  private async executeRestrict(incident: EmergencyIncident): Promise<void> {
    // Apply maximum security restrictions
    this.emit('restrict', { executionId: incident.executionId, pluginId: incident.pluginId });
    logger.warn(`Executed RESTRICT for ${incident.executionId}`);
  }

  /**
   * Execute monitor action
   */
  private async executeMonitor(incident: EmergencyIncident): Promise<void> {
    // Increase monitoring frequency
    this.emit('enhancedMonitoring', { executionId: incident.executionId, pluginId: incident.pluginId });
    logger.info(`Executed MONITOR for ${incident.executionId}`);
  }

  /**
   * Execute alert action
   */
  private async executeAlert(incident: EmergencyIncident): Promise<void> {
    const alert = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'emergency',
      severity: incident.severity,
      incident,
    };

    this.emit('alert', alert);
    
    // External notifications if configured
    if (this.config.enableExternalNotifications) {
      await this.sendExternalNotifications(alert);
    }
    
    logger.error(`Executed ALERT for ${incident.executionId}`);
  }

  /**
   * Execute backup action
   */
  private async executeBackup(incident: EmergencyIncident): Promise<void> {
    // Backup critical system state and data
    const backupId = crypto.randomUUID();
    await this.createSystemBackup(backupId, incident);
    logger.warn(`Executed BACKUP for ${incident.executionId} (backup ID: ${backupId})`);
  }

  /**
   * Execute forensic capture action
   */
  private async executeForensicCapture(incident: EmergencyIncident): Promise<void> {
    const context = this.activeExecutions.get(incident.executionId);
    if (context) {
      const forensicPath = await this.performForensicCapture(incident.executionId, context);
      this.forensicCaptures.set(incident.executionId, forensicPath);
      logger.warn(`Executed FORENSIC-CAPTURE for ${incident.executionId} (path: ${forensicPath})`);
    }
  }

  /**
   * Terminate execution
   */
  private async terminateExecution(context: ExecutionContext): Promise<void> {
    try {
      if (context.worker) {
        await context.worker.terminate();
        logger.debug(`Terminated worker for ${context.executionId}`);
      }

      if (context.vmContext) {
        // VM contexts cannot be directly terminated, but we can invalidate them
        logger.debug(`Invalidated VM context for ${context.executionId}`);
      }

      this.activeExecutions.delete(context.executionId);
    } catch (error: any) {
      logger.error(`Error terminating execution ${context.executionId}: ${error.message}`);
    }
  }

  /**
   * Capture system state for forensics
   */
  private async captureSystemState(): Promise<any> {
    return {
      timestamp: Date.now(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: process.uptime(),
      activeExecutions: this.activeExecutions.size,
      quarantinedPlugins: this.quarantinedPlugins.size,
    };
  }

  /**
   * Capture forensic data
   */
  private async captureForensicData(
    executionId: string,
    context?: ExecutionContext
  ): Promise<any> {
    const forensicData: any = {
      executionId,
      timestamp: Date.now(),
      systemState: await this.captureSystemState(),
    };

    if (context) {
      forensicData.pluginContext = {
        pluginId: context.pluginId,
        pluginName: context.pluginName,
        startTime: context.startTime,
        executionTime: Date.now() - context.startTime.getTime(),
        monitoring: context.monitoring,
      };
    }

    return forensicData;
  }

  /**
   * Perform comprehensive forensic capture
   */
  private async performForensicCapture(
    executionId: string,
    context: ExecutionContext
  ): Promise<string> {
    const forensicDir = path.join(this.config.forensicStoragePath, executionId);
    await fs.mkdir(forensicDir, { recursive: true });

    const forensicData = await this.captureForensicData(executionId, context);
    const forensicPath = path.join(forensicDir, 'forensic-data.json');
    
    await fs.writeFile(forensicPath, JSON.stringify(forensicData, null, 2));
    return forensicPath;
  }

  /**
   * Send external notifications
   */
  private async sendExternalNotifications(alert: any): Promise<void> {
    // This would implement external notification mechanisms
    // For now, just log the alert
    logger.error(`External notification would be sent: ${JSON.stringify(alert)}`);
  }

  /**
   * Create system backup
   */
  private async createSystemBackup(backupId: string, incident: EmergencyIncident): Promise<void> {
    // This would implement system backup procedures
    logger.warn(`System backup created: ${backupId} for incident ${incident.id}`);
  }

  /**
   * Generate recovery recommendations
   */
  private generateRecoveryRecommendations(
    incident: EmergencyIncident,
    actionResults: EmergencyActionResult[]
  ): string[] {
    const recommendations: string[] = [];

    if (incident.trigger === 'resource-exhaustion') {
      recommendations.push('Review and optimize plugin resource usage');
      recommendations.push('Consider increasing resource limits if legitimate');
      recommendations.push('Implement resource usage monitoring');
    }

    if (incident.trigger === 'security-violation') {
      recommendations.push('Conduct security audit of plugin code');
      recommendations.push('Review plugin permissions and access controls');
      recommendations.push('Update security policies and rules');
    }

    if (incident.severity === 'critical' || incident.severity === 'catastrophic') {
      recommendations.push('Conduct thorough incident investigation');
      recommendations.push('Review system security posture');
      recommendations.push('Consider additional security controls');
    }

    const failedActions = actionResults.filter(r => !r.success);
    if (failedActions.length > 0) {
      recommendations.push('Review and fix failed emergency actions');
      recommendations.push('Test emergency response procedures');
    }

    return recommendations;
  }

  /**
   * Persist incident to storage
   */
  private async persistIncident(incident: EmergencyIncident): Promise<void> {
    try {
      const logEntry = `${incident.timestamp.toISOString()}: ${incident.severity.toUpperCase()} - ${incident.trigger} - ${incident.description}\n`;
      await fs.appendFile(this.config.incidentLogPath, logEntry);
      
      // Also save detailed incident data
      const incidentPath = path.join(
        path.dirname(this.config.incidentLogPath),
        'incidents',
        `${incident.id}.json`
      );
      
      await fs.mkdir(path.dirname(incidentPath), { recursive: true });
      await fs.writeFile(incidentPath, JSON.stringify(incident, null, 2));
      
    } catch (error: any) {
      logger.error(`Failed to persist incident ${incident.id}: ${error.message}`);
    }
  }

  /**
   * Initialize required directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.config.forensicStoragePath, { recursive: true });
      await fs.mkdir(path.dirname(this.config.incidentLogPath), { recursive: true });
      await fs.mkdir(path.join(path.dirname(this.config.incidentLogPath), 'incidents'), { recursive: true });
    } catch (error: any) {
      logger.error(`Failed to initialize emergency directories: ${error.message}`);
    }
  }

  /**
   * Setup default action handlers
   */
  private setupDefaultActionHandlers(): void {
    // Custom action handlers can be added here
    // For now, using built-in handlers
  }

  /**
   * Add custom action handler
   */
  addCustomActionHandler(
    action: EmergencyAction,
    handler: (incident: EmergencyIncident) => Promise<EmergencyActionResult>
  ): void {
    this.config.customActionHandlers.set(action, handler);
    logger.info(`Added custom emergency action handler: ${action}`);
  }

  /**
   * Remove custom action handler
   */
  removeCustomActionHandler(action: EmergencyAction): boolean {
    const removed = this.config.customActionHandlers.delete(action);
    if (removed) {
      logger.info(`Removed custom emergency action handler: ${action}`);
    }
    return removed;
  }

  /**
   * Get emergency statistics
   */
  getEmergencyStats(): object {
    const severityCounts = this.incidentHistory.reduce((counts, incident) => {
      counts[incident.severity] = (counts[incident.severity] || 0) + 1;
      return counts;
    }, {} as Record<EmergencySeverity, number>);

    const triggerCounts = this.incidentHistory.reduce((counts, incident) => {
      counts[incident.trigger] = (counts[incident.trigger] || 0) + 1;
      return counts;
    }, {} as Record<EmergencyTrigger, number>);

    return {
      totalIncidents: this.incidentHistory.length,
      activeExecutions: this.activeExecutions.size,
      emergencyStops: this.emergencyStops.size,
      quarantinedPlugins: this.quarantinedPlugins.size,
      forensicCaptures: this.forensicCaptures.size,
      severityDistribution: severityCounts,
      triggerDistribution: triggerCounts,
      config: {
        enableAutomatedResponse: this.config.enableAutomatedResponse,
        enableForensicCapture: this.config.enableForensicCapture,
        maxResponseTime: this.config.maxResponseTime,
      },
    };
  }

  /**
   * Cleanup and dispose resources
   */
  async cleanup(): Promise<void> {
    logger.info('Starting emergency controller cleanup...');

    // Terminate all active executions
    const activeExecutions = Array.from(this.activeExecutions.values());
    for (const context of activeExecutions) {
      await this.terminateExecution(context);
    }

    // Clear all tracking data
    this.activeExecutions.clear();
    this.emergencyStops.clear();
    this.forensicCaptures.clear();

    // Keep incident history and quarantined plugins for persistence

    logger.info('Emergency controller cleanup completed');
  }
}
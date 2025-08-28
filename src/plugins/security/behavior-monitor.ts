/**
 * @fileoverview Real-time security monitoring and behavior analysis system
 * @lastmodified 2025-08-27T13:00:00Z
 *
 * Features: Real-time monitoring, anomaly detection, behavioral analysis, threat scoring
 * Main APIs: BehaviorMonitor class for comprehensive security event analysis
 * Constraints: Machine learning patterns, statistical analysis, real-time processing
 * Patterns: Observer pattern, event stream processing, anomaly detection, threat intelligence
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { logger } from '../../utils/logger';

/**
 * Security event types
 */
export type SecurityEventType = 
  | 'resource-violation'
  | 'code-execution' 
  | 'network-request'
  | 'file-access'
  | 'permission-escalation'
  | 'suspicious-behavior'
  | 'authentication-failure'
  | 'data-exfiltration'
  | 'timing-attack'
  | 'injection-attempt';

/**
 * Security event severity
 */
export type EventSeverity = 'info' | 'warning' | 'high' | 'critical';

/**
 * Security event data
 */
export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: EventSeverity;
  timestamp: number;
  executionId: string;
  pluginName: string;
  description: string;
  metadata: {
    source?: string;
    target?: string;
    method?: string;
    parameters?: unknown[];
    stackTrace?: string;
    userAgent?: string;
    ip?: string;
    duration?: number;
    size?: number;
  };
  context?: {
    previousEvents: string[];
    userSession?: string;
    systemLoad?: number;
    memoryUsage?: number;
  };
}

/**
 * Behavioral pattern analysis
 */
export interface BehaviorPattern {
  id: string;
  name: string;
  description: string;
  eventSequence: SecurityEventType[];
  timeWindowMs: number;
  minimumOccurrences: number;
  riskScore: number; // 0-100
  indicators: string[];
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetection {
  detected: boolean;
  confidence: number; // 0-100
  type: 'statistical' | 'pattern' | 'frequency' | 'temporal';
  description: string;
  baseline?: number;
  current?: number;
  threshold?: number;
}

/**
 * Threat assessment result
 */
export interface ThreatAssessment {
  executionId: string;
  pluginName: string;
  overallRiskScore: number; // 0-100
  threatLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  indicators: ThreatIndicator[];
  recommendations: string[];
  actions: RecommendedAction[];
}

/**
 * Threat indicator
 */
export interface ThreatIndicator {
  type: 'behavioral' | 'statistical' | 'pattern' | 'signature';
  name: string;
  description: string;
  severity: EventSeverity;
  evidence: unknown[];
  confidence: number;
}

/**
 * Recommended security action
 */
export interface RecommendedAction {
  action: 'monitor' | 'throttle' | 'isolate' | 'terminate' | 'quarantine' | 'alert';
  priority: 'low' | 'medium' | 'high' | 'immediate';
  description: string;
  automated: boolean;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  // Event collection
  enableEventCollection: boolean;
  maxEventHistory: number;
  eventRetentionMs: number;
  
  // Behavioral analysis
  enableBehaviorAnalysis: boolean;
  behaviorAnalysisIntervalMs: number;
  minimumEventsForAnalysis: number;
  
  // Anomaly detection
  enableAnomalyDetection: boolean;
  anomalyDetectionSensitivity: number; // 0-1
  baselineWindowMs: number;
  
  // Threat assessment
  enableThreatAssessment: boolean;
  threatAssessmentIntervalMs: number;
  riskThreshold: number;
  
  // Actions
  enableAutomatedResponse: boolean;
  maxAutomatedActions: number;
  actionCooldownMs: number;
  
  // Alerting
  enableAlerting: boolean;
  alertThreshold: number;
  alertCooldownMs: number;
}

/**
 * Default monitoring configuration
 */
export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  // Event collection
  enableEventCollection: true,
  maxEventHistory: 10000,
  eventRetentionMs: 24 * 60 * 60 * 1000, // 24 hours
  
  // Behavioral analysis
  enableBehaviorAnalysis: true,
  behaviorAnalysisIntervalMs: 30000, // 30 seconds
  minimumEventsForAnalysis: 5,
  
  // Anomaly detection
  enableAnomalyDetection: true,
  anomalyDetectionSensitivity: 0.7,
  baselineWindowMs: 10 * 60 * 1000, // 10 minutes
  
  // Threat assessment
  enableThreatAssessment: true,
  threatAssessmentIntervalMs: 60000, // 1 minute
  riskThreshold: 70,
  
  // Actions
  enableAutomatedResponse: true,
  maxAutomatedActions: 5,
  actionCooldownMs: 60000, // 1 minute
  
  // Alerting
  enableAlerting: true,
  alertThreshold: 80,
  alertCooldownMs: 300000, // 5 minutes
};

/**
 * Statistical baseline for anomaly detection
 */
interface StatisticalBaseline {
  mean: number;
  standardDeviation: number;
  min: number;
  max: number;
  count: number;
  lastUpdated: number;
}

/**
 * Real-time security monitoring and behavior analysis system
 */
export class BehaviorMonitor extends EventEmitter {
  private config: MonitoringConfig;
  private eventHistory = new Map<string, SecurityEvent[]>(); // executionId -> events
  private behaviorPatterns: BehaviorPattern[];
  private statisticalBaselines = new Map<string, StatisticalBaseline>();
  private threatAssessments = new Map<string, ThreatAssessment>();
  private recentActions = new Map<string, { action: RecommendedAction; timestamp: number }[]>();
  
  private analysisTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<MonitoringConfig> = {}) {
    super();
    this.config = { ...DEFAULT_MONITORING_CONFIG, ...config };
    this.behaviorPatterns = this.initializeBehaviorPatterns();
    
    this.startPeriodicAnalysis();
    this.startPeriodicCleanup();
    
    logger.info('Security behavior monitor initialized');
  }

  /**
   * Record a security event for analysis
   */
  recordEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
    };

    // Add to history
    if (!this.eventHistory.has(event.executionId)) {
      this.eventHistory.set(event.executionId, []);
    }
    
    const events = this.eventHistory.get(event.executionId)!;
    events.push(fullEvent);
    
    // Limit history size
    if (events.length > this.config.maxEventHistory) {
      events.splice(0, events.length - this.config.maxEventHistory);
    }

    // Emit event for real-time processing
    this.emit('securityEvent', fullEvent);

    // Immediate analysis for critical events
    if (event.severity === 'critical') {
      this.performImmediateAnalysis(event.executionId);
    }

    logger.debug(`Security event recorded: ${event.type} (${event.severity}) for ${event.pluginName}`);
  }

  /**
   * Get current threat assessment for an execution
   */
  getThreatAssessment(executionId: string): ThreatAssessment | null {
    return this.threatAssessments.get(executionId) || null;
  }

  /**
   * Get all threat assessments
   */
  getAllThreatAssessments(): Map<string, ThreatAssessment> {
    return new Map(this.threatAssessments);
  }

  /**
   * Get event history for an execution
   */
  getEventHistory(executionId: string): SecurityEvent[] {
    return this.eventHistory.get(executionId)?.slice() || [];
  }

  /**
   * Perform immediate analysis for critical events
   */
  private async performImmediateAnalysis(executionId: string): Promise<void> {
    try {
      const events = this.eventHistory.get(executionId) || [];
      if (events.length === 0) return;

      const assessment = await this.analyzeThreatLevel(executionId, events);
      this.threatAssessments.set(executionId, assessment);

      // Take immediate action if necessary
      if (assessment.threatLevel === 'critical' && this.config.enableAutomatedResponse) {
        await this.takeAutomatedAction(assessment);
      }

      // Emit assessment for external handlers
      this.emit('threatAssessment', assessment);

    } catch (error: any) {
      logger.error(`Immediate analysis error for ${executionId}: ${error.message}`);
    }
  }

  /**
   * Start periodic analysis timer
   */
  private startPeriodicAnalysis(): void {
    if (!this.config.enableBehaviorAnalysis && !this.config.enableThreatAssessment) {
      return;
    }

    this.analysisTimer = setInterval(async () => {
      await this.performPeriodicAnalysis();
    }, Math.min(this.config.behaviorAnalysisIntervalMs, this.config.threatAssessmentIntervalMs));
  }

  /**
   * Start periodic cleanup timer
   */
  private startPeriodicCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredData();
    }, 60000); // Clean up every minute
  }

  /**
   * Perform periodic analysis of all active executions
   */
  private async performPeriodicAnalysis(): Promise<void> {
    try {
      const activeExecutions = Array.from(this.eventHistory.keys());
      
      for (const executionId of activeExecutions) {
        const events = this.eventHistory.get(executionId) || [];
        
        if (events.length < this.config.minimumEventsForAnalysis) {
          continue;
        }

        // Behavioral analysis
        if (this.config.enableBehaviorAnalysis) {
          await this.analyzeBehaviorPatterns(executionId, events);
        }

        // Anomaly detection
        if (this.config.enableAnomalyDetection) {
          await this.detectAnomalies(executionId, events);
        }

        // Threat assessment
        if (this.config.enableThreatAssessment) {
          const assessment = await this.analyzeThreatLevel(executionId, events);
          this.threatAssessments.set(executionId, assessment);

          // Automated response
          if (assessment.overallRiskScore > this.config.riskThreshold && 
              this.config.enableAutomatedResponse) {
            await this.takeAutomatedAction(assessment);
          }

          // Alerting
          if (assessment.overallRiskScore > this.config.alertThreshold && 
              this.config.enableAlerting) {
            this.sendAlert(assessment);
          }
        }
      }

    } catch (error: any) {
      logger.error(`Periodic analysis error: ${error.message}`);
    }
  }

  /**
   * Analyze behavior patterns in event sequence
   */
  private async analyzeBehaviorPatterns(executionId: string, events: SecurityEvent[]): Promise<void> {
    const recentEvents = events.filter(e => 
      Date.now() - e.timestamp < Math.max(...this.behaviorPatterns.map(p => p.timeWindowMs))
    );

    for (const pattern of this.behaviorPatterns) {
      const matches = this.findPatternMatches(pattern, recentEvents);
      
      if (matches.length >= pattern.minimumOccurrences) {
        const lastEvent = events[events.length - 1];
        this.recordEvent({
          type: 'suspicious-behavior',
          severity: pattern.riskScore > 70 ? 'critical' : pattern.riskScore > 50 ? 'high' : 'warning',
          executionId,
          pluginName: lastEvent.pluginName,
          description: `Behavior pattern detected: ${pattern.name}`,
          metadata: {
            pattern: pattern.id,
            matches: matches.length,
            indicators: pattern.indicators,
          },
        });

        logger.warn(`Behavior pattern detected: ${pattern.name} in ${executionId} (${matches.length} matches)`);
      }
    }
  }

  /**
   * Find pattern matches in event sequence
   */
  private findPatternMatches(pattern: BehaviorPattern, events: SecurityEvent[]): SecurityEvent[][] {
    const matches: SecurityEvent[][] = [];
    const windowStart = Date.now() - pattern.timeWindowMs;
    const relevantEvents = events.filter(e => e.timestamp > windowStart);

    // Simple pattern matching - look for event type sequences
    for (let i = 0; i <= relevantEvents.length - pattern.eventSequence.length; i++) {
      const sequence = relevantEvents.slice(i, i + pattern.eventSequence.length);
      
      const sequenceTypes = sequence.map(e => e.type);
      const patternMatches = pattern.eventSequence.every((expectedType, index) => 
        expectedType === sequenceTypes[index]
      );

      if (patternMatches) {
        matches.push(sequence);
      }
    }

    return matches;
  }

  /**
   * Detect anomalies in event patterns
   */
  private async detectAnomalies(executionId: string, events: SecurityEvent[]): Promise<void> {
    const recentEvents = events.filter(e => 
      Date.now() - e.timestamp < this.config.baselineWindowMs
    );

    if (recentEvents.length < 5) return; // Need minimum events for statistical analysis

    // Frequency anomaly detection
    const eventTypes = recentEvents.map(e => e.type);
    const typeFrequency = this.calculateFrequency(eventTypes);
    
    for (const [type, frequency] of typeFrequency.entries()) {
      const baseline = this.getStatisticalBaseline(executionId, type);
      const anomaly = this.detectFrequencyAnomaly(frequency, baseline);
      
      if (anomaly.detected) {
        const lastEvent = events[events.length - 1];
        this.recordEvent({
          type: 'suspicious-behavior',
          severity: anomaly.confidence > 0.8 ? 'high' : 'warning',
          executionId,
          pluginName: lastEvent.pluginName,
          description: `Frequency anomaly detected for ${type}: ${anomaly.description}`,
          metadata: {
            anomaly: anomaly,
            baseline: baseline,
          },
        });
      }
    }

    // Temporal anomaly detection
    const timingAnomalies = this.detectTimingAnomalies(recentEvents);
    for (const anomaly of timingAnomalies) {
      if (anomaly.detected) {
        const lastEvent = events[events.length - 1];
        this.recordEvent({
          type: 'timing-attack',
          severity: 'high',
          executionId,
          pluginName: lastEvent.pluginName,
          description: `Timing anomaly detected: ${anomaly.description}`,
          metadata: { anomaly },
        });
      }
    }
  }

  /**
   * Calculate frequency distribution
   */
  private calculateFrequency<T>(items: T[]): Map<T, number> {
    const frequency = new Map<T, number>();
    for (const item of items) {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    }
    return frequency;
  }

  /**
   * Get or create statistical baseline
   */
  private getStatisticalBaseline(executionId: string, eventType: string): StatisticalBaseline {
    const key = `${executionId}:${eventType}`;
    let baseline = this.statisticalBaselines.get(key);
    
    if (!baseline) {
      baseline = {
        mean: 0,
        standardDeviation: 0,
        min: 0,
        max: 0,
        count: 0,
        lastUpdated: Date.now(),
      };
      this.statisticalBaselines.set(key, baseline);
    }
    
    return baseline;
  }

  /**
   * Detect frequency anomalies using statistical analysis
   */
  private detectFrequencyAnomaly(frequency: number, baseline: StatisticalBaseline): AnomalyDetection {
    if (baseline.count < 10) {
      // Update baseline
      this.updateBaseline(baseline, frequency);
      return { detected: false, confidence: 0, type: 'frequency', description: 'Insufficient baseline data' };
    }

    const zScore = Math.abs(frequency - baseline.mean) / Math.max(baseline.standardDeviation, 0.1);
    const threshold = 2.0 / this.config.anomalyDetectionSensitivity; // Higher sensitivity = lower threshold
    
    this.updateBaseline(baseline, frequency);

    if (zScore > threshold) {
      return {
        detected: true,
        confidence: Math.min(zScore / threshold, 1.0),
        type: 'frequency',
        description: `Unusual frequency: ${frequency} (baseline: ${baseline.mean.toFixed(2)} ± ${baseline.standardDeviation.toFixed(2)})`,
        baseline: baseline.mean,
        current: frequency,
        threshold,
      };
    }

    return { detected: false, confidence: 0, type: 'frequency', description: 'Within normal range' };
  }

  /**
   * Update statistical baseline with new data point
   */
  private updateBaseline(baseline: StatisticalBaseline, newValue: number): void {
    baseline.count++;
    const delta = newValue - baseline.mean;
    baseline.mean += delta / baseline.count;
    
    if (baseline.count === 1) {
      baseline.standardDeviation = 0;
    } else {
      const delta2 = newValue - baseline.mean;
      baseline.standardDeviation = Math.sqrt(
        ((baseline.count - 2) * Math.pow(baseline.standardDeviation, 2) + delta * delta2) / (baseline.count - 1)
      );
    }
    
    baseline.min = Math.min(baseline.min, newValue);
    baseline.max = Math.max(baseline.max, newValue);
    baseline.lastUpdated = Date.now();
  }

  /**
   * Detect timing anomalies
   */
  private detectTimingAnomalies(events: SecurityEvent[]): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];
    
    if (events.length < 3) return anomalies;

    // Check for rapid-fire events (potential automated attack)
    const intervals: number[] = [];
    for (let i = 1; i < events.length; i++) {
      intervals.push(events[i].timestamp - events[i - 1].timestamp);
    }

    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const rapidFireThreshold = 100; // 100ms

    const rapidFireCount = intervals.filter(interval => interval < rapidFireThreshold).length;
    if (rapidFireCount > intervals.length * 0.5) {
      anomalies.push({
        detected: true,
        confidence: rapidFireCount / intervals.length,
        type: 'temporal',
        description: `Rapid-fire event pattern detected (${rapidFireCount}/${intervals.length} events < ${rapidFireThreshold}ms apart)`,
        baseline: avgInterval,
        current: Math.min(...intervals),
      });
    }

    return anomalies;
  }

  /**
   * Analyze overall threat level for an execution
   */
  private async analyzeThreatLevel(executionId: string, events: SecurityEvent[]): Promise<ThreatAssessment> {
    const pluginName = events.length > 0 ? events[0].pluginName : 'unknown';
    let overallRiskScore = 0;
    const indicators: ThreatIndicator[] = [];
    const recommendations: string[] = [];
    const actions: RecommendedAction[] = [];

    // Event severity scoring
    const severityScores = { info: 1, warning: 5, high: 20, critical: 50 };
    const severityScore = events.reduce((score, event) => 
      score + severityScores[event.severity], 0);
    
    overallRiskScore += Math.min(severityScore, 100);

    // Event frequency scoring
    const recentEvents = events.filter(e => Date.now() - e.timestamp < 300000); // 5 minutes
    const frequencyScore = Math.min(recentEvents.length * 2, 50);
    overallRiskScore += frequencyScore;

    // Event type diversity scoring (more types = higher risk)
    const eventTypes = new Set(events.map(e => e.type));
    const diversityScore = Math.min(eventTypes.size * 5, 30);
    overallRiskScore += diversityScore;

    // Critical event patterns
    const criticalEvents = events.filter(e => e.severity === 'critical');
    if (criticalEvents.length > 0) {
      indicators.push({
        type: 'behavioral',
        name: 'Critical Security Events',
        description: `${criticalEvents.length} critical security events detected`,
        severity: 'critical',
        evidence: criticalEvents.map(e => e.description),
        confidence: 95,
      });
      recommendations.push('Immediate investigation required for critical security events');
      actions.push({
        action: 'isolate',
        priority: 'immediate',
        description: 'Isolate plugin execution due to critical security events',
        automated: true,
      });
    }

    // Suspicious behavior patterns
    const suspiciousBehavior = events.filter(e => e.type === 'suspicious-behavior');
    if (suspiciousBehavior.length > 0) {
      indicators.push({
        type: 'pattern',
        name: 'Suspicious Behavior Detected',
        description: `${suspiciousBehavior.length} suspicious behavior patterns identified`,
        severity: 'high',
        evidence: suspiciousBehavior.map(e => e.description),
        confidence: 80,
      });
      recommendations.push('Monitor plugin behavior closely for malicious activity');
    }

    // Resource violations
    const resourceViolations = events.filter(e => e.type === 'resource-violation');
    if (resourceViolations.length > 3) {
      indicators.push({
        type: 'behavioral',
        name: 'Excessive Resource Violations',
        description: `${resourceViolations.length} resource limit violations`,
        severity: 'high',
        evidence: resourceViolations.slice(-3).map(e => e.description),
        confidence: 70,
      });
      recommendations.push('Review resource limits and plugin resource usage');
      actions.push({
        action: 'throttle',
        priority: 'high',
        description: 'Throttle plugin execution due to resource violations',
        automated: true,
      });
    }

    // Network access attempts
    const networkEvents = events.filter(e => e.type === 'network-request');
    if (networkEvents.length > 0) {
      indicators.push({
        type: 'behavioral',
        name: 'Network Activity',
        description: `${networkEvents.length} network access attempts`,
        severity: networkEvents.length > 10 ? 'high' : 'warning',
        evidence: networkEvents.map(e => `${e.metadata.method} ${e.metadata.target}`),
        confidence: 60,
      });
      
      if (networkEvents.length > 10) {
        recommendations.push('Investigate excessive network activity for data exfiltration');
        actions.push({
          action: 'monitor',
          priority: 'medium',
          description: 'Monitor network activity for suspicious patterns',
          automated: false,
        });
      }
    }

    // Cap the risk score
    overallRiskScore = Math.min(overallRiskScore, 100);

    // Determine threat level
    let threatLevel: ThreatAssessment['threatLevel'];
    if (overallRiskScore >= 80) threatLevel = 'critical';
    else if (overallRiskScore >= 60) threatLevel = 'high';
    else if (overallRiskScore >= 40) threatLevel = 'medium';
    else if (overallRiskScore >= 20) threatLevel = 'low';
    else threatLevel = 'none';

    // Calculate confidence based on data quality
    const confidence = Math.min(95, 50 + events.length * 2); // More events = higher confidence

    return {
      executionId,
      pluginName,
      overallRiskScore,
      threatLevel,
      confidence,
      indicators,
      recommendations,
      actions,
    };
  }

  /**
   * Take automated action based on threat assessment
   */
  private async takeAutomatedAction(assessment: ThreatAssessment): Promise<void> {
    const recentActions = this.recentActions.get(assessment.executionId) || [];
    const now = Date.now();

    // Clean up old actions
    const validActions = recentActions.filter(a => 
      now - a.timestamp < this.config.actionCooldownMs
    );

    // Check if we've exceeded the maximum automated actions
    if (validActions.length >= this.config.maxAutomatedActions) {
      logger.warn(`Maximum automated actions reached for ${assessment.executionId}`);
      return;
    }

    // Find the highest priority automated action
    const automatedActions = assessment.actions
      .filter(a => a.automated)
      .sort((a, b) => {
        const priorities = { immediate: 4, high: 3, medium: 2, low: 1 };
        return priorities[b.priority] - priorities[a.priority];
      });

    if (automatedActions.length === 0) return;

    const action = automatedActions[0];
    
    // Record the action
    validActions.push({ action, timestamp: now });
    this.recentActions.set(assessment.executionId, validActions);

    // Emit action event for external handlers
    this.emit('automatedAction', {
      executionId: assessment.executionId,
      action,
      assessment,
    });

    logger.warn(`Automated action taken for ${assessment.executionId}: ${action.action} (${action.priority})`);
  }

  /**
   * Send security alert
   */
  private sendAlert(assessment: ThreatAssessment): void {
    const alertId = crypto.randomUUID();
    
    const alert = {
      id: alertId,
      timestamp: Date.now(),
      type: 'security-threat',
      severity: assessment.threatLevel,
      executionId: assessment.executionId,
      pluginName: assessment.pluginName,
      riskScore: assessment.overallRiskScore,
      indicators: assessment.indicators,
      recommendations: assessment.recommendations,
    };

    this.emit('securityAlert', alert);
    
    logger.error(`Security alert generated: ${alertId} - ${assessment.pluginName} (risk: ${assessment.overallRiskScore}/100)`);
  }

  /**
   * Clean up expired data
   */
  private cleanupExpiredData(): void {
    const cutoff = Date.now() - this.config.eventRetentionMs;
    let cleanedEvents = 0;

    // Clean up event history
    for (const [executionId, events] of this.eventHistory.entries()) {
      const filteredEvents = events.filter(e => e.timestamp > cutoff);
      
      if (filteredEvents.length === 0) {
        this.eventHistory.delete(executionId);
        this.threatAssessments.delete(executionId);
        this.recentActions.delete(executionId);
      } else {
        this.eventHistory.set(executionId, filteredEvents);
        cleanedEvents += events.length - filteredEvents.length;
      }
    }

    // Clean up baselines
    for (const [key, baseline] of this.statisticalBaselines.entries()) {
      if (Date.now() - baseline.lastUpdated > this.config.eventRetentionMs) {
        this.statisticalBaselines.delete(key);
      }
    }

    if (cleanedEvents > 0) {
      logger.debug(`Cleaned up ${cleanedEvents} expired security events`);
    }
  }

  /**
   * Initialize default behavior patterns
   */
  private initializeBehaviorPatterns(): BehaviorPattern[] {
    return [
      {
        id: 'data-exfiltration',
        name: 'Data Exfiltration Pattern',
        description: 'Multiple file reads followed by network requests',
        eventSequence: ['file-access', 'file-access', 'network-request'],
        timeWindowMs: 30000, // 30 seconds
        minimumOccurrences: 1,
        riskScore: 85,
        indicators: ['Multiple file reads', 'Network transmission', 'Data access pattern'],
      },
      {
        id: 'privilege-escalation',
        name: 'Privilege Escalation Attempt',
        description: 'Permission violations followed by resource access',
        eventSequence: ['permission-escalation', 'resource-violation'],
        timeWindowMs: 10000, // 10 seconds
        minimumOccurrences: 1,
        riskScore: 90,
        indicators: ['Permission bypass attempt', 'Resource access violation'],
      },
      {
        id: 'reconnaissance',
        name: 'System Reconnaissance',
        description: 'Multiple resource probing attempts',
        eventSequence: ['resource-violation', 'resource-violation', 'resource-violation'],
        timeWindowMs: 60000, // 1 minute
        minimumOccurrences: 1,
        riskScore: 70,
        indicators: ['Multiple resource probes', 'System exploration'],
      },
      {
        id: 'timing-attack',
        name: 'Timing Attack Pattern',
        description: 'Rapid repeated operations for timing analysis',
        eventSequence: ['code-execution', 'code-execution', 'code-execution'],
        timeWindowMs: 5000, // 5 seconds
        minimumOccurrences: 5,
        riskScore: 75,
        indicators: ['Rapid execution pattern', 'Potential timing analysis'],
      },
      {
        id: 'resource-exhaustion',
        name: 'Resource Exhaustion Attack',
        description: 'Sustained resource violations',
        eventSequence: ['resource-violation', 'resource-violation'],
        timeWindowMs: 120000, // 2 minutes
        minimumOccurrences: 10,
        riskScore: 80,
        indicators: ['Sustained resource abuse', 'DoS attempt'],
      },
    ];
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return crypto.randomUUID();
  }

  /**
   * Add custom behavior pattern
   */
  addBehaviorPattern(pattern: BehaviorPattern): void {
    this.behaviorPatterns.push(pattern);
    logger.info(`Added custom behavior pattern: ${pattern.name}`);
  }

  /**
   * Remove behavior pattern
   */
  removeBehaviorPattern(patternId: string): boolean {
    const initialLength = this.behaviorPatterns.length;
    this.behaviorPatterns = this.behaviorPatterns.filter(p => p.id !== patternId);
    
    if (this.behaviorPatterns.length < initialLength) {
      logger.info(`Removed behavior pattern: ${patternId}`);
      return true;
    }
    return false;
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): object {
    const totalEvents = Array.from(this.eventHistory.values())
      .reduce((total, events) => total + events.length, 0);
    
    const activeExecutions = this.eventHistory.size;
    const threatAssessments = this.threatAssessments.size;
    const statisticalBaselines = this.statisticalBaselines.size;

    return {
      totalEvents,
      activeExecutions,
      threatAssessments,
      statisticalBaselines,
      behaviorPatterns: this.behaviorPatterns.length,
      config: this.config,
    };
  }

  /**
   * Cleanup and stop monitoring
   */
  cleanup(): void {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.eventHistory.clear();
    this.statisticalBaselines.clear();
    this.threatAssessments.clear();
    this.recentActions.clear();

    logger.info('Behavior monitor cleanup completed');
  }
}
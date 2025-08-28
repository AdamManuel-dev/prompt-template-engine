/**
 * @fileoverview Comprehensive plugin security integration and orchestration
 * @lastmodified 2025-08-27T14:00:00Z
 *
 * Features: Security orchestration, defense-in-depth, comprehensive protection, audit integration
 * Main APIs: SecurityManager class for unified security management
 * Constraints: Enterprise-grade security, compliance requirements, audit trails
 * Patterns: Facade pattern, security orchestration, defense-in-depth, compliance framework
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { IPlugin } from '../../types';
import { logger } from '../../utils/logger';

// Import all security components
import {
  EnhancedPluginSandbox,
  EnhancedSandboxConfig,
  EnhancedExecutionResult,
} from '../sandbox/enhanced-plugin-sandbox';
import {
  ResourceMonitor,
  ResourceLimits,
  ResourceUsage,
  getResourceMonitor,
} from './resource-monitor';
import {
  SignatureVerifier,
  SignatureConfig,
  SignatureVerificationResult,
} from './signature-verifier';
import {
  CodeAnalyzer,
  AnalysisConfig,
  CodeAnalysisResult,
} from './code-analyzer';
import {
  BehaviorMonitor,
  MonitoringConfig,
  SecurityEvent,
  ThreatAssessment,
} from './behavior-monitor';
import {
  PermissionManager,
  PermissionConfig,
  PluginSecurityContext,
  PermissionCheckResult,
} from './permission-manager';
import {
  EmergencyController,
  EmergencyConfig,
  EmergencyIncident,
  EmergencyResponse,
} from './emergency-controller';
import {
  SecurityTestSuite,
  SecurityTestConfig,
  SecurityTestSuiteResult,
} from './security-test-suite';

/**
 * Comprehensive security configuration
 */
export interface SecurityConfiguration {
  // Core security features
  enableVMSandbox: boolean;
  enableResourceMonitoring: boolean;
  enableSignatureVerification: boolean;
  enableCodeAnalysis: boolean;
  enableBehaviorMonitoring: boolean;
  enablePermissionManagement: boolean;
  enableEmergencyControls: boolean;
  enableSecurityTesting: boolean;

  // Security levels
  defaultSecurityLevel: 'minimal' | 'basic' | 'standard' | 'high' | 'maximum';
  enforceStrictMode: boolean;
  enableDefenseInDepth: boolean;

  // Component configurations
  sandbox: Partial<EnhancedSandboxConfig>;
  resourceLimits: Partial<ResourceLimits>;
  signature: Partial<SignatureConfig>;
  codeAnalysis: Partial<AnalysisConfig>;
  behaviorMonitoring: Partial<MonitoringConfig>;
  permissions: Partial<PermissionConfig>;
  emergency: Partial<EmergencyConfig>;
  testing: Partial<SecurityTestConfig>;

  // Audit and compliance
  enableAuditLogging: boolean;
  auditRetentionDays: number;
  enableComplianceReporting: boolean;
  complianceStandards: string[];

  // Integration
  enableRealTimeAlerts: boolean;
  enableAutomatedResponse: boolean;
  integrationEndpoints: string[];
}

/**
 * Default comprehensive security configuration
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfiguration = {
  // Core features
  enableVMSandbox: true,
  enableResourceMonitoring: true,
  enableSignatureVerification: true,
  enableCodeAnalysis: true,
  enableBehaviorMonitoring: true,
  enablePermissionManagement: true,
  enableEmergencyControls: true,
  enableSecurityTesting: true,

  // Security levels
  defaultSecurityLevel: 'high',
  enforceStrictMode: true,
  enableDefenseInDepth: true,

  // Component configurations
  sandbox: {},
  resourceLimits: {},
  signature: {},
  codeAnalysis: {},
  behaviorMonitoring: {},
  permissions: {},
  emergency: {},
  testing: {},

  // Audit and compliance
  enableAuditLogging: true,
  auditRetentionDays: 90,
  enableComplianceReporting: true,
  complianceStandards: ['OWASP', 'NIST', 'ISO27001'],

  // Integration
  enableRealTimeAlerts: true,
  enableAutomatedResponse: true,
  integrationEndpoints: [],
};

/**
 * Unified security assessment result
 */
export interface SecurityAssessment {
  assessmentId: string;
  pluginId: string;
  pluginName: string;
  timestamp: Date;

  // Overall security posture
  securityScore: number; // 0-100
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  complianceScore: number; // 0-100

  // Component results
  codeAnalysis?: CodeAnalysisResult;
  signatureVerification?: SignatureVerificationResult;
  behaviorAssessment?: ThreatAssessment;
  securityTesting?: SecurityTestSuiteResult;

  // Security context
  securityContext: PluginSecurityContext;

  // Recommendations and actions
  recommendations: string[];
  requiredActions: string[];
  blockers: string[];

  // Compliance and audit
  complianceGaps: string[];
  auditTrail: string[];
}

/**
 * Security event types for comprehensive monitoring
 */
export interface SecurityEventData extends SecurityEvent {
  component:
    | 'sandbox'
    | 'resource'
    | 'signature'
    | 'code'
    | 'behavior'
    | 'permission'
    | 'emergency';
  correlationId?: string;
}

/**
 * Comprehensive plugin security manager with defense-in-depth
 */
export class SecurityManager extends EventEmitter {
  private config: SecurityConfiguration;

  // Security components
  private sandbox: EnhancedPluginSandbox;

  private resourceMonitor: ResourceMonitor;

  private signatureVerifier: SignatureVerifier;

  private codeAnalyzer: CodeAnalyzer;

  private behaviorMonitor: BehaviorMonitor;

  private permissionManager: PermissionManager;

  private emergencyController: EmergencyController;

  private securityTestSuite: SecurityTestSuite;

  // State management
  private pluginContexts = new Map<string, PluginSecurityContext>();

  private securityAssessments = new Map<string, SecurityAssessment>();

  private auditLog: SecurityEventData[] = [];

  constructor(config: Partial<SecurityConfiguration> = {}) {
    super();
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };

    this.initializeSecurityComponents();
    this.setupEventHandlers();

    logger.info(
      'Comprehensive security manager initialized with defense-in-depth protection'
    );
  }

  /**
   * Perform comprehensive security assessment of a plugin
   */
  async assessPluginSecurity(
    plugin: IPlugin,
    options: {
      skipTesting?: boolean;
      emergencyMode?: boolean;
      correlationId?: string;
    } = {}
  ): Promise<SecurityAssessment> {
    const assessmentId = crypto.randomUUID();
    const correlationId = options.correlationId || crypto.randomUUID();

    logger.info(
      `Starting comprehensive security assessment for plugin: ${plugin.name}`
    );

    try {
      const assessment: SecurityAssessment = {
        assessmentId,
        pluginId: `${plugin.name}@${plugin.version}`,
        pluginName: plugin.name,
        timestamp: new Date(),
        securityScore: 0,
        riskLevel: 'critical',
        complianceScore: 0,
        securityContext: {} as PluginSecurityContext,
        recommendations: [],
        requiredActions: [],
        blockers: [],
        complianceGaps: [],
        auditTrail: [],
      };

      // Phase 1: Static Analysis and Signature Verification
      logger.info(
        `[${correlationId}] Phase 1: Static analysis and signature verification`
      );

      if (this.config.enableCodeAnalysis) {
        assessment.codeAnalysis = await this.codeAnalyzer.analyzePlugin(plugin);
        this.logSecurityEvent('code', 'static-analysis', correlationId, {
          score: assessment.codeAnalysis.score,
          threats: assessment.codeAnalysis.threats.length,
        });
      }

      if (this.config.enableSignatureVerification) {
        assessment.signatureVerification =
          await this.signatureVerifier.verifyPlugin(plugin);
        this.logSecurityEvent(
          'signature',
          'signature-verification',
          correlationId,
          {
            valid: assessment.signatureVerification.valid,
            trustLevel: assessment.signatureVerification.trustLevel,
          }
        );
      }

      // Phase 2: Create Security Context and Permissions
      logger.info(
        `[${correlationId}] Phase 2: Security context and permission setup`
      );

      if (this.config.enablePermissionManagement) {
        const trustLevel = this.determineTrustLevel(assessment);
        assessment.securityContext =
          await this.permissionManager.createPluginContext(plugin, {
            trustLevel,
            executionId: correlationId,
          });
        this.pluginContexts.set(
          assessment.pluginId,
          assessment.securityContext
        );
      }

      // Phase 3: Runtime Security Testing (if not skipped)
      if (!options.skipTesting && this.config.enableSecurityTesting) {
        logger.info(
          `[${correlationId}] Phase 3: Comprehensive security testing`
        );

        assessment.securityTesting =
          await this.securityTestSuite.runSecurityTests(plugin);
        this.logSecurityEvent('code', 'security-testing', correlationId, {
          overallScore: assessment.securityTesting.overallScore,
          criticalFindings: assessment.securityTesting.summary.criticalFindings,
        });
      }

      // Phase 4: Calculate Overall Security Score
      assessment.securityScore = this.calculateOverallSecurityScore(assessment);
      assessment.riskLevel = this.determineRiskLevel(assessment.securityScore);
      assessment.complianceScore = this.calculateComplianceScore(assessment);

      // Phase 5: Generate Recommendations and Actions
      assessment.recommendations =
        this.generateSecurityRecommendations(assessment);
      assessment.requiredActions = this.identifyRequiredActions(assessment);
      assessment.blockers = this.identifySecurityBlockers(assessment);
      assessment.complianceGaps = this.identifyComplianceGaps(assessment);

      // Store assessment
      this.securityAssessments.set(assessmentId, assessment);

      // Emit assessment event
      this.emit('securityAssessment', assessment);

      logger.info(
        `Security assessment completed for ${plugin.name}: Score ${assessment.securityScore}/100, Risk: ${assessment.riskLevel}`
      );

      return assessment;
    } catch (error: any) {
      logger.error(
        `Security assessment failed for ${plugin.name}: ${error.message}`
      );
      throw new Error(`Security assessment failed: ${error.message}`);
    }
  }

  /**
   * Execute plugin with comprehensive security enforcement
   */
  async executePluginSecurely(
    plugin: IPlugin,
    method: string = 'execute',
    args: unknown[] = [],
    options: {
      skipAssessment?: boolean;
      emergencyMode?: boolean;
      maxExecutionTime?: number;
    } = {}
  ): Promise<EnhancedExecutionResult> {
    const executionId = crypto.randomUUID();

    logger.info(`Starting secure plugin execution: ${plugin.name}.${method}`);

    try {
      // Pre-execution security assessment (unless skipped)
      let assessment: SecurityAssessment | undefined;
      if (!options.skipAssessment) {
        assessment = await this.assessPluginSecurity(plugin, {
          correlationId: executionId,
          emergencyMode: options.emergencyMode,
        });

        // Check for security blockers
        if (assessment.blockers.length > 0) {
          throw new Error(
            `Security blockers prevent execution: ${assessment.blockers.join(', ')}`
          );
        }

        // Check risk level
        if (assessment.riskLevel === 'critical' && !options.emergencyMode) {
          throw new Error(
            `Critical security risk prevents execution: score ${assessment.securityScore}/100`
          );
        }
      }

      // Register with emergency controller
      if (this.config.enableEmergencyControls) {
        this.emergencyController.registerExecution(
          executionId,
          assessment?.pluginId || plugin.name,
          plugin.name
        );
      }

      // Start resource monitoring
      if (this.config.enableResourceMonitoring) {
        this.resourceMonitor.startMonitoring(executionId);
      }

      // Start behavior monitoring
      if (this.config.enableBehaviorMonitoring) {
        this.behaviorMonitor.recordEvent({
          type: 'code-execution',
          severity: 'info',
          executionId,
          pluginName: plugin.name,
          description: `Plugin execution started: ${method}`,
          metadata: { method, args },
        });
      }

      // Execute in sandbox with comprehensive monitoring
      const result = await this.sandbox.executePlugin(
        plugin,
        method,
        {
          ...this.config.sandbox,
          enableRuntimeMonitoring: true,
          enableBehaviorAnalysis: true,
          maxExecutionTimeMs:
            options.maxExecutionTime || this.config.sandbox.maxExecutionTimeMs,
        },
        args
      );

      // Post-execution analysis
      if (this.config.enableBehaviorMonitoring) {
        const behaviorAssessment =
          this.behaviorMonitor.getThreatAssessment(executionId);
        if (
          behaviorAssessment &&
          behaviorAssessment.threatLevel === 'critical'
        ) {
          logger.warn(
            `Critical threat detected during execution of ${plugin.name}`
          );

          // Trigger emergency response if needed
          if (this.config.enableEmergencyControls) {
            await this.emergencyController.triggerEmergency(
              executionId,
              'malicious-behavior',
              'critical',
              `Critical behavioral threat detected: ${behaviorAssessment.indicators.map(i => i.description).join(', ')}`
            );
          }
        }
      }

      // Cleanup monitoring
      if (this.config.enableResourceMonitoring) {
        this.resourceMonitor.stopMonitoring(executionId);
      }

      if (this.config.enableEmergencyControls) {
        this.emergencyController.unregisterExecution(executionId);
      }

      logger.info(
        `Secure plugin execution completed: ${plugin.name}.${method} (${result.success ? 'success' : 'failed'})`
      );

      return result;
    } catch (error: any) {
      logger.error(
        `Secure plugin execution failed for ${plugin.name}: ${error.message}`
      );

      // Emergency cleanup
      if (this.config.enableResourceMonitoring) {
        this.resourceMonitor.stopMonitoring(executionId);
      }
      if (this.config.enableEmergencyControls) {
        this.emergencyController.unregisterExecution(executionId);
      }

      throw error;
    }
  }

  /**
   * Check plugin permission with comprehensive validation
   */
  async checkPermission(
    pluginId: string,
    permission: string,
    resource?: string,
    context?: Record<string, unknown>
  ): Promise<PermissionCheckResult> {
    if (!this.config.enablePermissionManagement) {
      return {
        granted: true,
        reason: 'Permission management disabled',
        auditInfo: {
          timestamp: new Date(),
          decision: 'allow',
        },
      };
    }

    const result = await this.permissionManager.checkPermission(
      pluginId,
      permission as any,
      resource,
      context
    );

    // Log permission check
    this.logSecurityEvent('permission', 'permission-check', undefined, {
      pluginId,
      permission,
      resource,
      granted: result.granted,
      reason: result.reason,
    });

    return result;
  }

  /**
   * Get security assessment by ID
   */
  getSecurityAssessment(assessmentId: string): SecurityAssessment | null {
    return this.securityAssessments.get(assessmentId) || null;
  }

  /**
   * Get all security assessments for a plugin
   */
  getPluginSecurityAssessments(pluginId: string): SecurityAssessment[] {
    return Array.from(this.securityAssessments.values()).filter(
      assessment => assessment.pluginId === pluginId
    );
  }

  /**
   * Get comprehensive security statistics
   */
  getSecurityStats(): object {
    const assessments = Array.from(this.securityAssessments.values());
    const riskDistribution = assessments.reduce(
      (dist, assessment) => {
        dist[assessment.riskLevel] = (dist[assessment.riskLevel] || 0) + 1;
        return dist;
      },
      {} as Record<string, number>
    );

    return {
      totalAssessments: assessments.length,
      averageSecurityScore:
        assessments.length > 0
          ? Math.round(
              assessments.reduce((sum, a) => sum + a.securityScore, 0) /
                assessments.length
            )
          : 0,
      averageComplianceScore:
        assessments.length > 0
          ? Math.round(
              assessments.reduce((sum, a) => sum + a.complianceScore, 0) /
                assessments.length
            )
          : 0,
      riskDistribution,
      auditLogSize: this.auditLog.length,
      activeContexts: this.pluginContexts.size,
      config: {
        securityLevel: this.config.defaultSecurityLevel,
        enabledFeatures: {
          vmSandbox: this.config.enableVMSandbox,
          resourceMonitoring: this.config.enableResourceMonitoring,
          signatureVerification: this.config.enableSignatureVerification,
          codeAnalysis: this.config.enableCodeAnalysis,
          behaviorMonitoring: this.config.enableBehaviorMonitoring,
          permissionManagement: this.config.enablePermissionManagement,
          emergencyControls: this.config.enableEmergencyControls,
          securityTesting: this.config.enableSecurityTesting,
        },
      },
      componentStats: {
        sandbox: this.config.enableVMSandbox,
        resourceMonitor: this.resourceMonitor.generateReport(),
        emergencyController: this.emergencyController.getEmergencyStats(),
        permissionManager: this.permissionManager.getStats(),
        securityTestSuite: this.securityTestSuite.getTestStats(),
      },
    };
  }

  /**
   * Initialize all security components
   */
  private initializeSecurityComponents(): void {
    if (this.config.enableVMSandbox) {
      this.sandbox = new EnhancedPluginSandbox(this.config.sandbox);
    }

    if (this.config.enableResourceMonitoring) {
      this.resourceMonitor = getResourceMonitor(this.config.resourceLimits);
    }

    if (this.config.enableSignatureVerification) {
      this.signatureVerifier = new SignatureVerifier(this.config.signature);
    }

    if (this.config.enableCodeAnalysis) {
      this.codeAnalyzer = new CodeAnalyzer(this.config.codeAnalysis);
    }

    if (this.config.enableBehaviorMonitoring) {
      this.behaviorMonitor = new BehaviorMonitor(
        this.config.behaviorMonitoring
      );
    }

    if (this.config.enablePermissionManagement) {
      this.permissionManager = new PermissionManager(this.config.permissions);
    }

    if (this.config.enableEmergencyControls) {
      this.emergencyController = new EmergencyController(this.config.emergency);
    }

    if (this.config.enableSecurityTesting) {
      this.securityTestSuite = new SecurityTestSuite(this.config.testing);
    }

    logger.info('All security components initialized successfully');
  }

  /**
   * Setup event handlers for component integration
   */
  private setupEventHandlers(): void {
    // Emergency controller events
    if (this.config.enableEmergencyControls) {
      this.emergencyController.on(
        'emergency',
        (response: EmergencyResponse) => {
          this.emit('emergency', response);
          this.logSecurityEvent(
            'emergency',
            'emergency-response',
            response.incident.executionId,
            {
              trigger: response.incident.trigger,
              severity: response.incident.severity,
              success: response.success,
            }
          );
        }
      );

      this.emergencyController.on(
        'quarantine',
        (data: { pluginId: string; reason: string }) => {
          this.emit('quarantine', data);
          logger.warn(`Plugin quarantined: ${data.pluginId} - ${data.reason}`);
        }
      );
    }

    // Behavior monitor events
    if (this.config.enableBehaviorMonitoring) {
      this.behaviorMonitor.on(
        'threatAssessment',
        (assessment: ThreatAssessment) => {
          if (
            assessment.threatLevel === 'critical' ||
            assessment.threatLevel === 'high'
          ) {
            this.emit('threatDetected', assessment);
          }
        }
      );

      this.behaviorMonitor.on('securityAlert', (alert: any) => {
        this.emit('securityAlert', alert);
      });
    }

    // Permission manager events
    if (this.config.enablePermissionManagement) {
      this.permissionManager.on('permissionAudit', (event: any) => {
        this.logSecurityEvent(
          'permission',
          'permission-audit',
          event.context?.executionId,
          event
        );
      });
    }

    // Resource monitor events
    if (this.config.enableResourceMonitoring) {
      this.resourceMonitor.on('violation', (violation: any) => {
        this.logSecurityEvent(
          'resource',
          'resource-violation',
          violation.executionId,
          violation
        );
      });

      this.resourceMonitor.on(
        'emergency',
        (executionId: string, reason: string) => {
          if (this.config.enableEmergencyControls) {
            this.emergencyController.triggerEmergency(
              executionId,
              'resource-exhaustion',
              'critical',
              reason
            );
          }
        }
      );
    }
  }

  /**
   * Log security event with correlation
   */
  private logSecurityEvent(
    component: SecurityEventData['component'],
    eventType: string,
    correlationId?: string,
    data?: any
  ): void {
    const event: SecurityEventData = {
      id: crypto.randomUUID(),
      type: eventType as any,
      severity: 'info',
      timestamp: Date.now(),
      executionId: correlationId || 'unknown',
      pluginName: data?.pluginName || 'unknown',
      description: `${component} event: ${eventType}`,
      metadata: data,
      component,
      correlationId,
    };

    this.auditLog.push(event);

    // Trim audit log if too large
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }

    this.emit('securityEvent', event);
  }

  /**
   * Determine plugin trust level based on assessment
   */
  private determineTrustLevel(
    assessment: SecurityAssessment
  ): PluginSecurityContext['trustLevel'] {
    if (assessment.signatureVerification?.trustLevel === 'official') {
      return 'system';
    }
    if (assessment.signatureVerification?.trustLevel === 'trusted') {
      return 'trusted';
    }
    if (assessment.signatureVerification?.trustLevel === 'verified') {
      return 'verified';
    }
    if (assessment.codeAnalysis?.safe && assessment.codeAnalysis.score > 80) {
      return 'basic';
    }
    return 'untrusted';
  }

  /**
   * Calculate overall security score
   */
  private calculateOverallSecurityScore(
    assessment: SecurityAssessment
  ): number {
    const scores: number[] = [];
    const weights: number[] = [];

    if (assessment.codeAnalysis) {
      scores.push(assessment.codeAnalysis.score);
      weights.push(30);
    }

    if (assessment.signatureVerification) {
      const sigScore = assessment.signatureVerification.valid ? 100 : 0;
      scores.push(sigScore);
      weights.push(25);
    }

    if (assessment.securityTesting) {
      scores.push(assessment.securityTesting.overallScore);
      weights.push(35);
    }

    if (assessment.behaviorAssessment) {
      const behaviorScore =
        100 - assessment.behaviorAssessment.overallRiskScore;
      scores.push(behaviorScore);
      weights.push(10);
    }

    if (scores.length === 0) return 0;

    const weightedSum = scores.reduce(
      (sum, score, index) => sum + score * weights[index],
      0
    );
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Determine risk level from security score
   */
  private determineRiskLevel(score: number): SecurityAssessment['riskLevel'] {
    if (score >= 90) return 'none';
    if (score >= 75) return 'low';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'high';
    return 'critical';
  }

  /**
   * Calculate compliance score
   */
  private calculateComplianceScore(assessment: SecurityAssessment): number {
    if (assessment.securityTesting?.complianceScore) {
      return assessment.securityTesting.complianceScore;
    }

    // Basic compliance calculation
    let score = 100;

    if (!assessment.signatureVerification?.valid) score -= 20;
    if (assessment.codeAnalysis && !assessment.codeAnalysis.safe) score -= 30;
    if (assessment.securityScore < 70) score -= 25;

    return Math.max(score, 0);
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(
    assessment: SecurityAssessment
  ): string[] {
    const recommendations = new Set<string>();

    if (assessment.securityScore < 70) {
      recommendations.add('Improve overall security posture before deployment');
    }

    if (assessment.codeAnalysis && !assessment.codeAnalysis.safe) {
      recommendations.add(
        'Address all critical and high-severity code vulnerabilities'
      );
      recommendations.add('Follow secure coding best practices');
    }

    if (
      assessment.signatureVerification &&
      !assessment.signatureVerification.valid
    ) {
      recommendations.add('Implement proper plugin signing and verification');
    }

    if (assessment.complianceScore < 80) {
      recommendations.add('Address compliance gaps to meet security standards');
    }

    if (assessment.securityTesting) {
      assessment.securityTesting.recommendations.forEach(rec =>
        recommendations.add(rec)
      );
    }

    return Array.from(recommendations);
  }

  /**
   * Identify required security actions
   */
  private identifyRequiredActions(assessment: SecurityAssessment): string[] {
    const actions: string[] = [];

    if (assessment.riskLevel === 'critical') {
      actions.push(
        'Block plugin execution until critical security issues are resolved'
      );
    }

    if (assessment.codeAnalysis?.threatLevel === 'critical') {
      actions.push('Fix critical code vulnerabilities immediately');
    }

    if (
      assessment.securityTesting &&
      assessment.securityTesting.summary.criticalFindings > 0
    ) {
      actions.push('Address all critical security test failures');
    }

    return actions;
  }

  /**
   * Identify security blockers
   */
  private identifySecurityBlockers(assessment: SecurityAssessment): string[] {
    const blockers: string[] = [];

    if (this.config.enforceStrictMode) {
      if (assessment.riskLevel === 'critical') {
        blockers.push('Critical security risk level in strict mode');
      }

      if (assessment.codeAnalysis?.threatLevel === 'critical') {
        blockers.push('Critical code vulnerabilities detected');
      }

      if (
        this.config.enableSignatureVerification &&
        assessment.signatureVerification &&
        !assessment.signatureVerification.valid
      ) {
        blockers.push('Invalid or missing plugin signature');
      }
    }

    return blockers;
  }

  /**
   * Identify compliance gaps
   */
  private identifyComplianceGaps(assessment: SecurityAssessment): string[] {
    const gaps: string[] = [];

    if (assessment.complianceScore < 80) {
      gaps.push('Overall compliance score below threshold');
    }

    if (assessment.securityTesting?.complianceGaps) {
      gaps.push(...assessment.securityTesting.complianceGaps);
    }

    return gaps;
  }

  /**
   * Get security audit log
   */
  getAuditLog(limit?: number): SecurityEventData[] {
    const log = [...this.auditLog].reverse();
    return limit ? log.slice(0, limit) : log;
  }

  /**
   * Cleanup and dispose of all security components
   */
  async cleanup(): Promise<void> {
    logger.info('Starting comprehensive security manager cleanup...');

    const cleanupPromises: Promise<void>[] = [];

    if (this.sandbox) {
      cleanupPromises.push(this.sandbox.cleanup());
    }

    if (this.resourceMonitor) {
      this.resourceMonitor.cleanup();
    }

    if (this.signatureVerifier) {
      this.signatureVerifier.cleanup();
    }

    if (this.codeAnalyzer) {
      this.codeAnalyzer.cleanup();
    }

    if (this.behaviorMonitor) {
      this.behaviorMonitor.cleanup();
    }

    if (this.permissionManager) {
      this.permissionManager.cleanup();
    }

    if (this.emergencyController) {
      cleanupPromises.push(this.emergencyController.cleanup());
    }

    if (this.securityTestSuite) {
      cleanupPromises.push(this.securityTestSuite.cleanup());
    }

    await Promise.all(cleanupPromises);

    // Clear local state
    this.pluginContexts.clear();
    this.securityAssessments.clear();
    this.auditLog.length = 0;

    logger.info('Comprehensive security manager cleanup completed');
  }
}

// Export all security components for individual use
export {
  EnhancedPluginSandbox,
  ResourceMonitor,
  SignatureVerifier,
  CodeAnalyzer,
  BehaviorMonitor,
  PermissionManager,
  EmergencyController,
  SecurityTestSuite,
  getResourceMonitor,
};

// Export types
export type {
  SecurityConfiguration,
  SecurityAssessment,
  SecurityEventData,
  EnhancedSandboxConfig,
  EnhancedExecutionResult,
  ResourceLimits,
  ResourceUsage,
  SignatureConfig,
  SignatureVerificationResult,
  AnalysisConfig,
  CodeAnalysisResult,
  MonitoringConfig,
  SecurityEvent,
  ThreatAssessment,
  PermissionConfig,
  PluginSecurityContext,
  PermissionCheckResult,
  EmergencyConfig,
  EmergencyIncident,
  EmergencyResponse,
  SecurityTestConfig,
  SecurityTestSuiteResult,
};

// Default export
export default SecurityManager;

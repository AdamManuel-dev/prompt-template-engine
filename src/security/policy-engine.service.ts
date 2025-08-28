/**
 * @fileoverview Authorization policy engine with advanced rule evaluation
 * @lastmodified 2025-08-27T17:30:00Z
 *
 * Features: Policy-based authorization, rule evaluation, context-aware decisions
 * Main APIs: evaluatePolicy(), createPolicy(), managePolicies(), contextEvaluation()
 * Constraints: High-performance evaluation, flexible rule definitions, audit trails
 * Patterns: Policy engine, rule evaluation, context-based authorization, caching
 */

import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { rbacManager } from './rbac-manager.service';
import { auditLogger } from './audit-logger.service';
import type { AccessContext } from './rbac-manager.service';

export type PolicyEffect = 'allow' | 'deny';
export type PolicyOperator =
  | 'eq'
  | 'ne'
  | 'lt'
  | 'le'
  | 'gt'
  | 'ge'
  | 'in'
  | 'nin'
  | 'contains'
  | 'regex'
  | 'exists'
  | 'not_exists';
export type PolicyConditionLogic = 'and' | 'or' | 'not';

export interface PolicyCondition {
  field: string;
  operator: PolicyOperator;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'array' | 'date' | 'object';
}

export interface PolicyRule {
  id: string;
  description: string;
  conditions: PolicyCondition[];
  conditionLogic: PolicyConditionLogic;
  effect: PolicyEffect;
  priority: number; // Higher priority = evaluated first
  metadata?: Record<string, any>;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'active' | 'inactive' | 'draft';

  // Policy targets
  subjects: string[]; // User IDs, roles, or patterns
  resources: string[]; // Resource patterns
  actions: string[]; // Action patterns

  // Rules and evaluation
  rules: PolicyRule[];
  defaultEffect: PolicyEffect;

  // Context requirements
  requiredContext: string[]; // Required context fields

  // Policy metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
  tags: string[];

  // Scheduling
  effectiveFrom?: Date;
  effectiveUntil?: Date;

  // Performance and caching
  cacheable: boolean;
  cacheTimeout?: number; // milliseconds
}

export interface PolicyEvaluationContext extends AccessContext {
  // Extended context for policy evaluation
  environment: {
    time: Date;
    dayOfWeek: number; // 0 = Sunday
    hour: number; // 0-23
    timezone: string;
  };

  request: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: any;
    query?: Record<string, string>;
  };

  subject: {
    userId: string;
    username?: string;
    email?: string;
    roles: string[];
    permissions: string[];
    groups?: string[];
    attributes?: Record<string, any>;
  };

  // Risk and trust factors
  risk: {
    userRiskScore: number;
    deviceRiskScore: number;
    locationRiskScore: number;
    behaviorRiskScore: number;
    overallRiskScore: number;
  };

  // Session and device info
  session: {
    sessionId: string;
    deviceId?: string;
    deviceTrusted: boolean;
    sessionAge: number; // milliseconds
    lastActivity: Date;
  };

  // Custom attributes
  custom?: Record<string, any>;
}

export interface PolicyEvaluationResult {
  decision: PolicyEffect;
  applicablePolicies: Policy[];
  evaluatedRules: Array<{
    policyId: string;
    ruleId: string;
    matched: boolean;
    effect: PolicyEffect;
    reason: string;
  }>;
  reason: string;
  confidence: number; // 0-1, confidence in the decision

  // Performance metrics
  evaluationTime: number; // milliseconds
  rulesEvaluated: number;
  conditionsEvaluated: number;
  cacheHit: boolean;

  // Compliance and audit
  auditInfo: {
    timestamp: Date;
    contextHash: string;
    policies: string[]; // Policy IDs
    finalDecision: PolicyEffect;
  };
}

/**
 * Authorization Policy Engine
 */
export class PolicyEngineService {
  private policies = new Map<string, Policy>();

  private policyCache = new Map<
    string,
    {
      result: PolicyEvaluationResult;
      timestamp: Date;
      expiry: Date;
    }
  >();

  // Performance tracking
  private stats = {
    totalEvaluations: 0,
    cacheHits: 0,
    averageEvaluationTime: 0,
    totalEvaluationTime: 0,
    policiesLoaded: 0,
    rulesEvaluated: 0,
    conditionsEvaluated: 0,
  };

  constructor() {
    this.initializeDefaultPolicies();

    // Clear cache periodically
    setInterval(() => this.cleanupCache(), 300000); // Every 5 minutes
  }

  /**
   * Evaluate authorization policies for a given context
   */
  async evaluatePolicy(
    context: PolicyEvaluationContext
  ): Promise<PolicyEvaluationResult> {
    const startTime = Date.now();
    this.stats.totalEvaluations++;

    try {
      // Generate context hash for caching
      const contextHash = this.generateContextHash(context);

      // Check cache first
      const cachedResult = this.getCachedResult(contextHash);
      if (cachedResult) {
        this.stats.cacheHits++;
        return {
          ...cachedResult,
          cacheHit: true,
          evaluationTime: Date.now() - startTime,
        };
      }

      // Find applicable policies
      const applicablePolicies = this.findApplicablePolicies(context);

      if (applicablePolicies.length === 0) {
        return this.createDefaultResult(
          context,
          'deny',
          'No applicable policies found',
          startTime
        );
      }

      // Evaluate policies by priority
      const evaluatedRules: PolicyEvaluationResult['evaluatedRules'] = [];
      let finalDecision: PolicyEffect = 'deny';
      let decisionReason = 'Default deny';
      let confidence = 1.0;
      let rulesEvaluated = 0;
      let conditionsEvaluated = 0;

      // Sort policies by priority (higher first)
      const sortedPolicies = applicablePolicies.sort((a, b) => {
        const aMaxPriority = Math.max(...a.rules.map(r => r.priority));
        const bMaxPriority = Math.max(...b.rules.map(r => r.priority));
        return bMaxPriority - aMaxPriority;
      });

      // Evaluate policies
      for (const policy of sortedPolicies) {
        const policyResult = await this.evaluatePolicyRules(policy, context);

        evaluatedRules.push(...policyResult.evaluatedRules);
        rulesEvaluated += policyResult.rulesEvaluated;
        conditionsEvaluated += policyResult.conditionsEvaluated;

        // Check for explicit allow or deny
        if (policyResult.decision === 'allow') {
          finalDecision = 'allow';
          decisionReason = policyResult.reason;
          confidence = policyResult.confidence;
          break; // First allow wins
        } else if (
          policyResult.decision === 'deny' &&
          finalDecision !== 'allow'
        ) {
          finalDecision = 'deny';
          decisionReason = policyResult.reason;
          confidence = Math.min(confidence, policyResult.confidence);
        }
      }

      const evaluationTime = Date.now() - startTime;

      // Update stats
      this.stats.rulesEvaluated += rulesEvaluated;
      this.stats.conditionsEvaluated += conditionsEvaluated;
      this.stats.totalEvaluationTime += evaluationTime;
      this.stats.averageEvaluationTime =
        this.stats.totalEvaluationTime / this.stats.totalEvaluations;

      const result: PolicyEvaluationResult = {
        decision: finalDecision,
        applicablePolicies,
        evaluatedRules,
        reason: decisionReason,
        confidence,
        evaluationTime,
        rulesEvaluated,
        conditionsEvaluated,
        cacheHit: false,
        auditInfo: {
          timestamp: new Date(),
          contextHash,
          policies: applicablePolicies.map(p => p.id),
          finalDecision,
        },
      };

      // Cache result if applicable
      if (applicablePolicies.some(p => p.cacheable)) {
        this.cacheResult(contextHash, result, applicablePolicies);
      }

      // Log audit event
      await this.logPolicyEvaluation(context, result);

      logger.debug('Policy evaluation completed', {
        decision: finalDecision,
        evaluationTime,
        applicablePolicies: applicablePolicies.length,
        rulesEvaluated,
      });

      return result;
    } catch (error) {
      logger.error('Policy evaluation failed', error as Error);

      // Fail securely with deny
      return this.createDefaultResult(
        context,
        'deny',
        'Policy evaluation error',
        startTime
      );
    }
  }

  /**
   * Create or update a policy
   */
  async createPolicy(
    policyData: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Policy> {
    try {
      const policy: Policy = {
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...policyData,
      };

      // Validate policy structure
      this.validatePolicy(policy);

      // Store policy
      this.policies.set(policy.id, policy);
      this.stats.policiesLoaded++;

      // Clear cache when policies change
      this.clearCache();

      logger.info('Policy created', {
        policyId: policy.id,
        name: policy.name,
        rulesCount: policy.rules.length,
      });

      // Audit log
      await auditLogger.logEvent({
        eventType: 'system_configuration',
        severity: 'info',
        action: 'policy_created',
        resource: 'policy_engine',
        clientInfo: {
          ipAddress: '127.0.0.1',
          userAgent: 'system',
        },
        details: {
          description: `Policy ${policy.name} created`,
          success: true,
          metadata: { policyId: policy.id, rulesCount: policy.rules.length },
        },
        riskScore: 20,
        complianceFlags: {
          pii: false,
          sensitive: true,
          financial: false,
          medical: false,
        },
        retentionClass: 'extended',
      });

      return policy;
    } catch (error) {
      logger.error('Policy creation failed', error as Error);
      throw error;
    }
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(
    policyId: string,
    updates: Partial<Policy>
  ): Promise<Policy | null> {
    try {
      const existingPolicy = this.policies.get(policyId);
      if (!existingPolicy) {
        return null;
      }

      const updatedPolicy: Policy = {
        ...existingPolicy,
        ...updates,
        id: policyId, // Ensure ID cannot be changed
        updatedAt: new Date(),
      };

      // Validate updated policy
      this.validatePolicy(updatedPolicy);

      // Store updated policy
      this.policies.set(policyId, updatedPolicy);

      // Clear cache
      this.clearCache();

      logger.info('Policy updated', {
        policyId,
        updates: Object.keys(updates),
      });

      return updatedPolicy;
    } catch (error) {
      logger.error('Policy update failed', error as Error);
      throw error;
    }
  }

  /**
   * Delete a policy
   */
  async deletePolicy(policyId: string): Promise<boolean> {
    try {
      const policy = this.policies.get(policyId);
      if (!policy) {
        return false;
      }

      this.policies.delete(policyId);
      this.clearCache();

      logger.info('Policy deleted', { policyId, name: policy.name });

      return true;
    } catch (error) {
      logger.error('Policy deletion failed', error as Error);
      throw error;
    }
  }

  /**
   * Get all policies or filter by criteria
   */
  getPolicies(filter?: {
    status?: Policy['status'];
    subjects?: string[];
    resources?: string[];
    actions?: string[];
    tags?: string[];
  }): Policy[] {
    let policies = Array.from(this.policies.values());

    if (filter) {
      if (filter.status) {
        policies = policies.filter(p => p.status === filter.status);
      }

      if (filter.subjects) {
        policies = policies.filter(p =>
          p.subjects.some(subject =>
            filter.subjects!.some(filterSubject =>
              this.matchesPattern(filterSubject, subject)
            )
          )
        );
      }

      if (filter.resources) {
        policies = policies.filter(p =>
          p.resources.some(resource =>
            filter.resources!.some(filterResource =>
              this.matchesPattern(filterResource, resource)
            )
          )
        );
      }

      if (filter.actions) {
        policies = policies.filter(p =>
          p.actions.some(action =>
            filter.actions!.some(filterAction =>
              this.matchesPattern(filterAction, action)
            )
          )
        );
      }

      if (filter.tags) {
        policies = policies.filter(p =>
          filter.tags!.some(tag => p.tags.includes(tag))
        );
      }
    }

    return policies;
  }

  /**
   * Get policy by ID
   */
  getPolicy(policyId: string): Policy | null {
    return this.policies.get(policyId) || null;
  }

  /**
   * Test policy evaluation with mock context
   */
  async testPolicy(
    policyId: string,
    mockContext: Partial<PolicyEvaluationContext>
  ): Promise<PolicyEvaluationResult> {
    const policy = this.getPolicy(policyId);
    if (!policy) {
      throw new Error('Policy not found');
    }

    // Create full test context
    const testContext: PolicyEvaluationContext = {
      userId: 'test-user',
      resource: 'test-resource',
      action: 'test-action',
      timestamp: new Date(),
      environment: {
        time: new Date(),
        dayOfWeek: new Date().getDay(),
        hour: new Date().getHours(),
        timezone: 'UTC',
      },
      request: {},
      subject: {
        userId: 'test-user',
        roles: [],
        permissions: [],
      },
      risk: {
        userRiskScore: 50,
        deviceRiskScore: 50,
        locationRiskScore: 50,
        behaviorRiskScore: 50,
        overallRiskScore: 50,
      },
      session: {
        sessionId: 'test-session',
        deviceTrusted: true,
        sessionAge: 0,
        lastActivity: new Date(),
      },
      ...mockContext,
    };

    return this.evaluatePolicy(testContext);
  }

  /**
   * Private helper methods
   */
  private findApplicablePolicies(context: PolicyEvaluationContext): Policy[] {
    const now = new Date();

    return Array.from(this.policies.values()).filter(policy => {
      // Check policy status
      if (policy.status !== 'active') {
        return false;
      }

      // Check effective dates
      if (policy.effectiveFrom && now < policy.effectiveFrom) {
        return false;
      }
      if (policy.effectiveUntil && now > policy.effectiveUntil) {
        return false;
      }

      // Check subject match
      if (
        !this.matchesAnyPattern(context.subject.userId, policy.subjects) &&
        !policy.subjects.some(subject =>
          context.subject.roles.includes(subject)
        )
      ) {
        return false;
      }

      // Check resource match
      if (!this.matchesAnyPattern(context.resource, policy.resources)) {
        return false;
      }

      // Check action match
      if (!this.matchesAnyPattern(context.action, policy.actions)) {
        return false;
      }

      return true;
    });
  }

  private async evaluatePolicyRules(
    policy: Policy,
    context: PolicyEvaluationContext
  ): Promise<{
    decision: PolicyEffect;
    reason: string;
    confidence: number;
    evaluatedRules: PolicyEvaluationResult['evaluatedRules'];
    rulesEvaluated: number;
    conditionsEvaluated: number;
  }> {
    const evaluatedRules: PolicyEvaluationResult['evaluatedRules'] = [];
    let rulesEvaluated = 0;
    let conditionsEvaluated = 0;

    // Sort rules by priority
    const sortedRules = policy.rules.sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      rulesEvaluated++;

      const ruleResult = await this.evaluateRule(rule, context);
      conditionsEvaluated += ruleResult.conditionsEvaluated;

      evaluatedRules.push({
        policyId: policy.id,
        ruleId: rule.id,
        matched: ruleResult.matched,
        effect: rule.effect,
        reason: ruleResult.reason,
      });

      // If rule matches, return its effect
      if (ruleResult.matched) {
        return {
          decision: rule.effect,
          reason: `Rule ${rule.id}: ${rule.description}`,
          confidence: ruleResult.confidence,
          evaluatedRules,
          rulesEvaluated,
          conditionsEvaluated,
        };
      }
    }

    // No rules matched, use default effect
    return {
      decision: policy.defaultEffect,
      reason: `No rules matched, using default effect: ${policy.defaultEffect}`,
      confidence: 0.5,
      evaluatedRules,
      rulesEvaluated,
      conditionsEvaluated,
    };
  }

  private async evaluateRule(
    rule: PolicyRule,
    context: PolicyEvaluationContext
  ): Promise<{
    matched: boolean;
    reason: string;
    confidence: number;
    conditionsEvaluated: number;
  }> {
    let conditionsEvaluated = 0;

    if (rule.conditions.length === 0) {
      return {
        matched: true,
        reason: 'No conditions specified',
        confidence: 1.0,
        conditionsEvaluated: 0,
      };
    }

    const conditionResults: boolean[] = [];

    for (const condition of rule.conditions) {
      conditionsEvaluated++;

      const conditionResult = this.evaluateCondition(condition, context);
      conditionResults.push(conditionResult);
    }

    // Apply condition logic
    let matched: boolean;
    switch (rule.conditionLogic) {
      case 'and':
        matched = conditionResults.every(result => result);
        break;
      case 'or':
        matched = conditionResults.some(result => result);
        break;
      case 'not':
        matched = !conditionResults.every(result => result);
        break;
      default:
        matched = conditionResults.every(result => result);
    }

    const confidence =
      conditionResults.length > 0
        ? conditionResults.filter(r => r).length / conditionResults.length
        : 0;

    return {
      matched,
      reason: `Conditions evaluated with ${rule.conditionLogic} logic`,
      confidence,
      conditionsEvaluated,
    };
  }

  private evaluateCondition(
    condition: PolicyCondition,
    context: PolicyEvaluationContext
  ): boolean {
    try {
      const fieldValue = this.getFieldValue(condition.field, context);

      // Handle existence checks first
      if (condition.operator === 'exists') {
        return fieldValue !== undefined && fieldValue !== null;
      }

      if (condition.operator === 'not_exists') {
        return fieldValue === undefined || fieldValue === null;
      }

      // If field doesn't exist, condition fails (except for existence checks above)
      if (fieldValue === undefined || fieldValue === null) {
        return false;
      }

      // Type conversion if needed
      const convertedValue = this.convertValue(fieldValue, condition.type);
      const convertedExpected = this.convertValue(
        condition.value,
        condition.type
      );

      switch (condition.operator) {
        case 'eq':
          return convertedValue === convertedExpected;
        case 'ne':
          return convertedValue !== convertedExpected;
        case 'lt':
          return convertedValue < convertedExpected;
        case 'le':
          return convertedValue <= convertedExpected;
        case 'gt':
          return convertedValue > convertedExpected;
        case 'ge':
          return convertedValue >= convertedExpected;
        case 'in':
          return (
            Array.isArray(condition.value) &&
            condition.value.includes(convertedValue)
          );
        case 'nin':
          return (
            Array.isArray(condition.value) &&
            !condition.value.includes(convertedValue)
          );
        case 'contains':
          return String(convertedValue).includes(String(convertedExpected));
        case 'regex':
          return new RegExp(convertedExpected).test(String(convertedValue));
        default:
          logger.warn('Unknown condition operator', {
            operator: condition.operator,
          });
          return false;
      }
    } catch (error) {
      logger.error('Condition evaluation failed', error as Error);
      return false;
    }
  }

  private getFieldValue(field: string, context: PolicyEvaluationContext): any {
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private convertValue(value: any, type: PolicyCondition['type']): any {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return value instanceof Date ? value : new Date(value);
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' ? value : {};
      default:
        return value;
    }
  }

  private matchesPattern(value: string, pattern: string): boolean {
    // Simple glob-like pattern matching
    if (pattern === '*') {
      return true;
    }

    if (pattern.includes('*')) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      return regex.test(value);
    }

    return value === pattern;
  }

  private matchesAnyPattern(value: string, patterns: string[]): boolean {
    return patterns.some(pattern => this.matchesPattern(value, pattern));
  }

  private validatePolicy(policy: Policy): void {
    if (!policy.name || !policy.description) {
      throw new Error('Policy must have name and description');
    }

    if (!policy.subjects || policy.subjects.length === 0) {
      throw new Error('Policy must have at least one subject');
    }

    if (!policy.resources || policy.resources.length === 0) {
      throw new Error('Policy must have at least one resource');
    }

    if (!policy.actions || policy.actions.length === 0) {
      throw new Error('Policy must have at least one action');
    }

    // Validate rules
    for (const rule of policy.rules) {
      if (!rule.id || !rule.description) {
        throw new Error('Rule must have id and description');
      }

      if (!['allow', 'deny'].includes(rule.effect)) {
        throw new Error('Rule effect must be allow or deny');
      }

      // Validate conditions
      for (const condition of rule.conditions) {
        if (!condition.field || !condition.operator) {
          throw new Error('Condition must have field and operator');
        }
      }
    }
  }

  private generateContextHash(context: PolicyEvaluationContext): string {
    // Create deterministic hash from relevant context fields
    const hashInput = {
      userId: context.userId,
      resource: context.resource,
      action: context.action,
      roles: context.subject.roles.sort(),
      time: Math.floor(context.timestamp.getTime() / 60000), // Round to minute
    };

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(hashInput))
      .digest('hex');
  }

  private getCachedResult(contextHash: string): PolicyEvaluationResult | null {
    const cached = this.policyCache.get(contextHash);
    if (!cached) {
      return null;
    }

    if (new Date() > cached.expiry) {
      this.policyCache.delete(contextHash);
      return null;
    }

    return cached.result;
  }

  private cacheResult(
    contextHash: string,
    result: PolicyEvaluationResult,
    policies: Policy[]
  ): void {
    const minCacheTimeout = Math.min(
      ...policies
        .filter(p => p.cacheable && p.cacheTimeout)
        .map(p => p.cacheTimeout!)
    );

    if (minCacheTimeout) {
      const expiry = new Date(Date.now() + minCacheTimeout);
      this.policyCache.set(contextHash, {
        result,
        timestamp: new Date(),
        expiry,
      });
    }
  }

  private clearCache(): void {
    this.policyCache.clear();
  }

  private cleanupCache(): void {
    const now = new Date();
    for (const [key, cached] of this.policyCache) {
      if (now > cached.expiry) {
        this.policyCache.delete(key);
      }
    }
  }

  private createDefaultResult(
    context: PolicyEvaluationContext,
    decision: PolicyEffect,
    reason: string,
    startTime: number
  ): PolicyEvaluationResult {
    return {
      decision,
      applicablePolicies: [],
      evaluatedRules: [],
      reason,
      confidence: 1.0,
      evaluationTime: Date.now() - startTime,
      rulesEvaluated: 0,
      conditionsEvaluated: 0,
      cacheHit: false,
      auditInfo: {
        timestamp: new Date(),
        contextHash: this.generateContextHash(context),
        policies: [],
        finalDecision: decision,
      },
    };
  }

  private async logPolicyEvaluation(
    context: PolicyEvaluationContext,
    result: PolicyEvaluationResult
  ): Promise<void> {
    await auditLogger.logEvent({
      eventType: 'authorization',
      severity: result.decision === 'deny' ? 'warning' : 'info',
      userId: context.userId,
      action: 'policy_evaluation',
      resource: context.resource,
      clientInfo: context.clientInfo || {
        ipAddress: 'unknown',
        userAgent: 'unknown',
      },
      details: {
        description: `Policy evaluation: ${result.decision}`,
        success: result.decision === 'allow',
        metadata: {
          reason: result.reason,
          confidence: result.confidence,
          evaluationTime: result.evaluationTime,
          policiesEvaluated: result.applicablePolicies.length,
          rulesEvaluated: result.rulesEvaluated,
        },
      },
      riskScore: result.decision === 'deny' ? 60 : 10,
      complianceFlags: {
        pii: false,
        sensitive: true,
        financial: false,
        medical: false,
      },
      retentionClass: 'standard',
    });
  }

  private initializeDefaultPolicies(): void {
    // Default emergency access policy
    const emergencyPolicy: Policy = {
      id: 'emergency-access-policy',
      name: 'Emergency Access Policy',
      description: 'Allows emergency access for critical operations',
      version: '1.0.0',
      status: 'active',
      subjects: ['system-admin'],
      resources: ['*'],
      actions: ['emergency:*'],
      rules: [
        {
          id: 'emergency-rule-1',
          description: 'Allow emergency access for system admins',
          conditions: [
            {
              field: 'subject.roles',
              operator: 'contains',
              value: 'system-admin',
              type: 'array',
            },
          ],
          conditionLogic: 'and',
          effect: 'allow',
          priority: 1000,
        },
      ],
      defaultEffect: 'deny',
      requiredContext: ['subject.roles'],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      lastModifiedBy: 'system',
      tags: ['emergency', 'system'],
      cacheable: false,
    };

    this.policies.set(emergencyPolicy.id, emergencyPolicy);

    // Default rate limiting policy
    const rateLimitPolicy: Policy = {
      id: 'rate-limit-policy',
      name: 'Rate Limiting Policy',
      description: 'Enforces rate limits based on user risk score',
      version: '1.0.0',
      status: 'active',
      subjects: ['*'],
      resources: ['*'],
      actions: ['*'],
      rules: [
        {
          id: 'high-risk-deny',
          description: 'Deny access for high-risk users',
          conditions: [
            {
              field: 'risk.overallRiskScore',
              operator: 'gt',
              value: 80,
              type: 'number',
            },
          ],
          conditionLogic: 'and',
          effect: 'deny',
          priority: 900,
        },
        {
          id: 'medium-risk-restrict',
          description: 'Restrict access for medium-risk users during off-hours',
          conditions: [
            {
              field: 'risk.overallRiskScore',
              operator: 'gt',
              value: 50,
              type: 'number',
            },
            {
              field: 'environment.hour',
              operator: 'lt',
              value: 9,
              type: 'number',
            },
          ],
          conditionLogic: 'and',
          effect: 'deny',
          priority: 800,
        },
      ],
      defaultEffect: 'allow',
      requiredContext: ['risk.overallRiskScore', 'environment.hour'],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      lastModifiedBy: 'system',
      tags: ['rate-limiting', 'risk-based'],
      cacheable: true,
      cacheTimeout: 60000, // 1 minute
    };

    this.policies.set(rateLimitPolicy.id, rateLimitPolicy);

    this.stats.policiesLoaded = this.policies.size;

    logger.info('Default policies initialized', {
      count: this.policies.size,
    });
  }

  /**
   * Get policy engine statistics
   */
  getStats(): typeof this.stats & {
    activePolicies: number;
    cacheSize: number;
    cacheHitRate: number;
  } {
    const activePolicies = Array.from(this.policies.values()).filter(
      p => p.status === 'active'
    ).length;

    const cacheHitRate =
      this.stats.totalEvaluations > 0
        ? this.stats.cacheHits / this.stats.totalEvaluations
        : 0;

    return {
      ...this.stats,
      activePolicies,
      cacheSize: this.policyCache.size,
      cacheHitRate,
    };
  }
}

/**
 * Global policy engine instance
 */
export const policyEngine = new PolicyEngineService();

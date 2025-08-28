/**
 * @fileoverview RBAC Usage Examples - demonstrates security system integration
 * @lastmodified 2025-08-27T17:50:00Z
 *
 * Features: Complete RBAC usage examples and integration patterns
 * Main APIs: Authentication, authorization, rate limiting, audit logging
 * Constraints: Demonstrates real-world security scenarios
 * Patterns: Security middleware, comprehensive protection, audit trails
 */

import {
  securityOrchestrator,
  createSecurityMiddleware,
  jwtAuthService,
  rbacManager,
  sessionManager,
  roleBasedRateLimiter,
  auditLogger,
  policyEngine,
  authorizationMiddleware,
} from '../src/security';

/**
 * Example 1: Complete Login Flow with RBAC
 */
async function loginExample() {
  console.log('=== Login Example ===');

  const clientInfo = {
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Chrome/120.0)',
    deviceFingerprint: 'device-123',
    location: {
      country: 'US',
      region: 'CA',
    },
  };

  // Attempt login
  const loginResult = await securityOrchestrator.login(
    'john.doe',
    'password',
    clientInfo
  );

  if (loginResult.success) {
    console.log('✅ Login successful');
    console.log('Access Token:', loginResult.tokens?.accessToken.substring(0, 50) + '...');
    console.log('User Roles:', loginResult.user?.roles);
    console.log('Session ID:', loginResult.session?.sessionId);
  } else {
    console.log('❌ Login failed:', loginResult.error);
  }

  return loginResult.tokens?.accessToken;
}

/**
 * Example 2: Resource Access with Authorization
 */
async function resourceAccessExample(token: string) {
  console.log('\n=== Resource Access Example ===');

  const clientInfo = {
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Chrome/120.0)',
  };

  // Try to access templates resource
  const accessResult = await securityOrchestrator.authenticateAndAuthorize(
    token,
    'templates',
    'create',
    clientInfo
  );

  if (accessResult.success) {
    console.log('✅ Access granted to templates:create');
    console.log('User Permissions:', accessResult.permissions?.slice(0, 5));
    console.log('Rate Limit Remaining:', accessResult.rateLimitResult?.remaining);
  } else {
    console.log('❌ Access denied:', accessResult.error);
  }
}

/**
 * Example 3: Role Management
 */
async function roleManagementExample() {
  console.log('\n=== Role Management Example ===');

  try {
    // Create a custom role
    const customRole = await rbacManager.createRole({
      name: 'content-moderator',
      displayName: 'Content Moderator',
      description: 'Can moderate user-generated content',
      permissions: [], // Will be populated with specific permission IDs
      inheritsFrom: ['editor'], // Inherits from editor role
      isSystemRole: false,
      tags: ['content', 'moderation'],
    });

    console.log('✅ Custom role created:', customRole.name);

    // Assign role to user
    await rbacManager.assignRoleToUser(
      'user-123',
      customRole.id,
      'admin-user',
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    );

    console.log('✅ Role assigned to user');

    // Check user permissions
    const hasPermission = await rbacManager.hasPermission(
      'user-123',
      'templates:create'
    );

    console.log('User has templates:create permission:', hasPermission);

  } catch (error) {
    console.log('❌ Role management failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 4: Policy-Based Authorization
 */
async function policyExample() {
  console.log('\n=== Policy-Based Authorization Example ===');

  try {
    // Create a business hours policy
    const businessHoursPolicy = await policyEngine.createPolicy({
      name: 'Business Hours Access Policy',
      description: 'Restricts access to sensitive resources during business hours only',
      version: '1.0.0',
      status: 'active',
      subjects: ['user', 'editor'],
      resources: ['sensitive-data:*', 'financial:*'],
      actions: ['read', 'export'],
      rules: [
        {
          id: 'business-hours-rule',
          description: 'Allow access only during business hours (9 AM - 5 PM)',
          conditions: [
            {
              field: 'environment.hour',
              operator: 'ge',
              value: 9,
              type: 'number',
            },
            {
              field: 'environment.hour',
              operator: 'le',
              value: 17,
              type: 'number',
            },
            {
              field: 'risk.overallRiskScore',
              operator: 'lt',
              value: 50,
              type: 'number',
            },
          ],
          conditionLogic: 'and',
          effect: 'allow',
          priority: 100,
        },
      ],
      defaultEffect: 'deny',
      requiredContext: ['environment.hour', 'risk.overallRiskScore'],
      createdBy: 'system',
      lastModifiedBy: 'system',
      tags: ['business-hours', 'sensitive-data'],
      cacheable: true,
      cacheTimeout: 300000, // 5 minutes
    });

    console.log('✅ Business hours policy created:', businessHoursPolicy.id);

    // Test policy evaluation
    const testContext = {
      userId: 'user-123',
      resource: 'sensitive-data',
      action: 'read',
      timestamp: new Date(),
      environment: {
        time: new Date(),
        dayOfWeek: 2, // Tuesday
        hour: 14, // 2 PM
        timezone: 'UTC',
      },
      request: {},
      subject: {
        userId: 'user-123',
        roles: ['user'],
        permissions: ['templates:read'],
      },
      risk: {
        userRiskScore: 30,
        deviceRiskScore: 20,
        locationRiskScore: 10,
        behaviorRiskScore: 25,
        overallRiskScore: 25,
      },
      session: {
        sessionId: 'session-123',
        deviceTrusted: true,
        sessionAge: 3600000,
        lastActivity: new Date(),
      },
    };

    const policyResult = await policyEngine.evaluatePolicy(testContext);
    
    console.log('Policy Decision:', policyResult.decision);
    console.log('Confidence:', policyResult.confidence);
    console.log('Reason:', policyResult.reason);

  } catch (error) {
    console.log('❌ Policy example failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 5: Rate Limiting with Role-Based Limits
 */
async function rateLimitingExample() {
  console.log('\n=== Rate Limiting Example ===');

  try {
    // Simulate multiple requests from different user roles
    const roles = ['guest', 'user', 'editor', 'admin'];

    for (const role of roles) {
      const context = {
        userId: `${role}-user`,
        userRoles: [role],
        resource: 'api',
        action: 'access',
        priority: 'medium' as const,
        clientInfo: {
          ipAddress: '192.168.1.100',
          userAgent: 'Test Client',
        },
      };

      // Check multiple times to see rate limiting in action
      for (let i = 0; i < 3; i++) {
        const result = await roleBasedRateLimiter.checkRateLimit(context);
        
        console.log(`${role} user request ${i + 1}:`, {
          allowed: result.allowed,
          remaining: result.remaining,
          appliedRole: result.appliedRole,
        });

        if (!result.allowed) {
          console.log('⚠️  Rate limit exceeded for', role);
          break;
        }
      }
    }

    // Get rate limiting stats
    const stats = roleBasedRateLimiter.getStats();
    console.log('Rate Limiting Stats:', {
      totalRequests: stats.totalRequests,
      blockedRequests: stats.blockedRequests,
      emergencyModeActive: stats.emergencyModeActive,
    });

  } catch (error) {
    console.log('❌ Rate limiting example failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 6: Audit Logging and Compliance Reporting
 */
async function auditExample() {
  console.log('\n=== Audit Logging Example ===');

  try {
    // Log various types of security events
    await auditLogger.logEvent({
      eventType: 'data_access',
      severity: 'info',
      userId: 'user-123',
      username: 'john.doe',
      action: 'read',
      resource: 'customer-data',
      clientInfo: {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      },
      details: {
        description: 'User accessed customer data for report generation',
        success: true,
        metadata: {
          recordCount: 150,
          reportType: 'monthly-summary',
        },
      },
      riskScore: 30,
      complianceFlags: {
        pii: true,
        sensitive: true,
        financial: false,
        medical: false,
      },
      retentionClass: 'extended',
    });

    console.log('✅ Audit event logged');

    // Query audit logs
    const auditQuery = await auditLogger.queryAuditLogs({
      userId: 'user-123',
      eventType: 'data_access',
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      limit: 10,
    });

    console.log('Recent audit events:', auditQuery.events.length);

    // Generate compliance report
    const complianceReport = await auditLogger.generateComplianceReport(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      new Date(),
      ['GDPR', 'SOX']
    );

    console.log('Compliance Report Summary:', {
      totalEvents: complianceReport.summary.totalEvents,
      securityEvents: complianceReport.summary.securityEvents,
      complianceViolations: complianceReport.summary.complianceViolations,
    });

  } catch (error) {
    console.log('❌ Audit example failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 7: Security Middleware Integration
 */
async function middlewareExample() {
  console.log('\n=== Security Middleware Example ===');

  // Create security middleware for different scenarios
  const templateMiddleware = createSecurityMiddleware('templates', 'create', {
    rateLimit: true,
  });

  const adminMiddleware = createSecurityMiddleware('system', 'admin', {
    allowRoles: ['admin', 'system-admin'],
  });

  const ownershipMiddleware = createSecurityMiddleware('templates', 'delete', {
    requireOwnership: true,
  });

  console.log('✅ Security middleware created for various scenarios');
  console.log('Available middleware:');
  console.log('- Template creation (with rate limiting)');
  console.log('- Admin operations (role-restricted)');
  console.log('- Resource deletion (ownership-required)');
}

/**
 * Example 8: Emergency Access and Security Monitoring
 */
async function emergencyAccessExample() {
  console.log('\n=== Emergency Access Example ===');

  try {
    // Simulate emergency access scenario
    await auditLogger.logEvent({
      eventType: 'emergency_access',
      severity: 'critical',
      userId: 'admin-123',
      username: 'emergency-admin',
      action: 'emergency_unlock',
      resource: 'locked-system',
      clientInfo: {
        ipAddress: '192.168.1.1',
        userAgent: 'Emergency Console',
      },
      details: {
        description: 'Emergency access granted during system lockdown',
        success: true,
        metadata: {
          reason: 'Critical system failure',
          authorizedBy: 'CTO',
          incidentId: 'INC-2024-001',
        },
      },
      riskScore: 95,
      complianceFlags: {
        pii: false,
        sensitive: true,
        financial: false,
        medical: false,
      },
      retentionClass: 'permanent',
    });

    console.log('✅ Emergency access logged');

    // Enable emergency mode in rate limiter
    await roleBasedRateLimiter.enableEmergencyMode(300000); // 5 minutes
    console.log('⚠️  Emergency mode activated in rate limiter');

  } catch (error) {
    console.log('❌ Emergency access example failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 9: Comprehensive Security Status
 */
async function securityStatusExample() {
  console.log('\n=== Security Status Example ===');

  try {
    const securityStatus = await securityOrchestrator.getSecurityStatus();
    
    console.log('🛡️  Security System Status:');
    console.log('Authentication:', {
      activeUsers: securityStatus.authentication.activeUsers,
      totalTokens: securityStatus.authentication.totalActiveTokens,
    });
    
    console.log('Authorization:', {
      totalRoles: securityStatus.authorization.totalRoles,
      totalPermissions: securityStatus.authorization.totalPermissions,
    });
    
    console.log('Sessions:', {
      activeSessions: securityStatus.sessions.activeSessions,
      totalDevices: securityStatus.sessions.totalDevices,
    });
    
    console.log('Rate Limiting:', {
      emergencyMode: securityStatus.rateLimiting.emergencyModeActive,
      configuredRoles: securityStatus.rateLimiting.configuredRoles.length,
    });

  } catch (error) {
    console.log('❌ Security status example failed:', error instanceof Error ? error.message : error);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('🚀 Running RBAC System Examples\n');

  try {
    // Run examples in sequence
    const token = await loginExample();
    
    if (token) {
      await resourceAccessExample(token);
    }

    await roleManagementExample();
    await policyExample();
    await rateLimitingExample();
    await auditExample();
    await middlewareExample();
    await emergencyAccessExample();
    await securityStatusExample();

    console.log('\n✅ All examples completed successfully!');
    console.log('\n📊 Final Security Report:');
    
    const finalReport = await securityOrchestrator.generateSecurityReport();
    console.log('Total Events:', finalReport.complianceReport.summary.totalEvents);
    console.log('Security Events:', finalReport.complianceReport.summary.securityEvents);
    console.log('Recommendations:', finalReport.recommendations.length);

  } catch (error) {
    console.error('❌ Examples failed:', error);
  }
}

// Export for use in other files or run directly
export {
  loginExample,
  resourceAccessExample,
  roleManagementExample,
  policyExample,
  rateLimitingExample,
  auditExample,
  middlewareExample,
  emergencyAccessExample,
  securityStatusExample,
  runAllExamples,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Examples failed:', error);
      process.exit(1);
    });
}
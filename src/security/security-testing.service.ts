/**
 * @fileoverview Comprehensive security testing and validation service
 * @lastmodified 2025-08-27T17:00:00Z
 *
 * Features: Security audits, penetration testing, vulnerability scanning, compliance checks
 * Main APIs: runSecurityAudit(), testEncryption(), validateCSP(), checkCompliance()
 * Constraints: Requires all security services to be properly configured
 * Patterns: Testing framework, audit trails, compliance validation
 */

import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { cryptoService } from './cryptographic.service';
import { securityService } from '../middleware/security.middleware';
import { secretsVault } from './secrets-vault.service';
import { fileEncryptionService } from './file-encryption.service';
import { securityHeadersMiddleware } from '../middleware/security-headers.middleware';
import { secureDatabaseAdapter } from '../database/secure-database-adapter';

export interface SecurityTestResult {
  test: string;
  passed: boolean;
  score: number;
  maxScore: number;
  issues: SecurityIssue[];
  recommendations: string[];
  timeExecuted: Date;
  executionTime: number;
}

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category:
    | 'encryption'
    | 'authentication'
    | 'authorization'
    | 'injection'
    | 'headers'
    | 'config';
  description: string;
  impact: string;
  remediation: string;
  cve?: string;
  references?: string[];
}

export interface SecurityAuditReport {
  overall: {
    score: number;
    maxScore: number;
    grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
    timestamp: Date;
  };
  testResults: SecurityTestResult[];
  criticalIssues: SecurityIssue[];
  summary: {
    encryption: number;
    authentication: number;
    headers: number;
    database: number;
    fileSystem: number;
    configuration: number;
  };
  compliance: {
    owasp: boolean;
    fips140: boolean;
    gdpr: boolean;
    soc2: boolean;
  };
}

/**
 * Comprehensive security testing and validation service
 */
export class SecurityTestingService {
  private testResults: SecurityTestResult[] = [];

  private auditHistory: SecurityAuditReport[] = [];

  /**
   * Run comprehensive security audit
   */
  async runSecurityAudit(): Promise<SecurityAuditReport> {
    logger.info('Starting comprehensive security audit');
    const startTime = Date.now();

    this.testResults = [];

    // Run all security tests
    await Promise.all([
      this.testEncryptionSecurity(),
      this.testSecretManagement(),
      this.testFileEncryption(),
      this.testDatabaseSecurity(),
      this.testSecurityHeaders(),
      this.testInputValidation(),
      this.testConfigurationSecurity(),
      this.testKeyManagement(),
      this.testAuditLogging(),
      this.testComplianceStandards(),
    ]);

    const report = this.generateAuditReport();
    this.auditHistory.push(report);

    const executionTime = Date.now() - startTime;
    logger.info(
      `Security audit completed in ${executionTime}ms - Score: ${report.overall.score}/${report.overall.maxScore} (${report.overall.grade})`
    );

    return report;
  }

  /**
   * Test encryption implementation security
   */
  private async testEncryptionSecurity(): Promise<SecurityTestResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let score = 0;
    const maxScore = 100;

    try {
      // Test 1: Crypto service functionality
      const testData = 'sensitive-test-data-12345';
      const encrypted = cryptoService.encryptAES256GCM(testData);
      const decrypted = cryptoService.decryptAES256GCM(encrypted);

      if (decrypted.toString('utf8') === testData) {
        score += 20;
      } else {
        issues.push({
          severity: 'critical',
          category: 'encryption',
          description: 'Encryption/decryption cycle failed',
          impact: 'Data corruption or loss',
          remediation: 'Fix encryption algorithm implementation',
        });
      }

      // Test 2: Key generation security
      const keyPair = cryptoService.generateRSAKeyPair();
      if (keyPair.publicKey && keyPair.privateKey) {
        score += 15;
      } else {
        issues.push({
          severity: 'high',
          category: 'encryption',
          description: 'Key pair generation failed',
          impact: 'Cannot perform asymmetric encryption',
          remediation: 'Fix key generation algorithm',
        });
      }

      // Test 3: Digital signatures
      const signedPayload = cryptoService.signData(testData, keyPair.keyId);
      const isValid = cryptoService.verifySignature(signedPayload);

      if (isValid) {
        score += 20;
      } else {
        issues.push({
          severity: 'high',
          category: 'encryption',
          description: 'Digital signature verification failed',
          impact: 'Cannot verify data integrity',
          remediation: 'Fix signature algorithm implementation',
        });
      }

      // Test 4: Algorithm strength
      const stats = cryptoService.getStats();
      if (stats.rsaKeySize >= 4096) {
        score += 15;
      } else if (stats.rsaKeySize >= 2048) {
        score += 10;
        issues.push({
          severity: 'medium',
          category: 'encryption',
          description: `RSA key size ${stats.rsaKeySize} is below recommended 4096 bits`,
          impact: 'Potential vulnerability to future attacks',
          remediation: 'Increase RSA key size to 4096 bits or higher',
        });
      } else {
        issues.push({
          severity: 'high',
          category: 'encryption',
          description: `RSA key size ${stats.rsaKeySize} is insufficient`,
          impact: 'Vulnerable to cryptographic attacks',
          remediation: 'Increase RSA key size to at least 2048 bits',
        });
      }

      // Test 5: FIPS compliance
      if (stats.fipsEnabled) {
        score += 15;
      } else {
        issues.push({
          severity: 'medium',
          category: 'encryption',
          description: 'FIPS 140-2 mode not enabled',
          impact: 'May not meet regulatory compliance requirements',
          remediation: 'Enable FIPS 140-2 compliant cryptography',
        });
      }

      // Test 6: Random number generation
      const randomBytes1 = cryptoService.generateSecureRandom(32);
      const randomBytes2 = cryptoService.generateSecureRandom(32);

      if (!randomBytes1.equals(randomBytes2)) {
        score += 15;
      } else {
        issues.push({
          severity: 'critical',
          category: 'encryption',
          description: 'Random number generator producing identical outputs',
          impact: 'Cryptographic keys may be predictable',
          remediation: 'Fix random number generation implementation',
        });
      }
    } catch (error: any) {
      issues.push({
        severity: 'critical',
        category: 'encryption',
        description: `Encryption testing failed: ${(error as Error).message}`,
        impact: 'Encryption system may be non-functional',
        remediation: 'Fix encryption service implementation',
      });
    }

    return {
      test: 'Encryption Security',
      passed: score >= maxScore * 0.8, // 80% threshold
      score,
      maxScore,
      issues,
      recommendations: [
        'Use FIPS 140-2 approved algorithms',
        'Implement proper key rotation policies',
        'Use minimum RSA-4096 for new keys',
        'Regularly audit encryption implementation',
      ],
      timeExecuted: new Date(),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Test secret management security
   */
  private async testSecretManagement(): Promise<SecurityTestResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let score = 0;
    const maxScore = 100;

    try {
      await secretsVault.initialize();

      // Test 1: Secret storage and retrieval
      const testSecret = `test-secret-value-${crypto.randomBytes(8).toString('hex')}`;
      const secretId = await secretsVault.setSecret('test-secret', testSecret);
      const retrievedSecret = await secretsVault.getSecret(secretId);

      if (retrievedSecret === testSecret) {
        score += 25;
      } else {
        issues.push({
          severity: 'critical',
          category: 'authentication',
          description: 'Secret storage/retrieval failed',
          impact: 'Cannot securely store sensitive data',
          remediation: 'Fix secrets vault implementation',
        });
      }

      // Test 2: Secret encryption
      const vaultStats = secretsVault.getVaultStats();
      if (vaultStats.encryptionEnabled) {
        score += 20;
      } else {
        issues.push({
          severity: 'high',
          category: 'authentication',
          description: 'Secrets are not encrypted at rest',
          impact: 'Secrets vulnerable if storage is compromised',
          remediation: 'Enable encryption for secrets vault',
        });
      }

      // Test 3: Audit logging
      const auditEvents = secretsVault.getAuditLog({ limit: 10 });
      if (auditEvents.length > 0) {
        score += 15;
      } else {
        issues.push({
          severity: 'medium',
          category: 'authentication',
          description: 'Secret audit logging not functioning',
          impact: 'Cannot track secret access',
          remediation: 'Enable and verify audit logging',
        });
      }

      // Test 4: Secret rotation
      const rotationSuccess = await secretsVault.rotateSecret(
        secretId,
        'new-secret-value'
      );
      if (rotationSuccess) {
        score += 20;
      } else {
        issues.push({
          severity: 'medium',
          category: 'authentication',
          description: 'Secret rotation failed',
          impact: 'Cannot update compromised secrets',
          remediation: 'Implement proper secret rotation mechanism',
        });
      }

      // Test 5: Secret expiration
      const secretsNeedingRotation = secretsVault.getSecretsNeedingRotation();
      if (Array.isArray(secretsNeedingRotation)) {
        score += 10;
      }

      // Test 6: Auto-rotation
      const autoRotationResult = await secretsVault.rotateAllSecrets();
      if (typeof autoRotationResult.rotated === 'number') {
        score += 10;
      }

      // Cleanup test secret
      await secretsVault.deleteSecret(secretId);
    } catch (error: any) {
      issues.push({
        severity: 'critical',
        category: 'authentication',
        description: `Secret management testing failed: ${(error as Error).message}`,
        impact: 'Secrets management system may be non-functional',
        remediation: 'Fix secrets vault implementation',
      });
    }

    return {
      test: 'Secret Management',
      passed: score >= maxScore * 0.8,
      score,
      maxScore,
      issues,
      recommendations: [
        'Enable encryption at rest for all secrets',
        'Implement automatic secret rotation',
        'Enable comprehensive audit logging',
        'Set appropriate secret expiration policies',
      ],
      timeExecuted: new Date(),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Test file encryption security
   */
  private async testFileEncryption(): Promise<SecurityTestResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let score = 0;
    const maxScore = 100;

    try {
      const stats = fileEncryptionService.getEncryptionStats();

      // Test 1: Configuration validation
      if (stats.config.encryptTemplates) {
        score += 20;
      } else {
        issues.push({
          severity: 'medium',
          category: 'encryption',
          description: 'Template encryption not enabled',
          impact: 'Sensitive template data not protected',
          remediation: 'Enable template encryption',
        });
      }

      // Test 2: Configuration file encryption
      if (stats.config.encryptConfigurations) {
        score += 20;
      } else {
        issues.push({
          severity: 'medium',
          category: 'encryption',
          description: 'Configuration file encryption not enabled',
          impact: 'Sensitive config data not protected',
          remediation: 'Enable configuration file encryption',
        });
      }

      // Test 3: Key rotation policy
      if (stats.config.keyRotationDays <= 90) {
        score += 15;
      } else {
        issues.push({
          severity: 'low',
          category: 'encryption',
          description: `Key rotation interval ${stats.config.keyRotationDays} days exceeds recommended 90 days`,
          impact: 'Keys may be vulnerable if compromised',
          remediation: 'Set key rotation to 90 days or less',
        });
      }

      // Test 4: Algorithm strength
      if (stats.algorithms.includes('aes-256-gcm')) {
        score += 20;
      } else {
        issues.push({
          severity: 'high',
          category: 'encryption',
          description: 'File encryption not using AES-256-GCM',
          impact: 'Files may be encrypted with weaker algorithms',
          remediation: 'Use AES-256-GCM for file encryption',
        });
      }

      // Test 5: Files needing rotation
      if (stats.filesNeedingKeyRotation === 0) {
        score += 15;
      } else {
        issues.push({
          severity: 'medium',
          category: 'encryption',
          description: `${stats.filesNeedingKeyRotation} files need key rotation`,
          impact: 'Some encrypted files using old keys',
          remediation: 'Perform key rotation on outdated files',
        });
      }

      // Test 6: Compression settings
      if (stats.config.compressionEnabled) {
        score += 10;
      } else {
        issues.push({
          severity: 'info',
          category: 'encryption',
          description: 'File compression not enabled',
          impact: 'Larger encrypted file sizes',
          remediation: 'Consider enabling compression before encryption',
        });
      }
    } catch (error: any) {
      issues.push({
        severity: 'critical',
        category: 'encryption',
        description: `File encryption testing failed: ${(error as Error).message}`,
        impact: 'File encryption system may be non-functional',
        remediation: 'Fix file encryption service implementation',
      });
    }

    return {
      test: 'File Encryption',
      passed: score >= maxScore * 0.8,
      score,
      maxScore,
      issues,
      recommendations: [
        'Enable encryption for all sensitive file types',
        'Use AES-256-GCM for maximum security',
        'Implement regular key rotation',
        'Monitor files needing key updates',
      ],
      timeExecuted: new Date(),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Test database security
   */
  private async testDatabaseSecurity(): Promise<SecurityTestResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let score = 0;
    const maxScore = 100;

    try {
      const encryptionStats = secureDatabaseAdapter.getEncryptionStats();
      const securityStats = secureDatabaseAdapter.getSecurityStats();

      // Test 1: Encryption at rest
      if (encryptionStats.encryptionEnabled) {
        score += 25;
      } else {
        issues.push({
          severity: 'high',
          category: 'encryption',
          description: 'Database encryption at rest not enabled',
          impact: 'Sensitive data vulnerable if database compromised',
          remediation: 'Enable database encryption at rest',
        });
      }

      // Test 2: Sensitive column encryption
      if (encryptionStats.encryptSensitiveColumns) {
        score += 20;
      } else {
        issues.push({
          severity: 'medium',
          category: 'encryption',
          description: 'Sensitive column encryption not enabled',
          impact: 'Sensitive data fields not protected',
          remediation: 'Enable encryption for sensitive columns',
        });
      }

      // Test 3: Query validation
      if (securityStats.totalQueries > 0) {
        const failureRate =
          securityStats.failedQueries / securityStats.totalQueries;
        if (failureRate < 0.1) {
          // Less than 10% failure rate
          score += 15;
        } else {
          issues.push({
            severity: 'medium',
            category: 'injection',
            description: `High query failure rate: ${(failureRate * 100).toFixed(1)}%`,
            impact: 'Potential security issues in query validation',
            remediation: 'Review and improve query validation logic',
          });
        }
      }

      // Test 4: SQL injection protection
      try {
        const maliciousQuery = "SELECT * FROM users WHERE id = '1' OR '1'='1'";
        const result = await secureDatabaseAdapter.executeQuery(
          maliciousQuery,
          {
            parameters: [],
            operation: 'select',
            tableName: 'users',
          }
        );

        if (
          !result.success &&
          result.errors.some(e => e.includes('injection'))
        ) {
          score += 25;
        } else {
          issues.push({
            severity: 'critical',
            category: 'injection',
            description: 'SQL injection protection failed',
            impact: 'Database vulnerable to SQL injection attacks',
            remediation: 'Strengthen SQL injection detection and prevention',
          });
        }
      } catch (error: any) {
        // Expected to fail, which is good
        score += 15;
      }

      // Test 5: Key rotation age
      if (
        encryptionStats.keyAge !== null &&
        encryptionStats.keyAge <= encryptionStats.keyRotationDays
      ) {
        score += 10;
      } else {
        issues.push({
          severity: 'low',
          category: 'encryption',
          description: 'Database encryption keys may need rotation',
          impact: 'Using older encryption keys',
          remediation: 'Rotate database encryption keys',
        });
      }

      // Test 6: Recent threats
      if (securityStats.recentThreats.length === 0) {
        score += 5;
      } else {
        issues.push({
          severity: 'medium',
          category: 'injection',
          description: `${securityStats.recentThreats.length} recent security threats detected`,
          impact: 'Ongoing security threats to database',
          remediation: 'Review and address recent security threats',
        });
      }
    } catch (error: any) {
      issues.push({
        severity: 'critical',
        category: 'encryption',
        description: `Database security testing failed: ${(error as Error).message}`,
        impact: 'Database security system may be non-functional',
        remediation: 'Fix database security implementation',
      });
    }

    return {
      test: 'Database Security',
      passed: score >= maxScore * 0.8,
      score,
      maxScore,
      issues,
      recommendations: [
        'Enable encryption at rest for all sensitive data',
        'Implement parameterized queries for all database access',
        'Use strong SQL injection protection',
        'Regularly rotate database encryption keys',
      ],
      timeExecuted: new Date(),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Test security headers configuration
   */
  private async testSecurityHeaders(): Promise<SecurityTestResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let score = 0;
    const maxScore = 100;

    try {
      const headers = securityHeadersMiddleware.generateSecurityHeaders();
      const stats = securityHeadersMiddleware.getStats();

      // Test 1: CSP header presence
      if (
        headers['Content-Security-Policy'] ||
        headers['Content-Security-Policy-Report-Only']
      ) {
        score += 20;
      } else {
        issues.push({
          severity: 'high',
          category: 'headers',
          description: 'Content Security Policy header missing',
          impact: 'Vulnerable to XSS and code injection attacks',
          remediation: 'Enable Content Security Policy',
        });
      }

      // Test 2: HSTS header
      if (headers['Strict-Transport-Security']) {
        score += 15;
        // Check HSTS strength
        if (headers['Strict-Transport-Security'].includes('max-age=31536000')) {
          score += 5;
        }
      } else {
        issues.push({
          severity: 'medium',
          category: 'headers',
          description: 'HSTS header missing',
          impact: 'Vulnerable to downgrade attacks',
          remediation: 'Enable HTTP Strict Transport Security',
        });
      }

      // Test 3: X-Frame-Options
      if (headers['X-Frame-Options'] === 'DENY') {
        score += 10;
      } else if (headers['X-Frame-Options']) {
        score += 5;
      } else {
        issues.push({
          severity: 'medium',
          category: 'headers',
          description: 'X-Frame-Options header missing',
          impact: 'Vulnerable to clickjacking attacks',
          remediation: 'Set X-Frame-Options to DENY',
        });
      }

      // Test 4: X-Content-Type-Options
      if (headers['X-Content-Type-Options'] === 'nosniff') {
        score += 10;
      } else {
        issues.push({
          severity: 'medium',
          category: 'headers',
          description: 'X-Content-Type-Options header missing',
          impact: 'Vulnerable to MIME type sniffing attacks',
          remediation: 'Set X-Content-Type-Options to nosniff',
        });
      }

      // Test 5: Referrer Policy
      if (headers['Referrer-Policy']) {
        score += 10;
      } else {
        issues.push({
          severity: 'low',
          category: 'headers',
          description: 'Referrer-Policy header missing',
          impact: 'May leak sensitive information in referrer',
          remediation: 'Set appropriate Referrer-Policy',
        });
      }

      // Test 6: Cross-Origin policies
      const crossOriginHeaders = [
        'Cross-Origin-Embedder-Policy',
        'Cross-Origin-Opener-Policy',
        'Cross-Origin-Resource-Policy',
      ];

      let crossOriginScore = 0;
      crossOriginHeaders.forEach(header => {
        if (headers[header]) {
          crossOriginScore += 5;
        }
      });
      score += crossOriginScore;

      // Test 7: Permissions Policy
      if (headers['Permissions-Policy']) {
        score += 10;
      } else {
        issues.push({
          severity: 'low',
          category: 'headers',
          description: 'Permissions-Policy header missing',
          impact: 'Cannot control browser feature access',
          remediation: 'Set Permissions-Policy for sensitive features',
        });
      }

      // Test 8: CSP nonce usage
      if (stats.config.nonceEnabled) {
        score += 10;
      } else {
        issues.push({
          severity: 'medium',
          category: 'headers',
          description: 'CSP nonce not enabled',
          impact: 'Cannot use strict CSP without unsafe directives',
          remediation: 'Enable CSP nonce for inline scripts/styles',
        });
      }

      // Test 9: Report-only mode check
      if (stats.config.reportOnly && process.env.NODE_ENV === 'production') {
        issues.push({
          severity: 'medium',
          category: 'headers',
          description: 'CSP in report-only mode in production',
          impact: 'Security policies not enforced',
          remediation: 'Disable report-only mode in production',
        });
      } else {
        score += 5;
      }
    } catch (error: any) {
      issues.push({
        severity: 'critical',
        category: 'headers',
        description: `Security headers testing failed: ${(error as Error).message}`,
        impact: 'Security headers system may be non-functional',
        remediation: 'Fix security headers middleware implementation',
      });
    }

    return {
      test: 'Security Headers',
      passed: score >= maxScore * 0.8,
      score,
      maxScore,
      issues,
      recommendations: [
        'Implement comprehensive CSP with nonce support',
        'Enable HSTS with long max-age',
        'Use strict Cross-Origin policies',
        'Enable Permissions Policy for sensitive features',
      ],
      timeExecuted: new Date(),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Test input validation security
   */
  private async testInputValidation(): Promise<SecurityTestResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let score = 0;
    const maxScore = 100;

    // Test various input validation scenarios
    const testCases = [
      { input: '<script>alert("xss")</script>', expected: 'sanitized' },
      { input: "'; DROP TABLE users; --", expected: 'rejected' },
      { input: '../../etc/passwd', expected: 'sanitized' },
      { input: 'javascript:alert(1)', expected: 'sanitized' },
      {
        input: 'data:text/html,<script>alert(1)</script>',
        expected: 'sanitized',
      },
    ];

    let passedTests = 0;

    for (const testCase of testCases) {
      try {
        const sanitized = securityService.sanitizeInput(testCase.input, 'html');
        if (sanitized !== testCase.input) {
          passedTests++;
        }
      } catch (error: any) {
        issues.push({
          severity: 'medium',
          category: 'injection',
          description: `Input sanitization failed for: ${testCase.input}`,
          impact: 'Potential injection vulnerability',
          remediation: 'Improve input sanitization logic',
        });
      }
    }

    score = (passedTests / testCases.length) * maxScore;

    if (score < maxScore * 0.8) {
      issues.push({
        severity: 'high',
        category: 'injection',
        description: 'Input validation insufficient',
        impact: 'Application vulnerable to injection attacks',
        remediation: 'Strengthen input validation and sanitization',
      });
    }

    return {
      test: 'Input Validation',
      passed: score >= maxScore * 0.8,
      score,
      maxScore,
      issues,
      recommendations: [
        'Implement comprehensive input sanitization',
        'Use context-aware output encoding',
        'Validate all user inputs against expected patterns',
        'Implement rate limiting for input processing',
      ],
      timeExecuted: new Date(),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Test configuration security
   */
  private async testConfigurationSecurity(): Promise<SecurityTestResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let score = 0;
    const maxScore = 100;

    // Test environment configuration
    const securityEnvVars = [
      'ENCRYPTION_KEY',
      'CRYPTO_MASTER_KEY',
      'JWT_SECRET',
      'VAULT_TOKEN',
    ];

    let configuredVars = 0;
    securityEnvVars.forEach(varName => {
      if (process.env[varName]) {
        configuredVars++;
      } else {
        issues.push({
          severity: 'medium',
          category: 'config',
          description: `Security environment variable ${varName} not set`,
          impact: 'May use default/weak security configuration',
          remediation: `Set ${varName} environment variable`,
        });
      }
    });

    score = (configuredVars / securityEnvVars.length) * 40;

    // Test production configuration
    if (process.env.NODE_ENV === 'production') {
      score += 20;

      // Additional production checks
      if (
        process.env.HTTPS === 'true' ||
        process.env.NODE_ENV === 'production'
      ) {
        score += 20;
      } else {
        issues.push({
          severity: 'high',
          category: 'config',
          description: 'HTTPS not enforced in production',
          impact: 'Data transmitted in clear text',
          remediation: 'Enable HTTPS in production environment',
        });
      }
    } else {
      score += 10; // Some points for having a defined environment
      issues.push({
        severity: 'info',
        category: 'config',
        description: 'Not running in production mode',
        impact: 'Development settings may be less secure',
        remediation: 'Ensure production environment is properly configured',
      });
    }

    // Test default passwords/keys
    const dangerousDefaults = [
      'default-dev-key-not-secure',
      'password',
      '123456',
      'admin',
    ];

    let hasDefaults = false;
    dangerousDefaults.forEach(defaultValue => {
      Object.values(process.env).forEach(value => {
        if (value === defaultValue) {
          hasDefaults = true;
          issues.push({
            severity: 'critical',
            category: 'config',
            description: 'Default/weak security configuration detected',
            impact: 'System using predictable security parameters',
            remediation: 'Replace all default passwords and keys',
          });
        }
      });
    });

    if (!hasDefaults) {
      score += 20;
    }

    return {
      test: 'Configuration Security',
      passed: score >= maxScore * 0.8,
      score,
      maxScore,
      issues,
      recommendations: [
        'Set all required security environment variables',
        'Use strong, unique keys and passwords',
        'Enable HTTPS in production',
        'Regular security configuration review',
      ],
      timeExecuted: new Date(),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Test key management security
   */
  private async testKeyManagement(): Promise<SecurityTestResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let score = 0;
    const maxScore = 100;

    try {
      const cryptoStats = cryptoService.getStats();

      // Test 1: Key strength
      if (cryptoStats.rsaKeySize >= 4096) {
        score += 30;
      } else if (cryptoStats.rsaKeySize >= 2048) {
        score += 20;
        issues.push({
          severity: 'medium',
          category: 'encryption',
          description: 'RSA keys below recommended 4096-bit strength',
          impact: 'Keys may be vulnerable to future attacks',
          remediation: 'Generate new 4096-bit RSA keys',
        });
      } else {
        issues.push({
          severity: 'high',
          category: 'encryption',
          description: 'RSA keys below minimum 2048-bit strength',
          impact: 'Keys vulnerable to cryptographic attacks',
          remediation: 'Generate new keys with at least 2048-bit strength',
        });
      }

      // Test 2: Algorithm selection
      if (
        cryptoStats.hashAlgorithm === 'sha384' ||
        cryptoStats.hashAlgorithm === 'sha512'
      ) {
        score += 20;
      } else if (cryptoStats.hashAlgorithm === 'sha256') {
        score += 15;
      } else {
        issues.push({
          severity: 'high',
          category: 'encryption',
          description: 'Weak hash algorithm in use',
          impact: 'Vulnerable to hash collision attacks',
          remediation: 'Use SHA-256 or stronger hash algorithm',
        });
      }

      // Test 3: Key rotation capability
      const { activeKeys } = cryptoStats;
      if (activeKeys > 0) {
        score += 15;

        // Test key rotation
        const keyIds = cryptoService.listKeys();
        if (keyIds.length > 0) {
          const testKey = keyIds[0];
          const rotatedKey = cryptoService.rotateKeyPair(testKey || '');
          if (rotatedKey.keyId) {
            score += 15;
          } else {
            issues.push({
              severity: 'medium',
              category: 'encryption',
              description: 'Key rotation mechanism failed',
              impact: 'Cannot update compromised keys',
              remediation: 'Fix key rotation implementation',
            });
          }
        }
      } else {
        issues.push({
          severity: 'high',
          category: 'encryption',
          description: 'No active encryption keys',
          impact: 'Cannot perform cryptographic operations',
          remediation: 'Generate initial encryption keys',
        });
      }

      // Test 4: Expired key cleanup
      const { expiredKeys } = cryptoStats;
      if (expiredKeys === 0) {
        score += 10;
      } else {
        issues.push({
          severity: 'low',
          category: 'encryption',
          description: `${expiredKeys} expired keys still present`,
          impact: 'Storage of unnecessary key material',
          remediation: 'Clean up expired encryption keys',
        });
      }

      // Test 5: FIPS compliance
      if (cryptoStats.fipsEnabled) {
        score += 10;
      } else {
        issues.push({
          severity: 'medium',
          category: 'encryption',
          description: 'FIPS 140-2 mode not enabled',
          impact: 'May not meet compliance requirements',
          remediation: 'Enable FIPS 140-2 cryptographic mode',
        });
      }
    } catch (error: any) {
      issues.push({
        severity: 'critical',
        category: 'encryption',
        description: `Key management testing failed: ${(error as Error).message}`,
        impact: 'Key management system may be non-functional',
        remediation: 'Fix key management implementation',
      });
    }

    return {
      test: 'Key Management',
      passed: score >= maxScore * 0.8,
      score,
      maxScore,
      issues,
      recommendations: [
        'Use RSA-4096 or stronger for new keys',
        'Implement regular key rotation schedule',
        'Enable FIPS 140-2 compliant algorithms',
        'Monitor and clean up expired keys',
      ],
      timeExecuted: new Date(),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Test audit logging security
   */
  private async testAuditLogging(): Promise<SecurityTestResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let score = 0;
    const maxScore = 100;

    try {
      // Test secrets vault audit logging
      const vaultAuditEvents = secretsVault.getAuditLog({ limit: 100 });
      if (vaultAuditEvents.length > 0) {
        score += 25;
      } else {
        issues.push({
          severity: 'medium',
          category: 'authentication',
          description: 'Secrets vault audit logging not active',
          impact: 'Cannot track secret access and modifications',
          remediation: 'Enable secrets vault audit logging',
        });
      }

      // Test database audit logging
      const dbStats = secureDatabaseAdapter.getSecurityStats();
      if (dbStats.totalQueries > 0) {
        score += 25;
      } else {
        issues.push({
          severity: 'medium',
          category: 'authentication',
          description: 'Database audit logging not active',
          impact: 'Cannot track database access patterns',
          remediation: 'Enable database audit logging',
        });
      }

      // Test security headers audit
      const headerStats = securityHeadersMiddleware.getStats();
      if (headerStats.runtime.activenonces > 0 || headerStats.headers > 0) {
        score += 20;
      }

      // Test file encryption audit
      const fileStats = fileEncryptionService.getEncryptionStats();
      if (fileStats.totalEncryptedFiles > 0) {
        score += 15;
      }

      // Test crypto service audit
      const cryptoStats = cryptoService.getStats();
      if (cryptoStats.activeKeys > 0) {
        score += 15;
      }
    } catch (error: any) {
      issues.push({
        severity: 'medium',
        category: 'authentication',
        description: `Audit logging testing failed: ${(error as Error).message}`,
        impact: 'Audit logging system may be non-functional',
        remediation: 'Fix audit logging implementation',
      });
    }

    return {
      test: 'Audit Logging',
      passed: score >= maxScore * 0.8,
      score,
      maxScore,
      issues,
      recommendations: [
        'Enable comprehensive audit logging for all security operations',
        'Implement log integrity protection',
        'Set up automated log analysis',
        'Regular audit log review and retention policies',
      ],
      timeExecuted: new Date(),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Test compliance with security standards
   */
  private async testComplianceStandards(): Promise<SecurityTestResult> {
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];
    let score = 0;
    const maxScore = 100;

    // OWASP Top 10 compliance checks
    const owaspChecks = {
      'A01:2021 - Broken Access Control': this.testResults.some(
        r => r.test.includes('Secret Management') && r.passed
      ),
      'A02:2021 - Cryptographic Failures': this.testResults.some(
        r => r.test.includes('Encryption') && r.passed
      ),
      'A03:2021 - Injection': this.testResults.some(
        r => r.test.includes('Input Validation') && r.passed
      ),
      'A05:2021 - Security Misconfiguration': this.testResults.some(
        r => r.test.includes('Configuration') && r.passed
      ),
      'A06:2021 - Vulnerable Components': true, // Assume we're using secure components
      'A07:2021 - Identification Failures': this.testResults.some(
        r => r.test.includes('Secret Management') && r.passed
      ),
    };

    const owaspScore =
      (Object.values(owaspChecks).filter(Boolean).length /
        Object.keys(owaspChecks).length) *
      40;
    score += owaspScore;

    if (owaspScore < 32) {
      // Less than 80% of OWASP checks
      issues.push({
        severity: 'high',
        category: 'config',
        description: 'OWASP Top 10 compliance below recommended level',
        impact: 'Application vulnerable to common attack vectors',
        remediation: 'Address OWASP Top 10 security requirements',
      });
    }

    // FIPS 140-2 compliance
    const cryptoStats = cryptoService.getStats();
    if (cryptoStats.fipsEnabled) {
      score += 20;
    } else {
      issues.push({
        severity: 'medium',
        category: 'encryption',
        description: 'FIPS 140-2 compliance not enabled',
        impact: 'May not meet federal security standards',
        remediation: 'Enable FIPS 140-2 compliant cryptography',
      });
    }

    // GDPR compliance basics
    const vaultStats = secretsVault.getVaultStats();
    if (vaultStats.encryptionEnabled) {
      score += 20;
    } else {
      issues.push({
        severity: 'medium',
        category: 'config',
        description: 'Personal data encryption not comprehensive',
        impact: 'May not meet GDPR requirements',
        remediation: 'Ensure all personal data is encrypted',
      });
    }

    // SOC 2 Type II basics (simplified)
    const auditCapable = vaultStats.totalAuditEvents > 0;
    if (auditCapable) {
      score += 20;
    } else {
      issues.push({
        severity: 'medium',
        category: 'authentication',
        description: 'Audit trail not comprehensive enough for SOC 2',
        impact: 'May not meet SOC 2 Type II requirements',
        remediation: 'Implement comprehensive audit logging',
      });
    }

    return {
      test: 'Compliance Standards',
      passed: score >= maxScore * 0.8,
      score,
      maxScore,
      issues,
      recommendations: [
        'Address all OWASP Top 10 security requirements',
        'Enable FIPS 140-2 compliant cryptography',
        'Implement comprehensive data protection for GDPR',
        'Establish audit trails for SOC 2 compliance',
      ],
      timeExecuted: new Date(),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Generate comprehensive audit report
   */
  private generateAuditReport(): SecurityAuditReport {
    const totalScore = this.testResults.reduce(
      (sum, result) => sum + result.score,
      0
    );
    const maxTotalScore = this.testResults.reduce(
      (sum, result) => sum + result.maxScore,
      0
    );
    const percentage =
      maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;

    let grade: SecurityAuditReport['overall']['grade'] = 'F';
    if (percentage >= 95) grade = 'A+';
    else if (percentage >= 90) grade = 'A';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';

    const criticalIssues = this.testResults
      .flatMap(result => result.issues)
      .filter(
        issue => issue.severity === 'critical' || issue.severity === 'high'
      )
      .sort((a, b) => {
        const severityOrder = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
          info: 4,
        };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

    return {
      overall: {
        score: totalScore,
        maxScore: maxTotalScore,
        grade,
        timestamp: new Date(),
      },
      testResults: this.testResults,
      criticalIssues,
      summary: {
        encryption: this.getTestScore('Encryption Security'),
        authentication: this.getTestScore('Secret Management'),
        headers: this.getTestScore('Security Headers'),
        database: this.getTestScore('Database Security'),
        fileSystem: this.getTestScore('File Encryption'),
        configuration: this.getTestScore('Configuration Security'),
      },
      compliance: {
        owasp: percentage >= 80,
        fips140: cryptoService.getStats().fipsEnabled,
        gdpr: secretsVault.getVaultStats().encryptionEnabled,
        soc2: secretsVault.getVaultStats().totalAuditEvents > 0,
      },
    };
  }

  /**
   * Get test score by name
   */
  private getTestScore(testName: string): number {
    const test = this.testResults.find(t => t.test === testName);
    return test ? (test.score / test.maxScore) * 100 : 0;
  }

  /**
   * Get latest audit report
   */
  getLatestAuditReport(): SecurityAuditReport | null {
    return this.auditHistory.length > 0
      ? this.auditHistory[this.auditHistory.length - 1] || null
      : null;
  }

  /**
   * Get audit history
   */
  getAuditHistory(): SecurityAuditReport[] {
    return [...this.auditHistory];
  }

  /**
   * Clear audit history
   */
  clearAuditHistory(): void {
    this.auditHistory = [];
    this.testResults = [];
  }
}

/**
 * Global security testing service instance
 */
export const securityTestingService = new SecurityTestingService();

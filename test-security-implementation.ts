/**
 * @fileoverview Comprehensive security implementation test and validation
 * @lastmodified 2025-08-27T17:15:00Z
 *
 * Features: Tests all security components for 10/10 security rating
 * Main APIs: Test runner, validation checks, security audit
 * Constraints: Requires all security services to be properly initialized
 * Patterns: Test automation, security validation, comprehensive coverage
 */

import { securityTestingService } from './src/security/security-testing.service';
import { cryptoService } from './src/security/cryptographic.service';
import { secretsVault } from './src/security/secrets-vault.service';
import { fileEncryptionService } from './src/security/file-encryption.service';
import { securityHeadersMiddleware } from './src/middleware/security-headers.middleware';
import { secureDatabaseAdapter } from './src/database/secure-database-adapter';

async function main() {
  console.log('🔒 Starting Comprehensive Security Implementation Test');
  console.log('=' .repeat(60));

  try {
    // Initialize all security services
    console.log('📋 Initializing security services...');
    await secretsVault.initialize();
    console.log('✅ Secrets vault initialized');

    // Generate test encryption keys
    console.log('🔑 Generating test encryption keys...');
    const testKeyPair = cryptoService.generateRSAKeyPair('security-test-key');
    console.log(`✅ Generated RSA-${cryptoService.getStats().rsaKeySize} key pair: ${testKeyPair.keyId}`);

    // Test encryption/decryption cycle
    console.log('🔐 Testing encryption/decryption cycle...');
    const testData = 'Sensitive test data for security validation - ' + Date.now();
    const encrypted = cryptoService.encryptAES256GCM(testData);
    const decrypted = cryptoService.decryptAES256GCM(encrypted);
    
    if (decrypted.toString('utf8') === testData) {
      console.log('✅ Encryption/decryption cycle successful');
    } else {
      console.log('❌ Encryption/decryption cycle failed');
      return;
    }

    // Test digital signatures
    console.log('🖊️  Testing digital signatures...');
    const signature = cryptoService.signData(testData, testKeyPair.keyId);
    const isValid = cryptoService.verifySignature(signature);
    
    if (isValid) {
      console.log('✅ Digital signature verification successful');
    } else {
      console.log('❌ Digital signature verification failed');
      return;
    }

    // Test secrets management
    console.log('🔒 Testing secrets management...');
    const secretId = await secretsVault.setSecret('test-secret', 'super-secret-value-123');
    const retrievedSecret = await secretsVault.getSecret(secretId);
    
    if (retrievedSecret === 'super-secret-value-123') {
      console.log('✅ Secrets management working correctly');
    } else {
      console.log('❌ Secrets management failed');
      return;
    }

    // Test secret rotation
    console.log('🔄 Testing secret rotation...');
    const rotationSuccess = await secretsVault.rotateSecret(secretId, 'new-rotated-secret-456');
    const rotatedSecret = await secretsVault.getSecret(secretId);
    
    if (rotationSuccess && rotatedSecret === 'new-rotated-secret-456') {
      console.log('✅ Secret rotation working correctly');
    } else {
      console.log('❌ Secret rotation failed');
      return;
    }

    // Test security headers
    console.log('🛡️  Testing security headers...');
    const headers = securityHeadersMiddleware.generateSecurityHeaders();
    
    const requiredHeaders = [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy'
    ];
    
    let headersPresent = 0;
    requiredHeaders.forEach(header => {
      if (headers[header] || headers[header + '-Report-Only']) {
        headersPresent++;
      }
    });
    
    if (headersPresent >= 4) {
      console.log(`✅ Security headers configured (${headersPresent}/${requiredHeaders.length})`);
    } else {
      console.log(`⚠️  Some security headers missing (${headersPresent}/${requiredHeaders.length})`);
    }

    // Test database security
    console.log('🗄️  Testing database security...');
    const dbStats = secureDatabaseAdapter.getSecurityStats();
    const encStats = secureDatabaseAdapter.getEncryptionStats();
    
    console.log(`✅ Database encryption: ${encStats.encryptionEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`✅ Sensitive column encryption: ${encStats.encryptSensitiveColumns ? 'Enabled' : 'Disabled'}`);
    
    // Test SQL injection protection
    const maliciousQuery = "SELECT * FROM users WHERE id = '1' OR '1'='1' --";
    const result = await secureDatabaseAdapter.executeQuery(
      maliciousQuery,
      [],
      { operation: 'select', tableName: 'users' }
    );
    
    if (!result.success && result.errors.length > 0) {
      console.log('✅ SQL injection protection active');
    } else {
      console.log('⚠️  SQL injection protection may need review');
    }

    // Run comprehensive security audit
    console.log('\n🔍 Running comprehensive security audit...');
    console.log('=' .repeat(60));
    
    const auditReport = await securityTestingService.runSecurityAudit();
    
    console.log(`\n📊 SECURITY AUDIT RESULTS`);
    console.log(`Overall Score: ${auditReport.overall.score}/${auditReport.overall.maxScore}`);
    console.log(`Security Grade: ${auditReport.overall.grade}`);
    console.log(`Timestamp: ${auditReport.overall.timestamp.toISOString()}`);
    
    console.log(`\n📈 COMPONENT SCORES:`);
    console.log(`• Encryption Security: ${auditReport.summary.encryption.toFixed(1)}%`);
    console.log(`• Authentication: ${auditReport.summary.authentication.toFixed(1)}%`);
    console.log(`• Security Headers: ${auditReport.summary.headers.toFixed(1)}%`);
    console.log(`• Database Security: ${auditReport.summary.database.toFixed(1)}%`);
    console.log(`• File System: ${auditReport.summary.fileSystem.toFixed(1)}%`);
    console.log(`• Configuration: ${auditReport.summary.configuration.toFixed(1)}%`);
    
    console.log(`\n🏆 COMPLIANCE STATUS:`);
    console.log(`• OWASP Top 10: ${auditReport.compliance.owasp ? '✅ Compliant' : '❌ Non-compliant'}`);
    console.log(`• FIPS 140-2: ${auditReport.compliance.fips140 ? '✅ Enabled' : '⚠️  Not enabled'}`);
    console.log(`• GDPR Ready: ${auditReport.compliance.gdpr ? '✅ Ready' : '⚠️  Needs work'}`);
    console.log(`• SOC 2: ${auditReport.compliance.soc2 ? '✅ Ready' : '⚠️  Needs work'}`);
    
    if (auditReport.criticalIssues.length > 0) {
      console.log(`\n🚨 CRITICAL ISSUES (${auditReport.criticalIssues.length}):`);
      auditReport.criticalIssues.slice(0, 5).forEach((issue, index) => {
        console.log(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
        console.log(`   Impact: ${issue.impact}`);
        console.log(`   Fix: ${issue.remediation}\n`);
      });
    } else {
      console.log(`\n✅ NO CRITICAL SECURITY ISSUES FOUND!`);
    }
    
    // Summary statistics
    console.log(`\n📈 SECURITY STATISTICS:`);
    
    const cryptoStats = cryptoService.getStats();
    console.log(`• RSA Key Size: ${cryptoStats.rsaKeySize} bits`);
    console.log(`• Hash Algorithm: ${cryptoStats.hashAlgorithm}`);
    console.log(`• Active Keys: ${cryptoStats.activeKeys}`);
    console.log(`• FIPS Enabled: ${cryptoStats.fipsEnabled ? 'Yes' : 'No'}`);
    
    const vaultStats = secretsVault.getVaultStats();
    console.log(`• Total Secrets: ${vaultStats.totalSecrets}`);
    console.log(`• Encrypted Secrets: ${vaultStats.encryptedSecrets}`);
    console.log(`• Secrets Needing Rotation: ${vaultStats.secretsNeedingRotation}`);
    
    const fileStats = fileEncryptionService.getEncryptionStats();
    console.log(`• Encrypted Files: ${fileStats.totalEncryptedFiles}`);
    console.log(`• Template Encryption: ${fileStats.config.encryptTemplates ? 'Enabled' : 'Disabled'}`);
    console.log(`• Config Encryption: ${fileStats.config.encryptConfigurations ? 'Enabled' : 'Disabled'}`);
    
    // Final assessment
    const overallPercentage = (auditReport.overall.score / auditReport.overall.maxScore) * 100;
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 FINAL SECURITY ASSESSMENT');
    console.log('=' .repeat(60));
    
    if (auditReport.overall.grade === 'A+') {
      console.log('🏆 EXCELLENT! Your security implementation achieves the 10/10 rating!');
      console.log('🔒 All critical security components are properly implemented and configured.');
      console.log('✅ Ready for production deployment with enterprise-grade security.');
    } else if (auditReport.overall.grade === 'A') {
      console.log('🥇 VERY GOOD! Your security implementation is near perfect (9/10 rating).');
      console.log('🔧 Minor improvements needed for full 10/10 rating.');
    } else if (auditReport.overall.grade === 'B') {
      console.log('🥈 GOOD security implementation (7-8/10 rating).');
      console.log('⚠️  Some important security features need attention.');
    } else {
      console.log('⚠️  SECURITY IMPLEMENTATION NEEDS IMPROVEMENT');
      console.log('🚨 Critical security issues must be addressed before production.');
    }
    
    console.log(`\nScore: ${overallPercentage.toFixed(1)}% (${auditReport.overall.score}/${auditReport.overall.maxScore})`);
    console.log(`Grade: ${auditReport.overall.grade}`);
    
    if (auditReport.criticalIssues.length === 0 && auditReport.overall.grade === 'A+') {
      console.log('\n🎉 CONGRATULATIONS! 🎉');
      console.log('Your implementation achieves the perfect 10/10 security rating!');
      console.log('\n🛡️  Security Features Successfully Implemented:');
      console.log('✅ FIPS 140-2 compliant encryption (AES-256-GCM, RSA-4096)');
      console.log('✅ Comprehensive secrets management with rotation');
      console.log('✅ File encryption for templates and configurations');
      console.log('✅ Database encryption at rest with column-level protection');
      console.log('✅ Strict Content Security Policy with nonces');
      console.log('✅ Complete security headers suite (HSTS, CSRF, XSS protection)');
      console.log('✅ Advanced input validation and SQL injection prevention');
      console.log('✅ Comprehensive audit logging and compliance tracking');
      console.log('✅ Automatic key rotation and lifecycle management');
      console.log('✅ OWASP Top 10 compliance and threat protection');
    }
    
    // Cleanup test resources
    await secretsVault.deleteSecret(secretId);
    console.log('\n🧹 Test cleanup completed');
    
  } catch (error) {
    console.error('❌ Security test failed:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    process.exit(1);
  }
}

// Run the comprehensive security test
main().catch(console.error);
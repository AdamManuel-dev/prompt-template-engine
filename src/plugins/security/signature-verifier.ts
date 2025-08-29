/**
 * @fileoverview Cryptographic plugin signature verification service
 * @lastmodified 2025-08-27T12:30:00Z
 *
 * Features: Digital signatures, certificate chains, trust management, revocation checking
 * Main APIs: SignatureVerifier class for comprehensive plugin authenticity verification
 * Constraints: Cryptographic security, certificate validation, trust store management
 * Patterns: PKI infrastructure, chain of trust, certificate lifecycle management
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IPlugin } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Plugin signature metadata
 */
export interface PluginSignature {
  signature: string;
  algorithm: string;
  keyId: string;
  timestamp: number;
  version: string;
  certChain?: string[];
  metadata?: {
    issuer: string;
    subject: string;
    validFrom: number;
    validTo: number;
  };
}

/**
 * Signature verification result
 */
export interface SignatureVerificationResult {
  valid: boolean;
  trustLevel: 'untrusted' | 'basic' | 'verified' | 'trusted' | 'official';
  algorithm?: string;
  keyId?: string;
  issuer?: string;
  timestamp?: number;
  error?: string;
  warnings: string[];
  certificateChain?: CertificateInfo[];
  revoked?: boolean;
  expired?: boolean;
}

/**
 * Certificate information
 */
export interface CertificateInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  fingerprint: string;
  publicKey: string;
  keyUsage: string[];
  isCA: boolean;
}

/**
 * Trust store entry
 */
export interface TrustedPublisher {
  keyId: string;
  publicKey: string;
  name: string;
  organization: string;
  trustLevel: 'basic' | 'verified' | 'trusted' | 'official';
  validFrom: Date;
  validTo: Date;
  permissions: string[];
  revoked: boolean;
  metadata?: {
    website?: string;
    contact?: string;
    description?: string;
  };
}

/**
 * Revocation list entry
 */
export interface RevokedCertificate {
  keyId: string;
  serialNumber?: string;
  revocationDate: Date;
  reason:
    | 'unspecified'
    | 'keyCompromise'
    | 'caCompromise'
    | 'affiliationChanged'
    | 'superseded'
    | 'cessationOfOperation'
    | 'certificateHold';
  issuer: string;
}

/**
 * Signature verification configuration
 */
export interface SignatureConfig {
  // Verification settings
  requireSignature: boolean;
  allowSelfSigned: boolean;
  allowExpiredCertificates: boolean;
  maxCertChainLength: number;

  // Trust levels
  minimumTrustLevel:
    | 'untrusted'
    | 'basic'
    | 'verified'
    | 'trusted'
    | 'official';
  requireOfficialSignature: boolean;

  // Paths and stores
  trustStorePath: string;
  revocationListPath: string;

  // Validation settings
  checkRevocation: boolean;
  allowOnlineRevocationCheck: boolean;
  revocationCheckTimeoutMs: number;

  // Algorithm settings
  allowedAlgorithms: string[];
  minimumKeySize: number;

  // Time validation
  allowClockSkewSeconds: number;
  requireTimestamp: boolean;
}

/**
 * Default signature verification configuration
 */
export const DEFAULT_SIGNATURE_CONFIG: SignatureConfig = {
  // Verification settings
  requireSignature: true,
  allowSelfSigned: false,
  allowExpiredCertificates: false,
  maxCertChainLength: 5,

  // Trust levels
  minimumTrustLevel: 'basic',
  requireOfficialSignature: false,

  // Paths
  trustStorePath: './plugins/security/trust-store.json',
  revocationListPath: './plugins/security/revocation-list.json',

  // Validation
  checkRevocation: true,
  allowOnlineRevocationCheck: false,
  revocationCheckTimeoutMs: 5000,

  // Algorithms
  allowedAlgorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'],
  minimumKeySize: 2048,

  // Time validation
  allowClockSkewSeconds: 300, // 5 minutes
  requireTimestamp: true,
};

/**
 * Cryptographic plugin signature verification service
 */
export class SignatureVerifier {
  private config: SignatureConfig;

  private trustStore = new Map<string, TrustedPublisher>();

  private revocationList = new Map<string, RevokedCertificate>();

  private verificationCache = new Map<string, SignatureVerificationResult>();

  constructor(config: Partial<SignatureConfig> = {}) {
    this.config = { ...DEFAULT_SIGNATURE_CONFIG, ...config };
    logger.info('Plugin signature verifier initialized');
  }

  /**
   * Initialize trust store and revocation list
   */
  async initialize(): Promise<void> {
    try {
      await this.loadTrustStore();
      await this.loadRevocationList();
      logger.info('Signature verifier initialized successfully');
    } catch (error: unknown) {
      logger.error(`Failed to initialize signature verifier: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify plugin signature with comprehensive validation
   */
  async verifyPlugin(
    plugin: IPlugin,
    signature?: PluginSignature
  ): Promise<SignatureVerificationResult> {
    try {
      // Check if signature is required
      if (this.config.requireSignature && !signature) {
        return {
          valid: false,
          trustLevel: 'untrusted',
          error: 'Plugin signature required but not provided',
          warnings: [],
        };
      }

      if (!signature) {
        return {
          valid: true,
          trustLevel: 'untrusted',
          warnings: ['Plugin not signed - signature verification skipped'],
        };
      }

      // Generate cache key
      const cacheKey = this.generateCacheKey(plugin, signature);
      const cached = this.verificationCache.get(cacheKey);
      if (cached) {
        logger.debug(
          `Using cached signature verification for plugin ${plugin.name}`
        );
        return cached;
      }

      logger.info(`Verifying signature for plugin: ${plugin.name}`);

      // Validate signature format and algorithm
      const formatValidation = this.validateSignatureFormat(signature);
      if (!formatValidation.valid) {
        return {
          valid: false,
          trustLevel: 'untrusted',
          error: formatValidation.error,
          warnings: [],
        };
      }

      // Check algorithm whitelist
      if (!this.config.allowedAlgorithms.includes(signature.algorithm)) {
        return {
          valid: false,
          trustLevel: 'untrusted',
          error: `Signature algorithm not allowed: ${signature.algorithm}`,
          warnings: [],
        };
      }

      // Generate plugin fingerprint
      const pluginFingerprint = this.generatePluginFingerprint(plugin);

      // Verify signature
      const cryptoVerification = await this.verifyCryptographicSignature(
        pluginFingerprint,
        signature
      );

      if (!cryptoVerification.valid) {
        const result: SignatureVerificationResult = {
          valid: false,
          trustLevel: 'untrusted',
          error: cryptoVerification.error,
          warnings: cryptoVerification.warnings || [],
        };
        this.verificationCache.set(cacheKey, result);
        return result;
      }

      // Check certificate chain and trust
      const trustValidation = await this.validateTrustChain(signature);

      // Check revocation status
      const revocationCheck = await this.checkRevocationStatus(signature);

      // Validate timestamp
      const timestampValidation = this.validateTimestamp(signature);

      // Combine all validation results
      const result = this.combineValidationResults(
        cryptoVerification,
        trustValidation,
        revocationCheck,
        timestampValidation,
        signature
      );

      // Cache result
      this.verificationCache.set(cacheKey, result);

      logger.info(
        `Signature verification completed for ${plugin.name}: ${result.valid ? 'VALID' : 'INVALID'} (${result.trustLevel})`
      );
      return result;
    } catch (error: unknown) {
      logger.error(
        `Signature verification error for ${plugin.name}: ${error.message}`
      );
      return {
        valid: false,
        trustLevel: 'untrusted',
        error: `Verification error: ${error.message}`,
        warnings: [],
      };
    }
  }

  /**
   * Sign a plugin with the provided private key
   */
  async signPlugin(
    plugin: IPlugin,
    privateKey: string,
    keyId: string
  ): Promise<PluginSignature> {
    try {
      logger.info(`Signing plugin: ${plugin.name}`);

      // Generate plugin fingerprint
      const pluginFingerprint = this.generatePluginFingerprint(plugin);

      // Create signature
      const signature = crypto.sign(
        'RSA-SHA256',
        Buffer.from(pluginFingerprint),
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        }
      );

      // Get certificate info if available
      const certInfo = this.getCertificateInfo(keyId);

      const pluginSignature: PluginSignature = {
        signature: signature.toString('base64'),
        algorithm: 'RS256',
        keyId,
        timestamp: Date.now(),
        version: '1.0',
        metadata: certInfo
          ? {
              issuer: certInfo.issuer,
              subject: certInfo.subject,
              validFrom: certInfo.validFrom.getTime(),
              validTo: certInfo.validTo.getTime(),
            }
          : undefined,
      };

      logger.info(`Plugin signed successfully: ${plugin.name}`);
      return pluginSignature;
    } catch (error: unknown) {
      logger.error(`Failed to sign plugin ${plugin.name}: ${error.message}`);
      throw new Error(`Plugin signing failed: ${error.message}`);
    }
  }

  /**
   * Add trusted publisher to trust store
   */
  async addTrustedPublisher(publisher: TrustedPublisher): Promise<void> {
    try {
      // Validate publisher data
      this.validateTrustedPublisher(publisher);

      // Add to trust store
      this.trustStore.set(publisher.keyId, publisher);

      // Persist to disk
      await this.saveTrustStore();

      logger.info(
        `Added trusted publisher: ${publisher.name} (${publisher.keyId})`
      );
    } catch (error: unknown) {
      logger.error(`Failed to add trusted publisher: ${error.message}`);
      throw error;
    }
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(
    keyId: string,
    reason: RevokedCertificate['reason']
  ): Promise<void> {
    try {
      const revokedCert: RevokedCertificate = {
        keyId,
        revocationDate: new Date(),
        reason,
        issuer: 'plugin-security-system',
      };

      this.revocationList.set(keyId, revokedCert);

      // Remove from trust store
      this.trustStore.delete(keyId);

      // Persist changes
      await Promise.all([this.saveRevocationList(), this.saveTrustStore()]);

      // Clear verification cache for this key
      this.clearCacheForKey(keyId);

      logger.warn(`Certificate revoked: ${keyId} (${reason})`);
    } catch (error: unknown) {
      logger.error(`Failed to revoke certificate ${keyId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate signature format
   */
  private validateSignatureFormat(signature: PluginSignature): {
    valid: boolean;
    error?: string;
  } {
    if (!signature.signature || typeof signature.signature !== 'string') {
      return {
        valid: false,
        error: 'Invalid signature format - missing or invalid signature field',
      };
    }

    if (!signature.algorithm || typeof signature.algorithm !== 'string') {
      return {
        valid: false,
        error: 'Invalid signature format - missing or invalid algorithm field',
      };
    }

    if (!signature.keyId || typeof signature.keyId !== 'string') {
      return {
        valid: false,
        error: 'Invalid signature format - missing or invalid keyId field',
      };
    }

    if (!signature.timestamp || typeof signature.timestamp !== 'number') {
      return {
        valid: false,
        error: 'Invalid signature format - missing or invalid timestamp field',
      };
    }

    // Validate base64 signature
    try {
      Buffer.from(signature.signature, 'base64');
    } catch {
      return {
        valid: false,
        error: 'Invalid signature format - signature is not valid base64',
      };
    }

    return { valid: true };
  }

  /**
   * Generate plugin fingerprint for signature verification
   */
  private generatePluginFingerprint(plugin: IPlugin): string {
    const pluginData = {
      name: plugin.name,
      version: plugin.version,
      description: plugin.description,
      author: plugin.author,
      // Include function code for verification
      execute: plugin.execute?.toString() || '',
      init: plugin.init?.toString() || '',
      // Include metadata
      timestamp: (plugin as any).timestamp || Date.now(),
    };

    // Create deterministic hash
    const jsonString = JSON.stringify(
      pluginData,
      Object.keys(pluginData).sort()
    );
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }

  /**
   * Verify cryptographic signature
   */
  private async verifyCryptographicSignature(
    data: string,
    signature: PluginSignature
  ): Promise<{ valid: boolean; error?: string; warnings?: string[] }> {
    try {
      // Get public key for verification
      const publicKey = await this.getPublicKey(signature.keyId);
      if (!publicKey) {
        return {
          valid: false,
          error: `Public key not found for keyId: ${signature.keyId}`,
        };
      }

      // Verify signature
      const isValid = crypto.verify(
        'RSA-SHA256',
        Buffer.from(data),
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        },
        Buffer.from(signature.signature, 'base64')
      );

      return {
        valid: isValid,
        error: isValid
          ? undefined
          : 'Cryptographic signature verification failed',
      };
    } catch (error: unknown) {
      return {
        valid: false,
        error: `Signature verification error: ${error.message}`,
      };
    }
  }

  /**
   * Validate trust chain
   */
  private async validateTrustChain(signature: PluginSignature): Promise<{
    trustLevel: SignatureVerificationResult['trustLevel'];
    warnings: string[];
    certificateChain?: CertificateInfo[];
  }> {
    const warnings: string[] = [];

    // Check if key is in trust store
    const trustedPublisher = this.trustStore.get(signature.keyId);

    if (!trustedPublisher) {
      if (this.config.allowSelfSigned) {
        warnings.push('Self-signed certificate - limited trust');
        return { trustLevel: 'basic', warnings };
      }
      return {
        trustLevel: 'untrusted',
        warnings: ['Publisher not in trust store'],
      };
    }

    // Check if publisher is revoked
    if (trustedPublisher.revoked) {
      return {
        trustLevel: 'untrusted',
        warnings: ['Publisher has been revoked'],
      };
    }

    // Check expiration
    if (new Date() > trustedPublisher.validTo) {
      if (!this.config.allowExpiredCertificates) {
        return {
          trustLevel: 'untrusted',
          warnings: ['Certificate has expired'],
        };
      }
      warnings.push('Certificate has expired but allowed by configuration');
    }

    // Check not yet valid
    if (new Date() < trustedPublisher.validFrom) {
      return {
        trustLevel: 'untrusted',
        warnings: ['Certificate not yet valid'],
      };
    }

    return { trustLevel: trustedPublisher.trustLevel, warnings };
  }

  /**
   * Check revocation status
   */
  private async checkRevocationStatus(signature: PluginSignature): Promise<{
    revoked: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    if (!this.config.checkRevocation) {
      return { revoked: false, warnings };
    }

    // Check local revocation list
    const revokedCert = this.revocationList.get(signature.keyId);
    if (revokedCert) {
      return {
        revoked: true,
        warnings: [`Certificate revoked: ${revokedCert.reason}`],
      };
    }

    // Online revocation checking would go here
    if (this.config.allowOnlineRevocationCheck) {
      warnings.push('Online revocation checking not implemented');
    }

    return { revoked: false, warnings };
  }

  /**
   * Validate timestamp
   */
  private validateTimestamp(signature: PluginSignature): {
    valid: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];

    if (!this.config.requireTimestamp) {
      return { valid: true, warnings };
    }

    if (!signature.timestamp) {
      return {
        valid: false,
        warnings: ['Timestamp required but not provided'],
      };
    }

    const now = Date.now();
    const clockSkewMs = this.config.allowClockSkewSeconds * 1000;

    // Check if signature is too old or too new
    const timeDiff = Math.abs(now - signature.timestamp);
    if (timeDiff > clockSkewMs) {
      warnings.push(`Timestamp outside allowed clock skew: ${timeDiff}ms`);
      return { valid: false, warnings };
    }

    return { valid: true, warnings };
  }

  /**
   * Combine validation results
   */
  private combineValidationResults(
    crypto: { valid: boolean; error?: string; warnings?: string[] },
    trust: {
      trustLevel: SignatureVerificationResult['trustLevel'];
      warnings: string[];
      certificateChain?: CertificateInfo[];
    },
    revocation: { revoked: boolean; warnings: string[] },
    timestamp: { valid: boolean; warnings: string[] },
    signature: PluginSignature
  ): SignatureVerificationResult {
    const allWarnings = [
      ...(crypto.warnings || []),
      ...trust.warnings,
      ...revocation.warnings,
      ...timestamp.warnings,
    ];

    // Signature is valid only if all checks pass
    const isValid =
      crypto.valid &&
      !revocation.revoked &&
      timestamp.valid &&
      trust.trustLevel !== 'untrusted';

    // Check minimum trust level
    const trustLevelValues = {
      untrusted: 0,
      basic: 1,
      verified: 2,
      trusted: 3,
      official: 4,
    };
    const minTrustValue = trustLevelValues[this.config.minimumTrustLevel];
    const currentTrustValue = trustLevelValues[trust.trustLevel];

    if (currentTrustValue < minTrustValue) {
      return {
        valid: false,
        trustLevel: trust.trustLevel,
        error: `Trust level ${trust.trustLevel} below minimum required ${this.config.minimumTrustLevel}`,
        warnings: allWarnings,
        algorithm: signature.algorithm,
        keyId: signature.keyId,
        timestamp: signature.timestamp,
        certificateChain: trust.certificateChain,
        revoked: revocation.revoked,
        expired: trust.warnings.some(w => w.includes('expired')),
      };
    }

    return {
      valid: isValid,
      trustLevel: trust.trustLevel,
      error: crypto.error,
      warnings: allWarnings,
      algorithm: signature.algorithm,
      keyId: signature.keyId,
      issuer: signature.metadata?.issuer,
      timestamp: signature.timestamp,
      certificateChain: trust.certificateChain,
      revoked: revocation.revoked,
      expired: trust.warnings.some(w => w.includes('expired')),
    };
  }

  /**
   * Generate cache key for verification result
   */
  private generateCacheKey(
    plugin: IPlugin,
    signature: PluginSignature
  ): string {
    const pluginHash = this.generatePluginFingerprint(plugin);
    const sigHash = crypto
      .createHash('sha256')
      .update(`${signature.signature}${signature.keyId}${signature.timestamp}`)
      .digest('hex');
    return `${pluginHash}-${sigHash}`;
  }

  /**
   * Get public key for verification
   */
  private async getPublicKey(keyId: string): Promise<string | null> {
    const trustedPublisher = this.trustStore.get(keyId);
    return trustedPublisher?.publicKey || null;
  }

  /**
   * Get certificate information
   */
  private getCertificateInfo(keyId: string): CertificateInfo | null {
    const trustedPublisher = this.trustStore.get(keyId);
    if (!trustedPublisher) return null;

    return {
      subject: trustedPublisher.name,
      issuer: trustedPublisher.organization,
      serialNumber: keyId,
      validFrom: trustedPublisher.validFrom,
      validTo: trustedPublisher.validTo,
      fingerprint: crypto
        .createHash('sha256')
        .update(trustedPublisher.publicKey)
        .digest('hex'),
      publicKey: trustedPublisher.publicKey,
      keyUsage: trustedPublisher.permissions,
      isCA: trustedPublisher.trustLevel === 'official',
    };
  }

  /**
   * Validate trusted publisher data
   */
  private validateTrustedPublisher(publisher: TrustedPublisher): void {
    if (!publisher.keyId || !publisher.publicKey || !publisher.name) {
      throw new Error('Trusted publisher missing required fields');
    }

    if (
      !['basic', 'verified', 'trusted', 'official'].includes(
        publisher.trustLevel
      )
    ) {
      throw new Error('Invalid trust level');
    }

    // Validate public key format
    try {
      crypto.createPublicKey(publisher.publicKey);
    } catch (error: unknown) {
      throw new Error('Invalid public key format');
    }

    // Validate dates
    if (publisher.validFrom >= publisher.validTo) {
      throw new Error('Invalid validity period');
    }
  }

  /**
   * Load trust store from disk
   */
  private async loadTrustStore(): Promise<void> {
    try {
      const trustStoreData = await fs.readFile(
        this.config.trustStorePath,
        'utf8'
      );
      const publishers = JSON.parse(trustStoreData) as TrustedPublisher[];

      this.trustStore.clear();
      for (const publisher of publishers) {
        // Convert date strings back to Date objects
        publisher.validFrom = new Date(publisher.validFrom);
        publisher.validTo = new Date(publisher.validTo);
        this.trustStore.set(publisher.keyId, publisher);
      }

      logger.info(`Loaded ${publishers.length} trusted publishers`);
    } catch (error: unknown) {
      if (error.code === 'ENOENT') {
        logger.info('Trust store not found - creating empty trust store');
        await this.createDefaultTrustStore();
      } else {
        logger.error(`Failed to load trust store: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Save trust store to disk
   */
  private async saveTrustStore(): Promise<void> {
    try {
      const publishers = Array.from(this.trustStore.values());
      const trustStoreData = JSON.stringify(publishers, null, 2);

      await fs.mkdir(path.dirname(this.config.trustStorePath), {
        recursive: true,
      });
      await fs.writeFile(this.config.trustStorePath, trustStoreData);

      logger.debug('Trust store saved successfully');
    } catch (error: unknown) {
      logger.error(`Failed to save trust store: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load revocation list from disk
   */
  private async loadRevocationList(): Promise<void> {
    try {
      const revocationData = await fs.readFile(
        this.config.revocationListPath,
        'utf8'
      );
      const revocations = JSON.parse(revocationData) as RevokedCertificate[];

      this.revocationList.clear();
      for (const revocation of revocations) {
        // Convert date strings back to Date objects
        revocation.revocationDate = new Date(revocation.revocationDate);
        this.revocationList.set(revocation.keyId, revocation);
      }

      logger.info(`Loaded ${revocations.length} revoked certificates`);
    } catch (error: unknown) {
      if (error.code === 'ENOENT') {
        logger.info('Revocation list not found - creating empty list');
        await this.saveRevocationList();
      } else {
        logger.error(`Failed to load revocation list: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Save revocation list to disk
   */
  private async saveRevocationList(): Promise<void> {
    try {
      const revocations = Array.from(this.revocationList.values());
      const revocationData = JSON.stringify(revocations, null, 2);

      await fs.mkdir(path.dirname(this.config.revocationListPath), {
        recursive: true,
      });
      await fs.writeFile(this.config.revocationListPath, revocationData);

      logger.debug('Revocation list saved successfully');
    } catch (error: unknown) {
      logger.error(`Failed to save revocation list: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create default trust store with system certificates
   */
  private async createDefaultTrustStore(): Promise<void> {
    // This would include system default trusted publishers
    const defaultPublishers: TrustedPublisher[] = [
      {
        keyId: 'system-default',
        publicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----', // Would be actual key
        name: 'System Default',
        organization: 'Plugin Security System',
        trustLevel: 'official',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        permissions: ['*'],
        revoked: false,
        metadata: {
          description: 'Default system certificate for plugin signing',
        },
      },
    ];

    for (const publisher of defaultPublishers) {
      this.trustStore.set(publisher.keyId, publisher);
    }

    await this.saveTrustStore();
    logger.info('Created default trust store');
  }

  /**
   * Clear verification cache for a specific key
   */
  private clearCacheForKey(keyId: string): void {
    const keysToDelete = Array.from(this.verificationCache.keys()).filter(key =>
      key.includes(keyId)
    );

    for (const key of keysToDelete) {
      this.verificationCache.delete(key);
    }
  }

  /**
   * Get trust store statistics
   */
  getTrustStoreStats(): object {
    const publishers = Array.from(this.trustStore.values());
    const revoked = Array.from(this.revocationList.values());

    const trustLevelCounts = publishers.reduce(
      (counts, pub) => {
        counts[pub.trustLevel] = (counts[pub.trustLevel] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>
    );

    return {
      totalPublishers: publishers.length,
      revokedCertificates: revoked.length,
      trustLevelDistribution: trustLevelCounts,
      cacheSize: this.verificationCache.size,
    };
  }

  /**
   * Cleanup verification cache and resources
   */
  cleanup(): void {
    this.verificationCache.clear();
    logger.info('Signature verifier cleanup completed');
  }
}

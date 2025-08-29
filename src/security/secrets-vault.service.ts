/**
 * @fileoverview Enterprise secrets management with vault integration and encryption
 * @lastmodified 2025-08-27T16:15:00Z
 *
 * Features: Encrypted secret storage, automatic rotation, environment-based config, audit logging
 * Main APIs: setSecret(), getSecret(), rotateSecret(), rotateAllSecrets()
 * Constraints: Requires VAULT_TOKEN, VAULT_URL, or local encrypted storage
 * Patterns: Vault pattern, encryption at rest, audit trail, automatic expiration
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { cryptoService } from './cryptographic.service';

export interface SecretMetadata {
  id: string;
  name: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  rotationPolicy?: RotationPolicy;
  tags: string[];
  encrypted: boolean;
}

export interface RotationPolicy {
  enabled: boolean;
  intervalDays: number;
  reminderDays: number;
  autoRotate: boolean;
}

export interface VaultConfig {
  provider: 'local' | 'hashicorp' | 'aws' | 'azure';
  encryptionEnabled: boolean;
  vaultUrl?: string;
  token?: string;
  storePath?: string;
  defaultRotationPolicy?: RotationPolicy;
}

export interface SecretEntry {
  metadata: SecretMetadata;
  value: string;
  checksum: string;
}

export interface AuditEvent {
  timestamp: Date;
  operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'ROTATE';
  secretId: string;
  userId?: string;
  source: string;
  success: boolean;
  error?: string;
}

/**
 * Enterprise-grade secrets management with vault integration
 */
export class SecretsVaultService {
  private readonly config: Required<VaultConfig>;

  private readonly secrets = new Map<string, SecretEntry>();

  private readonly auditLog: AuditEvent[] = [];

  private readonly storePath: string;

  private isInitialized = false;

  constructor(config: Partial<VaultConfig> = {}) {
    this.config = {
      provider: config.provider || 'local',
      encryptionEnabled: config.encryptionEnabled ?? true,
      vaultUrl: config.vaultUrl || VAULT_URL.$2 || '',
      token: config.token || VAULT_TOKEN.$2 || '',
      storePath: config.storePath || path.join(process.cwd(), '.vault'),
      defaultRotationPolicy: config.defaultRotationPolicy || {
        enabled: true,
        intervalDays: 90,
        reminderDays: 7,
        autoRotate: false,
      },
    };

    this.storePath = this.config.storePath;
    this.validateConfiguration();
  }

  /**
   * Initialize the secrets vault
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureStorageDirectory();
      await this.loadSecretsFromStorage();
      this.setupRotationScheduler();
      this.isInitialized = true;
      logger.info(
        `Secrets vault initialized with ${this.config.provider} provider`
      );
    } catch (error: unknown) {
      logger.error('Failed to initialize secrets vault', error as Error);
      throw new Error('Secrets vault initialization failed');
    }
  }

  /**
   * Store a secret with metadata and encryption
   */
  async setSecret(
    name: string,
    value: string,
    options: {
      expiresAt?: Date;
      rotationPolicy?: Partial<RotationPolicy>;
      tags?: string[];
      userId?: string;
    } = {}
  ): Promise<string> {
    this.ensureInitialized();

    try {
      const secretId = this.generateSecretId(name);
      const now = new Date();

      // Encrypt the secret value if encryption is enabled
      let encryptedValue = value;
      let encrypted = false;

      if (this.config.encryptionEnabled) {
        const encryptedPayload = cryptoService.encryptAES256GCM(
          value,
          Buffer.from(`secret-${secretId}`)
        );
        encryptedValue = JSON.stringify(encryptedPayload);
        encrypted = true;
      }

      const metadata: SecretMetadata = {
        id: secretId,
        name,
        version: this.getNextVersion(name),
        createdAt: now,
        updatedAt: now,
        expiresAt: options.expiresAt,
        rotationPolicy: {
          ...this.config.defaultRotationPolicy,
          ...options.rotationPolicy,
        },
        tags: options.tags || [],
        encrypted,
      };

      const checksum = cryptoService.generateHMAC(
        encryptedValue,
        `secret-${secretId}`
      );

      const secretEntry: SecretEntry = {
        metadata,
        value: encryptedValue,
        checksum,
      };

      this.secrets.set(secretId, secretEntry);
      await this.persistSecret(secretEntry);

      this.logAuditEvent('CREATE', secretId, options.userId, true);
      logger.info(`Secret stored: ${name} (${secretId})`);

      return secretId;
    } catch (error: unknown) {
      this.logAuditEvent(
        'CREATE',
        name,
        options.userId,
        false,
        (error as Error).message
      );
      logger.error('Failed to store secret', error as Error);
      throw new Error('Failed to store secret');
    }
  }

  /**
   * Retrieve and decrypt a secret
   */
  async getSecret(secretId: string, userId?: string): Promise<string | null> {
    this.ensureInitialized();

    try {
      const secretEntry = this.secrets.get(secretId);
      if (!secretEntry) {
        this.logAuditEvent('READ', secretId, userId, false, 'Secret not found');
        return null;
      }

      // Check if secret has expired
      if (
        secretEntry.metadata.expiresAt &&
        secretEntry.metadata.expiresAt < new Date()
      ) {
        this.logAuditEvent('READ', secretId, userId, false, 'Secret expired');
        logger.warn(`Attempted to access expired secret: ${secretId}`);
        return null;
      }

      // Verify checksum
      const expectedChecksum = cryptoService.generateHMAC(
        secretEntry.value,
        `secret-${secretId}`
      );
      if (expectedChecksum !== secretEntry.checksum) {
        this.logAuditEvent(
          'READ',
          secretId,
          userId,
          false,
          'Checksum validation failed'
        );
        logger.error(`Checksum validation failed for secret: ${secretId}`);
        throw new Error('Secret integrity check failed');
      }

      let decryptedValue = secretEntry.value;

      if (secretEntry.metadata.encrypted) {
        try {
          const encryptedPayload = JSON.parse(secretEntry.value);
          const decryptedBuffer = cryptoService.decryptAES256GCM(
            encryptedPayload,
            Buffer.from(`secret-${secretId}`)
          );
          decryptedValue = decryptedBuffer.toString('utf8');
        } catch (decryptError) {
          this.logAuditEvent(
            'READ',
            secretId,
            userId,
            false,
            'Decryption failed'
          );
          logger.error(
            `Failed to decrypt secret: ${secretId}`,
            decryptError as Error
          );
          throw new Error('Failed to decrypt secret');
        }
      }

      this.logAuditEvent('READ', secretId, userId, true);
      return decryptedValue;
    } catch (error: unknown) {
      this.logAuditEvent(
        'READ',
        secretId,
        userId,
        false,
        (error as Error).message
      );
      logger.error('Failed to retrieve secret', error as Error);
      throw error;
    }
  }

  /**
   * Rotate a secret with a new value
   */
  async rotateSecret(
    secretId: string,
    newValue: string,
    userId?: string
  ): Promise<boolean> {
    this.ensureInitialized();

    try {
      const secretEntry = this.secrets.get(secretId);
      if (!secretEntry) {
        this.logAuditEvent(
          'ROTATE',
          secretId,
          userId,
          false,
          'Secret not found'
        );
        return false;
      }

      const now = new Date();
      const updatedMetadata = {
        ...secretEntry.metadata,
        version: secretEntry.metadata.version + 1,
        updatedAt: now,
      };

      // Encrypt new value
      let encryptedValue = newValue;
      if (this.config.encryptionEnabled) {
        const encryptedPayload = cryptoService.encryptAES256GCM(
          newValue,
          Buffer.from(`secret-${secretId}`)
        );
        encryptedValue = JSON.stringify(encryptedPayload);
      }

      const checksum = cryptoService.generateHMAC(
        encryptedValue,
        `secret-${secretId}`
      );

      const updatedEntry: SecretEntry = {
        metadata: updatedMetadata,
        value: encryptedValue,
        checksum,
      };

      this.secrets.set(secretId, updatedEntry);
      await this.persistSecret(updatedEntry);

      this.logAuditEvent('ROTATE', secretId, userId, true);
      logger.info(`Secret rotated: ${secretEntry.metadata.name} (${secretId})`);

      return true;
    } catch (error: unknown) {
      this.logAuditEvent(
        'ROTATE',
        secretId,
        userId,
        false,
        (error as Error).message
      );
      logger.error('Failed to rotate secret', error as Error);
      return false;
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(secretId: string, userId?: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const secretEntry = this.secrets.get(secretId);
      if (!secretEntry) {
        this.logAuditEvent(
          'DELETE',
          secretId,
          userId,
          false,
          'Secret not found'
        );
        return false;
      }

      this.secrets.delete(secretId);
      await this.removeSecretFromStorage(secretId);

      this.logAuditEvent('DELETE', secretId, userId, true);
      logger.info(`Secret deleted: ${secretEntry.metadata.name} (${secretId})`);

      return true;
    } catch (error: unknown) {
      this.logAuditEvent(
        'DELETE',
        secretId,
        userId,
        false,
        (error as Error).message
      );
      logger.error('Failed to delete secret', error as Error);
      return false;
    }
  }

  /**
   * List all secrets (metadata only)
   */
  listSecrets(tags?: string[]): SecretMetadata[] {
    this.ensureInitialized();

    const secrets = Array.from(this.secrets.values()).map(
      entry => entry.metadata
    );

    if (tags && tags.length > 0) {
      return secrets.filter(metadata =>
        tags.some(tag => metadata.tags.includes(tag))
      );
    }

    return secrets;
  }

  /**
   * Get secrets that need rotation
   */
  getSecretsNeedingRotation(): SecretMetadata[] {
    this.ensureInitialized();

    const now = new Date();
    return Array.from(this.secrets.values())
      .map(entry => entry.metadata)
      .filter(metadata => {
        if (!metadata.rotationPolicy?.enabled) return false;

        const daysSinceUpdate = Math.floor(
          (now.getTime() - metadata.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        return daysSinceUpdate >= metadata.rotationPolicy.intervalDays;
      });
  }

  /**
   * Auto-rotate secrets based on policies
   */
  async rotateAllSecrets(
    userId?: string
  ): Promise<{ rotated: number; failed: number }> {
    this.ensureInitialized();

    const secretsToRotate = this.getSecretsNeedingRotation().filter(
      metadata => metadata.rotationPolicy?.autoRotate
    );

    let rotated = 0;
    let failed = 0;

    for (const metadata of secretsToRotate) {
      try {
        // Generate new secure value
        const newValue = cryptoService.generateSecureKey(32);
        const success = await this.rotateSecret(metadata.id, newValue, userId);

        if (success) {
          rotated++;
        } else {
          failed++;
        }
      } catch (error: unknown) {
        logger.error(`Auto-rotation failed for ${metadata.id}`, error as Error);
        failed++;
      }
    }

    logger.info(
      `Auto-rotation completed: ${rotated} rotated, ${failed} failed`
    );
    return { rotated, failed };
  }

  /**
   * Get audit log entries
   */
  getAuditLog(
    options: {
      secretId?: string;
      userId?: string;
      operation?: AuditEvent['operation'];
      limit?: number;
    } = {}
  ): AuditEvent[] {
    let filtered = this.auditLog;

    if (options.secretId) {
      filtered = filtered.filter(event => event.secretId === options.secretId);
    }

    if (options.userId) {
      filtered = filtered.filter(event => event.userId === options.userId);
    }

    if (options.operation) {
      filtered = filtered.filter(
        event => event.operation === options.operation
      );
    }

    if (options.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Get vault statistics
   */
  getVaultStats() {
    this.ensureInitialized();

    const now = new Date();
    const secrets = Array.from(this.secrets.values());

    return {
      totalSecrets: secrets.length,
      encryptedSecrets: secrets.filter(s => s.metadata.encrypted).length,
      expiredSecrets: secrets.filter(
        s => s.metadata.expiresAt && s.metadata.expiresAt < now
      ).length,
      secretsNeedingRotation: this.getSecretsNeedingRotation().length,
      totalAuditEvents: this.auditLog.length,
      provider: this.config.provider,
      encryptionEnabled: this.config.encryptionEnabled,
    };
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(): void {
    if (this.config.provider === 'hashicorp' && !this.config.vaultUrl) {
      throw new Error('Vault URL required for HashiCorp Vault provider');
    }

    if (this.config.provider !== 'local' && !this.config.token) {
      logger.warn('No vault token configured - some operations may fail');
    }
  }

  /**
   * Ensure vault is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        'Secrets vault not initialized - call initialize() first'
      );
    }
  }

  /**
   * Generate unique secret ID
   */
  private generateSecretId(name: string): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    const nameHash = crypto
      .createHash('sha256')
      .update(name)
      .digest('hex')
      .slice(0, 8);
    return `${nameHash}-${timestamp}-${random}`;
  }

  /**
   * Get next version number for a secret name
   */
  private getNextVersion(name: string): number {
    const existingVersions = Array.from(this.secrets.values())
      .filter(entry => entry.metadata.name === name)
      .map(entry => entry.metadata.version);

    return existingVersions.length > 0 ? Math.max(...existingVersions) + 1 : 1;
  }

  /**
   * Log audit event
   */
  private logAuditEvent(
    operation: AuditEvent['operation'],
    secretId: string,
    userId?: string,
    success: boolean = true,
    error?: string
  ): void {
    const event: AuditEvent = {
      timestamp: new Date(),
      operation,
      secretId,
      userId,
      source: 'SecretsVaultService',
      success,
      error,
    };

    this.auditLog.push(event);

    // Keep audit log size manageable
    if (this.auditLog.length > 10000) {
      this.auditLog.splice(0, 1000);
    }
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storePath, { recursive: true, mode: 0o700 });
    } catch (error: unknown) {
      logger.error('Failed to create vault storage directory', error as Error);
      throw error;
    }
  }

  /**
   * Load secrets from storage
   */
  private async loadSecretsFromStorage(): Promise<void> {
    try {
      const files = await fs.readdir(this.storePath);

      for (const file of files) {
        if (file.endsWith('.secret')) {
          const filePath = path.join(this.storePath, file);
          const content = await fs.readFile(filePath, 'utf8');
          const secretEntry: SecretEntry = JSON.parse(content);
          this.secrets.set(secretEntry.metadata.id, secretEntry);
        }
      }

      logger.info(`Loaded ${this.secrets.size} secrets from storage`);
    } catch (error: unknown) {
      logger.warn('Failed to load secrets from storage', error as Error);
      // Continue with empty vault
    }
  }

  /**
   * Persist secret to storage
   */
  private async persistSecret(secretEntry: SecretEntry): Promise<void> {
    const filename = `${secretEntry.metadata.id}.secret`;
    const filePath = path.join(this.storePath, filename);

    try {
      await fs.writeFile(filePath, JSON.stringify(secretEntry, null, 2), {
        mode: 0o600,
      });
    } catch (error: unknown) {
      logger.error('Failed to persist secret to storage', error as Error);
      throw error;
    }
  }

  /**
   * Remove secret from storage
   */
  private async removeSecretFromStorage(secretId: string): Promise<void> {
    const filename = `${secretId}.secret`;
    const filePath = path.join(this.storePath, filename);

    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      logger.warn('Failed to remove secret from storage', error as Error);
      // Continue - secret already removed from memory
    }
  }

  /**
   * Setup automatic rotation scheduler
   */
  private setupRotationScheduler(): void {
    // Run rotation check every hour
    setInterval(
      async () => {
        try {
          const stats = await this.rotateAllSecrets('system');
          if (stats.rotated > 0 || stats.failed > 0) {
            logger.info(
              `Scheduled rotation: ${stats.rotated} rotated, ${stats.failed} failed`
            );
          }
        } catch (error: unknown) {
          logger.error('Scheduled rotation failed', error as Error);
        }
      },
      60 * 60 * 1000
    ); // 1 hour
  }
}

/**
 * Global secrets vault instance
 */
export const secretsVault = new SecretsVaultService();

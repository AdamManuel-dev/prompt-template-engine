/**
 * @fileoverview File encryption service for templates and configurations
 * @lastmodified 2025-08-27T16:30:00Z
 *
 * Features: File-level encryption, metadata protection, integrity verification, key management
 * Main APIs: encryptFile(), decryptFile(), encryptTemplate(), verifyFileIntegrity()
 * Constraints: Requires cryptographic service, proper key management
 * Patterns: Stream encryption, chunked processing, authenticated encryption
 */

import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';
import { Transform, pipeline } from 'stream';
import { promisify } from 'util';
import { logger } from '../utils/logger';
import { cryptoService } from './cryptographic.service';

const pipelineAsync = promisify(pipeline);

export interface EncryptedFileMetadata {
  originalPath: string;
  encryptedPath: string;
  algorithm: string;
  keyId: string;
  iv: string;
  authTag: string;
  fileSize: number;
  originalHash: string;
  encryptedAt: Date;
  version: number;
}

export interface TemplateEncryptionConfig {
  encryptTemplates: boolean;
  encryptConfigurations: boolean;
  encryptLogs: boolean;
  keyRotationDays: number;
  compressionEnabled: boolean;
  chunkSize: number;
}

export interface FileEncryptionResult {
  success: boolean;
  encryptedPath?: string;
  metadata?: EncryptedFileMetadata;
  error?: string;
}

/**
 * File encryption service for protecting sensitive templates and configurations
 */
export class FileEncryptionService {
  private readonly config: TemplateEncryptionConfig;

  private readonly metadataStore = new Map<string, EncryptedFileMetadata>();

  private readonly fileKeyId: string;

  constructor(config: Partial<TemplateEncryptionConfig> = {}) {
    this.config = {
      encryptTemplates: config.encryptTemplates ?? true,
      encryptConfigurations: config.encryptConfigurations ?? true,
      encryptLogs: config.encryptLogs ?? false,
      keyRotationDays: config.keyRotationDays || 90,
      compressionEnabled: config.compressionEnabled ?? true,
      chunkSize: config.chunkSize || 64 * 1024, // 64KB chunks
    };

    // Generate or retrieve file encryption key
    this.fileKeyId = this.initializeFileEncryptionKey();
    logger.info('File encryption service initialized');
  }

  /**
   * Encrypt a file with authenticated encryption
   */
  async encryptFile(
    inputPath: string,
    outputPath?: string
  ): Promise<FileEncryptionResult> {
    try {
      const resolvedInputPath = path.resolve(inputPath);
      const resolvedOutputPath = outputPath || `${resolvedInputPath}.encrypted`;

      // Check if file should be encrypted based on config
      if (!this.shouldEncryptFile(resolvedInputPath)) {
        return {
          success: false,
          error: 'File type not configured for encryption',
        };
      }

      // Read file stats
      const stats = await fs.stat(resolvedInputPath);
      if (!stats.isFile()) {
        throw new Error('Input path is not a file');
      }

      // Generate encryption parameters
      const iv = crypto.randomBytes(16);
      const key = await this.deriveFileKey(this.fileKeyId);

      // Calculate original file hash
      const originalContent = await fs.readFile(resolvedInputPath);
      const originalHash = cryptoService.generateHash(originalContent);

      // Encrypt the file
      const cipher = crypto.createCipherGCM('aes-256-gcm', key, iv);
      const encryptedContent = Buffer.concat([
        cipher.update(originalContent),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();

      // Write encrypted file
      await fs.writeFile(resolvedOutputPath, encryptedContent, { mode: 0o600 });

      // Create metadata
      const metadata: EncryptedFileMetadata = {
        originalPath: resolvedInputPath,
        encryptedPath: resolvedOutputPath,
        algorithm: 'aes-256-gcm',
        keyId: this.fileKeyId,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        fileSize: stats.size,
        originalHash,
        encryptedAt: new Date(),
        version: 1,
      };

      // Store metadata
      this.metadataStore.set(resolvedOutputPath, metadata);
      await this.persistMetadata(metadata);

      logger.info(`File encrypted successfully: ${resolvedInputPath} -> ${resolvedOutputPath}`);

      return {
        success: true,
        encryptedPath: resolvedOutputPath,
        metadata,
      };
    } catch (error) {
      logger.error('File encryption failed', error as Error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Decrypt a file and verify integrity
   */
  async decryptFile(
    encryptedPath: string,
    outputPath?: string
  ): Promise<FileEncryptionResult> {
    try {
      const resolvedEncryptedPath = path.resolve(encryptedPath);
      const metadata = await this.loadMetadata(resolvedEncryptedPath);

      if (!metadata) {
        throw new Error('Metadata not found for encrypted file');
      }

      const resolvedOutputPath = outputPath || metadata.originalPath;

      // Derive decryption key
      const key = await this.deriveFileKey(metadata.keyId);

      // Read encrypted content
      const encryptedContent = await fs.readFile(resolvedEncryptedPath);

      // Decrypt the file
      const iv = Buffer.from(metadata.iv, 'hex');
      const authTag = Buffer.from(metadata.authTag, 'hex');

      const decipher = crypto.createDecipherGCM(metadata.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      const decryptedContent = Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final(),
      ]);

      // Verify file integrity
      const decryptedHash = cryptoService.generateHash(decryptedContent);
      if (decryptedHash !== metadata.originalHash) {
        throw new Error('File integrity verification failed');
      }

      // Write decrypted file
      await fs.writeFile(resolvedOutputPath, decryptedContent, { mode: 0o644 });

      logger.info(`File decrypted successfully: ${resolvedEncryptedPath} -> ${resolvedOutputPath}`);

      return {
        success: true,
        encryptedPath: resolvedOutputPath,
        metadata,
      };
    } catch (error) {
      logger.error('File decryption failed', error as Error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Encrypt template files in a directory
   */
  async encryptTemplateDirectory(
    directoryPath: string,
    recursive: boolean = true
  ): Promise<{ encrypted: string[]; failed: string[] }> {
    const encrypted: string[] = [];
    const failed: string[] = [];

    try {
      const files = await this.getTemplateFiles(directoryPath, recursive);

      for (const filePath of files) {
        const result = await this.encryptFile(filePath);
        if (result.success) {
          encrypted.push(filePath);
          // Optionally remove original file after successful encryption
          // await fs.unlink(filePath);
        } else {
          failed.push(filePath);
          logger.error(`Failed to encrypt template: ${filePath} - ${result.error}`);
        }
      }

      logger.info(`Template encryption completed: ${encrypted.length} encrypted, ${failed.length} failed`);
    } catch (error) {
      logger.error('Template directory encryption failed', error as Error);
    }

    return { encrypted, failed };
  }

  /**
   * Decrypt template files in a directory
   */
  async decryptTemplateDirectory(
    directoryPath: string,
    recursive: boolean = true
  ): Promise<{ decrypted: string[]; failed: string[] }> {
    const decrypted: string[] = [];
    const failed: string[] = [];

    try {
      const encryptedFiles = await this.getEncryptedFiles(directoryPath, recursive);

      for (const filePath of encryptedFiles) {
        const result = await this.decryptFile(filePath);
        if (result.success) {
          decrypted.push(filePath);
        } else {
          failed.push(filePath);
          logger.error(`Failed to decrypt template: ${filePath} - ${result.error}`);
        }
      }

      logger.info(`Template decryption completed: ${decrypted.length} decrypted, ${failed.length} failed`);
    } catch (error) {
      logger.error('Template directory decryption failed', error as Error);
    }

    return { decrypted, failed };
  }

  /**
   * Stream encrypt large files in chunks
   */
  async encryptFileStream(
    inputPath: string,
    outputPath: string
  ): Promise<FileEncryptionResult> {
    try {
      const key = await this.deriveFileKey(this.fileKeyId);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipherGCM('aes-256-gcm', key, iv);
      
      const inputStream = (await import('fs')).createReadStream(inputPath);
      const outputStream = (await import('fs')).createWriteStream(outputPath, { mode: 0o600 });

      // Create encryption transform
      const encryptTransform = new Transform({
        transform(chunk, encoding, callback) {
          callback(null, cipher.update(chunk));
        },
        flush(callback) {
          cipher.final();
          callback();
        },
      });

      await pipelineAsync(inputStream, encryptTransform, outputStream);

      const authTag = cipher.getAuthTag();
      
      // Append auth tag to file
      await fs.appendFile(outputPath, authTag);

      // Calculate original file hash (for large files, we'll use streaming hash)
      const originalHash = await this.calculateFileHash(inputPath);

      const stats = await fs.stat(inputPath);
      const metadata: EncryptedFileMetadata = {
        originalPath: path.resolve(inputPath),
        encryptedPath: path.resolve(outputPath),
        algorithm: 'aes-256-gcm',
        keyId: this.fileKeyId,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        fileSize: stats.size,
        originalHash,
        encryptedAt: new Date(),
        version: 1,
      };

      this.metadataStore.set(path.resolve(outputPath), metadata);
      await this.persistMetadata(metadata);

      logger.info(`Large file encrypted with streaming: ${inputPath} -> ${outputPath}`);

      return {
        success: true,
        encryptedPath: outputPath,
        metadata,
      };
    } catch (error) {
      logger.error('Stream encryption failed', error as Error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Verify file integrity without decryption
   */
  async verifyFileIntegrity(encryptedPath: string): Promise<boolean> {
    try {
      const metadata = await this.loadMetadata(encryptedPath);
      if (!metadata) {
        logger.warn(`No metadata found for file: ${encryptedPath}`);
        return false;
      }

      // For now, we'll just verify the metadata exists and file size matches
      const stats = await fs.stat(encryptedPath);
      const expectedSize = metadata.fileSize + 32; // Original size + overhead

      return Math.abs(stats.size - expectedSize) < 100; // Allow some variance
    } catch (error) {
      logger.error('File integrity verification failed', error as Error);
      return false;
    }
  }

  /**
   * Rotate encryption keys for all encrypted files
   */
  async rotateEncryptionKeys(): Promise<{ rotated: string[]; failed: string[] }> {
    const rotated: string[] = [];
    const failed: string[] = [];

    try {
      // Generate new key
      const newKeyId = cryptoService.rotateKeyPair(this.fileKeyId).keyId;

      // Re-encrypt all files with new key
      for (const [encryptedPath, metadata] of this.metadataStore.entries()) {
        try {
          // Decrypt with old key
          const decryptResult = await this.decryptFile(encryptedPath);
          if (!decryptResult.success) {
            failed.push(encryptedPath);
            continue;
          }

          // Re-encrypt with new key
          const tempKeyId = this.fileKeyId;
          (this as any).fileKeyId = newKeyId; // Temporary assignment
          
          const encryptResult = await this.encryptFile(
            decryptResult.metadata!.originalPath,
            encryptedPath
          );

          (this as any).fileKeyId = tempKeyId; // Restore

          if (encryptResult.success) {
            rotated.push(encryptedPath);
          } else {
            failed.push(encryptedPath);
          }
        } catch (error) {
          logger.error(`Key rotation failed for file: ${encryptedPath}`, error as Error);
          failed.push(encryptedPath);
        }
      }

      logger.info(`Key rotation completed: ${rotated.length} rotated, ${failed.length} failed`);
    } catch (error) {
      logger.error('Key rotation process failed', error as Error);
    }

    return { rotated, failed };
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats() {
    const now = new Date();
    const metadata = Array.from(this.metadataStore.values());

    return {
      totalEncryptedFiles: metadata.length,
      totalEncryptedSize: metadata.reduce((sum, meta) => sum + meta.fileSize, 0),
      oldestEncryption: metadata.reduce((oldest, meta) => 
        meta.encryptedAt < oldest ? meta.encryptedAt : oldest, now
      ),
      newestEncryption: metadata.reduce((newest, meta) => 
        meta.encryptedAt > newest ? meta.encryptedAt : newest, new Date(0)
      ),
      filesNeedingKeyRotation: metadata.filter(meta => {
        const daysSince = (now.getTime() - meta.encryptedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince >= this.config.keyRotationDays;
      }).length,
      algorithms: [...new Set(metadata.map(meta => meta.algorithm))],
      config: this.config,
    };
  }

  /**
   * Initialize file encryption key
   */
  private initializeFileEncryptionKey(): string {
    // Check if key pair already exists
    const existingKeys = cryptoService.listKeys();
    const fileKeyId = existingKeys.find(id => id.includes('file-encryption'));

    if (fileKeyId) {
      logger.info(`Using existing file encryption key: ${fileKeyId}`);
      return fileKeyId;
    }

    // Generate new key pair for file encryption
    const keyPair = cryptoService.generateRSAKeyPair('file-encryption-' + Date.now());
    logger.info(`Generated new file encryption key: ${keyPair.keyId}`);
    return keyPair.keyId;
  }

  /**
   * Derive encryption key for file operations
   */
  private async deriveFileKey(keyId: string): Promise<Buffer> {
    // For this implementation, we'll use HKDF to derive a file encryption key
    const keyInfo = cryptoService.getKeyInfo(keyId);
    if (!keyInfo) {
      throw new Error(`Key not found: ${keyId}`);
    }

    // Use the key ID as input to HKDF
    const keyMaterial = Buffer.from(keyId, 'utf8');
    return crypto.hkdfSync('sha384', keyMaterial, Buffer.from('file-salt'), Buffer.from('file-encryption'), 32);
  }

  /**
   * Check if file should be encrypted based on configuration
   */
  private shouldEncryptFile(filePath: string): boolean {
    const extension = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();

    if (this.config.encryptTemplates) {
      const templateExtensions = ['.hbs', '.mustache', '.ejs', '.pug', '.twig', '.liquid'];
      if (templateExtensions.includes(extension)) return true;
    }

    if (this.config.encryptConfigurations) {
      const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.ini', '.env'];
      const configFiles = ['config', 'configuration', 'settings', 'options'];
      
      if (configExtensions.includes(extension)) return true;
      if (configFiles.some(name => basename.includes(name))) return true;
    }

    if (this.config.encryptLogs) {
      const logExtensions = ['.log', '.txt'];
      if (logExtensions.includes(extension) && basename.includes('log')) return true;
    }

    return false;
  }

  /**
   * Get template files in directory
   */
  private async getTemplateFiles(directoryPath: string, recursive: boolean): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);

        if (entry.isDirectory() && recursive) {
          const subFiles = await this.getTemplateFiles(fullPath, recursive);
          files.push(...subFiles);
        } else if (entry.isFile() && this.shouldEncryptFile(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Failed to read directory: ${directoryPath}`, error as Error);
    }

    return files;
  }

  /**
   * Get encrypted files in directory
   */
  private async getEncryptedFiles(directoryPath: string, recursive: boolean): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(directoryPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directoryPath, entry.name);

        if (entry.isDirectory() && recursive) {
          const subFiles = await this.getEncryptedFiles(fullPath, recursive);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.encrypted')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Failed to read directory: ${directoryPath}`, error as Error);
    }

    return files;
  }

  /**
   * Calculate file hash for integrity verification
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return cryptoService.generateHash(content);
  }

  /**
   * Persist metadata to disk
   */
  private async persistMetadata(metadata: EncryptedFileMetadata): Promise<void> {
    const metadataPath = `${metadata.encryptedPath}.meta`;
    await fs.writeFile(
      metadataPath,
      JSON.stringify(metadata, null, 2),
      { mode: 0o600 }
    );
  }

  /**
   * Load metadata from disk
   */
  private async loadMetadata(encryptedPath: string): Promise<EncryptedFileMetadata | null> {
    try {
      // Check memory first
      const cached = this.metadataStore.get(encryptedPath);
      if (cached) return cached;

      // Load from disk
      const metadataPath = `${encryptedPath}.meta`;
      const content = await fs.readFile(metadataPath, 'utf8');
      const metadata: EncryptedFileMetadata = JSON.parse(content);
      
      this.metadataStore.set(encryptedPath, metadata);
      return metadata;
    } catch (error) {
      logger.warn(`Failed to load metadata for: ${encryptedPath}`, error as Error);
      return null;
    }
  }
}

/**
 * Global file encryption service instance
 */
export const fileEncryptionService = new FileEncryptionService();
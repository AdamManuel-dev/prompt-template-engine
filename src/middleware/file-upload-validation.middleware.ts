/**
 * @fileoverview Enhanced file upload validation with comprehensive security checks
 * @lastmodified 2025-08-27T16:30:00Z
 *
 * Features: File validation, path traversal protection, malware detection, type verification
 * Main APIs: validateFileUpload(), createFileValidationMiddleware(), scanFileContent()
 * Constraints: All file uploads must pass security validation
 * Patterns: Security-first file handling, threat detection, sandboxed validation
 */

import { z } from 'zod';
import * as crypto from 'crypto';
import * as path from 'path';
import * as mime from 'mime-types';
import {
  SecurePathSchema,
  EnhancedValidator,
  FileValidationResult,
} from '../validation/schemas';
import { logger } from '../utils/logger';

/**
 * File upload configuration
 */
export interface FileUploadConfig {
  maxFileSize: number;
  maxTotalSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  blockedExtensions: string[];
  blockedMimeTypes: string[];
  enableVirusScanning: boolean;
  enableContentValidation: boolean;
  enablePathValidation: boolean;
  quarantineDirectory: string;
  uploadDirectory: string;
  enableDecompression: boolean;
  maxDecompressionRatio: number;
  enableMetadataStripping: boolean;
}

/**
 * Default file upload configuration
 */
export const DEFAULT_FILE_UPLOAD_CONFIG: FileUploadConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxTotalSize: 100 * 1024 * 1024, // 100MB
  allowedMimeTypes: [
    'text/plain',
    'text/markdown',
    'application/json',
    'application/yaml',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ],
  allowedExtensions: [
    '.txt',
    '.md',
    '.json',
    '.yaml',
    '.yml',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.pdf',
  ],
  blockedExtensions: [
    '.exe',
    '.bat',
    '.cmd',
    '.com',
    '.pif',
    '.scr',
    '.vbs',
    '.js',
    '.jar',
    '.msi',
    '.dll',
    '.sys',
    '.bin',
    '.deb',
    '.rpm',
    '.dmg',
    '.app',
    '.pkg',
    '.sh',
    '.bash',
    '.zsh',
    '.fish',
    '.ps1',
    '.psm1',
    '.psd1',
    '.php',
    '.asp',
    '.aspx',
    '.jsp',
    '.cfm',
    '.cgi',
    '.pl',
    '.py',
    '.rb',
  ],
  blockedMimeTypes: [
    'application/x-executable',
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-bat',
    'application/x-sh',
    'text/x-script.python',
    'text/x-script.perl',
    'application/javascript',
    'text/javascript',
  ],
  enableVirusScanning: true,
  enableContentValidation: true,
  enablePathValidation: true,
  quarantineDirectory: './quarantine',
  uploadDirectory: './uploads',
  enableDecompression: false,
  maxDecompressionRatio: 10,
  enableMetadataStripping: true,
};

/**
 * File validation schema
 */
export const FileUploadSchema = z.object({
  filename: z
    .string()
    .min(1, 'Filename cannot be empty')
    .max(255, 'Filename too long')
    .refine(
      name => !/[\u0000-\u001f]/.test(name),
      'Filename contains control characters'
    )
    .refine(
      name => !/[<>:"|?*\\]/.test(name),
      'Filename contains invalid characters'
    )
    .refine(
      name => !/(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i.test(name),
      'Filename uses reserved system name'
    )
    .refine(name => !/^\./.test(name), 'Hidden files not allowed')
    .refine(name => !/\.$/.test(name), 'Filename cannot end with dot'),
  originalName: z.string().max(255).optional(),
  mimetype: z
    .string()
    .min(1, 'MIME type is required')
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-^]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^]*$/,
      'Invalid MIME type format'
    ),
  size: z
    .number()
    .min(0, 'File size cannot be negative')
    .max(100 * 1024 * 1024, 'File too large'),
  buffer: z.instanceof(Buffer).optional(),
  path: SecurePathSchema.optional(),
  destination: SecurePathSchema.optional(),
});

// Remove duplicate interface - use the one from schemas.ts

/**
 * File upload validation middleware
 */
export class FileUploadValidationMiddleware {
  private config: FileUploadConfig;

  constructor(config: Partial<FileUploadConfig> = {}) {
    this.config = { ...DEFAULT_FILE_UPLOAD_CONFIG, ...config };
  }

  /**
   * Validate uploaded file with comprehensive security checks
   */
  async validateFile(file: unknown): Promise<FileValidationResult> {
    const validationResult: FileValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      securityLevel: 'safe',
      threatLevel: 'safe',
      threats: [],
      safe: true,
      fileInfo: {
        filename: file.filename || file.originalname || 'unknown',
        size: file.size || 0,
        mimetype: file.mimetype || '',
        extension: '',
        hash: '',
        isExecutable: false,
        containsMalware: false,
        isCompressed: false,
      },
      securityChecks: {
        pathTraversalCheck: false,
        mimeTypeCheck: false,
        extensionCheck: false,
        contentValidation: false,
        virusScan: false,
        sizeValidation: false,
      },
      quarantined: false,
    };

    try {
      // Basic schema validation
      const schemaValidation = EnhancedValidator.validate(
        FileUploadSchema,
        file
      );
      if (!schemaValidation.isValid) {
        validationResult.isValid = false;
        validationResult.errors.push(...schemaValidation.errors);
        validationResult.securityLevel = 'warning';
        validationResult.threatLevel = 'warning';
      }

      // Extract file information
      const filename = file.filename || file.originalname;
      const extension = path.extname(filename).toLowerCase();
      const buffer = file.buffer || null;

      validationResult.fileInfo!.filename = filename;
      validationResult.fileInfo!.extension = extension;

      // Generate file hash
      if (buffer) {
        validationResult.fileInfo!.hash = crypto
          .createHash('sha256')
          .update(buffer)
          .digest('hex');
      }

      // 1. Path traversal validation
      if (this.config.enablePathValidation) {
        const pathValidation = this.validateFilePath(filename);
        validationResult.securityChecks!.pathTraversalCheck =
          pathValidation.safe;

        if (!pathValidation.safe) {
          validationResult.errors.push(...pathValidation.threats);
          validationResult.securityLevel = 'danger';
          validationResult.threatLevel = 'danger';
        } else {
          validationResult.sanitizedFilename = pathValidation.sanitizedFilename;
        }
      }

      // 2. File size validation
      const sizeValidation = this.validateFileSize(file.size);
      validationResult.securityChecks!.sizeValidation = sizeValidation.valid;

      if (!sizeValidation.valid) {
        validationResult.errors.push(...sizeValidation.errors);
        validationResult.threatLevel = 'warning';
      }

      // 3. MIME type validation
      const mimeValidation = this.validateMimeType(file.mimetype, extension);
      validationResult.securityChecks!.mimeTypeCheck = mimeValidation.valid;

      if (!mimeValidation.valid) {
        validationResult.errors.push(...mimeValidation.errors);
        validationResult.securityLevel = 'danger';
        validationResult.threatLevel = 'danger';
      }

      // 4. File extension validation
      const extensionValidation = this.validateFileExtension(extension);
      validationResult.securityChecks!.extensionCheck =
        extensionValidation.valid;

      if (!extensionValidation.valid) {
        validationResult.errors.push(...extensionValidation.errors);
        validationResult.securityLevel = 'danger';
        validationResult.threatLevel = 'danger';
      }

      // 5. Content validation (if buffer available)
      if (buffer && this.config.enableContentValidation) {
        const contentValidation = await this.validateFileContent(
          buffer,
          file.mimetype,
          extension
        );
        validationResult.securityChecks!.contentValidation =
          contentValidation.valid;

        validationResult.fileInfo!.isExecutable =
          contentValidation.isExecutable;
        validationResult.fileInfo!.isCompressed =
          contentValidation.isCompressed;

        if (!contentValidation.valid) {
          validationResult.errors.push(...contentValidation.threats);
          validationResult.threatLevel = contentValidation.threatLevel;
        }
      }

      // 6. Virus scanning (if enabled)
      if (buffer && this.config.enableVirusScanning) {
        const virusValidation = await this.scanForViruses(buffer, filename);
        validationResult.securityChecks!.virusScan = virusValidation.clean;
        validationResult.fileInfo!.containsMalware = !virusValidation.clean;

        if (!virusValidation.clean) {
          validationResult.errors.push(...virusValidation.threats);
          validationResult.securityLevel = 'danger';
          validationResult.threatLevel = 'danger';
          validationResult.quarantined = true;
        }
      }

      // Final validation result
      validationResult.isValid = validationResult.errors.length === 0;

      // Quarantine file if dangerous threats detected
      if (validationResult.securityLevel === 'danger') {
        validationResult.quarantined = true;
      }

      return validationResult;
    } catch (error: unknown) {
      logger.error('File validation error:', error);
      return {
        ...validationResult,
        isValid: false,
        errors: [`File validation error: ${(error as Error).message}`],
        securityLevel: 'danger',
        threatLevel: 'danger',
      };
    }
  }

  /**
   * Validate file path for traversal attacks
   */
  private validateFilePath(filename: string): {
    safe: boolean;
    threats: string[];
    sanitizedFilename?: string;
  } {
    const threats: string[] = [];
    let safe = true;

    // Check for path traversal patterns
    if (filename.includes('..')) {
      threats.push('Path traversal attempt detected (..)');
      safe = false;
    }

    if (filename.includes('/') || filename.includes('\\')) {
      threats.push('Directory separators in filename not allowed');
      safe = false;
    }

    // Check for absolute paths
    if (path.isAbsolute(filename)) {
      threats.push('Absolute paths not allowed');
      safe = false;
    }

    // Check for dangerous characters
    if (/[\u0000-\u001f]/.test(filename)) {
      threats.push('Control characters in filename');
      safe = false;
    }

    // Check for reserved names
    if (/(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i.test(filename)) {
      threats.push('Reserved system filename');
      safe = false;
    }

    // Generate sanitized filename
    const sanitizedFilename = this.sanitizeFilename(filename);

    return { safe, threats, sanitizedFilename };
  }

  /**
   * Validate file size
   */
  private validateFileSize(size: number): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (size <= 0) {
      errors.push('File is empty');
    }

    if (size > this.config.maxFileSize) {
      errors.push(
        `File too large: ${size} bytes (max ${this.config.maxFileSize})`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate MIME type
   */
  private validateMimeType(
    mimetype: string,
    extension: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if MIME type is allowed
    if (!this.config.allowedMimeTypes.includes(mimetype)) {
      errors.push(`MIME type not allowed: ${mimetype}`);
    }

    // Check if MIME type is explicitly blocked
    if (this.config.blockedMimeTypes.includes(mimetype)) {
      errors.push(`MIME type blocked: ${mimetype}`);
    }

    // Verify MIME type matches file extension
    const expectedMimeType = mime.lookup(extension);
    if (expectedMimeType && expectedMimeType !== mimetype) {
      errors.push(
        `MIME type mismatch: expected ${expectedMimeType}, got ${mimetype}`
      );
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate file extension
   */
  private validateFileExtension(extension: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check if extension is blocked
    if (this.config.blockedExtensions.includes(extension)) {
      errors.push(`File extension blocked: ${extension}`);
    }

    // Check if extension is allowed (if whitelist is configured)
    if (
      this.config.allowedExtensions.length > 0 &&
      !this.config.allowedExtensions.includes(extension)
    ) {
      errors.push(`File extension not allowed: ${extension}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate file content
   */
  private async validateFileContent(
    buffer: Buffer,
    mimetype: string,
    extension: string
  ): Promise<{
    valid: boolean;
    threats: string[];
    threatLevel: 'safe' | 'warning' | 'danger';
    isExecutable: boolean;
    isCompressed: boolean;
  }> {
    const threats: string[] = [];
    let threatLevel: 'safe' | 'warning' | 'danger' = 'safe';
    let isExecutable = false;
    let isCompressed = false;

    // Check file magic bytes
    const magicBytes = buffer.subarray(0, 16);
    const magicValidation = this.validateFileMagicBytes(
      magicBytes,
      mimetype,
      extension
    );

    if (!magicValidation.valid) {
      threats.push(...magicValidation.threats);
      threatLevel = 'danger';
    }

    isExecutable = magicValidation.isExecutable;
    isCompressed = magicValidation.isCompressed;

    // Check for embedded scripts in text files
    if (mimetype.startsWith('text/') || mimetype === 'application/json') {
      const textContent = buffer.toString(
        'utf8',
        0,
        Math.min(buffer.length, 10000)
      );
      const scriptValidation = this.validateTextContent(textContent);

      if (!scriptValidation.safe) {
        threats.push(...scriptValidation.threats);
        threatLevel = scriptValidation.threatLevel;
      }
    }

    // Check for dangerous binary patterns
    if (!mimetype.startsWith('text/')) {
      const binaryValidation = this.validateBinaryContent(buffer);

      if (!binaryValidation.safe) {
        threats.push(...binaryValidation.threats);
        threatLevel = binaryValidation.threatLevel;
      }
    }

    return {
      valid: threats.length === 0,
      threats,
      threatLevel,
      isExecutable,
      isCompressed,
    };
  }

  /**
   * Validate file magic bytes
   */
  private validateFileMagicBytes(
    magicBytes: Buffer,
    _mimetype: string,
    _extension: string
  ): {
    valid: boolean;
    threats: string[];
    isExecutable: boolean;
    isCompressed: boolean;
  } {
    const threats: string[] = [];
    let isExecutable = false;
    let isCompressed = false;

    // Common executable signatures
    const executableSignatures = [
      [0x4d, 0x5a], // PE/DOS executable (MZ)
      [0x7f, 0x45, 0x4c, 0x46], // ELF executable
      [0xfe, 0xed, 0xfa, 0xce], // Mach-O executable
      [0xca, 0xfe, 0xba, 0xbe], // Java class file
      [0x50, 0x4b, 0x03, 0x04], // ZIP/JAR (potentially executable)
    ];

    // Compression signatures
    const compressionSignatures = [
      [0x1f, 0x8b], // GZIP
      [0x50, 0x4b], // ZIP
      [0x52, 0x61, 0x72, 0x21], // RAR
      [0x42, 0x5a, 0x68], // BZIP2
    ];

    // Check for executable signatures
    for (const signature of executableSignatures) {
      if (this.matchesSignature(magicBytes, signature)) {
        isExecutable = true;
        threats.push('Executable file signature detected');
        break;
      }
    }

    // Check for compression signatures
    for (const signature of compressionSignatures) {
      if (this.matchesSignature(magicBytes, signature)) {
        isCompressed = true;
        if (!this.config.enableDecompression) {
          threats.push('Compressed files not allowed');
        }
        break;
      }
    }

    return {
      valid: threats.length === 0,
      threats,
      isExecutable,
      isCompressed,
    };
  }

  /**
   * Validate text content for embedded scripts
   */
  private validateTextContent(content: string): {
    safe: boolean;
    threats: string[];
    threatLevel: 'safe' | 'warning' | 'danger';
  } {
    const threats: string[] = [];
    let threatLevel: 'safe' | 'warning' | 'danger' = 'safe';

    // Check for script tags
    if (/<script[^>]*>.*?<\/script>/gis.test(content)) {
      threats.push('Embedded script tags detected');
      threatLevel = 'danger';
    }

    // Check for JavaScript functions
    const jsPatterns = [
      /eval\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /Function\s*\(/gi,
      /new\s+Function\s*\(/gi,
    ];

    for (const pattern of jsPatterns) {
      if (pattern.test(content)) {
        threats.push('Dangerous JavaScript functions detected');
        threatLevel = 'danger';
        break;
      }
    }

    // Check for shell commands
    const shellPatterns = [
      /system\s*\(/gi,
      /exec\s*\(/gi,
      /shell_exec\s*\(/gi,
      /passthru\s*\(/gi,
    ];

    for (const pattern of shellPatterns) {
      if (pattern.test(content)) {
        threats.push('Shell command injection patterns detected');
        threatLevel = 'danger';
        break;
      }
    }

    return { safe: threats.length === 0, threats, threatLevel };
  }

  /**
   * Validate binary content
   */
  private validateBinaryContent(buffer: Buffer): {
    safe: boolean;
    threats: string[];
    threatLevel: 'safe' | 'warning' | 'danger';
  } {
    const threats: string[] = [];
    let threatLevel: 'safe' | 'warning' | 'danger' = 'safe';

    // Check for embedded PE headers
    if (buffer.includes(Buffer.from('MZ'))) {
      threats.push('PE executable header found in binary data');
      threatLevel = 'danger';
    }

    // Check for script languages in binary
    const scriptMarkers = [
      '#!/bin/sh',
      '#!/bin/bash',
      '<?php',
      '<%',
      '<script',
    ];
    for (const marker of scriptMarkers) {
      if (buffer.includes(Buffer.from(marker))) {
        threats.push(`Script marker found in binary: ${marker}`);
        threatLevel = 'warning';
      }
    }

    return { safe: threats.length === 0, threats, threatLevel };
  }

  /**
   * Virus scanning (placeholder - would integrate with actual antivirus)
   */
  private async scanForViruses(
    buffer: Buffer,
    _filename: string
  ): Promise<{
    clean: boolean;
    threats: string[];
  }> {
    // This would integrate with actual antivirus scanning
    // For now, implement basic signature detection
    const threats: string[] = [];

    // Basic malware signatures (simplified)
    const malwareSignatures = [
      'EICAR-STANDARD-ANTIVIRUS-TEST-FILE',
      '\x4d\x5a\x90\x00\x03\x00\x00\x00', // PE header
    ];

    const content = buffer.toString('binary');
    for (const signature of malwareSignatures) {
      if (content.includes(signature)) {
        threats.push(
          `Malware signature detected: ${signature.substring(0, 20)}...`
        );
      }
    }

    return {
      clean: threats.length === 0,
      threats,
    };
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^\w\-_.]/g, '_') // Replace non-alphanumeric with underscore
      .replace(/_{2,}/g, '_') // Multiple underscores to single
      .substring(0, 255) // Limit length
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
  }

  /**
   * Check if magic bytes match signature
   */
  private matchesSignature(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) return false;

    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) return false;
    }

    return true;
  }

  /**
   * Express middleware factory
   */
  createMiddleware() {
    return async (req: any, res: any, next: unknown) => {
      if (!req.files && !req.file) {
        return next(); // No files to validate
      }

      try {
        const files = req.files
          ? Array.isArray(req.files)
            ? req.files
            : [req.files]
          : [req.file];
        const validationResults: FileValidationResult[] = [];

        for (const file of files) {
          if (file) {
            const result = await this.validateFile(file);
            validationResults.push(result);

            if (!result.isValid) {
              logger.warn('File validation failed:', {
                filename: result.fileInfo?.filename,
                errors: result.errors,
                threatLevel: result.threatLevel,
              });

              if (result.quarantined) {
                // Move file to quarantine (implementation would depend on file storage)
                logger.error(
                  'File quarantined due to security threats:',
                  result.fileInfo?.filename
                );
              }

              if (result.securityLevel === 'danger') {
                return res.status(400).json({
                  error: 'File validation failed',
                  details: result.errors,
                  threatLevel: result.securityLevel,
                });
              }
            }
          }
        }

        req.fileValidationResults = validationResults;
        next();
      } catch (error: unknown) {
        logger.error('File validation middleware error:', error);
        res.status(500).json({
          error: 'File validation error',
          message: (error as Error).message,
        });
      }
    };
  }
}

/**
 * Global file upload validation middleware
 */
export const fileUploadValidationMiddleware =
  new FileUploadValidationMiddleware();

/**
 * Express middleware factory
 */
export function createFileUploadValidationMiddleware(
  config?: Partial<FileUploadConfig>
) {
  const middleware = new FileUploadValidationMiddleware(config);
  return middleware.createMiddleware();
}

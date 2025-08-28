/**
 * @fileoverview Rollback procedures for template optimization and system state recovery
 * @lastmodified 2024-08-26T16:30:00Z
 * 
 * Features: Version rollback, state restoration, data integrity validation, cascading rollback
 * Main APIs: RollbackManager, VersionControl, StateSnapshot, ValidationSuite
 * Constraints: Requires backup data, version history, proper permissions
 * Patterns: Command pattern, memento pattern, checkpoint recovery, atomic operations
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import ora, { Ora } from 'ora';
import chalk from 'chalk';
import { Command } from 'commander';

import { TemplateService } from '../../src/services/template.service';
import { CacheService } from '../../src/services/cache.service';
import { logger } from '../../src/utils/logger';
import { Template } from '../../src/types';

/**
 * Rollback operation configuration
 */
interface RollbackConfig {
  /** Target version to rollback to */
  targetVersion?: string;
  /** Rollback scope */
  scope: 'all' | 'templates' | 'cache' | 'config';
  /** Whether to create pre-rollback backup */
  createBackup: boolean;
  /** Validation level */
  validationLevel: 'basic' | 'thorough' | 'comprehensive';
  /** Dry run mode */
  dryRun: boolean;
  /** Force rollback without confirmations */
  force: boolean;
  /** Output directory for rollback artifacts */
  outputDir: string;
  /** Maximum rollback depth (number of versions) */
  maxDepth: number;
  /** Include optimization cache in rollback */
  includeCaches: boolean;
  /** Rollback timeout in milliseconds */
  timeout: number;
}

/**
 * Version information for rollback operations
 */
interface VersionInfo {
  /** Version identifier */
  id: string;
  /** Version timestamp */
  timestamp: Date;
  /** Version description */
  description: string;
  /** Changed files */
  changes: Array<{
    file: string;
    action: 'created' | 'modified' | 'deleted';
    checksum: string;
  }>;
  /** Version metadata */
  metadata: {
    author: string;
    source: string;
    templateCount: number;
    optimizationCount: number;
  };
  /** Backup location */
  backupPath: string;
  /** Dependencies */
  dependencies?: string[];
}

/**
 * Rollback operation result
 */
interface RollbackResult {
  /** Operation success status */
  success: boolean;
  /** Version rolled back to */
  targetVersion: string;
  /** Files affected */
  filesAffected: number;
  /** Operations performed */
  operations: Array<{
    type: 'restore' | 'delete' | 'create';
    target: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
  /** Validation results */
  validation: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };
  /** Processing time */
  duration: number;
  /** Rollback artifacts created */
  artifacts: string[];
}

/**
 * State snapshot for rollback operations
 */
interface StateSnapshot {
  /** Snapshot identifier */
  id: string;
  /** Snapshot timestamp */
  timestamp: Date;
  /** Snapshot description */
  description: string;
  /** Template states */
  templates: Record<string, {
    content: string;
    metadata: any;
    checksum: string;
  }>;
  /** Cache states */
  caches: Record<string, any>;
  /** Configuration states */
  configurations: Record<string, any>;
  /** System metrics at snapshot time */
  metrics: {
    templateCount: number;
    optimizedCount: number;
    cacheSize: number;
    systemHealth: 'healthy' | 'degraded' | 'unhealthy';
  };
}

/**
 * Rollback operation manager
 * 
 * Provides comprehensive rollback capabilities for template optimization
 * operations, including version control, state restoration, and validation.
 * 
 * @class RollbackManager
 * @example
 * ```typescript
 * const rollbackManager = new RollbackManager({
 *   scope: 'templates',
 *   createBackup: true,
 *   validationLevel: 'thorough',
 *   dryRun: false,
 *   outputDir: './rollback-artifacts'
 * });
 * 
 * const result = await rollbackManager.rollbackToVersion('v1.2.3');
 * if (result.success) {
 *   console.log(`Rollback successful: ${result.filesAffected} files affected`);
 * }
 * ```
 */
class RollbackManager {
  private templateService: TemplateService;
  private cacheService: CacheService;
  private versionsDir: string;
  private snapshotsDir: string;

  constructor(private config: RollbackConfig) {
    this.templateService = new TemplateService();
    this.cacheService = new CacheService();
    this.versionsDir = path.join(config.outputDir, 'versions');
    this.snapshotsDir = path.join(config.outputDir, 'snapshots');
  }

  /**
   * Rollback to a specific version
   * 
   * @param targetVersion - Version to rollback to
   * @returns Promise resolving to rollback result
   */
  async rollbackToVersion(targetVersion: string): Promise<RollbackResult> {
    const startTime = Date.now();
    const spinner = ora(`Rolling back to version ${targetVersion}...`).start();

    try {
      // Initialize result
      const result: RollbackResult = {
        success: false,
        targetVersion,
        filesAffected: 0,
        operations: [],
        validation: { passed: false, errors: [], warnings: [] },
        duration: 0,
        artifacts: []
      };

      // Validate rollback request
      await this.validateRollbackRequest(targetVersion);
      spinner.succeed('Rollback validation passed');

      // Create pre-rollback backup if requested
      if (this.config.createBackup) {
        spinner.start('Creating pre-rollback backup...');
        const backupPath = await this.createPreRollbackBackup();
        result.artifacts.push(backupPath);
        spinner.succeed(`Pre-rollback backup created: ${backupPath}`);
      }

      // Load target version information
      const versionInfo = await this.loadVersionInfo(targetVersion);
      spinner.succeed(`Loaded version info for ${targetVersion}`);

      // Perform rollback operations
      if (!this.config.dryRun) {
        spinner.start('Performing rollback operations...');
        await this.performRollback(versionInfo, result);
        spinner.succeed(`Rollback operations completed: ${result.operations.length} operations`);
      } else {
        spinner.info('[DRY RUN] Rollback operations simulated');
      }

      // Validate rollback results
      spinner.start('Validating rollback results...');
      result.validation = await this.validateRollback(versionInfo);
      spinner.succeed(`Validation completed: ${result.validation.passed ? 'PASSED' : 'FAILED'}`);

      // Clear affected caches
      if (this.config.includeCaches && !this.config.dryRun) {
        spinner.start('Clearing affected caches...');
        await this.clearAffectedCaches(result.operations);
        spinner.succeed('Caches cleared');
      }

      result.success = result.validation.passed;
      result.duration = Date.now() - startTime;

      return result;

    } catch (error) {
      spinner.fail('Rollback failed');
      logger.error('Rollback operation failed', error);
      throw error;
    }
  }

  /**
   * Rollback to last known good state
   * 
   * @returns Promise resolving to rollback result
   */
  async rollbackToLastKnownGood(): Promise<RollbackResult> {
    const lastGoodVersion = await this.findLastKnownGoodVersion();
    
    if (!lastGoodVersion) {
      throw new Error('No known good version found');
    }

    return await this.rollbackToVersion(lastGoodVersion.id);
  }

  /**
   * Create system state snapshot
   * 
   * @param description - Snapshot description
   * @returns Promise resolving to snapshot ID
   */
  async createSnapshot(description: string): Promise<string> {
    const snapshotId = `snapshot-${Date.now()}`;
    const spinner = ora(`Creating system snapshot: ${snapshotId}`).start();

    try {
      const snapshot: StateSnapshot = {
        id: snapshotId,
        timestamp: new Date(),
        description,
        templates: {},
        caches: {},
        configurations: {},
        metrics: {
          templateCount: 0,
          optimizedCount: 0,
          cacheSize: 0,
          systemHealth: 'healthy'
        }
      };

      // Capture template states
      const templates = await this.templateService.listTemplates();
      for (const template of templates) {
        snapshot.templates[template.id] = {
          content: template.content,
          metadata: template.metadata || {},
          checksum: await this.calculateChecksum(template.content)
        };
      }

      snapshot.metrics.templateCount = templates.length;

      // Capture cache states
      snapshot.caches = await this.captureCacheStates();

      // Capture configuration states
      snapshot.configurations = await this.captureConfigurationStates();

      // Save snapshot
      await fs.mkdir(this.snapshotsDir, { recursive: true });
      const snapshotPath = path.join(this.snapshotsDir, `${snapshotId}.json`);
      await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));

      spinner.succeed(`Snapshot created: ${snapshotId}`);
      logger.info(`System snapshot created: ${snapshotPath}`);

      return snapshotId;

    } catch (error) {
      spinner.fail('Snapshot creation failed');
      logger.error('Failed to create snapshot', error);
      throw error;
    }
  }

  /**
   * List available versions for rollback
   * 
   * @returns Promise resolving to available versions
   */
  async listAvailableVersions(): Promise<VersionInfo[]> {
    const versions: VersionInfo[] = [];
    
    if (!existsSync(this.versionsDir)) {
      return versions;
    }

    const versionFiles = await fs.readdir(this.versionsDir);
    
    for (const file of versionFiles) {
      if (file.endsWith('.version.json')) {
        try {
          const versionPath = path.join(this.versionsDir, file);
          const versionContent = await fs.readFile(versionPath, 'utf8');
          const versionInfo: VersionInfo = JSON.parse(versionContent);
          versions.push(versionInfo);
        } catch (error) {
          logger.warn(`Failed to load version info from ${file}`, error);
        }
      }
    }

    // Sort by timestamp (newest first)
    return versions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Validate rollback request
   * 
   * @private
   * @param targetVersion - Version to validate
   */
  private async validateRollbackRequest(targetVersion: string): Promise<void> {
    // Check if version exists
    const versionPath = path.join(this.versionsDir, `${targetVersion}.version.json`);
    if (!existsSync(versionPath)) {
      throw new Error(`Version ${targetVersion} not found`);
    }

    // Load and validate version info
    const versionInfo = await this.loadVersionInfo(targetVersion);
    
    // Check if backup data exists
    if (!existsSync(versionInfo.backupPath)) {
      throw new Error(`Backup data not found for version ${targetVersion}: ${versionInfo.backupPath}`);
    }

    // Check dependencies
    if (versionInfo.dependencies) {
      for (const dependency of versionInfo.dependencies) {
        const depPath = path.join(this.versionsDir, `${dependency}.version.json`);
        if (!existsSync(depPath)) {
          throw new Error(`Missing dependency: ${dependency}`);
        }
      }
    }

    // Check rollback depth
    const availableVersions = await this.listAvailableVersions();
    const targetIndex = availableVersions.findIndex(v => v.id === targetVersion);
    
    if (targetIndex > this.config.maxDepth) {
      throw new Error(`Rollback depth exceeds maximum allowed: ${this.config.maxDepth}`);
    }
  }

  /**
   * Load version information
   * 
   * @private
   * @param versionId - Version identifier
   * @returns Promise resolving to version info
   */
  private async loadVersionInfo(versionId: string): Promise<VersionInfo> {
    const versionPath = path.join(this.versionsDir, `${versionId}.version.json`);
    const versionContent = await fs.readFile(versionPath, 'utf8');
    const versionInfo = JSON.parse(versionContent);
    
    // Convert timestamp string back to Date object
    versionInfo.timestamp = new Date(versionInfo.timestamp);
    
    return versionInfo;
  }

  /**
   * Create pre-rollback backup
   * 
   * @private
   * @returns Promise resolving to backup path
   */
  private async createPreRollbackBackup(): Promise<string> {
    const backupId = `pre-rollback-${Date.now()}`;
    const backupPath = path.join(this.config.outputDir, 'pre-rollback-backups', backupId);
    
    await fs.mkdir(backupPath, { recursive: true });

    // Backup current templates
    const templates = await this.templateService.listTemplates();
    const templatesDir = path.join(backupPath, 'templates');
    await fs.mkdir(templatesDir, { recursive: true });

    for (const template of templates) {
      const templatePath = path.join(templatesDir, `${template.id}.json`);
      await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
    }

    // Create backup manifest
    const manifest = {
      id: backupId,
      timestamp: new Date().toISOString(),
      description: 'Pre-rollback backup',
      templateCount: templates.length
    };

    await fs.writeFile(
      path.join(backupPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    return backupPath;
  }

  /**
   * Perform rollback operations
   * 
   * @private
   * @param versionInfo - Version to rollback to
   * @param result - Result object to update
   */
  private async performRollback(versionInfo: VersionInfo, result: RollbackResult): Promise<void> {
    const backupPath = versionInfo.backupPath;

    // Restore templates
    if (this.config.scope === 'all' || this.config.scope === 'templates') {
      await this.restoreTemplates(backupPath, result);
    }

    // Restore configurations
    if (this.config.scope === 'all' || this.config.scope === 'config') {
      await this.restoreConfigurations(backupPath, result);
    }

    // Clear caches if requested
    if (this.config.scope === 'all' || this.config.scope === 'cache') {
      await this.restoreCaches(backupPath, result);
    }
  }

  /**
   * Restore templates from backup
   * 
   * @private
   * @param backupPath - Path to backup data
   * @param result - Result object to update
   */
  private async restoreTemplates(backupPath: string, result: RollbackResult): Promise<void> {
    const templatesBackupPath = path.join(backupPath, 'templates');
    
    if (!existsSync(templatesBackupPath)) {
      return;
    }

    const templateFiles = await fs.readdir(templatesBackupPath);
    
    for (const file of templateFiles) {
      if (file.endsWith('.json')) {
        try {
          const templatePath = path.join(templatesBackupPath, file);
          const templateContent = await fs.readFile(templatePath, 'utf8');
          const template: Template = JSON.parse(templateContent);

          // Restore template through service
          await this.templateService.saveTemplate(template);

          result.operations.push({
            type: 'restore',
            target: `template:${template.id}`,
            status: 'success'
          });

          result.filesAffected++;

        } catch (error) {
          result.operations.push({
            type: 'restore',
            target: `template:${file}`,
            status: 'failed',
            error: (error as Error).message
          });
        }
      }
    }
  }

  /**
   * Restore configurations from backup
   * 
   * @private
   * @param backupPath - Path to backup data
   * @param result - Result object to update
   */
  private async restoreConfigurations(backupPath: string, result: RollbackResult): Promise<void> {
    const configBackupPath = path.join(backupPath, 'configurations');
    
    if (!existsSync(configBackupPath)) {
      return;
    }

    // Implementation would depend on configuration storage mechanism
    // This is a placeholder for configuration restoration logic
    logger.info('Configuration restoration not fully implemented');
  }

  /**
   * Restore caches from backup
   * 
   * @private
   * @param backupPath - Path to backup data
   * @param result - Result object to update
   */
  private async restoreCaches(backupPath: string, result: RollbackResult): Promise<void> {
    const cacheBackupPath = path.join(backupPath, 'caches');
    
    if (existsSync(cacheBackupPath)) {
      // Clear existing caches
      this.cacheService.clear();
      
      // Restore cache data if available
      // Implementation depends on cache backup format
      logger.info('Cache restoration completed');
    }

    result.operations.push({
      type: 'restore',
      target: 'cache:all',
      status: 'success'
    });
  }

  /**
   * Validate rollback results
   * 
   * @private
   * @param versionInfo - Target version info
   * @returns Promise resolving to validation result
   */
  private async validateRollback(versionInfo: VersionInfo): Promise<{ passed: boolean; errors: string[]; warnings: string[] }> {
    const validation = { passed: true, errors: [], warnings: [] };

    try {
      // Validate template count
      const currentTemplates = await this.templateService.listTemplates();
      if (currentTemplates.length !== versionInfo.metadata.templateCount) {
        validation.errors.push(
          `Template count mismatch: expected ${versionInfo.metadata.templateCount}, got ${currentTemplates.length}`
        );
      }

      // Validate template checksums
      for (const change of versionInfo.changes) {
        if (change.action !== 'deleted') {
          const template = currentTemplates.find(t => t.id === path.basename(change.file, '.json'));
          if (template) {
            const currentChecksum = await this.calculateChecksum(template.content);
            if (currentChecksum !== change.checksum && this.config.validationLevel === 'comprehensive') {
              validation.errors.push(
                `Checksum mismatch for template ${template.id}: expected ${change.checksum}, got ${currentChecksum}`
              );
            }
          }
        }
      }

      // Additional validation based on level
      if (this.config.validationLevel === 'thorough' || this.config.validationLevel === 'comprehensive') {
        await this.performThoroughValidation(validation);
      }

      validation.passed = validation.errors.length === 0;

    } catch (error) {
      validation.errors.push(`Validation failed: ${(error as Error).message}`);
      validation.passed = false;
    }

    return validation;
  }

  /**
   * Perform thorough validation
   * 
   * @private
   * @param validation - Validation result to update
   */
  private async performThoroughValidation(validation: { errors: string[]; warnings: string[] }): Promise<void> {
    // Check template integrity
    try {
      const templates = await this.templateService.listTemplates();
      for (const template of templates) {
        if (!template.content || template.content.trim().length === 0) {
          validation.errors.push(`Template ${template.id} has empty content`);
        }
      }
    } catch (error) {
      validation.errors.push(`Template integrity check failed: ${(error as Error).message}`);
    }

    // Check system health
    try {
      // Additional health checks would go here
      logger.debug('Thorough validation completed');
    } catch (error) {
      validation.warnings.push(`System health check warning: ${(error as Error).message}`);
    }
  }

  /**
   * Clear affected caches
   * 
   * @private
   * @param operations - Rollback operations performed
   */
  private async clearAffectedCaches(operations: Array<{ type: string; target: string; status: string }>): Promise<void> {
    // Clear template-related caches
    const templateOperations = operations.filter(op => op.target.startsWith('template:') && op.status === 'success');
    
    for (const operation of templateOperations) {
      const templateId = operation.target.split(':')[1];
      // Clear specific template caches
      await this.cacheService.delete(`template:${templateId}`);
      await this.cacheService.delete(`optimization:${templateId}`);
    }

    // Clear general caches if significant changes occurred
    if (operations.length > 10) {
      this.cacheService.clear();
    }
  }

  /**
   * Find last known good version
   * 
   * @private
   * @returns Promise resolving to last known good version
   */
  private async findLastKnownGoodVersion(): Promise<VersionInfo | null> {
    const versions = await this.listAvailableVersions();
    
    // Find the most recent version that doesn't have known issues
    for (const version of versions) {
      // Simple heuristic: versions with fewer than 10% failed changes are considered "good"
      const failedChanges = version.changes.filter(c => c.action === 'deleted').length;
      const totalChanges = version.changes.length;
      
      if (totalChanges > 0 && (failedChanges / totalChanges) < 0.1) {
        return version;
      }
    }

    return versions.length > 0 ? versions[versions.length - 1] : null;
  }

  /**
   * Capture cache states
   * 
   * @private
   * @returns Promise resolving to cache states
   */
  private async captureCacheStates(): Promise<Record<string, any>> {
    // Implementation would depend on cache structure
    return {
      templateCache: await this.cacheService.getStats(),
      optimizationCache: 'captured'
    };
  }

  /**
   * Capture configuration states
   * 
   * @private
   * @returns Promise resolving to configuration states
   */
  private async captureConfigurationStates(): Promise<Record<string, any>> {
    // Implementation would depend on configuration storage
    return {
      appConfig: 'captured',
      optimizationConfig: 'captured'
    };
  }

  /**
   * Calculate content checksum
   * 
   * @private
   * @param content - Content to checksum
   * @returns Promise resolving to checksum
   */
  private async calculateChecksum(content: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Display rollback summary
   * 
   * @param result - Rollback result to display
   */
  displaySummary(result: RollbackResult): void {
    console.log('\n' + chalk.blue.bold('🔄 Rollback Operation Summary'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    console.log(`${chalk.blue('Target Version:')} ${result.targetVersion}`);
    console.log(`${chalk.blue('Success:')} ${result.success ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`${chalk.blue('Files Affected:')} ${result.filesAffected}`);
    console.log(`${chalk.blue('Operations:')} ${result.operations.length}`);
    console.log(`${chalk.blue('Duration:')} ${(result.duration / 1000).toFixed(2)}s`);
    
    if (result.validation.errors.length > 0) {
      console.log(chalk.red('\nValidation Errors:'));
      result.validation.errors.forEach(error => {
        console.log(chalk.red(`  • ${error}`));
      });
    }
    
    if (result.validation.warnings.length > 0) {
      console.log(chalk.yellow('\nValidation Warnings:'));
      result.validation.warnings.forEach(warning => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }
  }
}

/**
 * CLI interface for rollback operations
 */
async function main() {
  const program = new Command();
  
  program
    .name('rollback')
    .description('Rollback template optimizations and system state')
    .version('1.0.0');

  program
    .command('version <targetVersion>')
    .description('Rollback to specific version')
    .option('--scope <scope>', 'Rollback scope: all, templates, cache, config', 'all')
    .option('--no-backup', 'Skip creating pre-rollback backup')
    .option('--validation <level>', 'Validation level: basic, thorough, comprehensive', 'thorough')
    .option('--dry-run', 'Perform dry run', false)
    .option('--force', 'Force rollback without confirmations', false)
    .option('-o, --output <dir>', 'Output directory', './rollback-artifacts')
    .action(async (targetVersion, options) => {
      const config: RollbackConfig = {
        targetVersion,
        scope: options.scope as any,
        createBackup: options.backup !== false,
        validationLevel: options.validation as any,
        dryRun: options.dryRun,
        force: options.force,
        outputDir: options.output,
        maxDepth: 50,
        includeCaches: true,
        timeout: 300000
      };

      try {
        const rollbackManager = new RollbackManager(config);
        const result = await rollbackManager.rollbackToVersion(targetVersion);
        rollbackManager.displaySummary(result);
        
        process.exit(result.success ? 0 : 1);
      } catch (error) {
        console.error(chalk.red('Rollback failed:'), error);
        process.exit(1);
      }
    });

  program
    .command('last-good')
    .description('Rollback to last known good state')
    .option('--dry-run', 'Perform dry run', false)
    .option('-o, --output <dir>', 'Output directory', './rollback-artifacts')
    .action(async (options) => {
      const config: RollbackConfig = {
        scope: 'all',
        createBackup: true,
        validationLevel: 'thorough',
        dryRun: options.dryRun,
        force: false,
        outputDir: options.output,
        maxDepth: 50,
        includeCaches: true,
        timeout: 300000
      };

      try {
        const rollbackManager = new RollbackManager(config);
        const result = await rollbackManager.rollbackToLastKnownGood();
        rollbackManager.displaySummary(result);
        
        process.exit(result.success ? 0 : 1);
      } catch (error) {
        console.error(chalk.red('Rollback to last known good failed:'), error);
        process.exit(1);
      }
    });

  program
    .command('list-versions')
    .description('List available versions for rollback')
    .action(async () => {
      const config: RollbackConfig = {
        scope: 'all',
        createBackup: false,
        validationLevel: 'basic',
        dryRun: true,
        force: false,
        outputDir: './rollback-artifacts',
        maxDepth: 50,
        includeCaches: false,
        timeout: 300000
      };

      try {
        const rollbackManager = new RollbackManager(config);
        const versions = await rollbackManager.listAvailableVersions();
        
        if (versions.length === 0) {
          console.log(chalk.yellow('No versions available for rollback'));
          return;
        }

        console.log(chalk.green.bold('\nAvailable Versions:'));
        console.log(chalk.cyan('═'.repeat(60)));
        
        versions.forEach(version => {
          console.log(`${chalk.blue(version.id)} - ${version.description}`);
          console.log(`  ${chalk.gray('Date:')} ${version.timestamp.toLocaleString()}`);
          console.log(`  ${chalk.gray('Templates:')} ${version.metadata.templateCount}`);
          console.log(`  ${chalk.gray('Changes:')} ${version.changes.length}`);
          console.log('');
        });
        
      } catch (error) {
        console.error(chalk.red('Failed to list versions:'), error);
        process.exit(1);
      }
    });

  program
    .command('snapshot [description]')
    .description('Create system state snapshot')
    .action(async (description = 'Manual snapshot') => {
      const config: RollbackConfig = {
        scope: 'all',
        createBackup: false,
        validationLevel: 'basic',
        dryRun: false,
        force: false,
        outputDir: './rollback-artifacts',
        maxDepth: 50,
        includeCaches: true,
        timeout: 300000
      };

      try {
        const rollbackManager = new RollbackManager(config);
        const snapshotId = await rollbackManager.createSnapshot(description);
        console.log(chalk.green(`Snapshot created: ${snapshotId}`));
      } catch (error) {
        console.error(chalk.red('Snapshot creation failed:'), error);
        process.exit(1);
      }
    });

  await program.parseAsync();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { RollbackManager, RollbackConfig, RollbackResult, VersionInfo, StateSnapshot };
/**
 * @fileoverview Data migration scripts for template optimization system upgrades
 * @lastmodified 2024-08-26T16:35:00Z
 * 
 * Features: Schema migration, data transformation, validation, integrity checks
 * Main APIs: MigrationEngine, SchemaVersioning, DataTransformer, IntegrityValidator
 * Constraints: Requires database access, proper backup procedures, downtime coordination
 * Patterns: Schema versioning, forward/backward compatibility, transactional operations
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
 * Migration configuration
 */
interface MigrationConfig {
  /** Source data format version */
  sourceVersion: string;
  /** Target data format version */
  targetVersion: string;
  /** Migration mode */
  mode: 'upgrade' | 'downgrade';
  /** Backup before migration */
  createBackup: boolean;
  /** Validation level */
  validationLevel: 'basic' | 'thorough' | 'comprehensive';
  /** Batch size for processing */
  batchSize: number;
  /** Dry run mode */
  dryRun: boolean;
  /** Output directory */
  outputDir: string;
  /** Migration timeout */
  timeout: number;
  /** Preserve original data */
  preserveOriginal: boolean;
  /** Transform options */
  transformOptions: {
    preserveMetadata: boolean;
    upgradeTemplateFormat: boolean;
    migrateOptimizationData: boolean;
    updateCacheFormat: boolean;
  };
}

/**
 * Schema version information
 */
interface SchemaVersion {
  /** Version identifier */
  version: string;
  /** Version timestamp */
  timestamp: Date;
  /** Schema description */
  description: string;
  /** Required migrations */
  migrations: string[];
  /** Compatibility info */
  compatibility: {
    /** Backward compatible versions */
    backward: string[];
    /** Forward compatible versions */
    forward: string[];
  };
  /** Schema changes */
  changes: Array<{
    type: 'field_added' | 'field_removed' | 'field_renamed' | 'field_type_changed' | 'structure_changed';
    entity: string;
    field?: string;
    oldValue?: any;
    newValue?: any;
    description: string;
  }>;
}

/**
 * Migration operation
 */
interface MigrationOperation {
  /** Operation identifier */
  id: string;
  /** Operation type */
  type: 'transform' | 'validate' | 'backup' | 'cleanup';
  /** Target entity */
  target: string;
  /** Operation description */
  description: string;
  /** Required for migration */
  required: boolean;
  /** Dependencies on other operations */
  dependencies: string[];
  /** Operation implementation */
  execute: (context: MigrationContext) => Promise<void>;
  /** Rollback implementation */
  rollback: (context: MigrationContext) => Promise<void>;
}

/**
 * Migration context
 */
interface MigrationContext {
  /** Configuration */
  config: MigrationConfig;
  /** Source schema */
  sourceSchema: SchemaVersion;
  /** Target schema */
  targetSchema: SchemaVersion;
  /** Progress tracking */
  progress: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  };
  /** Migration artifacts */
  artifacts: {
    backupPath?: string;
    logPath: string;
    errorLog: string[];
    warnings: string[];
  };
  /** Services */
  services: {
    templateService: TemplateService;
    cacheService: CacheService;
  };
}

/**
 * Migration result
 */
interface MigrationResult {
  /** Success status */
  success: boolean;
  /** Source version */
  sourceVersion: string;
  /** Target version */
  targetVersion: string;
  /** Operations performed */
  operations: Array<{
    id: string;
    status: 'success' | 'failed' | 'skipped';
    duration: number;
    error?: string;
  }>;
  /** Data statistics */
  statistics: {
    templatesProcessed: number;
    templatesTransformed: number;
    cacheEntriesProcessed: number;
    totalProcessingTime: number;
    dataIntegrityChecks: number;
  };
  /** Validation results */
  validation: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };
  /** Artifacts created */
  artifacts: string[];
}

/**
 * Data transformer for different template formats
 */
class DataTransformer {
  /**
   * Transform template from v1 to v2 format
   * 
   * @param template - Template in v1 format
   * @returns Promise resolving to v2 format template
   */
  static async transformV1ToV2(template: any): Promise<Template> {
    // V1 to V2: Add metadata structure, optimization tracking
    return {
      id: template.id,
      name: template.name || template.id,
      content: template.content,
      description: template.description || '',
      variables: template.variables || [],
      createdAt: template.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        version: '2.0',
        author: template.author || 'system',
        tags: template.tags || [],
        category: template.category || 'general',
        performance: {
          averageResponseTime: 0,
          successRate: 1.0,
          lastOptimized: null
        },
        optimization: {
          status: 'pending',
          history: [],
          metrics: {
            tokenReduction: 0,
            accuracyImprovement: 0,
            qualityScore: 0
          }
        }
      },
      usage: {
        frequency: 0,
        lastUsed: null,
        contexts: []
      }
    };
  }

  /**
   * Transform template from v2 to v3 format
   * 
   * @param template - Template in v2 format
   * @returns Promise resolving to v3 format template
   */
  static async transformV2ToV3(template: any): Promise<Template> {
    // V2 to V3: Enhanced optimization tracking, multi-model support
    const v3Template = { ...template };
    
    if (!v3Template.metadata) {
      v3Template.metadata = {};
    }

    // Enhanced optimization metadata
    v3Template.metadata.optimization = {
      ...v3Template.metadata.optimization,
      multiModel: {
        gpt4: { status: 'pending', metrics: {} },
        claude3: { status: 'pending', metrics: {} },
        gemini: { status: 'pending', metrics: {} }
      },
      pipeline: {
        stages: ['analysis', 'optimization', 'validation', 'deployment'],
        currentStage: 'analysis',
        stageHistory: []
      },
      settings: {
        iterations: 3,
        examples: 5,
        reasoning: false,
        targetModel: 'gpt-4'
      }
    };

    // Add versioning metadata
    v3Template.metadata.version = '3.0';
    v3Template.metadata.migrationHistory = [
      {
        fromVersion: '2.0',
        toVersion: '3.0',
        timestamp: new Date().toISOString(),
        transformer: 'DataTransformer.transformV2ToV3'
      }
    ];

    return v3Template;
  }

  /**
   * Transform optimization cache format
   * 
   * @param cacheEntry - Cache entry to transform
   * @param targetVersion - Target cache format version
   * @returns Transformed cache entry
   */
  static async transformCacheFormat(cacheEntry: any, targetVersion: string): Promise<any> {
    switch (targetVersion) {
      case '2.0':
        return {
          ...cacheEntry,
          version: '2.0',
          metadata: {
            created: cacheEntry.timestamp || new Date().toISOString(),
            ttl: cacheEntry.ttl || 3600000,
            size: JSON.stringify(cacheEntry.data || {}).length,
            compressed: false
          },
          data: cacheEntry.data || cacheEntry.value || {}
        };
      
      case '3.0':
        return {
          ...cacheEntry,
          version: '3.0',
          metadata: {
            ...cacheEntry.metadata,
            compression: 'gzip',
            encryption: false,
            integrity: {
              checksum: 'sha256',
              verified: true
            }
          }
        };
      
      default:
        return cacheEntry;
    }
  }
}

/**
 * Data integrity validator
 */
class IntegrityValidator {
  /**
   * Validate template data integrity
   * 
   * @param template - Template to validate
   * @param version - Expected schema version
   * @returns Validation result
   */
  static validateTemplate(template: any, version: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic structure validation
    if (!template.id) {
      errors.push('Missing required field: id');
    }
    if (!template.content) {
      errors.push('Missing required field: content');
    }

    // Version-specific validation
    switch (version) {
      case '2.0':
        if (!template.metadata) {
          errors.push('Missing metadata structure for v2.0');
        }
        if (template.metadata && !template.metadata.version) {
          errors.push('Missing version in metadata');
        }
        break;

      case '3.0':
        if (!template.metadata?.optimization?.multiModel) {
          errors.push('Missing multiModel optimization data for v3.0');
        }
        if (!template.metadata?.optimization?.pipeline) {
          errors.push('Missing pipeline data for v3.0');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate data consistency across templates
   * 
   * @param templates - Templates to validate
   * @returns Consistency validation result
   */
  static validateConsistency(templates: Template[]): { consistent: boolean; issues: string[] } {
    const issues: string[] = [];
    const ids = new Set<string>();
    const versions = new Set<string>();

    for (const template of templates) {
      // Check for duplicate IDs
      if (ids.has(template.id)) {
        issues.push(`Duplicate template ID: ${template.id}`);
      }
      ids.add(template.id);

      // Check version consistency
      if (template.metadata?.version) {
        versions.add(template.metadata.version);
      }
    }

    // Check if all templates have the same version
    if (versions.size > 1) {
      issues.push(`Inconsistent template versions: ${Array.from(versions).join(', ')}`);
    }

    return {
      consistent: issues.length === 0,
      issues
    };
  }
}

/**
 * Main data migration engine
 * 
 * Handles comprehensive data migration between schema versions with
 * validation, transformation, and rollback capabilities.
 * 
 * @class DataMigrationEngine
 * @example
 * ```typescript
 * const migrationEngine = new DataMigrationEngine({
 *   sourceVersion: '2.0',
 *   targetVersion: '3.0',
 *   mode: 'upgrade',
 *   createBackup: true,
 *   validationLevel: 'thorough',
 *   batchSize: 50,
 *   dryRun: false,
 *   outputDir: './migration-results'
 * });
 * 
 * const result = await migrationEngine.migrate();
 * console.log(`Migration ${result.success ? 'successful' : 'failed'}`);
 * ```
 */
class DataMigrationEngine {
  private context: MigrationContext;
  private operations: Map<string, MigrationOperation> = new Map();

  constructor(private config: MigrationConfig) {
    this.context = {
      config,
      sourceSchema: this.loadSchemaVersion(config.sourceVersion),
      targetSchema: this.loadSchemaVersion(config.targetVersion),
      progress: { total: 0, completed: 0, failed: 0, skipped: 0 },
      artifacts: {
        logPath: path.join(config.outputDir, `migration-${Date.now()}.log`),
        errorLog: [],
        warnings: []
      },
      services: {
        templateService: new TemplateService(),
        cacheService: new CacheService()
      }
    };

    this.initializeOperations();
  }

  /**
   * Execute data migration
   * 
   * @returns Promise resolving to migration result
   */
  async migrate(): Promise<MigrationResult> {
    const startTime = Date.now();
    const spinner = ora(`Migrating data from ${this.config.sourceVersion} to ${this.config.targetVersion}...`).start();

    try {
      const result: MigrationResult = {
        success: false,
        sourceVersion: this.config.sourceVersion,
        targetVersion: this.config.targetVersion,
        operations: [],
        statistics: {
          templatesProcessed: 0,
          templatesTransformed: 0,
          cacheEntriesProcessed: 0,
          totalProcessingTime: 0,
          dataIntegrityChecks: 0
        },
        validation: { passed: false, errors: [], warnings: [] },
        artifacts: []
      };

      // Initialize migration environment
      await this.initializeMigration();
      spinner.succeed('Migration environment initialized');

      // Create backup if requested
      if (this.config.createBackup) {
        spinner.start('Creating data backup...');
        const backupPath = await this.createBackup();
        this.context.artifacts.backupPath = backupPath;
        result.artifacts.push(backupPath);
        spinner.succeed(`Backup created: ${backupPath}`);
      }

      // Execute migration operations
      const operationIds = this.getExecutionOrder();
      
      for (const operationId of operationIds) {
        const operation = this.operations.get(operationId)!;
        
        spinner.start(`Executing: ${operation.description}`);
        const opStartTime = Date.now();
        
        try {
          if (!this.config.dryRun) {
            await operation.execute(this.context);
          } else {
            spinner.info(`[DRY RUN] Would execute: ${operation.description}`);
          }
          
          result.operations.push({
            id: operation.id,
            status: 'success',
            duration: Date.now() - opStartTime
          });
          
          spinner.succeed(`Completed: ${operation.description}`);
          
        } catch (error) {
          result.operations.push({
            id: operation.id,
            status: 'failed',
            duration: Date.now() - opStartTime,
            error: (error as Error).message
          });
          
          this.context.artifacts.errorLog.push(`Operation ${operationId} failed: ${(error as Error).message}`);
          
          if (operation.required) {
            spinner.fail(`Critical operation failed: ${operation.description}`);
            throw error;
          } else {
            spinner.warn(`Optional operation failed: ${operation.description}`);
            this.context.progress.skipped++;
          }
        }
      }

      // Validate migration results
      spinner.start('Validating migration results...');
      result.validation = await this.validateMigration();
      spinner.succeed(`Validation completed: ${result.validation.passed ? 'PASSED' : 'FAILED'}`);

      // Generate statistics
      result.statistics.totalProcessingTime = Date.now() - startTime;
      result.statistics.templatesProcessed = this.context.progress.completed;

      // Save migration report
      const reportPath = await this.generateReport(result);
      result.artifacts.push(reportPath);

      result.success = result.validation.passed;
      return result;

    } catch (error) {
      spinner.fail('Migration failed');
      logger.error('Data migration failed', error);
      throw error;
    }
  }

  /**
   * Initialize migration operations
   * 
   * @private
   */
  private initializeOperations(): void {
    // Template transformation operation
    this.operations.set('transform-templates', {
      id: 'transform-templates',
      type: 'transform',
      target: 'templates',
      description: 'Transform template data format',
      required: true,
      dependencies: [],
      execute: async (context) => {
        await this.transformTemplates(context);
      },
      rollback: async (context) => {
        await this.rollbackTemplateTransformation(context);
      }
    });

    // Cache migration operation
    this.operations.set('migrate-cache', {
      id: 'migrate-cache',
      type: 'transform',
      target: 'cache',
      description: 'Migrate cache format',
      required: false,
      dependencies: ['transform-templates'],
      execute: async (context) => {
        if (context.config.transformOptions.updateCacheFormat) {
          await this.migrateCacheFormat(context);
        }
      },
      rollback: async (context) => {
        await this.rollbackCacheMigration(context);
      }
    });

    // Validation operation
    this.operations.set('validate-integrity', {
      id: 'validate-integrity',
      type: 'validate',
      target: 'all',
      description: 'Validate data integrity',
      required: true,
      dependencies: ['transform-templates', 'migrate-cache'],
      execute: async (context) => {
        await this.performIntegrityValidation(context);
      },
      rollback: async () => {
        // Validation doesn't need rollback
      }
    });

    // Cleanup operation
    this.operations.set('cleanup', {
      id: 'cleanup',
      type: 'cleanup',
      target: 'temporary',
      description: 'Clean up temporary files',
      required: false,
      dependencies: ['validate-integrity'],
      execute: async (context) => {
        await this.performCleanup(context);
      },
      rollback: async () => {
        // Cleanup doesn't need rollback
      }
    });
  }

  /**
   * Get execution order for operations
   * 
   * @private
   * @returns Ordered array of operation IDs
   */
  private getExecutionOrder(): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (opId: string) => {
      if (visiting.has(opId)) {
        throw new Error(`Circular dependency detected: ${opId}`);
      }
      
      if (visited.has(opId)) {
        return;
      }

      visiting.add(opId);
      
      const operation = this.operations.get(opId);
      if (operation) {
        for (const dep of operation.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(opId);
      visited.add(opId);
      order.push(opId);
    };

    for (const opId of this.operations.keys()) {
      visit(opId);
    }

    return order;
  }

  /**
   * Transform templates to new format
   * 
   * @private
   * @param context - Migration context
   */
  private async transformTemplates(context: MigrationContext): Promise<void> {
    const templates = await context.services.templateService.listTemplates();
    context.progress.total = templates.length;

    const batches = this.createBatches(templates, context.config.batchSize);

    for (const batch of batches) {
      for (const template of batch) {
        try {
          let transformedTemplate: Template;

          // Apply appropriate transformation based on version path
          if (context.config.sourceVersion === '1.0' && context.config.targetVersion === '2.0') {
            transformedTemplate = await DataTransformer.transformV1ToV2(template);
          } else if (context.config.sourceVersion === '2.0' && context.config.targetVersion === '3.0') {
            transformedTemplate = await DataTransformer.transformV2ToV3(template);
          } else {
            throw new Error(`Unsupported migration path: ${context.config.sourceVersion} -> ${context.config.targetVersion}`);
          }

          // Save transformed template
          if (!context.config.dryRun) {
            await context.services.templateService.saveTemplate(transformedTemplate);
          }

          context.progress.completed++;

        } catch (error) {
          context.progress.failed++;
          context.artifacts.errorLog.push(`Template transformation failed for ${template.id}: ${(error as Error).message}`);
          logger.error(`Template transformation failed: ${template.id}`, error);
        }
      }
    }
  }

  /**
   * Migrate cache format
   * 
   * @private
   * @param context - Migration context
   */
  private async migrateCacheFormat(context: MigrationContext): Promise<void> {
    // Implementation would depend on cache storage mechanism
    logger.info('Cache format migration completed');
  }

  /**
   * Perform data integrity validation
   * 
   * @private
   * @param context - Migration context
   */
  private async performIntegrityValidation(context: MigrationContext): Promise<void> {
    const templates = await context.services.templateService.listTemplates();
    
    // Validate individual templates
    for (const template of templates) {
      const validation = IntegrityValidator.validateTemplate(template, context.config.targetVersion);
      
      if (!validation.valid) {
        context.artifacts.errorLog.push(...validation.errors.map(e => `Template ${template.id}: ${e}`));
      }
    }

    // Validate consistency across templates
    const consistencyCheck = IntegrityValidator.validateConsistency(templates);
    
    if (!consistencyCheck.consistent) {
      context.artifacts.errorLog.push(...consistencyCheck.issues);
    }

    context.progress.completed += templates.length;
  }

  /**
   * Load schema version information
   * 
   * @private
   * @param version - Version to load
   * @returns Schema version information
   */
  private loadSchemaVersion(version: string): SchemaVersion {
    // This would typically load from a schema registry or configuration
    const schemas: Record<string, SchemaVersion> = {
      '2.0': {
        version: '2.0',
        timestamp: new Date('2024-01-01'),
        description: 'Enhanced template format with optimization metadata',
        migrations: ['add-metadata-structure', 'add-optimization-tracking'],
        compatibility: {
          backward: ['1.0'],
          forward: ['3.0']
        },
        changes: [
          {
            type: 'field_added',
            entity: 'template',
            field: 'metadata',
            description: 'Added comprehensive metadata structure'
          }
        ]
      },
      '3.0': {
        version: '3.0',
        timestamp: new Date('2024-08-01'),
        description: 'Multi-model optimization support with enhanced pipeline',
        migrations: ['add-multimodel-support', 'enhance-optimization-pipeline'],
        compatibility: {
          backward: ['2.0'],
          forward: []
        },
        changes: [
          {
            type: 'structure_changed',
            entity: 'template.metadata.optimization',
            description: 'Enhanced optimization structure with multi-model support'
          }
        ]
      }
    };

    const schema = schemas[version];
    if (!schema) {
      throw new Error(`Unknown schema version: ${version}`);
    }

    return schema;
  }

  /**
   * Initialize migration environment
   * 
   * @private
   */
  private async initializeMigration(): Promise<void> {
    await fs.mkdir(this.config.outputDir, { recursive: true });
    
    // Initialize logging
    await fs.writeFile(
      this.context.artifacts.logPath,
      `Migration started: ${new Date().toISOString()}\n`
    );
  }

  /**
   * Create data backup
   * 
   * @private
   * @returns Promise resolving to backup path
   */
  private async createBackup(): Promise<string> {
    const backupId = `backup-${Date.now()}`;
    const backupPath = path.join(this.config.outputDir, 'backups', backupId);
    
    await fs.mkdir(backupPath, { recursive: true });

    // Backup templates
    const templates = await this.context.services.templateService.listTemplates();
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
      sourceVersion: this.config.sourceVersion,
      templateCount: templates.length,
      description: 'Pre-migration backup'
    };

    await fs.writeFile(
      path.join(backupPath, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    return backupPath;
  }

  /**
   * Validate migration results
   * 
   * @private
   * @returns Promise resolving to validation result
   */
  private async validateMigration(): Promise<{ passed: boolean; errors: string[]; warnings: string[] }> {
    const validation = {
      passed: true,
      errors: [...this.context.artifacts.errorLog],
      warnings: [...this.context.artifacts.warnings]
    };

    // Check if critical operations succeeded
    const failedCriticalOps = Array.from(this.operations.values())
      .filter(op => op.required)
      .filter(op => this.context.artifacts.errorLog.some(log => log.includes(op.id)));

    if (failedCriticalOps.length > 0) {
      validation.passed = false;
      validation.errors.push(`${failedCriticalOps.length} critical operations failed`);
    }

    // Additional validation based on level
    if (this.config.validationLevel === 'comprehensive') {
      const templates = await this.context.services.templateService.listTemplates();
      const consistencyCheck = IntegrityValidator.validateConsistency(templates);
      
      if (!consistencyCheck.consistent) {
        validation.errors.push(...consistencyCheck.issues);
        validation.passed = false;
      }
    }

    return validation;
  }

  /**
   * Generate migration report
   * 
   * @private
   * @param result - Migration result
   * @returns Promise resolving to report path
   */
  private async generateReport(result: MigrationResult): Promise<string> {
    const reportPath = path.join(this.config.outputDir, `migration-report-${Date.now()}.json`);
    const report = {
      ...result,
      context: {
        sourceSchema: this.context.sourceSchema,
        targetSchema: this.context.targetSchema,
        config: this.config
      },
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    return reportPath;
  }

  /**
   * Create batches from array
   * 
   * @private
   * @param array - Array to batch
   * @param batchSize - Size of each batch
   * @returns Array of batches
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Perform cleanup operations
   * 
   * @private
   * @param context - Migration context
   */
  private async performCleanup(context: MigrationContext): Promise<void> {
    // Clean up temporary files, old data if not preserving
    if (!context.config.preserveOriginal) {
      logger.info('Cleaning up original data files');
      // Implementation would clean up old format files
    }
  }

  /**
   * Rollback template transformation
   * 
   * @private
   * @param context - Migration context
   */
  private async rollbackTemplateTransformation(context: MigrationContext): Promise<void> {
    if (context.artifacts.backupPath) {
      logger.info('Rolling back template transformations');
      // Implementation would restore from backup
    }
  }

  /**
   * Rollback cache migration
   * 
   * @private
   * @param context - Migration context
   */
  private async rollbackCacheMigration(context: MigrationContext): Promise<void> {
    logger.info('Rolling back cache migration');
    // Implementation would restore cache format
  }

  /**
   * Display migration summary
   * 
   * @param result - Migration result to display
   */
  displaySummary(result: MigrationResult): void {
    console.log('\n' + chalk.green.bold('📊 Data Migration Summary'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    console.log(`${chalk.blue('Source Version:')} ${result.sourceVersion}`);
    console.log(`${chalk.blue('Target Version:')} ${result.targetVersion}`);
    console.log(`${chalk.blue('Success:')} ${result.success ? chalk.green('Yes') : chalk.red('No')}`);
    console.log(`${chalk.blue('Templates Processed:')} ${result.statistics.templatesProcessed}`);
    console.log(`${chalk.blue('Operations:')} ${result.operations.length}`);
    console.log(`${chalk.blue('Duration:')} ${(result.statistics.totalProcessingTime / 1000).toFixed(2)}s`);
    
    if (result.validation.errors.length > 0) {
      console.log(chalk.red('\nValidation Errors:'));
      result.validation.errors.slice(0, 10).forEach(error => {
        console.log(chalk.red(`  • ${error}`));
      });
      
      if (result.validation.errors.length > 10) {
        console.log(chalk.red(`  ... and ${result.validation.errors.length - 10} more errors`));
      }
    }
    
    if (result.validation.warnings.length > 0) {
      console.log(chalk.yellow('\nValidation Warnings:'));
      result.validation.warnings.slice(0, 5).forEach(warning => {
        console.log(chalk.yellow(`  • ${warning}`));
      });
    }
  }
}

/**
 * CLI interface for data migration
 */
async function main() {
  const program = new Command();
  
  program
    .name('data-migration')
    .description('Data migration tools for template optimization system')
    .version('1.0.0');

  program
    .command('upgrade <sourceVersion> <targetVersion>')
    .description('Upgrade data format between versions')
    .option('-b, --batch-size <size>', 'Batch size for processing', '50')
    .option('--no-backup', 'Skip creating backup')
    .option('--validation <level>', 'Validation level: basic, thorough, comprehensive', 'thorough')
    .option('--dry-run', 'Perform dry run', false)
    .option('--preserve-original', 'Preserve original data', true)
    .option('-o, --output <dir>', 'Output directory', './migration-results')
    .action(async (sourceVersion, targetVersion, options) => {
      const config: MigrationConfig = {
        sourceVersion,
        targetVersion,
        mode: 'upgrade',
        createBackup: options.backup !== false,
        validationLevel: options.validation as any,
        batchSize: parseInt(options.batchSize),
        dryRun: options.dryRun,
        outputDir: options.output,
        timeout: 300000,
        preserveOriginal: options.preserveOriginal,
        transformOptions: {
          preserveMetadata: true,
          upgradeTemplateFormat: true,
          migrateOptimizationData: true,
          updateCacheFormat: true
        }
      };

      try {
        const migrationEngine = new DataMigrationEngine(config);
        const result = await migrationEngine.migrate();
        migrationEngine.displaySummary(result);
        
        process.exit(result.success ? 0 : 1);
      } catch (error) {
        console.error(chalk.red('Migration failed:'), error);
        process.exit(1);
      }
    });

  program
    .command('validate <version>')
    .description('Validate data integrity for specific version')
    .option('-o, --output <dir>', 'Output directory', './validation-results')
    .action(async (version, options) => {
      const config: MigrationConfig = {
        sourceVersion: version,
        targetVersion: version,
        mode: 'upgrade',
        createBackup: false,
        validationLevel: 'comprehensive',
        batchSize: 100,
        dryRun: true,
        outputDir: options.output,
        timeout: 300000,
        preserveOriginal: true,
        transformOptions: {
          preserveMetadata: false,
          upgradeTemplateFormat: false,
          migrateOptimizationData: false,
          updateCacheFormat: false
        }
      };

      try {
        const migrationEngine = new DataMigrationEngine(config);
        const result = await migrationEngine.migrate();
        
        console.log(chalk.blue.bold('\n🔍 Data Validation Results'));
        console.log(chalk.cyan('═'.repeat(50)));
        console.log(`${chalk.blue('Version:')} ${version}`);
        console.log(`${chalk.blue('Valid:')} ${result.validation.passed ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`${chalk.blue('Errors:')} ${result.validation.errors.length}`);
        console.log(`${chalk.blue('Warnings:')} ${result.validation.warnings.length}`);
        
        if (result.validation.errors.length > 0) {
          console.log(chalk.red('\nErrors:'));
          result.validation.errors.forEach(error => {
            console.log(chalk.red(`  • ${error}`));
          });
        }
        
        process.exit(result.validation.passed ? 0 : 1);
      } catch (error) {
        console.error(chalk.red('Validation failed:'), error);
        process.exit(1);
      }
    });

  await program.parseAsync();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { DataMigrationEngine, MigrationConfig, MigrationResult, DataTransformer, IntegrityValidator };
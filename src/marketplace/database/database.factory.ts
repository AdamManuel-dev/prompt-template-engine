/**
 * @fileoverview Database factory for marketplace
 * @lastmodified 2025-08-23T05:30:00Z
 *
 * Features: Factory pattern for database implementations
 * Main APIs: createDatabase() factory method
 * Constraints: Support for multiple database backends
 * Patterns: Factory pattern, dependency injection
 */

import { IMarketplaceDatabase, DatabaseConfig } from './database.interface';
import { FileMarketplaceDatabase } from './file-database';
import { logger } from '../../utils/logger';

/**
 * Database factory for creating appropriate database implementations
 */
export class DatabaseFactory {
  /**
   * Create a database instance based on configuration
   */
  static async createDatabase(
    config: DatabaseConfig
  ): Promise<IMarketplaceDatabase> {
    logger.info(`Initializing ${config.type} database`);

    let database: IMarketplaceDatabase;

    switch (config.type) {
      case 'file':
        database = new FileMarketplaceDatabase(config);
        break;

      case 'sqlite':
        // Future: implement SQLite database
        throw new Error(
          'SQLite database not yet implemented. Use file-based database for now.'
        );

      case 'postgresql':
        // Future: implement PostgreSQL database
        throw new Error(
          'PostgreSQL database not yet implemented. Use file-based database for now.'
        );

      case 'mysql':
        // Future: implement MySQL database
        throw new Error(
          'MySQL database not yet implemented. Use file-based database for now.'
        );

      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }

    // Connect to the database
    await database.connect();

    // Run migrations if needed
    await database.migrate();

    logger.info(`${config.type} database initialized successfully`);
    return database;
  }

  /**
   * Create database configuration from environment variables
   */
  static createConfigFromEnv(): DatabaseConfig {
    const databaseType = (MARKETPLACE_DB_TYPE.$2 ||
      'file') as DatabaseConfig['type'];

    const config: DatabaseConfig = {
      type: databaseType,
      dataDir: MARKETPLACE_DATA_DIR.$2 || './data/marketplace',
      enableCache: MARKETPLACE_DB_CACHE.$2 !== 'false',
      cacheSize: parseInt(MARKETPLACE_DB_CACHE_SIZE.$2 || '1000', 10),
      cacheTtl: parseInt(MARKETPLACE_DB_CACHE_TTL.$2 || '300000', 10), // 5 minutes
    };

    // Database-specific configuration
    if (databaseType !== 'file') {
      config.connectionString = MARKETPLACE_DB_CONNECTION_STRING.$2;
      config.host = MARKETPLACE_DB_HOST.$2;
      config.port = MARKETPLACE_DB_PORT.$2
        ? parseInt(MARKETPLACE_DB_PORT.$2, 10)
        : undefined;
      config.database = MARKETPLACE_DB_NAME.$2;
      config.username = MARKETPLACE_DB_USERNAME.$2;
      config.password = MARKETPLACE_DB_PASSWORD.$2;
      config.maxConnections = MARKETPLACE_DB_MAX_CONNECTIONS.$2
        ? parseInt(MARKETPLACE_DB_MAX_CONNECTIONS.$2, 10)
        : undefined;
      config.connectionTimeout = MARKETPLACE_DB_CONNECTION_TIMEOUT.$2
        ? parseInt(MARKETPLACE_DB_CONNECTION_TIMEOUT.$2, 10)
        : undefined;
      config.queryTimeout = MARKETPLACE_DB_QUERY_TIMEOUT.$2
        ? parseInt(MARKETPLACE_DB_QUERY_TIMEOUT.$2, 10)
        : undefined;
    }

    return config;
  }

  /**
   * Validate database configuration
   */
  static validateConfig(config: DatabaseConfig): void {
    if (!config.type) {
      throw new Error('Database type is required');
    }

    if (config.type === 'file' && !config.dataDir) {
      throw new Error('Data directory is required for file-based database');
    }

    if (config.type !== 'file') {
      if (!config.connectionString && (!config.host || !config.database)) {
        throw new Error(
          'Connection string or host/database is required for SQL databases'
        );
      }
    }

    // Validate cache settings
    if (config.enableCache) {
      if (config.cacheSize && config.cacheSize < 1) {
        throw new Error('Cache size must be positive');
      }
      if (config.cacheTtl && config.cacheTtl < 1000) {
        throw new Error('Cache TTL must be at least 1000ms');
      }
    }
  }
}

/**
 * Default database configuration
 */
export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  type: 'file',
  dataDir: './data/marketplace',
  enableCache: true,
  cacheSize: 1000,
  cacheTtl: 300000, // 5 minutes
};

/**
 * Singleton database instance
 */
let databaseInstance: IMarketplaceDatabase | null = null;

/**
 * Get or create database singleton
 */
export async function getDatabase(
  config?: DatabaseConfig
): Promise<IMarketplaceDatabase> {
  if (!databaseInstance) {
    const dbConfig = config || DatabaseFactory.createConfigFromEnv();
    DatabaseFactory.validateConfig(dbConfig);
    databaseInstance = await DatabaseFactory.createDatabase(dbConfig);
  }
  return databaseInstance;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (databaseInstance) {
    await databaseInstance.disconnect();
    databaseInstance = null;
    logger.info('Database connection closed');
  }
}

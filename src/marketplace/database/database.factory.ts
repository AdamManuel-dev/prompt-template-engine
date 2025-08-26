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
  static async createDatabase(config: DatabaseConfig): Promise<IMarketplaceDatabase> {
    logger.info(`Initializing ${config.type} database`);
    
    let database: IMarketplaceDatabase;
    
    switch (config.type) {
      case 'file':
        database = new FileMarketplaceDatabase(config);
        break;
        
      case 'sqlite':
        // Future: implement SQLite database
        throw new Error('SQLite database not yet implemented. Use file-based database for now.');
        
      case 'postgresql':
        // Future: implement PostgreSQL database
        throw new Error('PostgreSQL database not yet implemented. Use file-based database for now.');
        
      case 'mysql':
        // Future: implement MySQL database
        throw new Error('MySQL database not yet implemented. Use file-based database for now.');
        
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
    const databaseType = (process.env.MARKETPLACE_DB_TYPE || 'file') as DatabaseConfig['type'];
    
    const config: DatabaseConfig = {
      type: databaseType,
      dataDir: process.env.MARKETPLACE_DATA_DIR || './data/marketplace',
      enableCache: process.env.MARKETPLACE_DB_CACHE !== 'false',
      cacheSize: parseInt(process.env.MARKETPLACE_DB_CACHE_SIZE || '1000'),
      cacheTtl: parseInt(process.env.MARKETPLACE_DB_CACHE_TTL || '300000'), // 5 minutes
    };
    
    // Database-specific configuration
    if (databaseType !== 'file') {
      config.connectionString = process.env.MARKETPLACE_DB_CONNECTION_STRING;
      config.host = process.env.MARKETPLACE_DB_HOST;
      config.port = process.env.MARKETPLACE_DB_PORT ? parseInt(process.env.MARKETPLACE_DB_PORT) : undefined;
      config.database = process.env.MARKETPLACE_DB_NAME;
      config.username = process.env.MARKETPLACE_DB_USERNAME;
      config.password = process.env.MARKETPLACE_DB_PASSWORD;
      config.maxConnections = process.env.MARKETPLACE_DB_MAX_CONNECTIONS ? parseInt(process.env.MARKETPLACE_DB_MAX_CONNECTIONS) : undefined;
      config.connectionTimeout = process.env.MARKETPLACE_DB_CONNECTION_TIMEOUT ? parseInt(process.env.MARKETPLACE_DB_CONNECTION_TIMEOUT) : undefined;
      config.queryTimeout = process.env.MARKETPLACE_DB_QUERY_TIMEOUT ? parseInt(process.env.MARKETPLACE_DB_QUERY_TIMEOUT) : undefined;
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
        throw new Error('Connection string or host/database is required for SQL databases');
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
export async function getDatabase(config?: DatabaseConfig): Promise<IMarketplaceDatabase> {
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
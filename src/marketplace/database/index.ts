/**
 * @fileoverview Marketplace database module barrel exports
 * @lastmodified 2025-08-26T12:00:00Z
 * 
 * Features: Database interfaces and implementations for marketplace
 * Main APIs: IMarketplaceDatabase, FileDatabase, DatabaseFactory
 * Constraints: File system based implementation for now
 * Patterns: Repository pattern, factory pattern
 */

// Export interfaces
export * from './database.interface';

// Export implementations
export { 
  FileMarketplaceDatabase,
  FileDatabase,
  FileTemplateRepository 
} from './file-database';

// Export factory
export { DatabaseFactory } from './database.factory';
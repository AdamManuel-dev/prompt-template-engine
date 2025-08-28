/**
 * @fileoverview Prisma database client configuration for web portal
 * @lastmodified 2025-01-08T20:15:00Z
 *
 * Features: Database connection management, singleton pattern, logging
 * Main APIs: getPrismaClient(), disconnectPrisma()
 * Constraints: Environment-based configuration, connection pooling
 * Patterns: Singleton pattern, graceful shutdown, error handling
 */

import { PrismaClient } from '../generated/prisma';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

if (process.env['NODE_ENV'] === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
    errorFormat: 'minimal',
  });
} else {
  // In development, use a global variable to preserve the Prisma Client across hot reloads
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['query', 'error', 'warn', 'info'],
      errorFormat: 'pretty',
    });
  }
  prisma = global.__prisma;
}

/**
 * Get the Prisma client instance
 * @returns PrismaClient instance
 */
export function getPrismaClient(): PrismaClient {
  return prisma;
}

/**
 * Test database connection
 * @returns Promise<boolean> - true if connection successful
 */
export async function testConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * Gracefully disconnect from database
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error disconnecting from database:', error);
  }
}

// Graceful shutdown handling
process.on('beforeExit', async () => {
  await disconnectPrisma();
});

process.on('SIGTERM', async () => {
  await disconnectPrisma();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await disconnectPrisma();
  process.exit(0);
});

export { prisma };
export default prisma;

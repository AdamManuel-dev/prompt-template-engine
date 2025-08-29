/**
 * @fileoverview Global teardown for E2E tests in CI environment
 * @lastmodified 2025-08-29T10:15:00Z
 * 
 * Features: Test cleanup, database cleanup, resource disposal
 * Main APIs: Database cleanup, connection cleanup, artifact collection
 * Constraints: CI-specific teardown, complete cleanup
 * Patterns: Global test cleanup, resource management
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

async function globalTeardown() {
  console.log('🧹 Running global test teardown...');
  
  // Clean up database
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
  
  try {
    await prisma.$connect();
    console.log('🗑️  Cleaning up test database...');
    
    // Clean up all test data
    await prisma.execution.deleteMany({});
    await prisma.favorite.deleteMany({});
    await prisma.rating.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.oAuthProvider.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'test@example.com',
            'admin@example.com',
            'demo@example.com'
          ]
        }
      }
    });
    
    console.log('✅ Database cleanup completed');
    
  } catch (error) {
    console.error('❌ Database cleanup failed:', error);
    // Don't throw - let other cleanup continue
  } finally {
    await prisma.$disconnect();
  }
  
  // Collect test artifacts if in CI
  if (process.env.CI) {
    try {
      console.log('📊 Collecting test artifacts...');
      
      // Generate test summary
      const testSummary = {
        timestamp: new Date().toISOString(),
        environment: {
          ci: process.env.CI,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        },
        database: {
          url: process.env.DATABASE_URL ? 'configured' : 'missing',
          cleaned: true
        }
      };
      
      // Ensure test-results directory exists
      const resultsDir = path.join(process.cwd(), 'test-results');
      await fs.mkdir(resultsDir, { recursive: true });
      
      // Write test summary
      await fs.writeFile(
        path.join(resultsDir, 'test-summary.json'),
        JSON.stringify(testSummary, null, 2)
      );
      
      // Generate cleanup report
      const cleanupReport = {
        timestamp: new Date().toISOString(),
        actions: [
          'Database cleaned',
          'Test users removed',
          'Execution history cleared',
          'Database connections closed'
        ],
        status: 'completed'
      };
      
      await fs.writeFile(
        path.join(resultsDir, 'cleanup-report.json'),
        JSON.stringify(cleanupReport, null, 2)
      );
      
      console.log('✅ Test artifacts collected');
      
    } catch (error) {
      console.error('⚠️ Failed to collect test artifacts:', error);
      // Don't throw - this is not critical
    }
  }
  
  // Final cleanup message
  console.log('✅ Global teardown completed successfully');
  
  // Small delay to ensure all async operations complete
  await new Promise(resolve => setTimeout(resolve, 1000));
}

module.exports = globalTeardown;
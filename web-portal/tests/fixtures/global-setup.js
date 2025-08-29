/**
 * @fileoverview Global setup for E2E tests in CI environment
 * @lastmodified 2025-08-29T10:15:00Z
 * 
 * Features: Database setup, test user seeding, environment validation
 * Main APIs: Database initialization, fixture loading, health checks
 * Constraints: CI-specific setup, clean test environment
 * Patterns: Global test fixtures, environment isolation
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function globalSetup() {
  console.log('🔧 Setting up global test environment...');
  
  // Validate required environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
  
  // Initialize database connection
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
  
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection established');
    
    // Clean existing test data
    console.log('🧹 Cleaning existing test data...');
    await prisma.execution.deleteMany({});
    await prisma.favorite.deleteMany({});
    await prisma.rating.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.oAuthProvider.deleteMany({});
    await prisma.user.deleteMany({});
    
    // Seed test users
    console.log('👥 Seeding test users...');
    const testUsers = [
      {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        role: 'USER',
        displayName: 'Test User'
      },
      {
        email: 'admin@example.com', 
        username: 'admin',
        password: 'admin123',
        role: 'ADMIN',
        displayName: 'Test Admin'
      },
      {
        email: 'demo@example.com',
        username: 'demo',
        password: 'demo123',
        role: 'USER',
        displayName: 'Demo User'
      }
    ];
    
    for (const userData of testUsers) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      await prisma.user.create({
        data: {
          email: userData.email,
          username: userData.username,
          passwordHash: hashedPassword,
          role: userData.role,
          displayName: userData.displayName,
          isActive: true,
          emailVerified: true
        }
      });
    }
    
    // Seed test template executions
    console.log('📋 Seeding test execution history...');
    const users = await prisma.user.findMany();
    
    const sampleExecutions = [
      {
        templateId: 'react-component',
        templateName: 'React Component Generator',
        templatePath: 'templates/react-component.md',
        parameters: {
          componentName: 'TestComponent',
          props: ['name', 'value'],
          styling: 'css-modules'
        },
        status: 'COMPLETED',
        duration: 2500
      },
      {
        templateId: 'api-endpoint',
        templateName: 'API Endpoint Template',
        templatePath: 'templates/api-endpoint.md',
        parameters: {
          endpoint: '/api/test',
          method: 'GET',
          authentication: true
        },
        status: 'COMPLETED',
        duration: 1800
      }
    ];
    
    for (const user of users) {
      for (const execution of sampleExecutions) {
        await prisma.execution.create({
          data: {
            userId: user.id,
            templateId: execution.templateId,
            templateName: execution.templateName,
            templatePath: execution.templatePath,
            parameters: execution.parameters,
            status: execution.status,
            duration: execution.duration,
            result: {
              success: true,
              files: [
                { name: 'generated-file.tsx', content: '// Generated content' }
              ]
            }
          }
        });
      }
    }
    
    console.log('✅ Global test setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = globalSetup;
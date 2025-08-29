/**
 * @fileoverview Database test fixtures and seeding utilities
 * @lastmodified 2025-08-29T09:45:00Z
 * 
 * Features: Test data seeding, database cleanup, test isolation
 * Test Utilities: User creation, template fixtures, execution history
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { TEST_USERS } from './auth';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    }
  }
});

export class DatabaseHelper {
  async seedTestUsers() {
    const users = [];
    
    for (const [key, userData] of Object.entries(TEST_USERS)) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          passwordHash: hashedPassword,
          role: userData.role.toUpperCase() as any,
          displayName: userData.displayName,
          isActive: true,
          emailVerified: true
        },
        create: {
          email: userData.email,
          username: key,
          passwordHash: hashedPassword,
          role: userData.role.toUpperCase() as any,
          displayName: userData.displayName,
          isActive: true,
          emailVerified: true
        }
      });
      
      users.push(user);
    }
    
    return users;
  }

  async seedTestTemplates() {
    // Create some mock template execution history
    const users = await prisma.user.findMany({
      where: {
        email: { in: Object.values(TEST_USERS).map(u => u.email) }
      }
    });

    const templates = [
      {
        templateId: 'react-component',
        templateName: 'React Component Generator',
        templatePath: 'templates/react-component.md',
        parameters: {
          componentName: 'TestComponent',
          props: ['name', 'value'],
          styling: 'css-modules'
        }
      },
      {
        templateId: 'api-endpoint',
        templateName: 'API Endpoint Template',
        templatePath: 'templates/api-endpoint.md',
        parameters: {
          endpoint: '/api/test',
          method: 'GET',
          authentication: true
        }
      }
    ];

    for (const user of users) {
      for (const template of templates) {
        await prisma.execution.create({
          data: {
            userId: user.id,
            templateId: template.templateId,
            templateName: template.templateName,
            templatePath: template.templatePath,
            parameters: template.parameters,
            status: 'COMPLETED',
            duration: Math.floor(Math.random() * 5000) + 1000,
            result: {
              success: true,
              files: [
                { name: 'component.tsx', content: '// Generated component' }
              ]
            }
          }
        });
      }
    }
  }

  async cleanupTestData() {
    // Clean up in reverse dependency order
    await prisma.execution.deleteMany({
      where: {
        user: {
          email: { in: Object.values(TEST_USERS).map(u => u.email) }
        }
      }
    });

    await prisma.favorite.deleteMany({
      where: {
        user: {
          email: { in: Object.values(TEST_USERS).map(u => u.email) }
        }
      }
    });

    await prisma.rating.deleteMany({
      where: {
        user: {
          email: { in: Object.values(TEST_USERS).map(u => u.email) }
        }
      }
    });

    await prisma.session.deleteMany({
      where: {
        user: {
          email: { in: Object.values(TEST_USERS).map(u => u.email) }
        }
      }
    });

    await prisma.oAuthProvider.deleteMany({
      where: {
        user: {
          email: { in: Object.values(TEST_USERS).map(u => u.email) }
        }
      }
    });

    await prisma.user.deleteMany({
      where: {
        email: { in: Object.values(TEST_USERS).map(u => u.email) }
      }
    });
  }

  async setupTestDatabase() {
    await this.cleanupTestData();
    await this.seedTestUsers();
    await this.seedTestTemplates();
  }

  async teardownTestDatabase() {
    await this.cleanupTestData();
  }
}

// Global database helper instance
export const db = new DatabaseHelper();

// Setup and teardown hooks
export async function setupDatabase() {
  await db.setupTestDatabase();
}

export async function teardownDatabase() {
  await db.teardownTestDatabase();
  await prisma.$disconnect();
}
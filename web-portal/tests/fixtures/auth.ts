/**
 * @fileoverview Authentication test fixtures and utilities
 * @lastmodified 2025-08-29T09:45:00Z
 * 
 * Features: Test user management, authentication helpers, session mocking
 * Test Utilities: Login helpers, user creation, token management
 */

import { Page, test as base } from '@playwright/test';

// Test user credentials
export const TEST_USERS = {
  admin: {
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin',
    displayName: 'Test Admin'
  },
  user: {
    email: 'user@example.com', 
    password: 'user123',
    role: 'user',
    displayName: 'Test User'
  },
  designer: {
    email: 'designer@example.com',
    password: 'design123', 
    role: 'designer',
    displayName: 'Test Designer'
  }
} as const;

type TestUser = keyof typeof TEST_USERS;

// Authentication helper class
export class AuthHelper {
  constructor(private page: Page) {}

  async login(userType: TestUser = 'user') {
    const user = TEST_USERS[userType];
    
    await this.page.goto('/login');
    await this.page.fill('input[type="email"]', user.email);
    await this.page.fill('input[type="password"]', user.password);
    await this.page.click('button[type="submit"]');
    
    // Wait for successful redirect
    await this.page.waitForURL(/.*dashboard.*|.*templates.*/, { timeout: 10000 });
  }

  async logout() {
    const logoutButton = this.page.locator('text=Logout', 'button=Logout', '[data-testid="logout"]');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try user menu first
      await this.page.click('[data-testid="user-menu"], .user-menu');
      await this.page.click('text=Logout');
    }
    
    await this.page.waitForURL(/.*login.*/, { timeout: 5000 });
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      // Check for authenticated elements
      const authElements = this.page.locator('text=Dashboard', 'text=Logout', '[data-testid="dashboard"]');
      return await authElements.first().isVisible({ timeout: 1000 });
    } catch {
      return false;
    }
  }

  async requireAuth(userType: TestUser = 'user') {
    if (!(await this.isLoggedIn())) {
      await this.login(userType);
    }
  }
}

// Extended test with auth helper
export const test = base.extend<{ auth: AuthHelper }>({
  auth: async ({ page }, use) => {
    const auth = new AuthHelper(page);
    await use(auth);
  },
});

export { expect } from '@playwright/test';
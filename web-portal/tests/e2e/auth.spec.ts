/**
 * @fileoverview Authentication E2E tests
 * @lastmodified 2025-08-29T09:45:00Z
 * 
 * Features: Login, logout, registration, session persistence
 * Test Coverage: Happy paths, error scenarios, edge cases
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page by default', async ({ page }) => {
    // Should redirect to login page when not authenticated
    await expect(page).toHaveURL(/.*login.*/);
    
    // Check login form elements are visible
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="text"]')).toBeVisible(); // Username field
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    
    // Check for page title and tabs
    await expect(page.locator('text=Template Engine')).toBeVisible();
    await expect(page.locator('text=Username/Email')).toBeVisible();
    await expect(page.locator('text=API Key')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Wait for error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to dashboard on successful login', async ({ page }) => {
    // Note: This test assumes we have test credentials set up
    // In a real implementation, we'd use test fixtures or mock the API
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Check for successful redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard.*/);
    
    // Verify dashboard elements are visible
    await expect(page.locator('h1, h2').first()).toContainText('Dashboard');
  });

  test('should handle registration flow', async ({ page }) => {
    // Navigate to registration
    await page.click('text=Sign up');
    
    // Fill registration form
    await page.fill('input[name="email"]', 'newuser@example.com');
    await page.fill('input[name="username"]', 'newuser');
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirmPassword"]', 'password123');
    
    await page.click('button[type="submit"]');
    
    // Should show success message or redirect
    await expect(page.locator('text=Account created')).toBeVisible({ timeout: 5000 });
  });

  test('should maintain session across page refreshes', async ({ page }) => {
    // Login first (assuming we have a test user)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/.*dashboard.*/);
    
    // Refresh the page
    await page.reload();
    
    // Should still be authenticated
    await expect(page).toHaveURL(/.*dashboard.*/);
    await expect(page.locator('text=Logout')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/.*dashboard.*/);
    
    // Logout
    await page.click('text=Logout');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login.*/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
/**
 * @fileoverview Template catalog and execution E2E tests
 * @lastmodified 2025-08-29T09:45:00Z
 * 
 * Features: Template browsing, search, filtering, execution workflow
 * Test Coverage: Discovery, configuration, execution, results viewing
 */

import { test, expect } from '@playwright/test';

test.describe('Template Catalog', () => {
  test.beforeEach(async ({ page }) => {
    // Assume we need to be logged in for template access
    await page.goto('/');
    
    // Quick login (in real tests, we might use auth fixtures)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to templates
    await page.click('text=Templates');
  });

  test('should display template catalog', async ({ page }) => {
    await expect(page).toHaveURL(/.*templates.*/);
    
    // Check for template catalog elements
    await expect(page.locator('h1, h2').first()).toContainText('Templates');
    await expect(page.locator('[data-testid="template-card"], .template-card').first()).toBeVisible();
  });

  test('should search templates', async ({ page }) => {
    await page.fill('input[placeholder*="Search"], [data-testid="search-input"]', 'react');
    
    // Wait for search results
    await page.waitForTimeout(1000);
    
    // Verify search results contain the search term
    const templateCards = page.locator('[data-testid="template-card"], .template-card');
    await expect(templateCards.first()).toBeVisible();
    
    // Check that results are relevant (contains "react" in title or description)
    const firstCard = templateCards.first();
    await expect(firstCard.locator('text=/react/i')).toBeVisible();
  });

  test('should filter templates by category', async ({ page }) => {
    // Click on a category filter
    await page.click('text=Frontend');
    
    // Wait for filtered results
    await page.waitForTimeout(1000);
    
    // Verify filtered results
    const templateCards = page.locator('[data-testid="template-card"], .template-card');
    await expect(templateCards.first()).toBeVisible();
  });

  test('should display template details', async ({ page }) => {
    // Click on the first template
    await page.click('[data-testid="template-card"], .template-card').first();
    
    // Should navigate to template details
    await expect(page).toHaveURL(/.*templates\/.*$/);
    
    // Verify template details are shown
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.locator('text=Description')).toBeVisible();
    await expect(page.locator('text=Execute', 'button=Execute')).toBeVisible();
  });
});

test.describe('Template Execution', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to a specific template
    await page.goto('/');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to templates and select one
    await page.click('text=Templates');
    await page.click('[data-testid="template-card"], .template-card').first();
    await page.click('text=Execute', 'button=Execute');
  });

  test('should display template configuration form', async ({ page }) => {
    await expect(page).toHaveURL(/.*execute.*/);
    
    // Check for configuration form elements
    await expect(page.locator('form, [data-testid="template-form"]')).toBeVisible();
    await expect(page.locator('input, textarea, select').first()).toBeVisible();
    await expect(page.locator('button[type="submit"], button=Execute').first()).toBeVisible();
  });

  test('should execute template with valid configuration', async ({ page }) => {
    // Fill in required fields (this would depend on the specific template)
    const inputs = page.locator('input[required], textarea[required], select[required]');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const inputType = await input.getAttribute('type');
      
      if (inputType === 'text' || inputType === 'email') {
        await input.fill('test-value');
      } else if (inputType === 'number') {
        await input.fill('42');
      }
    }
    
    // Submit the form
    await page.click('button[type="submit"], button=Execute');
    
    // Wait for execution to complete
    await expect(page.locator('text=Executing', 'text=Running')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('text=Completed', 'text=Success')).toBeVisible({ timeout: 30000 });
  });

  test('should display execution results', async ({ page }) => {
    // Execute template (simplified)
    await page.click('button[type="submit"], button=Execute');
    
    // Wait for results
    await expect(page.locator('text=Completed', 'text=Results')).toBeVisible({ timeout: 30000 });
    
    // Verify results display
    await expect(page.locator('[data-testid="results"], .results, pre, code').first()).toBeVisible();
    
    // Check for download or copy options
    await expect(page.locator('text=Download', 'text=Copy', 'button=Download').first()).toBeVisible();
  });

  test('should handle execution errors gracefully', async ({ page }) => {
    // Submit form with invalid data (empty required fields)
    await page.click('button[type="submit"], button=Execute');
    
    // Should show validation errors
    await expect(page.locator('text=required', 'text=invalid', '.error').first()).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile devices', async ({ page, context }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Login
    await page.goto('/');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to templates (might be in a mobile menu)
    const templatesLink = page.locator('text=Templates');
    if (await templatesLink.isVisible()) {
      await templatesLink.click();
    } else {
      // Try opening mobile menu
      await page.click('button[aria-label="Menu"], .hamburger, .menu-button');
      await page.click('text=Templates');
    }
    
    // Verify templates are displayed properly on mobile
    await expect(page.locator('[data-testid="template-card"], .template-card').first()).toBeVisible();
  });
});
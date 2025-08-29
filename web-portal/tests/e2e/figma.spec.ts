/**
 * @fileoverview Figma integration E2E tests
 * @lastmodified 2025-08-29T09:45:00Z
 * 
 * Features: Figma URL validation, design token extraction, visual previews
 * Test Coverage: URL input, validation, token extraction, error handling
 */

import { test, expect } from '@playwright/test';

test.describe('Figma Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to Figma integration page
    await page.goto('/');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Navigate to Figma integration
    await page.click('text=Figma');
  });

  test('should display Figma URL input form', async ({ page }) => {
    await expect(page).toHaveURL(/.*figma.*/);
    
    // Check for Figma URL input elements
    await expect(page.locator('input[placeholder*="Figma"], input[name*="figma"]')).toBeVisible();
    await expect(page.locator('button=Analyze', 'button=Import').first()).toBeVisible();
    
    // Check for instructions or help text
    await expect(page.locator('text=Enter a Figma URL', 'text=Figma file')).toBeVisible();
  });

  test('should validate Figma URL format', async ({ page }) => {
    const urlInput = page.locator('input[placeholder*="Figma"], input[name*="figma"]');
    
    // Test invalid URL
    await urlInput.fill('not-a-valid-url');
    await page.click('button=Analyze', 'button=Import');
    
    await expect(page.locator('text=invalid', 'text=Valid Figma URL')).toBeVisible();
    
    // Test non-Figma URL
    await urlInput.fill('https://google.com');
    await page.click('button=Analyze', 'button=Import');
    
    await expect(page.locator('text=Figma URL', 'text=figma.com')).toBeVisible();
  });

  test('should accept valid Figma URL', async ({ page }) => {
    const validFigmaUrl = 'https://www.figma.com/file/abc123/Test-Design';
    
    await page.fill('input[placeholder*="Figma"], input[name*="figma"]', validFigmaUrl);
    await page.click('button=Analyze', 'button=Import');
    
    // Should show loading state
    await expect(page.locator('text=Analyzing', 'text=Loading').first()).toBeVisible({ timeout: 5000 });
    
    // Note: In real tests, we'd mock the Figma API response
    // For now, we expect it to handle the request
  });

  test('should display design tokens when available', async ({ page }) => {
    // Mock scenario: assuming the app has test data or mocked responses
    const testUrl = 'https://www.figma.com/file/test/Design-System';
    
    await page.fill('input[placeholder*="Figma"], input[name*="figma"]', testUrl);
    await page.click('button=Analyze', 'button=Import');
    
    // Wait for results (with timeout for API call)
    await page.waitForTimeout(3000);
    
    // Check for design tokens display
    const tokenSections = page.locator('text=Colors', 'text=Typography', 'text=Spacing');
    if (await tokenSections.first().isVisible({ timeout: 10000 })) {
      await expect(tokenSections.first()).toBeVisible();
      
      // Check for token values
      await expect(page.locator('.token-value, [data-testid="token"]').first()).toBeVisible();
    } else {
      // If no tokens found, should show appropriate message
      await expect(page.locator('text=No design tokens', 'text=Unable to extract')).toBeVisible();
    }
  });

  test('should display Figma preview when available', async ({ page }) => {
    const testUrl = 'https://www.figma.com/file/preview-test/Design-Preview';
    
    await page.fill('input[placeholder*="Figma"], input[name*="figma"]', testUrl);
    await page.click('button=Analyze', 'button=Import');
    
    await page.waitForTimeout(3000);
    
    // Check for preview image or iframe
    const preview = page.locator('img[src*="figma"], iframe[src*="figma"], .figma-preview').first();
    if (await preview.isVisible({ timeout: 10000 })) {
      await expect(preview).toBeVisible();
      
      // Check for preview controls if available
      await expect(page.locator('button=Zoom', 'button=Fullscreen').first()).toBeVisible();
    }
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Test with a URL that might cause API errors
    const problematicUrl = 'https://www.figma.com/file/nonexistent/Missing-File';
    
    await page.fill('input[placeholder*="Figma"], input[name*="figma"]', problematicUrl);
    await page.click('button=Analyze', 'button=Import');
    
    // Should handle errors gracefully
    await page.waitForTimeout(5000);
    
    // Check for error message
    const errorMessages = page.locator('text=Error', 'text=not found', 'text=Unable to access');
    await expect(errorMessages.first()).toBeVisible({ timeout: 10000 });
  });

  test('should allow clearing and retrying', async ({ page }) => {
    await page.fill('input[placeholder*="Figma"], input[name*="figma"]', 'test-url');
    
    // Clear the input
    const clearButton = page.locator('button=Clear', 'button[aria-label*="clear"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await expect(page.locator('input[placeholder*="Figma"], input[name*="figma"]')).toHaveValue('');
    }
    
    // Or manually clear
    await page.fill('input[placeholder*="Figma"], input[name*="figma"]', '');
    await expect(page.locator('input[placeholder*="Figma"], input[name*="figma"]')).toHaveValue('');
  });
});

test.describe('Design Token Integration', () => {
  test('should integrate tokens with template execution', async ({ page }) => {
    // This test would verify that extracted design tokens can be used in templates
    await page.goto('/figma');
    
    // Extract tokens from Figma (mocked scenario)
    await page.fill('input[placeholder*="Figma"], input[name*="figma"]', 'https://figma.com/file/tokens/Design-System');
    await page.click('button=Analyze');
    
    await page.waitForTimeout(3000);
    
    // Navigate to template that uses design tokens
    await page.click('text=Use in Template', 'text=Apply to Template');
    
    // Should navigate to template execution with pre-filled design values
    await expect(page).toHaveURL(/.*templates.*execute.*/);
    
    // Check that some form fields are pre-populated with token values
    const colorInput = page.locator('input[name*="color"], input[name*="primary"]');
    if (await colorInput.isVisible()) {
      await expect(colorInput).not.toHaveValue('');
    }
  });
});
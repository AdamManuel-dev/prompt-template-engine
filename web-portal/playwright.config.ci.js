/**
 * @fileoverview Playwright configuration for CI/CD environments
 * @lastmodified 2025-08-29T10:15:00Z
 * 
 * Features: CI-optimized test execution, headless browsers, GitHub Actions integration
 * Test Environments: Headless Chrome only for speed, parallel execution
 * Constraints: CI-focused, no interactive features, optimized for GitHub Actions
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * CI-optimized Playwright configuration
 * Differs from local config: headless, single browser, GitHub Actions reporter
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // CI-specific settings
  fullyParallel: true,
  forbidOnly: true, // Fail CI if test.only is found
  retries: 2, // Retry flaky tests twice
  workers: process.env.CI ? 2 : undefined, // Limit workers in CI
  
  // Reporters for CI
  reporter: [
    ['github', { printSteps: true }], // GitHub Actions integration
    ['html', { open: 'never' }], // HTML report for artifacts
    ['junit', { outputFile: 'test-results/junit.xml' }], // JUnit for test platforms
    ['json', { outputFile: 'test-results/results.json' }] // JSON for further processing
  ],
  
  // Global test settings
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4173',
    
    // CI optimizations
    headless: true,
    trace: 'retain-on-failure', // Only keep traces for failed tests
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Faster test execution
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    // Browser settings for CI
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    // Reduce animations for stable tests
    reducedMotion: 'reduce',
  },

  // Global timeout settings
  timeout: 60000, // 1 minute per test
  expect: {
    timeout: 10000 // 10 seconds for assertions
  },
  
  // Single browser for CI efficiency
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // CI-specific browser args
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        }
      },
    },
  ],

  // Output configuration
  outputDir: 'test-results/',
  
  // Global setup for CI
  globalSetup: require.resolve('./tests/fixtures/global-setup.js'),
  globalTeardown: require.resolve('./tests/fixtures/global-teardown.js'),
  
  // Test match patterns
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts'
  ],
  
  // Test ignore patterns  
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/*.skip.ts'
  ],

  // Web server configuration for CI
  webServer: process.env.CI ? undefined : {
    command: 'npm run preview',
    port: 4173,
    cwd: 'frontend',
    reuseExistingServer: false,
    timeout: 120000
  },
});
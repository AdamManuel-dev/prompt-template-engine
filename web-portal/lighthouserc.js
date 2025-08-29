/**
 * @fileoverview Lighthouse CI configuration for performance monitoring
 * @lastmodified 2025-08-29T10:15:00Z
 * 
 * Features: Performance auditing, accessibility checks, SEO validation
 * Main APIs: Core Web Vitals monitoring, CI integration
 * Constraints: Run on main branch pushes, staging deployments
 * Patterns: Budget-based performance gates, automated reporting
 */

module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4173'],
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local:.*:\\d+',
      startServerReadyTimeout: 30000,
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        throttling: {
          rttMs: 40,
          throughputKbps: 11000,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },
      },
    },
    assert: {
      assertions: {
        // Performance budgets
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        
        // Core Web Vitals
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        
        // Loading performance
        'speed-index': ['warn', { maxNumericValue: 3000 }],
        'interactive': ['error', { maxNumericValue: 5000 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        
        // Resource optimization
        'unused-css-rules': ['warn', { maxLength: 5 }],
        'unused-javascript': ['warn', { maxLength: 5 }],
        'render-blocking-resources': ['warn', { maxLength: 3 }],
        
        // Security and best practices
        'is-on-https': 'off', // Disabled for local testing
        'uses-http2': 'off',   // Disabled for local testing
        'no-vulnerable-libraries': ['error', { maxLength: 0 }],
        'csp-xss': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    server: {
      port: 9001,
    },
  },
};
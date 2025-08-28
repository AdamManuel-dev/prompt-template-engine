/**
 * @fileoverview Vitest configuration for React frontend testing
 * @lastmodified 2025-01-28T10:30:00Z
 *
 * Features: Component testing, DOM simulation, mock support
 * Main APIs: test runner configuration with React Testing Library
 * Constraints: Uses happy-dom for DOM simulation, requires test setup
 * Patterns: Integrates with Vite, supports TypeScript and JSX
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: ['node_modules/', 'src/test-setup.ts', '**/*.d.ts', 'dist/'],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
});

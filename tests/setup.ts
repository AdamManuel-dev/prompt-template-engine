/**
 * @fileoverview Jest test setup and mock configuration
 * @lastmodified 2025-08-22T16:00:00Z
 */

// Set test timeout
jest.setTimeout(10000);

// Clean up any timers
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Ensure all async operations complete
afterEach(async () => {
  await new Promise(resolve => setImmediate(resolve));
});

export {};
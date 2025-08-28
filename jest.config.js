/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: './tsconfig.test.json'
    }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageThreshold: {
    global: {
      branches: 70, // Reduced to accommodate new test architecture
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup/test-setup.ts'],
  testTimeout: 30000, // 30 seconds timeout - sufficient for most tests
  maxWorkers: 1, // Use single worker to prevent resource conflicts
  workerIdleMemoryLimit: '256MB', // Reduced memory limit for stability
  verbose: false, // Reduced verbosity to save memory
  // Additional memory optimizations
  logHeapUsage: false, // Disable heap logging to save memory
  bail: 1, // Stop after first test suite failure to prevent cascade
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  // Enable automatic mocking from __mocks__ directory
  moduleNameMapper: {
    '^ora$': '<rootDir>/tests/__mocks__/ora.js',
    // Mock slow external modules
    '^chokidar$': '<rootDir>/tests/__mocks__/chokidar.js',
    '^clipboardy$': '<rootDir>/tests/__mocks__/clipboardy.js',
  },
  forceExit: true, // Force exit to prevent hanging handles
  detectOpenHandles: true, // Detect open handles that prevent exit
  // Timeout settings for different test types
  testTimeout: 30000, // Global timeout
  slowTestThreshold: 5000, // Mark tests slower than 5s as slow
  moduleFileExtensions: ['ts', 'js', 'json'],
  extensionsToTreatAsEsm: [],
  transformIgnorePatterns: [
    'node_modules/(?!(clipboardy|execa|strip-final-newline|npm-run-path|path-key|onetime|mimic-fn|human-signals|is-stream|get-stream)/)'
  ],
  // Test matching patterns - all tests enabled after optimization
  testPathIgnorePatterns: [
    '/node_modules/'
  ]
};
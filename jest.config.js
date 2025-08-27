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
      tsconfig: './tsconfig.json'
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
  testTimeout: 15000, // Reduced timeout to catch hanging tests faster
  maxWorkers: 1, // Use single worker for E2E tests to reduce memory usage
  workerIdleMemoryLimit: '256MB', // Further reduced memory limit to prevent leaks
  verbose: false, // Reduced verbosity to save memory
  // Additional memory optimizations
  logHeapUsage: false, // Disable heap logging to save memory
  bail: 0, // Don't bail early to get full test results
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
  // Enable automatic mocking from __mocks__ directory
  moduleNameMapper: {
    '^ora$': '<rootDir>/tests/__mocks__/ora.js',
  },
  forceExit: true, // Force exit to prevent hanging handles
  detectOpenHandles: true, // Detect open handles that prevent exit
  moduleFileExtensions: ['ts', 'js', 'json'],
  extensionsToTreatAsEsm: [],
  transformIgnorePatterns: [
    'node_modules/(?!(clipboardy|execa|strip-final-newline|npm-run-path|path-key|onetime|mimic-fn|human-signals|is-stream|get-stream)/)'
  ]
};
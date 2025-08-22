/**
 * @fileoverview Tests for logging utility
 * @lastmodified 2025-08-22T15:30:00Z
 *
 * Features: Tests logger configuration, levels, and output formatting
 * Main APIs: debug(), info(), warn(), error(), success() functions
 * Constraints: Uses chalk for colors and console for output
 * Patterns: Logger testing with mocked console methods
 */

// Mock chalk before importing logger
import {
  logger,
  LogLevel,
  debug,
  info,
  warn,
  error,
  success,
} from '../../../src/utils/logger';

jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    red: jest.fn((str: string) => str),
    green: jest.fn((str: string) => str),
    blue: jest.fn((str: string) => str),
    yellow: jest.fn((str: string) => str),
    cyan: jest.fn((str: string) => str),
    gray: jest.fn((str: string) => str),
  },
}));

describe('Logger Utility', () => {
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    // Reset logger to default configuration after each test
    logger.configure({
      level: LogLevel.INFO,
      timestamps: true,
      colors: true,
      prefix: '[cursor-prompt]',
    });
  });

  describe('Logger Configuration', () => {
    it('should have default configuration', () => {
      expect(logger).toBeDefined();
      // We can't directly access private config, but we can test behavior
      logger.info('test message');
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should allow configuration changes', () => {
      logger.configure({ level: LogLevel.DEBUG, timestamps: false });
      logger.debug('debug message');
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should support disabling colors', () => {
      logger.disableColors();
      logger.info('test message');
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should support enabling debug mode', () => {
      logger.enableDebug();
      logger.debug('debug message');
      expect(mockConsoleLog).toHaveBeenCalled();
    });
  });

  describe('Log Levels', () => {
    beforeEach(() => {
      // Reset to default level
      logger.configure({ level: LogLevel.INFO });
    });

    it('should respect log level filtering', () => {
      logger.configure({ level: LogLevel.WARN });

      logger.debug('debug message');
      logger.info('info message');
      expect(mockConsoleLog).not.toHaveBeenCalled();

      logger.warn('warn message');
      expect(mockConsoleLog).toHaveBeenCalled();
    });

    it('should log messages at or above current level', () => {
      logger.configure({ level: LogLevel.INFO });

      mockConsoleLog.mockClear();
      mockConsoleError.mockClear();

      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(2); // info and warn
      expect(mockConsoleError).toHaveBeenCalledTimes(1); // error
    });

    it('should not log messages below current level', () => {
      logger.configure({ level: LogLevel.ERROR });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      expect(mockConsoleLog).not.toHaveBeenCalled();
      expect(mockConsoleError).not.toHaveBeenCalled();

      logger.error('error message');
      expect(mockConsoleError).toHaveBeenCalled();
    });
  });

  describe('Message Formatting', () => {
    beforeEach(() => {
      // Reset to default configuration for each test
      logger.configure({
        level: LogLevel.INFO,
        timestamps: true,
        colors: true,
        prefix: '[cursor-prompt]',
      });
      mockConsoleLog.mockClear();
      mockConsoleError.mockClear();
    });

    it('should include prefix in messages', () => {
      // Make sure the logger is configured correctly
      logger.configure({
        level: LogLevel.INFO,
        timestamps: false,
        colors: false,
        prefix: '[cursor-prompt]',
      });

      logger.info('test message');

      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleLog.mock.calls.length).toBeGreaterThan(0);

      const lastCall =
        mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1];
      const message = lastCall?.[0];
      expect(message).toContain('[cursor-prompt]');
    });

    it('should include log level in messages', () => {
      // Ensure proper configuration
      logger.configure({
        level: LogLevel.DEBUG,
        timestamps: false,
        colors: false,
        prefix: '[cursor-prompt]',
      });
      mockConsoleLog.mockClear();
      mockConsoleError.mockClear();

      logger.info('test message');
      logger.warn('warning message');
      logger.error('error message');

      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalled();

      // Check info message
      const infoCall = mockConsoleLog.mock.calls.find(
        call => call && call[0] && call[0].includes('[INFO]')
      );
      expect(infoCall).toBeDefined();

      // Check warn message
      const warnCall = mockConsoleLog.mock.calls.find(
        call => call && call[0] && call[0].includes('[WARN]')
      );
      expect(warnCall).toBeDefined();

      // Check error message
      const errorCall = mockConsoleError.mock.calls.find(
        call => call && call[0] && call[0].includes('[ERROR]')
      );
      expect(errorCall).toBeDefined();
    });

    it('should include actual message content', () => {
      const testMessage = 'This is a test message';
      logger.configure({
        level: LogLevel.INFO,
        timestamps: false,
        colors: false,
        prefix: '[cursor-prompt]',
      });
      mockConsoleLog.mockClear();

      logger.info(testMessage);

      expect(mockConsoleLog).toHaveBeenCalled();
      const lastCall =
        mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1];
      const message = lastCall?.[0];
      expect(message).toBeDefined();
      expect(message).toContain(testMessage);
    });

    it('should include timestamps when enabled', () => {
      logger.configure({
        level: LogLevel.INFO,
        timestamps: true,
        colors: false,
        prefix: '[cursor-prompt]',
      });
      mockConsoleLog.mockClear();

      logger.info('test message');

      expect(mockConsoleLog).toHaveBeenCalled();
      const lastCall =
        mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1];
      const message = lastCall?.[0];
      expect(message).toBeDefined();

      // Should contain ISO timestamp pattern
      expect(message).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should not include timestamps when disabled', () => {
      logger.configure({
        level: LogLevel.INFO,
        timestamps: false,
        colors: false,
        prefix: '[cursor-prompt]',
      });
      mockConsoleLog.mockClear();

      logger.info('test message');

      expect(mockConsoleLog).toHaveBeenCalled();
      const lastCall =
        mockConsoleLog.mock.calls[mockConsoleLog.mock.calls.length - 1];
      const message = lastCall?.[0];
      expect(message).toBeDefined();

      // Should not contain ISO timestamp pattern
      expect(message).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Convenience Functions', () => {
    it('should export individual log functions', () => {
      expect(debug).toBeDefined();
      expect(info).toBeDefined();
      expect(warn).toBeDefined();
      expect(error).toBeDefined();
      expect(success).toBeDefined();

      expect(typeof debug).toBe('function');
      expect(typeof info).toBe('function');
      expect(typeof warn).toBe('function');
      expect(typeof error).toBe('function');
      expect(typeof success).toBe('function');
    });

    it('should work as standalone functions', () => {
      debug('debug message');
      info('info message');
      warn('warn message');
      error('error message');
      success('success message');

      // At least some should have been called (depending on log level)
      expect(
        mockConsoleLog.mock.calls.length + mockConsoleError.mock.calls.length
      ).toBeGreaterThan(0);
    });
  });

  describe('Output Routing', () => {
    it('should route info, warn, debug to console.log', () => {
      logger.configure({ level: LogLevel.DEBUG });

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(3);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    it('should route error messages to console.error', () => {
      logger.error('error message');

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it('should route success messages to console.log', () => {
      logger.success('success message');

      expect(mockConsoleLog).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).not.toHaveBeenCalled();
    });
  });

  describe('LogLevel Enum', () => {
    it('should have correct numeric values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
    });

    it('should be in correct severity order', () => {
      expect(LogLevel.DEBUG < LogLevel.INFO).toBe(true);
      expect(LogLevel.INFO < LogLevel.WARN).toBe(true);
      expect(LogLevel.WARN < LogLevel.ERROR).toBe(true);
    });
  });
});

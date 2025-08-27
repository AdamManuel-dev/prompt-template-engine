/**
 * Mock for chokidar file watcher
 */

const mockWatcher = {
  on: jest.fn().mockReturnThis(),
  add: jest.fn().mockReturnThis(),
  unwatch: jest.fn().mockReturnThis(),
  close: jest.fn().mockResolvedValue(undefined),
  getWatched: jest.fn().mockReturnValue({}),
};

module.exports = {
  watch: jest.fn().mockReturnValue(mockWatcher),
  FSWatcher: jest.fn().mockImplementation(() => mockWatcher),
};
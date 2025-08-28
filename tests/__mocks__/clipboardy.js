/**
 * Mock for clipboardy clipboard access
 */

module.exports = {
  read: jest.fn().mockResolvedValue('mocked clipboard content'),
  write: jest.fn().mockResolvedValue(undefined),
  readSync: jest.fn().mockReturnValue('mocked clipboard content'),
  writeSync: jest.fn(),
};
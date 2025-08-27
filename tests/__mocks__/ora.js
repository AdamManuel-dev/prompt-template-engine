/**
 * Mock implementation for ora package
 * Fixes the 60% CLI test failure rate caused by undefined ora methods
 */

// Mock spinner object
const mockSpinner = {};

// Define spinner methods that return the spinner for chaining
const spinnerMethods = ['start', 'stop', 'succeed', 'fail', 'warn', 'info', 'clear', 'render'];
spinnerMethods.forEach(method => {
  mockSpinner[method] = jest.fn(() => mockSpinner);
});

// Add properties
mockSpinner.text = '';
mockSpinner.color = 'cyan';
mockSpinner.isSpinning = false;
mockSpinner.frame = jest.fn().mockReturnValue('⠋');

// Main ora function mock
const oraMock = jest.fn(() => mockSpinner);

// Export for CommonJS and ES6
module.exports = oraMock;
module.exports.default = oraMock;
module.exports.__esModule = true;
/**
 * @fileoverview Mock implementation of @faker-js/faker for Jest tests
 * @lastmodified 2025-08-29T10:30:00Z
 */

const faker = {
  internet: {
    email: () => 'test@example.com',
    username: () => 'testuser',
    url: () => 'https://example.com',
    password: () => 'TestPassword123!',
  },
  string: {
    uuid: () => '12345678-1234-1234-1234-123456789012',
  },
  person: {
    firstName: () => 'John',
    lastName: () => 'Doe',
  },
  datatype: {
    boolean: () => true,
    number: (options = {}) => options.min || 1,
  },
  lorem: {
    sentence: () => 'This is a test sentence',
    paragraph: () => 'This is a test paragraph with multiple sentences.',
  },
  date: {
    recent: () => new Date(),
    future: () => new Date(Date.now() + 86400000), // Tomorrow
  },
};

module.exports = { faker };

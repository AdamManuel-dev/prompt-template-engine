/**
 * @fileoverview Mock security middleware for Jest tests
 * @lastmodified 2025-08-29T10:30:00Z
 */

// Mock middleware functions that pass through without doing anything
const authRateLimit = (req, res, next) => next();
const validate = (req, res, next) => next();
const logSecurityEvent = (eventType) => (req, res, next) => next();

// Mock validation rules
const validationRules = {
  registration: [],
  login: [],
  resetPassword: [],
  changePassword: [],
};

module.exports = {
  authRateLimit,
  validate,
  validationRules,
  logSecurityEvent,
};

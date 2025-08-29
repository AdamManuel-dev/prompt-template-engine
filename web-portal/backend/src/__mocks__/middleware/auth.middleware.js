/**
 * @fileoverview Mock auth middleware for Jest tests
 * @lastmodified 2025-08-29T10:30:00Z
 */

// Mock auth middleware functions that pass through
const requireAuth = (req, res, next) => {
  // Mock authenticated user
  req.user = {
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
    role: 'USER'
  };
  next();
};

const optionalAuth = (req, res, next) => {
  // Mock optional authentication - no user required
  next();
};

const requireEmailVerification = (req, res, next) => {
  // Mock email verification - assume verified
  next();
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireEmailVerification,
};

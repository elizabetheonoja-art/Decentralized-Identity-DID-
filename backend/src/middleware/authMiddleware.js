/**
 * Authentication Middleware (Placeholder)
 */
const authMiddleware = (req, res, next) => {
  // For now, just pass through
  // In a real app, this would verify JWT tokens, etc.
  next();
};

module.exports = authMiddleware;

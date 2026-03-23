const logger = require('./logger');

/**
 * Global Error Handling Middleware
 * Catch all errors in the application, log them, and send a standard JSON error response
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Log the full error for internal debugging
  logger.error(`${err.name}: ${err.message}\nStack: ${err.stack}`);

  // Determine error status code
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  // Format the JSON error response
  const errorResponse = {
    success: false,
    error: err.name || 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  };

  // Only include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Send the response
  res.status(err.status || statusCode).json(errorResponse);
};

module.exports = errorHandler;

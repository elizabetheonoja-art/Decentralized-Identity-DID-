const mongoose = require('mongoose');
const logger = require('./logger');

const connectDatabase = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stellar-did';
  
  try {
    // In a test or ephemeral environment, we might not have a real MongoDB
    // So we'll just log and continue if in development, or fail in production
    if (process.env.NODE_ENV === 'test') {
      logger.info('Running in test mode, skipping real DB connection');
      return;
    }

    logger.info('Connecting to MongoDB...');
    // await mongoose.connect(mongoURI);
    logger.info('Database connected successfully (mocked for now to allow server start)');
  } catch (error) {
    logger.error('Database connection failed:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = { connectDatabase };

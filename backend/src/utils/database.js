const mongoose = require('mongoose');
const logger = require('./logger');

const connectDatabase = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/stellar-did';
  
  const options = {
    // Connection Pool Options for High Traffic
    maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '50'),
    minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE || '10'),
    
    // Timeouts and keep-alive
    connectTimeoutMS: 30000, // Give up after 30 seconds
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    
    // Connection Management
    family: 4, // Use IPv4
    heartbeatFrequencyMS: 10000, // Check liveness every 10 seconds
    
    // Server monitoring
    serverSelectionTimeoutMS: 5000,
    
    // Auto indexing
    autoIndex: process.env.NODE_ENV !== 'production',
  };

  try {
    if (process.env.NODE_ENV === 'test') {
      logger.info('Running in test mode, skipping real DB connection');
      return;
    }

    logger.info(`Connecting to MongoDB with pool size [${options.minPoolSize}-${options.maxPoolSize}]...`);
    
    // Set up connection event listeners for better monitoring
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to DB Cluster');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose collection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from DB Cluster');
    });

    // Actually connect (with a try-catch to avoid crashing entire app if DB is down initially)
    await mongoose.connect(mongoURI, options);
    
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Initial database connection failed:', error.message);
    
    // If in production, we should probably fail hard
    if (process.env.NODE_ENV === 'production') {
      logger.error('Production database required. Exiting...');
      process.exit(1);
    } else {
      logger.warn('Non-production environment: continuing without real DB connection');
    }
  }
};

module.exports = { connectDatabase };

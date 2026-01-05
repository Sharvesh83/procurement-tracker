/**
 * MongoDB Database Connection Configuration
 * 
 * This module establishes a connection to MongoDB and handles
 * connection events. The connection string is read from environment
 * variables to support different deployment environments.
 */

const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/procurement_tracker';
    
    const conn = await mongoose.connect(mongoURI, {
      // Mongoose 6+ no longer needs these options, but kept for clarity
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;

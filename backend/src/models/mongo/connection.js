const mongoose = require('mongoose');
const logger = require('../../utils/logger');

async function connectMongo() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/workspace_db');
  logger.info('✅ MongoDB connected');
}

module.exports = { connectMongo };
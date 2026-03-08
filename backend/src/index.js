require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initWebSocket } = require('./websocket');
const { connectPostgres } = require('./models/postgres/connection');
const { connectMongo } = require('./models/mongo/connection');
const { connectRedis } = require('./redis');
const { connectKafka } = require('./kafka');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Init WebSocket
initWebSocket(server);

async function startServer() {
  try {
    await connectPostgres();
    await connectMongo();
    await connectRedis();
    await connectKafka();

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

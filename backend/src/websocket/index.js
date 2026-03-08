const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { setUserOnline, setUserOffline } = require('../redis');
const logger = require('../utils/logger');

let io;

function initWebSocket(server) {
  io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true },
    pingTimeout: 60000,
  });

  // ── Auth Middleware ─────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userName = decoded.name;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    logger.debug(`Socket connected: ${socket.userId}`);
    await setUserOnline(socket.userId, socket.id);

    // Notify workspace about online status
    socket.broadcast.emit('user_online', { userId: socket.userId });

    // ── Join Room ───────────────────────────────────
    socket.on('join_workspace', (workspaceId) => {
      socket.join(`workspace:${workspaceId}`);
    });
    socket.on('join_project', (projectId) => {
      socket.join(`project:${projectId}`);
    });
    socket.on('join_channel', (channelId) => {
      socket.join(`channel:${channelId}`);
    });

    // ── Chat Events ─────────────────────────────────
    socket.on('send_message', (data) => {
      io.to(`channel:${data.channelId}`).emit('receive_message', {
        ...data,
        senderId: socket.userId,
        senderName: socket.userName,
        createdAt: new Date(),
      });
    });

    socket.on('typing', (data) => {
      socket.to(`channel:${data.channelId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.userName,
        channelId: data.channelId,
      });
    });

    socket.on('stop_typing', (data) => {
      socket.to(`channel:${data.channelId}`).emit('user_stop_typing', {
        userId: socket.userId,
        channelId: data.channelId,
      });
    });

    // ── Task Events ─────────────────────────────────
    socket.on('task_moved', (data) => {
      socket.to(`project:${data.projectId}`).emit('task_updated', data);
    });

    // ── Disconnect ───────────────────────────────────
    socket.on('disconnect', async () => {
      await setUserOffline(socket.userId);
      socket.broadcast.emit('user_offline', { userId: socket.userId });
      logger.debug(`Socket disconnected: ${socket.userId}`);
    });
  });

  logger.info('✅ WebSocket server initialized');
  return io;
}

function getIO() { return io; }

// Emit to a specific room from anywhere in the app
function emitToRoom(room, event, data) {
  if (io) io.to(room).emit(event, data);
}

module.exports = { initWebSocket, getIO, emitToRoom };

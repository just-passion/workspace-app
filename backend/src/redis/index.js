const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;

async function connectRedis() {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });
  redis.on('connect', () => logger.info('✅ Redis connected'));
  redis.on('error', (err) => logger.warn('Redis error:', err.message));
}

function getRedis() { return redis; }

// ── Session Helpers ───────────────────────────────────
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

async function setSession(userId, data) {
  await redis.setex(`session:${userId}`, SESSION_TTL, JSON.stringify(data));
}
async function getSession(userId) {
  const data = await redis.get(`session:${userId}`);
  return data ? JSON.parse(data) : null;
}
async function deleteSession(userId) {
  await redis.del(`session:${userId}`);
}

// ── Online Users ──────────────────────────────────────
async function setUserOnline(userId, socketId) {
  await redis.hset('online_users', userId, socketId);
}
async function setUserOffline(userId) {
  await redis.hdel('online_users', userId);
}
async function getOnlineUsers() {
  return await redis.hgetall('online_users') || {};
}

// ── Task Cache ────────────────────────────────────────
const CACHE_TTL = 60 * 5; // 5 minutes

async function cacheProjectTasks(projectId, tasks) {
  await redis.setex(`project_tasks:${projectId}`, CACHE_TTL, JSON.stringify(tasks));
}
async function getCachedProjectTasks(projectId) {
  const data = await redis.get(`project_tasks:${projectId}`);
  return data ? JSON.parse(data) : null;
}
async function invalidateProjectTasksCache(projectId) {
  await redis.del(`project_tasks:${projectId}`);
}

module.exports = {
  connectRedis, getRedis,
  setSession, getSession, deleteSession,
  setUserOnline, setUserOffline, getOnlineUsers,
  cacheProjectTasks, getCachedProjectTasks, invalidateProjectTasksCache,
};

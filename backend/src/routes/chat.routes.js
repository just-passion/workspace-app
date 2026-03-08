// ── chat.routes.js ────────────────────────────────────
const chatRouter = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { Channel, ChatMessage } = require('../models/mongo/index');

chatRouter.use(authenticate);

// GET /api/channels?workspaceId=xxx
chatRouter.get('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    const query = workspaceId ? { workspaceId } : {};
    const channels = await Channel.find(query).sort({ createdAt: 1 });
    res.json({ channels });
  } catch (err) { next(err); }
});

chatRouter.post('/', async (req, res, next) => {
  try {
    const { workspaceId, name, type, members } = req.body;
    // Avoid duplicate channel names in same workspace
    const existing = await Channel.findOne({ workspaceId, name });
    if (existing) return res.json({ channel: existing });
    const channel = await Channel.create({ workspaceId, name, type, members, createdBy: req.user.id });
    res.status(201).json({ channel });
  } catch (err) { next(err); }
});

chatRouter.get('/:channelId/messages', async (req, res, next) => {
  try {
    const { limit = 50, before } = req.query;
    const query = { channelId: req.params.channelId, deletedAt: null };
    if (before) query.createdAt = { $lt: new Date(before) };
    const messages = await ChatMessage.find(query).sort({ createdAt: -1 }).limit(Number(limit));
    res.json({ messages: messages.reverse() });
  } catch (err) { next(err); }
});

chatRouter.post('/:channelId/messages', async (req, res, next) => {
  try {
    const msg = await ChatMessage.create({
      channelId: req.params.channelId,
      senderId: req.user.id,
      message: req.body.message,
    });
    res.status(201).json({ message: msg });
  } catch (err) { next(err); }
});

module.exports = chatRouter;

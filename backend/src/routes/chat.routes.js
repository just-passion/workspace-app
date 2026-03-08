// ── chat.routes.js ────────────────────────────────────
const chatRouter = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { Channel, ChatMessage } = require('../models/mongo/index');
const { User, WorkspaceMember } = require('../models/postgres/index');

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

// POST /api/channels  — create with custom name/type
chatRouter.post('/', async (req, res, next) => {
  try {
    const { workspaceId, name, type = 'public', members = [] } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Channel name is required' });

    // Avoid duplicate channel names in same workspace (for non-direct channels)
    if (type !== 'direct') {
      const existing = await Channel.findOne({ workspaceId, name: name.trim(), type: { $ne: 'direct' } });
      if (existing) return res.json({ channel: existing });
    }

    // Always include the creator
    const memberSet = [...new Set([...members, req.user.id])];
    const channel = await Channel.create({ workspaceId, name: name.trim(), type, members: memberSet, createdBy: req.user.id });
    res.status(201).json({ channel });
  } catch (err) { next(err); }
});

// GET /api/channels/direct?workspaceId=xxx&userId=yyy  — get or create DM channel
chatRouter.get('/direct', async (req, res, next) => {
  try {
    const { workspaceId, userId } = req.query;
    const me = req.user.id;
    // Find existing DM between the two users
    let channel = await Channel.findOne({
      workspaceId, type: 'direct',
      members: { $all: [me, userId], $size: 2 },
    });
    if (!channel) {
      channel = await Channel.create({
        workspaceId, name: `dm-${[me, userId].sort().join('-')}`,
        type: 'direct', members: [me, userId], createdBy: me,
      });
    }
    res.json({ channel });
  } catch (err) { next(err); }
});

// GET /api/channels/workspace-members?workspaceId=xxx  — list members for DMs sidebar
chatRouter.get('/workspace-members', async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    const members = await WorkspaceMember.findAll({
      where: { workspaceId },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'avatar'] }],
    });
    res.json({ members: members.map(m => m.user).filter(Boolean) });
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
      senderName: req.user.name,
      message: req.body.message,
      mentions: req.body.mentions || [],
    });
    res.status(201).json({ message: msg });
  } catch (err) { next(err); }
});

// GET /api/channels/:channelId/members
chatRouter.get('/:channelId/members', async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    // Fetch user details for each member
    const members = await User.findAll({
      where: { id: channel.members },
      attributes: ['id', 'name', 'email', 'avatar'],
    });
    res.json({ members, channel });
  } catch (err) { next(err); }
});

// POST /api/channels/:channelId/members  — add member by email or userId
chatRouter.post('/:channelId/members', async (req, res, next) => {
  try {
    const { userId, email } = req.body;
    let resolvedUserId = userId;

    if (!resolvedUserId && email) {
      const found = await User.findOne({ where: { email } });
      if (!found) return res.status(404).json({ error: 'No user found with that email address' });
      resolvedUserId = found.id;
    }
    if (!resolvedUserId) return res.status(400).json({ error: 'userId or email is required' });

    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    if (channel.members.includes(resolvedUserId)) {
      return res.status(409).json({ error: 'User is already a member' });
    }

    channel.members.push(resolvedUserId);
    await channel.save();
    res.json({ channel });
  } catch (err) { next(err); }
});

// DELETE /api/channels/:channelId/members/:userId  — remove member
chatRouter.delete('/:channelId/members/:userId', async (req, res, next) => {
  try {
    const channel = await Channel.findById(req.params.channelId);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    channel.members = channel.members.filter(m => m !== req.params.userId);
    await channel.save();
    res.json({ channel });
  } catch (err) { next(err); }
});

module.exports = chatRouter;


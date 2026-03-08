const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Workspace, WorkspaceMember } = require('../models/postgres/index');

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// Get the first workspace for a user
async function getUserWorkspace(userId) {
  const member = await WorkspaceMember.findOne({
    where: { userId },
    include: [{ model: Workspace, as: 'workspace' }],
  });
  return member?.workspace || null;
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed });

    // Auto-create a default workspace for new user
    const workspace = await Workspace.create({
      name: `${name}'s Workspace`,
      description: 'My workspace',
      ownerId: user.id,
    });
    await WorkspaceMember.create({ workspaceId: workspace.id, userId: user.id, role: 'owner' });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
      workspaceId: workspace.id,
    });
  } catch (err) { next(err); }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Fetch their workspace
    const workspace = await getUserWorkspace(user.id);

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
      workspaceId: workspace?.id || null,
    });
  } catch (err) { next(err); }
}

// GET /api/auth/me
async function getMe(req, res, next) {
  try {
    const workspace = await getUserWorkspace(req.user.id);
    res.json({ user: req.user, workspaceId: workspace?.id || null });
  } catch (err) { next(err); }
}

module.exports = { register, login, getMe };

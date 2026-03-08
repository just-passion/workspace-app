const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { Workspace, WorkspaceMember, Project, ActivityLog, User } = require('../models/postgres/index');
const { Task: MongoTask } = require('../models/mongo/index');

router.use(authenticate);

// POST /api/workspaces
router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Workspace name is required' });

    const workspace = await Workspace.create({ name: name.trim(), description, ownerId: req.user.id });
    await WorkspaceMember.create({ workspaceId: workspace.id, userId: req.user.id, role: 'owner' });
    res.status(201).json({ workspace });
  } catch (err) { next(err); }
});

// GET /api/workspaces/:id
router.get('/:id', async (req, res, next) => {
  try {
    const workspace = await Workspace.findByPk(req.params.id, {
      include: [{ model: WorkspaceMember, as: 'members' }],
    });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    res.json({ workspace });
  } catch (err) { next(err); }
});

// GET /api/workspaces/:id/projects
router.get('/:id/projects', async (req, res, next) => {
  try {
    const projects = await Project.findAll({ where: { workspaceId: req.params.id } });
    res.json({ projects });
  } catch (err) { next(err); }
});

// GET /api/workspaces/:id/members
router.get('/:id/members', async (req, res, next) => {
  try {
    const members = await WorkspaceMember.findAll({
      where: { workspaceId: req.params.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'avatar'] }],
    });
    res.json({ members });
  } catch (err) { next(err); }
});

// GET /api/workspaces/:id/stats
router.get('/:id/stats', async (req, res, next) => {
  try {
    const projects = await Project.findAll({ where: { workspaceId: req.params.id } });
    const projectIds = projects.map(p => p.id);
    const memberCount = await WorkspaceMember.count({ where: { workspaceId: req.params.id } });

    let totalTasks = 0, inProgress = 0, completed = 0;
    if (projectIds.length > 0) {
      totalTasks = await MongoTask.countDocuments({ projectId: { $in: projectIds } });
      inProgress = await MongoTask.countDocuments({ projectId: { $in: projectIds }, status: 'in_progress' });
      completed  = await MongoTask.countDocuments({ projectId: { $in: projectIds }, status: 'done' });
    }
    res.json({ totalTasks, inProgress, completed, memberCount });
  } catch (err) { next(err); }
});

// GET /api/workspaces/:id/activity
router.get('/:id/activity', async (req, res, next) => {
  try {
    const activity = await ActivityLog.findAll({
      where: { workspaceId: req.params.id },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ activity });
  } catch (err) { next(err); }
});

// POST /api/workspaces/:id/invite
router.post('/:id/invite', async (req, res, next) => {
  try {
    const { userId, role = 'member' } = req.body;
    const existing = await WorkspaceMember.findOne({ where: { workspaceId: req.params.id, userId } });
    if (existing) return res.status(409).json({ error: 'User is already a member' });
    const member = await WorkspaceMember.create({ workspaceId: req.params.id, userId, role });
    res.status(201).json({ member });
  } catch (err) { next(err); }
});

module.exports = router;

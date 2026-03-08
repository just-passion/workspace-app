const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { Workspace, WorkspaceMember, Project, ActivityLog } = require('../models/postgres/index');

router.use(authenticate);

// POST /api/workspaces
router.post('/', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const workspace = await Workspace.create({ name, description, ownerId: req.user.id });
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
    const member = await WorkspaceMember.create({ workspaceId: req.params.id, userId, role });
    res.status(201).json({ member });
  } catch (err) { next(err); }
});

module.exports = router;

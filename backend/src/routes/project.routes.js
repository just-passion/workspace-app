// ── project.routes.js ─────────────────────────────────
const projectRouter = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { Project, ProjectMember } = require('../models/postgres/index');
const { getProjectTasks } = require('../controllers/task.controller');

projectRouter.use(authenticate);

projectRouter.get('/', async (req, res, next) => {
  try {
    const projects = await Project.findAll({ include: [{ model: ProjectMember, as: 'members' }] });
    res.json({ projects });
  } catch (err) { next(err); }
});

projectRouter.post('/', async (req, res, next) => {
  try {
    const { workspaceId, name, description } = req.body;
    const project = await Project.create({ workspaceId, name, description, createdBy: req.user.id });
    await ProjectMember.create({ projectId: project.id, userId: req.user.id, role: 'owner' });
    res.status(201).json({ project });
  } catch (err) { next(err); }
});

projectRouter.get('/:id', async (req, res, next) => {
  try {
    const project = await Project.findByPk(req.params.id, { include: [{ model: ProjectMember, as: 'members' }] });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (err) { next(err); }
});

projectRouter.get('/:projectId/tasks', getProjectTasks);

module.exports = projectRouter;

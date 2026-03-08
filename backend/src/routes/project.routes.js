const projectRouter = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { Project, ProjectMember, User } = require('../models/postgres/index');
const { getProjectTasks } = require('../controllers/task.controller');
const { Task: MongoTask } = require('../models/mongo/index');

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
    const project = await Project.findByPk(req.params.id, {
      include: [{ model: ProjectMember, as: 'members', include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }] }],
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (err) { next(err); }
});

// PUT /api/projects/:id — update project
projectRouter.put('/:id', async (req, res, next) => {
  try {
    const { name, description, status } = req.body;
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    await project.update({ name, description, status });
    res.json({ project });
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id
projectRouter.delete('/:id', async (req, res, next) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    await project.destroy();
    res.json({ message: 'Project deleted' });
  } catch (err) { next(err); }
});

// GET /api/projects/:id/members
projectRouter.get('/:id/members', async (req, res, next) => {
  try {
    const members = await ProjectMember.findAll({
      where: { projectId: req.params.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    });
    res.json({ members });
  } catch (err) { next(err); }
});

// POST /api/projects/:id/members — invite user to project
projectRouter.post('/:id/members', async (req, res, next) => {
  try {
    const { userId, role = 'member' } = req.body;
    const existing = await ProjectMember.findOne({ where: { projectId: req.params.id, userId } });
    if (existing) return res.status(409).json({ error: 'User already a member' });
    const member = await ProjectMember.create({ projectId: req.params.id, userId, role });
    res.status(201).json({ member });
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id/members/:userId
projectRouter.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    await ProjectMember.destroy({ where: { projectId: req.params.id, userId: req.params.userId } });
    res.json({ message: 'Member removed' });
  } catch (err) { next(err); }
});

// GET /api/projects/:id/stats — task progress breakdown
projectRouter.get('/:id/stats', async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const total     = await MongoTask.countDocuments({ projectId });
    const done      = await MongoTask.countDocuments({ projectId, status: 'done' });
    const inProg    = await MongoTask.countDocuments({ projectId, status: 'in_progress' });
    const remaining = total - done - inProg;
    const progress  = total > 0 ? Math.round((done / total) * 100) : 0;
    res.json({ total, done, inProgress: inProg, remaining, progress });
  } catch (err) { next(err); }
});

projectRouter.get('/:projectId/tasks', getProjectTasks);

module.exports = projectRouter;

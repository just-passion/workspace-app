const projectRouter = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { Project, ProjectMember, User, WorkspaceMember, Workspace, ActivityLog } = require('../models/postgres/index');
const { getProjectTasks } = require('../controllers/task.controller');
const { Task: MongoTask } = require('../models/mongo/index');

projectRouter.use(authenticate);

// Helper: resolve workspaceId for a user — tries membership first, then ownership
async function resolveWorkspaceId(userId) {
  const membership = await WorkspaceMember.findOne({ where: { userId } });
  if (membership) return membership.workspaceId;
  const owned = await Workspace.findOne({ where: { ownerId: userId } });
  if (owned) return owned.id;
  return null;
}

projectRouter.get('/', async (req, res, next) => {
  try {
    const { workspaceId } = req.query;
    let projects;
    if (workspaceId) {
      projects = await Project.findAll({
        where: { workspaceId },
        include: [{ model: ProjectMember, as: 'members' }],
      });
    } else {
      const memberships = await ProjectMember.findAll({ where: { userId: req.user.id } });
      const projectIds = memberships.map(m => m.projectId);
      projects = await Project.findAll({
        where: { id: projectIds },
        include: [{ model: ProjectMember, as: 'members' }],
      });
    }
    res.json({ projects });
  } catch (err) { next(err); }
});

projectRouter.post('/', async (req, res, next) => {
  try {
    let { workspaceId, name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    // Auto-resolve workspaceId if not provided or null
    if (!workspaceId) {
      workspaceId = await resolveWorkspaceId(req.user.id);
      if (!workspaceId) {
        return res.status(400).json({ error: 'No workspace found. Please create a workspace first.' });
      }
    }

    const project = await Project.create({ workspaceId, name: name.trim(), description, createdBy: req.user.id });
    await ProjectMember.create({ projectId: project.id, userId: req.user.id, role: 'owner' });

    // Log activity
    try {
      await ActivityLog.create({
        workspaceId, userId: req.user.id, eventType: 'project_created',
        metadata: { projectId: project.id, title: project.name, workspaceId },
      });
    } catch (_) {}

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

projectRouter.put('/:id', async (req, res, next) => {
  try {
    const { name, description, status } = req.body;
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    await project.update({ name, description, status });
    res.json({ project });
  } catch (err) { next(err); }
});

projectRouter.delete('/:id', async (req, res, next) => {
  try {
    const project = await Project.findByPk(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    await project.destroy();
    res.json({ message: 'Project deleted' });
  } catch (err) { next(err); }
});

projectRouter.get('/:id/members', async (req, res, next) => {
  try {
    const members = await ProjectMember.findAll({
      where: { projectId: req.params.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    });
    res.json({ members });
  } catch (err) { next(err); }
});

projectRouter.post('/:id/members', async (req, res, next) => {
  try {
    const { userId, email, role = 'member' } = req.body;
    let resolvedUserId = userId;

    // Support email-based invite
    if (!resolvedUserId && email) {
      const found = await User.findOne({ where: { email } });
      if (!found) return res.status(404).json({ error: 'No user found with that email address' });
      resolvedUserId = found.id;
    }

    if (!resolvedUserId) return res.status(400).json({ error: 'userId or email is required' });

    const existing = await ProjectMember.findOne({ where: { projectId: req.params.id, userId: resolvedUserId } });
    if (existing) return res.status(409).json({ error: 'User already a member' });
    const member = await ProjectMember.create({ projectId: req.params.id, userId: resolvedUserId, role });

    // Also add to workspace if not already there
    const project = await Project.findByPk(req.params.id);
    if (project) {
      const wsMember = await WorkspaceMember.findOne({ where: { workspaceId: project.workspaceId, userId: resolvedUserId } });
      if (!wsMember) await WorkspaceMember.create({ workspaceId: project.workspaceId, userId: resolvedUserId, role: 'member' });

      // Log activity
      try {
        await ActivityLog.create({
          workspaceId: project.workspaceId, userId: resolvedUserId, eventType: 'member_joined',
          metadata: { projectId: project.id, title: project.name, workspaceId: project.workspaceId },
        });
      } catch (_) {}
    }

    res.status(201).json({ member });
  } catch (err) { next(err); }
});

projectRouter.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    await ProjectMember.destroy({ where: { projectId: req.params.id, userId: req.params.userId } });
    res.json({ message: 'Member removed' });
  } catch (err) { next(err); }
});

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

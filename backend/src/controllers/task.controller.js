const { Task, TaskComment } = require('../models/mongo/index');
const { publishEvent, TOPICS } = require('../kafka');
const { invalidateProjectTasksCache, getCachedProjectTasks, cacheProjectTasks } = require('../redis');
const { emitToRoom } = require('../websocket');

// GET /api/projects/:projectId/tasks
async function getProjectTasks(req, res, next) {
  try {
    const { projectId } = req.params;

    // Try cache first
    const cached = await getCachedProjectTasks(projectId);
    if (cached) return res.json({ tasks: cached, fromCache: true });

    const tasks = await Task.find({ projectId }).sort({ status: 1, order: 1 });
    await cacheProjectTasks(projectId, tasks);
    res.json({ tasks });
  } catch (err) { next(err); }
}

// POST /api/tasks
async function createTask(req, res, next) {
  try {
    const { projectId, title, description, status, priority, assigneeId, dueDate, workspaceId } = req.body;
    const task = await Task.create({
      projectId, title, description, status, priority, assigneeId, dueDate,
      createdBy: req.user.id,
    });

    await invalidateProjectTasksCache(projectId);

    // Emit WS event to project room
    emitToRoom(`project:${projectId}`, 'task_created', task);

    // Publish to Kafka
    await publishEvent(TOPICS.TASK_EVENTS, 'task_created', {
      taskId: task._id, projectId, workspaceId, userId: req.user.id, title,
    });

    // If assigned to someone else, send notification
    if (assigneeId && assigneeId !== req.user.id) {
      await publishEvent(TOPICS.NOTIFICATION_EVENTS, 'task_assigned', {
        targetUserId: assigneeId,
        message: `${req.user.name} assigned you a task: ${title}`,
        taskId: task._id,
      });
    }

    res.status(201).json({ task });
  } catch (err) { next(err); }
}

// PUT /api/tasks/:taskId
async function updateTask(req, res, next) {
  try {
    const { taskId } = req.params;
    const task = await Task.findByIdAndUpdate(taskId, req.body, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await invalidateProjectTasksCache(task.projectId);
    emitToRoom(`project:${task.projectId}`, 'task_updated', task);

    await publishEvent(TOPICS.TASK_EVENTS, 'task_updated', {
      taskId, projectId: task.projectId, userId: req.user.id, changes: req.body,
    });

    res.json({ task });
  } catch (err) { next(err); }
}

// PATCH /api/tasks/:taskId/status
async function moveTask(req, res, next) {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    const task = await Task.findByIdAndUpdate(taskId, { status }, { new: true });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await invalidateProjectTasksCache(task.projectId);
    emitToRoom(`project:${task.projectId}`, 'task_moved', { taskId, status });

    await publishEvent(TOPICS.TASK_EVENTS, 'task_status_changed', {
      taskId, projectId: task.projectId, userId: req.user.id, status,
    });

    res.json({ task });
  } catch (err) { next(err); }
}

// DELETE /api/tasks/:taskId
async function deleteTask(req, res, next) {
  try {
    const { taskId } = req.params;
    const task = await Task.findByIdAndDelete(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    await invalidateProjectTasksCache(task.projectId);
    emitToRoom(`project:${task.projectId}`, 'task_deleted', { taskId });

    res.json({ message: 'Task deleted' });
  } catch (err) { next(err); }
}

// GET /api/tasks/:taskId
async function getTask(req, res, next) {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  } catch (err) { next(err); }
}

// POST /api/tasks/:taskId/comments
async function addComment(req, res, next) {
  try {
    const { taskId } = req.params;
    const comment = await TaskComment.create({
      taskId, userId: req.user.id, comment: req.body.comment,
    });

    await publishEvent(TOPICS.NOTIFICATION_EVENTS, 'comment_added', {
      taskId, comment: req.body.comment, userId: req.user.id, userName: req.user.name,
    });

    res.status(201).json({ comment });
  } catch (err) { next(err); }
}

// GET /api/tasks/:taskId/comments
async function getComments(req, res, next) {
  try {
    const comments = await TaskComment.find({ taskId: req.params.taskId }).sort({ createdAt: 1 });
    res.json({ comments });
  } catch (err) { next(err); }
}

module.exports = { getProjectTasks, createTask, updateTask, moveTask, deleteTask, getTask, addComment, getComments };

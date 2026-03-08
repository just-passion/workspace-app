const { Task, TaskComment } = require('../models/mongo/index');
const { ActivityLog, Notification, Project } = require('../models/postgres/index');
const { publishEvent, TOPICS } = require('../kafka');
const { invalidateProjectTasksCache, getCachedProjectTasks, cacheProjectTasks } = require('../redis');
const { emitToRoom } = require('../websocket');

// Resolve workspaceId for a given projectId
async function resolveWorkspaceId(projectId) {
  try {
    const project = await Project.findByPk(projectId);
    return project?.workspaceId || null;
  } catch { return null; }
}

// Write activity log directly to DB; Kafka is best-effort side effect
async function logActivity(workspaceId, userId, eventType, metadata) {
  try {
    if (!workspaceId || !userId) return;
    await ActivityLog.create({ workspaceId, userId, eventType, metadata });
  } catch (err) {
    console.warn('[ActivityLog] write failed:', err.message);
  }
  publishEvent(TOPICS.TASK_EVENTS, eventType, { workspaceId, userId, ...metadata }).catch(() => {});
}

// Write notification directly to DB; Kafka is best-effort side effect
async function createNotification(userId, type, message, metadata = {}) {
  try {
    if (!userId) return;
    await Notification.create({ userId, type, message, metadata });
  } catch (err) {
    console.warn('[Notification] write failed:', err.message);
  }
  publishEvent(TOPICS.NOTIFICATION_EVENTS, type, { targetUserId: userId, message, ...metadata }).catch(() => {});
}

// GET /api/projects/:projectId/tasks
async function getProjectTasks(req, res, next) {
  try {
    const { projectId } = req.params;
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
    const { projectId, title, description, status, priority, assigneeId, dueDate } = req.body;
    const task = await Task.create({
      projectId, title, description, status, priority, assigneeId, dueDate,
      createdBy: req.user.id,
    });

    await invalidateProjectTasksCache(projectId);
    emitToRoom(`project:${projectId}`, 'task_created', task);

    const workspaceId = await resolveWorkspaceId(projectId);
    await logActivity(workspaceId, req.user.id, 'task_created', {
      taskId: String(task._id), projectId, title, workspaceId,
    });

    if (assigneeId && assigneeId !== req.user.id) {
      await createNotification(assigneeId, 'task_assigned',
        `${req.user.name} assigned you a task: ${title}`,
        { taskId: String(task._id), projectId }
      );
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

    const workspaceId = await resolveWorkspaceId(task.projectId);
    await logActivity(workspaceId, req.user.id, 'task_updated', {
      taskId, projectId: task.projectId, title: task.title, workspaceId,
    });

    if (req.body.assigneeId && req.body.assigneeId !== req.user.id) {
      await createNotification(req.body.assigneeId, 'task_assigned',
        `${req.user.name} assigned you a task: ${task.title}`,
        { taskId, projectId: task.projectId }
      );
    }

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

    const workspaceId = await resolveWorkspaceId(task.projectId);
    await logActivity(workspaceId, req.user.id, 'task_status_changed', {
      taskId, projectId: task.projectId, title: task.title, status, workspaceId,
    });

    if (status === 'done' && task.assigneeId && task.assigneeId !== req.user.id) {
      await createNotification(task.assigneeId, 'task_moved',
        `${req.user.name} marked "${task.title}" as done`,
        { taskId, projectId: task.projectId }
      );
    }

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

    const workspaceId = await resolveWorkspaceId(task.projectId);
    await logActivity(workspaceId, req.user.id, 'task_deleted', {
      taskId, projectId: task.projectId, title: task.title, workspaceId,
    });

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
    const { comment, mentions = [] } = req.body;

    const taskDoc = await Task.findById(taskId);
    const taskComment = await TaskComment.create({ taskId, userId: req.user.id, comment });

    // Notify mentioned users
    for (const mentionedUserId of mentions) {
      if (mentionedUserId !== req.user.id) {
        await createNotification(mentionedUserId, 'mention',
          `${req.user.name} mentioned you: "${comment.slice(0, 80)}"`,
          { taskId, commentId: String(taskComment._id) }
        );
      }
    }

    // Notify task assignee (if different from commenter and not already mentioned)
    if (taskDoc?.assigneeId && taskDoc.assigneeId !== req.user.id && !mentions.includes(taskDoc.assigneeId)) {
      await createNotification(taskDoc.assigneeId, 'comment',
        `${req.user.name} commented on "${taskDoc.title}"`,
        { taskId, commentId: String(taskComment._id) }
      );
    }

    const workspaceId = await resolveWorkspaceId(taskDoc?.projectId);
    await logActivity(workspaceId, req.user.id, 'comment_added', {
      taskId, title: taskDoc?.title, projectId: taskDoc?.projectId, workspaceId,
    });

    res.status(201).json({ comment: taskComment });
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

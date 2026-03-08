const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  getProjectTasks, createTask, updateTask, moveTask,
  deleteTask, getTask, addComment, getComments
} = require('../controllers/task.controller');

router.use(authenticate);

router.post('/', createTask);
router.get('/:taskId', getTask);
router.put('/:taskId', updateTask);
router.patch('/:taskId/status', moveTask);
router.delete('/:taskId', deleteTask);
router.post('/:taskId/comments', addComment);
router.get('/:taskId/comments', getComments);

// Mounted also at /projects/:projectId/tasks in project routes
module.exports = router;

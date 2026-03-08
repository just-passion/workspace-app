const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getProjectTasks, createTask, updateTask, moveTask,
  deleteTask, getTask, addComment, getComments
} = require('../controllers/task.controller');

router.use(authenticate);

// File upload setup (store locally; swap for S3 in production)
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

router.post('/', createTask);
router.get('/:taskId', getTask);
router.put('/:taskId', updateTask);
router.patch('/:taskId/status', moveTask);
router.delete('/:taskId', deleteTask);
router.post('/:taskId/comments', addComment);
router.get('/:taskId/comments', getComments);

// POST /api/tasks/:taskId/attachments
router.post('/:taskId/attachments', upload.single('file'), async (req, res, next) => {
  try {
    const { taskId } = req.params;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { Task } = require('../models/mongo/index');
    const fileUrl = `/uploads/${req.file.filename}`;
    const task = await Task.findByIdAndUpdate(
      taskId,
      { $push: { attachments: { name: req.file.originalname, url: fileUrl, uploadedAt: new Date() } } },
      { new: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task, attachment: { name: req.file.originalname, url: fileUrl } });
  } catch (err) { next(err); }
});

// Mounted also at /projects/:projectId/tasks in project routes
module.exports = router;


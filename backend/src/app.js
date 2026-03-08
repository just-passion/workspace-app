const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// ── Load models FIRST so all Sequelize associations are registered ──
require('./models/postgres/index');
require('./models/mongo/index');

const authRoutes = require('./routes/auth.routes');
const workspaceRoutes = require('./routes/workspace.routes');
const projectRoutes = require('./routes/project.routes');
const taskRoutes = require('./routes/task.routes');
const chatRoutes = require('./routes/chat.routes');
const notificationRoutes = require('./routes/notification.routes');
const activityRoutes = require('./routes/activity.routes');
const userRoutes = require('./routes/user.routes');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// ── Security ──────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Rate Limiting ─────────────────────────────────────
// Generous limit: 1000 requests per 15 minutes per IP
// Skip common polling endpoints to avoid spurious 429s
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => {
    // Don't rate-limit frequent polling endpoints
    const pollingPaths = [
      '/api/workspaces/', '/api/activity/', '/api/notifications',
      '/api/channels', '/api/projects',
    ];
    return pollingPaths.some(p => req.path.startsWith(p));
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ── Body Parsing ──────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ── Routes ─────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/channels', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/users', userRoutes);

// ── Static file serving for uploads ───────────────────
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Health Check ───────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// ── Error Handler ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;

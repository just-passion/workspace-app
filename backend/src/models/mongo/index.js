const mongoose = require('mongoose');

// ── Task ──────────────────────────────────────────────
const taskSchema = new mongoose.Schema({
  projectId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['backlog', 'todo', 'in_progress', 'done'], default: 'backlog', index: true },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  assigneeId: { type: String, default: null },
  dueDate: { type: Date, default: null },
  createdBy: { type: String, required: true },
  attachments: [{ name: String, url: String, uploadedAt: Date }],
  order: { type: Number, default: 0 },
}, { timestamps: true });

taskSchema.index({ projectId: 1, status: 1 });

// ── Task Comment ──────────────────────────────────────
const taskCommentSchema = new mongoose.Schema({
  taskId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  comment: { type: String, required: true },
}, { timestamps: true });

// ── Channel ───────────────────────────────────────────
const channelSchema = new mongoose.Schema({
  workspaceId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['public', 'private', 'direct'], default: 'public' },
  members: [{ type: String }],
  createdBy: { type: String, required: true },
}, { timestamps: true });

// ── Chat Message ──────────────────────────────────────
const chatMessageSchema = new mongoose.Schema({
  channelId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: { type: String, default: '' },
  message: { type: String, required: true },
  mentions: [{ type: String }],
  attachments: [{ name: String, url: String }],
  editedAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null },
}, { timestamps: true });

chatMessageSchema.index({ channelId: 1, createdAt: -1 });

const Task = mongoose.model('Task', taskSchema);
const TaskComment = mongoose.model('TaskComment', taskCommentSchema);
const Channel = mongoose.model('Channel', channelSchema);
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = { Task, TaskComment, Channel, ChatMessage };

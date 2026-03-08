const { DataTypes } = require('sequelize');
const { sequelize } = require('./connection');

// ── User ──────────────────────────────────────────────
const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  avatar: { type: DataTypes.STRING, allowNull: true },
}, { tableName: 'users', timestamps: true, underscored: true });

// ── Workspace ─────────────────────────────────────────
const Workspace = sequelize.define('Workspace', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  ownerId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
}, { tableName: 'workspaces', timestamps: true, underscored: true });

// ── WorkspaceMember ───────────────────────────────────
const WorkspaceMember = sequelize.define('WorkspaceMember', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  workspaceId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  role: { type: DataTypes.ENUM('owner', 'admin', 'member'), defaultValue: 'member' },
  joinedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'workspace_members', timestamps: false, underscored: true });

// ── Project ───────────────────────────────────────────
const Project = sequelize.define('Project', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  workspaceId: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(100), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('active', 'archived', 'completed'), defaultValue: 'active' },
  createdBy: { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'projects', timestamps: true, underscored: true });

// ── ProjectMember ─────────────────────────────────────
const ProjectMember = sequelize.define('ProjectMember', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  projectId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  role: { type: DataTypes.ENUM('owner', 'admin', 'member'), defaultValue: 'member' },
}, { tableName: 'project_members', timestamps: false, underscored: true });

// ── Notification ──────────────────────────────────────
const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.ENUM('mention', 'task_assigned', 'comment', 'workspace_invite', 'task_moved'), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  metadata: { type: DataTypes.JSONB, defaultValue: {} },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'notifications', timestamps: true, underscored: true });

// ── ActivityLog ───────────────────────────────────────
const ActivityLog = sequelize.define('ActivityLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  workspaceId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  eventType: { type: DataTypes.STRING(50), allowNull: false },
  metadata: { type: DataTypes.JSONB, defaultValue: {} },
}, { tableName: 'activity_logs', timestamps: true, updatedAt: false, underscored: true });

// ── Associations ──────────────────────────────────────
Workspace.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });
Workspace.hasMany(WorkspaceMember, { foreignKey: 'workspaceId', as: 'members' });
WorkspaceMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
WorkspaceMember.belongsTo(Workspace, { foreignKey: 'workspaceId', as: 'workspace' });
Project.belongsTo(Workspace, { foreignKey: 'workspaceId' });
Project.hasMany(ProjectMember, { foreignKey: 'projectId', as: 'members' });
ProjectMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ActivityLog.belongsTo(User, { foreignKey: 'userId', as: 'actor' });

module.exports = { User, Workspace, WorkspaceMember, Project, ProjectMember, Notification, ActivityLog };

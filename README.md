# ⚡ Collaborative Workspace App

Full-stack real-time team workspace (Jira + Slack + Notion style).

## 🏗 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + Zustand + React Query + dnd-kit |
| Backend | Node.js + Express |
| Relational DB | PostgreSQL + Sequelize |
| Document DB | MongoDB + Mongoose |
| Cache | Redis |
| Messaging | Kafka |
| Real-time | Socket.IO (WebSockets) |

---

## 🚀 Getting Started

### Step 1 — Install Node.js (if not installed)
Download from https://nodejs.org (v18 or higher recommended)

### Step 2 — Install Docker
Download from https://docker.com/get-started
(Used to run PostgreSQL, MongoDB, Redis, Kafka)

### Step 3 — Start all infrastructure services
```bash
cd docker
docker-compose up -d
```
This starts: PostgreSQL (5432), MongoDB (27017), Redis (6379), Kafka (9092)

### Step 4 — Set up backend environment
```bash
cd backend
cp .env.example .env
# Edit .env if needed (defaults work with docker-compose)
```

### Step 5 — Install all dependencies
```bash
# From root
npm install
cd frontend && npm install
cd ../backend && npm install
```

### Step 6 — Run the app (both frontend + backend)
```bash
# From root
npm run dev
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Health check: http://localhost:5000/health

---

## 📁 Project Structure

```
workspace-app/
├── frontend/               # React app (Vite)
│   └── src/
│       ├── pages/          # Route-level components
│       ├── components/     # Shared UI components
│       ├── store/          # Zustand state stores
│       ├── services/       # Axios API client
│       └── hooks/          # Custom hooks (useSocket, etc)
│
├── backend/                # Node.js + Express API
│   └── src/
│       ├── controllers/    # Request handlers
│       ├── routes/         # Express routers
│       ├── models/
│       │   ├── postgres/   # Sequelize models
│       │   └── mongo/      # Mongoose models
│       ├── kafka/          # Kafka producer + consumer
│       ├── redis/          # Redis helpers
│       ├── websocket/      # Socket.IO server
│       ├── middleware/      # Auth, error handling
│       └── utils/          # Logger etc.
│
└── docker/
    └── docker-compose.yml  # All infrastructure services
```

---

## 🔌 API Reference

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
```

### Workspaces
```
POST   /api/workspaces
GET    /api/workspaces/:id
GET    /api/workspaces/:id/projects
GET    /api/workspaces/:id/activity
POST   /api/workspaces/:id/invite
```

### Projects
```
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
GET    /api/projects/:id/tasks
```

### Tasks
```
POST   /api/tasks
GET    /api/tasks/:taskId
PUT    /api/tasks/:taskId
PATCH  /api/tasks/:taskId/status
DELETE /api/tasks/:taskId
POST   /api/tasks/:taskId/comments
GET    /api/tasks/:taskId/comments
```

### Chat
```
POST   /api/channels
GET    /api/channels/:channelId/messages
POST   /api/channels/:channelId/messages
```

### Notifications
```
GET    /api/notifications
PATCH  /api/notifications/:id/read
PATCH  /api/notifications/read-all
```

### Activity
```
GET    /api/activity/:workspaceId
```

---

## ⚡ WebSocket Events

### Client → Server
| Event | Payload |
|---|---|
| `join_workspace` | workspaceId |
| `join_project` | projectId |
| `join_channel` | channelId |
| `send_message` | { channelId, message } |
| `typing` | { channelId } |
| `stop_typing` | { channelId } |
| `task_moved` | { projectId, taskId, status } |

### Server → Client
| Event | Description |
|---|---|
| `receive_message` | New chat message |
| `user_typing` | Someone is typing |
| `user_stop_typing` | Stopped typing |
| `task_created` | New task in project |
| `task_updated` | Task was edited |
| `task_moved` | Task changed columns |
| `user_online` | User came online |
| `user_offline` | User went offline |

---

## 🗃 Kafka Topics

| Topic | Events |
|---|---|
| `task-events` | task_created, task_updated, task_status_changed, task_deleted |
| `chat-events` | message_sent, message_deleted |
| `notification-events` | user_mentioned, task_assigned, comment_added |
| `activity-events` | workspace_joined, project_created, task_updated |

---

## 🛣 What to Build Next

1. **File uploads** — Add S3/Cloudflare R2 for task attachments
2. **Search** — ElasticSearch for full-text task/message search
3. **Email notifications** — Nodemailer + queue for digests
4. **Workspace settings** — Roles & permissions management UI
5. **Mobile responsive** — Tailwind breakpoints on all pages
6. **Dark/Light mode** — CSS variable toggle
7. **Task analytics** — Charts with Recharts

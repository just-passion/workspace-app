import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CreateWorkspacePage from './pages/CreateWorkspacePage';
import WorkspacePage from './pages/WorkspacePage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';
import ChatPage from './pages/ChatPage';
import NotificationsPage from './pages/NotificationsPage';
import ActivityPage from './pages/ActivityPage';
import AppLayout from './components/layout/AppLayout';

// Must be logged in
function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

// Must be logged in AND have a workspace set up
function WorkspaceRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  const workspaceId = useAuthStore((s) => s.workspaceId);
  if (!token) return <Navigate to="/login" replace />;
  if (!workspaceId) return <Navigate to="/create-workspace" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Needs auth but no workspace yet */}
        <Route path="/create-workspace" element={<PrivateRoute><CreateWorkspacePage /></PrivateRoute>} />

        {/* Needs auth + workspace */}
        <Route path="/" element={<WorkspaceRoute><AppLayout /></WorkspaceRoute>}>
          <Route index element={<Navigate to="/workspace" replace />} />
          <Route path="workspace"     element={<WorkspacePage />} />
          <Route path="projects"      element={<ProjectsPage />} />
          <Route path="project/:id"   element={<ProjectDetailPage />} />
          <Route path="task/:id"      element={<TaskDetailPage />} />
          <Route path="chat"          element={<ChatPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="activity"      element={<ActivityPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

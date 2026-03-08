import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WorkspacePage from './pages/WorkspacePage';
import CreateWorkspacePage from './pages/CreateWorkspacePage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';
import ChatPage from './pages/ChatPage';
import NotificationsPage from './pages/NotificationsPage';
import ActivityPage from './pages/ActivityPage';
import AppLayout from './components/layout/AppLayout';

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/create-workspace" element={<PrivateRoute><CreateWorkspacePage /></PrivateRoute>} />
        <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
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

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, MessageSquare, Bell, LogOut, Activity } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSocket } from '../../hooks/useSocket';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

const NAV = [
  { to: '/workspace',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',       icon: FolderKanban,    label: 'Projects' },
  { to: '/chat',           icon: MessageSquare,   label: 'Chat' },
  { to: '/notifications',  icon: Bell,            label: 'Notifications' },
  { to: '/activity',       icon: Activity,        label: 'Activity' },
];

export default function AppLayout() {
  useSocket();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const { data: notifData } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30000,
  });
  const unreadCount = notifData?.notifications?.filter(n => !n.isRead).length || 0;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">⚡</div>

        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} title={label}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={18} />
            {label === 'Notifications' && unreadCount > 0 && (
              <span className="nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </NavLink>
        ))}

        {/* Bottom controls */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <button onClick={handleLogout} title="Logout"
            className="nav-link"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'var(--red-dim)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.background = ''; }}>
            <LogOut size={16} />
          </button>
          <div className="avatar" style={{ width: '30px', height: '30px', fontSize: '12px' }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
        </div>
      </aside>

      {/* Page Content */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <Outlet />
      </main>
    </div>
  );
}

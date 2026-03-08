import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { Bell, CheckCheck } from 'lucide-react';

const TYPE_ICONS  = { mention: '@', task_assigned: '☑', comment: '💬', workspace_invite: '✉', task_moved: '→' };
const TYPE_COLORS = { mention: '#4F6EF7', task_assigned: '#22D3A4', comment: '#A78BFA', workspace_invite: '#F5A623', task_moved: '#F87171' };
const FILTERS = ['All', 'Mentions', 'Tasks', 'Comments'];

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [activeFilter, setActiveFilter] = useState('All');

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
  });
  const notifications = data?.notifications || [];
  const unread = notifications.filter(n => !n.isRead);

  const markRead = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });
  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });

  return (
    <div className="page-scroll" style={{ maxWidth: '680px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          {unread.length > 0 && (
            <p className="page-subtitle">{unread.length} unread notification{unread.length !== 1 ? 's' : ''}</p>
          )}
        </div>
        {unread.length > 0 && (
          <button onClick={() => markAllRead.mutate()} className="btn btn-secondary" style={{ fontSize: '12px' }}>
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setActiveFilter(f)}
            className={`filter-pill${activeFilter === f ? ' active' : ''}`}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {notifications.length === 0 ? (
          <div className="empty-state">
            <Bell size={32} className="empty-state-icon" />
            <p className="empty-state-text">You're all caught up</p>
          </div>
        ) : notifications.map(n => {
          const color = TYPE_COLORS[n.type] || '#4F6EF7';
          return (
            <div key={n.id} onClick={() => !n.isRead && markRead.mutate(n.id)}
              className={`notif-item ${n.isRead ? 'read' : 'unread'}`}>
              <div className="notif-icon" style={{ background: color + '1A', borderColor: color + '40' }}>
                {TYPE_ICONS[n.type] || '🔔'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '3px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)' }}>
                    {n.type?.replace(/_/g, ' ')}
                  </p>
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', flexShrink: 0 }}>
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.4 }}>{n.message}</p>
              </div>
              {!n.isRead && <div className="notif-dot" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

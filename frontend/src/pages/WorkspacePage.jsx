import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { Plus, Users } from 'lucide-react';

const STATUS_COLOR = { active: '#22D3A4', archived: '#4A5578', completed: '#4F6EF7' };

export default function WorkspacePage() {
  const user = useAuthStore((s) => s.user);
  const workspaceId = useAuthStore((s) => s.workspaceId);
  const navigate = useNavigate();

  const { data: projectsData } = useQuery({
    queryKey: ['workspace-projects', workspaceId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/projects`).then(r => r.data),
    enabled: !!workspaceId,
  });

  const { data: activityData } = useQuery({
    queryKey: ['workspace-activity', workspaceId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/activity`).then(r => r.data),
    enabled: !!workspaceId,
    refetchInterval: 15000,
  });

  const projects = projectsData?.projects || [];
  const activity = activityData?.activity || [];

  const stats = [
    { label: 'Total Projects', value: projects.length,                                   color: '#4F6EF7' },
    { label: 'Active',         value: projects.filter(p => p.status === 'active').length, color: '#22D3A4' },
    { label: 'Completed',      value: projects.filter(p => p.status === 'completed').length, color: '#A78BFA' },
    { label: 'Team Events',    value: activity.length,                                    color: '#F5A623' },
  ];

  return (
    <div className="page-scroll">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Good morning, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">{projects.length} active projects in your workspace</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/projects')} className="btn btn-secondary">
            <Users size={14} /> Invite Member
          </button>
          <button onClick={() => navigate('/projects')} className="btn btn-primary">
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} className="stat-card" style={{ '--accent-color': color }}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 268px', gap: '18px' }}>
        {/* Projects list */}
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '12px', letterSpacing: '-0.01em' }}>
            Projects
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {projects.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No projects yet</p>
                <button onClick={() => navigate('/projects')} className="btn btn-primary" style={{ fontSize: '13px' }}>
                  + Create your first project
                </button>
              </div>
            ) : projects.map(p => {
              const color = STATUS_COLOR[p.status] || '#4F6EF7';
              return (
                <div key={p.id} onClick={() => navigate(`/project/${p.id}`)}
                  className="card card-interactive"
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px' }}>
                  <div style={{ width: '3px', height: '40px', borderRadius: '999px', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '14px', letterSpacing: '-0.01em' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>
                  </div>
                  <span className="badge" style={{ background: color + '1A', color, borderColor: color + '40' }}>
                    {p.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity feed */}
        <div className="card" style={{ padding: '16px', height: 'fit-content' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '14px', letterSpacing: '-0.01em' }}>
            Recent Activity
          </h2>
          {activity.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>No activity yet</p>
          ) : activity.slice(0, 8).map((a, i) => (
            <div key={i} className="activity-item">
              <div className="avatar avatar-sm">
                {a.userId?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="activity-text">{a.eventType?.replace(/_/g, ' ')}</div>
                <div className="activity-time">{new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

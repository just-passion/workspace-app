import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { Plus, Users, ExternalLink } from 'lucide-react';

const STATUS_COLOR = { active: '#22D3A4', archived: '#4A5578', completed: '#4F6EF7' };
const AVATAR_COLORS = [
  { bg: 'rgba(79,110,247,0.2)', border: 'rgba(79,110,247,0.35)', color: '#7B97FF' },
  { bg: 'rgba(167,139,250,0.2)', border: 'rgba(167,139,250,0.35)', color: '#A78BFA' },
  { bg: 'rgba(34,211,164,0.2)', border: 'rgba(34,211,164,0.35)', color: '#22D3A4' },
  { bg: 'rgba(245,166,35,0.2)', border: 'rgba(245,166,35,0.35)', color: '#F5A623' },
  { bg: 'rgba(248,113,113,0.2)', border: 'rgba(248,113,113,0.35)', color: '#F87171' },
];

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function WorkspacePage() {
  const user = useAuthStore((s) => s.user);
  const workspaceId = useAuthStore((s) => s.workspaceId);
  const navigate = useNavigate();

  const { data: projectsData } = useQuery({
    queryKey: ['workspace-projects', workspaceId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/projects`).then(r => r.data),
    enabled: !!workspaceId,
  });

  const { data: statsData } = useQuery({
    queryKey: ['workspace-stats', workspaceId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/stats`).then(r => r.data),
    enabled: !!workspaceId,
    refetchInterval: 30000,
  });

  const { data: membersData } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => api.get(`/workspaces/${workspaceId}/members`).then(r => r.data),
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
  const members  = membersData?.members || [];
  const stats    = statsData || {};

  const statCards = [
    { label: 'Total Tasks',  value: stats.totalTasks ?? 0,                   color: '#4F6EF7' },
    { label: 'In Progress',  value: stats.inProgress  ?? 0,                   color: '#F5A623' },
    { label: 'Completed',    value: stats.completed   ?? 0,                   color: '#22D3A4' },
    { label: 'Team Members', value: stats.memberCount ?? members.length ?? 0, color: '#A78BFA' },
  ];

  return (
    <div className="page-scroll">
      <div className="page-header">
        <div>
          <h1 className="page-title">{getGreeting()}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''} in your workspace</p>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
        {statCards.map(({ label, value, color }) => (
          <div key={label} className="stat-card" style={{ '--accent-color': color }}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '18px' }}>
        <div>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '12px' }}>Projects</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {projects.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-text">No projects yet</p>
                <button onClick={() => navigate('/projects')} className="btn btn-primary">+ Create first project</button>
              </div>
            ) : projects.map(p => {
              const color = STATUS_COLOR[p.status] || '#4F6EF7';
              return (
                <div key={p.id} onClick={() => navigate(`/project/${p.id}`)}
                  className="card card-interactive"
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px' }}>
                  <div style={{ width: '3px', height: '40px', borderRadius: '999px', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '14px' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description || 'No description'}</div>
                  </div>
                  <span className="badge" style={{ background: color + '1A', color, borderColor: color + '40' }}>{p.status}</span>
                  <ExternalLink size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '14px' }}>Team Members</h2>
            {members.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>No members yet</p>
            ) : members.map((m, i) => {
              const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const name = m.user?.name || '?';
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: i < members.length - 1 ? '10px' : 0 }}>
                  <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '11px', background: av.bg, border: `2px solid ${av.border}`, color: av.color }}>
                    {name[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-1)', fontWeight: 500 }}>{name}</div>
                    <div style={{ fontSize: '11px', color: '#22D3A4', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22D3A4' }} />online
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'capitalize' }}>{m.role}</div>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '14px' }}>Recent Activity</h2>
            {activity.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>No activity yet</p>
            ) : activity.slice(0, 6).map((a, i) => {
              const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <div key={i} className="activity-item">
                  <div className="avatar avatar-sm" style={{ background: av.bg, border: `1.5px solid ${av.border}`, color: av.color }}>
                    {a.userId?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="activity-text" style={{ fontWeight: 500 }}>{a.eventType?.replace(/_/g, ' ')}</div>
                    <div className="activity-time">{timeAgo(a.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
